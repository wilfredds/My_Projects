// ── Voice co-pilot ────────────────────────────────────────────────
// Speaks hazard warnings the way Google Maps speaks turns. Uses the
// browser's built-in Web Speech API — free, no network, no API key.
//
// Two rules keep it from becoming annoying, which is the difference
// between a feature people love and one they mute on ride two:
//   1. Each hazard is announced at most once per cooldown window.
//   2. Announcements queue instead of talking over each other.

const COOLDOWN_MS = 5 * 60 * 1000;  // same hazard: at most once per 5 min
const MIN_GAP_MS  = 3000;           // never two alerts within 3 s

const spokenAt = new Map();   // hazardId -> timestamp
let queue = [];
let speaking = false;
let lastSpokeAt = 0;

export function isMuted() {
  return localStorage.getItem('voiceMuted') === 'true';
}
export function setMuted(v) {
  localStorage.setItem('voiceMuted', v ? 'true' : 'false');
  if (v) cancelAll();
}
export function toggleMuted() {
  const next = !isMuted();
  setMuted(next);
  return next;
}

// Short attention beep via Web Audio — cuts through road noise better
// than speech alone, and still works if speech synthesis is unavailable.
let audioCtx = null;
function beep(freq = 880, ms = 120) {
  try {
    audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === 'suspended') audioCtx.resume();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = 'sine';
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.0001, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.25, audioCtx.currentTime + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + ms / 1000);
    osc.connect(gain).connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + ms / 1000);
  } catch (_) { /* audio unavailable — speech and vibration still work */ }
}

function vibrate(pattern) {
  if (navigator.vibrate) { try { navigator.vibrate(pattern); } catch (_) {} }
}

function drain() {
  if (speaking || !queue.length) return;
  const gap = Date.now() - lastSpokeAt;
  if (gap < MIN_GAP_MS) { setTimeout(drain, MIN_GAP_MS - gap); return; }

  const item = queue.shift();
  speaking = true;

  const finish = () => {
    speaking = false;
    lastSpokeAt = Date.now();
    drain();
  };

  if (item.urgent) { beep(1040, 90); vibrate([80, 60, 80]); }
  else             { beep(760, 90);  vibrate(60); }

  if (!('speechSynthesis' in window)) { setTimeout(finish, 400); return; }

  try {
    const u = new SpeechSynthesisUtterance(item.text);
    u.rate = 1.05;
    u.pitch = 1.0;
    u.volume = 1.0;
    u.lang = item.lang || 'en-PH';
    u.onend = finish;
    u.onerror = finish;
    // Speak slightly after the beep so they don't collide.
    setTimeout(() => window.speechSynthesis.speak(u), 180);
  } catch (_) { setTimeout(finish, 400); }
}

// Queue a spoken alert. Returns false if suppressed.
export function say(text, { urgent = false, key = null, lang } = {}) {
  if (isMuted() || !text) return false;

  if (key) {
    const last = spokenAt.get(key) || 0;
    if (Date.now() - last < COOLDOWN_MS) return false;   // already warned recently
    spokenAt.set(key, Date.now());
  }

  queue.push({ text, urgent, lang });
  drain();
  return true;
}

// Bypasses the cooldown — for confirmations like "Pothole reported".
export function confirm(text) {
  if (isMuted()) { vibrate(40); return; }
  queue.push({ text, urgent: false });
  drain();
}

export function cancelAll() {
  queue = [];
  speaking = false;
  try { window.speechSynthesis?.cancel(); } catch (_) {}
}

// Forget cooldowns — call when a new ride starts.
export function resetSpoken() {
  spokenAt.clear();
  cancelAll();
}

// Some Android browsers need a user-gesture-triggered warm-up before
// speech will play at all. Call once from the ride's Start button.
export function warmUp() {
  try {
    audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === 'suspended') audioCtx.resume();
    if ('speechSynthesis' in window) {
      const u = new SpeechSynthesisUtterance(' ');
      u.volume = 0;
      window.speechSynthesis.speak(u);
    }
  } catch (_) {}
}
