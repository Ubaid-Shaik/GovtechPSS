// Vercel Serverless Function: server-side OCR via Azure AI Vision 4.0 (Read).
// Lives at /api/ocr.js, called by card.html at /api/ocr.
// Keeps your key off the client and avoids CORS.
// Set these in Vercel → Project → Settings → Environment Variables (NOT in this file):
//   AZURE_VISION_ENDPOINT  e.g. https://<your-resource>.cognitiveservices.azure.com
//   AZURE_VISION_KEY       the resource key

export default async function handler(req, res) {
  if (req.method === "OPTIONS") { res.status(204).end(); return; }
  if (req.method !== "POST") { res.status(405).json({ error: "Method not allowed" }); return; }

  const endpoint = process.env.AZURE_VISION_ENDPOINT;
  const key = process.env.AZURE_VISION_KEY;
  if (!endpoint || !key) {
    res.status(500).json({ error: "OCR not configured — set AZURE_VISION_ENDPOINT and AZURE_VISION_KEY in Vercel." });
    return;
  }

  try {
    const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {});
    const image = body.image;
    if (!image) { res.status(400).json({ error: "no image" }); return; }

    const buf = Buffer.from(image, "base64");
    const url = endpoint.replace(/\/+$/, "") +
      "/computervision/imageanalysis:analyze?api-version=2024-02-01&features=read";

    const resp = await fetch(url, {
      method: "POST",
      headers: { "Ocp-Apim-Subscription-Key": key, "Content-Type": "application/octet-stream" },
      body: buf
    });

    if (!resp.ok) {
      const detail = await resp.text();
      res.status(502).json({ error: "vision_error", status: resp.status, detail: detail.slice(0, 400) });
      return;
    }

    const data = await resp.json();
    const lines = [];
    const blocks = (data.readResult && data.readResult.blocks) || [];
    for (const b of blocks) for (const l of (b.lines || [])) if (l.text) lines.push(l.text);

    res.status(200).json({ text: lines.join("\n") });
  } catch (e) {
    res.status(500).json({ error: String((e && e.message) || e) });
  }
}
