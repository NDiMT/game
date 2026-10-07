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

Pushes to `main` are deployed to GitHub Pages by `.github/workflows/pages.yml`:

- Arrow Cube 3D: `https://ndimt.github.io/game/`
- Color Gates: `https://ndimt.github.io/game/color-gates/`

If the first deploy fails, go to **Settings → Pages** in the repository, set **Source** to **GitHub Actions**, and re-run the workflow.

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

---

# Dead Sector

A third game in `dead-sector/`: a roguelite FPS inspired by *Deadzone: Rogue*, drawn in the style of classic *Doom*.

- **Look:** A software raycaster renders at 320×200 in the browser (textured walls, floor and ceiling, distance fog, billboard sprites) with a Doom-style status bar and face. All art and sound are procedural, so there are no asset files.
- **Structure:** A run is a chain of rooms on a failing space station. Doors lock while enemies teleport in over two waves. When a room is clear, you pick 1 of 3 upgrades and the exit opens. Every 6th room is a sector boss, and each new sector has a new look (storage, foundry, bio-lab) and tougher enemies.
- **Weapons:** Pistol (infinite ammo), shotgun, chaingun, plasma rifle and rocket launcher. You carry up to 3, and weapons level up with +25% damage per level.
- **Upgrades:** Fire, shock and cryo elements, damage, fire rate, crits, life steal, max health, armor, exploding kills, faster dash and move speed.
- **Enemies:** Drones, grunts, chargers, heavies and a boss with ring and aimed bullet patterns plus reinforcements.
- **Controls:** WASD and mouse (pointer lock), click to fire, Shift/Space to dash, 1–3, Q or the wheel to switch weapons, Esc to pause. Touch devices get a virtual stick, drag-to-look and buttons.

---

# Bari Van Run

A fourth game in `bari-van/`: a mobile-first 3D driving game (Three.js) on the group's Puglia day trip (Bari → Alberobello → Matera → Bari), with each leg's real schedule as the in-game clock.

- **Comedy:** Take a bend too fast and the sliding doors open and a passenger flies out (with lines from the group chat). Potholes, speed bumps and hard braking pop the rear doors. Stop next to stranded passengers to pick them up, or they take a taxi to the next stop.
- **Obstacles:** Potholes, speed bumps in towns, roadworks cones, a flock of sheep crossing, and two-way traffic (Fiats, tomato-loaded Ape trucks, buses).
- **Scenery:** The Bari seafront with palms and the Swabian castle, olive groves and dry-stone walls, Alberobello trulli, the Matera sassi with the cathedral, and a night drive home with headlights.
- **Controls:** A touch steering wheel (±135°, springs back to center), real-looking gas and brake pedals (hold brake to reverse), optional tilt steering and a horn. On desktop: arrow keys or WASD.

## Holy Ground (`holy-ground/`)

A modern take on Populous for phones in portrait. Raise and lower the corners of a diorama island so your followers find flat land, grow tents into castles on full 5×5 plots, lead them to settle, gather or fight, and outlast the Crimson god with swamps, knights, quakes, volcanoes, floods and Armageddon across 8 worlds in 4 biomes. Three.js, procedural art, synthesized sound.

## Polis (`polis/`)

A pocket city builder in the spirit of SimCity, for phones in portrait. Lay roads and bridges, zone homes, shops and industry, keep power and water flowing through the network, fund police, fire, schools, parks and a stadium, watch R/C/I demand, land value, pollution and crime, set the tax rate and grow a hamlet into a metropolis. The city saves itself. Three.js, procedural art, synthesized sound.
