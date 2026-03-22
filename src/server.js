import childProcess from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import express from "express";
import httpProxy from "http-proxy";
import * as tar from "tar";

// Migrate deprecated CLAWDBOT_* env vars → OPENCLAW_* so existing Railway deployments
// keep working. Users should update their Railway Variables to use the new names.
for (const suffix of ["PUBLIC_PORT", "STATE_DIR", "WORKSPACE_DIR", "GATEWAY_TOKEN", "CONFIG_PATH"]) {
  const oldKey = `CLAWDBOT_${suffix}`;
  const newKey = `OPENCLAW_${suffix}`;
  if (process.env[oldKey] && !process.env[newKey]) {
    process.env[newKey] = process.env[oldKey];
    // Best-effort compatibility shim for old Railway templates.
    // Intentionally no warning: Railway templates can still set legacy keys and warnings are noisy.
  }
  // Avoid forwarding legacy variables into OpenClaw subprocesses.
  // OpenClaw logs a warning when deprecated CLAWDBOT_* variables are present.
  delete process.env[oldKey];
}

// Railway injects PORT at runtime and routes traffic to that port.
// Do not force a different public port in the container image, or the service may
// boot but the Railway domain will be routed to a different port.
//
// OPENCLAW_PUBLIC_PORT is kept as an escape hatch for non-Railway deployments.
const PORT = Number.parseInt(process.env.PORT ?? process.env.OPENCLAW_PUBLIC_PORT ?? "3000", 10);

// State/workspace
// OpenClaw defaults to ~/.openclaw.
const STATE_DIR =
  process.env.OPENCLAW_STATE_DIR?.trim() ||
  path.join(os.homedir(), ".openclaw");

const WORKSPACE_DIR =
  process.env.OPENCLAW_WORKSPACE_DIR?.trim() ||
  path.join(STATE_DIR, "workspace");

// Canonical heartbeat message — source of truth is shared/protocols/projects.md
const DASHBOARD_URL = "https://dash.belowthesurface.studio/mc";

const HEARTBEAT_MESSAGE = `Project heartbeat (scan only — do NOT do actual work): Read shared/protocols/projects.md. Check shared/projects/ for projects where you are lead. (1) Check notifications/ — process and delete. (2) Check issues/ — update statuses, propose new issues if needed (status: proposed). (3) Post daily standup if not done today. (4) If .budget-exceeded exists, message Kavin you are paused. Do NOT execute work items in this turn. When referencing the dashboard, always include a direct link: ${DASHBOARD_URL}#/projects/{project-slug}/issues for issues, ${DASHBOARD_URL}#/projects/{project-slug} for project overview.`;

// Protect /setup with a user-provided password.
const SETUP_PASSWORD = process.env.SETUP_PASSWORD?.trim();

// Gateway admin token (protects OpenClaw gateway + Control UI).
// Must be stable across restarts. If not provided via env, persist it in the state dir.
function resolveGatewayToken() {
  const envTok = process.env.OPENCLAW_GATEWAY_TOKEN?.trim();
  if (envTok) return envTok;

  const tokenPath = path.join(STATE_DIR, "gateway.token");
  try {
    const existing = fs.readFileSync(tokenPath, "utf8").trim();
    if (existing) return existing;
  } catch {
    // ignore
  }

  const generated = crypto.randomBytes(32).toString("hex");
  try {
    fs.mkdirSync(STATE_DIR, { recursive: true });
    fs.writeFileSync(tokenPath, generated, { encoding: "utf8", mode: 0o600 });
  } catch {
    // best-effort
  }
  return generated;
}

const OPENCLAW_GATEWAY_TOKEN = resolveGatewayToken();
process.env.OPENCLAW_GATEWAY_TOKEN = OPENCLAW_GATEWAY_TOKEN;

// Where the gateway will listen internally (we proxy to it).
const INTERNAL_GATEWAY_PORT = Number.parseInt(process.env.INTERNAL_GATEWAY_PORT ?? "18789", 10);
const INTERNAL_GATEWAY_HOST = process.env.INTERNAL_GATEWAY_HOST ?? "127.0.0.1";
const GATEWAY_TARGET = `http://${INTERNAL_GATEWAY_HOST}:${INTERNAL_GATEWAY_PORT}`;

// Always run the built-from-source CLI entry directly to avoid PATH/global-install mismatches.
const OPENCLAW_ENTRY = process.env.OPENCLAW_ENTRY?.trim() || "/openclaw/dist/entry.js";
const OPENCLAW_NODE = process.env.OPENCLAW_NODE?.trim() || "node";

function clawArgs(args) {
  return [OPENCLAW_ENTRY, ...args];
}

function resolveConfigCandidates() {
  const explicit = process.env.OPENCLAW_CONFIG_PATH?.trim();
  if (explicit) return [explicit];

  return [path.join(STATE_DIR, "openclaw.json")];
}

function configPath() {
  const candidates = resolveConfigCandidates();
  for (const candidate of candidates) {
    try {
      if (fs.existsSync(candidate)) return candidate;
    } catch {
      // ignore
    }
  }
  // Default to canonical even if it doesn't exist yet.
  return candidates[0] || path.join(STATE_DIR, "openclaw.json");
}

function isConfigured() {
  try {
    return resolveConfigCandidates().some((candidate) => fs.existsSync(candidate));
  } catch {
    return false;
  }
}

// One-time migration: rename legacy config files to openclaw.json so existing
// deployments that still have the old filename on their volume keep working.
(function migrateLegacyConfigFile() {
  // If the operator explicitly chose a config path, do not rename files in STATE_DIR.
  if (process.env.OPENCLAW_CONFIG_PATH?.trim()) return;

  const canonical = path.join(STATE_DIR, "openclaw.json");
  if (fs.existsSync(canonical)) return;

  for (const legacy of ["clawdbot.json", "moltbot.json"]) {
    const legacyPath = path.join(STATE_DIR, legacy);
    try {
      if (fs.existsSync(legacyPath)) {
        fs.renameSync(legacyPath, canonical);
        console.log(`[migration] Renamed ${legacy} → openclaw.json`);
        return;
      }
    } catch (err) {
      console.warn(`[migration] Failed to rename ${legacy}: ${err}`);
    }
  }
})();

let gatewayProc = null;
let gatewayStarting = null;

// Debug breadcrumbs for common Railway failures (502 / "Application failed to respond").
let lastGatewayError = null;
let lastGatewayExit = null;
let lastDoctorOutput = null;
let lastDoctorAt = null;

// --- Model Fallback Watcher ---
// Tracks provider fallback state to avoid duplicate alerts.
// Key: provider prefix (e.g. "anthropic"), Value: { alertedAt, reason, next }
const _fallbackState = new Map();
const FALLBACK_COOLDOWN_MS = 5 * 60 * 1000; // 5 min between alerts for same provider
const OPS_CHAT_ID = process.env.OPS_TELEGRAM_CHAT_ID?.trim() || "1460501374"; // Kavin's DM

function _getTelegramBotToken() {
  try {
    const cfg = JSON.parse(fs.readFileSync(configPath(), "utf8"));
    // Walk known paths for the bot token
    const tg = cfg?.channels?.telegram;
    if (tg?.botToken) return tg.botToken;
    if (tg?.token) return tg.token;
    // Try agents.list[0] (main/Sam) telegram config
    for (const agent of cfg?.agents?.list || []) {
      if (agent.id === "main" && agent.channels?.telegram?.botToken) {
        return agent.channels.telegram.botToken;
      }
    }
  } catch { /* ignore */ }
  return process.env.SAM_TELEGRAM_TOKEN?.trim() || null;
}

async function _sendFallbackAlert(fields) {
  const botToken = _getTelegramBotToken();
  if (!botToken) {
    console.error("[ops-watcher] No Telegram bot token found — cannot send fallback alert");
    return;
  }

  const provider = (fields.requested || "").split("/")[0] || "unknown";
  const now = Date.now();
  const prev = _fallbackState.get(provider);
  if (prev && (now - prev.alertedAt) < FALLBACK_COOLDOWN_MS) return; // debounce

  _fallbackState.set(provider, { alertedAt: now, reason: fields.reason, next: fields.next });

  const reason = fields.reason || "unknown";
  const requested = fields.requested || "unknown";
  const next = fields.next || "none";
  const decision = fields.decision || "unknown";

  let text = `⚠️ *Model fallback triggered*\n\n`;
  text += `*Requested:* \`${requested}\`\n`;
  text += `*Decision:* ${decision}\n`;
  text += `*Reason:* ${reason}\n`;

  if (next === "none") {
    text += `\n🔴 *All fallbacks exhausted* — agent request failed entirely.`;
  } else {
    text += `*Falling back to:* \`${next}\``;
  }

  const body = {
    chat_id: OPS_CHAT_ID,
    text,
    parse_mode: "Markdown",
  };

  try {
    const resp = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!resp.ok) {
      console.error(`[ops-watcher] Telegram sendMessage failed: ${resp.status} ${await resp.text()}`);
    }
  } catch (err) {
    console.error(`[ops-watcher] Telegram sendMessage error: ${err}`);
  }
}

function _parseFallbackLine(line) {
  const match = line.match(/\[model-fallback\/decision\]/);
  if (!match) return null;

  const fields = {};
  for (const [, key, val] of line.matchAll(/(\w+)=(\S+)/g)) {
    fields[key] = val;
  }
  return fields;
}

function _scanGatewayLine(line) {
  const fields = _parseFallbackLine(line);
  if (fields) {
    _sendFallbackAlert(fields).catch((err) => {
      console.error(`[ops-watcher] alert error: ${err}`);
    });
  }
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function waitForGatewayReady(opts = {}) {
  const timeoutMs = opts.timeoutMs ?? 20_000;
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      // Try the default Control UI base path, then fall back to root.
      const paths = ["/openclaw", "/"];
      for (const p of paths) {
        try {
          const res = await fetch(`${GATEWAY_TARGET}${p}`, { method: "GET" });
          // Any HTTP response means the port is open.
          if (res) return true;
        } catch {
          // try next
        }
      }
    } catch {
      // not ready
    }
    await sleep(250);
  }
  return false;
}

async function startGateway() {
  if (gatewayProc) return;
  if (!isConfigured()) throw new Error("Gateway cannot start: not configured");

  fs.mkdirSync(STATE_DIR, { recursive: true });
  fs.mkdirSync(WORKSPACE_DIR, { recursive: true });

  const args = [
    "gateway",
    "run",
    "--bind",
    "loopback",
    "--port",
    String(INTERNAL_GATEWAY_PORT),
    "--auth",
    "token",
    "--token",
    OPENCLAW_GATEWAY_TOKEN,
  ];

  gatewayProc = childProcess.spawn(OPENCLAW_NODE, clawArgs(args), {
    stdio: ["inherit", "pipe", "pipe"],
    env: {
      ...process.env,
      OPENCLAW_STATE_DIR: STATE_DIR,
      OPENCLAW_WORKSPACE_DIR: WORKSPACE_DIR,
    },
  });

  // Forward stdout/stderr to console (preserving Railway log visibility)
  // and scan each line for model-fallback events.
  for (const stream of [gatewayProc.stdout, gatewayProc.stderr]) {
    if (!stream) continue;
    let buffer = "";
    stream.on("data", (chunk) => {
      const text = chunk.toString();
      process.stdout.write(text); // preserve original logging
      buffer += text;
      const lines = buffer.split("\n");
      buffer = lines.pop() || ""; // keep incomplete line in buffer
      for (const line of lines) {
        _scanGatewayLine(line);
      }
    });
    stream.on("end", () => {
      if (buffer.trim()) _scanGatewayLine(buffer);
      buffer = "";
    });
  }

  gatewayProc.on("error", (err) => {
    const msg = `[gateway] spawn error: ${String(err)}`;
    console.error(msg);
    lastGatewayError = msg;
    gatewayProc = null;
  });

  gatewayProc.on("exit", (code, signal) => {
    const msg = `[gateway] exited code=${code} signal=${signal}`;
    console.error(msg);
    lastGatewayExit = { code, signal, at: new Date().toISOString() };
    gatewayProc = null;
  });
}

async function runDoctorBestEffort() {
  // Avoid spamming `openclaw doctor` in a crash loop.
  const now = Date.now();
  if (lastDoctorAt && now - lastDoctorAt < 5 * 60 * 1000) return;
  lastDoctorAt = now;

  try {
    const r = await runCmd(OPENCLAW_NODE, clawArgs(["doctor"]));
    const out = redactSecrets(r.output || "");
    lastDoctorOutput = out.length > 50_000 ? out.slice(0, 50_000) + "\n... (truncated)\n" : out;
  } catch (err) {
    lastDoctorOutput = `doctor failed: ${String(err)}`;
  }
}

async function ensureGatewayRunning() {
  if (!isConfigured()) return { ok: false, reason: "not configured" };
  if (gatewayProc) return { ok: true };
  if (!gatewayStarting) {
    gatewayStarting = (async () => {
      try {
        lastGatewayError = null;
        await startGateway();
        const ready = await waitForGatewayReady({ timeoutMs: 20_000 });
        if (!ready) {
          throw new Error("Gateway did not become ready in time");
        }
      } catch (err) {
        const msg = `[gateway] start failure: ${String(err)}`;
        lastGatewayError = msg;
        // Collect extra diagnostics to help users file issues.
        await runDoctorBestEffort();
        throw err;
      }
    })().finally(() => {
      gatewayStarting = null;
    });
  }
  await gatewayStarting;
  return { ok: true };
}

async function restartGateway() {
  if (gatewayProc) {
    try {
      gatewayProc.kill("SIGTERM");
    } catch {
      // ignore
    }
    // Give it a moment to exit and release the port.
    await sleep(750);
    gatewayProc = null;
  }
  return ensureGatewayRunning();
}

function requireSetupAuth(req, res, next) {
  if (!SETUP_PASSWORD) {
    return res
      .status(500)
      .type("text/plain")
      .send("SETUP_PASSWORD is not set. Set it in Railway Variables before using /setup.");
  }

  const header = req.headers.authorization || "";
  const [scheme, encoded] = header.split(" ");
  if (scheme !== "Basic" || !encoded) {
    res.set("WWW-Authenticate", 'Basic realm="OpenClaw Setup"');
    return res.status(401).send("Auth required");
  }
  const decoded = Buffer.from(encoded, "base64").toString("utf8");
  const idx = decoded.indexOf(":");
  const password = idx >= 0 ? decoded.slice(idx + 1) : "";
  if (password !== SETUP_PASSWORD) {
    res.set("WWW-Authenticate", 'Basic realm="OpenClaw Setup"');
    return res.status(401).send("Invalid password");
  }
  return next();
}

const app = express();
app.disable("x-powered-by");
app.use(express.json({ limit: "1mb" }));

// Minimal health endpoint for Railway.
app.get("/setup/healthz", (_req, res) => res.json({ ok: true }));

async function probeGateway() {
  // Don't assume HTTP — the gateway primarily speaks WebSocket.
  // A simple TCP connect check is enough for "is it up".
  const net = await import("node:net");

  return await new Promise((resolve) => {
    const sock = net.createConnection({
      host: INTERNAL_GATEWAY_HOST,
      port: INTERNAL_GATEWAY_PORT,
      timeout: 750,
    });

    const done = (ok) => {
      try { sock.destroy(); } catch {}
      resolve(ok);
    };

    sock.on("connect", () => done(true));
    sock.on("timeout", () => done(false));
    sock.on("error", () => done(false));
  });
}

// Public health endpoint (no auth) so Railway can probe without /setup.
// Keep this free of secrets.
app.get("/healthz", async (_req, res) => {
  let gatewayReachable = false;
  if (isConfigured()) {
    try {
      gatewayReachable = await probeGateway();
    } catch {
      gatewayReachable = false;
    }
  }

  res.json({
    ok: true,
    wrapper: {
      configured: isConfigured(),
      stateDir: STATE_DIR,
      workspaceDir: WORKSPACE_DIR,
    },
    gateway: {
      target: GATEWAY_TARGET,
      reachable: gatewayReachable,
      lastError: lastGatewayError,
      lastExit: lastGatewayExit,
      lastDoctorAt,
    },
  });
});

app.get("/setup/app.js", requireSetupAuth, (_req, res) => {
  // Serve JS for /setup (kept external to avoid inline encoding/template issues)
  res.type("application/javascript");
  res.send(fs.readFileSync(path.join(process.cwd(), "src", "setup-app.js"), "utf8"));
});

app.get("/setup", requireSetupAuth, (_req, res) => {
  // No inline <script>: serve JS from /setup/app.js to avoid any encoding/template-literal issues.
  res.type("html").send(`<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>OpenClaw Setup</title>
  <style>
    body { font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial; margin: 2rem; max-width: 900px; }
    .card { border: 1px solid #ddd; border-radius: 12px; padding: 1.25rem; margin: 1rem 0; }
    label { display:block; margin-top: 0.75rem; font-weight: 600; }
    input, select { width: 100%; padding: 0.6rem; margin-top: 0.25rem; }
    button { padding: 0.8rem 1.2rem; border-radius: 10px; border: 0; background: #111; color: #fff; font-weight: 700; cursor: pointer; }
    code { background: #f6f6f6; padding: 0.1rem 0.3rem; border-radius: 6px; }
    .muted { color: #555; }
  </style>
</head>
<body>
  <h1>OpenClaw Setup</h1>
  <p class="muted">This wizard configures OpenClaw by running the same onboarding command it uses in the terminal, but from the browser.</p>

  <div class="card">
    <h2>Status</h2>
    <div id="status">Loading...</div>
    <div id="statusDetails" class="muted" style="margin-top:0.5rem"></div>
    <div style="margin-top: 0.75rem">
      <a href="/openclaw" target="_blank">Open OpenClaw UI</a>
      &nbsp;|&nbsp;
      <a href="/setup/export" target="_blank">Download backup (.tar.gz)</a>
    </div>

    <div style="margin-top: 0.75rem">
      <div class="muted" style="margin-bottom:0.25rem"><strong>Import backup</strong> (advanced): restores into <code>/data</code> and restarts the gateway.</div>
      <input id="importFile" type="file" accept=".tar.gz,application/gzip" />
      <button id="importRun" style="background:#7c2d12; margin-top:0.5rem">Import</button>
      <pre id="importOut" style="white-space:pre-wrap"></pre>
    </div>
  </div>

  <div class="card">
    <h2>Debug console</h2>
    <p class="muted">Run a small allowlist of safe commands (no shell). Useful for debugging and recovery.</p>

    <div style="display:flex; gap:0.5rem; align-items:center">
      <select id="consoleCmd" style="flex: 1">
        <option value="gateway.restart">gateway.restart (wrapper-managed)</option>
        <option value="gateway.stop">gateway.stop (wrapper-managed)</option>
        <option value="gateway.start">gateway.start (wrapper-managed)</option>
        <option value="openclaw.status">openclaw status</option>
        <option value="openclaw.health">openclaw health</option>
        <option value="openclaw.doctor">openclaw doctor</option>
        <option value="openclaw.logs.tail">openclaw logs --tail N</option>
        <option value="openclaw.config.get">openclaw config get &lt;path&gt;</option>
        <option value="openclaw.version">openclaw --version</option>
        <option value="openclaw.devices.list">openclaw devices list</option>
        <option value="openclaw.devices.approve">openclaw devices approve &lt;requestId&gt;</option>
        <option value="openclaw.plugins.list">openclaw plugins list</option>
        <option value="openclaw.plugins.enable">openclaw plugins enable &lt;name&gt;</option>
      </select>
      <input id="consoleArg" placeholder="Optional arg (e.g. 200, gateway.port)" style="flex: 1" />
      <button id="consoleRun" style="background:#0f172a">Run</button>
    </div>
    <pre id="consoleOut" style="white-space:pre-wrap"></pre>
  </div>

  <div class="card">
    <h2>Config editor (advanced)</h2>
    <p class="muted">Edits the full config file on disk (JSON5). Saving creates a timestamped <code>.bak-*</code> backup and restarts the gateway.</p>
    <div class="muted" id="configPath"></div>
    <textarea id="configText" style="width:100%; height: 260px; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;"></textarea>
    <div style="margin-top:0.5rem">
      <button id="configReload" style="background:#1f2937">Reload</button>
      <button id="configSave" style="background:#111; margin-left:0.5rem">Save</button>
    </div>
    <pre id="configOut" style="white-space:pre-wrap"></pre>
  </div>

  <div class="card">
    <h2>1) Model/auth provider</h2>
    <p class="muted">Matches the groups shown in the terminal onboarding.</p>
    <label>Provider group</label>
    <select id="authGroup">
      <option>Loading providers…</option>
    </select>

    <label>Auth method</label>
    <select id="authChoice">
      <option>Loading methods…</option>
    </select>

    <label>Key / Token (if required)</label>
    <input id="authSecret" type="password" placeholder="Paste API key / token if applicable" />

    <label>Wizard flow</label>
    <select id="flow">
      <option value="quickstart">quickstart</option>
      <option value="advanced">advanced</option>
      <option value="manual">manual</option>
    </select>
  </div>

  <div class="card">
    <h2>2) Optional: Channels</h2>
    <p class="muted">You can also add channels later inside OpenClaw, but this helps you get messaging working immediately.</p>

    <label>Telegram bot token (optional)</label>
    <input id="telegramToken" type="password" placeholder="123456:ABC..." />
    <div class="muted" style="margin-top: 0.25rem">
      Get it from BotFather: open Telegram, message <code>@BotFather</code>, run <code>/newbot</code>, then copy the token.
    </div>

    <label>Discord bot token (optional)</label>
    <input id="discordToken" type="password" placeholder="Bot token" />
    <div class="muted" style="margin-top: 0.25rem">
      Get it from the Discord Developer Portal: create an application, add a Bot, then copy the Bot Token.<br/>
      <strong>Important:</strong> Enable <strong>MESSAGE CONTENT INTENT</strong> in Bot → Privileged Gateway Intents, or the bot will crash on startup.
    </div>

    <label>Slack bot token (optional)</label>
    <input id="slackBotToken" type="password" placeholder="xoxb-..." />

    <label>Slack app token (optional)</label>
    <input id="slackAppToken" type="password" placeholder="xapp-..." />
  </div>

  <div class="card">
    <h2>2b) Advanced: Custom OpenAI-compatible provider (optional)</h2>
    <p class="muted">Use this to configure an OpenAI-compatible API that requires a custom base URL (e.g. Ollama, vLLM, LM Studio, hosted proxies). You usually set the API key as a Railway variable and reference it here.</p>

    <label>Provider id (e.g. ollama, deepseek, myproxy)</label>
    <input id="customProviderId" placeholder="ollama" />

    <label>Base URL (must include /v1, e.g. http://host:11434/v1)</label>
    <input id="customProviderBaseUrl" placeholder="http://127.0.0.1:11434/v1" />

    <label>API (openai-completions or openai-responses)</label>
    <select id="customProviderApi">
      <option value="openai-completions">openai-completions</option>
      <option value="openai-responses">openai-responses</option>
    </select>

    <label>API key env var name (optional, e.g. OLLAMA_API_KEY). Leave blank for no key.</label>
    <input id="customProviderApiKeyEnv" placeholder="OLLAMA_API_KEY" />

    <label>Optional model id to register (e.g. llama3.1:8b)</label>
    <input id="customProviderModelId" placeholder="" />
  </div>

  <div class="card">
    <h2>3) Run onboarding</h2>
    <button id="run">Run setup</button>
    <button id="pairingApprove" style="background:#1f2937; margin-left:0.5rem">Approve pairing</button>
    <button id="reset" style="background:#444; margin-left:0.5rem">Reset setup</button>
    <pre id="log" style="white-space:pre-wrap"></pre>
    <p class="muted">Reset deletes the OpenClaw config file so you can rerun onboarding. Pairing approval lets you grant DM access when dmPolicy=pairing.</p>

    <details style="margin-top: 0.75rem">
      <summary><strong>Pairing helper</strong> (for “disconnected (1008): pairing required”)</summary>
      <p class="muted">This lists pending device requests and lets you approve them without SSH.</p>
      <button id="devicesRefresh" style="background:#0f172a">Refresh pending devices</button>
      <div id="devicesList" class="muted" style="margin-top:0.5rem"></div>
    </details>
  </div>

  <script src="/setup/app.js"></script>
</body>
</html>`);
});

const AUTH_GROUPS = [
  { value: "openai", label: "OpenAI", hint: "Codex OAuth + API key", options: [
    { value: "codex-cli", label: "OpenAI Codex OAuth (Codex CLI)" },
    { value: "openai-codex", label: "OpenAI Codex (ChatGPT OAuth)" },
    { value: "openai-api-key", label: "OpenAI API key" }
  ]},
  { value: "anthropic", label: "Anthropic", hint: "Claude Code CLI + API key", options: [
    { value: "claude-cli", label: "Anthropic token (Claude Code CLI)" },
    { value: "token", label: "Anthropic token (paste setup-token)" },
    { value: "apiKey", label: "Anthropic API key" }
  ]},
  { value: "google", label: "Google", hint: "Gemini API key + OAuth", options: [
    { value: "gemini-api-key", label: "Google Gemini API key" },
    { value: "google-antigravity", label: "Google Antigravity OAuth" },
    { value: "google-gemini-cli", label: "Google Gemini CLI OAuth" }
  ]},
  { value: "openrouter", label: "OpenRouter", hint: "API key", options: [
    { value: "openrouter-api-key", label: "OpenRouter API key" }
  ]},
  { value: "ai-gateway", label: "Vercel AI Gateway", hint: "API key", options: [
    { value: "ai-gateway-api-key", label: "Vercel AI Gateway API key" }
  ]},
  { value: "moonshot", label: "Moonshot AI", hint: "Kimi K2 + Kimi Code", options: [
    { value: "moonshot-api-key", label: "Moonshot AI API key" },
    { value: "kimi-code-api-key", label: "Kimi Code API key" }
  ]},
  { value: "zai", label: "Z.AI (GLM 4.7)", hint: "API key", options: [
    { value: "zai-api-key", label: "Z.AI (GLM 4.7) API key" }
  ]},
  { value: "minimax", label: "MiniMax", hint: "M2.1 (recommended)", options: [
    { value: "minimax-api", label: "MiniMax M2.1" },
    { value: "minimax-api-lightning", label: "MiniMax M2.1 Lightning" }
  ]},
  { value: "qwen", label: "Qwen", hint: "OAuth", options: [
    { value: "qwen-portal", label: "Qwen OAuth" }
  ]},
  { value: "copilot", label: "Copilot", hint: "GitHub + local proxy", options: [
    { value: "github-copilot", label: "GitHub Copilot (GitHub device login)" },
    { value: "copilot-proxy", label: "Copilot Proxy (local)" }
  ]},
  { value: "synthetic", label: "Synthetic", hint: "Anthropic-compatible (multi-model)", options: [
    { value: "synthetic-api-key", label: "Synthetic API key" }
  ]},
  { value: "opencode-zen", label: "OpenCode Zen", hint: "API key", options: [
    { value: "opencode-zen", label: "OpenCode Zen (multi-model proxy)" }
  ]}
];

app.get("/setup/api/status", requireSetupAuth, async (_req, res) => {
  const version = await runCmd(OPENCLAW_NODE, clawArgs(["--version"]));
  const channelsHelp = await runCmd(OPENCLAW_NODE, clawArgs(["channels", "add", "--help"]));

  res.json({
    configured: isConfigured(),
    gatewayTarget: GATEWAY_TARGET,
    openclawVersion: version.output.trim(),
    channelsAddHelp: channelsHelp.output,
    authGroups: AUTH_GROUPS,
  });
});

app.get("/setup/api/auth-groups", requireSetupAuth, (_req, res) => {
  res.json({ ok: true, authGroups: AUTH_GROUPS });
});

function buildOnboardArgs(payload) {
  const args = [
    "onboard",
    "--non-interactive",
    "--accept-risk",
    "--json",
    "--no-install-daemon",
    "--skip-health",
    "--workspace",
    WORKSPACE_DIR,
    // The wrapper owns public networking; keep the gateway internal.
    "--gateway-bind",
    "loopback",
    "--gateway-port",
    String(INTERNAL_GATEWAY_PORT),
    "--gateway-auth",
    "token",
    "--gateway-token",
    OPENCLAW_GATEWAY_TOKEN,
    "--flow",
    payload.flow || "quickstart",
  ];

  if (payload.authChoice) {
    args.push("--auth-choice", payload.authChoice);

    // Map secret to correct flag for common choices.
    const secret = (payload.authSecret || "").trim();
    const map = {
      "openai-api-key": "--openai-api-key",
      "apiKey": "--anthropic-api-key",
      "openrouter-api-key": "--openrouter-api-key",
      "ai-gateway-api-key": "--ai-gateway-api-key",
      "moonshot-api-key": "--moonshot-api-key",
      "kimi-code-api-key": "--kimi-code-api-key",
      "gemini-api-key": "--gemini-api-key",
      "zai-api-key": "--zai-api-key",
      "minimax-api": "--minimax-api-key",
      "minimax-api-lightning": "--minimax-api-key",
      "synthetic-api-key": "--synthetic-api-key",
      "opencode-zen": "--opencode-zen-api-key",
    };

    const flag = map[payload.authChoice];

    // If the user picked an API-key auth choice but didn't provide a secret, fail fast.
    // Otherwise OpenClaw may fall back to its default auth choice, which looks like the
    // wizard "reverted" their selection.
    if (flag && !secret) {
      throw new Error(`Missing auth secret for authChoice=${payload.authChoice}`);
    }

    if (flag) {
      args.push(flag, secret);
    }

    if (payload.authChoice === "token") {
      // This is the Anthropic setup-token flow.
      if (!secret) throw new Error("Missing auth secret for authChoice=token");
      args.push("--token-provider", "anthropic", "--token", secret);
    }
  }

  return args;
}

function runCmd(cmd, args, opts = {}) {
  return new Promise((resolve) => {
    const timeoutMs = Number.isFinite(opts.timeoutMs) ? opts.timeoutMs : 120_000;

    const proc = childProcess.spawn(cmd, args, {
      ...opts,
      env: {
        ...process.env,
        OPENCLAW_STATE_DIR: STATE_DIR,
        OPENCLAW_WORKSPACE_DIR: WORKSPACE_DIR,
      },
    });

    let out = "";
    proc.stdout?.on("data", (d) => (out += d.toString("utf8")));
    proc.stderr?.on("data", (d) => (out += d.toString("utf8")));

    let killTimer;
    const timer = setTimeout(() => {
      try { proc.kill("SIGTERM"); } catch {}
      killTimer = setTimeout(() => {
        try { proc.kill("SIGKILL"); } catch {}
      }, 2_000);
      out += `\n[timeout] Command exceeded ${timeoutMs}ms and was terminated.\n`;
      resolve({ code: 124, output: out });
    }, timeoutMs);

    proc.on("error", (err) => {
      clearTimeout(timer);
      if (killTimer) clearTimeout(killTimer);
      out += `\n[spawn error] ${String(err)}\n`;
      resolve({ code: 127, output: out });
    });

    proc.on("close", (code) => {
      clearTimeout(timer);
      if (killTimer) clearTimeout(killTimer);
      resolve({ code: code ?? 0, output: out });
    });
  });
}

app.post("/setup/api/run", requireSetupAuth, async (req, res) => {
  try {
    const respondJson = (status, body) => {
      if (res.writableEnded || res.headersSent) return;
      res.status(status).json(body);
    };
    if (isConfigured()) {
      await ensureGatewayRunning();
      return respondJson(200, {
        ok: true,
        output: "Already configured.\nUse Reset setup if you want to rerun onboarding.\n",
      });
    }

    fs.mkdirSync(STATE_DIR, { recursive: true });
    fs.mkdirSync(WORKSPACE_DIR, { recursive: true });

    const payload = req.body || {};

    let onboardArgs;
    try {
      onboardArgs = buildOnboardArgs(payload);
    } catch (err) {
      return respondJson(400, { ok: false, output: `Setup input error: ${String(err)}` });
    }

    const prefix = "[setup] running openclaw onboard...\n";
    const onboard = await runCmd(OPENCLAW_NODE, clawArgs(onboardArgs));

  let extra = "";

  const ok = onboard.code === 0 && isConfigured();

  // Optional setup (only after successful onboarding).
  if (ok) {
    // Ensure gateway token is written into config so the browser UI can authenticate reliably.
    // (We also enforce loopback bind since the wrapper proxies externally.)
    // IMPORTANT: Set both gateway.auth.token (server-side) and gateway.remote.token (client-side)
    // to the same value so the Control UI can connect without "token mismatch" errors.
    await runCmd(OPENCLAW_NODE, clawArgs(["config", "set", "gateway.auth.mode", "token"]));
    await runCmd(OPENCLAW_NODE, clawArgs(["config", "set", "gateway.auth.token", OPENCLAW_GATEWAY_TOKEN]));
    await runCmd(OPENCLAW_NODE, clawArgs(["config", "set", "gateway.remote.token", OPENCLAW_GATEWAY_TOKEN]));
    await runCmd(OPENCLAW_NODE, clawArgs(["config", "set", "gateway.bind", "loopback"]));
    await runCmd(OPENCLAW_NODE, clawArgs(["config", "set", "gateway.port", String(INTERNAL_GATEWAY_PORT)]));

    // Railway runs behind a reverse proxy. Trust loopback as a proxy hop so local client detection
    // remains correct when X-Forwarded-* headers are present.
    await runCmd(
      OPENCLAW_NODE,
      clawArgs(["config", "set", "--json", "gateway.trustedProxies", JSON.stringify(["127.0.0.1"]) ]),
    );

    // Optional: configure a custom OpenAI-compatible provider (base URL) for advanced users.
    if (payload.customProviderId?.trim() && payload.customProviderBaseUrl?.trim()) {
      const providerId = payload.customProviderId.trim();
      const baseUrl = payload.customProviderBaseUrl.trim();
      const api = (payload.customProviderApi || "openai-completions").trim();
      const apiKeyEnv = (payload.customProviderApiKeyEnv || "").trim();
      const modelId = (payload.customProviderModelId || "").trim();

      if (!/^[A-Za-z0-9_-]+$/.test(providerId)) {
        extra += `\n[custom provider] skipped: invalid provider id (use letters/numbers/_/-)`;
      } else if (!/^https?:\/\//.test(baseUrl)) {
        extra += `\n[custom provider] skipped: baseUrl must start with http(s)://`;
      } else if (api !== "openai-completions" && api !== "openai-responses") {
        extra += `\n[custom provider] skipped: api must be openai-completions or openai-responses`;
      } else if (apiKeyEnv && !/^[A-Za-z_][A-Za-z0-9_]*$/.test(apiKeyEnv)) {
        extra += `\n[custom provider] skipped: invalid api key env var name`;
      } else {
        const providerCfg = {
          baseUrl,
          api,
          apiKey: apiKeyEnv ? "${" + apiKeyEnv + "}" : undefined,
          models: modelId ? [{ id: modelId, name: modelId }] : undefined,
        };

        // Ensure we merge in this provider rather than replacing other providers.
        await runCmd(OPENCLAW_NODE, clawArgs(["config", "set", "models.mode", "merge"]));
        const set = await runCmd(
          OPENCLAW_NODE,
          clawArgs(["config", "set", "--json", `models.providers.${providerId}`, JSON.stringify(providerCfg)]),
        );
        extra += `\n[custom provider] exit=${set.code} (output ${set.output.length} chars)\n${set.output || "(no output)"}`;
      }
    }

    const channelsHelp = await runCmd(OPENCLAW_NODE, clawArgs(["channels", "add", "--help"]));
    const helpText = channelsHelp.output || "";

    const supports = (name) => helpText.includes(name);

    if (payload.telegramToken?.trim()) {
      if (!supports("telegram")) {
        extra += "\n[telegram] skipped (this openclaw build does not list telegram in `channels add --help`)\n";
      } else {
        // Avoid `channels add` here (it has proven flaky across builds); write config directly.
        const token = payload.telegramToken.trim();
        const cfgObj = {
          enabled: true,
          dmPolicy: "pairing",
          botToken: token,
          groupPolicy: "allowlist",
          streamMode: "partial",
        };
        const set = await runCmd(
          OPENCLAW_NODE,
          clawArgs(["config", "set", "--json", "channels.telegram", JSON.stringify(cfgObj)]),
        );
        const get = await runCmd(OPENCLAW_NODE, clawArgs(["config", "get", "channels.telegram"]));

        // Best-effort: enable the telegram plugin explicitly (some builds require this even when configured).
        const plug = await runCmd(OPENCLAW_NODE, clawArgs(["plugins", "enable", "telegram"]));

        extra += `\n[telegram config] exit=${set.code} (output ${set.output.length} chars)\n${set.output || "(no output)"}`;
        extra += `\n[telegram verify] exit=${get.code} (output ${get.output.length} chars)\n${get.output || "(no output)"}`;
        extra += `\n[telegram plugin enable] exit=${plug.code} (output ${plug.output.length} chars)\n${plug.output || "(no output)"}`;
      }
    }

    if (payload.discordToken?.trim()) {
      if (!supports("discord")) {
        extra += "\n[discord] skipped (this openclaw build does not list discord in `channels add --help`)\n";
      } else {
        const token = payload.discordToken.trim();
        const cfgObj = {
          enabled: true,
          token,
          groupPolicy: "allowlist",
          dm: {
            policy: "pairing",
          },
        };
        const set = await runCmd(
          OPENCLAW_NODE,
          clawArgs(["config", "set", "--json", "channels.discord", JSON.stringify(cfgObj)]),
        );
        const get = await runCmd(OPENCLAW_NODE, clawArgs(["config", "get", "channels.discord"]));
        extra += `\n[discord config] exit=${set.code} (output ${set.output.length} chars)\n${set.output || "(no output)"}`;
        extra += `\n[discord verify] exit=${get.code} (output ${get.output.length} chars)\n${get.output || "(no output)"}`;
      }
    }

    if (payload.slackBotToken?.trim() || payload.slackAppToken?.trim()) {
      if (!supports("slack")) {
        extra += "\n[slack] skipped (this openclaw build does not list slack in `channels add --help`)\n";
      } else {
        const cfgObj = {
          enabled: true,
          botToken: payload.slackBotToken?.trim() || undefined,
          appToken: payload.slackAppToken?.trim() || undefined,
        };
        const set = await runCmd(
          OPENCLAW_NODE,
          clawArgs(["config", "set", "--json", "channels.slack", JSON.stringify(cfgObj)]),
        );
        const get = await runCmd(OPENCLAW_NODE, clawArgs(["config", "get", "channels.slack"]));
        extra += `\n[slack config] exit=${set.code} (output ${set.output.length} chars)\n${set.output || "(no output)"}`;
        extra += `\n[slack verify] exit=${get.code} (output ${get.output.length} chars)\n${get.output || "(no output)"}`;
      }
    }

    // Apply changes immediately.
    await restartGateway();

    // Ensure OpenClaw applies any "configured but not enabled" channel/plugin changes.
    // This makes Telegram/Discord pairing issues much less "silent".
    const fix = await runCmd(OPENCLAW_NODE, clawArgs(["doctor", "--fix"]));
    extra += `\n[doctor --fix] exit=${fix.code} (output ${fix.output.length} chars)\n${fix.output || "(no output)"}`;

    // Doctor may require a restart depending on changes.
    await restartGateway();
  }

  return respondJson(ok ? 200 : 500, {
    ok,
    output: `${prefix}${onboard.output}${extra}`,
  });
  } catch (err) {
    console.error("[/setup/api/run] error:", err);
    return respondJson(500, { ok: false, output: `Internal error: ${String(err)}` });
  }
});

app.get("/setup/api/debug", requireSetupAuth, async (_req, res) => {
  const v = await runCmd(OPENCLAW_NODE, clawArgs(["--version"]));
  const help = await runCmd(OPENCLAW_NODE, clawArgs(["channels", "add", "--help"]));

  // Channel config checks (redact secrets before returning to client)
  const tg = await runCmd(OPENCLAW_NODE, clawArgs(["config", "get", "channels.telegram"]));
  const dc = await runCmd(OPENCLAW_NODE, clawArgs(["config", "get", "channels.discord"]));

  const tgOut = redactSecrets(tg.output || "");
  const dcOut = redactSecrets(dc.output || "");

  res.json({
    wrapper: {
      node: process.version,
      port: PORT,
      publicPortEnv: process.env.PORT || null,
      stateDir: STATE_DIR,
      workspaceDir: WORKSPACE_DIR,
      configured: isConfigured(),
      configPathResolved: configPath(),
      configPathCandidates: typeof resolveConfigCandidates === "function" ? resolveConfigCandidates() : null,
      internalGatewayHost: INTERNAL_GATEWAY_HOST,
      internalGatewayPort: INTERNAL_GATEWAY_PORT,
      gatewayTarget: GATEWAY_TARGET,
      gatewayRunning: Boolean(gatewayProc),
      gatewayTokenFromEnv: Boolean(process.env.OPENCLAW_GATEWAY_TOKEN?.trim()),
      gatewayTokenPersisted: fs.existsSync(path.join(STATE_DIR, "gateway.token")),
      lastGatewayError,
      lastGatewayExit,
      lastDoctorAt,
      lastDoctorOutput,
      railwayCommit: process.env.RAILWAY_GIT_COMMIT_SHA || null,
    },
    openclaw: {
      entry: OPENCLAW_ENTRY,
      node: OPENCLAW_NODE,
      version: v.output.trim(),
      channelsAddHelpIncludesTelegram: help.output.includes("telegram"),
      channels: {
        telegram: {
          exit: tg.code,
          configuredEnabled: /"enabled"\s*:\s*true/.test(tg.output || "") || /enabled\s*[:=]\s*true/.test(tg.output || ""),
          botTokenPresent: /(\d{5,}:[A-Za-z0-9_-]{10,})/.test(tg.output || ""),
          output: tgOut,
        },
        discord: {
          exit: dc.code,
          configuredEnabled: /"enabled"\s*:\s*true/.test(dc.output || "") || /enabled\s*[:=]\s*true/.test(dc.output || ""),
          tokenPresent: /"token"\s*:\s*"?\S+"?/.test(dc.output || "") || /token\s*[:=]\s*\S+/.test(dc.output || ""),
          output: dcOut,
        },
      },
    },
  });
});

// --- Debug console (Option A: allowlisted commands + config editor) ---

function redactSecrets(text) {
  if (!text) return text;
  // Very small best-effort redaction. (Config paths/values may still contain secrets.)
  return String(text)
    .replace(/(sk-[A-Za-z0-9_-]{10,})/g, "[REDACTED]")
    .replace(/(gho_[A-Za-z0-9_]{10,})/g, "[REDACTED]")
    .replace(/(xox[baprs]-[A-Za-z0-9-]{10,})/g, "[REDACTED]")
    // Telegram bot tokens look like: 123456:ABCDEF...
    .replace(/(\d{5,}:[A-Za-z0-9_-]{10,})/g, "[REDACTED]")
    .replace(/(AA[A-Za-z0-9_-]{10,}:\S{10,})/g, "[REDACTED]");
}

function extractDeviceRequestIds(text) {
  const s = String(text || "");
  const out = new Set();

  for (const m of s.matchAll(/requestId\s*(?:=|:)\s*([A-Za-z0-9_-]{6,})/g)) out.add(m[1]);
  for (const m of s.matchAll(/"requestId"\s*:\s*"([A-Za-z0-9_-]{6,})"/g)) out.add(m[1]);

  return Array.from(out);
}

const ALLOWED_CONSOLE_COMMANDS = new Set([
  // Wrapper-managed lifecycle
  "gateway.restart",
  "gateway.stop",
  "gateway.start",

  // OpenClaw CLI helpers
  "openclaw.version",
  "openclaw.status",
  "openclaw.health",
  "openclaw.doctor",
  "openclaw.logs.tail",
  "openclaw.config.get",

  // Device management (for fixing "disconnected (1008): pairing required")
  "openclaw.devices.list",
  "openclaw.devices.approve",

  // Plugin management
  "openclaw.plugins.list",
  "openclaw.plugins.enable",
]);

app.post("/setup/api/console/run", requireSetupAuth, async (req, res) => {
  const payload = req.body || {};
  const cmd = String(payload.cmd || "").trim();
  const arg = String(payload.arg || "").trim();

  if (!ALLOWED_CONSOLE_COMMANDS.has(cmd)) {
    return res.status(400).json({ ok: false, error: "Command not allowed" });
  }

  try {
    if (cmd === "gateway.restart") {
      await restartGateway();
      return res.json({ ok: true, output: "Gateway restarted (wrapper-managed).\n" });
    }
    if (cmd === "gateway.stop") {
      if (gatewayProc) {
        try { gatewayProc.kill("SIGTERM"); } catch {}
        await sleep(750);
        gatewayProc = null;
      }
      return res.json({ ok: true, output: "Gateway stopped (wrapper-managed).\n" });
    }
    if (cmd === "gateway.start") {
      const r = await ensureGatewayRunning();
      return res.json({ ok: Boolean(r.ok), output: r.ok ? "Gateway started.\n" : `Gateway not started: ${r.reason}\n` });
    }

    if (cmd === "openclaw.version") {
      const r = await runCmd(OPENCLAW_NODE, clawArgs(["--version"]));
      return res.status(r.code === 0 ? 200 : 500).json({ ok: r.code === 0, output: redactSecrets(r.output) });
    }
    if (cmd === "openclaw.status") {
      const r = await runCmd(OPENCLAW_NODE, clawArgs(["status"]));
      return res.status(r.code === 0 ? 200 : 500).json({ ok: r.code === 0, output: redactSecrets(r.output) });
    }
    if (cmd === "openclaw.health") {
      const r = await runCmd(OPENCLAW_NODE, clawArgs(["health"]));
      return res.status(r.code === 0 ? 200 : 500).json({ ok: r.code === 0, output: redactSecrets(r.output) });
    }
    if (cmd === "openclaw.doctor") {
      const r = await runCmd(OPENCLAW_NODE, clawArgs(["doctor"]));
      return res.status(r.code === 0 ? 200 : 500).json({ ok: r.code === 0, output: redactSecrets(r.output) });
    }
    if (cmd === "openclaw.logs.tail") {
      const lines = Math.max(50, Math.min(1000, Number.parseInt(arg || "200", 10) || 200));
      const r = await runCmd(OPENCLAW_NODE, clawArgs(["logs", "--tail", String(lines)]));
      return res.status(r.code === 0 ? 200 : 500).json({ ok: r.code === 0, output: redactSecrets(r.output) });
    }
    if (cmd === "openclaw.config.get") {
      if (!arg) return res.status(400).json({ ok: false, error: "Missing config path" });
      const r = await runCmd(OPENCLAW_NODE, clawArgs(["config", "get", arg]));
      return res.status(r.code === 0 ? 200 : 500).json({ ok: r.code === 0, output: redactSecrets(r.output) });
    }

    // Device management commands (for fixing "disconnected (1008): pairing required")
    if (cmd === "openclaw.devices.list") {
      const r = await runCmd(OPENCLAW_NODE, clawArgs(["devices", "list"]));
      return res.status(r.code === 0 ? 200 : 500).json({ ok: r.code === 0, output: redactSecrets(r.output) });
    }
    if (cmd === "openclaw.devices.approve") {
      const requestId = String(arg || "").trim();
      if (!requestId) {
        return res.status(400).json({ ok: false, error: "Missing device request ID" });
      }
      if (!/^[A-Za-z0-9_-]+$/.test(requestId)) {
        return res.status(400).json({ ok: false, error: "Invalid device request ID" });
      }
      const r = await runCmd(OPENCLAW_NODE, clawArgs(["devices", "approve", requestId]));
      return res.status(r.code === 0 ? 200 : 500).json({ ok: r.code === 0, output: redactSecrets(r.output) });
    }

    // Plugin management commands
    if (cmd === "openclaw.plugins.list") {
      const r = await runCmd(OPENCLAW_NODE, clawArgs(["plugins", "list"]));
      return res.status(r.code === 0 ? 200 : 500).json({ ok: r.code === 0, output: redactSecrets(r.output) });
    }
    if (cmd === "openclaw.plugins.enable") {
      const name = String(arg || "").trim();
      if (!name) return res.status(400).json({ ok: false, error: "Missing plugin name" });
      if (!/^[A-Za-z0-9_-]+$/.test(name)) return res.status(400).json({ ok: false, error: "Invalid plugin name" });
      const r = await runCmd(OPENCLAW_NODE, clawArgs(["plugins", "enable", name]));
      return res.status(r.code === 0 ? 200 : 500).json({ ok: r.code === 0, output: redactSecrets(r.output) });
    }

    return res.status(400).json({ ok: false, error: "Unhandled command" });
  } catch (err) {
    return res.status(500).json({ ok: false, error: String(err) });
  }
});

app.get("/setup/api/config/raw", requireSetupAuth, async (_req, res) => {
  try {
    const p = configPath();
    const exists = fs.existsSync(p);
    const content = exists ? fs.readFileSync(p, "utf8") : "";
    res.json({ ok: true, path: p, exists, content });
  } catch (err) {
    res.status(500).json({ ok: false, error: String(err) });
  }
});

app.post("/setup/api/config/raw", requireSetupAuth, async (req, res) => {
  try {
    const content = String((req.body && req.body.content) || "");
    if (content.length > 500_000) {
      return res.status(413).json({ ok: false, error: "Config too large" });
    }

    fs.mkdirSync(STATE_DIR, { recursive: true });

    const p = configPath();
    // Backup
    if (fs.existsSync(p)) {
      const backupPath = `${p}.bak-${new Date().toISOString().replace(/[:.]/g, "-")}`;
      fs.copyFileSync(p, backupPath);
    }

    fs.writeFileSync(p, content, { encoding: "utf8", mode: 0o600 });

    // Apply immediately.
    if (isConfigured()) {
      await restartGateway();
    }

    res.json({ ok: true, path: p });
  } catch (err) {
    res.status(500).json({ ok: false, error: String(err) });
  }
});

app.post("/setup/api/pairing/approve", requireSetupAuth, async (req, res) => {
  const { channel, code } = req.body || {};
  if (!channel || !code) {
    return res.status(400).json({ ok: false, error: "Missing channel or code" });
  }
  const r = await runCmd(OPENCLAW_NODE, clawArgs(["pairing", "approve", String(channel), String(code)]));
  return res.status(r.code === 0 ? 200 : 500).json({ ok: r.code === 0, output: r.output });
});

// Device pairing helper (list + approve) to avoid needing SSH.
app.get("/setup/api/devices/pending", requireSetupAuth, async (_req, res) => {
  const r = await runCmd(OPENCLAW_NODE, clawArgs(["devices", "list"]));
  const output = redactSecrets(r.output);
  const requestIds = extractDeviceRequestIds(output);
  return res.status(r.code === 0 ? 200 : 500).json({ ok: r.code === 0, requestIds, output });
});

app.post("/setup/api/devices/approve", requireSetupAuth, async (req, res) => {
  const requestId = String((req.body && req.body.requestId) || "").trim();
  if (!requestId) return res.status(400).json({ ok: false, error: "Missing device request ID" });
  if (!/^[A-Za-z0-9_-]+$/.test(requestId)) return res.status(400).json({ ok: false, error: "Invalid device request ID" });
  const r = await runCmd(OPENCLAW_NODE, clawArgs(["devices", "approve", requestId]));
  return res.status(r.code === 0 ? 200 : 500).json({ ok: r.code === 0, output: redactSecrets(r.output) });
});

app.post("/setup/api/reset", requireSetupAuth, async (_req, res) => {
  // Reset: stop gateway (frees memory) + delete config file(s) so /setup can rerun.
  // Keep credentials/sessions/workspace by default.
  try {
    // Stop gateway to avoid running gateway + onboard concurrently on small Railway instances.
    try {
      if (gatewayProc) {
        try { gatewayProc.kill("SIGTERM"); } catch {}
        await sleep(750);
        gatewayProc = null;
      }
    } catch {
      // ignore
    }

    const candidates = typeof resolveConfigCandidates === "function" ? resolveConfigCandidates() : [configPath()];
    for (const p of candidates) {
      try { fs.rmSync(p, { force: true }); } catch {}
    }

    res.type("text/plain").send("OK - stopped gateway and deleted config file(s). You can rerun setup now.");
  } catch (err) {
    res.status(500).type("text/plain").send(String(err));
  }
});

app.get("/setup/export", requireSetupAuth, async (_req, res) => {
  fs.mkdirSync(STATE_DIR, { recursive: true });
  fs.mkdirSync(WORKSPACE_DIR, { recursive: true });

  res.setHeader("content-type", "application/gzip");
  res.setHeader(
    "content-disposition",
    `attachment; filename="openclaw-backup-${new Date().toISOString().replace(/[:.]/g, "-")}.tar.gz"`,
  );

  // Prefer exporting from a common /data root so archives are easy to inspect and restore.
  // This preserves dotfiles like /data/.openclaw/openclaw.json.
  const stateAbs = path.resolve(STATE_DIR);
  const workspaceAbs = path.resolve(WORKSPACE_DIR);

  const dataRoot = "/data";
  const underData = (p) => p === dataRoot || p.startsWith(dataRoot + path.sep);

  let cwd = "/";
  let paths = [stateAbs, workspaceAbs].map((p) => p.replace(/^\//, ""));

  if (underData(stateAbs) && underData(workspaceAbs)) {
    cwd = dataRoot;
    // We export relative to /data so the archive contains: .openclaw/... and workspace/...
    paths = [
      path.relative(dataRoot, stateAbs) || ".",
      path.relative(dataRoot, workspaceAbs) || ".",
    ];
  }

  const stream = tar.c(
    {
      gzip: true,
      portable: true,
      noMtime: true,
      cwd,
      onwarn: () => {},
    },
    paths,
  );

  stream.on("error", (err) => {
    console.error("[export]", err);
    if (!res.headersSent) res.status(500);
    res.end(String(err));
  });

  stream.pipe(res);
});

function isUnderDir(p, root) {
  const abs = path.resolve(p);
  const r = path.resolve(root);
  return abs === r || abs.startsWith(r + path.sep);
}

function looksSafeTarPath(p) {
  if (!p) return false;
  // tar paths always use / separators
  if (p.startsWith("/") || p.startsWith("\\")) return false;
  // windows drive letters
  if (/^[A-Za-z]:[\\/]/.test(p)) return false;
  // path traversal
  if (p.split("/").includes("..")) return false;
  return true;
}

async function readBodyBuffer(req, maxBytes) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let total = 0;
    req.on("data", (chunk) => {
      total += chunk.length;
      if (total > maxBytes) {
        reject(new Error("payload too large"));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

// Import a backup created by /setup/export.
// This is intentionally limited to restoring into /data to avoid overwriting arbitrary host paths.
app.post("/setup/import", requireSetupAuth, async (req, res) => {
  try {
    const dataRoot = "/data";
    if (!isUnderDir(STATE_DIR, dataRoot) || !isUnderDir(WORKSPACE_DIR, dataRoot)) {
      return res
        .status(400)
        .type("text/plain")
        .send("Import is only supported when OPENCLAW_STATE_DIR and OPENCLAW_WORKSPACE_DIR are under /data (Railway volume).\n");
    }

    // Stop gateway before restore so we don't overwrite live files.
    if (gatewayProc) {
      try { gatewayProc.kill("SIGTERM"); } catch {}
      await sleep(750);
      gatewayProc = null;
    }

    const buf = await readBodyBuffer(req, 250 * 1024 * 1024); // 250MB max
    if (!buf.length) return res.status(400).type("text/plain").send("Empty body\n");

    // Extract into /data.
    // We only allow safe relative paths, and we intentionally do NOT delete existing files.
    // (Users can reset/redeploy or manually clean the volume if desired.)
    const tmpPath = path.join(os.tmpdir(), `openclaw-import-${Date.now()}.tar.gz`);
    fs.writeFileSync(tmpPath, buf);

    await tar.x({
      file: tmpPath,
      cwd: dataRoot,
      gzip: true,
      strict: true,
      onwarn: () => {},
      filter: (p) => {
        // Allow only paths that look safe.
        return looksSafeTarPath(p);
      },
    });

    try { fs.rmSync(tmpPath, { force: true }); } catch {}

    // Restart gateway after restore.
    if (isConfigured()) {
      await restartGateway();
    }

    res.type("text/plain").send("OK - imported backup into /data and restarted gateway.\n");
  } catch (err) {
    console.error("[import]", err);
    res.status(500).type("text/plain").send(String(err));
  }
});

// --- Mission Control Dashboard ---
// Serves the dashboard SPA and provides a file API for reading project data.
// Look for dashboard dist in the app directory first (deployed via template),
// then fall back to the state directory (manually placed).
const DASHBOARD_DIR = fs.existsSync(path.resolve(import.meta.dirname, "..", "dashboard", "dist"))
  ? path.resolve(import.meta.dirname, "..", "dashboard", "dist")
  : path.join(STATE_DIR, "dashboard", "dist");
const PROJECTS_ALLOWED_PREFIXES = ["shared/", "workspace"];

// File API: read files from the OpenClaw state directory.
// Only allows paths under approved prefixes to prevent directory traversal.
app.get("/mc/api/files", requireSetupAuth, (req, res) => {
  const filePath = req.query.path;
  if (!filePath || typeof filePath !== "string") {
    return res.status(400).json({ error: "Missing ?path= parameter" });
  }
  // Block directory traversal
  const normalized = path.normalize(filePath);
  if (normalized.includes("..") || path.isAbsolute(normalized)) {
    return res.status(403).json({ error: "Path traversal not allowed" });
  }
  // Only allow approved prefixes
  if (!PROJECTS_ALLOWED_PREFIXES.some((p) => normalized.startsWith(p))) {
    return res.status(403).json({ error: "Path not in allowed scope" });
  }
  const fullPath = path.join(STATE_DIR, normalized);
  if (!fs.existsSync(fullPath)) {
    return res.status(404).json({ error: "File not found" });
  }
  const stat = fs.statSync(fullPath);
  if (stat.isDirectory()) {
    // Return directory listing
    const entries = fs.readdirSync(fullPath, { withFileTypes: true }).map((e) => ({
      name: e.name,
      type: e.isDirectory() ? "directory" : "file",
    }));
    return res.json({ type: "directory", entries });
  }
  // Return file contents
  const content = fs.readFileSync(fullPath, "utf8");
  if (fullPath.endsWith(".json")) {
    try {
      return res.json({ type: "file", content: JSON.parse(content) });
    } catch {
      return res.json({ type: "file", content });
    }
  }
  return res.json({ type: "file", content });
});

// File API: write files to the OpenClaw state directory.
app.post("/mc/api/files", requireSetupAuth, (req, res) => {
  const filePath = req.query.path;
  if (!filePath || typeof filePath !== "string") {
    return res.status(400).json({ error: "Missing ?path= parameter" });
  }
  const normalized = path.normalize(filePath);
  if (normalized.includes("..") || path.isAbsolute(normalized)) {
    return res.status(403).json({ error: "Path traversal not allowed" });
  }
  if (!PROJECTS_ALLOWED_PREFIXES.some((p) => normalized.startsWith(p))) {
    return res.status(403).json({ error: "Path not in allowed scope" });
  }
  const { content } = req.body;
  if (content === undefined || content === null) {
    return res.status(400).json({ error: "Missing content in request body" });
  }
  const fullPath = path.join(STATE_DIR, normalized);
  fs.mkdirSync(path.dirname(fullPath), { recursive: true });
  fs.writeFileSync(fullPath, typeof content === "string" ? content : JSON.stringify(content, null, 2), "utf8");
  return res.json({ ok: true, path: normalized });
});

// File API: delete files from the OpenClaw state directory.
app.delete("/mc/api/files", requireSetupAuth, (req, res) => {
  const filePath = req.query.path;
  if (!filePath || typeof filePath !== "string") {
    return res.status(400).json({ error: "Missing ?path= parameter" });
  }
  const normalized = path.normalize(filePath);
  if (normalized.includes("..") || path.isAbsolute(normalized)) {
    return res.status(403).json({ error: "Path traversal not allowed" });
  }
  if (!PROJECTS_ALLOWED_PREFIXES.some((p) => normalized.startsWith(p))) {
    return res.status(403).json({ error: "Path not in allowed scope" });
  }
  const fullPath = path.join(STATE_DIR, normalized);
  if (!fs.existsSync(fullPath)) {
    return res.status(404).json({ error: "File not found" });
  }
  fs.unlinkSync(fullPath);
  return res.json({ ok: true, deleted: normalized });
});

// Helper: find program.md for an experiment-start approval
function findExperimentProgram(projectsDir, projectName, approvalData) {
  const expDir = path.join(projectsDir, projectName, "experiments");
  if (!fs.existsSync(expDir)) return null;

  // If the approval has an explicit experiment_path, use it directly
  if (approvalData.experiment_path) {
    const programPath = path.join(projectsDir, projectName, approvalData.experiment_path, "program.md");
    if (fs.existsSync(programPath)) {
      try { return fs.readFileSync(programPath, "utf8"); } catch { return null; }
    }
  }

  // Otherwise, find the most recent experiment directory (highest exp-NNN)
  try {
    const entries = fs.readdirSync(expDir, { withFileTypes: true })
      .filter((e) => e.isDirectory())
      .sort((a, b) => b.name.localeCompare(a.name)); // descending — most recent first
    for (const entry of entries) {
      const programPath = path.join(expDir, entry.name, "program.md");
      if (fs.existsSync(programPath)) {
        try { return fs.readFileSync(programPath, "utf8"); } catch { /* skip */ }
      }
    }
  } catch { /* skip */ }
  return null;
}

// Get single approval by ID
app.get("/mc/api/approvals/:id", requireSetupAuth, (req, res) => {
  const { id } = req.params;

  // Search project-format approvals (pending + resolved)
  const projectsDir = path.join(STATE_DIR, "shared", "projects");
  if (fs.existsSync(projectsDir)) {
    const projects = fs.readdirSync(projectsDir, { withFileTypes: true }).filter((e) => e.isDirectory());
    for (const proj of projects) {
      // Check pending
      const pendingPath = path.join(projectsDir, proj.name, "approvals", "pending", `${id}.json`);
      if (fs.existsSync(pendingPath)) {
        try {
          const raw = fs.readFileSync(pendingPath, "utf8");
          const data = JSON.parse(raw);
          if (data.status === "resolved") {
            // It's a tombstone — look in resolved
            const resolvedPath = path.join(projectsDir, proj.name, "approvals", "resolved", `${id}.json`);
            if (fs.existsSync(resolvedPath)) {
              const resolvedRaw = fs.readFileSync(resolvedPath, "utf8");
              const resolvedData = JSON.parse(resolvedRaw);
              return res.json({ ...resolvedData, _project: proj.name });
            }
          }
          const enriched = { ...data, _project: proj.name };
          // If experiment gate, attach program.md content and resolve theme/metric names
          if (data.gate === "experiment-start" || data.gate === "autoresearch-start") {
            const programMd = findExperimentProgram(projectsDir, proj.name, data);
            if (programMd) enriched.programMd = programMd;
            // Resolve theme title and proxy metric names for new-format experiments
            if (data.theme) {
              const themePath = path.join(projectsDir, proj.name, "themes", `${data.theme}.json`);
              if (fs.existsSync(themePath)) {
                try {
                  const theme = JSON.parse(fs.readFileSync(themePath, "utf8"));
                  enriched.theme_title = theme.title || data.theme;
                  if (Array.isArray(data.proxy_metrics) && Array.isArray(theme.proxy_metrics)) {
                    enriched.proxy_metrics = data.proxy_metrics.map((pm) => {
                      const pmId = typeof pm === "string" ? pm : pm.id;
                      const found = theme.proxy_metrics.find((t) => t.id === pmId);
                      return {
                        id: pmId,
                        name: found ? found.name : pmId,
                        target: typeof pm === "object" ? pm.target : null,
                      };
                    });
                  }
                } catch { /* skip theme resolution */ }
              }
            }
          }
          return res.json(enriched);
        } catch { /* skip */ }
      }
      // Check resolved
      const resolvedPath = path.join(projectsDir, proj.name, "approvals", "resolved", `${id}.json`);
      if (fs.existsSync(resolvedPath)) {
        try {
          const raw = fs.readFileSync(resolvedPath, "utf8");
          const data = JSON.parse(raw);
          const enriched = { ...data, _project: proj.name };
          if (data.gate === "experiment-start" || data.gate === "autoresearch-start") {
            const programMd = findExperimentProgram(projectsDir, proj.name, data);
            if (programMd) enriched.programMd = programMd;
            if (data.theme) {
              const themePath = path.join(projectsDir, proj.name, "themes", `${data.theme}.json`);
              if (fs.existsSync(themePath)) {
                try {
                  const theme = JSON.parse(fs.readFileSync(themePath, "utf8"));
                  enriched.theme_title = theme.title || data.theme;
                  if (Array.isArray(data.proxy_metrics) && Array.isArray(theme.proxy_metrics)) {
                    enriched.proxy_metrics = data.proxy_metrics.map((pm) => {
                      const pmId = typeof pm === "string" ? pm : pm.id;
                      const found = theme.proxy_metrics.find((t) => t.id === pmId);
                      return {
                        id: pmId,
                        name: found ? found.name : pmId,
                        target: typeof pm === "object" ? pm.target : null,
                      };
                    });
                  }
                } catch { /* skip theme resolution */ }
              }
            }
          }
          return res.json(enriched);
        } catch { /* skip */ }
      }
    }
  }

  // Check deliverables
  const indexPath = path.join(STATE_DIR, "shared", "output", "index.json");
  if (fs.existsSync(indexPath)) {
    try {
      const indexRaw = fs.readFileSync(indexPath, "utf8");
      const index = JSON.parse(indexRaw);
      const entries = Array.isArray(index) ? index : (index.deliverables || index.entries || []);
      const entry = entries.find((e) => (e.id || e.taskId || e.file) === id);
      if (entry) {
        let deliverableContent = null;
        if (entry.deliverable) {
          const delivPath = path.join(STATE_DIR, entry.deliverable);
          if (fs.existsSync(delivPath)) {
            try { deliverableContent = fs.readFileSync(delivPath, "utf8"); } catch {}
          }
        }
        return res.json({
          id: entry.id || entry.taskId || entry.file,
          gate: "deliverable-review",
          what: entry.summary || entry.title || entry.description || "Deliverable review",
          why: deliverableContent || entry.description || null,
          requester: entry.agent || entry.author || "unknown",
          created: entry.created || entry.timestamp || entry.date || null,
          _project: entry.project || null,
          _deliverablePath: entry.deliverable || null,
          _source: "deliverables",
          status: entry.status === "needs-feedback" ? "pending" : entry.status,
        });
      }
    } catch { /* skip */ }
  }

  // Check proposed issues (shared/projects/*/issues/*.json with status "proposed")
  if (fs.existsSync(projectsDir)) {
    const projects = fs.readdirSync(projectsDir, { withFileTypes: true }).filter((e) => e.isDirectory());
    for (const proj of projects) {
      const issuesDir = path.join(projectsDir, proj.name, "issues");
      if (!fs.existsSync(issuesDir)) continue;
      const issueFiles = fs.readdirSync(issuesDir).filter((f) => f.endsWith(".json") && f !== ".counter");
      for (const file of issueFiles) {
        try {
          const raw = fs.readFileSync(path.join(issuesDir, file), "utf8");
          const issue = JSON.parse(raw);
          const issueId = issue.id || file.replace(".json", "");
          if (issueId !== id) continue;
          return res.json({
            id: issueId,
            type: "proposed-issue",
            what: issue.title || file.replace(".json", ""),
            why: issue.description || null,
            requester: issue.created_by || issue.assignee || "agent",
            created: issue.created || null,
            status: issue.status || "proposed",
            priority: issue.priority || null,
            labels: issue.labels || [],
            comments: issue.comments || [],
            _project: proj.name,
            _file: file,
            _source: "issue",
          });
        } catch { /* skip */ }
      }
    }
  }

  // Check proposed themes (shared/projects/*/themes/*.json)
  if (fs.existsSync(projectsDir)) {
    const projects = fs.readdirSync(projectsDir, { withFileTypes: true }).filter((e) => e.isDirectory());
    for (const proj of projects) {
      const themesDir = path.join(projectsDir, proj.name, "themes");
      if (!fs.existsSync(themesDir)) continue;
      const themeFiles = fs.readdirSync(themesDir).filter((f) => f.endsWith(".json"));
      for (const file of themeFiles) {
        try {
          const raw = fs.readFileSync(path.join(themesDir, file), "utf8");
          const theme = JSON.parse(raw);
          const themeId = theme.id || file.replace(".json", "");
          if (themeId !== id) continue;
          return res.json({
            id: themeId,
            type: "proposed-theme",
            what: theme.title || file.replace(".json", ""),
            title: theme.title || file.replace(".json", ""),
            description: theme.description || null,
            proxy_metrics: theme.proxy_metrics || [],
            requester: theme.proposed_by || "agent",
            created: theme.proposed_at || null,
            status: theme.status || "proposed",
            _project: proj.name,
            _file: file,
            _source: "theme",
          });
        } catch { /* skip */ }
      }
    }
  }

  return res.status(404).json({ error: "Approval not found" });
});

// List pending approvals across all projects
app.get("/mc/api/approvals", requireSetupAuth, (req, res) => {
  const approvals = [];
  const filterProject = req.query.project || null;

  const projectsDir = path.join(STATE_DIR, "shared", "projects");
  if (fs.existsSync(projectsDir)) {
    const projects = fs.readdirSync(projectsDir, { withFileTypes: true }).filter((e) => e.isDirectory());
    for (const proj of projects) {
      if (filterProject && proj.name !== filterProject) continue;

      // Source 1: Project-format approvals (shared/projects/*/approvals/pending/*.json)
      const pendingDir = path.join(projectsDir, proj.name, "approvals", "pending");
      if (fs.existsSync(pendingDir)) {
        const files = fs.readdirSync(pendingDir).filter((f) => f.endsWith(".json"));
        for (const file of files) {
          try {
            const raw = fs.readFileSync(path.join(pendingDir, file), "utf8");
            const data = JSON.parse(raw);
            if (data.status === "resolved") continue; // skip tombstones
            approvals.push({
              ...data,
              type: data.gate || "unknown",
              _project: proj.name,
              _file: file,
              _source: "gate",
            });
          } catch { /* skip malformed files */ }
        }
      }

      // Source 2: Proposed issues (shared/projects/*/issues/*.json with status "proposed")
      const issuesDir = path.join(projectsDir, proj.name, "issues");
      if (fs.existsSync(issuesDir)) {
        const issueFiles = fs.readdirSync(issuesDir).filter((f) => f.endsWith(".json") && f !== ".counter");
        for (const file of issueFiles) {
          try {
            const raw = fs.readFileSync(path.join(issuesDir, file), "utf8");
            const issue = JSON.parse(raw);
            if (issue.status !== "proposed") continue;
            approvals.push({
              id: issue.id || file.replace(".json", ""),
              type: "proposed-issue",
              what: issue.title || file.replace(".json", ""),
              why: issue.description || null,
              requester: issue.created_by || issue.assignee || "agent",
              created: issue.created || null,
              status: "pending",
              priority: issue.priority || null,
              theme_title: issue.theme_title || null,
              proxy_metric_names: issue.proxy_metric_names || null,
              _project: proj.name,
              _file: file,
              _source: "issue",
            });
          } catch { /* skip malformed files */ }
        }
      }

      // Source 3: Proposed themes (shared/projects/*/themes/*.json with status "proposed")
      const themesDir = path.join(projectsDir, proj.name, "themes");
      if (fs.existsSync(themesDir)) {
        const themeFiles = fs.readdirSync(themesDir).filter((f) => f.endsWith(".json"));
        for (const file of themeFiles) {
          try {
            const raw = fs.readFileSync(path.join(themesDir, file), "utf8");
            const theme = JSON.parse(raw);
            if (theme.status !== "proposed") continue;
            approvals.push({
              id: theme.id || file.replace(".json", ""),
              type: "proposed-theme",
              what: theme.title || file.replace(".json", ""),
              description: theme.description || null,
              proxy_metrics: theme.proxy_metrics || [],
              requester: theme.proposed_by || "agent",
              created: theme.proposed_at || null,
              status: "pending",
              _project: proj.name,
              _file: file,
              _source: "theme",
            });
          } catch { /* skip malformed files */ }
        }
      }
    }
  }

  // Source 3: Legacy deliverables format (shared/output/index.json with status "needs-feedback")
  if (!filterProject) {
    const indexPath = path.join(STATE_DIR, "shared", "output", "index.json");
    if (fs.existsSync(indexPath)) {
      try {
        const indexRaw = fs.readFileSync(indexPath, "utf8");
        const index = JSON.parse(indexRaw);
        const entries = Array.isArray(index) ? index : (index.deliverables || index.entries || []);
        for (const entry of entries) {
          if (entry.status !== "needs-feedback") continue;
          let deliverableContent = null;
          if (entry.deliverable) {
            const delivPath = path.join(STATE_DIR, entry.deliverable);
            if (fs.existsSync(delivPath)) {
              try { deliverableContent = fs.readFileSync(delivPath, "utf8"); } catch {}
            }
          }
          approvals.push({
            id: entry.id || entry.taskId || entry.file,
            type: "deliverable-review",
            gate: "deliverable-review",
            what: entry.summary || entry.title || entry.description || "Deliverable review",
            why: deliverableContent || entry.description || null,
            requester: entry.agent || entry.author || "unknown",
            created: entry.created || entry.timestamp || entry.date || null,
            _project: entry.project || null,
            _deliverablePath: entry.deliverable || null,
            _file: entry.file || entry.id,
            _source: "gate",
          });
        }
      } catch { /* skip malformed index.json */ }
    }
  }

  approvals.sort((a, b) => (b.created || "").localeCompare(a.created || ""));
  return res.json({ approvals });
});

// List all projects
app.get("/mc/api/projects", requireSetupAuth, (_req, res) => {
  const projectsDir = path.join(STATE_DIR, "shared", "projects");
  if (!fs.existsSync(projectsDir)) {
    return res.json({ projects: [] });
  }
  const entries = fs.readdirSync(projectsDir, { withFileTypes: true });
  const projects = entries
    .filter((e) => e.isDirectory() && !e.name.startsWith("_"))
    .map((e) => {
      const projectPath = path.join(projectsDir, e.name, "PROJECT.md");
      let meta = { id: e.name };
      if (fs.existsSync(projectPath)) {
        const raw = fs.readFileSync(projectPath, "utf8");
        // Parse basic frontmatter-style fields
        const leadMatch = raw.match(/\*\*Lead:\*\*\s*(\S+)/);
        const budgetMatch = raw.match(/\*\*Budget:\*\*\s*(.+)/);
        const statusMatch = raw.match(/\*\*Status:\*\*\s*(\S+)/);
        const titleMatch = raw.match(/^#\s+(.+)/m);
        meta = {
          ...meta,
          title: titleMatch?.[1] || e.name,
          lead: leadMatch?.[1] || "unassigned",
          budget: budgetMatch?.[1]?.trim() || "none",
          status: statusMatch?.[1] || "unknown",
          raw,
        };
      }
      return meta;
    });
  return res.json({ projects });
});

// List themes for a project (approved and proposed)
app.get("/mc/api/themes", requireSetupAuth, (req, res) => {
  const projectSlug = req.query.project;
  if (!projectSlug) return res.status(400).json({ error: "project query param required" });

  const themesDir = path.join(STATE_DIR, "shared", "projects", projectSlug, "themes");
  if (!fs.existsSync(themesDir)) return res.json({ themes: [] });

  const themes = [];
  const files = fs.readdirSync(themesDir).filter((f) => f.endsWith(".json"));
  for (const file of files) {
    try {
      const raw = fs.readFileSync(path.join(themesDir, file), "utf8");
      const theme = JSON.parse(raw);
      themes.push(theme);
    } catch { /* skip malformed files */ }
  }

  // Sort: approved first, then by proposed_at descending
  themes.sort((a, b) => {
    if (a.status === "approved" && b.status !== "approved") return -1;
    if (b.status === "approved" && a.status !== "approved") return 1;
    return (b.proposed_at || "").localeCompare(a.proposed_at || "");
  });

  return res.json({ themes });
});

// Unified inbox — aggregates approvals, budget warnings, stale tasks, recent standups
app.get("/mc/api/inbox", requireSetupAuth, (_req, res) => {
  const projectsDir = path.join(STATE_DIR, "shared", "projects");
  if (!fs.existsSync(projectsDir)) {
    return res.json({ items: [], counts: { approvals: 0, budget: 0, tasks: 0, standups: 0, total: 0 } });
  }

  const items = [];
  const projects = fs.readdirSync(projectsDir, { withFileTypes: true }).filter((e) => e.isDirectory());
  const now = Date.now();
  const threeDays = 3 * 24 * 60 * 60 * 1000;
  const today = new Date().toISOString().split("T")[0];
  const yesterday = new Date(now - 24 * 60 * 60 * 1000).toISOString().split("T")[0];

  for (const proj of projects) {
    const projDir = path.join(projectsDir, proj.name);

    // A. Pending Approvals
    const pendingDir = path.join(projDir, "approvals", "pending");
    if (fs.existsSync(pendingDir)) {
      const files = fs.readdirSync(pendingDir).filter((f) => f.endsWith(".json"));
      for (const file of files) {
        try {
          const data = JSON.parse(fs.readFileSync(path.join(pendingDir, file), "utf8"));
          if (data.status === "resolved") continue;
          items.push({
            type: "approval",
            project: proj.name,
            id: data.id || file,
            title: data.what || "Pending approval",
            subtitle: data.why || null,
            requester: data.requester || "unknown",
            gate: data.gate || "unknown",
            timestamp: data.created || new Date().toISOString(),
            data,
          });
        } catch { /* skip */ }
      }
    }

    // B. Budget Warnings — read costs/ and PROJECT.md
    const costsDir = path.join(projDir, "costs");
    const projectMdPath = path.join(projDir, "PROJECT.md");
    if (fs.existsSync(costsDir) && fs.existsSync(projectMdPath)) {
      try {
        const projectRaw = fs.readFileSync(projectMdPath, "utf8");
        const budgetMatch = projectRaw.match(/\*\*Budget:\*\*\s*\$(\d+)/);
        if (budgetMatch) {
          const budget = parseInt(budgetMatch[1]);
          let totalSpend = 0;
          const costFiles = fs.readdirSync(costsDir).filter((f) => f.endsWith(".json"));
          for (const cf of costFiles) {
            try {
              const costData = JSON.parse(fs.readFileSync(path.join(costsDir, cf), "utf8"));
              totalSpend += costData.amount || costData.cost || 0;
            } catch { /* skip */ }
          }
          const pct = budget > 0 ? Math.round((totalSpend / budget) * 100) : 0;
          if (pct >= 80) {
            items.push({
              type: "budget",
              project: proj.name,
              id: `budget-${proj.name}`,
              title: pct >= 100
                ? `Budget exceeded: $${totalSpend} / $${budget} (${pct}%)`
                : `Budget warning: $${totalSpend} / $${budget} (${pct}%)`,
              subtitle: null,
              severity: pct >= 100 ? "critical" : "warning",
              percent: pct,
              spent: totalSpend,
              budget,
              timestamp: new Date().toISOString(),
            });
          }
        }
      } catch { /* skip */ }
    }

    // C. Stale Tasks — issues in_progress > 3 days
    const issuesDir = path.join(projDir, "issues");
    if (fs.existsSync(issuesDir)) {
      const issueFiles = fs.readdirSync(issuesDir).filter((f) => f.endsWith(".json"));
      for (const issueFile of issueFiles) {
        try {
          const issue = JSON.parse(fs.readFileSync(path.join(issuesDir, issueFile), "utf8"));
          if (issue.status !== "in_progress") continue;
          const updated = issue.updated || issue.created || issue.started;
          if (!updated) continue;
          const elapsed = now - new Date(updated).getTime();
          if (elapsed > threeDays) {
            const daysStale = Math.floor(elapsed / (24 * 60 * 60 * 1000));
            items.push({
              type: "stale_task",
              project: proj.name,
              id: issue.id || issueFile,
              title: issue.title || issueFile.replace(".json", ""),
              subtitle: `Assigned to ${issue.assignee || "unassigned"} — in progress for ${daysStale} days`,
              assignee: issue.assignee || null,
              daysStale,
              timestamp: updated,
            });
          }
        } catch { /* skip */ }
      }
    }

    // D. Recent Standups — today/yesterday
    const standupsDir = path.join(projDir, "standups");
    if (fs.existsSync(standupsDir)) {
      const standupFiles = fs.readdirSync(standupsDir).filter((f) => f.endsWith(".md"));
      for (const sf of standupFiles) {
        const dateMatch = sf.match(/(\d{4}-\d{2}-\d{2})/);
        if (!dateMatch) continue;
        const fileDate = dateMatch[1];
        if (fileDate !== today && fileDate !== yesterday) continue;
        try {
          const content = fs.readFileSync(path.join(standupsDir, sf), "utf8");
          const lines = content.split("\n").filter((l) => l.trim());
          const preview = lines.slice(0, 2).join(" ").slice(0, 120);
          // Try to extract lead from PROJECT.md
          let lead = null;
          if (fs.existsSync(projectMdPath)) {
            const raw = fs.readFileSync(projectMdPath, "utf8");
            const leadMatch = raw.match(/\*\*Lead:\*\*\s*(\S+)/);
            lead = leadMatch?.[1] || null;
          }
          items.push({
            type: "standup",
            project: proj.name,
            id: `standup-${proj.name}-${fileDate}`,
            title: `Standup from ${proj.name}`,
            subtitle: preview,
            lead,
            date: fileDate,
            timestamp: new Date(fileDate + "T09:00:00Z").toISOString(),
          });
        } catch { /* skip */ }
      }
    }
  }

  // E. Legacy deliverables needing feedback (shared/output/index.json)
  const indexPath = path.join(STATE_DIR, "shared", "output", "index.json");
  if (fs.existsSync(indexPath)) {
    try {
      const indexRaw = fs.readFileSync(indexPath, "utf8");
      const index = JSON.parse(indexRaw);
      const entries = Array.isArray(index) ? index : (index.deliverables || index.entries || []);
      for (const entry of entries) {
        if (entry.status !== "needs-feedback") continue;
        // Read deliverable content if file exists
        let deliverableContent = null;
        if (entry.deliverable) {
          const delivPath = path.join(STATE_DIR, entry.deliverable);
          if (fs.existsSync(delivPath)) {
            try { deliverableContent = fs.readFileSync(delivPath, "utf8"); } catch {}
          }
        }
        items.push({
          type: "approval",
          project: entry.project || null,
          id: entry.id || entry.taskId || entry.file,
          title: entry.summary || entry.title || entry.description || "Deliverable review",
          subtitle: entry.description || entry.summary || null,
          requester: entry.agent || entry.author || "unknown",
          gate: "deliverable-review",
          timestamp: entry.created || entry.timestamp || entry.date || new Date().toISOString(),
          _source: "deliverables",
          _deliverableContent: deliverableContent,
          data: entry,
        });
      }
    } catch { /* skip malformed index.json */ }
  }

  // E. Proposed Issues — issues with status "proposed" awaiting Kavin's review
  for (const proj of projects) {
    const issuesDir = path.join(projectsDir, proj.name, "issues");
    if (!fs.existsSync(issuesDir)) continue;
    const issueFiles = fs.readdirSync(issuesDir).filter((f) => f.endsWith(".json"));
    for (const issueFile of issueFiles) {
      try {
        const issue = JSON.parse(fs.readFileSync(path.join(issuesDir, issueFile), "utf8"));
        if (issue.status !== "proposed") continue;
        items.push({
          type: "proposed_issue",
          project: proj.name,
          id: issue.id || issueFile.replace(".json", ""),
          title: issue.title || issueFile.replace(".json", ""),
          subtitle: issue.description ? issue.description.slice(0, 120) : null,
          assignee: issue.assignee || null,
          priority: issue.priority || "medium",
          timestamp: issue.created || new Date().toISOString(),
        });
      } catch { /* skip */ }
    }
  }

  // Sort by recency
  items.sort((a, b) => (b.timestamp || "").localeCompare(a.timestamp || ""));

  const counts = {
    approvals: items.filter((i) => i.type === "approval").length,
    budget: items.filter((i) => i.type === "budget").length,
    tasks: items.filter((i) => i.type === "stale_task").length,
    standups: items.filter((i) => i.type === "standup").length,
    proposed: items.filter((i) => i.type === "proposed_issue").length,
  };
  counts.total = counts.approvals + counts.budget + counts.tasks + counts.standups + counts.proposed;

  return res.json({ items, counts });
});

// Global activity feed — aggregates activity across all projects
app.get("/mc/api/activity", requireSetupAuth, (req, res) => {
  const projectsDir = path.join(STATE_DIR, "shared", "projects");
  if (!fs.existsSync(projectsDir)) {
    return res.json({ events: [] });
  }

  const limit = Math.min(parseInt(req.query.limit) || 50, 200);
  const filterProject = req.query.project || null;
  const filterAgent = req.query.agent || null;

  const events = [];
  const projects = fs.readdirSync(projectsDir, { withFileTypes: true }).filter((e) => e.isDirectory());

  for (const proj of projects) {
    if (filterProject && proj.name !== filterProject) continue;
    const projDir = path.join(projectsDir, proj.name);

    // Read activity.log
    const activityLog = path.join(projDir, "activity.log");
    if (fs.existsSync(activityLog)) {
      try {
        const lines = fs.readFileSync(activityLog, "utf8").split("\n").filter(Boolean);
        for (const line of lines.slice(-200)) {
          try {
            const entry = JSON.parse(line);
            if (filterAgent && entry.agent !== filterAgent) continue;
            events.push({
              ...entry,
              project: proj.name,
              type: entry.type || entry.event || "activity",
              timestamp: entry.timestamp || entry.created || entry.time,
            });
          } catch {
            // Try plain text format: "2026-03-20T10:00:00Z [agent] event description"
            const match = line.match(/^(\S+)\s+\[(\S+)]\s+(.+)/);
            if (match) {
              const agent = match[2];
              if (filterAgent && agent !== filterAgent) continue;
              events.push({
                project: proj.name,
                timestamp: match[1],
                agent,
                description: match[3],
                type: "activity",
              });
            }
          }
        }
      } catch { /* skip */ }
    }

    // Read recent issues (by updated date)
    const issuesDir = path.join(projDir, "issues");
    if (fs.existsSync(issuesDir)) {
      const issueFiles = fs.readdirSync(issuesDir).filter((f) => f.endsWith(".json"));
      for (const issueFile of issueFiles) {
        try {
          const issue = JSON.parse(fs.readFileSync(path.join(issuesDir, issueFile), "utf8"));
          if (filterAgent && issue.assignee !== filterAgent) continue;
          events.push({
            project: proj.name,
            type: "issue_update",
            timestamp: issue.updated || issue.created,
            agent: issue.assignee || null,
            description: `Issue "${issue.title || issueFile}" — ${issue.status || "unknown"}`,
            issueId: issue.id || issueFile.replace(".json", ""),
            status: issue.status,
          });
        } catch { /* skip */ }
      }
    }

    // Read resolved approvals
    const resolvedDir = path.join(projDir, "approvals", "resolved");
    if (fs.existsSync(resolvedDir)) {
      const resolvedFiles = fs.readdirSync(resolvedDir).filter((f) => f.endsWith(".json"));
      for (const rf of resolvedFiles) {
        try {
          const approval = JSON.parse(fs.readFileSync(path.join(resolvedDir, rf), "utf8"));
          if (filterAgent && approval.requester !== filterAgent && approval.resolved_by !== filterAgent) continue;
          events.push({
            project: proj.name,
            type: `approval_${approval.decision || approval.status || "resolved"}`,
            timestamp: approval.resolved_at || approval.created,
            agent: approval.resolved_by || "kavin",
            description: `${approval.decision || "resolved"}: ${approval.what || rf}`,
            requester: approval.requester,
          });
        } catch { /* skip */ }
      }
    }

    // Read standups
    const standupsDir = path.join(projDir, "standups");
    if (fs.existsSync(standupsDir)) {
      const standupFiles = fs.readdirSync(standupsDir).filter((f) => f.endsWith(".md"));
      for (const sf of standupFiles) {
        const dateMatch = sf.match(/(\d{4}-\d{2}-\d{2})/);
        if (!dateMatch) continue;
        // Read lead from PROJECT.md
        let lead = null;
        const projectMdPath = path.join(projDir, "PROJECT.md");
        if (fs.existsSync(projectMdPath)) {
          try {
            const raw = fs.readFileSync(projectMdPath, "utf8");
            const leadMatch = raw.match(/\*\*Lead:\*\*\s*(\S+)/);
            lead = leadMatch?.[1] || null;
          } catch { /* skip */ }
        }
        if (filterAgent && lead !== filterAgent) continue;
        events.push({
          project: proj.name,
          type: "standup",
          timestamp: new Date(dateMatch[1] + "T09:00:00Z").toISOString(),
          agent: lead,
          description: `Standup posted`,
          date: dateMatch[1],
        });
      }
    }
  }

  // Sort by timestamp descending, apply limit
  events.sort((a, b) => (b.timestamp || "").localeCompare(a.timestamp || ""));
  const limited = events.slice(0, limit);

  return res.json({ events: limited });
});

// List all agents with their current status
app.get("/mc/api/agents", requireSetupAuth, (_req, res) => {
  try {
    const entries = fs.readdirSync(STATE_DIR, { withFileTypes: true });
    const workspaceDirs = entries
      .filter((e) => e.isDirectory() && (e.name === "workspace" || e.name.startsWith("workspace-")))
      .map((e) => e.name);

    const agents = workspaceDirs.map((dir) => {
      const agent = { id: dir, workspace: dir };

      const identityPath = path.join(STATE_DIR, dir, "IDENTITY.md");
      if (fs.existsSync(identityPath)) {
        const raw = fs.readFileSync(identityPath, "utf8");
        const nameMatch = raw.match(/(?:^|\n)#\s+(.+)/);
        const emojiMatch = raw.match(/emoji:\s*(.+)/i) || raw.match(/^(\p{Emoji_Presentation}|\p{Emoji}\uFE0F)/mu);
        agent.name = nameMatch?.[1]?.trim() || dir.replace(/^workspace-?/, "") || "Sam";
        agent.emoji = emojiMatch?.[1]?.trim() || null;
      } else {
        agent.name = dir === "workspace" ? "Sam" : dir.replace(/^workspace-/, "").split("-")[0];
        agent.name = agent.name.charAt(0).toUpperCase() + agent.name.slice(1);
      }

      const soulPath = path.join(STATE_DIR, dir, "SOUL.md");
      if (fs.existsSync(soulPath)) {
        const raw = fs.readFileSync(soulPath, "utf8");
        const lines = raw.split("\n").filter((l) => l.trim() && !l.startsWith("#"));
        agent.role = lines[0]?.trim().slice(0, 120) || "";
      } else {
        agent.role = "";
      }

      const tasksPath = path.join(STATE_DIR, dir, "memory", "active-tasks.md");
      agent.inProgress = [];
      agent.waitingOn = [];
      agent.status = "idle";
      if (fs.existsSync(tasksPath)) {
        const raw = fs.readFileSync(tasksPath, "utf8");
        let currentSection = null;
        for (const line of raw.split("\n")) {
          const headerMatch = line.match(/^##\s+(.+)/);
          if (headerMatch) { currentSection = headerMatch[1].trim(); continue; }
          if (currentSection === "In Progress" && line.startsWith("- ")) {
            agent.inProgress.push(line.slice(2).replace(/\(last-updated:\s*\d{4}-\d{2}-\d{2}\)/, "").trim());
          }
          if (currentSection === "Waiting On" && line.startsWith("- ")) {
            agent.waitingOn.push(line.slice(2).replace(/\(last-updated:\s*\d{4}-\d{2}-\d{2}\)/, "").trim());
          }
        }
        if (agent.inProgress.length > 0) agent.status = "active";
      }

      return agent;
    });

    return res.json({ agents });
  } catch (err) {
    return res.status(500).json({ error: "Failed to list agents", detail: err.message });
  }
});

// Get agent detail
app.get("/mc/api/agents/:id", requireSetupAuth, (req, res) => {
  const agentId = req.params.id;
  const dirPath = path.join(STATE_DIR, agentId);

  if (!fs.existsSync(dirPath) || !fs.statSync(dirPath).isDirectory()) {
    return res.status(404).json({ error: "Agent workspace not found" });
  }

  const agent = { id: agentId, workspace: agentId };

  const identityPath = path.join(dirPath, "IDENTITY.md");
  if (fs.existsSync(identityPath)) {
    const raw = fs.readFileSync(identityPath, "utf8");
    const nameMatch = raw.match(/(?:^|\n)#\s+(.+)/);
    const emojiMatch = raw.match(/emoji:\s*(.+)/i) || raw.match(/^(\p{Emoji_Presentation}|\p{Emoji}\uFE0F)/mu);
    agent.name = nameMatch?.[1]?.trim() || agentId.replace(/^workspace-?/, "") || "Sam";
    agent.emoji = emojiMatch?.[1]?.trim() || null;
    agent.identityRaw = raw;
  } else {
    agent.name = agentId === "workspace" ? "Sam" : agentId.replace(/^workspace-/, "").split("-")[0];
    agent.name = agent.name.charAt(0).toUpperCase() + agent.name.slice(1);
  }

  const soulPath = path.join(dirPath, "SOUL.md");
  if (fs.existsSync(soulPath)) {
    const raw = fs.readFileSync(soulPath, "utf8");
    agent.soulRaw = raw;
    const lines = raw.split("\n").filter((l) => l.trim() && !l.startsWith("#"));
    agent.role = lines[0]?.trim().slice(0, 120) || "";
    agent.soulSummary = lines.slice(0, 3).join("\n");
  }

  const memoryPath = path.join(dirPath, "MEMORY.md");
  if (fs.existsSync(memoryPath)) {
    agent.memoryRaw = fs.readFileSync(memoryPath, "utf8");
  }

  const tasksPath = path.join(dirPath, "memory", "active-tasks.md");
  if (fs.existsSync(tasksPath)) {
    agent.tasksRaw = fs.readFileSync(tasksPath, "utf8");
  }

  agent.inProgress = [];
  agent.waitingOn = [];
  agent.status = "idle";
  if (agent.tasksRaw) {
    let currentSection = null;
    for (const line of agent.tasksRaw.split("\n")) {
      const headerMatch = line.match(/^##\s+(.+)/);
      if (headerMatch) { currentSection = headerMatch[1].trim(); continue; }
      if (currentSection === "In Progress" && line.startsWith("- ")) {
        agent.inProgress.push(line.slice(2).replace(/\(last-updated:\s*\d{4}-\d{2}-\d{2}\)/, "").trim());
      }
      if (currentSection === "Waiting On" && line.startsWith("- ")) {
        agent.waitingOn.push(line.slice(2).replace(/\(last-updated:\s*\d{4}-\d{2}-\d{2}\)/, "").trim());
      }
    }
    if (agent.inProgress.length > 0) agent.status = "active";
  }

  agent.projects = [];
  const projectsDir = path.join(STATE_DIR, "shared", "projects");
  if (fs.existsSync(projectsDir)) {
    const projEntries = fs.readdirSync(projectsDir, { withFileTypes: true }).filter((e) => e.isDirectory());
    for (const proj of projEntries) {
      const projectPath = path.join(projectsDir, proj.name, "PROJECT.md");
      if (fs.existsSync(projectPath)) {
        const raw = fs.readFileSync(projectPath, "utf8");
        const leadMatch = raw.match(/\*\*Lead:\*\*\s*(\S+)/);
        if (leadMatch && leadMatch[1].toLowerCase() === agent.name.toLowerCase()) {
          const titleMatch = raw.match(/^#\s+(.+)/m);
          agent.projects.push({ id: proj.name, title: titleMatch?.[1] || proj.name });
        }
      }
    }
  }

  return res.json({ agent });
});

// Get agent activity (recent daily logs)
app.get("/mc/api/agents/:id/activity", requireSetupAuth, (req, res) => {
  const agentId = req.params.id;
  const dirPath = path.join(STATE_DIR, agentId);

  if (!fs.existsSync(dirPath)) {
    return res.status(404).json({ error: "Agent workspace not found" });
  }

  const days = [];
  const dailyDir = path.join(dirPath, "memory", "daily");
  if (fs.existsSync(dailyDir)) {
    const files = fs.readdirSync(dailyDir)
      .filter((f) => f.endsWith(".md"))
      .sort()
      .reverse()
      .slice(0, 7);

    for (const file of files) {
      try {
        const content = fs.readFileSync(path.join(dailyDir, file), "utf8");
        days.push({ date: file.replace(".md", ""), content });
      } catch { /* skip */ }
    }
  }

  const activityEntries = [];
  const activityDir = path.join(dirPath, "memory", "activity");
  if (fs.existsSync(activityDir)) {
    const files = fs.readdirSync(activityDir)
      .filter((f) => f.endsWith(".md") || f.endsWith(".json"))
      .sort()
      .reverse()
      .slice(0, 20);

    for (const file of files) {
      try {
        const content = fs.readFileSync(path.join(activityDir, file), "utf8");
        activityEntries.push({ file, content });
      } catch { /* skip */ }
    }
  }

  return res.json({ days, activityEntries });
});

// Get agent runs (from subagents/runs.json)
app.get("/mc/api/agents/:id/runs", requireSetupAuth, (req, res) => {
  const agentId = req.params.id;
  const runsPath = path.join(STATE_DIR, "subagents", "runs.json");

  if (!fs.existsSync(runsPath)) {
    return res.json({ runs: [] });
  }

  try {
    const raw = fs.readFileSync(runsPath, "utf8");
    const allRuns = JSON.parse(raw);
    const runsArray = Array.isArray(allRuns) ? allRuns : [];

    const dirPath = path.join(STATE_DIR, agentId);
    let agentName = agentId === "workspace" ? "sam" : agentId.replace(/^workspace-/, "").split("-")[0];

    const identityPath = path.join(dirPath, "IDENTITY.md");
    if (fs.existsSync(identityPath)) {
      const idRaw = fs.readFileSync(identityPath, "utf8");
      const nameMatch = idRaw.match(/(?:^|\n)#\s+(.+)/);
      if (nameMatch) agentName = nameMatch[1].trim().toLowerCase();
    }

    const filtered = runsArray.filter((run) => {
      const spawner = (run.spawner || run.parent || run.agent || "").toLowerCase();
      return spawner.includes(agentName) || spawner.includes(agentId.replace(/^workspace-?/, ""));
    });

    filtered.sort((a, b) => {
      const ta = new Date(a.timestamp || a.started || 0).getTime();
      const tb = new Date(b.timestamp || b.started || 0).getTime();
      return tb - ta;
    });

    return res.json({ runs: filtered.slice(0, 50) });
  } catch (err) {
    return res.json({ runs: [], error: err.message });
  }
});

// Get compiled dashboard data
app.get("/mc/api/dashboard", requireSetupAuth, (_req, res) => {
  const dashboardPath = path.join(STATE_DIR, "shared", "projects", "dashboard.json");
  if (fs.existsSync(dashboardPath)) {
    try {
      const data = JSON.parse(fs.readFileSync(dashboardPath, "utf8"));
      return res.json(data);
    } catch {
      return res.status(500).json({ error: "Failed to parse dashboard.json" });
    }
  }
  return res.json({ projects: [], approvals: [], standups: [], costs: {} });
});

// --- Issue Management API ---
// Issues are stored as JSON files at shared/projects/{slug}/issues/{id}.json
// Counter file at shared/projects/{slug}/issues/.counter tracks auto-increment

function issueDir(slug) {
  return path.join(STATE_DIR, "shared", "projects", slug, "issues");
}

function readCounter(slug) {
  const counterPath = path.join(issueDir(slug), ".counter");
  try {
    return parseInt(fs.readFileSync(counterPath, "utf8").trim(), 10) || 0;
  } catch {
    return 0;
  }
}

function writeCounter(slug, value) {
  const dir = issueDir(slug);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, ".counter"), String(value), "utf8");
}

function projectPrefix(slug) {
  // Convert slug to uppercase prefix, e.g. "lia-first-100" -> "LIA"
  const parts = slug.split("-");
  if (parts.length >= 1) {
    return parts[0].toUpperCase();
  }
  return slug.toUpperCase().slice(0, 3);
}

// List all issues for a project
app.get("/mc/api/issues", requireSetupAuth, (req, res) => {
  const slug = req.query.project;
  if (!slug || typeof slug !== "string") {
    return res.status(400).json({ error: "Missing ?project= parameter" });
  }
  const dir = issueDir(slug);
  if (!fs.existsSync(dir)) {
    return res.json({ issues: [] });
  }
  const files = fs.readdirSync(dir).filter((f) => f.endsWith(".json"));
  const issues = [];
  for (const file of files) {
    try {
      const raw = fs.readFileSync(path.join(dir, file), "utf8");
      issues.push(JSON.parse(raw));
    } catch { /* skip malformed */ }
  }
  // Sort by updated date, newest first
  issues.sort((a, b) => (b.updated || "").localeCompare(a.updated || ""));
  return res.json({ issues });
});

// Get single issue
app.get("/mc/api/issues/:id", requireSetupAuth, (req, res) => {
  const slug = req.query.project;
  const id = req.params.id;
  if (!slug || typeof slug !== "string") {
    return res.status(400).json({ error: "Missing ?project= parameter" });
  }
  const filePath = path.join(issueDir(slug), `${id}.json`);
  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: "Issue not found" });
  }
  try {
    const raw = fs.readFileSync(filePath, "utf8");
    return res.json(JSON.parse(raw));
  } catch (err) {
    return res.status(500).json({ error: "Failed to read issue" });
  }
});

// Create issue
app.post("/mc/api/issues", requireSetupAuth, (req, res) => {
  const { project, title, description, priority, assignee, labels, theme, proxy_metrics } = req.body;
  if (!project || !title) {
    return res.status(400).json({ error: "Missing project or title" });
  }

  // Validate theme tagging — required when project has approved themes
  const themesDir = path.join(STATE_DIR, "shared", "projects", project, "themes");
  let approvedThemes = [];
  if (fs.existsSync(themesDir)) {
    const themeFiles = fs.readdirSync(themesDir).filter((f) => f.endsWith(".json"));
    for (const file of themeFiles) {
      try {
        const t = JSON.parse(fs.readFileSync(path.join(themesDir, file), "utf8"));
        if (t.status === "approved") approvedThemes.push(t);
      } catch { /* skip malformed */ }
    }
  }

  if (approvedThemes.length > 0) {
    if (!theme) {
      return res.status(400).json({ error: "Theme required — this project has approved themes" });
    }
    const matchedTheme = approvedThemes.find((t) => t.id === theme);
    if (!matchedTheme) {
      return res.status(400).json({ error: `Theme "${theme}" not found or not approved` });
    }
    // Validate proxy_metrics belong to the tagged theme
    if (proxy_metrics && proxy_metrics.length > 0) {
      const validMetricIds = (matchedTheme.proxy_metrics || []).map((pm) => pm.id);
      const invalid = proxy_metrics.filter((id) => !validMetricIds.includes(id));
      if (invalid.length > 0) {
        return res.status(400).json({ error: `Proxy metrics [${invalid.join(", ")}] don't belong to theme "${theme}"` });
      }
    }
  }

  const counter = readCounter(project) + 1;
  writeCounter(project, counter);
  const prefix = projectPrefix(project);
  const id = `${prefix}-${String(counter).padStart(3, "0")}`;
  const now = new Date().toISOString();
  const issue = {
    id,
    title,
    description: description || "",
    status: "todo",
    priority: priority || "none",
    assignee: assignee || null,
    project,
    milestone: null,
    labels: labels || [],
    theme: theme || null,
    proxy_metrics: proxy_metrics || [],
    created: now,
    updated: now,
    created_by: "kavin",
    comments: [],
  };
  const dir = issueDir(project);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, `${id}.json`), JSON.stringify(issue, null, 2), "utf8");
  return res.json(issue);
});

// Update issue (partial)
app.patch("/mc/api/issues/:id", requireSetupAuth, (req, res) => {
  const slug = req.query.project || req.body.project;
  const id = req.params.id;
  if (!slug) {
    return res.status(400).json({ error: "Missing project" });
  }
  const filePath = path.join(issueDir(slug), `${id}.json`);
  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: "Issue not found" });
  }
  try {
    const existing = JSON.parse(fs.readFileSync(filePath, "utf8"));
    const updates = req.body;
    delete updates.id; // prevent ID change
    delete updates.created; // prevent creation date change
    const updated = { ...existing, ...updates, updated: new Date().toISOString() };
    fs.writeFileSync(filePath, JSON.stringify(updated, null, 2), "utf8");
    return res.json(updated);
  } catch (err) {
    return res.status(500).json({ error: "Failed to update issue" });
  }
});

// Add comment to issue
app.post("/mc/api/issues/:id/comments", requireSetupAuth, (req, res) => {
  const slug = req.query.project || req.body.project;
  const id = req.params.id;
  const { text, author } = req.body;
  if (!slug || !text) {
    return res.status(400).json({ error: "Missing project or text" });
  }
  const filePath = path.join(issueDir(slug), `${id}.json`);
  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: "Issue not found" });
  }
  try {
    const existing = JSON.parse(fs.readFileSync(filePath, "utf8"));
    const comment = {
      author: author || "kavin",
      text,
      created: new Date().toISOString(),
    };
    existing.comments = existing.comments || [];
    existing.comments.push(comment);
    existing.updated = new Date().toISOString();
    fs.writeFileSync(filePath, JSON.stringify(existing, null, 2), "utf8");
    return res.json({ ok: true, comment, issue: existing });
  } catch (err) {
    return res.status(500).json({ error: "Failed to add comment" });
  }
});

// --- Experiments API ---
// Reads autoresearch experiment data from shared/projects/{slug}/experiments/

app.get("/mc/api/experiments", requireSetupAuth, (req, res) => {
  const slug = req.query.project;
  if (!slug || typeof slug !== "string") {
    return res.status(400).json({ error: "Missing ?project= parameter" });
  }
  const expDir = path.join(STATE_DIR, "shared", "projects", slug, "experiments");
  if (!fs.existsSync(expDir)) {
    return res.json({ experiments: [] });
  }

  const experiments = [];
  let entries;
  try {
    entries = fs.readdirSync(expDir, { withFileTypes: true });
  } catch {
    return res.json({ experiments: [] });
  }

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const expPath = path.join(expDir, entry.name);
    const programPath = path.join(expPath, "program.md");
    const resultsPath = path.join(expPath, "results.tsv");

    let programMd = null;
    let name = entry.name;
    let results = [];
    let bestMetric = null;
    let status = "unknown";

    // Parse program.md
    if (fs.existsSync(programPath)) {
      try {
        programMd = fs.readFileSync(programPath, "utf8");
        const titleMatch = programMd.match(/^#\s+(.+)/m);
        if (titleMatch) name = titleMatch[1];
        const statusMatch = programMd.match(/## Status\s*\n\s*(\S+)/);
        if (statusMatch) status = statusMatch[1];
      } catch { /* skip */ }
    }

    // Parse results.tsv
    if (fs.existsSync(resultsPath)) {
      try {
        const raw = fs.readFileSync(resultsPath, "utf8");
        const lines = raw.trim().split("\n");
        if (lines.length > 1) {
          const headers = lines[0].split("\t").map((h) => h.trim());
          for (let i = 1; i < lines.length; i++) {
            const cols = lines[i].split("\t").map((c) => c.trim());
            const row = {};
            for (let j = 0; j < headers.length; j++) {
              row[headers[j]] = cols[j] || "";
            }
            results.push(row);
          }
          // Find best metric (third column, assumed numeric, higher is better)
          if (headers.length >= 3) {
            const metricCol = headers[2];
            const numericResults = results
              .map((r) => parseFloat(r[metricCol]))
              .filter((n) => !isNaN(n));
            if (numericResults.length > 0) {
              bestMetric = Math.max(...numericResults);
            }
          }
        }
      } catch { /* skip */ }
    }

    let hypothesis = null;
    if (programMd) {
      const hypoMatch = programMd.match(/## Hypothesis\s*\n([\s\S]*?)(?=\n##|$)/);
      if (hypoMatch) hypothesis = hypoMatch[1].trim();
    }

    experiments.push({
      name,
      dir: entry.name,
      program_md: programMd,
      hypothesis,
      results,
      result_count: results.length,
      best_metric: bestMetric,
      status,
    });
  }

  // Sort by directory name (exp-001, exp-002, etc.)
  experiments.sort((a, b) => a.dir.localeCompare(b.dir));
  return res.json({ experiments });
});

// Create experiment
app.post("/mc/api/experiments", requireSetupAuth, (req, res) => {
  const { project, name, hypothesis, proxy_metric, target_value, program_md, theme } = req.body;
  if (!project || !name) {
    return res.status(400).json({ error: "Missing project or name" });
  }

  const expDir = path.join(STATE_DIR, "shared", "projects", project, "experiments");
  // Ensure experiments directory exists
  if (!fs.existsSync(expDir)) {
    fs.mkdirSync(expDir, { recursive: true });
  }

  // Determine next experiment number by reading existing dirs
  let maxNum = 0;
  try {
    const entries = fs.readdirSync(expDir, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const match = entry.name.match(/^exp-(\d+)$/);
      if (match) {
        const num = parseInt(match[1], 10);
        if (num > maxNum) maxNum = num;
      }
    }
  } catch { /* empty dir is fine */ }

  const nextNum = maxNum + 1;
  const dirName = `exp-${String(nextNum).padStart(3, "0")}`;
  const newExpDir = path.join(expDir, dirName);
  fs.mkdirSync(newExpDir, { recursive: true });

  // Build program.md content
  const lines = [`# ${name}`, ""];
  lines.push("## Status", "planned", "");
  if (hypothesis) {
    lines.push("## Hypothesis", hypothesis, "");
  }
  if (proxy_metric) {
    const targetPart = target_value ? `: ${target_value}` : "";
    lines.push("## Proxy Metric", `${proxy_metric}${targetPart}`, "");
  }
  if (theme) {
    lines.push("## Theme", theme, "");
  }
  if (program_md) {
    lines.push("## Program", program_md, "");
  }

  const programContent = lines.join("\n");
  fs.writeFileSync(path.join(newExpDir, "program.md"), programContent, "utf8");

  return res.json({ ok: true, dir: dirName, name });
});

// --- Budget Management API ---
// Budget policies stored as budget-policy.json inside each project directory.
// Cost data aggregated from costs/*.json files within each project.

function parseBudgetFromProjectMd(raw) {
  if (!raw) return 0;
  const match = raw.match(/\*\*Budget:\*\*\s*\$(\d+(?:\.\d+)?)/);
  return match ? parseFloat(match[1]) : 0;
}

function loadProjectCosts(projectSlug) {
  const costsDir = path.join(STATE_DIR, "shared", "projects", projectSlug, "costs");
  if (!fs.existsSync(costsDir)) return { agents: [], totalSpend: 0, entries: [] };
  const files = fs.readdirSync(costsDir).filter((f) => f.endsWith(".json"));
  const agents = [];
  let totalSpend = 0;
  const allEntries = [];
  for (const file of files) {
    try {
      const raw = fs.readFileSync(path.join(costsDir, file), "utf8");
      const data = JSON.parse(raw);
      agents.push(data);
      totalSpend += data.total_usd || 0;
      if (data.entries) {
        for (const entry of data.entries) {
          allEntries.push({ ...entry, agent: data.agent });
        }
      }
    } catch { /* skip malformed */ }
  }
  allEntries.sort((a, b) => (b.timestamp || "").localeCompare(a.timestamp || ""));
  return { agents, totalSpend, entries: allEntries };
}

function loadBudgetPolicy(projectSlug) {
  const policyPath = path.join(STATE_DIR, "shared", "projects", projectSlug, "budget-policy.json");
  if (!fs.existsSync(policyPath)) return null;
  try {
    return JSON.parse(fs.readFileSync(policyPath, "utf8"));
  } catch { return null; }
}

function computeCostSummary(projectSlug, costData, weeklyBudget, policy) {
  const { agents, totalSpend, entries } = costData;
  const budget = policy?.weekly_budget_usd ?? weeklyBudget;
  const remaining = Math.max(0, budget - totalSpend);
  const utilizationPct = budget > 0 ? Math.round((totalSpend / budget) * 100) : 0;

  // Calculate daily burn rate from entries in the last 7 days
  const now = Date.now();
  const sevenDaysAgo = now - 7 * 24 * 60 * 60 * 1000;
  const recentEntries = entries.filter((e) => {
    const ts = e.timestamp ? new Date(e.timestamp).getTime() : 0;
    return ts >= sevenDaysAgo;
  });
  const recentSpend = recentEntries.reduce((sum, e) => sum + (e.cost_usd || 0), 0);
  const timestamps = recentEntries.map((e) => new Date(e.timestamp).getTime()).filter((t) => t > 0);
  let daySpan = 1;
  if (timestamps.length > 1) {
    daySpan = Math.max(1, Math.ceil((Math.max(...timestamps) - Math.min(...timestamps)) / (24 * 60 * 60 * 1000)));
  }
  const dailyBurnRate = recentSpend > 0 ? recentSpend / daySpan : 0;

  // Projected exhaustion date
  let exhaustionDate = null;
  if (dailyBurnRate > 0 && remaining > 0) {
    const daysRemaining = remaining / dailyBurnRate;
    exhaustionDate = new Date(now + daysRemaining * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
  }

  const warnThreshold = policy?.warn_threshold ?? 0.8;
  const stopThreshold = policy?.stop_threshold ?? 1.0;
  let status = "healthy";
  if (budget > 0) {
    if (totalSpend / budget >= stopThreshold) status = "exceeded";
    else if (totalSpend / budget >= warnThreshold) status = "warning";
  }

  return {
    project: projectSlug,
    totalSpend: Math.round(totalSpend * 100) / 100,
    budget,
    remaining: Math.round(remaining * 100) / 100,
    utilizationPct,
    dailyBurnRate: Math.round(dailyBurnRate * 100) / 100,
    exhaustionDate,
    status,
    warnThreshold,
    stopThreshold,
    agents: agents.map((a) => ({
      agent: a.agent,
      totalUsd: a.total_usd || 0,
      entryCount: a.entries?.length || 0,
      weekStart: a.week_start,
    })),
    perAgentLimits: policy?.per_agent_limits || null,
  };
}

// GET /mc/api/costs?project={slug} — cost summary for one project
app.get("/mc/api/costs", requireSetupAuth, (req, res) => {
  const slug = req.query.project;
  if (!slug || typeof slug !== "string") {
    return res.status(400).json({ error: "Missing ?project= parameter" });
  }
  const projectDir = path.join(STATE_DIR, "shared", "projects", slug);
  if (!fs.existsSync(projectDir)) {
    return res.status(404).json({ error: "Project not found" });
  }

  const costData = loadProjectCosts(slug);
  const policy = loadBudgetPolicy(slug);

  let weeklyBudget = 0;
  const projectMdPath = path.join(projectDir, "PROJECT.md");
  if (fs.existsSync(projectMdPath)) {
    weeklyBudget = parseBudgetFromProjectMd(fs.readFileSync(projectMdPath, "utf8"));
  }

  const summary = computeCostSummary(slug, costData, weeklyBudget, policy);
  return res.json({ ...summary, entries: costData.entries });
});

// GET /mc/api/costs/overview — cost summary across all projects
app.get("/mc/api/costs/overview", requireSetupAuth, (_req, res) => {
  const projectsDir = path.join(STATE_DIR, "shared", "projects");
  if (!fs.existsSync(projectsDir)) {
    return res.json({ projects: [], totals: { spend: 0, budget: 0, utilizationPct: 0 } });
  }
  const dirs = fs.readdirSync(projectsDir, { withFileTypes: true });
  const summaries = [];
  let totalSpend = 0;
  let totalBudget = 0;

  for (const entry of dirs) {
    if (!entry.isDirectory()) continue;
    const slug = entry.name;
    const costData = loadProjectCosts(slug);
    const policy = loadBudgetPolicy(slug);

    let weeklyBudget = 0;
    const projectMdPath = path.join(projectsDir, slug, "PROJECT.md");
    if (fs.existsSync(projectMdPath)) {
      weeklyBudget = parseBudgetFromProjectMd(fs.readFileSync(projectMdPath, "utf8"));
    }

    const summary = computeCostSummary(slug, costData, weeklyBudget, policy);

    let title = slug;
    let projectStatus = "unknown";
    let lead = "unassigned";
    if (fs.existsSync(projectMdPath)) {
      const raw = fs.readFileSync(projectMdPath, "utf8");
      const titleMatch = raw.match(/^#\s+(.+)/m);
      if (titleMatch) title = titleMatch[1];
      const statusMatch = raw.match(/\*\*Status:\*\*\s*(\S+)/);
      if (statusMatch) projectStatus = statusMatch[1];
      const leadMatch = raw.match(/\*\*Lead:\*\*\s*(\S+)/);
      if (leadMatch) lead = leadMatch[1];
    }

    summaries.push({ ...summary, title, projectStatus, lead });
    totalSpend += summary.totalSpend;
    totalBudget += summary.budget;
  }

  return res.json({
    projects: summaries,
    totals: {
      spend: Math.round(totalSpend * 100) / 100,
      budget: totalBudget,
      utilizationPct: totalBudget > 0 ? Math.round((totalSpend / totalBudget) * 100) : 0,
    },
  });
});

// GET /mc/api/budget-policy?project={slug} — get budget policy
app.get("/mc/api/budget-policy", requireSetupAuth, (req, res) => {
  const slug = req.query.project;
  if (!slug || typeof slug !== "string") {
    return res.status(400).json({ error: "Missing ?project= parameter" });
  }
  const policy = loadBudgetPolicy(slug);
  if (!policy) {
    return res.json({ exists: false, policy: null });
  }
  return res.json({ exists: true, policy });
});

// PUT /mc/api/budget-policy — update budget policy
app.put("/mc/api/budget-policy", requireSetupAuth, (req, res) => {
  const { project, weekly_budget_usd, warn_threshold, stop_threshold, per_agent_limits } = req.body;
  if (!project || typeof project !== "string") {
    return res.status(400).json({ error: "Missing project" });
  }
  if (typeof weekly_budget_usd !== "number" || weekly_budget_usd < 0) {
    return res.status(400).json({ error: "Invalid weekly_budget_usd" });
  }
  const projectDir = path.join(STATE_DIR, "shared", "projects", project);
  if (!fs.existsSync(projectDir)) {
    return res.status(404).json({ error: "Project not found" });
  }

  const today = new Date().toISOString().split("T")[0];
  const existing = loadBudgetPolicy(project);

  const policy = {
    project,
    weekly_budget_usd,
    warn_threshold: typeof warn_threshold === "number" ? Math.min(1, Math.max(0, warn_threshold)) : (existing?.warn_threshold ?? 0.8),
    stop_threshold: typeof stop_threshold === "number" ? Math.min(1.5, Math.max(0, stop_threshold)) : (existing?.stop_threshold ?? 1.0),
    per_agent_limits: per_agent_limits || existing?.per_agent_limits || {},
    created: existing?.created || today,
    updated: today,
  };

  const policyPath = path.join(projectDir, "budget-policy.json");
  fs.writeFileSync(policyPath, JSON.stringify(policy, null, 2), "utf8");

  // Remove budget-exceeded flag so agents can resume on next heartbeat
  const budgetExceededFlag = path.join(projectDir, ".budget-exceeded");
  try { fs.unlinkSync(budgetExceededFlag); } catch { /* ignore if not present */ }

  return res.json({ ok: true, policy });
});

// --- Projects Summary API ---

app.get("/mc/api/projects/summary", requireSetupAuth, (_req, res) => {
  const projectsDir = path.join(STATE_DIR, "shared", "projects");
  if (!fs.existsSync(projectsDir)) {
    return res.json({ projects: [] });
  }
  try {
    const entries = fs.readdirSync(projectsDir, { withFileTypes: true });
    const projects = entries
      .filter((e) => e.isDirectory())
      .map((e) => {
        const projDir = path.join(projectsDir, e.name);
        const projectPath = path.join(projDir, "PROJECT.md");
        let meta = { id: e.name, title: e.name, lead: "unassigned", budget: "none", status: "unknown", mission: "" };

        if (fs.existsSync(projectPath)) {
          const raw = fs.readFileSync(projectPath, "utf8");
          const titleMatch = raw.match(/^#\s+(.+)/m);
          const leadMatch = raw.match(/\*\*Lead:\*\*\s*(\S+)/);
          const budgetMatch = raw.match(/\*\*Budget:\*\*\s*(.+)/);
          const statusMatch = raw.match(/\*\*Status:\*\*\s*(\S+)/);
          const missionMatch = raw.match(/## Mission\s*(?:\/\s*Goal)?\n+([\s\S]*?)(?=\n## |$)/);
          const nsmMatch = raw.match(/\*\*NSM:\*\*\s*(.+)/);
          meta.title = titleMatch?.[1] || e.name;
          meta.lead = leadMatch?.[1] || "unassigned";
          meta.budget = budgetMatch?.[1]?.trim() || "none";
          meta.status = statusMatch?.[1] || "unknown";
          meta.mission = missionMatch?.[1]?.trim() || "";
          meta.nsm = nsmMatch?.[1]?.trim() || null;
        }

        // Parse milestones.md for current milestone
        const milestonesPath = path.join(projDir, "milestones.md");
        let currentMilestone = null;
        if (fs.existsSync(milestonesPath)) {
          const milestonesRaw = fs.readFileSync(milestonesPath, "utf8");
          const lines = milestonesRaw.split("\n");
          for (const line of lines) {
            const m = line.match(/^[-*]\s+\[([x ])\]\s+(.+)/i);
            if (m && m[1] === " ") {
              currentMilestone = m[2].trim();
              break;
            }
          }
          if (!currentMilestone) {
            // Check for heading-style milestones
            for (const line of lines) {
              if (line.match(/^##\s+/) && !line.toLowerCase().includes("completed")) {
                currentMilestone = line.replace(/^##\s+/, "").trim();
                break;
              }
            }
          }
        }
        meta.currentMilestone = currentMilestone;

        // Count issues by status
        const issuesDir = path.join(projDir, "issues");
        let issuesDone = 0;
        let issuesTotal = 0;
        if (fs.existsSync(issuesDir)) {
          const issueFiles = fs.readdirSync(issuesDir).filter((f) => f.endsWith(".json"));
          for (const f of issueFiles) {
            try {
              const issue = JSON.parse(fs.readFileSync(path.join(issuesDir, f), "utf8"));
              issuesTotal++;
              if (issue.status === "done" || issue.status === "closed" || issue.status === "completed") {
                issuesDone++;
              }
            } catch { /* skip */ }
          }
        }
        meta.issuesDone = issuesDone;
        meta.issuesTotal = issuesTotal;

        // Get cost data for budget utilization
        const costsDir = path.join(projDir, "costs");
        let totalSpend = 0;
        if (fs.existsSync(costsDir)) {
          const costFiles = fs.readdirSync(costsDir).filter((f) => f.endsWith(".json"));
          for (const f of costFiles) {
            try {
              const costData = JSON.parse(fs.readFileSync(path.join(costsDir, f), "utf8"));
              totalSpend += costData.total_usd || 0;
            } catch { /* skip */ }
          }
        }
        meta.totalSpend = totalSpend;

        return meta;
      });
    return res.json({ projects });
  } catch (err) {
    return res.status(500).json({ error: "Failed to load project summaries", detail: err.message });
  }
});

// --- Org Chart API ---

app.get("/mc/api/org-chart", requireSetupAuth, (_req, res) => {
  try {
    // Read TEAM.md for structure
    const teamPath = path.join(STATE_DIR, "shared", "TEAM.md");
    const teamRaw = fs.existsSync(teamPath) ? fs.readFileSync(teamPath, "utf8") : "";

    // Read agent data from workspaces
    const entries = fs.readdirSync(STATE_DIR, { withFileTypes: true });
    const workspaceDirs = entries
      .filter((e) => e.isDirectory() && (e.name === "workspace" || e.name.startsWith("workspace-")))
      .map((e) => e.name);

    const agentMap = {};
    for (const dir of workspaceDirs) {
      const agent = { id: dir === "workspace" ? "sam" : dir.replace(/^workspace-/, "").split("-")[0] };

      const identityPath = path.join(STATE_DIR, dir, "IDENTITY.md");
      if (fs.existsSync(identityPath)) {
        const raw = fs.readFileSync(identityPath, "utf8");
        const nameMatch = raw.match(/(?:^|\n)#\s+(.+)/);
        const emojiMatch = raw.match(/emoji:\s*(.+)/i) || raw.match(/^(\p{Emoji_Presentation}|\p{Emoji}\uFE0F)/mu);
        agent.name = nameMatch?.[1]?.trim() || agent.id.charAt(0).toUpperCase() + agent.id.slice(1);
        agent.emoji = emojiMatch?.[1]?.trim() || null;
      } else {
        agent.name = agent.id.charAt(0).toUpperCase() + agent.id.slice(1);
        agent.emoji = null;
      }

      const soulPath = path.join(STATE_DIR, dir, "SOUL.md");
      if (fs.existsSync(soulPath)) {
        const raw = fs.readFileSync(soulPath, "utf8");
        const lines = raw.split("\n").filter((l) => l.trim() && !l.startsWith("#"));
        agent.role = lines[0]?.trim().slice(0, 120) || "";
      } else {
        agent.role = "";
      }

      // Check status from active-tasks
      const tasksPath = path.join(STATE_DIR, dir, "memory", "active-tasks.md");
      agent.status = "idle";
      if (fs.existsSync(tasksPath)) {
        const raw = fs.readFileSync(tasksPath, "utf8");
        if (/## In Progress[\s\S]*?- .+/m.test(raw)) agent.status = "active";
      }

      agentMap[agent.id] = agent;
    }

    // Read project leads
    const projectsDir = path.join(STATE_DIR, "shared", "projects");
    const projectLeads = {};
    if (fs.existsSync(projectsDir)) {
      for (const entry of fs.readdirSync(projectsDir, { withFileTypes: true })) {
        if (!entry.isDirectory()) continue;
        const projMd = path.join(projectsDir, entry.name, "PROJECT.md");
        if (fs.existsSync(projMd)) {
          const raw = fs.readFileSync(projMd, "utf8");
          const leadMatch = raw.match(/\*\*Lead:\*\*\s*(\w+)/i);
          if (leadMatch) {
            const leadName = leadMatch[1].toLowerCase();
            if (!projectLeads[leadName]) projectLeads[leadName] = [];
            projectLeads[leadName].push(entry.name);
          }
        }
      }
    }

    // Build hierarchy: Kavin → Sam → leads → specialists
    const leads = ["binny", "leslie", "kiko", "zara", "ritam", "midas", "businessg"];
    const specialists = { ej: "binny", jon: "binny" };

    const buildNode = (id, type, childIds) => {
      const a = agentMap[id] || { id, name: id.charAt(0).toUpperCase() + id.slice(1), role: "", status: "idle", emoji: null };
      return {
        id: a.id,
        name: a.name,
        role: a.role,
        type,
        emoji: a.emoji,
        projects: projectLeads[a.id] || [],
        status: a.status,
        children: childIds,
      };
    };

    const nodes = [];

    // Kavin (human)
    nodes.push({ id: "kavin", name: "Kavin", role: "Board", type: "human", emoji: null, projects: [], status: "active", children: ["sam"] });

    // Sam (coordinator)
    const samChildren = leads.filter((l) => agentMap[l]);
    nodes.push(buildNode("sam", "coordinator", samChildren));

    // Leads
    for (const lead of leads) {
      if (!agentMap[lead]) continue;
      const specChildren = Object.entries(specialists).filter(([, parent]) => parent === lead).map(([id]) => id).filter((id) => agentMap[id]);
      nodes.push(buildNode(lead, "lead", specChildren));
    }

    // Specialists
    for (const [specId] of Object.entries(specialists)) {
      if (!agentMap[specId]) continue;
      nodes.push(buildNode(specId, "specialist", []));
    }

    return res.json({ nodes });
  } catch (err) {
    return res.status(500).json({ error: "Failed to build org chart", detail: err.message });
  }
});

// --- Workspaces (Execution Runs) API ---

app.get("/mc/api/workspaces", requireSetupAuth, (req, res) => {
  const runsPath = path.join(STATE_DIR, "subagents", "runs.json");
  try {
    if (!fs.existsSync(runsPath)) {
      return res.json({ workspaces: [] });
    }

    const raw = fs.readFileSync(runsPath, "utf8");
    const allRuns = Array.isArray(JSON.parse(raw)) ? JSON.parse(raw) : [];

    let filtered = allRuns;

    // Filter by project
    const projectFilter = req.query.project;
    if (projectFilter) {
      filtered = filtered.filter((r) => (r.project || "").toLowerCase() === projectFilter.toLowerCase());
    }

    // Filter by agent
    const agentFilter = req.query.agent;
    if (agentFilter) {
      filtered = filtered.filter((r) => {
        const spawner = (r.spawner || r.parent || r.agent || "").toLowerCase();
        return spawner.includes(agentFilter.toLowerCase());
      });
    }

    // Filter by status
    const statusFilter = req.query.status;
    if (statusFilter) {
      filtered = filtered.filter((r) => (r.status || "").toLowerCase() === statusFilter.toLowerCase());
    }

    // Sort newest first
    filtered.sort((a, b) => {
      const ta = new Date(a.timestamp || a.started || 0).getTime();
      const tb = new Date(b.timestamp || b.started || 0).getTime();
      return tb - ta;
    });

    // Map to workspace format
    const workspaces = filtered.slice(0, 100).map((run) => {
      const started = run.timestamp || run.started || null;
      const ended = run.ended || run.completed || null;
      let durationMs = null;
      if (started && ended) {
        durationMs = new Date(ended).getTime() - new Date(started).getTime();
      }

      // Try to extract issue ID from task/template
      let issue = null;
      const taskStr = run.task || run.template || run.prompt || "";
      const issueMatch = taskStr.match(/([A-Z]+-\d+)/);
      if (issueMatch) issue = issueMatch[1];

      return {
        id: run.id || run.runId || `run-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        agent: run.spawner || run.parent || run.agent || "unknown",
        project: run.project || null,
        issue,
        type: run.type || run.tool || "openclaw",
        model: run.model || null,
        status: run.status || "completed",
        started,
        ended,
        duration_ms: durationMs,
        branch: run.branch || null,
        working_dir: run.workingDir || run.working_dir || null,
        task: taskStr.slice(0, 500) || null,
      };
    });

    return res.json({ workspaces });
  } catch (err) {
    return res.status(500).json({ error: "Failed to list workspaces", detail: err.message });
  }
});

// POST /mc/api/heartbeat/enable — enable or create heartbeat cron for a project lead
app.post("/mc/api/heartbeat/enable", requireSetupAuth, (req, res) => {
  const { agent } = req.body;
  if (!agent) return res.status(400).json({ error: "agent required" });

  // Try to find and enable existing disabled cron first
  const listResult = childProcess.spawnSync("openclaw", ["cron", "list", "--json"], {
    cwd: STATE_DIR, timeout: 15000, encoding: "utf-8"
  });

  let existingId = null;
  if (listResult.stdout) {
    try {
      // Output may have extra text before JSON — find the array
      const match = listResult.stdout.match(/\[[\s\S]*\]/);
      if (match) {
        const jobs = JSON.parse(match[0]);
        const existing = jobs.find(j => j.name === `project-heartbeat-${agent}`);
        if (existing) existingId = existing.id;
      }
    } catch (_) { /* ignore parse errors */ }
  }

  if (existingId) {
    // Enable existing cron
    const enableResult = childProcess.spawnSync("openclaw", ["cron", "enable", existingId], {
      cwd: STATE_DIR, timeout: 15000, encoding: "utf-8"
    });
    return res.json({ ok: true, action: "enabled", id: existingId });
  }

  // Create new heartbeat cron
  const addResult = childProcess.spawnSync("openclaw", [
    "cron", "add",
    "--name", `project-heartbeat-${agent}`,
    "--agent", agent,
    "--every", "15m",
    "--session", "isolated",
    "--message", HEARTBEAT_MESSAGE,
    "--timeout-seconds", "120",
    "--model", "anthropic/claude-haiku-4-5",
    "--no-deliver"
  ], { cwd: STATE_DIR, timeout: 15000, encoding: "utf-8" });

  if (addResult.status !== 0) {
    return res.status(500).json({ error: "Failed to create heartbeat", detail: addResult.stderr });
  }
  return res.json({ ok: true, action: "created" });
});

// Serve the Mission Control SPA
if (fs.existsSync(DASHBOARD_DIR)) {
  app.use("/mc", express.static(DASHBOARD_DIR));
  // SPA catch-all: serve index.html for any /mc/* route not matched above
  app.get("/mc/{*splat}", (req, res) => {
    // Don't catch API routes
    if (req.path.startsWith("/mc/api/")) return res.status(404).json({ error: "Not found" });
    const indexPath = path.join(DASHBOARD_DIR, "index.html");
    if (fs.existsSync(indexPath)) return res.sendFile(indexPath);
    return res.status(404).send("Dashboard not built yet. Run: cd dashboard && npm run build");
  });
}

// Proxy everything else to the gateway.
const proxy = httpProxy.createProxyServer({
  target: GATEWAY_TARGET,
  ws: true,
  xfwd: true,
});

proxy.on("error", (err, _req, res) => {
  console.error("[proxy]", err);
  try {
    if (res && typeof res.writeHead === "function" && !res.headersSent) {
      res.writeHead(502, { "Content-Type": "text/plain" });
      res.end("Gateway unavailable\n");
    }
  } catch {
    // ignore
  }
});

// --- Dashboard password protection ---
// Require the same SETUP_PASSWORD for the entire Control UI dashboard,
// not just the /setup routes.  Healthcheck is excluded so Railway probes work.
function requireDashboardAuth(req, res, next) {
  if (req.path === "/healthz" || req.path === "/setup/healthz") return next();
  if (req.path.startsWith("/hooks")) return next(); // allow OpenClaw webhook endpoints to bypass dashboard auth
  if (!SETUP_PASSWORD) return next(); // no password configured → open
  const header = req.headers.authorization || "";
  const [scheme, encoded] = header.split(" ");
  if (scheme !== "Basic" || !encoded) {
    res.set("WWW-Authenticate", 'Basic realm="OpenClaw Dashboard"');
    return res.status(401).send("Auth required");
  }
  const decoded = Buffer.from(encoded, "base64").toString("utf8");
  const idx = decoded.indexOf(":");
  const password = idx >= 0 ? decoded.slice(idx + 1) : "";
  if (password !== SETUP_PASSWORD) {
    res.set("WWW-Authenticate", 'Basic realm="OpenClaw Dashboard"');
    return res.status(401).send("Invalid password");
  }
  return next();
}

// --- Gateway token injection ---
// The gateway is only reachable from this container. The Control UI in the browser
// cannot set custom Authorization headers for WebSocket connections, so we inject
// the token into proxied requests at the wrapper level.
function attachGatewayAuthHeader(req) {
  if (!req?.headers?.authorization && OPENCLAW_GATEWAY_TOKEN) {
    req.headers.authorization = `Bearer ${OPENCLAW_GATEWAY_TOKEN}`;
  }
}

proxy.on("proxyReqWs", (_proxyReq, req) => {
  attachGatewayAuthHeader(req);
});

app.use(requireDashboardAuth, async (req, res) => {
  // If not configured, force users to /setup for any non-setup routes.
  if (!isConfigured() && !req.path.startsWith("/setup")) {
    return res.redirect("/setup");
  }

  if (isConfigured()) {
    try {
      await ensureGatewayRunning();
    } catch (err) {
      const hint = [
        "Gateway not ready.",
        String(err),
        lastGatewayError ? `\n${lastGatewayError}` : "",
        "\nTroubleshooting:",
        "- Visit /setup and check the Debug Console",
        "- Visit /setup/api/debug for config + gateway diagnostics",
      ].join("\n");
      return res.status(503).type("text/plain").send(hint);
    }
  }

  attachGatewayAuthHeader(req);
  return proxy.web(req, res, { target: GATEWAY_TARGET });
});

// --- Cost Compiler (Budget Alerts) ---
// Reads gateway session JSONL logs, aggregates costs per agent per project,
// writes cost files, and triggers budget alerts at 90%/100%.

function getMondayOfWeek(date) {
  const d = new Date(date);
  const day = d.getUTCDay(); // 0=Sun
  const diff = day === 0 ? 6 : day - 1; // days since Monday
  d.setUTCDate(d.getUTCDate() - diff);
  d.setUTCHours(0, 0, 0, 0);
  return d.toISOString().split("T")[0];
}

function buildAgentProjectMap() {
  const projectsDir = path.join(STATE_DIR, "shared", "projects");
  const map = {}; // agent -> { slug, budget }
  if (!fs.existsSync(projectsDir)) return map;
  try {
    const entries = fs.readdirSync(projectsDir, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const slug = entry.name;
      const projectPath = path.join(projectsDir, slug, "PROJECT.md");
      if (!fs.existsSync(projectPath)) continue;
      try {
        const raw = fs.readFileSync(projectPath, "utf8");
        const leadMatch = raw.match(/\*\*Lead:\*\*\s*(\S+)/);
        const budgetMatch = raw.match(/\*\*Budget:\*\*\s*\$(\d+(?:\.\d+)?)/);
        if (leadMatch) {
          const lead = leadMatch[1].toLowerCase().replace(/^@/, "");
          map[lead] = {
            slug,
            budget: budgetMatch ? parseFloat(budgetMatch[1]) : 0,
          };
        }
      } catch { /* skip */ }
    }
  } catch { /* skip */ }
  return map;
}

function runCostCompiler() {
  const agentsDir = path.join(STATE_DIR, "agents");
  if (!fs.existsSync(agentsDir)) return;

  try {
    const watermarkPath = path.join(STATE_DIR, "shared", "costs", ".watermarks.json");
    fs.mkdirSync(path.dirname(watermarkPath), { recursive: true });

    let watermarks = {};
    try {
      watermarks = JSON.parse(fs.readFileSync(watermarkPath, "utf8"));
    } catch { /* fresh start */ }

    const agentProjectMap = buildAgentProjectMap();
    const agentDirs = fs.readdirSync(agentsDir, { withFileTypes: true })
      .filter((e) => e.isDirectory())
      .map((e) => e.name);

    const currentMonday = getMondayOfWeek(new Date());
    let totalNewEntries = 0;
    let agentsProcessed = 0;

    for (const agent of agentDirs) {
      const sessionsDir = path.join(agentsDir, agent, "sessions");
      if (!fs.existsSync(sessionsDir)) continue;

      let sessionFiles;
      try {
        sessionFiles = fs.readdirSync(sessionsDir)
          .filter((f) => f.endsWith(".jsonl"))
          .sort();
      } catch { continue; }

      if (sessionFiles.length === 0) continue;

      const wm = watermarks[agent] || { last_session: null, last_line: 0, last_processed: null };
      const newEntries = [];

      // Find starting point
      let startIdx = 0;
      if (wm.last_session) {
        const idx = sessionFiles.indexOf(wm.last_session + ".jsonl");
        if (idx >= 0) startIdx = idx;
        // If file was deleted, start from beginning of available files
      }

      for (let fi = startIdx; fi < sessionFiles.length; fi++) {
        const sessionFile = sessionFiles[fi];
        const sessionId = sessionFile.replace(".jsonl", "");
        const filePath = path.join(sessionsDir, sessionFile);

        let lines;
        try {
          const raw = fs.readFileSync(filePath, "utf8");
          lines = raw.split("\n");
        } catch { continue; }

        // Determine starting line
        let startLine = 0;
        if (sessionId === wm.last_session) {
          startLine = wm.last_line;
        }

        for (let li = startLine; li < lines.length; li++) {
          const line = lines[li].trim();
          if (!line) continue;

          let entry;
          try {
            entry = JSON.parse(line);
          } catch { continue; }

          if (entry.type !== "message") continue;
          const usage = entry.message?.usage;
          if (!usage?.cost?.total) continue;

          newEntries.push({
            id: entry.id || `${sessionId}-${li}`,
            timestamp: entry.timestamp || new Date().toISOString(),
            model: entry.model || "unknown",
            tokens: usage.totalTokens || 0,
            cost_usd: Math.round(usage.cost.total * 1000000) / 1000000,
            session: sessionId.substring(0, 8),
          });
        }

        // Update watermark to end of this file
        watermarks[agent] = {
          last_session: sessionId,
          last_line: lines.length,
          last_processed: new Date().toISOString(),
        };
      }

      if (newEntries.length === 0) continue;

      // Determine project
      const projectInfo = agentProjectMap[agent] || { slug: "_org-level", budget: 0 };
      const projectSlug = projectInfo.slug;
      const costsDir = path.join(STATE_DIR, "shared", "projects", projectSlug, "costs");
      fs.mkdirSync(costsDir, { recursive: true });

      const costFilePath = path.join(costsDir, `${agent}.json`);
      let costData = {
        agent,
        project: projectSlug,
        week_start: currentMonday,
        entries: [],
        total_usd: 0,
        _processed_ids: [],
      };

      try {
        const existing = JSON.parse(fs.readFileSync(costFilePath, "utf8"));
        costData = { ...costData, ...existing };
        if (!costData._processed_ids) costData._processed_ids = [];
      } catch { /* fresh */ }

      // Weekly rollover — if cost file is from a previous week, archive and reset
      if (costData.week_start && costData.week_start < currentMonday) {
        const archiveDir = path.join(costsDir, "archive");
        fs.mkdirSync(archiveDir, { recursive: true });
        try {
          fs.writeFileSync(
            path.join(archiveDir, `${agent}-${costData.week_start}.json`),
            JSON.stringify(costData, null, 2),
            "utf8"
          );
        } catch { /* best effort */ }

        // Delete budget-exceeded flag on rollover
        const flagPath = path.join(STATE_DIR, "shared", "projects", projectSlug, ".budget-exceeded");
        try { fs.unlinkSync(flagPath); } catch { /* ignore */ }

        costData = {
          agent,
          project: projectSlug,
          week_start: currentMonday,
          entries: [],
          total_usd: 0,
          _processed_ids: [],
        };
      }

      // Dedup and append
      const processedSet = new Set(costData._processed_ids);
      let addedCount = 0;
      for (const entry of newEntries) {
        if (processedSet.has(entry.id)) continue;
        processedSet.add(entry.id);
        costData.entries.push(entry);
        addedCount++;
      }

      if (addedCount === 0) continue;

      // Recalculate total
      costData.total_usd = Math.round(
        costData.entries.reduce((sum, e) => sum + (e.cost_usd || 0), 0) * 1000000
      ) / 1000000;
      costData._processed_ids = [...processedSet];

      fs.writeFileSync(costFilePath, JSON.stringify(costData, null, 2), "utf8");

      totalNewEntries += addedCount;
      agentsProcessed++;

      // Check thresholds
      // Load budget from policy first, fall back to PROJECT.md
      const policy = loadBudgetPolicy(projectSlug);
      const budget = policy?.weekly_budget_usd ?? projectInfo.budget;

      if (budget > 0) {
        const projectCosts = loadProjectCosts(projectSlug);
        const totalSpend = projectCosts.totalSpend;
        const ratio = totalSpend / budget;

        const notifDir = path.join(STATE_DIR, "shared", "projects", projectSlug, "notifications");
        fs.mkdirSync(notifDir, { recursive: true });

        if (ratio >= 1.0) {
          // 100% — write notification + flag
          const ts = new Date().toISOString().replace(/[:.]/g, "-");
          const notifPath = path.join(notifDir, `${ts}-budget-exceeded.json`);
          if (!fs.existsSync(path.join(STATE_DIR, "shared", "projects", projectSlug, ".budget-exceeded"))) {
            fs.writeFileSync(notifPath, JSON.stringify({
              type: "budget-exceeded",
              project: projectSlug,
              budget_usd: budget,
              spent_usd: Math.round(totalSpend * 100) / 100,
              ratio: Math.round(ratio * 1000) / 1000,
              timestamp: new Date().toISOString(),
              agent,
            }, null, 2), "utf8");

            fs.writeFileSync(
              path.join(STATE_DIR, "shared", "projects", projectSlug, ".budget-exceeded"),
              JSON.stringify({ exceeded_at: new Date().toISOString(), spent: totalSpend, budget }),
              "utf8"
            );
          }
        } else if (ratio >= 0.9) {
          // 90% — write warning notification
          const ts = new Date().toISOString().replace(/[:.]/g, "-");
          // Only write if no recent warning exists (check last 10 min)
          const existingNotifs = fs.readdirSync(notifDir).filter((f) => f.includes("budget-warning"));
          const tenMinAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString().replace(/[:.]/g, "-");
          const recentWarning = existingNotifs.some((f) => f > tenMinAgo);
          if (!recentWarning) {
            const notifPath = path.join(notifDir, `${ts}-budget-warning.json`);
            fs.writeFileSync(notifPath, JSON.stringify({
              type: "budget-warning",
              project: projectSlug,
              budget_usd: budget,
              spent_usd: Math.round(totalSpend * 100) / 100,
              ratio: Math.round(ratio * 1000) / 1000,
              timestamp: new Date().toISOString(),
              agent,
            }, null, 2), "utf8");
          }
        }
      }
    }

    // Save watermarks
    fs.writeFileSync(watermarkPath, JSON.stringify(watermarks, null, 2), "utf8");

    if (totalNewEntries > 0 || agentsProcessed > 0) {
      console.log(`[cost-compiler] Processed ${totalNewEntries} new entries for ${agentsProcessed} agents`);
    }
  } catch (err) {
    console.error(`[cost-compiler] Error: ${String(err)}`);
  }
}

// Start cost compiler interval (every 5 minutes)
setInterval(runCostCompiler, 300_000);
// Run once on startup after a short delay
setTimeout(runCostCompiler, 10_000);

const server = app.listen(PORT, "0.0.0.0", async () => {
  console.log(`[wrapper] listening on :${PORT}`);
  console.log(`[wrapper] state dir: ${STATE_DIR}`);
  console.log(`[wrapper] workspace dir: ${WORKSPACE_DIR}`);

  // Harden state dir for OpenClaw and avoid missing credentials dir on fresh volumes.
  try {
    fs.mkdirSync(path.join(STATE_DIR, "credentials"), { recursive: true });
  } catch {}
  try {
    fs.chmodSync(STATE_DIR, 0o700);
  } catch {}

  console.log(`[wrapper] gateway token: ${OPENCLAW_GATEWAY_TOKEN ? "(set)" : "(missing)"}`);
  console.log(`[wrapper] gateway target: ${GATEWAY_TARGET}`);
  if (!SETUP_PASSWORD) {
    console.warn("[wrapper] WARNING: SETUP_PASSWORD is not set; /setup will error.");
  }

  // Optional operator hook to install/persist extra tools under /data.
  // This is intentionally best-effort and should be used to set up persistent
  // prefixes (npm/pnpm/python venv), not to mutate the base image.
  const bootstrapPath = path.join(WORKSPACE_DIR, "bootstrap.sh");
  if (fs.existsSync(bootstrapPath)) {
    console.log(`[wrapper] running bootstrap: ${bootstrapPath}`);
    try {
      await runCmd("bash", [bootstrapPath], {
        env: {
          ...process.env,
          OPENCLAW_STATE_DIR: STATE_DIR,
          OPENCLAW_WORKSPACE_DIR: WORKSPACE_DIR,
        },
        timeoutMs: 10 * 60 * 1000,
      });
      console.log("[wrapper] bootstrap complete");
    } catch (err) {
      console.warn(`[wrapper] bootstrap failed (continuing): ${String(err)}`);
    }
  }

  // Sync gateway tokens in config with the current env var on every startup.
  // This prevents "gateway token mismatch" when OPENCLAW_GATEWAY_TOKEN changes
  // (e.g. Railway variable update) but the config file still has the old value.
  if (isConfigured() && OPENCLAW_GATEWAY_TOKEN) {
    console.log("[wrapper] syncing gateway tokens in config...");
    try {
      await runCmd(OPENCLAW_NODE, clawArgs(["config", "set", "gateway.auth.mode", "token"]));
      await runCmd(OPENCLAW_NODE, clawArgs(["config", "set", "gateway.auth.token", OPENCLAW_GATEWAY_TOKEN]));
      await runCmd(OPENCLAW_NODE, clawArgs(["config", "set", "gateway.remote.token", OPENCLAW_GATEWAY_TOKEN]));
      console.log("[wrapper] gateway tokens synced");
    } catch (err) {
      console.warn(`[wrapper] failed to sync gateway tokens: ${String(err)}`);
    }
  }

  // Auto-start the gateway if already configured so polling channels (Telegram/Discord/etc.)
  // work even if nobody visits the web UI.
  if (isConfigured()) {
    console.log("[wrapper] config detected; starting gateway...");
    try {
      await ensureGatewayRunning();
      console.log("[wrapper] gateway ready");
    } catch (err) {
      console.error(`[wrapper] gateway failed to start at boot: ${String(err)}`);
    }
  }
});

server.on("upgrade", async (req, socket, head) => {
  // Note: browsers cannot attach arbitrary HTTP headers (including Authorization: Basic)
  // in WebSocket handshakes. Do not enforce dashboard Basic auth at the upgrade layer.
  // The gateway authenticates at the protocol layer and we inject the gateway token below.

  if (!isConfigured()) {
    socket.destroy();
    return;
  }
  try {
    await ensureGatewayRunning();
  } catch {
    socket.destroy();
    return;
  }
  attachGatewayAuthHeader(req);
  proxy.ws(req, socket, head, { target: GATEWAY_TARGET });
});

process.on("SIGTERM", () => {
  // Best-effort shutdown
  try {
    if (gatewayProc) gatewayProc.kill("SIGTERM");
  } catch {
    // ignore
  }

  // Stop accepting new connections; allow in-flight requests to complete briefly.
  try {
    server.close(() => process.exit(0));
  } catch {
    process.exit(0);
  }

  setTimeout(() => process.exit(0), 5_000).unref?.();
});
