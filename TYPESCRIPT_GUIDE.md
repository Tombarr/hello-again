# TypeScript Usage Guide

The LinkedIn Batch Processor is now available in TypeScript with full type definitions for enhanced developer experience and type safety.

## Files

- `linkedin-batch-processor.ts` - TypeScript source code with comprehensive types
- `tsconfig.json` - TypeScript compiler configuration
- `package.json` - Build scripts and dependencies
- `batch-processor-demo-ts.html` - HTML demo using compiled TypeScript

## Quick Start

### 1. Install Dependencies

```bash
npm install
```

This installs TypeScript as a dev dependency.

### 2. Compile TypeScript

```bash
npm run build
```

This generates:
- `dist/linkedin-batch-processor.js` - Compiled JavaScript
- `dist/linkedin-batch-processor.d.ts` - Type definitions
- `dist/linkedin-batch-processor.js.map` - Source maps

### 3. Use in Browser

Open `batch-processor-demo-ts.html` in your browser:

```bash
open batch-processor-demo-ts.html
```

Or serve it with a local server:

```bash
npx http-server . -p 8080
```

Then visit http://localhost:8080/batch-processor-demo-ts.html

## Available Scripts

```bash
# Compile TypeScript once
npm run build

# Watch mode - recompile on changes
npm run build:watch

# Type check without emitting files
npm run type-check

# Clean build output
npm run clean
```

## Type Definitions

### Core Interfaces

```typescript
import type {
  LinkedInConnection,
  LocationInfo,
  CurrentLocation,
  LinkedInStats,
  Education,
  BatchInfo,
  BatchStatus,
  ProcessResult,
  BatchStatusResponse,
  BatchResultResponse
} from './dist/linkedin-batch-processor.js';

// Example: Type-safe connection data
const connection: LinkedInConnection = {
  firstName: 'Alex',
  lastName: 'Rohrberg',
  url: 'https://www.linkedin.com/in/alexrohrberg',
  company: 'Schneider Electric',
  position: 'Software Engineer',
  connectedOn: '22 Dec 2025'
};

// Example: Type-safe location info
const locationInfo: LocationInfo = {
  current_location: {
    city: 'Nashville',
    state: 'Tennessee',
    country: 'United States',
    latitude: 36.1627,
    longitude: -86.7816,
    openstreetmap_id: 'R113124'
  },
  location_move_date: '2023-08-15',
  linkedin_stats: {
    connections: 500,
    followers: 1250
  },
  about: 'Software Engineer specializing in...',
  education: [],
  data_freshness: '2025-12-28',
  sources: ['https://www.linkedin.com/in/alexrohrberg']
};
```

### Function Signatures

```typescript
// Parse CSV with type-safe return
function parseLinkedInCSV(file: File): Promise<LinkedInConnection[]>;

// Generate JSONL with typed input
function generateBatchJSONL(connections: LinkedInConnection[]): string;

// Upload with typed response
function uploadBatchFile(jsonlContent: string, apiKey: string): Promise<BatchInfo>;

// Check status with comprehensive response type
function checkBatchStatus(batchId: string, apiKey: string): Promise<BatchStatusResponse>;

// Download results with typed batch results
function downloadBatchResults(
  outputFileId: string,
  apiKey: string
): Promise<BatchResultResponse[]>;

// Main processor with typed result
function processLinkedInConnections(
  csvFile: File,
  apiKey: string
): Promise<ProcessResult>;
```

## Usage Examples

### In TypeScript Projects

```typescript
import {
  processLinkedInConnections,
  checkBatchStatus,
  downloadBatchResults,
  type LinkedInConnection,
  type BatchStatusResponse
} from './dist/linkedin-batch-processor.js';

async function processBatch(csvFile: File, apiKey: string) {
  // TypeScript knows the exact return type
  const result = await processLinkedInConnections(csvFile, apiKey);

  console.log(`Batch ID: ${result.batchInfo.batchId}`);
  console.log(`Status: ${result.batchInfo.status}`); // Autocomplete works!

  // Save for later
  localStorage.setItem('batchId', result.batchInfo.batchId);

  return result;
}

async function pollBatchStatus(batchId: string, apiKey: string) {
  const status: BatchStatusResponse = await checkBatchStatus(batchId, apiKey);

  // TypeScript enforces correct status values
  if (status.status === 'completed') {
    console.log('✓ Batch complete!');
    return status.output_file_id;
  } else if (status.status === 'failed') {
    throw new Error('Batch processing failed');
  }

  // Type-safe request counts
  const { total, completed, failed } = status.request_counts || {};
  console.log(`Progress: ${completed}/${total} (${failed} failed)`);

  return null;
}
```

### In JavaScript with JSDoc

Even in JavaScript files, you can get TypeScript benefits:

```javascript
// @ts-check
import { processLinkedInConnections } from './dist/linkedin-batch-processor.js';

/**
 * @param {File} csvFile
 * @param {string} apiKey
 * @returns {Promise<import('./dist/linkedin-batch-processor.js').ProcessResult>}
 */
async function process(csvFile, apiKey) {
  const result = await processLinkedInConnections(csvFile, apiKey);
  // Full autocomplete and type checking!
  return result;
}
```

### Extending Types

```typescript
import type { LinkedInConnection, LocationInfo } from './dist/linkedin-batch-processor.js';

// Add custom fields
interface ExtendedConnection extends LinkedInConnection {
  tags?: string[];
  notes?: string;
  priority?: 'high' | 'medium' | 'low';
}

// Extend location info
interface EnhancedLocationInfo extends LocationInfo {
  timezone?: string;
  population?: number;
  cost_of_living_index?: number;
}
```

## Type Safety Benefits

### 1. Autocomplete

Your IDE will provide intelligent autocomplete for:
- Function parameters
- Return values
- Object properties
- Enum values (like BatchStatus)

### 2. Compile-Time Errors

Catch errors before runtime:

```typescript
// ❌ TypeScript error: Argument of type 'string' is not assignable to parameter of type 'File'
await parseLinkedInCSV('connections.csv');

// ✅ Correct
const file = document.querySelector('input[type="file"]').files[0];
await parseLinkedInCSV(file);

// ❌ TypeScript error: Property 'invalid' does not exist on type 'BatchInfo'
const result = await uploadBatchFile(jsonl, apiKey);
console.log(result.invalid);

// ✅ Correct
console.log(result.batchId);
```

### 3. Refactoring Safety

When you rename or restructure types, TypeScript will find all affected code:

```typescript
// If LocationInfo changes, TypeScript will highlight everywhere it's used
type NewLocationInfo = LocationInfo & { last_verified: string };
```

### 4. Self-Documenting Code

Types serve as inline documentation:

```typescript
// Hover over any function in VS Code to see full type information
const status = await checkBatchStatus(batchId, apiKey);
// status: BatchStatusResponse (with all properties visible)
```

## IDE Setup

### VS Code

1. Install recommended extensions:
   - [TypeScript and JavaScript Language Features](https://marketplace.visualstudio.com/items?itemName=ms-vscode.vscode-typescript-next) (usually built-in)
   - [Error Lens](https://marketplace.visualstudio.com/items?itemName=usernamehw.errorlens) - Inline error display

2. Enable TypeScript checking in JavaScript files:
   Add to `.vscode/settings.json`:
   ```json
   {
     "javascript.validate.enable": true,
     "typescript.tsdk": "node_modules/typescript/lib"
   }
   ```

### WebStorm / IntelliJ

TypeScript support is built-in. Just ensure:
1. TypeScript service is enabled
2. tsconfig.json is recognized

## Strict Type Checking

The `tsconfig.json` enables strict mode for maximum type safety:

```json
{
  "strict": true,
  "noUnusedLocals": true,
  "noUnusedParameters": true,
  "noImplicitReturns": true,
  "noFallthroughCasesInSwitch": true,
  "noUncheckedIndexedAccess": true,
  "exactOptionalPropertyTypes": true
}
```

This catches common errors like:
- Unhandled null/undefined
- Unused variables
- Missing return statements
- Unsafe array access

## Build Output

After running `npm run build`, the `dist/` folder contains:

```
dist/
├── linkedin-batch-processor.js        # Compiled JavaScript (ES2020)
├── linkedin-batch-processor.d.ts      # Type definitions
├── linkedin-batch-processor.js.map    # Source map
└── linkedin-batch-processor.d.ts.map  # Declaration source map
```

### Using Compiled Output

```html
<!-- In HTML with ES modules -->
<script type="module">
  import { processLinkedInConnections } from './dist/linkedin-batch-processor.js';
  // ...
</script>
```

```typescript
// In TypeScript projects
import { processLinkedInConnections } from './dist/linkedin-batch-processor.js';
```

```javascript
// In Node.js (CommonJS)
const { processLinkedInConnections } = require('./dist/linkedin-batch-processor.js');
```

## Advanced: Custom JSON Schema Types

If you modify `LOCATION_INFO_SCHEMA`, update the corresponding TypeScript types:

```typescript
// Add a new field to the schema
export const CUSTOM_SCHEMA = {
  ...LOCATION_INFO_SCHEMA,
  properties: {
    ...LOCATION_INFO_SCHEMA.properties,
    current_employer: {
      type: 'object',
      properties: {
        company: { type: 'string' },
        title: { type: 'string' },
        start_date: { type: 'string' }
      }
    }
  }
};

// Update the TypeScript interface to match
export interface CustomLocationInfo extends LocationInfo {
  current_employer: {
    company: string;
    title: string;
    start_date: string;
  };
}
```

## Troubleshooting

### "Cannot find module" errors

Ensure you've built the project:
```bash
npm run build
```

### Type errors in IDE but build succeeds

1. Reload TypeScript server (VS Code: Cmd+Shift+P → "Reload Window")
2. Check that `tsconfig.json` is in the project root
3. Verify TypeScript version: `npx tsc --version`

### Source maps not working

Make sure `sourceMap` is enabled in `tsconfig.json`:
```json
{
  "compilerOptions": {
    "sourceMap": true
  }
}
```

## Migration from JavaScript

To migrate existing JavaScript code to TypeScript:

1. Rename `.js` files to `.ts`
2. Run `npm run type-check` to see errors
3. Add type annotations gradually:
   ```typescript
   // Before (JavaScript)
   function process(data) { ... }

   // After (TypeScript)
   function process(data: LinkedInConnection[]): string { ... }
   ```
4. Fix type errors one by one
5. Enable stricter checks incrementally

## Performance

TypeScript compilation is fast:
- Initial build: ~1-2 seconds
- Watch mode rebuild: <500ms
- No runtime overhead (compiles to plain JavaScript)

## License

MIT - Same as the main project
