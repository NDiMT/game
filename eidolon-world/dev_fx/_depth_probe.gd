extends Node3D
func _ready() -> void:
	var sh := Shader.new()
	sh.code = "shader_type spatial;\nrender_mode unshaded, blend_mix, depth_draw_never;\nuniform sampler2D dtex : hint_depth_texture, filter_nearest;\nvoid fragment() { float d = texture(dtex, SCREEN_UV).r; vec4 v = INV_PROJECTION_MATRIX * vec4(SCREEN_UV * 2.0 - 1.0, d, 1.0); float lin = -v.z / v.w; ALBEDO = vec3(fract(lin * 0.2)); ALPHA = 1.0; }"
	var m := ShaderMaterial.new(); m.shader = sh
	var mi := MeshInstance3D.new(); var q := QuadMesh.new(); q.size = Vector2(4, 4); mi.mesh = q; mi.material_override = m; add_child(mi)
	var b := MeshInstance3D.new(); var bm := BoxMesh.new(); b.mesh = bm; b.position = Vector3(0.5, 0, -1); add_child(b)
	var c := Camera3D.new(); c.position = Vector3(0, 0, 5); add_child(c)
	var l := DirectionalLight3D.new(); add_child(l)
	await get_tree().create_timer(0.5).timeout
	await RenderingServer.frame_post_draw
	get_viewport().get_texture().get_image().save_png(OS.get_cmdline_user_args()[0])
	get_tree().quit()
