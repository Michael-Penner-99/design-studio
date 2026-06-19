import type { NextRequest } from "next/server";
import type { Queryable } from "./db";
import { getSession } from "./auth";
import type { SessionRow } from "./repo";
import { SESSION_COOKIE } from "./session-cookie";

export async function sessionFromRequest(db: Queryable, req: NextRequest): Promise<SessionRow | null> {
  const cookieId = req.cookies.get(SESSION_COOKIE)?.value;
  if (cookieId) {
    const fromCookie = await getSession(db, cookieId);
    if (fromCookie) return fromCookie;
  }
  const auth = req.headers.get("authorization");
  const m = auth?.match(/^Bearer\s+(.+)$/i);
  if (m) return getSession(db, m[1]);
  return null;
}

export function authorizeSlug(session: SessionRow, slug: string): boolean {
  return session.role === "operator" || session.slug === slug;
}

/** Operator access if a valid operator session OR the configured operator bearer token is presented. */
export function operatorAuthorized(
  session: SessionRow | null,
  bearerToken: string | null,
  expectedToken: string | undefined
): boolean {
  if (session?.role === "operator") return true;
  if (expectedToken && bearerToken && bearerToken === expectedToken) return true;
  return false;
}
