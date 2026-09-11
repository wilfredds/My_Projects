import { initUI, toast, countUp, haptic, confetti, setTheme, getTheme, toggleTheme } from './ui.js';

// Re-export shared UX helpers so any page importing from app.js can use them.
export { toast, countUp, haptic, confetti, setTheme, getTheme, toggleTheme };

// ── User identity (device-based, no login required) ──
export function getUserId() {
  let id = localStorage.getItem('bikeUserId');
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem('bikeUserId', id);
  }
  return id;
}

// ── Rider level ──
export function getRiderLevel() {
  return localStorage.getItem('riderLevel') || 'beginner';
}
export function setRiderLevel(level) {
  localStorage.setItem('riderLevel', level);
}

// ── Premium ──
export function isPremium() {
  return localStorage.getItem('isPremium') === 'true';
}
export function setPremium(val) {
  localStorage.setItem('isPremium', val ? 'true' : 'false');
}

// ── Language ──
export function getLang() {
  return localStorage.getItem('lang') || 'en';
}
export function setLang(lang) {
  localStorage.setItem('lang', lang);
  applyLanguage(lang);
}

const strings = {
  en: {
    home: 'Home', challenge: 'Challenge', routes: 'Routes',
    tracker: 'Tracker', more: 'More',
    daily_tip: 'Daily Tip', good_morning: 'Good morning, Rider!',
    level_beginner: 'Beginner', level_intermediate: 'Intermediate', level_advanced: 'Advanced',
    unlock_premium: 'Unlock Premium ₱79',
  },
  tl: {
    home: 'Tahanan', challenge: 'Hamon', routes: 'Ruta',
    tracker: 'Talaan', more: 'Higit pa',
    daily_tip: 'Payo Ngayon', good_morning: 'Magandang umaga, Mangangahoy!',
    level_beginner: 'Baguhan', level_intermediate: 'Katamtaman', level_advanced: 'Beterano',
    unlock_premium: 'I-unlock ang Premium ₱79',
  }
};

export function applyLanguage(lang) {
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.dataset.i18n;
    if (strings[lang] && strings[lang][key]) {
      el.textContent = strings[lang][key];
    }
  });
}

// ── Bottom nav renderer ──
const navItems = [
  { icon: 'fa-house',        label: { en: 'Home',      tl: 'Tahanan'  }, href: 'dashboard.html', key: 'home' },
  { icon: 'fa-fire',         label: { en: 'Challenge', tl: 'Hamon'    }, href: 'challenge.html', key: 'challenge' },
  { icon: 'fa-location-crosshairs', label: { en: 'Record', tl: 'I-rekord' }, href: 'record.html', key: 'record', fab: true },
  { icon: 'fa-map-location-dot', label: { en: 'Routes', tl: 'Ruta'   }, href: 'routes.html',    key: 'routes' },
  { icon: 'fa-chart-line',   label: { en: 'Tracker',   tl: 'Talaan'  }, href: 'tracker.html',   key: 'tracker' },
];

export function renderBottomNav(activeKey) {
  const lang = getLang();
  const nav = document.getElementById('bottom-nav');
  if (!nav) return;
  nav.innerHTML = navItems.map(item => `
    <a class="nav-item ${item.fab ? 'nav-fab' : ''} ${item.key === activeKey ? 'active' : ''}" href="${item.href}">
      <i class="fa-solid ${item.icon}"></i>
      <span>${item.label[lang]}</span>
    </a>
  `).join('');
}

// ── Rider badge label ──
export function getRiderBadgeLabel() {
  const level = getRiderLevel();
  const lang = getLang();
  const map = { beginner: { en: 'Beginner', tl: 'Baguhan' }, intermediate: { en: 'Intermediate', tl: 'Katamtaman' }, advanced: { en: 'Advanced', tl: 'Beterano' } };
  return map[level]?.[lang] ?? level;
}

// ── Daily tip picker (deterministic by day of year) ──
export async function getDailyTip() {
  try {
    const resp = await fetch('assets/data/tips.json');
    const tips = await resp.json();
    const dayOfYear = Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 0)) / 86400000);
    const level = getRiderLevel();
    const filtered = tips.filter(t => !t.level || t.level === level || t.level === 'all');
    return filtered[dayOfYear % filtered.length];
  } catch {
    return { tip: 'Stay hydrated — drink water every 20 minutes on the road.', level: 'all' };
  }
}

// ── Page init helper ── call at top of each page
export function initPage(activeNavKey) {
  applyLanguage(getLang());
  renderBottomNav(activeNavKey);
  initUI();

  // Update rider badge if present
  const badge = document.getElementById('rider-badge');
  if (badge) badge.textContent = getRiderBadgeLabel();

  // Language toggle button
  const langBtn = document.getElementById('lang-toggle');
  if (langBtn) {
    const current = getLang();
    langBtn.textContent = current === 'en' ? 'TL' : 'EN';
    langBtn.addEventListener('click', () => {
      const next = getLang() === 'en' ? 'tl' : 'en';
      setLang(next);
      langBtn.textContent = next === 'en' ? 'TL' : 'EN';
    });
  }
}
