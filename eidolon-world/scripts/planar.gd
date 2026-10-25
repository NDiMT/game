class_name PlanarMirror
extends Node
## A real planar reflection for the great mirror (v0.4). A SubViewport shares the world and renders it
## from the main camera reflected across the mirror plane, at half resolution; the mirror shader
## samples it through that camera's view-projection, so columns, arches and the floor reflect fully.
##
## Render layers (bit values): 1 world, 2 the wanderer (main view only), 4 the reflection's double and
## its footprints (reflection view only), 8 main-only effects (fog sheets, shafts, god rays, motes,
## projected puppets), 16 what stands BEHIND the hall mirror (its own wall), never in the reflection.
## The reflection renders only while its glass is on screen and near; every other frame while you
## stand still. On the LOW tier the cheap projected method is used instead.

const LAYER_WORLD := 1
const LAYER_PLAYER := 2
const LAYER_DOUBLE := 4
const LAYER_MAIN_FX := 8
const LAYER_BEHIND := 16
const MAIN_MASK := 0xFFFFF & ~LAYER_DOUBLE
const REFL_MASK := LAYER_WORLD | LAYER_DOUBLE

var vp: SubViewport
var cam: Camera3D
var plane_n := Vector3.BACK
var plane_d := 0.0
var mat: ShaderMaterial          # the mirror quad's material
var enabled := true              # false on the LOW tier
var active := false
var scale := 1.0                 # v0.5b: x the REAL 3D render resolution (window pixels x render scale)
var res_k := 1.0                 # v0.6: per glass (a smaller glass needs fewer pixels)
const MAX_H := 1400
var _frame := 0
var _H := Basis()
## v0.5: two planar mirrors (the Hall, the Garden): only one renders at a time; the active one also
## tells every marble surface which side of its plane to drop (global `refl_clip`)
static var current: PlanarMirror

func setup(n: Vector3, d: float, mirror_mat: ShaderMaterial, env: Environment) -> void:
	plane_n = n.normalized()
	plane_d = d
	mat = mirror_mat
	var nn := plane_n
	_H = Basis(Vector3(1, 0, 0) - 2.0 * nn.x * nn, Vector3(0, 1, 0) - 2.0 * nn.y * nn, Vector3(0, 0, 1) - 2.0 * nn.z * nn)
	vp = SubViewport.new()
	vp.size = Vector2i(200, 430)
	vp.render_target_update_mode = SubViewport.UPDATE_DISABLED
	vp.msaa_3d = Viewport.MSAA_DISABLED
	vp.transparent_bg = false
	add_child(vp)
	cam = Camera3D.new()
	cam.projection = Camera3D.PROJECTION_ORTHOGONAL
	cam.keep_aspect = Camera3D.KEEP_WIDTH
	cam.cull_mask = REFL_MASK
	cam.near = 1.0
	cam.far = 110.0
	# its own environment: the same fog, but linear (the main pass tonemaps and grades the mirror once)
	var e := env.duplicate() as Environment
	e.background_mode = Environment.BG_COLOR
	e.background_color = Color(0.74, 0.75, 0.75)
	e.tonemap_mode = Environment.TONE_MAPPER_LINEAR
	e.tonemap_exposure = 1.0
	e.glow_enabled = false
	e.adjustment_enabled = false
	cam.environment = e
	vp.add_child(cam)
	mat.set_shader_parameter("refl_tex", vp.get_texture())

## called every frame by the reflector: on = the glass is on screen, near, and planar is allowed
var _off_t := 0.0
var _last_cam := Transform3D()
func update(main_cam: Camera3D, on: bool, moving: bool) -> void:
	var want := on and enabled
	# v0.5b hysteresis: once on, stay on 0.4 s after it stops being wanted (no planar / fallback
	# flicker at a region edge or the screen border)
	if active and not want and enabled:
		_off_t += main_cam.get_process_delta_time()
		if _off_t < 0.4: want = true
	else:
		_off_t = 0.0
	if want and current != null and current != self and current.active: want = false
	if want != active:
		active = want
		mat.set_shader_parameter("planar", 1.0 if active else 0.0)
		if active:
			current = self
			RenderingServer.global_shader_parameter_set("refl_clip", Vector4(plane_n.x, plane_n.y, plane_n.z, plane_d))
		else:
			vp.render_target_update_mode = SubViewport.UPDATE_DISABLED
			if current == self:
				current = null
				RenderingServer.global_shader_parameter_set("refl_clip", Vector4.ZERO)
	if not active: return
	_frame += 1
	var main_vp := main_cam.get_viewport()
	# (v0.5b: the logical canvas size is not the pixel size: at DPR 3 that made the glass ~130 px wide)
	var sz := Vector2(main_vp.size) * main_vp.scaling_3d_scale * scale * res_k
	if sz.y > MAX_H: sz *= MAX_H / sz.y
	var want_sz := Vector2i(maxi(64, int(sz.x)), maxi(64, int(sz.y)))
	if vp.size != want_sz: vp.size = want_sz
	# reflect the main camera (its h/v offsets folded into the position: an orthographic view)
	var mx := main_cam.global_transform
	var p := mx.origin + mx.basis.x * main_cam.h_offset + mx.basis.y * main_cam.v_offset
	var rp := _H * p + 2.0 * plane_d * plane_n
	var rb := _H * mx.basis
	rb.x = -rb.x                     # back to a proper rotation (the image is mirrored, as it should be)
	cam.global_transform = Transform3D(rb, rp)
	cam.size = main_cam.size
	var view := cam.global_transform.affine_inverse()
	var proj := cam.get_camera_projection()
	mat.set_shader_parameter("refl_vp", Projection(proj) * Projection(view))
	# full rate while you or the camera move (v0.8.5: the camera's ease too, so the reflection never lags
	# the view), every other frame while everything is still
	var cam_moved := not mx.is_equal_approx(_last_cam)
	_last_cam = mx
	vp.render_target_update_mode = SubViewport.UPDATE_ONCE if (moving or cam_moved or _frame % 2 == 0) else SubViewport.UPDATE_DISABLED
