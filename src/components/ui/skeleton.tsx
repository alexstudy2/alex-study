import React from "react";

export interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  width?: string | number;
  height?: string | number;
  rounded?: "sm" | "md" | "lg" | "full";
}

export function Skeleton({
  className = "",
  width,
  height,
  rounded = "md",
  style,
  ...props
}: SkeletonProps) {
  const roundedClass =
    rounded === "full"
      ? "style-rounded-full"
      : rounded === "lg"
      ? "style-rounded-lg"
      : rounded === "sm"
      ? "style-rounded-sm"
      : "style-rounded-md";

  return (
    <div
      className={["ui-skeleton", roundedClass, className].filter(Boolean).join(" ")}
      style={{
        width: typeof width === "number" ? `${width}px` : width,
        height: typeof height === "number" ? `${height}px` : height,
        ...style,
      }}
      {...props}
    />
  );
}
