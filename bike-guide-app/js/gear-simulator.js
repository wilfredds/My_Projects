// MTB 3×7 Gear Master Simulator
// Front chainrings: 22t, 32t, 42t
// Rear cassette:   34t, 28t, 24t, 21t, 18t, 15t, 12t

const FRONT = [22, 32, 42];
const REAR  = [34, 28, 24, 21, 18, 15, 12];
const FRONT_LABEL = ['Ring 1 (Granny)', 'Ring 2 (Middle)', 'Ring 3 (Big Ring)'];
const REAR_LABEL  = ['Cog 1 (Easiest)', 'Cog 2', 'Cog 3', 'Cog 4', 'Cog 5', 'Cog 6', 'Cog 7 (Hardest)'];

function getGearClass(fIdx, rIdx) {
  // Cross-chain: small front + small rear, or big front + big rear
  if ((fIdx === 0 && rIdx >= 5) || (fIdx === 2 && rIdx <= 1)) return 'gear-danger';
  const ratio = FRONT[fIdx] / REAR[rIdx];
  if (ratio < 1.1)  return 'gear-easy';
  if (ratio < 2.0)  return 'gear-medium';
  return 'gear-hard';
}

function getTerrainText(fIdx, rIdx) {
  const cls = getGearClass(fIdx, rIdx);
  const ratio = (FRONT[fIdx] / REAR[rIdx]).toFixed(2);
  if (cls === 'gear-danger') {
    return {
      terrain: '⚠️ Cross-Chain — Avoid This!',
      cadence: 'This combination puts extreme diagonal stress on your chain. Switch to adjacent rings.',
      color: '#c0392b'
    };
  }
  if (cls === 'gear-easy') return {
    terrain: '🏔️ Best For: Steep Climbs & Uphill',
    cadence: 'Keep cadence high (70–80 RPM). Spin, don\'t grind. Great for Tagaytay-style climbs.',
    color: '#2d6a4f'
  };
  if (cls === 'gear-medium') return {
    terrain: '🛣️ Best For: Flat Roads & Rolling Hills',
    cadence: 'Target 80–90 RPM for efficiency. Most of your road riding will be in this zone.',
    color: '#e65c00'
  };
  return {
    terrain: '⚡ Best For: Downhill & Speed Sections',
    cadence: 'Cadence may drop to 60–70 RPM in these gears — that\'s okay. Focus on power per stroke.',
    color: '#f4722b'
  };
}

function buildTable() {
  const table = document.getElementById('gear-table');
  if (!table) return;

  // Header row: rear cog labels
  const thead = table.querySelector('thead');
  const headerRow = document.createElement('tr');
  headerRow.innerHTML = '<th></th>' + REAR.map((t, i) => `<th>${i+1}<br><small>${t}t</small></th>`).join('');
  thead.appendChild(headerRow);

  // Rows: front rings
  const tbody = table.querySelector('tbody');
  FRONT.forEach((ft, fIdx) => {
    const row = document.createElement('tr');
    row.innerHTML = `<th style="font-size:0.62rem;text-align:right;padding-right:6px;white-space:nowrap;">${FRONT_LABEL[fIdx].split(' ')[0]}<br><small>${ft}t</small></th>`;
    REAR.forEach((rt, rIdx) => {
      const ratio = (ft / rt).toFixed(2);
      const cls   = getGearClass(fIdx, rIdx);
      const td    = document.createElement('td');
      td.className = `gear-cell ${cls}`;
      td.textContent = ratio;
      td.title = `Front ${ft}t / Rear ${rt}t`;
      td.addEventListener('click', () => selectGear(fIdx, rIdx, td));
      row.appendChild(td);
    });
    tbody.appendChild(row);
  });
}

function selectGear(fIdx, rIdx, cell) {
  document.querySelectorAll('.gear-cell').forEach(c => c.classList.remove('selected'));
  cell.classList.add('selected', 'anim-gear-highlight');
  setTimeout(() => cell.classList.remove('anim-gear-highlight'), 800);

  const ratio   = (FRONT[fIdx] / REAR[rIdx]).toFixed(2);
  const info    = getTerrainText(fIdx, rIdx);
  const infoEl  = document.getElementById('gear-info');

  infoEl.style.borderLeftColor = info.color;
  infoEl.innerHTML = `
    <div style="display:flex;align-items:flex-end;gap:8px;margin-bottom:8px;">
      <span class="ratio-display" style="color:${info.color};">${ratio}</span>
      <span class="ratio-label">gear ratio</span>
    </div>
    <p style="font-size:0.7rem;color:#888;margin-bottom:8px;">
      Front: <strong>${FRONT_LABEL[fIdx]}</strong> &nbsp;|&nbsp; Rear: <strong>${REAR_LABEL[rIdx]}</strong>
    </p>
    <p class="terrain-fit" style="color:${info.color};">${info.terrain}</p>
    <p class="cadence-tip">${info.cadence}</p>
  `;
}

buildTable();
