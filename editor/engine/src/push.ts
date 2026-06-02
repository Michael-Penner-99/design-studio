import { readFileSync, mkdtempSync, readdirSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, relative } from "node:path";
import { buildManifest } from "./manifest";
import type { Manifest, Tier } from "./types";

export interface PushPayload {
  slug: string;
  displayName: string;
  vercelProjectId: string | null;
  customDomain: string | null;
  tier: string;
  manifest: Manifest;
  pages: { path: string; html: string }[];
  assets: { path: string; base64: string }[];
}

export interface BuildPushPayloadOptions {
  slug: string;
  root: string;
  displayName: string;
  tier?: Tier;
}

function readDeployInfo(root: string, slug: string): { projectId: string | null; domain: string | null } {
  try {
    const m = JSON.parse(readFileSync(join(root, "clients", slug, "deploy", "manifest.json"), "utf8"));
    return { projectId: m?.site?.vercel_project_id ?? null, domain: m?.site?.preview_url ?? null };
  } catch {
    return { projectId: null, domain: null };
  }
}

function readAssets(dir: string, base = dir): { path: string; base64: string }[] {
  const out: { path: string; base64: string }[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...readAssets(full, base));
    else if (!entry.name.endsWith(".html")) out.push({ path: relative(base, full), base64: readFileSync(full).toString("base64") });
  }
  return out;
}

function readAllPages(dir: string, base = dir): { path: string; html: string }[] {
  const out: { path: string; html: string }[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...readAllPages(full, base));
    else if (entry.name.endsWith(".html")) out.push({ path: relative(base, full), html: readFileSync(full, "utf8") });
  }
  return out;
}

export function buildPushPayload(opts: BuildPushPayloadOptions): PushPayload {
  const tier: Tier = opts.tier ?? "Text only";
  const siteDir = join(opts.root, "clients", opts.slug, "site");
  if (!statSync(siteDir).isDirectory()) throw new Error(`No site dir at ${siteDir}`);

  const outDir = mkdtempSync(join(tmpdir(), `push-tagged-${opts.slug}-`));
  const manifest = buildManifest({ slug: opts.slug, siteDir, outDir, tier });
  const pages = readAllPages(outDir);
  const assets = readAssets(siteDir);
  const { projectId, domain } = readDeployInfo(opts.root, opts.slug);

  return {
    slug: opts.slug,
    displayName: opts.displayName,
    vercelProjectId: projectId,
    customDomain: domain,
    tier,
    manifest,
    pages,
    assets,
  };
}
