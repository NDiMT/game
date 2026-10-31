extends Node3D
## (Agent A, dev) web check for the v1.1 effects: every FxBurst kind (one-shots re-fired every 1.5 s), PickupMarker on
## a cloth and a pedestal, VeiledEyes, petals + leaves, on marble at the game camera. Export a scratch copy of the
## project with this as the main scene and watch the browser console (it prints "FXCHECK frames N" every 2 s).
var marble: ShaderMaterial
var t := 0.0
var fire_t := 0.0
var report_t := 0.0
var frames := 0

func _ready() -> void:
	var fn := FastNoiseLite.new(); fn.noise_type = FastNoiseLite.TYPE_SIMPLEX_SMOOTH; fn.frequency = 0.012; fn.seed = 17
	var img := fn.get_seamless_image(256, 256, false, false, 0.1, true); img.generate_mipmaps()
	var noise := ImageTexture.create_from_image(img)
	var env := Environment.new(); env.background_mode = Environment.BG_COLOR; env.background_color = Color(0.55, 0.56, 0.57)
	env.ambient_light_source = Environment.AMBIENT_SOURCE_COLOR; env.ambient_light_color = Color(0.70, 0.76, 0.86); env.ambient_light_energy = 0.4
	env.tonemap_mode = Environment.TONE_MAPPER_FILMIC; env.tonemap_exposure = 0.75
	var we := WorldEnvironment.new(); we.environment = env; add_child(we)
	var sun := DirectionalLight3D.new(); sun.rotation = Vector3(deg_to_rad(-55.0), deg_to_rad(-32.0), 0.0); sun.light_energy = 0.6; sun.shadow_enabled = true; add_child(sun)
	marble = ShaderMaterial.new(); marble.shader = preload("res://shaders/marble.gdshader"); marble.set_shader_parameter("noise_tex", noise)
	_box(Vector3(0, -0.05, 0), Vector3(10, 0.1, 10), 0.75)
	_box(Vector3(-1.8, 1.2, -1.6), Vector3(1.6, 2.4, 0.3), 0.25)
	_box(Vector3(1.6, 0.45, -1.2), Vector3(0.4, 0.9, 0.4), 0.25)
	var wm := ShaderMaterial.new(); wm.shader = preload("res://shaders/water.gdshader"); wm.set_shader_parameter("noise_tex", noise)
	var w := MeshInstance3D.new(); var pm := PlaneMesh.new(); pm.size = Vector2(2.2, 2.0); w.mesh = pm; w.material_override = wm; w.position = Vector3(1.4, 0.02, 1.5); add_child(w)
	FxBurst.embers(self, Vector3(1.6, 0.95, -1.2))
	FxBurst.mist(self, Vector3(-1.0, 0.3, 1.6), 2.0)
	add_child(AmbientLife.petals(AABB(Vector3(-3, 0.05, -3), Vector3(6, 2.2, 6)), 70, Vector3(1.0, 0.0, 0.5), 0.2, 0.08, 0.35))
	add_child(AmbientLife.moths(Vector3(1.6, 1.05, -1.2)))
	for i in 2:
		var mk := PickupMarker.new(); mk.bed = ["cloth", "plinth"][i]; mk.bed_mat = marble; add_child(mk)
		mk.global_position = [Vector3(-0.2, 0, 0.2), Vector3(0.6, 0, -0.4)][i]
	add_child(VeiledEyes.for_statue(Vector3(-1.8, 1.9, -1.44), Vector3(0.7071, 0, 0.7071) * 0.0 + Vector3(0, 0, 1)))
	add_child(VeiledEyes.for_shadow(Vector3(-0.8, 0.0, 1.0), Vector3(1, 0, 0.5), 1.0, 0.0, 1.5))
	var rig := Node3D.new(); rig.rotation.y = -PI * 0.25; add_child(rig)
	var pitch := Node3D.new(); pitch.rotation.x = -deg_to_rad(36.0); rig.add_child(pitch)
	var cam := Camera3D.new(); cam.projection = Camera3D.PROJECTION_ORTHOGONAL; cam.keep_aspect = Camera3D.KEEP_WIDTH; cam.size = 5.0; cam.position = Vector3(0, 0, 24); pitch.add_child(cam)
	rig.position = Vector3(-0.2, 0.9, 0.2)
	# the game's High-tier viewport (World.set_tier): MSAA 2x, a 3D render scale below 1, glow on. (The depth-texture
	# back-buffer failure on the web only shows with these; a plain viewport hides it.)
	var vp := get_viewport()
	vp.msaa_3d = Viewport.MSAA_2X
	vp.scaling_3d_mode = Viewport.SCALING_3D_MODE_BILINEAR
	vp.scaling_3d_scale = 0.8
	env.glow_enabled = true
	env.glow_intensity = 0.55
	print("FXCHECK start ", RenderingServer.get_current_rendering_method(), " msaa ", vp.msaa_3d, " scale ", vp.scaling_3d_scale)

func _box(c: Vector3, s: Vector3, id: float) -> void:
	var bm := BoxMesh.new(); bm.size = s
	var arr := bm.get_mesh_arrays(); var n: int = (arr[Mesh.ARRAY_VERTEX] as PackedVector3Array).size()
	var cols := PackedColorArray(); for i in n: cols.append(Color(0.4, id, 0.0, 1.0))
	arr[Mesh.ARRAY_COLOR] = cols; var am := ArrayMesh.new(); am.add_surface_from_arrays(Mesh.PRIMITIVE_TRIANGLES, arr)
	var mi := MeshInstance3D.new(); mi.mesh = am; mi.material_override = marble; mi.position = c; add_child(mi)

func _process(dt: float) -> void:
	t += dt; fire_t -= dt; report_t += dt; frames += 1
	if fire_t <= 0.0:
		fire_t = 1.5
		FxBurst.splash(self, Vector3(1.2, 0.03, 1.3))
		FxBurst.footstep(self, Vector3(1.9, 0.03, 1.9))
		FxBurst.dust(self, Vector3(-1.8, 2.35, -1.35), 1.0)
		FxBurst.sparks(self, Vector3(1.6, 1.0, -1.2))
	if report_t > 2.0:
		report_t = 0.0
		print("FXCHECK frames ", frames, " draw_calls ", Performance.get_monitor(Performance.RENDER_TOTAL_DRAW_CALLS_IN_FRAME))
