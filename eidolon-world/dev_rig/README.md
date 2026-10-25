# Wanderer re-rig (dev)

This folder holds a candidate replacement rig for the owner's Tripo wanderer. It is self-contained: no game
scene or script refers to it yet.

| File | What it is |
|---|---|
| `assets/models/wanderer_rigged.glb` | The re-rigged model: same mesh (15 061 verts, 10 972 tris) and same UVs, an A-pose bind, new weights, 58 cloth bones and 1024² JPEG textures (1.2 MB). |
| `assets/models/wanderer_rigged.glb.import` | Imports the textures as embedded Basis Universal, so no extra texture files are extracted next to the GLB. |
| `dev_rig/wanderer_rig.gd` | A reusable node. It loads the GLB, builds the spring-bone cloth and drives the procedural walk and idle. |
| `dev_rig/wanderer_rig_test.tscn` / `.gd` | The test scene, which plays idle, walk, a 180° turn, stop and idle again. It also renders stills and runs a cost benchmark. |
| `dev/shots/rig-*.png` | Before/after stills and weight maps. |

## How to run it

```
godot --path eidolon-world res://dev_rig/wanderer_rig_test.tscn
#   L = toggle the original auto-rig, C = cloth on/off, P = pause, drag = orbit, wheel = zoom
xvfb-run godot --path eidolon-world --rendering-driver opengl3 --fixed-fps 30 res://dev_rig/wanderer_rig_test.tscn -- --shots=/abs/dir --rig=new|old
godot --headless --path eidolon-world --fixed-fps 60 res://dev_rig/wanderer_rig_test.tscn -- --bench=40
```

## What changed compared with the Tripo auto-rig

- **Bind pose.** The bind pose is now an A-pose: arms 52° down and 14° forward, baked into the mesh and the
  inverse bind matrices. Lowering the arms at runtime is now about 25° from the bind instead of about 80°.
  The sleeve tatters were re-hung during the bake: their chains only translate with the arm, so they still
  hang straight down.
- **Skeleton clean-up.** The finger, twist, share, eye and facial bones are gone; there is no hand mesh.
  The arm joints were moved onto the real sleeve axis. The legs were re-proportioned: in the old rig the
  knee sat 2 cm below the hip, now the hip, knee and ankle are spread properly.
  - Before: 78 bones.
  - After: 25 body bones plus 58 cloth bones, 83 in total.
- **Weights.** Every vertex has at most 4 influences, normalised. Weights are computed per welded position,
  so they don't split at UV seams. They are smoothed with an edge-length-weighted Laplacian.
  - **Cloak below the waist:** a smooth height blend over Pelvis, Waist, Spine01 and Spine02. Below the hip
    it uses the hem chains, plus a soft leg share of at most about 0.23, mostly at the front. The left/right
    split runs across 22 cm, so the cloak doesn't stretch between the legs.
  - **Hood and face:** Head and NeckTwist01.
  - **Sleeves:** an envelope along the sleeve axis over Clavicle, Upperarm, Forearm and Hand with linear
    falloff. The shoulder top shares Spine02. The hanging drapes go to the sleeve chains.
  - **Scarf:** the scarf pieces are separate meshes. Each one rides a scarf chain; before, about 76% of it
    was weighted to the right arm.
- **Measured effect.** The original and the new rig were both posed with a stride of ±0.36 rad, the back knee
  at 0.5 rad and the arms hanging (`stress.py`):
  - Cloak edges deformed by more than 25%: 5.6% before, 0.9% after. Worst stretch: ×6.3 before, ×2.1 after.
  - Shoulder and sleeve edges deformed by more than 25%: 2.2% before, 0% after. Worst stretch: ×2.5 before,
    ×1.24 after.

## Node structure (after import)

```
wanderer_rigged (Node3D, glTF root)
└─ Armature
   └─ Skeleton3D   (83 bones; rest pose == A-pose bind)
      ├─ Wanderer  (MeshInstance3D, one surface, material "wanderer_cloak")
      └─ Cloth     (SpringBoneSimulator3D, added at runtime by wanderer_rig.gd)
         ├─ Col_Pelvis, Col_Spine01                    (vertical capsules)
         └─ Col_L_Thigh, Col_L_Calf, Col_R_Thigh, Col_R_Calf (capsules along the leg bones)
```

The model faces +Z, and its left is +X. `wanderer_rig.gd` does what `scripts/wanderer_glb.gd` does: it
rotates the model by PI about Y and scales it by `HEIGHT` = 1.12.

## Bone names

- **Body (25)**, with the same names as the old rig:
  - `BoneRoot > Hip > Pelvis > {L,R}_Thigh > _Calf > _Foot > _ToeBase`
  - `Hip > Waist > Spine01 > Spine02 > NeckTwist01 > NeckTwist02 > Head`
  - `Spine02 > {L,R}_Clavicle > _Upperarm > _Forearm > _Hand`
- **Cloth (58).** The bones are named `<Chain>_<k>`, with k = 0 at the root. Every bone's +Y axis runs along
  the chain. The chains were placed automatically: the tool finds the narrow hanging tatter strips (local
  minima of the hem, grown upward while the region stays under 6–7.5 cm wide) and fits each chain along the
  strip's medial line.

| Chains | Parent | Bones | Where |
|---|---|---|---|
| `HemL0..3`, `HemR0..3` | Pelvis | 4 each | Around the skirt at azimuths ±17–26° (front sides), ±54–58°, ±120–133° and ±147–163° (back). They run from hip height (y 0.40) down to the tip of the best tatter in each sector. |
| `SleeveL0..2`, `SleeveR0..1` | `*_Forearm` | 3 each | The long hanging strips at the sleeve ends. The mesh is not symmetric, so the right sleeve has 2. |
| `ScarfR0` (long right tail), `ScarfR1` (second right tail, which also carries the short strip and the torn-off tip), `ScarfL0` (left tail) | Spine02 | 4 / 3 / 4 | Fitted along the medial line of each scarf piece, using geodesic distance bands. |

## Spring settings (`SPRING` in wanderer_rig.gd)

| Kind | Stiffness | Drag | Gravity | Joint radius | Stiffness at tip | Drag at tip |
|---|---|---|---|---|---|---|
| Hem | 3.0 | 0.50 | 0.45 | 0.018 | ×0.5 | ×0.8 |
| Sleeve | 1.4 | 0.45 | 1.3 | 0.014 | ×0.6 | ×0.85 |
| Scarf | 1.6 | 0.42 | 0.35 | 0.02 | ×0.45 | ×0.8 |

- The tip values are linear damping curves from root to tip.
- `extend_end_bone` is on, with direction +Y and a length equal to the last segment.
- Center is the world origin, so the cloth lags behind movement and turns.
- Wind comes from `set_wind(Vector3)`, which sets `external_force`. The test uses a gentle gust of about 0.05.
- Colliders, in model units:
  - Pelvis capsule: r 0.125, which is the skirt's inner cone.
  - Spine01 capsule: r 0.11.
  - Thigh capsules: r 0.07.
  - Calf capsules: r 0.06.

## Cost

| Item | Value |
|---|---|
| Spring setup | 1 SpringBoneSimulator3D, 16 chains, 58 joints, 6 colliders |
| Skin | 83 bones, at most 4 weights per vertex |
| Draw calls | 1 skinned draw call, as before |
| Cloth CPU cost (`--bench`, headless, desktop x86) | About 0.07–0.10 ms per wanderer per frame (40 wanderers: 5.7 ms with cloth on vs 1.5 ms with it off) |
| Expected on a mid-range phone | Roughly 0.3–0.5 ms for the one hero character. This is an assumption: it was not measured on a device. |

Most of the cloth cost is the collision tests. If you need to cut it further, give the hem chains only the
Pelvis and leg colliders, and give the scarf and sleeves only Spine01.

## Swapping it into the game

1. In `scripts/wanderer_glb.gd`, load `res://assets/models/wanderer_rigged.glb` instead of `wanderer.glb`.
   `DRIVEN` and `apply_pose` work unchanged, because they work with global deltas and the bone names are kept.
2. Remove the old rest-pose maths:
   - `ARM_TWIST` and `CLAV_DROP` are no longer needed, because the bind is already an A-pose.
   - Set `ARM_DIR` and `FORE_DIR` to the hanging directions in `wanderer_rig.gd`.
3. Add the cloth: copy `_find_chains()`, `_build_springs()`, `_capsule()` and the `SPRING` table from
   `wanderer_rig.gd`, then call `_build_springs()` after the skeleton is found.
   - Call `sim.reset()` when the player teleports.
   - Feed wind through `sim.external_force`.
4. Rebuild the vertex-colour bake. `tests/prep_wanderer.gd` writes `wanderer_mesh.res`, which carries the
   hem height, the cloth flutter mask and the rune bands for `wanderer.gdshader`.
   - Point the bake at the new GLB.
   - Its cuff and rim rules assume the T-pose, so convert them to A-pose coordinates, or compute them from
     the original GLB and transfer them by vertex index (the vertex order is unchanged).
   - Turn the shader's procedural cloak and scarf flutter down or off, because the bones now provide it.
5. The reflection puppet, the ghost and the veil (`BoneAttachment3D` on `Head`) keep working, because the
   bone names are the same.

## Tooling

The rig was built with Python, numpy and scipy, editing the GLB directly. Blender was not used. The scripts
are in `dev_rig/tools/`, which has a `.gdignore`:

- `rig_build.py` computes the weights and finds the chains from the original `wanderer.glb`.
- `rig_export.py` does the A-pose bake and writes the GLB. The environment variables `ARM_DOWN` and
  `ARM_FWD` set the bind arm angles.
- `stress.py` runs the deformation metrics.
- `glb.py` and `glbw.py` are a minimal GLB reader and writer.

To rebuild, run `python3 eidolon-world/dev_rig/tools/rig_export.py eidolon-world/assets/models/wanderer_rigged.glb`.
The output is byte-identical to the committed GLB.
