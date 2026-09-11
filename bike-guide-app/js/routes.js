let allRoutes = [];

export async function loadRoutes() {
  const res = await fetch('assets/data/routes.json');
  allRoutes = await res.json();
  return allRoutes;
}

export function filterRoutes({ difficulty, region, premiumUnlocked }) {
  return allRoutes.filter(r => {
    if (difficulty && difficulty !== 'all' && r.difficulty !== difficulty) return false;
    if (region     && region     !== 'all' && r.region !== region)         return false;
    if (!premiumUnlocked && r.isPremium)                                   return false;
    return true;
  });
}

export function buildMapUrl(route) {
  return `https://www.google.com/maps/search/?api=1&query=${route.lat},${route.lng}`;
}

export function buildDirectionsUrl(route) {
  return `https://www.google.com/maps/dir/?api=1&destination=${route.lat},${route.lng}&travelmode=bicycling`;
}

export function renderRouteCard(route, premiumUnlocked) {
  const isLocked = route.isPremium && !premiumUnlocked;
  const diffColor = { beginner:'#2d6a4f', intermediate:'#f4722b', advanced:'#c0392b' }[route.difficulty] || '#888';
  return `
    <div class="route-card card-base" style="margin-bottom:14px;border-radius:16px;overflow:hidden;${isLocked ? 'opacity:0.7;' : ''}">
      <div style="height:6px;background:${diffColor};"></div>
      <div style="padding:14px 16px;">
        <div style="display:flex;align-items:flex-start;gap:10px;margin-bottom:8px;">
          <div style="flex:1;">
            <div style="font-size:0.95rem;font-weight:700;color:var(--dark);">${isLocked ? '🔒 ' : ''}${route.name}</div>
            <div style="font-size:0.72rem;color:var(--text-muted);">${route.region} · ${route.city}</div>
          </div>
          <span style="background:${diffColor};color:#fff;font-size:0.65rem;font-weight:700;padding:4px 10px;border-radius:50px;white-space:nowrap;text-transform:capitalize;">${route.difficulty}</span>
        </div>
        <div style="display:flex;gap:12px;margin-bottom:10px;">
          <span style="font-size:0.78rem;color:var(--text-soft);"><i class="fa-solid fa-route" style="color:#2d6a4f;"></i> ${route.distanceKm} km</span>
          <span style="font-size:0.78rem;color:var(--text-soft);"><i class="fa-solid fa-mountain" style="color:#2980b9;"></i> ${route.elevationM}m gain</span>
          <span style="font-size:0.78rem;color:var(--text-soft);"><i class="fa-regular fa-clock" style="color:#f4722b;"></i> ${route.estimatedHours}h</span>
        </div>
        <p style="font-size:0.78rem;color:var(--text-soft);margin-bottom:10px;">${route.description}</p>
        <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:10px;">
          ${route.highlights.map(h => `<span style="background:#f0f7f4;color:#2d6a4f;font-size:0.65rem;font-weight:600;padding:3px 8px;border-radius:50px;">${h}</span>`).join('')}
        </div>
        <div style="font-size:0.72rem;color:var(--text-muted);margin-bottom:10px;"><i class="fa-regular fa-sun"></i> Best time: ${route.bestTime}</div>
        ${isLocked
          ? `<button onclick="window.location.href='premium.html'" style="width:100%;padding:10px;background:linear-gradient(135deg,#f4722b,#ff9a5c);color:#fff;border:none;border-radius:50px;font-family:'Poppins',sans-serif;font-size:0.82rem;font-weight:700;cursor:pointer;">🔓 Unlock Premium — ₱79</button>`
          : `<div style="display:flex;gap:8px;">
              <a href="${buildMapUrl(route)}" target="_blank" style="flex:1;display:block;text-align:center;padding:9px;background:#f0f7f4;color:#2d6a4f;border-radius:50px;font-size:0.78rem;font-weight:700;text-decoration:none;"><i class="fa-solid fa-map-pin"></i> View Map</a>
              <a href="${buildDirectionsUrl(route)}" target="_blank" style="flex:1;display:block;text-align:center;padding:9px;background:#2d6a4f;color:#fff;border-radius:50px;font-size:0.78rem;font-weight:700;text-decoration:none;"><i class="fa-solid fa-diamond-turn-right"></i> Directions</a>
            </div>`
        }
      </div>
    </div>
  `;
}
