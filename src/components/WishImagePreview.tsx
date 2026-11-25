import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface WishImagePreviewProps {
  src: string;
  alt: string;
  label: string;
  compact?: boolean;
}

export function WishImagePreview({ src, alt, label, compact = false }: WishImagePreviewProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        className={`wish-image-open${compact ? " wish-image-open-compact" : ""}`}
        aria-label={label}
        onClick={() => setOpen(true)}
      >
        <img
          src={src}
          alt={alt}
          className={compact ? "wish-image-thumbnail" : "wish-image-wall-thumbnail"}
        />
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="wish-image-dialog max-w-[min(94vw,64rem)]">
          <DialogHeader>
            <DialogTitle>Wish photo</DialogTitle>
            <DialogDescription>{alt}</DialogDescription>
          </DialogHeader>
          <img
            src={src}
            alt={alt}
            className="mx-auto max-h-[75vh] w-full rounded-lg object-contain"
          />
        </DialogContent>
      </Dialog>
    </>
  );
}
