class_name Kit3
## v3: the small building blocks the Chapter I beats share (the v2 ones lived on Puzzles / Chapter / Hub, which v3
## does not build): a marble piece of its own (it moves), a rune face, a soft glow, a breath pane (I.3's fog), bars
## (a low gate), a little film of water, the lamp and the comb. Static: pass the game.

static var _rune_shader: Shader

## a marble mesh as its own node (a moving piece); its occluding parts fade in the see-through like any wall
static func marble(game: Game, mesh: Mesh, parent: Node3D) -> MeshInstance3D:
	var mi := MeshInstance3D.new()
	mi.mesh = MB.split_occ(mesh)
	for si in mi.mesh.get_surface_count():
		mi.set_surface_override_material(si, game.level.marble_occ_mat if mi.mesh.surface_get_name(si) == "occ" else game.level.marble_mat)
	parent.add_child(mi)
	return mi

static func rune(parent: Node3D, pos: Vector3, size: Vector2, basis: Basis, design: float, lit: float) -> ShaderMaterial:
	if _rune_shader == null: _rune_shader = preload("res://shaders/rune_face.gdshader")
	var m := ShaderMaterial.new()
	m.shader = _rune_shader
	m.set_shader_parameter("design", design)
	m.set_shader_parameter("lit", lit)
	m.set_shader_parameter("numeral", 0.0)
	m.set_shader_parameter("on_floor", 1.0 if (basis * Vector3.BACK).y > 0.7 else 0.0)
	_quad(parent, m, size, Transform3D(basis, pos))
	return m

static func glow(parent: Node3D, pos: Vector3, size: float, col: Color, intensity: float) -> ShaderMaterial:
	var m := ShaderMaterial.new()
	m.shader = preload("res://shaders/halo.gdshader")
	m.set_shader_parameter("color", col)
	m.set_shader_parameter("intensity", intensity)
	_quad(parent, m, Vector2(size, size), Transform3D(Basis(), pos))
	return m

static func _quad(parent: Node3D, m: Material, size: Vector2, xf: Transform3D) -> MeshInstance3D:
	var q := QuadMesh.new()
	q.size = size
	var mi := MeshInstance3D.new()
	mi.mesh = q
	mi.material_override = m
	mi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	mi.transform = xf
	parent.add_child(mi)
	return mi

## a small fogged glass (I.3): the glass quad and the breath layer over it; returns the breath material ("fog", "write")
static func breath_pane(parent: Node3D, game: Game, center: Vector3, basis: Basis, size: Vector2) -> ShaderMaterial:
	var gm := TwoWorld.glass_quad(parent, game.level.noise_tex, center, basis, size)
	gm.set_shader_parameter("floor_y", center.y - 1.2)
	var bm := ShaderMaterial.new()
	bm.shader = preload("res://shaders/breath.gdshader")
	for kv in [["noise_tex", game.level.noise_tex], ["glyphs", Vector3(99, -1, -1)], ["flip", 1.0], ["size", size], ["vertical", 0.0]]:
		bm.set_shader_parameter(kv[0], kv[1])
	bm.render_priority = 2
	var mi := _quad(parent, bm, size, Transform3D(basis, center + basis * Vector3(0, 0, 0.06)))
	mi.layers = TwoWorld.MINE
	return bm

## iron-dark bars across a doorway (`w` wide, along z or x), 2.6 m high: a low gate that rises out of the way
static func bars(game: Game, parent: Node3D, at: Vector3, w: float, along_z: bool) -> Node3D:
	var n := Node3D.new()
	n.position = at
	parent.add_child(n)
	var m := MB.new()
	w -= 0.16                        # (a hair inside the doorway's wall ends)
	var cnt := int(w / 0.24)
	for i in cnt + 1:
		var o := -w * 0.5 + w * float(i) / cnt
		m.cyl(Vector3(0, 1.3, o) if along_z else Vector3(o, 1.3, 0), 0.035, 0.035, 2.6, Color(0.5, 1.0, 0.0), 6)
	for y in [0.5, 2.2]:
		m.box(Vector3(0, y, 0), Vector3(0.08, 0.08, w) if along_z else Vector3(w, 0.08, 0.08), Color(0.5, 1.0, 0.0))
	marble(game, m.commit(), n)
	return n

static func water_mat() -> StandardMaterial3D:
	var pm := StandardMaterial3D.new()
	pm.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	pm.albedo_color = Color(0.16, 0.19, 0.22, 0.72)
	pm.metallic = 0.6
	pm.roughness = 0.05
	return pm

## her lamp: a small bronze oil lamp with its flame (and, held, a warm light)
static func lamp(game: Game, lit_light := false) -> Node3D:
	var n := Node3D.new()
	n.name = "Lamp"
	var m := MB.new()
	m.cyl(Vector3(0, 0.05, 0), 0.07, 0.09, 0.1, Color(0.5, 0.9, 0.0), 10)
	m.cyl(Vector3(0, 0.12, 0), 0.02, 0.05, 0.05, Color(0.5, 0.9, 0.0), 8)
	m.box(Vector3(0.08, 0.1, 0), Vector3(0.1, 0.02, 0.02), Color(0.5, 0.9, 0.0))
	var mi := marble(game, m.commit(), n)
	mi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	var f := Flame.new(0.0, 0.16, Palette.FIRE_LIGHT, game.level.noise_tex)
	f.position = Vector3(0, 0.14, 0)
	f.mat.set_shader_parameter("intensity", 0.85)
	f.bounce = false
	n.add_child(f)
	if lit_light:
		var l := OmniLight3D.new()
		l.light_color = Color(1.0, 0.72, 0.45)
		l.omni_range = 4.5
		l.omni_attenuation = 1.6
		l.light_energy = 0.6
		l.shadow_enabled = false
		l.position = Vector3(0, 0.3, 0)
		n.add_child(l)
	return n

## the shell comb (the story item; Tripo model when there)
static func comb(game: Game) -> Node3D:
	var p := "res://assets/models/items/item_comb.glb"
	if ResourceLoader.exists(p):
		var c: Node3D = (load(p) as PackedScene).instantiate()
		c.scale = Vector3.ONE * 2.2
		return c
	var m := MB.new()
	m.box(Vector3(0, 0.03, 0), Vector3(0.1, 0.03, 0.08), Color(0.5, 0.25, 0.0))
	var root := Node3D.new()
	marble(game, m.commit(), root)
	return root
