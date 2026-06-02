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
  let role: string;
  let slug: string | null;
  let resolvedUsername: string;

  const envUser = process.env.OPERATOR_USERNAME;
  const envHash = process.env.OPERATOR_PASSWORD_HASH;
  if (envUser && envHash && username === envUser) {
    if (!(await verifyPassword(password, envHash))) return null;
    role = "operator"; slug = null; resolvedUsername = envUser;
  } else {
    const cred = await findCredential(db, username);
    if (!cred) return null;
    if (!(await verifyPassword(password, cred.password_hash))) return null;
    role = cred.role; slug = cred.slug; resolvedUsername = cred.username;
  }

  const sessionId = randomUUID();
  await createSession(db, {
    id: sessionId, username: resolvedUsername, slug, role,
    expiresAt: new Date(now + SESSION_TTL_MS),
  });
  return { sessionId, role, slug };
}

export async function getSession(db: Queryable, sessionId: string): Promise<SessionRow | null> {
  return getSessionRow(db, sessionId);
}
