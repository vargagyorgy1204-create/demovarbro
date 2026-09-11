/* ==========================================================================
   shader.js — Three.js liquid-gradient hero background
   Self-initialises at parse time (this script sits at the end of <body>, so
   the DOM is ready) to overlap shader compilation with the preloader.

   Exposes:
     VB.shaderReady  Promise, resolves after the first painted frame
                     (or immediately when the CSS fallback is used)
     VB.shader       { fallback, reason, pause(), resume(), dispose() }
   ========================================================================== */
(function () {
  'use strict';

  var VB = (window.VB = window.VB || {});
  if (VB.reduceMotion === undefined) {
    VB.reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  var hero = document.getElementById('hero');
  var canvas = document.getElementById('heroCanvas');

  var resolveReady;
  VB.shaderReady = new Promise(function (res) { resolveReady = res; });

  /* ---------------------------------------------------------------- helpers */

  function cssVar(name) {
    return getComputedStyle(document.documentElement).getPropertyValue(name);
  }

  /* Gradients can't reach the GPU, which is why the -a/-b scalars exist. */
  function hexToVec3(hex) {
    var h = String(hex).trim().replace('#', '');
    if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
    var n = parseInt(h, 16);
    if (isNaN(n)) n = 0;
    return new THREE.Vector3(
      ((n >> 16) & 255) / 255,
      ((n >> 8) & 255) / 255,
      (n & 255) / 255
    );
  }

  /* Hand the page to the animated CSS gradient and let the preloader move on. */
  function useFallback(reason) {
    if (hero) hero.classList.add('hero--css-bg');
    VB.shader = {
      fallback: true,
      reason: reason,
      pause: function () {},
      resume: function () {},
      dispose: function () {}
    };
    resolveReady();
  }

  /* ----------------------------------------------------- fallback decisions */

  if (!hero || !canvas) {
    console.warn('[VarBro] Hero canvas not found — skipping the WebGL background.');
    useFallback('missing canvas');
    return;
  }
  if (VB.reduceMotion)                       { useFallback('prefers-reduced-motion'); return; }
  if (window.innerWidth < 768)               { useFallback('viewport < 768px'); return; }
  if (typeof navigator.hardwareConcurrency === 'number' &&
      navigator.hardwareConcurrency < 4)     { useFallback('hardwareConcurrency < 4'); return; }
  if (typeof THREE === 'undefined') {
    console.warn('[VarBro] three.js did not load — falling back to the CSS gradient.');
    useFallback('three.js unavailable');
    return;
  }

  /* ------------------------------------------------------------------ GLSL */

  var VERT = [
    'varying vec2 vUv;',
    'void main() {',
    '  vUv = uv;',
    '  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);',
    '}'
  ].join('\n');

  var FRAG = [
    'uniform float uTime;',
    'uniform vec2  uResolution;',
    'uniform vec2  uMouse;',
    'uniform vec3  uColorA;',
    'uniform vec3  uColorB;',
    'uniform vec3  uColorCool;',
    'uniform vec3  uBase;',
    'varying vec2  vUv;',

    /* --- simplex noise (Ashima/Gustavson), inlined: no library dependency --- */
    'vec3 mod289(vec3 x){ return x - floor(x * (1.0 / 289.0)) * 289.0; }',
    'vec2 mod289(vec2 x){ return x - floor(x * (1.0 / 289.0)) * 289.0; }',
    'vec3 permute(vec3 x){ return mod289(((x * 34.0) + 1.0) * x); }',

    'float snoise(vec2 v) {',
    '  const vec4 C = vec4(0.211324865405187, 0.366025403784439,',
    '                     -0.577350269189626, 0.024390243902439);',
    '  vec2 i  = floor(v + dot(v, C.yy));',
    '  vec2 x0 = v - i + dot(i, C.xx);',
    '  vec2 i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);',
    '  vec4 x12 = x0.xyxy + C.xxzz;',
    '  x12.xy -= i1;',
    '  i = mod289(i);',
    '  vec3 p = permute(permute(i.y + vec3(0.0, i1.y, 1.0))',
    '                 + i.x + vec3(0.0, i1.x, 1.0));',
    '  vec3 m = max(0.5 - vec3(dot(x0, x0), dot(x12.xy, x12.xy), dot(x12.zw, x12.zw)), 0.0);',
    '  m = m * m; m = m * m;',
    '  vec3 x  = 2.0 * fract(p * C.www) - 1.0;',
    '  vec3 h  = abs(x) - 0.5;',
    '  vec3 ox = floor(x + 0.5);',
    '  vec3 a0 = x - ox;',
    '  m *= 1.79284291400159 - 0.85373472095314 * (a0 * a0 + h * h);',
    '  vec3 g;',
    '  g.x  = a0.x  * x0.x  + h.x  * x0.y;',
    '  g.yz = a0.yz * x12.xz + h.yz * x12.yw;',
    '  return 130.0 * dot(m, g);',
    '}',

    'float fbm(vec2 p) {',
    '  float v = 0.0;',
    '  float a = 0.5;',
    '  for (int i = 0; i < 4; i++) {',
    '    v += a * snoise(p);',
    '    p *= 2.02;',
    '    a *= 0.5;',
    '  }',
    '  return v;',
    '}',

    'void main() {',
    '  float aspect = uResolution.x / max(uResolution.y, 1.0);',
    '  vec2 p = (vUv - 0.5) * vec2(aspect, 1.0) * 2.0;',
    '  vec2 m = (uMouse - 0.5) * vec2(aspect, 1.0) * 2.0;',

    /* magnetic warp: displaces the field near the cursor, no bright spot */
    '  vec2  toM  = p - m;',
    '  float d    = length(toM);',
    '  float pull = exp(-d * d * 2.2) * 0.42;',
    '  p -= normalize(toM + vec2(1e-4)) * pull;',

    /* one full "breath" ~ 10s */
    '  float t = uTime * 0.055;',

    /* two rounds of domain warping give the liquid, folding motion */
    '  vec2 q = vec2(fbm(p * 0.9 + vec2(0.0, t)),',
    '                fbm(p * 0.9 + vec2(5.2, 1.3) - t * 0.85));',
    '  vec2 r = vec2(fbm(p * 0.9 + 1.8 * q + vec2(1.7, 9.2) + t * 0.45),',
    '                fbm(p * 0.9 + 1.8 * q + vec2(8.3, 2.8) - t * 0.32));',
    '  float f = fbm(p * 0.9 + 2.1 * r);',

    '  vec3 col = uBase;',
    '  col = mix(col, uColorCool, clamp(smoothstep(-0.15, 0.85, f) * 0.60, 0.0, 1.0));',
    '  col = mix(col, uColorA,    clamp(smoothstep(0.05, 0.95, length(r)) * 0.50, 0.0, 1.0));',
    '  col = mix(col, uColorB,    clamp(smoothstep(0.45, 1.05, f + 0.4 * r.y) * 0.32, 0.0, 1.0));',

    /* radial vignette darkens the edges */
    '  float vig = 1.0 - smoothstep(0.30, 1.05, length((vUv - 0.5) * vec2(aspect, 1.0)) * 1.45);',
    '  col *= mix(0.32, 1.0, clamp(vig, 0.0, 1.0));',

    /* luminance ceiling — white hero text has to stay legible everywhere */
    '  float lum = dot(col, vec3(0.2126, 0.7152, 0.0722));',
    '  col = mix(col, col * (0.34 / max(lum, 1e-3)), smoothstep(0.30, 0.62, lum));',

    /* ordered-ish dither kills banding across the large soft gradient */
    '  float dither = fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453) - 0.5;',
    '  col += dither / 255.0;',

    '  gl_FragColor = vec4(col, 1.0);',
    '}'
  ].join('\n');

  /* ------------------------------------------------------------------ setup */

  var renderer, scene, camera, geometry, material, mesh, uniforms;

  try {
    renderer = new THREE.WebGLRenderer({
      canvas: canvas,
      antialias: false,
      alpha: false,
      powerPreference: 'high-performance'
    });
  } catch (err) {
    console.warn('[VarBro] WebGL context creation failed — falling back to the CSS gradient.', err);
    useFallback('WebGL unavailable');
    return;
  }

  try {
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(hero.clientWidth, hero.clientHeight, false);
    /* The shader already outputs display-ready sRGB values. */
    renderer.outputColorSpace = THREE.LinearSRGBColorSpace;

    scene = new THREE.Scene();
    camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

    uniforms = {
      uTime:       { value: 0 },
      uResolution: { value: new THREE.Vector2(hero.clientWidth, hero.clientHeight) },
      uMouse:      { value: new THREE.Vector2(0.5, 0.5) },
      uColorA:     { value: hexToVec3(cssVar('--card-primary-a')) },
      uColorB:     { value: hexToVec3(cssVar('--card-primary-b')) },
      uColorCool:  { value: hexToVec3(cssVar('--card-accent-cool-a')) },
      uBase:       { value: hexToVec3(cssVar('--card-secondary')) }
    };

    geometry = new THREE.PlaneGeometry(2, 2);
    material = new THREE.ShaderMaterial({
      vertexShader: VERT,
      fragmentShader: FRAG,
      uniforms: uniforms,
      depthTest: false,
      depthWrite: false
    });

    mesh = new THREE.Mesh(geometry, material);
    scene.add(mesh);
  } catch (err) {
    console.warn('[VarBro] Hero shader setup failed — falling back to the CSS gradient.', err);
    try { renderer.dispose(); } catch (e) {}
    useFallback('shader setup error');
    return;
  }

  /* ------------------------------------------------------------ interaction */

  var targetMouse = new THREE.Vector2(0.5, 0.5);

  function onPointerMove(e) {
    var rect = hero.getBoundingClientRect();
    targetMouse.set(
      (e.clientX - rect.left) / Math.max(rect.width, 1),
      /* flip Y: CSS grows downward, the shader's vUv grows upward */
      1 - (e.clientY - rect.top) / Math.max(rect.height, 1)
    );
  }

  window.addEventListener('pointermove', onPointerMove, { passive: true });

  /* ------------------------------------------------------------ render loop */

  var rafId = null;
  var running = false;
  var time = 0;
  var last = performance.now();
  /* Independent of the ScrollTrigger/visibility flags so both can veto. */
  var inView = true;

  function frame(now) {
    rafId = requestAnimationFrame(frame);

    var dt = Math.min((now - last) / 1000, 0.05);   /* clamp tab-switch spikes */
    last = now;
    time += dt;

    uniforms.uTime.value = time;

    /* ~0.06 smoothing: the field trails the cursor rather than snapping */
    uniforms.uMouse.value.x += (targetMouse.x - uniforms.uMouse.value.x) * 0.06;
    uniforms.uMouse.value.y += (targetMouse.y - uniforms.uMouse.value.y) * 0.06;

    renderer.render(scene, camera);
  }

  function start() {
    if (running) return;
    running = true;
    last = performance.now();
    rafId = requestAnimationFrame(frame);
  }

  function stop() {
    if (!running) return;
    running = false;
    if (rafId !== null) cancelAnimationFrame(rafId);
    rafId = null;
  }

  /* Both the scroll position and the tab state can pause rendering. */
  function sync() {
    if (inView && !document.hidden) start();
    else stop();
  }

  function onVisibility() { sync(); }
  document.addEventListener('visibilitychange', onVisibility);

  /* ----------------------------------------------------------------- resize */

  var resizeTimer = null;

  function applyResize() {
    var w = hero.clientWidth;
    var h = hero.clientHeight;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(w, h, false);
    uniforms.uResolution.value.set(w, h);
    if (!running) renderer.render(scene, camera);   /* keep a paused canvas correct */
  }

  function onResize() {
    if (resizeTimer) clearTimeout(resizeTimer);
    resizeTimer = setTimeout(applyResize, 150);
  }

  window.addEventListener('resize', onResize);

  /* ---------------------------------------------------------------- cleanup */

  function dispose() {
    stop();
    window.removeEventListener('pointermove', onPointerMove);
    window.removeEventListener('resize', onResize);
    document.removeEventListener('visibilitychange', onVisibility);
    if (resizeTimer) clearTimeout(resizeTimer);
    if (mesh) scene.remove(mesh);
    if (geometry) geometry.dispose();
    if (material) material.dispose();
    if (renderer) renderer.dispose();
  }

  VB.shader = {
    fallback: false,
    reason: null,
    pause: function () { inView = false; sync(); },
    resume: function () { inView = true; sync(); },
    dispose: dispose
  };

  /* ------------------------------------------- compile, first frame, signal */

  try {
    renderer.compile(scene, camera);
    renderer.render(scene, camera);
  } catch (err) {
    console.warn('[VarBro] Hero shader failed to compile — falling back to the CSS gradient.', err);
    dispose();
    useFallback('shader compile error');
    return;
  }

  /* Resolve only once the browser has actually painted that first frame. */
  requestAnimationFrame(function () {
    resolveReady();
    sync();
  });
})();
