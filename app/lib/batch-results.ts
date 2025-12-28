/**
 * Batch results processing utilities
 * Merges OpenAI Batch API results with original connections data
 */

import { parseConnectionsCSV } from "./batch-processor";

/**
 * Location data from batch response
 */
export interface LocationData {
  city: string | null;
  country: string | null;
  lat: number | null;
  lng: number | null;
}

/**
 * Stats data from batch response
 */
export interface StatsData {
  conn: number | null;
  foll: number | null;
}

/**
 * Enriched connection with location and stats
 */
export interface EnrichedConnection {
  // Original connection data
  firstName: string;
  lastName: string;
  url: string;
  emailAddress?: string;
  company?: string;
  position?: string;
  connectedOn?: string;

  // Enriched data from batch
  location?: LocationData;
  stats?: StatsData;

  // Metadata
  enriched: boolean;
  error?: string;
}

/**
 * Batch result item structure
 */
interface BatchResultItem {
  id: string;
  custom_id: string;
  response: {
    status_code: number;
    request_id: string;
    body: {
      id: string;
      object: string;
      created: number;
      model: string;
      choices: Array<{
        index: number;
        message: {
          role: string;
          content: string;
          refusal: null | string;
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
  error: null | {
    message: string;
    type: string;
    param: string | null;
    code: string | null;
  };
}

/**
 * Parse JSONL batch results file
 */
export function parseBatchResults(jsonlText: string): BatchResultItem[] {
  const lines = jsonlText.split("\n").filter((line) => line.trim());
  return lines.map((line) => JSON.parse(line));
}

/**
 * Extract location and stats from a batch result item
 */
function extractEnrichmentData(item: BatchResultItem): {
  location?: LocationData;
  stats?: StatsData;
  error?: string;
} {
  // Check for API-level errors
  if (item.error) {
    return {
      error: `API Error: ${item.error.message}`,
    };
  }

  // Check for non-200 status
  if (item.response.status_code !== 200) {
    return {
      error: `HTTP ${item.response.status_code}`,
    };
  }

  try {
    // Extract content from the response
    const content = item.response.body.choices[0]?.message?.content;
    if (!content) {
      return {
        error: "No content in response",
      };
    }

    // Parse the JSON content
    const data = JSON.parse(content);

    return {
      location: data.loc || undefined,
      stats: data.stats || undefined,
    };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Failed to parse response",
    };
  }
}

/**
 * Merge batch results with original connections
 */
export function mergeConnectionsWithResults(
  connections: Array<{
    firstName: string;
    lastName: string;
    url: string;
    emailAddress?: string;
    company?: string;
    position?: string;
    connectedOn?: string;
  }>,
  batchResults: BatchResultItem[]
): EnrichedConnection[] {
  // Create a map of custom_id to results for quick lookup
  const resultsMap = new Map<string, BatchResultItem>();
  for (const result of batchResults) {
    resultsMap.set(result.custom_id, result);
  }

  // Merge connections with their results
  return connections.map((connection, index) => {
    const customId = `req-${index + 1}`;
    const result = resultsMap.get(customId);

    const enriched: EnrichedConnection = {
      ...connection,
      enriched: false,
    };

    if (result) {
      const { location, stats, error } = extractEnrichmentData(result);
      enriched.location = location;
      enriched.stats = stats;
      enriched.enriched = !error && (!!location || !!stats);
      if (error) {
        enriched.error = error;
      }
    }

    return enriched;
  });
}

/**
 * Process batch results and merge with connections from CSV
 */
export async function processBatchResults(
  csvText: string,
  jsonlText: string
): Promise<{
  success: boolean;
  data?: EnrichedConnection[];
  stats?: {
    total: number;
    enriched: number;
    withLocation: number;
    withStats: number;
    errors: number;
  };
  error?: string;
}> {
  try {
    // Parse connections
    const connections = parseConnectionsCSV(csvText);
    if (connections.length === 0) {
      return {
        success: false,
        error: "No connections found in CSV",
      };
    }

    // Parse batch results
    const batchResults = parseBatchResults(jsonlText);
    if (batchResults.length === 0) {
      return {
        success: false,
        error: "No results found in batch output",
      };
    }

    // Merge data
    const enrichedConnections = mergeConnectionsWithResults(
      connections,
      batchResults
    );

    // Calculate statistics
    let enriched = 0;
    let withLocation = 0;
    let withStats = 0;
    let errors = 0;

    for (const conn of enrichedConnections) {
      if (conn.enriched) enriched++;
      if (conn.location) withLocation++;
      if (conn.stats) withStats++;
      if (conn.error) errors++;
    }

    return {
      success: true,
      data: enrichedConnections,
      stats: {
        total: enrichedConnections.length,
        enriched,
        withLocation,
        withStats,
        errors,
      },
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Export enriched connections to CSV
 */
export function exportToCSV(connections: EnrichedConnection[]): string {
  const headers = [
    "First Name",
    "Last Name",
    "Company",
    "Position",
    "Email",
    "URL",
    "Connected On",
    "City",
    "Country",
    "Latitude",
    "Longitude",
    "Connections",
    "Followers",
    "Enriched",
    "Error",
  ];

  const rows = connections.map((conn) => {
    return [
      conn.firstName || "",
      conn.lastName || "",
      conn.company || "",
      conn.position || "",
      conn.emailAddress || "",
      conn.url || "",
      conn.connectedOn || "",
      conn.location?.city || "",
      conn.location?.country || "",
      conn.location?.lat?.toString() || "",
      conn.location?.lng?.toString() || "",
      conn.stats?.conn?.toString() || "",
      conn.stats?.foll?.toString() || "",
      conn.enriched ? "Yes" : "No",
      conn.error || "",
    ];
  });

  // Escape CSV fields
  const escapeField = (field: string): string => {
    if (field.includes(",") || field.includes('"') || field.includes("\n")) {
      return `"${field.replace(/"/g, '""')}"`;
    }
    return field;
  };

  const csvLines = [
    headers.map(escapeField).join(","),
    ...rows.map((row) => row.map(escapeField).join(",")),
  ];

  return csvLines.join("\n");
}

/**
 * Export enriched connections to JSON
 */
export function exportToJSON(connections: EnrichedConnection[]): string {
  return JSON.stringify(connections, null, 2);
}

/**
 * Download enriched data as a file
 */
export function downloadEnrichedData(
  connections: EnrichedConnection[],
  format: "csv" | "json",
  filename?: string
): void {
  const content = format === "csv"
    ? exportToCSV(connections)
    : exportToJSON(connections);

  const mimeType = format === "csv"
    ? "text/csv;charset=utf-8;"
    : "application/json;charset=utf-8;";

  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.setAttribute("href", url);
  link.setAttribute(
    "download",
    filename || `enriched-connections-${Date.now()}.${format}`
  );
  link.style.visibility = "hidden";

  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  URL.revokeObjectURL(url);
}

/**
 * Filter enriched connections
 */
export function filterEnrichedConnections(
  connections: EnrichedConnection[],
  filters: {
    onlyEnriched?: boolean;
    onlyWithLocation?: boolean;
    onlyWithStats?: boolean;
    country?: string;
    city?: string;
    hasError?: boolean;
  }
): EnrichedConnection[] {
  return connections.filter((conn) => {
    if (filters.onlyEnriched && !conn.enriched) return false;
    if (filters.onlyWithLocation && !conn.location) return false;
    if (filters.onlyWithStats && !conn.stats) return false;
    if (filters.hasError !== undefined && (!!conn.error !== filters.hasError)) return false;

    if (filters.country && conn.location?.country !== filters.country) return false;
    if (filters.city && conn.location?.city !== filters.city) return false;

    return true;
  });
}

/**
 * Get unique countries from enriched connections
 */
export function getUniqueCountries(connections: EnrichedConnection[]): string[] {
  const countries = new Set<string>();
  for (const conn of connections) {
    if (conn.location?.country) {
      countries.add(conn.location.country);
    }
  }
  return Array.from(countries).sort();
}

/**
 * Get unique cities from enriched connections
 */
export function getUniqueCities(connections: EnrichedConnection[]): string[] {
  const cities = new Set<string>();
  for (const conn of connections) {
    if (conn.location?.city) {
      cities.add(conn.location.city);
    }
  }
  return Array.from(cities).sort();
}
