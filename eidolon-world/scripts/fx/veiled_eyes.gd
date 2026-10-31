class_name VeiledEyes
## v1.1 (Agent A) a PAIR of veiled stone eyes (shaders/veiled_eyes.gdshader): one quad, oriented with the face it is on.
##   add_child(VeiledEyes.for_statue(eye_mid_world, face_forward, face_up))   on a statue: eye_mid = between the eyes,
##        a hair in front of the face; face_forward = the direction the face looks; face_up = up the face (usually UP)
##   add_child(VeiledEyes.for_shadow(head_mid_world, along))                  on a floor shadow: head_mid = where the
##        eyes sit in the shadow's head, `along` = the shadow's direction (feet -> head, horizontal): its "up the face"
## Returns the MeshInstance3D; its material's `k` (0..1) lights / closes them, `pulse` for a hint, `phase` per pair.
## Layout: about 44 x 40 cm; eyes 22 cm apart, each 10.5 x 4.2 cm (readable at the 7.5 m camera).

const SHADER := preload("res://shaders/veiled_eyes.gdshader")

static func _make(xf: Transform3D, k: float, phase: float, size: Vector2) -> MeshInstance3D:
	var q := QuadMesh.new()
	q.size = size
	var m := ShaderMaterial.new()
	m.shader = SHADER
	m.set_shader_parameter("k", k)
	m.set_shader_parameter("phase", phase)
	m.set_shader_parameter("qsize", size)
	var mi := MeshInstance3D.new()
	mi.name = "VeiledEyes"
	mi.mesh = q
	mi.material_override = m
	mi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	mi.transform = xf
	return mi

## on a statue's face: the quad faces `forward` (its +Z), +Y = `up` made square to it
static func for_statue(mid: Vector3, forward: Vector3, up := Vector3.UP, k := 1.0, phase := 0.0) -> MeshInstance3D:
	var z := forward.normalized()
	var x := up.cross(z).normalized()
	var y := z.cross(x).normalized()
	return _make(Transform3D(Basis(x, y, z), mid + z * 0.01), k, phase, Vector2(0.44, 0.40))

## on a floor shadow's head: flat on the floor (+Z up), +Y = along the shadow (toward the head's top).
## v1.1d BOLDER (owner): at scale 1.5 (W's call) each eye is about 40 x 20 cm, 60 cm apart (centres), a clear almond,
## a crimson-hot core (only slightly whitened: a white centre reads as a hole on pale marble) and a strong halo.
## The shadow's head must be big enough to wear them: statue_shadow.gdshader `head_k` 2.0 (see HANDOFF). (taller than on a face: the floor is
## seen at 36 deg, so it is foreshortened to about 16 x 5 on screen), 30 cm apart, a strong white-hot core and a wide halo.
static func for_shadow(mid: Vector3, along: Vector3, k := 1.0, phase := 0.0, scale := 1.0) -> MeshInstance3D:
	var y := Vector3(along.x, 0.0, along.z).normalized()
	var z := Vector3.UP
	var x := y.cross(z).normalized()
	var f := scale / 1.5
	var size := Vector2(1.6, 0.95) * f
	var mi := _make(Transform3D(Basis(x, y, z), mid + Vector3(0, 0.012, 0)), k, phase, size)
	var m := mi.material_override as ShaderMaterial
	m.set_shader_parameter("eye", Vector2(0.40, 0.20) * f)
	m.set_shader_parameter("gap", 0.60 * f)
	m.set_shader_parameter("hot_white", 0.25)
	m.set_shader_parameter("halo_k", 1.3)
	m.set_shader_parameter("core_k", 1.7)
	m.set_shader_parameter("tilt", 0.16)
	m.set_shader_parameter("tears", 0.35)
	m.set_shader_parameter("brow", 0.0)
	return mi
