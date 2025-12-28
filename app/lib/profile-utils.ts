/**
 * Profile extraction and parsing utilities
 * Handles LinkedIn Profile.csv data
 */

import { getZipFileAsBlob } from "./indexeddb";
import { getZipFileAsText } from "./zip-utils";

export interface LinkedInProfile {
  firstName: string;
  lastName: string;
  maidenName?: string;
  address?: string;
  birthDate?: string;
  headline?: string;
  summary?: string;
  industry?: string;
  zipCode?: string;
  geoLocation?: string;
  twitterHandles?: string;
  websites?: string;
  instantMessengers?: string;
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
 * Extract Profile.csv from the uploaded ZIP file
 */
export async function getLinkedInProfile(
  blob: Blob
): Promise<string | null> {
  // Try common locations for Profile.csv in LinkedIn exports
  const possiblePaths = [
    "Profile.csv",
    "profile.csv",
    "data/Profile.csv",
    "Data/Profile.csv",
  ];

  for (const path of possiblePaths) {
    const content = await getZipFileAsText(blob, path);
    if (content) {
      return content;
    }
  }

  // Search for any file named Profile.csv
  try {
    const { findZipFiles } = await import("./zip-utils");
    const files = await findZipFiles(blob, "**/Profile.csv");
    if (files.length > 0 && files[0]) {
      return await getZipFileAsText(blob, files[0].filename);
    }
  } catch (error) {
    console.error("Failed to search for Profile.csv:", error);
  }

  return null;
}

/**
 * Parse Profile.csv into a typed profile object
 */
export function parseProfileCSV(csvText: string): LinkedInProfile | null {
  const lines = csvText.split("\n").filter((line) => line.trim());

  if (lines.length < 2) {
    return null; // Need at least header and one data row
  }

  // Parse header
  const headerLine = lines[0];
  if (!headerLine) return null;
  const headers = parseCSVLine(headerLine);

  // Parse first data row (Profile.csv typically has only one row)
  const valueLine = lines[1];
  if (!valueLine) return null;
  const values = parseCSVLine(valueLine);

  if (values.length !== headers.length) {
    console.warn("Profile CSV header/value mismatch");
    return null;
  }

  // Build profile object
  const profile: Record<string, string> = {};
  headers.forEach((header, index) => {
    const key = toCamelCase(header);
    const value = values[index];
    profile[key] = value || "";
  });

  const result: LinkedInProfile = {
    firstName: profile.firstName || "",
    lastName: profile.lastName || "",
  };

  // Only add optional fields if they have values
  if (profile.maidenName) result.maidenName = profile.maidenName;
  if (profile.address) result.address = profile.address;
  if (profile.birthDate) result.birthDate = profile.birthDate;
  if (profile.headline) result.headline = profile.headline;
  if (profile.summary) result.summary = profile.summary;
  if (profile.industry) result.industry = profile.industry;
  if (profile.zipCode) result.zipCode = profile.zipCode;
  if (profile.geoLocation) result.geoLocation = profile.geoLocation;
  if (profile.twitterHandles) result.twitterHandles = profile.twitterHandles;
  if (profile.websites) result.websites = profile.websites;
  if (profile.instantMessengers) result.instantMessengers = profile.instantMessengers;

  return result;
}

/**
 * Get the user's profile from the uploaded ZIP file
 */
export async function getUserProfile(): Promise<LinkedInProfile | null> {
  try {
    const blob = await getZipFileAsBlob();
    if (!blob) {
      console.error("No ZIP file found");
      return null;
    }

    const profileCSV = await getLinkedInProfile(blob);
    if (!profileCSV) {
      console.error("Profile.csv not found in ZIP");
      return null;
    }

    return parseProfileCSV(profileCSV);
  } catch (error) {
    console.error("Failed to get user profile:", error);
    return null;
  }
}

/**
 * Get user's display name (First name, or "First Last" if needed)
 */
export async function getUserDisplayName(): Promise<string> {
  const profile = await getUserProfile();
  if (!profile) {
    return "Friend"; // Fallback
  }

  return profile.firstName || profile.lastName || "Friend";
}
