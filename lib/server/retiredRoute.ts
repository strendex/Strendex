// Shared response for retired API routes.
//
// POST /api/rank and POST /api/submit were the pre-Group-1 calculator's two
// calls. They accepted incomplete benchmarks and trusted browser-converted
// values, and /api/submit saved such rows as approved. Every submission now goes
// through POST /api/score. A 410 tells a stale open tab to reload rather than
// retrying.

import { NextResponse } from "next/server";

export const RETIRED_ROUTE_MESSAGE =
  "This version of the calculator is out of date. Please refresh the page and try again.";

export function retiredRoute(): NextResponse {
  return NextResponse.json(
    { error: RETIRED_ROUTE_MESSAGE, code: "ENDPOINT_RETIRED" },
    { status: 410, headers: { "Cache-Control": "no-store" } },
  );
}
