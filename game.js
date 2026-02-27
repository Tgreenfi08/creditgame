const creditEvents = [
  { text: "On-time payments", delta: 100 },
  { text: "30+ day late payment", delta: -100 },
  { text: "60-90+ day late payment", delta: -100 },
  { text: "Charge-off", delta: -95 },
  { text: "Collection account", delta: -90 },
  { text: "Bankruptcy", delta: -100 },
  { text: "Foreclosure / repossession", delta: -95 },
  { text: "<10% utilization", delta: 95 },
  { text: "10-30% utilization", delta: 70 },
  { text: ">30% utilization", delta: -80 },
  { text: "Maxed-out card", delta: -95 },
  { text: "Pay before statement closes (lower reported balance)", delta: 75 },
  { text: "Pay statement balance in full", delta: 70 },
  { text: "Carry high revolving balances", delta: -70 },
  { text: "Credit limit increase (no extra spending)", delta: 60 },
  { text: "Keep oldest accounts open", delta: 55 },
  { text: "Close an old card (age/utilization hit)", delta: -60 },
  { text: "Single hard inquiry", delta: -30 },
  { text: "Many inquiries (short time)", delta: -65 },
  { text: "Rate-shopping loans (within window)", delta: -15 },
  { text: "Open many new accounts quickly", delta: -60 },
  { text: "Good credit mix", delta: 35 },
];

const balloonColors = ["mint", "sky", "peach", "lemon", "rose", "aqua", "lavender"];
const balloonPalette = {
  mint: { fill: "#d4f6e8", stroke: "#b2e5d3" },
  sky: { fill: "#d7efff", stroke: "#b7dff8" },
  peach: { fill: "#ffe4cf", stroke: "#f4cfae" },
  lemon: { fill: "#fff7c9", stroke: "#f0e5a1" },
  rose: { fill: "#ffe0ea", stroke: "#f1bed2" },
  aqua: { fill: "#d8f7f4", stroke: "#b8e7e3" },
  lavender: { fill: "#ece5ff", stroke: "#d5c9f8" },
};
const maxBalloons = 8;
const spawnEverySeconds = 0.88;
const winningScore = 850;

const scorePanel = document.getElementById("score-panel");
const scoreValue = document.getElementById("score-value");
const scoreDelta = document.getElementById("score-delta");
const gameArea = document.getElementById("game-area");
const audioToggle = document.getElementById("audio-toggle");
const winOverlay = document.getElementById("win-overlay");
const confettiLayer = document.getElementById("confetti-layer");

const backgroundMusic = new Audio();
backgroundMusic.loop = true;
backgroundMusic.volume = 0.35;

const popSound = new Audio();
popSound.volume = 0.65;

let nextBalloonId = 1;

const state = {
  score: 0,
  active: [],
  bag: [],
  spawnClock: 0,
  lastTick: performance.now(),
  feedbackTimer: null,
  audioEnabled: false,
  gameOver: false,
};

const assetCandidates = {
  backgroundImage: [
    "assets/backgrounds/game-background.jpg",
    "assets/backgrounds/game-background.jpeg",
    "assets/backgrounds/game-background.png",
    "game-background.jpg",
    "game-background.jpeg",
    "game-background.png",
  ],
  music: [
    "assets/audio/music/theme.mp3",
    "assets/audio/theme.mp3",
    "audio/music/theme.mp3",
    "audio/theme.mp3",
    "theme.mp3",
  ],
  pop: [
    "assets/audio/sfx/pop.wav",
    "assets/audio/pop.wav",
    "audio/sfx/pop.wav",
    "audio/pop.wav",
    "pop.wav",
  ],
};

function balloonImageCandidates(color) {
  return [
    `assets/balloons/${color}.png`,
    `assets/balloons/${color}.svg`,
    `balloons/${color}.png`,
    `balloons/${color}.svg`,
    `${color}.png`,
    `${color}.svg`,
  ];
}

function setImageSourceWithFallback(img, candidates, onAllFail, onLoad) {
  let index = 0;
  const handleError = () => {
    if (index >= candidates.length) {
      img.removeEventListener("error", handleError);
      onAllFail?.();
      return;
    }
    img.src = candidates[index];
    index += 1;
  };

  img.addEventListener("error", handleError);
  img.addEventListener(
    "load",
    () => {
      img.removeEventListener("error", handleError);
      onLoad?.();
    },
    { once: true }
  );

  handleError();
}

function applyBackgroundImage() {
  const probe = new Image();
  let index = 0;

  const tryNext = () => {
    if (index >= assetCandidates.backgroundImage.length) {
      return;
    }
    probe.src = assetCandidates.backgroundImage[index];
    index += 1;
  };

  probe.onload = () => {
    document.body.style.setProperty("--bg-image", `url("${probe.src}")`);
  };
  probe.onerror = tryNext;
  tryNext();
}

function createAudioSourceController(audio, candidates) {
  let index = 0;
  if (candidates.length > 0) {
    audio.src = candidates[0];
    audio.load();
  }
  return {
    getCurrent() {
      return candidates[index];
    },
    moveNext() {
      if (index + 1 >= candidates.length) {
        return false;
      }
      index += 1;
      audio.src = candidates[index];
      audio.load();
      return true;
    },
  };
}

const musicSource = createAudioSourceController(backgroundMusic, assetCandidates.music);
const popSource = createAudioSourceController(popSound, assetCandidates.pop);

function randomBetween(min, max) {
  return min + Math.random() * (max - min);
}

function shuffle(items) {
  const arr = items.slice();
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function refillBag() {
  state.bag = shuffle(creditEvents);
}

function takeEvent() {
  if (state.bag.length === 0) {
    refillBag();
  }
  return state.bag.pop();
}

function removeBalloonByIndex(index) {
  const [balloon] = state.active.splice(index, 1);
  if (balloon && balloon.el && balloon.el.isConnected) {
    balloon.el.remove();
  }
}

function renderScore() {
  scoreValue.textContent = String(state.score);
}

function clearAllBalloons() {
  while (state.active.length > 0) {
    const balloon = state.active.pop();
    if (balloon.el.isConnected) {
      balloon.el.remove();
    }
  }
}

function createConfettiBurst(count = 180) {
  confettiLayer.innerHTML = "";
  for (let i = 0; i < count; i += 1) {
    const piece = document.createElement("span");
    piece.className = "confetti-piece";
    const angle = randomBetween(0, Math.PI * 2);
    const distance = randomBetween(150, Math.max(window.innerWidth, window.innerHeight) * 0.55);
    const dx = Math.cos(angle) * distance;
    const dy = Math.sin(angle) * distance;
    piece.style.setProperty("--dx", `${dx.toFixed(1)}px`);
    piece.style.setProperty("--dy", `${dy.toFixed(1)}px`);
    piece.style.setProperty("--rot", `${randomBetween(-560, 560).toFixed(1)}deg`);
    piece.style.setProperty("--hue", `${Math.floor(randomBetween(0, 360))}`);
    piece.style.setProperty("--delay", `${randomBetween(0, 0.22).toFixed(2)}s`);
    confettiLayer.appendChild(piece);
  }
}

function triggerWinState() {
  if (state.gameOver) {
    return;
  }
  state.gameOver = true;
  clearAllBalloons();
  winOverlay.classList.add("show");
  winOverlay.setAttribute("aria-hidden", "false");
  createConfettiBurst();
}

function showScoreFeedback(delta) {
  const isPositive = delta >= 0;
  scoreDelta.textContent = `${isPositive ? "+" : ""}${delta}`;
  scoreDelta.classList.remove("positive", "negative", "show");
  scoreDelta.classList.add(isPositive ? "positive" : "negative", "show");

  scorePanel.classList.remove("flash-positive", "flash-negative");
  scorePanel.offsetWidth;
  scorePanel.classList.add(isPositive ? "flash-positive" : "flash-negative");

  clearTimeout(state.feedbackTimer);
  state.feedbackTimer = setTimeout(() => {
    scoreDelta.classList.remove("show");
    scorePanel.classList.remove("flash-positive", "flash-negative");
  }, 620);
}

function playPop() {
  if (!state.audioEnabled) {
    return;
  }
  const sfx = new Audio(popSource.getCurrent());
  sfx.volume = popSound.volume;
  sfx.play().catch(() => {
    if (popSource.moveNext()) {
      const fallbackSfx = new Audio(popSource.getCurrent());
      fallbackSfx.volume = popSound.volume;
      fallbackSfx.play().catch(() => {});
    }
  });
}

function setBalloonPosition(balloon) {
  balloon.el.style.transform = `translate(${balloon.x}px, ${balloon.y}px)`;
}

function isTooCloseToExisting(candidate, others) {
  for (const balloon of others) {
    const closeX = Math.abs(candidate.x - balloon.x) < (candidate.width + balloon.width) * 0.58;
    const closeY = Math.abs(candidate.y - balloon.y) < (candidate.height + balloon.height) * 0.48;
    if (closeX && closeY) {
      return true;
    }
  }
  return false;
}

function findSpawnPosition(width, height) {
  const maxX = Math.max(8, gameArea.clientWidth - width - 8);
  for (let i = 0; i < 32; i += 1) {
    const candidate = {
      x: randomBetween(8, maxX),
      y: gameArea.clientHeight + randomBetween(42, 300),
      width,
      height,
    };
    if (!isTooCloseToExisting(candidate, state.active)) {
      return candidate;
    }
  }

  return {
    x: randomBetween(8, maxX),
    y: gameArea.clientHeight + randomBetween(42, 300),
  };
}

function createBalloon() {
  const event = takeEvent();
  const id = nextBalloonId;
  nextBalloonId += 1;

  const width = Math.min(280, Math.max(170, event.text.length * 4.45));
  const height = width * 1.22;
  const spawn = findSpawnPosition(width, height);

  const balloon = {
    id,
    event,
    x: spawn.x,
    y: spawn.y,
    width,
    height,
    speed: randomBetween(40, 88),
    drift: randomBetween(-16, 16),
    el: document.createElement("button"),
  };

  balloon.el.type = "button";
  balloon.el.className = "balloon";
  balloon.el.style.width = `${width}px`;
  balloon.el.style.height = `${height}px`;
  balloon.el.setAttribute("aria-label", event.text);

  const image = document.createElement("img");
  image.className = "balloon-image";
  image.alt = "";
  const color = balloonColors[Math.floor(Math.random() * balloonColors.length)];
  const palette = balloonPalette[color];

  const fallback = document.createElement("span");
  fallback.className = "balloon-fallback";
  fallback.style.setProperty("--balloon-fill", palette.fill);
  fallback.style.setProperty("--balloon-stroke", palette.stroke);

  setImageSourceWithFallback(
    image,
    balloonImageCandidates(color),
    () => {
      balloon.el.classList.add("image-missing");
      balloon.el.classList.remove("image-ready");
    },
    () => {
      balloon.el.classList.remove("image-missing");
      balloon.el.classList.add("image-ready");
    }
  );

  const label = document.createElement("span");
  label.className = "balloon-label";
  label.textContent = event.text;

  const string = document.createElement("span");
  string.className = "balloon-string";

  balloon.el.appendChild(fallback);
  balloon.el.appendChild(image);
  balloon.el.appendChild(string);
  balloon.el.appendChild(label);
  balloon.el.addEventListener("click", () => {
    if (state.gameOver) {
      return;
    }
    const index = state.active.findIndex((item) => item.id === id);
    if (index < 0) {
      return;
    }
    const popped = state.active[index];
    popped.el.classList.add("popped");
    const nextScore = Math.max(0, state.score + popped.event.delta);
    const appliedDelta = nextScore - state.score;
    state.score = nextScore;
    renderScore();
    showScoreFeedback(appliedDelta);
    playPop();
    state.active.splice(index, 1);
    if (state.score >= winningScore) {
      triggerWinState();
    }
    setTimeout(() => {
      if (popped.el.isConnected) {
        popped.el.remove();
      }
    }, 130);
  });

  gameArea.appendChild(balloon.el);
  state.active.push(balloon);
  setBalloonPosition(balloon);
}

function tick(now) {
  if (state.gameOver) {
    return;
  }
  const dt = Math.min(0.05, (now - state.lastTick) / 1000);
  state.lastTick = now;
  state.spawnClock += dt;

  if (state.active.length < maxBalloons) {
    while (state.spawnClock >= spawnEverySeconds && state.active.length < maxBalloons) {
      state.spawnClock -= spawnEverySeconds;
      createBalloon();
    }
  }

  for (let i = state.active.length - 1; i >= 0; i -= 1) {
    const balloon = state.active[i];
    balloon.y -= balloon.speed * dt;
    balloon.x += balloon.drift * dt;

    if (balloon.x <= 0 || balloon.x + balloon.width >= gameArea.clientWidth) {
      balloon.drift *= -1;
      balloon.x = Math.max(0, Math.min(gameArea.clientWidth - balloon.width, balloon.x));
    }

    if (balloon.y + balloon.height < -160) {
      removeBalloonByIndex(i);
      continue;
    }

    setBalloonPosition(balloon);
  }

  requestAnimationFrame(tick);
}

async function setAudio(enabled) {
  state.audioEnabled = enabled;
  audioToggle.textContent = `Audio: ${enabled ? "On" : "Off"}`;

  if (!enabled) {
    backgroundMusic.pause();
    return;
  }

  while (true) {
    try {
      await backgroundMusic.play();
      return;
    } catch (error) {
      if (!musicSource.moveNext()) {
        state.audioEnabled = false;
        audioToggle.textContent = "Audio: Off";
        return;
      }
    }
  }
}

audioToggle.addEventListener("click", () => {
  setAudio(!state.audioEnabled);
});

window.addEventListener("resize", () => {
  state.active.forEach((balloon) => {
    balloon.x = Math.max(0, Math.min(gameArea.clientWidth - balloon.width, balloon.x));
    setBalloonPosition(balloon);
  });
});

function init() {
  applyBackgroundImage();
  refillBag();
  renderScore();
  for (let i = 0; i < 4; i += 1) {
    createBalloon();
  }
  requestAnimationFrame(tick);
}

init();
