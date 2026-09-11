// ── Shared UX engine ──────────────────────────────────────────────
// Imported once via app.js, so every page that calls initPage() gets
// these enhancements for free: toasts, ripples, haptics, scroll-reveal,
// animated counters, smooth page transitions and an install prompt.

const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// ── Haptic feedback ──
export function haptic(pattern = 10) {
  if (navigator.vibrate) { try { navigator.vibrate(pattern); } catch (_) {} }
}

// ── Dark mode ──
export function getTheme() {
  return document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
}
export function setTheme(theme) {
  const dark = theme === 'dark';
  document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light');
  localStorage.setItem('theme', dark ? 'dark' : 'light');
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', dark ? '#11161e' : '#2d6a4f');
  document.querySelectorAll('.theme-toggle i').forEach(i => {
    i.className = dark ? 'fa-solid fa-sun' : 'fa-solid fa-moon';
  });
}
export function toggleTheme() {
  setTheme(getTheme() === 'dark' ? 'light' : 'dark');
  haptic(10);
}

function injectThemeToggle() {
  const host = document.querySelector('.top-actions');
  if (!host || host.querySelector('.theme-toggle')) return;
  const btn = document.createElement('button');
  btn.className = 'icon-btn theme-toggle no-ripple';
  btn.title = 'Toggle dark mode';
  btn.setAttribute('aria-label', 'Toggle dark mode');
  btn.innerHTML = `<i class="fa-solid ${getTheme() === 'dark' ? 'fa-sun' : 'fa-moon'}"></i>`;
  btn.addEventListener('click', toggleTheme);
  host.insertBefore(btn, host.firstChild);
}

// ── Confetti burst (lightweight DOM particles, no library) ──
export function confetti({ count = 90, duration = 2600 } = {}) {
  if (reduceMotion) return;
  const colors = ['#f4722b', '#ff9a5c', '#2d6a4f', '#52b788', '#ffd166', '#06d6a0', '#118ab2'];
  const host = document.createElement('div');
  host.className = 'confetti-host';
  document.body.appendChild(host);
  for (let i = 0; i < count; i++) {
    const p = document.createElement('span');
    p.className = 'confetti-piece';
    const size = 6 + Math.random() * 8;
    p.style.cssText =
      `left:${Math.random() * 100}vw;` +
      `width:${size}px;height:${size * (0.4 + Math.random() * 0.6)}px;` +
      `background:${colors[(Math.random() * colors.length) | 0]};` +
      `animation-delay:${Math.random() * 0.5}s;` +
      `animation-duration:${1.6 + Math.random() * 1.6}s;` +
      `transform:rotate(${Math.random() * 360}deg);` +
      `border-radius:${Math.random() > 0.5 ? '50%' : '2px'};`;
    host.appendChild(p);
  }
  setTimeout(() => host.remove(), duration + 600);
}

// ── Toasts ──
let toastHost;
export function toast(message, { type = 'info', duration = 2600, icon, action } = {}) {
  if (!toastHost) {
    toastHost = document.createElement('div');
    toastHost.className = 'toast-host';
    document.body.appendChild(toastHost);
  }
  const icons = { success: 'fa-circle-check', error: 'fa-circle-exclamation', info: 'fa-circle-info' };
  const el = document.createElement('div');
  el.className = `toast toast-${type}`;
  el.innerHTML = `<i class="fa-solid ${icon || icons[type] || icons.info}"></i><span></span>`;
  el.querySelector('span').textContent = message;
  const close = () => {
    el.classList.remove('show');
    el.addEventListener('transitionend', () => el.remove(), { once: true });
    setTimeout(() => el.remove(), 400);
  };
  if (action) {
    const b = document.createElement('button');
    b.className = 'toast-action';
    b.textContent = action.label;
    b.addEventListener('click', e => { e.stopPropagation(); action.onClick(); close(); });
    el.appendChild(b);
  }
  toastHost.appendChild(el);
  requestAnimationFrame(() => el.classList.add('show'));
  el.addEventListener('click', close);
  setTimeout(close, duration);
  return close;
}

// ── Animated number counter ──
export function countUp(el, to, { duration = 900, decimals = 0, suffix = '' } = {}) {
  if (!el) return;
  const target = Number(to) || 0;
  if (reduceMotion) { el.textContent = target.toFixed(decimals) + suffix; return; }
  const start = performance.now();
  const from = 0;
  const ease = t => 1 - Math.pow(1 - t, 3); // easeOutCubic
  function frame(now) {
    const p = Math.min((now - start) / duration, 1);
    const val = from + (target - from) * ease(p);
    el.textContent = val.toFixed(decimals) + suffix;
    if (p < 1) requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}

// ── Ripple on tap ──
function attachRipple(root = document) {
  root.addEventListener('pointerdown', e => {
    const target = e.target.closest('.module-card, .level-card, .challenge-strip, .btn-primary-green, .btn-orange, .submit-btn, .start-btn, .nav-item, .day-cell, .ripple');
    if (!target || target.classList.contains('no-ripple') || reduceMotion) return;
    const rect = target.getBoundingClientRect();
    const size = Math.max(rect.width, rect.height);
    const ink = document.createElement('span');
    ink.className = 'ripple-ink';
    ink.style.width = ink.style.height = size + 'px';
    ink.style.left = (e.clientX - rect.left - size / 2) + 'px';
    ink.style.top = (e.clientY - rect.top - size / 2) + 'px';
    const prevPos = getComputedStyle(target).position;
    if (prevPos === 'static') target.style.position = 'relative';
    target.appendChild(ink);
    ink.addEventListener('animationend', () => ink.remove());
  }, { passive: true });
}

// ── Scroll reveal with stagger ──
function setupReveal() {
  if (reduceMotion) return;
  const selector = '.module-card, .stat-card, .ride-item, .tip-card, .challenge-strip, .section-title, .card-base, .day-cell';
  const els = [...document.querySelectorAll(selector)].filter(el => !el.closest('.bottom-nav'));
  if (!els.length) return;
  const io = new IntersectionObserver((entries, obs) => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      const el = entry.target;
      const sibs = [...el.parentElement.children].filter(c => c.classList.contains('reveal'));
      const idx = sibs.indexOf(el);
      el.style.transitionDelay = Math.min(idx * 60, 360) + 'ms';
      el.classList.add('revealed');
      obs.unobserve(el);
    });
  }, { threshold: 0.08, rootMargin: '0px 0px -5% 0px' });
  els.forEach(el => { el.classList.add('reveal'); io.observe(el); });
}

// ── Haptics on key taps ──
function setupHaptics() {
  document.addEventListener('click', e => {
    if (e.target.closest('.nav-item, .module-card, .btn-primary-green, .btn-orange, .submit-btn, .start-btn, .day-cell, .chatbot-btn')) {
      haptic(8);
    }
  }, { passive: true });
}

// ── Smooth page transitions for same-app links ──
function setupPageTransitions() {
  if (reduceMotion) return;
  document.body.classList.add('page-enter');
  requestAnimationFrame(() => document.body.classList.add('page-enter-active'));

  document.addEventListener('click', e => {
    const a = e.target.closest('a[href]');
    if (!a) return;
    const href = a.getAttribute('href');
    if (!href || href.startsWith('#') || href.startsWith('http') || href.startsWith('mailto') ||
        a.target === '_blank' || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    if (!href.endsWith('.html')) return;
    e.preventDefault();
    document.body.classList.add('page-leave');
    setTimeout(() => { window.location.href = href; }, 180);
  });
}

// ── Add-to-Home-Screen install prompt ──
function setupInstallPrompt() {
  let deferred = null;
  window.addEventListener('beforeinstallprompt', e => {
    e.preventDefault();
    deferred = e;
    if (localStorage.getItem('a2hsDismissed') === 'true') return;
    const bar = document.createElement('div');
    bar.className = 'install-bar';
    bar.innerHTML = `
      <i class="fa-solid fa-bicycle"></i>
      <div class="install-text"><strong>Install Bike Guide PH</strong><span>Add to your home screen for the full app experience</span></div>
      <button class="install-yes">Install</button>
      <button class="install-no" aria-label="Dismiss">&times;</button>`;
    document.body.appendChild(bar);
    requestAnimationFrame(() => bar.classList.add('show'));
    bar.querySelector('.install-yes').onclick = async () => {
      bar.classList.remove('show');
      if (deferred) { deferred.prompt(); await deferred.userChoice; deferred = null; }
    };
    bar.querySelector('.install-no').onclick = () => {
      bar.classList.remove('show');
      localStorage.setItem('a2hsDismissed', 'true');
      setTimeout(() => bar.remove(), 400);
    };
  });
}

// ── Public initializer (called from initPage) ──
let started = false;
export function initUI() {
  if (started) return;
  started = true;
  const run = () => {
    injectThemeToggle();
    attachRipple();
    setupReveal();
    setupHaptics();
    setupPageTransitions();
    setupInstallPrompt();
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', run);
  else run();
}
