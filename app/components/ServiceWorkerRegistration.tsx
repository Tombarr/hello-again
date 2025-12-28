"use client";

import { useEffect, useState } from "react";

/**
 * Service Worker registration component
 * Registers the service worker and provides cache management
 */
export default function ServiceWorkerRegistration() {
  const [registration, setRegistration] = useState<ServiceWorkerRegistration | null>(null);
  const [updateAvailable, setUpdateAvailable] = useState(false);

  useEffect(() => {
    // Check if service workers are supported
    if (typeof window !== "undefined" && "serviceWorker" in navigator) {
      // Register service worker
      navigator.serviceWorker
        .register("/sw.js")
        .then((reg) => {
          console.log("✅ Service Worker registered:", reg);
          setRegistration(reg);

          // Check for updates
          reg.addEventListener("updatefound", () => {
            const newWorker = reg.installing;
            if (newWorker) {
              newWorker.addEventListener("statechange", () => {
                if (
                  newWorker.state === "installed" &&
                  navigator.serviceWorker.controller
                ) {
                  // New service worker available
                  setUpdateAvailable(true);
                  console.log("🔄 Service Worker update available");
                }
              });
            }
          });
        })
        .catch((error) => {
          console.error("❌ Service Worker registration failed:", error);
        });

      // Listen for controller change (new SW activated)
      navigator.serviceWorker.addEventListener("controllerchange", () => {
        console.log("🔄 Service Worker controller changed");
        // Reload to use new service worker
        if (!window.location.pathname.includes("process")) {
          window.location.reload();
        }
      });
    }
  }, []);

  // Auto-update when new version available
  useEffect(() => {
    if (updateAvailable && registration) {
      // Skip waiting and activate new service worker
      registration.waiting?.postMessage({ type: "SKIP_WAITING" });
    }
  }, [updateAvailable, registration]);

  return null; // This component doesn't render anything
}

/**
 * Clear all service worker caches
 */
export async function clearServiceWorkerCache(): Promise<boolean> {
  if ("serviceWorker" in navigator) {
    const controller = navigator.serviceWorker.controller;
    if (!controller) return false;

    return new Promise((resolve) => {
      const messageChannel = new MessageChannel();

      messageChannel.port1.onmessage = (event) => {
        resolve(event.data.success || false);
      };

      controller.postMessage(
        { type: "CLEAR_CACHE" },
        [messageChannel.port2]
      );
    });
  }
  return false;
}

/**
 * Get cache size statistics
 */
export async function getCacheStats(): Promise<{
  mapbox: number;
  images: number;
  static: number;
  total: number;
} | null> {
  if ("serviceWorker" in navigator) {
    const controller = navigator.serviceWorker.controller;
    if (!controller) return null;

    return new Promise((resolve) => {
      const messageChannel = new MessageChannel();

      messageChannel.port1.onmessage = (event) => {
        resolve(event.data);
      };

      controller.postMessage(
        { type: "GET_CACHE_SIZE" },
        [messageChannel.port2]
      );

      // Timeout after 5 seconds
      setTimeout(() => resolve(null), 5000);
    });
  }
  return null;
}

/**
 * Format bytes to human-readable size
 */
export function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 Bytes";

  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + " " + sizes[i];
}
