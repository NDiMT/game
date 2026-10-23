class_name AIDriver
extends RefCounted
## Racing-line follower with speed planning from curvature, simple overtaking/avoidance,
## nitro on straights and rule-based weapon use. No rubber-banding: skill is fixed per driver.

var car: Car
var track: Track
var game: Node
# skill profile
var grip_use := 0.9        # fraction of available lateral grip used when planning corner speed
var line_bias := 0.0       # personal lateral offset from the racing line (m)
var wander := 0.8          # amplitude of slow line wander (m)
var steer_gain := 1.15
var nitro_eager := 0.7     # 0..1
var reaction := 0.12       # s, steering smoothing

var _avoid := 0.0
var _phase := 0.0
var _stuck_t := 0.0
var _reverse_t := 0.0
var _steer := 0.0
var _rng := RandomNumberGenerator.new()

func _init(p_car: Car, p_track: Track, p_game: Node, skill: Dictionary) -> void:
	car = p_car; track = p_track; game = p_game
	for k in skill: set(k, skill[k])
	_rng.seed = hash(p_car.driver_name)
	_phase = _rng.randf() * TAU

func update(dt: float) -> void:
	if not car.alive:
		return
	var t := track
	var i := car.track_idx
	var v := maxf(car.speed, 0.0)
	_phase += dt * 0.35
	var pos := car.global_position
	var fwd := car.global_basis.z

	# --- avoidance: shift sideways around cars just ahead
	var want_avoid := 0.0
	for o: Car in game.cars:
		if o == car or not o.alive: continue
		var rel := o.global_position - pos
		var ahead := rel.dot(fwd)
		if ahead < -2.0 or ahead > 16.0 + v * 0.25: continue
		var side := t.lateral_of(o.global_position, i) - t.lateral_of(pos, i)
		if absf(side) < 3.2:
			var my_lat := t.lateral_of(pos, i)
			var dir := -1.0 if side > 0.0 else 1.0
			if absf(my_lat + dir * 3.5) > Track.HALF - 2.0: dir = -dir
			want_avoid += dir * (3.6 - absf(side)) * 1.1
	_avoid = lerpf(_avoid, clampf(want_avoid, -5.0, 5.0), minf(1.0, dt * 2.5))

	# --- steering towards a look-ahead point on the (personal) racing line
	var la := 7.0 + v * 0.42
	var j := i + int(la / Track.STEP)
	var lat := t.line_off[t.wrapi_(j)] + line_bias + sin(_phase) * wander + _avoid
	lat = clampf(lat, -Track.HALF + 1.6, Track.HALF - 1.6)
	var target := t.sample_point(j, lat)
	var local := car.global_transform.affine_inverse() * target
	var ang := atan2(local.x, local.z) # + = target is to the left
	# pure pursuit: path curvature 2 sin(a) / L, mapped through the car's steering model (r = 6 + 0.62 v)
	var dist := maxf(local.length(), 3.0)
	var want_steer := clampf(-2.0 * sin(ang) / dist * (6.0 + 0.62 * v) * steer_gain, -1.0, 1.0)
	_steer = lerpf(_steer, want_steer, minf(1.0, dt / maxf(reaction, 0.01)))

	# --- speed planning: brake for the tightest upcoming corner we can't take
	var a_lat := Car.MU_REAR * 9.8 * Car.GRAV * grip_use * 0.82
	var look := int((v * v / (2.0 * Car.BRAKE * 0.7) + 25.0) / Track.STEP)
	var target_v := 99.0
	for k in range(2, look + 2, 2):
		var c := t.line_curv[t.wrapi_(i + k)]
		if c < 0.002: continue
		var vc := sqrt(a_lat / c)
		# the steering model can't turn tighter than r = 6 + 0.62 v
		vc = minf(vc, maxf(8.0, (1.0 / c - 6.0) / 0.62 * 0.95))
		var d := k * Track.STEP
		target_v = minf(target_v, sqrt(vc * vc + 2.0 * Car.BRAKE * 0.6 * d))
	var thr := 1.0; var brk := 0.0
	if v > target_v + 2.5: thr = 0.0; brk = clampf((v - target_v) / 8.0, 0.3, 1.0)
	elif v > target_v: thr = 0.0

	# --- nitro on straights
	var straight := true
	for k in range(0, int(110.0 / Track.STEP), 3):
		if t.line_curv[t.wrapi_(i + k)] > 0.01: straight = false; break
	var nit := straight and v > 14.0 and car.nitro > (0.75 - nitro_eager * 0.5) and absf(_steer) < 0.35

	# --- stuck recovery
	if car.controls_enabled and v < 2.0 and _reverse_t <= 0.0: _stuck_t += dt
	else: _stuck_t = maxf(0.0, _stuck_t - dt)
	if _stuck_t > 2.0:
		_stuck_t = 0.0
		_reverse_t = 1.2
	if _reverse_t > 0.0:
		_reverse_t -= dt
		thr = 0.0; brk = 1.0; nit = false
		_steer = -signf(want_steer)

	car.in_steer = _steer
	car.in_throttle = thr
	car.in_brake = brk
	car.in_nitro = nit
