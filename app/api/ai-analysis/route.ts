// app/api/ai-analysis/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import OpenAI from "openai";
import crypto from "crypto";

export const runtime = "nodejs";

// ===== Config =====
const MODEL = process.env.OPENAI_MODEL || "gpt-4.1-nano";
const PROMPT_VERSION = "v1";

// Hard caps (cost control)
const MAX_OUTPUT_TOKENS = 350; // keep 250–400 as you requested
const MAX_PROMPT_CHARS = 2600; // strict prompt length cap
const MAX_ANALYSIS_CHARS = 1400; // post-trim safety

// Rate limits (basic + cheap)
const MAX_PER_MINUTE = 5;
const MAX_PER_DAY = 20;



const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY || "missing" });

// ===== Helpers =====
function getClientIp(req: Request) {
  const xfwd = req.headers.get("x-forwarded-for");
  if (xfwd) return xfwd.split(",")[0].trim();
  return "unknown";
}

// stable stringify (sort keys recursively) so hashes are consistent
function stableStringify(value: any): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  const keys = Object.keys(value).sort();
  const props = keys.map((k) => `${JSON.stringify(k)}:${stableStringify(value[k])}`);
  return `{${props.join(",")}}`;
}

function sha256Hex(input: string) {
  return crypto.createHash("sha256").update(input).digest("hex");
}

function nowUnixSeconds() {
  return Math.floor(Date.now() / 1000);
}

async function incrementAndCheckLimit(supabaseAdmin: any, ip: string) {
  const t = nowUnixSeconds();
  const minuteBucketId = Math.floor(t / 60);
  const dayBucketId = Math.floor(t / 86400);

  // Minute bucket
  const minute = await upsertAndGetCount(
    supabaseAdmin,
    ip,
    "minute",
    minuteBucketId,
  );
  if (minute > MAX_PER_MINUTE) return { ok: false, reason: "Too many requests (minute limit)." };

  // Day bucket
  const day = await upsertAndGetCount(
    supabaseAdmin,
    ip,
    "day",
    dayBucketId,
  );
  if (day > MAX_PER_DAY) return { ok: false, reason: "Too many requests (daily limit)." };

  return { ok: true as const };
}

async function upsertAndGetCount(
  supabaseAdmin: any,
  ip: string,
  bucket: "minute" | "day",
  bucketId: number,
) {
    const { data, error } = await supabaseAdmin.rpc("ai_rl_hit", {
      p_ip: ip,
      p_bucket: bucket,
      p_bucket_id: bucketId,
    });
  
    if (error) throw error;
  
    // rpc returns the integer count
    return Number(data) || 0;
  }

function buildPrompt(payload: any) {
  const limiter =
    payload?.strengthPercentile > payload?.endurancePercentile
      ? "endurance"
      : payload?.endurancePercentile > payload?.strengthPercentile
      ? "strength"
      : "balanced";

  const instruction = `
You are STRENDEX AI. Write a concise premium sports-tech "AI Performance Analysis".
Rules:
- Informational only. Not medical advice. No diagnosis. No extreme training or dangerous advice.
- Keep general training guidance; avoid injury rehab, supplements, PEDs, or medical claims.
- Output MUST be short (not an essay) and formatted with 5 sections exactly:

1) Summary (1–2 sentences)
2) Biggest limiter (strength vs endurance; choose one)
3) Next steps (3 bullets, actionable)
4) 4-week outline (very short, 4 lines labeled Week 1–4)
5) Fastest score boost (1 sentence)

Use a direct, premium tone. No fluff.
If missing endurance or strength data, say so and give safe defaults.

Known likely limiter: ${limiter}
`.trim();

  const compactData = {
    // inputs
    bodyweight: payload.bodyweight,
    unitSystem: payload.unitSystem,
    bench: payload.bench,
    squat: payload.squat,
    deadlift: payload.deadlift,
    runDistance: payload.runDistance,
    runTimeText: payload.runTimeText,

    // computed / canonical
    strengthIndex: payload.strengthIndex,
    enduranceIndex: payload.enduranceIndex,
    strengthPercentile: payload.strengthPercentile,
    endurancePercentile: payload.endurancePercentile,
    hqScore: payload.hqScore,
    tier: payload.tier,
    archetype: payload.archetype,
  };

  let full = `${instruction}\n\nDATA:\n${JSON.stringify(compactData)}`;

  // Hard prompt-length cap
  if (full.length > MAX_PROMPT_CHARS) {
    full = full.slice(0, MAX_PROMPT_CHARS);
  }
  return full;
}

function trimAnalysis(text: string) {
  let t = (text || "").trim();

  // Absolute char cap
  if (t.length > MAX_ANALYSIS_CHARS) t = t.slice(0, MAX_ANALYSIS_CHARS).trim();

  // Ensure disclaimer appended
  const disclaimer = "AI guidance is informational, not medical advice.";
  if (!t.toLowerCase().includes("not medical advice")) {
    t += `\n\n${disclaimer}`;
  }
  return t;
}

// ===== Route =====
export async function POST(req: Request) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const openaiApiKey = process.env.OPENAI_API_KEY;

    if (!openaiApiKey) {
      return NextResponse.json({ error: "Missing OPENAI_API_KEY" }, { status: 500 });
    }

    if (!supabaseUrl || !serviceRoleKey) {
      return NextResponse.json(
        { error: "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY" },
        { status: 500 },
      );
    }

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const ip = getClientIp(req);
    const limit = await incrementAndCheckLimit(supabaseAdmin, ip);
    if (!limit.ok) {
      return NextResponse.json({ error: limit.reason }, { status: 429 });
    }

    const payload = await req.json();

    // Minimal validation (don’t break tool if partial)
    const hqScore = Number(payload?.hqScore);
    if (!Number.isFinite(hqScore)) {
      return NextResponse.json({ error: "Invalid payload: missing hqScore" }, { status: 400 });
    }

    // Hash exact payload (stable)
    const payloadStable = stableStringify(payload);
    const inputHash = sha256Hex(payloadStable);

    // Cache lookup
    const { data: cached, error: cacheErr } = await supabaseAdmin
      .from("ai_analysis_cache")
      .select("analysis_text")
      .eq("input_hash", inputHash)
      .maybeSingle();

    if (cacheErr) {
      // don’t fail hard; proceed to generate
      console.error("[AI CACHE READ ERROR]", cacheErr);
    }

    if (cached?.analysis_text) {
      // touch last_accessed_at (best-effort)
      const { error: touchErr } = await supabaseAdmin
  .from("ai_analysis_cache")
  .update({ last_accessed_at: new Date().toISOString() })
  .eq("input_hash", inputHash);

if (touchErr) console.error("[AI CACHE TOUCH ERROR]", touchErr);
      return NextResponse.json({ analysis: cached.analysis_text, cached: true });
    }

    // Generate
    const prompt = buildPrompt(payload);

    const resp = await openai.responses.create({
      model: MODEL,
      input: prompt,
      max_output_tokens: MAX_OUTPUT_TOKENS,
      temperature: 0.4,
    });

    // Extract text
    const text =
      resp.output_text && typeof resp.output_text === "string"
        ? resp.output_text
        : "";

    const analysis = trimAnalysis(text);

    // Store cache
    const { error: insErr } = await supabaseAdmin.from("ai_analysis_cache").insert({
      input_hash: inputHash,
      payload,
      analysis_text: analysis,
      model: MODEL,
      prompt_version: PROMPT_VERSION,
    });

    if (insErr) {
      console.error("[AI CACHE INSERT ERROR]", insErr);
      // still return analysis
    }

    return NextResponse.json({ analysis, cached: false });
  } catch (e: any) {
    console.error("[AI ANALYSIS ERROR]", e);
    return NextResponse.json({ error: e?.message ?? "AI analysis failed" }, { status: 500 });
  }
}