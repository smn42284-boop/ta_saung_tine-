export const MAX_WISH_IMAGE_BYTES = 5 * 1024 * 1024;
export const MAX_COMPRESSED_WISH_IMAGE_BYTES = 850 * 1024;
export const MAX_WISH_IMAGE_DIMENSION = 1280;
export const WISH_IMAGES_STORAGE_KEY = "share-light.wish-images.v1";
export const WISH_IMAGES_CHANGE_EVENT = "share-light:wish-images";

const MIME_TYPES: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
};

type WishImageMap = Record<string, string>;

export function isStorageQuotaError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const name = "name" in error ? error.name : undefined;
  const code = "code" in error ? error.code : undefined;
  return (
    name === "QuotaExceededError" ||
    name === "NS_ERROR_DOM_QUOTA_REACHED" ||
    code === 22 ||
    code === 1014
  );
}

function isSupportedDataUrl(value: unknown): value is string {
  return typeof value === "string" && /^data:image\/(?:webp|png|jpeg);base64,/i.test(value);
}

function readWishImages(): WishImageMap {
  if (typeof window === "undefined") return {};
  let raw: string | null;
  try {
    raw = window.localStorage.getItem(WISH_IMAGES_STORAGE_KEY);
  } catch {
    throw new Error(
      "This browser could not access saved wish photos. Enable local storage and try again.",
    );
  }
  if (raw === null) return {};
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    throw new Error("Saved wish photos could not be read from this browser.");
  }
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error("Saved wish photos in this browser are invalid.");
  const images: WishImageMap = {};
  for (const [id, dataUrl] of Object.entries(value)) {
    if (!id || !isSupportedDataUrl(dataUrl))
      throw new Error("Saved wish photos in this browser are invalid.");
    images[id] = dataUrl;
  }
  return images;
}

function writeWishImages(images: WishImageMap): void {
  if (typeof window === "undefined") throw new Error("Wish photos can only be saved in a browser.");
  try {
    if (Object.keys(images).length)
      window.localStorage.setItem(WISH_IMAGES_STORAGE_KEY, JSON.stringify(images));
    else window.localStorage.removeItem(WISH_IMAGES_STORAGE_KEY);
  } catch (error) {
    if (isStorageQuotaError(error)) {
      throw new Error(
        "This browser is out of local storage space for the photo. The wish was not submitted; try a smaller image or free some browser storage.",
      );
    }
    throw new Error("This browser could not save the photo. Enable local storage and try again.");
  }
  window.dispatchEvent(new Event(WISH_IMAGES_CHANGE_EVENT));
}

export function validateWishImageFile(file: File): void {
  const extension = file.name.toLowerCase().match(/\.[^.]+$/)?.[0] ?? "";
  const expectedType = MIME_TYPES[extension];
  if (!expectedType || (file.type !== "" && file.type.toLowerCase() !== expectedType)) {
    throw new Error("Choose a JPG, JPEG, PNG or WEBP image.");
  }
  if (file.size > MAX_WISH_IMAGE_BYTES) throw new Error("Choose an image that is 5 MB or smaller.");
  if (!file.size) throw new Error("The selected image is empty.");
}

async function validateImageSignature(file: File): Promise<void> {
  const bytes = await new Promise<Uint8Array>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (reader.result instanceof ArrayBuffer) resolve(new Uint8Array(reader.result));
      else reject(new Error("This image could not be checked."));
    };
    reader.onerror = () => reject(new Error("This image could not be checked."));
    reader.readAsArrayBuffer(file.slice(0, 12));
  });
  const isJpeg = bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  const isPng =
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a;
  const isWebp =
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50;
  const actualType = isJpeg ? "image/jpeg" : isPng ? "image/png" : isWebp ? "image/webp" : null;
  const extension = file.name.toLowerCase().match(/\.[^.]+$/)?.[0] ?? "";
  const expectedType = MIME_TYPES[extension];
  if (!actualType || actualType !== expectedType)
    throw new Error("That file is not a supported image. Choose a JPG, PNG or WEBP.");
}

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("This image could not be opened. Please choose another."));
    };
    image.src = url;
  });
}

function encodeCanvas(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob);
        else reject(new Error("This image could not be compressed."));
      },
      "image/webp",
      quality,
    );
  });
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") resolve(reader.result);
      else reject(new Error("This image could not be prepared for saving."));
    };
    reader.onerror = () => reject(new Error("This image could not be prepared for saving."));
    reader.readAsDataURL(blob);
  });
}

export async function prepareWishImage(file: File): Promise<string> {
  validateWishImageFile(file);
  await validateImageSignature(file);
  const image = await loadImage(file);
  if (!image.naturalWidth || !image.naturalHeight)
    throw new Error("This image has invalid dimensions.");

  const scale = Math.min(
    1,
    MAX_WISH_IMAGE_DIMENSION / Math.max(image.naturalWidth, image.naturalHeight),
  );
  let width = Math.max(1, Math.round(image.naturalWidth * scale));
  let height = Math.max(1, Math.round(image.naturalHeight * scale));
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Your browser could not prepare this image.");

  for (let attempt = 0; attempt < 8; attempt++) {
    canvas.width = width;
    canvas.height = height;
    context.clearRect(0, 0, width, height);
    context.drawImage(image, 0, 0, width, height);
    for (const quality of [0.82, 0.7, 0.58, 0.46]) {
      const blob = await encodeCanvas(canvas, quality);
      if (
        blob.size <= MAX_COMPRESSED_WISH_IMAGE_BYTES &&
        /^image\/(?:webp|png|jpeg)$/i.test(blob.type)
      ) {
        return blobToDataUrl(blob);
      }
    }
    if (Math.max(width, height) <= 160) break;
    width = Math.max(1, Math.floor(width * 0.8));
    height = Math.max(1, Math.floor(height * 0.8));
  }
  throw new Error(
    "This image could not be reduced enough to save in this browser. Please choose a smaller image.",
  );
}

export function stageWishImage(dataUrl: string): string {
  if (!isSupportedDataUrl(dataUrl)) throw new Error("The selected photo is not ready to save.");
  const id = `pending:${crypto.randomUUID()}`;
  const images = readWishImages();
  images[id] = dataUrl;
  writeWishImages(images);
  return id;
}

export function associateStagedWishImage(stagedId: string, wishId: string): void {
  const images = readWishImages();
  const image = images[stagedId];
  if (!image) throw new Error("The prepared photo could not be found.");
  delete images[stagedId];
  images[wishId] = image;
  writeWishImages(images);
}

export function discardStagedWishImage(stagedId: string): void {
  const images = readWishImages();
  if (!(stagedId in images)) return;
  delete images[stagedId];
  writeWishImages(images);
}

export function getWishImages(ids?: string[]): WishImageMap {
  const images = readWishImages();
  if (!ids) return images;
  return Object.fromEntries(ids.flatMap((id) => (images[id] ? [[id, images[id]!]] : [])));
}

export function removeWishImage(wishId: string): void {
  const images = readWishImages();
  if (!(wishId in images)) return;
  delete images[wishId];
  writeWishImages(images);
}

export function clearWishImages(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(WISH_IMAGES_STORAGE_KEY);
  } catch {
    throw new Error("Wishes were cleared, but this browser could not remove their saved photos.");
  }
  window.dispatchEvent(new Event(WISH_IMAGES_CHANGE_EVENT));
}
