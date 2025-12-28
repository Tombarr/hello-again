# LinkedIn Connections Batch Processor for OpenAI

Process LinkedIn connections CSV exports and generate OpenAI Batch API requests to gather detailed location and professional information using web search.

## Features

- **Browser-based** - No server required, runs entirely client-side
- **Zero dependencies** - Pure JavaScript, no npm packages needed
- **Structured outputs** - JSON Schema ensures consistent, parseable responses
- **Web search enabled** - Uses `gpt-4o-mini-search-preview-2025-03-11` with web_search tool
- **Batch API integration** - Upload, track, and download batch results
- **Cost-effective** - Batch API offers 50% discount vs real-time API

## Files

- `linkedin-batch-processor.js` - Core processing functions
- `batch-processor-demo.html` - Interactive web UI
- `BATCH_PROCESSOR_README.md` - This file

## Quick Start

1. **Download your LinkedIn connections**:
   - Go to LinkedIn Settings → Data Privacy → Get a copy of your data
   - Download "Connections" export (CSV file)

2. **Open the demo**:
   ```bash
   open batch-processor-demo.html
   ```

3. **Process your connections**:
   - Enter your OpenAI API key (get one at https://platform.openai.com/api-keys)
   - Upload your `Connections.csv` file
   - Click "Process & Upload Batch"
   - Save the Batch ID displayed

4. **Check status later** (batches take time to complete):
   - The Batch ID is saved in localStorage
   - Click "Check Status" to see progress
   - When complete, click "Download Results"

## Prompt Improvements

### Original Issues
The original prompt in `locate-prompt.txt` had several limitations:
- No structured output format
- Unclear date format expectations
- No guidance on handling missing/ambiguous data
- No source attribution

### Improvements Implemented

#### 1. **Structured JSON Schema**
Instead of free-form text responses, we enforce a strict JSON schema:

```javascript
{
  current_location: {
    city: string,
    state: string | null,
    country: string,
    latitude: number | null,
    longitude: number | null,
    openstreetmap_id: string | null
  },
  location_move_date: string | null,  // ISO 8601: YYYY-MM-DD
  linkedin_stats: {
    connections: number | null,
    followers: number | null
  },
  about: string | null,
  education: [{
    institution: string,
    degree: string | null,
    field_of_study: string | null,
    start_year: number | null,
    end_year: number | null
  }],
  data_freshness: string,  // ISO 8601 date when retrieved
  sources: [string]  // URLs used
}
```

**Benefits**:
- Guaranteed parseable output
- Type safety
- Consistent field names
- Clear null handling

#### 2. **Enhanced Prompt Language**

```text
OLD: "Provide the following information for this individual..."

NEW: "Search the web and LinkedIn to find the following information about
this individual. Use the most recent and reliable sources available."
```

**Improvements**:
- Explicit instruction to use web search
- Emphasis on recency and reliability
- Clearer task framing

#### 3. **Date Format Specification**

```text
Added: "For dates, use ISO 8601 format (YYYY-MM-DD)"
```

**Benefits**:
- Machine-readable dates
- No ambiguity (US vs EU format)
- Easy sorting and filtering

#### 4. **Handling Ambiguity**

```text
Added: "If multiple locations or unclear information is found,
use the most recent or most credible source"
```

**Benefits**:
- Clear decision-making guidance
- Reduces hallucination
- Prioritizes quality

#### 5. **Source Attribution**

```text
Added: "List all URLs and sources you used to gather this information"
```

**Benefits**:
- Verification capability
- Transparency
- Compliance with data sourcing requirements

#### 6. **Data Freshness Tracking**

```text
Added: "Record the current date as data_freshness"
```

**Benefits**:
- Know when data was retrieved
- Track staleness
- Re-run old queries if needed

## API Usage

### Programmatic Usage (JavaScript)

```javascript
// Import the processor
import { processLinkedInConnections } from './linkedin-batch-processor.js';

// Process a file
const csvFile = /* File object from input */;
const apiKey = 'sk-proj-...';

const result = await processLinkedInConnections(csvFile, apiKey);

console.log(`Batch ID: ${result.batchInfo.batchId}`);
console.log(`Processing ${result.connectionsCount} connections`);

// Save batch ID for later
localStorage.setItem('batchId', result.batchInfo.batchId);
```

### Check Batch Status

```javascript
import { checkBatchStatus } from './linkedin-batch-processor.js';

const batchId = 'batch_...';
const status = await checkBatchStatus(batchId, apiKey);

console.log(`Status: ${status.status}`);
console.log(`Completed: ${status.request_counts.completed}/${status.request_counts.total}`);
```

### Download Results

```javascript
import { downloadBatchResults } from './linkedin-batch-processor.js';

// First get the output file ID
const status = await checkBatchStatus(batchId, apiKey);

if (status.status === 'completed') {
  const results = await downloadBatchResults(status.output_file_id, apiKey);

  // Process results
  results.forEach(result => {
    const customId = result.custom_id;
    const response = result.response.body.choices[0].message.content;
    const data = JSON.parse(response);

    console.log(`${customId}: ${data.current_location.city}, ${data.current_location.country}`);
  });
}
```

## Batch API Details

### Pricing
- **50% discount** compared to synchronous API
- gpt-4o-mini-search-preview: ~$0.15 per 1M input tokens, ~$0.60 per 1M output tokens (with batch discount)

### Timing
- Completion window: 24 hours
- Most batches complete within a few hours
- Check status periodically

### Limits
- Max 50,000 requests per batch
- Max 100 MB file size
- Max 90 days result retention

### Status Values
- `validating` - File is being validated
- `in_progress` - Requests are being processed
- `finalizing` - Batch is wrapping up
- `completed` - All done, results available
- `failed` - Batch failed (check errors)
- `expired` - Batch expired before completion
- `cancelled` - Batch was cancelled

## Result Processing

Results are returned as JSONL, where each line is:

```json
{
  "id": "batch_req_...",
  "custom_id": "request-1-John-Doe",
  "response": {
    "status_code": 200,
    "body": {
      "choices": [{
        "message": {
          "content": "{\"current_location\":{\"city\":\"San Francisco\",\"state\":\"California\",\"country\":\"United States\",\"latitude\":37.7749,\"longitude\":-122.4194,\"openstreetmap_id\":\"R111968\"},\"location_move_date\":\"2023-06-15\",\"linkedin_stats\":{\"connections\":500,\"followers\":1200},\"about\":\"Software engineer passionate about...\",\"education\":[{\"institution\":\"Stanford University\",\"degree\":\"BS\",\"field_of_study\":\"Computer Science\",\"start_year\":2015,\"end_year\":2019}],\"data_freshness\":\"2025-12-28\",\"sources\":[\"https://linkedin.com/in/johndoe\"]}"
        }
      }]
    }
  }
}
```

Parse the `response.body.choices[0].message.content` as JSON to get structured data.

## Error Handling

Common errors and solutions:

### API Key Invalid
```
Error: File upload failed: {"error":{"message":"Incorrect API key..."}}
```
**Solution**: Check your API key at https://platform.openai.com/api-keys

### Model Not Available
```
Error: model 'gpt-4o-mini-search-preview-2025-03-11' not found
```
**Solution**: Verify you have access to the search preview model, or change model in the code

### File Too Large
```
Error: File upload failed: {"error":{"message":"File exceeds maximum size..."}}
```
**Solution**: Split your CSV into smaller batches

### Rate Limits
```
Error: Batch creation failed: {"error":{"type":"rate_limit_exceeded"}}
```
**Solution**: Wait a moment and try again, or upgrade your API tier

## Privacy & Security

- **API Key**: Only sent to OpenAI, never to any other server
- **CSV Data**: Processed entirely in your browser, not uploaded anywhere except OpenAI
- **HTTPS**: All API calls use HTTPS encryption
- **localStorage**: Batch IDs stored locally for convenience

## Advanced Usage

### Custom Filtering

Filter connections before creating batch:

```javascript
async function processOnlyRecent(csvFile, apiKey, daysAgo = 30) {
  const connections = await parseLinkedInCSV(csvFile);

  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - daysAgo);

  const recentConnections = connections.filter(conn => {
    const connDate = new Date(conn.connectedOn);
    return connDate >= cutoffDate;
  });

  const jsonl = generateBatchJSONL(recentConnections);
  const batchInfo = await uploadBatchFile(jsonl, apiKey);

  return batchInfo;
}
```

### Custom Schema

Modify `LOCATION_INFO_SCHEMA` in `linkedin-batch-processor.js` to add/remove fields:

```javascript
const CUSTOM_SCHEMA = {
  type: "object",
  properties: {
    // Add your custom fields
    current_employer: {
      type: "object",
      properties: {
        company: { type: "string" },
        start_date: { type: "string" }
      }
    },
    // ... rest of schema
  }
};
```

### Batch Monitoring

Poll batch status automatically:

```javascript
async function waitForCompletion(batchId, apiKey, intervalMs = 60000) {
  return new Promise((resolve, reject) => {
    const poll = setInterval(async () => {
      try {
        const status = await checkBatchStatus(batchId, apiKey);
        console.log(`Status: ${status.status} (${status.request_counts.completed}/${status.request_counts.total})`);

        if (status.status === 'completed') {
          clearInterval(poll);
          resolve(status);
        } else if (status.status === 'failed' || status.status === 'expired') {
          clearInterval(poll);
          reject(new Error(`Batch ${status.status}`));
        }
      } catch (error) {
        clearInterval(poll);
        reject(error);
      }
    }, intervalMs);
  });
}

// Usage
const status = await waitForCompletion(batchId, apiKey, 60000); // Poll every 60s
const results = await downloadBatchResults(status.output_file_id, apiKey);
```

## Troubleshooting

### JSONL Preview

To preview the generated JSONL before uploading:

1. Process file in the UI
2. Click "Download JSONL (Optional)"
3. Open in text editor
4. Verify format and content

### Testing with Single Connection

Create a test CSV with one connection:

```csv
First Name,Last Name,URL,Email Address,Company,Position,Connected On
Test,User,https://www.linkedin.com/in/testuser,,Test Corp,Engineer,28 Dec 2025
```

### Validate JSON Schema

Test schema compliance:

```javascript
const testResponse = {
  current_location: {
    city: "San Francisco",
    country: "USA"
  },
  linkedin_stats: {},
  data_freshness: "2025-12-28"
};

// Should match LOCATION_INFO_SCHEMA
console.log(JSON.stringify(testResponse, null, 2));
```

## Resources

- [OpenAI Batch API Documentation](https://platform.openai.com/docs/guides/batch)
- [OpenAI Structured Outputs](https://platform.openai.com/docs/guides/structured-outputs)
- [gpt-4o-mini-search-preview Model](https://platform.openai.com/docs/models/gpt-4o-mini-search-preview)
- [JSON Schema Documentation](https://json-schema.org/)
- [LinkedIn Data Export](https://www.linkedin.com/help/linkedin/answer/50191)

## License

MIT - Feel free to use and modify for your needs.
