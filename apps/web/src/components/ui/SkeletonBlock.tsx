import type { CSSProperties } from "react";

type SkeletonBlockProps = {
  className?: string;
  width?: CSSProperties["width"];
  height?: CSSProperties["height"];
  radius?: CSSProperties["borderRadius"];
};

export function SkeletonBlock({
  className = "",
  width,
  height,
  radius
}: SkeletonBlockProps) {
  return (
    <span
      className={`skeleton-block${className ? ` ${className}` : ""}`}
      style={{
        width,
        height,
        borderRadius: radius
      }}
      aria-hidden="true"
    />
  );
}
