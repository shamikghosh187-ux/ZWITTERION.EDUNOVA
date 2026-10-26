// Vercel serverless endpoint: Google Cloud Vision OCR.
// Configure GOOGLE_CLOUD_VISION_API_KEY in Vercel Project Settings > Environment Variables.
const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/bmp"]);

module.exports = async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("X-Content-Type-Options", "nosniff");

  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Use POST for OCR requests." });
  }

  const apiKey = process.env.GOOGLE_CLOUD_VISION_API_KEY;
  if (!apiKey) {
    return res.status(503).json({
      error: "Google Vision is not configured yet. Add GOOGLE_CLOUD_VISION_API_KEY to Vercel environment variables."
    });
  }

  try {
    const body = req.body || {};
    const mimeType = String(body.mimeType || "");
    const imageBase64 = String(body.imageBase64 || "").replace(/^data:[^;]+;base64,/, "");
    if (!ALLOWED_TYPES.has(mimeType)) {
      return res.status(400).json({ error: "Unsupported image type. Use JPG, PNG, WEBP, or BMP." });
    }
    if (!imageBase64 || !/^[A-Za-z0-9+/]+={0,2}$/.test(imageBase64)) {
      return res.status(400).json({ error: "The uploaded image is invalid." });
    }
    const estimatedBytes = Math.floor(imageBase64.length * 3 / 4);
    if (estimatedBytes > MAX_IMAGE_BYTES) {
      return res.status(413).json({ error: "Each image must be 8 MB or smaller." });
    }

    const googleResponse = await fetch(
      "https://vision.googleapis.com/v1/images:annotate?key=" + encodeURIComponent(apiKey),
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requests: [{
            image: { content: imageBase64 },
            features: [{ type: "DOCUMENT_TEXT_DETECTION" }]
          }]
        })
      }
    );

    const payload = await googleResponse.json();
    if (!googleResponse.ok) {
      console.error("Google Vision request failed:", googleResponse.status, payload?.error?.status || "unknown");
      return res.status(502).json({ error: "Google Vision could not process this page. Check API setup, billing, and quota." });
    }
    const result = payload.responses && payload.responses[0];
    if (result?.error) {
      return res.status(422).json({ error: "OCR failed for this page. Try a clearer image." });
    }

    const text = result?.fullTextAnnotation?.text || result?.textAnnotations?.[0]?.description || "";
    return res.status(200).json({ text, detected: Boolean(text), provider: "google-cloud-vision" });
  } catch (error) {
    console.error("Vision OCR handler error:", error?.message || "unknown");
    return res.status(500).json({ error: "Could not process the scan. Please try again." });
  }
};
