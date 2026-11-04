import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Sparkles, CheckCircle2 } from "lucide-react";
import { LanternShape, LanternSky, Stars } from "@/components/Sky";
import { addLantern, MAX_NICK, MAX_WISH, useLanterns, validateWish } from "@/lib/lanterns";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Light Up ThaSaung Taing — Release Your Lantern" },
      { name: "description", content: "Write a wish and add your glowing lantern to ThaSaung Taing's shared night sky at the Coke Chill Festival." },
      { property: "og:title", content: "Light Up ThaSaung Taing" },
      { property: "og:description", content: "Every light tells a story. Add your lantern to our shared sky!" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

function Index() {
  const lanterns = useLanterns();
  const visible = lanterns.filter((l) => l.status !== "rejected");
  const [nick, setNick] = useState("");
  const [wish, setWish] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [state, setState] = useState<"idle" | "releasing" | "done">("idle");
  const [newId, setNewId] = useState<string | null>(null);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (state === "releasing") return;
    const err = validateWish(wish);
    setError(err);
    if (err) return;
    const l = addLantern(nick, wish);
    setNewId(l.id);
    setState("releasing");
    setNick("");
    setWish("");
    setTimeout(() => setState("done"), 2400);
  };

  return (
    <main className="relative min-h-screen overflow-hidden bg-sky">
      <Stars count={70} />
      <div className="pointer-events-none absolute inset-0 opacity-60">
        <LanternSky lanterns={visible} max={18} scale={0.8} interactive={false} />
      </div>

      <div className="relative z-10 mx-auto flex max-w-md flex-col px-5 pb-12 pt-10">
        <p className="text-center text-xs font-semibold uppercase tracking-[0.3em] text-gold">Coca-Cola · Coke Chill Festival</p>
        <h1 className="mt-3 text-center font-display text-5xl leading-tight text-foreground text-glow sm:text-6xl">
          Light Up<br />ThaSaung Taing
        </h1>
        <p className="mt-3 text-center text-base text-muted-foreground">Every light tells a story. Add your lantern to our shared sky!</p>

        <div className="relative mt-8">
          {state === "releasing" && (
            <div className="pointer-events-none absolute inset-x-0 top-0 z-20 flex justify-center">
              <div className="release"><LanternShape size={70} hue={30} /></div>
            </div>
          )}

          {state === "done" ? (
            <div className="wish-card p-6 text-center animate-in fade-in zoom-in-95">
              <CheckCircle2 className="mx-auto h-10 w-10 text-gold" />
              <p className="mt-3 font-serif text-xl font-bold text-foreground">Your light is now part of ThaSaung Taing!</p>
              <p className="mt-2 text-sm text-muted-foreground">Look up at the big screen — your lantern will rise once it's approved.</p>
              <button onClick={() => setState("idle")} className="mt-5 rounded-full border border-gold/50 px-5 py-2 text-sm font-semibold text-gold transition hover:bg-gold/10">
                Light another lantern
              </button>
            </div>
          ) : (
            <form onSubmit={submit} className="wish-card space-y-4 p-5" noValidate>
              <div>
                <label htmlFor="nick" className="text-sm font-medium text-foreground">Nickname <span className="text-muted-foreground">(optional)</span></label>
                <input id="nick" value={nick} maxLength={MAX_NICK} onChange={(e) => setNick(e.target.value)} placeholder="e.g. Aye Aye"
                  className="mt-1.5 w-full rounded-xl border border-input bg-background/60 px-4 py-3 text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-ring" />
              </div>
              <div>
                <div className="flex justify-between">
                  <label htmlFor="wish" className="text-sm font-medium text-foreground">Your wish for ThaSaung Taing</label>
                  <span className={`text-xs ${wish.length > MAX_WISH ? "text-destructive" : "text-muted-foreground"}`}>{wish.length}/{MAX_WISH}</span>
                </div>
                <textarea id="wish" value={wish} rows={3} maxLength={MAX_WISH}
                  onChange={(e) => { setWish(e.target.value); if (error) setError(null); }}
                  placeholder="May our town shine bright…" aria-invalid={!!error}
                  className="mt-1.5 w-full resize-none rounded-xl border border-input bg-background/60 px-4 py-3 text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-ring" />
                {error && <p className="mt-1 text-sm text-destructive" role="alert">{error}</p>}
              </div>
              <button type="submit" disabled={state === "releasing"}
                className="flex w-full items-center justify-center gap-2 rounded-full bg-primary py-4 font-sans text-lg font-bold uppercase tracking-wider text-primary-foreground shadow-glow transition active:scale-95 disabled:opacity-60">
                <Sparkles className="h-5 w-5" /> LIGHT MY LANTERN
              </button>
            </form>
          )}
        </div>

        <div className="mt-8 text-center">
          <p className="font-display text-5xl font-bold text-gold text-glow tabular-nums">{visible.length.toLocaleString()}</p>
          <p className="text-sm uppercase tracking-widest text-muted-foreground">lanterns illuminated</p>
          <p className="mt-3 text-sm text-foreground/80">Together, we light up ThaSaung Taing. Add yours and watch the sky glow!</p>
        </div>

        <div className="relative mt-6 h-64 overflow-hidden rounded-2xl border border-border bg-sky">
          <Stars count={25} />
          <LanternSky lanterns={visible} max={30} scale={0.7} highlightId={newId} />
          <p className="pointer-events-none absolute left-3 top-3 text-xs uppercase tracking-widest text-gold">Shared sky · tap a lantern</p>
        </div>
      </div>
    </main>
  );
}
