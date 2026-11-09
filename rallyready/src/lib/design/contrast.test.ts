import { describe, expect, it } from 'vitest'

import css from '../../index.css?raw'

/**
 * Words have to be readable in light mode.
 *
 * The brand lime and the phase colours are *fills*: a button, a chart bar, the
 * tint behind a chip. They were also being used as the colour of words, and on
 * a light surface that failed every time — the active nav tab measured 1.4:1,
 * and every phase colour was under 3.3 on its own tinted chip, against the 4.5
 * WCAG asks of text. Seventy places in the light theme, none in the dark one.
 *
 * The fix is an `-ink` shade of each colour for words. These tests hold both
 * halves: that the ink shades really pass, computed from the stylesheet itself,
 * and that nothing goes back to using a fill colour as text.
 */

type Rgb = [number, number, number]

/** OKLCH to linear sRGB (Björn Ottosson's matrices), clamped to the gamut. */
function oklchToLinear(l: number, c: number, hDeg: number): Rgb {
  const h = (hDeg * Math.PI) / 180
  const a = c * Math.cos(h)
  const b = c * Math.sin(h)
  const l_ = (l + 0.3963377774 * a + 0.2158037573 * b) ** 3
  const m_ = (l - 0.1055613458 * a - 0.0638541728 * b) ** 3
  const s_ = (l - 0.0894841775 * a - 1.291485548 * b) ** 3
  const clamp = (v: number) => Math.min(1, Math.max(0, v))
  return [
    clamp(4.0767416621 * l_ - 3.3077115913 * m_ + 0.2309699292 * s_),
    clamp(-1.2684380046 * l_ + 2.6097574011 * m_ - 0.3413193965 * s_),
    clamp(-0.0041960863 * l_ - 0.7034186147 * m_ + 1.707614701 * s_),
  ]
}

const encode = (v: number) => (v <= 0.0031308 ? 12.92 * v : 1.055 * v ** (1 / 2.4) - 0.055)
const decode = (v: number) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)
const luminance = ([r, g, b]: Rgb) => 0.2126 * r + 0.7152 * g + 0.0722 * b
const contrast = (x: Rgb, y: Rgb) => {
  const [hi, lo] = [luminance(x), luminance(y)].sort((p, q) => q - p) as [number, number]
  return (hi + 0.05) / (lo + 0.05)
}

/** A colour at `alpha` over a surface, composited the way the browser does. */
function over(top: Rgb, alpha: number, under: Rgb): Rgb {
  return top.map((t, i) =>
    decode(alpha * encode(t) + (1 - alpha) * encode(under[i] as number)),
  ) as Rgb
}

/**
 * One top-level rule's body, found by its selector at the start of a line.
 *
 * Not `indexOf('.dark')`: the file opens with `@custom-variant dark (&:is(.dark
 * *))`, so a plain search lands on line 3 and every lookup after it reads the
 * wrong block.
 */
function rule(selector: RegExp): string {
  const start = selector.exec(css)
  if (!start) throw new Error(`index.css has no ${selector} rule`)
  const open = css.indexOf('{', start.index)
  let depth = 0
  for (let i = open; i < css.length; i++) {
    if (css[i] === '{') depth++
    if (css[i] === '}' && --depth === 0) return css.slice(open + 1, i)
  }
  throw new Error(`${selector} is never closed`)
}

const light = rule(/^:root\s*\{/m)
const dark = rule(/^\.dark\s*\{/m)

function token(block: string, name: string): Rgb {
  const match = new RegExp(`--${name}:\\s*oklch\\(([\\d.]+)\\s+([\\d.]+)\\s+([\\d.]+)\\)`).exec(
    block,
  )
  if (!match) throw new Error(`--${name} is not an oklch() value in this block`)
  return oklchToLinear(Number(match[1]), Number(match[2]), Number(match[3]))
}

const COLOURS = ['primary', 'work', 'rest', 'sprint', 'warmup', 'cooldown'] as const
const SURFACES = ['background', 'card', 'secondary', 'accent'] as const

describe('the ink shades', () => {
  for (const colour of COLOURS) {
    it(`--${colour}-ink reads at 4.5:1 on every light surface, and on its own tint`, () => {
      const ink = token(light, `${colour}-ink`)
      for (const surface of SURFACES) {
        const ratio = contrast(ink, token(light, surface))
        expect(ratio, `${colour}-ink on ${surface}: ${ratio.toFixed(2)}`).toBeGreaterThanOrEqual(
          4.5,
        )
      }
      // Chips put the ink on a 15–20% wash of the colour itself.
      const tint = over(token(light, colour), 0.2, token(light, 'card'))
      const ratio = contrast(ink, tint)
      expect(ratio, `${colour}-ink on its 20% tint: ${ratio.toFixed(2)}`).toBeGreaterThanOrEqual(
        4.5,
      )
    })

    it(`--${colour}-ink is the colour itself in the dark theme`, () => {
      expect(dark).toMatch(new RegExp(`--${colour}-ink:\\s*var\\(--${colour}\\)`))
    })
  }

  it('would have caught the original problem', () => {
    // The fill colour as text, which is what shipped: it must fail, or this
    // file is measuring something other than what the eye sees.
    expect(contrast(token(light, 'primary'), token(light, 'background'))).toBeLessThan(2)
  })
})

describe('words are never written in a fill colour', () => {
  const sources = import.meta.glob(['/src/**/*.{ts,tsx}', '!/src/**/*.test.{ts,tsx}'], {
    query: '?raw',
    import: 'default',
    eager: true,
  }) as Record<string, string>

  it('uses `text-*-ink`, never the bare colour, for text and glyphs', () => {
    const offenders = Object.entries(sources).flatMap(([path, text]) =>
      [...text.matchAll(/\btext-(primary|work|rest|sprint|warmup|cooldown)(?![-\w/])/g)].map(
        (m) => `${path}: ${m[0]}`,
      ),
    )
    expect(Object.keys(sources).length).toBeGreaterThan(100)
    expect(offenders, offenders.join('\n')).toEqual([])
  })
})
