// =====================================================================
// HEX REALMS: shader rig contract. Models stay single merged geometries
// (one draw call each); every vertex carries which "bone" it belongs to
// and the pivot that bone rotates around. The body / glow / ink-hull
// materials deform vertices on the GPU from a few per-mesh uniforms.
//
//   geometry attributes (added by the model modules):
//     aBone  : float, one of BONE.* (0 = static, the default)
//     aPivot : vec3, the bone's pivot in model-local space
//   models without these attributes simply don't animate.
//
// Hierarchy is deliberately shallow: each bone rotates about its own
// pivot, then everything except ROOT and the legs follows BODY. Put a
// weapon on ARM_R with the shoulder as pivot so it swings with the arm.
// =====================================================================

export const BONE = {
  ROOT: 0,     // static: base, ground bits
  BODY: 1,     // torso/pelvis: bobs, leans, breathes (pivot ~ hips)
  HEAD: 2,     // head/neck (pivot ~ neck)
  ARM_L: 3,    // shield/off arm (pivot ~ shoulder)
  ARM_R: 4,    // weapon arm + weapon (pivot ~ shoulder)
  LEG_FL: 5,   // biped left leg / quadruped front-left (pivot ~ hip)
  LEG_FR: 6,   // biped right leg / quadruped front-right
  LEG_BL: 7,   // quadruped back-left
  LEG_BR: 8,   // quadruped back-right
  WING_L: 9,   // pivot at the wing root, flaps around the body's Z axis
  WING_R: 10,
  TAIL: 11,    // pivot at the tail root, sways
  CLOTH: 12,   // capes, banners on bodies, robes' hem: waves with distance from pivot
  RIDER: 13,   // a mounted rider (follows BODY, adds its own bob/lean)
  SPIN: 14,    // windmill sails, wheels: spins around local +Z through the pivot
  FLAG: 15,    // free-standing flags/pennants: waves with distance from pivot
};

// Animation states (uniform uAnimState)
export const ANIM = { IDLE: 0, WALK: 1, ATTACK: 2, HIT: 3, DEATH: 4, CAST: 5, FLY: 6, CHEER: 7 };

/** Add aBone/aPivot to a part geometry before it is merged (non-indexed or indexed both fine). */
export function tagPart(THREE, geo, bone, pivot = [0, 0, 0]) {
  const n = geo.attributes.position.count;
  const b = new Float32Array(n).fill(bone), p = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { p[i * 3] = pivot[0]; p[i * 3 + 1] = pivot[1]; p[i * 3 + 2] = pivot[2]; }
  geo.setAttribute('aBone', new THREE.BufferAttribute(b, 1));
  geo.setAttribute('aPivot', new THREE.BufferAttribute(p, 3));
  return geo;
}

/** Make sure a final geometry has aBone/aPivot (static defaults) so every geometry drawn with the shared material matches. */
export function ensureRig(THREE, geo) {
  if (!geo || geo.attributes.aBone) return geo;
  const n = geo.attributes.position.count;
  geo.setAttribute('aBone', new THREE.BufferAttribute(new Float32Array(n), 1));
  geo.setAttribute('aPivot', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
  return geo;
}

/** Tag a vertex range [start, start+count) of an already merged geometry. */
export function tagRange(THREE, geo, start, count, bone, pivot = [0, 0, 0]) {
  ensureRig(THREE, geo);
  const b = geo.attributes.aBone.array, p = geo.attributes.aPivot.array;
  for (let i = start; i < start + count; i++) { b[i] = bone; p[i * 3] = pivot[0]; p[i * 3 + 1] = pivot[1]; p[i * 3 + 2] = pivot[2]; }
  geo.attributes.aBone.needsUpdate = true; geo.attributes.aPivot.needsUpdate = true;
  return geo;
}
