import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function GET() {
  return NextResponse.json({
    ok: true,
    message: "Rank API is running. Use POST with { hq_score }.",
  });
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { hq_score } = body as { hq_score: number };

    if (!Number.isFinite(hq_score)) {
      return NextResponse.json({ error: "Invalid hq_score" }, { status: 400 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    // ✅ This will tell us immediately if env vars are missing
    if (!supabaseUrl) {
      return NextResponse.json(
        { error: "Missing NEXT_PUBLIC_SUPABASE_URL" },
        { status: 500 }
      );
    }
    if (!serviceRoleKey) {
      return NextResponse.json(
        { error: "Missing SUPABASE_SERVICE_ROLE_KEY (add to .env.local + restart dev server)" },
        { status: 500 }
      );
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const totalRes = await supabase
      .from("submissions")
      .select("*", { count: "exact", head: true });

    if (totalRes.error) {
      return NextResponse.json(
        { error: `Supabase total count error: ${totalRes.error.message}` },
        { status: 500 }
      );
    }

    const total = totalRes.count ?? 0;

    const betterRes = await supabase
      .from("submissions")
      .select("*", { count: "exact", head: true })
      .gte("hq_score", hq_score);

    if (betterRes.error) {
      return NextResponse.json(
        { error: `Supabase >= count error: ${betterRes.error.message}` },
        { status: 500 }
      );
    }

    const betterOrEqual = betterRes.count ?? 0;

    if (total === 0) {
      return NextResponse.json({ total: 0, topPercent: null });
    }

    const topPercent = Math.max(
      1,
      Math.min(100, Math.round((betterOrEqual / total) * 100))
    );

    return NextResponse.json({ total, topPercent });
  } catch (err: any) {
    // ✅ Now you’ll see the real crash in terminal AND in response
    console.error("Rank API crash:", err);
    return NextResponse.json(
      { error: `Server crash: ${err?.message ?? "unknown"}` },
      { status: 500 }
    );
  }
}