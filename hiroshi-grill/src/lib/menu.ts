/**
 * Menu content. Same rule as restaurant.ts: ⚠️ every price here is a
 * PLACEHOLDER. Swap in the real menu before launch.
 *
 * Package `id` values are the ones stored in `reservations.package`, so if you
 * rename a package, the historical rows keep the old id — change ids only if
 * you are willing to migrate the table.
 */

export type UnliPackage = {
  id: string;
  name: string;
  price: number;
  blurb: string;
  includes: string[];
  featured?: boolean;
};

export const unliPackages: UnliPackage[] = [
  {
    id: "classic",
    name: "Classic Unli",
    price: 399,
    blurb: "The everyday set. Six marinated cuts and the full side-dish bar.",
    includes: [
      "6 pork & chicken cuts, unlimited",
      "Unlimited side dishes (banchan)",
      "Unlimited rice, egg roll & soup",
      "Cheese dip and lettuce wraps",
      "2 hours dining time",
    ],
  },
  {
    id: "master",
    name: "Master Grill",
    price: 549,
    blurb: "Our house set — everything in Classic, plus the beef cuts.",
    includes: [
      "10 cuts including beef bulgogi & samgyupsal",
      "Unlimited side dishes (banchan)",
      "Unlimited rice, egg roll & soup",
      "Cheese dip, lettuce wraps & 1 dessert",
      "2 hours dining time",
    ],
    featured: true,
  },
  {
    id: "premium",
    name: "Premium Wagyu",
    price: 749,
    blurb: "Everything in Master Grill, plus wagyu cubes and seafood.",
    includes: [
      "14 cuts including wagyu cubes",
      "Shrimp, squid & scallop",
      "Unlimited side dishes (banchan)",
      "Unlimited rice, egg roll & soup",
      "Cheese dip, lettuce wraps & 1 dessert",
      "2 hours dining time",
    ],
  },
];

export type MenuItem = {
  name: string;
  price: number;
  note?: string;
};

export type MenuSection = {
  id: string;
  title: string;
  caption: string;
  items: MenuItem[];
};

export const alaCarteSections: MenuSection[] = [
  {
    id: "rice",
    title: "Rice Bowls",
    caption: "Grilled over rice, served in one bowl. No time limit.",
    items: [
      { name: "Pork Samgyupsal Bowl", price: 189, note: "Grilled pork belly, egg, kimchi" },
      { name: "Beef Bulgogi Bowl", price: 219, note: "Sweet soy beef, sesame, scallion" },
      { name: "Chicken Teriyaki Bowl", price: 179 },
      { name: "Spicy Pork Bowl", price: 199, note: "Gochujang marinade" },
      { name: "Extra Rice", price: 35 },
    ],
  },
  {
    id: "ramen",
    title: "Ramen & Soup",
    caption: "Made to order. Ask for it mild if you are sharing with kids.",
    items: [
      { name: "Shoyu Ramen", price: 229, note: "Soy broth, chashu, soft egg" },
      { name: "Spicy Miso Ramen", price: 249 },
      { name: "Tonkotsu Ramen", price: 269, note: "12-hour pork bone broth" },
      { name: "Kimchi Jjigae", price: 199, note: "Kimchi stew with pork and tofu" },
      { name: "Egg Drop Soup", price: 89 },
    ],
  },
  {
    id: "sides",
    title: "Sides & Drinks",
    caption: "Add-ons for the table.",
    items: [
      { name: "Cheesy Corn", price: 99 },
      { name: "Kimchi Pancake", price: 149 },
      { name: "Iced Tea (pitcher)", price: 120 },
      { name: "Soda in Can", price: 60 },
      { name: "Bottled Water", price: 30 },
    ],
  },
];

/**
 * House rules. Unli places live or die on these being stated plainly up front —
 * it is the difference between a firm policy and an argument at the table.
 */
export const houseRules: { title: string; detail: string }[] = [
  {
    title: "2 hours per table",
    detail:
      "Dining time starts when your first tray is served. We will give you a friendly heads-up at the 15-minute mark.",
  },
  {
    title: "Finish what you take",
    detail:
      "Unlimited means unlimited refills, not unlimited waste. Leftover meat is charged at ₱150 per 100 grams.",
  },
  {
    title: "One set per person",
    detail:
      "Everyone at the table dining on unli orders their own set. Sharing one set between two people is not allowed.",
  },
  {
    title: "No take-out from unli sets",
    detail: "Unli food is for dine-in only. The rice and ramen menu is available for take-out.",
  },
  {
    title: "Kids eat free under 4 ft",
    detail: "Children under 4 feet dine free with a paying adult. Please ask the host to measure at seating.",
  },
  {
    title: "Let the crew handle the grill",
    detail:
      "Our crew changes the grill plate and manages the fire. Please do not adjust the burner yourself — it is a safety rule, not a preference.",
  },
];
