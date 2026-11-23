export const PLANTS = ["HTY", "HB", "CDC", "JC"] as const;
export type Plant = (typeof PLANTS)[number];
export type WishStatus = "approved" | "pending" | "rejected";
export const EMAIL_DOMAIN = "@coca-cola.com.mm";
export const MAX_NAME = 80;
export const REACTIONS = ["like", "love", "haha", "wow", "thankful"] as const;
export type ReactionType = (typeof REACTIONS)[number];
export type ReactionCounts = Record<ReactionType, number>;

export function emptyReactionCounts(): ReactionCounts {
  return { like: 0, love: 0, haha: 0, wow: 0, thankful: 0 };
}

export function isReaction(value: unknown): value is ReactionType {
  return REACTIONS.some((reaction) => reaction === value);
}

export function isAnonymousVisitorId(value: unknown): value is string {
  return (
    typeof value === "string" &&
    /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(value)
  );
}

export interface PublicWish {
  id: string;
  employee_name: string;
  plant: Plant;
  message: string;
  created_on: string;
}

export interface DisplayWish extends PublicWish {
  reactions: ReactionCounts;
  myReaction: ReactionType | null;
}

export interface Wish extends PublicWish {
  email: string;
  status: WishStatus;
}

export interface WishInput {
  employee_name: string;
  email: string;
  plant: Plant;
  message: string;
}

export type PlantCounts = Record<Plant, number>;
export interface DisplayData {
  wishes: DisplayWish[];
  counts: PlantCounts;
}

export function isPlant(value: unknown): value is Plant {
  return PLANTS.some((plant) => plant === value);
}

export function normalizeEmail(value: string): string {
  const trimmed = value.trim().toLowerCase();
  const email = trimmed.includes("@") ? trimmed : `${trimmed}${EMAIL_DOMAIN}`;
  if (
    !/^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@coca-cola\.com\.mm$/.test(email) ||
    email.length > 254
  ) {
    throw new Error(`Please use your ${EMAIL_DOMAIN} email address.`);
  }
  return email;
}

export function validateWish(value: string): string | null {
  const message = value.trim();
  if (!/^\S\s*\S\s*\S/u.test(message))
    return "Please write a wish of at least 3 non-whitespace characters.";
  const compact = message.toLowerCase().replace(/[\s\p{P}\p{S}]/gu, "");
  if (!/[\p{L}\p{N}]/u.test(compact) || /^(.)\1{2,}$/u.test(compact)) {
    return "Please write a meaningful wish, not repeated characters.";
  }
  const words = message.toLowerCase().match(/[\p{L}\p{M}\p{N}]+/gu) ?? [];
  if (words.length >= 3 && new Set(words).size === 1) {
    return "Please write a meaningful wish, not repeated words.";
  }
  return null;
}

export function parseWishInput(value: unknown): WishInput {
  if (!value || typeof value !== "object")
    throw new Error("Please provide your employee details.");
  const input = value as Record<string, unknown>;
  if (
    typeof input["employee_name"] !== "string" ||
    !input["employee_name"].trim()
  ) {
    throw new Error("Please enter your employee name.");
  }
  const employee_name = input["employee_name"].trim();
  if (employee_name.length > MAX_NAME)
    throw new Error(`Name must be ${MAX_NAME} characters or fewer.`);
  if (typeof input["email"] !== "string")
    throw new Error("Please enter your company email.");
  const email = normalizeEmail(input["email"]);
  if (!isPlant(input["plant"])) throw new Error("Please select your plant.");
  if (typeof input["message"] !== "string")
    throw new Error("Please write your wish.");
  const error = validateWish(input["message"]);
  if (error) throw new Error(error);
  return {
    employee_name,
    email,
    plant: input["plant"],
    message: input["message"].trim(),
  };
}
