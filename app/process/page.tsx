"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Fraunces, Work_Sans } from "next/font/google";
import LinkedInContactsMap, {
  type MapPerson,
} from "../components/LinkedInContactsMap";
import type { EnrichedConnection } from "../lib/batch-results";
import { getUserProfile, type LinkedInProfile } from "../lib/profile-utils";
import {
  getAllBatches,
  getPendingBatches,
  deleteBatch,
  type StoredBatch,
} from "../lib/batch-storage";
import {
  createBatch,
  checkBatchStatus,
  downloadBatchResults,
  processBatchWithConnections,
  listOpenAIBatches,
  importBatch,
} from "../lib/batch-api";
import { hasZipFile, getApiKey } from "../lib/indexeddb";

const display = Fraunces({
  subsets: ["latin"],
  weight: ["600", "700"],
});

const body = Work_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

export default function ProcessPage() {
  const router = useRouter();
  const [profile, setProfile] = useState<LinkedInProfile | null>(null);
  const [batches, setBatches] = useState<StoredBatch[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [limit, setLimit] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [mapPeople, setMapPeople] = useState<MapPerson[]>([]);
  const [isMapLoading, setIsMapLoading] = useState(false);
  const [isMapFullWidth, setIsMapFullWidth] = useState(true);

  // Import batches state
  const [openAIBatches, setOpenAIBatches] = useState<Array<{
    id: string;
    status: string;
    created_at: number;
    alreadyImported: boolean;
  }>>([]);
  const [selectedBatchId, setSelectedBatchId] = useState<string>("");
  const [isLoadingBatches, setIsLoadingBatches] = useState(false);
  const [isImporting, setIsImporting] = useState(false);

  // Load profile and batches
  useEffect(() => {
    let isMounted = true;

    const loadData = async () => {
      try {
        // Check if user has uploaded ZIP
        const hasFile = await hasZipFile();
        if (!hasFile) {
          router.push("/");
          return;
        }

        // Load profile
        const userProfile = await getUserProfile();
        if (isMounted) {
          setProfile(userProfile);
        }

        // Load batches
        const allBatches = await getAllBatches();
        if (isMounted) {
          setBatches(allBatches);
        }
      } catch (err) {
        console.error("Failed to load data:", err);
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    void loadData();

    return () => {
      isMounted = false;
    };
  }, [router]);

  // Auto-poll pending batches
  useEffect(() => {
    let interval: NodeJS.Timeout;

    const pollPendingBatches = async () => {
      const pending = await getPendingBatches();

      if (pending.length > 0) {
        for (const batch of pending) {
          await checkBatchStatus(batch.batchId);
        }

        // Refresh batch list
        const allBatches = await getAllBatches();
        setBatches(allBatches);
      }
    };

    // Initial poll
    void pollPendingBatches();

    // Poll every 60 seconds
    interval = setInterval(() => {
      void pollPendingBatches();
    }, 60000);

    return () => {
      if (interval) {
        clearInterval(interval);
      }
    };
  }, []);

  const handleCreateBatch = async () => {
    setIsCreating(true);
    setError(null);
    setSuccess(null);

    try {
      // Check for API key
      const apiKey = await getApiKey();
      if (!apiKey) {
        setError("Please save your API key first");
        router.push("/");
        return;
      }

      // Parse limit
      const limitNum = limit ? parseInt(limit, 10) : undefined;
      if (limit && (isNaN(limitNum!) || limitNum! <= 0)) {
        setError("Limit must be a positive number");
        return;
      }

      const result = await createBatch(limitNum);

      if (result.success) {
        setSuccess(
          `Batch created successfully! ID: ${result.batchId?.slice(0, 20)}...`
        );
        setLimit(""); // Reset limit

        // Refresh batches
        const allBatches = await getAllBatches();
        setBatches(allBatches);

        // Clear success message after 5 seconds
        setTimeout(() => setSuccess(null), 5000);
      } else {
        setError(result.error || "Failed to create batch");
      }
    } catch (err) {
      console.error("Batch creation error:", err);
      setError(
        err instanceof Error ? err.message : "Failed to create batch"
      );
    } finally {
      setIsCreating(false);
    }
  };

  const handleRefreshStatus = async (batchId: string) => {
    await checkBatchStatus(batchId);
    const allBatches = await getAllBatches();
    setBatches(allBatches);
  };

  const handleDownload = async (batch: StoredBatch) => {
    if (!batch.outputFileId) {
      setError("No output file available");
      return;
    }

    try {
      const result = await downloadBatchResults(batch.outputFileId);

      if (result.success && result.data) {
        // Create download link
        const blob = new Blob([JSON.stringify(result.data, null, 2)], {
          type: "application/json",
        });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `batch-results-${batch.batchId}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        setSuccess("Results downloaded successfully");
        setTimeout(() => setSuccess(null), 3000);
      } else {
        setError(result.error || "Failed to download results");
      }
    } catch (err) {
      console.error("Download error:", err);
      setError("Failed to download results");
    }
  };

  const handleShowInMap = async (batch: StoredBatch) => {
    if (!batch.outputFileId) {
      setError("No output file available");
      return;
    }

    try {
      setIsMapLoading(true);
      const result = await processBatchWithConnections(batch.outputFileId);

      if (result.success && Array.isArray(result.data)) {
        const connections = result.data as EnrichedConnection[];
        const people: MapPerson[] = connections.flatMap((connection) => {
          const city = connection.location?.city;
          if (!city) return [];

          const country = connection.location?.country;
          const name = `${connection.firstName ?? ""} ${connection.lastName ?? ""}`.trim();
          const person: MapPerson = {
            name: name || "Unknown",
            url: connection.url ?? "",
            city: country ? `${city}, ${country}` : city,
            company: connection.company ?? "",
            position: connection.position ?? "",
            connectedOn: connection.connectedOn ?? "",
          };

          return [person];
        });

        setMapPeople(people);
        setSuccess(
          `Loaded ${people.length} connections into the map.`
        );
        setTimeout(() => setSuccess(null), 5000);
      } else {
        console.error("❌ Merge failed:", result.error);
        setError(result.error || "Failed to merge data");
      }
    } catch (err) {
      console.error("❌ Merge error:", err);
      setError("Failed to merge data");
    } finally {
      setIsMapLoading(false);
    }
  };

  const handleDeleteBatch = async (batchId: string) => {
    if (!confirm("Are you sure you want to delete this batch?")) {
      return;
    }

    try {
      await deleteBatch(batchId);
      const allBatches = await getAllBatches();
      setBatches(allBatches);
      setSuccess("Batch deleted");
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      console.error("Delete error:", err);
      setError("Failed to delete batch");
    }
  };

  const handleLoadOpenAIBatches = async () => {
    setIsLoadingBatches(true);
    setError(null);

    try {
      const result = await listOpenAIBatches();

      if (result.success && result.batches) {
        // Get current local batches
        const localBatches = await getAllBatches();
        const localBatchIds = new Set(localBatches.map((b) => b.batchId));

        // Mark which batches are already imported
        const batchesWithImportStatus = result.batches.map((batch) => ({
          id: batch.id,
          status: batch.status,
          created_at: batch.created_at,
          alreadyImported: localBatchIds.has(batch.id),
        }));

        setOpenAIBatches(batchesWithImportStatus);
        setSuccess(
          `Loaded ${batchesWithImportStatus.length} batches from OpenAI`
        );
        setTimeout(() => setSuccess(null), 3000);
      } else {
        setError(result.error || "Failed to load batches");
      }
    } catch (err) {
      console.error("Load batches error:", err);
      setError("Failed to load batches from OpenAI");
    } finally {
      setIsLoadingBatches(false);
    }
  };

  const handleImportBatch = async () => {
    if (!selectedBatchId) {
      setError("Please select a batch to import");
      return;
    }

    setIsImporting(true);
    setError(null);

    try {
      const result = await importBatch(selectedBatchId);

      if (result.success) {
        // Refresh local batches
        const allBatches = await getAllBatches();
        setBatches(allBatches);

        // Update OpenAI batches to mark as imported
        setOpenAIBatches((prev) =>
          prev.map((batch) =>
            batch.id === selectedBatchId
              ? { ...batch, alreadyImported: true }
              : batch
          )
        );

        setSuccess("Batch imported successfully");
        setSelectedBatchId(""); // Clear selection
        setTimeout(() => setSuccess(null), 3000);
      } else {
        setError(result.error || "Failed to import batch");
      }
    } catch (err) {
      console.error("Import batch error:", err);
      setError("Failed to import batch");
    } finally {
      setIsImporting(false);
    }
  };

  const getDisplayName = () => {
    if (profile?.firstName) {
      return profile.firstName;
    }
    return "Friend";
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "completed":
        return "bg-green-100 text-green-800 border-green-200";
      case "failed":
      case "expired":
      case "cancelled":
        return "bg-red-100 text-red-800 border-red-200";
      case "in_progress":
      case "finalizing":
        return "bg-blue-100 text-blue-800 border-blue-200";
      default:
        return "bg-gray-100 text-gray-800 border-gray-200";
    }
  };

  if (isLoading) {
    return (
      <div
        className={`${body.className} flex min-h-screen items-center justify-center bg-[#f6f1ea]`}
      >
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#1d1c1a]/20 border-t-[#1d1c1a]" />
          <span className="text-lg text-[#1d1c1a]">Loading...</span>
        </div>
      </div>
    );
  }

  return (
    <div className={`${body.className} min-h-screen bg-[#f6f1ea] text-[#1d1c1a]`}>
      <main className="relative overflow-hidden">
        {/* Background decorations */}
        <div className="absolute inset-0">
          <div className="absolute -left-32 top-24 h-80 w-80 rounded-full bg-[#ffb86c]/40 blur-3xl" />
          <div className="absolute right-0 top-0 h-72 w-72 rounded-full bg-[#7fd1c7]/40 blur-3xl" />
          <div className="absolute bottom-0 left-1/2 h-96 w-96 -translate-x-1/2 rounded-full bg-[#f59e8b]/30 blur-3xl" />
        </div>

        <section className="relative mx-auto max-w-5xl px-6 py-16 sm:px-10 lg:px-16">
          {/* Header */}
          <header className="mb-12 flex flex-col gap-6">
            <button
              onClick={() => router.push("/")}
              className="inline-flex w-fit items-center gap-2 text-sm font-semibold text-[#4b4a45] transition hover:text-[#1d1c1a]"
            >
              <span>←</span> Back to Home
            </button>

            <h1 className={`${display.className} text-4xl sm:text-5xl lg:text-6xl`}>
              Hello {getDisplayName()} <span className="wave">👋</span>
            </h1>

            {profile && (
              <div className="rounded-2xl border border-[#1d1c1a]/10 bg-white/70 p-6 backdrop-blur">
                <p className="text-sm uppercase tracking-[0.2em] text-[#7b7872]">
                  Your Profile
                </p>
                <p className="mt-2 text-lg font-semibold text-[#1d1c1a]">
                  {profile.firstName} {profile.lastName}
                </p>
                {profile.headline && (
                  <p className="mt-1 text-sm text-[#4b4a45]">{profile.headline}</p>
                )}
              </div>
            )}
          </header>

          {/* Batch Creation */}
          <div className="mb-8 rounded-3xl border border-[#1d1c1a]/10 bg-white/80 p-8 shadow-[0_20px_50px_-40px_rgba(0,0,0,0.4)] backdrop-blur">
            <h2 className={`${display.className} text-2xl`}>Create Batch</h2>
            <p className="mt-2 text-sm text-[#4b4a45]">
              Process your LinkedIn connections with AI to find location data
            </p>

            <div className="mt-6 space-y-4">
              <div>
                <label
                  htmlFor="limit"
                  className="block text-sm font-semibold text-[#1d1c1a]"
                >
                  Connection Limit (Optional)
                </label>
                <input
                  id="limit"
                  type="number"
                  min="1"
                  value={limit}
                  onChange={(e) => setLimit(e.target.value)}
                  placeholder="Leave empty to process all connections"
                  className="mt-2 w-full rounded-lg border border-[#1d1c1a]/20 bg-white px-4 py-3 text-sm text-[#1d1c1a] placeholder:text-[#4b4a45]/40 focus:border-[#1d1c1a] focus:outline-none focus:ring-1 focus:ring-[#1d1c1a]"
                />
                <p className="mt-1 text-xs text-[#7b7872]">
                  Limit the number of connections to process (useful for testing)
                </p>
              </div>

              {error && (
                <div className="rounded-lg bg-[#fef2f2] px-4 py-3 text-sm text-[#b91c1c]">
                  {error}
                </div>
              )}

              {success && (
                <div className="rounded-lg bg-[#f0fdf4] px-4 py-3 text-sm text-[#166534]">
                  {success}
                </div>
              )}

              <button
                onClick={handleCreateBatch}
                disabled={isCreating}
                className="w-full rounded-full bg-[#1d1c1a] px-6 py-3 text-sm font-semibold text-[#f6f1ea] transition hover:-translate-y-0.5 hover:bg-[#2b2926] disabled:translate-y-0 disabled:cursor-not-allowed disabled:bg-[#1d1c1a]/30"
              >
                {isCreating ? (
                  <span className="flex items-center justify-center gap-2">
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-[#f6f1ea]/20 border-t-[#f6f1ea]" />
                    Creating Batch...
                  </span>
                ) : (
                  "Create Batch"
                )}
              </button>
            </div>
          </div>

          {/* Import Existing Batch */}
          <div className="mb-8 rounded-3xl border border-[#1d1c1a]/10 bg-white/80 p-8 shadow-[0_20px_50px_-40px_rgba(0,0,0,0.4)] backdrop-blur">
            <h2 className={`${display.className} text-2xl`}>
              Import Existing Batch
            </h2>
            <p className="mt-2 text-sm text-[#4b4a45]">
              Load and import batches created previously on OpenAI
            </p>

            <div className="mt-6 space-y-4">
              <button
                onClick={handleLoadOpenAIBatches}
                disabled={isLoadingBatches}
                className="w-full rounded-full border border-[#1d1c1a]/20 bg-white px-6 py-3 text-sm font-semibold text-[#1d1c1a] transition hover:bg-[#f6f1ea] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isLoadingBatches ? (
                  <span className="flex items-center justify-center gap-2">
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-[#1d1c1a]/20 border-t-[#1d1c1a]" />
                    Loading OpenAI Batches...
                  </span>
                ) : (
                  "Load OpenAI Batches"
                )}
              </button>

              {openAIBatches.length > 0 && (
                <div className="flex gap-3">
                  <select
                    value={selectedBatchId}
                    onChange={(e) => setSelectedBatchId(e.target.value)}
                    className="flex-1 rounded-lg border border-[#1d1c1a]/20 bg-white px-4 py-3 text-sm text-[#1d1c1a] focus:border-[#1d1c1a] focus:outline-none focus:ring-1 focus:ring-[#1d1c1a]"
                  >
                    <option value="">Select a batch to import...</option>
                    {openAIBatches.map((batch) => (
                      <option key={batch.id} value={batch.id}>
                        {batch.id.slice(0, 20)}... ({batch.status}) -{" "}
                        {new Date(batch.created_at * 1000).toLocaleDateString()}
                        {batch.alreadyImported ? " [Already Imported]" : ""}
                      </option>
                    ))}
                  </select>

                  <button
                    onClick={handleImportBatch}
                    disabled={!selectedBatchId || isImporting}
                    className="rounded-full bg-[#1d1c1a] px-6 py-3 text-sm font-semibold text-[#f6f1ea] transition hover:bg-[#2b2926] disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {isImporting ? (
                      <span className="flex items-center gap-2">
                        <div className="h-4 w-4 animate-spin rounded-full border-2 border-[#f6f1ea]/20 border-t-[#f6f1ea]" />
                        Importing...
                      </span>
                    ) : (
                      "Import Batch"
                    )}
                  </button>
                </div>
              )}

              {openAIBatches.length > 0 && (
                <p className="text-xs text-[#7b7872]">
                  Found {openAIBatches.length} batches on OpenAI.{" "}
                  {openAIBatches.filter((b) => b.alreadyImported).length}{" "}
                  already imported.
                </p>
              )}
            </div>
          </div>

          {/* Batch List */}
          <div className="rounded-3xl border border-[#1d1c1a]/10 bg-white/80 p-8 shadow-[0_20px_50px_-40px_rgba(0,0,0,0.4)] backdrop-blur">
            <h2 className={`${display.className} text-2xl`}>Batch Jobs</h2>

            {batches.length === 0 ? (
              <p className="mt-4 text-sm text-[#4b4a45]">
                No batches yet. Create your first batch above!
              </p>
            ) : (
              <div className="mt-6 space-y-4">
                {batches.map((batch) => (
                  <div
                    key={batch.batchId}
                    className="rounded-2xl border border-[#1d1c1a]/10 bg-white/70 p-6"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-3">
                          <span
                            className={`rounded-full border px-3 py-1 text-xs font-semibold ${getStatusColor(
                              batch.status
                            )}`}
                          >
                            {batch.status}
                          </span>
                          {batch.requestCounts && (
                            <span className="text-xs text-[#7b7872]">
                              {batch.requestCounts.completed} /{" "}
                              {batch.requestCounts.total} completed
                            </span>
                          )}
                        </div>

                        <p className="mt-2 font-mono text-xs text-[#4b4a45]">
                          {batch.batchId}
                        </p>

                        {batch.metadata?.description && (
                          <p className="mt-1 text-sm text-[#1d1c1a]">
                            {batch.metadata.description}
                          </p>
                        )}

                        <p className="mt-1 text-xs text-[#7b7872]">
                          Created {new Date(batch.createdAt).toLocaleString()}
                        </p>
                      </div>

                      <div className="flex gap-2">
                        {batch.status === "completed" && batch.outputFileId && (
                          <>
                            <button
                              onClick={() => handleShowInMap(batch)}
                              className="rounded-full border border-[#1d1c1a]/20 bg-[#7fd1c7] px-4 py-2 text-xs font-semibold text-[#1d1c1a] transition hover:bg-[#6dc1b7]"
                              title="Show merged connections in map"
                            >
                              Show in map
                            </button>
                            <button
                              onClick={() => handleDownload(batch)}
                              className="rounded-full border border-[#1d1c1a]/20 bg-[#1d1c1a] px-4 py-2 text-xs font-semibold text-[#f6f1ea] transition hover:bg-[#2b2926]"
                            >
                              Download
                            </button>
                          </>
                        )}

                        <button
                          onClick={() => handleRefreshStatus(batch.batchId)}
                          className="rounded-full border border-[#1d1c1a]/20 px-4 py-2 text-xs font-semibold text-[#1d1c1a] transition hover:bg-[#f6f1ea]"
                          title="Refresh status"
                        >
                          ↻
                        </button>

                        <button
                          onClick={() => handleDeleteBatch(batch.batchId)}
                          className="rounded-full border border-[#b91c1c]/20 px-4 py-2 text-xs font-semibold text-[#b91c1c] transition hover:bg-[#fef2f2]"
                          title="Delete batch"
                        >
                          ✕
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

          </div>
        </section>

        <section
          className={`relative mx-auto pb-20 ${
            isMapFullWidth
              ? "max-w-none px-0"
              : "max-w-6xl px-6 sm:px-10 lg:px-16"
          }`}
        >
          <div
            className={`mb-4 flex justify-end ${
              isMapFullWidth ? "px-20" : ""
            }`}
          >
            <button
              onClick={() => setIsMapFullWidth((value) => !value)}
              className="rounded-full border border-[#1d1c1a]/20 bg-white/80 px-4 py-2 text-xs font-semibold text-[#1d1c1a] transition hover:bg-[#f6f1ea]"
            >
              {isMapFullWidth ? "Set normal width" : "Set full width"}
            </button>
          </div>

          <div
            className={
              isMapFullWidth
                ? "relative left-1/2 right-1/2 -ml-[50vw] -mr-[50vw] w-screen px-20"
                : ""
            }
          >
            <LinkedInContactsMap
              externalPeople={mapPeople}
              externalLoading={isMapLoading}
              fullBleed={isMapFullWidth}
            />
          </div>
        </section>
      </main>
    </div>
  );
}
