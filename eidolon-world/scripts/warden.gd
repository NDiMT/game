class_name Warden
extends Node3D
## v1.0 M3c (dev/V1_WORLD.md 5): the Glass Warden, Theron, seen only in glass.
##  * Sightings: now and then, while your back is to a great mirror, he stands BEHIND you in it (a figure on
##    LAYER_DOUBLE: the planar reflection sees him, the camera never does). A cold sting; he is gone when you
##    turn, step away, or after a few seconds.
##  * The Mirror Walk patrol: past the sealed panel, a long glass (two real planar mirrors) runs along the
##    Walk's east side. He walks the Walk itself, but only the glass shows him: his reflection paces it. While he faces you, keep to a pillar's shadow (or the Spring's gap, where there is
##    no glass); cross while he looks away. Seen: the glass rings, a sigh, and you are back at the Walk's
##    start. No death, no fail screen. A mist gathers on the glass where he will look next.
##    Once you have crossed (reached the lift) he leaves the Walk.
## Figure: A's WardenRig (scripts/warden_rig.gd, assets/models/warden_rigged.glb), on LAYER_DOUBLE only.

const PACE := 2.0                          # (his clip, quickened: he keeps a beat you can cross)
const GLASS_H := 2.6
# the Walk
const GLASS_X := 32.75
const FIG_X := 31.95                        # (he walks the Walk itself: only the glass shows him)
const WALK_X := Vector2(30.3, 32.5)
const WALK_Y := 4.0
const START_Z := -25.4                      # the Walk's start (north of the panel)
const END_Z := -43.6                        # the lift: crossed
const PATROL := Vector2(-43.0, -26.0)       # his beat along the glass (z)
const PAUSE := 2.0
const SIGHT := 8.0
const PILLARS := [-28.6, -36.8, -40.6]
const SHADOW := 0.6
const SPRING_GAP := Vector2(-33.4, -30.6)   # no glass there
const PANES := [Vector2(-44.3, -33.6), Vector2(-30.4, -24.9)]

var game: Game
var chapter: Chapter
var patrol_fig: WardenRig
var ghost_fig: WardenRig                   # (sightings, in reflections only)
var glasses: Array[Reflector] = []
var mist: MeshInstance3D
var mist_mat: ShaderMaterial
var wz := -43.0                            # his place on the beat
var facing := 1.0                          # +1: facing south (+z), -1: north
var _pause := 0.0
var caught := 0
var _catch_t := 0.0
var active := false
# sightings
var sight_on := false
var _sight_t := 0.0
var _sight_cool := 40.0
var _sight_wait := 0.0
var _sight_from := Vector3.ZERO
var sightings := 0

func setup(g: Game, ch: Chapter) -> void:
	game = g
	chapter = ch
	_build_walk()
	patrol_fig = _figure()
	ghost_fig = _figure()
	ghost_fig.visible = false

## his figure: A's WardenRig (the rigged model, its walk / idle, a head that turns toward a point), drawn ONLY
## on LAYER_DOUBLE: the planar reflections see him, the camera never does
func _figure() -> WardenRig:
	var w := WardenRig.new()
	w.reflection = true                       # (A: dark, a faint crimson rim, unshaded: he reads the same in every glass)
	w.visible = false                         # (QA P1-2: never at the title, never outside a glass)
	add_child(w)
	for c in w.find_children("*", "MeshInstance3D", true, false):
		var mi := c as MeshInstance3D
		mi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
		mi.layers = PlanarMirror.LAYER_DOUBLE
	if w.anim: w.anim.speed_scale = PACE
	return w

# ------------------------------------------------------------------ the Mirror Walk: glass, pillars, mist
func _build_walk() -> void:
	for p in PANES:
		var L: float = p.y - p.x
		var gc := Vector3(GLASS_X, WALK_Y + 0.12 + GLASS_H * 0.5, (p.x + p.y) * 0.5)
		var gsize := Vector2(L - 0.2, GLASS_H)
		# a real planar mirror (like the Scales' glass): you, and him, in it
		var mm := game.puzzles._mirror_quad(gc, Basis(Vector3.UP, -PI * 0.5), gsize, false, 1.0)
		mm.set_shader_parameter("ncols", 0)
		mm.set_shader_parameter("floor_y", WALK_Y)
		var pm := PlanarMirror.new()
		add_child(pm)
		pm.setup(Vector3.LEFT, -GLASS_X + 0.01, mm, game.world.env)
		pm.cam.far = 30.0
		pm.res_k = 0.6
		var r := Reflector.new()
		r.kind = "mirror"; r.plane_n = Vector3.LEFT; r.plane_d = -GLASS_X + 0.02
		r.clip_c = gc; r.clip_u = Vector3.BACK; r.clip_v = Vector3.UP; r.clip_h = gsize * 0.5
		r.region = Level.R(WALK_X.x, p.x - 2.0, WALK_X.y, p.y + 1.5)
		r.planar = pm
		game.puzzles._add_refl(r)
		glasses.append(r)
		# its frame: carved marble, a sill, posts and a cornice (not a black line)
		var fm := MB.new()
		fm.box(Vector3(GLASS_X + 0.04, WALK_Y + 0.06, gc.z), Vector3(0.24, 0.12, L), Color(0.5, 0.25, 0.0))
		fm.box(Vector3(GLASS_X + 0.04, WALK_Y + 0.2 + GLASS_H, gc.z), Vector3(0.28, 0.16, L + 0.1), Color(0.5, 0.25, 0.0))
		fm.box(Vector3(GLASS_X + 0.1, WALK_Y + 0.12 + GLASS_H * 0.5, gc.z), Vector3(0.08, GLASS_H, L), Color(0.5, 0.25, 0.0))     # (its silvered back)
		for z in [p.x + 0.07, p.y - 0.07]: fm.box(Vector3(GLASS_X + 0.04, WALK_Y + 0.12 + GLASS_H * 0.5, z), Vector3(0.22, GLASS_H + 0.1, 0.14), Color(0.5, 0.25, 0.0))
		game.puzzles.marble_instance(fm.commit(), self)
	# the pillars whose shadows hide you from the glass
	var pm := MB.new()
	for z in PILLARS:
		pm.cyl(Vector3(32.12, WALK_Y + 1.3, z), 0.17, 0.2, 2.6, Color(0.5, 0.25, 0.0), 12)
		pm.box(Vector3(32.12, WALK_Y + 2.66, z), Vector3(0.5, 0.12, 0.5), Color(0.5, 0.25, 0.0))
		game.level.ob_circle(Vector2(32.12, z), 0.24)
	game.puzzles.marble_instance(pm.commit(), self)
	# their shadows on the floor (darker bands from the pillar to the walk's west edge)
	var sm := StandardMaterial3D.new()
	sm.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	sm.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	sm.albedo_color = Color(0.08, 0.1, 0.16, 0.4)          # (QA P1-3: the safe places read at a glance)
	for z in PILLARS:
		var q2 := QuadMesh.new()
		q2.size = Vector2(1.9, SHADOW * 2.0)
		var s := MeshInstance3D.new()
		s.mesh = q2
		s.material_override = sm
		s.transform = Transform3D(Basis(Vector3.RIGHT, -PI * 0.5), Vector3(31.2, WALK_Y + 0.012, z))
		s.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
		add_child(s)
	# the mist where he will look next
	mist_mat = ShaderMaterial.new()
	mist_mat.shader = preload("res://shaders/mist_veil.gdshader")
	mist_mat.set_shader_parameter("noise_tex", game.level.noise_tex)
	mist_mat.set_shader_parameter("density", 0.0)
	mist_mat.set_shader_parameter("glow", 0.1)
	var mq := QuadMesh.new()
	mq.size = Vector2(2.4, 2.2)
	mist = MeshInstance3D.new()
	mist.mesh = mq
	mist.material_override = mist_mat
	mist.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	mist.layers = PlanarMirror.LAYER_MAIN_FX
	add_child(mist)

func in_shadow(z: float) -> bool:
	if z > START_Z - 0.2 or z < END_Z: return true
	if z > SPRING_GAP.x and z < SPRING_GAP.y: return true
	for pz in PILLARS:
		if absf(z - pz) < SHADOW: return true
	return false

func on_walk(p: Vector3) -> bool:
	return p.x > WALK_X.x and p.x < WALK_X.y and absf(p.y - WALK_Y) < 0.3 and p.z < START_Z + 0.8 and p.z > END_Z - 1.0

## he faces you: you are ahead of him along his beat, close enough, out of every shadow
func sees(p: Vector3) -> bool:
	if not active or not on_walk(p) or in_shadow(p.z): return false
	var ahead := (p.z - wz) * facing
	return ahead > 0.0 and ahead < SIGHT

## (his head turns toward you a moment before he sees you)
func sees_soon(p: Vector3) -> bool:
	if not active or not on_walk(p): return false
	var ahead := (p.z - wz) * facing
	return ahead > 0.0 and ahead < SIGHT + 2.0

func looking_away_from(z: float) -> bool:
	return (z - wz) * facing <= 0.0

func _update_patrol(dt: float) -> void:
	var hs: Dictionary = chapter.state["hub"]
	active = hs.get("e_open", false) and not hs.get("wk_crossed", false)
	patrol_fig.visible = active
	if not active:
		mist_mat.set_shader_parameter("density", 0.0)
		return
	var p := game.player.position
	if on_walk(p) and p.z < END_Z: hs["wk_crossed"] = true
	if game.satchel and (game.satchel.is_open or game.satchel.map_open):     # (QA P2-1: the world waits under the card)
		patrol_fig.walk(false)
		return
	if _pause > 0.0:
		_pause -= dt
		patrol_fig.walk(false)
		if _pause <= 0.0: facing = -facing
	else:
		wz += facing * patrol_fig.walk_speed() * PACE * dt
		patrol_fig.walk(true)
		if wz >= PATROL.y or wz <= PATROL.x:
			wz = clampf(wz, PATROL.x, PATROL.y)
			_pause = PAUSE
	patrol_fig.position = Vector3(FIG_X, WALK_Y, wz)
	patrol_fig.look_at_point(p + Vector3(0, 0.9, 0) if sees_soon(p) else Vector3.INF)
	var turning := clampf(1.0 - _pause / PAUSE, 0.0, 1.0) if _pause > 0.0 else 0.0
	var f := -facing if (_pause > 0.0 and turning > 0.5) else facing
	patrol_fig.rotation.y = 0.0 if f > 0.0 else PI
	# the mist on the glass: ahead of where he is looking, thick while he is about to turn
	var look := -facing if _pause > 0.0 else facing
	mist.transform = Transform3D(Basis(Vector3.UP, -PI * 0.5), Vector3(GLASS_X - 0.05, WALK_Y + 1.3, clampf(wz + look * 3.0, PANES[0].x, PANES[1].y)))
	var dens := 0.25 + (0.35 if _pause > 0.0 else 0.0)
	if chapter.hub.has_item("lamp") and mist.position.distance_to(p) < 3.5: dens *= 0.3     # (the lamp keeps his mist back)
	mist_mat.set_shader_parameter("density", dens)
	# seen
	if _catch_t > 0.0:
		_catch_t -= dt
		return
	if game.mode == "play" and sees(p):
		_catch()

func _catch() -> void:
	caught += 1
	_catch_t = 2.2
	chapter.state["hub"]["warden_seen"] = int(chapter.state["hub"].get("warden_seen", 0)) + 1
	chapter.event.emit("warden_seen", null)
	game.controls.block(1600)
	var tw := create_tween()
	tw.tween_callback(func() -> void: game.ui.fade_to(1.0, 0.6))
	tw.tween_interval(0.75)
	tw.tween_callback(func() -> void:
		game.auto_target = Vector3.INF
		game.player.teleport(Vector3(31.4, WALK_Y, START_Z), 0.0)          # (facing north, up the Walk again)
		game.world.snap_to(game.player.position)
		game.ui.fade_to(0.0, 0.8)
		game.ui.show_text("He saw you in the glass.", game.player.position, 2.5))

# ------------------------------------------------------------------ sightings: behind you, in a great mirror
func _update_sightings(dt: float) -> void:
	if sight_on:
		_sight_t -= dt
		var pl := game.player
		var fwd := Vector3(-sin(pl.yaw), 0.0, -cos(pl.yaw))
		var to := ghost_fig.position - pl.position
		to.y = 0.0
		if _sight_t <= 0.0 or fwd.dot(to.normalized()) > 0.3 or pl.position.distance_to(_sight_from) > 2.5:
			sight_on = false
			ghost_fig.visible = false
		return
	_sight_cool -= dt
	if _sight_cool > 0.0 or game.mode != "play" or not game.visited.has("atrium"): return
	var pl2 := game.player
	var fwd2 := Vector3(-sin(pl2.yaw), 0.0, -cos(pl2.yaw))
	for r in game.puzzles.reflectors:
		if r.planar == null or not r.planar_on or r.kind != "mirror" or r in glasses: continue
		if not r.region.has_point(Vector2(pl2.position.x, pl2.position.z)): continue
		var d: float = r.plane_n.dot(pl2.position) - r.plane_d
		if d < 1.2 or d > 7.0: continue
		if fwd2.dot(r.plane_n) < 0.5 or pl2.speed01 > 0.2:          # (your back to the glass, standing)
			_sight_wait = 0.0
			continue
		# right behind your back, between you and the glass: the camera never draws him, the glass does
		# (only where his reflection is in the glass from the one view: otherwise nobody would see him)
		var at := _sight_spot(r, pl2.position, d)
		if at == Vector3.INF:
			_sight_wait = 0.0
			continue
		_sight_wait += dt
		if _sight_wait < 1.6: return
		_sight_wait = 0.0
		ghost_fig.position = at
		ghost_fig.rotation.y = atan2(r.plane_n.x, r.plane_n.z)          # (looking at you)
		ghost_fig.visible = true
		ghost_fig.walk(false)
		ghost_fig.look_at_point(pl2.position + Vector3(0, 0.9, 0))
		sight_on = true
		_sight_t = 4.5
		_sight_from = pl2.position
		_sight_cool = 150.0
		sightings += 1
		chapter.event.emit("warden_glimpse", null)
		return

## where behind you he can stand so that his reflection shows in the glass ON SCREEN (the nearest such place
## to straight behind you), or INF
func _sight_spot(r: Reflector, p: Vector3, d: float) -> Vector3:
	var cam := game.world.cam
	var cb := cam.global_transform.basis.z
	var n := r.plane_n
	var den := n.dot(cb)
	if absf(den) < 0.05: return Vector3.INF
	var side := n.cross(Vector3.UP).normalized()
	var best := Vector3.INF
	var bd := INF
	for lat in [0.0, 0.6, -0.6, 1.2, -1.2, 1.8, -1.8, 2.4, -2.4]:
		var at: Vector3 = p - n * minf(1.0, d * 0.45) + side * float(lat)
		var ok := true
		var mid := Vector3.ZERO
		for hy in [0.2, 1.0, 1.8]:
			var q: Vector3 = at + Vector3(0, hy, 0)
			if not r.seen_in_glass(q, cb): ok = false; break
			var m: Vector3 = q - 2.0 * (n.dot(q) - r.plane_d) * n
			var g: Vector3 = m + cb * ((r.plane_d - n.dot(m)) / den)
			if not cam.is_position_in_frustum(g): ok = false; break
			mid = g
		if not ok: continue
		# (well inside the glass and the screen: nearest the glass's centre, then nearest straight behind you)
		var score := (mid - r.clip_c).length() + absf(float(lat)) * 0.5
		if score < bd: bd = score; best = at
	return best

func update(dt: float) -> void:
	_update_patrol(dt)
	_update_sightings(dt)

func apply_state() -> void:
	var hs: Dictionary = chapter.state["hub"]
	if not hs.has("wk_crossed"): hs["wk_crossed"] = false
	if not hs.has("warden_seen"): hs["warden_seen"] = 0
	wz = PATROL.x
	facing = 1.0
	_pause = 0.0
	_catch_t = 0.0
	sight_on = false
	ghost_fig.visible = false
	patrol_fig.visible = false
	_sight_cool = 40.0
