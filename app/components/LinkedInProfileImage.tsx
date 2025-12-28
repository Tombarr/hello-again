"use client";

import { useState } from "react";

interface LinkedInProfileImageProps {
  /** LinkedIn profile URL */
  profileUrl: string;
  /** Alt text for the image */
  alt: string;
  /** Size of the image in pixels */
  size?: number;
  /** Additional CSS classes */
  className?: string;
}

/**
 * Lazy-loaded LinkedIn profile image component
 * Uses ogfetch proxy to fetch profile images with fallback to SVG avatar
 */
export default function LinkedInProfileImage({
  profileUrl,
  alt,
  size = 40,
  className = "",
}: LinkedInProfileImageProps) {
  const [isLoaded, setIsLoaded] = useState(false);
  const [hasError, setHasError] = useState(false);

  // Construct proxy URL
  const proxyUrl = ``;

  return (
    <div
      className={`relative overflow-hidden rounded-full bg-[#1d1c1a]/5 ${className}`}
      style={{ width: size, height: size }}
    >
      {/* Skeleton loader */}
      {!isLoaded && (
        <div
          className="absolute inset-0 animate-pulse bg-gradient-to-r from-[#1d1c1a]/10 via-[#1d1c1a]/5 to-[#1d1c1a]/10"
          style={{
            backgroundSize: "200% 100%",
            animation: "shimmer 1.5s infinite",
          }}
        />
      )}

      {/* Profile image */}
      <img
        src={proxyUrl}
        alt={alt}
        loading="lazy"
        decoding="async"
        className={`h-full w-full object-cover transition-opacity duration-300 ${
          isLoaded ? "opacity-100" : "opacity-0"
        }`}
        onLoad={() => setIsLoaded(true)}
        onError={() => {
          setHasError(true);
          setIsLoaded(true);
        }}
      />

      {/* Error state - show initials */}
      {hasError && (
        <div className="absolute inset-0 flex items-center justify-center bg-[#1d1c1a] text-xs font-semibold text-[#f6f1ea]">
          {getInitials(alt)}
        </div>
      )}

      <style jsx>{`
        @keyframes shimmer {
          0% {
            background-position: -200% 0;
          }
          100% {
            background-position: 200% 0;
          }
        }
      `}</style>
    </div>
  );
}

/**
 * Get initials from a name
 */
function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(p => p.length > 0);
  if (parts.length === 0) return "?";

  const firstPart = parts[0];
  if (!firstPart) return "?";

  if (parts.length === 1) return firstPart.charAt(0).toUpperCase();

  const lastPart = parts[parts.length - 1];
  if (!lastPart) return firstPart.charAt(0).toUpperCase();

  return firstPart.charAt(0).toUpperCase() + lastPart.charAt(0).toUpperCase();
}
