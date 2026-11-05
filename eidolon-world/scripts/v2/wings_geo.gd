class_name WingsGeo
extends RefCounted
## (v2 rebuild, phase 3) the v1 puzzle rooms' geometry in the new world: each builder is the v1 one, unchanged in its
## numbers, drawn through an LvOff (its module's world offset: Map2.GW / GG / GN / GE / GX). Their walk regions keep
## their v1 names (the puzzles toggle them by name); Map2.V1_SPACE says which new space each belongs to.

static func R(x0: float, z0: float, x1: float, z1: float) -> Rect2:
	return Level.R(x0, z0, x1, z1)

static func build(lv: Level) -> void:
	_stair_of_breath(LvOff.new(lv, Map2.GW))
	_hall(LvOff.new(lv, Map2.GW))
	_gallery(LvOff.new(lv, Map2.GG))
	var n := LvOff.new(lv, Map2.GN)
	_garden(n)
	_hollow_walk(n)
	_court(n)
	_tree_nook(n)
	_maze(n)

# ============================================================================================ WEST: the Glass wing
## W.1 the Stair of Breath, W.2 the Offering (v1 W_top), the corridor into the Hall (v1 ch1_geo)
static func _stair_of_breath(L: LvOff) -> void:
	var z := "W"
	# landing where the stones come ashore
	L.slab(z, R(-12.8, -0.2, -9.4, 3.6), 0.0, 0.7, 0.0)
	L.walk(R(-12.8, -0.2, -9.4, 3.6), 0.0, NAN, -1, "W_land")
	L.balustrade(z, Vector2(-12.75, 3.55), Vector2(-11.15, 3.55), 0.0)          # (v2: the Inlet Road comes in at its east end)
	L.balustrade(z, Vector2(-12.75, 3.4), Vector2(-12.75, 0.0), 0.0)
	L.statue(z, Vector3(-11.9, 0.0, 2.8), PI * 0.75, 0.85)      # (v1.0: clear of the rail)
	# first flight up to the breath landing
	L.steps(z, R(-12.4, -4.0, -10.2, -0.2), 1, 0.0, 0.5, false)     # (v0.7: high at the landing end, as you walk it)
	L.walk(R(-12.4, -4.0, -10.2, -0.2), 0.5, 0.0, 1, "W_stair1")
	L.slab(z, R(-12.4, -6.6, -10.2, -4.0), 0.5, 0.7, 0.0)
	L.walk(R(-12.4, -6.6, -10.2, -4.0), 0.5, NAN, -1, "W_breath")
	# the cliff wall on the east (between the stair and the water), the small glass set into it facing
	# west; the open side of the stair is the west, over the void
	L.wall(z, R(-10.2, -12.6, -9.7, -0.2), -0.6, 3.9, true)
	# bronze frame: proud of the wall by 12 cm (its back is buried in the wall: no coplanar faces)
	L.box(z, Vector3(-10.22, 1.75, -5.3), Vector3(0.2, 1.75, 1.35), 1.0)
	L.box(z, Vector3(-10.36, 0.93, -5.3), Vector3(0.36, 0.12, 1.3), 0.25)
	# second flight to the top (sealed by a veil of mist until she answers)
	L.steps(z, R(-12.4, -10.6, -10.2, -6.6), 1, 0.5, 1.0, false)
	L.walk(R(-12.4, -10.6, -10.2, -6.6), 1.0, 0.5, 1, "W_stair2")
	L.slab(z, R(-12.4, -14.4, -10.2, -10.6), 1.0, 0.7, 0.0)
	L.walk(R(-12.4, -14.4, -10.2, -10.6), 1.0, NAN, -1, "W_top")
	L.ob_rect(R(-12.4, -6.95, -10.2, -6.65), "breath_gate")
	L.column(Vector3(-12.15, 0.5, -6.8), 3.4)
	L.column(Vector3(-10.64, 0.5, -6.8), 3.4)      # (v1.0: clear of the wall)
	L.box(z, Vector3(-11.3, 4.05, -6.8), Vector3(2.2, 0.4, 0.6), 0.25, true)
	for x in [-12.35]:
		L.balustrade(z, Vector2(x, -0.3), Vector2(x, -3.9), 0.25)
		L.balustrade(z, Vector2(x, -4.1), Vector2(x, -6.5), 0.5)
		L.balustrade(z, Vector2(x, -7.2), Vector2(x, -10.5), 0.75)
		L.balustrade(z, Vector2(x, -10.7), Vector2(x, -14.3), 1.0)
	L.balustrade(z, Vector2(-12.35, -14.35), Vector2(-10.3, -14.35), 1.0)
	# the corridor east into the Hall of Glass, between its west columns
	L.slab(z, R(-10.2, -14.2, -5.0, -12.8), 1.0, 0.6, 0.0)          # (v0.9.1: ends where the Hall's floor begins: it overlapped it, coplanar: the flicker at the Hall's door)
	L.walk(R(-10.2, -14.2, -4.6, -12.8), 1.0, NAN, -1, "W_corr")
	L.balustrade(z, Vector2(-10.1, -14.25), Vector2(-5.2, -14.25), 1.0)
	L.balustrade(z, Vector2(-10.1, -12.75), Vector2(-5.2, -12.75), 1.0)
	L.rubble(Vector3(-12.1, 1.0, -14.1), 0.3, 3)

## W.3 the Hall of Glass (v1 level._hall)
static func _hall(L: LvOff) -> void:
	var z := "H"
	L.slab(z, R(-5, -21, 5, -11), 1.0, 0.8, 0.75)
	L.walk(R(-4.6, -20.6, 4.6, -11), 1.0, NAN, -1, "H")
	# far walls: north (with the great mirror) and east (with the doorway)
	L.wall("Hn", R(-5, -21, 5, -20.6), 1.0, 6.2)
	L.wall(z, R(4.6, -21, 5, -18.4), 1.0, 4.6)
	# v0.9: the east wall south of the door is a parapet: from the one fixed view a full wall here hid half of
	# the shadow chamber beyond it
	L.wall(z, R(4.6, -16.6, 5, -11), 1.0, 2.05)
	# v0.5: the remembered doorway: a wall today (its own mesh: hidden from the mirror, it opens)
	L.wall("Hdoor", R(4.6, -18.4, 5, -16.6), 1.0, 3.7)
	L.box(z, Vector3(4.8, 4.15, -17.5), Vector3(0.4, 0.9, 1.8), 0.25, true)
	L.walk(R(4.6, -18.2, 5.05, -16.8), 1.0, NAN, -1, "hdoor", false)
	# mirror frame (dark bronze) around the great glass x[-2.6,2.6] y[1.15,5.6]
	# (v0.9.1: the side bars 6 mm prouder than the rails: their front faces were coplanar at the corners)
	for fb in [[Vector3(0, 1.1, -20.52), Vector3(5.5, 0.14, 0.12)], [Vector3(0, 5.66, -20.52), Vector3(5.5, 0.14, 0.12)],
			[Vector3(-2.68, 3.38, -20.517), Vector3(0.14, 4.6, 0.126)], [Vector3(2.68, 3.38, -20.517), Vector3(0.14, 4.6, 0.126)]]:
		L.box("Hn", fb[0], fb[1], 1.0, true)
	# pilasters on the north wall
	for x in [-4.0, 4.0]:
		L.box("Hn", Vector3(x, 3.6, -20.45), Vector3(0.6, 5.2, 0.3), 0.25, true)
	# colonnade on the open sides (west + south)
	# (v0.9: the near columns broken low, so the floor behind them shows from the fixed view)
	for zz in [-17.4, -19.9]:
		L.column(Vector3(-4.5, 1.0, zz), 4.2)
	L.stump(Vector3(-4.5, 1.0, -14.8), 0.75)
	L.stump(Vector3(-4.5, 1.0, -12.2), 0.6, true, 0.08)
	L.column(Vector3(-3.3, 1.0, -11.3), 4.2)
	L.stump(Vector3(3.3, 1.0, -11.3), 0.9)
	# a fallen column across the north-east corner hides the low tablet
	# (v0.6: the old stump here is gone: the hall keeps only its fallen block and the things the glass remembers)
	L.box(z, Vector3(2.7, 1.3, -19.9), Vector3(0.62, 0.62, 1.9), 0.25, false, Basis(Vector3.UP, 1.2))
	L.ob_rect(R(1.95, -20.4, 3.4, -19.4))
	L.box(z, Vector3(4.35, 1.35, -19.9), Vector3(0.36, 0.7, 0.9), 0.25, false)
	L.rubble(Vector3(-3.5, 1.0, -19.6), 0.7, 6)
	L.rubble(Vector3(4.05, 1.0, -11.95), 0.3, 4)       # (v0.7: into the corner, off the hall's cells)

## W.5 Where Her Shadow Fell (v1 ch1_geo._gallery)
static func _gallery(L: LvOff) -> void:
	var z := "GL"
	# (the Court of Light stands above to the north-east, its floor at 2 m from z -17: the chamber keeps
	# south of it; only the way in from the Hall's door runs on under the court's west edge)
	L.slab(z, R(5.0, -16.9, 10.0, -9.6), 1.0, 0.7, 0.0)
	L.walk(R(5.0, -16.9, 10.0, -9.6), 1.0, NAN, -1, "GL")
	L.slab(z, R(5.0, -18.4, 7.0, -16.9), 1.0, 0.7, 0.0)
	L.walk(R(5.0, -18.4, 6.9, -16.85), 1.0, NAN, -1, "GL")
	# the far walls: the court's foundation (north-east) and the way in's end wall
	L.ob_rect(R(6.95, -18.45, 10.35, -16.9))
	L.wall(z, R(5.0, -18.7, 7.0, -18.4), 1.0, 4.4, true)          # (v0.9.1: from the Hall's wall, not into it: their faces were coplanar at the Hall's east door)
	L.ob_rect(R(4.6, -18.75, 7.05, -18.4))
	# the near walls: low parapets (east and south), so the floor and her shadows read
	L.wall(z, R(10.0, -16.9, 10.3, -9.3), 1.0, 2.05, true)
	L.ob_rect(R(10.0, -16.9, 10.35, -9.3))
	L.wall(z, R(5.0, -9.6, 7.4, -9.3), 1.0, 2.05, true)
	L.wall(z, R(8.8, -9.6, 10.3, -9.3), 1.0, 2.05, true)
	L.ob_rect(R(4.6, -9.6, 7.4, -9.25))
	L.ob_rect(R(8.8, -9.6, 10.35, -9.25))
	# the true way on (v0.9: south, toward the Sunken Colossus): a gate in the south parapet between two
	# newel posts, a stretch of parapet in it that is not there (seen through the shard)
	for gx in [7.3, 8.9]:
		L.box(z, Vector3(gx, 1.7, -9.45), Vector3(0.36, 1.4, 0.36), 0.25, true)
		L.box(z, Vector3(gx, 2.46, -9.45), Vector3(0.46, 0.12, 0.46), 0.25, true)
	L.wall("GLs", R(7.4, -9.6, 8.8, -9.3), 1.0, 2.05, true)
	L.ob_rect(R(7.4, -9.65, 8.8, -9.25), "gallery_secret")
	# the threshold out
	L.slab(z, R(7.4, -9.7, 8.8, -9.2), 1.0, 0.7, 0.0)
	L.walk(R(7.45, -9.7, 8.75, -9.2), 1.0, NAN, -1, "GL")

# ============================================================================================ NORTH: the Garden wing
## N.2 the Turned Ones (v1 level._garden: the garden of the veiled)
static func _garden(L: LvOff) -> void:
	var z := "G"
	# (v0.8.1: the shadow chamber takes the garden's north-west corner, x 5..10.3, z -18.4..-9.3)
	L.slab(z, R(10.3, -15, 17, -5), 1.0, 0.8, 0.0)
	L.walk(R(10.3, -15, 17, -5), 1.0, NAN, -1, "G")
	# v0.5: the Turned Ones' great mirror stands on the north edge (the glass is a puzzle object)
	L.wall("Gn", R(10.3, -15.6, 15.3, -15.05), 1.0, 5.9, false)
	# (v0.9.1: the frame is its own mesh, seen by the main camera only: its rails, proud of the glass,
	# showed in the planar reflection as a dark bar across the reflected runes)
	L.box("Gframe", Vector3(10.45, 3.35, -14.95), Vector3(0.32, 4.7, 0.32), 1.0, true)
	L.box("Gframe", Vector3(15.15, 3.35, -14.95), Vector3(0.32, 4.7, 0.32), 1.0, true)
	L.box("Gframe", Vector3(12.8, 5.6, -14.95), Vector3(5.0, 0.3, 0.34), 1.0, true)
	L.box("Gframe", Vector3(12.8, 1.06, -14.95), Vector3(4.7, 0.12, 0.3), 1.0, false)
	L.ob_rect(R(10.3, -15.3, 15.4, -14.75))
	L.wall(z, R(15.3, -15.3, 17, -14.95), 1.0, 2.0, true)
	# the door east, to the Hollow Walk (its leaves are puzzle objects)
	L.box(z, Vector3(16.95, 2.75, -12.85), Vector3(0.5, 3.5, 0.5), 0.25, true)
	L.box(z, Vector3(16.95, 2.75, -10.75), Vector3(0.5, 3.5, 0.5), 0.25, true)
	L.box(z, Vector3(16.95, 4.7, -11.8), Vector3(0.6, 0.45, 2.7), 0.25, true)
	# dead trees
	L.tree(z, Vector3(11.4, 1.0, -8.1), 11)
	# (v2: no west court any more: the garden's west edge is a rail; you come up from the Flooded Colonnade, south)
	L.balustrade(z, Vector2(10.35, -14.7), Vector2(10.35, -5.1), 1.0)
	L.tree(z, Vector3(14.4, 1.0, -9.6), 23)
	# (v1.0, the overlap audit: a third dead tree here grew into the door's post and leaves; nowhere near
	# could take it without standing in the way up from the colossus: two keep the garden)
	# veiled statues without runes (the rune statues are placed by the puzzle)
	L.statue(z, Vector3(12.2, 1.0, -5.7), PI, 0.85)
	# (v0.9: the south-east corner is the way up from the colossus' stones: its stump stands drowned in the
	# water beside them now, its rubble along the east rail)
	L.rubble(Vector3(16.6, 1.0, -6.0), 0.25, 5)
	L.rubble(Vector3(11.0, 1.0, -9.0), 0.3, 4)
	# (v1.0: her small glass stands here, on the rail's line: it is the rail here)
	L.balustrade(z, Vector2(16.95, -10.4), Vector2(16.95, -5.2), 1.0)
	L.balustrade(z, Vector2(10.4, -4.95), Vector2(12.3, -4.95), 1.0)          # (v2: the Flooded Colonnade comes up east of it)
	L.inscription("g_stele", Vector3(11.0, 1.0, -6.4), "White marble first. Then a thousand faces. Then glass.", 1.2,
		Transform3D(Basis(), Vector3(11.0, 1.62, -5.635)), Vector2(1.0, 0.9))
	L.box(z, Vector3(11.0, 1.55, -5.75), Vector3(1.15, 1.1, 0.22), 0.25)
	L.box(z, Vector3(11.0, 2.14, -5.75), Vector3(1.25, 0.08, 0.28), 0.25)
	L.ob_rect(R(10.5, -5.9, 11.5, -5.5))

## N.4 Our Steps (v1 ch1_geo._hollow_walk); the Wind Ramp up to the Court
static func _hollow_walk(L: LvOff) -> void:
	var z := "HW"
	L.slab(z, R(17.4, -15.0, 25.6, -6.0), 1.0, 0.8, 0.0)
	L.walk(R(17.5, -15.0, 25.45, -6.0), 1.0, NAN, -1, "HW")
	# "Our Steps" (v1.1d): a floor of 4 x 3 slabs on the view's diagonal (OurSteps.U / V) before a tall planar
	# MIRROR straight across the screen; her room is only in the glass (our_steps.gd builds the glass and her twins)
	L.wall(z, R(17.3, -6.12, 25.5, -5.82), 1.0, 1.9, true)
	L.wall(z, R(19.6, -15.25, 25.5, -15.0), 1.0, 2.2, true)
	L.wall(z, R(25.5, -15.25, 25.8, -5.82), 1.0, 2.2, true)
	# the doorway from the garden (its door is a puzzle object in the garden)
	L.slab(z, R(16.8, -12.6, 17.4, -11.0), 1.0, 0.6, 0.0)      # (v1.0: up to the room's floor, not over it: their tops were coplanar)
	L.walk(R(16.8, -12.5, 17.6, -11.1), 1.0, NAN, -1, "g_door", false)
	var __s0 := L.lv.rng.state
	var B := Basis(Vector3.UP, -PI * 0.25)          # (local x along the glass, local z away from it)
	var T := OurSteps.TILE
	var ev := OurSteps.EDGE_V
	var gh := OurSteps.GLASS_HALF
	var hw := T * OurSteps.C * 0.5 + 0.12          # (the rails' half width along the glass)
	# the slabs (proud of the floor, a seam between them)
	for c in OurSteps.C:
		for r in OurSteps.R:
			L.mb(z).tag = "floor"
			L.lv.box(z, OurSteps.tile(Vector2i(c, r)) + Vector3(0, 0.016 - 0.2, 0), Vector3(T - 0.06, 0.4, T - 0.06), 0.25, false, B)
			L.mb(z).tag = ""
	# rails round your floor: its near edge (but at the entry slab) and both ends, up to the glass
	var rail := func(a: Vector2, b: Vector2, low := false) -> void:
		var pa := OurSteps.at(a.x, a.y)
		var pb := OurSteps.at(b.x, b.y)
		if low:
			# (v1.0) the near edge, toward the camera: a low kerb, so it never hides the slabs behind it
			var mc := (pa + pb) * 0.5
			L.lv.box(z, Vector3(mc.x, 1.11, mc.z), Vector3(pa.distance_to(pb), 0.22, 0.24), 0.25, false, B)
		else:
			var ns := int(ceil(pa.distance_to(pb) / 2.0))        # (short runs: a rail here is never broken: no false way out)
			for k in ns:
				var qa := pa.lerp(pb, float(k) / ns)
				var qb := pa.lerp(pb, float(k + 1) / ns)
				L.lv.balustrade(z, Vector2(qa.x, qa.z), Vector2(qb.x, qb.z), 1.0)
		var n := int(ceil(pa.distance_to(pb) / 0.25))
		for i in n + 1:
			var q := pa.lerp(pb, float(i) / float(n))
			L.lv.ob_circle(Vector2(q.x, q.z), 0.14)
	var rv := ev - 0.12
	rail.call(Vector2(-hw, rv), Vector2(-T * 0.5 - 0.06, rv), true)
	rail.call(Vector2(T * 0.5 + 0.06, rv), Vector2(hw, rv), true)
	rail.call(Vector2(-hw, rv), Vector2(-hw, -0.25))
	rail.call(Vector2(hw, rv), Vector2(hw, -0.25))
	# the mirror's frame (the glass itself is a chapter object: our_steps.gd): two posts, a sill and a
	# cornice; nothing passes it, and a short wall seals its west end to the room's south wall
	for u in [-gh - 0.14, gh + 0.14]:
		L.lv.box(z, OurSteps.at(u, 0.0) + Vector3(0, (OurSteps.GLASS_H + 0.1) * 0.5, 0), Vector3(0.26, OurSteps.GLASS_H + 0.1, 0.3), 0.25, true, B)
	L.lv.box(z, OurSteps.at(0.0, 0.0) + Vector3(0, 0.05, 0), Vector3(2.0 * gh + 0.02, 0.1, 0.24), 0.25, false, B)
	L.lv.box(z, OurSteps.at(0.0, 0.0) + Vector3(0, OurSteps.GLASS_H + 0.2, 0), Vector3(2.0 * gh + 0.56, 0.2, 0.34), 0.25, true, B)
	for i in 27:
		var q := OurSteps.at(lerpf(-gh - 0.1, gh + 0.1, i / 26.0), 0.05)
		L.lv.ob_circle(Vector2(q.x, q.z), 0.18)
	var w0 := OurSteps.at(-gh - 0.28, 0.0)
	var wz := L.o.z - 15.0          # (v2: the room's south wall, in the world)
	var w1 := Vector3(w0.x - (wz - w0.z) * -1.0, 1.0, wz)          # (along -U down to the south wall)
	var mid := (w0 + w1) * 0.5
	L.lv.box(z, Vector3(mid.x, 1.0 + 1.1, mid.z), Vector3(0.24, 2.2, w0.distance_to(w1) - 0.12), 0.25, true, Basis(Vector3.UP, PI * 0.25))
	for i in 6:
		var q := w0.lerp(w1, i / 5.0)
		L.lv.ob_circle(Vector2(q.x, q.z), 0.2)
	# (v1.1d: the same 55 draws from the level's rng in all as the v1.0 block: nothing built after it moves)
	var __r := RandomNumberGenerator.new()
	__r.state = __s0
	var __n := 0
	while __r.state != L.lv.rng.state and __n < 200:
		__r.randf(); __n += 1
	for i in maxi(0, 55 - __n): L.lv.rng.randf()
	# the exit: a gated ramp up to the Court of Light
	L.steps(z, R(17.5, -17.2, 19.5, -15.0), 1, 1.0, 2.0, false)
	L.walk(R(17.5, -17.2, 19.5, -15.0), 2.0, 1.0, 1, "HW_ramp")
	L.ob_rect(R(17.5, -15.3, 19.5, -15.0), "hw_gate")
	L.column(Vector3(17.3, 1.0, -15.15), 3.2, false)
	L.column(Vector3(19.7, 1.0, -15.15), 3.2, false)
	L.slab("L", R(15.4, -18.4, 19.5, -17.2), 2.0, 0.8, 0.0)
	L.walk(R(15.4, -18.4, 19.5, -17.2), 2.0, NAN, -1, "L_ramp")
	L.balustrade(z, Vector2(19.55, -15.3), Vector2(19.55, -17.1), 1.0)
	L.balustrade("L", Vector2(19.45, -17.3), Vector2(19.45, -18.3), 2.0)

## N.5 the Court of Light (v1 level._court)
static func _court(L: LvOff) -> void:
	var z := "L"
	L.slab(z, R(7, -27, 17, -17), 2.0, 0.9, 0.0)
	L.walk(R(7, -27, 17, -17), 2.0, NAN, -1, "L")
	# a low parapet round the court (the light stops there)
	L.balustrade(z, Vector2(7.1, -26.95), Vector2(9.3, -26.95), 2.0)
	L.balustrade(z, Vector2(14.7, -26.95), Vector2(16.9, -26.95), 2.0)
	L.balustrade(z, Vector2(7.05, -26.8), Vector2(7.05, -17.2), 2.0)
	L.balustrade(z, Vector2(7.2, -17.05), Vector2(15.2, -17.05), 2.0)
	# v0.6: the east edge is her GREAT GLASS (z -26.6..-21.5, the pane is a puzzle object) and, south of
	# it, the drawbridge's gap (z -21.4..-19.4)
	L.box(z, Vector3(16.98, 4.15, -26.68), Vector3(0.3, 4.3, 0.3), 1.0, true)
	L.box(z, Vector3(16.98, 4.15, -21.42), Vector3(0.3, 4.3, 0.3), 1.0, true)
	L.box(z, Vector3(16.98, 6.42, -24.05), Vector3(0.34, 0.3, 5.62), 1.0, true)
	L.box(z, Vector3(16.98, 2.06, -24.05), Vector3(0.3, 0.12, 5.4), 1.0, false)
	L.ob_rect(R(16.8, -26.85, 17.2, -21.25))
	L.balustrade(z, Vector2(16.95, -21.3), Vector2(16.95, -18.6), 2.0)          # (v2: no drawbridge: the High wing is its own)
	# v0.5: the mural wall (her half-erased portrait; its middle is a door) and the Mist Maze beyond
	# (v0.9: the mural's flanking walls low, so the way on and the Tree of Shards beyond them show)
	L.wall(z, R(9.3, -27.3, 10.9, -26.95), 2.0, 3.4, true)
	L.wall(z, R(13.1, -27.3, 14.7, -26.95), 2.0, 3.4, true)
	L.wall("Mural", R(10.9, -27.3, 13.1, -26.95), 2.0, 5.2, true)
	L.box(z, Vector3(12.0, 5.45, -27.12), Vector3(2.4, 0.5, 0.42), 0.25, true)
	L.ob_rect(R(9.3, -27.35, 10.9, -26.9))
	L.ob_rect(R(13.1, -27.35, 14.7, -26.9))
	L.ob_rect(R(10.9, -27.35, 13.1, -26.9), "mural_door")
	# great columns at the corners, one broken
	L.column(Vector3(7.6, 2.0, -26.4), 4.6)
	L.stump(Vector3(7.6, 2.0, -17.6), 1.6)
	L.rubble(Vector3(8.6, 2.0, -18.4), 0.6, 5)
	# (v0.9: on the far, north side, its face toward you: from the one fixed view a stele on the west edge
	# showed only its back)
	L.inscription("l_stele", Vector3(15.6, 2.0, -25.9), "Where our light ends, hers goes on.\nShe set her own glasses there, and waited.", 1.2,
		Transform3D(Basis(), Vector3(15.6, 2.62, -26.465)), Vector2(0.95, 1.0))
	L.box(z, Vector3(15.6, 2.6, -26.58), Vector3(1.1, 1.2, 0.22), 0.25)

## N.6 the Tree of Shards (v1 ch1_geo._tree_nook)
static func _tree_nook(L: LvOff) -> void:
	var z := "TS"
	L.slab(z, R(13.1, -28.9, 16.95, -27.3), 2.0, 0.8, 0.0)
	L.walk(R(13.1, -28.85, 16.9, -27.32), 2.0, NAN, -1, "TS")
	L.balustrade(z, Vector2(16.95, -28.8), Vector2(16.95, -27.4), 2.0)
	L.ob_rect(R(16.85, -28.9, 17.1, -27.3))
	L.lv.box(z, Ch1Geo.TS_TREE + Vector3(0, 0.12, 0), Vector3(1.5, 0.24, 1.5), 0.25)
	L.lv.box(z, Ch1Geo.TS_TREE + Vector3(0, 0.22, 0), Vector3(1.2, 0.2, 1.2), 1.0)
	L.lv.ob_circle(Vector2(Ch1Geo.TS_TREE.x, Ch1Geo.TS_TREE.z), 0.7)

## N.7 the Mist Maze and her pool (v1 ch1_geo._maze)
static func _maze(L: LvOff) -> void:
	var z := "MZ"
	# the doorway from the Court's mural wall, and a landing
	L.slab(z, R(10.9, -29.2, 13.1, -26.9), 2.0, 0.7, 0.0)
	L.walk(R(10.9, -29.2, 13.1, -26.9), 2.0, NAN, -1, "MZ_door", false)
	L.slab(z, R(9.0, -39.0, 17.0, -29.0), 2.0, 0.9, 0.0)
	L.walk(R(9.0, -39.0, 17.0, -29.0), 2.0, NAN, -1, "MZ")
	# the maze walls are invisible: obstacles along the closed edges between cells
	var open := {}
	for e in Ch1Geo.MZ_OPEN:
		open[Ch1Geo._edge_key(e[0], e[1])] = true
	for r in 5:
		for c in 4:
			var a := Vector2i(r, c)
			for nb in [Vector2i(r, c + 1), Vector2i(r + 1, c)]:
				if nb.x > 4 or nb.y > 3: continue
				if open.has(Ch1Geo._edge_key(a, nb)): continue
				var x0 := Ch1Geo.MZ_ORIGIN.x + c * 2.0
				var zt := Ch1Geo.MZ_ORIGIN.y - r * 2.0
				if nb.y == c + 1:       # wall on the east edge of (r, c)
					L.lv.ob_rect(R(x0 + 1.92, zt - 2.0, x0 + 2.08, zt), "mzw_%d_%d_e" % [r, c])
				else:                   # wall on the south edge
					L.lv.ob_rect(R(x0, zt - 2.08, x0 + 2.0, zt - 1.92), "mzw_%d_%d_s" % [r, c])
	# the rim of the maze, low and broken; the outer edge is the edge of the slab
	L.balustrade(z, Vector2(17.05, -29.1), Vector2(17.05, -38.9), 2.0)
	L.balustrade(z, Vector2(11.0, -39.05), Vector2(16.9, -39.05), 2.0)
	L.balustrade(z, Vector2(8.95, -29.1), Vector2(8.95, -38.9), 2.0)          # (v2: its west edge, where her pool was)
	for k in 6:
		L.stump(Vector3(9.4 + k * 1.45, 2.0, -29.25 - (k % 2) * 9.5), 0.5 + 0.3 * (k % 3), false)
	# (v2, the script: no pool of hers beside it: her steps show on the maze floor itself, in the lamp's light)

