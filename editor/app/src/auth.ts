import { randomUUID } from "node:crypto";
import bcrypt from "bcryptjs";
import type { Queryable } from "./db";
import { findCredential, createSession, getSessionRow, type SessionRow } from "./repo";

const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 14; // 14 days

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, 10);
}
export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

export interface LoginResult { sessionId: string; role: string; slug: string | null; }

/** Returns a session on success, or null on bad username/password (no user enumeration). */
export async function login(db: Queryable, username: string, password: string, now: number = Date.now()): Promise<LoginResult | null> {
  const cred = await findCredential(db, username);
  if (!cred) return null;
  if (!(await verifyPassword(password, cred.password_hash))) return null;
  const sessionId = randomUUID();
  await createSession(db, {
    id: sessionId, username: cred.username, slug: cred.slug, role: cred.role,
    expiresAt: new Date(now + SESSION_TTL_MS),
  });
  return { sessionId, role: cred.role, slug: cred.slug };
}

export async function getSession(db: Queryable, sessionId: string): Promise<SessionRow | null> {
  return getSessionRow(db, sessionId);
}
