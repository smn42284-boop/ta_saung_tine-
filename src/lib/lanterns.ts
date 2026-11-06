import { useEffect, useState, useCallback } from "react";
import mockLanterns from "./mock-lanterns.json";
import { maxWishLength } from "./app-config";

export type LanternStatus = "pending" | "approved" | "rejected";
export interface MessageRecord {
  id: string;
  nickname: string;
  wish: string;
  createdAt: number;
  status: LanternStatus;
  hue: number; // 0-60 warm range
}

export type Lantern = MessageRecord;

interface MockMessage {
  name: string;
  message: string;
  status: string;
}

export const MAX_WISH = maxWishLength;
export const MAX_NICK = 24;
const KEY = "lut.lanterns.v1";
const EVT = "lut:update";

const SAMPLE_MESSAGES: MockMessage[] = mockLanterns;

function seed(): MessageRecord[] {
  const now = Date.now();
  return SAMPLE_MESSAGES.map(({ name, message, status }, i) => {
    if (status !== "pending" && status !== "approved" && status !== "rejected") {
      throw new Error(`Unknown status in mock message data: ${status}`);
    }

    return {
      id: `seed-${i}`,
      nickname: name,
      wish: message,
      createdAt: now - (SAMPLE_MESSAGES.length - i) * 97_000,
      status,
      hue: Math.round(Math.random() * 50),
    };
  });
}

export function loadLanterns(): Lantern[] {
  if (typeof window === "undefined") return [];
  const raw = localStorage.getItem(KEY);
  if (raw) {
    const parsed: unknown = JSON.parse(raw);
    if (
      Array.isArray(parsed) &&
      parsed.every(
        (item): item is Lantern =>
          typeof item === "object" &&
          item !== null &&
          typeof item.id === "string" &&
          typeof item.nickname === "string" &&
          typeof item.wish === "string" &&
          typeof item.createdAt === "number" &&
          (item.status === "pending" ||
            item.status === "approved" ||
            item.status === "rejected") &&
          typeof item.hue === "number",
      )
    ) {
      return parsed;
    }
    throw new Error("Saved festival messages have an invalid format.");
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
  const l: MessageRecord = {
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
