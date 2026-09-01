// Core cost-splitting logic. Mirrors the spec exactly.
export function computeTotals(session) {
  const players = session?.players || [];
  const n = players.length;
  const courtFee = Number(session?.court_fee) || 0;
  const numShuttles = Number(session?.num_shuttles) || 0;
  const pricePerShuttle = Number(session?.price_per_shuttle) || 0;

  const totalShuttleCost = numShuttles * pricePerShuttle;
  const totalCost = courtFee + totalShuttleCost;

  const courtPortion = n > 0 ? courtFee / n : 0;
  const shuttlePortion = n > 0 ? totalShuttleCost / n : 0;
  const perPlayerShare = courtPortion + shuttlePortion;

  const paidCount = players.filter((p) => p.paid).length;
  const collected = paidCount * perPlayerShare;
  const outstanding = (n - paidCount) * perPlayerShare;

  return {
    numPlayers: n,
    courtFee,
    totalShuttleCost,
    totalCost,
    courtPortion,
    shuttlePortion,
    perPlayerShare,
    paidCount,
    unpaidCount: n - paidCount,
    collected,
    outstanding,
  };
}

export const round2 = (v) => Math.round((Number(v) || 0) * 100) / 100;
