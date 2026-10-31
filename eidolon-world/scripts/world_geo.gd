class_name WorldGeo
extends RefCounted
## v1.0 M3 (dev/V1_WORLD.md): the free world's new spaces, built into the Level like Ch1Geo's: the HUB (the
## Atrium of a Thousand Faces) and the traversal sections that join it to the three wings:
##   T1 the Crumbling Bridge   pool stub -> the Atrium (its loose slabs are a chapter object: hub.gd)
##   T2 the Scaffold Climb     up to the gallery and Theron's workbench (the lamp)
##   T4 the Flooded Colonnade  hidden stones across the colossus lake (only her reflection shows them)
##   T5 the Undercroft         a dark vaulted passage east (the lamp)
##   T3 the Wind-swept Balcony up the lake's east shore to the Eidolon Ledge
## Coordinates: -z is north (up the screen); the camera looks from the south-west.

## (v1.0 A's material ids, by vertex COLOR.g: 0.87-0.95 bronze, 0.95-0.995 brown wood, 1.0 charcoal)
const WOOD := 0.97
const BRONZE := 0.91
const A_Y := 0.5                         # the Atrium's floor
const A_RECT := Rect2(-4.0, 9.6, 18.0, 13.4)   # x -4..14, z 9.6..23
const FOUNTAIN := Vector3(5.0, A_Y, 16.0)
const GAL_Y := A_Y + 2.6                 # the scaffold gallery
const LAMP_POS := Vector3(13.25, GAL_Y, 14.7)
const BAL_Y := 2.0                       # the balcony
## T4: the hidden path's stones (centres, x z), their top just under the water
const T4_Y := 0.1
const T4_STONES := [Vector2(11.5, 8.15), Vector2(10.75, 7.5), Vector2(10.6, 6.6), Vector2(11.35, 5.95), Vector2(12.15, 5.45)]
const T4_DECOYS := [Vector2(12.75, 7.35), Vector2(9.75, 8.45), Vector2(12.95, 6.25), Vector2(9.75, 6.0)]
const LAKE_Z1 := 9.6                     # (the colossus lake now reaches the Atrium's north edge)

static func R(x0: float, z0: float, x1: float, z1: float) -> Rect2:
	return Level.R(x0, z0, x1, z1)

static func build(lv: Level) -> void:
	_bridge(lv)
	_atrium(lv)
	_colonnade(lv)
	_undercroft(lv)
	_balcony(lv)

# ------------------------------------------------------------------ T1: pool stub -> Atrium
static func _bridge(lv: Level) -> void:
	# (the slabs themselves are loose: hub.gd lays them and lets them settle under you)
	lv.walk(R(-1.0, 7.3, 1.0, 9.65), 0.0, A_Y, 1, "T1")
	lv.balustrade("T1", Vector2(-1.05, 7.4), Vector2(-1.05, 9.5), 0.05)
	lv.balustrade("T1", Vector2(1.05, 7.4), Vector2(1.05, 9.5), 0.05)
	lv.ob_rect(R(-1.25, 7.3, -1.0, 9.6))
	lv.ob_rect(R(1.0, 7.3, 1.25, 9.6))
	lv.underside("T1", R(-1.0, 7.3, 1.0, 9.6), -0.4)

# ------------------------------------------------------------------ the Atrium of a Thousand Faces
static func _atrium(lv: Level) -> void:
	var z := "A"
	var r := A_RECT
	lv.slab(z, r, A_Y, 0.8, 0.0)
	lv.walk(r.grow_individual(-0.15, -0.0, -0.15, -0.15), A_Y, NAN, -1, "A")
	# the edges: low parapets toward the camera (west, south) and the lake (north); the far east side is
	# a wall (the undercroft's mouth in it)
	lv.balustrade(z, Vector2(-3.95, 9.75), Vector2(-3.95, 22.85), A_Y)
	lv.balustrade(z, Vector2(-3.85, 22.95), Vector2(13.85, 22.95), A_Y)
	lv.balustrade(z, Vector2(-3.85, 9.65), Vector2(-1.15, 9.65), A_Y)
	lv.balustrade(z, Vector2(1.15, 9.65), Vector2(10.85, 9.65), A_Y)
	lv.balustrade(z, Vector2(12.15, 9.65), Vector2(13.85, 9.65), A_Y)
	for e in [R(-4.2, 9.6, -3.85, 23.2), R(-4.0, 22.85, 14.0, 23.2), R(-4.0, 9.4, -1.0, 9.75), R(1.0, 9.4, 10.85, 9.75), R(12.15, 9.4, 14.0, 9.75)]:
		lv.ob_rect(e)
	lv.wall(z, R(14.0, 12.85, 14.35, 23.0), A_Y, A_Y + 3.4, false)
	lv.wall(z, R(14.0, 9.6, 14.35, 10.0), A_Y, A_Y + 3.4, false)
	lv.ob_rect(R(13.9, 12.85, 14.4, 23.0))
	lv.ob_rect(R(13.9, 9.6, 14.4, 10.0))
	# the dry fountain: a round basin, its broken figure
	# (v1.0 M4: A's kit_fountain, Props; the same draws from the level's rng as the old basin and stump)
	lv.C(0.25); lv.C(0.0); lv.C(0.25)
	lv.rng.randf()
	# the half-carved faces: rows of busts on plinths (Theron's thousand attempts), aisles between
	for p in [Vector2(2.6, 11.4), Vector2(4.6, 11.4), Vector2(6.6, 11.4), Vector2(8.6, 11.4),
			Vector2(-2.6, 14.0), Vector2(-2.6, 16.4), Vector2(-2.6, 18.8),
			Vector2(2.4, 13.6), Vector2(7.6, 13.6), Vector2(2.4, 18.4), Vector2(7.6, 18.4)]:
		_bust(lv, z, Vector3(p.x, A_Y, p.y), lv.yaw_to(Vector3(p.x, 0, p.y), FOUNTAIN))
	# two blocks waiting to be carved, a fallen crane arm
	lv.box(z, Vector3(9.9, A_Y + 0.45, 20.6), Vector3(1.0, 0.9, 0.8), 0.25, false, Basis(Vector3.UP, 0.3))
	lv.ob_rect(R(9.24, 20.0, 10.56, 21.2))
	lv.box(z, Vector3(-1.0, A_Y + 0.12, 21.6), Vector3(3.2, 0.24, 0.3), WOOD, false, Basis(Vector3.UP, 0.12))
	lv.ob_rect(R(-2.65, 21.3, 0.65, 21.95))
	# T2: Theron's scaffold up the east wall: a plank stair, a gallery with his workbench
	var g := Rect2(11.2, 14.0, 2.75, 3.4)                       # the gallery (x 11.2..13.95, z 14..17.4)
	lv.walk(g, GAL_Y, NAN, -1, "A_gal")
	lv.walk(R(11.2, 17.4, 12.6, 22.4), GAL_Y, A_Y, 1, "A_scaf")
	lv.mb(z).tag = "floor"
	lv.box(z, Vector3(g.get_center().x, GAL_Y - 0.08, g.get_center().y), Vector3(g.size.x, 0.16, g.size.y), 0.0)      # (stone flags on his timbers: brown wood read red-orange from the fixed view)
	lv.mb(z).tag = ""
	lv.steps(z, R(11.2, 17.4, 12.6, 22.4), 1, A_Y, GAL_Y, false)
	for px in [11.3, 13.85]:
		for pz in [14.1, 17.3]:
			lv.box(z, Vector3(px, (A_Y + GAL_Y - 0.16) * 0.5, pz), Vector3(0.14, GAL_Y - 0.16 - A_Y, 0.14), 1.0)
	lv.balustrade(z, Vector2(11.15, 14.05), Vector2(11.15, 17.35), GAL_Y)
	# (no rail on its north edge: from the fixed view it would stand before the Undercroft's mouth)
	lv.ob_rect(R(10.95, 17.4, 11.2, 21.8))                       # (the stair's open side; its foot is low enough to step on from the side)
	lv.box(z, Vector3(13.4, GAL_Y + 0.4, 15.1), Vector3(0.8, 0.08, 1.4), WOOD)            # the workbench
	for bz in [14.55, 15.65]:
		lv.box(z, Vector3(13.4, GAL_Y + 0.18, bz), Vector3(0.7, 0.36, 0.08), WOOD)
	lv.ob_rect(R(12.95, 14.35, 13.85, 15.85))

## a half-carved face: a plinth, a rough block, the face emerging on one side
## (v1.0 M3c: TURNED's head is its own node, chapter Life: now and then it has turned when you come back)
const TURNED := Vector2(2.6, 11.4)
## (v1.0 M4: these plinths carry A's kit faces, Props; their old block heads are not built)
const KIT_FACES := [Vector2(4.6, 11.4), Vector2(8.6, 11.4), Vector2(-2.6, 14.0), Vector2(-2.6, 18.8), Vector2(2.4, 13.6),
	Vector2(7.6, 13.6), Vector2(2.4, 18.4), Vector2(7.6, 18.4)]
static func _bust(lv: Level, z: String, base: Vector3, yaw: float) -> void:
	var B := Basis(Vector3.UP, yaw)
	var m := lv.mb(z)
	m.group = "bust:%d" % int(base.x * 100 + base.z)
	m.box(base + Vector3(0, 0.45, 0), Vector3(0.6, 0.9, 0.6), lv.C(0.25), B)
	if Vector2(base.x, base.z).distance_to(TURNED) < 0.01 or Vector2(base.x, base.z) in KIT_FACES:
		lv.C(0.25); lv.C(0.25)                     # (the same draws from the level's rng: nothing else moves)
	else:
		m.box(base + Vector3(0, 1.1, 0) + B * Vector3(0, 0, -0.04), Vector3(0.46, 0.42, 0.4), lv.C(0.25), B)
		m.sphere(base + Vector3(0, 1.15, 0) + B * Vector3(0, 0, 0.12), Vector3(0.16, 0.2, 0.12), lv.C(0.25), 10, 6, B)
	m.group = ""
	lv.ob_circle(Vector2(base.x, base.z), 0.45)

# ------------------------------------------------------------------ T4: the flooded colonnade
static func _colonnade(lv: Level) -> void:
	var z := "T4"
	# off the Atrium's edge: a short ramp of worn steps down into the water, onto the first hidden stone
	lv.walk(R(11.0, 8.5, 12.0, 9.65), T4_Y, A_Y, 1, "T4")
	lv.steps(z, R(11.0, 8.65, 12.0, 9.6), 1, T4_Y, A_Y, true)
	# the hidden stones (their tops 5 cm under the still water) and the ways between them
	var stones: Array = T4_STONES
	for i in stones.size():
		var c: Vector2 = stones[i]
		lv.walk(Rect2(c - Vector2(0.48, 0.48), Vector2(0.96, 0.96)), T4_Y, NAN, -1, "T4")
		lv.mb(z).tag = "floor"
		lv.box(z, Vector3(c.x, T4_Y - 0.45, c.y), Vector3(0.9, 0.9, 0.9), 0.25, false, Basis(Vector3.UP, 0.2 * i))
		lv.mb(z).tag = ""
		if i + 1 < stones.size():
			var mid: Vector2 = (c + (stones[i + 1] as Vector2)) * 0.5
			lv.walk(Rect2(mid - Vector2(0.4, 0.4), Vector2(0.8, 0.8)), T4_Y, NAN, -1, "T4")
	# up out of the water onto the colossus stones' southern apex
	lv.walk(R(11.75, 3.95, 12.55, 5.05), Ch1Geo.CO_WATER_Y + 0.85, T4_Y, 1, "T4")
	lv.walk(R(11.75, 3.55, 12.55, 3.97), Ch1Geo.CO_WATER_Y + 0.85, NAN, -1, "T4")       # (onto the stones: no seam between)
	lv.steps(z, R(11.75, 3.95, 12.55, 5.05), 1, T4_Y, Ch1Geo.CO_WATER_Y + 0.85, false)
	# the drowned colonnade: broken shafts standing out of the water (they look like stepping stones:
	# they are not)
	for c in T4_DECOYS:
		lv.stump(Vector3(c.x, -0.9, c.y), 1.1, true, 0.04)      # (on the lake's bed)

# ------------------------------------------------------------------ T5: the undercroft
static func _undercroft(lv: Level) -> void:
	var z := "UC"
	var r := R(14.0, 10.2, 23.6, 12.6)
	lv.slab(z, r.grow_individual(0.0, 0.25, 0.0, 0.25), A_Y, 0.8, 0.0)
	lv.walk(r.grow_individual(0.25, 0.0, 0.0, 0.0), A_Y, NAN, -1, "UC")      # (from the Atrium's own edge)
	# a vault on piers (the south side is an arcade toward the camera: you are seen through it)
	lv.wall(z, R(14.35, 9.95, 23.6, 10.2), A_Y, A_Y + 2.4, true)
	for px in [15.4, 17.8, 20.2, 22.6]:
		lv.box(z, Vector3(px, A_Y + 1.2, 12.72), Vector3(0.36, 2.4, 0.24), 0.25, true)
		lv.ob_rect(R(px - 0.2, 12.6, px + 0.2, 12.85))
	lv.C(0.25, true)          # (QA P1-4: the vault's roof is the hub's own node, lifted away while you are under it; the same rng draw)
	lv.ob_rect(R(14.0, 12.6, 23.6, 12.85))
	# fallen blocks to weave through (the lamp shows them)
	# (off the way's centreline: north, south, north)
	for b in [[Vector3(16.4, 0.0, 10.6), 0.4], [Vector3(19.0, 0.0, 12.2), -0.3], [Vector3(21.4, 0.0, 10.6), 0.15]]:
		var p: Vector3 = b[0]
		lv.box(z, Vector3(p.x, A_Y + 0.3, p.z), Vector3(0.8, 0.6, 0.55), 0.25, false, Basis(Vector3.UP, float(b[1])))
		lv.ob_circle(Vector2(p.x, p.z), 0.42)
	# its east end: a stair up to the balcony
	lv.steps(z, R(23.6, 10.2, 26.45, 12.6), 0, A_Y, BAL_Y, true)
	lv.walk(R(23.6, 10.2, 26.45, 12.6), A_Y, BAL_Y, 0, "UC_up")
	lv.wall(z, R(23.6, 9.95, 26.45, 10.2), A_Y, BAL_Y + 0.9, true)
	lv.ob_rect(R(23.6, 12.6, 26.45, 12.85))
	lv.balustrade(z, Vector2(23.7, 12.75), Vector2(26.35, 12.75), BAL_Y - 0.6)

# ------------------------------------------------------------------ T3: the wind-swept balcony
static func _balcony(lv: Level) -> void:
	var z := "BAL"
	var r := R(26.45, -18.95, 29.6, 12.6)
	lv.slab(z, r, BAL_Y, 0.5, 0.0)
	lv.walk(r.grow_individual(0.0, 0.15, 0.0, 0.0), BAL_Y, NAN, -1, "BAL")      # (into the Ledge's floor: no seam)
	lv.balustrade(z, Vector2(29.55, 12.5), Vector2(29.55, -18.9), BAL_Y)
	lv.balustrade(z, Vector2(26.55, 12.55), Vector2(29.45, 12.55), BAL_Y)
	lv.balustrade(z, Vector2(26.5, 10.1), Vector2(26.5, -18.9), BAL_Y)
	lv.ob_rect(R(29.45, -19.0, 29.8, 12.7))
	lv.ob_rect(R(26.45, 12.45, 29.6, 12.8))
	lv.ob_rect(R(26.25, -19.0, 26.55, 10.15))
	# poles with torn veils (the veils are chapter objects: they stream in the gusts)
	# (v1.0 M4: A's kit awning posts carry the torn veils now, Props; the same rng draw per old pole)
	for pz in [6.0, -2.0, -10.0]:
		lv.rng.randf()
