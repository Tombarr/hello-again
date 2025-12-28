/**
 * LinkedIn Connections to OpenAI Batch API Processor
 * Runs client-side in the browser
 */

// ============================================================================
// Type Definitions
// ============================================================================

export interface CurrentLocation {
  city: string;
  state: string | null;
  country: string;
  latitude: number | null;
  longitude: number | null;
  openstreetmap_id: string | null;
}

export interface LinkedInStats {
  connections: number | null;
  followers: number | null;
}

export interface Education {
  institution: string;
  degree: string | null;
  field_of_study: string | null;
  start_year: number | null;
  end_year: number | null;
}

export interface LocationInfo {
  current_location: CurrentLocation;
  location_move_date: string | null;
  linkedin_stats: LinkedInStats;
  about: string | null;
  education: Education[];
  data_freshness: string;
  sources: string[];
}

export interface LinkedInConnection {
  firstName: string;
  lastName: string;
  url: string;
  emailAddress?: string;
  company?: string;
  position?: string;
  connectedOn?: string;
  [key: string]: string | undefined;
}

export interface BatchRequestMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface BatchRequestBody {
  model: string;
  messages: BatchRequestMessage[];
  response_format: {
    type: 'json_schema';
    json_schema: {
      name: string;
      strict: boolean;
      schema: typeof LOCATION_INFO_SCHEMA;
    };
  };
  tools: Array<{ type: 'web_search' }>;
}

export interface BatchRequest {
  custom_id: string;
  method: 'POST';
  url: '/v1/chat/completions';
  body: BatchRequestBody;
}

export interface BatchInfo {
  batchId: string;
  status: BatchStatus;
  fileId: string;
  createdAt: number;
}

export type BatchStatus =
  | 'validating'
  | 'failed'
  | 'in_progress'
  | 'finalizing'
  | 'completed'
  | 'expired'
  | 'cancelling'
  | 'cancelled';

export interface RequestCounts {
  total: number;
  completed: number;
  failed: number;
}

export interface BatchStatusResponse {
  id: string;
  object: 'batch';
  endpoint: string;
  errors?: {
    object: string;
    data: Array<{
      code: string;
      message: string;
      param: string | null;
      line: number | null;
    }>;
  };
  input_file_id: string;
  completion_window: string;
  status: BatchStatus;
  output_file_id?: string;
  error_file_id?: string;
  created_at: number;
  in_progress_at?: number;
  expires_at?: number;
  finalizing_at?: number;
  completed_at?: number;
  failed_at?: number;
  expired_at?: number;
  cancelling_at?: number;
  cancelled_at?: number;
  request_counts?: RequestCounts;
  metadata?: Record<string, string>;
}

export interface BatchResultResponse {
  id: string;
  custom_id: string;
  response: {
    status_code: number;
    request_id: string;
    body: {
      id: string;
      object: 'chat.completion';
      created: number;
      model: string;
      choices: Array<{
        index: number;
        message: {
          role: 'assistant';
          content: string;
        };
        finish_reason: string;
      }>;
      usage: {
        prompt_tokens: number;
        completion_tokens: number;
        total_tokens: number;
      };
    };
  };
  error?: {
    code: string;
    message: string;
  };
}

export interface ProcessResult {
  batchInfo: BatchInfo;
  jsonlContent: string;
  connectionsCount: number;
}

export interface FileUploadResponse {
  id: string;
  object: 'file';
  bytes: number;
  created_at: number;
  filename: string;
  purpose: string;
}

export interface BatchCreateResponse {
  id: string;
  object: 'batch';
  endpoint: string;
  input_file_id: string;
  completion_window: string;
  status: BatchStatus;
  created_at: number;
  metadata?: Record<string, string>;
}

export interface JSONSchemaProperty {
  type: string | string[];
  description?: string;
  properties?: Record<string, JSONSchemaProperty>;
  items?: JSONSchemaProperty;
  required?: string[];
  additionalProperties?: boolean;
}

export interface JSONSchema {
  type: 'object';
  properties: Record<string, JSONSchemaProperty>;
  required: string[];
  additionalProperties: boolean;
}

// ============================================================================
// Constants
// ============================================================================

/**
 * JSON Schema for structured output from OpenAI
 */
export const LOCATION_INFO_SCHEMA: JSONSchema = {
  type: 'object',
  properties: {
    current_location: {
      type: 'object',
      properties: {
        city: { type: 'string' },
        state: { type: ['string', 'null'] },
        country: { type: 'string' },
        latitude: { type: ['number', 'null'] },
        longitude: { type: ['number', 'null'] },
        openstreetmap_id: { type: ['string', 'null'] },
      },
      required: ['city', 'country'],
      additionalProperties: false,
    },
    location_move_date: {
      type: ['string', 'null'],
      description: 'ISO 8601 date format (YYYY-MM-DD) when they moved to current location',
    },
    linkedin_stats: {
      type: 'object',
      properties: {
        connections: { type: ['integer', 'null'] },
        followers: { type: ['integer', 'null'] },
      },
      additionalProperties: false,
    },
    about: {
      type: ['string', 'null'],
      description: 'Biography or about section from LinkedIn profile',
    },
    education: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          institution: { type: 'string' },
          degree: { type: ['string', 'null'] },
          field_of_study: { type: ['string', 'null'] },
          start_year: { type: ['integer', 'null'] },
          end_year: { type: ['integer', 'null'] },
        },
        required: ['institution'],
        additionalProperties: false,
      },
    },
    data_freshness: {
      type: 'string',
      description: 'Date when this information was retrieved (ISO 8601 format)',
    },
    sources: {
      type: 'array',
      items: { type: 'string' },
      description: 'URLs or sources used to gather this information',
    },
  },
  required: ['current_location', 'linkedin_stats', 'data_freshness'],
  additionalProperties: false,
};

// ============================================================================
// Core Functions
// ============================================================================

/**
 * Generate improved prompt for individual lookup
 */
export function generatePrompt(person: LinkedInConnection): string {
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
 */
export async function parseLinkedInCSV(file: File): Promise<LinkedInConnection[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (event: ProgressEvent<FileReader>) => {
      try {
        const text = event.target?.result as string;
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
        const connections: LinkedInConnection[] = [];

        // Parse data rows
        for (let i = headerIndex + 1; i < lines.length; i++) {
          const line = lines[i].trim();
          if (!line) continue;

          const values = parseCSVLine(line);
          if (values.length === headers.length) {
            const connection: Partial<LinkedInConnection> = {};
            headers.forEach((header, index) => {
              connection[toCamelCase(header)] = values[index];
            });
            connections.push(connection as LinkedInConnection);
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
export function parseCSVLine(line: string): string[] {
  const result: string[] = [];
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
export function toCamelCase(str: string): string {
  return str
    .toLowerCase()
    .replace(/[^a-zA-Z0-9]+(.)/g, (_match, chr) => chr.toUpperCase());
}

/**
 * Generate JSONL batch file for OpenAI Batch API
 */
export function generateBatchJSONL(connections: LinkedInConnection[]): string {
  const requests: BatchRequest[] = connections.map((person, index) => {
    return {
      custom_id: `request-${index + 1}-${person.firstName}-${person.lastName}`.replace(/\s+/g, '-'),
      method: 'POST',
      url: '/v1/chat/completions',
      body: {
        model: 'gpt-4o-mini-search-preview-2025-03-11',
        messages: [
          {
            role: 'system',
            content:
              'You are a helpful assistant that searches the web for professional information about individuals. Always use the web_search tool to find current and accurate information. Return data in the specified JSON structure.',
          },
          {
            role: 'user',
            content: generatePrompt(person),
          },
        ],
        response_format: {
          type: 'json_schema',
          json_schema: {
            name: 'location_info',
            strict: true,
            schema: LOCATION_INFO_SCHEMA,
          },
        },
        tools: [
          {
            type: 'web_search',
          },
        ],
      },
    };
  });

  return requests.map((req) => JSON.stringify(req)).join('\n');
}

/**
 * Upload JSONL to OpenAI Batch API
 */
export async function uploadBatchFile(jsonlContent: string, apiKey: string): Promise<BatchInfo> {
  // Step 1: Upload the file
  const blob = new Blob([jsonlContent], { type: 'application/jsonl' });
  const formData = new FormData();
  formData.append('file', blob, 'batch_requests.jsonl');
  formData.append('purpose', 'batch');

  const uploadResponse = await fetch('https://api.openai.com/v1/files', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
    body: formData,
  });

  if (!uploadResponse.ok) {
    const error = await uploadResponse.json();
    throw new Error(`File upload failed: ${JSON.stringify(error)}`);
  }

  const fileData: FileUploadResponse = await uploadResponse.json();
  const fileId = fileData.id;

  console.log(`File uploaded successfully. File ID: ${fileId}`);

  // Step 2: Create the batch
  const batchResponse = await fetch('https://api.openai.com/v1/batches', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      input_file_id: fileId,
      endpoint: '/v1/chat/completions',
      completion_window: '24h',
      metadata: {
        description: 'LinkedIn connections location lookup',
        created_at: new Date().toISOString(),
      },
    }),
  });

  if (!batchResponse.ok) {
    const error = await batchResponse.json();
    throw new Error(`Batch creation failed: ${JSON.stringify(error)}`);
  }

  const batchData: BatchCreateResponse = await batchResponse.json();

  return {
    batchId: batchData.id,
    status: batchData.status,
    fileId: fileId,
    createdAt: batchData.created_at,
  };
}

/**
 * Check batch status
 */
export async function checkBatchStatus(batchId: string, apiKey: string): Promise<BatchStatusResponse> {
  const response = await fetch(`https://api.openai.com/v1/batches/${batchId}`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`Failed to check batch status: ${JSON.stringify(error)}`);
  }

  return await response.json();
}

/**
 * Download batch results
 */
export async function downloadBatchResults(
  outputFileId: string,
  apiKey: string
): Promise<BatchResultResponse[]> {
  const response = await fetch(`https://api.openai.com/v1/files/${outputFileId}/content`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`Failed to download results: ${JSON.stringify(error)}`);
  }

  const text = await response.text();
  return text
    .split('\n')
    .filter((line) => line.trim())
    .map((line) => JSON.parse(line));
}

/**
 * Main processor function - orchestrates the entire flow
 */
export async function processLinkedInConnections(csvFile: File, apiKey: string): Promise<ProcessResult> {
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
    connectionsCount: connections.length,
  };
}

// ============================================================================
// Browser/Module Compatibility
// ============================================================================

// For CommonJS environments
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    parseLinkedInCSV,
    generateBatchJSONL,
    uploadBatchFile,
    checkBatchStatus,
    downloadBatchResults,
    processLinkedInConnections,
    generatePrompt,
    parseCSVLine,
    toCamelCase,
    LOCATION_INFO_SCHEMA,
  };
}
