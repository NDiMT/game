class_name TwoWorld
## v3 (dev/CH1_V3.md §0): the TWO WORLDS. Her world is what the glass and the still water show; yours is what the camera
## sees. One rule for every puzzle that uses the difference (I.1, I.4, N.1, N.4, W.3, W.6, I.20):
##   HER  = drawn ONLY by reflection cameras (a planar mirror / still water): things that exist only on her side.
##          Place them in the room as if they stood on YOUR side: the glass shows them reflected.
##   MINE = drawn ONLY by the main camera: things that exist only on your side (never in a reflection).
## Plus the factory for the great glass and the still water (a real planar reflection + her double, Reflector).

const HER := PlanarMirror.LAYER_DOUBLE
const MINE := PlanarMirror.LAYER_MAIN_FX
const BOTH := PlanarMirror.LAYER_WORLD

## put a node (and everything under it) in her world only
static func set_her(n: Node) -> void:
	_layer(n, HER)

## put a node (and everything under it) in your world only
static func set_mine(n: Node) -> void:
	_layer(n, MINE)

static func _layer(n: Node, mask: int) -> void:
	if n is VisualInstance3D: (n as VisualInstance3D).layers = mask
	for c in n.find_children("*", "VisualInstance3D", true, false): (c as VisualInstance3D).layers = mask

## the glass quad (mirror.gdshader) + its sheen; returns the glass material
static func glass_quad(parent: Node3D, noise: Texture2D, center: Vector3, basis: Basis, size: Vector2) -> ShaderMaterial:
	var m := ShaderMaterial.new()
	m.shader = preload("res://shaders/mirror.gdshader")
	m.set_shader_parameter("noise_tex", noise)
	m.set_shader_parameter("n", basis * Vector3.BACK)
	m.set_shader_parameter("floor_y", center.y - size.y * 0.5)
	m.set_shader_parameter("size", size)
	m.set_shader_parameter("ncols", 0)
	m.set_shader_parameter("crack", 0.0)
	m.set_shader_parameter("wall_mounted", 1.0 if absf((basis * Vector3.BACK).y) < 0.5 else 0.0)
	var q := QuadMesh.new()
	q.size = size
	var g := MeshInstance3D.new()
	g.name = "Glass"
	g.mesh = q
	g.material_override = m
	g.transform = Transform3D(basis, center)
	g.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	g.layers = MINE                  # (QA P1-5: a glass never renders into the viewport it samples)
	parent.add_child(g)
	var om := ShaderMaterial.new()
	om.shader = preload("res://shaders/mirror_over.gdshader")
	om.render_priority = 1
	om.set_shader_parameter("size", size)
	var o := MeshInstance3D.new()
	o.mesh = q
	o.material_override = om
	o.transform = Transform3D(basis, center + basis * Vector3(0, 0, 0.045))
	o.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	o.layers = MINE
	parent.add_child(o)
	return m

## a great standing glass: its quad, its planar reflection and her double (lag: she is half a second late).
## `n` faces the room (toward the camera side); `region` is where she shows in it
static func wall_mirror(parent: Node3D, game: Game, center: Vector3, n: Vector3, size: Vector2, region: Rect2, lag := 0.5) -> Reflector:
	var basis := Basis.looking_at(-n, Vector3.UP)          # the quad's +z (its face) along n
	var gm := glass_quad(parent, game.level.noise_tex, center, basis, size)
	var pm := PlanarMirror.new()
	parent.add_child(pm)
	pm.setup(n, n.dot(center), gm, game.world.env)
	var r := Reflector.new()
	r.kind = "mirror"
	r.plane_n = n
	r.plane_d = n.dot(center) + 0.001
	r.clip_c = center
	r.clip_u = basis.x
	r.clip_v = Vector3.UP
	r.clip_h = size * 0.5
	r.region = region
	r.lag = lag
	r.planar = pm
	parent.add_child(r)
	r.setup()
	return r

## a still, horizontal sheet of water that reflects for real (the I.1 / I.4 / I.20 kind)
static func still_water(parent: Node3D, game: Game, center: Vector3, half: Vector2, region: Rect2, lag := 0.5) -> Reflector:
	var basis := Basis(Vector3.RIGHT, -PI * 0.5)
	var gm := glass_quad(parent, game.level.noise_tex, center, basis, half * 2.0)
	gm.set_shader_parameter("floor_y", center.y)
	var pm := PlanarMirror.new()
	parent.add_child(pm)
	pm.setup(Vector3.UP, center.y, gm, game.world.env)
	pm.cam.far = 24.0
	pm.res_k = 0.5
	var r := Reflector.new()
	r.kind = "pool"
	r.plane_n = Vector3.UP
	r.plane_d = center.y + 0.001
	r.clip_c = center
	r.clip_u = Vector3.RIGHT
	r.clip_v = Vector3.BACK
	r.clip_h = half
	r.region = region
	r.lag = lag
	r.planar = pm
	parent.add_child(r)
	r.setup()
	return r
