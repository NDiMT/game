class_name Juice
extends Node3D
## (v1.1) A's soft particles sample the depth texture: the web build's WebGL2 could not make the back
## buffers for it ("Could not create 3D back buffers"), so on the web the classic bursts stay alone
static var soft_ok := not OS.has_feature("web")
## v1.0 M1 "juice": small physical moments that make the world feel heavy and alive. One-shot particle
## bursts (CPU particles, a soft round sprite, freed when done), wet-stone sheens that dry, a tiny
## translation-only camera shake (World.shake), and the event hooks that place them: the pool's rising
## stones, doors and gates grinding (dust from the lintel), statues turning (a grit trickle), braziers
## igniting (a flare, sparks), bridges and weights landing, a pressed plate, Our Steps' steps, items found.
## Everything here is gameplay-side; the look of each sprite comes from the existing soft-sprite and
## water-ring shaders (Agent A owns those).

var game: Game
static var _sprite_mat: StandardMaterial3D
static var _quad: QuadMesh
var live := 0                      # (tests / perf) bursts alive now
var fired := {}                    # (tests) kind -> count

func setup(g: Game) -> void:
	game = g
	if _sprite_mat == null:
		var gt := GradientTexture2D.new()
		gt.fill = GradientTexture2D.FILL_RADIAL
		gt.fill_from = Vector2(0.5, 0.5)
		gt.fill_to = Vector2(1.0, 0.5)
		gt.width = 32
		gt.height = 32
		var gr := Gradient.new()
		gr.set_color(0, Color(1, 1, 1, 1))
		gr.set_color(1, Color(1, 1, 1, 0))
		gt.gradient = gr
		_sprite_mat = StandardMaterial3D.new()
		_sprite_mat.albedo_texture = gt
		_sprite_mat.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
		_sprite_mat.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
		_sprite_mat.vertex_color_use_as_albedo = true
		_sprite_mat.billboard_mode = BaseMaterial3D.BILLBOARD_PARTICLES
		_sprite_mat.disable_receive_shadows = true
		_sprite_mat.no_depth_test = false
		_quad = QuadMesh.new()
		_quad.size = Vector2(1, 1)
	game.chapter.event.connect(_on_chapter)
	game.puzzles.event.connect(_on_puzzles)
	_prewarm.call_deferred()

## (smoothness) every material a burst uses is drawn once, far below the world, while the game warms up:
## the first door or brazier never stalls on a shader compile
func _prewarm() -> void:
	var at := Vector3(0, -60, 0)
	burst(at, "prewarm", 2, Vector3.ONE * 0.1, Vector3.UP, 10.0, Vector2(0.1, 0.2), Vector2(0.1, 0.1), DUST, 0.3)
	ring(at, 0.5, 0.3)
	var n := Node3D.new()
	add_child(n)
	n.global_position = at
	wet(n, Vector2(0.2, 0.2), 0.0, 0.3)
	get_tree().create_timer(1.0).timeout.connect(n.queue_free)
	fired.clear()

func _count(kind: String) -> void:
	fired[kind] = int(fired.get(kind, 0)) + 1

## one burst of soft sprites. `box` the emission half-extents, `vel` the mean velocity, `spread` degrees
func burst(at: Vector3, kind: String, amount: int, box: Vector3, vel: Vector3, spread: float, speed: Vector2,
		size: Vector2, col: Color, life: float, gravity := Vector3(0, -2.0, 0), parent: Node3D = null) -> CPUParticles3D:
	if game and game.world and not game.world.quality_high: amount = maxi(4, amount / 2)
	var p := CPUParticles3D.new()
	p.mesh = _quad
	p.material_override = _sprite_mat
	p.amount = amount
	p.one_shot = true
	p.explosiveness = 0.8
	p.lifetime = life
	p.local_coords = false
	p.direction = vel.normalized() if vel.length() > 0.001 else Vector3.UP
	p.spread = spread
	p.initial_velocity_min = speed.x
	p.initial_velocity_max = speed.y
	p.gravity = gravity
	p.damping_min = 0.6
	p.damping_max = 1.4
	p.scale_amount_min = size.x
	p.scale_amount_max = size.y
	var sc := Curve.new()
	sc.add_point(Vector2(0.0, 0.5))
	sc.add_point(Vector2(0.3, 1.0))
	sc.add_point(Vector2(1.0, 1.3))
	p.scale_amount_curve = sc
	p.emission_shape = CPUParticles3D.EMISSION_SHAPE_BOX
	p.emission_box_extents = box
	var ramp := Gradient.new()
	ramp.set_color(0, col)
	ramp.add_point(0.25, col)
	ramp.set_color(ramp.get_point_count() - 1, Color(col.r, col.g, col.b, 0.0))
	p.color_ramp = ramp
	p.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	p.layers = PlanarMirror.LAYER_MAIN_FX
	(parent if parent else self).add_child(p)
	p.global_position = at
	p.emitting = true
	live += 1
	_count(kind)
	get_tree().create_timer(life + 0.6).timeout.connect(func() -> void:
		live -= 1
		if is_instance_valid(p): p.queue_free())
	return p

# ------------------------------------------------------------------ the kinds
const DUST := Color(0.86, 0.84, 0.8, 0.5)
const GRIT := Color(0.55, 0.53, 0.5, 0.9)
const EMBER := Color(1.0, 0.45, 0.3, 0.95)

## a heavy thing settles: a low ring of dust rolling out over the floor
func dust_floor(at: Vector3, r := 0.6, amount := 26) -> void:
	burst(at + Vector3(0, 0.05, 0), "dust", amount, Vector3(r, 0.02, r), Vector3(0, 0.3, 0), 80.0, Vector2(0.3, 0.9), Vector2(0.18, 0.42), DUST, 1.6, Vector3(0, -0.15, 0))

## dust sifting down from a lintel or a ceiling edge (along `along`, half length)
func dust_fall(at: Vector3, along: Vector3, amount := 30) -> void:
	var box := Vector3(absf(along.x) + 0.05, 0.05, absf(along.z) + 0.05)
	burst(at, "dust_fall", amount, box, Vector3(0, -1, 0), 25.0, Vector2(0.1, 0.5), Vector2(0.08, 0.22), DUST, 2.2, Vector3(0, -1.2, 0))
	burst(at, "grit", amount / 3, box, Vector3(0, -1, 0), 10.0, Vector2(0.2, 0.6), Vector2(0.025, 0.05), GRIT, 1.0, Vector3(0, -9.0, 0))

## stone on stone: a grit trickle from the joint
func grit(at: Vector3, r := 0.35) -> void:
	burst(at, "grit", 14, Vector3(r, 0.05, r), Vector3(0, -1, 0), 30.0, Vector2(0.1, 0.5), Vector2(0.02, 0.045), GRIT, 0.9, Vector3(0, -9.0, 0))
	burst(at, "dust", 8, Vector3(r, 0.05, r), Vector3(0, 0.2, 0), 70.0, Vector2(0.1, 0.35), Vector2(0.08, 0.18), DUST, 1.2, Vector3(0, -0.2, 0))

## fire catching: sparks lifting, a flare
func sparks(at: Vector3) -> void:
	burst(at, "sparks", 18, Vector3(0.08, 0.05, 0.08), Vector3(0, 1, 0), 28.0, Vector2(0.8, 2.0), Vector2(0.02, 0.05), EMBER, 1.1, Vector3(0, 0.8, 0))

## a found thing: a small soft glint burst
func glint(at: Vector3) -> void:
	burst(at, "glint", 16, Vector3(0.12, 0.12, 0.12), Vector3(0, 1, 0), 180.0, Vector2(0.2, 0.7), Vector2(0.03, 0.07), Color(1.0, 0.86, 0.84, 0.9), 1.2, Vector3(0, 0.1, 0))

## a spreading ring on still water (the existing ring shader)
func ring(at: Vector3, size := 1.6, dur := 1.4) -> void:
	var m := ShaderMaterial.new()
	m.shader = preload("res://shaders/water_ring.gdshader")
	m.set_shader_parameter("t", 0.0)
	var pm := PlaneMesh.new()
	pm.size = Vector2(size, size)
	var mi := MeshInstance3D.new()
	mi.mesh = pm
	mi.material_override = m
	mi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	add_child(mi)
	mi.global_position = at + Vector3(0, 0.015, 0)
	_count("ring")
	var tw := mi.create_tween()
	tw.tween_method(func(v: float) -> void: m.set_shader_parameter("t", v), 0.0, 1.0, dur).set_ease(Tween.EASE_OUT).set_trans(Tween.TRANS_SINE)
	tw.tween_callback(mi.queue_free)

## water running off the edges of a stone rising out of the pool, for `dur` seconds (follows the stone)
func sheet(node: Node3D, half: Vector2, top: float, dur: float) -> void:
	for e in 4:
		var horiz := e < 2
		var off := Vector3(0.0, top, (half.y if e == 0 else -half.y)) if horiz else Vector3((half.x if e == 2 else -half.x), top, 0.0)
		var box := Vector3(half.x, 0.01, 0.01) if horiz else Vector3(0.01, 0.01, half.y)
		var p := burst(node.global_position + node.global_transform.basis * off, "sheet", 26, box, off.normalized() * Vector3(1, 0, 1) + Vector3(0, -0.4, 0), 20.0, Vector2(0.15, 0.45),
			Vector2(0.025, 0.06), Color(0.86, 0.92, 0.96, 0.85), 0.75, Vector3(0, -9.0, 0))
		p.one_shot = false
		p.explosiveness = 0.0
		p.local_coords = false
		var tw := p.create_tween()
		tw.tween_interval(dur)
		tw.tween_callback(func() -> void: p.emitting = false)
		# (it rides up with the stone)
		p.set_meta("follow", [node, off])
		_follow.append(p)

var _follow: Array = []
func _process(_dt: float) -> void:
	if _follow.is_empty(): return
	for i in range(_follow.size() - 1, -1, -1):
		var p = _follow[i]
		if not is_instance_valid(p) or not (p as CPUParticles3D).emitting:
			_follow.remove_at(i)
			continue
		var f: Array = p.get_meta("follow")
		var n: Node3D = f[0]
		if is_instance_valid(n): p.global_position = n.global_position + n.global_transform.basis * (f[1] as Vector3)

## a stone's top, wet and darker, drying over `dur` seconds (a thin film on its top face)
func wet(node: Node3D, half: Vector2, top: float, dur := 3.0) -> void:
	var m := StandardMaterial3D.new()
	m.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	m.albedo_color = Color(0.16, 0.18, 0.2, 0.42)
	m.roughness = 0.15
	m.metallic_specular = 0.9
	var bm := PlaneMesh.new()
	bm.size = half * 2.0 - Vector2(0.02, 0.02)
	var mi := MeshInstance3D.new()
	mi.mesh = bm
	mi.material_override = m
	mi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	mi.layers = PlanarMirror.LAYER_MAIN_FX
	node.add_child(mi)
	mi.position = Vector3(0, top + 0.004, 0)
	_count("wet")
	var tw := mi.create_tween()
	tw.tween_interval(dur * 0.25)
	tw.tween_method(func(v: float) -> void: m.albedo_color.a = v, 0.42, 0.0, dur * 0.75).set_trans(Tween.TRANS_SINE)
	tw.tween_callback(mi.queue_free)

## the same, for a stone of any shape: a dark wet film over its own mesh (top and sides), drying
func wet_mesh(node: Node3D, mesh: Mesh, dur := 3.0) -> void:
	var m := StandardMaterial3D.new()
	m.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	m.albedo_color = Color(0.14, 0.16, 0.18, 0.45)
	m.roughness = 0.12
	m.metallic_specular = 0.9
	var mi := MeshInstance3D.new()
	mi.mesh = mesh
	mi.material_override = m
	mi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	mi.layers = PlanarMirror.LAYER_MAIN_FX
	node.add_child(mi)
	mi.transform = Transform3D(Basis.from_scale(Vector3(1.006, 1.0, 1.006)), Vector3(0, 0.003, 0))
	_count("wet")
	var tw := mi.create_tween()
	tw.tween_interval(dur * 0.2)
	tw.tween_method(func(v: float) -> void: m.albedo_color.a = v, 0.45, 0.0, dur * 0.8).set_trans(Tween.TRANS_SINE)
	tw.tween_callback(mi.queue_free)

## (v1.0) a stone rises out of still water: the surface bulges and rings first, then it breaks through,
## water sheets off its edges as it climbs, and its wet stone darkens and dries over 3 s
func stone_rises(node: Node3D, water_y: float, rise_t: float, delay: float) -> void:
	var at := Vector3(node.global_position.x, water_y, node.global_position.z)
	var mi: MeshInstance3D = null
	for c in node.get_children():
		if c is MeshInstance3D and (c as MeshInstance3D).mesh:
			mi = c
			break
	var ab := mi.mesh.get_aabb() if mi else AABB(Vector3(-0.6, -0.5, -0.6), Vector3(1.2, 0.5, 1.2))
	var half := Vector2(ab.size.x * 0.5, ab.size.z * 0.5)
	var tw := create_tween()
	tw.tween_interval(maxf(0.0, delay - 0.35))
	tw.tween_callback(func() -> void:
		ring(at, 1.8, 1.0)
		burst(at, "bubbles", 10, Vector3(half.x * 0.6, 0.01, half.y * 0.6), Vector3.UP, 15.0, Vector2(0.2, 0.5), Vector2(0.02, 0.05), Color(0.9, 0.95, 1.0, 0.7), 0.5, Vector3(0, -1.0, 0)))
	tw.tween_interval(0.35)
	var fx: WaterFX = game.puzzles.pool_fx if game.puzzles else null
	tw.tween_callback(func() -> void:
		ring(at, 3.4, 2.2)
		sheet(node, half, 0.0, rise_t * 0.9)
		if Juice.soft_ok: FxBurst.splash(self, at, 1.0)                    # (v1.1 A: soft spray as it breaks the surface)
		# (A's water: a foam collar, a sheeting band and rings off its edges, on the water itself)
		if fx:
			fx.rise(Rect2(at.x - half.x, at.z - half.y, half.x * 2.0, half.y * 2.0), rise_t + 0.6)
			fx.splash(at, 1.0)
		shake(0.12))
	tw.tween_interval(rise_t)
	tw.tween_callback(func() -> void:
		# (wet stone that dries in patches: the marble's own per-instance `wet`, A's; the film where it is absent)
		if fx and mi:
			fx.wet_dry(mi, 3.0, water_y)
			_count("wet")
		elif mi: wet_mesh(node, mi.mesh, 3.0))

func shake(a: float) -> void:
	if game.world: game.world.shake(a)

# ------------------------------------------------------------------ the hooks
func _on_chapter(name: String, data: Variant) -> void:
	var ch := game.chapter
	match name:
		"statue_turn":
			if data is int and data >= 0 and data < 3:
				grit(Vector3(Chapter.TURN_X[data], 1.05, Chapter.TURN_Z), 0.45)
		"brazier":
			sparks(Chapter.SH_BRAZ[data] + Vector3(0, 1.15, 0))
			if Juice.soft_ok: FxBurst.sparks(self, Chapter.SH_BRAZ[data] + Vector3(0, 1.15, 0))          # (v1.1 A: soft sparks)
		"door_real":
			dust_fall(Vector3(16.95, 4.4, -11.8), Vector3(0, 0, 0.9))
			if Juice.soft_ok: FxBurst.dust(self, Vector3(16.95, 1.2, -11.8), 1.4)
			shake(0.25)
		"steps_step":
			if ch.steps: dust_floor(ch.steps.tile(ch.steps.p), 0.25, 8)
		"steps_blocked":
			if ch.steps: grit(ch.steps.tile(ch.steps.p) + Vector3(0, 0.3, 0), 0.2)
		"weight_hang":
			shake(0.18)
			dust_floor(game.player.position, 0.5, 12)
		"lift":
			shake(0.2)
		"shard", "memory":
			glint(game.player.position + Vector3(0, 1.1, 0))
		"hall_lock":
			grit(game.player.position + Vector3(0, 0.6, 0) - game.player.fig.global_transform.basis.z * 0.8, 0.3)
		"solve":
			match str(data):
				"hollow_walk":
					# the gate grinds up its posts
					get_tree().create_timer(0.6).timeout.connect(func() -> void:
						if Juice.soft_ok: FxBurst.dust(self, Vector3(18.5, 1.3, -15.15), 1.4)
						dust_fall(Vector3(18.5, 3.9, -15.15), Vector3(1.0, 0, 0))
						dust_floor(Vector3(18.5, 1.0, -15.15), 0.9, 18)
						shake(0.22))
				"shard_gallery":
					dust_fall(Vector3(8.1, 3.4, -9.45), Vector3(0.7, 0, 0))
					if Juice.soft_ok: FxBurst.dust(self, Vector3(8.1, 1.3, -9.45), 1.2)
					shake(0.2)
				"court_light":
					dust_fall(Vector3(12.0, 5.6, Chapter.MURAL_Z + 0.2), Vector3(2.4, 0, 0), 40)
					shake(0.3)

func _on_puzzles(name: String, data: Variant) -> void:
	var pz := game.puzzles
	match name:
		"door_grind":
			if pz.door:
				var dp: Vector3 = pz.door.global_position
				dust_fall(dp + Vector3(0, 3.9, 0), Vector3(1.0, 0, 0.2), 36)
				dust_floor(dp + Vector3(0, 0.0, 0), 1.0, 20)
				if Juice.soft_ok: FxBurst.dust(self, dp + Vector3(0, 0.6, 0), 1.6)
		"gate_open":
			if pz.gate_bars:
				dust_fall(pz.gate_bars.global_position + Vector3(0, 2.9, 0), Vector3(0, 0, 1.0))
				if Juice.soft_ok: FxBurst.dust(self, pz.gate_bars.global_position + Vector3(0, 0.5, 0), 1.2)
				shake(0.15)
		"bridge_fall":
			get_tree().create_timer(0.85).timeout.connect(func() -> void:
				if pz.drawbridge: dust_floor(pz.drawbridge.global_position, 1.2, 30))
		"bridge_rise":
			if pz.risen_bridge: dust_floor(pz.risen_bridge.global_position + Vector3(0, 0.1, 0), 1.2, 30)
			shake(0.25)
		"plate_touch":
			dust_floor(game.player.position, 0.35, 10)
		"mirror_turn":
			grit(game.player.position + Vector3(0, 0.4, 0) - game.player.fig.global_transform.basis.z * 0.7, 0.3)
		"dial":
			grit(game.player.position + Vector3(0, 0.9, 0) - game.player.fig.global_transform.basis.z * 0.6, 0.2)
