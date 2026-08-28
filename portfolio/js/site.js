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
  var revealables = document.querySelectorAll('.reveal');

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
      line: 'React and TypeScript. Badminton drills, 478 tests.'
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
          line('Looking for an OJT placement and open to freelance work.');
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
          line('Cisco NetAcad     Ethical Hacker                     Jul 2026');
          line('Cisco NetAcad     Networking Basics                  Feb 2026');
          line('Cisco NetAcad     CCNA: Introduction to Networks     Jan 2026');
          line('Cisco / OpenEDG   Python Essentials 2                May 2024');
          line('AWS Educate       Getting Started with Compute       trained');
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

  // Parallax is a desktop-pointer nicety. On a touch screen it competes with
  // the scroll itself, and with reduced motion it should not run at all.
  var portrait = null;
  var portraitTop = 0;

  if (!reduceMotion && window.matchMedia('(pointer: fine)').matches) {
    portrait = document.querySelector('.portrait img');
    if (portrait) {
      portraitTop = portrait.getBoundingClientRect().top + window.scrollY;
    }
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

      if (portrait) {
        // A few pixels of drift against the scroll. Clamped so the image never
        // pulls away from its frame.
        var drift = Math.max(-14, Math.min(14, (top - portraitTop) * 0.03));
        portrait.style.transform = 'translate3d(0,' + drift.toFixed(1) + 'px,0) scale(1.06)';
      }

      ticking = false;
    });
  }

  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  /* --- résumé: print / save as PDF ------------------------------------- */
  var printBtn = document.getElementById('print-cv');
  if (printBtn) {
    printBtn.addEventListener('click', function () { window.print(); });
  }

  /* --- highlight the section being read --------------------------------
     Sub-pages link back with "../index.html#about", which is not a
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
