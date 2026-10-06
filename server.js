import express from "express";
import fs from "fs/promises";
import path from "path";
import crypto from "crypto";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(express.json({ limit: "1mb" }));
app.use(express.static(path.join(__dirname, "public")));

const PORT = process.env.PORT || 3000;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || "";
const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-3-flash-preview";
const TEACHER_CODE = process.env.TEACHER_CODE || "121705";
const APP_SECRET = process.env.APP_SECRET || "change-this-secret-in-production";

const DATA_DIR = path.join(__dirname, "data");
const SETTINGS_FILE = path.join(DATA_DIR, "settings.json");
const SESSIONS_FILE = path.join(DATA_DIR, "sessions.json");

async function ensureData() {
  await fs.mkdir(DATA_DIR, { recursive: true });
  try { await fs.access(SETTINGS_FILE); }
  catch { await fs.writeFile(SETTINGS_FILE, JSON.stringify({ unlockedUnits: 1 }, null, 2)); }
  try { await fs.access(SESSIONS_FILE); }
  catch { await fs.writeFile(SESSIONS_FILE, "[]"); }
}

async function readJson(file, fallback) {
  try { return JSON.parse(await fs.readFile(file, "utf8")); }
  catch { return fallback; }
}

async function writeJson(file, value) {
  await fs.writeFile(file, JSON.stringify(value, null, 2), "utf8");
}

function makeTeacherToken() {
  const payload = `teacher:${Date.now()}`;
  const sig = crypto.createHmac("sha256", APP_SECRET).update(payload).digest("hex");
  return Buffer.from(`${payload}:${sig}`).toString("base64url");
}

function validTeacherToken(token) {
  try {
    const decoded = Buffer.from(token, "base64url").toString("utf8");
    const parts = decoded.split(":");
    if (parts.length !== 3 || parts[0] !== "teacher") return false;
    const payload = `${parts[0]}:${parts[1]}`;
    const expected = crypto.createHmac("sha256", APP_SECRET).update(payload).digest("hex");
    return crypto.timingSafeEqual(Buffer.from(parts[2]), Buffer.from(expected));
  } catch {
    return false;
  }
}

function requireTeacher(req, res, next) {
  const token = (req.headers.authorization || "").replace(/^Bearer\s+/i, "");
  if (!validTeacherToken(token)) return res.status(401).json({ error: "Unauthorized" });
  next();
}

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, aiConfigured: Boolean(GEMINI_API_KEY), model: GEMINI_MODEL });
});

app.post("/api/teacher-login", (req, res) => {
  if (String(req.body?.code || "") !== String(TEACHER_CODE)) {
    return res.status(401).json({ error: "Invalid code" });
  }
  res.json({ token: makeTeacherToken() });
});

app.get("/api/settings", async (_req, res) => {
  res.json(await readJson(SETTINGS_FILE, { unlockedUnits: 1 }));
});

app.put("/api/settings", requireTeacher, async (req, res) => {
  const unit = Number(req.body?.unlockedUnits);
  if (!Number.isInteger(unit) || unit < 1 || unit > 12) {
    return res.status(400).json({ error: "unlockedUnits must be an integer from 1 to 12." });
  }
  const data = { unlockedUnits: unit, updatedAt: new Date().toISOString() };
  await writeJson(SETTINGS_FILE, data);
  res.json(data);
});

app.get("/api/sessions", requireTeacher, async (_req, res) => {
  const sessions = await readJson(SESSIONS_FILE, []);
  res.json(Array.isArray(sessions) ? sessions : []);
});

app.post("/api/sessions", async (req, res) => {
  const session = req.body;
  if (!session || typeof session !== "object") return res.status(400).json({ error: "Invalid session." });

  const sessions = await readJson(SESSIONS_FILE, []);
  const safe = {
    ...session,
    id: String(session.id || crypto.randomUUID()),
    savedAt: new Date().toISOString()
  };

  const index = sessions.findIndex(x => String(x.id) === safe.id);
  if (index >= 0) sessions[index] = safe;
  else sessions.push(safe);

  // Keep the file bounded for a classroom app.
  const bounded = sessions.slice(-1000);
  await writeJson(SESSIONS_FILE, bounded);
  res.status(201).json({ ok: true, id: safe.id });
});

app.get("/api/ai-test", async (_req, res) => {
  if (!GEMINI_API_KEY) return res.status(503).json({ ok: false, error: "AI_NOT_CONFIGURED" });

  const url =
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(GEMINI_MODEL)}:generateContent?key=${encodeURIComponent(GEMINI_API_KEY)}`;

  try {
    const upstream = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: "Reply with exactly: TUTOR_OK" }] }],
        generationConfig: { temperature: 0, maxOutputTokens: 20 }
      })
    });
    const data = await upstream.json().catch(() => ({}));
    const text = data?.candidates?.[0]?.content?.parts?.map(p => p.text || "").join("").trim() || "";
    if (!upstream.ok) {
      console.error("AI test failed:", upstream.status, JSON.stringify(data).slice(0, 1200));
      return res.status(upstream.status).json({ ok: false, model: GEMINI_MODEL, status: upstream.status, error: data?.error?.message || "Gemini request failed" });
    }
    res.json({ ok: true, model: GEMINI_MODEL, response: text });
  } catch (err) {
    console.error("AI test network error:", err);
    res.status(502).json({ ok: false, model: GEMINI_MODEL, error: "AI_REQUEST_FAILED" });
  }
});

app.post("/api/gemini", async (req, res) => {
  if (!GEMINI_API_KEY) {
    return res.status(503).json({
      error: "AI_NOT_CONFIGURED",
      message: "Set GEMINI_API_KEY on the server."
    });
  }

  const url =
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(GEMINI_MODEL)}:generateContent?key=${encodeURIComponent(GEMINI_API_KEY)}`;

  try {
    const upstream = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(req.body)
    });

    const text = await upstream.text();
    if (!upstream.ok) {
      console.error(`Gemini upstream error ${upstream.status} using model ${GEMINI_MODEL}:`, text.slice(0, 1200));
    }
    res.status(upstream.status);
    res.type(upstream.headers.get("content-type") || "application/json");
    res.send(text);
  } catch (err) {
    console.error("Gemini proxy error:", err);
    res.status(502).json({ error: "AI_REQUEST_FAILED" });
  }
});

await ensureData();

app.listen(PORT, () => {
  console.log(`SpeakBridge running on port ${PORT}`);
});
