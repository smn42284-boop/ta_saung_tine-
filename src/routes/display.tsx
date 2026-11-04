import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { LanternSky, Stars } from "@/components/Sky";
import { useLanterns, type Lantern } from "@/lib/lanterns";

export const Route = createFileRoute("/display")({
  head: () => ({
    meta: [
      { title: "Light Up Taunggyi — Festival Sky" },
      { name: "description", content: "The live shared lantern sky of the Taunggyi Coke Chill Festival." },
      { property: "og:title", content: "Light Up Taunggyi — Festival Sky" },
      { property: "og:description", content: "Every light tells a story. Watch Taunggyi's lanterns rise." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Display,
});

const MILESTONES = [1000, 3000, 5000];

function Display() {
  const all = useLanterns();
  const approved = useMemo(() => all.filter((l) => l.status === "approved"), [all]);
  const count = approved.length;
  const [card, setCard] = useState<Lantern | null>(null);
  const [celebrate, setCelebrate] = useState<number | null>(null);
  const prev = useRef<number | null>(null);

  useEffect(() => {
    if (!approved.length) return;
    const pick = () => setCard(approved[Math.floor(Math.random() * Math.min(approved.length, 60)) + Math.max(0, approved.length - 60)] ?? null);
    pick();
    const t = setInterval(pick, 7500);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [approved.length > 0]);

  useEffect(() => {
    if (prev.current !== null) {
      const hit = MILESTONES.find((m) => prev.current! < m && count >= m);
      if (hit) {
        setCelebrate(hit);
        setTimeout(() => setCelebrate(null), 8000);
      }
    }
    prev.current = count;
  }, [count]);

  return (
    <main className="fixed inset-0 overflow-hidden bg-sky">
      <Stars count={160} />
      <LanternSky lanterns={approved} max={400} scale={1.4} interactive={false} highlightId={approved.at(-1)?.id} />

      <div className="pointer-events-none absolute inset-x-0 top-[6vh] text-center">
        <p className="font-display text-[5vw] font-bold leading-none text-foreground text-glow">Every Light Tells a Story</p>
        <p className="mt-[1.5vh] font-serif text-[1.6vw] tracking-[0.4em] text-gold">TOGETHER, WE LIGHT UP TAUNGGYI</p>
      </div>

      <div className="pointer-events-none absolute bottom-[5vh] left-[4vw]">
        <p className="font-display text-[7vw] font-bold leading-none text-gold text-glow tabular-nums">{count.toLocaleString()}</p>
        <p className="mt-2 text-[1.4vw] uppercase tracking-[0.3em] text-foreground/80">lanterns illuminated</p>
      </div>

      <div className="pointer-events-none absolute bottom-[5vh] right-[4vw] text-right">
        <p className="font-serif text-[1.3vw] font-bold tracking-widest text-primary-foreground"><span className="rounded-full bg-primary px-[1.2vw] py-[0.5vw] shadow-glow">Coke Chill Festival</span></p>
        <p className="mt-3 text-[1.1vw] text-muted-foreground">Scan the QR code to add your lantern</p>
      </div>

      {card && (
        <div key={card.id + Date.now()} className="fade-cycle pointer-events-none absolute left-1/2 top-[38vh] w-[38vw] -translate-x-1/2">
          <div className="wish-card px-[2.5vw] py-[2vw] text-center">
            <p className="font-serif text-[2.1vw] leading-snug text-foreground">"{card.wish}"</p>
            <p className="mt-[1vw] text-[1.3vw] text-gold">— {card.nickname || "A friend of Taunggyi"}</p>
          </div>
        </div>
      )}

      {celebrate && <Celebration value={celebrate} />}
    </main>
  );
}

function Celebration({ value }: { value: number }) {
  const sparks = useMemo(() => Array.from({ length: 6 }).flatMap((_, b) =>
    Array.from({ length: 24 }, (_, i) => {
      const a = (i / 24) * Math.PI * 2;
      const r = 120 + Math.random() * 120;
      return { k: `${b}-${i}`, x: 15 + b * 14, y: 20 + (b % 2) * 25, dx: Math.cos(a) * r, dy: Math.sin(a) * r, d: b * 0.5 };
    })), []);
  return (
    <div className="pointer-events-none absolute inset-0 z-30 animate-in fade-in">
      {sparks.map((s) => (
        <span key={s.k} className="firework" style={{ left: `${s.x}%`, top: `${s.y}%`, ["--dx" as string]: `${s.dx}px`, ["--dy" as string]: `${s.dy}px`, animationDelay: `${s.d}s` }} />
      ))}
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <p className="font-display text-[10vw] font-bold text-gold text-glow">{value.toLocaleString()}</p>
        <p className="font-serif text-[2.5vw] tracking-widest text-foreground">LANTERNS LIGHT UP TAUNGGYI!</p>
      </div>
    </div>
  );
}
