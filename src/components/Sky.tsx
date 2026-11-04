import { useMemo, useState } from "react";
import { X } from "lucide-react";
import type { Lantern } from "@/lib/lanterns";

function rand(seed: string) {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 16777619);
  return () => {
    h = Math.imul(h ^ (h >>> 15), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return ((h ^= h >>> 16) >>> 0) / 4294967296;
  };
}

export function LanternShape({ size = 28, hue = 25, className = "" }: { size?: number; hue?: number; className?: string }) {
  return (
    <span
      className={`lantern ${className}`}
      style={{ width: size, height: size * 1.3, ["--h" as string]: hue }}
      aria-hidden
    />
  );
}

export function Stars({ count = 80 }: { count?: number }) {
  const stars = useMemo(() => {
    const r = rand("stars" + count);
    return Array.from({ length: count }, (_, i) => ({
      i, x: r() * 100, y: r() * 85, s: r() * 2 + 0.5, d: r() * 5,
    }));
  }, [count]);
  return (
    <div className="pointer-events-none absolute inset-0">
      {stars.map((s) => (
        <span key={s.i} className="star" style={{ left: `${s.x}%`, top: `${s.y}%`, width: s.s, height: s.s, animationDelay: `${s.d}s` }} />
      ))}
    </div>
  );
}

interface SkyProps {
  lanterns: Lantern[];
  max?: number;
  scale?: number;
  interactive?: boolean;
  highlightId?: string | null | undefined;
}

export function LanternSky({ lanterns, max = 120, scale = 1, interactive = true, highlightId }: SkyProps) {
  const [open, setOpen] = useState<Lantern | null>(null);
  const shown = lanterns.slice(-max);
  return (
    <div className="absolute inset-0 overflow-hidden">
      {shown.map((l) => {
        const r = rand(l.id);
        const size = (16 + r() * 26) * scale;
        const dur = 22 + r() * 26;
        const delay = -r() * dur;
        const x = 3 + r() * 92;
        const isNew = l.id === highlightId;
        return (
          <button
            key={l.id}
            type="button"
            disabled={!interactive}
            onClick={() => setOpen(l)}
            aria-label={`Lantern: ${l.wish}`}
            className={`absolute bottom-0 ${isNew ? "float-new" : "float-up"} ${interactive ? "cursor-pointer" : "cursor-default"}`}
            style={{ left: `${x}%`, animationDuration: isNew ? "9s" : `${dur}s`, animationDelay: isNew ? "0s" : `${delay}s` }}
          >
            <span className="sway block" style={{ animationDuration: `${3 + r() * 3}s` }}>
              <LanternShape size={isNew ? size * 1.6 : size} hue={l.hue} />
            </span>
          </button>
        );
      })}
      {open && (
        <div className="absolute inset-x-4 top-1/3 z-20 mx-auto max-w-xs animate-in fade-in zoom-in-95">
          <div className="wish-card relative p-5 text-center">
            <button onClick={() => setOpen(null)} className="absolute right-2 top-2 text-muted-foreground hover:text-foreground" aria-label="Close">
              <X className="h-4 w-4" />
            </button>
            <p className="font-display text-lg leading-snug text-foreground">"{open.wish}"</p>
            <p className="mt-2 text-sm text-gold">— {open.nickname || "A friend of ThaSaung Taing"}</p>
          </div>
        </div>
      )}
    </div>
  );
}
