"use client";

import { useRef, useState } from "react";

export default function UploadArea() {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);

  const handleFiles = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const file = files[0];
    setFileName(file.name);
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
    <div className="flex flex-col gap-4">
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
        className="inline-flex cursor-pointer items-center justify-center rounded-full bg-[#1d1c1a] px-7 py-3 text-sm font-semibold text-[#f6f1ea] transition hover:-translate-y-0.5 hover:bg-[#2b2926]"
      >
        Upload your LinkedIn ZIP file
      </label>

      <label
        htmlFor="linkedin-zip"
        className={`flex min-h-[140px] cursor-pointer flex-col items-center justify-center gap-3 rounded-2xl border border-dashed px-6 py-8 text-sm transition ${
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
      </label>
    </div>
  );
}
