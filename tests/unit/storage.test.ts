import { describe, expect, it } from "vitest";
import {
  buildStorageKey,
  isValidStorageKey,
  safeDisplayName,
} from "@/lib/storage/keys";
import { claimMatches, detectType } from "@/lib/storage/signature";

const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);
const PNG = new Uint8Array([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00,
]);
const WEBP = new Uint8Array([
  0x52, 0x49, 0x46, 0x46, 0x24, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50,
]);
const PDF = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x37]);

function bytesOf(text: string): Uint8Array {
  return new TextEncoder().encode(text);
}

describe("identifying a file by its bytes", () => {
  it("recognises each accepted format", () => {
    expect(detectType(JPEG)?.contentType).toBe("image/jpeg");
    expect(detectType(PNG)?.contentType).toBe("image/png");
    expect(detectType(WEBP)?.contentType).toBe("image/webp");
    expect(detectType(PDF)?.contentType).toBe("application/pdf");
  });

  it("gives each one the extension the server will use", () => {
    expect(detectType(JPEG)?.extension).toBe("jpg");
    expect(detectType(PDF)?.extension).toBe("pdf");
  });

  /**
   * The check this module exists for. A file may announce anything; only the
   * leading bytes are evidence.
   */
  it("refuses an HTML document however it is dressed up", () => {
    const html = bytesOf("<html><script>alert(document.cookie)</script>");
    expect(detectType(html)).toBeNull();
  });

  it("refuses an SVG, which is an image everywhere but here", () => {
    // No binary signature to check, and it can carry `<script>`.
    const svg = bytesOf(
      '<svg xmlns="http://www.w3.org/2000/svg"><script/></svg>',
    );
    expect(detectType(svg)).toBeNull();
  });

  it("refuses a script, an archive and an executable", () => {
    expect(detectType(bytesOf("#!/bin/sh\nrm -rf /"))).toBeNull();
    // ZIP — also the container an Office file uses.
    expect(detectType(new Uint8Array([0x50, 0x4b, 0x03, 0x04]))).toBeNull();
    // ELF.
    expect(detectType(new Uint8Array([0x7f, 0x45, 0x4c, 0x46]))).toBeNull();
  });

  /**
   * `null` is a refusal, not a fallback. A store that shrugged and called an
   * unknown file `application/octet-stream` would have accepted the very thing
   * this check keeps out.
   */
  it("returns null rather than a generic type", () => {
    expect(detectType(bytesOf("anything at all"))).toBeNull();
  });

  it("refuses an empty or truncated file", () => {
    expect(detectType(new Uint8Array([]))).toBeNull();
    // The first two bytes of a PNG and nothing more.
    expect(detectType(new Uint8Array([0x89, 0x50]))).toBeNull();
  });

  it("does not mistake a WebP-shaped RIFF for a WebP", () => {
    // A WAV file is `RIFF....WAVE` — same container, different format.
    const wav = new Uint8Array([
      0x52, 0x49, 0x46, 0x46, 0x24, 0x00, 0x00, 0x00, 0x57, 0x41, 0x56, 0x45,
    ]);
    expect(detectType(wav)).toBeNull();
  });
});

describe("what a browser may render in place", () => {
  it("lets an image render and never a PDF", () => {
    expect(detectType(JPEG)?.inline).toBe(true);
    expect(detectType(PNG)?.inline).toBe(true);
    // A PDF viewer runs scripts of its own, so it is always a download.
    expect(detectType(PDF)?.inline).toBe(false);
  });
});

describe("comparing the claim with the bytes", () => {
  it("agrees when an honest browser got it right", () => {
    expect(claimMatches("image/jpeg", detectType(JPEG)!)).toBe(true);
    // Browsers append parameters; the type is what matters.
    expect(claimMatches("image/jpeg; charset=binary", detectType(JPEG)!)).toBe(
      true,
    );
  });

  it("disagrees when the file is not what it said", () => {
    expect(claimMatches("application/pdf", detectType(PNG)!)).toBe(false);
    expect(claimMatches(null, detectType(PNG)!)).toBe(false);
    expect(claimMatches("", detectType(PNG)!)).toBe(false);
  });
});

describe("storage keys", () => {
  it("builds a key nothing about the upload influenced", () => {
    const key = buildStorageKey("pdf");

    expect(isValidStorageKey(key)).toBe(true);
    expect(key.endsWith(".pdf")).toBe(true);
    // Two levels of fan-out, so one directory never holds everything.
    expect(key.split("/")).toHaveLength(4);
  });

  it("never builds the same key twice", () => {
    const keys = new Set(
      Array.from({ length: 200 }, () => buildStorageKey("jpg")),
    );
    expect(keys.size).toBe(200);
  });

  /**
   * The provider validates before it touches the filesystem, so this is the
   * line a traversal attempt has to cross.
   */
  it("rejects anything that did not come from the builder", () => {
    for (const bad of [
      "documents/../../../etc/passwd",
      "../secrets.env",
      "/etc/passwd",
      "documents/aa/bb/../../../x.pdf",
      "documents/aa/bb/not-a-uuid.pdf",
      "documents/aa/bb/00000000-0000-0000-0000-000000000000.exe",
      "",
    ]) {
      expect(isValidStorageKey(bad), bad).toBe(false);
    }
  });
});

describe("the name a file arrived with", () => {
  it("keeps an ordinary name", () => {
    expect(safeDisplayName("شناسنامه.pdf")).toBe("شناسنامه.pdf");
  });

  /** It is never part of a path — but it is shown, and it will be headered. */
  it("strips directories of either flavour", () => {
    expect(safeDisplayName("../../etc/passwd")).toBe("passwd");
    expect(safeDisplayName("C:\\Users\\ali\\id.jpg")).toBe("id.jpg");
    expect(safeDisplayName("/var/log/syslog")).toBe("syslog");
  });

  it("strips what would break a header", () => {
    expect(safeDisplayName('id".jpg')).toBe("id.jpg");
    expect(safeDisplayName("id\r\nX-Evil: 1.jpg")).toBe("idX-Evil: 1.jpg");
  });

  it("falls back rather than returning nothing", () => {
    expect(safeDisplayName("")).toBe("بدون نام");
    expect(safeDisplayName(null)).toBe("بدون نام");
    expect(safeDisplayName("..")).toBe("بدون نام");
    expect(safeDisplayName("   ")).toBe("بدون نام");
  });

  it("caps a name long enough to be a problem", () => {
    expect(safeDisplayName("ا".repeat(500)).length).toBeLessThanOrEqual(120);
  });
});
