/**
 * Every piece of business information the public site displays lives here, in
 * one file, so it can be corrected without touching a single component.
 *
 * ⚠️  PLACEHOLDERS — READ BEFORE DEPLOYING
 * The address, phone number, hours and prices below are stand-ins so the layout
 * has something realistic to render. They are NOT the real details of Hiroshi
 * Master Grill. Replace every value marked `PLACEHOLDER` with the real thing
 * before the site goes public — these values are also fed into the JSON-LD
 * structured data that Google reads, and publishing wrong hours or a wrong
 * phone number there is worse than publishing none at all.
 */

export const restaurant = {
  name: "Hiroshi Master Grill",
  shortName: "Hiroshi",
  cuisine: "Unlimited Samgyupsal",
  tagline: "Unli samgyupsal, grilled the way it should be.",
  description:
    "Korean-style unlimited grill in General Trias, Cavite. Marinated pork, " +
    "beef and chicken over a live grill, with unlimited side dishes, rice and " +
    "soup — plus a short rice and ramen menu for lighter appetites.",

  /** PLACEHOLDER — replace with the real street address. */
  address: {
    street: "123 Governor's Drive",
    barangay: "Barangay Manggahan",
    city: "General Trias",
    province: "Cavite",
    postalCode: "4107",
    country: "PH",
  },

  /** PLACEHOLDER — replace with the real contact details. */
  contact: {
    phone: "(046) 000-0000",
    phoneHref: "tel:+63460000000",
    email: "hello@example.com",
    facebook: "https://facebook.com/",
  },

  /** PLACEHOLDER — replace with the real trading hours. */
  hours: [
    { days: "Monday – Thursday", open: "11:00 AM", close: "10:00 PM" },
    { days: "Friday – Sunday", open: "11:00 AM", close: "11:00 PM" },
  ],

  /** Used by the structured data below. 24-hour, per Schema.org. */
  hoursSpec: [
    { days: ["Monday", "Tuesday", "Wednesday", "Thursday"], opens: "11:00", closes: "22:00" },
    { days: ["Friday", "Saturday", "Sunday"], opens: "11:00", closes: "23:00" },
  ],

  /** PLACEHOLDER — drop in the real coordinates from Google Maps. */
  geo: { latitude: 14.3869, longitude: 120.8817 },

  priceRange: "₱₱",
} as const;

export const fullAddress = [
  restaurant.address.street,
  restaurant.address.barangay,
  `${restaurant.address.city}, ${restaurant.address.province} ${restaurant.address.postalCode}`,
].join(", ");

export const mapsSearchUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
  `${restaurant.name}, ${fullAddress}`,
)}`;

/**
 * Schema.org Restaurant markup. Search engines use this to show hours, price
 * range and location directly in results — the single highest-leverage bit of
 * SEO for a local restaurant.
 */
export function restaurantJsonLd(siteUrl: string) {
  return {
    "@context": "https://schema.org",
    "@type": "Restaurant",
    name: restaurant.name,
    description: restaurant.description,
    servesCuisine: ["Korean", "Samgyupsal", "Barbecue"],
    priceRange: restaurant.priceRange,
    url: siteUrl,
    telephone: restaurant.contact.phone,
    address: {
      "@type": "PostalAddress",
      streetAddress: `${restaurant.address.street}, ${restaurant.address.barangay}`,
      addressLocality: restaurant.address.city,
      addressRegion: restaurant.address.province,
      postalCode: restaurant.address.postalCode,
      addressCountry: restaurant.address.country,
    },
    geo: {
      "@type": "GeoCoordinates",
      latitude: restaurant.geo.latitude,
      longitude: restaurant.geo.longitude,
    },
    openingHoursSpecification: restaurant.hoursSpec.map((slot) => ({
      "@type": "OpeningHoursSpecification",
      dayOfWeek: slot.days,
      opens: slot.opens,
      closes: slot.closes,
    })),
    acceptsReservations: true,
  };
}
