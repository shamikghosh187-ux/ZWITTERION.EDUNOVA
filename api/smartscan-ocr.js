const ALLOWED_HOSTS = new Set(["zwitterionclasses.co.in", "www.zwitterionclasses.co.in"]);
const MAX_IMAGES = 4;
const MAX_IMAGE_CHARS = 2_800_000;

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Vary", "Origin");
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed." });
  }

  const origin = req.headers.origin;
  let host = "";
  try { host = new URL(origin || "").host; } catch (_) {}
  const allowed = ALLOWED_HOSTS.has(host) || (process.env.NODE_ENV !== "production" && /^localhost(:\d+)?$/.test(host));
  if (!allowed) return res.status(403).json({ error: "Requests must come from the Zwitterion website." });

  const apiKey = process.env.GOOGLE_CLOUD_VISION_API_KEY;
  if (!apiKey) return res.status(503).json({ error: "Google Vision is not configured on the server yet." });

  try {
    const images = req.body && req.body.images;
    if (!Array.isArray(images) || images.length < 1 || images.length > MAX_IMAGES) {
      return res.status(400).json({ error: "Upload between 1 and 4 pages per batch." });
    }
    const results = [];
    for (const item of images) {
      if (!item || typeof item.data !== "string" || !/^data:image\/(jpeg|png|webp);base64,/i.test(item.data)) {
        return res.status(400).json({ error: "Each page must be a JPEG, PNG, or WebP image." });
      }
      const encoded = item.data.slice(item.data.indexOf(",") + 1);
      if (!encoded || encoded.length > MAX_IMAGE_CHARS) {
        return res.status(413).json({ error: "Each image must be smaller than about 2 MB. Please resize it and try again." });
      }
      const visionResponse = await fetch("https://vision.googleapis.com/v1/images:annotate?key=" + encodeURIComponent(apiKey), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requests: [{ image: { content: encoded }, features: [{ type: "DOCUMENT_TEXT_DETECTION" }] }] })
      });
      let payload = {};
      try { payload = await visionResponse.json(); } catch (_) {}
      if (!visionResponse.ok || payload.error) {
        console.error("Cloud Vision OCR request failed:", payload.error && payload.error.code, payload.error && payload.error.status);
        return res.status(502).json({ error: "Google Vision could not read this page. Check API enablement, billing, and key restrictions." });
      }
      const page = payload.responses && payload.responses[0];
      if (page && page.error) {
        console.error("Cloud Vision page OCR error:", page.error.code, page.error.status);
        return res.status(502).json({ error: "Google Vision could not process one of the pages." });
      }
      results.push({ text: (page && page.fullTextAnnotation && page.fullTextAnnotation.text) || (page && page.textAnnotations && page.textAnnotations[0] && page.textAnnotations[0].description) || "" });
    }
    return res.status(200).json({ ok: true, pages: results });
  } catch (error) {
    console.error("SmartScan OCR failed:", error && error.message);
    return res.status(500).json({ error: "Text extraction failed. Please try again with fewer or smaller images." });
  }
}
