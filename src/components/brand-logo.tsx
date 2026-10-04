import { BrainCircuit } from "lucide-react";
import { cn } from "@/lib/cn";

export function BrandLogo({ className, alt = "StudyFlow" }: { className?: string; alt?: string }) {
  return <span role="img" aria-label={alt} className={cn("inline-flex shrink-0 items-center justify-center rounded-control bg-primary text-white", className)}><BrainCircuit aria-hidden className="h-[60%] w-[60%]" strokeWidth={1.8} /></span>;
}
