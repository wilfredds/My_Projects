/* ==========================================================================
   Portfolio behaviour.

   Everything here is an enhancement. Every word on every page is already in
   the HTML, so the site reads fine with this file blocked or broken.
   ========================================================================== */

(function () {
  'use strict';

  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Captured now: currentScript is only set while this file first runs. The
  // search resolves its links against the site root, which is one level up
  // from js/, so they work the same from a case study as from the home page.
  var siteRoot = document.currentScript
    ? new URL('../', document.currentScript.src)
    : new URL('/', window.location.href);

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

  /* ----------------------------------------------------- scroll scenes --
     ScrollTrigger's idea without the library: each [data-scene] element gets
     its progress through the viewport, 0 to 1, as the custom property --p,
     and the stylesheet decides what that progress draws. One value per
     element, written through the CSSOM (which the CSP allows), read by CSS
     that only touches transform, opacity and clip-path.

       read    the statement inks in, word by word, from the moment it enters
               until its last line is a fifth of the way up the screen
       line    the timeline draws down to a reading line 70% of the way down
               the screen, lighting each project as it passes
       unveil  a project screenshot develops as it enters

     Without JavaScript, or with reduced motion, nothing runs and every rule
     falls back to var(--p, 1): the finished state. */
  var scenes = Array.prototype.slice.call(document.querySelectorAll('[data-scene]'));

  if (scenes.length && !reduceMotion && 'IntersectionObserver' in window) {
    var RANGES = {
      read: function (r, vh) { return (vh * 0.95 - r.top) / (vh * 0.15 + r.height); },
      line: function (r, vh) { return (vh * 0.7 - r.top) / r.height; },
      unveil: function (r, vh) { return (vh - r.top) / (vh * 0.5); }
    };

    // The statement is split into words so each can take its own share of
    // the progress. Screen readers get the sentence whole, from a hidden
    // copy, rather than sixty separate words.
    scenes.forEach(function (el) {
      if (el.getAttribute('data-scene') !== 'read') return;
      var whole = el.textContent.replace(/\s+/g, ' ').trim();
      var visual = document.createElement('span');
      visual.setAttribute('aria-hidden', 'true');
      var i = 0;
      var walk = function (from, into) {
        Array.prototype.slice.call(from.childNodes).forEach(function (node) {
          if (node.nodeType === 3) {
            node.textContent.split(/(\s+)/).forEach(function (part) {
              if (!part) return;
              if (/^\s+$/.test(part)) { into.appendChild(document.createTextNode(' ')); return; }
              var w = document.createElement('span');
              w.className = 'w';
              w.textContent = part;
              w.style.setProperty('--i', i++);
              into.appendChild(w);
            });
          } else if (node.nodeType === 1) {
            var copy = document.createElement(node.tagName.toLowerCase());
            walk(node, copy);
            into.appendChild(copy);
          }
        });
      };
      walk(el, visual);
      var spoken = document.createElement('span');
      spoken.className = 'sr-only';
      spoken.textContent = whole;
      el.textContent = '';
      el.appendChild(spoken);
      el.appendChild(visual);
      el.style.setProperty('--n', i);
      el.classList.add('is-split');
    });

    // The timeline needs to know where each project sits along its line.
    scenes.forEach(function (el) {
      if (el.getAttribute('data-scene') !== 'line') return;
      var place = function () {
        var h = el.offsetHeight || 1;
        var items = Array.prototype.slice.call(el.children);
        items.forEach(function (li) {
          // The line's head runs 0.8rem below the reading line, which puts
          // it on a dot exactly when the reading line reaches the item's top.
          li.style.setProperty('--at', (li.offsetTop / h).toFixed(4));
        });
        // The drawn line runs from the first dot to the last, not to the
        // bottom of the list, so it stops where the history does.
        var track = items.length ? items[items.length - 1].offsetTop : 0;
        el.style.setProperty('--track', track + 'px');
        el.style.setProperty('--ratio', (h / Math.max(track, 1)).toFixed(4));
      };
      place();
      window.addEventListener('resize', place);
      if (document.fonts && document.fonts.ready) document.fonts.ready.then(place);
    });

    var live = [];
    var ticking = false;
    var last = new WeakMap();

    var tick = function () {
      ticking = false;
      var vh = window.innerHeight;
      // Read every position first, then write: one layout, not one per scene.
      var values = live.map(function (el) {
        var p = RANGES[el.getAttribute('data-scene')](el.getBoundingClientRect(), vh);
        return Math.min(1, Math.max(0, p));
      });
      live.forEach(function (el, n) {
        var p = values[n];
        var before = last.get(el);
        if (before !== undefined && Math.abs(before - p) < 0.0005) return;
        last.set(el, p);
        el.style.setProperty('--p', p.toFixed(4));
      });
    };
    var request = function () {
      if (!ticking) { ticking = true; window.requestAnimationFrame(tick); }
    };

    // Only scenes near the screen are measured on scroll.
    var sceneObserver = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        var at = live.indexOf(entry.target);
        if (entry.isIntersecting && at === -1) live.push(entry.target);
        if (!entry.isIntersecting && at !== -1) {
          // Leaving: settle on whichever end it left by, so nothing is left
          // half drawn by a fast scroll.
          live.splice(at, 1);
          var done = entry.boundingClientRect.top < 0 ? 1 : 0;
          last.set(entry.target, done);
          entry.target.style.setProperty('--p', String(done));
        }
      });
      request();
    }, { rootMargin: '25% 0px 25% 0px' });

    scenes.forEach(function (el) {
      // Start every scene at its beginning, so nothing below the fold paints
      // finished and then snaps back when it is first measured.
      el.style.setProperty('--p', el.getBoundingClientRect().top < 0 ? '1' : '0');
      sceneObserver.observe(el);
    });
    document.documentElement.classList.add('has-scenes');
    window.addEventListener('scroll', request, { passive: true });
    window.addEventListener('resize', request);
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

  /* The terminal and the quick-jump search both read this list, so a project
     is added in one place. `title` and `tags` are for the search: the tags are
     the card's data-tech values plus the plain words someone might type. */
  var PROJECTS = {
    floodguard: {
      title: 'FloodGuard',
      path: 'projects/floodguard.html',
      tags: 'iot capstone flood warning sms gsm noveleta',
      line: 'Capstone. IoT flood warning by SMS, Noveleta.'
    },
    autocare: {
      title: 'AutoCare',
      path: 'projects/autocare.html',
      tags: 'nextjs next.js react typescript postgres car shop client',
      line: 'Next.js and Postgres. Job system for a car shop.'
    },
    rallyready: {
      title: 'RallyReady',
      path: 'projects/rallyready.html',
      tags: 'react typescript pwa supabase postgres badminton vitest',
      line: 'React and TypeScript. Badminton drills, 648 tests.'
    },
    'badminton-ph': {
      title: 'BadmintonPH',
      href: 'https://badminton-ph.web.app',
      tags: 'react firebase badminton tournament',
      line: 'React. Live tournament platform on Firebase.'
    },
    'hiroshi-grill': {
      title: 'Hiroshi Master Grill',
      path: 'projects/hiroshi-master-grill.html',
      tags: 'nextjs next.js react typescript supabase postgres restaurant booking client samgyupsal',
      line: 'Next.js 16 and Supabase. Client booking app.'
    },
    cyclemind_ai: {
      title: 'CycleMind AI',
      path: 'projects/cyclemind-ai.html',
      tags: 'flutter dart firebase cycling bike ai',
      line: 'Flutter and Firebase. AI coach and bike doctor.'
    },
    'bike-guide-app': {
      title: 'Bike Guide PH',
      path: 'projects/bike-guide-ph.html',
      tags: 'vanilla javascript pwa firebase cycling offline',
      line: 'Vanilla JS PWA. Gear guide, routes, offline.'
    },
    'corruption-watch': {
      title: 'Corruption Watch PH',
      path: 'projects/corruption-watch-ph.html',
      tags: 'vanilla javascript firebase reporting',
      line: 'Firebase. Anonymous reporting, tested rules.'
    },
    hiraya: {
      title: 'Hiraya',
      anchor: 'index.html#hiraya',
      tags: 'unity csharp c# game mmorpg',
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
          line('testing     Vitest, node:test, Firestore emulator');
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

  /* ==================================================================== */
  /*  Quick-jump search (Ctrl K, Cmd K or /)                              */
  /* ==================================================================== */
  /* A command palette: one box that reaches every project, section and
     page, plus a few actions. It only appears when somebody asks for it, so
     it never sits on top of the work. Built on a native <dialog>, which gives
     the focus trap, Escape and an inert page behind it for free. The list is
     a listbox the input drives through aria-activedescendant, so focus never
     leaves the text box. Every row is built with textContent. */
  var navInner = document.querySelector('.nav-inner');

  // Its own scope: var hoists, and names like list and status are common.
  if (navInner && window.HTMLDialogElement) (function () {
    var isMac = /Mac|iPhone|iPad/.test(
      (navigator.userAgentData && navigator.userAgentData.platform) || navigator.platform || ''
    );
    var modKey = isMac ? '⌘' : 'Ctrl';
    var EMAIL = 'frncishub@gmail.com';
    var SVG = 'http://www.w3.org/2000/svg';
    var ICONS = {
      search: 'M11 19a8 8 0 1 1 0-16 8 8 0 0 1 0 16zM21 21l-4.35-4.35',
      project: 'M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z',
      section: 'M4 9h16M4 15h16M10 3 8 21M16 3l-2 18',
      page: 'M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9zM14 3v6h6M8 13h8M8 17h5',
      download: 'M12 3v12M7 10l5 5 5-5M5 21h14',
      external: 'M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5',
      copy: 'M9 9h10v12H9zM5 15V3h10',
      mail: 'M3 6h18v12H3zM3 7l9 6 9-6',
      theme: 'M12 3a9 9 0 1 0 9 9 7 7 0 0 1-9-9z'
    };

    var icon = function (name, cls) {
      var svg = document.createElementNS(SVG, 'svg');
      svg.setAttribute('viewBox', '0 0 24 24');
      svg.setAttribute('fill', 'none');
      svg.setAttribute('stroke', 'currentColor');
      svg.setAttribute('stroke-width', '1.7');
      svg.setAttribute('stroke-linecap', 'round');
      svg.setAttribute('stroke-linejoin', 'round');
      svg.setAttribute('aria-hidden', 'true');
      if (cls) svg.setAttribute('class', cls);
      var path = document.createElementNS(SVG, 'path');
      path.setAttribute('d', ICONS[name]);
      svg.appendChild(path);
      return svg;
    };

    var el = function (tag, cls, text) {
      var node = document.createElement(tag);
      if (cls) node.className = cls;
      if (text) node.textContent = text;
      return node;
    };

    var resolve = function (path) { return new URL(path, siteRoot).href; };

    // Accents and punctuation are folded away, so "resume" finds Résumé and
    // "next js" finds Next.js. Each character maps to one character, which
    // keeps match positions valid for highlighting the original title.
    var fold = function (text) {
      return text.normalize('NFD').replace(/[̀-ͯ]/g, '')
        .toLowerCase().replace(/[^a-z0-9#]/g, ' ');
    };

    /* --- what it can reach --------------------------------------------- */
    var items = [];

    Object.keys(PROJECTS).forEach(function (key) {
      var p = PROJECTS[key];
      var item = { group: 'Projects', title: p.title, sub: p.line, keys: key + ' ' + p.tags + ' project' };
      if (p.path) { item.href = resolve(p.path); item.meta = 'Case study'; item.icon = 'project'; }
      else if (p.href) { item.href = p.href; item.external = true; item.meta = 'Live site'; item.icon = 'external'; }
      else { item.href = resolve(p.anchor); item.meta = 'On the home page'; item.icon = 'project'; }
      items.push(item);
    });

    [
      ['projects', 'Projects', 'All nine, filterable by stack', 'work portfolio'],
      ['education', 'Experience and education', 'Certicode internship and LPU Cavite', 'experience work internship intern certicode school university lpu ojt'],
      ['stack', 'Tech stack', 'The stack I build on', 'tools technologies'],
      ['fit', 'Check me against your job post', 'Paste a post, see the work behind each skill', 'hiring job post description fit match requirements recruiter'],
      ['certs', 'Certifications', 'Cisco, AWS, DataCamp, SAP and more', 'certificates cisco ccna aws datacamp sap python'],
      ['skills', 'Technical skills', 'Languages, frameworks, testing, cloud', 'skills languages'],
      ['room', 'Coding camp photos', 'Two days at the coding camp', 'bootcamp pictures gallery'],
      ['timeline', 'Timeline', 'How I got here', 'history journey'],
      ['shell', 'Terminal', 'Type commands into a working shell', 'terminal shell command line cli'],
      ['contact', 'Contact', 'Email, GitHub and where to find me', 'contact hire email message reach']
    ].forEach(function (s) {
      items.push({
        group: 'Sections', title: s[1], sub: s[2], keys: s[3], icon: 'section',
        href: resolve('index.html#' + s[0]), meta: 'Section'
      });
    });

    items.push(
      { group: 'Pages', title: 'Résumé', sub: 'One page, printable', keys: 'resume cv curriculum vitae',
        href: resolve('resume.html'), meta: 'Page', icon: 'page' },
      { group: 'Pages', title: 'Download the CV', sub: 'PDF, two A4 pages', keys: 'resume cv pdf download',
        href: resolve('assets/francis-wilfred-antiporda-cv.pdf'), download: true, meta: 'PDF', icon: 'download' },
      { group: 'Actions', title: 'Copy my email address', sub: EMAIL, keys: 'email copy contact clipboard',
        run: 'copy', meta: 'Copy', icon: 'copy' },
      { group: 'Actions', title: 'Write me an email', sub: 'Opens your mail app', keys: 'email mail contact hire',
        href: 'mailto:' + EMAIL, meta: 'Email', icon: 'mail' },
      { group: 'Actions', title: 'GitHub profile', sub: 'github.com/wilfredds', keys: 'github code repositories source',
        href: 'https://github.com/wilfredds', external: true, meta: 'New tab', icon: 'external' }
    );
    if (themeToggle) {
      items.push({ group: 'Actions', title: 'Switch theme', sub: '', keys: 'theme dark light mode colour color',
        run: 'theme', meta: 'Theme', icon: 'theme' });
    }

    // A page does not offer a jump to itself.
    var here = window.location.pathname.replace(/\.html$/, '').replace(/\/index$/, '/');
    items = items.filter(function (it) {
      if (!it.href || it.external || it.download || it.href.indexOf('#') !== -1) return true;
      var path = new URL(it.href).pathname.replace(/\.html$/, '').replace(/\/index$/, '/');
      return path !== here;
    });
    items.forEach(function (it) {
      it.foldedTitle = fold(it.title);
      it.words = (it.foldedTitle + ' ' + fold(it.keys)).split(/\s+/).filter(Boolean);
    });

    /* --- matching -------------------------------------------------------
       Every word typed has to land somewhere. A hit at the start of the
       title counts most, then the start of any word in the title, then
       anywhere in it, then the tags. */
    var score = function (it, tokens) {
      var total = 0;
      for (var i = 0; i < tokens.length; i++) {
        var t = tokens[i];
        var at = it.foldedTitle.indexOf(t);
        if (at === 0) total += 100;
        else if (at > 0 && it.foldedTitle.charAt(at - 1) === ' ') total += 60;
        else if (at > 0) total += 35;
        else if (it.words.some(function (w) { return w.indexOf(t) === 0; })) total += 25;
        else if (it.words.some(function (w) { return w.indexOf(t) !== -1; })) total += 10;
        else return 0;
      }
      return total;
    };

    /* --- the dialog ---------------------------------------------------- */
    var dialog = el('dialog', 'cmdk');
    dialog.setAttribute('aria-label', 'Search the site');

    var bar = el('div', 'cmdk-bar');
    bar.appendChild(icon('search', 'cmdk-bar-icon'));
    var field = el('input', 'cmdk-input');
    field.type = 'text';
    field.setAttribute('role', 'combobox');
    field.setAttribute('aria-expanded', 'true');
    field.setAttribute('aria-controls', 'cmdk-list');
    field.setAttribute('aria-autocomplete', 'list');
    field.setAttribute('aria-label', 'Search projects, sections and pages');
    field.setAttribute('placeholder', window.matchMedia('(max-width: 520px)').matches
      ? 'Search the site' : 'Search projects, sections, pages');
    field.setAttribute('autocomplete', 'off');
    field.setAttribute('spellcheck', 'false');
    field.setAttribute('enterkeyhint', 'go');
    bar.appendChild(field);
    var closeBtn = el('button', 'cmdk-close', 'Esc');
    closeBtn.type = 'button';
    closeBtn.setAttribute('aria-label', 'Close search');
    bar.appendChild(closeBtn);

    var list = el('div', 'cmdk-list');
    list.id = 'cmdk-list';
    list.setAttribute('role', 'listbox');
    list.setAttribute('aria-label', 'Results');

    var empty = el('p', 'cmdk-empty');
    empty.hidden = true;

    var status = el('p', 'sr-only');
    status.setAttribute('role', 'status');

    var foot = el('div', 'cmdk-foot');
    [['↑ ↓', 'to move'], ['↵', 'to open'], ['Esc', 'to close']].forEach(function (k) {
      var span = el('span');
      span.appendChild(el('kbd', null, k[0]));
      span.appendChild(document.createTextNode(' ' + k[1]));
      foot.appendChild(span);
    });

    dialog.appendChild(bar);
    dialog.appendChild(list);
    dialog.appendChild(empty);
    dialog.appendChild(foot);
    dialog.appendChild(status);
    document.body.appendChild(dialog);

    /* --- the button in the nav ----------------------------------------- */
    var opener = el('button', 'nav-search');
    opener.type = 'button';
    opener.setAttribute('aria-haspopup', 'dialog');
    opener.setAttribute('aria-keyshortcuts', isMac ? 'Meta+K /' : 'Control+K /');
    opener.setAttribute('aria-label', 'Search the site');
    opener.appendChild(icon('search'));
    opener.appendChild(el('span', 'nav-search-label', 'Search'));
    var openerKbd = el('kbd', 'nav-search-kbd', modKey + ' K');
    openerKbd.setAttribute('aria-hidden', 'true');
    opener.appendChild(openerKbd);
    navInner.insertBefore(opener, themeToggle && themeToggle.parentNode === navInner ? themeToggle : null);

    /* --- rendering ----------------------------------------------------- */
    var shown = [];
    var active = 0;
    var GROUPS = ['Projects', 'Sections', 'Pages', 'Actions'];

    var highlight = function (node, it, tokens) {
      var ranges = [];
      tokens.forEach(function (t) {
        var at = it.foldedTitle.indexOf(t);
        if (at !== -1) ranges.push([at, at + t.length]);
      });
      ranges.sort(function (a, b) { return a[0] - b[0]; });
      var pos = 0;
      ranges.forEach(function (r) {
        if (r[0] < pos) return;
        if (r[0] > pos) node.appendChild(document.createTextNode(it.title.slice(pos, r[0])));
        node.appendChild(el('mark', null, it.title.slice(r[0], r[1])));
        pos = r[1];
      });
      if (pos < it.title.length) node.appendChild(document.createTextNode(it.title.slice(pos)));
    };

    var setActive = function (i, scroll) {
      if (!shown.length) { field.removeAttribute('aria-activedescendant'); return; }
      active = (i + shown.length) % shown.length;
      shown.forEach(function (it, n) { it.node.setAttribute('aria-selected', n === active ? 'true' : 'false'); });
      field.setAttribute('aria-activedescendant', shown[active].node.id);
      if (scroll) shown[active].node.scrollIntoView({ block: 'nearest' });
    };

    var statusTimer = null;
    var render = function (fresh) {
      var query = field.value.trim();
      var tokens = fold(query).split(/\s+/).filter(Boolean);

      if (themeToggle) {
        items.forEach(function (it) {
          if (it.run !== 'theme') return;
          var next = document.documentElement.getAttribute('data-theme') === 'light' ||
            (!document.documentElement.getAttribute('data-theme') &&
              window.matchMedia('(prefers-color-scheme: light)').matches) ? 'dark' : 'light';
          it.title = 'Switch to the ' + next + ' theme';
          it.foldedTitle = fold(it.title);
          it.sub = 'The choice is remembered on this device';
        });
      }

      var ranked = items.map(function (it, order) {
        return { it: it, order: order, score: tokens.length ? score(it, tokens) : 1 };
      }).filter(function (r) { return r.score > 0; });

      // Groups keep their order when browsing, and follow their best match
      // when searching, so the likeliest answer is always the first row.
      var best = {};
      ranked.forEach(function (r) { best[r.it.group] = Math.max(best[r.it.group] || 0, r.score); });
      var groups = GROUPS.filter(function (g) { return best[g]; });
      if (tokens.length) groups.sort(function (a, b) { return best[b] - best[a]; });

      list.textContent = '';
      shown = [];
      groups.forEach(function (g) {
        var block = el('div', 'cmdk-group');
        block.setAttribute('role', 'group');
        var label = el('div', 'cmdk-group-label', g);
        label.id = 'cmdk-g-' + g.toLowerCase();
        label.setAttribute('aria-hidden', 'true');
        block.setAttribute('aria-labelledby', label.id);
        block.appendChild(label);

        ranked.filter(function (r) { return r.it.group === g; })
          .sort(function (a, b) { return (b.score - a.score) || (a.order - b.order); })
          .forEach(function (r) {
            var it = r.it;
            var row = el('div', 'cmdk-item' + (it.group === 'Projects' ? ' is-project' : ''));
            row.id = 'cmdk-o-' + shown.length;
            row.setAttribute('role', 'option');
            row.setAttribute('aria-selected', 'false');
            if (fresh && !reduceMotion) row.style.setProperty('--n', Math.min(shown.length, 10));

            var ico = el('span', 'cmdk-ico');
            ico.appendChild(icon(it.icon));
            row.appendChild(ico);

            var text = el('span', 'cmdk-text');
            var title = el('span', 'cmdk-title');
            highlight(title, it, tokens);
            text.appendChild(title);
            if (it.sub) text.appendChild(el('span', 'cmdk-sub', it.sub));
            row.appendChild(text);

            var meta = el('span', 'cmdk-meta', it.meta);
            meta.setAttribute('aria-hidden', 'true');
            row.appendChild(meta);

            it.node = row;
            shown.push(it);
            block.appendChild(row);
          });
        list.appendChild(block);
      });

      list.classList.toggle('is-fresh', !!fresh && !reduceMotion);
      empty.hidden = shown.length > 0;
      if (!shown.length) {
        empty.textContent = '';
        empty.appendChild(document.createTextNode('Nothing matches “' + query + '”. Try a stack, like '));
        empty.appendChild(el('b', null, 'Flutter'));
        empty.appendChild(document.createTextNode(', or a word like '));
        empty.appendChild(el('b', null, 'contact'));
        empty.appendChild(document.createTextNode('.'));
      }
      setActive(0, true);

      window.clearTimeout(statusTimer);
      statusTimer = window.setTimeout(function () {
        status.textContent = !shown.length ? 'No results.' :
          shown.length === 1 ? '1 result.' : shown.length + ' results.';
      }, 350);
    };

    /* --- open, close, go ----------------------------------------------- */
    var returnFocus = null;
    var closing = false;

    var openSearch = function (seed) {
      if (dialog.open) return;
      returnFocus = document.activeElement;
      field.value = seed || '';
      closing = false;
      dialog.classList.remove('is-closing');
      dialog.showModal();
      render(true);
      field.focus();
      opener.setAttribute('aria-expanded', 'true');
    };

    // `then` runs once the dialog is really closed. Until then the page
    // behind it is inert, and focusing anything there silently fails.
    var closeSearch = function (then) {
      if (!dialog.open || closing) return;
      closing = true;
      var done = function () {
        dialog.removeEventListener('animationend', done);
        window.clearTimeout(fallback);
        dialog.classList.remove('is-closing');
        dialog.close();
        closing = false;
        opener.setAttribute('aria-expanded', 'false');
        if (typeof then === 'function') then();
        else if (returnFocus && returnFocus.focus) returnFocus.focus();
      };
      if (reduceMotion) { done(); return; }
      dialog.classList.add('is-closing');
      dialog.addEventListener('animationend', done);
      var fallback = window.setTimeout(done, 260);
    };

    var activate = function (it) {
      if (!it) return;
      if (it.run === 'copy') {
        copy(EMAIL).then(function (ok) {
          var sub = it.node && it.node.querySelector('.cmdk-sub');
          if (sub) sub.textContent = ok ? 'Copied to your clipboard' : EMAIL;
          status.textContent = ok ? 'Email address copied.' : 'Copy failed. The address is ' + EMAIL + '.';
          if (ok) window.setTimeout(function () { closeSearch(); }, 700);
        });
        return;
      }
      if (it.run === 'theme') {
        themeToggle.click();
        closeSearch();
        return;
      }
      if (it.external) {
        window.open(it.href, '_blank', 'noopener');
        closeSearch();
        return;
      }
      if (it.download) {
        var a = el('a');
        a.href = it.href;
        a.setAttribute('download', '');
        document.body.appendChild(a);
        a.click();
        a.remove();
        closeSearch();
        return;
      }
      var target = new URL(it.href);
      var samePage = target.pathname.replace(/\.html$/, '').replace(/\/index$/, '/') === here;
      var section = samePage && target.hash && document.getElementById(target.hash.slice(1));
      if (section) {
        window.history.pushState(null, '', target.hash);
        section.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' });
        // Focus follows the reader, so the next Tab starts from there.
        closeSearch(function () {
          if (!section.hasAttribute('tabindex')) section.setAttribute('tabindex', '-1');
          section.focus({ preventScroll: true });
        });
        return;
      }
      closeSearch(function () { window.location.href = it.href; });
    };

    opener.addEventListener('click', function () { openSearch(); });
    closeBtn.addEventListener('click', function () { closeSearch(); });

    // Escape: let the closing animation play instead of vanishing.
    dialog.addEventListener('cancel', function (e) { e.preventDefault(); closeSearch(); });

    // A click on the dimmed page outside the panel closes it.
    dialog.addEventListener('click', function (e) {
      if (e.target !== dialog) return;
      var r = dialog.getBoundingClientRect();
      var inside = e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom;
      if (!inside) closeSearch();
    });

    field.addEventListener('input', function () { render(false); });

    field.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowDown') { e.preventDefault(); setActive(active + 1, true); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); setActive(active - 1, true); }
      else if (e.key === 'PageDown') { e.preventDefault(); setActive(Math.min(active + 5, shown.length - 1), true); }
      else if (e.key === 'PageUp') { e.preventDefault(); setActive(Math.max(active - 5, 0), true); }
      else if (e.key === 'Enter') { e.preventDefault(); activate(shown[active]); }
    });

    // mousemove, not mouseover: a list scrolling under a still pointer must
    // not steal the highlight from the keyboard.
    list.addEventListener('mousemove', function (e) {
      var row = e.target.closest('.cmdk-item');
      if (!row) return;
      var i = shown.map(function (it) { return it.node; }).indexOf(row);
      if (i !== -1 && i !== active) setActive(i, false);
    });
    list.addEventListener('click', function (e) {
      var row = e.target.closest('.cmdk-item');
      if (!row) return;
      var i = shown.map(function (it) { return it.node; }).indexOf(row);
      if (i !== -1) activate(shown[i]);
    });

    var typing = function (node) {
      return node && (node.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(node.tagName));
    };

    document.addEventListener('keydown', function (e) {
      var otherOpen = (lightbox && !lightbox.hidden) ||
        document.querySelector('dialog[open]:not(.cmdk)');
      if ((e.key === 'k' || e.key === 'K') && (e.metaKey || e.ctrlKey) && !e.altKey && !e.shiftKey) {
        if (otherOpen) return;
        e.preventDefault();
        if (dialog.open) closeSearch(); else openSearch();
      } else if (e.key === '/' && !dialog.open && !otherOpen && !typing(document.activeElement) &&
                 !e.metaKey && !e.ctrlKey && !e.altKey) {
        e.preventDefault();
        openSearch();
      }
    });
  })();

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
