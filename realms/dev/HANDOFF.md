# ORBIS: handoff notes (for a new session)

## State
- **Live:** v2.1 at https://ndimt.github.io/game/realms/ (deployed from the pages branch `claude/solo-game-ideas-balatro-yj6hqw`, then merged to `main`).
- **Dev branch:** `claude/arrow-pro-3d-game-2tki08`.
- **In progress:** v2.2 work. When this was written an agent was still on it; check `git log`. It covers:
  - PWA manifest
  - fullscreen and orientation lock
  - always-landscape (the game rotates when the phone is held in portrait)
  - fixes for text that isn't centred, e.g. the Crown Run faction picker
- **Modes:**
  - Free Play: classic skirmish with 2–5 crowns.
  - Crown Run: HoMM-native roguelite. Design is in `realms/dev/CROWN_RUN.md`; code in `realms/crown.js` and `realms/crown_ui.js`.
- **Map:** flat hex grid (`realms/hexgrid.js`). The layout is designed for landscape first.

## Next: icon overhaul with PixelLab
The API key must be available to the session as `PIXELLAB_API_KEY` (env var) or as a network secret for `api.pixellab.ai`.

Steps:
1. **Check credits/balance first** and tell the owner before spending anything.
2. **Lock a style guide.** Painted/HD style with an ink outline, light from the top-left, palettes tied to faction colours, 128 px icons. Generate 6–8 samples, let the owner pick, and use the chosen one as the reference image for all later batches.
3. **Generate in this order:**
   - Artifacts: 48. Rarity frames; the pieces of each set share a motif.
   - Spells: ~20, coloured by school.
   - Skills: ~20, as medallions with bronze/silver/gold tiers.
   - Resources: 7.
   - Buildings: per faction.
   - Units and heroes: img2img from the current 3D portraits (`portraits.js`) so each unit keeps its identity.
   - UI crests.
4. **For each batch:** show the owner a contact sheet, approve it, then compress to WebP atlases. The game uses them with the current SVG / 3D portraits as fallback.
