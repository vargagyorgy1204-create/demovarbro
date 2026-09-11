/* ==========================================================================
   cards.js — hero bento cards
     Music player  playlist-driven playback, real progress + seek, equaliser
                   driven by real AnalyserNode data
     Terminal      looping typewriter

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
     Music player
     Adding a 2nd/3rd track later means only editing this array — nothing
     else in this module needs to change.
     ====================================================================== */
  var PLAYLIST = [
    { title: 'Lo-fi Coding Mix', artist: 'prettyjohn1 · Pixabay', src: 'assets/audio/lofi.mp3' }
  ];
  var currentTrackIndex = 0;

  var music = (function () {
    var card = document.getElementById('musicCard');
    var btn = document.getElementById('musicBtn');
    var prevBtn = document.getElementById('prevBtn');
    var nextBtn = document.getElementById('nextBtn');
    var muteBtn = document.getElementById('muteBtn');
    var audio = document.getElementById('lofi');
    var eq = document.getElementById('eq');
    var titleEl = document.getElementById('playerTitle');
    var artistEl = document.getElementById('playerArtist');
    var elapsedEl = document.getElementById('timeElapsed');
    var remainingEl = document.getElementById('timeRemaining');
    var bar = document.getElementById('progressBar');
    var fill = document.getElementById('progressFill');
    var handle = document.getElementById('progressHandle');

    if (!card || !btn || !audio || !eq || !prevBtn || !nextBtn || !muteBtn || !bar) {
      return { pause: function () {}, resume: function () {}, dispose: function () {} };
    }

    var bars = Array.prototype.slice.call(eq.querySelectorAll('.eq__bar'));
    var maxHeight = 32;

    var ctx = null;
    var analyser = null;
    var source = null;
    var data = null;
    var rafId = null;
    var levels = bars.map(function () { return REST_HEIGHT; });
    var disabled = false;
    var metadataReady = false;
    var dragging = false;

    /* 8 buckets across the 32 bins of an fftSize-64 analyser — unchanged
       analyser setup, just re-bucketed from 5 groups to 8. */
    var BUCKETS = [
      [0, 2], [2, 4], [4, 6], [6, 9],
      [9, 13], [13, 18], [18, 24], [24, 32]
    ];

    function disable(reason) {
      if (disabled) return;
      disabled = true;
      card.classList.add('is-disabled');
      [btn, prevBtn, nextBtn, muteBtn].forEach(function (b) {
        b.disabled = true;
        b.setAttribute('aria-disabled', 'true');
      });
      stopLoop();
      restBars();
      console.warn('[VarBro] Music player disabled: ' + reason);
    }

    /* The audio file may not be in the repo — fail visibly, never throw. */
    var MISSING = 'the current track could not be loaded (missing or unsupported).';

    audio.addEventListener('error', function () { disable(MISSING); });

    function checkSettledError() {
      if (audio.error || audio.networkState === 3 /* NETWORK_NO_SOURCE */) disable(MISSING);
    }
    /* Give a still-in-flight request a chance to fail before judging it. */
    window.addEventListener('load', checkSettledError);

    audio.addEventListener('loadedmetadata', function () {
      metadataReady = true;
      bar.removeAttribute('aria-disabled');
      updateProgressUI();
    });

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
      btn.setAttribute('aria-label', playing ? 'Szüneteltetés' : 'Lejátszás');
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

    /* ---------------------------------------------------------- playlist */

    function formatTime(sec) {
      if (!isFinite(sec) || sec < 0) sec = 0;
      var m = Math.floor(sec / 60);
      var s = Math.floor(sec % 60);
      return m + ':' + String(s).padStart(2, '0');
    }

    function resetProgressUI() {
      metadataReady = false;
      bar.setAttribute('aria-disabled', 'true');
      bar.setAttribute('aria-valuenow', '0');
      fill.style.width = '0%';
      handle.style.insetInlineStart = '0%';
      elapsedEl.textContent = '0:00';
      remainingEl.textContent = '0:00';
    }

    function updateProgressUI() {
      if (!metadataReady || !audio.duration) return;
      var pct = (audio.currentTime / audio.duration) * 100;
      fill.style.width = pct + '%';
      handle.style.insetInlineStart = pct + '%';
      bar.setAttribute('aria-valuenow', String(Math.round(pct)));
      elapsedEl.textContent = formatTime(audio.currentTime);
      remainingEl.textContent = formatTime(audio.duration - audio.currentTime);
    }

    function loadTrack(index, opts) {
      opts = opts || {};
      currentTrackIndex = ((index % PLAYLIST.length) + PLAYLIST.length) % PLAYLIST.length;
      var track = PLAYLIST[currentTrackIndex];

      titleEl.textContent = track.title;
      artistEl.textContent = track.artist;
      resetProgressUI();
      /* Setting .src synchronously resets networkState to NETWORK_NO_SOURCE
         as the first step of the load algorithm, before the async fetch has
         even started — checking it right here would read that transient
         reset, not a real failure. The 'error' event (attached above) is the
         reliable signal for a genuine 404 on a freshly assigned source. */
      audio.src = track.src;

      if (opts.wasPlaying) play(); else pauseAudio();
    }

    function prevTrack() {
      var wasPlaying = !audio.paused;
      loadTrack(currentTrackIndex - 1, { wasPlaying: wasPlaying });
    }

    function nextTrack(auto) {
      var wasPlaying = auto || !audio.paused;
      loadTrack(currentTrackIndex + 1, { wasPlaying: wasPlaying });
    }

    prevBtn.addEventListener('click', function () { if (!disabled) prevTrack(); });
    nextBtn.addEventListener('click', function () { if (!disabled) nextTrack(false); });

    /* With a single track this cycles to itself — expected, and becomes
       fully functional the moment PLAYLIST grows past one entry. */
    audio.addEventListener('ended', function () { nextTrack(true); });

    muteBtn.addEventListener('click', function () {
      if (disabled) return;
      audio.muted = !audio.muted;
      muteBtn.setAttribute('aria-pressed', String(audio.muted));
      muteBtn.setAttribute('aria-label', audio.muted ? 'Némítás feloldása' : 'Némítás');
    });

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

    audio.addEventListener('timeupdate', function () {
      if (!dragging) updateProgressUI();
    });

    /* ------------------------------------------------------------- seek */

    function ratioFromEvent(e) {
      var r = bar.getBoundingClientRect();
      var x = (e.clientX - r.left) / Math.max(r.width, 1);
      return Math.min(1, Math.max(0, x));
    }

    function seekPreview(ratio) {
      /* Move the fill/handle immediately while dragging, ahead of the
         audio element's own (throttled) timeupdate events. */
      var pct = ratio * 100;
      fill.style.width = pct + '%';
      handle.style.insetInlineStart = pct + '%';
      bar.setAttribute('aria-valuenow', String(Math.round(pct)));
      if (audio.duration) {
        elapsedEl.textContent = formatTime(ratio * audio.duration);
        remainingEl.textContent = formatTime(audio.duration - ratio * audio.duration);
      }
    }

    bar.addEventListener('pointerdown', function (e) {
      if (disabled || !metadataReady) return;
      dragging = true;
      bar.setPointerCapture(e.pointerId);
      seekPreview(ratioFromEvent(e));
    });

    bar.addEventListener('pointermove', function (e) {
      if (!dragging) return;
      seekPreview(ratioFromEvent(e));
    });

    function endDrag(e) {
      if (!dragging) return;
      dragging = false;
      if (audio.duration) audio.currentTime = ratioFromEvent(e) * audio.duration;
      updateProgressUI();
    }

    bar.addEventListener('pointerup', endDrag);
    bar.addEventListener('pointercancel', function () { dragging = false; });

    /* Keyboard seek: the bar is a role="slider". */
    bar.addEventListener('keydown', function (e) {
      if (disabled || !metadataReady) return;
      var step = 5;
      if (e.key === 'ArrowRight' || e.key === 'ArrowUp') {
        audio.currentTime = Math.min(audio.duration, audio.currentTime + step);
        updateProgressUI();
        e.preventDefault();
      } else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') {
        audio.currentTime = Math.max(0, audio.currentTime - step);
        updateProgressUI();
        e.preventDefault();
      }
    });

    restBars();
    resetProgressUI();
    loadTrack(0, { wasPlaying: false });

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
     Terminal typewriter
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
      terminal.start();
    },
    pause: function () {
      music.pause();
      terminal.pause();
    },
    resume: function () {
      music.resume();
      terminal.resume();
    },
    dispose: function () {
      music.dispose();
      terminal.dispose();
    }
  };
})();
