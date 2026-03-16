"use client";

import Image from "next/image";
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
    <Image
      src={sources[index]}
      alt={alt}
      width={64}
      height={64}
      className={className}
      onError={() => {
        if (index < sources.length - 1) {
          setIndex((prev) => prev + 1);
        }
      }}
    />
  );
}
