# Batch Processing Workflow

Complete guide to the OpenAI Batch API integration for processing LinkedIn connections.

## Overview

The batch processing workflow allows users to:
1. Upload their LinkedIn data export
2. Save their OpenAI API key
3. Process connections with AI to extract location data
4. Track batch jobs and download results

## User Flow

### 1. Home Page (`/`)

**Components:**
- `ApiKeyInput` - Secure API key storage
- `UploadArea` - LinkedIn ZIP upload
- Navigation button (appears after upload)

**Actions:**
1. User enters OpenAI API key → Saved to IndexedDB
2. User uploads LinkedIn ZIP → Binary data saved to IndexedDB
3. "Continue to Process Data" button appears → Navigates to `/process`

### 2. Process Page (`/process`)

**Features:**
- Personalized greeting from Profile.csv
- Batch creation with optional limit
- Real-time batch status tracking
- Result downloads
- Batch history management

**Components:**
- Profile display
- Batch creation form
- Batch list with status

## Data Flow

```
┌─────────────────┐
│  Upload ZIP     │
│  + API Key      │
└────────┬────────┘
         │
         v
┌─────────────────┐
│  IndexedDB      │
│  - ZIP binary   │
│  - API key      │
│  - Batches []   │
└────────┬────────┘
         │
         v
┌─────────────────┐
│  Extract Files  │
│  - Profile.csv  │
│  - Connections  │
└────────┬────────┘
         │
         v
┌─────────────────┐
│  Create Batch   │
│  - Parse CSV    │
│  - Gen JSONL    │
│  - Upload       │
└────────┬────────┘
         │
         v
┌─────────────────┐
│  OpenAI API     │
│  - Batch API    │
│  - Web Search   │
└────────┬────────┘
         │
         v
┌─────────────────┐
│  Poll Status    │
│  - Auto-poll    │
│  - Update IDB   │
└────────┬────────┘
         │
         v
┌─────────────────┐
│  Download       │
│  Results JSON   │
└─────────────────┘
```

## File Structure

### Utilities

**`app/lib/profile-utils.ts`**
- Extract and parse Profile.csv
- Get user display name
- Type-safe profile interface

```typescript
interface LinkedInProfile {
  firstName: string;
  lastName: string;
  headline?: string;
  summary?: string;
  // ... more fields
}
```

**`app/lib/batch-storage.ts`**
- Store/retrieve batches in IndexedDB
- Track batch status
- Manage batch lifecycle

```typescript
interface StoredBatch {
  batchId: string;
  createdAt: number;
  status: BatchStatus;
  fileId: string;
  outputFileId?: string;
  requestCounts?: {
    total: number;
    completed: number;
    failed: number;
  };
  metadata?: {
    connectionsCount: number;
    description?: string;
  };
}
```

**`app/lib/batch-api.ts`**
- Create OpenAI batches
- Check batch status
- Download results

### Pages

**`app/page.tsx`** (Home)
- Upload interface
- API key management
- Navigation to process page

**`app/process/page.tsx`**
- Batch creation
- Status tracking
- Result downloads

## API Integration

### Creating a Batch

```typescript
const result = await createBatch(limit?: number);
```

**Steps:**
1. Get API key from IndexedDB
2. Extract Connections.csv from ZIP
3. Parse CSV and apply limit
4. Generate JSONL with structured output schema
5. Upload file to OpenAI
6. Create batch job
7. Store batch metadata in IndexedDB

**Structured Output Schema:**

```typescript
{
  current_location: {
    city: string;
    state: string | null;
    country: string;
    latitude: number | null;
    longitude: number | null;
    openstreetmap_id: string | null;
  },
  location_move_date: string | null,
  linkedin_stats: {
    connections: number | null;
    followers: number | null;
  },
  about: string | null,
  education: Array<{
    institution: string;
    degree: string | null;
    field_of_study: string | null;
    start_year: number | null;
    end_year: number | null;
  }>,
  data_freshness: string,
  sources: string[]
}
```

### Checking Status

```typescript
const result = await checkBatchStatus(batchId);
```

**Auto-polling:**
- Runs on page load
- Polls every 60 seconds
- Only checks pending batches
- Updates IndexedDB automatically

**Batch Statuses:**
- `validating` - File validation in progress
- `in_progress` - Processing requests
- `finalizing` - Completing batch
- `completed` - Done, results available
- `failed` - Batch failed
- `expired` - Expired before completion
- `cancelled` - User cancelled

### Downloading Results

```typescript
const result = await downloadBatchResults(outputFileId);
```

**Process:**
1. Fetch results from OpenAI
2. Parse JSONL response
3. Create JSON blob
4. Trigger browser download

## IndexedDB Schema

**Database:** `helloAgain` (v2)

**Stores:**

1. **settings**
   - `openai_api_key` → string
   - `batches` → StoredBatch[]

2. **uploads**
   - `linkedinZip` → UploadInfo (with binary data)

## Features

### Profile Personalization

- Extracts Profile.csv from ZIP
- Parses user's first name
- Displays "Hello [Name]" greeting
- Shows profile info (headline, etc.)

### Batch Limits

- Optional numeric input
- Limits connections processed
- Useful for testing
- No limit by default

### Status Tracking

- Real-time status updates
- Progress indicators
- Auto-refresh every 60 seconds
- Visual status badges

### Batch Management

- List all batches (newest first)
- Refresh individual batch status
- Download completed results
- Delete batches

## Usage Examples

### Creating a Test Batch

1. Go to `/process` page
2. Enter `10` in the limit field
3. Click "Create Batch"
4. Wait for status to change to `completed`
5. Click "Download" button

### Processing All Connections

1. Leave limit field empty
2. Click "Create Batch"
3. Monitor progress in batch list
4. Auto-polls every 60 seconds
5. Download when complete

### Managing Multiple Batches

```typescript
// Get all batches
const batches = await getAllBatches();

// Get only pending
const pending = await getPendingBatches();

// Get only completed
const completed = await getCompletedBatches();

// Delete a batch
await deleteBatch(batchId);

// Clear all
await clearAllBatches();
```

## Error Handling

### Common Errors

**"API key not found"**
- Solution: Go to home page and save API key

**"ZIP file not found"**
- Solution: Upload LinkedIn export ZIP

**"Connections.csv not found"**
- Solution: Ensure LinkedIn export includes connections

**"Batch creation failed"**
- Check API key validity
- Verify sufficient API credits
- Check network connection

### Recovery

If a batch fails:
1. Check error message in batch details
2. Fix the issue (API key, credits, etc.)
3. Create a new batch
4. Previous batches remain in history

## Performance

### Batch Processing Times

- **Validation:** ~1-2 minutes
- **Processing:** Varies by size
  - 10 connections: ~5-10 minutes
  - 100 connections: ~30-60 minutes
  - 500+ connections: Several hours

### Costs

Using `gpt-4o-mini`:
- ~$0.075 per 1M input tokens (50% batch discount)
- ~$0.30 per 1M output tokens (50% batch discount)

**Estimates:**
- 10 connections: ~$0.02 - $0.05
- 100 connections: ~$0.20 - $0.50
- 500 connections: ~$1.00 - $2.50

### Limits

- Max 50,000 requests per batch
- Max 100 MB file size
- 24-hour completion window
- Results stored for 90 days

## Security

- API keys stored only in browser IndexedDB
- ZIP files processed client-side
- No data sent to your servers
- Direct OpenAI API communication
- CORS-safe browser environment

## Troubleshooting

### Batch Stuck in "validating"

Wait 2-3 minutes, then refresh status. If still stuck after 10 minutes, delete and recreate.

### Status Not Updating

Click the refresh button (↻) manually, or wait for next auto-poll cycle.

### Download Not Working

1. Check if batch status is "completed"
2. Verify outputFileId exists
3. Check browser console for errors
4. Try downloading again

### Profile Name Not Showing

1. Check if Profile.csv exists in ZIP
2. Verify CSV format matches LinkedIn export
3. Check browser console for parsing errors

## Best Practices

1. **Test First:** Use limit=10 for initial test
2. **Monitor Progress:** Check status periodically
3. **Save Batch IDs:** Keep record of batch IDs
4. **Download Results:** Save results locally when complete
5. **Clean Up:** Delete old batches to keep list manageable

## Future Enhancements

Potential features to add:
- Batch result visualization
- Map view of connections
- Export to CSV
- Batch comparison
- Cost estimator
- Retry failed requests
- Pause/resume batches
- Email notifications

## API References

- [OpenAI Batch API](https://platform.openai.com/docs/guides/batch)
- [Structured Outputs](https://platform.openai.com/docs/guides/structured-outputs)
- [gpt-4o-mini Model](https://platform.openai.com/docs/models/gpt-4o-mini)

## License

MIT
