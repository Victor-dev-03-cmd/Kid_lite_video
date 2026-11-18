/* Original, first-party offline educational activities; no outside audio or image requests. */
(function () {
  'use strict';
  const pages = [
    { art: '🐢🌼', text: 'Tilly the little turtle saw a yellow flower dancing in the breeze.' },
    { art: '🌦️🐢', text: 'A soft rain came. Tilly shared her leaf umbrella with a tiny beetle.' },
    { art: '🐞🍃', text: 'The beetle smiled. “Small kindness makes a big day brighter!”' },
    { art: '🌈✨', text: 'Soon a rainbow appeared. Tilly and her new friend waved hello.' }
  ];
  const shapes = ['🔴', '🟡', '🔵', '🟢'];
  function story(node) {
    let page = 0;
    const draw = () => {
      node.innerHTML = '<div class="activity-card"><div class="tag">A LITTLE STORY · PAGE ' + (page + 1) + ' OF ' + pages.length + '</div><div class="story-illustration">' + pages[page].art + '</div><p class="story-text">' + pages[page].text + '</p><div class="story-controls"><button class="text-button" id="prev-story"' + (page === 0 ? ' disabled' : '') + '>← Previous</button><button class="primary-button" id="next-story">' + (page === pages.length - 1 ? 'Read again ↻' : 'Next page →') + '</button></div></div>';
      node.querySelector('#prev-story').onclick = () => { page = Math.max(page - 1, 0); draw(); };
      node.querySelector('#next-story').onclick = () => { page = (page + 1) % pages.length; draw(); };
    };
    draw();
  }
  function memory(node) {
    let cards = [], open = [], matched = new Set(), moves = 0, busy = false;
    function reset() {
      cards = [...shapes, ...shapes].map((shape, id) => ({ shape, id })).sort(() => Math.random() - .5);
      open = []; matched = new Set(); moves = 0; busy = false; draw();
    }
    function draw() {
      node.innerHTML = '<div class="activity-card"><div class="tag">SHAPES & COLORS · MEMORY MATCH</div><p class="memory-stats">' + matched.size / 2 + ' of 4 pairs found · ' + moves + ' moves</p><div class="memory-board"></div><div class="game-actions"><button class="text-button" id="restart-game">↻ New game</button></div><p class="muted" style="text-align:center">Tap two cards to find matching colors.</p></div>';
      const board = node.querySelector('.memory-board');
      cards.forEach((card, index) => {
        const flipped = open.includes(index) || matched.has(index);
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'memory-card' + (flipped ? ' revealed' : '') + (matched.has(index) ? ' matched' : '');
        button.textContent = flipped ? card.shape : '?';
        button.setAttribute('aria-label', flipped ? 'Revealed ' + card.shape : 'Hidden card ' + (index + 1));
        button.disabled = matched.has(index);
        button.onclick = () => flip(index);
        board.appendChild(button);
      });
      if (matched.size === cards.length) node.querySelector('.memory-stats').textContent = '🎉 Great job! All pairs found in ' + moves + ' moves.';
      node.querySelector('#restart-game').onclick = reset;
    }
    function flip(index) {
      if (busy || open.includes(index) || matched.has(index)) return;
      open.push(index);
      if (open.length === 2) {
        moves += 1;
        if (cards[open[0]].shape === cards[open[1]].shape) {
          matched.add(open[0]); matched.add(open[1]); open = [];
        } else {
          busy = true;
          draw();
          setTimeout(() => { open = []; busy = false; draw(); }, 850);
          return;
        }
      }
      draw();
    }
    reset();
  }
  let context;
  function lullaby(node) {
    let playing = false, activeGains = [], playNumber = 0;
    const melody = [262, 330, 392, 330, 294, 349, 440, 349, 330, 392, 523, 392, 294, 330, 262];
    node.innerHTML = '<div class="activity-card" style="text-align:center"><div class="tag">ORIGINAL OFFLINE MELODY</div><div class="story-illustration">🌙🎶</div><h2>Quiet little lullaby</h2><p class="muted">A gentle tune made with WebAudio. No streaming or audio downloads.</p><button class="primary-button" id="play-lullaby">♫ Play melody</button><p class="muted">Sound plays only after you tap the button.</p></div>';
    const button = node.querySelector('#play-lullaby');
    button.onclick = async () => {
      if (playing) { activeGains.forEach(g => { g.gain.cancelScheduledValues(context.currentTime); g.gain.setValueAtTime(0.0001, context.currentTime); }); playing = false; playNumber++; button.textContent = '♫ Play again'; return; }
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) { button.textContent = 'Audio unavailable on this device'; button.disabled = true; return; }
      context = context || new AC();
      await context.resume();
      playing = true; activeGains = []; const currentPlay = ++playNumber; button.textContent = 'Stop melody';
      // Schedule a short original melody once, rather than looping indefinitely.
      const now = context.currentTime;
      melody.forEach((frequency, i) => {
        const osc = context.createOscillator(); const gain = context.createGain();
        const start = now + i * .48; const end = start + .44;
        osc.type = 'sine'; osc.frequency.value = frequency;
        gain.gain.setValueAtTime(0.0001, start);
        gain.gain.exponentialRampToValueAtTime(.065, start + .05);
        gain.gain.exponentialRampToValueAtTime(.0001, end);
        activeGains.push(gain); osc.connect(gain).connect(context.destination); osc.start(start); osc.stop(end + .02);
      });
      const length = melody.length * 480;
      setTimeout(() => {
        if (playNumber !== currentPlay) return;
        playing = false; activeGains = []; button.textContent = '♫ Play again';
      }, length + 200);
    };
  }
  window.KidLiteOffline = { story, memory, lullaby };
})();
