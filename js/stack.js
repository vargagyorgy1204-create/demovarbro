/* ==========================================================================
   stack.js — #stack ("A stackem"): a pinned, scroll-driven 3D carousel of 7
              technology badges over an ambient Three.js particle field.

   Loaded after about.js (so VB.ease is the registered "brand" curve) and
   before main.js, which owns Lenis, the section theme triggers and the dot
   rail — #stack is picked up there automatically from its data-theme, so
   there is nothing to wire for the nav or the dots here.

   Falls back to a flat card grid under exactly the same conditions
   shader.js uses for the hero: reduced motion, < 768px, or fewer than 4
   logical cores.
   ========================================================================== */
(function () {
  'use strict';

  var VB = (window.VB = window.VB || {});
  if (VB.reduceMotion === undefined) {
    VB.reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  var section = document.getElementById('stack');
  if (!section) return;

  var ring    = section.querySelector('.stack__ring');
  var canvas  = document.getElementById('stack-bg');
  var capName = section.querySelector('.stack__caption-name');
  var capDesc = section.querySelector('.stack__caption-desc');
  var head    = Array.prototype.slice.call(
    section.querySelectorAll('.stack__eyebrow, .stack__title')
  );
  var badges  = Array.prototype.slice.call(section.querySelectorAll('.stack__badge'));
  if (!ring || !badges.length) return;

  var COUNT = badges.length;                 /* 7 */
  var STEP  = 360 / COUNT;                   /* 51.4286deg */
  var SPAN  = STEP * (COUNT - 1);            /* 308.5714deg — 6 steps, never a full turn */
  var RAD   = Math.PI / 180;                 /* the ring's X tilt lives in CSS — see .stack__ring */

  /* Depth-cue end points: back of the ring -> front. */
  var OPACITY_BACK = 0.28, SCALE_BACK = 0.80, BLUR_BACK = 3;

  var hasGsap = typeof gsap !== 'undefined' && typeof ScrollTrigger !== 'undefined';
  if (hasGsap) gsap.registerPlugin(ScrollTrigger);

  var EASE = VB.ease || 'power2.out';

  var angles = badges.map(function (b, i) { return i * STEP; });

  function lerp(a, b, t) { return a + (b - a) * t; }
  function clamp01(v) { return v < 0 ? 0 : v > 1 ? 1 : v; }
  function setVar(el, name, value) { el.style.setProperty(name, value); }

  /* d = cos(badge angle + ring rotation): +1 dead front, -1 dead back. */
  function depthAt(i, phi) { return Math.cos((angles[i] + phi) * RAD); }

  /* ------------------------------------------------------- fallback policy
     The same three tests shader.js applies to the hero, so a machine that
     gets the CSS-gradient hero also gets the flat stack rather than one
     cheap section and one expensive one. */
  var flatReason =
    !hasGsap ? 'gsap unavailable'
    : VB.reduceMotion ? 'prefers-reduced-motion'
    : window.innerWidth < 768 ? 'viewport < 768px'
    : (typeof navigator.hardwareConcurrency === 'number' &&
       navigator.hardwareConcurrency < 4) ? 'hardwareConcurrency < 4'
    : null;

  /* ====================================================================== */
  /* FLAT FALLBACK                                                          */
  /* ====================================================================== */

  if (flatReason) {
    section.classList.add('stack--flat');

    /* Reduced motion: everything visible immediately, no scroll animation. */
    if (!VB.reduceMotion && hasGsap) {
      var items = head.concat(badges);
      var revealFlat = function () {
        gsap.to(items, { y: 0, opacity: 1, duration: 0.5, ease: EASE, stagger: 0.05 });
      };
      gsap.set(items, { y: 18, opacity: 0 });
      ScrollTrigger.create({
        trigger: section,
        start: 'top 80%',
        once: true,
        onEnter: revealFlat,
        onLeave: revealFlat          /* reloaded below the section: show, don't hide */
      });
    }

    console.info('[VarBro] Stack: flat fallback (' + flatReason + ').');
    return;
  }

  /* ====================================================================== */
  /* AMBIENT THREE.JS LAYER                                                 */
  /* Built before the ScrollTrigger below, which drives it via onToggle.    */
  /* ====================================================================== */

  var bg = (function () {
    var noop = { setActive: function () {}, focusX: function () {} };

    if (!canvas || typeof THREE === 'undefined') {
      if (canvas) canvas.style.display = 'none';
      return noop;
    }

    var renderer, scene, camera, points, glow, pGeo, pMat, gGeo, gMat;

    try {
      renderer = new THREE.WebGLRenderer({
        canvas: canvas, antialias: false, alpha: true, powerPreference: 'low-power'
      });
    } catch (err) {
      console.warn('[VarBro] Stack background: WebGL unavailable, running without it.', err);
      canvas.style.display = 'none';
      return noop;
    }

    try {
      var w = section.clientWidth || window.innerWidth;
      var h = section.clientHeight || window.innerHeight;

      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      renderer.setSize(w, h, false);
      renderer.setClearAlpha(0);

      scene = new THREE.Scene();
      camera = new THREE.PerspectiveCamera(60, w / Math.max(h, 1), 1, 3000);
      camera.position.z = 620;

      /* Brand palette read from the tokens rather than re-declared here. */
      var css = getComputedStyle(document.documentElement);
      function token(name, fallback) {
        return new THREE.Color((css.getPropertyValue(name) || '').trim() || fallback);
      }
      var palette = [
        token('--card-primary-a', '#6c63ff'),
        token('--card-primary-b', '#c850c0'),
        token('--card-accent-cool-b', '#1a8fa3')
      ];

      /* ---- particle field ---- */
      var N = 1400;
      var pos = new Float32Array(N * 3);
      var col = new Float32Array(N * 3);
      var siz = new Float32Array(N);

      for (var k = 0; k < N; k++) {
        pos[k * 3]     = (Math.random() - 0.5) * 2200;
        pos[k * 3 + 1] = (Math.random() - 0.5) * 1200;
        pos[k * 3 + 2] = -900 + Math.random() * 1200;
        var c = palette[(Math.random() * palette.length) | 0];
        col[k * 3] = c.r; col[k * 3 + 1] = c.g; col[k * 3 + 2] = c.b;
        siz[k] = 1 + Math.random() * 2;                    /* 1-3px */
      }

      pGeo = new THREE.BufferGeometry();
      pGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      pGeo.setAttribute('aColor', new THREE.BufferAttribute(col, 3));
      pGeo.setAttribute('aSize', new THREE.BufferAttribute(siz, 1));

      pMat = new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        uniforms: { uTime: { value: 0 }, uPixelRatio: { value: renderer.getPixelRatio() } },
        vertexShader: [
          'attribute vec3 aColor;',
          'attribute float aSize;',
          'uniform float uTime;',
          'uniform float uPixelRatio;',
          'varying vec3 vColor;',
          'varying float vAlpha;',
          'void main() {',
          '  vColor = aColor;',
          '  vec3 p = position;',
          /* a slow, barely-there drift — atmosphere, not motion */
          '  p.y += sin(uTime * 0.12 + p.x * 0.0025) * 18.0;',
          '  p.x += cos(uTime * 0.09 + p.z * 0.0030) * 14.0;',
          '  vec4 mv = modelViewMatrix * vec4(p, 1.0);',
          '  float dist = -mv.z;',
          /* depth falloff: nearer points are bigger and brighter */
          '  float depth = clamp(1.0 - (dist - 200.0) / 1400.0, 0.0, 1.0);',
          '  vAlpha = mix(0.25, 0.6, depth);',
          '  gl_PointSize = aSize * uPixelRatio * mix(0.6, 2.2, depth);',
          '  gl_Position = projectionMatrix * mv;',
          '}'
        ].join('\n'),
        fragmentShader: [
          'varying vec3 vColor;',
          'varying float vAlpha;',
          'void main() {',
          '  vec2 uv = gl_PointCoord - 0.5;',
          '  float d = length(uv);',
          '  if (d > 0.5) discard;',
          '  float a = smoothstep(0.5, 0.1, d) * vAlpha;',
          '  gl_FragColor = vec4(vColor, a);',
          '}'
        ].join('\n')
      });

      points = new THREE.Points(pGeo, pMat);
      scene.add(points);

      /* ---- radial glow that sits behind the focused badge ---- */
      gGeo = new THREE.PlaneGeometry(1500, 1100);
      gMat = new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        uniforms: { uColorA: { value: palette[0] }, uColorB: { value: palette[1] } },
        vertexShader: [
          'varying vec2 vUv;',
          'void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }'
        ].join('\n'),
        fragmentShader: [
          'uniform vec3 uColorA;',
          'uniform vec3 uColorB;',
          'varying vec2 vUv;',
          'void main() {',
          '  float d = length((vUv - 0.5) * vec2(1.35, 1.0));',
          '  float a = smoothstep(0.5, 0.0, d) * 0.17;',
          '  gl_FragColor = vec4(mix(uColorA, uColorB, vUv.x), a);',
          '}'
        ].join('\n')
      });
      glow = new THREE.Mesh(gGeo, gMat);
      glow.position.z = -420;
      scene.add(glow);
    } catch (err) {
      console.warn('[VarBro] Stack background setup failed — continuing without it.', err);
      try { renderer.dispose(); } catch (e) {}
      canvas.style.display = 'none';
      return noop;
    }

    var rafId = null, running = false, active = false;
    var time = 0, last = performance.now();
    var glowTargetX = 0;

    function frame(now) {
      rafId = requestAnimationFrame(frame);
      var dt = Math.min((now - last) / 1000, 0.05);     /* clamp tab-switch spikes */
      last = now;
      time += dt;

      pMat.uniforms.uTime.value = time;
      points.rotation.y = time * 0.012;
      glow.position.x += (glowTargetX - glow.position.x) * 0.06;

      renderer.render(scene, camera);
    }

    /* Paused, never disposed, so returning to the section is instant — and
       the loop never runs alongside the hero's while #stack is off screen. */
    function sync() {
      var want = active && !document.hidden;
      if (want && !running) {
        running = true;
        last = performance.now();
        rafId = requestAnimationFrame(frame);
      } else if (!want && running) {
        running = false;
        if (rafId !== null) cancelAnimationFrame(rafId);
        rafId = null;
      }
    }

    document.addEventListener('visibilitychange', sync);

    var resizeTimer = null;
    window.addEventListener('resize', function () {
      if (resizeTimer) clearTimeout(resizeTimer);
      resizeTimer = setTimeout(function () {
        var w2 = section.clientWidth || window.innerWidth;
        var h2 = section.clientHeight || window.innerHeight;
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        renderer.setSize(w2, h2, false);
        pMat.uniforms.uPixelRatio.value = renderer.getPixelRatio();
        camera.aspect = w2 / Math.max(h2, 1);
        camera.updateProjectionMatrix();
        if (!running) renderer.render(scene, camera);
      }, 150);
    });

    renderer.render(scene, camera);

    return {
      setActive: function (v) { active = v; sync(); },
      focusX: function (x) { glowTargetX = x; }
    };
  })();

  /* ====================================================================== */
  /* 3D RING                                                                */
  /* ====================================================================== */

  var focused = -1;
  var capTl = null;

  function writeCaption(i) {
    capName.textContent = badges[i].querySelector('.stack__name').textContent;
    capDesc.textContent = badges[i].querySelector('.stack__desc').textContent;
  }

  /* Only ever called when the focused index actually changes — never on
     every scroll tick. */
  function swapCaption(i) {
    if (!capName || !capDesc) return;

    if (!capName.textContent) {          /* first fill: nothing to animate out */
      writeCaption(i);
      gsap.fromTo([capName, capDesc], { opacity: 0, y: -8 },
        { opacity: 1, y: 0, duration: 0.22, ease: EASE });
      return;
    }

    if (capTl) capTl.kill();
    capTl = gsap.timeline();
    capTl
      .to([capName, capDesc], { opacity: 0, y: 8, duration: 0.18, ease: 'power1.in' })
      .add(function () { writeCaption(i); })
      .fromTo([capName, capDesc], { opacity: 0, y: -8 },
        { opacity: 1, y: 0, duration: 0.22, ease: EASE });
  }

  function setFocus(i) {
    if (i === focused) return;
    if (focused >= 0) badges[focused].classList.remove('is-focused');
    badges[i].classList.add('is-focused');
    focused = i;
    swapCaption(i);
  }

  /* ------------------------------------------------------------ depth cues
     Computed per badge on every update — CSS alone cannot know where a badge
     currently sits around the ring. */

  function depthTargets(i, phi) {
    var t = (depthAt(i, phi) + 1) / 2;        /* 0 at the back, 1 at the front */
    return {
      opacity: lerp(OPACITY_BACK, 1, t),
      scale:   lerp(SCALE_BACK, 1, t),
      blur:    lerp(BLUR_BACK, 0, t)
    };
  }

  function applyDepth(phi) {
    var bestD = -2, bestI = 0;

    for (var i = 0; i < COUNT; i++) {
      var d = depthAt(i, phi);
      if (d > bestD) { bestD = d; bestI = i; }

      var t = depthTargets(i, phi);
      gsap.set(badges[i], {
        opacity: t.opacity,
        filter: t.blur < 0.05 ? 'none' : 'blur(' + t.blur.toFixed(2) + 'px)'
      });
      setVar(badges[i], '--s', t.scale.toFixed(4));
    }

    setFocus(bestI);
  }

  /* Only the angle is written; the CSS rule owns the order (rotateX then
     rotateY), which is what keeps this a lazy susan rather than a tilted
     ring wobbling about the world vertical. */
  function applyRing(phi) {
    setVar(ring, '--ring-y', phi.toFixed(4) + 'deg');
  }

  /* The glow tracks the front of the ring, so as the next technology swings
     in the light behind it slides across rather than sitting dead centre. */
  function glowFollow(phi) {
    var x = 0;
    for (var i = 0; i < COUNT; i++) {
      var a = (angles[i] + phi) * RAD;
      var d = Math.cos(a);
      if (d > 0.2) x += Math.sin(a) * 420 * d;     /* front-most badges only */
    }
    bg.focusX(x);
  }

  /* -------------------------------------------------------------- entrance
     Badges start collapsed at the ring centre and fly out to their ring
     positions. Driven through a plain state array rather than by tweening
     CSS variables, so back.out()'s overshoot is applied to one number per
     badge and written out in a single pass. */

  var entranceState = badges.map(function () { return { t: 0 }; });
  var entranceTl = null;
  var entranceDone = false;

  function renderEntrance() {
    for (var i = 0; i < COUNT; i++) {
      var t = entranceState[i].t;
      var tgt = depthTargets(i, 0);
      setVar(badges[i], '--zf', t.toFixed(4));
      setVar(badges[i], '--s', lerp(0.6, tgt.scale, clamp01(t)).toFixed(4));
      gsap.set(badges[i], {
        opacity: lerp(0, tgt.opacity, clamp01(t)),
        filter: tgt.blur < 0.05 ? 'none' : 'blur(' + tgt.blur.toFixed(2) + 'px)'
      });
    }
  }

  function finishEntrance() {
    entranceDone = true;
    entranceTl = null;
    for (var i = 0; i < COUNT; i++) setVar(badges[i], '--zf', '1');
    render();
  }

  function playEntrance() {
    if (entranceTl || entranceDone) return;

    /* Landed deep in the section (a reload, or a fast scroll straight past
       the start): assemble instantly rather than animating from nothing
       while the ring is already turning. */
    if (progressNow() > 0.05) {
      gsap.set(head, { y: 0, opacity: 1 });
      finishEntrance();
      return;
    }

    /* Focus badge 0 up front so the gradient logo and the caption are there
       while the ring assembles, rather than appearing a beat after it. */
    setFocus(0);

    entranceTl = gsap.timeline({ onUpdate: renderEntrance, onComplete: finishEntrance });
    entranceTl.to(head, { y: 0, opacity: 1, duration: 0.6, ease: EASE, stagger: 0.08 }, 0);
    entranceTl.to(entranceState, {
      t: 1, duration: 0.7, ease: 'back.out(1.4)', stagger: 0.06
    }, 0.1);
  }

  /* ---------------------------------------------------------------- scroll */

  var ringState = { phi: 0 };
  var spin = null;

  function progressNow() {
    return spin && spin.scrollTrigger ? spin.scrollTrigger.progress : 0;
  }

  function render() {
    if (!entranceDone) return;       /* the entrance owns the badges until it ends */
    applyRing(ringState.phi);
    applyDepth(ringState.phi);
    glowFollow(ringState.phi);
  }

  /* Hidden start state, set with transforms and opacity only (never display
     or visibility) so the layout is reserved from the first frame and the
     section contributes nothing to CLS. */
  gsap.set(head, { y: 24, opacity: 0 });
  for (var b = 0; b < COUNT; b++) {
    setVar(badges[b], '--zf', '0');
    setVar(badges[b], '--s', '0.6');
    gsap.set(badges[b], { opacity: 0 });
  }
  applyRing(0);
  gsap.set([capName, capDesc], { opacity: 0 });

  spin = gsap.to(ringState, {
    /* Negative: badge 1 sits to the RIGHT of badge 0, so turning this way
       swings the next technology in from the right-hand side. Six steps, not
       a full turn, so badge 6 is the last in focus and it never wraps back
       round to badge 0. */
    phi: -SPAN,
    ease: 'none',
    onUpdate: render,
    scrollTrigger: {
      trigger: section,
      start: 'top top',
      end: function () { return '+=' + Math.round(window.innerHeight * 2.2); },
      pin: true,
      anticipatePin: 1,
      scrub: true,
      invalidateOnRefresh: true,
      /* No snap. ScrollTrigger's snap drives the scroll position itself,
         which fights Lenis (which is also driving it): measured on six
         positions through the pin, the ring landed on 0deg / -51deg / 0deg /
         -51deg / -154deg / -51deg instead of stepping cleanly, i.e. the two
         kept yanking the scroll away from each other. Without it the scrub
         is exact (see the same six positions in the report). */
      onUpdate: function (self) {
        if (!entranceTl && !entranceDone) playEntrance();
        /* Scrolled on during the entrance: finish it instantly and hand the
           badges over, rather than letting the two fight over the same
           properties. Taken into a local first — progress(1) fires the
           timeline's own onComplete, which already clears entranceTl. */
        if (entranceTl && self.progress > 0.08) {
          var tl = entranceTl;
          entranceTl = null;
          tl.progress(1);
          tl.kill();
          if (!entranceDone) finishEntrance();
        }
      },
      onToggle: function (self) { bg.setActive(self.isActive); }
    }
  });

  /* The entrance runs on its own trigger, BEFORE the pin engages rather than
     at pin start. Two reasons: the section is a full viewport tall, so with
     the assembly held back until 'top top' the visitor watches an empty dark
     panel slide up for a whole screen of scrolling; and a scroll that lands
     exactly on the pin boundary never crosses it, so the pin's own onEnter
     cannot be relied on to fire. By the time the ring pins, it is assembled
     and the first technology is already in focus. */
  ScrollTrigger.create({
    trigger: section,
    start: 'top 70%',
    once: true,
    onEnter: playEntrance,
    onLeave: playEntrance        /* reloaded below the section: assemble, don't hide */
  });

  /* -------------------------------------------------- refresh after assets
     The icon masks and the web fonts both change the section's height, and
     the pin above this one (#about) moves everything below it. */
  function iconsSettled() {
    var urls = badges.map(function (bd) {
      var icon = bd.querySelector('.stack__icon');
      if (!icon) return null;
      var cs = getComputedStyle(icon);
      /* Already absolute here, since it comes from the computed mask. */
      var v = cs.maskImage || cs.webkitMaskImage || '';
      var m = v.match(/url\(["']?([^"')]+)["']?\)/);
      return m ? m[1] : null;
    }).filter(Boolean);

    return Promise.all(urls.map(function (u) {
      return new Promise(function (resolve) {
        var img = new Image();
        img.onload = img.onerror = function () { resolve(); };
        img.src = u;
      });
    }));
  }

  iconsSettled().then(function () { ScrollTrigger.refresh(); });
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(function () { ScrollTrigger.refresh(); });
  }
})();
