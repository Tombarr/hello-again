"use client";

import { useEffect, useRef, useState } from "react";

type UploadInfo = {
  name: string;
  size: number;
  type: string;
  lastModified: number;
  storedAt: number;
};

export default function UploadArea() {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [uploadedInfo, setUploadedInfo] = useState<UploadInfo | null>(null);

  useEffect(() => {
    let isMounted = true;
    const hydrateFromStorage = async () => {
      const stored = localStorage.getItem("helloAgainUploadInfo");
      if (stored) {
        try {
          const parsed = JSON.parse(stored) as UploadInfo;
          if (isMounted) {
            setUploadedInfo(parsed);
            setFileName(parsed.name);
          }
          return;
        } catch (err) {
          localStorage.removeItem("helloAgainUploadInfo");
        }
      }

      try {
        const db = await openDatabase();
        const record = await new Promise<UploadInfo | null>((resolve, reject) => {
          const transaction = db.transaction("uploads", "readonly");
          const store = transaction.objectStore("uploads");
          const request = store.get("linkedinZip");
          request.onsuccess = () => {
            const value = request.result as
              | (UploadInfo & { file?: File })
              | undefined;
            if (!value) {
              resolve(null);
              return;
            }
            resolve({
              name: value.name,
              size: value.size,
              type: value.type,
              lastModified: value.lastModified,
              storedAt: Date.now(),
            });
          };
          request.onerror = () => reject(request.error);
        });

        if (record && isMounted) {
          localStorage.setItem("helloAgainUploadInfo", JSON.stringify(record));
          setUploadedInfo(record);
          setFileName(record.name);
        }
      } catch (err) {
        // ignore hydration failures
      }
    };

    void hydrateFromStorage();
    return () => {
      isMounted = false;
    };
  }, []);

  const openDatabase = () =>
    new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open("helloAgain", 1);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains("uploads")) {
          db.createObjectStore("uploads");
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });

  const storeFile = async (file: File) => {
    try {
      const db = await openDatabase();
      await new Promise<void>((resolve, reject) => {
        const transaction = db.transaction("uploads", "readwrite");
        const store = transaction.objectStore("uploads");
        store.put(
          {
            name: file.name,
            size: file.size,
            type: file.type,
            lastModified: file.lastModified,
            file,
          },
          "linkedinZip"
        );
        transaction.oncomplete = () => resolve();
        transaction.onerror = () => reject(transaction.error);
      });
      const info: UploadInfo = {
        name: file.name,
        size: file.size,
        type: file.type,
        lastModified: file.lastModified,
        storedAt: Date.now(),
      };
      localStorage.setItem("helloAgainUploadInfo", JSON.stringify(info));
      setUploadedInfo(info);
      setError(null);
    } catch (err) {
      setError("Unable to save file to IndexedDB.");
    }
  };

  const handleFiles = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const file = files[0];
    setFileName(file.name);
    void storeFile(file);
  };

  const clearUpload = async () => {
    try {
      const db = await openDatabase();
      await new Promise<void>((resolve, reject) => {
        const transaction = db.transaction("uploads", "readwrite");
        const store = transaction.objectStore("uploads");
        store.delete("linkedinZip");
        transaction.oncomplete = () => resolve();
        transaction.onerror = () => reject(transaction.error);
      });
    } catch (err) {
      // ignore clearing failure
    }
    localStorage.removeItem("helloAgainUploadInfo");
    setUploadedInfo(null);
    setFileName(null);
    if (inputRef.current) {
      inputRef.current.value = "";
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
      <input
        ref={inputRef}
        id="linkedin-zip"
        type="file"
        accept=".zip,application/zip"
        onChange={handleChange}
        className="hidden"
      />

      <label
        htmlFor="linkedin-zip"
        className="inline-flex w-full cursor-pointer items-center justify-center rounded-full bg-[#1d1c1a] px-7 py-3 text-sm font-semibold text-[#f6f1ea] transition hover:-translate-y-0.5 hover:bg-[#2b2926]"
      >
        Upload your LinkedIn ZIP file
      </label>

      <label
        htmlFor="linkedin-zip"
        className={`flex min-h-[140px] w-full cursor-pointer flex-col items-center justify-center gap-3 rounded-2xl border border-dashed px-6 py-8 text-sm transition ${
          isDragging
            ? "border-[#1d1c1a] bg-[#1d1c1a]/5"
            : "border-[#1d1c1a]/20 bg-white/70"
        }`}
        onDragOver={(event) => {
          event.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
      >
        <span className="font-semibold text-[#1d1c1a]">
          Drag & drop your LinkedIn ZIP here
        </span>
        <span className="text-[#4b4a45]">
          {fileName ? `Selected: ${fileName}` : "or click to browse files"}
        </span>
        {error ? (
          <span className="text-xs font-semibold text-[#b45309]">{error}</span>
        ) : null}
      </label>
      {uploadedInfo ? (
        <div className="w-full rounded-2xl border border-[#1d1c1a]/10 bg-white/70 px-5 py-4 text-left text-sm text-[#4b4a45]">
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
        </div>
      ) : null}
    </div>
  );
}
