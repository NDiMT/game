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

## on a floor shadow's head: flat on the floor (+Z up), +Y = along the shadow (toward the head's top)
static func for_shadow(mid: Vector3, along: Vector3, k := 1.0, phase := 0.0, scale := 1.0) -> MeshInstance3D:
	var y := Vector3(along.x, 0.0, along.z).normalized()
	var z := Vector3.UP
	var x := y.cross(z).normalized()
	return _make(Transform3D(Basis(x, y, z), mid + Vector3(0, 0.012, 0)), k, phase, Vector2(0.44, 0.40) * scale)
