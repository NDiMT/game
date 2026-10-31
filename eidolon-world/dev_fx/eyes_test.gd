extends Node3D
## (Agent A, dev) v1.1 veiled eyes: on a statue's face (VeiledEyes.for_statue) and on a shadow's head on the floor
## (VeiledEyes.for_shadow), next to the old eyes.gdshader pair, at the game's camera (and --zoom for a close look).
##   godot --path . --rendering-driver opengl3 --resolution 780x1688 res://dev_fx/eyes_test.tscn -- --shots=/abs/dir [--zoom=3]
var shots := ""
var t := 0.0
var zoom := 7.5
var marble: ShaderMaterial

func _ready() -> void:
	for a in OS.get_cmdline_user_args():
		if a.begins_with("--shots="): shots = a.get_slice("=", 1)
		elif a.begins_with("--zoom="): zoom = float(a.get_slice("=", 1))
	var fn := FastNoiseLite.new(); fn.noise_type = FastNoiseLite.TYPE_SIMPLEX_SMOOTH; fn.frequency = 0.012; fn.seed = 17
	var img := fn.get_seamless_image(256, 256, false, false, 0.1, true); img.generate_mipmaps()
	var noise := ImageTexture.create_from_image(img)
	var env := Environment.new(); env.background_mode = Environment.BG_COLOR; env.background_color = Color(0.74, 0.75, 0.75)
	env.ambient_light_source = Environment.AMBIENT_SOURCE_COLOR; env.ambient_light_color = Color(0.70, 0.76, 0.86); env.ambient_light_energy = 0.4
	env.tonemap_mode = Environment.TONE_MAPPER_FILMIC; env.tonemap_exposure = 0.7
	var we := WorldEnvironment.new(); we.environment = env; add_child(we)
	var sun := DirectionalLight3D.new(); sun.rotation = Vector3(deg_to_rad(-55.0), deg_to_rad(-32.0), 0.0); sun.light_energy = 0.7; sun.shadow_enabled = true; add_child(sun)
	marble = ShaderMaterial.new(); marble.shader = preload("res://shaders/marble.gdshader"); marble.set_shader_parameter("noise_tex", noise)
	var fl := MeshInstance3D.new(); var bm := BoxMesh.new(); bm.size = Vector3(10, 0.1, 10); fl.mesh = _tint(bm, 0.05); fl.material_override = marble; fl.position.y = -0.05; add_child(fl)
	# a statue: a plinth and the veiled bust, turned to face the camera's side
	var pl := MeshInstance3D.new(); var pb := BoxMesh.new(); pb.size = Vector3(0.6, 1.2, 0.6); pl.mesh = _tint(pb, 0.25); pl.material_override = marble
	pl.position = Vector3(-0.8, 0.6, 0.0); add_child(pl)
	var res := Props._mesh("kit_face1")
	var bust := MeshInstance3D.new(); bust.mesh = res[0]; bust.material_override = marble
	var yaw := -PI * 0.25
	bust.transform = Transform3D(Basis(Vector3.UP, yaw) * Basis.from_scale(Vector3.ONE * 1.6), Vector3(-0.8, 1.2, 0.0)); add_child(bust)
	var fwd := Basis(Vector3.UP, yaw) * Vector3.BACK
	add_child(VeiledEyes.for_statue(Vector3(-0.8, 1.2 + 0.79, 0.0) + fwd * 0.2, fwd, Vector3.UP, 1.0, 0.0))
	# a shadow on the floor (the statue_shadow quad) with the new eyes in its head
	var along := Vector3(1, 0, 0.6).normalized()
	var sq := MeshInstance3D.new(); var qm := PlaneMesh.new(); qm.size = Vector2(1.45, 2.0); sq.mesh = qm
	var sm := ShaderMaterial.new(); sm.shader = preload("res://shaders/statue_shadow.gdshader"); sm.set_shader_parameter("k", 1.0); sq.material_override = sm
	var feet := Vector3(-0.4, 0.01, 0.1)
	var zl := -along
	sq.transform = Transform3D(Basis(Vector3.UP.cross(zl), Vector3.UP, zl), feet + along * 1.0)      # (head toward -Z local: UV.y 0)
	add_child(sq)
	add_child(VeiledEyes.for_shadow(Vector3(-0.4, 0.0, 0.1) + along * 1.72, along, 1.0, 1.3, 1.5))
	# the old pair for comparison (two camera-facing quads)
	for s in [-1.0, 1.0]:
		var om := ShaderMaterial.new(); om.shader = preload("res://shaders/eyes.gdshader"); om.set_shader_parameter("qsize", 0.32)
		var oq := MeshInstance3D.new(); var q2 := QuadMesh.new(); q2.size = Vector2(0.32, 0.32); oq.mesh = q2; oq.material_override = om
		oq.position = Vector3(-1.9, 1.5, -0.6) + Vector3(0.7071, 0, 0.7071) * 0.11 * s; add_child(oq)
	var rig := Node3D.new(); rig.rotation.y = -PI * 0.25; add_child(rig)
	var pitch := Node3D.new(); pitch.rotation.x = -deg_to_rad(36.0); rig.add_child(pitch)
	var cam := Camera3D.new(); cam.projection = Camera3D.PROJECTION_ORTHOGONAL; cam.keep_aspect = Camera3D.KEEP_WIDTH; cam.size = zoom; cam.position = Vector3(0, 0, 24); pitch.add_child(cam)
	rig.position = Vector3(0.0, 0.9, 0.5)

func _tint(pm: PrimitiveMesh, id: float) -> ArrayMesh:
	var arr := pm.get_mesh_arrays(); var n: int = (arr[Mesh.ARRAY_VERTEX] as PackedVector3Array).size()
	var c := PackedColorArray(); for i in n: c.append(Color(0.4, id, 0.0, 1.0))
	arr[Mesh.ARRAY_COLOR] = c; var am := ArrayMesh.new(); am.add_surface_from_arrays(Mesh.PRIMITIVE_TRIANGLES, arr); return am

func _process(dt: float) -> void:
	t += dt
	if t > 1.0 and shots != "":
		await RenderingServer.frame_post_draw
		get_viewport().get_texture().get_image().save_png("%s/eyes-%s.png" % [shots, str(zoom)])
		get_tree().quit()
