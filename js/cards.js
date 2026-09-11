/* ==========================================================================
   cards.js — hero bento cards
     Card 2  lo-fi music toggle, equaliser driven by real AnalyserNode data
     Card 3  live status + Munich clock
     Card 4  looping terminal typewriter

   Exposes VB.cards = { init(), pause(), resume(), dispose() }
   pause()/resume() are wired to the hero's ScrollTrigger so no RAF loop or
   interval keeps running once the hero is off-screen.
   ========================================================================== */
(function () {
  'use strict';

  var VB = (window.VB = window.VB || {});
  if (VB.reduceMotion === undefined) {
    VB.reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  var REST_HEIGHT = 4;   /* px — equaliser bar height at rest */

  /* ======================================================================
     Card 2 — lo-fi music
     ====================================================================== */
  var music = (function () {
    var card = document.getElementById('musicCard');
    var btn = document.getElementById('musicBtn');
    var audio = document.getElementById('lofi');
    var eq = document.getElementById('eq');
    if (!card || !btn || !audio || !eq) return { pause: function () {}, dispose: function () {} };

    var bars = Array.prototype.slice.call(eq.querySelectorAll('.eq__bar'));
    var maxHeight = 40;

    var ctx = null;
    var analyser = null;
    var source = null;
    var data = null;
    var rafId = null;
    var levels = bars.map(function () { return REST_HEIGHT; });
    var disabled = false;

    /* 5 buckets across the 32 bins of an fftSize-64 analyser */
    var BUCKETS = [[0, 2], [2, 5], [5, 10], [10, 18], [18, 32]];

    function disable(reason) {
      if (disabled) return;
      disabled = true;
      card.classList.add('is-disabled');
      btn.disabled = true;
      btn.setAttribute('aria-disabled', 'true');
      stopLoop();
      restBars();
      console.warn('[VarBro] Lo-fi card disabled: ' + reason);
    }

    /* The audio file is not in the repo yet — fail visibly, never throw. */
    var MISSING = 'assets/audio/lofi.mp3 could not be loaded (missing or unsupported).';

    audio.addEventListener('error', function () { disable(MISSING); });

    /* <audio preload="metadata"> starts fetching while the document is still
       parsing, so a 404 can fire before this script runs. Check the settled
       state too, exactly as the logo guard does. */
    function checkSettledError() {
      if (audio.error || audio.networkState === 3 /* NETWORK_NO_SOURCE */) disable(MISSING);
    }
    checkSettledError();
    /* Give a still-in-flight request a chance to fail before judging it. */
    window.addEventListener('load', checkSettledError);

    function restBars() {
      bars.forEach(function (bar, i) {
        levels[i] = REST_HEIGHT;
        bar.style.height = REST_HEIGHT + 'px';
      });
    }

    function setupAudioGraph() {
      /* Created on the first click: an AudioContext made earlier starts
         suspended and would need resuming anyway. */
      var AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) { disable('AudioContext is unavailable in this browser.'); return false; }

      try {
        ctx = new AC();
        analyser = ctx.createAnalyser();
        analyser.fftSize = 64;
        analyser.smoothingTimeConstant = 0.75;
        source = ctx.createMediaElementSource(audio);
        source.connect(analyser);
        analyser.connect(ctx.destination);
        data = new Uint8Array(analyser.frequencyBinCount);
        return true;
      } catch (err) {
        disable('could not build the audio graph — ' + err.message);
        return false;
      }
    }

    function loop() {
      rafId = requestAnimationFrame(loop);
      analyser.getByteFrequencyData(data);

      for (var i = 0; i < bars.length; i++) {
        var range = BUCKETS[i];
        var sum = 0;
        for (var b = range[0]; b < range[1]; b++) sum += data[b];
        var avg = sum / (range[1] - range[0]) / 255;             /* 0..1 */
        var target = REST_HEIGHT + avg * (maxHeight - REST_HEIGHT);

        /* lerp so the bars breathe instead of strobing */
        levels[i] += (target - levels[i]) * 0.25;
        bars[i].style.height = levels[i].toFixed(1) + 'px';
      }
    }

    function startLoop() {
      if (VB.reduceMotion || disabled || rafId !== null) return;
      rafId = requestAnimationFrame(loop);
    }

    function stopLoop() {
      if (rafId !== null) cancelAnimationFrame(rafId);
      rafId = null;
    }

    function setPlayingState(playing) {
      btn.setAttribute('aria-pressed', String(playing));
      btn.setAttribute('aria-label', playing ? 'Zene szüneteltetése' : 'Zene lejátszása');
    }

    function play() {
      if (disabled) return;
      if (!ctx && !setupAudioGraph()) return;
      if (ctx.state === 'suspended') ctx.resume();

      var p = audio.play();
      if (p && typeof p.catch === 'function') {
        p.catch(function (err) {
          disable('playback was rejected — ' + err.message);
          setPlayingState(false);
        });
      }
    }

    function pauseAudio() {
      audio.pause();
    }

    btn.addEventListener('click', function () {
      if (disabled) return;
      if (audio.paused) play();
      else pauseAudio();
    });

    audio.addEventListener('play', function () {
      setPlayingState(true);
      startLoop();
      if (VB.reduceMotion) restBars();      /* audio plays, bars stay still */
    });

    audio.addEventListener('pause', function () {
      setPlayingState(false);
      stopLoop();
      if (window.gsap) {
        /* animate down to rest rather than snapping */
        bars.forEach(function (bar, i) {
          gsap.to(bar, {
            height: REST_HEIGHT,
            duration: VB.reduceMotion ? 0 : 0.35,
            ease: 'power2.out',
            onUpdate: function () { levels[i] = bar.offsetHeight; },
            onComplete: function () { levels[i] = REST_HEIGHT; }
          });
        });
      } else {
        restBars();
      }
    });

    restBars();

    return {
      pause: function () { stopLoop(); },
      resume: function () { if (!audio.paused) startLoop(); },
      dispose: function () {
        stopLoop();
        pauseAudio();
        if (ctx && ctx.state !== 'closed') ctx.close();
      }
    };
  })();

  /* ======================================================================
     Card 3 — live status + Munich clock
     ====================================================================== */
  var clock = (function () {
    var el = document.getElementById('clock');
    if (!el) return { pause: function () {}, resume: function () {}, dispose: function () {} };

    var formatter = null;
    try {
      formatter = new Intl.DateTimeFormat('en-GB', {
        timeZone: 'Europe/Berlin',
        hour12: false,
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      });
    } catch (err) {
      console.warn('[VarBro] Europe/Berlin time zone unavailable — clock falls back to local time.', err);
    }

    var timer = null;

    function tick() {
      var now = new Date();
      if (formatter) {
        /* Some locales emit a narrow no-break space around the separator. */
        el.textContent = formatter.format(now).replace(/ | /g, ' ').trim();
      } else {
        el.textContent = [now.getHours(), now.getMinutes(), now.getSeconds()]
          .map(function (n) { return String(n).padStart(2, '0'); })
          .join(':');
      }
    }

    function start() {
      tick();
      if (timer === null) timer = setInterval(tick, 1000);
    }

    function stop() {
      if (timer !== null) clearInterval(timer);
      timer = null;
    }

    return { start: start, pause: stop, resume: start, dispose: stop };
  })();

  /* ======================================================================
     Card 4 — terminal typewriter
     ====================================================================== */
  var terminal = (function () {
    var body = document.getElementById('termBody');
    if (!body) return { start: function () {}, pause: function () {}, resume: function () {}, dispose: function () {} };

    var LINES = [
      { text: '$ npm run build',        cls: 'term__line--cmd' },
      { text: '✓ compiled in 0.8s', cls: 'term__line--ok' },
      { text: '$ git push origin main', cls: 'term__line--cmd' },
      { text: '✓ deployed',         cls: 'term__line--ok' }
    ];

    var CHAR_MS = 35;
    var LINE_PAUSE = 380;
    var HOLD_MS = 2000;

    var timer = null;
    var running = false;
    var lineIdx = 0;
    var charIdx = 0;

    function esc(s) {
      return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }

    function caret() { return '<span class="term__caret">▋</span>'; }

    function paint(withCaret) {
      var typing = lineIdx < LINES.length;
      var html = '';

      for (var i = 0; i < Math.min(lineIdx, LINES.length); i++) {
        /* Once every line is typed the caret rests at the end of the last
           one. Giving it a line of its own would make a 5th line and grow
           the card on every loop. */
        var parkCaret = !typing && withCaret && i === LINES.length - 1;
        html += '<span class="term__line ' + LINES[i].cls + '">' +
                esc(LINES[i].text) + (parkCaret ? caret() : '') + '</span>';
      }

      if (typing) {
        html += '<span class="term__line ' + LINES[lineIdx].cls + '">' +
                esc(LINES[lineIdx].text.slice(0, charIdx)) +
                (withCaret ? caret() : '') +
                '</span>';
      }

      body.innerHTML = html;
    }

    function paintAll() {
      body.innerHTML = LINES.map(function (l) {
        return '<span class="term__line ' + l.cls + '">' + esc(l.text) + '</span>';
      }).join('');
    }

    function schedule(fn, ms) {
      timer = setTimeout(function () {
        timer = null;
        if (running) fn();
      }, ms);
    }

    function step() {
      if (!running) return;

      if (lineIdx >= LINES.length) {
        paint(true);
        schedule(function () {              /* hold, clear, restart */
          lineIdx = 0;
          charIdx = 0;
          step();
        }, HOLD_MS);
        return;
      }

      var line = LINES[lineIdx];

      if (charIdx < line.text.length) {
        charIdx++;
        paint(true);
        schedule(step, CHAR_MS);
      } else {
        lineIdx++;
        charIdx = 0;
        paint(true);
        schedule(step, LINE_PAUSE);
      }
    }

    function start() {
      if (VB.reduceMotion) { paintAll(); return; }   /* static, no typing, no blink */
      if (running) return;
      running = true;
      step();
    }

    function stop() {
      running = false;
      if (timer !== null) clearTimeout(timer);
      timer = null;
    }

    function resume() {
      if (VB.reduceMotion) return;
      if (running) return;
      running = true;
      step();
    }

    /* Reserve the final layout immediately so typing never shifts anything. */
    if (VB.reduceMotion) paintAll(); else paint(true);

    return { start: start, pause: stop, resume: resume, dispose: stop };
  })();

  /* ======================================================================
     Public surface
     ====================================================================== */
  VB.cards = {
    init: function () {
      clock.start();
      terminal.start();
    },
    pause: function () {
      music.pause();
      clock.pause();
      terminal.pause();
    },
    resume: function () {
      music.resume();
      clock.resume();
      terminal.resume();
    },
    dispose: function () {
      music.dispose();
      clock.dispose();
      terminal.dispose();
    }
  };
})();
