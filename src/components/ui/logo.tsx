"use client";

import React, { useState } from "react";

export function AlexStudyLogo({ size = 36, className = "" }: { size?: number; className?: string }) {
  const [imgError, setImgError] = useState(false);

  return (
    <span
      className={`inline-flex items-center gap-2.5 ${className}`}
      style={{ display: "inline-flex", alignItems: "center", gap: "0.6rem" }}
    >
      {!imgError ? (
        <img
          src="/logo.png"
          alt="Alex Study Logo"
          width={size}
          height={size}
          style={{ width: size, height: size, objectFit: "contain", borderRadius: "8px" }}
          onError={() => setImgError(true)}
        />
      ) : (
        <svg
          width={size}
          height={size}
          viewBox="0 0 48 48"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="shrink-0"
          aria-hidden="true"
        >
          {/* Shield Outer Border */}
          <path
            d="M24 4L7 10V22C7 33.1 14.3 43.1 24 46C33.7 43.1 41 33.1 41 22V10L24 4Z"
            fill="var(--primary)"
            stroke="var(--accent)"
            strokeWidth="2.5"
            strokeLinejoin="round"
          />
          {/* Inner Shield Accent */}
          <path
            d="M24 8L11 12.6V22C11 30.6 16.5 38.4 24 40.8C31.5 38.4 37 30.6 37 22V12.6L24 8Z"
            fill="var(--surface)"
            fillOpacity="0.15"
          />
          {/* Rod of Asclepius / Caduceus Staff (Gold) */}
          <path d="M24 12V36" stroke="var(--accent)" strokeWidth="3" strokeLinecap="round" />
          {/* Serpent Winding (Gold & White) */}
          <path
            d="M18 16C18 16 22 14 26 18C30 22 22 26 26 30C30 34 22 36 22 36"
            stroke="var(--accent)"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          {/* Star of Excellence */}
          <circle cx="24" cy="12" r="3" fill="var(--accent)" />
        </svg>
      )}
      <span className="font-extrabold tracking-tight" style={{ fontWeight: 800 }}>
        Alex <span style={{ color: "var(--accent)" }}>Study</span>
      </span>
    </span>
  );
}
