export const SESSION_COOKIE = "editor_session";

export function sessionCookieOptions(maxAgeSeconds: number) {
  return {
    httpOnly: true as const,
    secure: true as const,
    sameSite: "lax" as const,
    path: "/" as const,
    maxAge: maxAgeSeconds,
  };
}
