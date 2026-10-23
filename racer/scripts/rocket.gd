class_name Rocket
extends Node3D
## Homing rocket: manual ray-marched projectile (cheap, no physics body).

const SPEED := 78.0
const TURN := 3.2          # rad/s homing
const LIFE := 2.6

var shooter: Car
var target: Car
var game: Node
var vel := Vector3.ZERO
var _t := 0.0
var _ray := PhysicsRayQueryParameters3D.new()
var _trail: CPUParticles3D

func launch(p_game: Node, p_shooter: Car, p_target: Car, at: Vector3, dir: Vector3) -> void:
	game = p_game; shooter = p_shooter; target = p_target
	vel = dir.normalized() * (SPEED + maxf(0.0, p_shooter.speed))
	position = at
	_ray.collision_mask = 1 | 2
	_ray.exclude = [p_shooter.get_rid()]

func _ready() -> void:
	var body := MeshInstance3D.new()
	var cm := CapsuleMesh.new(); cm.radius = 0.14; cm.height = 1.1
	cm.radial_segments = 8; cm.rings = 2
	body.mesh = cm
	var m := StandardMaterial3D.new()
	m.albedo_color = Color(0.85, 0.85, 0.8); m.metallic = 0.5; m.roughness = 0.4
	body.material_override = m
	body.rotation.x = PI / 2
	add_child(body)
	var glow := MeshInstance3D.new()
	var sm := SphereMesh.new(); sm.radius = 0.45; sm.height = 0.9; sm.radial_segments = 8; sm.rings = 4
	glow.mesh = sm
	var gm := StandardMaterial3D.new()
	gm.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	gm.albedo_color = Color(1, 0.6, 0.2)
	gm.emission_enabled = true; gm.emission = Color(1, 0.55, 0.15); gm.emission_energy_multiplier = 4.0
	glow.material_override = gm
	glow.position = Vector3(0, 0, -0.6)
	add_child(glow)
	_trail = Fx.emitter(false, 70, 1.0, 1.2)
	_trail.direction = Vector3.UP; _trail.spread = 180.0
	_trail.initial_velocity_min = 0.2; _trail.initial_velocity_max = 1.0
	_trail.scale_amount_curve = Fx._grow_curve()
	_trail.color_ramp = Fx.ramp([Color(1, 0.8, 0.45, 1.0), Color(0.85, 0.75, 0.65, 0.7), Color(0.6, 0.56, 0.52, 0)])
	_trail.position = Vector3(0, 0, -0.7)
	add_child(_trail)
	_trail.emitting = true

func _physics_process(dt: float) -> void:
	_t += dt
	if _t > LIFE:
		_explode(global_position, null)
		return
	if target and target.alive and _t > 0.08:
		var to_t := target.global_position + Vector3.UP * 0.9 - global_position
		var dir := vel.normalized()
		var want := to_t.normalized()
		if dir.dot(want) > -0.2:
			var ang := dir.angle_to(want)
			var k := minf(1.0, TURN * dt / maxf(ang, 0.0001))
			dir = dir.slerp(want, k).normalized()
			vel = dir * vel.length()
	vel.y -= 1.5 * dt
	var from := global_position
	var to := from + vel * dt
	_ray.from = from; _ray.to = to
	var hit := get_world_3d().direct_space_state.intersect_ray(_ray)
	if not hit.is_empty():
		_explode(hit.position, hit.collider as Car)
		return
	global_position = to
	if vel.length() > 0.1: look_at(to + vel, Vector3.UP)
	rotate_object_local(Vector3.UP, PI) # mesh is built along +Z

func _explode(at: Vector3, direct: Car) -> void:
	if game: game.explode(at, 6.5, 30.0, shooter, direct, 1.0)
	# leave the trail behind to fade out
	_trail.emitting = false
	var tp := _trail.global_position
	remove_child(_trail)
	get_parent().add_child(_trail)
	_trail.global_position = tp
	get_tree().create_timer(1.0).timeout.connect(_trail.queue_free)
	queue_free()
