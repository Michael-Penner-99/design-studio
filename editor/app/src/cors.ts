import type { NextRequest } from "next/server";

export function parseAllowedOrigins(env: string | undefined): string[] {
  return (env ?? "").split(",").map((s) => s.trim()).filter(Boolean);
}

export function corsHeaders(requestOrigin: string | null, allowed: string[]): Record<string, string> {
  const allowAll = allowed.includes("*");
  const matched = !!requestOrigin && (allowAll || allowed.includes(requestOrigin));
  if (!matched) return {};
  return {
    "Access-Control-Allow-Origin": requestOrigin as string,
    "Access-Control-Allow-Methods": "GET,POST,PUT,OPTIONS",
    "Access-Control-Allow-Headers": "authorization, content-type",
    Vary: "Origin",
  };
}

export function corsForReq(req: NextRequest): Record<string, string> {
  return corsHeaders(req.headers.get("origin"), parseAllowedOrigins(process.env.EDITOR_ALLOWED_ORIGINS));
}
