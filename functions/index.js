// functions/index.js

const functions = require("firebase-functions");
const admin = require("firebase-admin");

admin.initializeApp();

exports.getOutfitDescription = functions.https.onRequest(async (req, res) => {
  // Allow cross-origin requests
  res.set("Access-Control-Allow-Origin", "*");
  res.set("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") {
    res.status(204).send("");
    return;
  }

  // Only allow POST
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  // Verify Firebase Auth token
  const authHeader = req.headers.authorization || "";
  const idToken = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!idToken) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  try {
    await admin.auth().verifyIdToken(idToken);
  } catch {
    res.status(401).json({ error: "Invalid token" });
    return;
  }

  // Get API key from Firebase config
  const apiKey = functions.config().anthropic.key;

  // Call Anthropic
  const { combo, style } = req.body;
  if (!combo || !style) {
    res.status(400).json({ error: "Missing combo or style" });
    return;
  }

  const desc = combo
    .map(i => `${i.name} (${i.category}, ${i.color}, ${i.material})`)
    .join(", ");

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 1000,
        messages: [{
          role: "user",
          content: `Write a short, elegant 2-sentence outfit description for: ${desc}. Style: ${style}. Sound like a personal stylist.`
        }]
      })
    });

    const data = await response.json();
    const text = data.content?.find(b => b.type === "text")?.text || "";
    res.status(200).json({ description: text });

  } catch (err) {
    console.error("Anthropic error:", err);
    res.status(500).json({ error: "Failed to generate description" });
  }
});