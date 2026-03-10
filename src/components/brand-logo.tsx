"use client";

import { useState } from "react";

export function BrandLogo({
  className,
  alt = "StudyFlow",
}: {
  className?: string;
  alt?: string;
}) {
  const sources = ["/brand/studyflow-logo.png", "/studyflow-logo.png", "/brand/studyflow-logo.svg"];
  const [index, setIndex] = useState(0);

  return (
    <img
      src={sources[index]}
      alt={alt}
      className={className}
      onError={() => {
        if (index < sources.length - 1) {
          setIndex((prev) => prev + 1);
        }
      }}
    />
  );
}
