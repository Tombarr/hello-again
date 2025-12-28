"use client";

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
 * LinkedIn profile image component with static SVG avatar placeholder
 */
export default function LinkedInProfileImage({
  profileUrl: _profileUrl,
  alt,
  size = 40,
  className = "",
}: LinkedInProfileImageProps) {
  return (
    <div
      className={`relative overflow-hidden rounded-full bg-[#e8eef3] ${className}`}
      style={{ width: size, height: size }}
      title={alt}
    >
      {/* Static SVG Avatar */}
      <svg
        aria-hidden="true"
        role="none"
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 128 128"
        className="h-full w-full"
      >
        <path fill="transparent" d="M0 0h128v128H0z" />
        <path
          d="M88.41 84.67a32 32 0 10-48.82 0 66.13 66.13 0 0148.82 0z"
          fill="#788fa5"
        />
        <path
          d="M88.41 84.67a32 32 0 01-48.82 0A66.79 66.79 0 000 128h128a66.79 66.79 0 00-39.59-43.33z"
          fill="#9db3c8"
        />
        <path
          d="M64 96a31.93 31.93 0 0024.41-11.33 66.13 66.13 0 00-48.82 0A31.93 31.93 0 0064 96z"
          fill="#56687a"
        />
      </svg>
    </div>
  );
}
