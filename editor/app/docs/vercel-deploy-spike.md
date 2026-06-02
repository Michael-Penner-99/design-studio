# Vercel Deploy Spike — findings (2026-06-02)

Validated `POST /v13/deployments` against the real account before relying on the Publisher.

## Confirmed (matches `src/vercel.ts`)
- `POST https://api.vercel.com/v13/deployments?teamId={VERCEL_TEAM_ID}`, `Authorization: Bearer {VERCEL_TOKEN}`.
- Body `{ name, target, files:[{file, data:<base64>, encoding:"base64"}], projectSettings:{framework:null} }` → **200**.
- Response includes `id`, `url`, `readyState`, `alias[]`. A one-file inline base64 deploy worked.
- Fresh deploy returned `readyState: INITIALIZING`, then `READY` within one poll (~3s). **Confirms the readiness-poll in `publisher.ts` is necessary** (the `url` is not immediately live).

## Important nuance: deployment protection
- The throwaway `editor-spike` project (created fresh, no `project` id) inherited the **team default Deployment Protection** → its alias returned **HTTP 401** unauthenticated.
- The real Publisher always passes `project: {vercel_project_id}` for the client's **existing** `{slug}-site` project, which is already configured **public** (the live contractor sites serve 200) and carries the custom-domain alias. So production publishes to an existing project remain public and update the custom domain.
- **Action for ops:** when onboarding, ensure each client's `{slug}-site` project has Deployment Protection OFF (it already is for factory-deployed sites). New projects default to protected.

## No code change
`src/vercel.ts` matches the confirmed request/response shape. Inline base64 files were accepted for this small payload; if a future client has very large assets and the inline limit is hit, switch large files to the pre-upload-by-sha flow (`POST /v2/files` then reference by `sha`) — not needed now.

## Cleanup
The throwaway `editor-spike` project was deleted after the spike.
