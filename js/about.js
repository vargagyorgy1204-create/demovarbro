/* ==========================================================================
   about.js — #about ("Rólam"): one-shot entrance + a four-photo
              scroll-scrubbed sequence on the photo.

   Loaded after hero.js (which registers the "brand" ease and sets
   VB.ease) and before main.js (which owns Lenis, the section theme
   triggers and the dot rail — those pick #about up automatically from its
   data-theme, nothing to wire here).
   ========================================================================== */
(function () {
  'use strict';

  var VB = (window.VB = window.VB || {});
  if (VB.reduceMotion === undefined) {
    VB.reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  var section = document.getElementById('about');
  if (!section) return;

  var photo   = document.getElementById('about-photo');
  var imgs    = [1, 2, 3, 4].map(function (n) {
    return section.querySelector('.about__img--' + n);
  });
  var inner   = section.querySelector('.about__inner');
  var textEls = Array.prototype.slice.call(
    section.querySelectorAll('.about__eyebrow, .about__title, .about__bio, .about__more')
  );

  var hasGsap = typeof gsap !== 'undefined' && typeof ScrollTrigger !== 'undefined';
  if (hasGsap) gsap.registerPlugin(ScrollTrigger);

  var EASE = VB.ease || 'power2.out';   /* "brand" once hero.js has run */

  /* Same fallback policy as shader.js / stack.js: a narrow viewport or a
     low-core CPU gets the static first photo, no pin and no sequence. */
  var lowCpu = typeof navigator.hardwareConcurrency === 'number' &&
               navigator.hardwareConcurrency < 4;
  var narrow = window.innerWidth < 768;
  var animate = hasGsap && !VB.reduceMotion && !lowCpu && !narrow;

  /* --------------------------------------------------------------- guards */

  var warned = false;
  function warnOnce(msg) {
    if (warned) return;
    warned = true;
    console.warn('[VarBro] ' + msg);
  }

  /* Resolves true/false once the image has loaded/failed. Cached failures
     fire no event, so settled images are checked directly. */
  function settled(img) {
    return new Promise(function (resolve) {
      if (!img) { resolve(false); return; }
      if (img.complete) { resolve(img.naturalWidth > 0); return; }
      img.addEventListener('load',  function () { resolve(true);  }, { once: true });
      img.addEventListener('error', function () { resolve(false); }, { once: true });
    });
  }

  /* --------------------------------------------------------- photo sequence
     Four frames, three crossfades, driven by the section's PINNED progress
     p (0..1). Frame 1 is the base layer and is never animated; frames 2-4
     fade in above it, so there is never an empty box mid-transition:

        hold 1 | p .18 -> .32 fade 2 | hold 2 | .46 -> .60 fade 3 | hold 3 |
        .72 -> .86 fade 4 | hold 4

     One timeline of total length 1 on a scrubbed pin, so the bands are
     literal progress values: position = p. Linear (ease 'none'), no snap.
     The pin starts the moment the section is centred in the viewport and
     lasts 2.4 screens, so the sequence plays while the photo is in view.

     refreshPriority keeps this pin ahead of main.js's section triggers in
     the refresh order, since the pin spacer shifts everything below it.
     Created up front so it's ready before the images settle; torn down
     below if any of the four files turns out to be missing. */
  var BANDS = [[0.18, 0.32], [0.46, 0.60], [0.72, 0.86]];
  var scrub = null;

  if (animate && photo && imgs.every(Boolean)) {
    scrub = gsap.timeline({
      defaults: { ease: 'none' },
      scrollTrigger: {
        trigger: section,
        start: 'center center',
        end: function () { return '+=' + Math.round(window.innerHeight * 2.4); },
        pin: true,
        pinSpacing: true,
        anticipatePin: 1,
        scrub: true,
        invalidateOnRefresh: true,
        refreshPriority: 1
      }
    });
    BANDS.forEach(function (band, i) {
      scrub.fromTo(imgs[i + 1], { opacity: 0 },
        { opacity: 1, duration: band[1] - band[0] }, band[0]);
    });
    /* Pad the timeline out to exactly 1 so its progress equals p. */
    scrub.set({}, {}, 1);
  }

  function killScrub() {
    if (!scrub) return;
    /* kill(true) reverts the pin, removing the spacer it injected — without
       it the page would keep 2.4 screens of empty scroll for an effect that
       is no longer there. */
    if (scrub.scrollTrigger) scrub.scrollTrigger.kill(true);
    scrub.kill();
    scrub = null;
    if (hasGsap) ScrollTrigger.refresh();
  }

  /* ------------------------------------------------------------- entrance
     Hidden state set with transforms/opacity only (never display or
     visibility), so the layout is reserved from the first frame and CLS
     stays 0. Photo first, then eyebrow, title and each bio paragraph. */
  var revealed = false;

  function reveal() {
    if (revealed) return;
    revealed = true;
    var targets = section.classList.contains('about--no-photo') ? textEls : [photo].concat(textEls);
    gsap.to(targets, {
      y: 0, opacity: 1,
      duration: 0.7, ease: EASE, stagger: 0.09
    });
  }

  if (animate && inner) {
    if (photo) gsap.set(photo, { y: 30, opacity: 0 });
    gsap.set(textEls, { y: 24, opacity: 0 });

    ScrollTrigger.create({
      trigger: inner,
      start: 'top 75%',
      once: true,
      onEnter: reveal,
      /* A reload restored below the section lands past the end without
         ever crossing the start — still reveal rather than stay hidden. */
      onLeave: reveal
    });
  }

  /* ------------------------------------------------------ image fallbacks */
  Promise.all(imgs.map(settled)).then(function (ok) {
    var loaded = ok.filter(Boolean).length;

    if (loaded === 0) {
      warnOnce('About photos missing — expected assets/img/photo1.jpg .. photo4.jpg. ' +
               'Hiding the photo; text spans full width.');
      killScrub();
      section.classList.add('about--no-photo');
    } else if (loaded < imgs.length) {
      /* A half-working sequence is worse than a static photo: show the
         first frame that did load, drop the rest, no scrub. */
      var first = ok.indexOf(true);
      warnOnce('Some About photos failed to load — expected assets/img/photo1.jpg .. ' +
               'photo4.jpg. Showing the first one that loaded, no sequence.');
      killScrub();
      imgs.forEach(function (img, i) {
        if (!img) return;
        if (i === first) {
          img.style.opacity = '1';
          img.alt = imgs[0] ? imgs[0].alt : '';
          img.removeAttribute('aria-hidden');
        } else {
          img.style.opacity = '0';
          img.style.display = 'none';
        }
      });
    }

    if (hasGsap) ScrollTrigger.refresh();
  });

  /* The hero changed page height above this section, and web fonts can
     still reflow the bio after first paint — refresh positions once each. */
  if (hasGsap && document.fonts && document.fonts.ready) {
    document.fonts.ready.then(function () { ScrollTrigger.refresh(); });
  }
})();
