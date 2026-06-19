import { randomUUID } from "node:crypto";
import bcrypt from "bcryptjs";
import type { Queryable } from "./db";
import { findCredential, setCredential, createSession, getSessionRow, type SessionRow } from "./repo";

const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 14; // 14 days

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, 10);
}
export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

export interface LoginResult { sessionId: string; role: string; slug: string | null; }

export async function seedOperator(db: Queryable): Promise<void> {
  const envUser = process.env.OPERATOR_USERNAME;
  const envHash = process.env.OPERATOR_PASSWORD_HASH;
  if (!envUser || !envHash) return;
  const existing = await findCredential(db, envUser);
  if (existing) return;
  await setCredential(db, { username: envUser, slug: null, role: "operator", passwordHash: envHash });
}

/** Returns a session on success, or null on bad username/password (no user enumeration). */
export async function login(db: Queryable, username: string, password: string, now: number = Date.now()): Promise<LoginResult | null> {
  await seedOperator(db);

  let role: string;
  let slug: string | null;
  let resolvedUsername: string;
  let hash: string;

  const cred = await findCredential(db, username);
  if (cred) {
    role = cred.role; slug = cred.slug; resolvedUsername = cred.username; hash = cred.password_hash;
  } else {
    const envUser = process.env.OPERATOR_USERNAME;
    const envHash = process.env.OPERATOR_PASSWORD_HASH;
    if (envUser && envHash && username === envUser) {
      role = "operator"; slug = null; resolvedUsername = envUser; hash = envHash;
    } else {
      return null;
    }
  }

  if (!(await verifyPassword(password, hash))) return null;

  const sessionId = randomUUID();
  await createSession(db, {
    id: sessionId, username: resolvedUsername, slug, role,
    expiresAt: new Date(now + SESSION_TTL_MS),
  });
  return { sessionId, role, slug };
}

export async function changeOperatorPassword(
  db: Queryable, username: string, currentPassword: string, newPassword: string
): Promise<boolean> {
  await seedOperator(db);
  const cred = await findCredential(db, username);
  if (!cred || cred.role !== "operator") return false;
  if (!(await verifyPassword(currentPassword, cred.password_hash))) return false;
  await setCredential(db, { username: cred.username, slug: null, role: "operator", passwordHash: await hashPassword(newPassword) });
  return true;
}

export async function getSession(db: Queryable, sessionId: string): Promise<SessionRow | null> {
  return getSessionRow(db, sessionId);
}
