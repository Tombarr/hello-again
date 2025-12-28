/**
 * ZIP file utilities using fflate
 * Provides functions to read and extract files from ZIP archives
 */

import { unzip, strFromU8, Unzipped } from "fflate";

export interface ZipFileEntry {
  filename: string;
  directory: boolean;
  uncompressedSize: number;
  compressedSize: number;
  lastModDate?: Date;
}

/**
 * Unzip a Blob and return the extracted files
 */
async function unzipBlob(blob: Blob): Promise<Unzipped> {
  const arrayBuffer = await blob.arrayBuffer();
  const uint8Array = new Uint8Array(arrayBuffer);

  return new Promise((resolve, reject) => {
    unzip(uint8Array, (err, result) => {
      if (err) {
        reject(err);
      } else {
        resolve(result);
      }
    });
  });
}

/**
 * List all files in a ZIP archive
 */
export async function listZipContents(blob: Blob): Promise<ZipFileEntry[]> {
  const unzipped = await unzipBlob(blob);
  const entries: ZipFileEntry[] = [];

  for (const [filename, data] of Object.entries(unzipped)) {
    const isDirectory = filename.endsWith("/");

    entries.push({
      filename,
      directory: isDirectory,
      uncompressedSize: data.length,
      compressedSize: data.length, // fflate doesn't provide compressed size after extraction
    });
  }

  return entries;
}

/**
 * Get a specific file from the ZIP by exact filename
 */
export async function getZipFileByName(
  blob: Blob,
  filename: string
): Promise<Blob | null> {
  const unzipped = await unzipBlob(blob);
  const data = unzipped[filename];

  if (!data) {
    return null;
  }

  // Check if it's a directory
  if (filename.endsWith("/")) {
    return null;
  }

  return new Blob([data]);
}

/**
 * Get a file from the ZIP as text
 */
export async function getZipFileAsText(
  blob: Blob,
  filename: string
): Promise<string | null> {
  const unzipped = await unzipBlob(blob);
  const data = unzipped[filename];

  if (!data || filename.endsWith("/")) {
    return null;
  }

  return strFromU8(data);
}

/**
 * Search for files matching a pattern (simple glob-like matching)
 * Supports wildcards: * (any characters) and ? (single character)
 */
export async function findZipFiles(
  blob: Blob,
  pattern: string
): Promise<ZipFileEntry[]> {
  const unzipped = await unzipBlob(blob);

  // Convert glob pattern to regex
  const regexPattern = pattern
    .replace(/\./g, "\\.")
    .replace(/\*/g, ".*")
    .replace(/\?/g, ".")
    .replace(/\*\*/g, ".*"); // Support ** for recursive matching
  const regex = new RegExp(`^${regexPattern}$`, "i");

  const entries: ZipFileEntry[] = [];

  for (const [filename, data] of Object.entries(unzipped)) {
    if (regex.test(filename)) {
      const isDirectory = filename.endsWith("/");

      entries.push({
        filename,
        directory: isDirectory,
        uncompressedSize: data.length,
        compressedSize: data.length,
      });
    }
  }

  return entries;
}

/**
 * Extract multiple files from ZIP by their filenames
 */
export async function extractZipFiles(
  blob: Blob,
  filenames: string[]
): Promise<Map<string, Blob>> {
  const unzipped = await unzipBlob(blob);
  const results = new Map<string, Blob>();

  for (const filename of filenames) {
    const data = unzipped[filename];

    if (data && !filename.endsWith("/")) {
      results.set(filename, new Blob([data]));
    }
  }

  return results;
}

/**
 * Extract all files from ZIP as a Map
 */
export async function extractAllFiles(blob: Blob): Promise<Map<string, Blob>> {
  const unzipped = await unzipBlob(blob);
  const results = new Map<string, Blob>();

  for (const [filename, data] of Object.entries(unzipped)) {
    if (!filename.endsWith("/")) {
      results.set(filename, new Blob([data]));
    }
  }

  return results;
}

/**
 * Extract all text files from ZIP as a Map
 */
export async function extractAllTextFiles(
  blob: Blob
): Promise<Map<string, string>> {
  const unzipped = await unzipBlob(blob);
  const results = new Map<string, string>();

  for (const [filename, data] of Object.entries(unzipped)) {
    if (!filename.endsWith("/")) {
      results.set(filename, strFromU8(data));
    }
  }

  return results;
}

/**
 * Check if a file exists in the ZIP
 */
export async function zipFileExists(
  blob: Blob,
  filename: string
): Promise<boolean> {
  const unzipped = await unzipBlob(blob);
  return filename in unzipped && !filename.endsWith("/");
}

/**
 * Get LinkedIn Connections.csv file from the ZIP
 * This is a helper specifically for LinkedIn exports
 */
export async function getLinkedInConnections(
  blob: Blob
): Promise<string | null> {
  const unzipped = await unzipBlob(blob);

  // Try common locations for Connections.csv in LinkedIn exports
  const possiblePaths = [
    "Connections.csv",
    "connections.csv",
    "data/Connections.csv",
    "Data/Connections.csv",
  ];

  for (const path of possiblePaths) {
    if (unzipped[path]) {
      return strFromU8(unzipped[path]);
    }
  }

  // If not found in common locations, search for any file named Connections.csv
  for (const [filename, data] of Object.entries(unzipped)) {
    if (
      filename.toLowerCase().includes("connections.csv") &&
      !filename.endsWith("/")
    ) {
      return strFromU8(data);
    }
  }

  return null;
}

/**
 * Get all CSV files from the ZIP
 */
export async function getAllCsvFiles(blob: Blob): Promise<ZipFileEntry[]> {
  const unzipped = await unzipBlob(blob);
  const entries: ZipFileEntry[] = [];

  for (const [filename, data] of Object.entries(unzipped)) {
    if (filename.toLowerCase().endsWith(".csv") && !filename.endsWith("/")) {
      entries.push({
        filename,
        directory: false,
        uncompressedSize: data.length,
        compressedSize: data.length,
      });
    }
  }

  return entries;
}

/**
 * Validate that a blob appears to be a valid ZIP file
 */
export async function isValidZipFile(blob: Blob): Promise<boolean> {
  try {
    await unzipBlob(blob);
    return true;
  } catch (error) {
    console.error("Invalid ZIP file:", error);
    return false;
  }
}

/**
 * Get file count in ZIP (excluding directories)
 */
export async function getFileCount(blob: Blob): Promise<number> {
  const unzipped = await unzipBlob(blob);
  let count = 0;

  for (const filename of Object.keys(unzipped)) {
    if (!filename.endsWith("/")) {
      count++;
    }
  }

  return count;
}

/**
 * Get total uncompressed size of all files in ZIP
 */
export async function getTotalSize(blob: Blob): Promise<number> {
  const unzipped = await unzipBlob(blob);
  let totalSize = 0;

  for (const [filename, data] of Object.entries(unzipped)) {
    if (!filename.endsWith("/")) {
      totalSize += data.length;
    }
  }

  return totalSize;
}
