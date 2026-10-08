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

A pocket city builder in the spirit of SimCity 2000, for phones in portrait. Lay streets, avenues and bridges; zone homes, shops and industry; string power lines from coal, gas, wind, solar or nuclear plants and lay water pipes in an underground view. Residents commute to jobs over the road network, so traffic jams are real; bus stops and avenues help. Fund police, fire, health, education and transport, set separate R/C/I taxes, pass policies, take loans, and keep your approval up. Detailed buildings in four variants per level light up at night, industry turns high-tech when the city is educated, and fires, tornadoes, earthquakes and meltdowns can strike. Graphs, news and autosave included, with a generative jazz combo (walking bass, electric piano, brushed swing drums and an improvising vibraphone) as the soundtrack. Three.js, procedural art, synthesized sound.

## Aeons (`aeons/`)

A god game about evolution, for phones in portrait. Turn a small 3D planet of hexagonal columns with day and night, oceans, clouds and an atmosphere, and raise or lower its hexes (green and red arrows show where) so your tribe can settle and grow on flat ground. Their knowledge carries you through seven ages, from the Stone Age to the Space Age, and in each one you build a wonder (Stonehenge, the Great Pyramid, the Parthenon, a Cathedral, the Iron Tower, the Sky Needle) to begin the next. Settlements change their look every age: huts become temples, castles, factories, glass towers and domed space colonies, with planes and satellites in the sky. Nature fights back with wildfires, plague, earthquakes, hurricanes and meteors, and from the Industrial Age pollution hurts the planet: if its health falls, the ice melts and the seas rise. Towns spread hex by hex over whatever flat land you give them, SimCity style, from a camp of a few hexes to sprawling cities of 80+ hexes. Each age unlocks buildings to place beside your towns (hunting grounds and shrines, farms and workshops, temples, libraries and aqueducts, markets, castles and universities, factories and railways, hospitals, power plants and airports, research labs, fusion reactors and arcologies) that boost food, knowledge, room to grow, health or defence for every town within three hexes. New powers unlock as you go (rain, forests, inspiration, blessings, cleansing, terraforming and meteor deflection). Real-time sun shadows and a glow pass light up cities on the night side. You share the planet with a rival tribe, the Crimson, whose own god shapes their land, builds and races you through the ages: if they launch a Starship first you lose, unless you are allies. Diplomacy is up to you: send gifts, form an alliance (shared knowledge and trade), keep the peace, or declare war and send war bands to capture their towns, where better weapons of a later age win. They remember how you treat them: crowding their borders or digging up their land angers them, while blessings and rain on their towns earn their trust. Land near the Crimson cannot be shaped. The Level tool makes terraforming easy: tap, or hold and drag to paint, and each hex steps toward your nearest town's height. Treasures dot the map (crystals, gold, fish, sacred springs and, later, oil) and reward the towns that reach them; a beacon steers your settlers; and event cards ask you to choose between two paths. Three difficulty levels, a chain of missions with rewards, wonders that leave lasting gifts, and trade caravans that travel between you and the Crimson while you keep the peace. Cities feel alive: streets run along the hex edges with street lamps that glow at night, people, carts, cars and hover pods move through them, downtowns rise in the centre with markets and plazas while suburbs with gardens spread at the edge, boats and ships sail the seas and flocks of birds circle overhead. Every raise, lower or level shatters the hex into flying chunks with a shockwave, quick strokes build combos with a climbing sound, golden wisps appear to be tapped for inspiration, and the light turns golden at dusk. The look is soft and indie: pastel land and water, a dusk-gradient sky, lavender-tinted shadows and a paper-style interface. A compact HUD keeps most of the screen for the world, and a zen button hides the interface entirely. Nights are magical, with auroras over the poles, fireflies over the forests, glowing surf, a nebula, twinkling stars and shooting stars. The score is a cinematic church-organ ostinato over a ticking clock that swells as the ages advance, and the game ends when you launch the Starship. Three.js, procedural art, synthesized sound.
