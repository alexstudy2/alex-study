"use client";

import React from "react";

export function AlexStudyLogo({ size = 34, className = "" }: { size?: number; className?: string }) {
  return (
    <span
      className={`inline-flex items-center gap-2.5 select-none ${className}`}
      style={{ display: "inline-flex", alignItems: "center", gap: "0.6rem" }}
    >
      <svg
        width={size}
        height={size}
        viewBox="0 0 48 48"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="shrink-0"
        aria-hidden="true"
      >
        {/* Hand-Drawn Sketch Pad Shield */}
        <path
          d="M24 4C14 7 7 11 7 22C7 33.5 15.5 43.5 24 46C32.5 43.5 41 33.5 41 22C41 11 34 7 24 4Z"
          fill="var(--primary)"
          stroke="var(--secondary)"
          strokeWidth="3"
          strokeLinejoin="round"
        />
        {/* Playful Stethoscope / Caduceus Doodle */}
        <path
          d="M24 12V36"
          stroke="var(--secondary)"
          strokeWidth="3.5"
          strokeLinecap="round"
        />
        <path
          d="M17 18C17 18 22 15 25 19C28 23 20 27 25 31C28 34 23 36 23 36"
          stroke="#FFFFFF"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {/* Sketch Spark Star */}
        <circle cx="24" cy="11" r="3.5" fill="var(--warning)" stroke="var(--secondary)" strokeWidth="1.5" />
      </svg>
      <span
        style={{
          fontFamily: "var(--font-heading)",
          fontSize: "1.25rem",
          fontWeight: 800,
          color: "var(--secondary)",
          letterSpacing: "-0.01em",
        }}
      >
        Alex <span style={{ color: "var(--primary)" }}>Study</span>
      </span>
    </span>
  );
}
