import crypto from "node:crypto";

const MAX_BYTES = 8 * 1024 * 1024;
const ALLOWED_MIME = new Set(["image/jpeg", "image/png", "image/webp", "image/bmp"]);

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("X-Content-Type-Options", "nosniff");
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed." });
  }

  const apiKey = process.env.GOOGLE_CLOUD_VISION_API_KEY;
  if (!apiKey) return res.status(503).json({ error: "OCR is not configured yet. Add GOOGLE_CLOUD_VISION_API_KEY to Vercel and redeploy." });

  try {
    const { image, mimeType } = req.body || {};
    if (typeof image !== "string" || !ALLOWED_MIME.has(mimeType)) {
      return res.status(400).json({ error: "Upload a JPEG, PNG, WEBP, or BMP image." });
    }
    const raw = Buffer.from(image, "base64");
    if (!raw.length || raw.length > MAX_BYTES) {
      return res.status(413).json({ error: "Each image must be under 8 MB. Try a smaller scan." });
    }

    const response = await fetch("https://vision.googleapis.com/v1/images:annotate?key=" + encodeURIComponent(apiKey), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        requests: [{
          image: { content: raw.toString("base64") },
          features: [
            { type: "DOCUMENT_TEXT_DETECTION", maxResults: 1 },
            { type: "TEXT_DETECTION", maxResults: 1 }
          ],
          imageContext: { languageHints: ["en"] }
        }]
      })
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok || data.error) {
      const status = response.status === 429 ? 429 : 502;
      return res.status(status).json({ error: data.error?.message || "Google Vision could not read this page. Try again with a clearer image." });
    }
    const result = data.responses?.[0];
    if (result?.error) return res.status(502).json({ error: result.error.message || "OCR failed." });
    const full = result?.fullTextAnnotation?.text || result?.textAnnotations?.[0]?.description || "";
    return res.status(200).json({
      text: full,
      pages: result?.fullTextAnnotation?.pages?.length || 1,
      detectedLanguage: result?.fullTextAnnotation?.pages?.[0]?.property?.detectedLanguages?.[0]?.languageCode || "unknown"
    });
  } catch (error) {
    return res.status(500).json({ error: "Could not process this scan. Please retry." });
  }
}
