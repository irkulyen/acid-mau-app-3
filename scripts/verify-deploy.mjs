#!/usr/bin/env node
import { spawn } from "node:child_process";

const API_URL = (process.env.VERIFY_API_URL || process.env.SOAK_API_URL || "").trim().replace(/\/+$/, "");
const TELEMETRY_TOKEN = (process.env.TELEMETRY_TOKEN || "").trim();
const EXPECT_BUILD_ID = (process.env.EXPECT_BUILD_ID || "").trim();
const STRICT = process.env.VERIFY_STRICT !== "false";
const VERIFY_JWT_SECRET = (process.env.VERIFY_JWT_SECRET || process.env.JWT_SECRET || "").trim();

if (!API_URL) {
  console.error("Missing VERIFY_API_URL (or SOAK_API_URL).");
  process.exit(1);
}

const requiredHealthFields = ["ok", "timestamp", "buildId", "instanceId", "socketPath"];

function safeParseJson(text) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

async function fetchJson(url, headers = {}) {
  const response = await fetch(url, { headers });
  const raw = await response.text();
  const json = safeParseJson(raw);
  return {
    status: response.status,
    ok: response.ok,
    raw,
    json,
  };
}

function runSoak() {
  return new Promise((resolve) => {
    const env = {
      ...process.env,
      SOAK_API_URL: API_URL,
      SOAK_CLIENTS: process.env.SOAK_CLIENTS || "4",
      SOAK_DURATION_MS: process.env.SOAK_DURATION_MS || "10000",
      SOAK_JWT_SECRET: VERIFY_JWT_SECRET,
    };

    const child = spawn(process.execPath, ["scripts/soak-room.mjs"], {
      env,
      stdio: ["ignore", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    child.on("close", (code) => {
      resolve({ code: code ?? 1, stdout, stderr });
    });
  });
}

function extractJsonBlock(text) {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) return null;
  return text.slice(start, end + 1);
}

async function main() {
  const summary = {
    apiUrl: API_URL,
    strict: STRICT,
    expectedBuildId: EXPECT_BUILD_ID || null,
    checks: {
      health: { ok: false },
      telemetry: { ok: false, skipped: false },
      soak: { ok: false },
    },
    failures: [],
  };

  // Health
  try {
    const healthResp = await fetchJson(`${API_URL}/api/health`);
    summary.checks.health.status = healthResp.status;
    summary.checks.health.payload = healthResp.json ?? healthResp.raw;
    if (!healthResp.ok || !healthResp.json) {
      summary.failures.push(`health_unavailable_${healthResp.status}`);
    } else {
      const missing = requiredHealthFields.filter((key) => !(key in healthResp.json));
      summary.checks.health.missingFields = missing;
      summary.checks.health.ok = missing.length === 0;
      if (STRICT && missing.length > 0) {
        summary.failures.push(`health_missing_fields:${missing.join(",")}`);
      }
      if (EXPECT_BUILD_ID) {
        const actual = String(healthResp.json.buildId || "");
        if (actual !== EXPECT_BUILD_ID) {
          summary.failures.push(`build_id_mismatch:${actual}`);
        }
      }
    }
  } catch (error) {
    summary.failures.push("health_request_failed");
    summary.checks.health.error = error instanceof Error ? error.message : String(error);
  }

  // Telemetry (optional)
  try {
    const headers = TELEMETRY_TOKEN ? { Authorization: `Bearer ${TELEMETRY_TOKEN}` } : {};
    const telemetryResp = await fetchJson(`${API_URL}/api/telemetry`, headers);
    summary.checks.telemetry.status = telemetryResp.status;
    summary.checks.telemetry.payload = telemetryResp.json ?? telemetryResp.raw;
    if (telemetryResp.ok && telemetryResp.json) {
      summary.checks.telemetry.ok = true;
    } else {
      if (STRICT) summary.failures.push(`telemetry_unavailable_${telemetryResp.status}`);
    }
  } catch (error) {
    summary.checks.telemetry.error = error instanceof Error ? error.message : String(error);
    if (STRICT) summary.failures.push("telemetry_request_failed");
  }

  // Soak
  if (!VERIFY_JWT_SECRET) {
    summary.checks.soak = {
      ok: true,
      skipped: true,
      reason: "missing_verify_jwt_secret",
    };
  } else {
    const soakResult = await runSoak();
    const soakText = `${soakResult.stdout}\n${soakResult.stderr}`.trim();
    const soakJsonBlock = extractJsonBlock(soakText);
    const soakJson = soakJsonBlock ? safeParseJson(soakJsonBlock) : null;
    summary.checks.soak.exitCode = soakResult.code;
    summary.checks.soak.payload = soakJson ?? soakText;
    summary.checks.soak.ok = Boolean(soakJson?.ok);
    if (!summary.checks.soak.ok) {
      summary.failures.push("soak_failed");
    }
  }

  const ok = summary.failures.length === 0;
  console.log(JSON.stringify({ ok, ...summary }, null, 2));
  process.exit(ok ? 0 : 1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
