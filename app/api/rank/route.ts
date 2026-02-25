import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function POST(req: Request) {
  try {
    const { hq_score } = await req.json();

    const score = Number(hq_score);
    if (!Number.isFinite(score) || score <= 0) {
      return NextResponse.json({ error: "Invalid score" }, { status: 400 });
    }

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    // Prefer service role for accurate counts; fallback to anon if that's all you have.
    const key =
      process.env.SUPABASE_SERVICE_ROLE_KEY ||
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!url || !key) {
      return NextResponse.json(
        { error: "Missing Supabase env vars" },
        { status: 500 }
      );
    }

    const supabase = createClient(url, key);

    // Total athletes (rows)
    const totalRes = await supabase
      .from("submissions")
      .select("id", { count: "exact", head: true });

    const total = totalRes.count ?? 0;

    if (total <= 0) {
      return NextResponse.json(
        { topPercent: 100, rank: null, total: 0 },
        { status: 200 }
      );
    }

    // Rank = how many have HQ >= your score (1 = best)
    const betterOrEqualRes = await supabase
      .from("submissions")
      .select("id", { count: "exact", head: true })
      .gte("hq_score", score);

    const betterOrEqual = betterOrEqualRes.count ?? total;

    // "Top X%" where smaller is better
    const topPercentRaw = (betterOrEqual / total) * 100;
    const topPercent = Math.max(1, Math.min(100, Math.round(topPercentRaw)));

    return NextResponse.json(
      {
        topPercent,
        rank: betterOrEqual,
        total,
      },
      { status: 200 }
    );
  } catch (e) {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}