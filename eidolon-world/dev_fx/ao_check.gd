extends Node3D
## (Agent A, dev) one marble block on a floor slab, lit flat: checks the contact AO at the bottom of block sides.
func _ready() -> void:
	var fn := FastNoiseLite.new(); fn.seed = 17; fn.frequency = 0.012
	var img := fn.get_seamless_image(256, 256, false, false, 0.1, true); img.generate_mipmaps()
	var m := ShaderMaterial.new(); m.shader = preload("res://shaders/marble.gdshader")
	m.set_shader_parameter("noise_tex", ImageTexture.create_from_image(img))
	m.set_shader_parameter("pbr_k", 0.0)
	for spec in [[Vector3(0, 0.75, 0), Vector3(0.8, 1.5, 0.8)], [Vector3(0, -0.05, 0), Vector3(4, 0.1, 4)]]:
		var bm := BoxMesh.new(); bm.size = spec[1]
		var arr := bm.get_mesh_arrays(); var n: int = (arr[Mesh.ARRAY_VERTEX] as PackedVector3Array).size()
		var cols := PackedColorArray(); for i in n: cols.append(Color(0.3, 0.25, 0.0, 1.0))
		arr[Mesh.ARRAY_COLOR] = cols
		var am := ArrayMesh.new(); am.add_surface_from_arrays(Mesh.PRIMITIVE_TRIANGLES, arr)
		var mi := MeshInstance3D.new(); mi.mesh = am; mi.material_override = m; mi.position = spec[0]; add_child(mi)
	var env := Environment.new(); env.background_mode = Environment.BG_COLOR; env.background_color = Color(0.3, 0.3, 0.3)
	env.ambient_light_source = Environment.AMBIENT_SOURCE_COLOR; env.ambient_light_color = Color(1, 1, 1); env.ambient_light_energy = 0.5
	var we := WorldEnvironment.new(); we.environment = env; add_child(we)
	var c := Camera3D.new(); c.position = Vector3(1.8, 1.4, 2.6); add_child(c); c.look_at(Vector3(0, 0.6, 0))
	for k in 6: await get_tree().process_frame
	await RenderingServer.frame_post_draw
	get_viewport().get_texture().get_image().save_png(OS.get_cmdline_user_args()[0])
	get_tree().quit()
