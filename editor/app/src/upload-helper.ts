const ALLOWED = ["image/png", "image/jpeg", "image/webp", "image/svg+xml"];
const MAX_BYTES = 8 * 1024 * 1024; // 8 MB

export function validateUpload(contentType: string, size: number): { ok: boolean; reason?: string } {
  if (!ALLOWED.includes(contentType)) return { ok: false, reason: `Unsupported type ${contentType}` };
  if (size > MAX_BYTES) return { ok: false, reason: `Too large (${size} > ${MAX_BYTES})` };
  return { ok: true };
}

export function blobKey(slug: string, fieldId: string, filename: string): string {
  const safe = filename.replace(/[^a-zA-Z0-9._-]/g, "_");
  return `clients/${slug}/uploads/${fieldId}/${safe}`;
}
