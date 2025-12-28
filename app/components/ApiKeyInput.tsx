"use client";

import { useEffect, useState } from "react";
import {
  deleteApiKey,
  getApiKey,
  saveApiKey,
  validateOpenAIApiKey,
} from "../lib/indexeddb";

export default function ApiKeyInput() {
  const [apiKey, setApiKey] = useState("");
  const [savedKey, setSavedKey] = useState<string | null>(null);
  const [showKey, setShowKey] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    const loadApiKey = async () => {
      try {
        const key = await getApiKey();
        if (isMounted) {
          setSavedKey(key);
          setIsLoading(false);
        }
      } catch (err) {
        console.error("Failed to load API key:", err);
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    void loadApiKey();

    return () => {
      isMounted = false;
    };
  }, []);

  const handleSave = async () => {
    setError(null);
    setSuccess(false);

    if (!apiKey.trim()) {
      setError("Please enter an API key");
      return;
    }

    if (!validateOpenAIApiKey(apiKey)) {
      setError(
        "Invalid API key format. OpenAI keys start with 'sk-' or 'sk-proj-'"
      );
      return;
    }

    try {
      await saveApiKey(apiKey);
      setSavedKey(apiKey);
      setApiKey("");
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to save API key"
      );
    }
  };

  const handleDelete = async () => {
    try {
      await deleteApiKey();
      setSavedKey(null);
      setApiKey("");
      setError(null);
      setSuccess(false);
    } catch (err) {
      setError("Failed to delete API key");
    }
  };

  const maskApiKey = (key: string) => {
    if (key.length <= 12) {
      return key.slice(0, 4) + "..." + key.slice(-4);
    }
    return key.slice(0, 8) + "..." + key.slice(-8);
  };

  if (isLoading) {
    return (
      <div className="rounded-2xl border border-[#1d1c1a]/10 bg-white/70 p-6">
        <div className="flex items-center justify-center">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-[#1d1c1a]/20 border-t-[#1d1c1a]" />
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-[#1d1c1a]/10 bg-white/70 p-6 backdrop-blur">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          <label
            htmlFor="api-key"
            className="block text-xs font-semibold uppercase tracking-[0.2em] text-[#7b7872]"
          >
            OpenAI API Key
          </label>
          <p className="mt-1 text-xs text-[#4b4a45]">
            Required for processing LinkedIn data with AI.{" "}
            <a
              href="https://platform.openai.com/api-keys"
              target="_blank"
              rel="noopener noreferrer"
              className="font-semibold text-[#1d1c1a] underline decoration-[#1d1c1a]/30 underline-offset-2 transition hover:decoration-[#1d1c1a]"
            >
              Get your key here
            </a>
          </p>
        </div>
      </div>

      {savedKey ? (
        <div className="mt-4 space-y-3">
          <div className="flex items-center gap-2 rounded-lg border border-[#1d1c1a]/10 bg-[#f6f1ea]/50 px-4 py-3">
            <div className="flex-1 font-mono text-sm text-[#1d1c1a]">
              {showKey ? savedKey : maskApiKey(savedKey)}
            </div>
            <button
              type="button"
              onClick={() => setShowKey(!showKey)}
              className="rounded px-2 py-1 text-xs font-semibold text-[#4b4a45] transition hover:bg-white/50"
              aria-label={showKey ? "Hide API key" : "Show API key"}
            >
              {showKey ? "Hide" : "Show"}
            </button>
          </div>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleDelete}
              className="rounded-full border border-[#1d1c1a]/20 px-4 py-2 text-xs font-semibold text-[#1d1c1a]/70 transition hover:border-[#1d1c1a] hover:bg-white/50 hover:text-[#1d1c1a]"
            >
              Remove Key
            </button>
          </div>
        </div>
      ) : (
        <div className="mt-4 space-y-3">
          <div className="relative">
            <input
              id="api-key"
              type={showKey ? "text" : "password"}
              value={apiKey}
              onChange={(e) => {
                setApiKey(e.target.value);
                setError(null);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  void handleSave();
                }
              }}
              placeholder="sk-proj-..."
              className="w-full rounded-lg border border-[#1d1c1a]/20 bg-white px-4 py-3 pr-20 font-mono text-sm text-[#1d1c1a] placeholder:text-[#4b4a45]/40 focus:border-[#1d1c1a] focus:outline-none focus:ring-1 focus:ring-[#1d1c1a]"
            />
            <button
              type="button"
              onClick={() => setShowKey(!showKey)}
              className="absolute right-3 top-1/2 -translate-y-1/2 rounded px-2 py-1 text-xs font-semibold text-[#4b4a45] transition hover:bg-[#f6f1ea]"
              aria-label={showKey ? "Hide API key" : "Show API key"}
            >
              {showKey ? "Hide" : "Show"}
            </button>
          </div>

          {error && (
            <div className="rounded-lg bg-[#fef2f2] px-4 py-2 text-xs text-[#b91c1c]">
              {error}
            </div>
          )}

          {success && (
            <div className="rounded-lg bg-[#f0fdf4] px-4 py-2 text-xs text-[#166534]">
              API key saved securely to IndexedDB
            </div>
          )}

          <button
            type="button"
            onClick={() => void handleSave()}
            disabled={!apiKey.trim()}
            className="w-full rounded-full bg-[#1d1c1a] px-6 py-3 text-sm font-semibold text-[#f6f1ea] transition hover:-translate-y-0.5 hover:bg-[#2b2926] disabled:translate-y-0 disabled:cursor-not-allowed disabled:bg-[#1d1c1a]/30"
          >
            Save API Key
          </button>

          <p className="text-xs text-[#7b7872]">
            Your API key is stored locally in your browser and never sent to
            our servers. It&apos;s only used to communicate directly with
            OpenAI.
          </p>
        </div>
      )}
    </div>
  );
}
