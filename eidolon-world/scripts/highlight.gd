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
		if not is_instance_valid(mi) or not mi.is_visible_in_tree(): continue      # (a freed pickup marker's bed)
		if _carried(mi): continue          # (the lamp in her hand is never what a place's prompt acts on)
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

static func _carried(n: Node) -> bool:
	var p := n.get_parent()
	while p:
		if p is Player: return true
		p = p.get_parent()
	return false

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

# ---------------------------------------------------------------- (v3 clarity) the glints: what can be touched reads from afar
## Every interact she can use now, within GLINT_R but not yet in reach, wears a small crimson twinkle over the thing it
## acts on (the nearest MAX_GLINTS; the one in reach has the overlay instead). A beat's hint flares its space's glints.
const GLINT_R := 6.5
const MAX_GLINTS := 4
const GLINT_SH := """shader_type spatial;
render_mode unshaded, blend_mix, depth_draw_never, cull_disabled, shadows_disabled, fog_disabled;
global uniform vec4 accent;
uniform float k = 0.0;
uniform float ph = 0.0;
void vertex() {
	MODELVIEW_MATRIX = VIEW_MATRIX * mat4(INV_VIEW_MATRIX[0], INV_VIEW_MATRIX[1], INV_VIEW_MATRIX[2], MODEL_MATRIX[3]);
}
void fragment() {
	vec2 q = UV * 2.0 - 1.0;
	float r = length(q);
	float tw = 0.75 + 0.25 * pow(0.5 + 0.5 * sin(TIME * 2.2 + ph), 2.0);
	// a four-point star (arms thin out to the tips), a bright heart, a faint ring: reads at ~30 px on a phone
	float star = max(0.0, 1.0 - abs(q.x) * 5.0 - abs(q.y) * 1.05) + max(0.0, 1.0 - abs(q.y) * 5.0 - abs(q.x) * 1.05);
	float core = exp(-r * r * 30.0);
	float ring = smoothstep(0.1, 0.0, abs(r - 0.42 - 0.08 * tw)) * 0.45;
	float a = clamp(star * 1.2 + core + ring, 0.0, 1.0);
	// (mixed, not added: an added crimson vanishes on the pale marble) a deep crimson star with a pale heart
	ALBEDO = mix(accent.rgb * 0.95, vec3(1.0, 0.82, 0.8), clamp(core * 1.3, 0.0, 1.0));
	ALPHA = a * clamp(k, 0.0, 1.0) * tw;
}
"""
var _gl_sh: Shader
var _gl_pool: Array[MeshInstance3D] = []
var _gl_of := {}                  # interact id -> its glint mesh (this frame's)
var _gl_anchor := {}              # interact id -> the point over the thing it acts on (found once)
var _flare := {}                  # space key -> seconds of hint flare left

func flare(space_key: String, s := 2.5) -> void:
	_flare[space_key] = s

func anchor(it: Level.Interact) -> Vector3:
	if _gl_anchor.has(it.id): return _gl_anchor[it.id]
	var ms := targets(it)
	var a := it.pos + Vector3(0, 0.95, 0)
	if not ms.is_empty():
		var bb := ms[0].global_transform * ms[0].get_aabb()
		if bb.size.y < 2.4: a = Vector3(bb.get_center().x, bb.end.y + 0.32, bb.get_center().z)
	_gl_anchor[it.id] = a
	return a

## called each play frame by the game (after the focus is chosen), with the space she stands in
func glints(level: Level, p: Vector3, dt: float, space_key: String, on: bool) -> void:
	for s in _flare.keys():
		_flare[s] = float(_flare[s]) - dt
		if _flare[s] <= 0.0: _flare.erase(s)
	var pick: Array = []
	if on:
		for it in level.interacts:
			if not it.enabled or it.id == id: continue
			if absf(it.pos.y - p.y) > 2.0: continue
			var d := Vector2(it.pos.x - p.x, it.pos.z - p.z).length()
			if d > GLINT_R or d < it.radius * 0.8: continue
			if it.cond.is_valid() and not it.cond.call(): continue
			pick.append([d, it])
		pick.sort_custom(func(a: Array, b: Array) -> bool: return a[0] < b[0])
		pick.resize(mini(pick.size(), MAX_GLINTS))
	var want := {}
	for e in pick: want[(e[1] as Level.Interact).id] = e[1]
	var fl := 1.0 + (1.2 if _flare.has(space_key) else 0.0)
	# fade out the ones no longer wanted, in the ones that are
	for gid in _gl_of.keys():
		var mi: MeshInstance3D = _gl_of[gid]
		var m := mi.material_override as ShaderMaterial
		var kk: float = m.get_shader_parameter("k")
		if want.has(gid): kk = move_toward(kk, 0.95 * fl, dt * 2.5)
		else: kk = move_toward(kk, 0.0, dt * 3.0)
		m.set_shader_parameter("k", kk)
		if kk <= 0.0 and not want.has(gid):
			mi.visible = false
			_gl_pool.append(mi)
			_gl_of.erase(gid)
	for gid in want:
		if _gl_of.has(gid): continue
		var mi := _gl_get()
		if mi == null: break
		mi.global_position = anchor(want[gid])
		(mi.material_override as ShaderMaterial).set_shader_parameter("ph", float(hash(gid) % 628) / 100.0)
		mi.visible = true
		_gl_of[gid] = mi

func _gl_get() -> MeshInstance3D:
	if not _gl_pool.is_empty(): return _gl_pool.pop_back()
	if _gl_of.size() >= MAX_GLINTS + 2: return null
	if _gl_sh == null:
		_gl_sh = Shader.new()
		_gl_sh.code = GLINT_SH
	var m := ShaderMaterial.new()
	m.shader = _gl_sh
	m.render_priority = 4
	m.set_shader_parameter("k", 0.0)
	var q := QuadMesh.new()
	q.size = Vector2(0.8, 0.8)
	var mi := MeshInstance3D.new()
	mi.mesh = q
	mi.material_override = m
	mi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	mi.layers = PlanarMirror.LAYER_MAIN_FX
	add_child(mi)
	return mi
