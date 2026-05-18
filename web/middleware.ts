import { NextResponse, type NextRequest } from "next/server";

/**
 * HTTP Basic Auth gate for the operator app.
 *
 * Free alternative to Vercel's Password Protection. Browser prompts for
 * username + password on first visit, then caches the credentials for the
 * session. Credentials live in BASIC_AUTH_USER + BASIC_AUTH_PASSWORD env vars.
 *
 * If either env var is missing, the gate is OPEN — useful for `npm run dev`
 * without setting up auth locally. In production set both.
 */
export function middleware(req: NextRequest) {
  const expectedUser = process.env.BASIC_AUTH_USER ?? "";
  const expectedPass = process.env.BASIC_AUTH_PASSWORD ?? "";

  // If auth isn't configured, let everything through (local dev convenience).
  if (!expectedUser || !expectedPass) {
    return NextResponse.next();
  }

  const auth = req.headers.get("authorization");
  if (auth) {
    const [scheme, encoded] = auth.split(" ");
    if (scheme === "Basic" && encoded) {
      try {
        // Edge runtime has atob; no Buffer required.
        const decoded = atob(encoded);
        const sepIdx = decoded.indexOf(":");
        const user = sepIdx >= 0 ? decoded.slice(0, sepIdx) : decoded;
        const pass = sepIdx >= 0 ? decoded.slice(sepIdx + 1) : "";
        if (user === expectedUser && pass === expectedPass) {
          return NextResponse.next();
        }
      } catch {
        // fall through to 401
      }
    }
  }

  return new NextResponse("Authentication required", {
    status: 401,
    headers: {
      "WWW-Authenticate": 'Basic realm="Action Studio Factory", charset="UTF-8"',
    },
  });
}

// Apply to everything except Next.js internals + the favicon.
export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.svg|favicon.ico).*)"],
};
