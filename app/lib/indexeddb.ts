/**
 * IndexedDB utilities for Hello Again
 * Handles storage of API keys and ZIP file binary data
 */

const DB_NAME = "helloAgain";
const DB_VERSION = 2;
const UPLOADS_STORE = "uploads";
const SETTINGS_STORE = "settings";

export interface UploadInfo {
  name: string;
  size: number;
  type: string;
  lastModified: number;
  storedAt: number;
  data: ArrayBuffer;
}

/**
 * Open or create the IndexedDB database
 */
export function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = request.result;
      const oldVersion = event.oldVersion;

      // Create uploads store if it doesn't exist
      if (!db.objectStoreNames.contains(UPLOADS_STORE)) {
        db.createObjectStore(UPLOADS_STORE);
      }

      // Create settings store for API keys and other settings
      if (!db.objectStoreNames.contains(SETTINGS_STORE)) {
        db.createObjectStore(SETTINGS_STORE);
      }

      // Migration: If upgrading from v1, we need to handle existing data
      if (oldVersion === 1) {
        console.log("Migrating from database version 1 to 2");
        // The existing data will be preserved
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

// ============================================================================
// API Key Storage
// ============================================================================

const OPENAI_API_KEY = "openai_api_key";
const OPENAI_API_KEY_VALIDATED = "openai_api_key_validated";

/**
 * Validate OpenAI API key format
 * Keys should start with 'sk-' or 'sk-proj-' for project keys
 */
export function validateOpenAIApiKey(key: string): boolean {
  if (!key || typeof key !== "string") {
    return false;
  }

  // OpenAI keys start with sk- (legacy) or sk-proj- (project keys)
  // They are typically 48-51 characters long
  const trimmed = key.trim();
  const validPrefix = trimmed.startsWith("sk-proj-") || trimmed.startsWith("sk-");
  const validLength = trimmed.length >= 20; // Minimum reasonable length

  return validPrefix && validLength;
}

/**
 * Save OpenAI API key to IndexedDB
 */
export async function saveApiKey(apiKey: string): Promise<void> {
  if (!validateOpenAIApiKey(apiKey)) {
    throw new Error("Invalid API key format");
  }

  const db = await openDatabase();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(SETTINGS_STORE, "readwrite");
    const store = transaction.objectStore(SETTINGS_STORE);

    store.put(apiKey.trim(), OPENAI_API_KEY);

    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
}

/**
 * Get OpenAI API key from IndexedDB
 */
export async function getApiKey(): Promise<string | null> {
  try {
    const db = await openDatabase();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(SETTINGS_STORE, "readonly");
      const store = transaction.objectStore(SETTINGS_STORE);
      const request = store.get(OPENAI_API_KEY);

      request.onsuccess = () => {
        const value = request.result;
        resolve(typeof value === "string" ? value : null);
      };

      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    console.error("Failed to get API key:", error);
    return null;
  }
}

/**
 * Delete OpenAI API key from IndexedDB
 */
export async function deleteApiKey(): Promise<void> {
  const db = await openDatabase();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(SETTINGS_STORE, "readwrite");
    const store = transaction.objectStore(SETTINGS_STORE);

    store.delete(OPENAI_API_KEY);
    store.delete(OPENAI_API_KEY_VALIDATED);

    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
}

/**
 * Save API key validation status to IndexedDB
 */
export async function saveApiKeyValidationStatus(isValid: boolean): Promise<void> {
  const db = await openDatabase();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(SETTINGS_STORE, "readwrite");
    const store = transaction.objectStore(SETTINGS_STORE);

    store.put(isValid, OPENAI_API_KEY_VALIDATED);

    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
}

/**
 * Get API key validation status from IndexedDB
 */
export async function getApiKeyValidationStatus(): Promise<boolean> {
  try {
    const db = await openDatabase();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(SETTINGS_STORE, "readonly");
      const store = transaction.objectStore(SETTINGS_STORE);
      const request = store.get(OPENAI_API_KEY_VALIDATED);

      request.onsuccess = () => {
        const value = request.result;
        resolve(typeof value === "boolean" ? value : false);
      };

      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    console.error("Failed to get API key validation status:", error);
    return false;
  }
}

// ============================================================================
// ZIP File Storage
// ============================================================================

const LINKEDIN_ZIP_KEY = "linkedinZip";

/**
 * Store ZIP file binary data in IndexedDB
 */
export async function saveZipFile(file: File): Promise<void> {
  // Read file as ArrayBuffer for efficient storage
  const arrayBuffer = await file.arrayBuffer();

  const uploadInfo: UploadInfo = {
    name: file.name,
    size: file.size,
    type: file.type || "application/zip",
    lastModified: file.lastModified,
    storedAt: Date.now(),
    data: arrayBuffer,
  };

  const db = await openDatabase();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(UPLOADS_STORE, "readwrite");
    const store = transaction.objectStore(UPLOADS_STORE);

    store.put(uploadInfo, LINKEDIN_ZIP_KEY);

    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
}

/**
 * Get ZIP file info from IndexedDB (without the binary data)
 */
export async function getZipFileInfo(): Promise<Omit<UploadInfo, "data"> | null> {
  try {
    const db = await openDatabase();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(UPLOADS_STORE, "readonly");
      const store = transaction.objectStore(UPLOADS_STORE);
      const request = store.get(LINKEDIN_ZIP_KEY);

      request.onsuccess = () => {
        const value = request.result as UploadInfo | undefined;
        if (!value) {
          resolve(null);
          return;
        }

        // Return info without the heavy binary data
        resolve({
          name: value.name,
          size: value.size,
          type: value.type,
          lastModified: value.lastModified,
          storedAt: value.storedAt,
        });
      };

      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    console.error("Failed to get ZIP file info:", error);
    return null;
  }
}

/**
 * Get ZIP file binary data from IndexedDB
 */
export async function getZipFileData(): Promise<ArrayBuffer | null> {
  try {
    const db = await openDatabase();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(UPLOADS_STORE, "readonly");
      const store = transaction.objectStore(UPLOADS_STORE);
      const request = store.get(LINKEDIN_ZIP_KEY);

      request.onsuccess = () => {
        const value = request.result as UploadInfo | undefined;
        resolve(value?.data ?? null);
      };

      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    console.error("Failed to get ZIP file data:", error);
    return null;
  }
}

/**
 * Get ZIP file as an Object URL for downloading or processing
 */
export async function getZipFileAsObjectURL(): Promise<string | null> {
  const data = await getZipFileData();
  if (!data) {
    return null;
  }

  const info = await getZipFileInfo();
  const blob = new Blob([data], { type: info?.type || "application/zip" });
  return URL.createObjectURL(blob);
}

/**
 * Get ZIP file as a Blob
 */
export async function getZipFileAsBlob(): Promise<Blob | null> {
  const data = await getZipFileData();
  if (!data) {
    return null;
  }

  const info = await getZipFileInfo();
  return new Blob([data], { type: info?.type || "application/zip" });
}

/**
 * Delete ZIP file from IndexedDB
 */
export async function deleteZipFile(): Promise<void> {
  const db = await openDatabase();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(UPLOADS_STORE, "readwrite");
    const store = transaction.objectStore(UPLOADS_STORE);

    store.delete(LINKEDIN_ZIP_KEY);

    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
}

/**
 * Check if a ZIP file is stored
 */
export async function hasZipFile(): Promise<boolean> {
  const info = await getZipFileInfo();
  return info !== null;
}
