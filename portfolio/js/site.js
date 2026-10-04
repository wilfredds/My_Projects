/* ==========================================================================
   Portfolio behaviour.

   Everything here is an enhancement. Every word on every page is already in
   the HTML, so the site reads fine with this file blocked or broken.
   ========================================================================== */

(function () {
  'use strict';

  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* -------------------------------------------------------------- theme --
     boot.js has already applied any saved choice. This only handles the
     button, and keeps its label describing what pressing it will do.       */
  var themeToggle = document.getElementById('theme-toggle');

  if (themeToggle) {
    var systemLight = window.matchMedia('(prefers-color-scheme: light)');

    var currentTheme = function () {
      var set = document.documentElement.getAttribute('data-theme');
      if (set === 'light' || set === 'dark') return set;
      return systemLight.matches ? 'light' : 'dark';
    };

    var describe = function () {
      var next = currentTheme() === 'dark' ? 'light' : 'dark';
      themeToggle.setAttribute('aria-label', 'Switch to ' + next + ' theme');
    };

    var fadeTimer = null;

    themeToggle.addEventListener('click', function () {
      var next = currentTheme() === 'dark' ? 'light' : 'dark';

      if (!reduceMotion) {
        document.documentElement.classList.add('theme-switching');
        window.clearTimeout(fadeTimer);
        fadeTimer = window.setTimeout(function () {
          document.documentElement.classList.remove('theme-switching');
        }, 320);
      }

      document.documentElement.setAttribute('data-theme', next);

      try {
        window.localStorage.setItem('theme', next);
      } catch (e) {
        // Nothing to do. The choice still holds for this page view.
      }

      describe();
    });

    // Somebody who never pressed the button should follow their system when
    // it changes under them.
    systemLight.addEventListener('change', describe);

    describe();
  }

  /* --------------------------------------------------------------- year -- */
  var year = document.getElementById('year');
  if (year) year.textContent = String(new Date().getFullYear());

  /* ----------------------------------------------------- reveal on scroll */
  /* The hero is always the first screen, so it does not wait for the
     observer: its headline and portrait start fully masked, and Chromium
     reports a fully clip-pathed element as not intersecting at all, so an
     observer would wait for them forever. They start on the next frame
     instead, after the masked state has painted, so the transition runs. */
  var heroReveals = document.querySelectorAll('.hero .reveal');
  window.requestAnimationFrame(function () {
    window.requestAnimationFrame(function () {
      heroReveals.forEach(function (el) { el.classList.add('in'); });
    });
  });
  var revealables = document.querySelectorAll('.reveal:not(.hero .reveal), .reveal-head');

  if (reduceMotion || !('IntersectionObserver' in window)) {
    revealables.forEach(function (el) { el.classList.add('in'); });
  } else {
    var revealObserver = new IntersectionObserver(function (entries) {
      // Stagger by arrival, not by position in the document. A row of cards
      // scrolled into view together cascades; a single card that comes into
      // view on its own appears immediately, with nothing to wait for.
      var arriving = entries
        .filter(function (entry) { return entry.isIntersecting; })
        .map(function (entry) { return entry.target; })
        .sort(function (a, b) {
          return a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1;
        });

      arriving.forEach(function (el, i) {
        el.style.setProperty('--d', Math.min(i, 6) * 70 + 'ms');
        el.classList.add('in');
        revealObserver.unobserve(el);
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });

    revealables.forEach(function (el) { revealObserver.observe(el); });
  }

  /* ----------------------------------------------------------- counters --
     The final number is already the element's text, so a browser without
     IntersectionObserver just shows it.                                    */
  if (!reduceMotion && 'IntersectionObserver' in window) {
    var countObserver = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        countUp(entry.target);
        countObserver.unobserve(entry.target);
      });
    }, { threshold: 0.6 });

    document.querySelectorAll('[data-count]').forEach(function (el) {
      countObserver.observe(el);
    });
  }

  function countUp(el) {
    var target = parseInt(el.getAttribute('data-count'), 10);
    if (!isFinite(target)) return;

    var duration = 900;
    var started = null;

    function step(now) {
      if (started === null) started = now;
      var progress = Math.min((now - started) / duration, 1);
      var eased = 1 - Math.pow(1 - progress, 3);
      el.textContent = String(Math.round(target * eased));
      if (progress < 1) requestAnimationFrame(step);
      else el.textContent = String(target);
    }

    requestAnimationFrame(step);
  }

  /* ==================================================================== */
  /*  Interactive terminal                                                */
  /* ==================================================================== */

  var PROJECTS = {
    floodguard: {
      line: 'Capstone. IoT and AI flood warning, Noveleta.'
    },
    autocare: {
      path: 'projects/autocare.html',
      line: 'Next.js and Postgres. Job system for a car shop.'
    },
    rallyready: {
      path: 'projects/rallyready.html',
      line: 'React and TypeScript. Badminton drills, 648 tests.'
    },
    'badminton-ph': {
      href: 'https://badminton-ph.web.app',
      line: 'React. Live tournament platform on Firebase.'
    },
    'hiroshi-grill': {
      path: 'projects/hiroshi-master-grill.html',
      line: 'Next.js 16 and Supabase. Client booking app.'
    },
    cyclemind_ai: {
      path: 'projects/cyclemind-ai.html',
      line: 'Flutter and Firebase. AI coach and bike doctor.'
    },
    'bike-guide-app': {
      path: 'projects/bike-guide-ph.html',
      line: 'Vanilla JS PWA. Gear guide, routes, offline.'
    },
    'corruption-watch': {
      path: 'projects/corruption-watch-ph.html',
      line: 'Firebase. Anonymous reporting, tested rules.'
    },
    hiraya: {
      line: 'Unity 6 and C#. Filipino MMORPG, in progress.'
    }
  };

  var COMMANDS = [
    'help', 'whoami', 'ls', 'open', 'skills', 'education', 'capstone',
    'certs', 'contact', 'resume', 'github', 'clear', 'sudo'
  ];

  var term = document.getElementById('term');

  if (term) {
    var out = document.getElementById('term-out');
    var body = document.getElementById('term-body');
    var form = document.getElementById('term-form');
    var input = document.getElementById('term-input');
    var idle = document.getElementById('term-idle');
    var hint = document.getElementById('term-hint');

    var history = [];
    var historyAt = -1;

    /* --- printing ----------------------------------------------------- */
    function line(text, cls) {
      var el = document.createElement('span');
      el.className = 'line ' + (cls || 'out');
      el.textContent = text;
      out.appendChild(el);
      return el;
    }

    function blank() {
      line(' ', 'out');
    }

    function echo(command) {
      var el = document.createElement('span');
      el.className = 'line';

      var p = document.createElement('span');
      p.className = 'prompt';
      p.textContent = '$';

      var c = document.createElement('span');
      c.className = 'cmdtext';
      c.textContent = command;

      el.appendChild(p);
      el.appendChild(c);
      out.appendChild(el);
    }

    function link(text, href) {
      var el = document.createElement('span');
      el.className = 'line out';

      var a = document.createElement('a');
      a.href = href;
      a.textContent = text;

      el.appendChild(a);
      out.appendChild(el);
    }

    function scrollDown() {
      body.scrollTop = body.scrollHeight;
    }

    /* --- commands ------------------------------------------------------ */
    function run(raw) {
      var parts = raw.trim().split(/\s+/);
      var cmd = (parts[0] || '').toLowerCase();
      var arg = parts.slice(1).join(' ').toLowerCase();

      if (!cmd) return;

      switch (cmd) {
        case 'help':
          line('Commands you can run here:', 'out-strong');
          line('  whoami       who is behind this site');
          line('  ls           list the five projects');
          line('  open <name>  open a project write-up');
          line('  skills       what I work with');
          line('  education    where I study');
          line('  capstone     the FloodGuard project');
          line('  certs        certifications');
          line('  contact      how to reach me');
          line('  resume       open the résumé');
          line('  github       open my GitHub');
          line('  clear        wipe the screen');
          blank();
          line('Tab completes, arrow keys walk your history.', 'faint');
          break;

        case 'whoami':
          line('Francis Wilfred Antiporda', 'out-strong');
          line('Fourth-year BSIT at Lyceum of the Philippines University, Cavite.');
          line('Full-stack developer in General Trias, Cavite.');
          line('Front-end developer intern at Certicode since September 2026. Still looking for an OJT placement, and open to freelance work.');
          break;

        case 'ls':
          Object.keys(PROJECTS).forEach(function (name) {
            line(pad(name + '/') + PROJECTS[name].line, 'out ls-row');
          });
          blank();
          line('Run "open autocare" to read one of them.', 'faint');
          break;

        case 'open':
        case 'cd':
          openProject(arg);
          break;

        case 'skills':
          line('languages   TypeScript, JavaScript, Dart, C#, Python, SQL');
          line('frontend    React, Next.js, Flutter, Vite, Tailwind, PWA');
          line('backend     Node.js, Prisma, PostgreSQL, Firebase, Supabase');
          line('networking  Cisco CCNA, Networking Basics, Ethical Hacker');
          line('data        SQL, Python, pandas, cleaning, visualisation');
          line('cloud       AWS Educate, Vercel, Firebase Hosting, Neon');
          line('games       Unity 6, C#');
          line('testing     Vitest, node:test, Playwright, Firestore emulator');
          line('deploy      Vercel, Firebase Hosting, Neon, GitHub Pages');
          break;

        case 'education':
          line('Lyceum of the Philippines University, Cavite', 'out-strong');
          line('BS Information Technology, 4th year, expected 2027.');
          line('Capstone: FloodGuard. Run "capstone" for the details.');
          break;

        case 'capstone':
          line('FloodGuard', 'out-strong');
          line('A Predictive IoT and Artificial Intelligence Flood Monitoring and');
          line('Early Warning System with Automated SMS Notification for the');
          line('Municipality of Noveleta, Cavite.');
          blank();
          line('Role: team leader.', 'out-strong');
          break;

        case 'certs':
          line('DataCamp          Associate Data Analyst             Sep 2026');
          line('Cisco NetAcad     Ethical Hacker                     Jul 2026');
          line('Cisco NetAcad     Networking Basics                  Feb 2026');
          line('Cisco NetAcad     CCNA: Introduction to Networks     Jan 2026');
          line('SAP / Erudite     SAP Business One Courseware        May 2025');
          line('Cisco / OpenEDG   Python Essentials 2                May 2024');
          line('AWS Educate       Getting Started with Compute       trained');
          blank();
          line('Six of the seven are scanned on the certifications section.');
          break;

        case 'contact':
          line('email     frncishub@gmail.com');
          line('github    github.com/wilfredds');
          line('linkedin  linkedin.com/in/francis-wilfred-antiporda-530273345');
          line('location  General Trias, Cavite, Philippines');
          blank();
          link('Send me an email', 'mailto:frncishub@gmail.com');
          break;

        case 'resume':
          line('Opening the résumé.');
          go('resume.html');
          break;

        case 'github':
          line('Opening github.com/wilfredds in a new tab.');
          window.open('https://github.com/wilfredds', '_blank', 'noopener');
          break;

        case 'clear':
          out.innerHTML = '';
          break;

        case 'sudo':
          line('Nice try. You already have everything you need on this page.', 'out-strong');
          line('Try "contact" instead.', 'faint');
          break;

        default:
          line('command not found: ' + cmd, 'err');
          line('Type "help" to see what works.', 'faint');
      }
    }

    function pad(text) {
      while (text.length < 20) text += ' ';
      return text;
    }

    function openProject(name) {
      if (!name) {
        line('Which one? Try: open autocare', 'err');
        return;
      }

      var key = Object.keys(PROJECTS).filter(function (p) {
        return p === name || p.indexOf(name) === 0 || p.replace(/[-_]/g, '') === name.replace(/[-_ ]/g, '');
      })[0];

      if (!key) {
        line('No project called "' + name + '". Run "ls" to see them.', 'err');
        return;
      }

      var entry = PROJECTS[key];

      if (entry.path) {
        line('Opening ' + key + '.');
        go(entry.path);
        return;
      }

      if (entry.href) {
        line('Opening ' + entry.href + ' in a new tab.');
        window.open(entry.href, '_blank', 'noopener');
        return;
      }

      line(key, 'out-strong');
      line(entry.line);
      line('No write-up page for this one yet. Run "contact" to ask me about it.', 'faint');
    }

    function go(href) {
      window.setTimeout(function () { window.location.href = href; }, 350);
    }

    /* --- start it up ---------------------------------------------------- */
    function enable() {
      if (idle) idle.hidden = true;
      if (hint) hint.hidden = false;
      form.hidden = false;
    }

    var introLines = Array.prototype.slice.call(out.querySelectorAll('.line'));

    if (reduceMotion) {
      enable();
    } else {
      var originals = introLines.map(function (el) { return el.innerHTML; });
      introLines.forEach(function (el) { el.style.visibility = 'hidden'; });

      var at = 0;

      var play = function () {
        if (at >= introLines.length) {
          enable();
          return;
        }

        var el = introLines[at];
        var cmd = el.querySelector('.cmdtext');
        el.style.visibility = 'visible';

        if (!cmd) {
          at += 1;
          window.setTimeout(play, 190);
          return;
        }

        var text = cmd.textContent;
        cmd.textContent = '';
        var char = 0;

        (function type() {
          if (char <= text.length) {
            cmd.textContent = text.slice(0, char);
            char += 1;
            window.setTimeout(type, 34);
            return;
          }
          at += 1;
          window.setTimeout(play, 240);
        })();
      };

      // Somebody who tabs away and comes back should not find a half-typed
      // prompt waiting for them.
      document.addEventListener('visibilitychange', function () {
        if (!document.hidden || at >= introLines.length) return;
        introLines.forEach(function (el, i) {
          el.innerHTML = originals[i];
          el.style.visibility = 'visible';
        });
        at = introLines.length;
        enable();
      });

      window.setTimeout(play, 260);
    }

    form.addEventListener('submit', function (event) {
      event.preventDefault();

      var raw = input.value;
      if (!raw.trim()) return;

      echo(raw);
      history.push(raw);
      historyAt = history.length;

      run(raw);
      input.value = '';
      scrollDown();
    });

    input.addEventListener('keydown', function (event) {
      if (event.key === 'ArrowUp') {
        if (!history.length) return;
        event.preventDefault();
        historyAt = Math.max(0, historyAt - 1);
        input.value = history[historyAt];
        return;
      }

      if (event.key === 'ArrowDown') {
        if (!history.length) return;
        event.preventDefault();
        historyAt = Math.min(history.length, historyAt + 1);
        input.value = historyAt === history.length ? '' : history[historyAt];
        return;
      }

      if (event.key === 'Tab') {
        var value = input.value;
        var words = value.split(/\s+/);
        var pool = words.length > 1 ? Object.keys(PROJECTS) : COMMANDS;
        var stub = words[words.length - 1].toLowerCase();
        if (!stub) return;

        var hit = pool.filter(function (c) { return c.indexOf(stub) === 0; })[0];
        if (!hit) return;

        event.preventDefault();
        words[words.length - 1] = hit;
        input.value = words.join(' ') + ' ';
      }
    });

    // Clicking anywhere in the terminal focuses the prompt, the way a real one
    // behaves. Selecting text is left alone.
    body.addEventListener('click', function () {
      if (form.hidden) return;
      if (String(window.getSelection())) return;
      input.focus();
    });
  }

  /* ==================================================================== */
  /*  Project filtering                                                   */
  /* ==================================================================== */

  var filters = document.getElementById('filters');

  if (filters) {
    var cards = Array.prototype.slice.call(
      document.querySelectorAll('#projects-list .card')
    );
    var chips = Array.prototype.slice.call(filters.querySelectorAll('.chip'));
    var status = document.getElementById('filter-status');
    var empty = document.getElementById('filter-empty');
    var count = document.getElementById('project-count');

    filters.hidden = false;

    function apply(tech) {
      var shown = 0;

      cards.forEach(function (card) {
        var tags = (card.getAttribute('data-tech') || '').split(/\s+/);
        var match = tech === 'all' || tags.indexOf(tech) !== -1;
        var wasHidden = card.hidden;

        card.hidden = !match;
        if (!match) return;

        shown += 1;

        // display:none swallows transitions, so a card returning to the list
        // replays a one-shot animation instead.
        if (wasHidden && !reduceMotion) {
          card.classList.remove('is-entering');
          void card.offsetWidth;
          card.classList.add('is-entering');
        }
      });

      chips.forEach(function (chip) {
        var on = chip.getAttribute('data-filter') === tech;
        chip.classList.toggle('is-on', on);
        chip.setAttribute('aria-pressed', on ? 'true' : 'false');
      });

      if (count) {
        count.textContent = shown + (shown === 1 ? ' project' : ' projects');
      }

      if (status) {
        status.textContent = tech === 'all'
          ? ''
          : 'Showing ' + shown + ' of ' + cards.length + ' projects built with ' + label(tech) + '.';
      }

      if (empty) empty.hidden = shown !== 0;
    }

    function label(tech) {
      var chip = chips.filter(function (c) {
        return c.getAttribute('data-filter') === tech;
      })[0];
      return chip ? chip.textContent : tech;
    }

    chips.forEach(function (chip) {
      chip.addEventListener('click', function () {
        apply(chip.getAttribute('data-filter'));
      });
    });

    var reset = document.querySelector('[data-filter-reset]');
    if (reset) {
      reset.addEventListener('click', function () { apply('all'); });
    }
  }

  /* ==================================================================== */
  /*  Copy to clipboard                                                   */
  /* ==================================================================== */

  document.querySelectorAll('[data-copy]').forEach(function (button) {
    var original = button.textContent;

    button.addEventListener('click', function () {
      var text = button.getAttribute('data-copy');

      copy(text).then(function (ok) {
        button.textContent = ok ? 'Copied' : text;
        button.classList.toggle('is-copied', ok);

        window.setTimeout(function () {
          button.textContent = original;
          button.classList.remove('is-copied');
        }, 1800);
      });
    });
  });

  function copy(text) {
    if (navigator.clipboard && window.isSecureContext) {
      return navigator.clipboard.writeText(text)
        .then(function () { return true; })
        .catch(function () { return false; });
    }

    // Older browsers, and any page served over plain http.
    var field = document.createElement('textarea');
    field.value = text;
    field.setAttribute('readonly', '');
    field.style.position = 'fixed';
    field.style.opacity = '0';
    document.body.appendChild(field);
    field.select();

    var ok = false;
    try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
    document.body.removeChild(field);

    return Promise.resolve(ok);
  }

  /* ==================================================================== */
  /*  Reading progress, back to top, active section                       */
  /* ==================================================================== */

  var progress = document.getElementById('progress');
  var progressBar = document.getElementById('progress-bar');
  var toTop = document.getElementById('to-top');

  if (progress && progressBar) progress.hidden = false;

  if (toTop) {
    toTop.addEventListener('click', function () {
      window.scrollTo({ top: 0, behavior: reduceMotion ? 'auto' : 'smooth' });
    });
  }

  var ticking = false;

  function onScroll() {
    if (ticking) return;
    ticking = true;

    window.requestAnimationFrame(function () {
      var top = window.scrollY || document.documentElement.scrollTop;

      if (progressBar) {
        var height = document.documentElement.scrollHeight - window.innerHeight;
        var pct = height > 0 ? Math.min(top / height, 1) : 0;
        progressBar.style.transform = 'scaleX(' + pct + ')';
      }

      if (toTop) toTop.hidden = top < 600;

      ticking = false;
    });
  }

  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  /* --- the contact sheet's scroll-linked pan ----------------------------
     The strip of bootcamp frames is wider than the page. Its baseline is a
     plain horizontal scroller, which already works with a swipe, a trackpad
     and the keyboard; this maps the section's own travel through the viewport
     onto that strip, so the roll advances as the page is read.

     It is deliberately narrow in scope. On a touch screen a scroll-linked pan
     fights momentum scrolling and takes the swipe away from the visitor, so
     there it stays a native scroller. The same goes for anyone who asked for
     less motion, and for a window too narrow for the pan to have anywhere to
     go.                                                                    */
  /* The deal-in staggers by each frame's place in the sheet. The index used to
     sit in a style="--i: n" attribute, which the Content-Security-Policy
     blocks, so in production the stagger never applied. Setting it through
     the CSSOM is allowed. */
  document.querySelectorAll('.sheet .frame').forEach(function (frame, i) {
    frame.style.setProperty('--i', i);
  });

  var rail = document.getElementById('sheet-rail');
  var strip = document.getElementById('sheet-strip');

  if (rail && strip && !reduceMotion &&
      window.matchMedia('(min-width: 900px) and (pointer: fine)').matches) {

    var panMax = 0;
    var panTicking = false;

    function measurePan() {
      // Measure against the rail's content box, not its border box. The rail
      // is padded by a full page gutter on each side so the first frame lines
      // up with every other section, and clientWidth includes that padding:
      // using it left the strip 160px short at 1280px wide and the last frame
      // never finished arriving.
      var style = window.getComputedStyle(rail);
      var inner = rail.clientWidth -
        parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
      panMax = Math.max(0, strip.scrollWidth - inner);
      if (panMax === 0) {
        rail.classList.remove('is-panning');
        strip.style.transform = '';
      } else {
        rail.classList.add('is-panning');
      }

      /* The markup tells a visitor to swipe, which is true of the scroller
         underneath and false the moment this pan takes over. Keep the hint
         describing what is actually on. */
      var hint = document.getElementById('sheet-hint');
      if (hint) {
        hint.textContent = panMax
          ? 'The strip advances as you scroll.'
          : 'Swipe the strip to move through it.';
      }
    }

    function drawPan() {
      panTicking = false;
      if (!panMax) return;

      var box = rail.getBoundingClientRect();
      var view = window.innerHeight || document.documentElement.clientHeight;

      // 0 as the rail's top reaches the bottom of the viewport, 1 as its
      // bottom leaves the top.
      var travel = view + box.height;
      var raw = (view - box.top) / travel;

      // Hold still at both ends. Without this the strip is already half way
      // along before the section is properly on screen, and the last frame
      // never sits still long enough to be read.
      var eased = (raw - 0.18) / 0.54;
      eased = Math.max(0, Math.min(1, eased));

      strip.style.transform = 'translate3d(' + (-eased * panMax).toFixed(1) + 'px, 0, 0)';
    }

    function onPanScroll() {
      if (panTicking) return;
      panTicking = true;
      window.requestAnimationFrame(drawPan);
    }

    measurePan();
    drawPan();
    window.addEventListener('scroll', onPanScroll, { passive: true });
    window.addEventListener('resize', function () { measurePan(); drawPan(); });

    // The frames are lazy-loaded, so the strip is narrower than its final
    // width until they arrive. Re-measure as each one lands.
    strip.querySelectorAll('img').forEach(function (img) {
      if (img.complete) return;
      img.addEventListener('load', function () { measurePan(); drawPan(); });
    });
  }

  /* --- certificate lightbox --------------------------------------------
     Every .cert-shot button carries its own image and caption in data
     attributes, so one overlay serves all of them and adding a certificate
     needs no JavaScript change.                                           */
  var lightbox = document.getElementById('lightbox');

  if (lightbox) {
    var lbImg = document.getElementById('lightbox-img');
    var lbTitle = document.getElementById('lightbox-title');
    var lbNote = document.getElementById('lightbox-note');
    var lbClose = document.getElementById('lightbox-close');
    var lastOpener = null;

    function openCert(button) {
      var img = button.querySelector('img');

      lbImg.src = button.getAttribute('data-cert-src');
      /* The thumbnail already describes the document. Reusing its alt keeps
         one description rather than two that can drift apart. */
      lbImg.alt = img ? img.alt : '';
      lbTitle.textContent = button.getAttribute('data-cert-title') || '';
      /* The parser has already decoded the entities in the attribute, so this
         is plain text by the time it gets here. No innerHTML needed. */
      lbNote.textContent = button.getAttribute('data-cert-note') || '';

      lastOpener = button;
      lightbox.hidden = false;
      document.body.classList.add('is-locked');
      lbClose.focus();
    }

    function closeCert() {
      lightbox.hidden = true;
      /* removeAttribute, not src = '': an empty src resolves to the page URL
         and the browser fetches the document a second time. */
      lbImg.removeAttribute('src');
      document.body.classList.remove('is-locked');
      /* Send focus back where it came from, or a keyboard visitor is dropped
         at the top of the document. */
      if (lastOpener) lastOpener.focus();
      lastOpener = null;
    }

    document.querySelectorAll('.cert-shot[data-cert-src]').forEach(function (button) {
      button.addEventListener('click', function () { openCert(button); });
    });

    lbClose.addEventListener('click', closeCert);

    /* Clicking the backdrop closes. Clicking the certificate itself does not,
       so a visitor reading it cannot dismiss it by accident. */
    lightbox.addEventListener('click', function (event) {
      if (event.target === lightbox || event.target.classList.contains('lightbox-stage')) {
        closeCert();
      }
    });

    document.addEventListener('keydown', function (event) {
      if (lightbox.hidden) return;

      if (event.key === 'Escape') {
        closeCert();
        return;
      }

      /* Only the close button is focusable inside, so Tab holds it there
         rather than walking the page behind the overlay. */
      if (event.key === 'Tab') {
        event.preventDefault();
        lbClose.focus();
      }
    });
  }

  /* --- résumé: print / save as PDF ------------------------------------- */
  var printBtn = document.getElementById('print-cv');
  if (printBtn) {
    printBtn.addEventListener('click', function () { window.print(); });
  }

  /* --- the blueprint lens ----------------------------------------------
     The hero promises "the parts that never make it into a demo". This shows
     them. A clone of the hero is redrawn as a cyanotype working drawing and
     laid exactly over the original; a circle that follows the pointer cuts a
     window through to it. Every number on the drawing is measured here, in the
     visitor's browser, when the drawing is drawn. Nothing is typed in.

     Paint and layout-shift entries are buffered by the browser, but only for
     an observer that exists, so these start now and are read later. */
  var vitals = { lcp: null, cls: 0, hasCls: false };
  if ('PerformanceObserver' in window && PerformanceObserver.supportedEntryTypes) {
    var entryTypes = PerformanceObserver.supportedEntryTypes;
    try {
      if (entryTypes.indexOf('largest-contentful-paint') !== -1) {
        new PerformanceObserver(function (list) {
          var all = list.getEntries();
          vitals.lcp = all[all.length - 1].startTime;
        }).observe({ type: 'largest-contentful-paint', buffered: true });
      }
      if (entryTypes.indexOf('layout-shift') !== -1) {
        vitals.hasCls = true;
        new PerformanceObserver(function (list) {
          list.getEntries().forEach(function (e) {
            if (!e.hadRecentInput) vitals.cls += e.value;
          });
        }).observe({ type: 'layout-shift', buffered: true });
      }
    } catch (e) {
      // An older engine that lists a type but rejects the options: go without.
    }
  }

  var bpHero = document.querySelector('.hero');
  var bpToggle = document.getElementById('bp-toggle');
  var bpHint = document.getElementById('bp-hint');
  var bpSummary = document.getElementById('bp-summary');

  if (bpHero && bpToggle && window.CSS && CSS.supports &&
      CSS.supports('clip-path', 'circle(1px at 1px 1px)')) {

    var SVGNS = 'http://www.w3.org/2000/svg';
    var finePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
    var bpOriginal = {
      grid: bpHero.querySelector('.hero-grid'),
      kicker: bpHero.querySelector('.hero-kicker'),
      h1: bpHero.querySelector('h1'),
      blurb: bpHero.querySelector('.hero-blurb'),
      buttons: bpHero.querySelectorAll('.hero-actions .btn'),
      img: bpHero.querySelector('.portrait img')
    };
    var bp = { x: 0, y: 0, tx: 0, ty: 0, r: 0, tr: 0, raf: 0, pinned: false, touched: false };
    var bpLayer = null;
    var bpInk = null;
    var bpNotes = null;
    var bpPlate = null;
    var bpRing = null;
    var bpMeasure = document.createElement('canvas').getContext('2d');

    var heroRect = function () { return bpHero.getBoundingClientRect(); };

    var relRect = function (el, h) {
      var r = el.getBoundingClientRect();
      return { l: r.left - h.left, t: r.top - h.top, r: r.right - h.left,
               b: r.bottom - h.top, w: r.width, h: r.height };
    };

    var parseRgb = function (s) {
      var m = s.match(/[\d.]+/g);
      return m ? [ +m[0], +m[1], +m[2], m[3] === undefined ? 1 : +m[3] ] : [0, 0, 0, 0];
    };
    var luminance = function (c) {
      var f = function (v) {
        v /= 255;
        return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
      };
      return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2]);
    };
    // Contrast against the first opaque background up the tree, which is how
    // the colour actually composites.
    var contrastOf = function (el) {
      var fg = parseRgb(getComputedStyle(el).color);
      var bg = null;
      for (var n = el; n && !bg; n = n.parentElement) {
        var c = parseRgb(getComputedStyle(n).backgroundColor);
        if (c[3] > 0.95) bg = c;
      }
      bg = bg || parseRgb(getComputedStyle(document.body).backgroundColor);
      var a = luminance(fg), b = luminance(bg);
      return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
    };

    var fontOf = function (el) {
      var cs = getComputedStyle(el);
      bpMeasure.font = cs.fontStyle + ' ' + cs.fontWeight + ' ' + cs.fontSize + ' ' + cs.fontFamily;
      var probe = bpMeasure.measureText('Hxgp');
      var size = parseFloat(cs.fontSize);
      return {
        family: cs.fontFamily.split(',')[0].replace(/["']/g, '').trim(),
        weight: cs.fontWeight,
        size: size,
        lead: cs.lineHeight === 'normal' ? size * 1.2 : parseFloat(cs.lineHeight),
        asc: probe.fontBoundingBoxAscent || size * 0.82,
        cap: bpMeasure.measureText('H').actualBoundingBoxAscent || size * 0.7,
        xh: bpMeasure.measureText('x').actualBoundingBoxAscent || size * 0.48
      };
    };

    // One rectangle per rendered line, merged across the inline boxes the
    // italic <em> splits a line into.
    var linesOf = function (el, h) {
      var range = document.createRange();
      range.selectNodeContents(el);
      var rects = Array.prototype.slice.call(range.getClientRects())
        .filter(function (r) { return r.width > 1 && r.height > 1; })
        .sort(function (a, b) { return a.top - b.top; });
      var lines = [];
      rects.forEach(function (r) {
        var mid = (r.top + r.bottom) / 2;
        var line = lines.filter(function (l) { return Math.abs(l.mid - mid) < r.height * 0.4; })[0];
        if (line) {
          line.left = Math.min(line.left, r.left);
          line.right = Math.max(line.right, r.right);
          line.top = Math.min(line.top, r.top);
        } else {
          lines.push({ mid: mid, left: r.left, right: r.right, top: r.top });
        }
      });
      return lines.map(function (l) {
        return { l: l.left - h.left, r: l.right - h.left, t: l.top - h.top };
      });
    };

    var px = function (n) { return Math.round(n) + ' px'; };
    var ratio = function (n) { return (Math.floor(n * 10) / 10).toFixed(1) + ' : 1'; };

    var addLine = function (cls, x1, y1, x2, y2) {
      var l = document.createElementNS(SVGNS, 'line');
      l.setAttribute('class', cls);
      l.setAttribute('x1', x1.toFixed(1)); l.setAttribute('y1', y1.toFixed(1));
      l.setAttribute('x2', x2.toFixed(1)); l.setAttribute('y2', y2.toFixed(1));
      bpInk.appendChild(l);
    };
    // A dimension line with its two end ticks, the way a drawing gives a size.
    var addDim = function (x1, y, x2) {
      addLine('dim', x1, y, x2, y);
      addLine('dim', x1, y - 4, x1, y + 4);
      addLine('dim', x2, y - 4, x2, y + 4);
    };
    // Notes are built from text nodes, never markup: parts alternate plain and
    // bold, so a measured value can never be read as HTML.
    var addNote = function (parts, x, y, align) {
      var d = document.createElement('div');
      d.className = 'bp-note' + (align ? ' is-' + align : '');
      parts.forEach(function (part, i) {
        if (i % 2) {
          var b = document.createElement('b');
          b.textContent = part;
          d.appendChild(b);
        } else {
          d.appendChild(document.createTextNode(part));
        }
      });
      d.style.left = x.toFixed(1) + 'px';
      d.style.top = y.toFixed(1) + 'px';
      bpNotes.appendChild(d);
      return d;
    };

    var bpDraw = function () {
      if (!bpLayer) return;
      var h = heroRect();
      bpInk.setAttribute('viewBox', '0 0 ' + h.width.toFixed(1) + ' ' + h.height.toFixed(1));
      while (bpInk.firstChild) bpInk.removeChild(bpInk.firstChild);
      bpNotes.textContent = '';

      // The grid: its real columns and gap, read from the computed style.
      var grid = bpOriginal.grid;
      var gcs = getComputedStyle(grid);
      var g = relRect(grid, h);
      var cols = gcs.gridTemplateColumns.split(' ').map(parseFloat).filter(isFinite);
      var gap = parseFloat(gcs.columnGap) || 0;
      var x = g.l + parseFloat(gcs.paddingLeft);
      var dimY = Math.max(16, g.t - 26);
      cols.forEach(function (w, i) {
        addLine('guide', x, 8, x, h.height - 8);
        addLine('guide', x + w, 8, x + w, h.height - 8);
        addDim(x, dimY, x + w);
        addNote([i === 0 ? 'text column ' : 'portrait column ', px(w)], x + w / 2, dimY - 17, 'centre');
        if (i < cols.length - 1 && gap) addNote(['gap ', px(gap)], x + w + gap / 2, dimY + 6, 'centre');
        x += w + gap;
      });
      var colEnd = g.l + parseFloat(gcs.paddingLeft) + cols[0];

      // The kicker.
      var k = bpOriginal.kicker;
      if (k) {
        var kf = fontOf(k), kr = relRect(k, h);
        var track = parseFloat(getComputedStyle(k).letterSpacing) / kf.size;
        addNote([kf.family + ' ', kf.weight, ' · ' + kf.size.toFixed(1) + ' px · tracked ' +
                 (Math.round(track * 100) / 100) + ' em'], kr.l, kr.t - 18);
      }

      // The headline: baseline, x-height and cap height of every line,
      // from the font's own metrics at its rendered size.
      var h1 = bpOriginal.h1;
      var f = fontOf(h1);
      var lines = linesOf(h1, h);
      lines.forEach(function (ln, i) {
        var base = ln.t + f.asc;
        addLine('base', ln.l - 10, base, ln.r + 10, base);
        addLine('metric', ln.l - 10, base - f.xh, ln.r + 10, base - f.xh);
        addLine('metric', ln.l - 10, base - f.cap, ln.r + 10, base - f.cap);
        if (i === 0 && ln.r + 96 < h.width) {
          addNote(['cap height'], ln.r + 16, base - f.cap - 7);
          addNote(['x-height'], ln.r + 16, base - f.xh - 7);
          addNote(['baseline'], ln.r + 16, base - 7);
        }
      });
      var last = lines[lines.length - 1];
      if (last) {
        addNote([f.family + ' ', f.weight, ' · ' + px(f.size) + ' on ' + px(f.lead) + ' · contrast ',
                 ratio(contrastOf(h1))], colEnd, last.t + f.asc + 12, 'end');
      }

      // The paragraph: size, leading, measure, contrast.
      var p = bpOriginal.blurb;
      if (p) {
        var pf = fontOf(p), pr = relRect(p, h);
        bpMeasure.font = getComputedStyle(p).fontWeight + ' ' + getComputedStyle(p).fontSize + ' ' + getComputedStyle(p).fontFamily;
        var avg = bpMeasure.measureText('abcdefghijklmnopqrstuvwxyz').width / 26;
        var room = colEnd - pr.r;
        var chars = Math.round(pr.w / avg) + ' characters';
        addLine('guide', pr.l, pr.t - 4, pr.l, pr.b + 4);
        if (room > 170) {
          var ny = pr.t + pr.h / 2 - 22;
          addNote([px(pf.size) + ' on ' + px(pf.lead)], pr.r + 18, ny);
          addNote(['about ', chars, ' a line'], pr.r + 18, ny + 15);
          addNote(['contrast ', ratio(contrastOf(p))], pr.r + 18, ny + 30);
        } else {
          addNote([px(pf.size) + ' on ' + px(pf.lead) + ' · ', chars, ' · contrast ' + ratio(contrastOf(p))],
                  pr.l, pr.b + 4);
        }
      }

      // The buttons, against the 44 px a thumb needs.
      var btn = bpOriginal.buttons[0];
      if (btn) {
        var br = relRect(btn, h);
        var row = relRect(btn.parentElement, h);
        var under = row.b - br.b > 8 ? row.b : br.b;
        addDim(br.l, under + 9, br.r);
        addNote([Math.round(br.w) + ' × ' + Math.round(br.h) + ' px · ',
                 br.h >= 44 ? 'meets the 44 px touch target' : 'under the 44 px touch target'],
                br.l, under + 15);
      }

      // The portrait: the box it holds, and what it cost to fetch.
      var img = bpOriginal.img;
      if (img) {
        var ir = relRect(img, h);
        var box = document.createElementNS(SVGNS, 'rect');
        box.setAttribute('class', 'box');
        box.setAttribute('x', ir.l.toFixed(1)); box.setAttribute('y', ir.t.toFixed(1));
        box.setAttribute('width', ir.w.toFixed(1)); box.setAttribute('height', ir.h.toFixed(1));
        bpInk.appendChild(box);
        addLine('cross', ir.l, ir.t, ir.r, ir.b);
        addLine('cross', ir.r, ir.t, ir.l, ir.b);
        addDim(ir.l, ir.t - 12, ir.r);
        addNote([px(ir.w)], ir.l + ir.w / 2, ir.t - 29, 'centre');
        var src = img.currentSrc || img.src;
        var entry = (performance.getEntriesByName && performance.getEntriesByName(src)[0]) || null;
        var bytes = entry ? (entry.encodedBodySize || entry.transferSize || 0) : 0;
        var ext = (src.split('?')[0].split('.').pop() || '').toUpperCase();
        var spec = [img.naturalWidth + ' × ' + img.naturalHeight + ' ' + ext];
        if (bytes) spec.push(' · ' + Math.round(bytes / 1024) + ' KB');
        if (img.getAttribute('fetchpriority') === 'high') spec.push(' · fetched first');
        addNote([spec.join('')], ir.l + ir.w / 2, ir.t + ir.h / 2 - 7, 'centre');
      }
    };

    // The title block: this visit, measured.
    var bpFillPlate = function () {
      if (!bpPlate) return;
      bpPlate.textContent = '';
      var rows = [];
      var nav = performance.getEntriesByType ? performance.getEntriesByType('navigation')[0] : null;
      if (nav && nav.domContentLoadedEventEnd) rows.push(['page ready', Math.round(nav.domContentLoadedEventEnd) + ' ms']);
      if (vitals.lcp !== null) rows.push(['largest paint', Math.round(vitals.lcp) + ' ms']);
      if (vitals.hasCls) rows.push(['layout shift', vitals.cls.toFixed(2)]);
      if (performance.getEntriesByType) {
        var all = performance.getEntriesByType('resource');
        var bytes = (nav && nav.encodedBodySize) || 0;
        all.forEach(function (e) { bytes += e.encodedBodySize || 0; });
        if (bytes) rows.push(['weight so far', Math.round(bytes / 1024) + ' KB in ' + (all.length + 1) + ' files']);
      }
      var head = document.createElement('span');
      head.className = 'bp-plate-head';
      head.textContent = 'This visit, measured in your browser';
      bpPlate.appendChild(head);
      rows.forEach(function (row) {
        var item = document.createElement('span');
        var label = document.createElement('span');
        label.className = 'bp-plate-label';
        label.textContent = row[0] + ' ';
        var value = document.createElement('b');
        value.textContent = row[1];
        item.appendChild(label);
        item.appendChild(value);
        bpPlate.appendChild(item);
      });
      return rows;
    };

    var bpBuild = function () {
      bpLayer = document.createElement('div');
      bpLayer.className = 'bp';
      bpLayer.setAttribute('aria-hidden', 'true');
      bpLayer.inert = true;

      var clone = bpOriginal.grid.cloneNode(true);
      clone.removeAttribute('id');
      Array.prototype.forEach.call(clone.querySelectorAll('[id]'), function (el) {
        el.removeAttribute('id');
      });
      Array.prototype.forEach.call(clone.querySelectorAll('.reveal'), function (el) {
        el.classList.remove('reveal', 'in');
      });
      Array.prototype.forEach.call(clone.querySelectorAll('[aria-describedby],[aria-live]'), function (el) {
        el.removeAttribute('aria-describedby');
        el.removeAttribute('aria-live');
      });
      bpLayer.appendChild(clone);

      bpInk = document.createElementNS(SVGNS, 'svg');
      bpInk.setAttribute('class', 'bp-ink');
      bpInk.setAttribute('aria-hidden', 'true');
      bpInk.setAttribute('preserveAspectRatio', 'none');
      bpLayer.appendChild(bpInk);

      bpNotes = document.createElement('div');
      bpLayer.appendChild(bpNotes);

      bpPlate = document.createElement('p');
      bpPlate.className = 'bp-plate';
      bpLayer.appendChild(bpPlate);

      bpRing = document.createElement('div');
      bpRing.className = 'bp-ring';
      bpRing.setAttribute('aria-hidden', 'true');

      bpHero.appendChild(bpLayer);
      bpHero.appendChild(bpRing);
      bpDraw();
      bpFillPlate();
    };

    var bpSet = function () {
      bpHero.style.setProperty('--bp-x', bp.x.toFixed(1) + 'px');
      bpHero.style.setProperty('--bp-y', bp.y.toFixed(1) + 'px');
      bpHero.style.setProperty('--bp-r', Math.max(0, bp.r).toFixed(1) + 'px');
      var ringOn = !bp.pinned && bp.r > 4;
      bpHero.style.setProperty('--bp-ring', ringOn ? '1' : '0');
      bpHero.style.setProperty('--bp-ring-vis', ringOn ? 'visible' : 'hidden');
    };

    var bpLoop = function () {
      // A pinned wipe opens slowly, on purpose; the hover lens keeps up.
      var kr = reduceMotion ? 1 : (bp.pinned ? 0.075 : 0.16);
      var kp = reduceMotion ? 1 : 0.2;
      bp.x += (bp.tx - bp.x) * kp;
      bp.y += (bp.ty - bp.y) * kp;
      bp.r += (bp.tr - bp.r) * kr;
      var settled = Math.abs(bp.tx - bp.x) < 0.3 && Math.abs(bp.ty - bp.y) < 0.3 &&
                    Math.abs(bp.tr - bp.r) < 0.3;
      if (settled) { bp.x = bp.tx; bp.y = bp.ty; bp.r = bp.tr; }
      bpSet();
      bp.raf = settled ? 0 : window.requestAnimationFrame(bpLoop);
    };
    var bpKick = function () {
      if (!bp.raf) bp.raf = window.requestAnimationFrame(bpLoop);
    };

    var lensRadius = function () {
      return Math.max(96, Math.min(150, bpHero.clientWidth * 0.12));
    };

    var bpPin = function (on) {
      bp.pinned = on;
      bpToggle.setAttribute('aria-pressed', on ? 'true' : 'false');
      bpToggle.querySelector('.bp-toggle-label').textContent = on ? 'Hide the blueprint' : 'Show the blueprint';
      var h = heroRect();
      var b = bpToggle.getBoundingClientRect();
      var ox = b.left + b.width / 2 - h.left;
      var oy = b.top + b.height / 2 - h.top;
      if (on || bp.r < 1) { bp.x = bp.tx = ox; bp.y = bp.ty = oy; }
      if (on) {
        bpDraw();
        var rows = bpFillPlate() || [];
        bp.tr = Math.hypot(Math.max(ox, h.width - ox), Math.max(oy, h.height - oy)) + 24;
        if (bpSummary) {
          var f = fontOf(bpOriginal.h1);
          bpSummary.textContent = 'Blueprint shown. Headline set in ' + f.family + ' at ' +
            Math.round(f.size) + ' pixels, contrast ' + ratio(contrastOf(bpOriginal.h1)) + '. ' +
            rows.map(function (r) { return r[0] + ' ' + r[1]; }).join(', ') + '.';
        }
      } else {
        bp.tr = 0;
        if (bpSummary) bpSummary.textContent = 'Blueprint hidden.';
      }
      bpKick();
    };

    bpToggle.addEventListener('click', function () {
      bp.touched = true;
      bpPin(!bp.pinned);
    });

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && bp.pinned) { bpPin(false); bpToggle.focus(); }
    });

    if (finePointer) {
      bpHero.addEventListener('pointermove', function (e) {
        if (!bpLayer || bp.pinned || e.pointerType === 'touch') return;
        bp.touched = true;
        var h = heroRect();
        var tx = e.clientX - h.left;
        var ty = e.clientY - h.top;
        // Step aside for anything clickable, so a link never turns into a
        // drawing of a link just as somebody reaches for it.
        var overControl = e.target.closest && e.target.closest('a, button, input');
        if (bp.r < 1 && !overControl) {
          bp.x = tx; bp.y = ty;
          bpFillPlate();
        }
        bp.tx = tx; bp.ty = ty;
        bp.tr = overControl ? 0 : lensRadius();
        bpKick();
      });
      bpHero.addEventListener('pointerleave', function () {
        if (bp.pinned) return;
        bp.tr = 0;
        bpKick();
      });
    }

    var bpResizeTimer = 0;
    window.addEventListener('resize', function () {
      window.clearTimeout(bpResizeTimer);
      bpResizeTimer = window.setTimeout(function () {
        bpDraw();
        if (bp.pinned) bpPin(true);
      }, 150);
    });

    // Once per visit, the lens shows itself: it opens over the start of the
    // headline, travels it, and closes. Skipped for anyone who asked for less
    // motion, on touch screens, and as soon as the visitor moves first.
    var bpDemo = function () {
      if (reduceMotion || !finePointer || bp.touched) return;
      try {
        if (window.sessionStorage.getItem('bp-demo')) return;
        window.sessionStorage.setItem('bp-demo', '1');
      } catch (e) { /* storage blocked: show it anyway */ }
      var h = heroRect();
      if (h.top > window.innerHeight * 0.5 || h.bottom < 0) return;
      var lines = linesOf(bpOriginal.h1, h);
      if (!lines.length) return;
      var f = fontOf(bpOriginal.h1);
      var stops = lines.map(function (ln, i) {
        var y = ln.t + f.asc - f.xh / 2;
        return { x: i % 2 ? ln.r - 70 : ln.l + 70, y: y };
      });
      var step = function (i) {
        if (bp.touched || bp.pinned) { if (!bp.pinned) { bp.tr = 0; bpKick(); } return; }
        if (i >= stops.length) { bp.tr = 0; bpKick(); return; }
        bp.tx = stops[i].x; bp.ty = stops[i].y;
        if (i === 0) { bp.x = bp.tx; bp.y = bp.ty; bpFillPlate(); }
        bp.tr = lensRadius() * 0.85;
        bpKick();
        window.setTimeout(function () { step(i + 1); }, 900);
      };
      step(0);
    };

    // Build once the fonts and the portrait are in, so the drawing measures
    // the page as it finally stands rather than as it first painted.
    var bpStart = function () {
      bpToggle.hidden = false;
      if (bpHint) {
        if (finePointer) bpHint.textContent = 'Or move your pointer across this section to look underneath.';
        bpHint.hidden = false;
      }
      var ready = document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve();
      ready.then(function () {
        window.setTimeout(function () {
          bpBuild();
          window.setTimeout(bpDemo, 500);
        }, reduceMotion ? 0 : 900);
      });
      if (document.fonts && document.fonts.addEventListener) {
        document.fonts.addEventListener('loadingdone', function () { bpDraw(); });
      }
    };
    if (document.readyState === 'complete') bpStart();
    else window.addEventListener('load', bpStart);
  }

  /* --- highlight the section being read --------------------------------
     Sub-pages link back with "../index.html#projects", which is not a
     selector, so only same-page hashes are considered.                    */
  var navLinks = Array.prototype.slice.call(
    document.querySelectorAll('.nav-links a[href^="#"]')
  );
  var sections = navLinks
    .map(function (link) { return document.getElementById(link.getAttribute('href').slice(1)); })
    .filter(Boolean);

  if (sections.length && 'IntersectionObserver' in window) {
    var navObserver = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        navLinks.forEach(function (link) {
          var active = link.getAttribute('href') === '#' + entry.target.id;
          if (active) link.setAttribute('aria-current', 'true');
          else link.removeAttribute('aria-current');
        });
      });
    }, { rootMargin: '-45% 0px -50% 0px' });

    sections.forEach(function (section) { navObserver.observe(section); });
  }
})();
