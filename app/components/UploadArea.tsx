"use client";

import { useEffect, useRef, useState } from "react";
import {
  deleteZipFile,
  getZipFileInfo,
  saveZipFile,
  type UploadInfo,
} from "../lib/indexeddb";

type UploadInfoDisplay = Omit<UploadInfo, "data">;

export default function UploadArea() {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploadedInfo, setUploadedInfo] = useState<UploadInfoDisplay | null>(
    null
  );
  const [isUploading, setIsUploading] = useState(false);

  useEffect(() => {
    let isMounted = true;

    const hydrateFromStorage = async () => {
      try {
        const info = await getZipFileInfo();

        if (info && isMounted) {
          setUploadedInfo(info);
        }
      } catch (err) {
        console.error("Failed to load ZIP file info:", err);
      }
    };

    void hydrateFromStorage();

    return () => {
      isMounted = false;
    };
  }, []);

  const storeFile = async (file: File) => {
    setIsUploading(true);
    setError(null);

    try {
      // Validate file type
      if (!file.type.includes("zip") && !file.name.endsWith(".zip")) {
        throw new Error("Please upload a ZIP file");
      }

      // Save to IndexedDB with binary data
      await saveZipFile(file);

      const info: UploadInfoDisplay = {
        name: file.name,
        size: file.size,
        type: file.type || "application/zip",
        lastModified: file.lastModified,
        storedAt: Date.now(),
      };

      setUploadedInfo(info);
      setError(null);
    } catch (err) {
      console.error("Upload error:", err);
      setError(
        err instanceof Error
          ? err.message
          : "Unable to save file to IndexedDB."
      );
    } finally {
      setIsUploading(false);
    }
  };

  const handleFiles = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const file = files[0];
    if (!file) return;
    void storeFile(file);
  };

  const clearUpload = async () => {
    try {
      await deleteZipFile();
      setUploadedInfo(null);
      setError(null);

      if (inputRef.current) {
        inputRef.current.value = "";
      }
    } catch (err) {
      console.error("Failed to clear upload:", err);
      setError("Failed to clear upload");
    }
  };

  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    handleFiles(event.target.files);
  };

  const handleDrop = (event: React.DragEvent<HTMLLabelElement>) => {
    event.preventDefault();
    setIsDragging(false);
    const files = event.dataTransfer.files;
    handleFiles(files);

    if (inputRef.current) {
      inputRef.current.files = files;
    }
  };

  return (
    <div className="flex flex-col items-center gap-4 text-center">
      <div className="grid w-full grid-cols-[2.5rem_1fr] items-center gap-4 text-left">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#f59e8b]/30 text-sm font-semibold">
          6
        </span>
        <span className="text-sm font-semibold text-[#3b3a35]">
          Upload the ZIP to Hello Again to build your city list.
        </span>
      </div>
      <input
        ref={inputRef}
        id="linkedin-zip"
        type="file"
        accept=".zip,application/zip"
        onChange={handleChange}
        className="hidden"
        disabled={isUploading}
      />

      <label
        htmlFor="linkedin-zip"
        className={`flex min-h-[140px] w-full cursor-pointer flex-col items-center justify-center gap-3 rounded-2xl border border-dashed px-6 py-8 text-sm transition ${
          isDragging
            ? "border-[#1d1c1a] bg-[#1d1c1a]/5"
            : "border-[#1d1c1a]/20 bg-white/70"
        } ${isUploading ? "cursor-not-allowed opacity-50" : ""}`}
        onDragOver={(event) => {
          event.preventDefault();
          if (!isUploading) {
            setIsDragging(true);
          }
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
      >
        <span className="font-semibold text-[#1d1c1a]">
          {isUploading ? "Uploading..." : "Upload your LinkedIn ZIP file"}
        </span>
        <span className="text-[#4b4a45]">
          Drag & drop here or click to browse
        </span>
        {error ? (
          <span className="text-xs font-semibold text-[#b45309]">{error}</span>
        ) : null}
        {uploadedInfo ? (
          <div className="mt-4 w-full rounded-2xl border border-[#1d1c1a]/10 bg-white/70 px-5 py-4 text-left text-sm text-[#4b4a45]">
            <div className="flex items-start justify-between gap-4">
              <p className="text-xs uppercase tracking-[0.2em] text-[#7b7872]">
                Uploaded file
              </p>
              <button
                type="button"
                onClick={() => void clearUpload()}
                className="rounded-full border border-[#1d1c1a]/20 px-2 py-1 text-xs font-semibold text-[#1d1c1a]/70 transition hover:border-[#1d1c1a] hover:text-[#1d1c1a]"
                aria-label="Clear uploaded file"
              >
                ✕
              </button>
            </div>
            <p className="mt-2 font-semibold text-[#1d1c1a]">
              {uploadedInfo.name}
            </p>
            <p className="mt-1 text-xs">
              {(uploadedInfo.size / (1024 * 1024)).toFixed(2)} MB ·{" "}
              {uploadedInfo.type || "application/zip"}
            </p>
            <p className="mt-1 text-xs text-[#7b7872]">
              Uploaded {new Date(uploadedInfo.storedAt).toLocaleDateString()}
            </p>
          </div>
        ) : null}
      </label>
    </div>
  );
}
