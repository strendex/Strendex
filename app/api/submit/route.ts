// POST /api/submit — RETIRED (HTTP 410). Replaced by POST /api/score.
//
// Ships together with the calculator that calls /api/score. The route is kept
// so a stale tab gets a clear "refresh" answer instead of a 404, and it no
// longer reads or writes the database.

import { retiredRoute } from "@/lib/server/retiredRoute";

export const runtime = "nodejs";

export async function POST() {
  return retiredRoute();
}

export async function GET() {
  return retiredRoute();
}
