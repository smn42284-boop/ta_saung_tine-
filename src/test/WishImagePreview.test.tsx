import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { WishImagePreview } from "@/components/WishImagePreview";

describe("WishImagePreview", () => {
  it("opens a larger image preview from the wish card image", () => {
    render(
      <WishImagePreview
        src="data:image/webp;base64,ZmFrZQ=="
        alt="Photo attached to Aye's wish"
        label="View photo attached to Aye's wish"
      />,
    );

    fireEvent.click(
      screen.getByRole("button", {
        name: "View photo attached to Aye's wish",
      }),
    );

    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getAllByRole("img", { name: "Photo attached to Aye's wish" })).toHaveLength(1);
  });
});
