// CO2 emission factors in kg per km (Philippine averages)
const EMISSION_FACTORS = {
  jeepney:    0.089,
  car:        0.192,
  motorcycle: 0.103,
  bus:        0.068,
};

// Bike emits effectively 0 direct CO2
export function calcCO2Saved(distanceKm, vehicle) {
  const factor = EMISSION_FACTORS[vehicle] ?? EMISSION_FACTORS.car;
  return +(distanceKm * factor).toFixed(3);
}

export function treesEquivalent(co2Kg) {
  // An average tree absorbs ~21 kg CO2/year → per day ≈ 0.0575 kg
  return +(co2Kg / 0.0575).toFixed(1);
}

export async function shareCarbonBadge(co2Kg, km) {
  const text = `🚴 I saved ${co2Kg} kg of CO₂ by cycling ${km} km instead of driving! Join me on Bike Guide PH. #BikeGuidePH #GreenCycling #EcoRider`;
  if (navigator.share) {
    await navigator.share({ title: 'My Carbon Save — Bike Guide PH', text });
  } else {
    await navigator.clipboard.writeText(text);
    alert('Copied to clipboard! Paste it anywhere to share.');
  }
}
