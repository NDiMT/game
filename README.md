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

---

# Color Gates

A second game in `color-gates/`. It keeps the arrow-cube mechanic and adds color sorting.

- Every cube has a color and a symbol. At the top there is one open gate that takes 3 cubes of its color, plus a preview of the next gates.
- A cube with a clear path that matches the open gate goes into it. A cube that does not match goes to a small waiting queue (4–5 slots).
- When a gate fills up, the next one opens and automatically pulls in matching cubes from the queue.
- You lose if the queue overflows, or if it is full and no free cube matches the open gate. You get stars for keeping the queue short.
- Every level can be solved. The gate order comes from a valid removal order, split into groups of 3 of the same color, so a solution exists that never uses the queue.

Open `http://localhost:8000/color-gates/` after starting the server.
