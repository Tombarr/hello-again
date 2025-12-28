# Schema Validation Fix

## Problem

All batch requests were failing with this error:
```
Invalid schema for response_format 'profile': In context=('properties', 'loc'),
'required' is required to be supplied and to be an array including every key
in properties. Missing 'city'.
```

## Root Cause

When using OpenAI's **strict mode** (`strict: true`) with structured outputs, ALL nested objects must have their own `required` arrays that include **every property** in that object.

### What Was Wrong:

```typescript
// ❌ BROKEN - Missing 'required' in nested objects
{
  type: "object",
  properties: {
    loc: {
      type: "object",
      properties: {
        city: { type: ["string", "null"] },
        country: { type: ["string", "null"] },
      },
      // ❌ Missing 'required' array!
      additionalProperties: false,
    }
  },
  required: ["loc"],
  additionalProperties: false,
}
```

### What's Correct:

```typescript
// ✅ CORRECT - Each nested object has 'required' array
{
  type: "object",
  properties: {
    loc: {
      type: "object",
      properties: {
        city: { type: ["string", "null"] },
        country: { type: ["string", "null"] },
      },
      required: ["city", "country"], // ✅ Required array with ALL properties
      additionalProperties: false,
    }
  },
  required: ["loc"],
  additionalProperties: false,
}
```

## OpenAI Strict Mode Requirements

When using `strict: true`, your schema must follow these rules:

### 1. Every Object Needs 'required'
All objects (including nested ones) must have a `required` array.

### 2. 'required' Must Include ALL Properties
The `required` array must list **every** property key, even if the property can be `null`.

```typescript
// ✅ Correct: All properties listed in required
{
  type: "object",
  properties: {
    name: { type: "string" },
    age: { type: ["number", "null"] },  // Can be null, but still required
    city: { type: ["string", "null"] }
  },
  required: ["name", "age", "city"],  // All properties must be here
  additionalProperties: false
}
```

### 3. Use Union Types for Nullable Fields
To allow null values, use union types:

```typescript
// ✅ Field is required but can be null
{ type: ["string", "null"] }

// ❌ Don't omit from required
{
  properties: {
    optional_field: { type: ["string", "null"] }
  },
  required: []  // ❌ Wrong! Should be required: ["optional_field"]
}
```

### 4. additionalProperties Must Be false
```typescript
{
  type: "object",
  properties: { ... },
  required: [...],
  additionalProperties: false  // ✅ Required for strict mode
}
```

## Fixed Schema

### Current Working Schema:

```typescript
const MINIMAL_SCHEMA = {
  type: "object",
  properties: {
    loc: {
      type: "object",
      properties: {
        city: { type: ["string", "null"] },
        country: { type: ["string", "null"] },
        lat: { type: ["number", "null"] },
        lng: { type: ["number", "null"] },
      },
      required: ["city", "country", "lat", "lng"],  // ✅ All properties
      additionalProperties: false,
    },
    stats: {
      type: "object",
      properties: {
        conn: { type: ["integer", "null"] },
        foll: { type: ["integer", "null"] },
      },
      required: ["conn", "foll"],  // ✅ All properties
      additionalProperties: false,
    },
  },
  required: ["loc", "stats"],  // ✅ Top-level required
  additionalProperties: false,
};
```

## Validation Tools

### 1. Schema Validator (`app/lib/schema-validator.ts`)

```typescript
import { validateBatchSchema } from './lib/schema-validator';

const result = validateBatchSchema();

if (!result.valid) {
  console.error('Schema errors:', result.errors);
} else {
  console.log('Schema is valid!');
  console.log('Test request:', result.testRequest);
}
```

### 2. Test Script (`test-schema.js`)

Run the validation test:
```bash
node test-schema.js
```

Output:
```
🔍 Validating schema...
✅ Schema is valid!
📋 Test request JSONL: [...]
📊 Schema structure: [...]
✨ Ready to use in batch processing!
```

## Common Mistakes to Avoid

### ❌ Mistake 1: Missing 'required' in nested objects
```typescript
{
  properties: {
    user: {
      type: "object",
      properties: {
        name: { type: "string" }
      },
      // ❌ Missing 'required'
      additionalProperties: false
    }
  }
}
```

**Fix:** Add `required: ["name"]`

### ❌ Mistake 2: Partial 'required' arrays
```typescript
{
  properties: {
    city: { type: "string" },
    country: { type: "string" },
    lat: { type: "number" }
  },
  required: ["city", "country"]  // ❌ Missing 'lat'
}
```

**Fix:** Include all properties: `required: ["city", "country", "lat"]`

### ❌ Mistake 3: additionalProperties not set to false
```typescript
{
  type: "object",
  properties: { ... },
  required: [...],
  // ❌ Missing additionalProperties: false
}
```

**Fix:** Add `additionalProperties: false`

### ❌ Mistake 4: Using optional properties without union types
```typescript
{
  properties: {
    optional: { type: "string" }  // ❌ Can't be omitted in strict mode
  },
  required: []
}
```

**Fix:** Use union type: `{ type: ["string", "null"] }` and include in required

## Testing Your Schema

### Quick Validation Checklist:

- [ ] Every `type: "object"` has a `properties` field
- [ ] Every `type: "object"` has a `required` array
- [ ] Every property key appears in the `required` array
- [ ] Every `type: "object"` has `additionalProperties: false`
- [ ] Nullable fields use union types: `["string", "null"]`
- [ ] Nested objects follow the same rules recursively

### Before Deploying:

1. Run the validation test:
   ```bash
   node test-schema.js
   ```

2. Test with a small batch (limit: 1-2 connections)

3. Check batch status for validation errors

4. Verify one successful response before scaling up

## Example: Adding a New Field

If you want to add a new field to the schema:

```typescript
// Before
{
  properties: {
    loc: {
      properties: {
        city: { type: ["string", "null"] },
        country: { type: ["string", "null"] }
      },
      required: ["city", "country"]
    }
  }
}

// After - Adding 'state' field
{
  properties: {
    loc: {
      properties: {
        city: { type: ["string", "null"] },
        country: { type: ["string", "null"] },
        state: { type: ["string", "null"] }  // ✅ New field
      },
      required: ["city", "country", "state"]  // ✅ Add to required!
    }
  }
}
```

## Debugging Failed Batches

If a batch fails with schema errors:

1. **Check the error message** - It tells you exactly which property is missing from `required`

2. **Validate locally** - Run `node test-schema.js` before creating batches

3. **Test with one request** - Use limit=1 to test quickly

4. **Check nested objects** - Make sure every level has `required`

5. **Verify additionalProperties** - Must be `false` at every level

## Resources

- [OpenAI Structured Outputs Guide](https://platform.openai.com/docs/guides/structured-outputs)
- [JSON Schema Specification](https://json-schema.org/)
- [OpenAI API Reference - Chat Completions](https://platform.openai.com/docs/api-reference/chat/create)

## License

MIT
