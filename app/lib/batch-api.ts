/**
 * OpenAI Batch API utilities
 * Create and manage batch processing jobs
 */

import { getApiKey, getZipFileAsBlob } from "./indexeddb";
import { getLinkedInConnections } from "./zip-utils";
import { parseConnectionsCSV } from "./batch-processor";
import { addBatch, updateBatchStatus, type StoredBatch } from "./batch-storage";

// Import the batch processor functions
const OPENAI_API_BASE = "https://api.openai.com/v1";

/**
 * Generate minimal prompt for individual lookup
 */
function generatePrompt(person: {
  firstName: string;
  lastName: string;
  url: string;
  company?: string;
  position?: string;
}): string {
  return `${person.firstName} ${person.lastName} at ${person.company || "Unknown"} (${person.position || "Unknown"}). Infer: location (city, country, lat/lng), LinkedIn stats (connections/followers). Use null if unknown.`;
}

/**
 * Generate JSONL batch file for OpenAI Batch API
 * Optimized schema with minimal fields and short names
 */
function generateBatchJSONL(
  connections: Array<{
    firstName: string;
    lastName: string;
    url: string;
    company?: string;
    position?: string;
  }>
): string {
  // Minimal schema: location (city, country, coordinates) and LinkedIn stats
  // Note: With strict mode, nested objects must have 'required' arrays
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

  const requests = connections.map((person, index) => {
    return {
      custom_id: `req-${index + 1}`,
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
            content: generatePrompt(person),
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
  });

  return requests.map((req) => JSON.stringify(req)).join("\n");
}

/**
 * Create a new batch job
 */
export async function createBatch(
  limit?: number
): Promise<{ success: boolean; batchId?: string; error?: string }> {
  try {
    // 1. Get API key
    const apiKey = await getApiKey();
    if (!apiKey) {
      return { success: false, error: "API key not found" };
    }

    // 2. Get ZIP file
    const blob = await getZipFileAsBlob();
    if (!blob) {
      return { success: false, error: "ZIP file not found" };
    }

    // 3. Extract Connections.csv
    const csvText = await getLinkedInConnections(blob);
    if (!csvText) {
      return { success: false, error: "Connections.csv not found" };
    }

    // 4. Parse connections
    let connections = parseConnectionsCSV(csvText);
    const totalConnections = connections.length;

    // Apply limit if specified
    if (limit && limit > 0) {
      connections = connections.slice(0, limit);
    }

    if (connections.length === 0) {
      return { success: false, error: "No connections found" };
    }

    // 5. Generate JSONL
    const jsonl = generateBatchJSONL(connections);

    // 6. Upload file
    const blob_data = new Blob([jsonl], { type: "application/jsonl" });
    const formData = new FormData();
    formData.append("file", blob_data, "batch_requests.jsonl");
    formData.append("purpose", "batch");

    const uploadResponse = await fetch(`${OPENAI_API_BASE}/files`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
      body: formData,
    });

    if (!uploadResponse.ok) {
      const error = await uploadResponse.json();
      return {
        success: false,
        error: `File upload failed: ${JSON.stringify(error)}`,
      };
    }

    const fileData = await uploadResponse.json();
    const fileId = fileData.id;

    // 7. Create batch
    const batchResponse = await fetch(`${OPENAI_API_BASE}/batches`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        input_file_id: fileId,
        endpoint: "/v1/chat/completions",
        completion_window: "24h",
        metadata: {
          description: "LinkedIn connections location lookup",
          created_at: new Date().toISOString(),
          total_connections: totalConnections.toString(),
          processed_connections: connections.length.toString(),
        },
      }),
    });

    if (!batchResponse.ok) {
      const error = await batchResponse.json();
      return {
        success: false,
        error: `Batch creation failed: ${JSON.stringify(error)}`,
      };
    }

    const batchData = await batchResponse.json();

    // 8. Store in IndexedDB
    const storedBatch: StoredBatch = {
      batchId: batchData.id,
      createdAt: Date.now(),
      status: batchData.status,
      fileId: fileId,
      metadata: {
        connectionsCount: connections.length,
        description: `Processing ${connections.length} of ${totalConnections} connections`,
      },
    };

    await addBatch(storedBatch);

    return { success: true, batchId: batchData.id };
  } catch (error) {
    console.error("Batch creation error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Check batch status
 */
export async function checkBatchStatus(
  batchId: string
): Promise<{ success: boolean; status?: any; error?: string }> {
  try {
    const apiKey = await getApiKey();
    if (!apiKey) {
      return { success: false, error: "API key not found" };
    }

    const response = await fetch(`${OPENAI_API_BASE}/batches/${batchId}`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
    });

    if (!response.ok) {
      const error = await response.json();
      return {
        success: false,
        error: `Status check failed: ${JSON.stringify(error)}`,
      };
    }

    const status = await response.json();

    // Update stored batch
    await updateBatchStatus(batchId, status.status, {
      requestCounts: status.request_counts,
      outputFileId: status.output_file_id,
      errorFileId: status.error_file_id,
    });

    return { success: true, status };
  } catch (error) {
    console.error("Status check error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Download batch results
 */
export async function downloadBatchResults(
  outputFileId: string
): Promise<{ success: boolean; data?: any[]; error?: string }> {
  try {
    const apiKey = await getApiKey();
    if (!apiKey) {
      return { success: false, error: "API key not found" };
    }

    const response = await fetch(
      `${OPENAI_API_BASE}/files/${outputFileId}/content`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${apiKey}`,
        },
      }
    );

    if (!response.ok) {
      const error = await response.json();
      return {
        success: false,
        error: `Download failed: ${JSON.stringify(error)}`,
      };
    }

    const text = await response.text();
    const results = text
      .split("\n")
      .filter((line) => line.trim())
      .map((line) => JSON.parse(line));

    return { success: true, data: results };
  } catch (error) {
    console.error("Download error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Download batch results as raw JSONL text
 */
export async function downloadBatchResultsRaw(
  outputFileId: string
): Promise<{ success: boolean; data?: string; error?: string }> {
  try {
    const apiKey = await getApiKey();
    if (!apiKey) {
      return { success: false, error: "API key not found" };
    }

    const response = await fetch(
      `${OPENAI_API_BASE}/files/${outputFileId}/content`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${apiKey}`,
        },
      }
    );

    if (!response.ok) {
      const error = await response.json();
      return {
        success: false,
        error: `Download failed: ${JSON.stringify(error)}`,
      };
    }

    const text = await response.text();
    return { success: true, data: text };
  } catch (error) {
    console.error("Download error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Process batch results and merge with connections
 */
export async function processBatchWithConnections(
  outputFileId: string
): Promise<{
  success: boolean;
  data?: any;
  stats?: any;
  error?: string;
}> {
  try {
    // Import the batch-results module dynamically to avoid circular dependencies
    const { processBatchResults } = await import("./batch-results");

    // 1. Get ZIP file
    const blob = await getZipFileAsBlob();
    if (!blob) {
      return { success: false, error: "ZIP file not found" };
    }

    // 2. Extract Connections.csv
    const csvText = await getLinkedInConnections(blob);
    if (!csvText) {
      return { success: false, error: "Connections.csv not found" };
    }

    // 3. Download batch results
    const resultsResponse = await downloadBatchResultsRaw(outputFileId);
    if (!resultsResponse.success || !resultsResponse.data) {
      return {
        success: false,
        error: resultsResponse.error || "Failed to download results",
      };
    }

    // 4. Process and merge
    const result = await processBatchResults(csvText, resultsResponse.data);

    return result;
  } catch (error) {
    console.error("Process batch error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}
