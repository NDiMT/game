# Arrow Cube 3D

A browser-based 3D arrow puzzle inspired by *Arrow Pro 3D*.

Every small cube carries an arrow. Tap a cube and it slides away in the direction of its arrow, but only if nothing is in its path. If something is in the way, you lose a life. Clear every cube to finish the level.

## Controls

- **Drag**: rotate the shape
- **Scroll or pinch**: zoom
- **Tap or click**: fire a cube
- **💡 / H**: hint (3 per level)
- **↻ / R**: restart the level

## Run locally

It is a static site with no build step. Serve the folder with any static server:

```bash
python3 -m http.server 8000
# open http://localhost:8000
```

It also works on GitHub Pages as-is.

## How it works

- `src/levels.js` has 16 handmade shapes (box, pyramid, sphere, cross, torus, blob). After those, levels are generated procedurally from a seed, so each level number always gives the same puzzle.
- Every level can be solved. Directions are assigned by simulating a removal order: at each step, a random cube with a clear path is picked and removed. That order is a valid solution.
- `src/main.js` holds the Three.js rendering, input (tap vs. drag), animations, hints, lives, WebAudio sound effects and progress saved in `localStorage`.
- `vendor/` contains Three.js r170 (MIT), so the game runs without a CDN.
