import { describe, it, expect } from "vitest";
import { validateUpload, blobKey } from "../src/upload-helper";

describe("validateUpload", () => {
  it("accepts allowed image types under the size cap", () => {
    expect(validateUpload("image/png", 500_000)).toEqual({ ok: true });
  });
  it("rejects non-images and oversized files", () => {
    expect(validateUpload("application/pdf", 1000).ok).toBe(false);
    expect(validateUpload("image/png", 99_000_000).ok).toBe(false);
  });
});

describe("blobKey", () => {
  it("namespaces by slug + field id", () => {
    expect(blobKey("acme", "index__img__1", "logo.png")).toBe("clients/acme/uploads/index__img__1/logo.png");
  });
});
