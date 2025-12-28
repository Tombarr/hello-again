"use client";

import { useEffect, useState } from "react";
import { getZipFileAsBlob } from "../lib/indexeddb";
import {
  getAllCsvFiles,
  getLinkedInConnections,
  listZipContents,
  type ZipFileEntry,
} from "../lib/zip-utils";

export default function ZipFileViewer() {
  const [files, setFiles] = useState<ZipFileEntry[]>([]);
  const [csvFiles, setCsvFiles] = useState<ZipFileEntry[]>([]);
  const [connectionsPreview, setConnectionsPreview] = useState<string | null>(
    null
  );
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);

  const loadZipContents = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const blob = await getZipFileAsBlob();

      if (!blob) {
        setError("No ZIP file found. Please upload a file first.");
        return;
      }

      // List all files
      const allFiles = await listZipContents(blob);
      setFiles(allFiles);

      // Get CSV files
      const csvs = await getAllCsvFiles(blob);
      setCsvFiles(csvs);

      // Try to get Connections.csv preview
      const connections = await getLinkedInConnections(blob);
      if (connections) {
        // Show first 500 characters as preview
        setConnectionsPreview(connections.substring(0, 500));
      }
    } catch (err) {
      console.error("Failed to read ZIP:", err);
      setError(
        err instanceof Error ? err.message : "Failed to read ZIP file"
      );
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadZipContents();
  }, []);

  if (isLoading) {
    return (
      <div className="rounded-2xl border border-[#1d1c1a]/10 bg-white/70 p-6">
        <div className="flex items-center justify-center gap-3">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-[#1d1c1a]/20 border-t-[#1d1c1a]" />
          <span className="text-sm text-[#4b4a45]">Reading ZIP file...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-2xl border border-[#b91c1c]/20 bg-[#fef2f2] p-6">
        <p className="text-sm text-[#b91c1c]">{error}</p>
      </div>
    );
  }

  if (files.length === 0) {
    return null;
  }

  const displayFiles = showAll ? files : files.slice(0, 10);
  const hasMore = files.length > 10;

  return (
    <div className="space-y-4">
      {/* CSV Files Summary */}
      {csvFiles.length > 0 && (
        <div className="rounded-2xl border border-[#1d1c1a]/10 bg-white/70 p-6">
          <h3 className="text-sm font-semibold uppercase tracking-[0.2em] text-[#7b7872]">
            CSV Files Found
          </h3>
          <div className="mt-3 space-y-2">
            {csvFiles.map((file) => (
              <div
                key={file.filename}
                className="flex items-center justify-between rounded-lg border border-[#1d1c1a]/10 bg-[#f6f1ea]/50 px-4 py-2"
              >
                <span className="text-sm font-medium text-[#1d1c1a]">
                  {file.filename}
                </span>
                <span className="text-xs text-[#7b7872]">
                  {(file.uncompressedSize / 1024).toFixed(1)} KB
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Connections Preview */}
      {connectionsPreview && (
        <div className="rounded-2xl border border-[#1d1c1a]/10 bg-white/70 p-6">
          <h3 className="text-sm font-semibold uppercase tracking-[0.2em] text-[#7b7872]">
            Connections.csv Preview
          </h3>
          <pre className="mt-3 overflow-x-auto rounded-lg border border-[#1d1c1a]/10 bg-[#f6f1ea]/50 p-4 text-xs text-[#1d1c1a]">
            {connectionsPreview}
            {connectionsPreview.length === 500 && "..."}
          </pre>
        </div>
      )}

      {/* All Files List */}
      <div className="rounded-2xl border border-[#1d1c1a]/10 bg-white/70 p-6">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold uppercase tracking-[0.2em] text-[#7b7872]">
            All Files ({files.length})
          </h3>
          {hasMore && (
            <button
              onClick={() => setShowAll(!showAll)}
              className="rounded-full border border-[#1d1c1a]/20 px-3 py-1 text-xs font-semibold text-[#1d1c1a]/70 transition hover:border-[#1d1c1a] hover:text-[#1d1c1a]"
            >
              {showAll ? "Show less" : `Show all (${files.length})`}
            </button>
          )}
        </div>

        <div className="mt-3 max-h-96 space-y-1 overflow-y-auto">
          {displayFiles.map((file) => (
            <div
              key={file.filename}
              className="flex items-center justify-between rounded px-3 py-2 text-sm transition hover:bg-[#f6f1ea]/50"
            >
              <div className="flex items-center gap-2">
                {file.directory ? (
                  <span className="text-[#7b7872]">📁</span>
                ) : (
                  <span className="text-[#7b7872]">📄</span>
                )}
                <span className="font-mono text-xs text-[#1d1c1a]">
                  {file.filename}
                </span>
              </div>
              {!file.directory && (
                <span className="text-xs text-[#7b7872]">
                  {(file.uncompressedSize / 1024).toFixed(1)} KB
                </span>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
