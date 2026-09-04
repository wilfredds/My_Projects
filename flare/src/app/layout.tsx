import type { Metadata } from "next";
import { cookies } from "next/headers";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { THEME_COOKIE, themeAttribute, themeOrDefault } from "@/lib/theme/theme";
import { missingFirebaseConfig } from "@/lib/firebase/env";
import { SetupRequired } from "@/components/setup-required";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "FLARE",
  description: "Firefighters' Learning and Resources Exchange",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  // The saved preference is stamped on <html> during the server render, so
  // the first paint is already the right theme. The alternative — an inline
  // script that patches the attribute before paint — keeps pages statically
  // renderable but needs either 'unsafe-inline' or a nonce in the CSP.
  //
  // Reading the cookie here opts the app out of static rendering. That costs
  // little for FLARE, where nearly every screen is behind a session and
  // renders per-request anyway, and it buys a flash-free load with no inline
  // script to exempt from the CSP later.
  const store = await cookies();
  const theme = themeOrDefault(store.get(THEME_COOKIE)?.value);

  // Checked here, once, rather than letting each page throw from inside the
  // Firebase SDK. An unconfigured clone is the most common first-run state,
  // and it deserves an answer rather than a stack trace.
  const missing = missingFirebaseConfig();

  return (
    <html
      lang="en"
      data-theme={themeAttribute(theme)}
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        {missing.length > 0 ? <SetupRequired missing={missing} /> : children}
      </body>
    </html>
  );
}
