import { fullAddress, mapsSearchUrl, restaurant } from "@/lib/restaurant";

import { SectionHeading } from "./section";

export function Visit() {
  return (
    <section id="visit" className="scroll-mt-20 bg-paper-warm/60 py-20 sm:py-24">
      <div className="mx-auto w-full max-w-6xl px-5">
        <SectionHeading eyebrow="Visit" title="Find us in General Trias.">
          Along the main road, with parking at the back. Look for the red lantern.
        </SectionHeading>

        <div className="mt-12 grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
          <div className="rounded-2xl border border-paper-edge bg-white/50 p-7">
            <h3 className="font-display text-xl font-semibold text-sumi">Address</h3>
            <address className="mt-3 not-italic text-sm leading-relaxed text-sumi-muted">
              {restaurant.address.street}
              <br />
              {restaurant.address.barangay}
              <br />
              {restaurant.address.city}, {restaurant.address.province} {restaurant.address.postalCode}
            </address>
            <a
              href={mapsSearchUrl}
              target="_blank"
              /* noopener/noreferrer on every external target="_blank" link. Without
                 noopener the page we open gets a handle on ours via window.opener
                 and can navigate it somewhere else — a classic phishing trick. */
              rel="noopener noreferrer"
              className="mt-4 inline-block text-sm font-semibold text-lacquer underline underline-offset-4 hover:text-lacquer-deep"
            >
              Open in Google Maps
            </a>
            <span className="sr-only"> (opens in a new tab)</span>
          </div>

          <div className="rounded-2xl border border-paper-edge bg-white/50 p-7">
            <h3 className="font-display text-xl font-semibold text-sumi">Hours</h3>
            <dl className="mt-3 space-y-2.5 text-sm">
              {restaurant.hours.map((slot) => (
                <div key={slot.days}>
                  <dt className="font-medium text-sumi">{slot.days}</dt>
                  <dd className="text-sumi-muted">
                    {slot.open} – {slot.close}
                  </dd>
                </div>
              ))}
            </dl>
            <p className="mt-4 text-sm text-sumi-muted">
              Last unli order is taken one hour before closing.
            </p>
          </div>

          <div className="rounded-2xl border border-paper-edge bg-white/50 p-7 sm:col-span-2 lg:col-span-1">
            <h3 className="font-display text-xl font-semibold text-sumi">Get in touch</h3>
            <p className="mt-3 text-sm text-sumi-muted">
              For parties over 30, private events, or anything the form cannot cover, call the
              front desk.
            </p>
            <a
              href={restaurant.contact.phoneHref}
              className="mt-4 inline-block font-display text-2xl font-semibold text-lacquer hover:text-lacquer-deep"
            >
              {restaurant.contact.phone}
            </a>
            <p className="mt-3 text-sm text-sumi-muted">{fullAddress}</p>
          </div>
        </div>
      </div>
    </section>
  );
}
