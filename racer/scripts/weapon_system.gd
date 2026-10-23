class_name WeaponSystem
extends RefCounted
## Per-car weapon state + trigger rules, shared by the player and the AI (same rules = fair).
## The lock-on always runs (aim assist): a ring fills on the target in the forward cone.
## mode "auto": the rules fire everything (AI, autopilot, AUTO setting).
## mode "tap" / "flick": the player fires; rockets home in proportion to the lock progress.

var car: Car
var game: Node
var slots := {}            # slot -> {"def": Dictionary, "ammo": int, "cool": float}
var mode := "auto"
var lock_target: Car
var lock_progress := 0.0   # 0..1
var ult := 0.0             # 0..1 ULTIMATE meter
var stats := {"rockets": 0, "mines": 0, "ults": 0, "hits": 0, "wrecks": 0, "near_miss": 0}
var _locked_t := 0.0
var _barrel := 0
var _ray := PhysicsRayQueryParameters3D.new()

func _init(p_car: Car, p_game: Node, loadout: Dictionary) -> void:
	car = p_car
	game = p_game
	for slot in loadout:
		var d: Dictionary = loadout[slot]
		slots[slot] = {"def": d, "ammo": int(d.get("ammo", 0)), "cool": 0.0}
	_ray.collision_mask = 1

func def(slot: String) -> Dictionary:
	return slots[slot].def if slots.has(slot) else {}

func ammo(slot: String) -> int:
	return slots[slot].ammo if slots.has(slot) else 0

func refill_lap() -> void:
	for s in slots.values():
		var d: Dictionary = s.def
		if d.has("ammo_max"):
			s.ammo = mini(s.ammo + int(d.get("refill_per_lap", 0)), int(d.ammo_max))

func add_ult(x: float) -> void:
	if not slots.has("ultimate") or not car.alive: return
	var was := ult
	ult = clampf(ult + x, 0.0, 1.0)
	if was < 1.0 and ult >= 1.0 and game: game.on_ult_ready(car)

func is_locked() -> bool:
	return lock_target != null and lock_progress >= 1.0

# ------------------------------------------------------------------ per physics tick
func update(dt: float) -> void:
	for s in slots.values(): s.cool = maxf(0.0, s.cool - dt)
	if not (car.alive and car.controls_enabled and not car.finished):
		lock_progress = maxf(0.0, lock_progress - dt * 3.0)
		if lock_progress <= 0.0: lock_target = null
		return
	if car.drifting: add_ult(WeaponDefs.ULT_GAIN.drift_per_s * dt)
	_update_lock(dt)
	if mode == "auto":
		_auto_rear()
		if ult >= 1.0 and _ult_targets().size() > 0: activate_ult()

func _geom_ok(o: Car, tr: Dictionary) -> bool:
	if o == null or o == car or not o.alive: return false
	var rel := o.global_position - car.global_position
	var dist := rel.length()
	if dist < tr.min_range or dist > tr.range: return false
	var f := car.global_basis.z
	var a := Vector2(rel.x, rel.z).normalized()
	var b := Vector2(f.x, f.z).normalized()
	return a.dot(b) >= cos(deg_to_rad(tr.cone_deg))

func _los(o: Car) -> bool:
	_ray.from = car.global_position + car.global_basis.y * 2.3
	_ray.to = o.global_position + o.global_basis.y * 1.0
	return car.get_world_3d().direct_space_state.intersect_ray(_ray).is_empty()

func _valid(o: Car, tr: Dictionary) -> bool:
	return _geom_ok(o, tr) and (not tr.get("los", false) or _los(o))

func _candidate(tr: Dictionary) -> Car:
	# prefer the nearest car ahead inside the cone (one LOS ray for the winner only)
	var best: Car = null
	var bd := 1e9
	for o: Car in game.cars:
		if not _geom_ok(o, tr): continue
		var d := o.global_position.distance_squared_to(car.global_position)
		if d < bd: bd = d; best = o
	if best and tr.get("los", false) and not _los(best): return null
	return best

func _update_lock(dt: float) -> void:
	var d := def("front")
	if d.is_empty(): return
	var tr: Dictionary = d.trigger
	if lock_target == null or not _valid(lock_target, tr):
		# target left the cone / got hidden: the ring drains, then a new target can be picked
		lock_progress = maxf(0.0, lock_progress - dt / (tr.lock_time * 0.6))
		_locked_t = 0.0
		if lock_progress <= 0.0:
			lock_target = _candidate(tr)
		return
	if ammo("front") <= 0:
		lock_progress = minf(lock_progress, 0.35)
		return
	lock_progress = minf(1.0, lock_progress + dt / tr.lock_time)
	if lock_progress >= 1.0:
		_locked_t += dt
		if mode == "auto" and _locked_t >= tr.fire_delay: fire_front()

# ------------------------------------------------------------------ actions
## fire the front weapon at the current lock; partial lock = weaker homing, no lock = straight
func fire_front() -> bool:
	if not slots.has("front") or not car.alive or not car.controls_enabled: return false
	var s: Dictionary = slots.front
	if s.ammo <= 0 or s.cool > 0.0: return false
	var d: Dictionary = s.def
	s.ammo -= 1
	s.cool = d.cooldown
	var homing := lock_progress if lock_target else 0.0
	var tgt: Car = lock_target if homing > 0.05 else null
	for k in int(d.get("count", 1)):
		game.spawn_rocket(car, tgt, d.projectile, _barrel, homing)
		_barrel = 1 - _barrel
	stats.rockets += 1
	lock_progress = 0.0
	_locked_t = 0.0
	return true

func drop_rear(manual := false) -> bool:
	if not slots.has("rear") or not car.alive or not car.controls_enabled: return false
	var s: Dictionary = slots.rear
	if s.ammo <= 0 or s.cool > 0.0: return false
	if not manual and s.def.trigger.get("on_road", false) and not (car.on_road and car.grounded >= 3): return false
	s.ammo -= 1
	s.cool = s.def.cooldown
	game.spawn_mine(car, s.def)
	stats.mines += 1
	return true

func _auto_rear() -> void:
	if not slots.has("rear"): return
	var s: Dictionary = slots.rear
	if s.ammo <= 0 or s.cool > 0.0: return
	var tr: Dictionary = s.def.trigger
	var f := car.global_basis.z
	for o: Car in game.cars:
		if o == car or not o.alive: continue
		var rel := o.global_position - car.global_position
		var behind := -rel.dot(f)
		if behind < tr.min or behind > tr.max: continue
		if rel.normalized().dot(-f) >= cos(deg_to_rad(tr.cone_deg)):
			drop_rear()
			return

func _ult_targets() -> Array[Car]:
	var d := def("ultimate")
	var out: Array[Car] = []
	if d.is_empty(): return out
	var f := car.global_basis.z
	for o: Car in game.cars:
		if o == car or not o.alive: continue
		var rel := o.global_position - car.global_position
		if rel.dot(f) > 0.0 and rel.length() < d.range: out.append(o)
	out.sort_custom(func(a: Car, b: Car) -> bool:
		return a.global_position.distance_squared_to(car.global_position) < b.global_position.distance_squared_to(car.global_position))
	return out.slice(0, int(d.max_targets))

func activate_ult() -> bool:
	if ult < 1.0 or not slots.has("ultimate") or not car.alive or not car.controls_enabled: return false
	ult = 0.0
	stats.ults += 1
	game.start_ultimate(car, def("ultimate"), _ult_targets())
	return true

func next_barrel() -> int:
	_barrel = 1 - _barrel
	return _barrel
