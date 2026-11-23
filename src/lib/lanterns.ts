import { useEffect, useState } from "react";
import { apiRequest, getApiMode, LOCAL_API_STORAGE_KEY } from "./api-client";
export { apiRequest } from "./api-client";
import {
  PLANTS,
  MAX_NAME,
  parseWishInput,
  emptyReactionCounts,
  isAnonymousVisitorId,
  isPlant,
  isReaction,
  REACTIONS,
  type DisplayData,
  type DisplayWish,
  type PlantCounts,
  type ReactionType,
  type Wish,
  type WishInput,
  type WishStatus,
} from "../../shared/wishes";

export {
  validateWish,
  normalizeEmail,
  EMAIL_DOMAIN,
} from "../../shared/wishes";
export const OFFICE_LOCATIONS = PLANTS;
export const MAX_NICK = MAX_NAME;
export type LanternLocation = (typeof PLANTS)[number];
export type LanternStatus = WishStatus;
export type CreateLanternInput = WishInput;

export interface Lantern {
  id: string;
  name: string;
  email?: string;
  message: string;
  officeLocation: LanternLocation;
  status: WishStatus;
  createdAt: string;
  reactions: DisplayWish["reactions"];
  myReaction: ReactionType | null;
}

export const DISPLAY_CACHE_KEY = "share-light.display.v1";
export const REACTION_VISITOR_KEY = "share-light.reaction-visitor.v1";
const CHANGE_EVENT = "share-light:update";
const emptyCounts = (): PlantCounts => ({ HTY: 0, HB: 0, CDC: 0, JC: 0 });

export function getReactionVisitorId(): string {
  try {
    const saved = window.localStorage.getItem(REACTION_VISITOR_KEY);
    if (isAnonymousVisitorId(saved)) return saved;
    const visitorId = window.crypto.randomUUID();
    window.localStorage.setItem(REACTION_VISITOR_KEY, visitorId);
    return visitorId;
  } catch {
    throw new Error(
      "Your browser could not save an anonymous visitor ID. Enable site storage to use reactions.",
    );
  }
}

export function parseDisplayData(value: unknown): DisplayData {
  if (
    !value ||
    typeof value !== "object" ||
    !("wishes" in value) ||
    !Array.isArray(value.wishes) ||
    !("counts" in value) ||
    !value.counts ||
    typeof value.counts !== "object"
  ) {
    throw new Error("Invalid display data.");
  }
  const wishes = value.wishes.map((wish: unknown): DisplayWish => {
    if (!wish || typeof wish !== "object")
      throw new Error("Invalid display wish.");
    const item = wish as Record<string, unknown>;
    if (
      typeof item["id"] !== "string" ||
      typeof item["employee_name"] !== "string" ||
      typeof item["message"] !== "string" ||
      !isPlant(item["plant"]) ||
      typeof item["created_on"] !== "string" ||
      Number.isNaN(Date.parse(item["created_on"]))
    ) {
      throw new Error("Invalid display wish.");
    }
    // Whitelist the public projection: never persist an email in the display cache.
    const reactions = emptyReactionCounts();
    if ("reactions" in item) {
      if (!item["reactions"] || typeof item["reactions"] !== "object")
        throw new Error("Invalid display reaction counts.");
      for (const reaction of REACTIONS) {
        const count: unknown = Reflect.get(item["reactions"], reaction);
        if (
          typeof count !== "number" ||
          !Number.isSafeInteger(count) ||
          count < 0
        ) {
          throw new Error("Invalid display reaction count.");
        }
        reactions[reaction] = count;
      }
    }
    const myReaction =
      "myReaction" in item && item["myReaction"] !== null
        ? item["myReaction"]
        : null;
    if (myReaction !== null && !isReaction(myReaction))
      throw new Error("Invalid visitor reaction.");
    return {
      id: item["id"],
      employee_name: item["employee_name"],
      message: item["message"],
      plant: item["plant"],
      created_on: item["created_on"],
      reactions,
      myReaction,
    };
  });
  const counts = emptyCounts();
  for (const plant of PLANTS) {
    const count: unknown = Reflect.get(value.counts, plant);
    if (
      typeof count !== "number" ||
      !Number.isSafeInteger(count) ||
      count < 0
    ) {
      throw new Error("Invalid plant count.");
    }
    counts[plant] = count;
  }
  return { wishes, counts };
}

function cachedDisplay(): DisplayData {
  if (typeof window !== "undefined") {
    try {
      const raw = window.localStorage.getItem(DISPLAY_CACHE_KEY);
      if (raw) return parseDisplayData(JSON.parse(raw));
    } catch (error) {
      console.error(
        "Display cache could not be read; fetching live wishes.",
        error,
      );
    }
  }
  return { wishes: [], counts: emptyCounts() };
}

function toLantern(wish: DisplayData["wishes"][number] | Wish): Lantern {
  return {
    id: wish.id,
    name: wish.employee_name,
    message: wish.message,
    officeLocation: wish.plant,
    createdAt: wish.created_on,
    status: "status" in wish ? wish.status : "approved",
    reactions: "reactions" in wish ? wish.reactions : emptyReactionCounts(),
    myReaction: "myReaction" in wish ? wish.myReaction : null,
    ...("email" in wish ? { email: wish.email } : {}),
  };
}

function notifyChange() {
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

export const lanternService = {
  async submit(input: WishInput) {
    const created = await apiRequest<Wish>(
      "/wishes",
      "POST",
      parseWishInput(input),
    );
    notifyChange();
    return created;
  },
  async getAll(pin: string, signal?: AbortSignal) {
    const data = await apiRequest<{ wishes: Wish[] }>(
      "/wishes?status=all",
      "GET",
      undefined,
      pin,
      signal,
    );
    return data.wishes.map(toLantern);
  },
  async update(
    wish: Lantern,
    changes: { status?: "approved" | "rejected"; message?: string },
    pin: string,
  ) {
    await apiRequest(
      `/wishes/${encodeURIComponent(wish.id)}`,
      "PATCH",
      {
        plant: wish.officeLocation,
        ...changes,
      },
      pin,
    );
    notifyChange();
  },
  async delete(wish: Lantern, pin: string) {
    await apiRequest(
      `/wishes/${encodeURIComponent(wish.id)}`,
      "DELETE",
      { plant: wish.officeLocation },
      pin,
    );
    notifyChange();
  },
  async clear(pin: string) {
    await apiRequest("/wishes/all", "DELETE", undefined, pin);
    try {
      window.localStorage.removeItem(DISPLAY_CACHE_KEY);
    } catch (error) {
      console.error(
        "Wishes were cleared, but the local display cache could not be removed.",
        error,
      );
    }
    notifyChange();
  },
  async react(
    wish: Lantern,
    reaction: ReactionType | null,
  ): Promise<{
    reactions: Lantern["reactions"];
    myReaction: ReactionType | null;
    isLocalDemo: boolean;
  }> {
    const result = await apiRequest<{
      reactions: Lantern["reactions"];
      myReaction: ReactionType | null;
    }>(`/wishes/${encodeURIComponent(wish.id)}/reactions`, "POST", {
      plant: wish.officeLocation,
      visitorId: getReactionVisitorId(),
      reaction,
    });
    notifyChange();
    return { ...result, isLocalDemo: getApiMode() === "browser" };
  },
};

export function useLanterns() {
  const [data, setData] = useState(cachedDisplay);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    let inFlight = false;
    const controller = new AbortController();
    const refresh = async () => {
      if (inFlight) return;
      inFlight = true;
      try {
        const visitorId = getReactionVisitorId();
        const next = parseDisplayData(
          await apiRequest<unknown>(
            `/wishes?status=approved&visitorId=${encodeURIComponent(visitorId)}`,
            "GET",
            undefined,
            undefined,
            controller.signal,
          ),
        );
        if (!active) return;
        setData((current) =>
          JSON.stringify(current) === JSON.stringify(next) ? current : next,
        );
        setError(null);
        try {
          window.localStorage.setItem(DISPLAY_CACHE_KEY, JSON.stringify(next));
        } catch (cacheError) {
          console.error(
            "Live wishes loaded, but the display cache could not be saved.",
            cacheError,
          );
        }
      } catch (reason) {
        if (active)
          setError(
            reason instanceof Error
              ? reason.message
              : "Wishes could not be refreshed.",
          );
      } finally {
        inFlight = false;
      }
    };
    void refresh();
    const onChange = () => void refresh();
    const onStorage = (event: StorageEvent) => {
      if (event.key === DISPLAY_CACHE_KEY) {
        setData(cachedDisplay());
        void refresh();
      } else if (event.key === LOCAL_API_STORAGE_KEY) {
        void refresh();
      }
    };
    const timer = window.setInterval(onChange, 5000);
    window.addEventListener(CHANGE_EVENT, onChange);
    window.addEventListener("storage", onStorage);
    return () => {
      active = false;
      controller.abort();
      window.clearInterval(timer);
      window.removeEventListener(CHANGE_EVENT, onChange);
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  return { lanterns: data.wishes.map(toLantern), counts: data.counts, error };
}
