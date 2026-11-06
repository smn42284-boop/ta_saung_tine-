import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Check, X, RotateCcw, Flame, CheckCircle2, XCircle, Clock } from "lucide-react";
import { resetLanterns, setStatus, useLanterns, type LanternStatus } from "@/lib/lanterns";
import { appSubtitle, appTitle } from "@/lib/app-config";

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [
      { title: `${appTitle} — Admin` },
      { name: "description", content: appSubtitle },
      { property: "og:title", content: `${appTitle} — Admin` },
      { property: "og:description", content: appSubtitle },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: Admin,
});

type Filter = "all" | LanternStatus;

function Admin() {
  const all = useLanterns();
  const [filter, setFilter] = useState<Filter>("pending");
  const stats = useMemo(() => ({
    total: all.length,
    approved: all.filter((l) => l.status === "approved").length,
    rejected: all.filter((l) => l.status === "rejected").length,
    pending: all.filter((l) => l.status === "pending").length,
  }), [all]);
  const rows = [...all].reverse().filter((l) => filter === "all" || l.status === filter).slice(0, 200);

  const cards = [
    { label: "Total submissions", v: stats.total, icon: Flame },
    { label: "Approved", v: stats.approved, icon: CheckCircle2 },
    { label: "Rejected", v: stats.rejected, icon: XCircle },
    { label: "Pending", v: stats.pending, icon: Clock },
  ];

  return (
    <main className="min-h-screen bg-sky px-4 py-8">
      <div className="mx-auto max-w-5xl">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="font-display text-3xl font-bold text-foreground">{appTitle} · Admin</h1>
            <p className="text-sm text-muted-foreground">{appSubtitle}. Only approved lanterns appear on the festival display.</p>
          </div>
          <button onClick={() => confirm("Reset all data to sample lanterns?") && resetLanterns()}
            className="flex items-center gap-2 rounded-full border border-border px-4 py-2 text-sm text-muted-foreground hover:text-foreground">
            <RotateCcw className="h-4 w-4" /> Reset sample data
          </button>
        </div>

        <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-4">
          {cards.map((c) => (
            <div key={c.label} className="glass rounded-2xl p-4">
              <c.icon className="h-5 w-5 text-gold" />
              <p className="mt-2 text-3xl font-bold tabular-nums text-foreground">{c.v.toLocaleString()}</p>
              <p className="text-xs uppercase tracking-wider text-muted-foreground">{c.label}</p>
            </div>
          ))}
        </div>

        <div className="mt-8 flex gap-2">
          {(["pending", "approved", "rejected", "all"] as Filter[]).map((f) => (
            <button key={f} onClick={() => setFilter(f)}
              className={`rounded-full px-4 py-1.5 text-sm capitalize transition ${filter === f ? "bg-primary text-primary-foreground" : "glass text-muted-foreground hover:text-foreground"}`}>
              {f}
            </button>
          ))}
        </div>

        <div className="glass mt-4 divide-y divide-border overflow-hidden rounded-2xl">
          {rows.length === 0 && <p className="p-6 text-center text-muted-foreground">No submissions here.</p>}
          {rows.map((l) => (
            <div key={l.id} className="flex flex-wrap items-center gap-3 p-4">
              <div className="min-w-0 flex-1">
                <p className="text-foreground">"{l.wish}"</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {l.nickname || "Anonymous"} · {new Date(l.createdAt).toLocaleString()} ·{" "}
                  <span className={l.status === "approved" ? "text-success" : l.status === "rejected" ? "text-destructive" : "text-gold"}>{l.status}</span>
                </p>
              </div>
              <div className="flex gap-2">
                <button onClick={() => setStatus(l.id, "approved")} disabled={l.status === "approved"} aria-label="Approve"
                  className="flex items-center gap-1 rounded-full bg-success/15 px-3 py-1.5 text-sm text-success hover:bg-success/25 disabled:opacity-30">
                  <Check className="h-4 w-4" /> Approve
                </button>
                <button onClick={() => setStatus(l.id, "rejected")} disabled={l.status === "rejected"} aria-label="Reject"
                  className="flex items-center gap-1 rounded-full bg-destructive/15 px-3 py-1.5 text-sm text-destructive hover:bg-destructive/25 disabled:opacity-30">
                  <X className="h-4 w-4" /> Reject
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
