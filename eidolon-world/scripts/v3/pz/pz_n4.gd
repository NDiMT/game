extends Puzzle
## N.4 "The Still Room" (CH1_V3 §3, the owner's chosen mirror puzzle): WHEN YOU ARE STILL, SHE IS FREE.
## A great glass fills the north wall (World3.mirrors["N4"]). Walk, and the crimson reflection copies you half a second
## late. Stop for one second in one of the three bays along the glass (W, C, E: mosaic rugs, low planters between) and
## a ring closes at your feet, her figure shimmers free of yours (ReflActor) and she does what you cannot: in HER world
## (only the glass shows it) she unties the cleat in that bay, and the bar its rope holds lifts.
##   Teach   bay C (you can only reach C at first): the bar across the antechamber pins its two glass-sealed gates
##   Test    bays W and E: two of the three bars on the exit door's reflection
##   Twist   the third cleat hangs HIGH in bay E: she reaches, can't, and shakes her oval at you. The stone block is real,
##           so it stands in both worlds: push it along its rail into bay E (tap = one slot), stop in E again, and she
##           climbs its reflection and unties it.
## The exit is a glass-sealed door on the east wall, beside the glass: it opens when its reflection shows it unbarred
## (I.1's law). No fail state, no grid, no counting; every bar latches; an action once begun always finishes (walk off
## and she finishes first, then comes back to you). Hint (45 s, again after each bar): she knocks twice in the bay.
## The camera looks down 36 deg: the glass shows the floor only ~3.4 m out, so everything of hers is within 2 m of it.
## A's look swaps these by name: N4_Cleat_*, N4_Rope_*, N4_Bar_*, N4_Block, N4_Gate_*, N4_DoorPane, N4_Rug_*, still_ring.

const Y := 1.0
const GZ := -35.71                       # the glass (World3: the N wall's middle + GLASS_OFF)
const BAYS := {"W": [6.0, 9.4], "C": [9.4, 12.6], "E": [12.6, 16.0]}
const STRIP := [-35.7, -32.75]           # the bays' depth: the glass to the low screen
const SCREEN_Z := -32.6
const PLANT_X := [9.4, 12.6]
const GATE_Z := [-35.78, -34.0]          # the side gates: the planters' line from the glass to the planters
const SLOTS := [7.9, 11.0, 14.5]         # the block's rail, one slot per bay
const RAIL_Z := -35.0
const BLOCK := Vector3(0.8, 0.6, 0.8)
const DOOR := Vector3(15.85, Y, -34.2)   # the exit's middle (E wall; Map3 link N4-IBN at -34.2)
const WALK_Z := -33.95                   # her lane in her world (south of the rail: the block never stands in it)
## the cleats (her world only): key -> [bay, the cleat, where she stands to untie it, the bar's height or -1 (the lintel)]
const CLEATS := {
	"c": ["C", Vector3(10.15, Y + 0.95, -35.6), Vector3(10.15, Y, -35.2), -1.0],
	"w": ["W", Vector3(6.85, Y + 0.95, -35.6), Vector3(6.85, Y, -35.2), Y + 0.5],
	"e": ["E", Vector3(13.25, Y + 0.95, -35.6), Vector3(13.25, Y, -35.2), Y + 1.1],
	"eh": ["E", Vector3(14.5, Y + 2.45, -35.64), Vector3(14.5, Y, -35.35), Y + 1.7],
}
const IRON := Color(0.11, 0.1, 0.1)
const HEMP := Color(0.52, 0.42, 0.3)

var actor: ReflActor
var glass: Reflector
var block: MeshInstance3D
var block_ob: Level.Obstacle
var slot := 0
var bars := {}                    # key -> Node3D (her world)
var ropes := {}                   # key -> Node3D (her world)
var cleats := {}                  # key -> Node3D (her world)
var side_gates: Array = []        # [Node3D leaf, obstacle name]
var rugs := {}                    # bay -> rune material
var pane: Node3D                  # the exit's glass seal (your world)
var ring_mat: ShaderMaterial
var ring: MeshInstance3D
var knock_mat: ShaderMaterial
var knock_mi: MeshInstance3D
var still_t := 0.0
var _fired := false
var _ring_k := 0.0
var _flash := 0.0
var _pop_t := 0.0
var _auto := -1
var _auto_t := 0.0

func build() -> void:
	hint_after = 45.0
	test_s = 80.0
	var lv := game.level
	var g := gate("N4", "IBN")
	g.mi.visible = false
	g.mi.set_meta("hide", true)
	var mb := MB.new()
	var stone := Color(0.5, 0.25, 0.0)
	# the low screen (0.9 m): it closes bays W and E from the room; C stands open (the antechamber)
	for seg in [[6.2, PLANT_X[0] - 0.27], [PLANT_X[1] + 0.27, 15.8]]:
		mb.box(Vector3((seg[0] + seg[1]) * 0.5, Y + 0.45, SCREEN_Z), Vector3(seg[1] - seg[0], 0.9, 0.24), stone)
		lv.ob_rect(Rect2(seg[0], SCREEN_Z - 0.14, seg[1] - seg[0], 0.28))
	# the two low planters between the bays (soil, a carved rim), the glass-sealed gates beyond them to the glass
	for x in PLANT_X:
		mb.box(Vector3(x, Y + 0.27, (SCREEN_Z + GATE_Z[1]) * 0.5 - 0.06), Vector3(0.48, 0.54, absf(SCREEN_Z - GATE_Z[1]) - 0.12), stone)
		mb.box(Vector3(x, Y + 0.555, (SCREEN_Z + GATE_Z[1]) * 0.5 - 0.06), Vector3(0.36, 0.03, absf(SCREEN_Z - GATE_Z[1]) - 0.24), Color(0.5, 1.0, 0.0))
		lv.ob_rect(Rect2(x - 0.26, GATE_Z[1] - 0.02, 0.52, SCREEN_Z - GATE_Z[1] + 0.16))
	# the exit's frame (the glass seal is its own node: it sinks)
	for dz in [-1.06, 1.06]:
		mb.box(Vector3(DOOR.x - 0.02, Y + 1.15, DOOR.z + dz), Vector3(0.3, 2.3, 0.12), Color(0.5, 0.5, 0.0))
	mb.box(Vector3(DOOR.x - 0.02, Y + 2.36, DOOR.z), Vector3(0.3, 0.14, 2.24), Color(0.5, 0.5, 0.0))
	Kit3.marble(game, mb.commit(), self).name = "N4_Fixtures"
	for i in 2:
		var x: float = PLANT_X[i]
		var nm: String = "n4_gate_" + ["W", "E"][i]
		lv.ob_rect(Rect2(x - 0.12, GATE_Z[0], 0.24, GATE_Z[1] - GATE_Z[0]), nm)
		side_gates.append([_gate_leaf(x, nm), nm])
	# the block: real stone, so it is in both worlds; it slides on its rail (tap = one slot)
	var bm := MB.new()
	bm.box(Vector3(0, BLOCK.y * 0.5, 0), BLOCK, Color(0.5, 0.5, 0.0))
	bm.box(Vector3(0, BLOCK.y + 0.01, 0), Vector3(BLOCK.x - 0.12, 0.02, BLOCK.z - 0.12), Color(0.5, 0.25, 0.0))
	block = Kit3.marble(game, bm.commit(), self)
	block.name = "N4_Block"
	block_ob = lv.ob_rect(Rect2(), "n4_block")
	_place_block(0, true)
	lv.add_interact("n4_block", Vector3(SLOTS[0], Y, RAIL_Z), "push", push, 1.25,
		func() -> bool: return not done and bool(state.get("c", false)))
	# the rail in the floor (a dark groove: the slots read as places)
	var rm := MB.new()
	rm.box(Vector3((SLOTS[0] + SLOTS[2]) * 0.5, Y + 0.004, RAIL_Z), Vector3(SLOTS[2] - SLOTS[0] + 0.9, 0.008, 0.12), Color(0.5, 1.0, 0.0))
	Kit3.marble(game, rm.commit(), self).name = "N4_Rail"

## a glass-sealed gate leaf (2.1 m) in the planters' line, from the glass to the planter
func _gate_leaf(x: float, nm: String) -> Node3D:
	var n := Node3D.new()
	n.name = "N4_Gate_" + nm.right(1)
	add_child(n)
	n.position = Vector3(x, Y, (GATE_Z[0] + GATE_Z[1]) * 0.5 + 0.03)
	var len := GATE_Z[1] - GATE_Z[0] - 0.1
	var m := MB.new()
	for dz in [-len * 0.5 + 0.05, len * 0.5 - 0.05]: m.box(Vector3(0, 1.05, dz), Vector3(0.12, 2.1, 0.1), Color(0.5, 0.9, 0.0))
	for yy in [0.06, 2.04]: m.box(Vector3(0, yy, 0), Vector3(0.12, 0.12, len - 0.2), Color(0.5, 0.9, 0.0))
	Kit3.marble(game, m.commit(), n)
	n.add_child(_pane(Vector2(len - 0.2, 1.86), Vector3(0, 1.05, 0), Basis(Vector3.UP, PI * 0.5)))
	return n

## a pane of old glass (your world): pale, a little milky
func _pane(size: Vector2, at: Vector3, basis: Basis) -> MeshInstance3D:
	var q := QuadMesh.new()
	q.size = size
	var mi := MeshInstance3D.new()
	mi.mesh = q
	var m := StandardMaterial3D.new()
	m.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	m.albedo_color = Color(0.78, 0.86, 0.9, 0.32)
	m.metallic = 0.3
	m.roughness = 0.08
	m.cull_mode = BaseMaterial3D.CULL_DISABLED
	mi.material_override = m
	mi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	mi.transform = Transform3D(basis, at)
	return mi

func post() -> void:
	glass = World3.mirrors.get("N4")
	actor = ReflActor.new(glass)
	actor.name = "N4_Actor"
	add_child(actor)
	# the exit's seal
	pane = Node3D.new()
	pane.name = "N4_DoorPane"
	add_child(pane)
	pane.position = DOOR
	pane.add_child(_pane(Vector2(2.0, 2.2), Vector3(0, 1.1, 0), Basis(Vector3.UP, PI * 0.5)))
	# HER world: the cleats, the ropes, the bars (the glass shows them; you never see them in the room)
	for k in CLEATS:
		var c: Array = CLEATS[k]
		var cp: Vector3 = c[1]
		var cn := _iron_node("N4_Cleat_" + k, cp)
		_box(cn, Vector3.ZERO, Vector3(0.34, 0.07, 0.07), IRON)
		_box(cn, Vector3(-0.13, 0.05, 0.03), Vector3(0.07, 0.07, 0.1), IRON)
		_box(cn, Vector3(0.13, 0.05, 0.03), Vector3(0.07, 0.07, 0.1), IRON)
		if k != "eh": _box(cn, Vector3(0, -(cp.y - Y) * 0.5, 0.0), Vector3(0.09, cp.y - Y, 0.09), Color(0.3, 0.28, 0.26))      # (its post)
		cleats[k] = cn
		var bn: Node3D
		var pts: Array
		if c[3] < 0.0:
			# the antechamber's bar: a beam across bay C from gate to gate, resting in their brackets
			bn = _iron_node("N4_Bar_" + k, Vector3(11.0, Y + 1.95, RAIL_Z + 0.02))
			_box(bn, Vector3.ZERO, Vector3(PLANT_X[1] - PLANT_X[0] + 0.3, 0.1, 0.1), IRON)
			for bx in [-1.45, 1.45]: _box(bn, Vector3(bx, -0.08, 0), Vector3(0.16, 0.06, 0.16), IRON)
			pts = [cp + Vector3(0.1, 0.04, 0.02), Vector3(10.7, Y + 1.95, RAIL_Z + 0.02)]
		else:
			# a bar across the exit's reflection, in brackets on its jambs
			bn = _iron_node("N4_Bar_" + k, Vector3(DOOR.x - 0.12, c[3], DOOR.z))
			_box(bn, Vector3.ZERO, Vector3(0.09, 0.09, 2.3), IRON)
			for bz in [-1.08, 1.08]: _box(bn, Vector3(0.02, 0, bz), Vector3(0.14, 0.16, 0.1), IRON)
			var top := Y + 3.05 + (0.08 if k == "e" else 0.0) + (0.16 if k == "eh" else 0.0)
			pts = [cp + Vector3(0.12, 0.04, 0.02), Vector3(cp.x + 0.12, top, GZ + 0.1), Vector3(15.68, top, GZ + 0.1),
				Vector3(15.72, c[3] + 0.06, DOOR.z - 1.0)]
		bars[k] = bn
		ropes[k] = _rope("N4_Rope_" + k, pts)
	for n in bars.values() + ropes.values() + cleats.values(): TwoWorld.set_her(n)
	# the bays' mosaic rugs (they glow when their bay is done)
	for b in BAYS:
		var r: Array = BAYS[b]
		var rug := Kit3.rune(self, Vector3((r[0] + r[1]) * 0.5, Y + 0.012, -33.55), Vector2(2.0, 2.0), Basis(Vector3.RIGHT, -PI * 0.5), 4.0, 0.12)
		rugs[b] = rug
	# the stillness ring at her feet (placeholder: A's "still_ring" fx)
	ring_mat = ShaderMaterial.new()
	ring_mat.shader = _ring_shader()
	var pm := PlaneMesh.new()
	pm.size = Vector2(1.6, 1.6)
	ring = MeshInstance3D.new()
	ring.name = "still_ring"
	ring.mesh = pm
	ring.material_override = ring_mat
	ring.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	ring.layers = TwoWorld.MINE
	ring.visible = false
	add_child(ring)
	knock_mat = Kit3.glow(self, Vector3(11.0, Y + 1.3, GZ + 0.06), 1.1, Palette.HER, 0.0)
	knock_mi = get_child(get_child_count() - 1)
	knock_mi.name = "N4_Knock"
	StillRoomFx.dress_n4(self, game)          # (A's look: swaps the placeholders above by name)

static var _rs: Shader
static func _ring_shader() -> Shader:
	if _rs: return _rs
	_rs = Shader.new()
	_rs.code = """shader_type spatial;
render_mode unshaded, blend_mix, depth_draw_never, cull_disabled, shadows_disabled, fog_disabled;
uniform float k = 0.0;
uniform float flash = 0.0;
uniform vec4 col : source_color = vec4(0.86, 0.1, 0.16, 1.0);
void fragment() {
	float r = length(UV * 2.0 - 1.0);
	float R = mix(0.98, 0.34, k);
	float w = 0.035 + 0.05 * k + 0.12 * flash;
	float a = smoothstep(w, 0.0, abs(r - R)) * (0.2 + 0.8 * k);
	a += flash * 0.35 * smoothstep(0.5, 0.0, r);
	ALBEDO = col.rgb;
	ALPHA = clamp(a, 0.0, 1.0) * col.a;
}"""
	return _rs

func _iron_node(nm: String, at: Vector3) -> Node3D:
	var n := Node3D.new()
	n.name = nm
	n.position = at
	add_child(n)
	return n

func _box(parent: Node3D, at: Vector3, size: Vector3, col: Color) -> void:
	var bm := BoxMesh.new()
	bm.size = size
	var mi := MeshInstance3D.new()
	mi.mesh = bm
	var m := StandardMaterial3D.new()
	m.albedo_color = col
	m.metallic = 0.5 if col == IRON else 0.0
	m.roughness = 0.5
	mi.material_override = m
	mi.position = at
	mi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	parent.add_child(mi)

## a rope through points (thin cylinders), sagging a little between them
func _rope(nm: String, pts: Array) -> Node3D:
	var n := Node3D.new()
	n.name = nm
	add_child(n)
	var m := StandardMaterial3D.new()
	m.albedo_color = HEMP
	m.roughness = 0.9
	for i in pts.size() - 1:
		var a: Vector3 = pts[i]
		var b: Vector3 = pts[i + 1]
		var cm := CylinderMesh.new()
		cm.top_radius = 0.018
		cm.bottom_radius = 0.018
		cm.height = a.distance_to(b)
		cm.radial_segments = 5
		cm.rings = 1
		var mi := MeshInstance3D.new()
		mi.mesh = cm
		mi.material_override = m
		mi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
		var d := (b - a).normalized()
		var x := d.cross(Vector3.FORWARD if absf(d.z) < 0.9 else Vector3.RIGHT).normalized()
		mi.transform = Transform3D(Basis(x, d, x.cross(d)), (a + b) * 0.5)
		n.add_child(mi)
	return n

# ------------------------------------------------------------------ the rule: still for 1 s in a bay -> she acts there
func bay_at(p: Vector3) -> String:
	if p.z < STRIP[0] or p.z > STRIP[1]: return ""
	for b in BAYS:
		if p.x >= BAYS[b][0] and p.x < BAYS[b][1]: return b
	return ""

## what she would do in a bay now
func tasks(b: String) -> Array:
	var c := bool(state.get("c", false))
	match b:
		"C": return [] if c else ["c"]
		"W": return ["w"] if c and not state.get("w", false) else []
		"E":
			if not c: return []
			var out: Array = []
			if not state.get("e", false): out.append("e")
			if not state.get("eh", false): out.append("eh")
			return out
	return []

func tick(dt: float) -> void:
	if not glass: return
	var p := game.player.position
	_tick_auto(dt)
	var acting: bool = game.get("_acting")
	var b := bay_at(p)
	var can := not done and here() and game.mode == "play" and not acting and game.auto_target == Vector3.INF \
		and not actor.busy() and b != "" and not tasks(b).is_empty()
	if can and game.player.speed01 < 0.05: still_t += dt
	else:
		still_t = 0.0
		_fired = false
	# the ring: it closes over the second; it pops when she breaks free (A's ring_pop), and fades if you move on
	if _pop_t > 0.0:
		_pop_t -= dt
		if _pop_t <= 0.0: ring.visible = false
	else:
		_ring(dt, p)
	if still_t >= 1.0 and not _fired:
		_fired = true
		_free_her(b, p)

func _ring(dt: float, p: Vector3) -> void:
	var want := clampf((still_t - 0.15) / 0.85, 0.0, 1.0)
	if _fired: want = 0.0
	_ring_k = want if want > _ring_k else move_toward(_ring_k, want, dt * 3.0)
	ring.visible = _ring_k > 0.01 or _flash > 0.01
	if ring.visible:
		ring.global_position = Vector3(p.x, p.y + 0.02, p.z)
		ring_mat.set_shader_parameter("k", _ring_k)

## she breaks off your reflection where you stand and goes about the bay's work; then she comes back to you
func _free_her(b: String, p0: Vector3) -> void:
	var list := tasks(b)
	progress()
	_ring_k = 0.0
	_pop_t = 0.9
	ring.global_position = Vector3(p0.x, p0.y + 0.02, p0.z)
	StillRoomFx.ring_pop(ring)
	StillRoomFx.detach(self, glass.clip_c, glass.plane_n, p0, game.world.cam)
	if game.sfx:
		game.sfx.play("glass", -16.0, 1.35)
		game.sfx.play_later("chime", 0.15, -22.0, 1.6)
	if game.juice: game.juice.glint(p0 + Vector3(0, 1.1, 0))
	var home := Vector3(p0.x, Y, p0.z)
	actor.detach()
	var lane := Vector3(home.x, Y, maxf(home.z, WALK_Z))
	for k in list:
		var c: Array = CLEATS[k]
		var stand: Vector3 = c[2]
		if k == "eh" and slot == 2:
			# the twist: she climbs the block's reflection and reaches the high cleat
			actor.go([lane, Vector3(SLOTS[2], Y, WALK_Z), Vector3(SLOTS[2], Y, RAIL_Z + 0.62), Vector3(SLOTS[2], Y + BLOCK.y, RAIL_Z)])
			actor.call_back(func() -> void: StillRoomFx.untie(cleats[k], 2.6, ropes[k]))
			actor.act("reach_high", 2.6, func() -> void: _untie(k), 0.72)
			actor.go([Vector3(SLOTS[2], Y, RAIL_Z + 0.62), Vector3(SLOTS[2], Y, WALK_Z)])
			lane = Vector3(SLOTS[2], Y, WALK_Z)
		elif k == "eh":
			# she reaches up, can't, and shakes her oval at you
			actor.go([lane, Vector3(stand.x, Y, WALK_Z), stand])
			actor.act("reach_fail_shake", 2.8, func() -> void: _fail_high(), 0.5)
			actor.act("look_at_you", 0.9)
			actor.go([Vector3(stand.x, Y, WALK_Z)])
			lane = Vector3(stand.x, Y, WALK_Z)
		else:
			actor.go([lane, Vector3(stand.x, Y, WALK_Z), stand])
			actor.call_back(func() -> void: StillRoomFx.untie(cleats[k], 2.5, ropes[k]))
			actor.act("untie_cleat", 2.5, func() -> void: _untie(k), 0.72)
			actor.go([Vector3(stand.x, Y, WALK_Z)])
			lane = Vector3(stand.x, Y, WALK_Z)
	actor.go([Vector3(home.x, Y, maxf(home.z, WALK_Z)), home])
	actor.rejoin()

func _fail_high() -> void:
	if game.sfx: game.sfx.play("glass_tink", -22.0, 0.75)
	state["tried_high"] = true

## the knot gives: the rope falls slack, the bar lifts in the glass (muffled, through it)
func _untie(k: String) -> void:
	if state.get(k, false): return
	state[k] = true
	hint_given = false
	progress()
	if game.sfx:
		game.sfx.play("rattle", -19.0, 0.72)
		game.sfx.play_later("creak", 0.35, -17.0, 0.8)
		game.sfx.play_later("click", 0.9, -15.0, 0.9)
	_lift(k, false)
	var bay: String = CLEATS[k][0]
	if tasks(bay).is_empty(): _rug(bay, false)
	if k == "c":
		_open_side_gates(false)
	elif game.juice:
		game.juice.glint(DOOR + Vector3(-0.2, 1.3, 0))          # (the real door hears its reflection)
	if state.get("w", false) and state.get("e", false) and state.get("eh", false): get_tree().create_timer(1.3).timeout.connect(func() -> void: solve())

## the bar (A's timber bar) lifts in its brackets and stays up; the rope ran off with the untie (StillRoomFx.untie)
func _lift(k: String, snap: bool) -> void:
	if snap:
		StillRoomFx.set_lifted(bars[k], true)
		StillRoomFx.set_untied(cleats[k], ropes[k])
		return
	StillRoomFx.lift(bars[k], 1.1, 0.9)

## (a reset / load) bound again: the bar down, the wraps on, the rope back
func _bind(k: String) -> void:
	StillRoomFx.set_lifted(bars[k], false)
	var cm: Variant = (cleats[k] as Node3D).get_meta("mat", null)
	if cm is ShaderMaterial: (cm as ShaderMaterial).set_shader_parameter("unwrap", 0.0)
	var rm: Variant = (ropes[k] as Node3D).get_meta("rope_mat", null)
	if rm is ShaderMaterial: (rm as ShaderMaterial).set_shader_parameter("rope_gone", 0.0)

func _rug(b: String, snap: bool) -> void:
	var m: ShaderMaterial = rugs[b]
	if snap:
		m.set_shader_parameter("lit", 1.0)
		return
	var tw := create_tween()
	tw.tween_method(func(v: float) -> void: m.set_shader_parameter("lit", v), 0.12, 1.0, 1.2)

func _open_side_gates(snap: bool) -> void:
	for sg in side_gates:
		var n: Node3D = sg[0]
		game.level.set_enabled(sg[1], false)
		if snap:
			n.visible = false
			continue
		var tw := n.create_tween()
		tw.tween_interval(0.8)
		tw.tween_property(n, "position:y", Y - 2.2, 1.6).set_trans(Tween.TRANS_SINE).set_ease(Tween.EASE_IN)
		tw.tween_callback(func() -> void: n.visible = false)
		if game.juice: game.juice.dust_floor(n.position, 0.6, 10)
	if not snap and game.sfx: game.sfx.play_later("door", 0.8, -12.0, 1.1)

# ------------------------------------------------------------------ the block
func push() -> void:
	if done: return
	var dir := 1 if game.player.position.x < block.position.x else -1
	var to := slot + dir
	game.call("perform", "push", block.position + Vector3(0, 0.4, 0), func() -> void:
		if to < 0 or to >= SLOTS.size():
			if game.sfx: game.sfx.play("hollow", -16.0, 0.8)          # (the rail's end: it does not move)
			return
		_place_block(to, false))

func _place_block(i: int, snap: bool) -> void:
	slot = i
	state["slot"] = i
	var to := Vector3(SLOTS[i], Y, RAIL_Z)
	block_ob.r = Rect2(to.x - BLOCK.x * 0.5 - 0.05, GZ, BLOCK.x + 0.1, RAIL_Z + BLOCK.z * 0.5 + 0.05 - GZ)     # (to the glass: no one stands behind it)
	var it: Level.Interact = null
	for x in game.level.interacts:
		if x.id == "n4_block": it = x
	if it: it.pos = to
	if snap:
		block.position = to
		return
	progress()
	StillRoomFx.push(block, to, 0.9)
	if game.sfx: game.sfx.play("grind", -12.0, 0.9)
	if game.juice: game.juice.grit(to + Vector3(0, 0.05, 0), 0.45)

# ------------------------------------------------------------------ contract
func apply() -> void:
	super.apply()
	if actor: actor.stop()
	still_t = 0.0
	_fired = false
	_auto = -1
	for k in CLEATS:
		if not bars.has(k): continue
		if state.get(k, false): _lift(k, true)
		else: _bind(k)
	for b in rugs: rugs[b].set_shader_parameter("lit", 0.12)
	if state.get("c", false): _rug("C", true)
	if state.get("w", false): _rug("W", true)
	if state.get("e", false) and state.get("eh", false): _rug("E", true)
	var c_open := bool(state.get("c", false))
	for sg in side_gates:
		game.level.set_enabled(sg[1], not c_open)
		(sg[0] as Node3D).visible = not c_open
		(sg[0] as Node3D).position.y = Y
	_place_block(int(state.get("slot", 0)), true)

func on_solved() -> void:
	if not state.get("c", false): _open_side_gates(true)
	for k in CLEATS: state[k] = true
	if game.juice:
		game.juice.dust_floor(DOOR, 0.8, 14)
		game.juice.glint(DOOR + Vector3(-0.2, 1.4, 0))
	if game.sfx: game.sfx.play("door", -10.0, 1.0)

## the exit's seal sinks with the gate
func update(dt: float) -> void:
	super.update(dt)
	if pane and gates.size() > 0:
		var g: Puzzle.Gate = gates[0]
		pane.position.y = DOOR.y - Cinematic.ease_k(g.k, 1) * 2.3
		pane.visible = g.k < 0.999

## she knocks twice on the glass in the bay to try (the block's slot, if that is what is missing)
func hint() -> void:
	var b := "C"
	if state.get("c", false):
		if not state.get("w", false): b = "W"
		else: b = "E"
	var x: float = (BAYS[b][0] + BAYS[b][1]) * 0.5
	knock_mi.position.x = x
	var tw := create_tween()
	for i in 2:
		tw.tween_method(func(v: float) -> void: knock_mat.set_shader_parameter("intensity", v), 0.0, 0.9, 0.12)
		tw.tween_method(func(v: float) -> void: knock_mat.set_shader_parameter("intensity", v), 0.9, 0.0, 0.3)
	if game.sfx:
		game.sfx.play("glass_tink", -12.0, 1.0)
		game.sfx.play_later("glass_tink", 0.42, -12.0, 1.0)
	if b == "E" and state.get("e", false) and slot != 2 and state.get("tried_high", false) and game.juice:
		game.juice.glint(block.position + Vector3(0, 0.8, 0))
	# her knuckles too, when she is free to (only the glass shows her)
	if not actor.busy() and glass.active:
		var at := Vector3(x, Y, GZ + 0.45)
		var home := game.player.position
		actor.detach()
		actor.go([Vector3(home.x, Y, maxf(home.z, WALK_Z)), Vector3(x, Y, WALK_Z), at])
		actor.act("knock_glass_twice", 1.4)
		actor.go([Vector3(x, Y, WALK_Z), Vector3(home.x, Y, maxf(home.z, WALK_Z)), Vector3(home.x, Y, home.z)])
		actor.rejoin()

## as a player would: stand still in C; then in W; push the block twice (into E); stand still in E
const AUTO := [["walk", 11.0, -33.6], ["state", "c"], ["walk", 9.9, -35.0], ["walk", 8.85, -35.0], ["walk", 8.85, -33.6],
	["walk", 7.3, -33.6], ["state", "w"], ["walk", 7.0, -35.0], ["interact"], ["slot", 1], ["walk", 8.9, -33.9],
	["walk", 9.95, -35.0], ["interact"], ["slot", 2], ["walk", 12.0, -34.95], ["walk", 13.3, -34.95], ["walk", 13.3, -33.5], ["state", "eh"]]

func autosolve() -> void:
	_auto = 0
	_auto_t = 0.0

func _tick_auto(dt: float) -> void:
	if _auto < 0 or done or _auto >= AUTO.size(): return
	_auto_t += dt
	var idle: bool = game.auto_target == Vector3.INF and not actor.busy() and not game.get("_acting")
	if not idle or _auto_t < 0.4: return
	var a: Array = AUTO[_auto]
	match a[0]:
		"walk": game.cmd("walk:%f:%f" % [a[1], a[2]])
		"interact": game.try_interact()
		"state": if not state.get(a[1], false): return
		"slot": if slot != a[1]: return
	_auto += 1
	_auto_t = 0.0
