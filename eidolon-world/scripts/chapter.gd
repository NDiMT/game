class_name Chapter
extends Node3D
## v0.5: Chapter I, "The Veiled Gate", the long version: the puzzles of the new spaces (the
## geometry is in ch1_geo.gd; the beam, the eidolon plate and the shrine stay in puzzles.gd).
##
##  1 Waking Pool     ripples: only standing still calms the pool, and the still water shows
##                    stepping stones that exist only in the reflection; once seen, they hold you
##  2 Stair of Breath breathe on a small glass: from the other side she writes one rune, "follow me"; the veil
##                    of mist over the stair dissolves
##  3 Hall of Glass   the great mirror remembers a doorway where there is a wall; touch the glass and
##                    she gives you the MIRROR SHARD, and the doorway is real again
##  4 Shard Gallery   raise the shard: through it you see hidden runes, which doorways are false, and
##                    the passage that is real; touch it to open it
##  5 Garden          THE TURNED ONES: three veiled statues on plinths that turn; the rune facing the
##                    mirror is seen only in the mirror; her breath-writing gives the runes as SHE sees
##                    them (reversed for you); a correct rune glows in the glass; the door opens in the
##                    reflection first, then in your world
##  6 Hollow Walk     hollow statues step toward you only while you stand still, and not while you
##                    look at them; guide one onto each plate
##  7 Court of Light  (the beam: puzzles.gd) then the lit crystal throws your veil's shadow on her
##                    mural: fit it into the missing head
##  8 Mist Maze       invisible walls in a white mist; her petrol footprints in the pool beside the
##                    maze walk the true path, mirrored
##  9 Echo Corridor   your steps echo; by one stretch of wall the echo is hollow: a hidden room keeps
##                    the first hidden memory (optional)
## 10 The Scales      the scale weighs only what the glass shows, and in the glass you weigh nothing:
##                    turn the glass to see the lift, step on, and it rises
## 11 Eidolon Ledge   (the plate: puzzles.gd) her footprints in her world lead to the plate
## 12 Gate of Four    three veiled statues and an empty plinth face the shrine: stand on the empty one,
##                    face the shrine, be still, and the gate counts you as the fourth
## 13 First Shrine    (puzzles.gd) + the closing cinematic, "The Hand in the Water"

signal event(name: String, data: Variant)

const L_LIGHT := Vector3(16.3, 2.4, -24.2)          # the lit crystal's light falls from here (mural)
const MURAL_Z := -26.93
const MURAL_HEAD := Vector2(12.0, 3.3)               # where the head is missing (x, y on the wall)
const TURN_FACES := [[[6, 0.0], [6, 1.0], [3, 0.0], [5, 0.0]], [[7, 1.0], [7, 0.0], [4, 0.0], [0, 0.0]],
	[[8, 0.0], [3, 0.0], [8, 1.0], [5, 0.0]]]        # per statue: faces N, E, S, W at rest: [design, flip]
const TURN_SOLUTION := [0, 1, 0]                       # orientation that puts the true rune toward the glass
const TURN_START := [2, 3, 1]
const TURN_X := [10.6, 12.0, 13.4]
const TURN_Z := -13.5
const SCALES_MIRROR := Vector3(29.0, 2.0, -46.6)
const PAN_A := Vector3(31.4, 2.0, -45.6)
const PAN_B := Vector3(27.8, 2.0, -50.6)
const FOUR_R := 3.9
const FOUR_ANGLES := [20.0, 160.0, -20.0, -160.0]      # degrees round the tholos; the last is empty
const MEMORY_1 := "I took the goddess's mirror from her shrine.\nShe did not stop me. She only watched."

var game: Game
var level: Level
var puzzles: Puzzles
var state := {}
var calm := 0.0
var lens_on := false
var lens_px := Vector4.ZERO
var _t := 0.0
var _moved := false

# pool / stair
var stone_mats: Array[ShaderMaterial] = []
var breath_mats := {}              # id -> ShaderMaterial
var stair_veil: ShaderMaterial
var _breathing := ""
# hall / gallery
var shard_node: Node3D
var hall_mirror_mat: ShaderMaterial
var gls_mat: ShaderMaterial
# garden
var garden_refl: Reflector
var turn_pivots: Array[Node3D] = []
var turn_face_mats: Array = []     # per statue: 4 ShaderMaterials
var turn_tw: Array = [null, null, null]
var door_real: Array[Node3D] = []
var door_refl: Array[Node3D] = []
# hollow walk
var hollow_nodes: Array[Node3D] = []
var hollow_glints: Array[ShaderMaterial] = []
var hollow_obs: Array = []
var plate_mats: Array[ShaderMaterial] = []
var hw_gate: Node3D
var _still := 0.0
var _tick := 0.0
var hollow_moving := false
# court mural
var mural_mat: ShaderMaterial
var mural_hold := 0.0
var shadow_world := Vector3.INF
# maze
var maze_mist: ShaderMaterial
var shimmers: Array[MeshInstance3D] = []
var _shim_i := 0
var _bump_cd := 0.0
var maze_feet: Array[MeshInstance3D] = []
var maze_feet_t: Array[float] = []
var _maze_loop := 0.0
# echo
var crack_mat: ShaderMaterial
var echo_heard := 0
var _echo_flash := 0.0
# scales
var lift_node: Node3D
var panb_node: Node3D
var arm_node: Node3D
var scale_mirror: Node3D
var scale_gaze: ShaderMaterial
var pan_a_mat: ShaderMaterial
var pan_b_mat: ShaderMaterial
var lift_h := 0.0
var arm_half := 3.0
var rods: Array[MeshInstance3D] = []
var _groan_cd := 0.0
# ledge footprints
var ledge_feet: Array[MeshInstance3D] = []
var ledge_feet_t: Array[float] = []
var _ledge_loop := 0.0
# gate of four
var four_mats: Array[ShaderMaterial] = []
var four_ring: ShaderMaterial
var four_hold := 0.0
var gap_veils: Array[ShaderMaterial] = []
var front_veil: ShaderMaterial
var waiting := 0.0
# shrine pool
var shrine_water: ShaderMaterial
var shrine_over: ShaderMaterial
# hints
var hint_t := 0.0
var hint_area := ""
var _hint_cd := 0.0
var wisp: MeshInstance3D
var wisp_mat: ShaderMaterial

func _init(g: Game) -> void:
	game = g
	level = g.level
	puzzles = g.puzzles
	reset_state()

func reset_state() -> void:
	state = {"stones": false, "breath": false, "shard": false, "hall_door": false, "gallery": false,
		"turned": TURN_START.duplicate(), "turned_done": false, "garden_breath": false,
		"hollows": [[5, 2], [1, 1]], "hollow_lock": [false, false], "hollow_done": false,
		"mural": false, "maze": false, "echo_room": false, "memories": [], "scales_mirror": 0, "scales": false,
		"four": false}

# ================================================================== build (before level.commit)
func build() -> void:
	_build_pool()
	_build_stair()
	_build_hall()
	_build_gallery()
	_build_garden()
	_build_hollow()
	_build_mural()
	_build_maze()
	_build_echo()
	_build_scales()
	_build_ledge_feet()
	_build_four()
	_build_shrine_pool()
	_build_wisp()

## after level.commit: the zone meshes exist now
func post_commit() -> void:
	var hd := level.get_node_or_null("Zone_Hdoor") as MeshInstance3D
	if hd: hd.layers = PlanarMirror.LAYER_MAIN_FX            # the mirror remembers no wall there
	var gn := level.get_node_or_null("Zone_Gn") as MeshInstance3D
	if gn: gn.layers = PlanarMirror.LAYER_BEHIND
	var gls := level.get_node_or_null("Zone_GLs") as MeshInstance3D
	if gls:
		gls_mat = level.marble_mat.duplicate()
		gls_mat.set_shader_parameter("lens_hide", 1.0)
		gls.material_override = gls_mat
	apply_state()

func _mi(mesh: Mesh, mat: Material, xf: Transform3D, parent: Node3D = null) -> MeshInstance3D:
	var mi := MeshInstance3D.new()
	mi.mesh = mesh
	mi.material_override = mat
	mi.transform = xf
	mi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	(parent if parent else self).add_child(mi)
	return mi

func _smat(path: String, params := {}) -> ShaderMaterial:
	var m := ShaderMaterial.new()
	m.shader = load(path)
	for k in params: m.set_shader_parameter(k, params[k])
	return m

func _quad(size: Vector2) -> QuadMesh:
	var q := QuadMesh.new()
	q.size = size
	return q

func _plane(size: Vector2) -> PlaneMesh:
	var q := PlaneMesh.new()
	q.size = size
	return q

## a veiled statue as its own mesh (it moves or turns): local origin at the base
func _statue_mesh(sc: float, plinth: float, mat_id := 0.25) -> ArrayMesh:
	var m := MB.new()
	var col := Color(0.5, mat_id, 0.0, 1.0)
	var y := plinth + 0.08
	var at := func(x: float, yy: float, z: float) -> Vector3: return Vector3(x, y + yy, z) * Vector3(1, 1, 1) * 1.0 if false else Vector3(x * sc, y + yy * sc, z * sc)
	if plinth > 0.01:
		m.box(Vector3(0, plinth * 0.5, 0), Vector3(0.95 * sc, plinth, 0.95 * sc), col)
		m.box(Vector3(0, plinth + 0.04, 0), Vector3(1.08 * sc, 0.08, 1.08 * sc), col)
	m.cyl(at.call(0, 0.62, 0), 0.25 * sc, 0.34 * sc, 1.24 * sc, col, 14, Basis(Vector3.BACK, 0.03))
	m.cyl(at.call(0, 1.5, 0.01), 0.27 * sc, 0.23 * sc, 0.56 * sc, col, 14)
	m.sphere(at.call(0, 1.78, 0.01), Vector3(0.30, 0.10, 0.19) * sc, col, 14, 5)
	for sx in [-1.0, 1.0]:
		m.cyl(at.call(sx * 0.27, 1.55, 0.0), 0.065 * sc, 0.075 * sc, 0.46 * sc, col, 8, Basis(Vector3.BACK, sx * 0.12))
		m.cyl(at.call(sx * 0.13, 1.36, -0.13), 0.06 * sc, 0.065 * sc, 0.34 * sc, col, 8, Basis(Vector3.BACK, -sx * 1.15) * Basis(Vector3.RIGHT, 0.3))
	m.sphere(at.call(0, 1.33, -0.19), Vector3(0.09, 0.07, 0.07) * sc, col, 8, 4)
	var hb := Basis(Vector3.RIGHT, -0.20)
	m.cyl(at.call(0, 1.94, 0.02), 0.14 * sc, 0.25 * sc, 0.34 * sc, col, 14)
	m.sphere(at.call(0, 2.12, 0.0), Vector3(0.155, 0.19, 0.17) * sc, col, 14, 7, hb)
	m.sphere(at.call(0, 2.11, -0.075), Vector3(0.10, 0.13, 0.09) * sc, col, 10, 5, hb)
	m.sphere(at.call(0, 2.19, 0.03), Vector3(0.165, 0.15, 0.17) * sc, col, 12, 6, hb)
	return m.commit()

# ------------------------------------------------------------------ 1. waking pool
func _build_pool() -> void:
	var sh := preload("res://shaders/stone_ghost.gdshader")
	for i in Ch1Geo.STONES.size():
		var c: Vector2 = Ch1Geo.STONES[i]
		var m := ShaderMaterial.new()
		m.shader = sh
		m.set_shader_parameter("noise_tex", level.noise_tex)
		m.set_shader_parameter("seed", i * 0.37)
		_mi(_plane(Vector2(Ch1Geo.STONE, Ch1Geo.STONE)), m, Transform3D(Basis(), Vector3(c.x, -0.018, c.y)))
		stone_mats.append(m)
		var h := Ch1Geo.STONE * 0.5
		level.walk(Level.R(c.x - h, c.y - h, c.x + h, c.y + h), 0.0, NAN, -1, "stone%d" % i, false)

func _update_pool(dt: float) -> void:
	var p := game.player.position
	var q := Vector2(p.x, p.z)
	var pool := Level.R(-9.6, -0.2, -0.6, 3.6)
	var cq := Vector2(clampf(q.x, pool.position.x, pool.end.x), clampf(q.y, pool.position.y, pool.end.y))
	var near := cq.distance_to(q) < 1.8 and absf(p.y) < 0.4
	var still := game.player.speed01 < 0.04 and game.mode == "play" and _moved
	var target := 0.0
	if near: target = 1.0 if still else 0.0
	else: target = 0.4
	calm = move_toward(calm, target, dt * (0.42 if target > calm else 1.6))
	puzzles.water_over_mat.set_shader_parameter("calm", calm)
	if puzzles.pool_refl: puzzles.pool_refl.puppet.set_param("ripple_amt", 1.0 - calm)
	var rev := calm * calm * calm
	if state["stones"]: rev = maxf(0.38, rev)
	for m in stone_mats: m.set_shader_parameter("reveal", rev)
	if not state["stones"] and calm > 0.97 and near:
		_reveal_stones(false)

func _reveal_stones(instant: bool) -> void:
	state["stones"] = true
	for i in Ch1Geo.STONES.size(): level.set_enabled("stone%d" % i, true)
	if not instant: event.emit("solve", "waking_pool")

# ------------------------------------------------------------------ 2. stair of breath
## a small glass to breathe on (own_glass false: a patch of a larger mirror that is already there)
func _breath_glass(id: String, center: Vector3, basis: Basis, size: Vector2, glyphs: Vector3, vertical: bool, own_glass := true) -> void:
	if own_glass:
		var mm := puzzles._mirror_quad(center, basis, size, false, 1.0)
		mm.set_shader_parameter("floor_y", center.y - 1.2)
		mm.set_shader_parameter("ncols", 0)
	var bm := _smat("res://shaders/breath.gdshader", {"noise_tex": level.noise_tex, "glyphs": glyphs, "flip": 1.0,
		"size": size, "vertical": 1.0 if vertical else 0.0})
	var mi := _mi(_quad(size), bm, Transform3D(basis, center + basis * Vector3(0, 0, 0.06)))
	mi.layers = PlanarMirror.LAYER_MAIN_FX
	breath_mats[id] = bm

func _build_stair() -> void:
	_breath_glass("stair", Vector3(-10.23, 1.75, -5.3), Basis(Vector3.UP, -PI * 0.5), Vector2(1.0, 1.25), Vector3(99, -1, -1), false)
	level.add_interact("breathe_stair", Vector3(-11.1, 0.5, -5.3), "breathe", func() -> void: breathe("stair"), 1.25)
	stair_veil = _smat("res://shaders/mist_veil.gdshader", {"noise_tex": level.noise_tex, "density": 1.0, "glow": 0.35})
	_mi(_quad(Vector2(1.9, 3.2)), stair_veil, Transform3D(Basis(), Vector3(-11.3, 0.5 + 1.6, -6.8)))

## breathe on a small glass; from the other side she writes in the fog
func breathe(id: String) -> void:
	if _breathing != "": return
	_breathing = id
	var m: ShaderMaterial = breath_mats[id]
	game.player.locked = true
	event.emit("breath", id)
	var tw := create_tween()
	tw.tween_method(func(v: float) -> void: m.set_shader_parameter("fog", v), 0.0, 1.0, 1.1)
	tw.tween_interval(0.5)
	tw.tween_callback(func() -> void: event.emit("writing", id))
	tw.tween_method(func(v: float) -> void: m.set_shader_parameter("write", v), 0.0, 1.0, 2.6 if id == "stair" else 4.2)
	tw.tween_callback(func() -> void:
		game.player.locked = false
		_breathing = ""
		_breath_done(id))
	tw.tween_interval(9.0)
	tw.tween_method(func(v: float) -> void: m.set_shader_parameter("fog", v), 1.0, 0.0, 5.0)
	tw.tween_callback(func() -> void: m.set_shader_parameter("write", 0.0))

func _breath_done(id: String) -> void:
	if id == "stair" and not state["breath"]:
		_open_stair(false)
	elif id == "garden":
		state["garden_breath"] = true

func _open_stair(instant: bool) -> void:
	state["breath"] = true
	level.set_enabled("breath_gate", false)
	if instant:
		stair_veil.set_shader_parameter("density", 0.0)
		return
	var tw := create_tween()
	tw.tween_method(func(v: float) -> void: stair_veil.set_shader_parameter("density", v), 1.0, 0.0, 2.5)
	event.emit("solve", "stair_breath")

# ------------------------------------------------------------------ 3. hall of glass
func _build_hall() -> void:
	# the doorway as the glass remembers it (seen only in the reflection): warm light in the opening
	var dm := _smat("res://shaders/mist_veil.gdshader", {"noise_tex": level.noise_tex, "density": 0.55, "glow": 1.0})
	var d := _mi(_quad(Vector2(1.7, 2.7)), dm, Transform3D(Basis(Vector3.UP, -PI * 0.5), Vector3(4.82, 2.35, -17.5)))
	d.layers = PlanarMirror.LAYER_DOUBLE
	level.add_interact("touch_glass", Vector3(0.0, 1.0, -19.75), "touch", touch_glass, 1.4,
		func() -> bool: return not state["shard"])
	# the shard: a sliver of mirror, glowing
	shard_node = Node3D.new()
	add_child(shard_node)
	var st := SurfaceTool.new()
	st.begin(Mesh.PRIMITIVE_TRIANGLES)
	var pts := [Vector3(0, 0.22, 0), Vector3(-0.07, -0.12, 0.012), Vector3(0.09, -0.16, -0.012)]
	for k in [0, 1, 2]: st.add_vertex(pts[k])
	for k in [0, 2, 1]: st.add_vertex(pts[k])
	st.generate_normals()
	var sm := StandardMaterial3D.new()
	sm.albedo_color = Color(0.75, 0.85, 0.9)
	sm.emission_enabled = true
	sm.emission = Palette.CORE
	sm.emission_energy_multiplier = 1.6
	sm.metallic_specular = 1.0
	sm.roughness = 0.05
	_mi(st.commit(), sm, Transform3D(), shard_node)
	puzzles.glow_quad(shard_node, Vector3.ZERO, 0.9, Palette.ACCENT, 0.7)
	shard_node.visible = false

## touch the great glass: her hand meets yours from the other side and leaves you a shard of mirror
func touch_glass() -> void:
	if state["shard"]: return
	var pl := game.player
	pl.locked = true
	pl.extra_reach = 0.0
	var refl: Reflector = puzzles.hall_mirror
	event.emit("touch_glass", null)
	var tw := create_tween()
	tw.tween_property(pl, "extra_reach", 1.0, 1.0).set_trans(Tween.TRANS_SINE)
	tw.parallel().tween_property(refl, "reach_override", 1.0, 1.0).set_trans(Tween.TRANS_SINE)
	tw.tween_callback(func() -> void:
		shard_node.visible = true
		shard_node.global_position = Vector3(pl.position.x * 0.5, 2.3, -20.45))
	tw.tween_interval(0.6)
	tw.tween_method(func(k: float) -> void:
		var a := Vector3(pl.position.x * 0.5, 2.3, -20.45)
		var b := pl.position + Vector3(0, 0.9, 0)
		shard_node.global_position = a.lerp(b, k) + Vector3(0, sin(k * PI) * 0.35, 0)
		shard_node.rotation.y = k * TAU * 1.5, 0.0, 1.0, 1.4).set_trans(Tween.TRANS_SINE)
	tw.tween_callback(func() -> void:
		shard_node.visible = false
		state["shard"] = true
		game.ui.set_inventory(true, false)
		event.emit("shard", null))
	tw.tween_property(pl, "extra_reach", 0.0, 0.8)
	tw.parallel().tween_property(refl, "reach_override", 0.0, 0.8)
	tw.tween_callback(func() -> void:
		refl.reach_override = -1.0
		pl.locked = false
		_open_hall_door(false))

func _open_hall_door(instant: bool) -> void:
	state["hall_door"] = true
	level.set_enabled("hdoor", true)
	var hd := level.get_node_or_null("Zone_Hdoor") as MeshInstance3D
	if hd == null: return
	if instant:
		hd.visible = false
		return
	var tw := create_tween()
	tw.tween_property(hd, "position:y", -2.9, 2.6).set_trans(Tween.TRANS_SINE).set_ease(Tween.EASE_IN_OUT)
	tw.tween_callback(func() -> void: hd.visible = false)
	event.emit("solve", "hall_glass")

# ------------------------------------------------------------------ 4. shard gallery
func _build_gallery() -> void:
	var lsh := preload("res://shaders/lens_only.gdshader")
	var mk := func(kind: float, design: float) -> ShaderMaterial:
		var m := ShaderMaterial.new()
		m.shader = lsh
		m.set_shader_parameter("noise_tex", level.noise_tex)
		m.set_shader_parameter("kind", kind)
		m.set_shader_parameter("design", design)
		return m
	var west := Basis(Vector3.UP, -PI * 0.5)       # a quad facing -x (into the gallery from its east wall)
	var east := Basis(Vector3.UP, PI * 0.5)
	# the true passage: an archway of light where the wall seems solid
	_mi(_quad(Vector2(1.6, 3.0)), mk.call(2.0, 0.0), Transform3D(west, Vector3(6.83, 2.5, -8.5)))
	# the false doorways: through the shard they are plain wall
	for zz in [-15.6, -12.6]:
		_mi(_quad(Vector2(1.7, 3.0)), mk.call(1.0, 0.0), Transform3D(west, Vector3(6.76, 2.5, zz)))
	# runes only the shard shows: a trail along the floor, and one over the true arch
	var flat := Basis(Vector3.RIGHT, -PI * 0.5)
	for i in 3:
		_mi(_quad(Vector2(0.75, 0.75)), mk.call(0.0, 2.0), Transform3D(flat * Basis(Vector3.BACK, 0.0), Vector3(6.0, 1.02, [-15.0, -12.2, -9.9][i])))
	_mi(_quad(Vector2(0.6, 0.6)), mk.call(0.0, 1.0), Transform3D(west, Vector3(6.8, 4.15, -8.5)))
	# a cracked mirror pane or two on the west wall (they glint)
	for zz in [-16.4, -13.8, -11.0, -7.4]:
		var pm := puzzles._mirror_quad(Vector3(5.03, 2.5, zz), east, Vector2(0.9, 1.9), true, 1.0)
		pm.set_shader_parameter("ncols", 0)
	level.add_interact("raise_shard", Vector3(6.0, 1.0, -12.0), "shard", func() -> void: set_lens(true), 7.0,
		func() -> bool: return state["shard"] and not lens_on and not state["gallery"] and _in_gallery())
	level.add_interact("gallery_secret", Vector3(6.4, 1.0, -8.5), "touch", open_gallery, 1.15,
		func() -> bool: return lens_on and not state["gallery"])

func _in_gallery() -> bool:
	var p := game.player.position
	return p.x > 4.9 and p.x < 7.1 and p.z > -18.5 and p.z < -5.5

func set_lens(on: bool) -> void:
	if on and not state["shard"]: return
	if on == lens_on: return
	lens_on = on
	event.emit("lens", on)
	game.ui.set_inventory(state["shard"], on)
	if not on:
		RenderingServer.global_shader_parameter_set("shard_lens", Vector4.ZERO)
		game.ui.set_lens(false, Vector2.ZERO, 0.0)

func toggle_lens() -> void:
	set_lens(not lens_on)

func _update_lens() -> void:
	if not lens_on: return
	var vp := get_viewport()
	var cam := game.world.cam
	var sp := cam.unproject_position(game.player.position + Vector3(0, 0.9, 0))
	var vis := vp.get_visible_rect().size
	var r := vis.x * 0.36
	# 3D shaders see FRAGCOORD in render-target pixels (window size x the 3D render scale)
	var k := Vector2(vp.size) * vp.scaling_3d_scale / vis
	lens_px = Vector4(sp.x * k.x, sp.y * k.y, r * k.x, 1.0)
	RenderingServer.global_shader_parameter_set("shard_lens", lens_px)
	game.ui.set_lens(true, sp, r)

func open_gallery(instant := false) -> void:
	state["gallery"] = true
	level.set_enabled("gallery_secret", false)
	var gls := level.get_node_or_null("Zone_GLs") as MeshInstance3D
	if gls == null: return
	if instant:
		gls.visible = false
		return
	event.emit("solve", "shard_gallery")
	var tw := create_tween()
	tw.tween_property(gls, "position:y", -3.2, 2.4).set_trans(Tween.TRANS_SINE).set_ease(Tween.EASE_IN_OUT)
	tw.tween_callback(func() -> void: gls.visible = false)

# ------------------------------------------------------------------ 5. garden: the turned ones
func _build_garden() -> void:
	# the great glass on the garden's north edge, a real planar reflection (shared with the Hall)
	var mm := puzzles._mirror_quad(Vector3(12.0, 3.3, -14.93), Basis(), Vector2(5.9, 4.4), false, 1.0)
	mm.set_shader_parameter("ncols", 0)
	var pm := PlanarMirror.new()
	add_child(pm)
	pm.setup(Vector3.BACK, -14.93, mm, game.world.env)
	var r := Reflector.new()
	r.kind = "mirror"; r.plane_n = Vector3.BACK; r.plane_d = -14.92
	r.clip_c = Vector3(12.0, 3.3, -14.92); r.clip_u = Vector3.RIGHT; r.clip_v = Vector3.UP; r.clip_h = Vector2(2.9, 2.15)
	r.region = Level.R(7, -15, 17, -5)
	r.planar = pm
	puzzles._add_refl(r)
	garden_refl = r
	# the three turned ones
	var rsh: Shader = puzzles.rune_mat_shader
	var normals := [Basis(Vector3.UP, PI), Basis(Vector3.UP, PI * 0.5), Basis(), Basis(Vector3.UP, -PI * 0.5)]
	var dirs := [Vector3(0, 0, -1), Vector3(1, 0, 0), Vector3(0, 0, 1), Vector3(-1, 0, 0)]
	for i in 3:
		var pivot := Node3D.new()
		pivot.position = Vector3(TURN_X[i], 1.0, TURN_Z)
		add_child(pivot)
		var mi := MeshInstance3D.new()
		mi.mesh = _statue_mesh(0.9, 0.62)
		mi.material_override = level.marble_mat
		pivot.add_child(mi)
		var mats: Array[ShaderMaterial] = []
		for k in 4:
			var f: Array = TURN_FACES[i][k]
			var m := puzzles.rune_quad(pivot, Vector3(0, 0.31, 0) + dirs[k] * 0.478, Vector2(0.62, 0.62), normals[k], float(f[0]), 0.25)
			m.set_shader_parameter("mirror", f[1])
			mats.append(m)
		turn_face_mats.append(mats)
		turn_pivots.append(pivot)
		level.ob_circle(Vector2(TURN_X[i], TURN_Z), 0.55)
		# a fixed stone step before each, with its numeral (I, II, III)
		var sm := MB.new()
		sm.box(Vector3(TURN_X[i], 1.05, TURN_Z + 0.75), Vector3(0.9, 0.1, 0.42), Color(0.5, 0.25, 0.0))
		puzzles.marble_instance(sm.commit(), self)
		puzzles.rune_quad(self, Vector3(TURN_X[i], 1.105, TURN_Z + 0.75), Vector2(0.36, 0.36), Basis(Vector3.RIGHT, -PI * 0.5), -1.0, 0.45, float(i + 1))
		var idx := i
		level.add_interact("turn%d" % (i + 1), Vector3(TURN_X[i], 1.0, TURN_Z + 1.05), "turn", func() -> void: turn_statue(idx), 0.7,
			func() -> bool: return not state["turned_done"])
	# her message: a small glass on the gallery wall's garden face
	# her message: a small glass beside the great one
	# (a small glass of its own beside the great one: no statue stands between it and you)
	var wm := MB.new()
	var fc := Color(0.5, 1.0, 0.0)
	wm.box(Vector3(16.0, 1.25, -15.0), Vector3(1.2, 0.5, 0.5), Color(0.5, 0.25, 0.0))
	wm.box(Vector3(15.42, 2.3, -15.0), Vector3(0.1, 2.1, 0.12), fc)
	wm.box(Vector3(16.58, 2.3, -15.0), Vector3(0.1, 2.1, 0.12), fc)
	wm.box(Vector3(16.0, 3.38, -15.0), Vector3(1.26, 0.12, 0.14), fc)
	wm.box(Vector3(16.0, 2.3, -15.12), Vector3(1.1, 2.1, 0.1), Color(0.5, 0.25, 0.0))
	puzzles.marble_instance(wm.commit(), self)
	level.ob_rect(Level.R(15.35, -15.3, 16.65, -14.72))
	_breath_glass("garden", Vector3(16.0, 2.35, -14.93), Basis(), Vector2(1.05, 1.95), Vector3(6, 7, 8), true, true)
	level.add_interact("breathe_garden", Vector3(16.0, 1.0, -14.1), "breathe", func() -> void: breathe("garden"), 0.95)
	# the door east: its leaves in your world, and their twins only the mirror sees
	for twin in [false, true]:
		for s in [-1.0, 1.0]:
			var hinge := Vector3(16.95, 1.0, -11.8 + s * 0.8)
			var pv := Node3D.new()
			pv.position = hinge
			add_child(pv)
			var dm := MB.new()
			dm.box(Vector3(0, 1.6, -s * 0.4), Vector3(0.12, 3.2, 0.78), Color(0.5, 1.0, 0.0))
			dm.box(Vector3(0.07, 2.6, -s * 0.4), Vector3(0.03, 0.08, 0.6), Color(0.5, 0.25, 0.0))
			var dmi := puzzles.marble_instance(dm.commit(), pv)
			dmi.layers = PlanarMirror.LAYER_DOUBLE if twin else PlanarMirror.LAYER_MAIN_FX
			(door_refl if twin else door_real).append(pv)
	level.ob_rect(Level.R(16.8, -12.6, 17.15, -11.0), "g_door_ob")

func turn_statue(i: int) -> void:
	if state["turned_done"]: return
	var o: Array = state["turned"]
	o[i] = (int(o[i]) + 1) % 4
	event.emit("statue_turn", i)
	if turn_tw[i]: (turn_tw[i] as Tween).kill()
	var pv := turn_pivots[i]
	var goal := pv.rotation.y + PI * 0.5
	goal = roundf(goal / (PI * 0.5)) * PI * 0.5
	var tw := create_tween()
	turn_tw[i] = tw
	tw.tween_property(pv, "rotation:y", goal, 0.7).set_trans(Tween.TRANS_BACK).set_ease(Tween.EASE_OUT)
	tw.tween_callback(func() -> void:
		turn_tw[i] = null
		_apply_turned()
		_check_turned())

func _apply_turned(snap := false) -> void:
	var o: Array = state["turned"]
	for i in 3:
		if snap: turn_pivots[i].rotation.y = float(o[i]) * PI * 0.5
		var north := int(o[i]) % 4
		for k in 4:
			var m: ShaderMaterial = turn_face_mats[i][k]
			var good: bool = k == north and north == TURN_SOLUTION[i]
			m.set_shader_parameter("lit", 1.0 if good or state["turned_done"] and k == TURN_SOLUTION[i] else 0.25)
			m.set_shader_parameter("flare", 0.4 if good else 0.0)

func turned_correct() -> Array:
	var o: Array = state["turned"]
	var out := []
	for i in 3: out.append(int(o[i]) % 4 == TURN_SOLUTION[i])
	return out

func _check_turned() -> void:
	if state["turned_done"]: return
	if turned_correct() != [true, true, true]: return
	state["turned_done"] = true
	event.emit("solve", "garden_veiled")
	var tw := create_tween()
	tw.tween_method(func(v: float) -> void:
		for i in 3: (turn_face_mats[i][TURN_SOLUTION[i]] as ShaderMaterial).set_shader_parameter("flare", v), 0.4, 1.0, 0.8)
	tw.tween_callback(func() -> void: event.emit("door_reflection", null))
	# first in the reflection...
	for k in 2:
		tw.parallel().tween_property(door_refl[k], "rotation:y", [-1.0, 1.0][k] * PI * 0.55, 2.2).set_trans(Tween.TRANS_SINE)
	tw.tween_interval(1.2)
	# ...then in your world
	tw.tween_callback(func() -> void: event.emit("door_real", null))
	for k in 2:
		tw.parallel().tween_property(door_real[k], "rotation:y", [-1.0, 1.0][k] * PI * 0.55, 2.2).set_trans(Tween.TRANS_SINE)
	tw.tween_callback(func() -> void: _open_garden_door(true))

func _open_garden_door(instant: bool) -> void:
	level.set_enabled("g_door_ob", false)
	level.set_enabled("g_door", true)
	if instant:
		for k in 2:
			door_refl[k].rotation.y = [-1.0, 1.0][k] * PI * 0.55
			door_real[k].rotation.y = [-1.0, 1.0][k] * PI * 0.55

# ------------------------------------------------------------------ 6. hollow walk
func _build_hollow() -> void:
	for c in Ch1Geo.HW_PLATES:
		var m := puzzles.rune_quad(self, Ch1Geo.hw_cell(c) + Vector3(0, 0.025, 0), Vector2(0.92, 0.92), Basis(Vector3.RIGHT, -PI * 0.5), 3.0, 0.3)
		plate_mats.append(m)
		var pm := MB.new()
		pm.cyl(Ch1Geo.hw_cell(c) + Vector3(0, 0.01, 0), 0.5, 0.52, 0.03, Color(0.5, 1.0, 0.0), 20)
		puzzles.marble_instance(pm.commit(), self)
	var mesh := _statue_mesh(0.82, 0.16, 0.5)
	for k in 2:
		var pv := Node3D.new()
		add_child(pv)
		var mi := MeshInstance3D.new()
		mi.mesh = mesh
		mi.material_override = level.marble_mat
		pv.add_child(mi)
		hollow_glints.append(puzzles.glow_quad(pv, Vector3(0, 2.1, 0), 0.9, Palette.ACCENT, 0.0))
		hollow_nodes.append(pv)
		hollow_obs.append(level.ob_circle(Vector2.ZERO, 0.42, "hollow%d" % k))
	# the gate at the top of the ramp
	hw_gate = Node3D.new()
	hw_gate.position = Vector3(18.5, 1.0, -15.15)
	add_child(hw_gate)
	var gm := MB.new()
	for i in 8:
		var x := -0.88 + i * 0.25
		gm.cyl(Vector3(x, 1.3, 0), 0.035, 0.035, 2.6, Color(0.5, 1.0, 0.0), 6)
		gm.cyl(Vector3(x, 2.66, 0), 0.0, 0.06, 0.16, Color(0.5, 1.0, 0.0), 6)
	gm.box(Vector3(0, 0.5, 0), Vector3(2.0, 0.08, 0.08), Color(0.5, 1.0, 0.0))
	gm.box(Vector3(0, 2.2, 0), Vector3(2.0, 0.08, 0.08), Color(0.5, 1.0, 0.0))
	puzzles.marble_instance(gm.commit(), hw_gate)

func _place_hollows() -> void:
	var hs: Array = state["hollows"]
	for k in 2:
		var c := Vector2i(int(hs[k][0]), int(hs[k][1]))
		var p := Ch1Geo.hw_cell(c)
		hollow_nodes[k].position = p
		hollow_nodes[k].rotation.y = PI * 0.75
		(hollow_obs[k] as Level.Obstacle).c = Vector2(p.x, p.z)
	for i in 2:
		var lk: bool = state["hollow_lock"][i]
		plate_mats[i].set_shader_parameter("lit", 1.0 if _plate_taken(i) else 0.3)

func _plate_taken(i: int) -> bool:
	var hs: Array = state["hollows"]
	for k in 2:
		if Vector2i(int(hs[k][0]), int(hs[k][1])) == Ch1Geo.HW_PLATES[i]: return true
	return false

func hw_player_cell() -> Vector2i:
	var p := game.player.position
	return Vector2i(floori(p.x - Ch1Geo.HW_ORIGIN.x), floori(p.z - Ch1Geo.HW_ORIGIN.y))

func _hw_free(c: Vector2i, other: Vector2i, pc: Vector2i) -> bool:
	if c.x < 0 or c.x > 7 or c.y < 0 or c.y > 8: return false
	if c in Ch1Geo.HW_PILLARS: return false
	return c != other and c != pc

## does the wanderer look at this hollow? (it holds still while watched)
func hw_watched(k: int) -> bool:
	var p := game.player.position
	var h := hollow_nodes[k].position
	var d := Vector2(h.x - p.x, h.z - p.z)
	if d.length() < 0.01 or d.length() > 6.5: return false
	var fwd := Vector2(-sin(game.player.yaw), -cos(game.player.yaw))
	return fwd.dot(d.normalized()) > cos(deg_to_rad(50.0))

func _update_hollow(dt: float) -> void:
	if state["hollow_done"]: return
	var p := game.player.position
	var inside := p.x > 17.4 and p.x < 25.6 and p.z > -15.0 and p.z < -6.0 and absf(p.y - 1.0) < 0.2
	var still := game.player.speed01 < 0.04 and game.mode == "play"
	_still = _still + dt if (still and inside) else 0.0
	for k in 2:
		var w: bool = inside and still and hw_watched(k) and not state["hollow_lock"][k]
		var g: float = hollow_glints[k].get_shader_parameter("intensity")
		hollow_glints[k].set_shader_parameter("intensity", move_toward(g, 0.55 if w else 0.0, dt * 2.0))
	if _still < 0.5 or hollow_moving: return
	_tick += dt
	if _tick < 0.75: return
	_tick = 0.0
	hollow_tick()

## one step: every hollow you are not watching moves one cell toward you (the longer axis first)
func hollow_tick() -> bool:
	var hs: Array = state["hollows"]
	var lk: Array = state["hollow_lock"]
	var pc := hw_player_cell()
	var moved := false
	for k in 2:
		if lk[k] or hw_watched(k): continue
		var h := Vector2i(int(hs[k][0]), int(hs[k][1]))
		var o := Vector2i(int(hs[1 - k][0]), int(hs[1 - k][1]))
		var dx := pc.x - h.x
		var dz := pc.y - h.y
		if dx == 0 and dz == 0: continue
		var axes: Array[Vector2i] = []
		if absi(dx) >= absi(dz):
			axes.append(Vector2i(signi(dx), 0))
			if dz != 0: axes.append(Vector2i(0, signi(dz)))
		else:
			axes.append(Vector2i(0, signi(dz)))
			if dx != 0: axes.append(Vector2i(signi(dx), 0))
		for a in axes:
			var n := h + a
			if not _hw_free(n, o, pc): continue
			hs[k] = [n.x, n.y]
			moved = true
			_slide_hollow(k, n)
			if n in Ch1Geo.HW_PLATES:
				lk[k] = true
				event.emit("hollow_lock", k)
			break
	if moved: event.emit("hollow_step", null)
	if lk[0] and lk[1] and not state["hollow_done"]:
		_open_hollow_gate(false)
	return moved

func _slide_hollow(k: int, c: Vector2i) -> void:
	var p := Ch1Geo.hw_cell(c)
	(hollow_obs[k] as Level.Obstacle).c = Vector2(p.x, p.z)
	hollow_moving = true
	var tw := create_tween()
	tw.tween_property(hollow_nodes[k], "position", p, 0.5).set_trans(Tween.TRANS_SINE)
	tw.tween_callback(func() -> void:
		hollow_moving = false
		for i in 2: plate_mats[i].set_shader_parameter("lit", 1.0 if _plate_taken(i) else 0.3))

func _open_hollow_gate(instant: bool) -> void:
	state["hollow_done"] = true
	level.set_enabled("hw_gate", false)
	if instant:
		hw_gate.position.y = 1.0 + 2.75
		return
	event.emit("solve", "hollow_walk")
	var tw := create_tween()
	tw.tween_interval(0.6)
	tw.tween_property(hw_gate, "position:y", 1.0 + 2.75, 2.2).set_trans(Tween.TRANS_QUAD).set_ease(Tween.EASE_IN_OUT)

# ------------------------------------------------------------------ 7. court: the mural
func _build_mural() -> void:
	mural_mat = _smat("res://shaders/mural.gdshader", {"noise_tex": level.noise_tex, "size": Vector2(5.2, 3.4), "lit": 0.0, "complete": 0.0,
		"head": Vector2((MURAL_HEAD.x - 9.4) / 5.2, (MURAL_HEAD.y - 2.1) / 3.4)})
	_mi(_quad(Vector2(5.2, 3.4)), mural_mat, Transform3D(Basis(), Vector3(12.0, 3.8, MURAL_Z)))
	level.inscription("l_mural", Vector3(9.0, 2.0, -25.6), "The sea took her on a still day.\nThe light remembers where her head was bowed.", 1.0,
		Transform3D(Basis(), Vector3(9.0, 2.62, -26.9)), Vector2(0.7, 0.7))

## where the lit crystal throws your veil's shadow on the mural wall (INF: no shadow)
func veil_shadow() -> Vector3:
	var p := game.player.position
	if not puzzles.state["bridge"] or absf(p.y - 2.0) > 0.2: return Vector3.INF
	if p.x < 7.0 or p.x > 17.0 or p.z > L_LIGHT.z - 0.25 or p.z < MURAL_Z: return Vector3.INF
	var H := p + Vector3(0, 1.0, 0)
	var t := (MURAL_Z - L_LIGHT.z) / (H.z - L_LIGHT.z)
	if t < 1.0: return Vector3.INF
	return L_LIGHT + (H - L_LIGHT) * t

## the spot to stand on (for hints and the test): your head on the line from the light to the hole
static func mural_spot() -> Vector3:
	var t := (MURAL_HEAD.y - L_LIGHT.y) / (3.0 - L_LIGHT.y)
	var x := L_LIGHT.x + (MURAL_HEAD.x - L_LIGHT.x) / t
	var z := L_LIGHT.z + (MURAL_Z - L_LIGHT.z) / t
	return Vector3(x, 2.0, z)

func _update_mural(dt: float) -> void:
	var lit: float = mural_mat.get_shader_parameter("lit")
	mural_mat.set_shader_parameter("lit", move_toward(lit, 1.0 if puzzles.state["bridge"] else 0.0, dt * 0.5))
	if state["mural"]: return
	var s := veil_shadow()
	shadow_world = s
	if s == Vector3.INF:
		mural_mat.set_shader_parameter("shadow", Vector4(0.5, 0.5, 0.062, 0.0))
		mural_hold = 0.0
		return
	var t := (MURAL_Z - L_LIGHT.z) / (game.player.position.z + 0.0 - L_LIGHT.z)
	var rad := 0.14 * t / 3.4
	mural_mat.set_shader_parameter("shadow", Vector4((s.x - 9.4) / 5.2, (s.y - 2.1) / 3.4, clampf(rad, 0.03, 0.12), 1.0))
	var fit := Vector2(s.x - MURAL_HEAD.x, s.y - MURAL_HEAD.y).length() < 0.32
	mural_hold = mural_hold + dt if fit and game.player.speed01 < 0.05 else 0.0
	if mural_hold > 1.3: complete_mural(false)

func complete_mural(instant: bool) -> void:
	state["mural"] = true
	level.set_enabled("mural_door", false)
	level.set_enabled("MZ_door", true)
	var mw := level.get_node_or_null("Zone_Mural") as MeshInstance3D
	if instant:
		mural_mat.set_shader_parameter("complete", 1.0)
		mural_mat.set_shader_parameter("shadow", Vector4(0.5, 0.5, 0.06, 0.0))
		if mw: mw.visible = false
		return
	event.emit("solve", "court_light")
	var tw := create_tween()
	tw.tween_method(func(v: float) -> void: mural_mat.set_shader_parameter("complete", v), 0.0, 1.0, 1.6)
	tw.tween_method(func(v: float) -> void: mural_mat.set_shader_parameter("shadow", Vector4(0.5, 0.5, 0.06, v)), 1.0, 0.0, 0.6)
	if mw:
		tw.tween_property(mw, "position:y", -3.4, 2.6).set_trans(Tween.TRANS_SINE).set_ease(Tween.EASE_IN_OUT)
		tw.tween_callback(func() -> void: mw.visible = false)

# ------------------------------------------------------------------ 8. mist maze
func _build_maze() -> void:
	maze_mist = _smat("res://shaders/maze_mist.gdshader", {"noise_tex": level.noise_tex, "density": 0.92, "clear_r": 1.35})
	var mmi := _mi(_plane(Vector2(8.6, 10.6)), maze_mist, Transform3D(Basis(), Vector3(13.0, 2.62, -34.0)))
	mmi.layers = PlanarMirror.LAYER_MAIN_FX
	var wsh := preload("res://shaders/wall_shimmer.gdshader")
	for i in 6:
		var m := ShaderMaterial.new()
		m.shader = wsh
		m.set_shader_parameter("noise_tex", level.noise_tex)
		m.set_shader_parameter("flash", 0.0)
		var mi := _mi(_quad(Vector2(2.1, 2.2)), m, Transform3D())
		mi.visible = false
		shimmers.append(mi)
	# her pool: still water, and her steps in it
	var wm := _smat("res://shaders/water.gdshader", {"noise_tex": level.noise_tex})
	_mi(_plane(Vector2(8.0, 10.0)), wm, Transform3D(Basis(), Vector3(4.6, 1.95, -34.0)))
	var om := _smat("res://shaders/water_over.gdshader", {"noise_tex": level.noise_tex, "area": Vector4(1.0, -38.6, 8.2, -29.4), "calm": 0.5})
	_mi(_plane(Vector2(8.0, 10.0)), om, Transform3D(Basis(), Vector3(4.6, 1.975, -34.0)))
	var fsh := preload("res://shaders/footprint.gdshader")
	var pts: Array[Vector3] = []
	pts.append(_mirror_maze(Vector3(12.0, 2.0, -27.6)))
	for rc in Ch1Geo.MZ_PATH: pts.append(_mirror_maze(Ch1Geo.mz_cell(rc)))
	pts.append(_mirror_maze(Vector3(10.0, 2.0, -40.0)))
	var side := 1.0
	for i in pts.size() - 1:
		var a: Vector3 = pts[i]
		var b: Vector3 = pts[i + 1]
		var L := a.distance_to(b)
		var n := maxi(1, int(L / 0.62))
		var dir := (b - a).normalized()
		var perp := dir.cross(Vector3.UP)
		for j in n:
			var c := a + dir * (L * (j + 0.5) / n) + perp * side * 0.17
			side = -side
			var m := ShaderMaterial.new()
			m.shader = fsh
			m.set_shader_parameter("project", 0.0)
			m.set_shader_parameter("life", 1.0)
			m.set_shader_parameter("dark", 1.0)
			var q := QuadMesh.new()
			q.size = Vector2(0.28, 0.46)
			q.orientation = PlaneMesh.FACE_Y
			var mi := _mi(q, m, Transform3D(Basis(Vector3.UP, atan2(-dir.x, -dir.z)), Vector3(c.x, c.y, c.z)))
			mi.visible = false
			maze_feet.append(mi)
			maze_feet_t.append(0.0)

func _mirror_maze(p: Vector3) -> Vector3:
	return Vector3(2.0 * Ch1Geo.MZ_MIRROR_X - p.x, 1.99, p.z)

func _in_maze() -> bool:
	var p := game.player.position
	return p.x > 8.5 and p.x < 17.5 and p.z > -40.0 and p.z < -26.5 and absf(p.y - 2.0) < 0.3

func _update_maze(dt: float) -> void:
	var inside := _in_maze()
	# her steps through the pool: one after another, then a pause, again
	var n := maze_feet.size()
	var period := n * 0.42 + 6.0
	if inside: _maze_loop = fmod(_maze_loop + dt, period)
	for i in n:
		var appear := i * 0.42
		var age := _maze_loop - appear
		var on := inside and age >= 0.0
		maze_feet[i].visible = on
		if on: (maze_feet[i].material_override as ShaderMaterial).set_shader_parameter("life", pow(clampf(age / 9.0, 0.0, 1.0), 2.0))
	# bumping into an invisible wall: it shimmers where you touched it
	_bump_cd = maxf(0.0, _bump_cd - dt)
	for s in shimmers:
		if s.visible:
			var m: ShaderMaterial = s.material_override
			var f: float = m.get_shader_parameter("flash")
			f = maxf(0.0, f - dt * 1.4)
			m.set_shader_parameter("flash", f)
			if f <= 0.0: s.visible = false
	if inside and _bump_cd <= 0.0 and game.player.input_dir.length() > 0.3 and game.player.speed01 < 0.15:
		var p2 := Vector2(game.player.position.x, game.player.position.z)
		var best: Level.Obstacle = null
		var bd := 0.55
		for o in level.obstacles:
			if o.circle or not o.name.begins_with("mzw_"): continue
			var q := Vector2(clampf(p2.x, o.r.position.x, o.r.end.x), clampf(p2.y, o.r.position.y, o.r.end.y))
			var d := q.distance_to(p2)
			if d < bd: bd = d; best = o
		if best:
			_bump_cd = 0.7
			_flash_wall(best.r)
			event.emit("maze_bump", null)
	if inside and not state["maze"] and game.player.position.z < -38.7:
		pass
	if not state["maze"] and game.player.position.z < -39.2 and game.player.position.x < 11.5 and game.player.position.x > 8.5 and absf(game.player.position.y - 2.0) < 0.2:
		state["maze"] = true
		event.emit("solve", "mist_maze")

func _flash_wall(r: Rect2) -> void:
	var s := shimmers[_shim_i]
	_shim_i = (_shim_i + 1) % shimmers.size()
	var c := r.get_center()
	var along_x := r.size.x > r.size.y
	s.transform = Transform3D(Basis() if along_x else Basis(Vector3.UP, PI * 0.5), Vector3(c.x, 3.1, c.y))
	s.visible = true
	(s.material_override as ShaderMaterial).set_shader_parameter("flash", 1.0)

# ------------------------------------------------------------------ 9. echo corridor
func _build_echo() -> void:
	crack_mat = _smat("res://shaders/wall_shimmer.gdshader", {"noise_tex": level.noise_tex, "kind": 1.0, "flash": 0.0})
	_mi(_quad(Vector2(1.8, 3.1)), crack_mat, Transform3D(Basis(), Vector3(18.3, 3.55, -46.37)))
	level.add_interact("echo_wall", Vector3(18.3, 2.0, -45.7), "touch", open_echo_room, 1.1,
		func() -> bool: return echo_heard >= 2 and not state["echo_room"])
	# the memory kept in the hidden room: a small relief of a quay and boats, glowing faintly
	var rm := MB.new()
	rm.box(Vector3(18.3, 2.75, -50.05), Vector3(1.3, 1.5, 0.2), Color(0.5, 0.25, 1.0))
	rm.box(Vector3(18.3, 2.1, -49.85), Vector3(1.0, 0.2, 0.5), Color(0.5, 0.25, 0.0))
	puzzles.marble_instance(rm.commit(), self)
	puzzles.rune_quad(self, Vector3(18.3, 2.85, -49.94), Vector2(0.7, 0.7), Basis(), 3.0, 0.8)
	puzzles.glow_quad(self, Vector3(18.3, 2.85, -49.7), 1.6, Palette.ACCENT, 0.35)
	level.add_interact("memory1", Vector3(18.3, 2.0, -49.1), "memory", func() -> void: collect_memory("m1"), 1.0,
		func() -> bool: return not ("m1" in state["memories"]))

## a footstep in the corridor: the echo comes back late; by the hollow wall it comes back twice
func on_footstep() -> void:
	var p := game.player.position
	if not (p.x > 8.8 and p.x < 26.4 and p.z < -38.9 and p.z > -46.5 and absf(p.y - 2.0) < 0.3): return
	game.sfx.play_later("step_hall", 0.34, -23.0, 0.97)
	if p.z < -44.3 and p.x > 16.4 and p.x < 20.2 and not state["echo_room"]:
		game.sfx.play_later("step_hall", 0.22, -15.0, 0.82)
		game.sfx.play_later("step_hall", 0.55, -21.0, 0.78)
		_echo_flash = 1.0
		echo_heard += 1
		if echo_heard == 2: event.emit("echo_hollow", null)

func _update_echo(dt: float) -> void:
	_echo_flash = maxf(0.0, _echo_flash - dt * 1.2)
	crack_mat.set_shader_parameter("flash", _echo_flash * 0.8 + (0.08 if echo_heard >= 2 and not state["echo_room"] else 0.0))

func open_echo_room(instant := false) -> void:
	state["echo_room"] = true
	level.set_enabled("echo_secret", false)
	level.set_enabled("EC_room_door", true)
	level.set_enabled("EC_room", true)
	var w := level.get_node_or_null("Zone_ECs") as MeshInstance3D
	if instant:
		if w: w.visible = false
		return
	event.emit("solve", "echo_corridor")
	if w:
		var tw := create_tween()
		tw.tween_property(w, "position:y", -3.6, 2.0).set_trans(Tween.TRANS_QUAD).set_ease(Tween.EASE_IN)
		tw.tween_callback(func() -> void: w.visible = false)

func collect_memory(id: String) -> void:
	if id in state["memories"]: return
	(state["memories"] as Array).append(id)
	event.emit("memory", id)

# ------------------------------------------------------------------ 10. the scales
func _build_scales() -> void:
	# the lift (pan A) and pan B with its stone
	lift_node = Node3D.new()
	lift_node.position = PAN_A
	add_child(lift_node)
	var lm := MB.new()
	lm.box(Vector3(0, -0.15, 0), Vector3(2.0, 0.3, 2.0), Color(0.5, 0.0, 0.0))
	lm.box(Vector3(0, -0.9, 0), Vector3(0.4, 1.4, 0.4), Color(0.5, 1.0, 0.0))
	lm.cyl(Vector3(0, 0.08, 0), 0.12, 0.16, 0.16, Color(0.5, 1.0, 0.0), 8)
	puzzles.marble_instance(lm.commit(), lift_node)
	pan_a_mat = puzzles.rune_quad(lift_node, Vector3(0, 0.012, 0), Vector2(1.2, 1.2), Basis(Vector3.RIGHT, -PI * 0.5), 2.0, 0.25)
	panb_node = Node3D.new()
	panb_node.position = PAN_B
	add_child(panb_node)
	var bm := MB.new()
	bm.box(Vector3(0, -0.15, 0), Vector3(2.0, 0.3, 2.0), Color(0.5, 0.0, 0.0))
	bm.sphere(Vector3(0, 0.45, 0), Vector3(0.5, 0.45, 0.45), Color(0.5, 0.5, 0.0), 10, 6)
	bm.box(Vector3(0.1, 0.12, 0.2), Vector3(0.7, 0.24, 0.5), Color(0.5, 0.5, 0.0), Basis(Vector3.UP, 0.4))
	bm.cyl(Vector3(0, 0.95, 0), 0.12, 0.16, 0.16, Color(0.5, 1.0, 0.0), 8)
	puzzles.marble_instance(bm.commit(), panb_node)
	pan_b_mat = puzzles.rune_quad(panb_node, Vector3(0, 0.012, 0.75), Vector2(0.5, 0.5), Basis(Vector3.RIGHT, -PI * 0.5), 2.0, 0.25)
	level.ob_rect(Level.R(26.8, -51.6, 28.8, -49.6))
	# the balance arm over its pivot
	arm_node = Node3D.new()
	arm_node.position = Vector3(30.0, 6.45, -48.2)
	add_child(arm_node)
	var am := MB.new()
	var d := (Vector2(PAN_A.x, PAN_A.z) - Vector2(PAN_B.x, PAN_B.z))
	var L := d.length() + 0.6
	am.box(Vector3.ZERO, Vector3(L, 0.24, 0.3), Color(0.5, 0.25, 1.0))
	am.cyl(Vector3(0, 0, 0), 0.22, 0.22, 0.5, Color(0.5, 1.0, 0.0), 10, Basis(Vector3.RIGHT, PI * 0.5))
	puzzles.marble_instance(am.commit(), arm_node)
	arm_node.rotation.y = -atan2(d.y, d.x)
	arm_half = d.length() * 0.5
	# a rod from each end of the beam down to its pan (they follow the beam as it tips)
	for k in 2:
		var rod := MeshInstance3D.new()
		var cm := CylinderMesh.new()
		cm.top_radius = 0.035; cm.bottom_radius = 0.035; cm.height = 1.0; cm.radial_segments = 6
		rod.mesh = cm
		rod.material_override = level.marble_mat
		add_child(rod)
		rods.append(rod)
	# the glass that decides what the scale sees: a stand that turns in quarter steps
	scale_mirror = Node3D.new()
	scale_mirror.position = SCALES_MIRROR + Vector3(0, 1.0, 0)
	add_child(scale_mirror)
	var fm := MB.new()
	var fc := Color(0.5, 1.0, 0.0)
	fm.box(Vector3(0, -0.6, 0), Vector3(1.3, 0.08, 0.1), fc)
	fm.box(Vector3(0, 0.75, 0), Vector3(1.3, 0.08, 0.1), fc)
	fm.box(Vector3(-0.62, 0.07, 0), Vector3(0.08, 1.4, 0.1), fc)
	fm.box(Vector3(0.62, 0.07, 0), Vector3(0.08, 1.4, 0.1), fc)
	fm.cyl(Vector3(0, -0.85, 0), 0.32, 0.4, 0.4, Color(0.3, 0.25, 0.0), 10)
	puzzles.marble_instance(fm.commit(), scale_mirror)
	var gm := ShaderMaterial.new()
	gm.shader = preload("res://shaders/glass.gdshader")
	gm.set_shader_parameter("size", Vector2(1.16, 1.3))
	gm.set_shader_parameter("base_alpha", 0.5)
	gm.set_shader_parameter("tint", Color(0.55, 0.75, 0.82))
	_mi(_quad(Vector2(1.16, 1.3)), gm, Transform3D(Basis(), Vector3(0, 0.07, 0)), scale_mirror)
	level.ob_circle(Vector2(SCALES_MIRROR.x, SCALES_MIRROR.z), 0.45)
	scale_gaze = _smat("res://shaders/beam_floor.gdshader", {"kind": 0.0, "length_m": 4.0, "intensity": 0.7})
	var gz := _mi(_plane(Vector2(1, 1)), scale_gaze, Transform3D())
	gz.name = "ScaleGaze"
	(gz.mesh as PlaneMesh).center_offset = Vector3(0.5, 0, 0)
	level.add_interact("scale_mirror", SCALES_MIRROR + Vector3(0, 0, 0.85), "turn", turn_scale_mirror, 0.9,
		func() -> bool: return not state["scales"])
	level.inscription("sc_stele", Vector3(27.0, 2.0, -46.0), "The scale weighs only what the glass shows.\nA likeness weighs nothing.", 1.1,
		Transform3D(Basis(Vector3.UP, PI * 0.5), Vector3(26.15, 2.62, -46.9)), Vector2(0.8, 0.75))
	var sm := MB.new()
	sm.box(Vector3(26.05, 2.6, -46.9), Vector3(0.2, 1.2, 1.0), Color(0.5, 0.25, 0.0))
	puzzles.marble_instance(sm.commit(), self)

## the glass faces: 0 west (the corridor), 1 north (pan B), 2 east (the lift), 3 south
func turn_scale_mirror() -> void:
	if state["scales"]: return
	state["scales_mirror"] = (int(state["scales_mirror"]) + 1) % 4
	event.emit("statue_turn", -1)
	var goal := -float(state["scales_mirror"]) * PI * 0.5
	var cur := scale_mirror.rotation.y
	goal = cur + wrapf(goal - cur, -PI, PI)
	var tw := create_tween()
	tw.tween_property(scale_mirror, "rotation:y", goal, 0.6).set_trans(Tween.TRANS_BACK).set_ease(Tween.EASE_OUT)

## which pan does the glass see? "A", "B" or ""
func glass_sees() -> String:
	var o := int(state["scales_mirror"])
	var n: Vector2 = [Vector2(-1, 0), Vector2(0, -1), Vector2(1, 0), Vector2(0, 1)][o]
	var m := Vector2(SCALES_MIRROR.x, SCALES_MIRROR.z)
	for pan in [["A", PAN_A], ["B", PAN_B]]:
		var v := Vector2(pan[1].x, pan[1].z) - m
		if n.dot(v.normalized()) > cos(deg_to_rad(52.0)): return pan[0]
	return ""

func on_lift() -> bool:
	var p := game.player.position
	return absf(p.x - PAN_A.x) < 1.0 and absf(p.z - PAN_A.z) < 1.0

func _update_scales(dt: float) -> void:
	var sees := glass_sees()
	pan_a_mat.set_shader_parameter("lit", move_toward(float(pan_a_mat.get_shader_parameter("lit")), 1.0 if sees == "A" else 0.25, dt * 2.0))
	pan_b_mat.set_shader_parameter("lit", move_toward(float(pan_b_mat.get_shader_parameter("lit")), 1.0 if sees == "B" else 0.25, dt * 2.0))
	# the glass's gaze, a faint light on the floor
	var gz := get_node("ScaleGaze") as MeshInstance3D
	var n3: Vector3 = [Vector3(-1, 0, 0), Vector3(0, 0, -1), Vector3(1, 0, 0), Vector3(0, 0, 1)][int(state["scales_mirror"])]
	gz.transform = Transform3D(Basis(n3 * 3.6, Vector3.UP, n3.cross(Vector3.UP) * 1.4), SCALES_MIRROR + Vector3(0, 0.02, 0) + n3 * 0.4)
	gz.visible = not state["scales"]
	var on := on_lift() and absf(game.player.position.y - (2.0 + lift_h * 2.0)) < 0.3
	var target := 0.0
	if state["scales"]: target = 1.0
	elif on and sees == "A": target = 1.0       # in the glass your weight is hers: none. The stone wins.
	_groan_cd = maxf(0.0, _groan_cd - dt)
	if on and target < 0.5 and _groan_cd <= 0.0 and game.player.speed01 < 0.05:
		_groan_cd = 6.0
		event.emit("scale_groan", null)
	var prev := lift_h
	lift_h = move_toward(lift_h, target, dt * (0.32 if target > lift_h else 0.5))
	if lift_h != prev or true:
		var y := 2.0 + lift_h * 2.0
		lift_node.position.y = y
		panb_node.position.y = PAN_B.y - lift_h * 1.1
		arm_node.rotation.z = (0.5 - lift_h) * 0.0
		arm_node.rotation = Vector3(0.0, arm_node.rotation.y, 0.0)
		arm_node.rotate_object_local(Vector3.BACK, (lift_h - 0.5) * 0.36)
		for k in 2:
			var top: Vector3 = arm_node.global_transform * Vector3(arm_half * (1.0 if k == 0 else -1.0), 0, 0)
			var bot: Vector3 = (lift_node.global_position + Vector3(0, 0.16, 0)) if k == 0 else (panb_node.global_position + Vector3(0, 1.03, 0))
			var v := top - bot
			var yb := v.normalized()
			var xb := yb.cross(Vector3.BACK).normalized() if absf(yb.z) < 0.9 else yb.cross(Vector3.RIGHT).normalized()
			rods[k].global_transform = Transform3D(Basis(xb, yb * v.length(), xb.cross(yb)), (top + bot) * 0.5)
		var g: Level.Region = level.named["lift"]
		g.y0 = y; g.y1 = y
		if on and lift_h != prev: game.player.position.y = y
	if not state["scales"] and lift_h >= 1.0 and on:
		state["scales"] = true
		event.emit("solve", "scales")

# ------------------------------------------------------------------ 11. her footprints to the plate
func _build_ledge_feet() -> void:
	var fsh := preload("res://shaders/footprint.gdshader")
	var path := [Vector3(22.1, 2.03, -25.5), Vector3(22.5, 2.03, -26.6), Vector3(22.9, 2.03, -27.7), Vector3(23.3, 2.03, -28.7), Vector3(23.6, 2.03, -29.4)]
	var side := 1.0
	for i in path.size() - 1:
		var a: Vector3 = path[i]
		var b: Vector3 = path[i + 1]
		var dir := (b - a).normalized()
		for j in 2:
			var c := a.lerp(b, (j + 0.5) / 2.0) + dir.cross(Vector3.UP) * side * 0.1
			side = -side
			var m := ShaderMaterial.new()
			m.shader = fsh
			m.set_shader_parameter("project", 0.0)
			m.set_shader_parameter("life", 1.0)
			m.set_shader_parameter("dark", 1.0)
			var q := QuadMesh.new()
			q.size = Vector2(0.28, 0.46)
			q.orientation = PlaneMesh.FACE_Y
			var mi := _mi(q, m, Transform3D(Basis(Vector3.UP, atan2(-dir.x, -dir.z)), c))
			mi.visible = false
			ledge_feet.append(mi)
			ledge_feet_t.append(0.0)

func _update_ledge(dt: float) -> void:
	var p := game.player.position
	var on: bool = p.x > 21.0 and p.x < 29.0 and p.z > -25.0 and p.z < -19.0 and absf(p.y - 2.0) < 0.2 and not puzzles.state["plate"]
	var n := ledge_feet.size()
	var period := n * 0.5 + 2.5
	if on: _ledge_loop = fmod(_ledge_loop + dt, period)
	for i in n:
		var age := _ledge_loop - i * 0.5
		var vis: bool = on and age >= 0.0
		ledge_feet[i].visible = vis
		if vis: (ledge_feet[i].material_override as ShaderMaterial).set_shader_parameter("life", pow(clampf(age / 6.0, 0.0, 1.0), 2.0))

# ------------------------------------------------------------------ 12. gate of the four veiled
func four_pos(i: int) -> Vector3:
	var a := deg_to_rad(FOUR_ANGLES[i])
	return Puzzles.SHRINE_C + Vector3(cos(a) * FOUR_R, 0.0, sin(a) * FOUR_R)

func _build_four() -> void:
	var c := Puzzles.SHRINE_C
	# the tholos' gaps are closed by veils of light; the one facing the bridge is the gate
	var vsh := preload("res://shaders/mist_veil.gdshader")
	for k in 8:
		var a := k * PI * 0.25
		var p := c + Vector3(cos(a) * 2.5, 0.0, sin(a) * 2.5)
		var front := k == 2
		level.ob_circle(Vector2(p.x, p.z), 0.5, "tholos_front" if front else "tholos_gap%d" % k)
		var m := ShaderMaterial.new()
		m.shader = vsh
		m.set_shader_parameter("noise_tex", level.noise_tex)
		m.set_shader_parameter("density", 0.75 if front else 0.45)
		m.set_shader_parameter("glow", 0.8 if front else 0.4)
		var tang := Vector3(-sin(a), 0, cos(a))
		_mi(_quad(Vector2(1.2, 3.2)), m, Transform3D(Basis(tang, Vector3.UP, tang.cross(Vector3.UP)), p + Vector3(0, 1.65, 0)))
		if front: front_veil = m
		else: gap_veils.append(m)
	var pm := MB.new()
	for i in 4:
		var p := four_pos(i)
		pm.box(p + Vector3(0, 0.125, 0), Vector3(1.0, 0.25, 1.0), Color(0.5, 0.25, 0.0))
		var face := (c - p)
		face.y = 0.0
		face = face.normalized()
		var B := Basis(Vector3.UP, atan2(face.x, face.z))
		four_mats.append(puzzles.rune_quad(self, p + Vector3(0, 0.13, 0) + face * 0.505, Vector2(0.24, 0.24), B, 2.0, 0.15))
		if i < 3:
			level.statue("S", p + Vector3(0, 0.25, 0), Level.yaw_to(p, c), 0.9, 0.45)
		else:
			level.walk(Level.R(p.x - 0.5, p.z - 0.5, p.x + 0.5, p.z + 0.5), 2.25, NAN, -1, "four_plinth")
	puzzles.marble_instance(pm.commit(), self)
	four_ring = _smat("res://shaders/ring.gdshader", {"lit": 0.0, "sweep": 0.0})
	_mi(_plane(Vector2(1.5, 1.5)), four_ring, Transform3D(Basis(), four_pos(3) + Vector3(0, 0.262, 0)))
	level.add_interact("four_wait", four_pos(3) + Vector3(0, 0.25, 0), "wait", wait_still, 0.55,
		func() -> bool: return not state["four"])
	level.inscription("s_four", Vector3(21.5, 2.0, -29.2), "A thousand of her wait for the one who breathes.\nStand where she stood. Be still, as we are still.", 1.0,
		Transform3D(Basis(Vector3.RIGHT, -PI * 0.5), Vector3(21.5, 2.012, -29.6)), Vector2(1.0, 0.7))

func on_four_plinth() -> bool:
	var p := game.player.position
	var q := four_pos(3)
	return absf(p.x - q.x) < 0.5 and absf(p.z - q.z) < 0.5 and absf(p.y - 2.25) < 0.1

func facing_shrine() -> bool:
	var p := game.player.position
	var d := Vector2(Puzzles.SHRINE_C.x - p.x, Puzzles.SHRINE_C.z - p.z).normalized()
	var fwd := Vector2(-sin(game.player.yaw), -cos(game.player.yaw))
	return fwd.dot(d) > cos(deg_to_rad(40.0))

## "wait": turn to face the shrine as the others do, and hold still
func wait_still() -> void:
	if not on_four_plinth(): return
	var p := game.player.position
	game.player.yaw = atan2(-(Puzzles.SHRINE_C.x - p.x), -(Puzzles.SHRINE_C.z - p.z))
	game.player.fig.rotation.y = game.player.yaw
	waiting = 5.0
	game.player.locked = true

func _update_four(dt: float) -> void:
	if waiting > 0.0:
		waiting -= dt
		if waiting <= 0.0 or state["four"]:
			waiting = 0.0
			if game.mode == "play": game.player.locked = false
	if state["four"]: return
	var ok := on_four_plinth() and game.player.speed01 < 0.04 and facing_shrine()
	four_hold = four_hold + dt if ok else maxf(0.0, four_hold - dt * 2.5)
	four_ring.set_shader_parameter("lit", minf(1.0, four_hold / 3.6) if ok or four_hold > 0.0 else 0.0)
	four_ring.set_shader_parameter("sweep", clampf(four_hold / 3.6, 0.0, 1.0))
	for i in 4:
		var on := four_hold > (i + 1) * 0.9
		four_mats[i].set_shader_parameter("lit", 1.0 if on else 0.15)
	if four_hold >= 3.6: open_four(false)

func open_four(instant: bool) -> void:
	state["four"] = true
	level.set_enabled("tholos_front", false)
	for m in four_mats: m.set_shader_parameter("lit", 1.0)
	if instant:
		front_veil.set_shader_parameter("density", 0.0)
		return
	event.emit("solve", "gate_four")
	var tw := create_tween()
	tw.tween_method(func(v: float) -> void:
		front_veil.set_shader_parameter("density", v)
		front_veil.set_shader_parameter("glow", 0.8 + (0.75 - v)), 0.75, 0.0, 3.0)

# ------------------------------------------------------------------ 13. the shrine's pool
func _build_shrine_pool() -> void:
	var c := Vector3(POOL_C.x, Puzzles.SHRINE_C.y, POOL_C.z)
	var d := POOL_R * 2.0 + 0.02
	shrine_water = _smat("res://shaders/water.gdshader", {"noise_tex": level.noise_tex, "disc": 1.0})
	_mi(_plane(Vector2(d, d)), shrine_water, Transform3D(Basis(), c + Vector3(0, 0.15, 0)))
	shrine_over = _smat("res://shaders/water_over.gdshader", {"noise_tex": level.noise_tex, "disc": 1.0,
		"area": Vector4(c.x - POOL_R, c.z - POOL_R, c.x + POOL_R, c.z + POOL_R), "calm": 0.6})
	_mi(_plane(Vector2(d, d)), shrine_over, Transform3D(Basis(), c + Vector3(0, 0.165, 0)))

# ------------------------------------------------------------------ hints
func _build_wisp() -> void:
	wisp = MeshInstance3D.new()
	wisp.mesh = _quad(Vector2(0.5, 0.5))
	wisp_mat = ShaderMaterial.new()
	wisp_mat.shader = preload("res://shaders/halo.gdshader")
	wisp_mat.set_shader_parameter("color", Palette.CORE)
	wisp_mat.set_shader_parameter("intensity", 0.0)
	wisp.material_override = wisp_mat
	wisp.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	wisp.visible = false
	add_child(wisp)

## where the gentle hint should drift (INF: nothing to hint in this space)
func hint_target(area: String) -> Vector3:
	match area:
		"waking_pool": return Vector3(-0.3, 0.0, 1.7) if not state["stones"] else Vector3.INF
		"stair_breath": return Vector3(-10.5, 1.6, -5.3) if not state["breath"] else Vector3.INF
		"hall_glass": return Vector3(0.0, 2.0, -20.3) if not state["shard"] else (Vector3(4.6, 1.8, -17.5) if not state["hall_door"] else Vector3.INF)
		"shard_gallery": return Vector3(6.6, 2.0, -8.5) if not state["gallery"] else Vector3.INF
		"garden_veiled":
			if state["turned_done"]: return Vector3.INF
			if not state["garden_breath"]: return Vector3(16.0, 2.2, -14.6)
			var ok := turned_correct()
			for i in 3:
				if not ok[i]: return Vector3(TURN_X[i], 2.3, TURN_Z)
		"hollow_walk":
			if state["hollow_done"]: return Vector3.INF
			for i in 2:
				if not _plate_taken(i): return Ch1Geo.hw_cell(Ch1Geo.HW_PLATES[i]) + Vector3(0, 0.6, 0)
		"court_light":
			if not puzzles.state["bridge"]:
				for i in 3:
					if int(puzzles.state["mirrors"][i]) != Puzzles.MIRROR_SOLUTION[i]:
						return [Vector3(10.5, 3.0, -24.5), Vector3(10.5, 3.0, -19.5), Vector3(16.3, 3.0, -19.5)][i]
			elif not state["mural"]: return mural_spot() + Vector3(0, 0.6, 0)
		"mist_maze": return Vector3(4.6, 2.6, -34.0) if not state["maze"] else Vector3.INF
		"scales":
			if state["scales"]: return Vector3.INF
			return SCALES_MIRROR + Vector3(0, 1.4, 0) if glass_sees() != "A" else PAN_A + Vector3(0, 0.8, 0)
		"eidolon_ledge":
			if puzzles.state["plate"]: return Vector3.INF
			if game.player.position.y > 3.0: return Vector3(29.8, 3.0, -22.4)
			return puzzles.foot_spot + Vector3(0, 0.6, 0)
		"gate_four": return four_pos(3) + Vector3(0, 0.9, 0) if not state["four"] else Vector3.INF
		"first_shrine": return Puzzles.SHRINE_C + Vector3(0, 1.0, 1.85) if not puzzles.state["shrine"] else Vector3.INF
	return Vector3.INF

## after a few minutes without progress in a space, a faint petrol wisp drifts from you toward what
## matters (no words, never the answer itself)
func _update_hints(dt: float, area: String) -> void:
	if area != hint_area:
		hint_area = area
		hint_t = 0.0
	if game.mode != "play": return
	hint_t += dt
	_hint_cd = maxf(0.0, _hint_cd - dt)
	if hint_t < Game.HINT_AFTER or _hint_cd > 0.0: return
	var tgt := hint_target(area)
	if tgt == Vector3.INF: return
	_hint_cd = 22.0
	show_hint(tgt)

func show_hint(tgt: Vector3) -> void:
	event.emit("hint", tgt)
	var a := game.player.position + Vector3(0, 1.3, 0)
	wisp.visible = true
	var tw := create_tween()
	tw.tween_method(func(k: float) -> void:
		wisp.global_position = a.lerp(tgt, k) + Vector3(0, sin(k * PI) * 0.8, 0)
		wisp_mat.set_shader_parameter("intensity", sin(k * PI) * 0.9 + 0.1), 0.0, 1.0, 3.2).set_trans(Tween.TRANS_SINE)
	tw.tween_method(func(v: float) -> void: wisp_mat.set_shader_parameter("intensity", v), 0.6, 0.0, 1.4)
	tw.tween_callback(func() -> void: wisp.visible = false)

## progress made: the hint clock starts again
func progress() -> void:
	hint_t = 0.0

# ================================================================== per frame / state
func update(dt: float) -> void:
	_t += dt
	if game.player.speed01 > 0.1: _moved = true
	_update_pool(dt)
	if lens_on and game.area != "shard_gallery" and game.area != "": set_lens(false)
	_update_lens()
	_update_hollow(dt)
	_update_mural(dt)
	_update_maze(dt)
	_update_echo(dt)
	_update_scales(dt)
	_update_ledge(dt)
	_update_four(dt)
	_update_hints(dt, game.area)

func apply_state() -> void:
	if state["stones"]: _reveal_stones(true)
	else:
		for i in Ch1Geo.STONES.size(): level.set_enabled("stone%d" % i, false)
	if state["breath"]: _open_stair(true)
	else:
		level.set_enabled("breath_gate", true)
		stair_veil.set_shader_parameter("density", 1.0)
	var hd := level.get_node_or_null("Zone_Hdoor") as MeshInstance3D
	if state["hall_door"]: _open_hall_door(true)
	else:
		level.set_enabled("hdoor", false)
		if hd: hd.visible = true; hd.position.y = 0.0
	var gls := level.get_node_or_null("Zone_GLs") as MeshInstance3D
	if state["gallery"]: open_gallery(true)
	else:
		level.set_enabled("gallery_secret", true)
		if gls: gls.visible = true; gls.position.y = 0.0
	_apply_turned(true)
	if state["turned_done"]: _open_garden_door(true)
	else:
		level.set_enabled("g_door_ob", true)
		level.set_enabled("g_door", false)
		for k in 2:
			door_refl[k].rotation.y = 0.0
			door_real[k].rotation.y = 0.0
	_place_hollows()
	if state["hollow_done"]: _open_hollow_gate(true)
	else:
		level.set_enabled("hw_gate", true)
		hw_gate.position.y = 1.0
	var mw := level.get_node_or_null("Zone_Mural") as MeshInstance3D
	if state["mural"]: complete_mural(true)
	else:
		level.set_enabled("mural_door", true)
		level.set_enabled("MZ_door", false)
		mural_mat.set_shader_parameter("complete", 0.0)
		if mw: mw.visible = true; mw.position.y = 0.0
	var ec := level.get_node_or_null("Zone_ECs") as MeshInstance3D
	if state["echo_room"]: open_echo_room(true)
	else:
		level.set_enabled("echo_secret", true)
		level.set_enabled("EC_room_door", false)
		level.set_enabled("EC_room", false)
		if ec: ec.visible = true; ec.position.y = 0.0
	scale_mirror.rotation.y = -float(state["scales_mirror"]) * PI * 0.5
	lift_h = 1.0 if state["scales"] else 0.0
	if state["four"]: open_four(true)
	else:
		level.set_enabled("tholos_front", true)
		front_veil.set_shader_parameter("density", 0.75)
	game.ui.set_inventory(state["shard"], false)
	set_lens(false)

# ================================================================== 13. "The Hand in the Water"
const POOL_C := Vector3(25.0, 2.155, -32.4)
const POOL_R := 1.18
const STAND := Vector3(25.0, 2.0, -30.8)
const TOUCH := Vector3(25.0, 2.17, -31.35)
var her: Figure                 # her shadow, in the water
var mine: Figure                # your plain reflection (only at the very end)
var touch_glow: ShaderMaterial
var whisper_glow: ShaderMaterial
var her_xf := Transform3D()
var her_pose := Figure.Pose.new()
var _refl_pool := Transform3D()

func _pool_puppet(slim: float) -> Figure:
	var f := Figure.new(preload("res://shaders/ghost.gdshader"))
	f.visible = false
	add_child(f)
	f.set_param("project", 1.0)
	f.set_param("plane_n", Vector3.UP)
	f.set_param("plane_d", POOL_C.y)
	f.set_param("clip_c", POOL_C)
	f.set_param("clip_u", Vector3.RIGHT)
	f.set_param("clip_v", Vector3.BACK)
	f.set_param("clip_h", Vector2(POOL_R, POOL_R))
	f.set_param("clip_disc", 1.0)
	f.set_param("ghost", 0.0)
	f.set_param("vis", 0.0)
	f.set_param("surface_col", Vector3(0.3, 0.36, 0.38))
	f.set_param("surface_mix", 0.1)
	f.set_param("ripple_amt", 0.25)
	f.set_param("shimmer", 0.0)
	f.slim = slim
	f.set_layers(PlanarMirror.LAYER_MAIN_FX)
	return f

func _place(f: Figure, xf: Transform3D, p: Figure.Pose) -> void:
	f.global_transform = _refl_pool * xf
	f.apply_pose(p)

## build the scene on a fresh Cinematic (main.gd plays it after the shrine wakes). Timed to the score
## (manifest doc, cinematic_hand, 59 s, started at P): 0-8 near silence; 8-16 strings as she steps
## closer; 16.5 the hands touch; 23-30 her voice; 30-37.6 the veil lifts (swell); 37.6 the whisper =
## silence; 41-59 she walks into the fog, unresolved. Before it, P s of awakening (shrine_awaken).
const CINE_P := 4.5
func hand_in_the_water(c: Cinematic) -> void:
	_refl_pool = Transform3D(Basis(Vector3.RIGHT, Vector3.DOWN, Vector3.BACK), Vector3(0, 2.0 * POOL_C.y, 0))
	if her == null:
		her = _pool_puppet(0.045)
		her.veil_contrary = true
		mine = _pool_puppet(0.0)
		touch_glow = puzzles.glow_quad(self, TOUCH, 2.2, Palette.ACCENT, 0.0)
		whisper_glow = puzzles.glow_quad(self, POOL_C + Vector3(0, 0.03, 0.05), 0.7, Palette.CORE, 0.0)
	var pl := game.player
	var w := game.world
	var g := game
	var P := CINE_P
	var start_pos := pl.position
	var start_yaw := pl.yaw
	var yaw_n := 0.0                                      # facing the pool (north)
	her_xf = Transform3D(Basis(Vector3.UP, yaw_n), STAND)
	her_pose = Figure.Pose.new()
	var hp := her_pose
	var look := POOL_C + Vector3(0, 0.3, 0.55)
	var cam_yaw := PI                                      # from beyond the pool, looking back at you
	# -- prelude: the shrine wakes; you step to the water's edge
	c.at(0.0, func() -> void:
		her.visible = true
		her.set_hem(pl.fig.hem * 1.25)
		her.set_runes(0)
		her.set_veil_lift(0.0)
		her.set_param("vis", 0.0)
		mine.visible = false
		g.ui.hide_text())
	c.audio(0.0, "shrine_awaken")
	c.anim(0.0, 2.0, func(k: float) -> void: g.sfx.set_duck(k))
	c.anim(0.0, 1.8, func(k: float) -> void:
		pl.position = start_pos.lerp(STAND, k)
		pl.yaw = lerp_angle(start_yaw, yaw_n, k)
		pl.fig.rotation.y = pl.yaw)
	c.anim(0.3, 3.4, func(k: float) -> void: puzzles.set_shrine_awake(k, k))
	c.anim(0.3, 4.0, func(k: float) -> void: pl.fig.set_hem(lerpf(Game.HEM_PER_SHRINE[0], Game.HEM_PER_SHRINE[1], k)))
	c.cam(0.3, 4.2, POOL_C + Vector3(0, 1.0, 0.6), -PI * 0.25, -deg_to_rad(40.0), 6.2)
	# -- 0 (P): the music begins in near silence; the letterbox closes, the camera comes round
	c.audio(P, "cinematic_hand")
	c.anim(P - 0.5, 1.8, func(k: float) -> void: g.ui.set_letterbox(k))
	c.cam(P, 4.5, look, cam_yaw, -deg_to_rad(50.0), 3.8)
	# close shots: everything nearer the camera than the pool's far rim is cut away (the dome, the
	# columns), and the crystal rises out of the frame
	c.anim(P - 0.6, 0.6, func(k: float) -> void: w.cam.near = lerpf(1.0, World.DIST - 1.6, k), 0)
	c.anim(P - 0.5, 3.5, func(k: float) -> void:
		puzzles.crystal_lift = 2.4 * k
		puzzles.shrine_halo.set_shader_parameter("intensity", lerpf(0.8, 0.12, k))
		puzzles.shrine_pillar.set_shader_parameter("fade", lerpf(0.8, 0.15, k))
		puzzles.shrine_light.light_energy = lerpf(2.2, 0.7, k))
	c.anim(P, 7.0, func(_k: float) -> void:
		her_xf = Transform3D(Basis(Vector3.UP, pl.yaw), pl.position)
		var p2 := pl.fig.pose.copy()
		her_pose = p2
		_place(her, her_xf, p2), 0)
	c.anim(P + 0.5, 2.5, func(k: float) -> void: her.set_param("vis", k))
	c.anim(P + 2.5, 2.0, func(k: float) -> void: pl.head_pitch_add = 0.32 * k)
	# -- 7: she stops mimicking you: you glance aside; she does not
	c.audio(P + 6.6, "glimpse")
	c.anim(P + 6.5, 1.4, func(k: float) -> void: pl.head_yaw_add = 0.3 * k)
	c.anim(P + 7.0, 1.0, func(k: float) -> void:
		var p3 := pl.fig.pose.copy()
		p3.head_yaw -= 0.3                                 # her head stays on you
		her_pose = p3
		_place(her, her_xf, p3))
	c.anim(P + 9.0, 1.4, func(k: float) -> void: pl.head_yaw_add = 0.3 * (1.0 - k))
	# -- 8-16: the strings: she steps closer, kneels, lays her palm on the water from below
	var her_from := STAND
	var her_to := STAND + Vector3(0.0, 0.0, -0.42)
	c.anim(P + 8.0, 2.6, func(k: float) -> void:
		var p4 := her_pose.copy()
		p4.head_yaw = lerpf(p4.head_yaw, 0.0, k)
		p4.phase = k * TAU
		p4.ripple = sin(k * PI) * 0.6
		p4.body_y = absf(sin(k * TAU)) * 0.03
		her_pose = p4
		her_xf = Transform3D(Basis(Vector3.UP, yaw_n), her_from.lerp(her_to, k))
		_place(her, her_xf, p4))
	c.audio(P + 8.1, "cloth")
	c.anim(P + 10.8, 2.4, func(k: float) -> void:
		var p5 := her_pose.copy()
		p5.crouch = 0.55 * k
		p5.lean_x = -0.25 * k
		p5.head_pitch = 0.3 * k
		p5.reach = minf(1.0, k * 1.3)
		p5.breath = 0.0
		_place(her, her_xf, p5)
		hp.crouch = p5.crouch; hp.lean_x = p5.lean_x; hp.head_pitch = p5.head_pitch; hp.reach = p5.reach)
	c.at(P + 10.8, func() -> void: her_pose = hp)
	# you hesitate... then answer: your palm to hers
	c.anim(P + 12.0, 2.2, func(k: float) -> void:
		pl.crouch = 0.55 * k
		pl.head_pitch_add = lerpf(0.32, 0.45, k))
	c.anim(P + 14.2, 0.8, func(k: float) -> void: pl.extra_reach = 0.45 * k)
	c.anim(P + 15.4, 1.1, func(k: float) -> void: pl.extra_reach = lerpf(0.45, 1.0, k))
	# -- 16.5: touch: a ring spreads through the water; Katoptron lights on you both
	c.anim(P + 16.5, 5.0, func(k: float) -> void:
		puzzles_ring(k * 5.0)
		touch_glow.set_shader_parameter("intensity", sin(minf(k * 3.0, 1.0) * PI * 0.5) * (1.0 - k) * 2.0), 0)
	c.at(P + 16.7, func() -> void:
		pl.fig.set_runes(1)
		her.set_runes(1))
	c.anim(P + 16.7, 2.5, func(k: float) -> void:
		var f := 1.0 + sin(k * PI) * 2.5
		pl.fig.set_param("glint", Game.HEM_PER_SHRINE[1] * f)
		her.set_param("glint", Game.HEM_PER_SHRINE[1] * 1.25 * f))
	# -- 23-30: her voice sings the motif; the camera draws in, slowly
	c.cam(P + 22.0, 7.5, POOL_C + Vector3(0, 0.2, 0.45), cam_yaw, -deg_to_rad(54.0), 2.7)
	# -- 30-37.6: her veil lifts: under it, the same unfinished marble face as yours
	c.anim(P + 30.0, 3.2, func(k: float) -> void: her.set_veil_lift(k))
	# -- 37.6: the whisper: her lips, that are not there, say something; the music stops
	c.anim(P + 37.6, 2.8, func(k: float) -> void:
		whisper_glow.set_shader_parameter("intensity", sin(k * PI) * (0.35 + 0.15 * sin(k * TAU * 3.0))))
	c.anim(P + 40.0, 1.4, func(k: float) -> void: her.set_veil_lift(1.0 - k))
	# -- 41-59: she rises, turns, and walks away into the world of reflections
	c.anim(P + 41.0, 1.8, func(k: float) -> void:
		var p6 := hp.copy()
		p6.crouch = 0.55 * (1.0 - k)
		p6.lean_x = -0.25 * (1.0 - k)
		p6.reach = 1.0 - k
		p6.head_pitch = 0.3 * (1.0 - k)
		_place(her, her_xf, p6))
	c.anim(P + 41.2, 1.6, func(k: float) -> void:
		pl.extra_reach = 1.0 - k
		pl.head_pitch_add = lerpf(0.45, 0.25, k))
	c.anim(P + 42.8, 1.2, func(k: float) -> void:
		var p7 := Figure.Pose.new()
		her_xf = Transform3D(Basis(Vector3.UP, yaw_n + PI * k), her_to)
		_place(her, her_xf, p7))
	c.anim(P + 44.0, 5.0, func(k: float) -> void:
		var p8 := Figure.Pose.new()
		p8.phase = k * 5.0 * 6.0
		p8.ripple = 0.8
		p8.body_y = absf(sin(p8.phase)) * 0.03
		p8.lean_x = -0.08
		her_xf = Transform3D(Basis(Vector3.UP, yaw_n + PI), her_to.lerp(her_to + Vector3(0, 0, 2.6), k))
		_place(her, her_xf, p8)
		her.set_param("vis", 1.0 - smoothstep(0.35, 1.0, k)), 0)
	# the pool goes quiet and shows only you
	c.at(P + 48.4, func() -> void:
		her.visible = false
		mine.visible = true
		mine.set_hem(pl.fig.hem)
		mine.set_runes(1))
	c.at(P + 51.1, func() -> void: mine.visible = false)
	c.anim(P + 48.4, 2.6, func(k: float) -> void:
		mine.set_param("vis", minf(k * 2.5, 1.0) * (1.0 - smoothstep(0.75, 1.0, k)) * 0.8)
		_place(mine, Transform3D(Basis(Vector3.UP, pl.yaw), pl.position), pl.fig.pose), 0)
	c.anim(P + 48.0, 2.5, func(k: float) -> void:
		pl.crouch = 0.55 * (1.0 - k)
		pl.head_pitch_add = 0.25 * (1.0 - k))
	c.anim(P + 48.0, 3.0, func(k: float) -> void: shrine_over.set_shader_parameter("calm", lerpf(0.6, 1.0, k)))
	# the fog draws back; far away the second shrine glows; the memory; I / VII
	c.cam(P + 49.0, 5.5, Level.SECOND_SHRINE.lerp(STAND, 0.62) + Vector3(0, 1.0, 0), -PI * 0.25, -World.PITCH, 13.0)
	c.anim(P + 49.0, 0.8, func(k: float) -> void: w.cam.near = lerpf(World.DIST - 1.6, 1.0, k), 0)
	c.anim(P + 49.0, 4.0, func(k: float) -> void:
		puzzles.crystal_lift = 2.4 * (1.0 - k)
		puzzles.shrine_halo.set_shader_parameter("intensity", lerpf(0.12, 0.8, k))
		puzzles.shrine_pillar.set_shader_parameter("fade", lerpf(0.15, 0.8, k))
		puzzles.shrine_light.light_energy = lerpf(0.7, 2.2, k))
	c.anim(P + 49.0, 7.0, func(k: float) -> void: w.set_awaken(k))
	c.anim(P + 50.0, 4.0, func(k: float) -> void: puzzles.far_pillar.set_shader_parameter("fade", lerpf(0.35, 0.6, k)))
	c.at(P + 49.5, func() -> void: g.ui.show_memory(Game.MEMORY_LINE, 3.0), false)
	c.at(P + 57.0, func() -> void:
		g.ui.show_milestone(1, Game.SHRINES_TOTAL, 3.5)
		g.sfx.play("bell_far", -12.0, 1.0))
	# back to you as the last chord fades
	c.cam(P + 56.0, 3.2, STAND + Vector3(0, 0.6, 0), -PI * 0.25, -World.PITCH, w.zoom)
	c.anim(P + 57.2, 2.0, func(k: float) -> void:
		g.ui.set_letterbox(1.0 - k)
		g.sfx.set_duck(1.0 - k))
	c.at(P + 59.3, func() -> void:
		g.sfx.set_duck(0.0)
		g.sfx.stop_cue("cinematic_hand", 1.5)
		g.sfx.stop_cue("shrine_awaken", 0.5)
		mine.visible = false
		her.visible = false
		touch_glow.set_shader_parameter("intensity", 0.0)
		whisper_glow.set_shader_parameter("intensity", 0.0)
		pl.fig.set_param("glint", Game.HEM_PER_SHRINE[1])
		pl.fig.set_hem(Game.HEM_PER_SHRINE[1])
		pl.extra_reach = 0.0
		pl.head_pitch_add = 0.0
		pl.head_yaw_add = 0.0
		pl.crouch = 0.0
		w.set_awaken(1.0)
		w.cam.near = 1.0
		puzzles.crystal_lift = 0.0
		puzzles.set_shrine_awake(1.0, 1.0))

func puzzles_ring(sec: float) -> void:
	shrine_over.set_shader_parameter("ring_c", TOUCH)
	shrine_over.set_shader_parameter("ring_t", sec if sec < 4.99 else -1.0)
