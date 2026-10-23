class_name Car
extends RigidBody3D
## Arcade-but-weighty raycast car: 4 ray wheels (spring/damper), lateral grip curve with
## rear-grip drop for drifts, yaw-rate steering controller, nitro, weapons, damage.
## Front of the car = local +Z, car's left = local +X.

signal wrecked(car: Car, by: Car)

const BODY_MESH := preload("res://assets/cars/car1_body.res")
const WHEEL_FRONT := preload("res://assets/cars/car1_wheel_front.res")
const WHEEL_REAR := preload("res://assets/cars/car1_wheel_rear.res")
const SCALE := 4.0              # model is 1 unit long -> 4 m

# --- tuning (SI units)
const MASS := 1150.0
const GRAV := 1.35              # gravity scale: heavier, snappier jumps
const SPRING := 26000.0         # N/m per wheel
const DAMPER := 2600.0          # N*s/m per wheel
const TOP := 0.45               # ray starts this far above the axle
const V_TOP := 40.0             # m/s (144 km/h) on the road
const NITRO_V_TOP := 52.0       # m/s (187 km/h)
const ACCEL := 11.5             # m/s^2 at standstill
const NITRO_ACCEL := 9.0
const BRAKE := 17.0
const REV_ACCEL := 7.0
const REV_TOP := 13.0
const MU_FRONT := 1.75
const MU_REAR := 1.7
const SLIP_REF := 1.1           # m/s lateral slip for full grip
const YAW_K := 7.5
const NITRO_USE := 0.28         # per second
const NITRO_REFILL := 0.045

var driver_name := "CAR"
var colour := "yellow"
var is_player := false
var game: Node                  # main game (spawns weapons / fx)

# inputs (written by player controls or AI each physics frame)
var in_steer := 0.0             # -1..1, + = right
var in_throttle := 0.0
var in_brake := 0.0
var in_nitro := false
var controls_enabled := false

# state
var hp := 100.0
var nitro := 0.6
var rockets := 6
var mines := 3
var alive := true
var kills := 0
var money := 0
var speed := 0.0                # signed forward speed m/s
var grounded := 0
var on_road := true
var drifting := false
var nitro_on := false
var lock_target: Car
var last_hit_by: Car
var steer_s := 0.0
var rpm := 0.0

# race bookkeeping (managed by the game)
var track_idx := 0
var progress := 0.0             # samples travelled (continuous)
var lap := 1
var finished := false
var finish_time := 0.0
var lap_start := 0.0
var best_lap := 0.0
var last_lap := 0.0
var place := 1
var safe_idx := 0
var respawns := 0
var falls := 0
var stat_rockets := 0
var stat_mines := 0

var _anchors: Array[Vector3] = []
var _radius := 0.5
var _radii: Array[float] = []
var _pre := 0.0
var _comp := [0.0, 0.0, 0.0, 0.0]
var _contact := [false, false, false, false]
var _spin := [0.0, 0.0, 0.0, 0.0]
var _wheel_nodes: Array[Node3D] = []
var _steer_nodes: Array[Node3D] = []
var _spin_nodes: Array[Node3D] = []
var _model: Node3D
var _ray := PhysicsRayQueryParameters3D.new()
var _pending_xf := false
var _respawn_xf := Transform3D()
var _respawn_vel := Vector3.ZERO
var _hits: Array = []
var _cool_front := 0.0
var _cool_rear := 0.0
var _flames: Array[Node3D] = []
var _flame_p: CPUParticles3D
var _dust: CPUParticles3D
var _dmg_smoke: CPUParticles3D
var _engine: AudioStreamPlayer3D
var _hit_cool := 0.0
var _wreck_t := 0.0
var _flip_t := 0.0

func setup(p_game: Node, p_colour: String, p_name: String, p_player: bool) -> void:
	game = p_game
	colour = p_colour
	driver_name = p_name
	is_player = p_player

func _ready() -> void:
	mass = MASS
	gravity_scale = GRAV
	inertia = Vector3(2300.0, 2700.0, 950.0)
	center_of_mass_mode = RigidBody3D.CENTER_OF_MASS_MODE_CUSTOM
	center_of_mass = Vector3(0, 0.62, 0.05)
	linear_damp = 0.0
	angular_damp = 0.6
	continuous_cd = true
	contact_monitor = true
	max_contacts_reported = 4
	can_sleep = false
	collision_layer = 2
	collision_mask = 1 | 2
	var pm := PhysicsMaterial.new()
	pm.friction = 0.25
	pm.bounce = 0.25
	physics_material_override = pm
	# body collision: main box above the wheels + cabin box
	var cs := CollisionShape3D.new()
	var bs := BoxShape3D.new(); bs.size = Vector3(2.3, 0.9, 3.9)
	cs.shape = bs; cs.position = Vector3(0, 1.05, 0)
	add_child(cs)
	var cs2 := CollisionShape3D.new()
	var bs2 := BoxShape3D.new(); bs2.size = Vector3(1.9, 0.75, 2.2)
	cs2.shape = bs2; cs2.position = Vector3(0, 1.85, -0.2)
	add_child(cs2)
	_pre = MASS * 9.8 * GRAV / 4.0 / SPRING
	_ray.collision_mask = 1
	_ray.exclude = [get_rid()]
	_build_visual()
	_build_fx()

func _build_visual() -> void:
	_model = Node3D.new()
	_model.name = "Model"
	add_child(_model)
	var mat := CarPaint.material(colour)
	var body := MeshInstance3D.new()
	body.mesh = BODY_MESH
	body.material_override = mat
	body.scale = Vector3.ONE * SCALE
	_model.add_child(body)
	var anchors: PackedVector3Array = BODY_MESH.get_meta("anchors")
	var src_side: int = BODY_MESH.get_meta("wheel_source_side")
	var rf := float(BODY_MESH.get_meta("radius_front")) * SCALE
	var rr := float(BODY_MESH.get_meta("radius_rear")) * SCALE
	_radius = (rf + rr) * 0.5
	for i in 4:
		var a := anchors[i] * SCALE
		_anchors.append(a)
		_radii.append(rf if a.z > 0.0 else rr)
		var pivot := Node3D.new(); pivot.position = a
		var steer := Node3D.new()
		var spin := Node3D.new()
		var w := MeshInstance3D.new()
		w.mesh = WHEEL_FRONT if a.z > 0.0 else WHEEL_REAR
		w.material_override = mat
		w.scale = Vector3.ONE * SCALE
		if signf(a.x) != signf(src_side): w.rotation.y = PI # mirror side: rotate, keeps the hub facing out
		_model.add_child(pivot); pivot.add_child(steer); steer.add_child(spin); spin.add_child(w)
		_wheel_nodes.append(pivot); _steer_nodes.append(steer); _spin_nodes.append(spin)

func _build_fx() -> void:
	var fmat := StandardMaterial3D.new()
	fmat.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	fmat.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	fmat.blend_mode = BaseMaterial3D.BLEND_MODE_ADD
	fmat.albedo_color = Color(0.45, 0.75, 1.0, 0.9)
	fmat.cull_mode = BaseMaterial3D.CULL_DISABLED
	for sx: float in [-0.45, 0.45]:
		var f := MeshInstance3D.new()
		var cm := CylinderMesh.new()
		cm.top_radius = 0.0; cm.bottom_radius = 0.26; cm.height = 1.6
		cm.radial_segments = 8; cm.rings = 1
		f.mesh = cm
		f.material_override = fmat
		f.rotation.x = -PI / 2 # cone tip points backwards (-Z)
		f.position = Vector3(sx, 0.62, -2.6)
		f.visible = false
		_model.add_child(f)
		_flames.append(f)
	_flame_p = Fx.emitter(true, 28, 0.22, 0.5)
	_flame_p.position = Vector3(0, 0.62, -2.2)
	_flame_p.emission_shape = CPUParticles3D.EMISSION_SHAPE_BOX
	_flame_p.emission_box_extents = Vector3(0.5, 0.08, 0.05)
	_flame_p.direction = Vector3(0, 0, -1); _flame_p.spread = 8.0
	_flame_p.initial_velocity_min = 6.0; _flame_p.initial_velocity_max = 10.0
	_flame_p.color_ramp = Fx.ramp([Color(0.5, 0.75, 1.0, 0.9), Color(1.0, 0.5, 0.12, 0.8), Color(0.8, 0.2, 0.05, 0)])
	_flame_p.local_coords = false
	_model.add_child(_flame_p)
	_dust = Fx.emitter(false, 40, 1.1, 1.6)
	_dust.position = Vector3(0, 0.25, -1.1)
	_dust.emission_shape = CPUParticles3D.EMISSION_SHAPE_BOX
	_dust.emission_box_extents = Vector3(1.1, 0.1, 0.2)
	_dust.direction = Vector3(0, 0.6, -1); _dust.spread = 35.0
	_dust.initial_velocity_min = 1.0; _dust.initial_velocity_max = 4.0
	_dust.gravity = Vector3(0, 0.6, 0)
	_dust.damping_min = 1.5; _dust.damping_max = 2.5
	_dust.scale_amount_min = 0.7; _dust.scale_amount_max = 1.6
	_dust.scale_amount_curve = Fx._grow_curve()
	_dust.color_ramp = Fx.ramp([Color(0.75, 0.55, 0.4, 0.0), Color(0.72, 0.52, 0.38, 0.4), Color(0.7, 0.54, 0.42, 0)])
	_model.add_child(_dust)
	_dmg_smoke = Fx.emitter(false, 16, 1.2, 1.2)
	_dmg_smoke.position = Vector3(0, 1.4, 1.4)
	_dmg_smoke.direction = Vector3.UP; _dmg_smoke.spread = 20.0
	_dmg_smoke.initial_velocity_min = 1.5; _dmg_smoke.initial_velocity_max = 3.0
	_dmg_smoke.gravity = Vector3(0, 1, 0)
	_dmg_smoke.scale_amount_curve = Fx._grow_curve()
	_dmg_smoke.color_ramp = Fx.ramp([Color(0.1, 0.09, 0.08, 0.0), Color(0.1, 0.09, 0.08, 0.7), Color(0.2, 0.18, 0.16, 0)])
	_model.add_child(_dmg_smoke)
	if game and game.has_method("engine_stream"):
		_engine = AudioStreamPlayer3D.new()
		_engine.stream = game.engine_stream()
		_engine.unit_size = 8.0
		_engine.max_distance = 120.0
		_engine.volume_db = -4.0 if is_player else -9.0
		_engine.bus = "Master"
		add_child(_engine)

func start_engine() -> void:
	if _engine and not _engine.playing: _engine.play()

# ------------------------------------------------------------------ physics
func _integrate_forces(state: PhysicsDirectBodyState3D) -> void:
	if _pending_xf:
		state.transform = _respawn_xf
		state.linear_velocity = _respawn_vel
		state.angular_velocity = Vector3.ZERO
		_pending_xf = false
		return
	var dt := state.step
	var xf := state.transform
	var b := xf.basis.orthonormalized()
	var fwd_v := b.z
	var up_v := b.y
	var lin := state.linear_velocity
	var v_fwd := lin.dot(fwd_v)
	speed = v_fwd
	var space := state.get_space_state()

	var thr := in_throttle if controls_enabled and alive else 0.0
	var brk := in_brake if controls_enabled and alive else 0.0
	var steer_in := in_steer if alive else 0.0
	nitro_on = controls_enabled and alive and in_nitro and nitro > 0.01 and v_fwd > -1.0
	steer_s = move_toward(steer_s, steer_in, dt * 5.0)

	# --- longitudinal acceleration target
	var vtop := (NITRO_V_TOP if nitro_on else V_TOP) * (1.0 if on_road else 0.72)
	var acc := 0.0
	if not controls_enabled:
		acc = -clampf(v_fwd * 4.0, -8.0, 8.0) # parked: hold position
	elif brk > 0.05:
		if v_fwd > 1.0: acc = -BRAKE * brk
		else: acc = -REV_ACCEL * brk * clampf(1.0 + v_fwd / REV_TOP, 0.0, 1.0)
	elif thr > 0.02 or nitro_on:
		var t := maxf(thr, 1.0 if nitro_on else 0.0)
		if v_fwd < -0.5: acc = BRAKE * t
		else:
			var r := clampf(v_fwd / vtop, 0.0, 1.0)
			acc = t * ACCEL * (1.0 - r * r) * (1.0 if on_road else 0.8)
		if nitro_on: acc += NITRO_ACCEL * clampf(1.25 - v_fwd / NITRO_V_TOP, 0.0, 1.0)
		if v_fwd > vtop: acc = -(v_fwd - vtop) * 0.8
	else:
		acc = -clampf(v_fwd, -1.0, 1.0) * 1.2 - v_fwd * 0.04
	var drift_mode := absf(steer_s) > 0.65 and v_fwd > 17.0 and thr > 0.3

	# --- wheels
	grounded = 0
	var road_hits := 0
	var drive_per_wheel := acc * mass / 4.0
	var lat_sum := 0.0
	for w in 4:
		var a := _anchors[w]
		var mount := Vector3(a.x, a.y + TOP, a.z)
		var origin := xf * mount
		_ray.from = origin
		_ray.to = origin - up_v * (TOP + _radius + _pre + 0.05)
		var hit := space.intersect_ray(_ray)
		if hit.is_empty():
			_contact[w] = false
			_comp[w] = -_pre
			continue
		var d := origin.distance_to(hit.position)
		var x := (TOP + _radius) - d
		_comp[w] = x
		_contact[w] = true
		grounded += 1
		var col: Object = hit.collider
		if col and col.is_in_group("road"): road_hits += 1
		var p_off: Vector3 = hit.position - xf.origin
		var vel := state.get_velocity_at_local_position(p_off)
		var vn := vel.dot(up_v)
		var fs := SPRING * (x + _pre) - DAMPER * vn
		if x > 0.2: fs += SPRING * 6.0 * (x - 0.2)
		fs = maxf(fs, 0.0)
		state.apply_force(up_v * fs, p_off)
		var n: Vector3 = hit.normal
		var f_dir := (fwd_v - n * fwd_v.dot(n)).normalized()
		var s_dir := n.cross(f_dir)
		var v_lat := vel.dot(s_dir)
		lat_sum += v_lat
		var front := a.z > 0.0
		var mu := (MU_FRONT if front else MU_REAR) * (1.0 if col and col.is_in_group("road") else 0.78)
		if drift_mode and not front: mu *= 0.7
		var xs := v_lat / SLIP_REF
		var g := tanh(xs) * (1.0 - 0.3 * smoothstep(1.2, 4.0, absf(xs)))
		var f_lat := -g * mu * fs
		var f_cap := absf(v_lat) * (mass / 4.0) / dt
		f_lat = clampf(f_lat, -f_cap, f_cap)
		var lift := up_v * 0.35
		state.apply_force(s_dir * f_lat, p_off + lift)
		var f_long := clampf(drive_per_wheel, -mu * fs * 1.1, mu * fs * 1.1)
		state.apply_force(f_dir * f_long, p_off + lift)
	on_road = road_hits >= 2 or (grounded < 2 and on_road)
	var gfrac := grounded / 4.0
	drifting = grounded >= 2 and absf(lat_sum / maxf(1, grounded)) > 2.8 and absf(v_fwd) > 8.0

	# --- steering: yaw-rate controller (speed-sensitive turn radius)
	var ang := state.angular_velocity
	var w_cur := ang.dot(up_v)
	if grounded > 0:
		var kappa := steer_s / (6.0 + 0.62 * absf(v_fwd))
		var w_target := -kappa * v_fwd * (1.15 if drift_mode else 1.0)
		state.apply_torque(up_v * (w_target - w_cur) * inertia.y * YAW_K * gfrac)
		# damp roll/pitch wobble a bit, downforce
		var rp := ang - up_v * w_cur
		state.apply_torque(-rp * 700.0 * gfrac)
		state.apply_central_force(-up_v * v_fwd * v_fwd * 1.3 * gfrac)
		if drift_mode and drifting: state.apply_central_force(fwd_v * mass * 2.0)
	else:
		# airborne: self-level and a little air steering
		var axis := up_v.cross(Vector3.UP)
		var rp := ang - up_v * w_cur
		state.apply_torque(axis * 5200.0 - rp * 900.0)
		state.apply_torque(up_v * (-steer_s * 1.6 - w_cur) * 900.0)
	# air drag
	state.apply_central_force(-lin * lin.length() * 0.3)

	# --- contacts (sparks / bump damage), handled in _physics_process
	for i in state.get_contact_count():
		var imp := state.get_contact_impulse(i).length()
		if imp > 1400.0:
			_hits.append([state.get_contact_collider_object(i), state.get_contact_collider_position(i), state.get_contact_local_normal(i), imp])

func _physics_process(dt: float) -> void:
	_cool_front = maxf(0.0, _cool_front - dt)
	_cool_rear = maxf(0.0, _cool_rear - dt)
	_hit_cool = maxf(0.0, _hit_cool - dt)
	if not alive:
		_wreck_t -= dt
		if _wreck_t <= 0.0 and game: game.respawn_car(self)
		_hits.clear()
		return
	if nitro_on: nitro = maxf(0.0, nitro - NITRO_USE * dt)
	else: nitro = minf(1.0, nitro + NITRO_REFILL * dt * (2.0 if place == 4 else 1.0))
	for h in _hits:
		if _hit_cool > 0.0: break
		_hit_cool = 0.15
		var other: Object = h[0]
		var strength := clampf((h[3] - 1400.0) / 5000.0, 0.2, 1.5)
		Fx.sparks(get_parent(), h[1], h[2], strength)
		if other is Car:
			var dmg := clampf((h[3] - 2600.0) / 450.0, 0.0, 10.0)
			if dmg > 0.5: damage(dmg, other)
			if game: game.on_bump(self, other, h[3])
		elif game: game.on_scrape(self, h[3])
	_hits.clear()
	# flipped / stuck upside-down
	if global_basis.y.y < 0.25 and absf(speed) < 4.0: _flip_t += dt
	else: _flip_t = 0.0
	if _flip_t > 1.8 and game: _flip_t = 0.0; game.respawn_car(self, false)

func _process(dt: float) -> void:
	# wheels: suspension travel, spin and steer
	for w in 4:
		var a := _anchors[w]
		var target_y := a.y + (clampf(_comp[w], -_pre, 0.22) if _contact[w] else -_pre)
		var p := _wheel_nodes[w].position
		p.y = lerpf(p.y, target_y, minf(1.0, dt * 25.0))
		_wheel_nodes[w].position = p
		_spin[w] = fmod(_spin[w] + speed / _radii[w] * dt, TAU)
		_spin_nodes[w].rotation.x = _spin[w]
		if a.z > 0.0:
			_steer_nodes[w].rotation.y = -steer_s * lerpf(0.5, 0.18, clampf(absf(speed) / 40.0, 0.0, 1.0))
	# fx
	for f in _flames:
		f.visible = nitro_on
		if nitro_on: f.scale = Vector3(1, 1, 1) * randf_range(0.8, 1.25)
	_flame_p.emitting = nitro_on
	var dusty := alive and grounded >= 2 and (drifting or (not on_road and absf(speed) > 6.0) or (in_throttle > 0.5 and absf(speed) < 6.0 and controls_enabled))
	_dust.emitting = dusty
	_dmg_smoke.emitting = alive and hp < 40.0
	if _engine:
		var gear_v := V_TOP / 5.0
		var sp := absf(speed)
		var gear := mini(int(sp / gear_v), 5)
		var in_gear := fmod(sp, gear_v) / gear_v if gear < 5 else minf(1.0, (sp - gear_v * 5) / 12.0)
		rpm = lerpf(rpm, clampf(in_gear * 0.75 + in_throttle * 0.25, 0.0, 1.0), minf(1.0, dt * 8.0))
		_engine.pitch_scale = 0.55 + rpm * 0.65 + gear * 0.06 + (0.15 if nitro_on else 0.0)

# ------------------------------------------------------------------ actions
func fire_front() -> bool:
	if not alive or not controls_enabled or rockets <= 0 or _cool_front > 0.0: return false
	rockets -= 1
	stat_rockets += 1
	_cool_front = 0.45
	if game: game.spawn_rocket(self, lock_target)
	return true

func drop_rear() -> bool:
	if not alive or not controls_enabled or mines <= 0 or _cool_rear > 0.0: return false
	mines -= 1
	stat_mines += 1
	_cool_rear = 0.6
	if game: game.spawn_mine(self)
	return true

func damage(amount: float, by: Car) -> void:
	if not alive or finished: return
	hp -= amount
	if by and by != self: last_hit_by = by
	if hp <= 0.0:
		hp = 0.0
		alive = false
		_wreck_t = 2.0
		_model.visible = false
		for f in _flames: f.visible = false
		set_deferred("freeze", true)
		collision_layer = 0
		wrecked.emit(self, last_hit_by)

func respawn_at(xf: Transform3D, full_hp := true, vel := Vector3.ZERO) -> void:
	_respawn_xf = xf
	_respawn_vel = vel
	_pending_xf = true
	respawns += 1
	if full_hp or not alive:
		hp = 100.0
	alive = true
	_model.visible = true
	collision_layer = 2
	freeze = false
	steer_s = 0.0
	_flip_t = 0.0
	# also move immediately so frozen bodies / cameras snap
	global_transform = xf
	linear_velocity = vel
	angular_velocity = Vector3.ZERO

func forward() -> Vector3:
	return global_basis.z
