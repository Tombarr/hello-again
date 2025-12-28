/**
 * LinkedIn Connections to OpenAI Batch API Processor
 * Runs client-side in the browser
 */

/**
 * JSON Schema for structured output from OpenAI
 */
const LOCATION_INFO_SCHEMA = {
  type: "object",
  properties: {
    current_location: {
      type: "object",
      properties: {
        city: { type: "string" },
        state: { type: ["string", "null"] },
        country: { type: "string" },
        latitude: { type: ["number", "null"] },
        longitude: { type: ["number", "null"] },
        openstreetmap_id: { type: ["string", "null"] }
      },
      required: ["city", "country"],
      additionalProperties: false
    },
    location_move_date: {
      type: ["string", "null"],
      description: "ISO 8601 date format (YYYY-MM-DD) when they moved to current location"
    },
    linkedin_stats: {
      type: "object",
      properties: {
        connections: { type: ["integer", "null"] },
        followers: { type: ["integer", "null"] }
      },
      additionalProperties: false
    },
    about: {
      type: ["string", "null"],
      description: "Biography or about section from LinkedIn profile"
    },
    education: {
      type: "array",
      items: {
        type: "object",
        properties: {
          institution: { type: "string" },
          degree: { type: ["string", "null"] },
          field_of_study: { type: ["string", "null"] },
          start_year: { type: ["integer", "null"] },
          end_year: { type: ["integer", "null"] }
        },
        required: ["institution"],
        additionalProperties: false
      }
    },
    data_freshness: {
      type: "string",
      description: "Date when this information was retrieved (ISO 8601 format)"
    },
    sources: {
      type: "array",
      items: { type: "string" },
      description: "URLs or sources used to gather this information"
    }
  },
  required: ["current_location", "linkedin_stats", "data_freshness"],
  additionalProperties: false
};

/**
 * Generate improved prompt for individual lookup
 */
function generatePrompt(person) {
  return `Search the web and LinkedIn to find the following information about this individual. Use the most recent and reliable sources available.

Individual Details:
- Name: ${person.firstName} ${person.lastName}
- LinkedIn: ${person.url}
- Current Company: ${person.company || 'Not specified'}
- Current Position: ${person.position || 'Not specified'}

Required Information:
1. CURRENT LOCATION: Find their current city, state (if applicable), and country. Include coordinates (latitude/longitude) and OpenStreetMap ID if available.

2. LOCATION HISTORY: Determine when they moved to their current location (provide date in YYYY-MM-DD format if found).

3. LINKEDIN STATISTICS: Find their current number of connections and followers.

4. ABOUT/BIO: Extract their LinkedIn "About" section or professional biography.

5. EDUCATION: List all educational institutions they attended, including degrees, fields of study, and years attended.

6. DATA SOURCES: List all URLs and sources you used to gather this information.

Instructions:
- Use web search to find the most current information available
- If specific data is not available, set the field to null
- For dates, use ISO 8601 format (YYYY-MM-DD)
- Prioritize information from LinkedIn and other professional networks
- Record the current date as data_freshness
- If multiple locations or unclear information is found, use the most recent or most credible source

Return all information in the structured JSON format specified.`;
}

/**
 * Parse CSV file from LinkedIn export
 * @param {File} file - The CSV file object
 * @returns {Promise<Array>} Array of connection objects
 */
async function parseLinkedInCSV(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (event) => {
      try {
        const text = event.target.result;
        const lines = text.split('\n');

        // Find the header line (skip notes at the top)
        let headerIndex = 0;
        for (let i = 0; i < lines.length; i++) {
          if (lines[i].includes('First Name,Last Name')) {
            headerIndex = i;
            break;
          }
        }

        const headers = parseCSVLine(lines[headerIndex]);
        const connections = [];

        // Parse data rows
        for (let i = headerIndex + 1; i < lines.length; i++) {
          const line = lines[i].trim();
          if (!line) continue;

          const values = parseCSVLine(line);
          if (values.length === headers.length) {
            const connection = {};
            headers.forEach((header, index) => {
              connection[toCamelCase(header)] = values[index];
            });
            connections.push(connection);
          }
        }

        resolve(connections);
      } catch (error) {
        reject(error);
      }
    };

    reader.onerror = () => reject(reader.error);
    reader.readAsText(file);
  });
}

/**
 * Parse a single CSV line handling quoted fields
 */
function parseCSVLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    const nextChar = line[i + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }

  result.push(current.trim());
  return result;
}

/**
 * Convert header to camelCase
 */
function toCamelCase(str) {
  return str
    .toLowerCase()
    .replace(/[^a-zA-Z0-9]+(.)/g, (match, chr) => chr.toUpperCase());
}

/**
 * Generate JSONL batch file for OpenAI Batch API
 * @param {Array} connections - Array of connection objects
 * @returns {string} JSONL content
 */
function generateBatchJSONL(connections) {
  const requests = connections.map((person, index) => {
    return {
      custom_id: `request-${index + 1}-${person.firstName}-${person.lastName}`.replace(/\s+/g, '-'),
      method: "POST",
      url: "/v1/chat/completions",
      body: {
        model: "gpt-4o-mini-search-preview-2025-03-11",
        messages: [
          {
            role: "system",
            content: "You are a helpful assistant that searches the web for professional information about individuals. Always use the web_search tool to find current and accurate information. Return data in the specified JSON structure."
          },
          {
            role: "user",
            content: generatePrompt(person)
          }
        ],
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "location_info",
            strict: true,
            schema: LOCATION_INFO_SCHEMA
          }
        },
        tools: [
          {
            type: "web_search"
          }
        ]
      }
    };
  });

  return requests.map(req => JSON.stringify(req)).join('\n');
}

/**
 * Upload JSONL to OpenAI Batch API
 * @param {string} jsonlContent - The JSONL content to upload
 * @param {string} apiKey - OpenAI API key
 * @returns {Promise<string>} Batch ID
 */
async function uploadBatchFile(jsonlContent, apiKey) {
  // Step 1: Upload the file
  const blob = new Blob([jsonlContent], { type: 'application/jsonl' });
  const formData = new FormData();
  formData.append('file', blob, 'batch_requests.jsonl');
  formData.append('purpose', 'batch');

  const uploadResponse = await fetch('https://api.openai.com/v1/files', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`
    },
    body: formData
  });

  if (!uploadResponse.ok) {
    const error = await uploadResponse.json();
    throw new Error(`File upload failed: ${JSON.stringify(error)}`);
  }

  const fileData = await uploadResponse.json();
  const fileId = fileData.id;

  console.log(`File uploaded successfully. File ID: ${fileId}`);

  // Step 2: Create the batch
  const batchResponse = await fetch('https://api.openai.com/v1/batches', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      input_file_id: fileId,
      endpoint: '/v1/chat/completions',
      completion_window: '24h',
      metadata: {
        description: 'LinkedIn connections location lookup',
        created_at: new Date().toISOString()
      }
    })
  });

  if (!batchResponse.ok) {
    const error = await batchResponse.json();
    throw new Error(`Batch creation failed: ${JSON.stringify(error)}`);
  }

  const batchData = await batchResponse.json();

  return {
    batchId: batchData.id,
    status: batchData.status,
    fileId: fileId,
    createdAt: batchData.created_at
  };
}

/**
 * Check batch status
 * @param {string} batchId - The batch ID to check
 * @param {string} apiKey - OpenAI API key
 * @returns {Promise<Object>} Batch status information
 */
async function checkBatchStatus(batchId, apiKey) {
  const response = await fetch(`https://api.openai.com/v1/batches/${batchId}`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${apiKey}`
    }
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`Failed to check batch status: ${JSON.stringify(error)}`);
  }

  return await response.json();
}

/**
 * Download batch results
 * @param {string} outputFileId - The output file ID from completed batch
 * @param {string} apiKey - OpenAI API key
 * @returns {Promise<Array>} Array of result objects
 */
async function downloadBatchResults(outputFileId, apiKey) {
  const response = await fetch(`https://api.openai.com/v1/files/${outputFileId}/content`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${apiKey}`
    }
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`Failed to download results: ${JSON.stringify(error)}`);
  }

  const text = await response.text();
  return text.split('\n').filter(line => line.trim()).map(line => JSON.parse(line));
}

/**
 * Main processor function - orchestrates the entire flow
 * @param {File} csvFile - The LinkedIn connections CSV file
 * @param {string} apiKey - OpenAI API key
 * @returns {Promise<Object>} Object containing batch info and JSONL content
 */
async function processLinkedInConnections(csvFile, apiKey) {
  console.log('Parsing CSV file...');
  const connections = await parseLinkedInCSV(csvFile);
  console.log(`Found ${connections.length} connections`);

  console.log('Generating batch requests...');
  const jsonlContent = generateBatchJSONL(connections);

  console.log('Uploading to OpenAI Batch API...');
  const batchInfo = await uploadBatchFile(jsonlContent, apiKey);

  return {
    batchInfo,
    jsonlContent,
    connectionsCount: connections.length
  };
}

// Export for use in browser or modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    parseLinkedInCSV,
    generateBatchJSONL,
    uploadBatchFile,
    checkBatchStatus,
    downloadBatchResults,
    processLinkedInConnections,
    LOCATION_INFO_SCHEMA
  };
}
