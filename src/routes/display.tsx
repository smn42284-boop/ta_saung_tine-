import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Cog } from "lucide-react";
import { LanternSky, Stars } from "@/components/Sky";
import { useLanterns, type Lantern } from "@/lib/lanterns";
import { appSubtitle, appTitle } from "@/lib/app-config";

export const Route = createFileRoute("/display")({
  head: () => ({
    meta: [
      { title: `${appTitle} — Festival Display` },
      { name: "description", content: appSubtitle },
      { property: "og:title", content: appTitle },
      { property: "og:description", content: appSubtitle },
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
  const [cardIndex, setCardIndex] = useState(0);
  const [celebrate, setCelebrate] = useState<number | null>(null);
  const prev = useRef<number | null>(null);

  useEffect(() => {
    if (!approved.length) return;
    setCardIndex(0);
    const t = setInterval(() => {
      setCardIndex((current) => (current + 1) % approved.length);
    }, 7500);
    return () => clearInterval(t);
  }, [approved.length]);

  const card: Lantern | null = approved[cardIndex] ?? null;

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
    <main className="display-main bg-sky">
      <div className="display-decor" aria-hidden="true">
        <Stars count={110} />
        <LanternSky lanterns={approved} max={100} scale={1} interactive={false} highlightId={approved.at(-1)?.id} />
      </div>

      <Link
        to="/admin"
        aria-label="Open festival display settings"
        title="Display settings"
        className="display-settings rounded-full border border-gold/40 bg-black/30 p-3 text-gold transition hover:bg-gold/15 focus:outline-none focus:ring-2 focus:ring-gold"
      >
        <Cog className="h-6 w-6" aria-hidden="true" />
      </Link>

      <header className="display-header">
        <p className="display-title font-display text-foreground text-glow">{appTitle}</p>
        <p className="display-subtitle font-serif text-gold">{appSubtitle}</p>
        <p className="display-tagline font-serif text-foreground/80">EVERY LIGHT TELLS A STORY</p>
      </header>

      <section className="display-stage" aria-live="polite">
        {card ? (
          <div
            key={card.id}
            className="display-wish wish-card"
            data-long={card.wish.length > 240 ? "true" : undefined}
          >
            <p className="display-message font-serif text-foreground">{card.wish}</p>
            <p className="display-name text-gold">— {card.nickname || "A friend of Ta Saung Tine"}</p>
          </div>
        ) : (
          <div className="display-wish wish-card">
            <p className="display-message font-serif text-foreground">Your festival wishes will shine here.</p>
          </div>
        )}
      </section>

      <footer className="display-footer">
        <div className="display-counter">
          <p className="display-count font-display font-bold text-gold text-glow tabular-nums">{count.toLocaleString()}</p>
          <p className="display-count-label text-foreground/80">lanterns illuminated</p>
        </div>

        <div className="display-festival">
          <p className="display-festival-label font-sans text-primary-foreground">
            <span className="rounded-full bg-primary shadow-glow">Coca-Cola · Coke Chill Festival</span>
          </p>
          <p className="display-qr text-muted-foreground">QR Code Coming Soon</p>
        </div>
      </footer>

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
        <p className="font-serif text-[2.5vw] tracking-widest text-foreground">LANTERNS LIGHT UP THASAUNG TAING!</p>
      </div>
    </div>
  );
}
