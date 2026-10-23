class_name Game
extends Node
## SCRAP RALLY - first playable test.
## title -> intro -> countdown 3-2-1-GO -> 3 laps vs 3 AI rivals -> results -> restart.

const LAPS := 3
const PLACE_MONEY := [1000, 600, 350, 150]
const KILL_MONEY := 150
const PICKUP_MONEY := 50

static var skip_title := false     # set by Restart
static var autotest := false       # headless test: every car (player too) on autopilot

const RIVALS := [
	{"name": "RAZOR", "colour": "red", "skill": {"grip_use": 0.97, "line_bias": -0.6, "wander": 0.4, "nitro_eager": 0.9, "aggression": 0.8, "reaction": 0.08}},
	{"name": "BLUE MAX", "colour": "blue", "skill": {"grip_use": 0.9, "line_bias": 0.8, "wander": 0.8, "nitro_eager": 0.7, "aggression": 0.55, "reaction": 0.11}},
	{"name": "VIPER", "colour": "teal", "skill": {"grip_use": 0.83, "line_bias": 0.0, "wander": 1.3, "nitro_eager": 0.45, "aggression": 0.35, "reaction": 0.16}},
]
const PLAYER_AUTOPILOT := {"grip_use": 0.9, "line_bias": -0.3, "wander": 0.6, "nitro_eager": 0.7, "aggression": 0.6, "reaction": 0.1}

var track: Track
var cars: Array[Car] = []
var player: Car
var ais := {}
var cam: ChaseCamera
var hud: Hud
var controls: TouchControls
var sfx: Sfx
var state := "title"
var state_t := 0.0
var race_time := 0.0
var pickups: Array = []
var finish_order: Array[Car] = []
var _count_last := -1
var _results_shown := false
var _pickup_mesh: Mesh
var _pickup_mat: Material
var _outside_t := {}
var _player_pickup_money := 0
var autopilot := false            # debug: player driven by the AI (web hook / tests)
var _force_nitro := 0.0
var _js_cb: JavaScriptObject
var _js_t := 0.0

func _ready() -> void:
	if "--autotest" in OS.get_cmdline_user_args(): autotest = true
	sfx = Sfx.new()
	add_child(sfx)
	track = Track.new()
	track.name = "Track"
	add_child(track)
	track.build()
	_spawn_cars()
	_spawn_pickups()
	cam = ChaseCamera.new()
	cam.target = player
	cam.far = 1600.0
	cam.near = 0.15
	add_child(cam)
	cam.current = true
	var layer := CanvasLayer.new()
	add_child(layer)
	controls = TouchControls.new()
	layer.add_child(controls)
	hud = Hud.new()
	hud.game = self
	layer.add_child(hud)
	hud.set_map(track.minimap_points())
	hud.race_pressed.connect(_on_race_pressed)
	hud.restart_pressed.connect(_on_restart)
	_setup_js()
	if skip_title or autotest:
		hud.title_root.visible = false
		_start_intro()
	else:
		state = "title"
		cam.mode = "orbit"
		cam.global_position = player.global_position + Vector3(8, 3, 6)

func _spawn_cars() -> void:
	var slot := 0
	for r in RIVALS:
		var c := _make_car(r.colour, r.name, false, slot)
		ais[c] = AIDriver.new(c, track, self, r.skill)
		slot += 1
	player = _make_car("original", "YOU", true, slot)
	ais[player] = AIDriver.new(player, track, self, PLAYER_AUTOPILOT)

func _make_car(colour: String, nm: String, is_player: bool, slot: int) -> Car:
	var c := Car.new()
	c.setup(self, colour, nm, is_player)
	c.name = nm.replace(" ", "_")
	add_child(c)
	var xf := track.grid_transform(slot)
	c.global_transform = xf
	c.track_idx = track.nearest_global(xf.origin)
	c.progress = c.track_idx
	c.safe_idx = c.track_idx
	c.wrecked.connect(_on_wrecked)
	cars.append(c)
	_outside_t[c] = 0.0
	return c

func engine_stream() -> AudioStream:
	return sfx.streams["engine"]

# ------------------------------------------------------------------ flow
func _on_race_pressed() -> void:
	if state != "title": return
	hud.title_root.visible = false
	_start_intro()

func _on_restart() -> void:
	skip_title = true
	get_tree().reload_current_scene()

func _start_intro() -> void:
	state = "intro"
	state_t = 0.0
	cam.mode = "chase"
	# fly in from in front of the grid
	var f := player.global_basis.z
	cam.global_position = player.global_position + f * 30.0 + Vector3.UP * 12.0
	hud.show_race = true
	controls.active = true
	for c in cars: c.start_engine()

func _set_state(s: String) -> void:
	state = s
	state_t = 0.0

func _process(dt: float) -> void:
	state_t += dt
	_js_state(dt)
	match state:
		"intro":
			if state_t > (0.3 if autotest else 1.4): _set_state("countdown"); _count_last = -1
		"countdown":
			var k := int(state_t)
			if k != _count_last and k < 3:
				_count_last = k
				hud.countdown_text = str(3 - k); hud.countdown_t = 0.0
				sfx.play("beep", -4.0)
			if state_t >= 3.0:
				_set_state("race")
				hud.countdown_text = "GO!"; hud.countdown_t = 0.0
				sfx.play("go", -3.0)
				Input.vibrate_handheld(40)
				for c in cars:
					c.controls_enabled = true
					c.lap_start = 0.0
		"race":
			race_time += dt
			if state_t > 1.0 and hud.countdown_text == "GO!": hud.countdown_text = ""
		"finished":
			race_time += dt
			if not _results_shown and state_t > 2.5: _show_results()
	# reticle for the player's lock
	hud.reticle_on = false
	if player.lock_target and player.alive and state == "race":
		var tp := player.lock_target.global_position + Vector3.UP * 1.0
		if not cam.is_position_behind(tp):
			hud.reticle_pos = cam.unproject_position(tp)
			hud.reticle_on = true
	# pickups spin / respawn
	for pk in pickups:
		var node: Node3D = pk.node
		if pk.cool > 0.0:
			pk.cool -= dt
			if pk.cool <= 0.0: node.visible = true
		node.rotate_y(dt * 3.0)

func _physics_process(dt: float) -> void:
	var racing := state == "race" or state == "finished"
	for c in cars:
		_track_car(c, dt)
	_update_locks()
	# inputs
	for c in cars:
		var auto := ais.has(c) and (c != player or autotest or autopilot or c.finished)
		if auto:
			ais[c].update(dt)
		else:
			c.in_steer = controls.steer
			c.in_throttle = controls.throttle
			c.in_brake = controls.brake
			c.in_nitro = controls.nitro
			if racing:
				if controls.consume_front():
					if c.fire_front(): Input.vibrate_handheld(30)
				if controls.consume_rear():
					if c.drop_rear(): Input.vibrate_handheld(30)
	if racing: _update_pickups()
	_update_places()
	if _force_nitro > 0.0:
		_force_nitro -= dt
		player.in_nitro = true
		player.in_throttle = 1.0

func _track_car(c: Car, dt: float) -> void:
	if not c.alive: return
	var old := c.track_idx
	var idx := track.nearest(c.global_position, old)
	var d := idx - old
	if d > track.n / 2: d -= track.n
	elif d < -track.n / 2: d += track.n
	c.progress += d
	c.track_idx = idx
	# safe respawn point: on the road, upright, all wheels down
	var lat := track.lateral_of(c.global_position, idx)
	if c.grounded == 4 and c.on_road and absf(lat) < Track.HALF - 1.0 and c.global_basis.y.y > 0.8:
		c.safe_idx = idx
	# lap counting
	var new_lap := int(floor(c.progress / track.n)) + 1
	if new_lap > c.lap and state in ["race", "finished"] and not c.finished:
		var lt := race_time - c.lap_start
		c.lap_start = race_time
		c.last_lap = lt
		if c.best_lap == 0.0 or lt < c.best_lap: c.best_lap = lt
		c.lap = new_lap
		c.rockets = mini(c.rockets + 2, 6)
		c.mines = mini(c.mines + 1, 3)
		if c.lap > LAPS:
			c.finished = true
			c.finish_time = race_time
			finish_order.append(c)
			if c == player:
				hud.flash("FINISH!", Hud.GOLD, 2.5)
				_set_state("finished")
				controls.active = false
		elif c == player:
			hud.flash("FINAL LAP" if c.lap == LAPS else "LAP %d" % c.lap, Color(1, 0.9, 0.7))
	# fell off the world / left the track
	var below := c.global_position.y < track.pos[idx].y - 12.0
	var outside := absf(lat) > Track.HALF + 6.0 and c.global_position.y < track.pos[idx].y + 3.0
	if outside or below: _outside_t[c] += dt
	else: _outside_t[c] = 0.0
	if below or _outside_t[c] > 1.5:
		if below: c.falls += 1
		_outside_t[c] = 0.0
		respawn_car(c, false)

func respawn_car(c: Car, wreck := true) -> void:
	var idx := track.wrapi_(c.safe_idx - 2)
	var best_lat := 0.0; var best_score := -1.0
	for lat: float in [0.0, -4.0, 4.0, -2.0, 2.0]:
		var p := track.sample_point(idx, lat)
		var score := 1e9
		for o in cars:
			if o != c and o.alive: score = minf(score, o.global_position.distance_to(p))
		if score > best_score + 2.0: best_score = score; best_lat = lat
	var xf := track.frame(idx, best_lat, 0.8)
	var d := idx - c.track_idx
	if d > track.n / 2: d -= track.n
	elif d < -track.n / 2: d += track.n
	c.progress += d
	c.track_idx = idx
	c.respawn_at(xf, wreck)
	if c == player:
		cam.snap()
		if not wreck: hud.flash("RESPAWN", Color(1, 1, 1, 0.9), 1.0)

func _update_locks() -> void:
	for c in cars:
		c.lock_target = null
		if not c.alive: continue
		var f := c.global_basis.z
		var best := 0.0
		for o in cars:
			if o == c or not o.alive: continue
			var rel := o.global_position - c.global_position
			var dist := rel.length()
			if dist < 4.0 or dist > 110.0: continue
			var cosang := rel.dot(f) / dist
			if cosang < cos(deg_to_rad(14.0)): continue
			var score := cosang * 2.0 - dist / 110.0
			if c.lock_target == null or score > best:
				best = score
				c.lock_target = o

func _update_places() -> void:
	var order := cars.duplicate()
	order.sort_custom(func(a: Car, b: Car) -> bool:
		if a.finished and b.finished: return a.finish_time < b.finish_time
		if a.finished != b.finished: return a.finished
		return a.progress > b.progress)
	for i in order.size(): order[i].place = i + 1

# ------------------------------------------------------------------ weapons / damage
func spawn_rocket(shooter: Car, target: Car) -> void:
	var r := Rocket.new()
	add_child(r)
	var at := shooter.global_transform * Vector3(0, 2.45, 1.4)
	var dir := (shooter.global_basis.z + shooter.global_basis.y * 0.02).normalized()
	r.launch(self, shooter, target, at, dir)
	r.look_at(at + dir, Vector3.UP)
	sfx.play_at("launch", at, self, 2.0 if shooter == player else -2.0)
	if shooter == player: cam.shake = maxf(cam.shake, 0.3)

func spawn_mine(c: Car) -> void:
	var m := Mine.new()
	m.owner_car = c
	m.game = self
	var at := c.global_transform * Vector3(0, 0.8, -2.9)
	var q := PhysicsRayQueryParameters3D.create(at + Vector3.UP, at + Vector3.DOWN * 6.0, 1)
	var hit := get_viewport().world_3d.direct_space_state.intersect_ray(q)
	add_child(m)
	if hit:
		m.global_position = hit.position
		var n: Vector3 = hit.normal
		m.global_basis = Basis(n.cross(c.global_basis.z).normalized(), n, c.global_basis.z).orthonormalized()
	else:
		m.global_position = at
	sfx.play_at("mine", at, self)

func explode(at: Vector3, radius: float, dmg: float, by: Car, direct: Car, size := 1.0) -> void:
	Fx.explosion(self, at, size)
	sfx.play_at("boom", at, self, 4.0)
	var pd := player.global_position.distance_to(at)
	if pd < 40.0: cam.shake = maxf(cam.shake, clampf(1.0 - pd / 40.0, 0.0, 1.0))
	for c in cars:
		if not c.alive: continue
		var d := c.global_position.distance_to(at)
		var k := 0.0
		if c == direct: k = 1.0
		elif d < radius: k = (1.0 - d / radius) * 0.85
		if k <= 0.0: continue
		var out := (c.global_position - at)
		out.y = 0.0
		out = (out.normalized() + Vector3.UP * 1.3).normalized()
		c.apply_impulse(out * c.mass * 5.5 * k, c.global_basis.x * randf_range(-0.6, 0.6))
		c.damage(dmg * k, by)
		if c == player:
			Input.vibrate_handheld(60)
			hud.flash("HIT  -%d" % int(dmg * k), Color(1, 0.4, 0.3), 0.9)

func _on_wrecked(c: Car, by: Car) -> void:
	Fx.explosion(self, c.global_position + Vector3.UP, 1.6)
	sfx.play_at("boom", c.global_position, self, 6.0)
	if by and by != c:
		by.kills += 1
		by.money += KILL_MONEY
		if by == player: hud.flash("WRECKED %s!  +$%d" % [c.driver_name, KILL_MONEY], Hud.GOLD, 2.0)
	if c == player:
		hud.flash("WRECKED!", Color(1, 0.35, 0.25), 1.8)
		cam.shake = 1.0
		Input.vibrate_handheld(120)

func on_bump(c: Car, other: Car, impulse: float) -> void:
	if c == player or other == player:
		if c == player: Input.vibrate_handheld(20)
		sfx.play("clank", -6.0 + clampf(impulse / 4000.0, 0.0, 6.0), randf_range(0.85, 1.15))
		cam.shake = maxf(cam.shake, clampf(impulse / 12000.0, 0.0, 0.5))

func on_scrape(c: Car, impulse: float) -> void:
	if c == player:
		sfx.play("clank", -12.0, randf_range(0.6, 0.8))

# ------------------------------------------------------------------ pickups
func _spawn_pickups() -> void:
	var cm := CylinderMesh.new()
	cm.top_radius = 0.6; cm.bottom_radius = 0.6; cm.height = 0.16; cm.radial_segments = 14; cm.rings = 1
	var m := StandardMaterial3D.new()
	m.albedo_color = Color(1.0, 0.75, 0.15)
	m.metallic = 0.9; m.roughness = 0.25
	m.emission_enabled = true; m.emission = Color(1.0, 0.6, 0.1); m.emission_energy_multiplier = 0.9
	_pickup_mesh = cm; _pickup_mat = m
	for p in track.pickup_spots:
		var node := Node3D.new()
		var mi := MeshInstance3D.new()
		mi.mesh = cm
		mi.material_override = m
		mi.rotation.x = PI / 2
		node.add_child(mi)
		var lbl := Label3D.new()
		lbl.text = "$"
		lbl.font_size = 64; lbl.pixel_size = 0.012
		lbl.modulate = Color(0.35, 0.18, 0.02)
		lbl.outline_size = 0
		lbl.position = Vector3(0, 0, 0.09)
		node.add_child(lbl)
		var lbl2 := lbl.duplicate() as Label3D
		lbl2.position = Vector3(0, 0, -0.09); lbl2.rotation.y = PI
		node.add_child(lbl2)
		add_child(node)
		node.global_position = p + Vector3.UP * 0.4
		pickups.append({"node": node, "pos": node.global_position, "cool": 0.0})

func _update_pickups() -> void:
	for pk in pickups:
		if pk.cool > 0.0: continue
		for c in cars:
			if not c.alive: continue
			if c.global_position.distance_squared_to(pk.pos) < 2.6 * 2.6 + 1.0:
				pk.cool = 8.0
				pk.node.visible = false
				c.money += PICKUP_MONEY
				if c == player:
					_player_pickup_money += PICKUP_MONEY
					sfx.play("coin", -4.0)
					Input.vibrate_handheld(10)
				break

# ------------------------------------------------------------------ debug hook (web)
## window.racerCmd('race'|'auto'|'fire'|'mine'|'nitro'|'finish'); state in window.racerState
func _setup_js() -> void:
	if not OS.has_feature("web"): return
	_js_cb = JavaScriptBridge.create_callback(_on_js_cmd)
	var win := JavaScriptBridge.get_interface("window")
	win.racerCmd = _js_cb

func _on_js_cmd(args: Array) -> void:
	var cmd := str(args[0]) if args.size() > 0 else ""
	match cmd:
		"race": _on_race_pressed()
		"auto": autopilot = true
		"manual": autopilot = false
		"fire": player.fire_front()
		"mine": player.drop_rear()
		"nitro": _force_nitro = 2.5; player.nitro = 1.0
		"finish": _debug_finish()
		"jump":
			var i := track.wrapi_(track.jump_idx - 22)
			var xf := track.frame(i, 0.0, 0.6)
			player.respawn_at(xf, false, xf.basis.z * 34.0)
			var dprog := i - player.track_idx
			player.track_idx = i
			player.safe_idx = i
			player.progress += dprog
			cam.snap()

func _debug_finish() -> void:
	# jump to the end of the race keeping the current order (for screenshots)
	var order := cars.duplicate()
	order.sort_custom(func(a: Car, b: Car) -> bool: return a.place < b.place)
	var i := 0
	for c: Car in order:
		c.finished = true
		c.lap = LAPS + 1
		c.finish_time = race_time + 95.0 + i * 1.8 + randf() * 1.2
		finish_order.append(c)
		i += 1
	race_time += 95.0
	_set_state("finished")
	controls.active = false
	state_t = 2.0

func _js_state(dt: float) -> void:
	if _js_cb == null: return
	_js_t -= dt
	if _js_t > 0.0: return
	_js_t = 0.25
	var st := {"state": state, "t": snappedf(race_time, 0.1), "place": player.place, "lap": player.lap,
		"speed": int(player.speed * 3.6), "lock": player.lock_target != null, "fps": Engine.get_frames_per_second(),
		"rockets": player.rockets, "results": _results_shown, "air": player.grounded == 0}
	JavaScriptBridge.eval("window.racerState = " + JSON.stringify(st) + ";", true)

# ------------------------------------------------------------------ results
func _show_results() -> void:
	_results_shown = true
	var order := cars.duplicate()
	order.sort_custom(func(a: Car, b: Car) -> bool: return a.place < b.place)
	var rows := []
	for c: Car in order:
		var bonus: int = PLACE_MONEY[c.place - 1]
		var t := Hud._fmt_time(c.finish_time) if c.finished else "LAP %d/%d" % [mini(c.lap, LAPS), LAPS]
		rows.append({"place": c.place, "name": c.driver_name, "time": t, "kills": c.kills, "money": c.money + bonus,
			"player": c == player, "tint": CarPaint.TINT.get(c.colour, Color.WHITE)})
	var pb: int = PLACE_MONEY[player.place - 1]
	var earned := {"place": pb, "pickups": _player_pickup_money, "kills": player.kills * KILL_MONEY,
		"total": pb + player.money}
	hud.show_finish(rows, player.place, earned)
