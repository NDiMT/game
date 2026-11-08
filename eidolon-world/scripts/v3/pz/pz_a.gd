extends Puzzle
## I.6 "The Atrium of a Thousand Faces" (CH1_V3 §1 #8, the hub): his attempts on plinths (A's "atrium" dressing), a
## dry fountain with a little still water in its bowl, three dead Beacons (one by each wing's road). The roads are
## barred until phase 3 opens them (beyond the bars the road runs on into the fog: a tease); the Veiled Way south is
## shut until the three Beacons burn (Act 3). The first time you come to the fountain with the Lamp: she stands in
## its water, looks at you, then turns her head to the WEST (a suggestion, not an order). Done = that gaze.

const FOUNT := Vector3(0.0, 0.88, 0.0)
## the three wings' road mouths (+ the Veiled Way): [to, beacon spot or null]
const ROADS := {"WR": Vector3(-8.35, 0.0, -2.5), "N1": Vector3(2.5, 0.0, -8.35), "ER": Vector3(8.35, 0.0, -2.5), "VW": null}
var fount: Reflector
var beacons := {}               # road -> BeaconFire
var _bars := {}                 # road -> [Node3D, obstacle name]
var _gaze_t := -1.0
var _pose := Figure.Pose.new()
var roads_open := false

func build() -> void:
	jingle = false
	hint_after = 1.0e9
	var lv := game.level
	var col := Color(0.5, 0.25, 0.0)
	var pm := MB.new()
	for k in ROADS:
		var d := Map3.door("A", k)
		var c: Vector2 = d["c"]
		var n: Vector2 = d["n"]
		var along_z := absf(n.x) > 0.5
		var w: float = d["w"]
		var at := Vector3(c.x + n.x * 0.35, 0.0, c.y + n.y * 0.35)
		var b := Kit3.bars(game, self, at, w + 0.2, along_z)
		var r := Rect2(at.x - (0.12 if along_z else w * 0.5), at.z - (w * 0.5 if along_z else 0.12), 0.24 if along_z else w, w if along_z else 0.24)
		lv.ob_rect(r, "a_road_" + k)
		_bars[k] = [b, "a_road_" + k]
		if ROADS[k] != null:
			var p: Vector3 = ROADS[k]
			pm.cyl(p + Vector3(0, 0.55, 0), 0.26, 0.32, 1.1, col, 12)
			pm.cyl(p + Vector3(0, 1.17, 0), 0.38, 0.22, 0.16, Color(0.5, 0.9, 0.0), 14)
			lv.ob_circle(Vector2(p.x, p.z), 0.38)
	Kit3.marble(game, pm.commit(), self)

func post() -> void:
	for k in ROADS:
		if ROADS[k] == null: continue
		var f := BeaconFire.new()
		f.noise = game.level.noise_tex
		add_child(f)
		f.position = (ROADS[k] as Vector3) + Vector3(0, 1.22, 0)
		beacons[k] = f
	fount = TwoWorld.still_water(self, game, FOUNT, Vector2(0.75, 0.75), Rect2(FOUNT.x - 3.4, FOUNT.z - 3.4, 6.8, 6.8), 0.5)
	(game.get("ch") as Ch1v3).add_refl(fount)

## (phase 3 / tests) the wing roads open (the Veiled Way stays for the Beacons)
func open_roads(on: bool) -> void:
	roads_open = on
	for k in _bars:
		var open := on if k != "VW" else on and Game.autotest
		var b: Node3D = _bars[k][0]
		game.level.set_enabled(_bars[k][1], not open)
		b.visible = not open

## the first time at the fountain, with her Lamp: she looks at you, then West
func tick(dt: float) -> void:
	var p := game.player.position
	if _gaze_t < 0.0:
		if not done and game.mode == "play" and game.call("has_item", "lamp") and Vector2(p.x - FOUNT.x, p.z - FOUNT.z).length() < 2.6:
			_gaze_t = 0.0
			fount.hold = true
			fount.hold_k = 1.0
			if game.sfx: game.sfx.cue("glimpse", -8.0)
		return
	_gaze_t += dt
	var to_you := atan2(p.x - FOUNT.x, p.z - FOUNT.z)
	var west := atan2(-1.0, 0.0)
	var k := smoothstep(1.4, 3.0, _gaze_t)
	_pose.head_yaw = lerp_angle(0.0, wrapf(west - to_you, -PI, PI), k) * 0.9
	_pose.breath = 0.5
	fount.hold_pose = _pose
	fount.hold_xf = Transform3D(Basis(Vector3.UP, to_you), FOUNT + Vector3(0, 0.01, 0))
	if _gaze_t > 3.2 and not done:
		solve()
		var bw: Node3D = _bars["WR"][0]
		if game.juice: game.juice.glint(bw.global_position + Vector3(0, 1.4, 0))
	if _gaze_t > 6.0:
		fount.hold = false
		_gaze_t = -1.0

func apply() -> void:
	super.apply()
	_gaze_t = -1.0
	if fount: fount.hold = false
	open_roads(roads_open)

func autosolve() -> void:
	if not game.call("has_item", "lamp"): game.call("give", "lamp", false)
	game.cmd("walk:%f:%f" % [FOUNT.x + 1.6, FOUNT.z + 1.6])
