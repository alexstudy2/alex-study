"use client";

import React from "react";

export function DoodleLoader({
  message,
  className = "",
}: {
  message?: string;
  className?: string;
}) {
  return (
    <div
      className={`doodle-loader-container flex flex-col items-center justify-center p-8 text-center ${className}`}
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <div className="doodle-loader-anim relative w-20 h-20 mb-4">
        {/* Animated Sketchpad Paper Card */}
        <svg
          viewBox="0 0 80 80"
          className="w-full h-full"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          {/* Paper sheet */}
          <rect
            x="12"
            y="14"
            width="52"
            height="56"
            rx="6"
            fill="var(--surface)"
            stroke="var(--secondary)"
            strokeWidth="3"
            className="animate-pulse"
          />
          {/* Notebook binder rings */}
          <circle cx="20" cy="14" r="3" fill="var(--secondary)" />
          <circle cx="38" cy="14" r="3" fill="var(--secondary)" />
          <circle cx="56" cy="14" r="3" fill="var(--secondary)" />

          {/* Hand-drawn sketch lines */}
          <line
            x1="22"
            y1="28"
            x2="54"
            y2="28"
            stroke="var(--line)"
            strokeWidth="2.5"
            strokeLinecap="round"
          />
          <line
            x1="22"
            y1="38"
            x2="48"
            y2="38"
            stroke="var(--primary)"
            strokeWidth="3"
            strokeLinecap="round"
          />
          <line
            x1="22"
            y1="48"
            x2="52"
            y2="48"
            stroke="var(--line)"
            strokeWidth="2.5"
            strokeLinecap="round"
          />

          {/* Animated bouncy pencil */}
          <g className="animate-bounce" style={{ transformOrigin: "50% 50%" }}>
            <path
              d="M52 24L62 34L44 52L34 52L34 42L52 24Z"
              fill="var(--warning)"
              stroke="var(--secondary)"
              strokeWidth="2"
            />
            <polygon points="34,52 30,56 34,48" fill="var(--secondary)" />
          </g>
        </svg>
      </div>

      {message && (
        <p
          className="text-sm font-bold text-secondary animate-pulse"
          style={{ fontFamily: "var(--font-heading)" }}
        >
          {message}
        </p>
      )}
    </div>
  );
}
