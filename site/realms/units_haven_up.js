// =====================================================================
// HEX REALMS: upgraded Haven creatures.
// havenUpModel(id) -> { body, glow } for halberdier, marksman, royalgriffin,
// crusader, zealot, champion, archangel. Facing +z, base at y = 0.
// Round 4: each upgrade is built by the same builder as its base creature
// (units_haven.js havenBuild(base, true)), so the silhouette and identity stay
// the same and the upgrade adds gold trim, capes, crowns, bigger plumes/wings.
// =====================================================================
import { havenBuild } from './units_haven.js?v=1.5';

const BASE_OF = { halberdier: 'pikeman', marksman: 'archer', royalgriffin: 'griffin', crusader: 'swordsman', zealot: 'monk', champion: 'cavalier', archangel: 'angel' };
export const HAVEN_UP_IDS = Object.keys(BASE_OF);
// Returns a fresh { body, glow } for an upgraded Haven creature id, or null for any other id.
export function havenUpModel(id) {
  const b = BASE_OF[id];
  return b ? havenBuild(b, true) : null;
}
