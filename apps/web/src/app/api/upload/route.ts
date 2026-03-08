import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/guard";
import { supabaseAdmin } from "@/lib/supabase";
import { log } from "@/lib/logger";

// POST /api/upload — upload image to Supabase Storage
// Optimizes: resize to max 800px, convert to WebP, generate 400px thumbnail
export async function POST(req: NextRequest) {
  const guard = await requireSession(req);
  if (!guard.ok) return guard.response;
  const { restaurantId } = guard;

  try {
    const formData = await req.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    // Validate file type
    const allowed = ["image/jpeg", "image/png", "image/webp"];
    if (!allowed.includes(file.type)) {
      return NextResponse.json(
        { error: "Only JPEG, PNG, and WebP images are allowed" },
        { status: 400 }
      );
    }

    // Max 5MB
    if (file.size > 5 * 1024 * 1024) {
      return NextResponse.json({ error: "Image must be under 5MB" }, { status: 400 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const inputBuffer = Buffer.from(arrayBuffer);
    const baseName = `${restaurantId}/${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;

    let fullBuffer: Buffer;
    let thumbBuffer: Buffer;
    let contentType = "image/webp";

    try {
      // Try sharp optimization
      const sharp = (await import("sharp")).default;

      const metadata = await sharp(inputBuffer).metadata();
      const origWidth = metadata.width || 800;

      // Full-size: max 800px wide, WebP
      fullBuffer = await sharp(inputBuffer)
        .resize({ width: Math.min(origWidth, 800), withoutEnlargement: true })
        .webp({ quality: 82 })
        .toBuffer();

      // Thumbnail: 400px wide, WebP
      thumbBuffer = await sharp(inputBuffer)
        .resize({ width: Math.min(origWidth, 400), withoutEnlargement: true })
        .webp({ quality: 72 })
        .toBuffer();
    } catch {
      // sharp not available — upload as-is
      fullBuffer = inputBuffer;
      thumbBuffer = inputBuffer;
      contentType = file.type;
    }

    const ext = contentType === "image/webp" ? "webp" : (file.name.split(".").pop() || "jpg");

    // Upload full-size
    const { data: fullData, error: fullErr } = await supabaseAdmin.storage
      .from("menu-images")
      .upload(`${baseName}.${ext}`, fullBuffer, { contentType, upsert: false });

    if (fullErr) {
      return NextResponse.json({ error: "Upload failed" }, { status: 500 });
    }

    // Upload thumbnail
    const { data: thumbData } = await supabaseAdmin.storage
      .from("menu-images")
      .upload(`${baseName}-thumb.${ext}`, thumbBuffer, { contentType, upsert: false });

    // Get public URLs
    const { data: fullUrl } = supabaseAdmin.storage
      .from("menu-images")
      .getPublicUrl(fullData.path);

    const thumbUrl = thumbData
      ? supabaseAdmin.storage.from("menu-images").getPublicUrl(thumbData.path).data.publicUrl
      : fullUrl.publicUrl;

    return NextResponse.json({
      url: fullUrl.publicUrl,
      thumbnail_url: thumbUrl,
      optimized: contentType === "image/webp",
      size: fullBuffer.length,
    });
  } catch (err) {
    log.error("Upload error", { error: String(err), restaurantId });
    return NextResponse.json({ error: "Upload failed" }, { status: 500 });
  }
}
