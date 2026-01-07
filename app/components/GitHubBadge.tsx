"use client";

import { useEffect } from "react";
import Script from "next/script";

export default function GitHubBadge() {
  useEffect(() => {
    // Re-render buttons after script loads
    const renderButtons = () => {
      if (window.GitHubButtons) {
        window.GitHubButtons.render();
      }
    };

    // Wait a bit for the script to initialize
    const timer = setTimeout(renderButtons, 100);
    return () => clearTimeout(timer);
  }, []);

  return (
    <>
      <Script
        src="https://buttons.github.io/buttons.js"
        strategy="afterInteractive"
      />
      <div className="fixed right-4 top-4 z-50 opacity-90 transition hover:opacity-100">
        <a
          className="github-button"
          href="https://github.com/Tombarr/hello-again"
          data-color-scheme="no-preference: light; light: light; dark: dark;"
          data-size="large"
          data-show-count="true"
          aria-label="Star Tombarr/hello-again on GitHub"
        >
          Star
        </a>
      </div>
    </>
  );
}

// Type declaration for GitHubButtons
declare global {
  interface Window {
    GitHubButtons?: {
      render: () => void;
    };
  }
}
