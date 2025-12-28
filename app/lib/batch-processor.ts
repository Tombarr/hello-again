/**
 * Batch processing utilities
 * Integrates IndexedDB storage, ZIP extraction, and OpenAI Batch API
 */

import { getApiKey, getZipFileAsBlob } from "./indexeddb";
import { getLinkedInConnections } from "./zip-utils";

export interface BatchProcessingResult {
  success: boolean;
  batchId?: string;
  error?: string;
  connectionsCount?: number;
}

/**
 * Check if all prerequisites are met for batch processing
 */
export async function canProcessBatch(): Promise<{
  ready: boolean;
  missingItems: string[];
}> {
  const missing: string[] = [];

  // Check for API key
  const apiKey = await getApiKey();
  if (!apiKey) {
    missing.push("OpenAI API Key");
  }

  // Check for ZIP file
  const blob = await getZipFileAsBlob();
  if (!blob) {
    missing.push("LinkedIn ZIP file");
  }

  return {
    ready: missing.length === 0,
    missingItems: missing,
  };
}

/**
 * Extract and validate LinkedIn Connections data
 */
export async function extractConnectionsData(): Promise<{
  success: boolean;
  data?: string;
  error?: string;
}> {
  try {
    const blob = await getZipFileAsBlob();
    if (!blob) {
      return {
        success: false,
        error: "No ZIP file uploaded. Please upload your LinkedIn data export.",
      };
    }

    const connections = await getLinkedInConnections(blob);
    if (!connections) {
      return {
        success: false,
        error:
          "Connections.csv not found in the ZIP file. Please ensure you exported your connections.",
      };
    }

    // Validate CSV has data
    const lines = connections.split("\n").filter((line) => line.trim());
    if (lines.length < 2) {
      return {
        success: false,
        error: "Connections.csv appears to be empty.",
      };
    }

    return {
      success: true,
      data: connections,
    };
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "Failed to extract data",
    };
  }
}

/**
 * Parse CSV text into connection objects
 */
export function parseConnectionsCSV(csvText: string): Array<{
  firstName: string;
  lastName: string;
  url: string;
  emailAddress?: string;
  company?: string;
  position?: string;
  connectedOn?: string;
}> {
  const lines = csvText.split("\n");

  // Find header line (skip notes at the top)
  let headerIndex = 0;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line && line.includes("First Name")) {
      headerIndex = i;
      break;
    }
  }

  const headerLine = lines[headerIndex];
  if (!headerLine) {
    return [];
  }

  const headers = parseCSVLine(headerLine);
  const connections = [];

  // Parse data rows
  for (let i = headerIndex + 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line || !line.trim()) continue;

    const values = parseCSVLine(line.trim());
    if (values.length === headers.length) {
      const connection: Record<string, string> = {};
      headers.forEach((header, index) => {
        const value = values[index];
        connection[toCamelCase(header)] = value || "";
      });
      connections.push(connection);
    }
  }

  return connections as Array<{
    firstName: string;
    lastName: string;
    url: string;
    emailAddress?: string;
    company?: string;
    position?: string;
    connectedOn?: string;
  }>;
}

/**
 * Parse a single CSV line handling quoted fields
 */
function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
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
    } else if (char === "," && !inQuotes) {
      result.push(current.trim());
      current = "";
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
function toCamelCase(str: string): string {
  return str
    .toLowerCase()
    .replace(/[^a-zA-Z0-9]+(.)/g, (_match, chr) => chr.toUpperCase());
}

/**
 * Get statistics about the connections data
 */
export async function getConnectionsStats(): Promise<{
  totalConnections: number;
  withEmails: number;
  withCompanies: number;
  withPositions: number;
  recentConnections: number; // Last 30 days
} | null> {
  const result = await extractConnectionsData();
  if (!result.success || !result.data) {
    return null;
  }

  const connections = parseConnectionsCSV(result.data);
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  let withEmails = 0;
  let withCompanies = 0;
  let withPositions = 0;
  let recentConnections = 0;

  for (const conn of connections) {
    if (conn.emailAddress) withEmails++;
    if (conn.company) withCompanies++;
    if (conn.position) withPositions++;

    if (conn.connectedOn) {
      const connDate = new Date(conn.connectedOn);
      if (connDate >= thirtyDaysAgo) {
        recentConnections++;
      }
    }
  }

  return {
    totalConnections: connections.length,
    withEmails,
    withCompanies,
    withPositions,
    recentConnections,
  };
}

/**
 * Preview connections data (first N connections)
 */
export async function previewConnections(
  limit: number = 5
): Promise<
  Array<{
    firstName: string;
    lastName: string;
    company?: string;
    position?: string;
  }>
> {
  const result = await extractConnectionsData();
  if (!result.success || !result.data) {
    return [];
  }

  const connections = parseConnectionsCSV(result.data);
  return connections.slice(0, limit).map((conn) => {
    const preview: {
      firstName: string;
      lastName: string;
      company?: string;
      position?: string;
    } = {
      firstName: conn.firstName,
      lastName: conn.lastName,
    };

    if (conn.company) preview.company = conn.company;
    if (conn.position) preview.position = conn.position;

    return preview;
  });
}
