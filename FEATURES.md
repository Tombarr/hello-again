# Hello Again - Features Documentation

This document describes the core features and utilities for handling LinkedIn data uploads, API key management, and ZIP file processing.

## Table of Contents

- [IndexedDB Storage](#indexeddb-storage)
- [ZIP File Processing](#zip-file-processing)
- [Components](#components)
- [Usage Examples](#usage-examples)

---

## IndexedDB Storage

The app uses IndexedDB for client-side storage of sensitive data like API keys and uploaded ZIP files.

### Location

`app/lib/indexeddb.ts`

### Features

#### API Key Management

Securely store and retrieve OpenAI API keys in the browser's IndexedDB.

```typescript
import {
  saveApiKey,
  getApiKey,
  deleteApiKey,
  validateOpenAIApiKey
} from './lib/indexeddb';

// Validate API key format
const isValid = validateOpenAIApiKey('sk-proj-...');

// Save API key
await saveApiKey('sk-proj-...');

// Retrieve API key
const apiKey = await getApiKey(); // Returns string | null

// Delete API key
await deleteApiKey();
```

**API Key Validation:**
- Must start with `sk-` or `sk-proj-`
- Minimum 20 characters
- Trims whitespace automatically

#### ZIP File Storage

Store LinkedIn export ZIP files with binary data in IndexedDB.

```typescript
import {
  saveZipFile,
  getZipFileInfo,
  getZipFileData,
  getZipFileAsBlob,
  getZipFileAsObjectURL,
  deleteZipFile,
  hasZipFile
} from './lib/indexeddb';

// Save a ZIP file (stores binary data)
const file = event.target.files[0];
await saveZipFile(file);

// Get file metadata (without binary data)
const info = await getZipFileInfo();
console.log(info.name, info.size, info.storedAt);

// Get binary data as ArrayBuffer
const data = await getZipFileData();

// Get as Blob for processing
const blob = await getZipFileAsBlob();

// Get as Object URL for download links
const url = await getZipFileAsObjectURL();
// Use with: <a href={url} download="data.zip">Download</a>

// Check if a file is stored
const exists = await hasZipFile();

// Delete the stored file
await deleteZipFile();
```

**Storage Interface:**

```typescript
interface UploadInfo {
  name: string;
  size: number;
  type: string;
  lastModified: number;
  storedAt: number;
  data: ArrayBuffer;
}
```

### Database Schema

**Database Name:** `helloAgain`
**Version:** 2

**Object Stores:**

1. **uploads** - Stores ZIP file data
   - Key: `linkedinZip`
   - Value: `UploadInfo` object with binary data

2. **settings** - Stores application settings
   - Key: `openai_api_key`
   - Value: API key string

---

## ZIP File Processing

Fast and efficient ZIP file processing using `fflate`.

### Location

`app/lib/zip-utils.ts`

### Features

#### List ZIP Contents

```typescript
import { listZipContents } from './lib/zip-utils';

const blob = await getZipFileAsBlob();
const files = await listZipContents(blob);

files.forEach(file => {
  console.log(file.filename, file.uncompressedSize, file.directory);
});
```

**Returns:**

```typescript
interface ZipFileEntry {
  filename: string;
  directory: boolean;
  uncompressedSize: number;
  compressedSize: number;
  lastModDate?: Date;
}
```

#### Get Specific Files

```typescript
import {
  getZipFileByName,
  getZipFileAsText
} from './lib/zip-utils';

// Get file as Blob
const csvBlob = await getZipFileByName(blob, 'Connections.csv');

// Get file as text
const csvText = await getZipFileAsText(blob, 'Connections.csv');
```

#### Search for Files

```typescript
import { findZipFiles } from './lib/zip-utils';

// Find all CSV files
const csvFiles = await findZipFiles(blob, '*.csv');

// Find files in a directory
const dataFiles = await findZipFiles(blob, 'data/*');

// Recursive search
const allCsvs = await findZipFiles(blob, '**/*.csv');
```

**Pattern Matching:**
- `*` - Match any characters
- `?` - Match single character
- `**` - Match across directories

#### Extract Multiple Files

```typescript
import { extractZipFiles, extractAllFiles } from './lib/zip-utils';

// Extract specific files
const files = await extractZipFiles(blob, [
  'Connections.csv',
  'Profile.csv'
]);

files.forEach((blob, filename) => {
  console.log(`Extracted: ${filename}`);
});

// Extract all files
const allFiles = await extractAllFiles(blob);
```

#### LinkedIn-Specific Helpers

```typescript
import {
  getLinkedInConnections,
  getAllCsvFiles
} from './lib/zip-utils';

// Get Connections.csv automatically
// Searches common locations and paths
const connections = await getLinkedInConnections(blob);

// Get all CSV files from the export
const csvFiles = await getAllCsvFiles(blob);
```

#### Validation and Utilities

```typescript
import {
  isValidZipFile,
  zipFileExists,
  getFileCount,
  getTotalSize
} from './lib/zip-utils';

// Validate ZIP file
const valid = await isValidZipFile(blob);

// Check if file exists
const exists = await zipFileExists(blob, 'Connections.csv');

// Get file count
const count = await getFileCount(blob); // Excludes directories

// Get total size
const size = await getTotalSize(blob); // In bytes
```

---

## Components

### ApiKeyInput

Location: `app/components/ApiKeyInput.tsx`

Secure input component for OpenAI API key management.

**Features:**
- Password-style input with show/hide toggle
- Real-time validation
- Masked display when saved
- Stored in IndexedDB
- Auto-loads saved key on mount

**Props:** None (self-contained)

**Usage:**

```tsx
import ApiKeyInput from './components/ApiKeyInput';

export default function Page() {
  return (
    <div>
      <ApiKeyInput />
    </div>
  );
}
```

**User Flow:**
1. Enter API key (masked by default)
2. Click "Show" to reveal key
3. Click "Save API Key"
4. Key is validated and stored
5. On reload, key is displayed in masked form
6. Click "Remove Key" to delete

### UploadArea

Location: `app/components/UploadArea.tsx`

Drag-and-drop file upload component with IndexedDB storage.

**Features:**
- Drag-and-drop support
- Click to browse
- Binary data storage in IndexedDB
- Upload progress indicator
- File validation (ZIP only)
- Displays file metadata
- Persistent across page reloads

**Props:** None (self-contained)

**Usage:**

```tsx
import UploadArea from './components/UploadArea';

export default function Page() {
  return (
    <div>
      <UploadArea />
    </div>
  );
}
```

**User Flow:**
1. Drag ZIP file or click to browse
2. File is validated (must be .zip)
3. Binary data saved to IndexedDB
4. Shows upload progress
5. Displays file info after upload
6. Click ✕ to remove

### ZipFileViewer

Location: `app/components/ZipFileViewer.tsx`

Component to display ZIP file contents and preview data.

**Features:**
- Lists all CSV files found
- Shows Connections.csv preview
- Displays all files in archive
- Shows file sizes
- Collapsible file list
- Auto-loads from IndexedDB

**Props:** None (self-contained)

**Usage:**

```tsx
import ZipFileViewer from './components/ZipFileViewer';

export default function Page() {
  return (
    <div>
      <ZipFileViewer />
    </div>
  );
}
```

**Display Sections:**
1. **CSV Files Found** - List of all CSV files with sizes
2. **Connections.csv Preview** - First 500 characters
3. **All Files** - Complete archive listing with show more/less

---

## Usage Examples

### Complete Upload and Processing Flow

```tsx
'use client';

import { useState } from 'react';
import ApiKeyInput from './components/ApiKeyInput';
import UploadArea from './components/UploadArea';
import {
  getApiKey,
  getZipFileAsBlob,
  hasZipFile
} from './lib/indexeddb';
import { getLinkedInConnections } from './lib/zip-utils';

export default function ProcessPage() {
  const [isProcessing, setIsProcessing] = useState(false);
  const [connections, setConnections] = useState<string | null>(null);

  const handleProcess = async () => {
    setIsProcessing(true);

    try {
      // 1. Check for API key
      const apiKey = await getApiKey();
      if (!apiKey) {
        alert('Please save your API key first');
        return;
      }

      // 2. Check for uploaded file
      const hasFile = await hasZipFile();
      if (!hasFile) {
        alert('Please upload your LinkedIn ZIP file');
        return;
      }

      // 3. Get ZIP file
      const blob = await getZipFileAsBlob();
      if (!blob) {
        alert('Failed to load ZIP file');
        return;
      }

      // 4. Extract Connections.csv
      const csvData = await getLinkedInConnections(blob);
      if (!csvData) {
        alert('Connections.csv not found in ZIP');
        return;
      }

      setConnections(csvData);

      // 5. Process with OpenAI Batch API
      // (Your processing logic here)

    } catch (error) {
      console.error('Processing error:', error);
      alert('Failed to process data');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="space-y-6">
      <ApiKeyInput />
      <UploadArea />

      <button
        onClick={handleProcess}
        disabled={isProcessing}
        className="rounded-full bg-black px-6 py-3 text-white"
      >
        {isProcessing ? 'Processing...' : 'Process Data'}
      </button>

      {connections && (
        <div>
          <h3>Connections Preview</h3>
          <pre>{connections.substring(0, 500)}</pre>
        </div>
      )}
    </div>
  );
}
```

### Custom ZIP Processing

```typescript
import {
  getZipFileAsBlob
} from './lib/indexeddb';
import {
  extractAllTextFiles,
  findZipFiles
} from './lib/zip-utils';

async function processAllCsvFiles() {
  const blob = await getZipFileAsBlob();
  if (!blob) return;

  // Find all CSV files
  const csvFiles = await findZipFiles(blob, '**/*.csv');

  console.log(`Found ${csvFiles.length} CSV files`);

  // Extract all text files
  const textFiles = await extractAllTextFiles(blob);

  // Process each CSV
  for (const [filename, content] of textFiles.entries()) {
    if (filename.endsWith('.csv')) {
      console.log(`Processing ${filename}...`);
      // Parse CSV and process
      const lines = content.split('\n');
      console.log(`${lines.length} lines in ${filename}`);
    }
  }
}
```

### Batch Processing with OpenAI

```typescript
import { getApiKey } from './lib/indexeddb';
import {
  parseLinkedInCSV,
  generateBatchJSONL,
  uploadBatchFile
} from './linkedin-batch-processor';

async function createBatchJob() {
  // Get API key from IndexedDB
  const apiKey = await getApiKey();
  if (!apiKey) {
    throw new Error('API key not found');
  }

  // Get ZIP and extract Connections.csv
  const blob = await getZipFileAsBlob();
  if (!blob) {
    throw new Error('ZIP file not found');
  }

  const csvText = await getLinkedInConnections(blob);
  if (!csvText) {
    throw new Error('Connections.csv not found');
  }

  // Convert CSV text to File object for processing
  const csvBlob = new Blob([csvText], { type: 'text/csv' });
  const csvFile = new File([csvBlob], 'Connections.csv');

  // Parse and create batch
  const connections = await parseLinkedInCSV(csvFile);
  const jsonl = generateBatchJSONL(connections);

  // Upload to OpenAI
  const batchInfo = await uploadBatchFile(jsonl, apiKey);

  console.log('Batch created:', batchInfo.batchId);
  return batchInfo;
}
```

---

## Performance Considerations

### IndexedDB
- Binary storage is efficient for large files
- Async operations don't block UI
- Persists across page reloads
- Max size typically 50MB+ (browser dependent)

### fflate
- Fast decompression (faster than zip.js)
- Memory efficient
- Synchronous API wrapped in Promises
- Handles large ZIP files well

### Best Practices

1. **Always check for existing data before processing:**
   ```typescript
   const hasKey = await getApiKey() !== null;
   const hasFile = await hasZipFile();
   ```

2. **Handle errors gracefully:**
   ```typescript
   try {
     const blob = await getZipFileAsBlob();
     const valid = await isValidZipFile(blob);
     if (!valid) {
       throw new Error('Invalid ZIP file');
     }
   } catch (error) {
     console.error('ZIP processing failed:', error);
   }
   ```

3. **Clean up Object URLs:**
   ```typescript
   const url = await getZipFileAsObjectURL();
   // Use the URL
   URL.revokeObjectURL(url); // Clean up when done
   ```

4. **Validate before processing:**
   ```typescript
   const apiKey = await getApiKey();
   if (!validateOpenAIApiKey(apiKey)) {
     alert('Invalid API key');
     return;
   }
   ```

---

## Security

- **API Keys:** Stored only in browser's IndexedDB, never sent to your servers
- **ZIP Files:** Processed entirely client-side
- **Privacy:** No data leaves the user's browser except direct OpenAI API calls
- **Validation:** All inputs validated before storage

---

## Browser Compatibility

- **IndexedDB:** All modern browsers (Chrome, Firefox, Safari, Edge)
- **File API:** Full support in modern browsers
- **fflate:** Works in all browsers with ES6 support
- **Recommended:** Chrome/Edge 90+, Firefox 88+, Safari 14+

---

## Troubleshooting

### API Key Not Saving

```typescript
// Check validation
const key = 'sk-proj-...';
console.log(validateOpenAIApiKey(key)); // Should be true

// Check for errors
try {
  await saveApiKey(key);
} catch (error) {
  console.error('Save failed:', error);
}
```

### ZIP File Won't Upload

```typescript
// Validate file type
if (!file.name.endsWith('.zip')) {
  console.error('Not a ZIP file');
}

// Check file size
console.log('File size:', file.size / 1024 / 1024, 'MB');

// Validate ZIP
const blob = new Blob([file]);
const valid = await isValidZipFile(blob);
console.log('Valid ZIP:', valid);
```

### File Not Found in ZIP

```typescript
// List all files first
const files = await listZipContents(blob);
console.log('Files in ZIP:', files.map(f => f.filename));

// Try case-insensitive search
const csvFiles = await findZipFiles(blob, '**/*connections*.csv');
console.log('Found:', csvFiles);
```

---

## License

MIT
