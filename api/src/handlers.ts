import { createHash, randomUUID, timingSafeEqual } from "node:crypto";
import type {
  HttpRequest,
  HttpResponseInit,
  InvocationContext,
} from "@azure/functions";
import type { PatchOperation } from "@azure/cosmos";
import {
  emptyReactionCounts,
  isAnonymousVisitorId,
  isPlant,
  isReaction,
  parseWishInput,
  validateWish,
  type DisplayWish,
  type PublicWish,
  type ReactionType,
  type Wish,
  type PlantCounts,
} from "../../shared/wishes";
import {
  errorCode,
  fullWish,
  getContainer,
  readSettings,
  writeSettings,
} from "./store";

class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

function requireAdmin(request: HttpRequest): void {
  const provided = Buffer.from(request.headers.get("x-admin-pin") || "");
  const expected = Buffer.from(process.env.ADMIN_PIN || "2026");
  if (
    provided.length !== expected.length ||
    !timingSafeEqual(provided, expected)
  ) {
    throw new HttpError(401, "Incorrect admin PIN.");
  }
}

async function body(request: HttpRequest): Promise<Record<string, unknown>> {
  try {
    const value: unknown = await request.json();
    if (!value || typeof value !== "object" || Array.isArray(value))
      throw new Error();
    return value as Record<string, unknown>;
  } catch {
    throw new HttpError(400, "A valid JSON object is required.");
  }
}

function response(jsonBody: unknown, status = 200): HttpResponseInit {
  return { status, jsonBody, headers: { "Cache-Control": "no-store" } };
}

function hashVisitorId(visitorId: string): string {
  return createHash("sha256").update(visitorId).digest("hex");
}

function reactionDocumentId(wishId: string, visitorHash: string): string {
  return `reaction-${createHash("sha256").update(`${wishId}:${visitorHash}`).digest("hex")}`;
}

interface ReactionCountRow {
  wishId: string;
  reaction: ReactionType;
  count: number;
}

async function reactionSummaries(
  container: Awaited<ReturnType<typeof getContainer>>,
  wishes: PublicWish[],
  visitorHash?: string,
): Promise<DisplayWish[]> {
  const summaries = new Map(
    wishes.map((wish) => [
      wish.id,
      {
        reactions: emptyReactionCounts(),
        myReaction: null as ReactionType | null,
      },
    ]),
  );
  if (!wishes.length) return [];
  const wishIds = wishes.map((wish) => wish.id);
  const totals = await container.items
    .query<ReactionCountRow>({
      query:
        "SELECT c.wishId, c.reaction, COUNT(1) AS count FROM c WHERE c.kind = @kind AND ARRAY_CONTAINS(@wishIds, c.wishId) GROUP BY c.wishId, c.reaction",
      parameters: [
        { name: "@kind", value: "reaction" },
        { name: "@wishIds", value: wishIds },
      ],
    })
    .fetchAll();
  for (const row of totals.resources) {
    const summary = summaries.get(row.wishId);
    if (summary && isReaction(row.reaction))
      summary.reactions[row.reaction] = row.count;
  }
  if (visitorHash) {
    const selections = await container.items
      .query<{ wishId: string; reaction: ReactionType }>({
        query:
          "SELECT c.wishId, c.reaction FROM c WHERE c.kind = @kind AND c.visitorHash = @visitorHash AND ARRAY_CONTAINS(@wishIds, c.wishId)",
        parameters: [
          { name: "@kind", value: "reaction" },
          { name: "@visitorHash", value: visitorHash },
          { name: "@wishIds", value: wishIds },
        ],
      })
      .fetchAll();
    for (const selection of selections.resources) {
      const summary = summaries.get(selection.wishId);
      if (summary && isReaction(selection.reaction))
        summary.myReaction = selection.reaction;
    }
  }
  return wishes.map((wish) => ({ ...wish, ...summaries.get(wish.id)! }));
}

function errorDetails(error: unknown): string {
  let details =
    error instanceof Error
      ? error.message
      : error &&
          typeof error === "object" &&
          "message" in error &&
          typeof error.message === "string"
        ? error.message
        : String(error);
  if (error instanceof Error && error.cause)
    details += ` ${errorDetails(error.cause)}`;
  for (const secret of [process.env.COSMOS_KEY, process.env.ADMIN_PIN]) {
    if (secret) details = details.split(secret).join("[redacted]");
  }
  return details;
}

export function withErrors(
  handler: (request: HttpRequest) => Promise<HttpResponseInit>,
) {
  return async (
    request: HttpRequest,
    context: InvocationContext,
  ): Promise<HttpResponseInit> => {
    try {
      return await handler(request);
    } catch (error) {
      if (error instanceof HttpError)
        return response({ error: error.message }, error.status);
      context.error("Festival API request failed", error);
      const code = errorCode(error);
      if (code === 404) return response({ error: "Wish not found." }, 404);
      if (code === 413)
        return response(
          {
            error:
              "This wish exceeds Cosmos DB's 2 MB document size limit. Please shorten it before trying again.",
          },
          413,
        );
      if (code === 429)
        return {
          ...response(
            { error: "The service is busy. Please retry shortly." },
            429,
          ),
          headers: { "Cache-Control": "no-store", "Retry-After": "5" },
        };
      return response(
        {
          error: "The festival service could not complete the request.",
          details: errorDetails(error),
        },
        500,
      );
    }
  };
}

export async function wishes(request: HttpRequest): Promise<HttpResponseInit> {
  if (request.method === "GET") {
    const status = request.query.get("status") || "approved";
    if (status !== "approved" && status !== "all")
      throw new HttpError(400, "Invalid status filter.");
    if (status === "all") requireAdmin(request);
    const container = await getContainer();
    if (status === "all") {
      const { resources } = await container.items
        .query<Wish>(
          "SELECT c.id, c.employee_name, c.email, c.plant, c.message, c.status, c.created_on FROM c WHERE c.id != 'app-settings' AND (NOT IS_DEFINED(c.kind) OR c.kind != 'reaction') ORDER BY c.created_on DESC",
        )
        .fetchAll();
      return response({ wishes: resources.map(fullWish) });
    }
    const visitorId = request.query.get("visitorId");
    if (visitorId !== null && !isAnonymousVisitorId(visitorId))
      throw new HttpError(400, "A valid anonymous visitor ID is required.");
    const [latest, totals] = await Promise.all([
      container.items
        .query<PublicWish>(
          "SELECT TOP 120 c.id, c.employee_name, c.plant, c.message, c.created_on FROM c WHERE c.status = 'approved' ORDER BY c.created_on DESC",
        )
        .fetchAll(),
      container.items
        .query<{ plant: string; count: number }>(
          "SELECT c.plant, COUNT(1) AS count FROM c WHERE c.status = 'approved' GROUP BY c.plant",
        )
        .fetchAll(),
    ]);
    const counts: PlantCounts = { HTY: 0, HB: 0, CDC: 0, JC: 0 };
    for (const row of totals.resources)
      if (isPlant(row.plant)) counts[row.plant] = row.count;
    return response({
      wishes: await reactionSummaries(
        container,
        latest.resources,
        visitorId ? hashVisitorId(visitorId) : undefined,
      ),
      counts,
    });
  }
  const input = await body(request);
  let valid;
  try {
    valid = parseWishInput(input);
  } catch (error) {
    throw new HttpError(
      400,
      error instanceof Error ? error.message : "Invalid wish.",
    );
  }
  const container = await getContainer();
  const settings = await readSettings(container);
  const wish: Wish = {
    ...valid,
    id: randomUUID(),
    status: settings.autoApprove ? "approved" : "pending",
    created_on: new Date().toISOString(),
  };
  await container.items.create(wish);
  return response(wish, 201);
}

export async function wishReaction(
  request: HttpRequest,
): Promise<HttpResponseInit> {
  if (request.method !== "POST")
    throw new HttpError(405, "Method not allowed.");
  const id = request.params.id;
  if (!id || id === "app-settings" || id === "all")
    throw new HttpError(400, "Invalid wish ID.");
  const input = await body(request);
  if (!isPlant(input.plant))
    throw new HttpError(400, "A valid plant partition key is required.");
  if (!isAnonymousVisitorId(input.visitorId))
    throw new HttpError(400, "A valid anonymous visitor ID is required.");
  if (input.reaction !== null && !isReaction(input.reaction))
    throw new HttpError(400, "Invalid reaction.");

  const container = await getContainer();
  const { resource: wish } = await container.item(id, input.plant).read<Wish>();
  if (
    !wish ||
    wish.id !== id ||
    wish.plant !== input.plant ||
    wish.status !== "approved"
  ) {
    throw new HttpError(404, "Wish not found.");
  }

  const visitorHash = hashVisitorId(input.visitorId);
  const item = container.item(reactionDocumentId(id, visitorHash), input.plant);
  if (input.reaction === null) {
    try {
      await item.delete();
    } catch (error) {
      if (errorCode(error) !== 404) throw error;
    }
  } else {
    await container.items.upsert({
      id: reactionDocumentId(id, visitorHash),
      plant: input.plant,
      kind: "reaction",
      wishId: id,
      visitorHash,
      reaction: input.reaction,
      updatedAt: new Date().toISOString(),
    });
  }
  const [summary] = await reactionSummaries(container, [wish], visitorHash);
  if (!summary) throw new Error("Reaction summary was not returned.");
  return response({
    reactions: summary.reactions,
    myReaction: summary.myReaction,
  });
}

export async function wishById(
  request: HttpRequest,
): Promise<HttpResponseInit> {
  requireAdmin(request);
  const id = request.params.id;
  if (!id || id === "app-settings" || id === "all")
    throw new HttpError(400, "Invalid wish ID.");
  const input = await body(request);
  if (!isPlant(input.plant))
    throw new HttpError(400, "A valid plant partition key is required.");
  const item = (await getContainer()).item(id, input.plant);
  if (request.method === "DELETE") {
    await item.delete();
    return response({ deleted: true });
  }
  const operations: PatchOperation[] = [];
  if ("status" in input) {
    if (input.status !== "approved" && input.status !== "rejected")
      throw new HttpError(400, "Invalid status.");
    operations.push({ op: "set", path: "/status", value: input.status });
  }
  if ("message" in input) {
    if (typeof input.message !== "string")
      throw new HttpError(400, "Invalid message.");
    const error = validateWish(input.message);
    if (error) throw new HttpError(400, error);
    operations.push({
      op: "set",
      path: "/message",
      value: input.message.trim(),
    });
  }
  if (!operations.length)
    throw new HttpError(400, "Provide a status or message to update.");
  const { resource } = await item.patch<Wish>(operations);
  if (!resource) throw new Error("Cosmos DB returned no updated wish.");
  return response(fullWish(resource));
}

export async function clearWishes(
  request: HttpRequest,
): Promise<HttpResponseInit> {
  requireAdmin(request);
  const container = await getContainer();
  const iterator = container.items.query<{ id: string; plant: string }>(
    "SELECT c.id, c.plant FROM c WHERE c.id != 'app-settings'",
    { maxItemCount: 100 },
  );
  let deleted = 0;
  // Bound concurrency and memory; a failed deletion must not report a successful reset.
  while (iterator.hasMoreResults()) {
    const { resources } = await iterator.fetchNext();
    for (let offset = 0; offset < resources.length; offset += 10) {
      const batch = resources.slice(offset, offset + 10);
      await Promise.all(
        batch.map(async ({ id, plant }) => {
          try {
            await container.item(id, plant).delete();
          } catch (error) {
            if (errorCode(error) !== 404) throw error;
          }
        }),
      );
      deleted += batch.length;
    }
  }
  return response({ deleted });
}

export async function settings(
  request: HttpRequest,
): Promise<HttpResponseInit> {
  if (request.method !== "GET") requireAdmin(request);
  if (request.method === "GET")
    return response(await readSettings(await getContainer()));
  const input = await body(request);
  if (typeof input.autoApprove !== "boolean")
    throw new HttpError(400, "autoApprove must be a boolean.");
  const container = await getContainer();
  return response(await writeSettings(container, input.autoApprove));
}
