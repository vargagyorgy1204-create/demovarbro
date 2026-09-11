/* ==========================================================================
   main.js — Lenis smooth scroll, nav + fullscreen menu, dot indicators,
             preloader, and the hand-off to the hero entrance.
   ========================================================================== */
(function () {
  'use strict';

  var VB = (window.VB = window.VB || {});
  if (VB.reduceMotion === undefined) {
    VB.reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  /* hero.js registers the real --ease-brand curve as "brand". */
  var EASE = VB.ease || 'power2.out';

  if (typeof gsap !== 'undefined') {
    gsap.registerPlugin(ScrollTrigger, SplitText, Flip);
  }

  /* ======================================================================
     Lucide icons
     ====================================================================== */
  function initIcons() {
    if (typeof lucide === 'undefined') {
      console.warn('[VarBro] Lucide did not load — icons will not render.');
      return;
    }
    lucide.createIcons({ attrs: { 'stroke-width': 1.75 } });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initIcons);
  } else {
    initIcons();
  }

  /* ======================================================================
     Lenis smooth scroll
     Wired into GSAP's ticker so scrubbed ScrollTriggers stay in sync.
     ====================================================================== */
  var lenis = null;

  if (!VB.reduceMotion && typeof Lenis !== 'undefined' && typeof gsap !== 'undefined') {
    lenis = new Lenis({
      duration: 1.1,
      easing: function (t) { return Math.min(1, 1.001 - Math.pow(2, -10 * t)); }
    });

    lenis.on('scroll', ScrollTrigger.update);

    gsap.ticker.add(function (time) {
      lenis.raf(time * 1000);          /* GSAP ticker is in seconds */
    });
    gsap.ticker.lagSmoothing(0);
  } else if (VB.reduceMotion) {
    /* Smooth scrolling is motion too — disabled entirely. */
    console.info('[VarBro] Reduced motion: Lenis disabled, native scrolling in use.');
  }

  VB.lenis = lenis;

  function scrollToSection(selector) {
    var el = document.querySelector(selector);
    if (!el) return;
    if (lenis) lenis.scrollTo(el);
    else el.scrollIntoView({ behavior: 'auto', block: 'start' });
  }

  /* ======================================================================
     Logo guard — the "Vb" PNGs are not in assets/img yet
     ====================================================================== */
  (function guardLogo() {
    var logo = document.querySelector('.nav__logo');
    if (!logo) return;

    var imgs = Array.prototype.slice.call(logo.querySelectorAll('.nav__logo-img'));
    var warned = false;

    function markMissing() {
      if (warned) return;
      warned = true;
      logo.classList.add('is-missing');
      console.warn(
        '[VarBro] Logo image missing — expected assets/img/vb-logo-dark-square.png and ' +
        'assets/img/vb-logo-light-square.png. Falling back to a text "Vb" mark.'
      );
    }

    imgs.forEach(function (img) {
      img.addEventListener('error', markMissing);
      /* Cached failures fire no event, so check the ones already settled. */
      if (img.complete && img.naturalWidth === 0) markMissing();
    });
  })();

  /* ======================================================================
     Nav + dots theme swapping, driven by each section's data-theme
     ====================================================================== */
  var nav = document.getElementById('nav');
  var dotsRail = document.getElementById('dots');

  function applyTheme(theme) {
    var onLight = theme === 'light';
    if (nav) nav.classList.toggle('nav--on-light', onLight);
    if (dotsRail) dotsRail.classList.toggle('dots--on-light', onLight);
  }

  /* ======================================================================
     Fullscreen menu
     ====================================================================== */
  var burger = document.getElementById('burger');
  var menu = document.getElementById('menu');
  var menuLinks = Array.prototype.slice.call(document.querySelectorAll('.menu__link, .menu__social-link'));
  var mainEl = document.querySelector('main');
  var menuOpen = false;
  var lastFocused = null;

  function openMenu() {
    if (menuOpen || !menu || typeof gsap === 'undefined') return;
    menuOpen = true;
    lastFocused = document.activeElement;

    menu.inert = false;
    menu.classList.add('is-open');
    burger.classList.add('is-open');
    burger.setAttribute('aria-expanded', 'true');
    burger.setAttribute('aria-label', 'Menü bezárása');

    /* Pause the scroller itself rather than just hiding the overflow. */
    if (lenis) lenis.stop();
    if (mainEl) mainEl.inert = true;
    if (dotsRail) dotsRail.inert = true;

    var d = VB.reduceMotion ? 0 : 0.5;
    gsap.timeline()
      .to(menu, { clipPath: 'inset(0 0 0% 0)', duration: d, ease: EASE })
      .fromTo(menuLinks,
        { y: 24, opacity: 0 },
        { y: 0, opacity: 1, duration: VB.reduceMotion ? 0 : 0.4, stagger: VB.reduceMotion ? 0 : 0.06, ease: EASE },
        VB.reduceMotion ? 0 : 0.15);

    if (menuLinks[0]) menuLinks[0].focus({ preventScroll: true });
  }

  function closeMenu() {
    if (!menuOpen || !menu) return;
    menuOpen = false;

    burger.classList.remove('is-open');
    burger.setAttribute('aria-expanded', 'false');
    burger.setAttribute('aria-label', 'Menü megnyitása');

    if (mainEl) mainEl.inert = false;
    if (dotsRail) dotsRail.inert = false;

    gsap.to(menu, {
      clipPath: 'inset(0 0 100% 0)',
      duration: VB.reduceMotion ? 0 : 0.5,
      ease: EASE,
      onComplete: function () {
        menu.classList.remove('is-open');
        menu.inert = true;
        if (lenis) lenis.start();
      }
    });

    if (lastFocused && lastFocused.focus) lastFocused.focus({ preventScroll: true });
  }

  if (burger) {
    burger.addEventListener('click', function () {
      if (menuOpen) closeMenu(); else openMenu();
    });
  }

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && menuOpen) closeMenu();
  });

  menuLinks.forEach(function (link) {
    link.addEventListener('click', function (e) {
      var href = link.getAttribute('href') || '';
      if (href.charAt(0) === '#') {
        e.preventDefault();
        closeMenu();
        /* Let the wipe start before the scroll takes over. */
        setTimeout(function () { scrollToSection(href); }, VB.reduceMotion ? 0 : 260);
      } else {
        closeMenu();      /* external link — let the browser follow it */
      }
    });
  });

  /* ======================================================================
     Side dot indicators
     ====================================================================== */
  var dotButtons = Array.prototype.slice.call(document.querySelectorAll('.dot'));

  dotButtons.forEach(function (dot) {
    dot.addEventListener('click', function () {
      scrollToSection(dot.dataset.target);
    });
  });

  function setActiveDot(index) {
    if (typeof gsap === 'undefined') return;
    dotButtons.forEach(function (dot, i) {
      var active = i === index;
      dot.classList.toggle('is-active', active);
      /* Morph the circle into a rounded bar by animating the box itself. */
      gsap.to(dot, {
        width: active ? 3 : 8,
        height: active ? 20 : 8,
        duration: VB.reduceMotion ? 0 : 0.35,
        ease: EASE
      });
    });
  }

  /* ======================================================================
     Section-driven triggers: theme, active dot, dot-rail visibility
     ====================================================================== */
  function initSectionTriggers() {
    if (typeof ScrollTrigger === 'undefined') return;

    var sections = Array.prototype.slice.call(document.querySelectorAll('section[data-theme]'));

    sections.forEach(function (section, i) {
      /* 46px ~ the vertical centre of the nav bar */
      ScrollTrigger.create({
        trigger: section,
        start: 'top 46px',
        end: 'bottom 46px',
        onEnter: function () { applyTheme(section.dataset.theme); setActiveDot(i); },
        onEnterBack: function () { applyTheme(section.dataset.theme); setActiveDot(i); }
      });
    });

    applyTheme(sections.length ? sections[0].dataset.theme : 'dark');
    setActiveDot(0);

    /* The rail stays out of the way until the hero is behind us.
       Note: `end: "max"` resolves to the trigger's own bottom here, not the
       document maximum, which yields a zero-length trigger that never fires —
       so this crosses a single point with onEnter/onLeaveBack instead. */
    var hero = document.getElementById('hero');
    if (hero && dotsRail) {
      var setRailVisible = function (visible) {
        gsap.to(dotsRail, {
          opacity: visible ? 1 : 0,
          duration: VB.reduceMotion ? 0 : 0.4,
          ease: 'power2.out'
        });
        dotsRail.classList.toggle('is-visible', visible);
      };

      ScrollTrigger.create({
        trigger: hero,
        start: 'bottom top',
        onEnter: function () { setRailVisible(true); },
        onLeaveBack: function () { setRailVisible(false); }
      });
    }
  }

  /* ======================================================================
     Preloader
     ====================================================================== */
  (function preloader() {
    var overlay = document.getElementById('preloader');
    var lineEl = document.getElementById('preloaderLine');

    var LINES = [
      'Pixeleket igazítom...',
      'Kávét kortyolok közben...',
      'A gradiens még festi magát...',
      'Mindjárt kész, ígérem...'
    ];
    var FINAL = 'Kezdődjön a show';

    var LINE_VISIBLE = 700;
    var FADE = 200;
    var FINAL_HOLD = 600;
    var OUT = 600;
    var MIN_TOTAL = 1400;
    var SCENE_TIMEOUT = 6000;

    function finish() {
      document.body.classList.add('is-loaded');
      if (typeof ScrollTrigger !== 'undefined') ScrollTrigger.refresh();
      initSectionTriggers();
      if (VB.hero) VB.hero.play();
    }

    if (!overlay || !lineEl || typeof gsap === 'undefined') {
      if (overlay) overlay.remove();
      finish();
      return;
    }

    /* ---- reduced motion: final line only, gone after 800ms ---- */
    if (VB.reduceMotion) {
      lineEl.textContent = FINAL;
      lineEl.classList.add('is-final');
      setTimeout(function () {
        overlay.remove();
        finish();
      }, 800);
      return;
    }

    var dismissRequested = false;
    var finished = false;
    var index = 0;

    /* Both gates must be satisfied: the minimum display time AND the scene. */
    var minTime = new Promise(function (res) { setTimeout(res, MIN_TOTAL); });

    var timedOut = false;
    var sceneReady = Promise.race([
      VB.shaderReady || Promise.resolve(),
      new Promise(function (res) {
        setTimeout(function () { timedOut = true; res(); }, SCENE_TIMEOUT);
      })
    ]);

    sceneReady.then(function () {
      if (timedOut) {
        var hero = document.getElementById('hero');
        if (hero && !hero.classList.contains('hero--css-bg')) {
          hero.classList.add('hero--css-bg');
          console.warn('[VarBro] Hero scene did not signal readiness within ' + SCENE_TIMEOUT +
                       'ms — showing the CSS gradient fallback.');
        }
      }
    });

    Promise.all([minTime, sceneReady]).then(function () { dismissRequested = true; });

    function fadeOutOverlay() {
      if (finished) return;
      finished = true;
      gsap.to(overlay, {
        opacity: 0,
        duration: OUT / 1000,
        ease: 'power2.out',
        onComplete: function () {
          overlay.remove();
          finish();          /* hero entrance starts immediately after */
        }
      });
    }

    function showFinalLine() {
      gsap.to(lineEl, {
        opacity: 0, duration: FADE / 1000, ease: 'none',
        onComplete: function () {
          lineEl.textContent = FINAL;
          lineEl.classList.add('is-final');
          gsap.to(lineEl, {
            opacity: 1, duration: FADE / 1000, ease: 'none',
            onComplete: function () { setTimeout(fadeOutOverlay, FINAL_HOLD); }
          });
        }
      });
    }

    /* Cycle the lines; once dismissal is requested, finish the current line
       first so the text never gets cut off mid-swap. */
    function showLine(i) {
      lineEl.textContent = LINES[i % LINES.length];
      gsap.fromTo(lineEl,
        { opacity: 0 },
        {
          opacity: 1, duration: FADE / 1000, ease: 'none',
          onComplete: function () {
            setTimeout(function () {
              if (dismissRequested) { showFinalLine(); return; }
              gsap.to(lineEl, {
                opacity: 0, duration: FADE / 1000, ease: 'none',
                onComplete: function () { showLine(++index); }
              });
            }, LINE_VISIBLE);
          }
        });
    }

    showLine(index);
  })();
})();
