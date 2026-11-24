import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { WishReactions } from "@/components/WishReactions";
import { REACTION_VISITOR_KEY, type Lantern } from "@/lib/lanterns";

const wish: Lantern = {
  id: "wish-1",
  name: "Aye",
  officeLocation: "HB",
  message: "Let hope shine",
  status: "approved",
  createdAt: "2026-11-10T00:00:00Z",
  reactions: { like: 0, love: 0, haha: 0, wow: 0, thankful: 0 },
  myReaction: null,
};
const visitorId = "22c6c6d4-0b2d-4c2b-9d8b-784e045c63c1";
const emptyCounts = { like: 0, love: 0, haha: 0, wow: 0, thankful: 0 };

describe("wish reactions", () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.localStorage.setItem(REACTION_VISITOR_KEY, visitorId);
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("lets a visitor choose, change, and remove their reaction", async () => {
    const fetcher = vi.fn(async (_url: string, init?: RequestInit) => {
      const request = JSON.parse(String(init?.body)) as {
        reaction: "love" | "thankful" | null;
      };
      return new Response(
        JSON.stringify({
          reactions: {
            ...emptyCounts,
            ...(request.reaction ? { [request.reaction]: 1 } : {}),
          },
          myReaction: request.reaction,
        }),
      );
    });
    vi.stubGlobal("fetch", fetcher);
    render(<WishReactions wish={wish} />);

    fireEvent.click(screen.getByRole("button", { name: "React to wish" }));
    expect(screen.getByRole("button", { name: "React to wish" })).toHaveTextContent("✨");
    fireEvent.click(screen.getByRole("button", { name: "Love" }));
    expect(await screen.findByText("1")).toBeInTheDocument();
    expect(screen.getByText("1").closest(".wish-reaction-count")).toHaveTextContent("❤️1");
    expect(
      screen.getByRole("button", { name: "Change or remove your Love reaction" }),
    ).toHaveTextContent("❤️");
    expect(
      screen.getByRole("button", { name: "Change or remove your Love reaction" }),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Change or remove your Love reaction" }));
    fireEvent.click(screen.getByRole("button", { name: "Thankful" }));
    await waitFor(() => expect(screen.getByText("1")).toBeInTheDocument());
    expect(
      screen.getByRole("button", {
        name: "Change or remove your Thankful reaction",
      }),
    ).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("button", {
        name: "Change or remove your Thankful reaction",
      }),
    );
    fireEvent.click(
      screen.getByRole("button", {
        name: "Thankful, selected. Select again to remove",
      }),
    );
    await waitFor(() =>
      expect(
        screen.queryByRole("button", {
          name: "Change or remove your Thankful reaction",
        }),
      ).not.toBeInTheDocument(),
    );
    expect(document.querySelector(".wish-reaction-count")).toBeNull();
    expect(fetcher).toHaveBeenCalledTimes(3);
    expect(fetcher.mock.calls.map(([, init]) => JSON.parse(String(init?.body)))).toEqual([
      { plant: "HB", visitorId, reaction: "love" },
      { plant: "HB", visitorId, reaction: "thankful" },
      { plant: "HB", visitorId, reaction: null },
    ]);
  });

  it("reverts the optimistic count and explains a failed save", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ error: "Reaction unavailable" }), {
          status: 503,
        }),
      ),
    );
    render(<WishReactions wish={wish} />);
    fireEvent.click(screen.getByRole("button", { name: "React to wish" }));
    fireEvent.click(screen.getByRole("button", { name: "Like" }));
    await waitFor(() => expect(screen.getByText("Reaction unavailable")).toBeInTheDocument());
    expect(document.querySelector(".wish-reaction-count")).toBeNull();
  });

  it("uses an emoji-only floating picker that closes on outside interaction", () => {
    const { container } = render(<WishReactions wish={wish} />);
    fireEvent.click(screen.getByRole("button", { name: "React to wish" }));

    const picker = screen.getByRole("group", { name: "Choose a reaction" });
    expect(container.contains(picker)).toBe(false);
    expect(Array.from(picker.querySelectorAll("button"), (button) => button.textContent)).toEqual([
      "👍",
      "❤️",
      "😂",
      "😮",
      "🙏",
    ]);
    expect(picker.querySelector('button[aria-label="Love"]')).toHaveAttribute("aria-label", "Love");
    expect(container.querySelector(".wish-reaction-summary")).toBeNull();

    fireEvent.pointerDown(document.body);
    expect(screen.queryByRole("group", { name: "Choose a reaction" })).toBeNull();
  });
});
