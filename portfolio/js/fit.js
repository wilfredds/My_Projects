/* ==========================================================================
   Check me against your job post.

   Paste a job post; every skill it names that this file knows about is
   listed with the work on this site that shows it, or marked honestly as
   related or not shown yet. It runs entirely in this page: the text is
   matched here and never stored or sent anywhere.

   Every claim below is checked against the projects themselves (their
   package.json, pubspec.yaml, schema and case studies), not against what
   would sound good. If a project changes, change its entry here too.
   ========================================================================== */

(function () {
  'use strict';

  var form = document.getElementById('fit-form');
  if (!form) return;

  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var EMAIL = 'frncishub@gmail.com';

  /* --- the work a skill can point to --------------------------------- */
  var WORK = {
    floodguard: { name: 'FloodGuard', href: 'projects/floodguard.html' },
    autocare: { name: 'AutoCare', href: 'projects/autocare.html' },
    rallyready: { name: 'RallyReady', href: 'projects/rallyready.html' },
    badminton: { name: 'BadmintonPH', href: 'https://badminton-ph.web.app', out: true },
    hiroshi: { name: 'Hiroshi Master Grill', href: 'projects/hiroshi-master-grill.html' },
    cyclemind: { name: 'CycleMind AI', href: 'projects/cyclemind-ai.html' },
    bikeguide: { name: 'Bike Guide PH', href: 'projects/bike-guide-ph.html' },
    crs: { name: 'Corruption Watch PH', href: 'projects/corruption-watch-ph.html' },
    hiraya: { name: 'Hiraya', href: '#hiraya' },
    site: { name: 'This site', href: '#top' },
    certs: { name: 'Certifications', href: '#certs' },
    repo: { name: 'GitHub', href: 'https://github.com/wilfredds/My_Projects', out: true }
  };

  /* --- the skills -------------------------------------------------------
     shown  a project here uses it
     near   related: a certification, or a close equivalent in use
     gap    not in any project on this site yet

     `find` holds regular-expression fragments matched case-insensitively
     as whole words. Entries are matched in this order and each match is
     blanked out of the text, so the specific ("Tailwind CSS", "React
     Native", "GitHub Actions") are caught before the general ("CSS",
     "React", "Git") can claim the same words. */
  var SKILLS = [
    // Specific names first, because they contain general ones.
    { name: 'React Native', status: 'near', find: ['react[- ]native'], work: ['cyclemind'],
      note: 'Mobile is Flutter here, not React Native.' },
    { name: 'State management', status: 'shown', work: ['rallyready', 'cyclemind'],
      find: ['state management', 'zustand', 'react[- ]query', 'tanstack(?: query)?', 'riverpod'],
      note: 'Zustand and React Query in RallyReady, Riverpod in CycleMind AI.' },
    { name: 'Forms and validation', status: 'shown', work: ['autocare', 'hiroshi'],
      find: ['react[- ]hook[- ]form', 'zod', 'form validation'],
      note: 'React Hook Form with Zod schemas.' },
    // Before Testing, which would otherwise take the "testing" in
    // "penetration testing".
    { name: 'Ethical hacking', status: 'near', work: ['certs'],
      find: ['ethical hacking', 'penetration testing', 'pen ?testing', 'vulnerability assessments?', 'soc', 'mitre(?: att&ck)?'],
      note: 'Cisco Ethical Hacker certification. Not a job done yet.' },
    { name: 'Networking', status: 'near', work: ['certs'],
      find: ['computer networks?', 'networking', 'ccna', 'tcp/ip'],
      note: 'Cisco CCNA: Introduction to Networks, and Networking Basics.' },
    { name: 'Testing', status: 'shown', work: ['rallyready', 'hiroshi', 'autocare'],
      find: ['(?:react )?testing library', 'unit tests?', 'unit testing', 'integration tests?',
             'automated (?:tests?|testing)', 'test coverage', 'vitest', 'testing'],
      note: 'RallyReady alone has 648 tests, run on every push.' },
    { name: 'Tailwind CSS', status: 'shown', find: ['tailwind(?:[- ]?css)?'],
      work: ['autocare', 'rallyready', 'hiroshi'] },
    { name: 'Next.js', status: 'shown', find: ['next\\.?js', 'next js', 'app router'],
      work: ['autocare', 'hiroshi'] },
    { name: 'Node.js', status: 'shown', find: ['node\\.?js', 'node'],
      work: ['autocare', 'hiroshi', 'cyclemind'],
      note: 'Next.js servers, and the Cloud Functions behind CycleMind AI.' },
    { name: 'Express', status: 'gap', find: ['express\\.?js', 'expressjs'] },
    { name: 'CI/CD', status: 'shown', work: ['autocare', 'rallyready', 'hiroshi', 'crs'],
      find: ['ci ?/ ?cd', 'continuous integration', 'continuous (?:delivery|deployment)',
             'github actions', 'ci pipelines?'],
      note: 'GitHub Actions run the tests and the build on every push.' },
    { name: 'Deployment', status: 'shown', work: ['autocare', 'rallyready', 'hiroshi', 'cyclemind', 'bikeguide'],
      find: ['vercel', 'firebase hosting', 'github pages', 'deploy(?:ment|ments|ing|s)?', 'hosting'],
      note: 'Six of the nine are live: Vercel, Firebase Hosting and GitHub Pages.' },
    { name: 'Git', status: 'shown', find: ['git', 'github', 'version control', 'pull requests?'],
      work: ['repo'], note: 'Every project here lives in one public repository.' },
    { name: 'PostgreSQL', status: 'shown', find: ['postgres(?:ql)?', 'psql'],
      work: ['autocare', 'hiroshi', 'rallyready'] },
    { name: 'MySQL', status: 'near', find: ['mysql', 'mariadb'], work: ['autocare', 'hiroshi'],
      note: 'PostgreSQL here, not MySQL.' },
    { name: 'SQL', status: 'shown', find: ['sql'], work: ['autocare', 'hiroshi', 'certs'],
      note: 'PostgreSQL in two projects, and the DataCamp data analyst certification.' },
    { name: 'Row-level security', status: 'shown', work: ['hiroshi', 'crs', 'certs'],
      find: ['row[- ]level security', 'rls', 'security rules', 'web security', 'application security',
             'app security', 'secure coding', 'cyber ?security', 'information security'],
      note: 'Hiroshi\'s database policies and Corruption Watch\'s rules are tested in CI; Ethical Hacker certified.' },
    { name: 'Role-based access', status: 'shown', work: ['autocare', 'hiroshi'],
      find: ['rbac', 'role[- ]based(?: access(?: control)?)?', 'user roles', 'access control'] },
    { name: 'Authentication', status: 'shown', work: ['autocare', 'hiroshi', 'cyclemind'],
      find: ['authentication', 'oauth ?2?(?:\\.0)?', 'next-?auth', 'auth', 'log ?ins?', 'sign[- ]?ins?'],
      note: 'NextAuth in AutoCare, a staff sign-in for Hiroshi, Google sign-in in CycleMind AI.' },
    { name: 'AI and LLM APIs', status: 'shown', work: ['cyclemind'],
      find: ['llms?', 'large language models?', 'generative ai', 'gen ?ai', 'ai integrations?', 'ai apis?',
             'ai features', 'openai', 'chatgpt', 'claude', 'anthropic', 'gemini', 'computer vision', 'vision models?'],
      note: 'CycleMind AI calls Claude\'s text and vision models through Cloud Functions.' },
    { name: 'Serverless functions', status: 'shown', work: ['cyclemind'],
      find: ['serverless', 'cloud functions', 'firebase functions', 'edge functions'],
      note: 'The AI key stays server-side, in Cloud Functions.' },
    { name: 'REST APIs', status: 'shown', work: ['autocare', 'cyclemind'],
      find: ['rest(?:ful)?[- ]apis?', 'restful', 'web apis?', 'http apis?'] },
    { name: 'GraphQL', status: 'gap', find: ['graphql', 'apollo'] },
    { name: 'Redux', status: 'near', find: ['redux(?: toolkit)?'], work: ['rallyready'],
      note: 'Zustand and React Query do that job in RallyReady.' },
    { name: 'Jest', status: 'near', find: ['jest'], work: ['rallyready'],
      note: 'Vitest, which runs Jest-style tests, not Jest itself.' },
    { name: 'Webpack', status: 'near', find: ['webpack'], work: ['rallyready'],
      note: 'Vite here, not Webpack.' },
    { name: 'Vite', status: 'shown', find: ['vite(?:js)?'], work: ['rallyready'] },
    { name: 'shadcn/ui and Radix', status: 'shown', find: ['shadcn(?:/ui)?', 'radix(?: ui)?'],
      work: ['autocare', 'rallyready'] },
    { name: 'Framer Motion', status: 'shown', find: ['framer[- ]motion'], work: ['rallyready'] },
    { name: 'React', status: 'shown', find: ['react(?:\\.?js)?(?!\\s+to(?![a-z]))'],
      work: ['rallyready', 'autocare', 'hiroshi', 'badminton'] },
    { name: 'TypeScript', status: 'shown', find: ['typescript'], work: ['autocare', 'rallyready', 'hiroshi'] },
    // "js" must not be the tail of Next.js or Node.js, which are caught above.
    { name: 'JavaScript', status: 'shown', find: ['javascript', 'ecmascript', 'es6', 'js'],
      pre: '[^a-z0-9.]', work: ['bikeguide', 'crs', 'site'],
      note: 'Two projects in plain JavaScript with no framework, and this site.' },
    { name: 'Sass/SCSS', status: 'gap', find: ['sass', 'scss'] },
    { name: 'HTML and CSS', status: 'shown', find: ['html5?', 'css3?'], work: ['bikeguide', 'crs', 'site'] },
    { name: 'Bootstrap', status: 'gap', find: ['bootstrap'] },
    { name: 'Responsive design', status: 'shown', work: ['site', 'bikeguide', 'hiroshi'],
      find: ['responsive(?: web)? design', 'responsive (?:web ?sites?|layouts?|uis?|interfaces?|pages?|web)',
             'mobile[- ]first', 'mobile[- ]responsive'] },
    { name: 'Accessibility', status: 'shown', work: ['site'],
      find: ['accessibility', 'a11y', 'wcag', 'aria', 'screen readers?'],
      note: 'Contrast measured to WCAG AA in both themes, keyboard access throughout.' },
    { name: 'PWA', status: 'shown', work: ['bikeguide', 'rallyready'],
      find: ['pwas?', 'progressive web apps?', 'service workers?', 'offline[- ]first'] },
    { name: 'Flutter', status: 'shown', find: ['flutter'], work: ['cyclemind'] },
    { name: 'Dart', status: 'shown', find: ['dart'], work: ['cyclemind'] },
    { name: 'Mobile apps', status: 'shown', work: ['cyclemind'],
      find: ['mobile (?:app|application)s?(?: development| developer)?', 'cross[- ]platform'],
      note: 'Flutter, published for the web.' },
    { name: 'Firebase', status: 'shown', find: ['firebase', 'firestore', 'cloud firestore'],
      work: ['cyclemind', 'bikeguide', 'crs', 'badminton'] },
    { name: 'Google Cloud', status: 'near', find: ['google cloud(?: platform)?', 'gcp'], work: ['cyclemind'],
      note: 'Firebase, which runs on Google Cloud. No other GCP services.' },
    { name: 'Supabase', status: 'shown', find: ['supabase'], work: ['rallyready', 'hiroshi'] },
    { name: 'Prisma', status: 'shown', find: ['prisma', 'orms?'], work: ['autocare'] },
    { name: 'MongoDB', status: 'gap', find: ['mongo(?:db)?'] },
    { name: 'Docker', status: 'near', find: ['docker(?:[- ]compose)?', 'containers?', 'containeri[sz]ation'],
      work: ['autocare'], note: 'Docker Compose for AutoCare\'s local database, not production containers.' },
    { name: 'Kubernetes', status: 'gap', find: ['kubernetes', 'k8s'] },
    { name: 'AWS', status: 'near', find: ['aws', 'amazon web services', 'ec2', 's3'], work: ['certs'],
      note: 'An AWS Educate compute badge. No AWS in production yet.' },
    { name: 'Azure', status: 'gap', find: ['azure'] },
    { name: 'Django', status: 'gap', find: ['django'] },
    { name: 'Flask', status: 'gap', find: ['flask'] },
    { name: 'Python', status: 'near', find: ['python'], work: ['certs'],
      note: 'Cisco Python Essentials 2 and DataCamp. No Python project on this site.' },
    { name: 'Data analysis', status: 'near', work: ['certs'],
      find: ['data analy(?:sis|tics|st)', 'pandas', 'data visuali[sz]ation', 'exploratory data analysis'],
      note: 'DataCamp Associate Data Analyst certification.' },
    { name: 'Internationalisation', status: 'shown', work: ['autocare'],
      find: ['i18n', 'internationali[sz]ation', 'locali[sz]ation', 'l10n', 'multilingual', 'multi-language'],
      note: 'AutoCare ships in six languages, Filipino among them.' },
    { name: 'Clean Architecture', status: 'shown', find: ['clean architecture'], work: ['cyclemind'] },
    { name: 'Google Maps', status: 'shown', find: ['google maps(?: api)?', 'maps api'], work: ['cyclemind'] },
    { name: 'IoT and embedded', status: 'shown', work: ['floodguard'],
      find: ['iot', 'internet of things', 'embedded(?: systems?)?', 'microcontrollers?', 'esp8266', 'nodemcu', 'gsm', 'sensors?'],
      note: 'A NodeMCU board and a GSM module sending SMS alerts, bench-tested.' },
    { name: 'Leadership', status: 'shown', work: ['floodguard'],
      find: ['leadership', 'team lead(?:er)?', 'lead(?:ing)? a team', 'led a team'],
      note: 'Team leader of the FloodGuard capstone.' },
    { name: 'Unity and C#', status: 'shown', find: ['c#', 'csharp', 'c sharp', 'unity3d', 'unity engine'],
      // Capital-U Unity only, and not "Unity of purpose": the engine, not the word.
      exact: ['Unity(?!\\s+of(?![a-z]))'], work: ['hiraya'], note: 'Hiraya, still being built.' },
    { name: '.NET', status: 'gap', find: ['\\.net', 'asp\\.net(?: core)?', 'dotnet'], pre: '[^a-z0-9]' },
    { name: 'Angular', status: 'gap', find: ['angular(?:js)?'] },
    { name: 'Vue', status: 'gap', find: ['vue(?:\\.?js)?', 'nuxt(?:\\.?js)?'] },
    { name: 'Svelte', status: 'gap', find: ['svelte(?:kit)?'] },
    { name: 'jQuery', status: 'gap', find: ['jquery'] },
    { name: 'Java', status: 'gap', find: ['java', 'spring boot', 'spring framework'] },
    { name: 'Kotlin', status: 'gap', find: ['kotlin'] },
    { name: 'PHP', status: 'gap', find: ['php'] },
    { name: 'Laravel', status: 'gap', find: ['laravel'] },
    { name: 'Go', status: 'gap', find: ['golang'] },
    { name: 'Ruby on Rails', status: 'gap', find: ['ruby on rails', 'ruby'] },
    { name: 'Storybook', status: 'gap', find: ['storybook'] },
    { name: 'Cypress', status: 'gap', find: ['cypress'] },
    { name: 'Selenium', status: 'gap', find: ['selenium'] },
    { name: 'Figma', status: 'gap', find: ['figma'] },
    { name: 'WordPress', status: 'gap', find: ['wordpress'] }
  ];

  var SAMPLE = [
    'Sample post: Junior Front-End Developer',
    '',
    'We are looking for a junior front-end developer to build and maintain our customer-facing web apps.',
    '',
    'What you will do',
    '- Build responsive UIs in React and TypeScript, styled with Tailwind CSS',
    '- Connect the front end to REST APIs',
    '- Write unit tests and review pull requests in Git',
    '',
    'Nice to have',
    '- Experience with Next.js or Vue',
    '- Familiarity with Figma and Docker'
  ].join('\n');

  /* --- matching ------------------------------------------------------- */
  // Whole words only: the character before a match must not be a letter or
  // digit, and neither may the one after. Written without lookbehind, so it
  // runs in every browser this site supports.
  SKILLS.forEach(function (skill) {
    var pre = '(^|' + (skill.pre || '[^a-z0-9]') + ')';
    skill.res = (skill.find || []).map(function (f) {
      return new RegExp(pre + '(' + f + ')(?![a-z0-9])', 'gi');
    });
    (skill.exact || []).forEach(function (f) {
      skill.res.push(new RegExp('(^|[^A-Za-z0-9])(' + f + ')(?![A-Za-z0-9])', 'g'));
    });
  });

  var check = function (text) {
    var source = ' ' + text.replace(/[\u2018\u2019]/g, '\'').replace(/[\u2013\u2014]/g, '-') + ' ';
    var found = [];
    SKILLS.forEach(function (skill) {
      var first = -1;
      skill.res.forEach(function (re) {
        re.lastIndex = 0;
        source = source.replace(re, function (all, before, word, at) {
          var start = at + before.length;
          if (first === -1 || start < first) first = start;
          // Blank the words out so a more general skill cannot claim them.
          return before + word.replace(/[^\n]/g, ' ');
        });
      });
      if (first !== -1) found.push({ skill: skill, at: first });
    });
    var order = { shown: 0, near: 1, gap: 2 };
    found.sort(function (a, b) {
      return (order[a.skill.status] - order[b.skill.status]) || (a.at - b.at);
    });
    return found.map(function (f) { return f.skill; });
  };

  /* --- the page -------------------------------------------------------- */
  var input = document.getElementById('fit-input');
  var sampleBtn = document.getElementById('fit-sample');
  var idle = document.getElementById('fit-idle');
  var result = document.getElementById('fit-result');
  var status = document.getElementById('fit-status');
  var SVG = 'http://www.w3.org/2000/svg';
  var MARKS = {
    shown: 'M4 10.5l4 4 8-9',
    near: 'M4 10c2-3 4-3 6 0s4 3 6 0',
    gap: 'M10 4.5a5.5 5.5 0 1 1 0 11a5.5 5.5 0 1 1 0-11'
  };
  var SPOKEN = { shown: 'Shown in my work.', near: 'Related.', gap: 'Not on this site yet.' };

  var el = function (tag, cls, text) {
    var node = document.createElement(tag);
    if (cls) node.className = cls;
    if (text !== undefined) node.textContent = text;
    return node;
  };

  var mark = function (kind) {
    var svg = document.createElementNS(SVG, 'svg');
    svg.setAttribute('viewBox', '0 0 20 20');
    svg.setAttribute('aria-hidden', 'true');
    var path = document.createElementNS(SVG, 'path');
    path.setAttribute('d', MARKS[kind]);
    path.setAttribute('pathLength', '1');
    svg.appendChild(path);
    return svg;
  };

  var link = function (key) {
    var w = WORK[key];
    var a = el('a', 'fit-proof-link', w.name);
    a.href = w.href;
    if (w.out) { a.target = '_blank'; a.rel = 'noopener'; }
    return a;
  };

  var plural = function (n, one, many) { return n + ' ' + (n === 1 ? one : many); };

  var summaryText = function (skills) {
    var by = function (s) { return skills.filter(function (k) { return k.status === s; }); };
    var names = function (list) { return list.map(function (w) { return WORK[w].name; }).join(', '); };
    var lines = ['Francis Wilfred Antiporda, checked against a job post'];
    var shown = by('shown');
    var near = by('near');
    var gap = by('gap');
    if (shown.length) {
      lines.push('', 'In his projects (' + shown.length + '):');
      shown.forEach(function (k) { lines.push('- ' + k.name + ': ' + names(k.work)); });
    }
    if (near.length) {
      lines.push('', 'Related (' + near.length + '):');
      near.forEach(function (k) { lines.push('- ' + k.name + ': ' + k.note); });
    }
    if (gap.length) {
      lines.push('', 'Not on his site yet (' + gap.length + '): ' + gap.map(function (k) { return k.name; }).join(', '));
    }
    lines.push('', 'Portfolio: ' + window.location.origin + '/', 'Email: ' + EMAIL);
    return lines.join('\n');
  };

  var copyText = function (text) {
    if (navigator.clipboard && window.isSecureContext) {
      return navigator.clipboard.writeText(text).then(function () { return true; }, function () { return false; });
    }
    var field = document.createElement('textarea');
    field.value = text;
    field.setAttribute('readonly', '');
    field.className = 'sr-only';
    document.body.appendChild(field);
    field.select();
    var ok = false;
    try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
    field.remove();
    return Promise.resolve(ok);
  };

  var countTimer = 0;
  var run = function () {
    var text = input.value.trim();
    if (!text) {
      status.textContent = 'Paste a job post first, or use the sample.';
      input.focus();
      return;
    }
    var skills = check(text);
    var shown = skills.filter(function (k) { return k.status === 'shown'; }).length;
    var near = skills.filter(function (k) { return k.status === 'near'; }).length;
    var gap = skills.length - shown - near;

    idle.hidden = true;
    result.hidden = false;
    result.textContent = '';
    result.classList.remove('is-running');

    if (!skills.length) {
      var none = el('div', 'fit-none');
      none.appendChild(el('p', 'fit-none-title', 'No skills I check for are named in this text.'));
      none.appendChild(el('p', null, 'It looks for technical skills by name, like React, SQL or Flutter. Try pasting the requirements section of the post.'));
      result.appendChild(none);
      status.textContent = 'No skills found in this text.';
      return;
    }

    /* the summary */
    var head = el('div', 'fit-summary');
    var count = el('p', 'fit-count');
    var num = el('span', 'fit-num', reduceMotion ? String(shown) : '0');
    count.appendChild(num);
    count.appendChild(el('span', 'fit-of', 'of ' + skills.length));
    head.appendChild(count);
    head.appendChild(el('p', 'fit-count-label',
      (skills.length === 1 ? 'skill named in this post is' : 'skills named in this post are') + ' in projects on this site'));

    var bar = el('ol', 'fit-bar');
    bar.setAttribute('aria-hidden', 'true');
    skills.forEach(function (k, i) {
      var seg = el('li', 'is-' + k.status);
      seg.style.setProperty('--i', i);
      bar.appendChild(seg);
    });
    head.appendChild(bar);

    var legend = el('p', 'fit-legend');
    if (shown) legend.appendChild(el('span', 'is-shown', shown + ' shown'));
    if (near) legend.appendChild(el('span', 'is-near', near + ' related'));
    if (gap) legend.appendChild(el('span', 'is-gap', gap + ' not here yet'));
    head.appendChild(legend);
    result.appendChild(head);

    /* the rows, in the order: shown, related, not yet */
    var rows = el('ul', 'fit-rows');
    skills.forEach(function (k, i) {
      var row = el('li', 'fit-row is-' + k.status);
      row.style.setProperty('--i', i);
      var m = el('span', 'fit-mark');
      m.appendChild(mark(k.status));
      row.appendChild(m);
      var name = el('span', 'fit-skill');
      name.appendChild(el('span', 'sr-only', SPOKEN[k.status] + ' '));
      name.appendChild(document.createTextNode(k.name));
      row.appendChild(name);

      var proof = el('span', 'fit-proof');
      if (k.status === 'gap') {
        proof.appendChild(el('span', 'fit-quiet', 'Not in a project on this site yet'));
      } else {
        k.work.forEach(function (key, n) {
          if (n) proof.appendChild(document.createTextNode(', '));
          proof.appendChild(link(key));
        });
      }
      if (k.note) proof.appendChild(el('span', 'fit-note', k.note));
      row.appendChild(proof);
      rows.appendChild(row);
    });
    result.appendChild(rows);

    /* what to do next */
    var next = el('div', 'fit-next');
    var mail = el('a', 'btn btn-primary', 'Email me about this role');
    mail.href = 'mailto:' + EMAIL + '?subject=' + encodeURIComponent('About a role we are hiring for') +
      '&body=' + encodeURIComponent('Hi Francis,\n\nI checked our job post against your portfolio: ' +
        shown + ' of ' + skills.length + ' skills shown in your projects.\n\n');
    next.appendChild(mail);
    var copyBtn = el('button', 'btn', 'Copy the summary');
    copyBtn.type = 'button';
    copyBtn.addEventListener('click', function () {
      copyText(summaryText(skills)).then(function (ok) {
        copyBtn.textContent = ok ? 'Summary copied' : 'Copy failed';
        copyBtn.classList.toggle('is-copied', ok);
        status.textContent = ok ? 'Summary copied to your clipboard.' : 'Copy failed. Select the results and copy them instead.';
        window.setTimeout(function () {
          copyBtn.textContent = 'Copy the summary';
          copyBtn.classList.remove('is-copied');
        }, 1800);
      });
    });
    next.appendChild(copyBtn);
    result.appendChild(next);
    result.appendChild(el('p', 'fit-scope',
      'It recognises ' + SKILLS.length + ' technical skills by name. Years of experience, degrees and soft skills are not scored.'));

    status.textContent = shown + ' of ' + plural(skills.length, 'skill', 'skills') +
      ' named in this post ' + (skills.length === 1 ? 'is' : 'are') + ' shown in projects on this site' +
      (near ? ', ' + near + ' related' : '') + (gap ? ', ' + gap + ' not here yet' : '') + '.';

    if (reduceMotion) return;

    // Rows stream in like a test run; the count keeps pace with the ticks.
    void result.offsetWidth;
    result.classList.add('is-running');
    window.cancelAnimationFrame(countTimer);
    var started = performance.now();
    var step = 70;
    var lead = 260;
    var tickCount = function (now) {
      var t = now - started - lead;
      var reached = Math.max(0, Math.min(shown, Math.floor(t / step) + 1));
      if (t < 0) reached = 0;
      num.textContent = String(reached);
      if (reached < shown) countTimer = window.requestAnimationFrame(tickCount);
    };
    countTimer = window.requestAnimationFrame(tickCount);
  };

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    run();
  });

  // Pasting is the whole point, so a paste runs the check by itself.
  input.addEventListener('paste', function () {
    window.setTimeout(run, 0);
  });

  input.addEventListener('keydown', function (e) {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      run();
    }
  });

  sampleBtn.addEventListener('click', function () {
    input.value = SAMPLE;
    run();
  });
})();
