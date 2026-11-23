/**
 * Shop branding: the logo upload check and the monogram. No database.
 *
 * The logo check is a security boundary — it is all that stands between an
 * uploaded file and every page and PDF of the app — so it is tested against
 * the ways a file could try to get past it.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkLogoDataUrl, LOGO_MAX_BYTES } from '../lib/logo.ts';
import { monogram, toAccent, isAccent } from '../lib/branding.ts';

/** A minimal PNG header: signature + IHDR with the given size. */
function pngBytes(width: number, height: number, extra = 0): Buffer {
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const ihdr = Buffer.alloc(25);
  ihdr.writeUInt32BE(13, 0); // chunk length
  ihdr.write('IHDR', 4, 'ascii');
  ihdr.writeUInt32BE(width, 8);
  ihdr.writeUInt32BE(height, 12);
  ihdr[16] = 8; // bit depth
  ihdr[17] = 6; // colour type RGBA
  return Buffer.concat([signature, ihdr, Buffer.alloc(extra)]);
}

const asDataUrl = (bytes: Buffer, mime = 'image/png') =>
  `data:${mime};base64,${bytes.toString('base64')}`;

test('a small PNG is accepted, with its size read from the header', () => {
  const result = checkLogoDataUrl(asDataUrl(pngBytes(320, 200)));
  assert.deepEqual(result, { ok: true, width: 320, height: 200 });
});

test('anything that is not a PNG data URL is refused', () => {
  assert.equal(checkLogoDataUrl(asDataUrl(pngBytes(64, 64), 'image/jpeg')).ok, false);
  assert.equal(checkLogoDataUrl(asDataUrl(pngBytes(64, 64), 'image/svg+xml')).ok, false);
  assert.equal(checkLogoDataUrl('https://example.com/logo.png').ok, false);
  assert.equal(checkLogoDataUrl('data:image/png;base64,<script>').ok, false);
});

test('a file that claims to be PNG but is not one is refused', () => {
  const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>');
  assert.deepEqual(checkLogoDataUrl(asDataUrl(svg)), { ok: false, reason: 'format' });
  const broken = pngBytes(64, 64);
  broken.write('XXXX', 12, 'ascii'); // first chunk is not IHDR
  assert.deepEqual(checkLogoDataUrl(asDataUrl(broken)), { ok: false, reason: 'format' });
});

test('oversized pictures are refused by dimensions and by bytes', () => {
  assert.deepEqual(checkLogoDataUrl(asDataUrl(pngBytes(2000, 300))), {
    ok: false,
    reason: 'dimensions',
  });
  assert.deepEqual(checkLogoDataUrl(asDataUrl(pngBytes(0, 300))), {
    ok: false,
    reason: 'dimensions',
  });
  assert.deepEqual(checkLogoDataUrl(asDataUrl(pngBytes(64, 64, LOGO_MAX_BYTES))), {
    ok: false,
    reason: 'size',
  });
});

test('the monogram takes the first letters of the first two words', () => {
  assert.equal(monogram('HI-OCTEN CAR CARE SERVICES'), 'HO');
  assert.equal(monogram("Mang Ben's Talyer"), 'MB');
  assert.equal(monogram('autoshop'), 'A');
  assert.equal(monogram('  '), 'A');
  assert.equal(monogram('Ñaño Motors'), 'ÑM');
});

test('only the curated accents are accepted; anything else falls back to orange', () => {
  assert.equal(isAccent('asul'), true);
  assert.equal(isAccent('red'), false);
  assert.equal(toAccent('lila'), 'lila');
  assert.equal(toAccent('#ff0000'), 'kahel');
  assert.equal(toAccent(undefined), 'kahel');
});
