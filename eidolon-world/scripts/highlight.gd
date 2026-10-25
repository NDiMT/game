class_name Highlight
extends Node3D
## v0.8.1: the interaction highlight, chosen centrally with the prompt (Game._update_focus): whatever
## the interact button will act on glows softly. The target is the small stone mesh(es) at the
## interact's position (found once among the puzzle / chapter / prop meshes on the game marble, by
## footprint): they get a soft aqua fresnel overlay. Where the target is part of the merged stone (a
## glass in a wall, a carved inscription), a soft ring lights on the floor before it instead.
const FADE := 0.15

var roots: Array = []
var marble: Array = []                # the marble materials (a candidate must wear one)
var cands: Array[MeshInstance3D] = []
var id := ""                          # the interact highlighted now ("" none)
var meshes: Array[MeshInstance3D] = []
var _in := ShaderMaterial.new()       # the current target's overlay
var _out := ShaderMaterial.new()      # the previous one, fading out
var _out_meshes: Array[MeshInstance3D] = []
var _ring: MeshInstance3D
var _ring_mat := ShaderMaterial.new()
var _ring_out := 0.0

func setup(r: Array, mats: Array) -> void:
	roots = r
	marble = mats
	var sh := preload("res://shaders/highlight.gdshader")
	_in.shader = sh
	_out.shader = sh
	_ring_mat.shader = preload("res://shaders/highlight_ring.gdshader")
	_ring_mat.render_priority = 3          # (v0.8.3: a fixed order over floor marks: no sort flicker)
	var pm := PlaneMesh.new()
	pm.size = Vector2(1.3, 1.3)
	_ring = MeshInstance3D.new()
	_ring.mesh = pm
	_ring.material_override = _ring_mat
	_ring.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	_ring.layers = PlanarMirror.LAYER_MAIN_FX
	_ring.visible = false
	add_child(_ring)
	for root in roots: _collect(root)

func _collect(n: Node) -> void:
	for ch in n.get_children():
		if ch is MeshInstance3D:
			var mi := ch as MeshInstance3D
			var ok := mi.material_override in marble
			if not ok and mi.mesh:
				for si in mi.mesh.get_surface_count():
					if mi.get_surface_override_material(si) in marble: ok = true
			if ok and mi.layers != PlanarMirror.LAYER_DOUBLE: cands.append(mi)
		_collect(ch)

## the meshes an interact acts on: the nearest small marble piece at its position, with its siblings
func targets(it: Level.Interact) -> Array[MeshInstance3D]:
	var out: Array[MeshInstance3D] = []
	var best: MeshInstance3D = null
	var bd := 0.75
	var q := Vector2(it.pos.x, it.pos.z)
	for mi in cands:
		if not mi.is_visible_in_tree(): continue
		var bb := mi.global_transform * mi.get_aabb()
		if bb.size.x > 4.6 or bb.size.z > 4.6 or bb.size.y > 6.0: continue
		if bb.end.y < it.pos.y - 0.6 or bb.position.y > it.pos.y + 2.6: continue
		var r := Rect2(bb.position.x, bb.position.z, bb.size.x, bb.size.z)
		var c := Vector2(clampf(q.x, r.position.x, r.end.x), clampf(q.y, r.position.y, r.end.y))
		var d := c.distance_to(q) + 0.05 * r.get_center().distance_to(q)
		if d < bd:
			bd = d
			best = mi
	if best == null: return out
	out.append(best)
	# (a thing made of several meshes under one node: a bust and its plinth, a stand and its glass)
	var par := best.get_parent()
	if par and not (par in roots):
		for ch in par.get_children():
			if ch is MeshInstance3D and ch != best and cands.has(ch): out.append(ch as MeshInstance3D)
	return out

func set_target(it: Level.Interact) -> void:
	var nid := it.id if it else ""
	if nid == id: return
	# the old target fades out; the new one fades in (both ~0.15 s)
	for mi in _out_meshes:
		if is_instance_valid(mi) and mi.material_overlay == _out: mi.material_overlay = null
	_out_meshes = meshes.duplicate()
	var tmp := _out; _out = _in; _in = tmp
	for mi in _out_meshes:
		if is_instance_valid(mi): mi.material_overlay = _out
	_in.set_shader_parameter("k", 0.0)
	_ring_out = 1.0 if _ring.visible else 0.0
	id = nid
	meshes = targets(it) if it else ([] as Array[MeshInstance3D])
	for mi in meshes: mi.material_overlay = _in
	if it and meshes.is_empty():
		_ring.position = Vector3(it.pos.x, it.pos.y + 0.025, it.pos.z)
		_ring.visible = true
		_ring_mat.set_shader_parameter("k", 0.0)
		_ring_out = 0.0
	elif not it:
		pass
	else:
		_ring.visible = _ring_out > 0.0

func update(dt: float) -> void:
	var kin: float = _in.get_shader_parameter("k") if _in.get_shader_parameter("k") != null else 0.0
	_in.set_shader_parameter("k", minf(1.0, kin + dt / FADE) if id != "" else maxf(0.0, kin - dt / FADE))
	var kout: float = _out.get_shader_parameter("k") if _out.get_shader_parameter("k") != null else 0.0
	kout = maxf(0.0, kout - dt / FADE)
	_out.set_shader_parameter("k", kout)
	if kout <= 0.0 and not _out_meshes.is_empty():
		for mi in _out_meshes:
			if is_instance_valid(mi) and mi.material_overlay == _out: mi.material_overlay = null
		_out_meshes.clear()
	# the floor ring (targets in the merged stone)
	var rk: float = _ring_mat.get_shader_parameter("k") if _ring_mat.get_shader_parameter("k") != null else 0.0
	var ring_on := id != "" and meshes.is_empty()
	rk = minf(1.0, rk + dt / FADE) if ring_on else maxf(0.0, rk - dt / FADE)
	_ring_mat.set_shader_parameter("k", rk)
	_ring.visible = rk > 0.0
