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
//
// Implementation: materials.js (RIG_DECL shader chunk + setAnim / getAnim /
// clearAnim / ANIM_DUR / ANIM_IMPACT / setRigIdle). Conventions it relies on:
//  - +Z is the front, +X is the *_R side (weapon hand): ARM_R, LEG_FR, LEG_BR,
//    WING_R at +x. Side signs come from sign(aPivot.x) (bone id if |x| < 0.02).
//  - Followers of BODY: HEAD, ARM_L/R, WING_*, TAIL, CLOTH, RIDER. Legs, ROOT,
//    SPIN and FLAG don't (a FLAG follows BODY only on models that have a BODY,
//    e.g. a hero's banner). When the model has a RIDER, ARM_L/ARM_R also follow
//    the RIDER (they are the rider's arms) and ATTACK becomes a lance thrust.
//  - The BODY / RIDER pivots are read from the first vertex with that bone, and
//    the figure height from the max y; one group shares them (body + glow + hull).
//  - DEATH / CHEER move the whole figure (all bones except ROOT/SPIN/FLAG), so
//    untagged (ROOT) vertices must be only ground bits: tag every figure part.
//  - WING pairs whose pivot has |x| < 0.02 are treated as a cape (gentle sway).
//  - CLOTH rising ABOVE its pivot on a model without BODY = flame (flicker);
//    CLOTH hanging below = cape/flap (bends more toward the hem).
//  - FLAG hanging below its pivot sways in its own plane (wall banners);
//    FLAG sticking out sideways flaps about the pole.
//  - HEAD / FLAG motion gets a phase from the pivot position, so several heads
//    (hydra necks) or rows of flags move independently.
//  - SPIN: about local +Z through the pivot, ~1.4 rad/s, always on.
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
