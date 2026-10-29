export const config = { api: { bodyParser: { sizeLimit: "4mb" } } };

const MAX_IMAGE_BYTES = 2_700_000;
const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("X-Content-Type-Options", "nosniff");
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed." });
  }

  const apiKey = process.env.GOOGLE_CLOUD_VISION_API_KEY;
  if (!apiKey) return res.status(503).json({ error: "OCR is not configured. Add GOOGLE_CLOUD_VISION_API_KEY in Vercel." });

  const auth = String(req.headers.authorization || "");
  const match = auth.match(/^Bearer\s+(.+)$/i);
  if (!match) return res.status(401).json({ error: "Please sign in with an administrator account." });

  try {
    const userResponse = await fetch("https://myeiojsclyburoicnglp.supabase.co/auth/v1/user", {
      headers: {
        Authorization: `Bearer ${match[1]}`,
        apikey: "sb_publishable_r981XMc9N_pteQ6LKJqsoQ_7Ck4Mlak"
      }
    });
    if (!userResponse.ok) return res.status(401).json({ error: "Your session is invalid or expired. Sign in again." });
    const user = await userResponse.json();
    const adminCheck = await fetch("https://myeiojsclyburoicnglp.supabase.co/rest/v1/admin_users?select=user_id&user_id=eq." + encodeURIComponent(user.id), {
      headers: {
        Authorization: `Bearer ${match[1]}`,
        apikey: "sb_publishable_r981XMc9N_pteQ6LKJqsoQ_7Ck4Mlak"
      }
    });
    if (!adminCheck.ok) return res.status(403).json({ error: "Could not verify administrator permissions. Please contact the site administrator." });
    const adminRows = await adminCheck.json();
    if (!Array.isArray(adminRows) || !adminRows.some(row => row.user_id === user.id)) {
      return res.status(403).json({ error: "SmartScan OCR is restricted to administrator accounts." });
    }

    const body = req.body || {};
    const imageBase64 = String(body.imageBase64 || body.base64 || "");
    const mimeType = String(body.mimeType || "");
    if (!ALLOWED_TYPES.has(mimeType)) return res.status(400).json({ error: "Use a JPG, PNG, or WebP image." });
    const normalized = imageBase64.replace(/^data:image\/[^;]+;base64,/, "");
    if (!normalized || !/^[A-Za-z0-9+/]*={0,2}$/.test(normalized)) return res.status(400).json({ error: "The image data is invalid." });
    const bytes = Buffer.from(normalized, "base64");
    if (!bytes.length || bytes.length > MAX_IMAGE_BYTES) return res.status(413).json({ error: "Each compressed page must be under 2.7 MB. Please use a smaller image." });

    const visionResponse = await fetch(`https://vision.googleapis.com/v1/images:annotate?key=${encodeURIComponent(apiKey)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        requests: [{
          image: { content: bytes.toString("base64") },
          features: [{ type: "DOCUMENT_TEXT_DETECTION", maxResults: 1 }],
          imageContext: { languageHints: ["en"] }
        }]
      })
    });
    const payload = await visionResponse.json().catch(() => ({}));
    if (!visionResponse.ok || payload.error) {
      console.error("Google Vision request failed:", payload.error?.status || visionResponse.status);
      const status = payload.error?.code === 429 ? 429 : 502;
      return res.status(status).json({ error: payload.error?.message || "Google Vision could not process this page. Check API enablement, key restrictions, and billing/quota settings." });
    }
    const result = payload.responses?.[0] || {};
    if (result.error) return res.status(422).json({ error: result.error.message || "No text could be read from this image." });
    return res.status(200).json({
      text: result.fullTextAnnotation?.text || result.textAnnotations?.[0]?.description || "",
      pages: result.fullTextAnnotation?.pages || [],
      width: result.fullTextAnnotation?.pages?.[0]?.width || null,
      height: result.fullTextAnnotation?.pages?.[0]?.height || null
    });
  } catch (error) {
    console.error("SmartScan OCR failed:", error);
    return res.status(500).json({ error: "SmartScan could not process the page. Please try again." });
  }
}
