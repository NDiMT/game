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

## (a5) v2's N.1 is gone (Map2 deleted): kept as a no-op so an old call still parses; v3's N.1 dresses itself
static func flooded_n1(_parent: Node) -> void:
	pass
