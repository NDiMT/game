class_name Prologue3
extends Cinematic
## v3 (dev/CH1_V3.md §4): the intro cards and the prologue "Η Αρπαγή", shot by shot on the perspective CineCam, with
## A's clips (heroine: lie_side, rise, look_hands, kneel_reach, recoil, pickup; Ione: the same 0.5 s late, then
## refl_press, refl_dragged; the Warden: grab) and CineFx (letterbox, vignette, shakes, light rig, flash, fog cards).
## Her world is REAL planar reflection: Ione and the Warden stand in the water world (HER layer) and only the pool's
## glass shows them. Their nodes are placed as R * S * Fx (R: the mirror about the surface, S: where they are SEEN,
## Fx: a model-space flip), a proper rotation the rigs pose in as usual; while Ione is "the reflection" (shots 3-6,
## 13) her node simply stands where the heroine stands and plays the heroine's clips half a second late.
## The last shot cranes onto the gameplay framing and hands over to the fixed camera, invisibly.

const WS := preload("res://scripts/v3/pz/pz_ws.gd")
const LAG := 0.5
const SURF := Vector3(-4.6, -0.35, 30.5)          # where the two palms meet
const W := -0.35                                 # the surface's height
const I_SEEN := Vector3(-4.62, -1.52, 30.42)      # Ione, seen: upright under the surface, her raised hand at SURF
## the text cards (EIDOLON_SCRIPT §5), each first mirrored, then turned
const STANZAS := [
	"On Kythira there lived a sculptor named Theron.\nFrom white marble he carved a woman,\nand loved her more than stone should be loved.",
	"Aphrodite gave her life, on one condition:\n*\"Leave her face smooth.\nA face is carved by living, from within.\"*",
	"They called her Ione.\nAnd life began to carve her a face,\na face the sculptor had never imagined.",
	"He gave her a veil.\nAnd he hid every mirror.",
	"One day the Aegean lay still as glass.",
	"There was no wave to blame."]
const WD_SEEN := Vector3(-4.95, -2.06, 29.5)      # the Warden, seen: behind her, his hood just under the surface
var ws                                           # (pz_ws.gd: the shore, its pool, its lanterns)
var fx: CineFx
var ione: Figure
var warden: WardenRig
var comb: Node3D
var _palm: MeshInstance3D
var _cl: CanvasLayer
var _card: IntroCard
var _ring_home: Node
var _cards_done := false
var _cut := false
var _ione_mode := "copy"                         # copy (the heroine's reflection, LAG late), seen (her own, in the water)
var _ione_seen := Transform3D()
var _wd_seen := Transform3D()
var _hist: Array = []                            # [t, heroine xf, pose]
var _cards3: Array = []                          # [MeshInstance3D, pos, ShaderMaterial]
var _glass: ShaderMaterial
var _penv := []                                  # the pool reflection's environment: [env, bg, fog colour, fog density]
var _water0 := []                                # [material, its params before, the black ones]

func _init(g: Game) -> void:
	super(g)
	name = "Prologue3"

func begin() -> void:
	ws = (game.get("ch") as Ch1v3).pz["WS"]
	fx = CineFx.new(game.world, game.ui)
	add_child(fx)
	_cl = CanvasLayer.new()
	_cl.layer = 60
	game.add_child(_cl)
	var bg := ColorRect.new()
	bg.color = Color.BLACK
	bg.set_anchors_preset(Control.PRESET_FULL_RECT)
	bg.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_cl.add_child(bg)
	_card = IntroCard.new()
	_cl.add_child(_card)
	_ring_home = game.ui.skip_ring.get_parent()
	game.ui.skip_ring.reparent(_cl, false)
	_setup()
	_build()
	await _card.play_all(STANZAS, 3.0)
	if _cut or _cards_done: return
	_cards_done = true
	_end_cards()
	start()

func _end_cards() -> void:
	if _ring_home and is_instance_valid(_ring_home) and game.ui.skip_ring.get_parent() != _ring_home:
		game.ui.skip_ring.reparent(_ring_home, false)
	if is_instance_valid(_cl): _cl.queue_free()
	_cl = null

func skip() -> void:
	_cut = true
	if not _cards_done:
		_cards_done = true
		if is_instance_valid(_card): _card.skip()
		_end_cards()
		start()
	super.skip()

## (devshots) skip the cards and run the clock to t (forward only)
func dev_seek(to: float) -> void:
	if not _cards_done:
		_cards_done = true
		if is_instance_valid(_card): _card.skip()
		_end_cards()
		start()
	while to > t + 0.001: _step(minf(0.05, to - t))
	if to > 3.5: fx.fade(0.0, 0.01)          # (the opening fade runs on real time)

# ------------------------------------------------------------------ the set
func _setup() -> void:
	var p := game.player
	p.teleport(WS.LIE, WS.LIE_YAW)
	p.locked = true
	p.fig.rig.stop(0.01)
	p.fig.rig.play("lie_side", {"fade": 0.01})
	ws.pool.set_meta("cine", true)                  # (its gameplay double rests: Ione is the reflection now)
	_glass = ws.pool.planar.mat
	# Ione: her crimson double, in the water world (only the glass shows her)
	ione = Figure.new(preload("res://shaders/ghost.gdshader"))
	game.add_child(ione)
	for kv in [["project", 0.0], ["graded", 0.0], ["vis", 1.0], ["ghost", 0.0], ["ripple_amt", 1.0], ["shimmer", 0.0],
			["plane_n", Vector3.UP], ["plane_d", W]]:
		ione.set_param(kv[0], kv[1])
	ione.slim = 0.045
	ione.veil_contrary = true
	ione.set_layers(TwoWorld.HER)
	ione.rig.play("lie_side", {"fade": 0.01})
	ione.global_transform = p.fig.global_transform
	# the water goes black and still (A's prologue water), the world to the night mood
	for w in World3.waters:
		var m := w.material_override as ShaderMaterial
		var keep := {}
		for k in ["deep", "shallow", "sky", "ripple_k", "foam_k", "glint_k"]: keep[k] = m.get_shader_parameter(k)
		var black := {"deep": Color(0.02, 0.022, 0.03), "shallow": Color(0.05, 0.055, 0.065), "sky": Color(0.12, 0.13, 0.16),
			"ripple_k": 0.25, "foam_k": 0.0, "glint_k": 0.5}
		_water0.append([m, keep, black])
		for k in black: m.set_shader_parameter(k, black[k])
	game.world.set_mood("prologue", 0.01)
	# her world is dark water: the pool's reflection pass gets a black sky and a dense dark fog (deeper = fainter)
	var e: Environment = ws.pool.planar.cam.environment
	_penv = [e, e.background_color, e.fog_light_color, e.fog_depth_begin, e.fog_depth_end]
	_pool_env(0.0)

## restore the world and put every piece of it away (end or skip)
func _teardown() -> void:
	if is_instance_valid(ione): ione.queue_free()
	if is_instance_valid(warden): warden.queue_free()
	if is_instance_valid(comb): comb.queue_free()
	if is_instance_valid(_palm): _palm.queue_free()
	for c in _cards3: if is_instance_valid(c[0]): (c[0] as Node).queue_free()
	_cards3.clear()
	if _glass: _glass.set_shader_parameter("crack", 0.0)
	game.level.set_darkness(0.0)
	_pool_env(1.0)
	game.world.set_darkness(0.0)
	ws.pool.remove_meta("cine")
	fx.clear_lights(0.0 if skipping else 1.5)
	fx.letterbox(false, 0.01 if skipping else 1.0)
	fx.vignette(0.0, 0.01 if skipping else 1.2)
	fx.fade(0.0, 0.01)
	fx.dof_off(0.01)
	_end_cards()

func _water_back(k: float) -> void:
	for e in _water0:
		var m: ShaderMaterial = e[0]
		var keep: Dictionary = e[1]
		var black: Dictionary = e[2]
		for kk in keep:
			if keep[kk] == null: continue
			if keep[kk] is Color: m.set_shader_parameter(kk, (black[kk] as Color).lerp(keep[kk], k))
			else: m.set_shader_parameter(kk, lerpf(float(black[kk]), float(keep[kk]), k))

func _pool_env(k: float) -> void:
	if _penv.is_empty(): return
	var e: Environment = _penv[0]
	e.background_color = Color(0.03, 0.033, 0.04).lerp(_penv[1], k)
	e.fog_light_color = Color(0.035, 0.04, 0.05).lerp(_penv[2], k)
	e.fog_depth_begin = lerpf(1.2, _penv[3], k)
	e.fog_depth_end = lerpf(6.5, _penv[4], k)

## a transform in the water world: placed so the glass shows an upright figure at `seen` (feet), turned to `yaw`
static func seen_xf(seen: Vector3, yaw: float) -> Transform3D:
	var R := Transform3D(Basis(Vector3(1, 0, 0), Vector3(0, -1, 0), Vector3(0, 0, 1)), Vector3(0, 2.0 * W, 0))
	var Fx := Transform3D(Basis.from_scale(Vector3(-1, 1, 1)), Vector3.ZERO)
	return R * Transform3D(Basis(Vector3.UP, yaw), seen) * Fx

## a soft fog card that faces the CineCam (CineFx's card look; CineFx.dof faces the gameplay camera)
func _fog_card(pos: Vector3, size: Vector2, alpha: float, seconds := 1.2) -> ShaderMaterial:
	var mi := MeshInstance3D.new()
	var q := QuadMesh.new()
	q.size = size
	mi.mesh = q
	mi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	var m := ShaderMaterial.new()
	var sh := Shader.new()
	sh.code = CineFx.CARD_SHADER
	m.shader = sh
	m.set_shader_parameter("tint", Color(0.09, 0.095, 0.11))
	m.set_shader_parameter("alpha", 0.0)
	mi.material_override = m
	mi.layers = TwoWorld.MINE
	game.world.add_child(mi)
	_cards3.append([mi, pos, m])
	_card_to(m, alpha, seconds)
	return m

func _card_to(m: ShaderMaterial, a: float, seconds: float) -> void:
	var a0: Variant = m.get_shader_parameter("alpha")
	var tw := create_tween()
	tw.tween_method(func(v: float) -> void: m.set_shader_parameter("alpha", v), float(a0) if a0 != null else 0.0, a, maxf(seconds, 0.01))

# ------------------------------------------------------------------ per frame: Ione, the Warden, the glass, the cards
func _step(dt: float) -> void:
	super._step(dt)
	if not is_instance_valid(ione): return
	var p := game.player
	_hist.append([t, p.fig.global_transform, p.fig.pose.copy()])
	while _hist.size() > 2 and _hist[1][0] <= t - LAG: _hist.pop_front()
	if _ione_mode == "copy":
		ione.global_transform = _hist[0][1]
		ione.apply_pose(_hist[0][2])
	else:
		ione.global_transform = seen_xf(_ione_seen.origin, _ione_seen.basis.get_euler().y)
		ione.apply_pose(Figure.Pose.new())
	if is_instance_valid(warden): warden.global_transform = seen_xf(_wd_seen.origin, _wd_seen.basis.get_euler().y)
	var cam := get_viewport().get_camera_3d()
	if ws.pool.planar and cam: ws.pool.planar.update(cam, true, true)
	if cam:
		for c in _cards3:
			if is_instance_valid(c[0]):
				var mi: MeshInstance3D = c[0]
				mi.global_transform = Transform3D(cam.global_transform.basis, c[1])
				(c[2] as ShaderMaterial).set_shader_parameter("t", t)

## the heroine plays a clip now and her reflection the same clip LAG later (while Ione is the reflection)
func both(time: float, clip: String, opts := {}) -> void:
	at(time, func() -> void: game.player.fig.rig.play(clip, opts))
	at(time + LAG, func() -> void: if _ione_mode == "copy" and is_instance_valid(ione): ione.rig.play(clip, opts))

func _snd(time: float, n: String, db := 0.0, pitch := 1.0) -> void:
	at(time, func() -> void: game.sfx.play(n, db, pitch), false)

# ------------------------------------------------------------------ the shots
func _build() -> void:
	clear()
	var LIE: Vector3 = WS.LIE
	var COMB: Vector3 = WS.COMB_LAND
	var HEAD: Vector3 = Map3.OBSERVER + Vector3(0, W, 0)
	var her := LIE + Vector3(-0.35, 0.18, 0.0)            # (the lying body's middle: the hip lies off to her left)
	at(0.0, func() -> void:
		fx.letterbox(true, 0.01)
		fx.vignette(0.55, 0.01)
		fx.fade(1.0, 0.01, Color.BLACK)
		fx.fade(0.0, 3.0, Color.BLACK)
		fx.light_rig("prologue", LIE, SURF, 0.01)
		game.level.set_darkness(0.55, LIE + Vector3(0, 0.6, -0.4), 4.5)
		game.world.set_darkness(0.55)
		game.sfx.cue("cinematic_hand", -8.0))
	# 1 (0-10): down through the fog onto the black water and the back of the Observer's veiled head
	path(0.0, 10.0, [HEAD + Vector3(14.0, 30.0, 16.0), HEAD + Vector3(10.0, 12.0, 11.0), HEAD + Vector3(7.5, 3.6, 8.2)],
		[HEAD + Vector3(0, 0.0, 0), HEAD + Vector3(0, 3.0, 0), HEAD + Vector3(0, 4.2, 0)], 52.0, 38.0, 2)
	for i in 4:
		var y := 26.0 - i * 6.5
		at(0.0, func() -> void: _fog_card(HEAD + Vector3(9.0 + i * 0.5, y, 10.0 + i * 0.4), Vector2(46, 30), 0.55, 0.01))
	at(4.5, func() -> void: for c in _cards3: _card_to(c[2], 0.0, 3.5))
	_snd(1.2, "bell", -24.0, 0.6)
	_snd(6.0, "bell_far", -28.0, 0.5)
	# 2 (10-17): across the water, a low lateral dolly toward the marble threshold where she lies
	path(10.0, 7.0, [Vector3(-13.5, 0.06, 25.6), Vector3(-10.8, 0.08, 26.7), Vector3(-8.0, 0.1, 27.9)],
		[LIE + Vector3(-1.2, 0.25, 0.0), LIE + Vector3(-0.4, 0.2, 0.0)], 34.0, 30.0, 0)
	_snd(10.5, "step_wet", -26.0, 0.55)
	# 3 (17-23): overhead on her, lying: a slow 15 degree turn, descending
	var ov: Array = []
	for k in 3:
		var a := deg_to_rad(-30.0 + 7.5 * k)
		ov.append(her + Vector3(sin(a) * 0.9, 3.8 - 0.55 * k, cos(a) * 0.9))
	path(17.0, 6.0, ov, [her], 40.0, 36.0, 1)
	_snd(18.0, "step_wet", -30.0, 0.5)
	# 4 (22-25.5): her hand, the fingers move (the rise begins with them)
	both(22.0, "rise", {"fade": 0.3})
	at(22.0, func() -> void:
		var h := game.player.fig.rig.bone_world("R_Hand")          # (A: the left hand lies under her veil)
		path(22.0, 3.5, [h + Vector3(1.0, 0.55, 1.3), h + Vector3(0.92, 0.5, 1.2)], [h + Vector3(0, 0.02, 0)], 16.0, 15.0))
	_snd(22.4, "glass_tink", -26.0, 1.6)
	at(22.4, func() -> void: fx.finger_glints(game.player.fig.rig), false)
	at(26.0, func() -> void: fx.joint_dust(game.player.fig.rig, 2.0), false)
	# 5 (25.5-30): low angle, craning up with her as she sits, kneels (stone grinding at the joints)
	path(25.5, 4.5, [LIE + Vector3(-1.0, 0.12, -1.5), LIE + Vector3(-1.1, 0.5, -1.7)],
		[LIE + Vector3(0, 0.35, 0), LIE + Vector3(0, 0.75, 0)], 44.0, 40.0)
	_snd(26.0, "grind", -18.0, 0.55)
	_snd(27.6, "grind", -20.0, 0.62)
	at(26.0, func() -> void: if game.juice: game.juice.dust_floor(LIE + Vector3(0, 0.1, 0), 0.4, 10))
	# 6 (30-37): over the pool, three-quarter: she stands; in the water her reflection rises half a second late, in
	# crimson; she looks at her hands, and so does it, late (one lyre note)
	path(30.0, 7.0, [LIE + Vector3(-2.4, 0.9, -3.4), LIE + Vector3(-2.0, 0.75, -2.9)],
		[LIE + Vector3(0.0, -0.1, -0.8), LIE + Vector3(0.0, -0.05, -0.7)], 40.0, 34.0)
	both(32.6, "look_hands")
	at(31.2, func() -> void: game.sfx.note("A", -12.0), false)
	# 7 (37-43): looking down on the surface: a crimson palm presses up from beneath, and knocks twice
	at(36.9, func() -> void:
		_ione_mode = "seen"
		_ione_seen = Transform3D(Basis(Vector3.UP, PI), I_SEEN)
		ione.rig.stop(0.01)
		ione.rig.play("refl_press", {"at": SURF, "n": Vector3.DOWN, "hold": true})
		ione.rig.look_at_point(game.player.global_position + Vector3(0, 0.8, 0), 0.6)
		game.player.fig.rig.look_at_point(SURF, 0.8))
	path(37.0, 6.0, [SURF + Vector3(1.15, 2.15, -0.15), SURF + Vector3(1.0, 1.95, -0.2)], [SURF + Vector3(-0.05, -0.4, -0.05)], 44.0, 38.0)
	at(37.6, func() -> void: _palm = OmenFx.palm_press(game.juice, SURF + Vector3(0, 0.01, 0), PI, ws.pool_fx, 2))
	at(36.95, func() -> void:
		ione.rig.clip_event.connect(func(c: String, ev: String) -> void:
			if c == "refl_press" and ev.begins_with("tap") and not skipping:
				game.sfx.play("glass_tink", -10.0, 0.9)
				fx.shake("taps", 0.4)))
	# 8 (43-50): from the side, pushing in: she kneels at the lip and reaches for the palm (Ione's four notes)
	at(43.0, func() -> void: game.player.fig.rig.play("kneel_reach", {"at": SURF + Vector3(0, 0.02, 0.06), "n": Vector3.UP, "hold": true}))
	path(43.0, 7.0, [LIE + Vector3(2.6, 0.55, -0.7), LIE + Vector3(1.9, 0.45, -0.55)], [LIE + Vector3(-0.1, 0.2, -0.55)], 40.0, 34.0)
	at(44.6, func() -> void: game.sfx.motif(-11.0, 0.5), false)
	# 9 (50-59): through the surface: behind her, in the water, the Glass Warden rises; cracks race over the water,
	# the light dims (the focus racks from her to him: a haze card over him lifts, one settles before her)
	at(49.5, func() -> void:
		warden = WardenRig.new()
		game.add_child(warden)
		warden.set_look("glass")
		warden.glass_param("clip_y", -1000.0)
		warden.glass_param("rise", 0.0)
		TwoWorld.set_her(warden)
		_wd_seen = Transform3D(Basis(Vector3.UP, PI), WD_SEEN + Vector3(0, -2.0, 0)))
	anim(50.0, 5.5, func(k: float) -> void: _wd_seen.origin = WD_SEEN + Vector3(0, -2.0 * (1.0 - k), 0), 2)
	anim(50.0, 6.0, func(k: float) -> void: if is_instance_valid(warden): warden.glass_param("rise", k))
	anim(51.5, 5.0, func(k: float) -> void: if _glass: _glass.set_shader_parameter("crack", 0.55 * k), 3)
	at(50.2, func() -> void:
		game.sfx.play("glass", -8.0, 0.4)
		fx.lights_to(0.45, 4.0)
		fx.shake("rumble", 0.5, 4.0), false)
	at(54.0, func() -> void: game.sfx.play("hollow", -10.0, 0.6), false)
	path(50.0, 9.0, [SURF + Vector3(2.3, 0.95, -0.7), SURF + Vector3(2.0, 0.85, -0.55)], [SURF + Vector3(-0.2, -0.75, -0.3), SURF + Vector3(-0.35, -0.85, -0.55)], 46.0, 40.0)
	at(50.0, func() -> void: _fog_card(SURF + Vector3(-0.3, -1.6, -1.4), Vector2(4, 3), 0.0, 0.01))
	# 10 (59-65): a glass hand on her shoulder; she turns her oval to us, a moment; the melody breaks off
	at(58.6, func() -> void:
		warden.grab(func() -> Vector3: return ione.rig.bone_world("R_Upperarm") + Vector3(0, 0.03, 0) if is_instance_valid(ione) else Vector3.ZERO, "R", 1.0))
	path(59.0, 6.0, [SURF + Vector3(1.25, 0.62, -0.25), SURF + Vector3(1.15, 0.6, -0.22)], [SURF + Vector3(-0.15, -0.55, -0.45)], 40.0, 36.0)
	at(59.6, func() -> void:
		game.sfx.play("glass_tink", -8.0, 0.5)
		ione.rig.look_at_point(get_viewport().get_camera_3d().global_position, 1.0))
	at(60.0, func() -> void: game.sfx.stop_cue("cinematic_hand", 0.4), false)
	# 11 (65-71): he drags her down into the mist of the water: whip in, then back; she recoils on the lip
	at(65.0, func() -> void:
		ione.rig.play("refl_dragged", {"hold": true})
		game.player.fig.rig.play("recoil", {"hold": true})
		fx.flash(Color(0.75, 0.05, 0.08), 0.45, 0.05, 1.0)
		fx.shake("crack", 1.0)
		game.sfx.play("whoosh", -6.0, 0.5)
		game.sfx.play("glass", -6.0, 0.3)
		if is_instance_valid(_palm): OmenFx.fade_out(_palm, 0.5)
		for c in _cards3: _card_to(c[2], 0.75, 1.6))
	anim(65.0, 2.6, func(k: float) -> void:
		var d := Vector3(0, -2.6 * k * k, -0.6 * k)
		_ione_seen.origin = I_SEEN + d
		_wd_seen.origin = WD_SEEN + d * 1.05, 0)
	path(65.0, 0.9, [SURF + Vector3(1.15, 0.6, -0.22), SURF + Vector3(0.6, 0.38, -0.2)], [SURF + Vector3(-0.15, -0.55, -0.45), SURF + Vector3(-0.1, -0.9, -0.5)], 36.0, 28.0, 3)
	path(65.9, 5.1, [SURF + Vector3(0.6, 0.38, -0.2), SURF + Vector3(2.6, 2.0, -1.6)], [SURF + Vector3(-0.1, -0.9, -0.5), SURF + Vector3(-0.4, -0.5, -0.6)], 28.0, 48.0, 2)
	at(68.0, func() -> void:
		if is_instance_valid(warden): warden.visible = false
		ione.visible = false)
	anim(67.0, 4.0, func(k: float) -> void: if _glass: _glass.set_shader_parameter("crack", 0.55 * (1.0 - k)))
	# 12 (71-77): something comes UP through the surface and clinks on the marble: a shell comb (slow)
	at(71.0, func() -> void:
		comb = Kit3.comb(game)
		game.juice.add_child(comb)
		PassThrough.water(game.juice, SURF + Vector3(0.3, 0.0, 0.02), comb, ws.pool_fx, 0.42, 2.6, COMB)
		fx.hero_item(comb)
		for c in _cards3: _card_to(c[2], 0.0, 3.0))
	# (it lands at 74.1: the view is on its landing by then, and holds there)
	path(71.0, 3.1, [SURF + Vector3(1.4, 0.75, -0.3), SURF + Vector3(1.05, 0.82, 0.0)], [SURF + Vector3(0.3, 0.15, 0.0), SURF + Vector3(0.3, 0.4, 0.1), COMB + Vector3(0, 0.05, 0)], 32.0, 29.0)
	path(74.1, 2.9, [SURF + Vector3(1.05, 0.82, 0.0), SURF + Vector3(0.95, 0.85, 0.1)], [COMB + Vector3(0, 0.05, 0)], 29.0, 28.0)
	at(74.1, func() -> void:          # (A: PassThrough lands it at 71.0 + 2.6 + 0.5)
		fx.droplet_crown(COMB)
		game.sfx.play("glass_tink", -8.0, 1.6)
		game.sfx.play_later("glass_tink", 0.18, -16.0, 1.75), false)
	# 13 (77-83): wide and still: the pool shows only her now, half a second late. She is still there, hidden.
	at(76.4, func() -> void:
		_ione_mode = "copy"
		_hist.clear()
		ione.visible = true
		ione.rig.stop(0.01)
		ione.rig.look_at_point(Vector3.INF)
		ione.rig.play("recoil", {"from": 1.4, "hold": true, "fade": 0.01})
		var e: Environment = ws.pool.planar.cam.environment
		e.fog_depth_begin = 4.0
		e.fog_depth_end = 18.0
		game.player.fig.rig.look_at_point(Vector3.INF)
		fx.lights_to(0.8, 3.0))
	at(77.0, func() -> void: game.player.fig.rig.release())
	at(77.5, func() -> void: if is_instance_valid(ione): ione.rig.release())
	path(77.0, 6.0, [LIE + Vector3(-3.4, 1.3, -5.6), LIE + Vector3(-3.3, 1.25, -5.4)], [LIE + Vector3(0, -0.2, -0.4)], 44.0, 42.0)
	# 14 (83-90): she takes the comb; it glows; the first path lights; the camera cranes back onto the play view
	at(83.0, func() -> void: if is_instance_valid(comb): fx.hero_item(comb, 0.0), false)
	at(83.0, func() -> void:
		var pr := game.player
		var to := COMB - pr.position
		pr.yaw = atan2(-to.x, -to.z)
		pr.fig.rotation.y = pr.yaw
		pr.fig.rig.play("pickup", {"at": COMB + Vector3(0, 0.03, 0)})
		game.world.snap_to(pr.position))
	both(83.0, "pickup", {"at": COMB + Vector3(0, 0.03, 0)})
	at(84.0, func() -> void:
		if is_instance_valid(comb): comb.queue_free()
		if game.juice: game.juice.glint(game.player.position + Vector3(0, 0.7, 0))
		ws.light_path())
	at(84.1, func() -> void:
		game.ui.show_item("comb", "")
		game.sfx.resolve(1), false)
	at(84.5, func() -> void:
		game.world.set_mood("act1", 5.0)
		fx.vignette(0.0, 4.0)
		fx.clear_lights(3.0))
	anim(84.5, 5.0, func(k: float) -> void:
		_water_back(k)
		_pool_env(k))
	at(83.0, func() -> void:
		game.world.snap_to(game.player.position)
		var fr := _gameplay_frame(30.0)
		path(83.0, 3.5, [LIE + Vector3(-2.2, 1.0, 3.2), (fr[0] as Vector3).lerp(fr[1], 0.35)], [LIE + Vector3(0, 0.45, 0), fr[1]], 40.0, 30.0))
	anim(84.0, 4.0, func(k: float) -> void:
		game.level.set_darkness(0.55 * (1.0 - k), LIE + Vector3(0, 0.6, -0.4), 4.5)
		game.world.set_darkness(0.55 * (1.0 - k)))
	handoff(86.5, 3.0)
	at(87.0, func() -> void: fx.letterbox(false, 2.5))
	at(89.6, func() -> void:
		_water_back(1.0)
		_teardown())
