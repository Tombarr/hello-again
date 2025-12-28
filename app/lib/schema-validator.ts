/**
 * JSON Schema validation utilities for OpenAI Batch API
 * Helps validate schemas before sending to avoid batch failures
 */

/**
 * Validate that a JSON schema is compatible with OpenAI's strict mode
 *
 * OpenAI's strict mode requirements:
 * 1. All nested objects must have 'required' arrays
 * 2. 'required' must include ALL properties in the object
 * 3. additionalProperties must be false
 * 4. Can use union types like ["string", "null"] for nullable fields
 */
export function validateStrictSchema(schema: any, path: string = "root"): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  // Check if it's an object type
  if (schema.type === "object") {
    // Must have properties
    if (!schema.properties) {
      errors.push(`${path}: Object type must have 'properties'`);
      return { valid: false, errors };
    }

    // Must have required array
    if (!schema.required || !Array.isArray(schema.required)) {
      errors.push(`${path}: Object type must have 'required' array`);
      return { valid: false, errors };
    }

    // Required must include all property keys
    const propertyKeys = Object.keys(schema.properties);
    const missingRequired = propertyKeys.filter(
      (key) => !schema.required.includes(key)
    );

    if (missingRequired.length > 0) {
      errors.push(
        `${path}: 'required' must include all properties. Missing: ${missingRequired.join(", ")}`
      );
    }

    // additionalProperties should be false
    if (schema.additionalProperties !== false) {
      errors.push(
        `${path}: 'additionalProperties' should be false for strict mode`
      );
    }

    // Recursively validate nested objects
    for (const [key, prop] of Object.entries(schema.properties)) {
      const propSchema = prop as any;

      // If it's an object, validate recursively
      if (propSchema.type === "object") {
        const nestedResult = validateStrictSchema(
          propSchema,
          `${path}.${key}`
        );
        errors.push(...nestedResult.errors);
      }

      // If it's an array with object items, validate the items schema
      if (propSchema.type === "array" && propSchema.items?.type === "object") {
        const itemsResult = validateStrictSchema(
          propSchema.items,
          `${path}.${key}[items]`
        );
        errors.push(...itemsResult.errors);
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Generate a test JSONL request to validate before creating a full batch
 */
export function generateTestRequest(
  schema: any,
  schemaName: string = "test_schema"
): string {
  const testRequest = {
    custom_id: "test-1",
    method: "POST",
    url: "/v1/chat/completions",
    body: {
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: "Test schema validation.",
        },
        {
          role: "user",
          content: "Return test data.",
        },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: schemaName,
          strict: true,
          schema: schema,
        },
      },
    },
  };

  return JSON.stringify(testRequest);
}

/**
 * Validate the current batch schema
 */
export function validateBatchSchema(): {
  valid: boolean;
  errors: string[];
  testRequest?: string;
} {
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
        required: ["city", "country", "lat", "lng"],
        additionalProperties: false,
      },
      stats: {
        type: "object",
        properties: {
          conn: { type: ["integer", "null"] },
          foll: { type: ["integer", "null"] },
        },
        required: ["conn", "foll"],
        additionalProperties: false,
      },
    },
    required: ["loc", "stats"],
    additionalProperties: false,
  };

  const result = validateStrictSchema(MINIMAL_SCHEMA);

  if (result.valid) {
    return {
      valid: true,
      errors: [],
      testRequest: generateTestRequest(MINIMAL_SCHEMA, "profile"),
    };
  }

  return {
    valid: false,
    errors: result.errors,
  };
}
