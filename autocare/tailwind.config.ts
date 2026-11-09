import type { Config } from 'tailwindcss';

/**
 * Elderly-first theme tokens.
 *
 * - Base body text is 18px (`text-base`), never smaller.
 * - `text-money` = 24px bold for any peso figure.
 * - `text-total` = 36px extra-bold for the grand total on the receipt.
 * - `text-meter` = 48px for the running total inside the meter.
 * - `min-h-tap` = 64px, the minimum height of every interactive element.
 *
 * These custom sizes are also registered with tailwind-merge in lib/utils.ts.
 * Without that, `cn('text-money', 'text-success')` reads `text-money` as a
 * colour and silently drops it — which is how the dashboard's money figures
 * once rendered at body size.
 */
const config: Config = {
  darkMode: ['class'],
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './lib/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
          strong: 'hsl(var(--primary-strong))',
          tint: 'hsl(var(--primary-tint))',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
          tint: 'hsl(var(--destructive-tint))',
        },
        success: {
          DEFAULT: 'hsl(var(--success))',
          foreground: 'hsl(var(--success-foreground))',
          tint: 'hsl(var(--success-tint))',
        },
        warning: {
          DEFAULT: 'hsl(var(--warning))',
          foreground: 'hsl(var(--warning-foreground))',
          tint: 'hsl(var(--warning-tint))',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
        popover: {
          DEFAULT: 'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))',
        },
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
      },
      fontSize: {
        // Base body text is 18px — the smallest text allowed anywhere in the app.
        base: ['1.125rem', { lineHeight: '1.75rem' }],
        lg: ['1.25rem', { lineHeight: '1.875rem' }],
        xl: ['1.5rem', { lineHeight: '2rem' }],
        '2xl': ['1.75rem', { lineHeight: '2.25rem' }],
        '3xl': ['2rem', { lineHeight: '2.5rem' }],
        '4xl': ['2.5rem', { lineHeight: '3rem' }],
        // Any peso figure: 24px bold.
        money: ['1.5rem', { lineHeight: '2rem', fontWeight: '700' }],
        // The grand total on the receipt: 36px extra bold.
        total: ['2.25rem', { lineHeight: '2.75rem', fontWeight: '800' }],
        // The running total inside the meter: 48px. Condensed digits keep a
        // six-figure peso amount on one line at phone width.
        meter: ['3rem', { lineHeight: '1', fontWeight: '700' }],
      },
      fontFamily: {
        /**
         * Reading text: Atkinson Hyperlegible Next, drawn by the Braille
         * Institute for low-vision readers — every I, l and 1 is distinct.
         * It has no peso sign, so Plex Condensed sits next in the stack to
         * catch a stray ₱ in running text instead of an unrelated system font.
         */
        sans: [
          '"Atkinson Hyperlegible Next"',
          '"IBM Plex Sans Condensed"',
          'system-ui',
          '-apple-system',
          '"Segoe UI"',
          'Roboto',
          'sans-serif',
        ],
        /**
         * Money, plates and headings: IBM Plex Sans Condensed. It has the ₱,
         * true tabular figures, and condensed width that keeps ₱13,100.00 on
         * one line on a phone.
         */
        display: ['"IBM Plex Sans Condensed"', '"Arial Narrow"', 'system-ui', 'sans-serif'],
      },
      minHeight: {
        tap: '4rem', // 64px — Fitts's Law minimum tap target
      },
      minWidth: {
        tap: '4rem',
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },
      keyframes: {
        'accordion-down': {
          from: { height: '0' },
          to: { height: 'var(--radix-accordion-content-height)' },
        },
        'accordion-up': {
          from: { height: 'var(--radix-accordion-content-height)' },
          to: { height: '0' },
        },
      },
      animation: {
        'accordion-down': 'accordion-down 0.2s ease-out',
        'accordion-up': 'accordion-up 0.2s ease-out',
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
};

export default config;
