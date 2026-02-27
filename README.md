# Credit Boost Balloon Pop

Simple browser game to teach which credit actions help or hurt your score.

## Run

Open `index.html` in a browser.

## Asset drop-ins

- Balloon artwork:
  - Put your PNG files in `assets/balloons/`
  - Use transparent backgrounds
  - Recommended size: around `500x620` or larger with the same portrait ratio
  - Keep these names so the game loads them automatically:
    - `mint.png`
    - `sky.png`
    - `peach.png`
    - `lemon.png`
    - `rose.png`
    - `aqua.png`
    - `lavender.png`
  - If a PNG is missing, the game falls back to the matching placeholder SVG.

- Background image:
  - Place your image at `assets/backgrounds/game-background.jpg`
  - PNG works too if you update the path in `styles.css`

- Audio:
  - Background music file: `assets/audio/music/theme.mp3`
  - Pop sound file: `assets/audio/sfx/pop.wav`
  - Audio starts only when the `Audio: Off` button is toggled on.
