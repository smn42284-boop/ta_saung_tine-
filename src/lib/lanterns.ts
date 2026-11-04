import { useEffect, useState, useCallback } from "react";

export type LanternStatus = "pending" | "approved" | "rejected";
export interface Lantern {
  id: string;
  nickname: string;
  wish: string;
  createdAt: number;
  status: LanternStatus;
  hue: number; // 0-60 warm range
}

export const MAX_WISH = 100;
export const MAX_NICK = 24;
const KEY = "lut.lanterns.v1";
const EVT = "lut:update";

const SAMPLE_WISHES: [string, string][] = [
  ["Aye Aye", "May Taunggyi shine bright forever!"],
  ["Ko Zaw", "Health and happiness for my family"],
  ["Mya", "Peace for every home in Shan State"],
  ["", "May all our dreams float high tonight"],
  ["Hnin", "Good luck to all students this year"],
  ["Thura", "Friends forever, festival forever!"],
  ["Su Su", "Love and laughter for everyone here"],
  ["Min Min", "Wishing my mom a speedy recovery"],
  ["", "Let's meet again next Tazaungdaing!"],
  ["Nang", "May Inle and Taunggyi always be blessed"],
  ["Kyaw Kyaw", "Success for every small business in town"],
  ["Phyu", "Chill vibes and good music all night"],
];

function seed(): Lantern[] {
  const now = Date.now();
  const out: Lantern[] = [];
  for (let i = 0; i < 140; i++) {
    const [nickname, wish] = SAMPLE_WISHES[i % SAMPLE_WISHES.length]!;
    out.push({
      id: `seed-${i}`,
      nickname,
      wish,
      createdAt: now - (140 - i) * 97_000,
      status: i % 23 === 0 ? "pending" : "approved",
      hue: Math.round(Math.random() * 50),
    });
  }
  return out;
}

export function loadLanterns(): Lantern[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return JSON.parse(raw) as Lantern[];
  } catch {
    /* ignore */
  }
  const s = seed();
  localStorage.setItem(KEY, JSON.stringify(s));
  return s;
}

function save(list: Lantern[]) {
  localStorage.setItem(KEY, JSON.stringify(list));
  window.dispatchEvent(new Event(EVT));
}

export function validateWish(wish: string): string | null {
  const t = wish.trim();
  if (!t) return "Please write a wish for Taunggyi.";
  if (t.length > MAX_WISH) return `Keep it under ${MAX_WISH} characters.`;
  return null;
}

export function addLantern(nickname: string, wish: string): Lantern {
  const l: Lantern = {
    id: crypto.randomUUID(),
    nickname: nickname.trim().slice(0, MAX_NICK),
    wish: wish.trim().slice(0, MAX_WISH),
    createdAt: Date.now(),
    status: "pending",
    hue: Math.round(Math.random() * 50),
  };
  save([...loadLanterns(), l]);
  return l;
}

export function setStatus(id: string, status: LanternStatus) {
  save(loadLanterns().map((l) => (l.id === id ? { ...l, status } : l)));
}

export function resetLanterns() {
  save(seed());
}

/** Live-synced lantern list across tabs/pages. */
export function useLanterns() {
  const [list, setList] = useState<Lantern[]>([]);
  const refresh = useCallback(() => setList(loadLanterns()), []);
  useEffect(() => {
    refresh();
    const onStorage = (e: StorageEvent) => e.key === KEY && refresh();
    window.addEventListener(EVT, refresh);
    window.addEventListener("storage", onStorage);
    const t = setInterval(refresh, 4000);
    return () => {
      window.removeEventListener(EVT, refresh);
      window.removeEventListener("storage", onStorage);
      clearInterval(t);
    };
  }, [refresh]);
  return list;
}
