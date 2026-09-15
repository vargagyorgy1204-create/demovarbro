/* ==========================================================================
   hero.js — entrance timeline, word-morph headline, magnetic cursor,
             scroll-out

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
  var canvas    = document.getElementById('heroCanvas');
  var morph     = document.querySelector('.hero-headline__morph');

  if (!hero) { VB.hero = { play: function () {} }; return; }

  /* --------------------------------------------------------------- helpers */

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
    var WORDS = ['builds', 'designs', 'codes'];
    if (!morph) return { start: function () {}, stop: function () {} };

    var current = morph.querySelector('.word');
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

    var PAUSE_MS = 900;   /* how long a fully-assembled word holds before the next cycle */

    /* ---- shared setup for both enter and exit: split a word into letters
       and offset each letter's background-clip:text gradient so the
       per-character slices reconstruct ONE continuous gradient across the
       word instead of one gradient per letter (the character carries no
       background/color of its own otherwise). No overflow-hidden mask here
       — letters spin past their own box's edges mid-flight, which a snug
       mask would clip. */
    function splitChars(el) {
      var split = new SplitText(el, { type: 'chars', charsClass: 'wm-char' });

      /* Measured before any transform (position/rotation only move things
         visually, but measuring first keeps this unambiguous). */
      var wordRect = el.getBoundingClientRect();
      var wordWidth = wordRect.width;
      split.chars.forEach(function (charEl) {
        var charRect = charEl.getBoundingClientRect();
        var offsetX = charRect.left - wordRect.left;
        charEl.style.backgroundSize = wordWidth + 'px 100%';
        charEl.style.backgroundPosition = (-offsetX) + 'px 0';
      });

      return split;
    }

    function rand(min, max) {
      return min + Math.random() * (max - min);
    }

    /* ---- enter: letters build the word up one at a time, left to right —
       each drops in with a short spin. stagger's default (ordered) walk
       through split.chars already goes left to right, and a stagger gap
       roughly matching each letter's own duration means one letter settles
       before the next starts moving, so the already-built prefix stays put
       while exactly one letter is ever mid-flight. onDone fires once the
       whole word is fully assembled (used to schedule the next cycle). */
    function enterWord(incoming, onDone) {
      var split = splitChars(incoming);

      gsap.set(split.chars, {
        yPercent: function () { return rand(-70, 70); },
        rotation: function () { return rand(-130, 130); },
        opacity: 0
      });

      gsap.to(split.chars, {
        yPercent: 0, rotation: 0, opacity: 1,
        duration: 0.32, ease: EASE, stagger: 0.3,
        onComplete: function () {
          split.revert();   /* settle back to plain text once fully in */
          if (onDone) onDone();
        }
      });
    }

    /* ---- exit: mirror of the enter — letters disappear one at a time,
       left to right, with the same kind of spin, before the element is
       discarded (no plain text to revert back to, unlike enterWord). */
    function exitWord(outgoing, onDone) {
      var split = splitChars(outgoing);

      gsap.to(split.chars, {
        yPercent: function () { return rand(-70, 70); },
        rotation: function () { return rand(-130, 130); },
        opacity: 0,
        duration: 0.28, ease: EASE, stagger: 0.24,
        onComplete: function () {
          if (outgoing.parentNode) outgoing.parentNode.removeChild(outgoing);
          onDone();
        }
      });
    }

    /* ---- the cycle: outgoing word's letters disappear one by one, THEN
       (not overlapping) the incoming word's letters build up one by one.
       The next cycle is scheduled only once the incoming word is FULLY
       assembled (not from a fixed clock at enter-start) — a sequential
       per-letter build takes longer for longer words, so timing has to
       follow the actual animation rather than a fixed delay. ---- */
    function swap() {
      idx = (idx + 1) % WORDS.length;
      var next = WORDS[idx];
      var outgoing = current;

      function startEnter() {
        var incoming = document.createElement('span');
        incoming.className = 'word';
        incoming.textContent = next;
        morph.appendChild(incoming);
        current = incoming;

        enterWord(incoming, function () {
          if (running) timer = setTimeout(swap, PAUSE_MS);
        });
      }

      if (outgoing) {
        exitWord(outgoing, startEnter);
      } else {
        startEnter();
      }
    }

    return {
      start: function () {
        if (VB.reduceMotion || running) return;   /* reduced motion: static "builds" */
        running = true;
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
     Magnetic cursor — desktop, fine pointer, motion allowed

     Note: the mousemove 3D-tilt system that used to run alongside this
     (rotateX/rotateY/lift on hover) has been removed entirely — it applied
     to exactly four elements (stamp, music player, terminal, building
     card) and all four are now excluded, so no tilt code is left to attach
     to anything. This cursor effect is independent and stays as-is.
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
        initCursor();
        /* Must run only after scatters have actually reached their rest
           state (y:0, scale:1, opacity:1) — initScrollOut()'s .to() tweens
           capture their "from" value at the moment they're defined, and
           ScrollTrigger renders a scrubbed timeline immediately on
           creation. Calling this any earlier (e.g. right after the
           timeline above is merely constructed, not yet complete) races
           against the still-running entrance tween on the same
           properties: the scroll-out timeline could capture the
           pre-entrance hidden values (y:30, opacity:0) as its own rest
           state instead, leaving cards stuck mid-scatter at the top of
           the page. */
        initScrollOut();
      }
    });

    tl.to(eyebrow,  { y: 0, opacity: 1 }, 0)
      .to(headline, { y: 0, opacity: 1 }, 0.1)
      .to(sub,      { y: 0, opacity: 1 }, 0.2)
      .to(heroBtn,  { y: 0, opacity: 1 }, 0.3)
      /* cards overlap the text: 200ms after the headline begins */
      .to(scatters, { y: 0, scale: 1, opacity: 1, stagger: 0.09 }, 0.3);
  }

  VB.hero = { play: play };
})();
