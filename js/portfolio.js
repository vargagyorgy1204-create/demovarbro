/* ==========================================================================
   portfolio.js — #portfolio ("Munkáim"): bento grid of project cards with
                  hover video loops, a fullscreen Flip-expanded gallery,
                  and a calm scroll entrance.

   Loaded after stack.js and before main.js, which owns Lenis, the section
   theme triggers and the dot rail — #portfolio is picked up there from its
   data-theme, so nothing is wired for the nav or the dots here.

   Everything works without GSAP/Flip: the grid is plain CSS and a click
   opens the same gallery with a simple fade (no Flip, no 3D).
   ========================================================================== */
(function () {
  'use strict';

  var VB = (window.VB = window.VB || {});
  if (VB.reduceMotion === undefined) {
    VB.reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  var section = document.getElementById('portfolio');
  var modal   = document.getElementById('pf-modal');
  if (!section) return;

  var cards = Array.prototype.slice.call(section.querySelectorAll('button.pf-card'));
  var allCards = Array.prototype.slice.call(section.querySelectorAll('.pf-card'));

  var hasGsap  = typeof gsap !== 'undefined' && typeof ScrollTrigger !== 'undefined';
  var hasFlip  = hasGsap && typeof Flip !== 'undefined';
  var hasSplit = hasGsap && typeof SplitText !== 'undefined';
  if (hasGsap) gsap.registerPlugin.apply(gsap, [ScrollTrigger, hasFlip && Flip, hasSplit && SplitText].filter(Boolean));

  var reduce = VB.reduceMotion;
  var hoverFine = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  var EASE = VB.ease || 'power2.out';

  function shotsOf(slug) {
    return ['assets/portfolio/hero-' + slug + '.jpg',
            'assets/portfolio/shot-' + slug + '-2.jpg',
            'assets/portfolio/shot-' + slug + '-3.jpg'];
  }

  /* ----------------------------------------------------------- preloading
     The gallery's three images are fetched on the first hover/focus so it
     opens instantly. Kept referenced so they are not collected early. */
  var preloaded = {};
  function preload(card) {
    var slug = card.dataset.slug;
    if (preloaded[slug]) return;
    preloaded[slug] = shotsOf(slug).map(function (src) {
      var im = new Image();
      im.decoding = 'async';
      im.src = src;
      return im;
    });
  }

  /* ----------------------------------------------------------- video loops
     Never in reduced-motion. Desktop (hover + fine pointer): play while the
     card is hovered. Touch: play while the card is >= 60% in view, at most
     two at once. The src is attached lazily, on first use. */
  function videoOf(card) { return card.querySelector('.pf-card__video'); }

  function ensureSrc(video) {
    if (!video.getAttribute('src') && video.dataset.src) {
      video.src = video.dataset.src;
      video.load();
    }
  }

  function playCard(card) {
    var v = videoOf(card);
    if (!v) return;
    ensureSrc(v);
    v.muted = true;
    var p = v.play();
    if (p && p.catch) p.catch(function () { /* autoplay refused: the image stays */ });
    card.classList.add('is-playing');
    card._pfHold = false;
  }

  function stopCard(card) {
    var v = videoOf(card);
    card.classList.remove('is-playing');
    if (!v) return;
    card._pfHold = true;
    /* Pause and rewind once the 0.4s fade-out is done — unless it was
       re-hovered in the meantime. */
    setTimeout(function () {
      if (card._pfHold) { v.pause(); try { v.currentTime = 0; } catch (e) { /* not loaded yet */ } }
    }, 420);
  }

  if (!reduce) {
    if (hoverFine) {
      cards.forEach(function (card) {
        card.addEventListener('pointerenter', function (e) {
          if (e.pointerType && e.pointerType !== 'mouse' && e.pointerType !== 'pen') return;
          preload(card);
          playCard(card);
        });
        card.addEventListener('pointerleave', function () { stopCard(card); });
        card.addEventListener('focus', function () { preload(card); });
      });
    } else if ('IntersectionObserver' in window) {
      var playing = [];
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (en) {
          var card = en.target;
          var i = playing.indexOf(card);
          if (en.isIntersecting && en.intersectionRatio >= 0.6) {
            if (i === -1) playing.push(card);
            while (playing.length > 2) stopCard(playing.shift());
            playCard(card);
          } else if (i !== -1) {
            playing.splice(i, 1);
            stopCard(card);
          }
        });
      }, { threshold: [0, 0.6, 1] });
      cards.forEach(function (card) {
        io.observe(card);
        card.addEventListener('pointerdown', function () { preload(card); }, { passive: true });
      });
    }
  }

  /* ----------------------------------------------------- cursor label
     The site's custom cursor only exists on desktop; the label rides next
     to it while a project card is hovered. */
  var label = null;
  if (hoverFine && !reduce) {
    label = document.createElement('div');
    label.className = 'pf-cursor';
    label.textContent = 'Megnézem';
    label.setAttribute('aria-hidden', 'true');
    document.body.appendChild(label);
    var lx = 0, ly = 0;
    window.addEventListener('pointermove', function (e) {
      lx = e.clientX; ly = e.clientY;
      if (label.classList.contains('is-on')) label.style.transform = 'translate(' + (lx + 22) + 'px,' + (ly + 22) + 'px)';
    }, { passive: true });
    cards.forEach(function (card) {
      card.addEventListener('pointerenter', function () {
        if (!document.body.classList.contains('has-cursor')) return;
        label.style.transform = 'translate(' + (lx + 22) + 'px,' + (ly + 22) + 'px)';
        label.classList.add('is-on');
      });
      card.addEventListener('pointerleave', function () { label.classList.remove('is-on'); });
    });
  }

  /* ------------------------------------------------------------- gallery */
  if (modal) initGallery();

  function initGallery() {
    var panel   = document.getElementById('pf-panel');
    var inner   = document.getElementById('pf-inner');
    var scrim   = modal.querySelector('.pf-modal__scrim');
    var track   = document.getElementById('pf-track');
    var titleEl = document.getElementById('pf-modal-title');
    var chipEl  = document.getElementById('pf-modal-chip');
    var descEl  = document.getElementById('pf-modal-desc');
    var closeB  = document.getElementById('pf-close');
    var prevB   = document.getElementById('pf-prev');
    var nextB   = document.getElementById('pf-next');
    var counter = document.getElementById('pf-counter');
    var dots    = Array.prototype.slice.call(modal.querySelectorAll('.pf-dot'));
    var imgs    = Array.prototype.slice.call(track.querySelectorAll('img'));
    var COUNT   = imgs.length;

    var fancy = hasFlip && !reduce;          /* Flip + 3D entrance */
    var isOpen = false, opener = null, savedY = 0, index = 0, busy = false;

    if (!fancy) modal.classList.add('pf-modal--fade');

    /* --- slide helpers --- */
    function currentIndex() {
      var w = track.clientWidth || 1;
      return Math.max(0, Math.min(COUNT - 1, Math.round(track.scrollLeft / w)));
    }

    function paint(i) {
      index = i;
      counter.textContent = (i + 1) + ' / ' + COUNT;
      dots.forEach(function (d, k) {
        d.classList.toggle('is-active', k === i);
        if (k === i) d.setAttribute('aria-current', 'true'); else d.removeAttribute('aria-current');
      });
      prevB.disabled = i === 0;
      nextB.disabled = i === COUNT - 1;
    }

    function go(i, instant) {
      i = Math.max(0, Math.min(COUNT - 1, i));
      track.scrollTo({ left: i * track.clientWidth, behavior: (instant || reduce) ? 'auto' : 'smooth' });
      paint(i);
    }

    track.addEventListener('scroll', function () {
      var i = currentIndex();
      if (i !== index) paint(i);
    }, { passive: true });

    prevB.addEventListener('click', function () { go(index - 1); });
    nextB.addEventListener('click', function () { go(index + 1); });
    dots.forEach(function (d, k) { d.addEventListener('click', function () { go(k); }); });

    /* Mouse drag-to-scroll (touch and pen use native scrolling + snap). */
    var drag = null;
    track.addEventListener('pointerdown', function (e) {
      if (e.pointerType !== 'mouse' || e.button !== 0) return;
      drag = { x: e.clientX, left: track.scrollLeft, moved: false };
    });
    window.addEventListener('pointermove', function (e) {
      if (!drag) return;
      var dx = e.clientX - drag.x;
      if (!drag.moved && Math.abs(dx) < 4) return;
      drag.moved = true;
      track.classList.add('is-dragging');
      track.scrollLeft = drag.left - dx;
    });
    window.addEventListener('pointerup', function () {
      if (!drag) return;
      var moved = drag.moved;
      drag = null;
      track.classList.remove('is-dragging');
      if (moved) go(currentIndex());
    });

    /* --- page lock --- */
    var restore = [];
    function lock() {
      savedY = window.scrollY;
      if (VB.lenis) VB.lenis.stop();
      document.documentElement.classList.add('pf-lock');
      Array.prototype.forEach.call(document.body.children, function (el) {
        if (el === modal || el.tagName === 'SCRIPT' || el.inert) return;
        el.inert = true;
        restore.push(el);
      });
    }
    function unlock() {
      restore.forEach(function (el) { el.inert = false; });
      restore = [];
      document.documentElement.classList.remove('pf-lock');
      window.scrollTo(0, savedY);
      if (VB.lenis) {
        VB.lenis.scrollTo(savedY, { immediate: true, force: true });
        VB.lenis.start();
      }
    }

    /* --- fill --- */
    function fill(card) {
      var slug = card.dataset.slug;
      var name = card.querySelector('.pf-card__name').textContent;
      titleEl.textContent = name;
      chipEl.textContent = card.dataset.cat;
      descEl.textContent = card.dataset.desc;
      shotsOf(slug).forEach(function (src, i) {
        imgs[i].src = src;
        imgs[i].alt = i === 0 ? name + ' — főoldal' : name + ' — ' + (i + 1) + '. kép';
      });
      track.scrollLeft = 0;
      paint(0);
    }

    /* --- panel <-> card rect (Flip works on the panel's own box) --- */
    function pinPanelTo(rect) {
      var s = panel.style;
      s.inset = 'auto';
      s.top = rect.top + 'px';
      s.left = rect.left + 'px';
      s.width = rect.width + 'px';
      s.height = rect.height + 'px';
      s.borderRadius = '28px';
    }
    function releasePanel() {
      var s = panel.style;
      s.inset = ''; s.top = ''; s.left = ''; s.width = ''; s.height = ''; s.borderRadius = '';
    }

    function focusables() {
      return Array.prototype.filter.call(
        modal.querySelectorAll('button, [href], [tabindex]:not([tabindex="-1"])'),
        function (el) { return !el.disabled && el.offsetParent !== null; }
      );
    }

    /* --- open --- */
    function open(card) {
      if (isOpen || busy) return;
      isOpen = true; opener = card;
      fill(card);
      lock();
      modal.hidden = false;

      if (!fancy) {
        void modal.offsetWidth;                       /* commit the fade-in start state */
        modal.classList.add('is-open');
        closeB.focus({ preventScroll: true });
        return;
      }

      busy = true;
      gsap.set(scrim, { opacity: 0 });
      gsap.set(inner, { opacity: 0, rotationX: 8, y: 24, transformPerspective: 1400 });
      pinPanelTo(card.getBoundingClientRect());
      var state = Flip.getState(panel, { props: 'borderRadius' });
      releasePanel();
      Flip.from(state, {
        duration: 0.7, ease: 'power3.inOut', scale: false, props: 'borderRadius',
        onComplete: function () { busy = false; }
      });
      gsap.to(scrim, { opacity: 1, duration: 0.5, ease: 'power2.out' });
      gsap.to(inner, {
        opacity: 1, rotationX: 0, y: 0, duration: 0.65, delay: 0.3, ease: 'power3.out',
        onComplete: function () { gsap.set(inner, { clearProps: 'transform' }); }
      });
      closeB.focus({ preventScroll: true });
    }

    /* --- close --- */
    function finishClose() {
      modal.hidden = true;
      modal.classList.remove('is-open');
      releasePanel();
      if (hasGsap) gsap.set([scrim, inner], { clearProps: 'all' });
      unlock();
      busy = false;
      if (opener) opener.focus({ preventScroll: true });
      opener = null;
    }

    function close() {
      if (!isOpen || busy) return;
      isOpen = false;

      if (!fancy) {
        modal.classList.remove('is-open');
        setTimeout(finishClose, reduce ? 0 : 300);
        return;
      }

      busy = true;
      var rect = opener.getBoundingClientRect();
      gsap.to(inner, { opacity: 0, duration: 0.25, ease: 'power2.in' });
      var state = Flip.getState(panel, { props: 'borderRadius' });
      pinPanelTo(rect);
      Flip.from(state, {
        duration: 0.6, ease: 'power3.inOut', scale: false, props: 'borderRadius',
        onComplete: finishClose
      });
      gsap.to(scrim, { opacity: 0, duration: 0.45, delay: 0.15, ease: 'power2.in' });
    }

    cards.forEach(function (card) {
      card.addEventListener('click', function () { open(card); });
    });
    closeB.addEventListener('click', close);
    modal.querySelector('[data-pf-close]').addEventListener('click', close);

    document.addEventListener('keydown', function (e) {
      if (!isOpen) return;
      if (e.key === 'Escape') { e.preventDefault(); close(); }
      else if (e.key === 'ArrowLeft')  { e.preventDefault(); go(index - 1); }
      else if (e.key === 'ArrowRight') { e.preventDefault(); go(index + 1); }
      else if (e.key === 'Tab') {
        var f = focusables();
        if (!f.length) return;
        var first = f[0], last = f[f.length - 1];
        if (!modal.contains(document.activeElement)) { e.preventDefault(); first.focus(); }
        else if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    });

    VB.portfolio = { open: open, close: close, isOpen: function () { return isOpen; } };
  }

  /* ------------------------------------------------------------- entrance
     Headline words, then the cards in batches, once. Transforms and opacity
     only, on boxes whose size is already fixed by the grid, so CLS stays 0.
     No pin, so nothing here moves the Stack/Services triggers. */
  if (hasGsap && !reduce) {
    var eyebrow = section.querySelector('.pf__eyebrow');
    var title   = section.querySelector('.pf__title');
    var sub     = section.querySelector('.pf__sub');

    gsap.set(allCards, { y: 60, scale: 0.96, opacity: 0 });
    gsap.set([eyebrow, sub], { y: 24, opacity: 0 });

    var shown = [];
    function showCards(batch) {
      var fresh = batch.filter(function (c) { return shown.indexOf(c) === -1; });
      if (!fresh.length) return;
      shown = shown.concat(fresh);
      gsap.to(fresh, {
        y: 0, scale: 1, opacity: 1, duration: 0.8, ease: EASE, stagger: 0.08,
        /* hand the transform back to CSS so the hover lift works */
        onComplete: function () { gsap.set(fresh, { clearProps: 'transform,opacity' }); }
      });
    }
    ScrollTrigger.batch(allCards, {
      start: 'top 90%',
      once: true,
      onEnter: showCards,
      /* a reload restored below the section lands past the start without
         crossing it — still reveal rather than stay hidden */
      onLeave: showCards
    });

    function headline() {
      var words = null;
      if (hasSplit) {
        var split = SplitText.create(title, { type: 'words', aria: 'auto' });
        words = split.words;
        gsap.set(words, { y: 40, opacity: 0 });
      } else {
        words = [title];
        gsap.set(title, { y: 40, opacity: 0 });
      }
      ScrollTrigger.create({
        trigger: section.querySelector('.pf__head'),
        start: 'top 82%',
        once: true,
        onEnter: reveal,
        onLeave: reveal
      });
      var done = false;
      function reveal() {
        if (done) return;
        done = true;
        gsap.to([eyebrow, sub], { y: 0, opacity: 1, duration: 0.7, ease: EASE, stagger: 0.1 });
        gsap.to(words, { y: 0, opacity: 1, duration: 0.8, ease: EASE, stagger: 0.06 });
      }
    }
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(headline); else headline();
  }

  /* ----------------------------------------------- positions after images
     Card sizes are fixed by the grid, but the section sits below two pins,
     so re-measure once everything has settled. */
  if (hasGsap) {
    var raf = 0;
    var refresh = function () {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(function () { ScrollTrigger.refresh(); });
    };
    Array.prototype.forEach.call(section.querySelectorAll('.pf-card__img'), function (im) {
      if (!im.complete) im.addEventListener('load', refresh, { once: true });
    });
    window.addEventListener('load', refresh, { once: true });
  }
})();
