/**
 * Server-side check for an uploaded shop logo. Kept apart from lib/branding.ts
 * because it decodes bytes with Node's Buffer, which must not end up in the
 * browser bundle.
 */

/** Largest logo we store, after the browser has resized it. */
export const LOGO_MAX_BYTES = 300 * 1024;
/** Largest logo side, in pixels. The browser resizes to 320 before sending. */
export const LOGO_MAX_SIDE = 512;

const PNG_PREFIX = 'data:image/png;base64,';
const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

export type LogoCheck =
  | { ok: true; width: number; height: number }
  | { ok: false; reason: 'format' | 'size' | 'dimensions' };

/**
 * Validate a logo before it is stored. The Settings page converts whatever the
 * owner picked into a PNG of at most 320×320; this re-checks that on the server
 * so nothing else can be smuggled in — only a real PNG, by its signature and
 * header, within the size limits. A PNG cannot carry script, and the app only
 * ever renders it through <img> and the PDF renderer.
 */
export function checkLogoDataUrl(dataUrl: string): LogoCheck {
  if (typeof dataUrl !== 'string' || !dataUrl.startsWith(PNG_PREFIX)) {
    return { ok: false, reason: 'format' };
  }
  const b64 = dataUrl.slice(PNG_PREFIX.length);
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(b64)) return { ok: false, reason: 'format' };
  // Size check before decoding anything large.
  if ((b64.length * 3) / 4 > LOGO_MAX_BYTES) return { ok: false, reason: 'size' };

  const bytes = Buffer.from(b64, 'base64');
  if (bytes.length < 33 || bytes.length > LOGO_MAX_BYTES) return { ok: false, reason: 'size' };
  if (!PNG_SIGNATURE.every((b, i) => bytes[i] === b)) return { ok: false, reason: 'format' };
  // The first chunk of every PNG is IHDR: width and height are its first fields.
  if (bytes.toString('ascii', 12, 16) !== 'IHDR') return { ok: false, reason: 'format' };
  const width = bytes.readUInt32BE(16);
  const height = bytes.readUInt32BE(20);
  if (!width || !height || width > LOGO_MAX_SIDE || height > LOGO_MAX_SIDE) {
    return { ok: false, reason: 'dimensions' };
  }
  return { ok: true, width, height };
}
