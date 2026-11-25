import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  MAX_WISH_IMAGE_BYTES,
  WISH_IMAGES_STORAGE_KEY,
  associateStagedWishImage,
  getWishImages,
  prepareWishImage,
  stageWishImage,
  validateWishImageFile,
} from "@/lib/wish-images";

const imageDataUrl = "data:image/webp;base64,ZmFrZQ==";

describe("temporary wish photo storage", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("accepts supported image extensions and rejects unsupported files and files over 5 MB", () => {
    const validFiles = [
      ["wish.jpg", "image/jpeg"],
      ["wish.jpeg", "image/jpeg"],
      ["wish.png", "image/png"],
      ["wish.webp", "image/webp"],
    ] as const;
    for (const [name, type] of validFiles) {
      expect(() => validateWishImageFile(new File(["image"], name, { type }))).not.toThrow();
    }

    expect(() =>
      validateWishImageFile(new File(["image"], "wish.gif", { type: "image/gif" })),
    ).toThrow("JPG, JPEG, PNG or WEBP");
    expect(() =>
      validateWishImageFile(
        new File([new Uint8Array(MAX_WISH_IMAGE_BYTES + 1)], "large.png", {
          type: "image/png",
        }),
      ),
    ).toThrow("5 MB");
  });

  it("keeps image data in a separate localStorage sidecar and associates it with the wish ID", () => {
    window.localStorage.setItem("share-light.local-api.v1", "existing wishes");
    const stagedId = stageWishImage(imageDataUrl);
    associateStagedWishImage(stagedId, "wish-123");

    expect(getWishImages(["wish-123", "pending"])).toEqual({
      "wish-123": imageDataUrl,
    });
    expect(JSON.parse(window.localStorage.getItem(WISH_IMAGES_STORAGE_KEY)!)).toEqual({
      "wish-123": imageDataUrl,
    });
    expect(window.localStorage.getItem("share-light.local-api.v1")).toBe("existing wishes");
  });

  it("reports localStorage quota failures instead of losing the selected photo silently", () => {
    vi.spyOn(window.localStorage, "setItem").mockImplementation(() => {
      throw new DOMException("Storage full", "QuotaExceededError");
    });

    expect(() => stageWishImage(imageDataUrl)).toThrow("out of local storage space");
  });

  it("resizes large valid images and stores their compressed WEBP representation", async () => {
    const file = new File(
      [new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x00])],
      "large.png",
      { type: "image/png" },
    );
    vi.stubGlobal(
      "Image",
      class {
        naturalWidth = 2400;
        naturalHeight = 1600;
        onload: (() => void) | null = null;
        onerror: (() => void) | null = null;
        set src(_value: string) {
          this.onload?.();
        }
      },
    );
    vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:photo");
    vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({
      clearRect: vi.fn(),
      drawImage: vi.fn(),
    } as unknown as CanvasRenderingContext2D);
    vi.spyOn(HTMLCanvasElement.prototype, "toBlob").mockImplementation(function (
      this: HTMLCanvasElement,
      callback,
    ) {
      expect(this.width).toBe(1280);
      expect(this.height).toBe(853);
      callback(new Blob(["compressed"], { type: "image/webp" }));
    });

    await expect(prepareWishImage(file)).resolves.toMatch(/^data:image\/webp;base64,/);
  });

  it("rejects files whose contents do not match their image extension", async () => {
    const file = new File(["not an image"], "fake.png", {
      type: "image/png",
    });

    await expect(prepareWishImage(file)).rejects.toThrow("not a supported image");
  });
});
