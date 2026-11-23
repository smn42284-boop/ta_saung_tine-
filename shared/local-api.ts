import {
  emptyReactionCounts,
  isAnonymousVisitorId,
  isPlant,
  isReaction,
  parseWishInput,
  validateWish,
  type ReactionType,
  type Wish,
} from "./wishes";

export interface LocalState {
  wishes: Wish[];
  reactions: LocalReaction[];
  autoApprove: boolean;
}

export interface LocalReaction {
  wishId: string;
  plant: Wish["plant"];
  visitorId: string;
  reaction: ReactionType;
}

export interface LocalRequest {
  path: string;
  method: string;
  data?: unknown;
  pin?: string;
}

class LocalApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

export function createLocalState(): LocalState {
  const samples = [
    {
      plant: "HTY",
      message: "တန်ဆောင်တိုင်မှာ အားလုံး စိတ်ချမ်းသာ ကိုယ်ကျန်းမာပါစေ။",
    },
    {
      plant: "HB",
      message:
        "May our lights bring hope, kindness and joy to every colleague.",
    },
    {
      plant: "CDC",
      message: "အလင်းရောင်များနဲ့အတူ ကောင်းသောဆန္ဒများ ပြည့်ဝပါစေ။",
    },
    {
      plant: "JC",
      message:
        "Together we shine brighter. Wishing everyone a beautiful festival!",
    },
    {
      plant: "HTY",
      message: "May this season light the way to a peaceful and happy year.",
    },
    { plant: "HB", message: "ပျော်ရွှင်ဖွယ် တန်ဆောင်တိုင်ညလေး ဖြစ်ပါစေ။" },
    {
      plant: "CDC",
      message:
        "A little light, a little kindness, and a sky full of shared dreams.",
    },
    {
      plant: "JC",
      message: "အားလုံးရဲ့ အိပ်မက်နဲ့ မျှော်လင့်ချက်များ တောက်ပပါစေ။",
    },
  ] as const;
  return {
    autoApprove: true,
    reactions: [],
    wishes: samples.map((sample, index) => ({
      ...sample,
      id: `00000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`,
      employee_name: `Sample Light ${index + 1}`,
      email: `sample.${index + 1}@coca-cola.com.mm`,
      status: "approved",
      created_on: new Date(Date.UTC(2026, 10, 1, 0, index)).toISOString(),
    })),
  };
}

export function parseLocalState(value: unknown): LocalState {
  if (
    !value ||
    typeof value !== "object" ||
    !("autoApprove" in value) ||
    typeof value.autoApprove !== "boolean" ||
    !("wishes" in value) ||
    !Array.isArray(value.wishes)
  ) {
    throw new Error(
      "Local festival data is invalid. Export or repair the stored data before continuing.",
    );
  }
  const state = value as Record<string, unknown>;
  const rawReactions = state["reactions"];
  if (rawReactions !== undefined && !Array.isArray(rawReactions))
    throw new Error("Local festival data contains invalid reactions.");
  const reactions = rawReactions ?? [];
  const wishRecords = state["wishes"] as unknown[];
  const parsedReactions = reactions.map((item: unknown): LocalReaction => {
    if (
      !item ||
      typeof item !== "object" ||
      !("wishId" in item) ||
      typeof item.wishId !== "string" ||
      !("plant" in item) ||
      !isPlant(item.plant) ||
      !("visitorId" in item) ||
      !isAnonymousVisitorId(item.visitorId) ||
      !("reaction" in item) ||
      !isReaction(item.reaction)
    ) {
      throw new Error("Local festival data contains an invalid reaction.");
    }
    return {
      wishId: item.wishId,
      plant: item.plant,
      visitorId: item.visitorId,
      reaction: item.reaction,
    };
  });
  const wishes = wishRecords.map((item: unknown): Wish => {
    if (
      !item ||
      typeof item !== "object" ||
      !("id" in item) ||
      typeof item.id !== "string" ||
      !("created_on" in item) ||
      typeof item.created_on !== "string" ||
      Number.isNaN(Date.parse(item.created_on)) ||
      !("status" in item) ||
      (item.status !== "approved" &&
        item.status !== "pending" &&
        item.status !== "rejected")
    ) {
      throw new Error("Local festival data contains an invalid wish.");
    }
    const input = parseWishInput(item);
    const oldSample =
      /^00000000-0000-4000-8000-00000000000[1-8]$/.test(item.id) &&
      input.employee_name === `Sample Light · ${input.plant}`;
    return {
      ...input,
      employee_name: oldSample
        ? `Sample Light ${Number(item.id.slice(-12))}`
        : input.employee_name,
      id: item.id,
      created_on: item.created_on,
      status: item.status,
    };
  });
  return {
    wishes,
    reactions: parsedReactions,
    autoApprove: state["autoApprove"] as boolean,
  };
}

function requireBody(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new LocalApiError(400, "A valid JSON object is required.");
  }
  return value as Record<string, unknown>;
}

export function handleLocalRequest(
  state: LocalState,
  request: LocalRequest,
  adminPin = "2026",
): {
  status: number;
  body: unknown;
} {
  try {
    const url = new URL(request.path, "http://local");
    const path = url.pathname;
    const method = request.method.toUpperCase();
    const admin = () => {
      if (request.pin !== adminPin)
        throw new LocalApiError(401, "Incorrect admin PIN.");
    };
    if (path === "/settings") {
      if (method === "PATCH" || method === "PUT") {
        admin();
        const body = requireBody(request.data);
        if (typeof body["autoApprove"] !== "boolean")
          throw new LocalApiError(400, "autoApprove must be a boolean.");
        state.autoApprove = body["autoApprove"];
      } else if (method !== "GET")
        throw new LocalApiError(405, "Method not allowed.");
      return { status: 200, body: { autoApprove: state.autoApprove } };
    }
    if (path === "/wishes" && method === "GET") {
      const status = url.searchParams.get("status") || "approved";
      if (status !== "all" && status !== "approved")
        throw new LocalApiError(400, "Invalid status filter.");
      if (status === "all") admin();
      const visitorId = url.searchParams.get("visitorId");
      if (visitorId !== null && !isAnonymousVisitorId(visitorId))
        throw new LocalApiError(
          400,
          "A valid anonymous visitor ID is required.",
        );
      const sorted = [...state.wishes].sort(
        (a, b) => Date.parse(b.created_on) - Date.parse(a.created_on),
      );
      if (status === "all") return { status: 200, body: { wishes: sorted } };
      const approved = sorted.filter((wish) => wish.status === "approved");
      const counts = { HTY: 0, HB: 0, CDC: 0, JC: 0 };
      for (const wish of approved) counts[wish.plant]++;
      return {
        status: 200,
        body: {
          counts,
          wishes: approved
            .slice(0, 120)
            .map(({ email: _email, status: _status, ...wish }) => {
              const wishReactions = state.reactions.filter(
                (item) => item.wishId === wish.id && item.plant === wish.plant,
              );
              const reactionCounts = emptyReactionCounts();
              for (const item of wishReactions)
                reactionCounts[item.reaction] += 1;
              return {
                ...wish,
                reactions: reactionCounts,
                myReaction:
                  wishReactions.find((item) => item.visitorId === visitorId)
                    ?.reaction ?? null,
              };
            }),
        },
      };
    }
    if (path === "/wishes" && method === "POST") {
      let input;
      try {
        input = parseWishInput(request.data);
      } catch (error) {
        throw new LocalApiError(
          400,
          error instanceof Error ? error.message : "Invalid wish.",
        );
      }
      const wish: Wish = {
        ...input,
        id: crypto.randomUUID(),
        created_on: new Date().toISOString(),
        status: state.autoApprove ? "approved" : "pending",
      };
      state.wishes.push(wish);
      return { status: 201, body: wish };
    }
    if (path === "/wishes/all" && method === "DELETE") {
      admin();
      const deleted = state.wishes.length;
      state.wishes = [];
      state.reactions = [];
      return { status: 200, body: { deleted } };
    }
    const reactionMatch = /^\/wishes\/([^/]+)\/reactions$/.exec(path);
    if (reactionMatch && method === "POST") {
      const body = requireBody(request.data);
      if (!isPlant(body["plant"]))
        throw new LocalApiError(
          400,
          "A valid plant partition key is required.",
        );
      if (!isAnonymousVisitorId(body["visitorId"]))
        throw new LocalApiError(
          400,
          "A valid anonymous visitor ID is required.",
        );
      if (body["reaction"] !== null && !isReaction(body["reaction"]))
        throw new LocalApiError(400, "Invalid reaction.");
      const wish = state.wishes.find(
        (item) =>
          item.id === reactionMatch[1] &&
          item.plant === body["plant"] &&
          item.status === "approved",
      );
      if (!wish) throw new LocalApiError(404, "Wish not found.");
      const current = state.reactions.find(
        (item) =>
          item.wishId === wish.id &&
          item.plant === wish.plant &&
          item.visitorId === body["visitorId"],
      );
      if (body["reaction"] === null) {
        if (current)
          state.reactions = state.reactions.filter((item) => item !== current);
      } else if (current) {
        current.reaction = body["reaction"];
      } else {
        state.reactions.push({
          wishId: wish.id,
          plant: wish.plant,
          visitorId: body["visitorId"],
          reaction: body["reaction"],
        });
      }
      const reactions = emptyReactionCounts();
      for (const item of state.reactions) {
        if (item.wishId === wish.id && item.plant === wish.plant)
          reactions[item.reaction] += 1;
      }
      return {
        status: 200,
        body: { reactions, myReaction: body["reaction"] },
      };
    }
    const match = /^\/wishes\/([^/]+)$/.exec(path);
    if (match && (method === "PATCH" || method === "DELETE")) {
      admin();
      const body = requireBody(request.data);
      if (!isPlant(body["plant"]))
        throw new LocalApiError(
          400,
          "A valid plant partition key is required.",
        );
      const wish = state.wishes.find(
        (item) => item.id === match[1] && item.plant === body["plant"],
      );
      if (!wish) throw new LocalApiError(404, "Wish not found.");
      if (method === "DELETE") {
        state.wishes = state.wishes.filter((item) => item !== wish);
        state.reactions = state.reactions.filter(
          (item) => item.wishId !== wish.id || item.plant !== wish.plant,
        );
        return { status: 200, body: { deleted: true } };
      }
      if (!("status" in body) && !("message" in body))
        throw new LocalApiError(400, "Provide a status or message to update.");
      if (
        "status" in body &&
        body["status"] !== "approved" &&
        body["status"] !== "rejected"
      ) {
        throw new LocalApiError(400, "Invalid status.");
      }
      if ("message" in body) {
        if (typeof body["message"] !== "string")
          throw new LocalApiError(400, "Invalid message.");
        const error = validateWish(body["message"]);
        if (error) throw new LocalApiError(400, error);
        wish.message = body["message"].trim();
      }
      if (body["status"] === "approved" || body["status"] === "rejected")
        wish.status = body["status"];
      return { status: 200, body: wish };
    }
    throw new LocalApiError(
      path === "/wishes" || match ? 405 : 404,
      "Local API route or method not found.",
    );
  } catch (error) {
    if (error instanceof LocalApiError)
      return { status: error.status, body: { error: error.message } };
    throw error;
  }
}
