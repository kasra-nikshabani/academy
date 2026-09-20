/**
 * What a file actually is.
 *
 * Pure, and the reason this module exists at all: **the browser's
 * `Content-Type` and the filename's extension are both things the uploader
 * chose.** A file announced as `photo.jpg` with `image/jpeg` can be an HTML
 * document, and a document store that trusts the announcement and later serves
 * it back is a way to run script on the club's own origin — reading the
 * session cookie of whoever opened it.
 *
 * So the bytes decide. Every accepted format has a signature at a known
 * offset, and a file whose leading bytes match nothing on the list is refused
 * regardless of what it claims to be.
 *
 * ## Why SVG is not on the list
 *
 * It is an image everywhere else and a script host here: an `<svg>` may carry
 * `<script>`, and it has no binary signature to check because it is XML. There
 * is no version of "accept SVG safely" that is worth the paragraph it would
 * take to explain, and a club uploading a birth certificate has never once
 * needed one.
 */

export type AcceptedContentType =
  "image/jpeg" | "image/png" | "image/webp" | "application/pdf";

interface Signature {
  contentType: AcceptedContentType;
  /** Bytes that must appear, `null` meaning "any byte here". */
  magic: readonly (number | null)[];
  offset: number;
  /** Extension used when the file is handed back, chosen by us. */
  extension: string;
  /**
   * Whether a browser may render it in place. A PDF opens in the viewer and
   * can carry its own scripting, so it is always a download.
   */
  inline: boolean;
}

const SIGNATURES: readonly Signature[] = [
  {
    contentType: "image/jpeg",
    magic: [0xff, 0xd8, 0xff],
    offset: 0,
    extension: "jpg",
    inline: true,
  },
  {
    contentType: "image/png",
    magic: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a],
    offset: 0,
    extension: "png",
    inline: true,
  },
  {
    // `RIFF....WEBP` — the four size bytes in between are not fixed.
    contentType: "image/webp",
    magic: [
      0x52,
      0x49,
      0x46,
      0x46,
      null,
      null,
      null,
      null,
      0x57,
      0x45,
      0x42,
      0x50,
    ],
    offset: 0,
    extension: "webp",
    inline: true,
  },
  {
    contentType: "application/pdf",
    magic: [0x25, 0x50, 0x44, 0x46, 0x2d],
    offset: 0,
    extension: "pdf",
    inline: false,
  },
];

export interface DetectedType {
  contentType: AcceptedContentType;
  extension: string;
  inline: boolean;
}

function matches(bytes: Uint8Array, signature: Signature): boolean {
  if (bytes.length < signature.offset + signature.magic.length) return false;

  return signature.magic.every((expected, index) => {
    if (expected === null) return true;
    return bytes[signature.offset + index] === expected;
  });
}

/**
 * Identifies a file from its leading bytes, or `null` if it is not one of the
 * formats the academy accepts.
 *
 * `null` is a refusal, not a fallback. A store that shrugged and called an
 * unknown file `application/octet-stream` would have accepted the thing this
 * check exists to keep out.
 */
export function detectType(bytes: Uint8Array): DetectedType | null {
  for (const signature of SIGNATURES) {
    if (matches(bytes, signature)) {
      return {
        contentType: signature.contentType,
        extension: signature.extension,
        inline: signature.inline,
      };
    }
  }
  return null;
}

/**
 * Every extension this system will ever write.
 *
 * Exported so the key validator can be built from it rather than from a
 * hand-written character class — the first version allowed any two-to-five
 * letters, which accepted `.exe`.
 */
export const ACCEPTED_EXTENSIONS = SIGNATURES.map(
  (signature) => signature.extension,
);

/** The formats a person may be told about, for an error message or a hint. */
export const ACCEPTED_LABEL = "JPEG، PNG، WebP یا PDF";

/**
 * Whether the client's claim agrees with the bytes.
 *
 * Not used to decide anything — the bytes already did that — but a mismatch is
 * worth a log line: an honest browser gets this right, so a file that arrives
 * calling itself a PDF and turns out to be a PNG is either a broken client or
 * somebody probing.
 */
export function claimMatches(
  claimed: string | null | undefined,
  detected: DetectedType,
): boolean {
  if (!claimed) return false;
  return claimed.split(";")[0]?.trim().toLowerCase() === detected.contentType;
}
