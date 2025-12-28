/**
 * Schema validation test
 * Run with: node test-schema.js
 */

// Test schema with strict mode requirements
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

// Generate test request
const testRequest = {
  custom_id: "test-validation",
  method: "POST",
  url: "/v1/chat/completions",
  body: {
    model: "gpt-4o-mini",
    messages: [
      {
        role: "system",
        content: "Return location and stats in JSON. Infer if needed.",
      },
      {
        role: "user",
        content:
          "John Doe at Acme Corp (Software Engineer). Infer: location (city, country, lat/lng), LinkedIn stats (connections/followers). Use null if unknown.",
      },
    ],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "profile",
        strict: true,
        schema: MINIMAL_SCHEMA,
      },
    },
  },
};

// Validate schema structure
function validateSchema(schema, path = "root") {
  const errors = [];

  if (schema.type === "object") {
    if (!schema.properties) {
      errors.push(`${path}: Missing 'properties'`);
      return errors;
    }

    if (!schema.required || !Array.isArray(schema.required)) {
      errors.push(`${path}: Missing or invalid 'required' array`);
      return errors;
    }

    const propertyKeys = Object.keys(schema.properties);
    const missingRequired = propertyKeys.filter(
      (key) => !schema.required.includes(key)
    );

    if (missingRequired.length > 0) {
      errors.push(
        `${path}: Required array missing properties: ${missingRequired.join(", ")}`
      );
    }

    if (schema.additionalProperties !== false) {
      errors.push(`${path}: additionalProperties should be false`);
    }

    // Check nested objects
    for (const [key, prop] of Object.entries(schema.properties)) {
      if (prop.type === "object") {
        errors.push(...validateSchema(prop, `${path}.${key}`));
      }
    }
  }

  return errors;
}

// Run validation
console.log("🔍 Validating schema...\n");

const errors = validateSchema(MINIMAL_SCHEMA);

if (errors.length === 0) {
  console.log("✅ Schema is valid!\n");
  console.log("📋 Test request JSONL:");
  console.log(JSON.stringify(testRequest, null, 2));
  console.log("\n📊 Schema structure:");
  console.log(JSON.stringify(MINIMAL_SCHEMA, null, 2));
  console.log("\n✨ Ready to use in batch processing!");
} else {
  console.log("❌ Schema validation failed:\n");
  errors.forEach((error) => console.log(`  - ${error}`));
  process.exit(1);
}
