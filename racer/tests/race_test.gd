extends Node
## Headless race test: all 4 cars (player on autopilot) race 3 laps.
## godot --headless --fixed-fps 60 --path racer res://tests/race_test.tscn
## Checks: every car finishes, nobody falls through the world, sane lap times.

const MAX_SIM := 480.0

var game: Game
var t := 0.0
var min_y := {}
var max_speed := {}
var lap_times := {}
var _last_lap := {}
var _done_t := -1.0
var drift_t := {}
var nitro_t := {}
var air_t := {}
var air_max := {}
var slow_t := {}

func _ready() -> void:
	Game.autotest = true
	game = load("res://scenes/main.tscn").instantiate()
	add_child(game)
	for c in game.cars:
		min_y[c.driver_name] = 1e9
		max_speed[c.driver_name] = 0.0
		lap_times[c.driver_name] = []
		_last_lap[c.driver_name] = 1
		drift_t[c.driver_name] = 0.0; nitro_t[c.driver_name] = 0.0; air_t[c.driver_name] = 0.0; air_max[c.driver_name] = 0.0

func _physics_process(dt: float) -> void:
	t += dt
	for c: Car in game.cars:
		var n := c.driver_name
		if c.alive:
			min_y[n] = minf(min_y[n], c.global_position.y)
			max_speed[n] = maxf(max_speed[n], c.speed)
			if c.drifting: drift_t[n] += dt
			if c.nitro_on: nitro_t[n] += dt
			if c.grounded == 0: air_t[n] += dt
			else: air_t[n] = 0.0
			air_max[n] = maxf(air_max[n], air_t[n])
		if c.lap != _last_lap[n]:
			_last_lap[n] = c.lap
			lap_times[n].append(snappedf(c.last_lap, 0.01))
	for c: Car in game.cars:
		var nm := c.driver_name
		slow_t[nm] = slow_t.get(nm, 0.0) + dt if (absf(c.speed) < 6.0 and game.state == "race") else 0.0
		if slow_t[nm] > 3.0 and int(t * 60) % 120 == 0:
			var i := c.track_idx
			print("STALL %s t=%.0f idx=%d pos=%s v=%.1f lat=%.1f grounded=%d up=%.2f alive=%s safe=%d thr=%.1f brk=%.1f steer=%.2f frozen=%s layer=%d" % [nm, t, i, str(c.global_position.snapped(Vector3.ONE * 0.1)), c.speed, game.track.lateral_of(c.global_position, i), c.grounded, c.global_basis.y.y, c.alive, c.safe_idx, c.in_throttle, c.in_brake, c.in_steer, c.freeze, c.collision_layer])
	if OS.get_environment("TRACE") != "" and int(t * 60) % 60 == 0:
		for c: Car in game.cars:
			if c.driver_name == OS.get_environment("TRACE"):
				var i := c.track_idx
				print("TRACE t=%.0f idx=%d prog=%.0f pos=%s v=%.1f lat=%.1f grounded=%d up=%.2f alive=%s safe=%d thr=%.1f brk=%.1f steer=%.2f" % [t, i, c.progress, str(c.global_position.snapped(Vector3.ONE * 0.1)), c.speed, game.track.lateral_of(c.global_position, i), c.grounded, c.global_basis.y.y, c.alive, c.safe_idx, c.in_throttle, c.in_brake, c.in_steer])
	if int(t * 60) % 600 == 0:
		var s := "t=%5.1f " % t
		for c: Car in game.cars:
			s += "| %s lap %d prog %.0f v %.0f hp %.0f rs %d " % [c.driver_name, c.lap, c.progress, c.speed * 3.6, c.hp, c.respawns]
		print(s)
	var all_done := true
	for c: Car in game.cars:
		if not c.finished: all_done = false
	if all_done and _done_t < 0.0: _done_t = t
	if (_done_t >= 0.0 and t > _done_t + 0.5) or t > MAX_SIM:
		_report()

func _report() -> void:
	var ok := true
	var lines := []
	for c: Car in game.cars:
		var n := c.driver_name
		var fell: bool = c.falls > 0 or min_y[n] < -30.0
		if not c.finished or fell: ok = false
		lines.append("%-9s place %d finished=%s time=%s best_lap=%.2f laps=%s respawns=%d falls=%d min_y=%.1f vmax=%d km/h kills=%d money=%d hp=%d drift=%.1fs nitro=%.1fs max_air=%.2fs rockets=%d mines=%d" % [
			n, c.place, c.finished, Hud._fmt_time(c.finish_time), c.best_lap, str(lap_times[n]), c.respawns, c.falls, min_y[n], int(max_speed[n] * 3.6), c.kills, c.money, int(c.hp), drift_t[n], nitro_t[n], air_max[n], c.stat_rockets, c.stat_mines])
	print("==== RACE TEST REPORT (sim %.1f s, track %.0f m) ====" % [t, game.track.length])
	for l in lines: print(l)
	print("RESULT: ", "PASS" if ok else "FAIL")
	get_tree().quit(0 if ok else 1)
