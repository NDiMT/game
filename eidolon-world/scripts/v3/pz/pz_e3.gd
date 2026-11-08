extends Puzzle
## E.3 "The Mirror Walk" (CH1_V3 §2, ★★★): a 35 m gallery along one great east glass. In the glass, and only there,
## the Warden walks beside you (he is in HER world: TwoWorld.HER), keeping pace a few metres back. When the glass mists
## at a spot, he will stop there in 1.5 s, turn and look OUT of it. A row of columns stands between the walk and the
## glass: be behind one, as he sees it from where he stands in the glass (a real line of sight from his mirrored place,
## so the angle matters). Teach: one column, a slow first look. Test: three, at his pace (the Upward Spring, E.4, is a
## safe side room). Twist: two mists at once: he looks from one, then whips to the other: only tight behind a column
## hides you from both. Seen: a white flash and you are back at the last column you hid behind (no death).
## Done = the north door. Clip: flinch_seen (A, P2; recoil stands in), hide_column (A; none yet).

const X_COL := 34.0
const R_COL := 0.28
const COLS := [-28.5, -32.0, -35.5, -43.2, -46.4, -49.6, -52.8]
const TWIST_Z := -44.0                     # north of this: two mists at once
const END_Z := -55.2
const X_WALK := 32.2                       # where he walks, in the room (his image stands 2.5 m deep in the glass)
const HIDE_TOL := 0.5                      # (the line from his eye to her middle passes this near a column's axis)
var glass_x := 34.71
var x_seen := 37.2                         # his mirrored place (the line of sight starts there)
var warden: WardenRig
var mists: Array[ShaderMaterial] = []
var mist_q: Array[MeshInstance3D] = []
var wz := -22.0                            # his z (room)
var st := "idle"                           # idle (not met yet), walk, warn, look, back
var st_t := 0.0
var looks: Array = []                      # z of each look in this warning (1, or 2 in the twist)
var look_i := 0
var exposed := 0.0
var cp := -1                               # the last column she hid behind (-1: the stair head)
var _caught := false
var _taught := false
var _auto: Array = []
var _auto_wait := false
var _auto_t := 0.0
var _hid_this := false

const MIST_SHADER := """
shader_type spatial;
render_mode unshaded, cull_disabled, depth_draw_never, blend_mix;
uniform float k = 0.0;
uniform sampler2D noise_tex : repeat_enable, filter_linear;
void fragment() {
	vec2 c = UV - vec2(0.5);
	float r = length(c * vec2(1.0, 0.75));
	float n = texture(noise_tex, UV * 1.6 + vec2(TIME * 0.02, -TIME * 0.035)).r;
	float n2 = texture(noise_tex, UV * 3.7 - vec2(TIME * 0.05, 0.0)).r;
	float a = smoothstep(0.5, 0.12, r + (n - 0.5) * 0.35 * (1.2 - k)) * k * (0.55 + 0.45 * n2);
	ALBEDO = vec3(0.86, 0.88, 0.9);
	ALPHA = clamp(a * 0.85, 0.0, 0.9);
}
"""

func build() -> void:
	test_s = 120.0
	var y := Map3.height("E3", Vector2(32.0, -40.0))
	var m := MB.new()
	for z: float in COLS:
		m.cyl(Vector3(X_COL, y + 1.45, z), R_COL, R_COL + 0.02, 2.9, Color(0.5, 0.0, 0.0), 14)
		m.cyl(Vector3(X_COL, y + 0.07, z), R_COL + 0.1, R_COL + 0.12, 0.14, Color(0.5, 0.25, 0.0), 14)
		m.box(Vector3(X_COL, y + 2.95, z), Vector3(R_COL * 2.6, 0.14, R_COL * 2.6), Color(0.5, 0.25, 0.0))
		game.level.ob_circle(Vector2(X_COL, z), R_COL + 0.04)
	Kit3.marble(game, m.commit(), self).name = "E3_Columns"

func post() -> void:
	var r := Map3.rect("E3")
	glass_x = r.end.x - World3.GLASS_OFF
	x_seen = 2.0 * glass_x - X_WALK
	var y := Map3.height("E3", Vector2(32.0, -40.0))
	warden = WardenRig.new()
	warden.name = "E3_Warden"
	add_child(warden)
	warden.set_look("reflection")
	warden.set_shadow(false)
	TwoWorld.set_her(warden)
	warden.position = Vector3(X_WALK, y, wz)
	warden.rotation.y = PI
	var sh := Shader.new()
	sh.code = MIST_SHADER
	for i in 2:
		var mm := ShaderMaterial.new()
		mm.shader = sh
		mm.set_shader_parameter("noise_tex", game.level.noise_tex)
		mm.render_priority = 3
		var q := QuadMesh.new()
		q.size = Vector2(1.9, 2.4)
		var mi := MeshInstance3D.new()
		mi.name = "E3_Mist_%d" % i
		mi.mesh = q
		mi.material_override = mm
		mi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
		mi.layers = TwoWorld.MINE
		mi.transform = Transform3D(Basis(Vector3.UP, -PI * 0.5), Vector3(glass_x - 0.015, y + 1.6, -30.0))
		mi.visible = false
		add_child(mi)
		mists.append(mm)
		mist_q.append(mi)

## the timings: the first look is slow, then his pace
func _warn_s() -> float: return 2.4 if not _taught else 1.5
func _walk_s() -> float: return 3.2 if game.player.position.z > TWIST_Z else 3.6

func tick(dt: float) -> void:
	if done or warden == null: return
	var p := game.player.position
	var inside := here() and game.mode == "play"
	if not inside and st != "look" and st != "warn":
		if st != "idle": _go_idle()
		return
	if st == "idle":
		_walk_to(p.z + 1.8, dt)
		if p.z < COLS[0] + 1.6: _state_to("warn")
		return
	if p.z < END_Z:
		solve()
		return
	st_t += dt
	match st:
		"walk":
			_walk_to(p.z + (2.2 if p.z > TWIST_Z else 1.4), dt)
			if st_t > _walk_s(): _state_to("warn")
		"warn":
			var k := clampf(st_t / _warn_s(), 0.0, 1.0)
			for i in looks.size(): mists[i].set_shader_parameter("k", smoothstep(0.0, 1.0, k))
			if st_t > _warn_s(): _state_to("look")
		"look":
			var per := 2.0 if looks.size() == 1 else 1.5
			var li := mini(int(st_t / per), looks.size() - 1)
			if li != look_i:
				look_i = li
				wz = looks[li]
				_turn_out(true)
				if game.sfx: game.sfx.play("glass", -20.0, 0.38)
			warden.position.z = lerpf(warden.position.z, wz, 1.0 - exp(-dt * 9.0))
			var seen := _seen_from(looks[look_i])
			exposed = exposed + dt if seen else maxf(0.0, exposed - dt * 2.0)
			if exposed > 0.3 and not _caught:
				_catch()
				return
			if not seen and _hidden_col() >= 0: _hid_this = true
			if st_t > per * looks.size():
				if _hid_this:
					var c := _hidden_col()
					if c > cp: cp = c
					state["cp"] = cp
					progress()
				_state_to("back")
		"back":
			for i in mists.size(): mists[i].set_shader_parameter("k", maxf(0.0, 1.0 - st_t / 0.6))
			if st_t > 0.7: _state_to("walk")

func _state_to(s: String) -> void:
	st = s
	st_t = 0.0
	match s:
		"walk":
			for q in mist_q: q.visible = false
			_turn_out(false)
		"warn":
			warden.walk(false)
			var p := game.player.position
			wz = clampf(warden.position.z, -53.5, -23.5)
			looks = [wz]
			if p.z < TWIST_Z: looks.append(clampf(wz - 3.4, -54.0, -23.5))
			for i in mist_q.size():
				mist_q[i].visible = i < looks.size()
				if i < looks.size(): mist_q[i].position.z = looks[i]
				mists[i].set_shader_parameter("k", 0.0)
			look_i = -1
			_hid_this = false
			if game.sfx:
				game.sfx.play("thud", -22.0, 0.5)
				game.sfx.play_later("thud", 0.42, -24.0, 0.5)
				if looks.size() > 1: game.sfx.play_later("glass_tink", 0.3, -22.0, 0.7)
		"look":
			look_i = -1
			exposed = 0.0
			_taught = true
		"back":
			_turn_out(false)

func _go_idle() -> void:
	st = "idle"
	st_t = 0.0
	warden.walk(false)
	_turn_out(false)
	for q in mist_q: q.visible = false

func _walk_to(z: float, dt: float) -> void:
	z = clampf(z, -54.0, -22.5)
	var d := z - warden.position.z
	var v := clampf(d * 0.9, -0.85, 0.85)
	warden.position.z += v * dt
	warden.walk(absf(v) > 0.12)
	if absf(v) > 0.12: warden.rotation.y = lerp_angle(warden.rotation.y, PI if v < 0.0 else 0.0, 1.0 - exp(-dt * 4.0))

## he turns out of the glass toward you (in the glass he faces the room), or back along it
func _turn_out(on: bool) -> void:
	var tw := warden.create_tween()
	tw.tween_property(warden, "rotation:y", PI * 0.5 if on else PI, 0.45).set_trans(Tween.TRANS_SINE)
	warden.look_at_point(game.player.position + Vector3(0, 0.8, 0) if on else Vector3.INF)

## is she in his sight from his look at z (seen from his mirrored place, past the columns)?
func _seen_from(z: float) -> bool:
	var p := game.player.position
	if p.x < 31.25 or p.z > -22.6 or p.z < -54.6: return false          # (in the side room, or past the glass's ends)
	if absf(p.z - z) > 7.5: return false
	for zc: float in COLS:
		if p.x > X_COL - 0.12 or p.x < X_COL - 1.7: continue
		var t := (X_COL - p.x) / (x_seen - p.x)
		if absf(p.z + (z - p.z) * t - zc) < HIDE_TOL: return false
	return true

## the column she is tucked behind now (-1: none)
func _hidden_col() -> int:
	var p := game.player.position
	for i in COLS.size():
		if p.x < X_COL - 0.12 and p.x > X_COL - 1.7 and absf(p.z - COLS[i]) < 1.0: return i
	return -1

## seen: she flinches, a white flash, and she is back behind the last column she hid at
func _catch() -> void:
	_caught = true
	progress()
	game.call("perform", "flinch_seen", Vector3(glass_x, game.player.position.y + 1.0, wz))
	if game.sfx:
		game.sfx.play("glass", -10.0, 0.3)
		game.sfx.play("whoosh", -14.0, 0.6)
	var ui = game.ui
	var col0: Color = ui.fade.color
	ui.fade.color = Color(0.93, 0.92, 0.9, 0.0)
	var tw := create_tween()
	tw.tween_interval(0.35)
	tw.tween_property(ui.fade, "color:a", 1.0, 0.35)
	tw.tween_callback(func() -> void:
		var to := _cp_pos()
		game.cmd("tp:%f:%f:%f" % [to.x, to.y, PI])
		wz = to.y + 3.0
		warden.position.z = wz
		_go_idle()
		st = "walk"
		st_t = -1.2)
	tw.tween_interval(0.25)
	tw.tween_property(ui.fade, "color:a", 0.0, 0.7)
	tw.tween_callback(func() -> void:
		ui.fade.color = Color(col0.r, col0.g, col0.b, 0.0)
		_caught = false)

func _cp_pos() -> Vector2:
	if cp < 0: return Vector2(32.0, -23.4)
	return Vector2(X_COL - 0.62, COLS[cp])

## she knocks twice on the glass by the next column to reach
func hint() -> void:
	var n := mini(cp + 1, COLS.size() - 1)
	var at := Vector3(glass_x - 0.02, Map3.height("E3", Vector2(32, -40)) + 1.0, COLS[n])
	if game.juice: game.juice.glint(at)
	if game.sfx:
		game.sfx.play("glass_tink", -14.0, 0.9)
		game.sfx.play_later("glass_tink", 0.35, -14.0, 0.9)

func on_solved() -> void:
	for q in mist_q: q.visible = false
	if warden:
		warden.look_at_point(Vector3.INF)
		warden.walk(true)
		warden.rotation.y = 0.0
		var tw := warden.create_tween()
		tw.tween_property(warden, "position:z", warden.position.z + 6.0, 6.0)
		tw.tween_callback(func() -> void:
			warden.walk(false)
			warden.visible = false)

func apply() -> void:
	super.apply()
	cp = int(state.get("cp", -1))
	_caught = false
	_taught = cp >= 0
	for q in mist_q: q.visible = false
	if warden:
		warden.visible = not done
		warden.position.z = -22.5
		warden.rotation.y = PI
		warden.walk(false)
	st = "idle"
	st_t = 0.0

## as a player would: column to column, each time just after a look has passed; tight behind the column
func autosolve() -> void:
	_auto = []
	for i in COLS.size(): _auto.append(Vector2(X_COL - 0.62, COLS[i] - (0.4 if COLS[i] > TWIST_Z else 0.0)))
	_auto.append(Vector2(33.0, -55.6))
	_auto_wait = false

func update(dt: float) -> void:
	super.update(dt)
	if _auto.is_empty() or done: return
	_auto_t += dt
	if _caught:
		_auto_wait = false
		var q0: Vector2 = _cp_pos()
		while not _auto.is_empty() and (_auto[0] as Vector2).y > q0.y + 0.1: _auto.pop_front()
		return
	if game.auto_target != Vector3.INF or _auto_t < 0.3: return
	if _auto_wait:
		if st != "walk" or st_t > 0.4: return
	var q: Vector2 = _auto.pop_front()
	_auto_t = 0.0
	_auto_wait = true
	game.cmd("walk:%f:%f" % [q.x, q.y])
