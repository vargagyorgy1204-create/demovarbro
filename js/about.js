/* ==========================================================================
   about.js — #about ("Rólam"): one-shot entrance + scroll-scrubbed
              neutral -> smile crossfade on the photo.

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
  var neutral = section.querySelector('.about__img--neutral');
  var smile   = section.querySelector('.about__img--smile');
  var inner   = section.querySelector('.about__inner');
  var textEls = Array.prototype.slice.call(
    section.querySelectorAll('.about__eyebrow, .about__title, .about__bio')
  );

  var hasGsap = typeof gsap !== 'undefined' && typeof ScrollTrigger !== 'undefined';
  if (hasGsap) gsap.registerPlugin(ScrollTrigger);

  var EASE = VB.ease || 'power2.out';   /* "brand" once hero.js has run */
  var animate = hasGsap && !VB.reduceMotion;

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

  /* ------------------------------------------------------- expression scrub
     Smile opacity runs 0 -> 1, linear and 1:1 with scroll, while the section
     is PINNED: the pin starts the moment the section is centred in the
     viewport and holds for 0.8 of a screen, so the expression change plays
     out exactly while the visitor is looking straight at the photo.

     Tied to the pin rather than to the photo's travel across the viewport
     (the first cut of this): measured on the deployed build, the untinned
     version did run correctly — scrub progress tracked scroll 1:1 — but it
     finished right as the section settled on screen and lasted only ~1s
     during a normal flick, and since the two frames differ by nothing but a
     slight change of expression, the crossfade was effectively invisible.

     refreshPriority keeps this pin ahead of main.js's section triggers in
     the refresh order, since the pin spacer shifts everything below it.
     Created up front so it's ready before the images settle; torn down
     below if the smile file turns out to be missing. */
  var scrub = null;

  if (animate && photo && smile) {
    scrub = gsap.fromTo(smile, { opacity: 0 }, {
      opacity: 1,
      ease: 'none',
      scrollTrigger: {
        trigger: section,
        start: 'center center',
        end: function () { return '+=' + Math.round(window.innerHeight * 0.8); },
        pin: true,
        pinSpacing: true,
        anticipatePin: 1,
        scrub: true,
        invalidateOnRefresh: true,
        refreshPriority: 1
      }
    });
  }

  function killScrub() {
    if (!scrub) return;
    /* kill(true) reverts the pin, removing the spacer it injected — without
       it the page would keep 0.8 screens of empty scroll for an effect that
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
  Promise.all([settled(neutral), settled(smile)]).then(function (ok) {
    var neutralOk = ok[0];
    var smileOk = ok[1];

    if (!neutralOk && !smileOk) {
      warnOnce('About photos missing — expected assets/img/about-photo-neutral.jpg and ' +
               'assets/img/about-photo-smile.jpg. Hiding the photo; text spans full width.');
      killScrub();
      section.classList.add('about--no-photo');
    } else if (!smileOk) {
      warnOnce('About smile photo missing — expected assets/img/about-photo-smile.jpg. ' +
               'Showing the neutral photo only, no expression scrub.');
      killScrub();
      if (smile) { smile.style.opacity = '0'; smile.style.display = 'none'; }
    } else if (!neutralOk) {
      /* Only the smile survived: show it as the (static) photo, carrying
         the alt text the neutral image would have had. */
      warnOnce('About neutral photo missing — expected assets/img/about-photo-neutral.jpg. ' +
               'Showing the smile photo statically, no expression scrub.');
      killScrub();
      if (neutral) neutral.style.display = 'none';
      smile.style.opacity = '1';
      smile.alt = neutral ? neutral.alt : '';
      smile.removeAttribute('aria-hidden');
    }

    if (hasGsap) ScrollTrigger.refresh();
  });

  /* The hero changed page height above this section, and web fonts can
     still reflow the bio after first paint — refresh positions once each. */
  if (hasGsap && document.fonts && document.fonts.ready) {
    document.fonts.ready.then(function () { ScrollTrigger.refresh(); });
  }
})();
