class_name WaterLook
## v2.0 (Agent A) looks for the game's water (water.gdshader) beyond the default pool.
##   WaterLook.flooded(mat, stones, decoys)   N.1 the Flooded Colonnade: murky green-grey water, ripples and glints,
##       a drifting foam edge, and stones a few cm under it, the true ones and the false ones ALIKE (soft paler squares
##       wavering in the ripples): her reflection is the only guide. stones / decoys: world Vector3 (x, y, z) centres;
##       `half` their half size (m), `yaw` taken from their index like Map2 turns them (0.2 * k).
static func flooded(mat: ShaderMaterial, stones: Array, decoys: Array = [], half := 0.45) -> void:
	if mat == null: return
	mat.set_shader_parameter("deep", Color(0.17, 0.21, 0.205))
	mat.set_shader_parameter("shallow", Color(0.30, 0.34, 0.31))
	mat.set_shader_parameter("sky", Color(0.60, 0.64, 0.66))
	mat.set_shader_parameter("shore", 0.05)
	mat.set_shader_parameter("foam_k", 0.7)
	mat.set_shader_parameter("ripple_k", 0.8)
	mat.set_shader_parameter("glint_k", 1.2)
	var arr := PackedVector4Array()
	var k := 0
	for p in stones:
		arr.append(Vector4(p.x, p.z, half, 0.2 * k)); k += 1
	for p in decoys:
		arr.append(Vector4(p.x, p.z, half, 0.2 * k + 0.4)); k += 1
	while arr.size() < 24: arr.append(Vector4(0, 0, 0, 0))
	mat.set_shader_parameter("sub", arr)
	mat.set_shader_parameter("n_sub", mini(stones.size() + decoys.size(), 24))
	mat.set_shader_parameter("sub_k", 0.7)

## N.1's false stones (Map2 local x, z): under the water like the true ones, off the true path and clear of the shafts
const N1_FALSE := [[0.6, -9.8], [4.6, -10.4], [0.4, -12.6], [4.8, -12.4], [1.4, -14.2]]
## the N.1 sheet as Map2 builds it: call once after Map2.water (finds the sheet by its place)
static func flooded_n1(parent: Node) -> void:
	var c := Map2.w(2.5, -12.0, Map2.N1_WATER_Y)
	for n in parent.get_children():          # (Map2.water's sheets: the same name each, so Godot renames all but the first)
		var mi := n as MeshInstance3D
		if mi == null or not (mi.material_override is ShaderMaterial): continue
		if (mi.material_override as ShaderMaterial).shader != preload("res://shaders/water.gdshader"): continue
		if Vector2(mi.global_position.x - c.x, mi.global_position.z - c.z).length() < 0.6:
			var st := []
			for s in Map2.N1_STONES: st.append(Map2.w(s[0], s[1], Map2.N1_Y))
			var fs := []
			for s in N1_FALSE: fs.append(Map2.w(s[0], s[1], Map2.N1_Y))
			flooded(mi.material_override as ShaderMaterial, st, fs)
			return
