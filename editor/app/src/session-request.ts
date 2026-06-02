import type { NextRequest } from "next/server";
import type { Queryable } from "./db";
import { getSession } from "./auth";
import type { SessionRow } from "./repo";
import { SESSION_COOKIE } from "./session-cookie";

export async function sessionFromRequest(db: Queryable, req: NextRequest): Promise<SessionRow | null> {
  const id = req.cookies.get(SESSION_COOKIE)?.value;
  if (!id) return null;
  return getSession(db, id);
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
