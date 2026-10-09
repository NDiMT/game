// =====================================================================
// HEX REALMS: upgraded Necropolis creatures (procedural, vertex-coloured).
// necroUpModel(id) -> { body: BufferGeometry, glow: BufferGeometry|null } | null
// ids: skelwarrior, plaguezombie, wraith, vampirelord, powerlich, dreadknight, ghostdragon
// Same size / orientation as the base creatures in units_necro.js:
// stand on y = 0, face +Z, about 1 unit tall (dread knight / ghost dragon about 1.4-1.5).
//
// Round 4: the upgrades are built by the SAME builders as the base creatures
// (units_necro.js necroBuild(id, true)), so each keeps its base silhouette
// identity and only grows grander: gold trims, crowns, bigger weapons/capes,
// extra glow. The import reuses this module's own ?v= query so the two files
// always load as one matching version.
// =====================================================================
const { necroBuild } = await import('./units_necro.js' + new URL(import.meta.url).search);

const BASE_OF = { skelwarrior: 'skeleton', plaguezombie: 'zombie', wraith: 'wight', vampirelord: 'vampire', powerlich: 'lich', dreadknight: 'blackknight', ghostdragon: 'bonedragon' };
export const NECRO_UP_IDS = Object.keys(BASE_OF);
export function necroUpModel(id) {
  return BASE_OF[id] ? necroBuild(BASE_OF[id], true) : null;
}
