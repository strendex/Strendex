// Reliable client-IP detection for rate limiting on Vercel.
//
// The first value of x-forwarded-for is client-controllable and can be spoofed
// (to dodge one's own limit or to block someone else by impersonating their IP).
// Prefer Vercel's trusted x-real-ip header; otherwise fall back to the LAST
// x-forwarded-for entry, which the trusted proxy appends.

export function getClientIp(req: Request) {
  const realIp = req.headers.get("x-real-ip");
  if (realIp && realIp.trim()) return realIp.trim();

  const xfwd = req.headers.get("x-forwarded-for");
  if (xfwd) {
    const parts = xfwd
      .split(",")
      .map((p) => p.trim())
      .filter(Boolean);
    if (parts.length > 0) return parts[parts.length - 1];
  }

  return "unknown";
}
