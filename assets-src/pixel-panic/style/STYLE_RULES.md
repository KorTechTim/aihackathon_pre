# PIXEL PANIC Style Rules

## Pixel grid

- World source tile: `16×16 px`; runtime scale: `2×`.
- Character source frame: `32×32 px`; runtime scale: `2×`.
- UI assets use a consistent two-screen-pixel block where practical.
- Diagonals follow even staircase rhythms. Pixel edges are hard with no anti-aliasing.
- Standard outline is one source pixel in `#172033` or a subject-specific dark shade.
- Source files and runtime exports are separate. Runtime images are lossless RGBA PNG.

## Form and lighting

- The light source is always top-left.
- AQUA is identified by the round backpack tank and short water cannon.
- FIX is identified by the square helmet and oversized tool arm.
- BUDDY is identified by long rescue arms, a heart chest light and beacon.
- Characters remain readable at `64×64` runtime size and are not distinguished by color alone.
- UI panels are darker and less saturated than the game map.

## Prohibited treatments

- No photoreal, 3D-rendered or smooth vector appearance.
- No blurry scaling, JPEG noise, gradients on game sprites, fake text or watermarks.
- No frightening injury, gore or horror imagery.
- No imitation of a known commercial game, mascot, character or logo.
- No Korean text baked into images except the approved horizontal logo.

## Rendering

Phaser uses `pixelArt: true`, `roundPixels: true` and `antialias: false`. CSS raster assets use `image-rendering: pixelated` with `crisp-edges` as a fallback.
