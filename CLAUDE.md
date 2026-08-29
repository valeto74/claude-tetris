# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project overview

Classic Tetris implemented in vanilla JavaScript with HTML5 Canvas and CSS. No dependencies, no build step, no package.json — the game is just three static files served or opened directly.

## Running the game

There is no build/install/test step. Open `index.html` directly, or serve the directory with any static server:

```bash
python3 -m http.server 8000
# or
npx serve .
```

Then open `http://localhost:8000`. There are no lint or test commands in this repo.

## Architecture

Everything lives in three files:

- `index.html` — DOM structure: the `#board` canvas (300×600, i.e. `COLS × BLOCK` by `ROWS × BLOCK`), the `#next-canvas` preview, HUD elements (`#score`, `#lines`, `#level`), and the pause/game-over `#overlay`. If `COLS`, `ROWS`, or `BLOCK` change in `game.js`, the canvas `width`/`height` attributes here must be updated to match.
- `style.css` — dark/retro arcade visual theme.
- `game.js` — all game logic, structured around this flow:

```
init() → createBoard(), spawn initial pieces, requestAnimationFrame(loop)
loop(ts) → accumulate dt; when dt ≥ dropInterval, advance the piece down one row
           or lockPiece(); then draw(); reschedule via requestAnimationFrame
keydown handler → move / tryRotate / softDrop / hardDrop / togglePause
```

Key mechanics to know before modifying gameplay:

- **Board model**: `ROWS × COLS` matrix; each cell is `0` (empty) or a color index `1–7` identifying which piece locked there.
- **Pieces**: defined as square matrices in `PIECES`; rotation is done via `rotateCW` (transpose + reverse rows), not by storing rotated variants.
- **Collision** (`collide`): checks board bounds and overlap with locked cells.
- **Wall kicks** (`tryRotate`): after rotating, tries offsets `[0, -1, 1, -2, 2]` columns before giving up on the rotation.
- **Locking** (`lockPiece`): merge → clearLines → spawn, in that order.
- **Line clearing** (`clearLines`): scans bottom-to-top, splices full rows out and unshifts empty rows at the top.
- **Scoring**: `LINE_SCORES = [0, 100, 300, 500, 800]` multiplied by current `level`; hard drop adds 2 points/cell dropped, soft drop adds 1 point/row.
- **Leveling/speed**: level increases every 10 lines; `dropInterval = max(100, 1000 - (level - 1) * 90)` ms.
- **Ghost piece**: `ghostY()` projects the current piece straight down to its landing row; drawn with `globalAlpha = 0.2`.
- **Game over**: triggered in `spawn()` when a freshly spawned piece immediately collides.

Tunable constants at the top of `game.js`: `COLS`, `ROWS`, `BLOCK`, `COLORS`, `LINE_SCORES`, initial `dropInterval`.
