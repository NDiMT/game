class_name Puzzles
extends Node3D
## Puzzle objects and their state:
##   a) RUNE DOOR    three dials in front of the garden door cycle the rune in each slot.
##                   Solution = the runes shown by the statues numbered I, II, III: KYKLOS, EIDOS, TRIGONON.
##   b) LIGHT        a crystal's beam; three mirror stands turn 45 degrees per touch. Light the far
##                   crystal and the drawbridge to the Eidolon ledge falls.
##   c) EIDOLON PLATE  the plate across the gap can only be pressed by your reflection in the great glass.
##   + the shortcut gate (opens only from the far side) and the shrine.

signal event(name: String, data: Variant)

const RUNE_NAMES := ["EIDOS", "MEANDROS", "KATOPTRON", "KYKLOS", "TRIGONON", "TETRAKTYS"]
const DOOR_SOLUTION := [3, 0, 4]
const MIRROR_SOLUTION := [3, 3, 1, 1]
const DIAL_X0 := 10.6
const DIAL_DX := 1.4
const DIAL_Z := -12.9
const PLATE_POS := Vector3(23.6, 2.0, -29.6)
const GLASS_Z := -24.97
const SHRINE_C := Vector3(25.0, 2.0, -32.6)
const TABLET_POS := Vector3(4.35, 1.5, -19.9)

var level: Level
var game: Node
var state := {}
var rune_mat_shader: Shader
var door: Node3D
var door_mat: ShaderMaterial
var slot_mats: Array[ShaderMaterial] = []
var dial_mats: Array[ShaderMaterial] = []
var statue_mats: Array[ShaderMaterial] = []
var statue_pos: Array[Vector3] = []
var gate_bars: Node3D
var source_crystal: MeshInstance3D
var target_crystal: MeshInstance3D
var target_mat: StandardMaterial3D
var target_halo: ShaderMaterial
var mirrors: Array[Node3D] = []
var mirror_angles: Array[float] = []
var beam_segs: Array[MeshInstance3D] = []
var beam_glows: Array[MeshInstance3D] = []
var beam_floor: Array[MeshInstance3D] = []     # v0.4: glow strips on the floor under each segment
var beam_pools: Array[MeshInstance3D] = []     # ...and pools of light where it strikes
var beam_lit := false
var beam_points: Array[Vector3] = []
var drawbridge: Node3D
var eid_glass_mat: ShaderMaterial
var ghost_path_mat: ShaderMaterial
var plate_mat: ShaderMaterial
var plate_charge := 0.0
var plate_ring: ShaderMaterial
var plate_pillar: ShaderMaterial
var plate_halo: ShaderMaterial
var plate_motes: Array[MeshInstance3D] = []
var foot_spot := Vector3.ZERO
var foot_mat: ShaderMaterial
var near_mat: ShaderMaterial
var guide: MeshInstance3D
var guide_mat: ShaderMaterial
var ledge_time := 0.0
var foot_spot_dist := 99.0
var risen_bridge: MeshInstance3D
var risen_mat: ShaderMaterial
var shrine_crystal: MeshInstance3D
var shrine_crystal_mat: StandardMaterial3D
var shrine_halo: ShaderMaterial
var shrine_ring: ShaderMaterial
var shrine_light: OmniLight3D
var shrine_pillar: ShaderMaterial
var far_pillar: ShaderMaterial
var tablet_mat: ShaderMaterial
var reflectors: Array[Reflector] = []
var eidolon_refl: Reflector
var hall_mirror: Reflector
var pool_refl: Reflector
var water_mat: ShaderMaterial
var water_over_mat: ShaderMaterial
var busy := false
var crystal_lift := 0.0          # v0.5: the cinematic lifts the crystal out of the shot
var _t := 0.0

func _init(lv: Level, g: Node) -> void:
	level = lv
	game = g
	rune_mat_shader = preload("res://shaders/rune_face.gdshader")
	reset_state()

func reset_state() -> void:
	state = {"door": [0, 0, 0], "door_open": false, "mirrors": MIRROR_START.duplicate(), "bridge": false,
		"plate": false, "shrine": false, "shortcut": false, "tablet": false, "drawbridge": false}

func build() -> void:
	_pool()

	_gate()
	_light_court()
	_eidolon_glass()
	_shrine()
	_tablet()
	_reflectors()

# ------------------------------------------------------------------ helpers
func rune_quad(parent: Node3D, pos: Vector3, size: Vector2, basis: Basis, design: float, lit: float, numeral := 0.0) -> ShaderMaterial:
	var m := ShaderMaterial.new()
	m.shader = rune_mat_shader
	m.set_shader_parameter("design", design)
	m.set_shader_parameter("lit", lit)
	m.set_shader_parameter("numeral", numeral)
	m.set_shader_parameter("on_floor", 1.0 if (basis * Vector3.BACK).y > 0.7 else 0.0)      # (v0.8.3)
	var q := QuadMesh.new()
	q.size = size
	var mi := MeshInstance3D.new()
	mi.mesh = q
	mi.material_override = m
	mi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	mi.transform = Transform3D(basis, pos)
	parent.add_child(mi)
	return m

func glow_quad(parent: Node3D, pos: Vector3, size: float, col: Color, intensity: float) -> ShaderMaterial:
	var m := ShaderMaterial.new()
	m.shader = preload("res://shaders/halo.gdshader")
	m.set_shader_parameter("color", col)
	m.set_shader_parameter("intensity", intensity)
	var q := QuadMesh.new()
	q.size = Vector2(size, size)
	var mi := MeshInstance3D.new()
	mi.mesh = q
	mi.material_override = m
	mi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	mi.position = pos
	parent.add_child(mi)
	return m

## v0.8.1: a small culled aqua light that follows a glow's intensity (and its pool on the floor, if given)
func aqua_light(parent: Node3D, pos: Vector3, glow: ShaderMaterial, range_m := 2.6, e := 0.4, pool_at := Vector3.INF, pool_size := 1.8) -> AquaLight:
	var al := AquaLight.new(range_m, e, pool_at, pool_size)
	al.position = pos
	al.follow = glow; al.follow_param = "intensity"; al.follow_scale = 1.4
	parent.add_child(al)
	return al

func marble_instance(mesh: Mesh, parent: Node3D, fade_y := -99.0) -> MeshInstance3D:
	var mi := MeshInstance3D.new()
	mi.mesh = mesh
	if fade_y > -98.0:
		var m: ShaderMaterial = level.marble_mat.duplicate()
		m.set_shader_parameter("fade_y", fade_y)
		mi.material_override = m
	else:
		# (v0.8: the parts that may hide the wanderer fade in the see-through rather than being cut)
		mi.mesh = MB.split_occ(mesh)
		for si in mi.mesh.get_surface_count():
			mi.set_surface_override_material(si, level.marble_occ_mat if mi.mesh.surface_get_name(si) == "occ" else level.marble_mat)
	parent.add_child(mi)
	return mi

func crystal_mesh(r: float, h: float) -> ArrayMesh:
	var st := SurfaceTool.new()
	st.begin(Mesh.PRIMITIVE_TRIANGLES)
	var top := Vector3(0, h, 0)
	var bot := Vector3(0, -h, 0)
	var ring := []
	for i in 6: ring.append(Vector3(cos(TAU * i / 6.0) * r, 0, sin(TAU * i / 6.0) * r))
	for i in 6:
		var a: Vector3 = ring[i]; var b: Vector3 = ring[(i + 1) % 6]
		st.add_vertex(top); st.add_vertex(b); st.add_vertex(a)
		st.add_vertex(bot); st.add_vertex(a); st.add_vertex(b)
	st.generate_normals()
	return st.commit()

func crystal(pos: Vector3, r: float, h: float, lit: bool) -> Array:
	var mat := StandardMaterial3D.new()
	mat.albedo_color = Color(0.20, 0.24, 0.26) if not lit else Palette.CORE
	mat.emission_enabled = true
	mat.emission = Palette.ACCENT
	mat.emission_energy_multiplier = 1.8 if lit else 0.0
	mat.roughness = 0.15
	mat.metallic_specular = 0.9
	var mi := MeshInstance3D.new()
	mi.mesh = crystal_mesh(r, h)
	mi.material_override = mat
	mi.position = pos
	add_child(mi)
	return [mi, mat]

func set_crystal_lit(mat: StandardMaterial3D, k: float) -> void:
	mat.albedo_color = Color(0.20, 0.24, 0.26).lerp(Palette.CORE, k)
	mat.emission_energy_multiplier = 1.8 * k

# ------------------------------------------------------------------ veiled gate pool
func _pool() -> void:
	water_mat = ShaderMaterial.new()
	water_mat.shader = preload("res://shaders/water.gdshader")
	water_mat.set_shader_parameter("noise_tex", level.noise_tex)
	# v0.5: the Waking Pool runs west off the island as an aqueduct basin
	var q := PlaneMesh.new()
	q.size = Vector2(8.95, 3.75)
	var mi := MeshInstance3D.new()
	mi.mesh = q
	mi.material_override = water_mat
	mi.position = Vector3(-5.125, Ch1Geo.WATER_Y, 1.7)        # v0.6: the water lies 30 cm below the rim
	mi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	add_child(mi)
	mi.add_to_group("f_water")
	var om := ShaderMaterial.new()
	om.shader = preload("res://shaders/water_over.gdshader")
	om.set_shader_parameter("noise_tex", level.noise_tex)
	om.set_shader_parameter("area", Vector4(-9.4, -0.1, -0.8, 3.4))
	water_over_mat = om
	var oq := PlaneMesh.new()
	oq.size = Vector2(8.95, 3.75)
	var omi := MeshInstance3D.new()
	omi.mesh = oq
	omi.material_override = om
	omi.position = Vector3(-5.125, Ch1Geo.WATER_Y + 0.025, 1.7)
	omi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	add_child(omi)
	omi.add_to_group("f_water")

# ------------------------------------------------------------------ a) rune door
func _rune_statues() -> void:
	# numbered statues; their order on the door is by numeral, NOT by where they stand
	var defs := [[Vector3(15.5, 1.0, -6.7), 1, DOOR_SOLUTION[0]], [Vector3(8.4, 1.0, -10.7), 2, DOOR_SOLUTION[1]],
		[Vector3(15.7, 1.0, -12.9), 3, DOOR_SOLUTION[2]]]
	var center := Vector3(12.0, 1.0, -9.5)
	for d in defs:
		var p: Vector3 = d[0]
		var yaw := atan2(-(center.x - p.x), -(center.z - p.z))
		level.statue("G", p, yaw, 1.0, 1.0)
		var B := Basis(Vector3.UP, yaw)
		var front := B * Vector3(0, 0, -0.505)
		var m := rune_quad(self, p + Vector3(0, 0.52, 0) + front * 1.004, Vector2(0.80, 1.0), B * Basis(Vector3.UP, PI), float(d[2]), 0.7, float(d[1]))
		statue_mats.append(m)
		statue_pos.append(p)
		var num: int = d[1]
		var des: int = d[2]
		level.add_interact("statue%d" % num, p + front * 2.0, "read", func() -> void: event.emit("statue", [des, num]), 1.25)

func _door() -> void:
	door = Node3D.new()
	door.position = Vector3(12.0, 1.0, -15.08)
	add_child(door)
	var m := MB.new()
	m.box(Vector3(0, 1.8, 0), Vector3(2.2, 3.6, 0.34), Color(0.4, 0.25, 0.0))
	# carved border on the face
	m.box(Vector3(0, 3.42, 0.18), Vector3(2.0, 0.08, 0.04), Color(0.4, 0.25, 0.0))
	m.box(Vector3(0, 0.25, 0.18), Vector3(2.0, 0.08, 0.04), Color(0.4, 0.25, 0.0))
	var mi := marble_instance(m.commit(), door, 0.97)
	door_mat = mi.material_override
	for i in 3:
		var x := -0.68 + i * 0.68
		slot_mats.append(rune_quad(door, Vector3(x, 2.3, 0.176), Vector2(0.64, 0.82), Basis(), -1.0, 0.0, float(i + 1)))
	# three dials before the door
	var dm := MB.new()
	for i in 3:
		var x := DIAL_X0 + i * DIAL_DX
		dm.box(Vector3(x, 1.45, DIAL_Z), Vector3(0.46, 0.9, 0.46), Color(0.6, 0.25, 0.0))
		dm.box(Vector3(x, 1.94, DIAL_Z), Vector3(0.58, 0.1, 0.58), Color(0.6, 0.25, 0.0), Basis(Vector3.RIGHT, 0.35))
		level.ob_circle(Vector2(x, DIAL_Z), 0.32)
		var tilt := Basis(Vector3.RIGHT, -PI * 0.5 + 0.35)
		dial_mats.append(rune_quad(self, Vector3(x, 2.0, DIAL_Z + 0.02), Vector2(0.44, 0.52), tilt, -1.0, 0.35))
		var idx := i
		level.add_interact("dial%d" % (i + 1), Vector3(x, 1.0, DIAL_Z + 0.65), "rune", func() -> void: game.open_door_overlay(idx), 0.75,
			func() -> bool: return not state["door_open"])
	level.add_interact("door", Vector3(12.0, 1.0, -14.3), "rune", func() -> void: game.open_door_overlay(1), 0.9,
		func() -> bool: return not state["door_open"])
	marble_instance(dm.commit(), self)
	level.ob_rect(Level.R(10.9, -15.28, 13.1, -14.86), "door")

func turn_dial(i: int, dir := 1) -> void:
	if state["door_open"] or busy: return
	var s: Array = state["door"]
	s[i] = posmod(int(s[i]) + dir, 6) if int(s[i]) >= 0 or dir > 0 else 5
	_apply_door_runes()
	event.emit("dial", i)
	if s == DOOR_SOLUTION:
		_open_door(false)

func _apply_door_runes() -> void:
	var s: Array = state["door"]
	for i in 3:
		slot_mats[i].set_shader_parameter("design", float(s[i]))
		slot_mats[i].set_shader_parameter("lit", 0.0 if s[i] < 0 else 1.0)
		slot_mats[i].set_shader_parameter("flare", 0.0 if s[i] < 0 else 0.35)
		dial_mats[i].set_shader_parameter("design", float(s[i]))
		dial_mats[i].set_shader_parameter("lit", 0.35 if s[i] < 0 else 0.8)

func _open_door(instant: bool) -> void:
	state["door_open"] = true
	level.set_enabled("door", false)
	if instant:
		door.position.y = 1.0 - 3.7
		door.visible = false
		for m in slot_mats + dial_mats: m.set_shader_parameter("lit", 1.0)
		return
	busy = true
	event.emit("door_solved", null)
	var tw := create_tween()
	tw.tween_method(func(v: float) -> void:
		for m in slot_mats + dial_mats:
			m.set_shader_parameter("flare", v)
			m.set_shader_parameter("lit", 1.0), 0.0, 1.0, 0.5)
	tw.tween_method(func(v: float) -> void:
		for m in slot_mats + dial_mats: m.set_shader_parameter("flare", v), 1.0, 0.25, 0.9)
	tw.tween_callback(func() -> void: event.emit("door_grind", null))
	tw.tween_property(door, "position:y", 1.0 - 3.7, 3.4).set_trans(Tween.TRANS_SINE).set_ease(Tween.EASE_IN_OUT)
	tw.tween_callback(func() -> void:
		door.visible = false
		busy = false
		event.emit("door_open", null))

# ------------------------------------------------------------------ shortcut gate
func _gate() -> void:
	gate_bars = Node3D.new()
	gate_bars.position = Vector3(5.15, 0.0, -2.0)
	add_child(gate_bars)
	var m := MB.new()
	for i in 9:
		var z := -1.0 + i * 0.25
		m.cyl(Vector3(0, 1.3, z), 0.035, 0.035, 2.6, Color(0.5, 1.0, 0.0), 6)
		m.cyl(Vector3(0, 2.66, z), 0.0, 0.06, 0.16, Color(0.5, 1.0, 0.0), 6)
	m.box(Vector3(0, 0.5, 0), Vector3(0.08, 0.08, 2.1), Color(0.5, 1.0, 0.0))
	m.box(Vector3(0, 2.2, 0), Vector3(0.08, 0.08, 2.1), Color(0.5, 1.0, 0.0))
	marble_instance(m.commit(), gate_bars)
	level.ob_rect(Level.R(4.85, -3.0, 5.4, -1.0), "gate")
	level.add_interact("gate_open", Vector3(5.75, 0.25, -2.0), "lever", open_gate, 1.0,
		func() -> bool: return not state["shortcut"] and game.player.position.x > 5.3)
	level.add_interact("gate_locked", Vector3(4.45, 0.0, -2.0), "locked", func() -> void: event.emit("gate_locked", null), 0.9,
		func() -> bool: return not state["shortcut"] and game.player.position.x < 5.0)

func open_gate(instant := false) -> void:
	if state["shortcut"] and not instant: return
	state["shortcut"] = true
	level.set_enabled("gate", false)
	if instant:
		gate_bars.position.y = 2.75
		return
	event.emit("gate_open", null)
	var tw := create_tween()
	tw.tween_property(gate_bars, "position:y", 2.75, 2.2).set_trans(Tween.TRANS_QUAD).set_ease(Tween.EASE_IN_OUT)

# ------------------------------------------------------------------ b) light court: "Two Worlds of Light"
## v0.6. A crystal throws a beam east; four mirror stands turn in 45 degree steps. The court's east edge
## is HER great glass: a beam that strikes it does not come back, it goes ON, into her world (we trace
## it there FOLDED back across the glass, so her world shares our coordinates). In her world stand
## your stands' twins (their reflections, turned as mirrors turn) and two glasses of her own (seen only
## in the glass). Out of her world again, the light can reach the dark crystal by the glass.
## The crystal passes the light on the way it came: only light that arrives heading toward her mural
## (within LIGHT_CONE of it) lights the mural; the beam through her world does, the near way does not.
## Exactly one setting of the four stands does it (court.c / the playthrough's solver check).
const COURT_GX := 16.85                     # the great glass (plane x), facing west
const COURT_G := Vector2(-26.5, -21.6)      # its span in z
const SRC := Vector2(8.2, -22.6)            # the source crystal (shines east)
const TGT := Vector2(15.7, -25.6)           # the dark crystal by the glass
const STAND_POS := [Vector2(9.7, -22.6), Vector2(9.7, -24.1), Vector2(15.7, -24.1), Vector2(15.7, -22.6)]
const MIRROR_START := [1, 0, 2, 2]
const HER_POS := [Vector2(14.6, -24.1), Vector2(14.6, -25.6)]   # her own glasses (folded positions)
const HER_K := [1, 3]
const LIGHT_CONE := 40.0
const COURT_BOUNDS := Rect2(7.15, -26.85, 9.7, 9.7)
var her_stands: Array[Node3D] = []
var her_glows: Array[ShaderMaterial] = []
var court_refl: Reflector
var beam_world: Array[int] = []             # per beam point: 0 ours, 1 hers (the segment that starts there)
var beam_good := false                      # lit, and from the mural's side
var beam_dir := Vector2.ZERO                # the direction the light arrived in
var decoy_t := 0.0                          # seconds the crystal has burned the wrong way (a hint)
var t_fan: MeshInstance3D                   # the light the crystal passes on, on the floor
var t_fan_mat: ShaderMaterial
const SEGS := 14

func _stand_mesh() -> ArrayMesh:
	var fm := MB.new()
	var fc := Color(0.5, 1.0, 0.0)
	fm.box(Vector3(-0.56, 0.0, 0), Vector3(0.07, 1.3, 0.07), fc)
	fm.box(Vector3(0.56, 0.0, 0), Vector3(0.07, 1.3, 0.07), fc)
	fm.box(Vector3(0, 0.66, 0), Vector3(1.2, 0.07, 0.07), fc)
	fm.box(Vector3(0, -0.6, 0), Vector3(1.2, 0.07, 0.07), fc)
	fm.cyl(Vector3(0, -0.55, 0), 0.05, 0.05, 0.3, fc, 6)
	return fm.commit()

func _stand_glass() -> MeshInstance3D:
	var gm := ShaderMaterial.new()
	gm.shader = preload("res://shaders/glass.gdshader")
	gm.set_shader_parameter("size", Vector2(1.05, 1.2))
	gm.set_shader_parameter("base_alpha", 0.35)
	gm.set_shader_parameter("tint", Color(0.55, 0.75, 0.82))
	var q := QuadMesh.new()
	q.size = Vector2(1.05, 1.2)
	var g := MeshInstance3D.new()
	g.mesh = q
	g.material_override = gm
	g.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	g.position.y = 0.03
	return g

func _light_court() -> void:
	var y := 2.0
	var pm := MB.new()
	var tpm := MB.new()
	for p in [Vector3(SRC.x, y, SRC.y), Vector3(TGT.x, y, TGT.y)]:
		var m: MB = pm if p.x < 12.0 else tpm
		m.cyl(p + Vector3(0, 0.45, 0), 0.24, 0.34, 0.9, Color(0.3, 0.25, 0.0), 12)
		m.cyl(p + Vector3(0, 0.95, 0), 0.34, 0.24, 0.12, Color(0.3, 0.25, 0.0), 12)
		level.ob_circle(Vector2(p.x, p.z), 0.42)
	# (her world has no crystal: the dark crystal, its pedestal and its halo are not in the glass)
	marble_instance(tpm.commit(), self).layers = PlanarMirror.LAYER_MAIN_FX
	for i in STAND_POS.size():
		var p := Vector3(STAND_POS[i].x, y, STAND_POS[i].y)
		pm.cyl(p + Vector3(0, 0.25, 0), 0.30, 0.38, 0.5, Color(0.3, 0.25, 0.0), 12)
		pm.cyl(p + Vector3(0, 0.55, 0), 0.07, 0.07, 0.3, Color(0.5, 1.0, 0.0), 8)
		level.ob_circle(Vector2(p.x, p.z), 0.62)            # (v0.7: the turning frame's full sweep)
	marble_instance(pm.commit(), self)
	var sc := crystal(Vector3(SRC.x, y + 1.45, SRC.y), 0.17, 0.32, true)
	source_crystal = sc[0]
	var src_halo := glow_quad(self, Vector3(SRC.x, y + 1.45, SRC.y), 2.2, Palette.ACCENT, 0.55)
	aqua_light(self, Vector3(SRC.x, y + 1.6, SRC.y), src_halo, 3.0, 0.45, Vector3(SRC.x, y + 0.012, SRC.y), 2.2)      # (v0.8.1: aqua gives light)
	var tc := crystal(Vector3(TGT.x, y + 1.45, TGT.y), 0.17, 0.32, false)
	target_crystal = tc[0]
	target_mat = tc[1]
	target_halo = glow_quad(self, Vector3(TGT.x, y + 1.45, TGT.y), 2.6, Palette.ACCENT, 0.0)
	target_crystal.layers = PlanarMirror.LAYER_MAIN_FX
	(get_child(get_child_count() - 1) as MeshInstance3D).layers = PlanarMirror.LAYER_MAIN_FX
	aqua_light(self, Vector3(TGT.x, y + 1.6, TGT.y), target_halo, 3.2, 0.5, Vector3(TGT.x, y + 0.012, TGT.y), 2.4)      # (v0.8.1)
	# the four mirror stands (frame + double-sided glass), rotating about Y
	var smesh := _stand_mesh()
	for i in STAND_POS.size():
		var p := Vector3(STAND_POS[i].x, y, STAND_POS[i].y)
		var pivot := Node3D.new()
		pivot.position = p + Vector3(0, 1.0, 0)
		add_child(pivot)
		marble_instance(smesh, pivot)
		pivot.add_child(_stand_glass())
		mirrors.append(pivot)
		var idx := i
		level.add_interact("mirror%d" % (i + 1), p, "turn", func() -> void: turn_mirror(idx), 1.15,
			func() -> bool: return not state["bridge"])
	mirror_angles.resize(STAND_POS.size())
	mirror_goal.resize(STAND_POS.size())
	mirror_tw.resize(STAND_POS.size())
	_apply_mirrors(true)
	# her own glasses: only in her world (the reflection's camera alone renders them)
	for i in HER_POS.size():
		var pv := Node3D.new()
		pv.position = Vector3(HER_POS[i].x, y + 1.0, HER_POS[i].y)
		pv.rotation.y = -float(HER_K[i]) * PI * 0.25
		add_child(pv)
		var mi := marble_instance(smesh, pv)
		mi.layers = PlanarMirror.LAYER_DOUBLE
		var g := _stand_glass()
		g.layers = PlanarMirror.LAYER_DOUBLE
		pv.add_child(g)
		var base := MB.new()
		base.cyl(Vector3(0, -0.75, 0), 0.30, 0.38, 0.5, Color(0.3, 0.25, 0.0), 12)
		var bmi := marble_instance(base.commit(), pv)
		bmi.layers = PlanarMirror.LAYER_DOUBLE
		var hg := glow_quad(pv, Vector3(0, 0.0, 0), 1.8, Palette.HER, 0.0)          # (her world: aqua since v0.8.1)
		(pv.get_child(pv.get_child_count() - 1) as MeshInstance3D).layers = PlanarMirror.LAYER_DOUBLE
		her_glows.append(hg)
		her_stands.append(pv)
	# her great glass on the court's east edge: a real planar reflection
	var gc := Vector3(COURT_GX - 0.01, 4.1, (COURT_G.x + COURT_G.y) * 0.5)
	var gsize := Vector2(COURT_G.y - COURT_G.x, 4.3)
	var west := Basis(Vector3.UP, -PI * 0.5)
	var mm := _mirror_quad(gc, west, gsize, false, 1.0)
	mm.set_shader_parameter("ncols", 0)
	mm.set_shader_parameter("floor_y", 2.0)
	var pmr := PlanarMirror.new()
	add_child(pmr)
	pmr.setup(Vector3.LEFT, -COURT_GX + 0.01, mm, game.world.env)
	pmr.cam.far = 46.0            # (v0.6 perf: her world needs only the court, not the far islands)
	pmr.res_k = 0.8
	var r := Reflector.new()
	r.kind = "mirror"; r.plane_n = Vector3.LEFT; r.plane_d = -COURT_GX + 0.02
	r.clip_c = gc; r.clip_u = Vector3.BACK; r.clip_v = Vector3.UP; r.clip_h = gsize * 0.5
	r.region = Level.R(7.0, -27.0, 17.0, -17.0)
	r.planar = pmr
	court_refl = r
	# the beam lights the floor: a strip under each segment, a pool at every strike
	var fsh := preload("res://shaders/beam_floor.gdshader")
	for i in SEGS:
		for kind in [0.0, 1.0]:
			var fm := ShaderMaterial.new()
			fm.shader = fsh
			fm.set_shader_parameter("kind", kind)
			fm.set_shader_parameter("phase", i * 1.3 + kind)
			var fq := PlaneMesh.new()
			fq.size = Vector2(1, 1)
			fq.center_offset = Vector3(0.5, 0, 0) if kind < 0.5 else Vector3.ZERO
			var f := MeshInstance3D.new()
			f.mesh = fq
			f.material_override = fm
			f.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
			f.visible = false
			add_child(f)
			if kind < 0.5: beam_floor.append(f)
			else: beam_pools.append(f)
	# the light the crystal passes on (a fan on the floor, the way the beam arrived)
	t_fan_mat = ShaderMaterial.new()
	t_fan_mat.shader = fsh
	t_fan_mat.set_shader_parameter("kind", 0.0)
	t_fan_mat.set_shader_parameter("intensity", 0.0)
	var tq := PlaneMesh.new()
	tq.size = Vector2(1, 1)
	tq.center_offset = Vector3(0.5, 0, 0)
	t_fan = MeshInstance3D.new()
	t_fan.mesh = tq
	t_fan.material_override = t_fan_mat
	t_fan.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	t_fan.visible = false
	t_fan.layers = PlanarMirror.LAYER_MAIN_FX
	add_child(t_fan)
	# beam ribbons + bounce glows
	var rsh := preload("res://shaders/ray.gdshader")
	for i in SEGS:
		var rm := ShaderMaterial.new()
		rm.shader = rsh
		var q := QuadMesh.new()
		q.size = Vector2(1, 1)
		var sg := MeshInstance3D.new()
		sg.mesh = q
		sg.material_override = rm
		sg.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
		sg.extra_cull_margin = 4.0
		sg.visible = false
		add_child(sg)
		beam_segs.append(sg)
		var gl := MeshInstance3D.new()
		var gq := QuadMesh.new()
		gq.size = Vector2(1.4, 1.4)
		gl.mesh = gq
		var hm := ShaderMaterial.new()
		hm.shader = preload("res://shaders/halo.gdshader")
		hm.set_shader_parameter("color", Palette.ACCENT)
		hm.set_shader_parameter("intensity", 1.2)
		gl.material_override = hm
		gl.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
		gl.visible = false
		add_child(gl)
		beam_glows.append(gl)
	# the drawbridge: hinged at the Eidolon ledge, standing upright until the light arrives
	drawbridge = Node3D.new()
	drawbridge.position = Vector3(21.0, 2.0, -20.4)
	drawbridge.rotation.z = -PI * 0.5
	add_child(drawbridge)
	var bm := MB.new()
	bm.box(Vector3(-2.0, -0.17, 0), Vector3(4.0, 0.34, 2.0), Color(0.5, 0.0, 0.0))
	for zz in [-0.95, 0.95]:
		bm.box(Vector3(-2.0, 0.3, zz), Vector3(3.9, 0.1, 0.14), Color(0.5, 0.25, 0.0))
		for k in 6: bm.cyl(Vector3(-0.2 - k * 0.72, 0.15, zz), 0.045, 0.06, 0.3, Color(0.5, 0.25, 0.0), 6)
	marble_instance(bm.commit(), drawbridge)
	level.walk(Level.R(17, -21.4, 21, -19.4), 2.0, NAN, -1, "LB", false)

func turn_mirror(i: int) -> void:
	if state["bridge"]: return
	var s: Array = state["mirrors"]
	s[i] = (int(s[i]) + 1) % 4
	event.emit("mirror_turn", i)
	mirror_goal[i] += PI * 0.25
	var target := mirror_goal[i]
	if mirror_tw[i]: mirror_tw[i].kill()
	else: _turning += 1
	var tw := create_tween()
	mirror_tw[i] = tw
	tw.tween_method(func(v: float) -> void:
		mirror_angles[i] = v
		_apply_mirrors(false), mirror_angles[i], target, 0.45).set_trans(Tween.TRANS_BACK).set_ease(Tween.EASE_OUT)
	tw.tween_callback(func() -> void:
		_turning -= 1
		mirror_tw[i] = null
		mirror_angles[i] = target)

var _turning := 0
var mirror_goal: Array[float] = []
var mirror_tw: Array = []

func _apply_mirrors(snap: bool) -> void:
	for i in mirrors.size():
		if snap:
			mirror_angles[i] = float(state["mirrors"][i]) * PI * 0.25
			mirror_goal[i] = mirror_angles[i]
			if mirror_tw[i]:
				(mirror_tw[i] as Tween).kill()
				mirror_tw[i] = null
		mirrors[i].rotation.y = -mirror_angles[i]
	if snap: _turning = 0

## the beam (also a pure function for the solver check: angles in quarter-PI steps, or live angles)
## -> {pts: Array[Vector3], world: Array[int] (per point), lit: bool, dir: Vector2, good: bool}
func trace_beam(angles: Array) -> Dictionary:
	var y := 3.0
	var pts: Array[Vector3] = []
	var worlds: Array[int] = []
	var p := SRC
	var d := Vector2(1, 0)
	var w := 0
	pts.append(Vector3(p.x + 0.2, y, p.y))
	worlds.append(0)
	var last := ""
	var lit := false
	for bounce in SEGS - 1:
		var best_t := INF
		var best := ""
		var best_i := -1
		for i in STAND_POS.size():
			if last == "m%d" % i: continue
			var r := _ray_circle(p, d, STAND_POS[i], 0.32)
			if r < best_t: best_t = r; best = "m"; best_i = i
		if w == 1:
			for i in HER_POS.size():
				if last == "h%d" % i: continue
				var r2 := _ray_circle(p, d, HER_POS[i], 0.32)
				if r2 < best_t: best_t = r2; best = "h"; best_i = i
		else:
			var rt := _ray_circle(p, d, TGT, 0.3)
			if rt < best_t: best_t = rt; best = "t"
		# the great glass
		if d.x > 0.0001:
			var tg := (COURT_GX - p.x) / d.x
			var zg := p.y + d.y * tg
			if tg > 0.05 and zg >= COURT_G.x and zg <= COURT_G.y and tg < best_t: best_t = tg; best = "g"
		for o in level.obstacles:
			if not o.circle or not o.enabled: continue
			if not COURT_BOUNDS.grow(1.0).has_point(o.c): continue
			var skip := o.c.distance_to(SRC) < 0.05 or o.c.distance_to(TGT) < 0.05
			for sp in STAND_POS:
				if o.c.distance_to(sp) < 0.05: skip = true
			if skip: continue
			var ot := _ray_circle(p, d, o.c, o.rad * 0.8)
			if ot < best_t: best_t = ot; best = "o"
		var et := _ray_exit(p, d, COURT_BOUNDS)
		if et < best_t: best_t = et; best = "e"
		var hp := p + d * best_t
		if best == "m" or best == "h":
			var a: float = float(angles[best_i]) if best == "m" else float(HER_K[best_i]) * PI * 0.25
			var n := Vector2(-sin(a), cos(a))
			var c: Vector2 = STAND_POS[best_i] if best == "m" else HER_POS[best_i]
			pts.append(Vector3(c.x, y, c.y))
			worlds.append(w)
			if absf(d.dot(n)) < 0.25: break       # grazing: the frame swallows the light
			d = (d - 2.0 * d.dot(n) * n).normalized()
			p = c
			last = best + str(best_i)
		elif best == "g":
			pts.append(Vector3(hp.x, y, hp.y))
			w = 1 - w
			worlds.append(w)
			d = Vector2(-d.x, d.y)
			p = hp
			last = "g"
		else:
			pts.append(Vector3(hp.x, y, hp.y))
			worlds.append(w)
			if best == "t": lit = true
			break
	var want := Vector2(Chapter.MURAL_HEAD.x - TGT.x, Chapter.MURAL_Z - TGT.y)
	var good := lit and rad_to_deg(absf(d.angle_to(want))) < LIGHT_CONE
	return {"pts": pts, "world": worlds, "lit": lit, "dir": d, "good": good}

func _trace() -> Array[Vector3]:
	var r := trace_beam(mirror_angles)
	beam_world = r["world"]
	beam_lit = r["lit"]
	beam_good = r["good"]
	beam_dir = r["dir"]
	return r["pts"]

## (tests) every setting of the stands: [state, lit, good]
func solve_court() -> Array:
	var out := []
	for s in 256:
		var st := [s & 3, (s >> 2) & 3, (s >> 4) & 3, (s >> 6) & 3]
		var ang := []
		for k in st: ang.append(float(k) * PI * 0.25)
		var r := trace_beam(ang)
		if r["lit"]: out.append([st, true, r["good"]])
	return out

static func _ray_circle(p: Vector2, d: Vector2, c: Vector2, r: float) -> float:
	var t := (c - p).dot(d)
	if t <= 0.05: return INF
	var closest := p + d * t
	if closest.distance_to(c) > r: return INF
	return t

static func _ray_exit(p: Vector2, d: Vector2, b: Rect2) -> float:
	var t := INF
	if d.x > 0.0001: t = minf(t, (b.end.x - p.x) / d.x)
	if d.x < -0.0001: t = minf(t, (b.position.x - p.x) / d.x)
	if d.y > 0.0001: t = minf(t, (b.end.y - p.y) / d.y)
	if d.y < -0.0001: t = minf(t, (b.position.y - p.y) / d.y)
	return maxf(t, 0.0)

## (v0.8.5) the beam is traced again only when a mirror's angle changed (a turn, a new state); the glow
## and the hints below still animate every frame
var _beam_angles: Array = []
func _update_beam(dt := 0.0) -> void:
	var same := _beam_angles.size() == mirror_angles.size() and not beam_points.is_empty()
	if same:
		for k in mirror_angles.size():
			if not is_equal_approx(float(_beam_angles[k]), float(mirror_angles[k])):
				same = false
				break
	if not same:
		_beam_angles = mirror_angles.duplicate()
		var pts := _trace()
		beam_points = pts
		for i in beam_segs.size():
			var sg := beam_segs[i]
			var g := beam_glows[i]
			var wl: int = beam_world[i] if i < beam_world.size() else 0
			var lay := PlanarMirror.LAYER_DOUBLE if wl == 1 else PlanarMirror.LAYER_MAIN_FX
			if i < pts.size() - 1:
				var a := pts[i]
				var b := pts[i + 1]
				var v := b - a
				var L := v.length()
				if L < 0.01:
					sg.visible = false
				else:
					var z := v.normalized().cross(Vector3.UP)
					sg.transform = Transform3D(Basis(v, Vector3.UP, z), a)
					var m: ShaderMaterial = sg.material_override
					m.set_shader_parameter("length_m", L)
					m.set_shader_parameter("intensity", 1.0)
					sg.layers = lay
					sg.visible = true
				g.visible = i > 0
				g.position = a
				g.layers = lay
			else:
				sg.visible = false
				g.visible = i == pts.size() - 1 and i > 0
				if g.visible:
					g.position = pts[i]
					g.layers = PlanarMirror.LAYER_DOUBLE if (beam_world[i - 1] if i - 1 < beam_world.size() else 0) == 1 else PlanarMirror.LAYER_MAIN_FX
		_update_beam_floor(pts)
	# the crystal: lit from any side it glows; it passes the light on the way it came
	var tk: float = target_halo.get_shader_parameter("intensity")
	if not state["bridge"]:
		set_crystal_lit(target_mat, 1.0 if beam_lit else 0.0)
		target_halo.set_shader_parameter("intensity", move_toward(tk, 0.7 if beam_lit else 0.0, dt * 2.0))
	t_fan.visible = beam_lit or state["bridge"]
	if t_fan.visible:
		var fd := beam_dir if beam_lit else Vector2(Chapter.MURAL_HEAD.x - TGT.x, Chapter.MURAL_Z - TGT.y).normalized()
		var L2 := clampf(_ray_exit(TGT, fd, COURT_BOUNDS) + 0.1, 0.5, 3.4)
		var dir3 := Vector3(fd.x, 0.0, fd.y)
		t_fan.transform = Transform3D(Basis(dir3 * L2, Vector3.UP, dir3.cross(Vector3.UP) * 3.2), Vector3(TGT.x, 2.018, TGT.y))
		t_fan_mat.set_shader_parameter("length_m", L2)
		t_fan_mat.set_shader_parameter("intensity", 0.8)
	# the wrong way for a while: her own glasses shimmer in the glass (a hint)
	decoy_t = decoy_t + dt if (beam_lit and not beam_good and not state["bridge"]) else maxf(0.0, decoy_t - dt * 0.2)
	var hk := smoothstep(10.0, 14.0, decoy_t) * (0.45 + 0.35 * sin(_t * 2.4))
	for i in her_glows.size():
		her_glows[i].set_shader_parameter("intensity", 0.0 if state["bridge"] else hk)
		her_stands[i].get_child(her_stands[i].get_child_count() - 1).visible = hk > 0.01 and not state["bridge"]
	if beam_good and _turning == 0 and not state["bridge"]:
		_lower_bridge(false)

## the floor glow follows the beam path (and so every mirror turn); her world's half only in the glass
func _update_beam_floor(pts: Array[Vector3]) -> void:
	var along := 0.0
	for i in beam_floor.size():
		var f := beam_floor[i]
		var pl := beam_pools[i]
		var wl: int = beam_world[i] if i < beam_world.size() else 0
		var lay := PlanarMirror.LAYER_DOUBLE if wl == 1 else PlanarMirror.LAYER_MAIN_FX
		if i < pts.size() - 1:
			var a := pts[i]
			var b := pts[i + 1]
			var v := Vector2(b.x - a.x, b.z - a.z)
			var L := v.length()
			var fy := level.height_at(Vector2(a.x, a.z)) + 0.016
			if L > 0.05:
				var dir := Vector3(v.x, 0.0, v.y) / L
				f.transform = Transform3D(Basis(dir * L, Vector3.UP, dir.cross(Vector3.UP) * 2.6), Vector3(a.x, fy, a.z))
				var m: ShaderMaterial = f.material_override
				m.set_shader_parameter("length_m", L)
				m.set_shader_parameter("offset_m", along)
				f.layers = lay
				f.visible = true
			else:
				f.visible = false
			along += L
		else:
			f.visible = false
		if i < pts.size() and wl == 0:
			var p := pts[i]
			pl.transform = Transform3D(Basis().scaled(Vector3(3.2, 1.0, 3.2)), Vector3(p.x, level.height_at(Vector2(p.x, p.z)) + 0.02, p.z))
			pl.layers = lay
			pl.visible = true
		else:
			pl.visible = false

## v0.5: the completed beam lights the target crystal, which pours its light across the Court onto
## her mural (chapter.gd); the drawbridge only comes down at the very end (a way back from the ledge)
func _lower_bridge(instant: bool) -> void:
	state["bridge"] = true
	if instant:
		set_crystal_lit(target_mat, 1.0)
		target_halo.set_shader_parameter("intensity", 0.7)
		return
	busy = true
	event.emit("beam_lit", null)
	var tw := create_tween()
	tw.tween_method(func(v: float) -> void:
		set_crystal_lit(target_mat, maxf(v, 0.7))
		target_halo.set_shader_parameter("intensity", 0.7 + v * 0.5), 0.0, 1.0, 1.2)
	tw.tween_callback(func() -> void:
		busy = false
		event.emit("beam_done", null))

func lower_drawbridge(instant: bool) -> void:
	state["drawbridge"] = true
	if instant:
		drawbridge.rotation.z = 0.0
		level.set_enabled("LB", true)
		return
	event.emit("bridge_fall", null)
	var tw := create_tween()
	tw.tween_property(drawbridge, "rotation:z", 0.0, 2.4).set_trans(Tween.TRANS_BOUNCE).set_ease(Tween.EASE_OUT)
	tw.tween_callback(func() -> void:
		level.set_enabled("LB", true)
		event.emit("bridge_down", null))

# ------------------------------------------------------------------ c) the eidolon glass and plate
func _eidolon_glass() -> void:
	eid_glass_mat = ShaderMaterial.new()
	eid_glass_mat.shader = preload("res://shaders/glass.gdshader")
	eid_glass_mat.set_shader_parameter("size", Vector2(4.0, 3.3))
	eid_glass_mat.set_shader_parameter("tint", Color(0.36, 0.55, 0.62))
	eid_glass_mat.set_shader_parameter("base_alpha", 0.18)
	var q := QuadMesh.new()
	q.size = Vector2(4.0, 3.3)
	var g := MeshInstance3D.new()
	g.mesh = q
	g.material_override = eid_glass_mat
	g.position = Vector3(23.6, 2.0 + 1.82, GLASS_Z)
	g.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	add_child(g)
	rune_quad(self, Vector3(23.6, 5.62, GLASS_Z + 0.17), Vector2(0.42, 0.42), Basis(), 2.0, 0.7)
	# stepping stones that exist only on the other side of the glass
	ghost_path_mat = ShaderMaterial.new()
	ghost_path_mat.shader = preload("res://shaders/ghostpath.gdshader")
	var pq := PlaneMesh.new()
	pq.size = Vector2(8.0, 3.0)
	var pmi := MeshInstance3D.new()
	pmi.mesh = pq
	pmi.material_override = ghost_path_mat
	pmi.position = Vector3(25.0, 2.02, -26.5)
	pmi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	add_child(pmi)
	# the plate on the shrine platform
	var pm := MB.new()
	pm.cyl(PLATE_POS + Vector3(0, 0.03, 0), 0.62, 0.66, 0.06, Color(0.5, 1.0, 0.0), 24)
	pm.cyl(PLATE_POS + Vector3(0, 0.05, 0), 0.52, 0.52, 0.06, Color(0.5, 0.25, 0.0), 24)
	marble_instance(pm.commit(), self)
	plate_mat = rune_quad(self, PLATE_POS + Vector3(0, 0.085, 0), Vector2(0.86, 0.86), Basis(Vector3.RIGHT, -PI * 0.5), 2.0, 0.6)
	plate_mat.set_shader_parameter("hers", 1.0)          # (the Eidolon plate: her side; aqua since v0.8.1)
	# the target, unmistakable: a rune sigil ring, a pillar of light, motes circling it
	plate_ring = ShaderMaterial.new()
	plate_ring.shader = preload("res://shaders/ring.gdshader")
	plate_ring.set_shader_parameter("lit", 1.0)
	plate_ring.set_shader_parameter("sweep", 1.0)
	plate_ring.set_shader_parameter("hers", 1.0)
	var rq := PlaneMesh.new()
	rq.size = Vector2(2.3, 2.3)
	var rmi := MeshInstance3D.new()
	rmi.mesh = rq
	rmi.material_override = plate_ring
	rmi.position = PLATE_POS + Vector3(0, 0.03, 0)
	rmi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	add_child(rmi)
	plate_pillar = _pillar(self, PLATE_POS + Vector3(0, 0.1, 0), 1.1, 13.0)
	plate_pillar.set_shader_parameter("fade", 0.7)
	plate_pillar.set_shader_parameter("color", Palette.HER_CORE)
	plate_halo = glow_quad(self, PLATE_POS + Vector3(0, 0.6, 0), 2.6, Palette.ACCENT, 0.5)
	aqua_light(self, PLATE_POS + Vector3(0, 0.9, 0), plate_halo, 3.0, 0.4)
	for i in 7:
		var mq := QuadMesh.new()
		mq.size = Vector2(0.16, 0.16)
		var mm := MeshInstance3D.new()
		mm.mesh = mq
		var hm := ShaderMaterial.new()
		hm.shader = preload("res://shaders/halo.gdshader")
		hm.set_shader_parameter("color", Palette.CORE)
		hm.set_shader_parameter("intensity", 1.4)
		mm.material_override = hm
		mm.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
		add_child(mm)
		plate_motes.append(mm)
	# your side of the glass: where you must stand (footprints), and the closeness ring around the plate
	foot_spot = Vector3(PLATE_POS.x, 2.0, 2.0 * GLASS_Z - PLATE_POS.z)
	foot_mat = _decal(foot_spot + Vector3(0, 0.025, 0), 1.6)
	foot_mat.set_shader_parameter("feet", 1.0)
	foot_mat.set_shader_parameter("radius", 0.42)
	foot_mat.set_shader_parameter("intensity", 0.0)
	near_mat = _decal(PLATE_POS + Vector3(0, 0.035, 0), 11.0)
	near_mat.set_shader_parameter("intensity", 0.0)
	guide = MeshInstance3D.new()
	var gq := QuadMesh.new()
	gq.size = Vector2(1, 1)
	guide.mesh = gq
	guide_mat = ShaderMaterial.new()
	guide_mat.shader = preload("res://shaders/ray.gdshader")
	guide_mat.set_shader_parameter("width", 0.07)
	guide_mat.set_shader_parameter("intensity", 0.0)
	guide.material_override = guide_mat
	guide.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	guide.extra_cull_margin = 8.0
	add_child(guide)
	# the bridge that rises when the plate is pressed
	risen_bridge = MeshInstance3D.new()
	var rb := MB.new()
	rb.box(Vector3(27.7, 1.75, -26.5), Vector3(1.8, 0.5, 3.0), Color(0.5, 0.0, 0.0))
	rb.cyl(Vector3(27.7, 0.3, -26.5), 0.8, 0.1, 2.4, Color(0.5, 0.5, 0.0), 7)
	risen_bridge.mesh = rb.commit()
	risen_mat = level.marble_mat.duplicate()
	risen_mat.set_shader_parameter("fade_y", -99.0)
	risen_bridge.material_override = risen_mat
	risen_bridge.position.y = -9.0
	risen_bridge.visible = false
	add_child(risen_bridge)
	level.walk(Level.R(26.8, -28, 28.6, -25), 2.0, NAN, -1, "EB", false)

func _decal(pos: Vector3, size: float) -> ShaderMaterial:
	var m := ShaderMaterial.new()
	m.shader = preload("res://shaders/target.gdshader")
	m.set_shader_parameter("size", size)
	var q := PlaneMesh.new()
	q.size = Vector2(size, size)
	var mi := MeshInstance3D.new()
	mi.mesh = q
	mi.material_override = m
	mi.position = pos
	mi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	add_child(mi)
	return m

func _update_plate_fx(dt: float) -> void:
	# motes spiral up the plate's pillar
	for i in plate_motes.size():
		var a := _t * (0.9 + i * 0.07) + i * TAU / plate_motes.size()
		var h := fmod(_t * 0.35 + i * 0.37, 1.0)
		plate_motes[i].position = PLATE_POS + Vector3(cos(a) * (0.55 - h * 0.25), 0.15 + h * 2.4, sin(a) * (0.55 - h * 0.25))
		plate_motes[i].scale = Vector3.ONE * (1.0 - h * 0.6)
	plate_halo.set_shader_parameter("intensity", 0.45 + 0.15 * sin(_t * 2.2) + plate_charge * 0.6)
	var on_ledge: bool = eidolon_refl != null and eidolon_refl.active and not state["plate"]
	ledge_time = ledge_time + dt if on_ledge else 0.0
	var rp := eidolon_refl.reflect_point(game.player.global_position) if eidolon_refl else Vector3.ZERO
	var dist := Vector2(rp.x - PLATE_POS.x, rp.z - PLATE_POS.z).length()
	# where to stand: a faint hint at once, clearer after a few seconds by the glass
	var fk := 0.0
	if on_ledge: fk = 0.30 + 0.55 * smoothstep(3.0, 6.0, ledge_time)
	foot_mat.set_shader_parameter("intensity", move_toward(float(foot_mat.get_shader_parameter("intensity")), fk, dt * 0.8))
	# closeness: a ring round the plate tightens and brightens as your reflection comes near
	var nk := 0.0
	if on_ledge: nk = clampf(1.0 - (dist - 0.5) / 6.0, 0.15, 1.0)
	near_mat.set_shader_parameter("radius", clampf(dist, 0.45, 5.2))
	near_mat.set_shader_parameter("intensity", move_toward(float(near_mat.get_shader_parameter("intensity")), nk, dt * 2.0))
	# a faint thread of light from the reflection's feet to the plate
	if on_ledge and dist > 0.6:
		var a3 := Vector3(rp.x, 2.06, rp.z)
		var b3 := Vector3(PLATE_POS.x, 2.06, PLATE_POS.z)
		var v := b3 - a3
		guide.transform = Transform3D(Basis(v, Vector3.UP, v.normalized().cross(Vector3.UP)), a3)
		guide_mat.set_shader_parameter("length_m", v.length())
		guide_mat.set_shader_parameter("intensity", 0.35 * eidolon_refl.vis)
		guide.visible = true
	else:
		guide.visible = false
	foot_spot_dist = Vector2(game.player.position.x - foot_spot.x, game.player.position.z - foot_spot.z).length()

func _update_plate(dt: float) -> void:
	_update_plate_fx(dt)
	if state["plate"] or eidolon_refl == null: return
	var on := false
	var refl_on := false
	if eidolon_refl.active and eidolon_refl.vis > 0.6:
		var rp := eidolon_refl.reflect_point(game.player.global_position)
		refl_on = Vector2(rp.x - PLATE_POS.x, rp.z - PLATE_POS.z).length() < 0.55
	# v0.6 "Two Plates": hers answers only while yours (on the ledge) is held down at the same time
	on = refl_on and game.chapter.plate_a_down()
	if refl_on and not on and not _plate_half:
		_plate_half = true
		event.emit("plate_half", null)
	if not refl_on: _plate_half = false
	plate_charge = move_toward(plate_charge, 1.0 if on else 0.0, dt / (0.9 if on else 0.5))
	plate_mat.set_shader_parameter("lit", 0.15 + plate_charge * 0.85)
	plate_mat.set_shader_parameter("flare", plate_charge * 0.4)
	if on and plate_charge > 0.02 and not _plate_touch:
		_plate_touch = true
		event.emit("plate_touch", null)
	if not on: _plate_touch = false
	if plate_charge >= 1.0:
		_press_plate(false)

var _plate_touch := false
var _plate_half := false

func _press_plate(instant: bool) -> void:
	state["plate"] = true
	risen_bridge.visible = true
	ghost_path_mat.set_shader_parameter("solid", 0.0)
	if instant:
		level.set_enabled("EB", true)
		risen_bridge.position.y = 0.0
		plate_mat.set_shader_parameter("lit", 1.0)
		return
	busy = true
	event.emit("plate_glow", null)
	var tf := create_tween()
	tf.tween_method(func(v: float) -> void: plate_pillar.set_shader_parameter("fade", v), 0.7, 2.2, 0.35)
	tf.tween_method(func(v: float) -> void: plate_pillar.set_shader_parameter("fade", v), 2.2, 0.9, 2.5)
	var tw := create_tween()
	tw.tween_method(func(v: float) -> void: plate_mat.set_shader_parameter("flare", v), 0.4, 1.0, 0.6)
	tw.tween_callback(func() -> void: event.emit("bridge_rise", null))
	tw.tween_property(risen_bridge, "position:y", 0.0, 3.2).set_trans(Tween.TRANS_QUART).set_ease(Tween.EASE_OUT)
	tw.parallel().tween_method(func(v: float) -> void: plate_mat.set_shader_parameter("flare", v), 1.0, 0.3, 2.0)
	tw.tween_callback(func() -> void:
		level.set_enabled("EB", true)
		busy = false
		event.emit("plate_open", null))

# ------------------------------------------------------------------ the shrine
func _shrine() -> void:
	var c := SHRINE_C
	var sc := crystal(c + Vector3(0, 1.75, 0.35), 0.2, 0.38, false)
	shrine_crystal = sc[0]
	shrine_crystal_mat = sc[1]
	shrine_halo = glow_quad(self, c + Vector3(0, 1.75, 0.35), 4.0, Palette.ACCENT, 0.0)
	aqua_light(self, c + Vector3(0, 1.9, 0.8), shrine_halo, 4.5, 0.6)
	shrine_ring = ShaderMaterial.new()
	shrine_ring.shader = preload("res://shaders/ring.gdshader")
	var q := PlaneMesh.new()
	q.size = Vector2(7.6, 7.6)
	var mi := MeshInstance3D.new()
	mi.mesh = q
	mi.material_override = shrine_ring
	mi.position = c + Vector3(0, 0.125, 0)
	mi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	add_child(mi)
	shrine_light = OmniLight3D.new()
	shrine_light.position = c + Vector3(0, 2.2, 0.4)
	shrine_light.light_color = Palette.CORE
	shrine_light.light_energy = 0.0
	shrine_light.omni_range = 9.0
	shrine_light.shadow_enabled = false
	add_child(shrine_light)
	# the light the shrine leaves on: a pillar of light through its dome
	shrine_pillar = _pillar(self, c + Vector3(0, 7.0, 0.0), 1.3, 26.0)
	shrine_pillar.set_shader_parameter("fade", 0.0)
	# the second shrine, far away beyond the fog: faintly glowing, still asleep
	var c2 := Level.SECOND_SHRINE
	var sc2 := crystal(c2 + Vector3(0, 1.2, 0), 0.16, 0.3, true)
	(sc2[0] as Node3D).reparent(level.beyond)
	glow_quad(level.beyond, c2 + Vector3(0, 1.2, 0), 3.0, Palette.ACCENT, 0.45)
	far_pillar = _pillar(level.beyond, c2 + Vector3(0, 3.5, 0), 0.9, 22.0)
	far_pillar.set_shader_parameter("fade", 0.35)
	level.add_interact("sealed", Vector3(28.0, 2.0, -38.3), "locked", func() -> void: event.emit("sealed", null), 1.0)
	level.add_interact("shrine", c + Vector3(0, 0, 1.85), "wake", func() -> void: event.emit("shrine", null), 1.2,
		func() -> bool: return not state["shrine"])

func _pillar(parent: Node3D, base: Vector3, width: float, height: float) -> ShaderMaterial:
	var m := ShaderMaterial.new()
	m.shader = preload("res://shaders/beam.gdshader")
	m.set_shader_parameter("color", Palette.CORE)
	m.set_shader_parameter("lit", 1.0)
	var q := QuadMesh.new()
	q.size = Vector2(width, height)
	var mi := MeshInstance3D.new()
	mi.mesh = q
	mi.material_override = m
	mi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	mi.position = base + Vector3(0, height * 0.5, 0)
	mi.extra_cull_margin = 10.0
	parent.add_child(mi)
	return m

func set_shrine_awake(k: float, sweep: float) -> void:
	shrine_pillar.set_shader_parameter("fade", k * 0.8)
	set_crystal_lit(shrine_crystal_mat, k)
	shrine_halo.set_shader_parameter("intensity", k * 0.8)
	shrine_ring.set_shader_parameter("lit", minf(1.0, k * 3.0))
	shrine_ring.set_shader_parameter("sweep", sweep)
	shrine_light.light_energy = k * 2.2

# ------------------------------------------------------------------ hidden tablet (glimpse 2 target)
func _tablet() -> void:
	tablet_mat = ShaderMaterial.new()      # (v0.3: the tablet carries engraved script instead)
	level.ob_rect(Level.R(4.15, -20.4, 4.6, -19.4))
	level.inscription("h_tablet", Vector3(3.85, 1.0, -19.9), "She writes from the far side of the glass.\nRead her as she reads.", 0.95,
		Transform3D(Basis(Vector3.UP, -PI * 0.5), Vector3(4.165, 1.38, -19.9)), Vector2(0.8, 0.56))

# ------------------------------------------------------------------ reflectors
func _reflectors() -> void:
	# 1. the first pool (glimpse 1: it lags, and something is slightly wrong)
	var r := Reflector.new()
	r.kind = "pool"; r.plane_n = Vector3.UP; r.plane_d = Ch1Geo.WATER_Y
	r.surface_col = Vector3(0.45, 0.5, 0.53); r.surface_mix = 0.12
	r.clip_c = Vector3(-5.125, Ch1Geo.WATER_Y, 1.7); r.clip_u = Vector3.RIGHT; r.clip_v = Vector3.BACK; r.clip_h = Vector2(4.47, 1.86)
	r.region = Level.R(-13, -5, 5, 5); r.near_rect = Level.R(-9.6, -0.2, -0.6, 3.6); r.near = 3.2
	r.lag = 0.42; r.wrong = 1.0; r.alpha = 0.88
	_add_refl(r); pool_refl = r
	# 2. the polished floor of the hall (faint)
	r = Reflector.new()
	r.kind = "floor"; r.plane_n = Vector3.UP; r.plane_d = 1.0
	r.surface_col = Vector3(0.08, 0.085, 0.095); r.surface_mix = 0.62
	r.clip_c = Vector3(0, 1.0, -15.8); r.clip_u = Vector3.RIGHT; r.clip_v = Vector3.BACK; r.clip_h = Vector2(4.6, 4.8)
	r.region = Level.R(-4.6, -20.6, 4.6, -11); r.alpha = 0.26
	_add_refl(r)
	# 3. the great mirror (glimpse 2: it looks toward the hidden tablet)
	r = Reflector.new()
	r.kind = "mirror"; r.plane_n = Vector3.BACK; r.plane_d = -20.56
	r.clip_c = Vector3(0, 3.38, -20.56); r.clip_u = Vector3.RIGHT; r.clip_v = Vector3.UP; r.clip_h = Vector2(2.58, 2.2)
	r.region = Level.R(-4.6, -20.6, 4.6, -14.5); r.alpha = 0.78
	r.gaze_target = TABLET_POS
	var hm := _mirror_quad(Vector3(0, 3.38, -20.575), Basis(), Vector2(5.2, 4.45))
	var pm := PlanarMirror.new()
	add_child(pm)
	pm.setup(Vector3.BACK, -20.575, hm, game.world.env)
	r.planar = pm
	_add_refl(r); hall_mirror = r
	_pane(Vector3(-2.4, 1.0, -15.6), 0.0, Vector2(1.6, 2.6), false)
	_pane(Vector3(2.2, 1.0, -14.6), -PI * 0.5, Vector2(1.6, 2.2), true)      # (v0.9: lower, so the shard by the door shows over it)
	# 4. the great Eidolon glass: the reflection steps out of the frame and walks the other world
	r = Reflector.new()
	r.kind = "eidolon"; r.plane_n = Vector3.BACK; r.plane_d = GLASS_Z
	r.project = false; r.ghost = 1.0; r.alpha = 0.62
	r.region = Level.R(21, -25, 29, -19)
	_add_refl(r); eidolon_refl = r
	# 5. v0.6: her great glass in the Court of Light
	_add_refl(court_refl)

const HALL_COLS := [Vector4(-4.5, -12.2, 0.3, 4.2), Vector4(-4.5, -14.8, 0.3, 4.2), Vector4(-4.5, -17.4, 0.3, 4.2),
	Vector4(-4.5, -19.9, 0.3, 4.2), Vector4(-3.3, -11.3, 0.3, 4.2), Vector4(3.3, -11.3, 0.3, 4.2)]

func _mirror_quad(center: Vector3, basis: Basis, size: Vector2, cracked := false, wall_mounted := -1.0) -> ShaderMaterial:
	var m := ShaderMaterial.new()
	m.shader = preload("res://shaders/mirror.gdshader")
	m.set_shader_parameter("noise_tex", level.noise_tex)
	m.set_shader_parameter("n", basis * Vector3.BACK)
	m.set_shader_parameter("floor_y", 1.0)
	m.set_shader_parameter("size", size)
	m.set_shader_parameter("cols", HALL_COLS)
	m.set_shader_parameter("ncols", HALL_COLS.size())
	m.set_shader_parameter("crack", 1.0 if cracked else 0.0)
	m.set_shader_parameter("wall_mounted", wall_mounted if wall_mounted >= 0.0 else (1.0 if absf(center.z + 20.575) < 0.01 else 0.0))
	var q := QuadMesh.new()
	q.size = size
	var g := MeshInstance3D.new()
	g.mesh = q
	g.material_override = m
	g.transform = Transform3D(basis, center)
	g.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	# (QA P1-5) no glass is ever drawn by a reflection camera: a mirror must never render into the very
	# viewport it samples (the WebGL feedback loop)
	g.layers = PlanarMirror.LAYER_MAIN_FX
	add_child(g)
	var om := ShaderMaterial.new()
	om.shader = preload("res://shaders/mirror_over.gdshader")
	om.render_priority = 1                 # the sheen always draws over the glass, under breath / runes
	om.set_shader_parameter("size", size)
	var o := MeshInstance3D.new()
	o.mesh = q
	o.material_override = om
	o.transform = Transform3D(basis, center + basis * Vector3(0, 0, 0.045))
	o.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	o.layers = PlanarMirror.LAYER_MAIN_FX
	add_child(o)
	return m

func _add_refl(r: Reflector) -> void:
	add_child(r)
	r.setup()
	reflectors.append(r)

func _pane(base: Vector3, yaw: float, size: Vector2, cracked: bool) -> void:
	## a free-standing mirror pane on a stone foot; reflective on its front (+z rotated by yaw)
	var B := Basis(Vector3.UP, yaw)
	var c := base + Vector3(0, 0.22 + size.y * 0.5, 0)
	_mirror_quad(c, B, size, cracked)
	var fm := MB.new()
	var fc := Color(0.5, 1.0, 1.0)
	fm.box(base + Vector3(0, 0.11, 0), (B * Vector3(size.x + 0.5, 0.22, 0.6)).abs(), Color(0.5, 0.25, 0.0))
	fm.box(c + B * Vector3(-size.x * 0.5 - 0.04, 0, 0), Vector3(0.08, size.y + 0.1, 0.08), fc)
	fm.box(c + B * Vector3(size.x * 0.5 + 0.04, 0, 0), Vector3(0.08, size.y + 0.1, 0.08), fc)
	fm.box(c + Vector3(0, size.y * 0.5 + 0.05, 0), (B * Vector3(size.x + 0.18, 0.1, 0.1)).abs(), fc)
	marble_instance(fm.commit(), self)
	var half := (B * Vector3(size.x * 0.5 + 0.25, 0, 0.3)).abs()
	level.ob_rect(Level.R(base.x - half.x, base.z - half.z, base.x + half.x, base.z + half.z))
	var n := B * Vector3.BACK
	var r := Reflector.new()
	r.kind = "mirror"; r.plane_n = n; r.plane_d = n.dot(c)
	r.clip_c = c; r.clip_u = B * Vector3.RIGHT; r.clip_v = Vector3.UP; r.clip_h = size * 0.5 - Vector2(0.03, 0.03)
	var front := Vector2(n.x, n.z)
	var cc := Vector2(c.x, c.z) + front * 2.2
	r.region = Rect2(cc - Vector2(2.4, 2.4), Vector2(4.8, 4.8))
	r.alpha = 0.72
	_add_refl(r)

# ------------------------------------------------------------------ per frame / save
var _beam_once := false
func update(dt: float) -> void:
	_t += dt
	if game.prof_on:
		for r in reflectors:
			var t0 := Time.get_ticks_usec()
			r.update(dt, game.player, game.world.cam_back)
			game._pm("refl:" + r.kind + ("*" if r.active else ""), t0)
	else:
		for r in reflectors: r.update(dt, game.player, game.world.cam_back)
	var tp := Time.get_ticks_usec() if game.prof_on else 0
	# (v0.8.5) the beam only changes in the court (its mirrors turn there): far from it, the beam drawn
	# last stays as it is and is not traced again every frame
	var pc: Vector3 = game.player.position
	if not _beam_once or Vector2(pc.x - 12.0, pc.z + 22.0).length() < 18.0 or busy:
		_beam_once = true
		_update_beam(dt)
	if game.prof_on: tp = game._pm("pz:beam", tp)
	_update_plate(dt)
	if game.prof_on: tp = game._pm("pz:plate", tp)
	# the numbered statues' runes brighten and pulse as you come near
	for i in statue_mats.size():
		var dd := Vector2(statue_pos[i].x - game.player.position.x, statue_pos[i].z - game.player.position.z).length()
		var near := 1.0 - smoothstep(1.5, 4.5, dd)
		statue_mats[i].set_shader_parameter("lit", 0.7 + 0.3 * near)
		statue_mats[i].set_shader_parameter("flare", near * (0.35 + 0.3 * sin(_t * 2.6 + i)))
	source_crystal.rotation.y += dt * 0.6
	target_crystal.rotation.y += dt * (0.6 if state["bridge"] else 0.1)
	shrine_crystal.rotation.y += dt * 0.4
	shrine_crystal.position.y = SHRINE_C.y + 1.75 + crystal_lift + sin(_t * 0.8) * 0.05
	if eidolon_refl:
		ghost_path_mat.set_shader_parameter("visible", eidolon_refl.vis)
		ghost_path_mat.set_shader_parameter("near_pos", eidolon_refl.reflect_point(game.player.global_position))
		eid_glass_mat.set_shader_parameter("pulse", eidolon_refl.vis * (0.15 + 0.1 * sin(_t * 1.3)))
	if hall_mirror:
		var k := 0.25 if state["tablet"] else 0.0
		k = maxf(k, hall_mirror.gaze_body * 0.5)
		tablet_mat.set_shader_parameter("lit", k)

func apply_state(s: Dictionary) -> void:
	_beam_once = false              # (v0.8.5: the beam is traced again for the new state)
	_beam_angles = []
	for k in s.keys():
		if state.has(k): state[k] = s[k]
	if (state["mirrors"] as Array).size() != STAND_POS.size(): state["mirrors"] = MIRROR_START.duplicate()      # (a v0.5 save)
	decoy_t = 0.0
	if state["shortcut"]: open_gate(true)
	_apply_mirrors(true)
	if state["bridge"]: _lower_bridge(true)
	if state.get("drawbridge", false): lower_drawbridge(true)
	if state["plate"]: _press_plate(true)
	if state["shrine"]: set_shrine_awake(1.0, 1.0)
