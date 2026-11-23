import type { Metadata, Viewport } from 'next';
import { NextIntlClientProvider } from 'next-intl';
import { getLocale, getMessages } from 'next-intl/server';
import { SessionProvider } from 'next-auth/react';
import { Toaster } from 'sonner';
import { getLocaleDefinition } from '@/i18n/locales';
import { getShopInfo } from '@/lib/settings';
// Self-hosted fonts. The Content-Security-Policy allows fonts only from this
// origin (`font-src 'self'`), so a Google Fonts link would be blocked; these
// are bundled into /_next/static instead. Each file carries unicode-range
// subsets, so a phone only downloads the Latin-extended file (which holds the
// ₱ sign) when a page actually shows a peso amount.
import '@fontsource/atkinson-hyperlegible-next/400.css';
import '@fontsource/atkinson-hyperlegible-next/600.css';
import '@fontsource/atkinson-hyperlegible-next/700.css';
import '@fontsource/ibm-plex-sans-condensed/600.css';
import '@fontsource/ibm-plex-sans-condensed/700.css';
import './globals.css';

export async function generateMetadata(): Promise<Metadata> {
  const shop = await getShopInfo();
  return {
    title: 'AutoCare',
    description: `Job records for ${shop.name}`,
    robots: { index: false, follow: false },
  };
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  // Never block pinch-zoom: some users will want to magnify further.
  maximumScale: 5,
  // Tints the browser chrome on Android/mobile Chrome. It must match the top of
  // the page so the phone's address bar blends into the app instead of drawing
  // a coloured band above it. The app header is white (`bg-card`), and the
  // sign-in pages open on a white panel too.
  themeColor: '#ffffff',
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const [locale, messages, shop] = await Promise.all([getLocale(), getMessages(), getShopInfo()]);
  const def = getLocaleDefinition(locale);

  return (
    // data-accent picks the shop's chosen colour (globals.css, lib/branding.ts).
    <html lang={locale} dir={def.dir} data-accent={shop.accent} suppressHydrationWarning>
      <body className="min-h-screen bg-background text-foreground">
        <NextIntlClientProvider locale={locale} messages={messages}>
          {/* Lets client components refresh the JWT after a language change or
              the policy acknowledgement, without a full sign-out. */}
          <SessionProvider>{children}</SessionProvider>
          <Toaster
            position="top-center"
            richColors
            closeButton
            duration={5000}
            toastOptions={{
              // Toasts must be as readable as the rest of the app.
              classNames: {
                toast: 'font-sans text-lg font-semibold',
                description: 'text-base',
              },
            }}
          />
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
