import { AlaCarteMenu } from "@/components/ala-carte-menu";
import { Hero } from "@/components/hero";
import { HouseRules } from "@/components/house-rules";
import { ReserveForm } from "@/components/reserve-form";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { UnliPackages } from "@/components/unli-packages";
import { turnstileSiteKey } from "@/lib/turnstile";
import { Visit } from "@/components/visit";

/**
 * The public landing page. Everything here is a server component except the
 * reservation form, so the whole page ships as HTML — good for the guest on a
 * slow connection, and good for Google, which reads it without running any
 * JavaScript.
 */
export default function HomePage() {
  return (
    <>
      <SiteHeader />
      <main id="main" className="grow">
        <Hero />
        <UnliPackages />
        <AlaCarteMenu />
        <HouseRules />
        <ReserveForm turnstileSiteKey={turnstileSiteKey()} />
        <Visit />
      </main>
      <SiteFooter />
    </>
  );
}
