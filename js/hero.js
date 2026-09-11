/* ==========================================================================
   hero.js — entrance timeline, word-morph headline, card tilt,
             magnetic cursor, scroll-out

   Exposes VB.hero = { play() }  — main.js calls play() when the preloader
   has faded out.
   ========================================================================== */
(function () {
  'use strict';

  var VB = (window.VB = window.VB || {});
  if (VB.reduceMotion === undefined) {
    VB.reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  if (typeof gsap === 'undefined') {
    console.warn('[VarBro] GSAP did not load — the hero will render statically.');
    VB.hero = { play: function () {} };
    return;
  }

  /* GSAP does not understand a raw CSS cubic-bezier() string — it silently
     falls back to its default ease. Solve the curve and register it so
     --ease-brand is genuinely what runs. */
  function cubicBezier(x1, y1, x2, y2) {
    function A(a, b) { return 1 - 3 * b + 3 * a; }
    function B(a, b) { return 3 * b - 6 * a; }
    function C(a) { return 3 * a; }
    function calc(t, a, b) { return ((A(a, b) * t + B(a, b)) * t + C(a)) * t; }
    function slope(t, a, b) { return 3 * A(a, b) * t * t + 2 * B(a, b) * t + C(a); }

    return function (x) {
      if (x <= 0) return 0;
      if (x >= 1) return 1;
      var t = x;
      for (var i = 0; i < 8; i++) {          /* Newton-Raphson */
        var s = slope(t, x1, x2);
        if (s === 0) break;
        t -= (calc(t, x1, x2) - x) / s;
      }
      return calc(t, y1, y2);
    };
  }

  gsap.registerEase('brand', cubicBezier(0.16, 1, 0.3, 1));

  var EASE = 'brand';            /* === --ease-brand */
  VB.ease = EASE;

  var hero      = document.getElementById('hero');
  var eyebrow   = document.querySelector('.hero-eyebrow');
  var headline  = document.querySelector('.hero-headline');
  var sub       = document.querySelector('.hero-sub');
  var heroBtn   = document.querySelector('.hero__text .btn');
  var textBlock = document.querySelector('.hero__text');
  var scatters  = Array.prototype.slice.call(document.querySelectorAll('.hero__cards .card-scatter'));
  var cards     = Array.prototype.slice.call(document.querySelectorAll('.hero__cards .card'));
  var canvas    = document.getElementById('heroCanvas');
  var morph     = document.querySelector('.hero-headline__morph');

  if (!hero) { VB.hero = { play: function () {} }; return; }

  /* --------------------------------------------------------------- helpers */

  function hexToRgb(hex) {
    var h = String(hex).trim().replace('#', '');
    if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
    var n = parseInt(h, 16);
    if (isNaN(n)) n = 0;
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }

  function cssVar(name) {
    return getComputedStyle(document.documentElement).getPropertyValue(name);
  }

  function debounce(fn, ms) {
    var t = null;
    return function () {
      if (t) clearTimeout(t);
      t = setTimeout(fn, ms);
    };
  }

  var interactive =
    !VB.reduceMotion &&
    window.innerWidth >= 900 &&
    !window.matchMedia('(pointer: coarse)').matches;

  /* ======================================================================
     Initial state — opacity/transform only. Nothing is display:none or
     visibility:hidden, so every element holds its layout box from frame 1
     and CLS stays at 0.
     ====================================================================== */
  if (VB.reduceMotion) {
    gsap.set(hero, { opacity: 0 });
  } else {
    gsap.set([eyebrow, headline, sub, heroBtn], { y: 20, opacity: 0 });
    gsap.set(scatters, { y: 30, scale: 0.95, opacity: 0 });
  }

  /* ======================================================================
     Word-morph headline
     ====================================================================== */
  var wordMorph = (function () {
    var WORDS = ['builds', 'designs', 'codes', 'animates'];
    if (!morph) return { start: function () {}, stop: function () {} };

    var current = morph.querySelector('.word');
    var currentSplit = null;
    var idx = 0;
    var timer = null;
    var running = false;

    /* ---- reserve the width of the longest word so the line never reflows */
    function measure() {
      var probe = document.createElement('span');
      var cs = getComputedStyle(current || morph);

      probe.style.position = 'absolute';
      probe.style.visibility = 'hidden';
      probe.style.whiteSpace = 'nowrap';
      probe.style.pointerEvents = 'none';
      probe.style.insetInlineStart = '-9999px';
      probe.style.insetBlockStart = '0';
      /* Copy the individual properties: the `font` shorthand comes back
         empty in some browsers. */
      probe.style.fontFamily = cs.fontFamily;
      probe.style.fontSize = cs.fontSize;
      probe.style.fontWeight = cs.fontWeight;
      probe.style.fontStyle = cs.fontStyle;
      probe.style.letterSpacing = cs.letterSpacing;
      document.body.appendChild(probe);

      var widest = 0;
      WORDS.forEach(function (w) {
        probe.textContent = w;
        widest = Math.max(widest, probe.getBoundingClientRect().width);
      });

      document.body.removeChild(probe);
      morph.style.minWidth = Math.ceil(widest) + 'px';
    }

    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(measure).catch(measure);
    } else {
      measure();
    }
    window.addEventListener('resize', debounce(measure, 150));

    /* ---- the cycle ---- */
    function swap() {
      var next = WORDS[(idx + 1) % WORDS.length];
      idx = (idx + 1) % WORDS.length;

      var incoming = document.createElement('span');
      incoming.className = 'word';
      incoming.textContent = next;
      morph.appendChild(incoming);

      var inSplit = new SplitText(incoming, { type: 'chars' });
      gsap.set(inSplit.chars, { y: '0.5em', opacity: 0, filter: 'blur(8px)' });

      var outgoing = current;
      var outSplit = currentSplit;

      if (outSplit) {
        gsap.to(outSplit.chars, {
          y: '-0.5em', opacity: 0, filter: 'blur(8px)',
          duration: 0.4, ease: EASE, stagger: 0.018,
          onComplete: function () {
            outSplit.revert();
            if (outgoing && outgoing.parentNode) outgoing.parentNode.removeChild(outgoing);
          }
        });
      } else if (outgoing && outgoing.parentNode) {
        outgoing.parentNode.removeChild(outgoing);
      }

      gsap.to(inSplit.chars, {
        y: '0em', opacity: 1, filter: 'blur(0px)',
        duration: 0.4, ease: EASE, stagger: 0.018
      });

      current = incoming;
      currentSplit = inSplit;

      if (running) timer = setTimeout(swap, 1800);
    }

    return {
      start: function () {
        if (VB.reduceMotion || running) return;   /* reduced motion: static "builds" */
        running = true;
        if (current) currentSplit = new SplitText(current, { type: 'chars' });
        timer = setTimeout(swap, 1800);
      },
      stop: function () {
        running = false;
        if (timer) clearTimeout(timer);
        timer = null;
      }
    };
  })();

  /* ======================================================================
     Card 3D tilt — desktop, fine pointer, motion allowed
     ====================================================================== */
  function initTilt() {
    if (!interactive) return;

    var rgb = hexToRgb(cssVar('--card-primary-a'));
    var lifted = '0 20px 45px -20px rgba(' + rgb[0] + ',' + rgb[1] + ',' + rgb[2] + ',0.5)';

    cards.forEach(function (card) {
      /* quickTo keeps per-frame writes cheap instead of spawning tweens */
      var setRotY = gsap.quickTo(card, 'rotationY', { duration: 0.5, ease: 'power3.out' });
      var setRotX = gsap.quickTo(card, 'rotationX', { duration: 0.5, ease: 'power3.out' });
      var setY    = gsap.quickTo(card, 'y',         { duration: 0.5, ease: 'power3.out' });

      card.addEventListener('mousemove', function (e) {
        var r = card.getBoundingClientRect();
        var nx = (e.clientX - r.left) / r.width;      /* 0..1 */
        var ny = (e.clientY - r.top) / r.height;      /* 0..1 */
        setRotY(-8 + nx * 16);                        /* -8deg .. 8deg */
        setRotX(8 - ny * 16);                         /*  8deg .. -8deg */
        setY(-6);
      });

      card.addEventListener('mouseenter', function () {
        gsap.to(card, { boxShadow: lifted, duration: 0.3, ease: 'power2.out' });
      });

      card.addEventListener('mouseleave', function () {
        gsap.to(card, {
          rotationX: 0, rotationY: 0, y: 0,
          boxShadow: '0 0px 0px 0px rgba(' + rgb[0] + ',' + rgb[1] + ',' + rgb[2] + ',0)',
          duration: 0.6, ease: EASE
        });
      });
    });
  }

  /* ======================================================================
     Magnetic cursor — desktop, fine pointer, motion allowed
     ====================================================================== */
  function initCursor() {
    var dot = document.getElementById('cursorDot');
    var ring = document.getElementById('cursorRing');
    if (!dot || !ring || !interactive) return;

    document.body.classList.add('has-cursor');
    gsap.set([dot, ring], { xPercent: -50, yPercent: -50 });

    var mx = window.innerWidth / 2, my = window.innerHeight / 2;
    var rx = mx, ry = my;
    var hovered = null;

    var setDot  = gsap.quickSetter(dot, 'css');
    var setRing = gsap.quickSetter(ring, 'css');

    window.addEventListener('pointermove', function (e) {
      mx = e.clientX;
      my = e.clientY;
      setDot({ x: mx, y: my });                      /* the dot tracks 1:1 */
    }, { passive: true });

    function frame() {
      var tx = mx, ty = my;

      /* magnetic pull: nudge the ring up to 8px toward the hovered element */
      if (hovered) {
        var r = hovered.getBoundingClientRect();
        var dx = (r.left + r.width / 2) - mx;
        var dy = (r.top + r.height / 2) - my;
        var dist = Math.sqrt(dx * dx + dy * dy) || 1;
        var mag = Math.min(8, dist);
        tx += (dx / dist) * mag;
        ty += (dy / dist) * mag;
      }

      rx += (tx - rx) * 0.15;                        /* trailing ring */
      ry += (ty - ry) * 0.15;
      setRing({ x: rx, y: ry });
      requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);

    var accent = cssVar('--card-primary-a').trim();

    Array.prototype.slice.call(document.querySelectorAll('[data-magnetic]')).forEach(function (el) {
      el.addEventListener('mouseenter', function () {
        hovered = el;
        gsap.to(ring, { width: 56, height: 56, borderColor: accent, duration: 0.3, ease: 'power2.out' });
      });
      el.addEventListener('mouseleave', function () {
        hovered = null;
        gsap.to(ring, { width: 32, height: 32, borderColor: 'rgba(255,255,255,0.4)', duration: 0.3, ease: 'power2.out' });
      });
    });
  }

  /* ======================================================================
     Scroll-out — scrubbed, the hero is never pinned
     ====================================================================== */
  function initScrollOut() {
    if (typeof ScrollTrigger === 'undefined') return;

    /* Render/interval gating runs regardless of motion preference. */
    ScrollTrigger.create({
      trigger: hero,
      start: 'top bottom',
      end: 'bottom top',
      onLeave:     function () { if (VB.shader) VB.shader.pause();  if (VB.cards) VB.cards.pause(); },
      onLeaveBack: function () { if (VB.shader) VB.shader.pause();  if (VB.cards) VB.cards.pause(); },
      onEnter:     function () { if (VB.shader) VB.shader.resume(); if (VB.cards) VB.cards.resume(); },
      onEnterBack: function () { if (VB.shader) VB.shader.resume(); if (VB.cards) VB.cards.resume(); }
    });

    if (VB.reduceMotion) return;   /* the hero simply scrolls away */

    var tl = gsap.timeline({
      scrollTrigger: {
        trigger: hero,
        start: 'top top',
        end: 'bottom top',
        scrub: true
      }
    });

    /* text drifts slower than the page — light parallax */
    tl.to(textBlock, { y: -60, opacity: 0, ease: 'none' }, 0);

    /* each card leaves in its own direction so they scatter, not slide */
    var SCATTER = [
      { x: -120, y: -90, rotationY: -25, rotationZ: -12 },   /* up-left    */
      { x:  120, y: -90, rotationY:  25, rotationZ:  12 },   /* up-right   */
      { x: -110, y:  80, rotationY:  25, rotationZ: -12 },   /* down-left  */
      { x:  110, y:  80, rotationY: -25, rotationZ:  12 }    /* down-right */
    ];

    scatters.forEach(function (el, i) {
      var s = SCATTER[i % SCATTER.length];
      tl.to(el, {
        x: s.x, y: s.y,
        rotationY: s.rotationY,
        rotationZ: s.rotationZ,
        opacity: 0,
        ease: 'none'
      }, 0);
    });

    if (canvas) tl.to(canvas, { opacity: 0, ease: 'none' }, 0);
  }

  /* ======================================================================
     Entrance
     ====================================================================== */
  function play() {
    if (VB.cards) VB.cards.init();

    if (VB.reduceMotion) {
      gsap.to(hero, {
        opacity: 1, duration: 0.3,
        onComplete: function () { initScrollOut(); }
      });
      return;
    }

    var tl = gsap.timeline({
      defaults: { duration: 0.6, ease: EASE },
      onComplete: function () {
        wordMorph.start();     /* the morph loop starts only once this finishes */
        initTilt();
        initCursor();
      }
    });

    tl.to(eyebrow,  { y: 0, opacity: 1 }, 0)
      .to(headline, { y: 0, opacity: 1 }, 0.1)
      .to(sub,      { y: 0, opacity: 1 }, 0.2)
      .to(heroBtn,  { y: 0, opacity: 1 }, 0.3)
      /* cards overlap the text: 200ms after the headline begins */
      .to(scatters, { y: 0, scale: 1, opacity: 1, stagger: 0.09 }, 0.3);

    initScrollOut();
  }

  VB.hero = { play: play };
})();
