extends Node3D
## (Agent A, dev) v1.1 effects: FxBurst splash / dust / sparks / embers / glints / mist / footstep, leaves among the
## petals, and PickupMarker (pillar + pool + twinkles, on a cloth and on a pedestal). Game camera; --zoom for detail.
##   godot --path . --rendering-driver opengl3 --fixed-fps 30 --resolution 780x1688 res://dev_fx/fx_test.tscn -- --shots=/abs/dir [--zoom=4] [--low]
const MOMENTS := {"a": 0.3, "b": 0.9, "c": 2.4}
var shots := ""
var zoom := 6.0
var t := 0.0
var queue := []
var marble: ShaderMaterial
var fired := false

func _ready() -> void:
	for a in OS.get_cmdline_user_args():
		if a.begins_with("--shots="): shots = a.get_slice("=", 1)
		elif a.begins_with("--zoom="): zoom = float(a.get_slice("=", 1))
		elif a == "--low": FxBurst.high = false; PickupMarker.high = false; AmbientLife.high = false
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
	_box(Vector3(-1.8, 1.2, -1.6), Vector3(1.6, 2.4, 0.3), 0.25)        # a door frame's wall (dust from its lintel)
	_box(Vector3(1.6, 0.45, -1.2), Vector3(0.4, 0.9, 0.4), 0.25)        # a brazier stand
	var wm := ShaderMaterial.new(); wm.shader = preload("res://shaders/water.gdshader"); wm.set_shader_parameter("noise_tex", noise)
	var w := MeshInstance3D.new(); var pm := PlaneMesh.new(); pm.size = Vector2(2.2, 2.0); w.mesh = pm; w.material_override = wm; w.position = Vector3(1.4, 0.02, 1.5); add_child(w)
	FxBurst.embers(self, Vector3(1.6, 0.95, -1.2))
	FxBurst.mist(self, Vector3(-1.0, 0.3, 1.6), 2.0)
	add_child(AmbientLife.petals(AABB(Vector3(-3, 0.05, -3), Vector3(6, 2.2, 6)), 70, Vector3(1.0, 0.0, 0.5), 0.2, 0.08, 0.35))
	for i in 2:
		var mk := PickupMarker.new(); mk.bed = ["cloth", "plinth"][i]; mk.bed_mat = marble; add_child(mk)
		mk.global_position = [Vector3(-0.2, 0, 0.2), Vector3(0.6, 0, -0.4)][i]
	var rig := Node3D.new(); rig.rotation.y = -PI * 0.25; add_child(rig)
	var pitch := Node3D.new(); pitch.rotation.x = -deg_to_rad(36.0); rig.add_child(pitch)
	var cam := Camera3D.new(); cam.projection = Camera3D.PROJECTION_ORTHOGONAL; cam.keep_aspect = Camera3D.KEEP_WIDTH; cam.size = zoom; cam.position = Vector3(0, 0, 24); pitch.add_child(cam)
	rig.position = Vector3(-0.2, 0.9, 0.2)
	if shots != "":
		for m in MOMENTS: queue.append([MOMENTS[m], m])

func _box(c: Vector3, s: Vector3, id: float) -> void:
	var bm := BoxMesh.new(); bm.size = s
	var arr := bm.get_mesh_arrays(); var n: int = (arr[Mesh.ARRAY_VERTEX] as PackedVector3Array).size()
	var cols := PackedColorArray(); for i in n: cols.append(Color(0.4, id, 0.0, 1.0))
	arr[Mesh.ARRAY_COLOR] = cols; var am := ArrayMesh.new(); am.add_surface_from_arrays(Mesh.PRIMITIVE_TRIANGLES, arr)
	var mi := MeshInstance3D.new(); mi.mesh = am; mi.material_override = marble; mi.position = c; add_child(mi)

func _process(dt: float) -> void:
	t += dt
	if not fired and t > 0.05:
		fired = true
		FxBurst.splash(self, Vector3(1.2, 0.03, 1.3))
		FxBurst.footstep(self, Vector3(1.9, 0.03, 1.9))
		FxBurst.dust(self, Vector3(-1.8, 2.35, -1.35), 1.0)
		FxBurst.sparks(self, Vector3(1.6, 1.0, -1.2))
	if not queue.is_empty() and t >= queue[0][0]:
		var m: String = queue.pop_front()[1]
		await RenderingServer.frame_post_draw
		get_viewport().get_texture().get_image().save_png("%s/fx-%s-%s.png" % [shots, str(zoom), m])
		if queue.is_empty(): get_tree().quit()
