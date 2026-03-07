/**
 * Image Optimization — resize, convert to WebP, generate thumbnails.
 *
 * Uses `sharp` for server-side image processing.
 * Install: npm install sharp
 *
 * Usage in upload API:
 *   const { optimized, thumbnail } = await optimizeImage(buffer, filename);
 */

import sharp from "sharp";

export interface OptimizedImage {
  /** Full-size WebP buffer (max 800px wide) */
  buffer: Buffer;
  /** WebP thumbnail buffer (400px wide) */
  thumbnail: Buffer;
  /** Original width */
  width: number;
  /** Original height */
  height: number;
  /** Optimized file size in bytes */
  size: number;
  /** Thumbnail file size in bytes */
  thumbnailSize: number;
  /** Content type */
  contentType: "image/webp";
}

/**
 * Optimize an uploaded image:
 * 1. Resize to max 800px wide (preserving aspect ratio)
 * 2. Convert to WebP (quality 82)
 * 3. Generate 400px wide thumbnail
 *
 * @param inputBuffer - Raw image buffer (JPEG, PNG, WebP)
 * @param filename - Original filename (for logging)
 */
export async function optimizeImage(
  inputBuffer: Buffer,
  filename?: string
): Promise<OptimizedImage> {
  const metadata = await sharp(inputBuffer).metadata();
  const origWidth = metadata.width || 800;
  const origHeight = metadata.height || 600;

  // Full-size: max 800px wide
  const fullSize = await sharp(inputBuffer)
    .resize({
      width: Math.min(origWidth, 800),
      withoutEnlargement: true,
    })
    .webp({ quality: 82 })
    .toBuffer();

  // Thumbnail: 400px wide
  const thumb = await sharp(inputBuffer)
    .resize({
      width: Math.min(origWidth, 400),
      withoutEnlargement: true,
    })
    .webp({ quality: 72 })
    .toBuffer();

  return {
    buffer: fullSize,
    thumbnail: thumb,
    width: origWidth,
    height: origHeight,
    size: fullSize.length,
    thumbnailSize: thumb.length,
    contentType: "image/webp",
  };
}

/**
 * Generate WebP filename from original.
 * e.g., "photo.jpg" → "photo.webp"
 */
export function webpFilename(original: string): string {
  return original.replace(/\.\w+$/, ".webp");
}

/**
 * Generate thumbnail filename.
 * e.g., "photo.jpg" → "photo-thumb.webp"
 */
export function thumbFilename(original: string): string {
  return original.replace(/\.\w+$/, "-thumb.webp");
}
