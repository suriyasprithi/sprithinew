"use client";

import { useRef, useState } from "react";
import { ImagePlus, X } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type Props = {
  value: string | null;
  onChange: (dataUrl: string | null) => void;
  /** Visual variant — full has a side preview, compact is just the drop area. */
  variant?: "full" | "compact";
  className?: string;
  /** Maximum file size in MB (default 5). Shown as a label and enforced on pick/drop. */
  maxSizeMB?: number;
};

export function ImageDrop({ value, onChange, variant = "full", className, maxSizeMB = 5 }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [hover, setHover] = useState(false);

  function readFile(file: File) {
    // Accept anything that LOOKS like an image: either the MIME type starts with
    // "image/", or — when the OS doesn't supply a MIME type (HEIC, some camera
    // outputs) — the filename ends with a common image extension.
    const looksLikeImage =
      file.type.startsWith("image/") ||
      /\.(png|jpe?g|gif|webp|bmp|svg|avif|heic|heif|tiff?|ico)$/i.test(file.name);
    if (!looksLikeImage) {
      toast.error("Please drop an image file");
      return;
    }
    if (file.size > maxSizeMB * 1024 * 1024) {
      toast.error(`Image must be under ${maxSizeMB} MB`);
      return;
    }
    const reader = new FileReader();
    reader.onload = () => onChange(typeof reader.result === "string" ? reader.result : null);
    reader.readAsDataURL(file);
  }

  const drop = (
    <button
      type="button"
      onClick={() => inputRef.current?.click()}
      onDragEnter={(e) => { e.preventDefault(); setHover(true); }}
      onDragOver={(e) => { e.preventDefault(); setHover(true); }}
      onDragLeave={() => setHover(false)}
      onDrop={(e) => {
        e.preventDefault();
        setHover(false);
        const file = e.dataTransfer.files?.[0];
        if (file) readFile(file);
      }}
      className={cn(
        "flex w-full flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed text-center transition-colors",
        variant === "full" ? "h-32" : "h-24",
        hover ? "border-brand bg-brand/5" : "border-border bg-surface-2/40 hover:border-brand/40",
      )}
    >
      <ImagePlus className={cn("h-6 w-6", hover ? "text-brand" : "text-muted-foreground")} />
      <p className="text-sm font-medium text-muted-foreground">Drag and drop image here</p>
      <p className="text-[11px] text-muted-foreground">or click to browse</p>
      <p className="text-[10px] font-medium text-muted-foreground">Max {maxSizeMB} MB</p>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) readFile(f); e.target.value = ""; }}
      />
    </button>
  );

  const preview = (
    <div className="relative flex h-full w-full items-center justify-center overflow-hidden rounded-xl border border-border bg-surface-2/40">
      {value ? (
        <>
          <img src={value} alt="Preview" className="h-full w-full object-cover" />
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onChange(null); }}
            aria-label="Remove image"
            className="absolute right-1 top-1 inline-flex h-6 w-6 items-center justify-center rounded-full bg-black/60 text-white hover:bg-black"
          >
            <X className="h-3 w-3" />
          </button>
        </>
      ) : (
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Preview</span>
      )}
    </div>
  );

  if (variant === "compact") {
    if (value) {
      return (
        <div className={cn("relative h-24 w-full overflow-hidden rounded-xl border border-border", className)}>
          <img src={value} alt="Preview" className="h-full w-full object-cover" />
          <button
            type="button"
            onClick={() => onChange(null)}
            aria-label="Remove image"
            className="absolute right-1 top-1 inline-flex h-6 w-6 items-center justify-center rounded-full bg-black/60 text-white hover:bg-black"
          >
            <X className="h-3 w-3" />
          </button>
        </div>
      );
    }
    return <div className={className}>{drop}</div>;
  }

  return (
    <div className={cn("grid grid-cols-[1fr_120px] gap-3", className)}>
      {drop}
      <div className="h-32">{preview}</div>
    </div>
  );
}
