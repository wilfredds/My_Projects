/**
 * Each training track's own colour, from its screen in the design.
 *
 * Categories created later have no design to draw from, so they fall back to
 * the brand gradient rather than being given an invented identity.
 */
const CATEGORY_GRADIENTS: Record<string, string> = {
  fire: "var(--cat-fire)",
  water: "var(--cat-water)",
  land: "var(--cat-land)",
  equipment: "var(--cat-equipment)",
  fitness: "var(--cat-fitness)",
  sop: "var(--cat-sop)",
};

export function categoryGradient(categoryId: string): string {
  return CATEGORY_GRADIENTS[categoryId] ?? "var(--grad-cta)";
}
