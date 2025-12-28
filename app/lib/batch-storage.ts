/**
 * Batch storage utilities for IndexedDB
 * Stores and manages OpenAI batch jobs
 */

import { openDatabase } from "./indexeddb";

const BATCHES_KEY = "batches";

export type BatchStatus =
  | "validating"
  | "failed"
  | "in_progress"
  | "finalizing"
  | "completed"
  | "expired"
  | "cancelling"
  | "cancelled";

export interface StoredBatch {
  batchId: string;
  createdAt: number;
  status: BatchStatus;
  fileId: string;
  outputFileId?: string;
  errorFileId?: string;
  requestCounts?: {
    total: number;
    completed: number;
    failed: number;
  };
  metadata?: {
    connectionsCount: number;
    description?: string;
  };
  lastChecked?: number;
}

/**
 * Get all stored batches
 */
export async function getAllBatches(): Promise<StoredBatch[]> {
  try {
    const db = await openDatabase();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction("settings", "readonly");
      const store = transaction.objectStore("settings");
      const request = store.get(BATCHES_KEY);

      request.onsuccess = () => {
        const batches = request.result as StoredBatch[] | undefined;
        resolve(batches || []);
      };

      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    console.error("Failed to get batches:", error);
    return [];
  }
}

/**
 * Add a new batch to storage
 */
export async function addBatch(batch: StoredBatch): Promise<void> {
  const batches = await getAllBatches();

  // Check if batch already exists
  const existingIndex = batches.findIndex((b) => b.batchId === batch.batchId);
  if (existingIndex >= 0) {
    // Update existing batch
    batches[existingIndex] = batch;
  } else {
    // Add new batch
    batches.push(batch);
  }

  // Sort by creation date (newest first)
  batches.sort((a, b) => b.createdAt - a.createdAt);

  const db = await openDatabase();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction("settings", "readwrite");
    const store = transaction.objectStore("settings");

    store.put(batches, BATCHES_KEY);

    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
}

/**
 * Update batch status
 */
export async function updateBatchStatus(
  batchId: string,
  status: BatchStatus,
  additionalData?: Partial<StoredBatch>
): Promise<void> {
  const batches = await getAllBatches();
  const batch = batches.find((b) => b.batchId === batchId);

  if (!batch) {
    throw new Error(`Batch ${batchId} not found`);
  }

  // Update batch
  batch.status = status;
  batch.lastChecked = Date.now();

  if (additionalData) {
    Object.assign(batch, additionalData);
  }

  const db = await openDatabase();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction("settings", "readwrite");
    const store = transaction.objectStore("settings");

    store.put(batches, BATCHES_KEY);

    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
}

/**
 * Get a specific batch by ID
 */
export async function getBatch(batchId: string): Promise<StoredBatch | null> {
  const batches = await getAllBatches();
  return batches.find((b) => b.batchId === batchId) || null;
}

/**
 * Delete a batch
 */
export async function deleteBatch(batchId: string): Promise<void> {
  const batches = await getAllBatches();
  const filtered = batches.filter((b) => b.batchId !== batchId);

  const db = await openDatabase();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction("settings", "readwrite");
    const store = transaction.objectStore("settings");

    if (filtered.length === 0) {
      store.delete(BATCHES_KEY);
    } else {
      store.put(filtered, BATCHES_KEY);
    }

    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
}

/**
 * Get pending batches (not completed, failed, expired, or cancelled)
 */
export async function getPendingBatches(): Promise<StoredBatch[]> {
  const batches = await getAllBatches();
  return batches.filter(
    (b) =>
      b.status !== "completed" &&
      b.status !== "failed" &&
      b.status !== "expired" &&
      b.status !== "cancelled"
  );
}

/**
 * Get completed batches
 */
export async function getCompletedBatches(): Promise<StoredBatch[]> {
  const batches = await getAllBatches();
  return batches.filter((b) => b.status === "completed");
}

/**
 * Clear all batches
 */
export async function clearAllBatches(): Promise<void> {
  const db = await openDatabase();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction("settings", "readwrite");
    const store = transaction.objectStore("settings");

    store.delete(BATCHES_KEY);

    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
}
