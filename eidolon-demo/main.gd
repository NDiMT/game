extends Node3D
## EIDOLON demo: one flat, continuous map in a clean isometric look. Tap to walk, tap things to use them.
const Fig := preload("res://fig.gd")
const WALK := 1.25
const CAP := Vector3(1.6, 0.0, -12.5)
const PIV := Vector3(-5.9, 0.0, -13.0)
const LAMP0 := Vector3(-7.8, 0.17, -6.75)
const MX := -19.4
const MZ := -23.5
const DX := -16.3
const TEAL_D := Color("13283a")
const CRIMSON := Color("b8232f")
const FOG := Color("eab99c")
const WATER := -1.3
# the third court, "the turned ones": three statues of her on turning plinths stand at the far rim of a pool. The
# water shows each of them turned another way; she turns the real ones until each stands as the water shows it
const EX0 := -22.3
const EZ0 := -16.9
const EX1 := -13.0
const EZ1 := -9.5
const RX0 := -20.8      # its pool: long and deep enough to hold the whole reflection of all three, the last one's too
const RZ0 := -13.8
const RX1 := -13.9
const RZ1 := -11.0
const TURN_AT := [Vector3(-20.0, 0, -14.4), Vector3(-18.5, 0, -14.4), Vector3(-17.0, 0, -14.4)]     # well clear of the gate behind them
const TURN_GOAL := [1, 3, 2]      # how many quarter turns (clockwise from above) the water shows each one turned
const TURN_YAW0 := 0.0            # the way a statue faces before any turn
const WINCH_K := 1.55                       # the capstan's size: its model is one unit tall
const WINCH_HUB := Vector2(0.497, 0.731)    # where the hub of its handwheel sits in the model: out along the axle, and up
const NEAR_MARK := 2.8      # from how near the gold marks of the first two puzzles show (metres from where she would stand)
const PLAY_WALK := 1.7      # her pace in play when sent by a tap (the scripted runs keep the slower WALK); a double tap or a far-held finger makes her run
const RES_STEPS := [1.0, 0.85, 0.72, 0.6, 0.5]      # steps of 3D resolution the game falls back through when the frame rate drops
const PLAY_SIZE := 8.6      # how much of the world the view holds in play (metres across): the title shows more, and the view closes in when the game begins
const STICK := false        # how she is walked in play: false = by taps on the ground and on things (as now), true = a floating joystick and an interact button
const WORLD_DEPTH := 0.4   # how much deeper the stone of the world is than the palette says (0 = as written, 1 = far too dark)
var sea_c := Color("3c7d92")
var mist_c := Color("cdb8c6")
var water_deep := Color("2a8790")
var water_shallow := Color("79d8c6")
var bg_c := Color("2c6379")
var pals := {}
var sepia_var := 0.0
var gate_a: Node3D
var mroot: Node3D
var winch_m: Node3D
var tile_hole := Rect2()
# the court of the crane (fourth puzzle), north of the garden, behind its door
const KX0 := -22.2
const KZ0 := -40.2
const KX1 := -13.2
const KZ1 := -32.6
const WX0 := -19.45      # its pool: it lies up to the foot of the north wall
const WZ0 := -39.8
const WX1 := -14.6
const WZ1 := -34.6
const KWALL_H := 2.6
const KPIV := Vector3(-19.8, 0, -37.0)      # the crane turns here, on a round quay at the pool's west rim
const KQUAY := 1.45      # the radius of that quay
const KANG := [30.0, 0.0, -35.66]      # the ways its arm can point (degrees, from east through south): at open water, at the islet, at the door the water keeps
const KISLE := Vector3(-15.7, 0, -37.0)
const KDOOR_X := -16.85      # the door the water keeps: the arm's third way leads to the step before it
const KDOOR_H := 2.08
const BEAM_R0 := 1.5      # the timber that hangs from the arm just over the water: from here to here along the arm
const BEAM_R1 := 3.5
const BEAM_TOP := 0.25
const KSTAND := 1.0      # how far from the crane's axis she stands, under its arm, to send her reflection out
const KPOST := Vector3(-20.4, 0, -36.5)      # the crank post beside the turntable
const KSTEP := 0.7      # how far the door's step (in the water) stands out from the wall
const KGEAR := 2.17      # turns of the crank post for one of the crane
const KJIB_Y := 2.48      # the underside of the arm, where the chains hang from
const KBENCH := Vector3(-14.1, 0, -33.3)
var crane_n: Node3D
var crane_m: Node3D
var crane_i := 0
var kpin: Node3D
var kcrank: Node3D
var kcrank_bench: Node3D
var kplug: Node3D
var kdoor_m: Node3D
var kledge: Array = []
var kkey: Node3D
var kribbon: Node3D
var kglow: MeshInstance3D
var crank_on := false
var kkey_top := Vector3.ZERO      # the hand of the islet's statue: in the water the key hangs from it
var title_sub := "demo  ·  tap to begin"
var end_sub := "end of the demo  ·  tap to play again"
var old_world := true      # false in a world built by a script that extends this one: what belongs to the old courts is then left out
var pocket: Array = []      # what she carries: at most three things, each used once
var pocket_ui: Control
var carry := {}      # a thing held in a hand (hers or her reflection's): {"node", "sk", "bone", "flip"}
var khalo: MeshInstance3D
var looks := {}      # things to look at, not to use: name -> {"foot": its place on the ground, "top": its head, "lines": what there is to read or notice, "i": which comes next, "big": the sculptor's own words (shown as the lines of the story are)}
var look_n := 0
const LOOK_LINES := {      # what she notices in the things he made, by kind
	"statue_veiled_mourning": ["this one he made to grieve", "veiled, like all of them"],
	"statue_veiled_praying": ["this one he made to ask", "veiled, like all of them"],
	"statue_veiled_unfinished": ["this one holds out its hands", "he stopped before the face"],
	"statue_veiled_kneeling": ["this one he made to kneel", "it looks down into the water"],
	"observer_veiled": ["her own shape, in stone", "under the veil the face is smooth"],
	"head": ["a face he tried, and put aside", "not her face. one he wished for her"],
	"mirror": ["a mirror. it shows the court, and no one in it"],
	"shroud": ["a mirror under a cloth", "the cloth is tied on the far side"],
}
const STELE_PARTS := "stone:marble,gold:gold,dark:dark"
const QUIET := ["plinth", "winch", "bench", "crane"]      # things that show a small gold mark only when she is near
const NOMARK := ["turn1", "turn2", "turn3", "wkey", "wdoor"]      # things with no mark at all: a statue to turn, and what is seen only in the water
const AX0 := -6.5   # the first court, now wide and open around the pool
const AZ0 := -4.0
const AX1 := 3.5
const AZ1 := 5.5
const PX0 := -3.4
const PX1 := 0.6
const PZ0 := -1.0
const PZ1 := 2.4
const PED := Vector3(2.7, 0, -14.6)   # the winch of the second court's gate, on its pedestal in that court's pool
const CROSS_H := 0.06                  # how high over the water the lost crossing's stones lay: its reflection lies that deep, and her reflection walks on it
const CROSS_X := -0.4                  # the lost crossing to it: from the front rim straight into the pool along this x, then a turn east along the winch's z
const MYPL := Vector3(PX0 - 0.5, 0, -0.6)   # her own plinth: the empty one in the row at the west rim of the pool
const CX0 := -3.4   # the second court, and its pool
const CZ0 := -18.6
const CX1 := 6.0
const CZ1 := -10.0
const COVERED := false   # the second court built as "the mirror he covered" (kept aside for a later puzzle) instead of the crossing
const QX0 := -2.15 if COVERED else -1.3   # the pool of the second court
const QX1 := -0.15 if COVERED else 4.4
const QZ0 := -17.0
const QZ1 := -11.4 if COVERED else -11.6
const WALLX := -2.85   # the face of the west wall
const WALLH := 2.3
const DOORZ := -14.0   # where the door is, in the water; on the wall itself there is plain stone
const SHEET_C := Vector3(-0.75, 0.035, -13.2)   # the middle of the cloth that lies over the pool
const SHOW_CAPSTAN := false   # the old capstan of this court is out of the way: the room is about the cloth and the wall
var winch_a: Node3D
var ped_a: Node3D         # the pedestal of the winch, which rises out of the pool when the row of statues is whole
var ped_m: Node3D
var glass2: ShaderMaterial
var gate_c: Node3D         # the grille of the second court's west gate
var gate_e: Node3D         # the grille of the third court's south gate
var turn_n := []           # the turning part of each plinth, with its statue
var turn_pin := []         # the small bronze pinion beside each plinth, which turns the other way
var turn_gem := []         # the stud on each plinth's ring: red, and gold when the statue stands as the water shows
var turn_q := [0, 0, 0]    # how many quarter turns each has been given
var turned_done := false
var turn_girth := []       # for each statue, how far its marble stands out from the plinth's axis at the height of her hands, every 10 degrees round
var palm_on := false       # her palms lie flat on a surface: tgtL and tgtR are the points under them, palm_nL and palm_nR the way it faces there
var palm_nL := Vector3.RIGHT
var palm_nR := Vector3.RIGHT
var palm_gap := 0.0        # (a check) the most an arm fell short of such a point, in hand lengths
var door_a: Node3D        # the leaf of plain stone in the west wall, and the door the water shows in its place
var door_m: Node3D
var seam_a: Node3D        # the joints of the leaf: they show only once the door has been seen in the water
var door_seen := false    # the wall can be pushed only after the cloth is off and the door has been seen
var sheet: MeshInstance3D   # the cloth: a simulated sheet, played back frame by frame
var sheet_mesh: ArrayMesh
var sheet_data: PackedFloat32Array
var sheet_meta: Dictionary = {}
var sheet_uv: PackedVector2Array
var sheet_ix: PackedInt32Array
var sheet_f := 1.0          # where the cloth is in its simulation, in frames
var sheet_held := false
var her_mats: Array = []
var posing := false
var cam_focus_on := false
var cam_focus := Vector3.ZERO
var refl_mat: ShaderMaterial
var shadow_c := Vector3(0.66, 0.66, 0.86)
var hero_style := 5
var hero_src: Node3D
var H := {}
var ghost_flat: StandardMaterial3D
var walk_on := false
var yaw_v := 0.0          # how fast she is turning: her turns start and end gently
var turn_amt := 0.0       # how far she still has to turn on the spot
var pose_k := 0.0         # 0 moving as usual .. 1 held still as a statue
var rem_dist := 0.0
var floor_mats: Array = []
var rig_norm := {}
var statue_cream := true
var hero_src_yaw_note := true
var hero_real := false
var shape_file := ""
var rig_file := ""
var hero_srcs := {}
var shape_cache := {}
var shape_tex: Texture2D
var SHP := {}
var body_mats: Array = []
var hover := 0.0
var tilt_f := 0.0
var tilt_r := 0.0
var yaw_prev := 0.0
var spd_prev := 0.0
var gph := 0.0
## how she walks: no forward lean, short steps, a small sway of the hips
var GT := {"lean": 0.0, "trail": 0.06, "stride": 0.9, "arm": 0.15, "step": 0.56, "shift": 0.016, "bob": 0.009, "pelv": 0.07, "shtw": 0.04}
var gait := 0.0

## arms that reach for a point and a spine that bows, on top of whatever animation is playing
## Touch controls, as in the other Eidolon: a floating joystick (it appears where the thumb lands, on the left part
## of the screen) and a round interact button at the lower right, which shows only while something is in reach.
## The mouse arrives as touch (project setting), so a desktop drag drives the same code.
class Joy extends CanvasLayer:
	signal interact
	const JOY_R := 54.0
	const BTN_R := 36.0
	var vec := Vector2.ZERO            # the stick: screen space (x right, y down), length <= 1
	var enabled := false
	var joy_index := -1
	var joy_base := Vector2.ZERO
	var joy_knob := Vector2.ZERO
	var joy_alpha := 0.0
	var icon := ""
	var want_icon := false
	var icon_alpha := 0.0
	var press := 0.0
	var t := 0.0
	var canvas: JoyPad

	func _ready() -> void:
		layer = 6
		canvas = JoyPad.new(); canvas.ctl = self
		canvas.set_anchors_preset(Control.PRESET_FULL_RECT); canvas.mouse_filter = Control.MOUSE_FILTER_IGNORE
		add_child(canvas)

	func btn_center() -> Vector2:
		return Vector2(canvas.size.x - 66.0, canvas.size.y - 118.0)

	func show_interact(name: String) -> void:
		want_icon = name != ""
		if name != "": icon = name

	func reset() -> void:
		joy_index = -1; vec = Vector2.ZERO

	func _input(e: InputEvent) -> void:
		if not enabled: return
		if e is InputEventScreenTouch:
			var p: Vector2 = canvas.get_global_transform_with_canvas().affine_inverse() * e.position
			if e.pressed:
				if icon_alpha > 0.3 and p.distance_to(btn_center()) < BTN_R + 14.0:
					press = 1.0; interact.emit(); get_viewport().set_input_as_handled(); return
				if joy_index < 0 and p.x < canvas.size.x * 0.75:
					joy_index = e.index; joy_base = p; joy_knob = p; vec = Vector2.ZERO
			elif e.index == joy_index: reset()
		elif e is InputEventScreenDrag and e.index == joy_index:
			var p2: Vector2 = canvas.get_global_transform_with_canvas().affine_inverse() * e.position
			var off := p2 - joy_base
			if off.length() > JOY_R:      # the base follows a thumb that wanders too far
				joy_base = p2 - off.normalized() * JOY_R; off = p2 - joy_base
			joy_knob = p2
			vec = off / JOY_R
			if vec.length() < 0.12: vec = Vector2.ZERO

	func _process(dt: float) -> void:
		t += dt
		if not enabled and joy_index >= 0: reset()
		joy_alpha = move_toward(joy_alpha, 1.0 if joy_index >= 0 else 0.0, dt * (6.0 if joy_index >= 0 else 3.0))
		icon_alpha = move_toward(icon_alpha, 1.0 if (enabled and want_icon) else 0.0, dt * 4.0)
		press = move_toward(press, 0.0, dt * 4.0)
		if joy_alpha > 0.0 or icon_alpha > 0.0: canvas.queue_redraw()
		elif canvas.drawn: canvas.drawn = false; canvas.queue_redraw()

class JoyPad extends Control:
	var ctl: Joy
	var drawn := false
	const INK := Color(0.97, 0.96, 0.92)
	const CY := Color("e8525a")
	const FROST := Color(0.965, 0.95, 0.915)
	const DARK := Color(0.16, 0.13, 0.13)

	func _draw() -> void:
		if ctl == null: return
		if ctl.joy_alpha > 0.0:
			drawn = true
			var a := ctl.joy_alpha; var b := ctl.joy_base
			draw_circle(b, Joy.JOY_R + 6.0, Color(FROST, 0.12 * a))
			draw_arc(b, Joy.JOY_R, 0, TAU, 64, Color(INK, 0.55 * a), 1.2, true)
			draw_arc(b, Joy.JOY_R - 6.0, 0, TAU, 64, Color(INK, 0.16 * a), 1.0, true)
			for k in 4:
				var dir := Vector2(cos(PI * 0.5 * k), sin(PI * 0.5 * k))
				draw_line(b + dir * (Joy.JOY_R - 3.0), b + dir * (Joy.JOY_R + 4.0), Color(INK, 0.5 * a), 1.0, true)
			var kp := b + (ctl.joy_knob - b).limit_length(Joy.JOY_R)
			draw_circle(kp, 21.0, Color(FROST, 0.5 * a))
			draw_arc(kp, 21.0, 0, TAU, 40, Color(CY, 0.85 * a), 1.2, true)
			draw_circle(kp, 3.0, Color(CY, 0.8 * a))
		if ctl.icon_alpha > 0.0:
			drawn = true
			var a2 := ctl.icon_alpha; var c2 := ctl.btn_center()
			var breathe := 0.5 + 0.5 * sin(ctl.t * 2.6)
			var r := Joy.BTN_R * (1.0 + ctl.press * 0.08)
			for i in 6: draw_circle(c2, r + 4.0 + i * 3.0, Color(CY, (0.035 + 0.02 * breathe) * a2 * (1.0 - i / 6.0)))
			draw_circle(c2, r, Color(FROST, 0.72 * a2))
			draw_arc(c2, r, 0, TAU, 64, Color(CY, (0.7 + 0.25 * breathe) * a2), 1.2, true)
			draw_arc(c2, r - 5.0, 0, TAU, 64, Color(CY, 0.18 * a2), 1.0, true)
			for k in 4:
				var dv := Vector2(cos(PI * 0.5 * k), sin(PI * 0.5 * k))
				draw_line(c2 + dv * (r + 2.0), c2 + dv * (r + 8.0), Color(CY, (0.6 + 0.3 * breathe) * a2), 1.4, true)
			var s := 13.0; var col := Color(DARK, 0.92 * a2); var cy := Color(CY, a2)
			match ctl.icon:
				"turn":      # a circular arrow round a pivot
					draw_arc(c2, s * 0.82, -PI * 0.95, PI * 0.6, 32, col, 2.2, true)
					var tip := c2 + Vector2(cos(PI * 0.6), sin(PI * 0.6)) * s * 0.82
					var tg := Vector2(-sin(PI * 0.6), cos(PI * 0.6))
					draw_colored_polygon(PackedVector2Array([tip + tg * s * 0.42, tip - tg.orthogonal() * s * 0.3 - tg * s * 0.05, tip + tg.orthogonal() * s * 0.3 - tg * s * 0.05]), col)
					draw_circle(c2, s * 0.16, cy)
				"touch":     # an open hand against a pane
					draw_line(c2 + Vector2(s * 0.75, -s), c2 + Vector2(s * 0.75, s), cy, 1.4, true)
					draw_arc(c2 + Vector2(-s * 0.05, s * 0.35), s * 0.42, 0, TAU, 20, col, 1.3, true)
					for k in 4:
						var x := -s * 0.38 + k * s * 0.24
						draw_line(Vector2(c2.x + x, c2.y), Vector2(c2.x + x + s * 0.03, c2.y - s * (0.7 + (0.18 if k in [1, 2] else 0.0))), col, 1.3, true)
				"wait":      # a figure standing still between two marks
					draw_circle(c2 + Vector2(0, -s * 0.62), s * 0.22, col)
					draw_line(c2 + Vector2(0, -s * 0.35), c2 + Vector2(0, s * 0.85), col, 1.6, true)
					draw_line(c2 + Vector2(-s * 0.85, -s * 0.8), c2 + Vector2(-s * 0.85, s * 0.85), cy, 1.2, true)
					draw_line(c2 + Vector2(s * 0.85, -s * 0.8), c2 + Vector2(s * 0.85, s * 0.85), cy, 1.2, true)
				_: draw_circle(c2, s * 0.3, col)

## What she carries, drawn at the foot of the screen: up to three small slots, each with a line drawing of the thing in
## it. Nothing is shown until she has picked something up
class Pocket extends Control:
	var items: Array = []
	var seen := 0.0      # fades in with the first thing
	var pop := 0.0       # the newest thing swells for a moment
	func _process(dt: float) -> void:
		var want := 1.0 if not items.is_empty() else 0.0
		if absf(seen - want) > 0.001 or pop > 0.0:
			seen = move_toward(seen, want, dt * 2.0); pop = maxf(pop - dt * 2.2, 0.0); queue_redraw()
	func _draw() -> void:
		if seen <= 0.001: return
		var k := size.x / 720.0
		var w := 78.0 * k; var gap := 14.0 * k
		var n := 3
		var x0 := (size.x - (w * n + gap * (n - 1))) * 0.5; var y0 := size.y - 212.0 * k
		for i in n:
			var r := Rect2(x0 + i * (w + gap), y0, w, w)
			draw_style_box(_box(Color(0.06, 0.1, 0.22, 0.34 * seen), Color(1.0, 0.93, 0.78, (0.5 if i < items.size() else 0.22) * seen), k), r)
			if i >= items.size(): continue
			var c := r.get_center(); var u := w * 0.5 * (1.0 + (0.22 * pop if i == items.size() - 1 else 0.0))
			var col := Color(1.0, 0.84, 0.48, seen); var lw := 3.2 * k
			match items[i]:
				"crank":      # a square socket, an arm, a grip standing at its end
					draw_rect(Rect2(c + Vector2(-0.62, 0.18) * u, Vector2(0.3, 0.3) * u), col, false, lw)
					draw_line(c + Vector2(-0.32, 0.33) * u, c + Vector2(0.42, 0.33) * u, col, lw * 1.25)
					draw_line(c + Vector2(0.42, 0.4) * u, c + Vector2(0.42, -0.5) * u, col, lw * 1.9)
					draw_circle(c + Vector2(0.42, -0.5) * u, lw * 1.3, col)
				"key":      # a ring, a shank, two wards
					draw_arc(c + Vector2(-0.36, -0.36) * u, 0.22 * u, 0.0, TAU, 24, col, lw)
					draw_line(c + Vector2(-0.2, -0.2) * u, c + Vector2(0.5, 0.5) * u, col, lw * 1.2)
					draw_line(c + Vector2(0.5, 0.5) * u, c + Vector2(0.66, 0.34) * u, col, lw * 1.2)
					draw_line(c + Vector2(0.3, 0.3) * u, c + Vector2(0.44, 0.16) * u, col, lw * 1.2)
	func _box(fill: Color, edge: Color, k: float) -> StyleBoxFlat:
		var sb := StyleBoxFlat.new(); sb.bg_color = fill; sb.border_color = edge
		sb.set_border_width_all(int(maxf(2.0 * k, 1.0))); sb.set_corner_radius_all(int(14.0 * k)); sb.anti_aliasing = true
		return sb

class HerMod extends SkeletonModifier3D:
	var main
	var own := false     # this copy reaches for points of its own (her reflection at the winch) instead of doing as she does
	var wL := 0.0; var wR := 0.0; var tL := Vector3.ZERO; var tR := Vector3.ZERO; var bow := 0.0
	func _b(sk: Skeleton3D, n: String) -> int:
		var i := sk.find_bone("mixamorig:" + n)
		return i if i >= 0 else sk.find_bone("mixamorig_" + n)
	## A palm laid flat on a surface. p: the point of the surface under the middle of the palm, n: the way the surface
	## faces there, up: upward (all in the skeleton's own frame). The arm's two bones turn until the wrist is where that
	## asks (the elbow down and out, bent as much as the distance needs), then the hand is set against the surface:
	## fingers upward where the surface faces her, more and more forward where it runs away from her. w blends from the
	## pose the animation gave. note: she herself leaves in main.palm_gap how far short of the point an arm was
	func _palm(sk: Skeleton3D, sd: String, w: float, p: Vector3, n: Vector3, up: Vector3, note: bool) -> void:
		if w <= 0.001: return
		var bi := _b(sk, sd + "Arm"); var ci := _b(sk, sd + "ForeArm"); var hi := _b(sk, sd + "Hand")
		var mi := _b(sk, sd + "HandMiddle1"); var ii := _b(sk, sd + "HandIndex1"); var pi := _b(sk, sd + "HandPinky1")
		if bi < 0 or ci < 0 or hi < 0 or mi < 0 or ii < 0 or pi < 0: return
		var g := sk.get_bone_global_pose(bi); var s := g.origin
		var e := sk.get_bone_global_pose(ci).origin; var h := sk.get_bone_global_pose(hi).origin
		var l1 := (e - s).length(); var l2 := (h - e).length(); var hl := (sk.get_bone_global_pose(mi).origin - h).length()
		var fwd := p - s; fwd -= up * fwd.dot(up); fwd = fwd.normalized()
		var ft := fwd - n * fwd.dot(n)                       # forward, as far as it lies in the surface
		var fing := (up - n * up.dot(n) + ft * 1.6).normalized()
		var t := p + n * (hl * 0.3) - fing * (hl * 0.62)       # the wrist: back along the hand from the middle of the palm, and off the stone by the heel of the hand
		var to := t - s; var d := clampf(to.length(), absf(l1 - l2) + hl * 0.05, (l1 + l2) * 0.999); var dir := to.normalized()
		if note: main.palm_gap = maxf(main.palm_gap, (to.length() - d) / maxf(hl, 0.0001))
		var ca := clampf((l1 * l1 + d * d - l2 * l2) / (2.0 * l1 * d), -1.0, 1.0)
		var out := (sk.get_bone_global_pose(_b(sk, "LeftArm")).origin - sk.get_bone_global_pose(_b(sk, "RightArm")).origin).normalized() * (1.0 if sd == "Left" else -1.0)
		var hint := out * 0.7 - up
		var perp := hint - dir * hint.dot(dir)
		perp = perp.normalized() if perp.length() > 0.001 else -up
		var e2 := s + dir * (l1 * ca) + perp * (l1 * sqrt(maxf(1.0 - ca * ca, 0.0)))
		sk.set_bone_global_pose(bi, Transform3D(Basis(Quaternion.IDENTITY.slerp(Quaternion((e - s).normalized(), (e2 - s).normalized()), w)) * g.basis, s))
		var gf := sk.get_bone_global_pose(ci); var h2 := sk.get_bone_global_pose(hi).origin
		var aim := s + dir * d                                # (the wrist's place, or as near to it as the arm reaches)
		sk.set_bone_global_pose(ci, Transform3D(Basis(Quaternion.IDENTITY.slerp(Quaternion((h2 - gf.origin).normalized(), (aim - gf.origin).normalized()), w)) * gf.basis, gf.origin))
		# the hand: its own three axes (along the fingers, out of the palm, across it) are turned onto those the surface asks
		var gh := sk.get_bone_global_pose(hi)
		var a := (sk.get_bone_global_pose(mi).origin - gh.origin).normalized()
		var c := sk.get_bone_global_pose(ii).origin - sk.get_bone_global_pose(pi).origin
		var pn := (a.cross(c) if sd == "Left" else c.cross(a)).normalized()
		var have := Basis(a, pn, a.cross(pn)); var want := Basis(fing, -n, fing.cross(-n))
		sk.set_bone_global_pose(hi, Transform3D(Basis(Quaternion.IDENTITY.slerp((want * have.inverse()).get_rotation_quaternion(), w)) * gh.basis, gh.origin))
	func _process_modification() -> void:
		var sk := get_skeleton()
		if sk == null or main == null: return
		var la := _b(sk, "LeftArm"); var ra := _b(sk, "RightArm")
		if la < 0 or ra < 0: return
		var lean: float = bow if own else main.a_lean
		if absf(lean) > 0.001:
			var sp := _b(sk, "Spine")
			if sp >= 0:
				var axis := (sk.get_bone_global_pose(la).origin - sk.get_bone_global_pose(ra).origin).normalized()
				var g := sk.get_bone_global_pose(sp)
				sk.set_bone_global_pose(sp, Transform3D(Basis(axis, lean * 0.9) * g.basis, g.origin))
		var inv := sk.global_transform.affine_inverse()
		if main.palm_on:      # (the turned ones) palms laid on a surface: see _palm
			var ref: Skeleton3D = main.H["main"].sk if main.H.has("main") and main.H["main"].sk != null else sk
			var rinv := ref.global_transform.affine_inverse()      # every copy of her takes the pose she takes, in its own space
			_palm(sk, "Left", main.a_wL, rinv * (main.tgtL as Vector3), (rinv.basis * (main.palm_nL as Vector3)).normalized(), (rinv.basis * Vector3.UP).normalized(), sk == ref)
			_palm(sk, "Right", main.a_wR, rinv * (main.tgtR as Vector3), (rinv.basis * (main.palm_nR as Vector3)).normalized(), (rinv.basis * Vector3.UP).normalized(), sk == ref)
			return
		for side in ([["Left", wL, tL], ["Right", wR, tR]] if own else [["Left", main.a_wL, main.tgtL], ["Right", main.a_wR, main.tgtR]]):
			var w: float = side[1]
			if w <= 0.001: continue
			var bi := _b(sk, side[0] + "Arm"); var ci := _b(sk, side[0] + "ForeArm")
			if bi < 0 or ci < 0: continue
			var g2 := sk.get_bone_global_pose(bi); var c := sk.get_bone_global_pose(ci).origin
			var cur := (c - g2.origin).normalized(); var want := ((inv * (side[2] as Vector3)) - g2.origin).normalized()
			var q := Quaternion.IDENTITY.slerp(Quaternion(cur, want), w)
			sk.set_bone_global_pose(bi, Transform3D(Basis(q) * g2.basis, g2.origin))

var mist_k := 0.96
var fog_k := 1.0
var face_m: ShaderMaterial
var veil_m: ShaderMaterial
const PALS := {
	"_": ["ffffff", "ffffff", "ffffff"],
	"stone": ["f8efe1", "e8d5c5", "ada5c0"], "shade": ["ebdecc", "d7c1b1", "9c94b0"],
	"sand": ["f6e3c6", "e3c7a6", "a8959d"], "rose": ["f1dccf", "dcc0b2", "a892a4"],
	"far": ["cfcbd6", "bab5c9", "9896b4"], "far2": ["b4b3c9", "a3a1bf", "8a8aad"],
	"dark": ["5a5678", "4d4a6e", "44416a"], "lamp": ["fff3c4", "ffe7a0", "ffd884"], "crim": ["dc3d46", "bb2530", "7e1c31"],
	"teal": ["13283a", "13283a", "13283a"], "cream": ["fff3d2", "fff3d2", "fff3d2"],
	"gold": ["f0cf86", "d2a962", "94775a"], "trunk": ["a58a82", "8a6f6c", "63506a"],
	"leaf": ["9dbfa6", "76a08e", "4f7a7c"], "leaf2": ["b9d2b4", "8fb39a", "5f8a86"], "leaf3": ["aac3a4", "86a48c", "5d7d7c"],
	"dress": ["cdd0da", "b0b3c5", "8789a6"], "dress2": ["e4e5ea", "cacbd6", "9fa0b6"],
	"veil": ["f1f1f4", "d9d9e0", "acadc0"], "skin": ["fffbf5", "f0e5de", "bfb6d0"],
	"cyp": ["4a8576", "316863", "214858"], "terra": ["ecd6c6", "d6b8a8", "a08a9e"], "linen": ["f3ecdc", "ddd0bd", "a99db2"], "rope": ["c99f76", "a67d5c", "7a5e5e"], "wood": ["b98f7a", "9a7064", "6c4e5e"], "clay": ["d2603f", "ad4732", "7c302d"],
	"marble": ["fffbf5", "f0e5de", "bfb6d0"], "crim2": ["ee5a60", "cf3640", "8f2238"],
}
const SH := """shader_type spatial;
render_mode ambient_light_disabled, specular_disabled;
uniform vec3 c_top : source_color; uniform vec3 c_z : source_color; uniform vec3 c_x : source_color;
uniform vec3 fog_col : source_color;
uniform vec4 l0; uniform vec4 l1; uniform vec4 l2; uniform vec4 l3; uniform vec4 l4; uniform vec4 l5; uniform vec4 l6;
uniform float sway = 0.0; uniform float time_s = 0.0; uniform float marble = 0.0; uniform float tone_var = 0.0; uniform float rim = 0.0; uniform float flat_n = 0.0; uniform vec3 shadow_col = vec3(0.66, 0.66, 0.86); uniform float mist_k = 0.96; uniform vec3 centre; uniform float mist_r = 7.0; uniform vec3 mist_col : source_color;
varying vec3 wp; varying vec3 wn;
float h3(vec3 p){ return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453); }
float vn(vec3 p){ vec3 i = floor(p); vec3 f = fract(p); f = f * f * (3.0 - 2.0 * f);
	return mix(mix(mix(h3(i), h3(i + vec3(1, 0, 0)), f.x), mix(h3(i + vec3(0, 1, 0)), h3(i + vec3(1, 1, 0)), f.x), f.y),
		mix(mix(h3(i + vec3(0, 0, 1)), h3(i + vec3(1, 0, 1)), f.x), mix(h3(i + vec3(0, 1, 1)), h3(i + vec3(1, 1, 1)), f.x), f.y), f.z); }
float fbm(vec3 p){ return vn(p) * 0.55 + vn(p * 2.1 + 3.1) * 0.3 + vn(p * 4.3 + 7.7) * 0.15; }
float lit(vec4 l, vec3 p){ vec3 v = vec3(0.57735); vec3 d = p - l.xyz; return l.w * pow(clamp(1.0 - length(d - v * dot(d, v)) / 2.7, 0.0, 1.0), 2.0); }
void vertex(){
	vec3 w0 = (MODEL_MATRIX * vec4(VERTEX, 1.0)).xyz;
	if (sway > 0.0) { float k = sway * clamp(VERTEX.y + 0.3, 0.0, 2.0); VERTEX.x += sin(time_s * 1.2 + w0.x * 0.9 + w0.z * 0.6) * 0.035 * k; VERTEX.z += cos(time_s * 0.95 + w0.z * 0.8) * 0.025 * k; }
	wp = (MODEL_MATRIX * vec4(VERTEX, 1.0)).xyz; wn = normalize((MODEL_MATRIX * vec4(NORMAL, 0.0)).xyz);
}
void fragment(){
	vec3 n = normalize(wn);
	if (flat_n > 0.5) { n = normalize(cross(dFdx(wp), dFdy(wp))); if (dot(n, vec3(1.0)) < 0.0) n = -n; }
	float wt = max(n.y, 0.0); float wz = max(n.z, 0.0); float wx = max(n.x, 0.0);
	float s = wt * wt + wz * wz + wx * wx;
	vec3 col = c_top * wt * wt + c_z * wz * wz + c_x * wx * wx + c_x * 0.86 * (1.0 - min(s, 1.0));
	col *= mix(0.9, 1.0, clamp(smoothstep(-1.6, -0.1, wp.y) + wt, 0.0, 1.0));
	if (marble > 0.0) {
		vec3 q = wp * 1.25;
		float w = fbm(q + vec3(fbm(q * 0.6 + 11.0), 0.0, fbm(q * 0.6 + 5.0)) * 1.6);
		float vein = smoothstep(0.022, 0.0, abs(w - 0.5));
		float vein2 = smoothstep(0.012, 0.0, abs(fbm(q * 2.6 + 20.0) - 0.47));
		col = mix(col, col * vec3(0.80, 0.81, 0.91), (vein * 0.34 + vein2 * 0.16) * marble);
		col *= 1.0 + (w - 0.5) * 0.06 * marble;
		if (tone_var > 0.0) {
			float tv = fbm(wp * 0.33 + 31.0); float tv2 = fbm(wp * 0.9 + vec3(57.0, 3.0, 9.0));
			vec3 tone = mix(vec3(1.04, 1.045, 1.06), vec3(0.96, 0.92, 0.845), smoothstep(0.3, 0.7, tv));
			tone *= mix(vec3(1.0), vec3(0.975, 0.945, 0.895), smoothstep(0.52, 0.78, tv2) * 0.75);
			col *= mix(vec3(1.0), tone, tone_var);
		}
	}
	if (rim > 0.0) { float ndv = clamp(dot(n, vec3(0.57735)), 0.0, 1.0); col *= mix(1.0 - 0.2 * rim, 1.0, smoothstep(0.0, 0.55, ndv)); }
	float l = lit(l0, wp) + lit(l1, wp) + lit(l2, wp) + lit(l3, wp) + lit(l4, wp) + lit(l5, wp) + lit(l6, wp);
	col = mix(col, col * vec3(1.06, 0.97, 0.80) + vec3(0.09, 0.055, 0.0), clamp(l, 0.0, 1.0) * 0.85);
	col = mix(col, fog_col, smoothstep(-1.35, -4.6, wp.y) * 0.9);
	vec3 d3 = wp - centre; float md = length(d3 - vec3(0.57735) * dot(d3, vec3(0.57735)));
	col = mix(col, mist_col, smoothstep(mist_r * 0.8, mist_r * 1.7, md) * mist_k);
	ALBEDO = col; ROUGHNESS = 1.0;
}
void light(){
	float facing = smoothstep(0.0, 0.12, dot(NORMAL, LIGHT));
	DIFFUSE_LIGHT += mix(shadow_col, vec3(1.0), mix(1.0, ATTENUATION, facing));
}"""
const SH_WATER := """shader_type spatial;
render_mode unshaded, cull_disabled;
uniform vec3 deep : source_color; uniform vec3 shallow : source_color; uniform float time_s = 0.0;
uniform vec2 flow = vec2(0.0); uniform float vert = 0.0;
uniform vec4 rect = vec4(0.0); uniform vec3 ring0 = vec3(0.0); uniform vec3 ring1 = vec3(0.0); uniform vec3 ring2 = vec3(0.0);   // rect: the basin (x0, z0, x1, z1). ring: where a ring opens (x, z) and how wide it grows
varying vec3 wp;
void vertex(){ wp = (MODEL_MATRIX * vec4(VERTEX, 1.0)).xyz; }
void fragment(){
	vec2 p = wp.xz * 2.4 + flow * time_s;
	if (vert > 0.5) {
		p = vec2((wp.x - wp.z) * 5.0, (wp.y - (wp.x + wp.z) * 0.5) * 1.6 + time_s * 2.6);
		float w = sin(p.x * 1.7 + time_s * 0.9) * sin(p.y * 2.3 - time_s * 0.7);
		float lines = smoothstep(0.86, 0.99, sin(p.x * 3.1 + sin(p.y * 2.0 + time_s * 0.6) * 1.6) * 0.5 + 0.5);
		ALBEDO = mix(deep, shallow, 0.5 + 0.3 * w) + vec3(0.45, 0.55, 0.5) * lines * 0.55;
	} else {
		// still water in a basin: a calm swell of two near tones, a fine net of light on its floor, deeper under the
		// kerb, and slow rings that open round the lily pads. (It used to be one bold snaking line across the pool.)
		float sw = sin(wp.x * 1.3 + time_s * 0.31) * sin(wp.z * 1.7 - time_s * 0.26);
		vec3 col = mix(deep, shallow, 0.4 + 0.1 * sw);
		vec2 q = wp.xz * 5.2 + vec2(sin(wp.z * 3.1 + time_s * 0.42), cos(wp.x * 2.7 - time_s * 0.36)) * 0.55 + flow * time_s;
		float net = smoothstep(0.9, 1.0, 1.0 - abs(sin(q.x) * 0.5 + sin(q.y + sin(q.x * 0.5) * 0.9) * 0.5));
		float gap = smoothstep(-0.2, 0.5, sin(q.x * 0.37 + 1.0) * sin(q.y * 0.41 - 0.6));     // the net is broken into short strokes
		col += vec3(0.42, 0.5, 0.44) * net * gap * 0.3;
		float rings = 0.0;
		for (int i = 0; i < 3; i++) {
			vec3 c = i == 0 ? ring0 : (i == 1 ? ring1 : ring2);
			if (c.z <= 0.0) continue;
			float d = distance(wp.xz, c.xy);
			for (int k = 0; k < 2; k++) {
				float ph = fract(time_s * 0.11 + float(i) * 0.37 + float(k) * 0.5);
				rings += smoothstep(0.022, 0.0, abs(d - 0.1 - ph * c.z)) * (1.0 - ph) * (1.0 - ph);
			}
		}
		col += vec3(0.5, 0.56, 0.5) * min(rings, 1.0) * 0.36;
		if (rect.z > rect.x) {     // the water under the kerb lies in its shade, and a thin bright line runs where it meets the stone
			float e = min(min(wp.x - rect.x, rect.z - wp.x), min(wp.z - rect.y, rect.w - wp.z));
			col *= mix(0.8, 1.0, smoothstep(0.0, 0.2, e));
			col += vec3(0.5, 0.56, 0.52) * smoothstep(0.03, 0.012, e) * 0.5;
		}
		ALBEDO = col;
	}
}"""
const SH_CLOTH := """shader_type spatial;
render_mode unshaded, cull_disabled;
uniform vec3 ca : source_color; uniform vec3 cb : source_color; uniform float wave = 0.0; uniform float time_s = 0.0;
varying vec3 wn;
void vertex(){
	if (wave > 0.0) { VERTEX += NORMAL * sin(time_s * 2.2 + UV.y * 5.0 + UV.x * 2.0) * 0.04 * UV.y * wave; }
	wn = normalize((MODEL_MATRIX * vec4(NORMAL, 0.0)).xyz);
}
void fragment(){
	vec3 n = normalize(wn); if (!FRONT_FACING) n = -n;
	float sh = 0.8 + 0.2 * clamp(dot(n, normalize(vec3(-0.25, 0.7, 0.66))) * 0.5 + 0.5, 0.0, 1.0);
	ALBEDO = mix(ca, cb, UV.y) * sh;
}"""
## the glass of a standing mirror. It shows what lies before it: the ray from the eye is turned back off the glass and
## followed down to the ground before the mirror (the floor of a court, or the sea), and what the screen shows at that
## place is what the glass shows, a little cool and a little pale, with two slow glints across it.
## (It used to follow the ray step by step through the drawn picture, to catch things that stand before the mirror.
## That flickered: whether the ray met a gate pier or a post changed from frame to frame as the eye moved. The place
## on the ground is fixed in the world, so this picture holds still.)
const SH_MIRROR := """shader_type spatial;
render_mode unshaded, cull_disabled;
uniform sampler2D screen_tex : hint_screen_texture, filter_linear_mipmap, repeat_disable;
uniform float ground_y = 0.0; uniform float time_s = 0.0;
varying vec3 wp; varying vec3 wn;
void vertex(){ wp = (MODEL_MATRIX * vec4(VERTEX, 1.0)).xyz; wn = normalize((MODEL_MATRIX * vec4(NORMAL, 0.0)).xyz); }
void fragment(){
	vec3 v = -normalize(INV_VIEW_MATRIX[2].xyz);
	vec3 n = normalize(wn); if (dot(n, v) > 0.0) n = -n;
	vec3 r = reflect(v, n);
	vec3 q = wp + r * clamp((wp.y - ground_y) / max(-r.y, 0.08), 0.25, 9.0);
	vec4 cp = PROJECTION_MATRIX * (VIEW_MATRIX * vec4(q, 1.0));
	vec2 huv = cp.xy / cp.w * 0.5 + 0.5;
	vec2 inb = smoothstep(vec2(0.0), vec2(0.04), huv) * smoothstep(vec2(0.0), vec2(0.04), 1.0 - huv);   // near the edge of the screen it fades to sky, it does not pop
	float hit = inb.x * inb.y;
	vec2 wob = vec2(sin(wp.y * 9.0 + time_s * 0.7), cos(wp.x * 7.0 + time_s * 0.5)) * 0.0009;
	vec3 sky = mix(vec3(0.52, 0.74, 0.84), vec3(0.8, 0.92, 0.96), UV.y);
	vec3 c = mix(sky, textureLod(screen_tex, clamp(huv + wob, 0.0, 1.0), 1.6).rgb, hit);
	c = (c - 0.62) * 1.2 + 0.62;                                                           // silvered glass: deeper than the day it shows,
	c = mix(c, sky, 0.5 * (1.0 - smoothstep(0.15, 0.6, dot(c, vec3(0.3, 0.5, 0.2)))));     // but never a dark hole: the dark sea comes back pale,
	c = mix(c, sky, 0.14 + 0.2 * smoothstep(0.4, 1.0, UV.y)) * vec3(0.8, 0.91, 0.98);      // cooler, and paler towards its head
	vec2 e = min(UV, 1.0 - UV);
	c *= 0.8 + 0.2 * smoothstep(0.0, 0.07, min(e.x * 2.2, e.y));                           // the frame's shadow round the edge
	float d = UV.x * 0.62 - UV.y * 0.5 + time_s * 0.012;
	float g = smoothstep(0.085, 0.07, abs(fract(d) - 0.42)) * 0.13 + smoothstep(0.022, 0.014, abs(fract(d) - 0.6)) * 0.2;
	ALBEDO = c + vec3(g);
}"""
## the cloth over the pool: its folds come from a simulation, so the shader only has to light them
const SH_SHEET := """shader_type spatial;
render_mode unshaded, cull_disabled;
uniform sampler2D albedo_tex : source_color, filter_linear_mipmap;
uniform vec3 base : source_color = vec3(0.8, 0.36, 0.25); uniform float mean_l = 0.2;
varying vec3 wn;
void vertex(){ wn = normalize((MODEL_MATRIX * vec4(NORMAL, 0.0)).xyz); }
void fragment(){
	vec3 n = normalize(wn); if (!FRONT_FACING) n = -n;
	float ndl = clamp(dot(n, normalize(vec3(-0.5, 0.52, 0.6))), 0.0, 1.0);    // a low light, so that it rakes the folds
	float sh = 0.5 + 0.62 * ndl;
	sh *= mix(0.74, 1.0, smoothstep(0.2, 0.9, abs(n.y)));   // the steep sides of a fold lie in its own shade
	// the colour is her own terracotta; the painted cloth gives only its light and dark, the creases it was made with
	float d = clamp(dot(texture(albedo_tex, UV).rgb, vec3(0.3333)) / mean_l, 0.5, 1.45);
	ALBEDO = base * mix(1.0, d, 0.85) * sh;
}"""
## the reflection, drawn as a soft dark shape lying on the water: every vertex is mirrored in the
## water plane and slid along the view direction until it meets the surface
const SH_REFL := """shader_type spatial;
render_mode unshaded, cull_disabled;
uniform float water_y = -1.3; uniform float time_s = 0.0; uniform vec3 tint = vec3(0.04, 0.12, 0.2); uniform float strength = 1.0;
uniform float lift = 0.0; uniform float use_tex = 0.0; uniform float vcol = 0.0; uniform float gain = 1.5; uniform float fade_a = 1.0; uniform sampler2D albedo_tex : source_color, filter_linear_mipmap;
uniform vec3 under_col = vec3(0.17, 0.39, 0.47);
varying float hh; varying vec3 q;
void vertex(){
	vec3 w = (MODEL_MATRIX * vec4(VERTEX, 1.0)).xyz;
	float h = max(w.y - water_y, 0.0); hh = w.y - water_y;
	vec3 f = -normalize(INV_VIEW_MATRIX[2].xyz);
	vec3 p = vec3(w.x, water_y - h, w.z) + f * (h / min(f.y, -0.05));
	float k = clamp(h * 0.45, 0.0, 1.6);
	p.x += (sin(p.z * 2.3 + time_s * 1.2) + 0.5 * sin(p.z * 6.1 - time_s * 1.7)) * 0.05 * k;
	p.z += (sin(p.x * 2.1 + time_s * 1.0) + 0.5 * sin(p.x * 5.3 + time_s * 1.5)) * 0.05 * k;
	p.y = water_y - 0.015 + lift - min(h, 8.0) * 0.0006; q = p;   // low parts lie over high ones, always: no two shapes fight for a pixel
	VERTEX = (inverse(MODEL_MATRIX) * vec4(p, 1.0)).xyz;
}
void fragment(){
	if (hh < 0.03) discard;
	if (HOLLOW_Q) discard;   // nothing lies on the sea inside the hollow of a court with a pool
	// the reflection thins out with height by blending into the colour of the deep water. (It used to be cut
	// into a pattern of dots, which shimmered whenever the camera moved.)
	float fade = mix(1.0, 0.3, smoothstep(1.6, 6.5, hh)) * strength * fade_a;
	vec3 c = tint;
	if (use_tex > 0.5) { vec3 tx = vcol > 0.5 ? mix(vec3(0.77, 0.765, 0.76), vec3(0.59, 0.246, 0.162), smoothstep(0.47, 0.53, COLOR.a)) : texture(albedo_tex, UV).rgb; float rw = smoothstep(0.08, 0.2, tx.r - tx.b); c = mix(tx * 0.92, clamp(tx * gain, 0.0, 1.0), rw); }
	ALBEDO = mix(under_col, c, fade);
}"""
## glints on water: short bright strokes that lie level across the picture (the eye looks along the diagonal of the
## map, so "level" is the line x - z), each coming and going in its own time. p: a place on the water in metres,
## cell: how far apart they lie (along the stroke, and into the picture), dens: how many of the cells hold one
const GLSL_GLINT := """float glints(vec2 p, float tm, vec2 cell, float dens){
	vec2 g = vec2(p.x - p.y, p.x + p.y) * 0.7071 / cell;
	g.x += floor(g.y) * 0.37;
	vec2 id = floor(g); vec2 f = fract(g) - 0.5;
	float h = fract(sin(dot(id, vec2(12.9898, 78.233))) * 43758.5453);
	float h2 = fract(h * 91.7);
	f.x += (h2 - 0.5) * 0.3;
	float len = 0.1 + 0.22 * fract(h * 7.3);
	float along = 1.0 - clamp(abs(f.x) / len, 0.0, 1.0);
	float w = 0.1 * (0.35 + 0.65 * along); float wy = max(w, fwidth(g.y) * 1.2);      // never thinner than a pixel: a stroke seen from far grows faint instead of flickering
	float d = smoothstep(0.0, 0.5, along) * smoothstep(wy, wy * 0.3, abs(f.y)) * (w / wy);
	return step(1.0 - dens, h) * d * smoothstep(0.25, 0.85, sin(tm * (0.45 + h2 * 0.5) + h * 40.0) * 0.5 + 0.5);
}
"""
## the still water of the mirror pool: almost clear, with a few slow glints
const SH_GLASS := """shader_type spatial;
render_mode unshaded, cull_disabled, depth_draw_never;
uniform float time_s = 0.0; uniform float blur_px = 3.2; uniform float wave = 1.0; uniform float lod = 1.0;
uniform vec4 lost_rect = vec4(0.0); uniform float lost_a = 0.0; uniform float lost_x = 0.0;   // lost_x: the crossing runs along x
uniform vec4 lost_rect2 = vec4(0.0); uniform float lost_x2 = 0.0;   // a second leg of it (none if the rectangle is empty)
uniform sampler2D screen_tex : hint_screen_texture, filter_linear_mipmap, repeat_disable;
varying vec3 wp;
//GLINT
void vertex(){ wp = (MODEL_MATRIX * vec4(VERTEX, 1.0)).xyz; }
void fragment(){
	vec2 px = 1.0 / VIEWPORT_SIZE;
	// slow ripples bend what the water shows, and a small blur softens it: a reflection, not a thing to step on
	vec2 rip = vec2(sin(wp.z * 7.0 + time_s * 1.1) + 0.6 * sin(wp.x * 11.0 - time_s * 0.8), sin(wp.x * 6.0 + time_s * 0.9) + 0.6 * sin(wp.z * 13.0 + time_s * 1.3)) * px * 3.0 * wave;
	vec2 uv = SCREEN_UV + rip;
	vec3 c = textureLod(screen_tex, uv, lod).rgb * 0.2;
	for (int i = 0; i < 8; i++) {
		float a = float(i) * 0.7854;
		c += textureLod(screen_tex, uv + vec2(cos(a), sin(a)) * px * blur_px * (1.0 + 0.5 * float(i % 2)), lod).rgb * 0.1;
	}
	float l = smoothstep(0.9, 1.0, sin(wp.x * 2.3 + sin(wp.z * 1.7 + time_s * 0.45) * 1.8 + time_s * 0.22) * 0.5 + 0.5);
	float l2 = glints(wp.xz, time_s * 0.8, vec2(1.1, 0.42), 0.34);   // a few level strokes of light (they were pale ovals, like flakes of snow on the water)
	if (lost_a > 0.0) {   // the lost crossing: no clear shape, only a soft shadow that the water still holds (one leg, or two that meet)
		float ls = 0.0;
		for (int k = 0; k < 2; k++) {
			vec4 r0 = k == 0 ? lost_rect : lost_rect2; float ax = k == 0 ? lost_x : lost_x2;
			if (r0.z - r0.x < 0.01) continue;
			vec2 q2 = wp.xz + vec2(sin(wp.z * 9.0 + time_s * 1.2) + 0.5 * sin(wp.z * 21.0 - time_s * 0.7), sin(wp.x * 7.0 + time_s * 0.9)) * 0.03 * wave;
			vec4 lr = r0;
			if (ax > 0.5) { q2 = q2.yx; lr = r0.yxwz; }
			float sx = smoothstep(lr.x - 0.12, lr.x + 0.1, q2.x) * (1.0 - smoothstep(lr.z - 0.1, lr.z + 0.12, q2.x));
			float sz = smoothstep(lr.y - 0.06, lr.y + 0.08, q2.y) * (1.0 - smoothstep(lr.w - 0.08, lr.w + 0.06, q2.y));
			float seg = 0.86 + 0.14 * smoothstep(-0.3, 0.5, sin((q2.y - lr.y) * 19.6));
			ls = max(ls, sx * sz * seg);
		}
		c = mix(c, vec3(0.12, 0.29, 0.39), ls * lost_a * 0.62);
	}
	c = mix(c, vec3(0.6, 0.85, 0.88), 0.24);
	c = mix(c, vec3(1.0), clamp(l * 0.3 + l2 * 0.45, 0.0, 1.0));
	ALBEDO = c;
}"""
## what the pool shows where nothing stands over it: the sky
const SH_PIT := """shader_type spatial;
render_mode unshaded, cull_front;
uniform vec3 top_c = vec3(0.73, 0.87, 0.89); uniform vec3 low_c = vec3(0.7, 0.85, 0.88); uniform float y0 = -0.2; uniform float y1 = -2.4;
varying vec3 wp;
void vertex(){ wp = (MODEL_MATRIX * vec4(VERTEX, 1.0)).xyz; }
void fragment(){ ALBEDO = mix(top_c, low_c, clamp((wp.y - y0) / (y1 - y0), 0.0, 1.0)); }"""
const SH_SEA := """shader_type spatial;
render_mode unshaded, cull_disabled;
uniform vec3 near_col : source_color; uniform vec3 far_col : source_color; uniform vec3 centre; uniform float mist_r = 7.0; uniform float time_s = 0.0; uniform float mist_k = 1.0;
varying vec3 wp;
//GLINT
void vertex(){ wp = (MODEL_MATRIX * vec4(VERTEX, 1.0)).xyz; }
void fragment(){
	if ((HOLLOW_WP) && wp.y < -0.1) discard;   // the hollow under the first court holds the mirror pool
	vec3 d3 = wp - centre; float md = length(d3 - vec3(0.57735) * dot(d3, vec3(0.57735)));
	float m = smoothstep(mist_r * 0.8, mist_r * 1.75, md) * mist_k;
	vec2 p = wp.xz * 1.1;
	float lines = smoothstep(0.93, 0.995, sin(p.x * 2.3 + sin(p.y * 1.7 + time_s * 0.45) * 1.9 + sin(p.x * 0.31 - p.y * 0.53) * 2.3 + time_s * 0.2) * 0.5 + 0.5);   // (the third wave keeps the lines from repeating like a wallpaper when the whole map is in view)
	// the light on the swell: short level strokes, some long and some short, that come and go. (They were round dots
	// on a square grid, which read as snow lying on the water.)
	float sp = glints(wp.xz, time_s, vec2(0.86, 0.3), 0.3) + 0.7 * glints(wp.xz + 3.7, time_s * 1.3, vec2(0.47, 0.21), 0.16);
	float brk = smoothstep(0.35, 0.75, sin(p.x * 0.63 + p.y * 0.41) * sin(p.y * 0.57 - p.x * 0.29 + 1.3) * 0.5 + 0.5);
	float road = smoothstep(2.4, 0.0, abs((wp.x - wp.z) - (centre.x - centre.z) - 4.2));
	// the sun's road across the water: the same strokes, smaller, closer and quicker (it too was dots on a grid)
	float glit = road * glints(wp.xz + 11.3, time_s * 2.8, vec2(0.26, 0.115), 0.85);
	lines *= smoothstep(21.0, 11.0, mist_r);   // with the whole map in view the long lines only made a pattern: there the sea lies plain
	vec3 col = mix(near_col, far_col, m) + vec3(0.5, 0.6, 0.6) * (lines * 0.1 * brk + sp * 0.35) * (1.0 - m);
	col += (vec3(1.0, 0.93, 0.78) * glit * 0.55 + vec3(0.9, 0.8, 0.7) * road * 0.07) * (1.0 - m * 0.6);
	ALBEDO = col; ALPHA = mix(0.6, 1.0, m);
}"""
const SH_FACE := """shader_type spatial;
render_mode unshaded;
uniform float time_s = 0.0;
varying vec3 lp;
void vertex(){ lp = VERTEX; }
void fragment(){
	float g = smoothstep(0.022, 0.0, abs(lp.x * 0.8 + lp.y - 0.02 - sin(time_s * 0.5) * 0.07));
	ALBEDO = mix(vec3(1.0, 0.99, 0.97), vec3(0.80, 0.85, 0.97), smoothstep(0.07, -0.09, lp.y)) + g * 0.2;
}"""
const SH_FOAM := """shader_type spatial;
render_mode unshaded, cull_disabled;
uniform float time_s = 0.0;
varying vec3 wp;
void vertex(){ wp = (MODEL_MATRIX * vec4(VERTEX, 1.0)).xyz; }
void fragment(){
	float d = UV.x; float ph = fract(time_s * 0.13 + UV.y);
	float wob = sin(wp.x * 5.0 + wp.z * 4.0 + time_s * 1.2) * 0.03;
	float edge = smoothstep(0.09, 0.0, abs(d - 0.07 - wob));
	float wave = smoothstep(0.07, 0.0, abs(d - ph * 0.95 - wob)) * (1.0 - ph) * 0.8;
	ALBEDO = vec3(0.93, 0.98, 0.97); ALPHA = clamp(edge * 0.75 + wave, 0.0, 1.0) * 0.8;
}"""
const SH_FOG := """shader_type spatial;
render_mode unshaded, cull_disabled;
uniform sampler2D noise_tex : repeat_enable, filter_linear;
uniform float time_s = 0.0; uniform vec3 hero; uniform float dens = 0.5; uniform float scale = 0.05; uniform vec2 vel = vec2(0.02, 0.01);
uniform float clear_r = 0.0; uniform vec3 col : source_color; uniform float far_a = 2.0; uniform float far_b = 9.0;
varying vec3 wp;
void vertex(){ wp = (MODEL_MATRIX * vec4(VERTEX, 1.0)).xyz; }
void fragment(){
	if ((HOLLOW_WP) && wp.y < -0.1) discard;   // the hollow under the first court holds the mirror pool
	vec2 uv = wp.xz * scale;
	float n = texture(noise_tex, uv + vel * time_s).r * 0.62 + texture(noise_tex, uv * 2.3 - vel.yx * time_s * 1.7 + 0.37).r * 0.38;
	vec3 d3 = wp - hero; float md = length(d3 - vec3(0.57735) * dot(d3, vec3(0.57735)));
	float a = mix(0.72, 1.0, n) * dens * smoothstep(far_a, far_b, md);
	if (clear_r > 0.0) a *= smoothstep(clear_r * 0.3, clear_r, distance(wp.xz, hero.xz));
	ALBEDO = col; ALPHA = a;
}"""
## the glass of the great mirror in the garden wall, laid over its dark niche: light added to what is behind it
const SH_PANE := """shader_type spatial;
render_mode unshaded, cull_disabled, blend_add, depth_draw_never;
uniform float time_s = 0.0;
void fragment(){
	float d = UV.x * 0.5 + UV.y * 0.34 + time_s * 0.01;
	float g = smoothstep(0.1, 0.075, abs(fract(d) - 0.42)) * 0.5 + smoothstep(0.024, 0.014, abs(fract(d) - 0.62)) * 0.85;
	vec2 e = min(UV, 1.0 - UV);
	float edge = smoothstep(0.0, 0.05, min(e.x * 1.8, e.y));
	ALBEDO = vec3(0.5, 0.78, 0.9) * (0.035 + 0.17 * smoothstep(0.75, 0.0, UV.y) * smoothstep(0.75, 0.0, UV.y) + g * 0.2) * edge;
}"""
const SH_SHARD := """shader_type spatial;
render_mode unshaded, cull_disabled;
uniform float time_s = 0.0; uniform float ph = 0.0;
void fragment(){ float g = pow(abs(sin(time_s * 1.7 + ph)), 6.0); ALBEDO = mix(vec3(0.70, 0.86, 0.93), vec3(1.0, 1.0, 0.98), g); }"""
const SH_RING := "shader_type spatial;\nrender_mode unshaded, blend_add, cull_disabled;\nuniform float p = 1.0; uniform vec3 tint = vec3(1.0, 0.36, 0.40);\nvoid fragment(){ float d = distance(UV, vec2(0.5)) * 2.0; float ring = smoothstep(0.05, 0.0, abs(d - p)) + 0.5 * smoothstep(0.035, 0.0, abs(d - p * 0.6)); ALBEDO = tint; ALPHA = ring * (1.0 - p); }"

var shaders := {}
var pmats := {}
var umats := {}
var timed: Array = []
var lights: Array = [Vector4.ZERO, Vector4.ZERO, Vector4.ZERO, Vector4.ZERO, Vector4.ZERO, Vector4.ZERO, Vector4.ZERO]
var fig: Node3D
var ghost: Node3D
var lamp: Node3D
var lamp_halo: MeshInstance3D
var door_halo: MeshInstance3D
var blob: MeshInstance3D
var pulse: MeshInstance3D
var tapring: MeshInstance3D
var usering: MeshInstance3D
var refl_out := {}         # (play) her reflection while it is away from her, out on the water: its body (empty: it is under her feet)
var refl_stay := false     # (while she is sent to the rim for it) her walking does not call the reflection back
var refl_token := 0        # each order to the reflection carries the next number; an older order sees it has been overtaken and stops
var refl_ring: MeshInstance3D
var refl_p := 1.0
var water_hinted := false
var turn_hinted := false
var hold_id := -1           # the finger that is down (-1: none), where it is, and for how long: held, it leads her
var hold_at := Vector2.ZERO
var hold_t := 0.0
var hold_next := 0.0
var res_level := 0         # (play) how far the 3D picture's resolution has been lowered to keep the game smooth: an index into RES_STEPS
var res_t := 0.0; var res_frames := 0; var res_hold := 3.0; var res_top := 0; var res_probe := false
var use_p := 1.0
var sun_light: DirectionalLight3D
var ripple: MeshInstance3D
var door: MeshInstance3D
var cap_rot: Node3D
var bridge: Node3D
var cam: Camera3D
var sky: MeshInstance3D
var mist: MeshInstance3D
var cam_t := Vector3.ZERO
var world: Node3D
var prop_src := {}        # the models of props/, each read once
var prop_fused := {}      # and their palette-painted surfaces fused into one
var floors := []          # the footprints of the floors: [x0, z0, x1, z1, height of the underside]
var lighten_check := []   # LIGHTEN=check: the pieces that would be joined, to see that none of them ever moves
var refl: Node3D
var wfig: Node3D
var sea_mat: ShaderMaterial
var shot = null
var bv := PackedVector3Array()
var bn := PackedVector3Array()
var foam_mat: ShaderMaterial
var gulls: Array = []
var boat: Node3D
var fogs: Array = []
var red_cloth: ShaderMaterial
var shard_mats: Array = []
var solids: Array = []     # things that stand on walkable floor and that she walks round with the stick: x, z and a radius
var blockers: Array = []   # things that stand on walkable floor (the lamp stands): x, z and a radius she does not stop within
var pulse_p := 1.0
var tap_p := 1.0
var ripple_p := 1.0
var flash := 0.0
var lamp_held := false
var lamp_energy := 0.25
var door_energy := 0.0
var lamp_off := Vector3.ZERO
var lamp_vel := Vector3.ZERO
var pushing := false
var busy := false
var ctl: Joy                # (play by hand) the joystick and the interact button
var reach := ""            # the thing in reach of her now: what the interact button would do
var hand_play := false     # no arguments: the game as a player plays it, with the first two courts' gates shut until their puzzles are solved
var started := false
var ended := false
var auto := false
var pending := ""
var done := {}
var rects := {}
var objs := {}
var markers := {}
var hint: Label
var quote_box: Control    # a line of the story, shown once over the scene (see quote())
var quote_lbls := []       # the same line several times over: its haze, its glow, its letters
var quote_glow: Control
var quotes_shown := {}
var title_box: Control
var end_box: Control
var last_tap := -9.0

var pos := Vector3(0.6, 0, 2.2)
var yaw := -2.4
var spd := 0.0
var vel := Vector3.ZERO
var route: Array = []
var speed_cap := WALK
var face_to = null
var look_at_pt = null
var phase := 0.0
var t := 0.0
var sway := Vector2.ZERO
var sway_v := Vector2.ZERO
var head_yaw := 0.0
var a_hy := 0.0
var a_drop := 0.0
var a_lean := 0.0
var a_pool := 0.0
var a_hold := 0.0
var a_raise := 0.0
var a_open := 0.0
var a_headp := 0.0
var a_wL := 0.0
var a_wR := 0.0
var tgtL := Vector3.ZERO
var tgtR := Vector3.ZERO
signal arrived
signal faced
signal settled

func pal(n: String, variant := "") -> ShaderMaterial:
	var key := n + "|" + variant
	if pmats.has(key): return pmats[key]
	var m := ShaderMaterial.new(); m.shader = shaders["two" if variant in ["2", "flat2", "2r"] else "base"]
	m.set_shader_parameter("c_top", Color(pals[n][0])); m.set_shader_parameter("c_z", Color(pals[n][1]))
	m.set_shader_parameter("c_x", Color(pals[n][2])); m.set_shader_parameter("fog_col", sea_c); m.set_shader_parameter("mist_col", mist_c); m.set_shader_parameter("shadow_col", shadow_c); m.set_shader_parameter("mist_k", mist_k)
	if variant == "sway": m.set_shader_parameter("sway", 1.0); m.set_shader_parameter("flat_n", 1.0); timed.append(m)
	if variant == "flat" or variant == "flat2": m.set_shader_parameter("flat_n", 1.0)
	if variant == "2r": m.set_shader_parameter("rim", 1.8)   # the statues of her: the faces that turn away from the eye go a little deeper, so that the folds and the limbs read as round
	if n in ["stone", "shade", "sand", "rose"]: m.set_shader_parameter("marble", 1.0)
	if n == "marble" or n == "skin": m.set_shader_parameter("marble", 0.3)
	if sepia_var > 0.0 and n in ["stone", "shade", "sand", "marble"]: m.set_shader_parameter("tone_var", sepia_var)
	if refl_mat != null and variant != "sway": m.next_pass = refl_mat
	pmats[key] = m
	return m

func water(flow := Vector2.ZERO, vert := false) -> ShaderMaterial:
	var m := ShaderMaterial.new(); m.shader = shaders["water"]
	m.set_shader_parameter("deep", water_deep); m.set_shader_parameter("shallow", water_shallow)
	m.set_shader_parameter("flow", flow); m.set_shader_parameter("vert", 1.0 if vert else 0.0)
	timed.append(m)
	return m

func cloth(a: Color, b: Color, wave := 0.0) -> ShaderMaterial:
	var m := ShaderMaterial.new(); m.shader = shaders["cloth"]
	m.set_shader_parameter("ca", a); m.set_shader_parameter("cb", b); m.set_shader_parameter("wave", wave)
	if wave > 0.0: timed.append(m)
	return m

func mat(c: Color, add := false) -> StandardMaterial3D:
	var k := "%s|%s" % [c.to_html(), add]
	if umats.has(k): return umats[k]
	var m := StandardMaterial3D.new(); m.albedo_color = c; m.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	if c.a < 1.0: m.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	if add: m.blend_mode = BaseMaterial3D.BLEND_MODE_ADD
	umats[k] = m
	return m

func blk(a: Vector3, b: Vector3, p := "stone", parent: Node = self) -> MeshInstance3D:
	var mi := MeshInstance3D.new(); var bm := BoxMesh.new()
	bm.size = (b - a).abs(); mi.mesh = bm; mi.position = (a + b) * 0.5
	mi.material_override = pal(p); parent.add_child(mi)
	return mi

func prim(mesh: Mesh, p: Vector3, m: Material, parent: Node = self) -> MeshInstance3D:
	var mi := MeshInstance3D.new(); mi.mesh = mesh; mi.position = p; mi.material_override = m; parent.add_child(mi)
	var solid: bool = m is ShaderMaterial and ((m as ShaderMaterial).shader == shaders["base"] or (shaders.has("tex") and (m as ShaderMaterial).shader == shaders["tex"]) or (m as ShaderMaterial).shader == shaders["two"] or (m as ShaderMaterial).shader == shaders["cloth"])
	mi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_ON if solid else GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	return mi

func cornice(x0: float, z0: float, x1: float, z1: float, y: float, o := 0.045, h := 0.06, p := "shade") -> void:
	blk(Vector3(x0 - o, y, z0 - o), Vector3(x1 + o, y + h, z1 + o), p)

func win_z(x: float, y: float, z: float, w: float, h: float, p := "dark") -> void:
	blk(Vector3(x - w * 0.5, y, z), Vector3(x + w * 0.5, y + h - w * 0.5, z + 0.012), p)
	var c := CylinderMesh.new(); c.top_radius = w * 0.5; c.bottom_radius = w * 0.5; c.height = 0.012; c.radial_segments = 24
	prim(c, Vector3(x, y + h - w * 0.5, z + 0.006), pal(p)).rotation.x = PI * 0.5

func win_x(x: float, y: float, z: float, w: float, h: float, p := "dark") -> void:
	blk(Vector3(x, y, z - w * 0.5), Vector3(x + 0.012, y + h - w * 0.5, z + w * 0.5), p)
	var c := CylinderMesh.new(); c.top_radius = w * 0.5; c.bottom_radius = w * 0.5; c.height = 0.012; c.radial_segments = 24
	prim(c, Vector3(x + 0.006, y + h - w * 0.5, z), pal(p)).rotation.z = PI * 0.5

func crenels(a: Vector3, b: Vector3, step := 0.3, sz := 0.13, p := "stone") -> void:
	var n := int(a.distance_to(b) / step)
	for i in n + 1:
		var c := a.lerp(b, float(i) / maxf(n, 1))
		blk(c - Vector3(sz, 0, sz) * 0.5, c + Vector3(sz * 0.5, sz * 0.9, sz * 0.5), p)

func halo(size: float, c: Color) -> MeshInstance3D:
	var g := Gradient.new(); g.offsets = PackedFloat32Array([0.0, 0.35, 1.0])
	g.colors = PackedColorArray([c, Color(c.r, c.g, c.b, c.a * 0.35), Color(c.r, c.g, c.b, 0)])
	var gt := GradientTexture2D.new(); gt.gradient = g; gt.fill = GradientTexture2D.FILL_RADIAL
	gt.fill_from = Vector2(0.5, 0.5); gt.fill_to = Vector2(1.0, 0.5); gt.width = 128; gt.height = 128
	var q := QuadMesh.new(); q.size = Vector2(size, size)
	var m := StandardMaterial3D.new(); m.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED; m.albedo_texture = gt
	m.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA; m.blend_mode = BaseMaterial3D.BLEND_MODE_ADD
	m.billboard_mode = BaseMaterial3D.BILLBOARD_ENABLED; m.no_depth_test = false
	var mi := MeshInstance3D.new(); mi.mesh = q; mi.material_override = m
	return mi

func slab(x0: float, z0: float, x1: float, z1: float, y: float, p := "stone", parent: Node = self) -> void:
	if parent == self: floors.append([x0, z0, x1, z1, y - 0.18])   # what lies between the sea under it and the eye (see _lighten)
	blk(Vector3(x0, y - 0.13, z0), Vector3(x1, y, z1), p, parent)
	blk(Vector3(x0 - 0.03, y - 0.18, z0 - 0.03), Vector3(x1 + 0.03, y - 0.13, z1 + 0.03), "shade", parent)
	dentils(x0, z0, x1, z1, y - 0.18, parent)

func pier(x: float, z: float, top: float, w := 0.5, p := "stone") -> void:
	var h := w * 0.5
	blk(Vector3(x - h, -2.45, z - h), Vector3(x + h, top, z + h), p)
	blk(Vector3(x - h - 0.06, -2.45, z - h - 0.06), Vector3(x + h + 0.06, WATER + 0.06, z + h + 0.06), "shade")
	win_z(x, -1.15, z + h, w * 0.46, 0.6); win_x(x + h, -1.15, z, w * 0.46, 0.6)
	foam(x - h - 0.06, z - h - 0.06, x + h + 0.06, z + h + 0.06, 0.3)

func col_faces(c: Vector3, hw: float, y0: float, y1: float, p := "stone") -> void:
	var v := PackedVector3Array(); var n := PackedVector3Array()
	var a := [Vector3(c.x + hw, y0, c.z + hw), Vector3(c.x + hw, y0, c.z - hw), Vector3(c.x + hw, y1, c.z - hw), Vector3(c.x + hw, y1, c.z + hw)]
	var b := [Vector3(c.x - hw, y0, c.z + hw), Vector3(c.x + hw, y0, c.z + hw), Vector3(c.x + hw, y1, c.z + hw), Vector3(c.x - hw, y1, c.z + hw)]
	for q in [[a, Vector3.RIGHT], [b, Vector3.BACK]]:
		for i in [0, 1, 2, 0, 2, 3]:
			v.append(q[0][i]); n.append(q[1])
	var arr := []; arr.resize(Mesh.ARRAY_MAX); arr[Mesh.ARRAY_VERTEX] = v; arr[Mesh.ARRAY_NORMAL] = n
	var am := ArrayMesh.new(); am.add_surface_from_arrays(Mesh.PRIMITIVE_TRIANGLES, arr)
	prim(am, Vector3.ZERO, pal(p, "2"))


# ---------------------------------------------------------------- scenery pieces
## many small boxes merged into one mesh (dentils, balusters, inlays)
func bb(a: Vector3, b: Vector3) -> void:
	var lo := Vector3(minf(a.x, b.x), minf(a.y, b.y), minf(a.z, b.z)); var hi := Vector3(maxf(a.x, b.x), maxf(a.y, b.y), maxf(a.z, b.z))
	var c := [Vector3(lo.x, lo.y, lo.z), Vector3(hi.x, lo.y, lo.z), Vector3(hi.x, hi.y, lo.z), Vector3(lo.x, hi.y, lo.z),
		Vector3(lo.x, lo.y, hi.z), Vector3(hi.x, lo.y, hi.z), Vector3(hi.x, hi.y, hi.z), Vector3(lo.x, hi.y, hi.z)]
	for f in [[[7, 6, 2, 3], Vector3.UP], [[4, 5, 6, 7], Vector3.BACK], [[5, 1, 2, 6], Vector3.RIGHT], [[0, 4, 7, 3], Vector3.LEFT], [[1, 0, 3, 2], Vector3.FORWARD]]:
		for i in [0, 1, 2, 0, 2, 3]:
			bv.append(c[f[0][i]]); bn.append(f[1])

func bb_end(p: String, parent: Node = self) -> MeshInstance3D:
	if bv.is_empty(): return null
	var arr := []; arr.resize(Mesh.ARRAY_MAX); arr[Mesh.ARRAY_VERTEX] = bv; arr[Mesh.ARRAY_NORMAL] = bn
	var am := ArrayMesh.new(); am.add_surface_from_arrays(Mesh.PRIMITIVE_TRIANGLES, arr)
	bv = PackedVector3Array(); bn = PackedVector3Array()
	return prim(am, Vector3.ZERO, pal(p, "2"), parent)

func dentils(x0: float, z0: float, x1: float, z1: float, y: float, parent: Node = self) -> void:
	var x := x0 + 0.05
	while x < x1 - 0.08:
		bb(Vector3(x, y - 0.06, z1), Vector3(x + 0.06, y, z1 + 0.035)); x += 0.13
	var z := z0 + 0.05
	while z < z1 - 0.08:
		bb(Vector3(x1, y - 0.06, z), Vector3(x1 + 0.035, y, z + 0.06)); z += 0.13
	bb_end("stone", parent)

## a Greek key border laid into the floor along the inside of a rectangle
func meander(x0: float, z0: float, x1: float, z1: float, p := "shade") -> void:
	var u := 0.26; var h := 0.13; var w := 0.022; var y1 := 0.004
	for side in 4:
		var horiz := side % 2 == 0
		var a0 := (x0 if horiz else z0) + 0.0; var a1 := (x1 if horiz else z1)
		var base := z0 if side == 0 else (x1 - h if side == 1 else (z1 - h if side == 2 else x0))
		var n := int((a1 - a0) / u)
		var uu := (a1 - a0) / maxf(n, 1)
		for i in n:
			var o := a0 + i * uu
			for seg in [[0.0, 0.0, uu, w], [0.0, 0.0, w, h], [0.0, h - w, uu * 0.72, h], [uu * 0.72 - w, h * 0.38, uu * 0.72, h], [uu * 0.32, h * 0.38, uu * 0.72, h * 0.38 + w]]:
				# only the top of each stroke is made: at 4 mm thick its sides are never seen, and they were four fifths of the border's triangles
				var c0 := Vector3(o + seg[0], y1, base + seg[1]) if horiz else Vector3(base + seg[1], y1, o + seg[0])
				var c1 := Vector3(o + seg[2], y1, base + seg[3]) if horiz else Vector3(base + seg[3], y1, o + seg[2])
				face_q([c0, Vector3(c1.x, y1, c0.z), c1, Vector3(c0.x, y1, c1.z)], Vector3.UP)
	bb_end(p)

func foam(x0: float, z0: float, x1: float, z1: float, wdt := 0.42) -> MeshInstance3D:
	# round things (a column, a pile, the pivot of the bridge) are asked for as a small square: they get a round ring,
	# not a square of foam standing off from a round shaft
	if absf((x1 - x0) - (z1 - z0)) < 0.001 and x1 - x0 < 0.75: return foam_ring(Vector3((x0 + x1) * 0.5, 0, (z0 + z1) * 0.5), (x1 - x0) * 0.5, wdt)
	var v := PackedVector3Array(); var uv := PackedVector2Array()
	var y := WATER + 0.012
	var inn := [Vector3(x0, y, z0), Vector3(x1, y, z0), Vector3(x1, y, z1), Vector3(x0, y, z1)]
	var out := [Vector3(x0 - wdt, y, z0 - wdt), Vector3(x1 + wdt, y, z0 - wdt), Vector3(x1 + wdt, y, z1 + wdt), Vector3(x0 - wdt, y, z1 + wdt)]
	for i in 4:
		var j := (i + 1) % 4
		for q in [[inn[i], 0.0], [inn[j], 0.0], [out[j], 1.0], [inn[i], 0.0], [out[j], 1.0], [out[i], 1.0]]:
			v.append(q[0]); uv.append(Vector2(q[1], i * 0.25))
	var arr := []; arr.resize(Mesh.ARRAY_MAX); arr[Mesh.ARRAY_VERTEX] = v; arr[Mesh.ARRAY_TEX_UV] = uv
	var am := ArrayMesh.new(); am.add_surface_from_arrays(Mesh.PRIMITIVE_TRIANGLES, arr)
	return prim(am, Vector3.ZERO, foam_mat)

## the same round a round thing: rings that open from it and fade
func foam_ring(c: Vector3, r: float, wdt := 0.3) -> MeshInstance3D:
	var v := PackedVector3Array(); var uv := PackedVector2Array()
	var y := WATER + 0.012; var n := 28
	for i in n:
		var a0 := TAU * i / n; var a1 := TAU * (i + 1) / n
		var d0 := Vector3(cos(a0), 0, sin(a0)); var d1 := Vector3(cos(a1), 0, sin(a1)); var o := Vector3(c.x, y, c.z)
		for q in [[o + d0 * r, 0.0], [o + d1 * r, 0.0], [o + d1 * (r + wdt), 1.0], [o + d0 * r, 0.0], [o + d1 * (r + wdt), 1.0], [o + d0 * (r + wdt), 1.0]]:
			v.append(q[0]); uv.append(Vector2(q[1], 0.0))
	var arr := []; arr.resize(Mesh.ARRAY_MAX); arr[Mesh.ARRAY_VERTEX] = v; arr[Mesh.ARRAY_TEX_UV] = uv
	var am := ArrayMesh.new(); am.add_surface_from_arrays(Mesh.PRIMITIVE_TRIANGLES, arr)
	return prim(am, Vector3.ZERO, foam_mat)

## a fluted column with base and capital
func column(p: Vector3, h: float, r := 0.15, broken := false) -> void:
	var segs := 48; var nfl := 12
	var v := PackedVector3Array(); var n := PackedVector3Array(); var idx := PackedInt32Array()
	for i in 2:
		var rr := r * (1.0 if i == 0 else 0.84)
		for j in segs + 1:
			var a := TAU * j / segs
			var k := 1.0 - 0.07 * (0.5 + 0.5 * cos(a * nfl))
			var d := Vector3(cos(a), 0, sin(a))
			var tdir := Vector3(-sin(a), 0, cos(a))
			v.append(p + d * rr * k + Vector3(0, 0.1 + (h - 0.2) * i, 0))
			n.append((d * k - tdir * (0.035 * nfl * sin(a * nfl))).normalized())
	for j in segs:
		var a0 := j; var b0 := j + 1; var c0 := j + segs + 1; var d0 := c0 + 1
		idx.append_array([a0, b0, d0, a0, d0, c0])
	var arr := []; arr.resize(Mesh.ARRAY_MAX); arr[Mesh.ARRAY_VERTEX] = v; arr[Mesh.ARRAY_NORMAL] = n; arr[Mesh.ARRAY_INDEX] = idx
	var am := ArrayMesh.new(); am.add_surface_from_arrays(Mesh.PRIMITIVE_TRIANGLES, arr)
	prim(am, Vector3.ZERO, pal("stone", "2"))
	cyl(p, r * 1.35, r * 1.35, 0.05, pal("shade"), 24); cyl(p + Vector3(0, 0.05, 0), r * 1.18, r * 1.05, 0.05, pal("stone"), 24)
	if broken:
		cyl(p + Vector3(0, h - 0.1, 0), r * 0.84, r * 0.6, 0.07, pal("shade"), 7)
	else:
		cyl(p + Vector3(0, h - 0.1, 0), r * 0.86, r * 1.25, 0.08, pal("stone"), 24)
		blk(p + Vector3(-r * 1.35, h - 0.02, -r * 1.35), p + Vector3(r * 1.35, h + 0.05, r * 1.35), "shade")

## The plants and small things of the courts are low-poly models made in Tripo (props/), sorted into parts by
## tools/flat_prop.py and painted here with the palettes, flat-faced like the rest. Leaves sway a little.
func thing(file: String, p: Vector3, height: float, parts: String, yaw := 0.0, across := 0.0) -> Node3D:
	var n := Node3D.new(); n.position = p; n.rotation.y = yaw; add_child(n)
	prop_model(file, n, height, across, false, false, parts)
	return n

## the slot in the floor that a gate's grille sinks into: a dark cut lined with bronze, with the lit inner wall of
## its far side showing, so that one sees where the gate goes
func gate_slot(c: Vector3, half: float, along_x: bool) -> void:
	var n := Node3D.new(); n.position = c; n.rotation.y = 0.0 if along_x else -PI * 0.5; add_child(n)
	var w := 0.062; var l := half + 0.05
	prim(_box(Vector3(l * 2.0, 0.004, w * 2.0)), Vector3(0, 0.003, 0), mat(Color("23213c")), n)                  # the dark of the cut
	prim(_box(Vector3(l * 2.0, 0.004, 0.034)), Vector3(0, 0.0045, -w + 0.017 if along_x else w - 0.017), mat(Color("6d6889")), n)   # its far wall, lit
	for e in [-1.0, 1.0]:
		blk(Vector3(-l - 0.022, 0, e * (w + 0.011) - 0.011), Vector3(l + 0.022, 0.014, e * (w + 0.011) + 0.011), "gold", n)
		blk(Vector3(e * (l + 0.011) - 0.011, 0, -w), Vector3(e * (l + 0.011) + 0.011, 0.014, w), "gold", n)

func _box(sz: Vector3) -> BoxMesh:
	var bm := BoxMesh.new(); bm.size = sz
	return bm

func cypress(p: Vector3, h := 2.2) -> void:
	thing("cypress", p, h * 1.04, "leaf:cyp~,trunk:trunk", p.x * 1.7 + p.z)
	decal(p + Vector3(0.14, 0, -0.14), 0.8, 0.6, 0.2, 0.78)

func urn(p: Vector3, sc := 1.0, pl := "terra") -> void:
	thing("amphora", p, 0.52 * sc, "terra:%s,band:wood" % pl, p.x * 2.3 + p.z * 1.1)

func vine(x: float, z: float, along_x: bool, length: float) -> void:
	var n := maxi(1, int(round(length / 0.85)))   # ivy over the edge of the floor, hanging down the wall below it
	for i in n:
		var o := (i + 0.5) * length / n
		var w := 0.8 + 0.14 * sin(i * 2.1 + x)
		var t := thing("ivy", Vector3(x + (o if along_x else 0.13), 0.03 - 0.62 * w, z + (0.13 if along_x else o)), 0.0, "leaf:%s~" % ("leaf" if i % 2 == 0 else "leaf2"), 0.0 if along_x else PI * 0.5, w)
		t.scale.y = 0.7 + 0.12 * cos(i * 1.3 + z)

func streamer(p: Vector3, length: float, w := 0.3, yaw := 3.67) -> void:
	if red_cloth == null: red_cloth = cloth(Color("e3454e"), Color("9a1e2f"), 3.2)
	var v := PackedVector3Array(); var n := PackedVector3Array(); var uv := PackedVector2Array(); var idx := PackedInt32Array()
	var segs := 14
	for i in segs + 1:
		var tt := float(i) / segs
		var ww := w * (1.0 - 0.5 * tt)
		for j in 2:
			v.append(Vector3(tt * length, (0.5 - j) * ww - 0.09 * tt * tt * length, 0)); n.append(Vector3(0, 0, 1)); uv.append(Vector2(j, tt))
	for i in segs:
		var a := i * 2
		idx.append_array([a, a + 1, a + 3, a, a + 3, a + 2])
	var arr := []; arr.resize(Mesh.ARRAY_MAX); arr[Mesh.ARRAY_VERTEX] = v; arr[Mesh.ARRAY_NORMAL] = n; arr[Mesh.ARRAY_TEX_UV] = uv; arr[Mesh.ARRAY_INDEX] = idx
	var am := ArrayMesh.new(); am.add_surface_from_arrays(Mesh.PRIMITIVE_TRIANGLES, arr)
	prim(am, p, red_cloth).rotation.y = yaw

## a stick from one point to another (a bough, a twig)
func stick(a: Vector3, b: Vector3, r: float, p: String) -> void:
	var y := (b - a).normalized()
	var x := y.cross(Vector3.UP if absf(y.y) < 0.99 else Vector3.RIGHT).normalized()
	blk(Vector3(-r, 0, -r), Vector3(r, a.distance_to(b), r), p).transform = Transform3D(Basis(x, y, x.cross(y)), (a + b) * 0.5)

## the tree of shards: a bare tree whose boughs are hung with splinters of mirror, each on its own thread. Every thread
## hangs from a bough or a twig (they used to hang in the air around a tree too small to reach them)
func shard_tree(p: Vector3) -> void:
	if shard_mats.is_empty():
		for i in 4:
			var m := ShaderMaterial.new(); m.shader = shaders["shard"]; m.set_shader_parameter("ph", i * 1.3); timed.append(m); shard_mats.append(m)
	blk(p + Vector3(-0.3, 0, -0.3), p + Vector3(0.3, 0.22, 0.3), "shade"); blk(p + Vector3(-0.34, 0.22, -0.34), p + Vector3(0.34, 0.27, 0.34), "stone")
	cyl(p + Vector3(0, 0.27, 0), 0.075, 0.048, 1.3, pal("trunk"), 7)
	var limbs := []   # seven boughs rise from the head of the trunk and reach out; each forks once and ends in a twig
	for j in 7:
		var a := TAU * j / 7.0 + 0.3 * sin(j * 2.1)
		var dir := Vector3(cos(a), 0, sin(a)); var side := Vector3(-sin(a), 0, cos(a)) * (1.0 if j % 2 == 0 else -1.0)
		var b0 := p + dir * 0.02 + Vector3(0, 1.28 + 0.04 * j, 0)
		var b1 := p + dir * (0.5 + 0.08 * sin(j * 1.9)) + Vector3(0, 2.0 + 0.14 * sin(j * 2.0 + 1.0), 0)
		var b2 := p + dir * (0.93 + 0.05 * cos(j * 1.3)) + Vector3(0, 2.27 + 0.1 * sin(j * 1.1), 0)
		var f0 := b0.lerp(b1, 0.6); var f1 := p + dir * 0.66 + side * 0.36 + Vector3(0, 2.3 + 0.1 * cos(j * 1.7), 0)
		stick(b0, b1, 0.022, "trunk"); stick(b1, b2, 0.014, "trunk"); stick(f0, f1, 0.012, "trunk")
		limbs.append([b0.lerp(b1, 0.5), b1]); limbs.append([b1, b2]); limbs.append([f0.lerp(f1, 0.3), f1])
	var sv: Array[PackedVector3Array] = [PackedVector3Array(), PackedVector3Array(), PackedVector3Array(), PackedVector3Array()]   # the shards, one mesh for each of their four glints
	for i in 44:
		var lm: Array = limbs[i % limbs.size()]
		var hp: Vector3 = (lm[0] as Vector3).lerp(lm[1], clampf(0.2 + 0.42 * (i / limbs.size()) + 0.3 * fposmod(i * 0.618, 1.0), 0.0, 1.0))   # where on its limb the thread is tied
		var ln := minf(0.14 + 0.52 * fposmod(i * 0.437, 1.0), hp.y - p.y - 1.12)
		blk(hp + Vector3(-0.004, -ln, -0.004), hp + Vector3(0.004, 0, 0.004), "dark")
		var bs := Basis.from_euler(Vector3(0.2 * sin(i * 3.1), i * 4.08, PI * 0.25)); var c := hp - Vector3(0, ln + 0.05, 0)
		var q := [c + bs * Vector3(-0.0375, -0.065, 0), c + bs * Vector3(0.0375, -0.065, 0), c + bs * Vector3(0.0375, 0.065, 0), c + bs * Vector3(-0.0375, 0.065, 0)]
		var sq: PackedVector3Array = sv[i % 4]
		for k in [0, 1, 2, 0, 2, 3]: sq.append(q[k])
		sv[i % 4] = sq
	for i in 4:
		var arr := []; arr.resize(Mesh.ARRAY_MAX); arr[Mesh.ARRAY_VERTEX] = sv[i]
		var am := ArrayMesh.new(); am.add_surface_from_arrays(Mesh.PRIMITIVE_TRIANGLES, arr)
		prim(am, Vector3.ZERO, shard_mats[i])
	decal(p + Vector3(0.35, 0, -0.35), 2.2, 1.6, 0.2, 0.78)

## a standing mirror: a pane in a gilt frame with a small pediment, on lion feet. Modelled in Tripo, then sorted by
## material (tools/mirror_prop.py) and painted here flat, with the world's own colours. kind: "bare", or hidden under a
## sheet: wholly ("tied", "round", "oval") or in part ("hem", "low", "wide", "slip", "ovalh")
const MIRROR_H := {"bare": 2.1, "tied": 2.14, "hem": 2.14, "low": 2.1, "slip": 2.08, "round": 1.95, "oval": 2.0, "ovalh": 2.0, "wide": 1.5}
func mirror_stand(p: Vector3, yaw := 0.0, parent: Node = self, ground_y := 0.0, kind := "bare", _sea := false) -> Node3D:
	var n := Node3D.new(); n.position = p; n.rotation.y = yaw; parent.add_child(n)
	var m := prop_model("mirror_" + kind, n, MIRROR_H[kind], 0.0, false, false, "cloth:linen,rope:rope,gold:gold,stone:stone,gem:crim,pane:shade", ground_y)
	_refl_margins(m)
	return n

func reeds(p: Vector3, n := 9) -> void:
	thing("reeds", Vector3(p.x, WATER + 0.004, p.z), 0.0, "leaf:leaf~,trunk:wood~,pad:leaf2,flower:rose", p.x * 0.9 + p.z * 1.7, 0.95 + 0.04 * n)

func rock(p: Vector3, s := 1.0) -> void:
	thing("rocks", Vector3(p.x, WATER - 0.1 * s, p.z), 0.0, "stone:shade", p.x * 1.3, 1.45 * s)
	foam(p.x - 0.55 * s, p.z - 0.45 * s, p.x + 0.55 * s, p.z + 0.45 * s, 0.3)

## her boat: a small clinker-built rowing boat with two thwarts, its oars shipped, a coil of line in the stern and a
## red strake (props/boat, made in Tripo; it was a hull of seven ribs and two boards)
func build_boat(parent: Node3D) -> void:
	var h := prop_model("boat", parent, 0.0, 1.85, false, false, "wood:wood,crim:crim,rope:linen,gold:trunk")
	h.rotation.y = PI * 0.5; h.scale = Vector3(1.2, 0.85, 1.0); h.position.y = 0.07      # its bow to the mooring pile; a little longer and lower than as made, and riding so that its boards stay above the plane of the sea (lower, the sea showed through them: a flooded boat)
	for m in h.find_children("*", "MeshInstance3D", true, false): (m as MeshInstance3D).cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF   # the sea takes no shadow

func _lowball(r: float) -> SphereMesh:
	var m := SphereMesh.new(); m.radius = r; m.height = r * 2.0; m.radial_segments = 7; m.rings = 4
	return m

func cyl(p: Vector3, r0: float, r1: float, h: float, m: Material, seg := 20, parent: Node = self) -> MeshInstance3D:
	var c := CylinderMesh.new(); c.bottom_radius = r0; c.top_radius = r1; c.height = h; c.radial_segments = seg
	return prim(c, p + Vector3(0, h * 0.5, 0), m, parent)

func ball(p: Vector3, r: float, m: Material, parent: Node = self) -> MeshInstance3D:
	var s := SphereMesh.new(); s.radius = r; s.height = r * 2.0; s.radial_segments = 20; s.rings = 10
	return prim(s, p, m, parent)

## one flat face (three or four corners) added to the mesh that bb_end closes; its normal is turned to the side `out` points to
func face_q(pts: Array, out: Vector3) -> void:
	var nn: Vector3 = ((pts[1] as Vector3) - (pts[0] as Vector3)).cross((pts[2] as Vector3) - (pts[0] as Vector3)).normalized()
	if nn.dot(out) < 0.0: nn = -nn
	for i in ([0, 1, 2] if pts.size() == 3 else [0, 1, 2, 0, 2, 3]):
		bv.append(pts[i]); bn.append(nn)

## the moulded band round the head of an arch, standing a little proud of a wall: a half ring about c, in the plane
## of a wall that faces +z (or +x), from radius r0 to r1 and `proud` thick. Closed with bb_end
func arch_band(c: Vector3, r0: float, r1: float, proud: float, facing_x := false, n := 14) -> void:
	var u := Vector3(0, 0, -1) if facing_x else Vector3(1, 0, 0); var o := Vector3(1, 0, 0) if facing_x else Vector3(0, 0, 1)
	for i in n:
		var a0 := PI * i / n; var a1 := PI * (i + 1) / n
		var d0 := u * cos(a0) + Vector3.UP * sin(a0); var d1 := u * cos(a1) + Vector3.UP * sin(a1)
		face_q([c + d0 * r0 + o * proud, c + d1 * r0 + o * proud, c + d1 * r1 + o * proud, c + d0 * r1 + o * proud], o)
		face_q([c + d0 * r1, c + d1 * r1, c + d1 * r1 + o * proud, c + d0 * r1 + o * proud], d0 + d1)
		face_q([c + d0 * r0, c + d1 * r0, c + d1 * r0 + o * proud, c + d0 * r0 + o * proud], -(d0 + d1))

## a sunk panel on the two faces of a square pier that the eye sees (the one to +x and the one to +z)
func pier_panels(cx: float, cz: float, half: float, y0: float, y1: float, w: float, p := "shade") -> void:
	blk(Vector3(cx + half, y0, cz - w), Vector3(cx + half + 0.005, y1, cz + w), p)
	blk(Vector3(cx - w, y0, cz + half), Vector3(cx + w, y1, cz + half + 0.005), p)

## a pedestal for a head or a vase: a stepped foot, a die with a sunk panel on each face seen, and a moulded cap. Its
## top is `h` above its foot
func pedestal(fp: Vector3, hw := 0.19, h := 0.78) -> void:
	blk(fp + Vector3(-hw - 0.045, 0, -hw - 0.045), fp + Vector3(hw + 0.045, 0.07, hw + 0.045), "shade")
	blk(fp + Vector3(-hw - 0.02, 0.07, -hw - 0.02), fp + Vector3(hw + 0.02, 0.11, hw + 0.02), "stone")
	blk(fp + Vector3(-hw + 0.01, 0.11, -hw + 0.01), fp + Vector3(hw - 0.01, h - 0.12, hw - 0.01), "stone")
	pier_panels(fp.x, fp.z, hw - 0.01, fp.y + 0.19, fp.y + h - 0.2, hw - 0.075)
	blk(fp + Vector3(-hw - 0.015, h - 0.12, -hw - 0.015), fp + Vector3(hw + 0.015, h - 0.09, hw + 0.015), "shade")
	blk(fp + Vector3(-hw - 0.05, h - 0.09, -hw - 0.05), fp + Vector3(hw + 0.05, h - 0.04, hw + 0.05), "stone")
	blk(fp + Vector3(-hw - 0.02, h - 0.04, -hw - 0.02), fp + Vector3(hw + 0.02, h, hw + 0.02), "shade")

## the round plinth of a statue: a foot ring, and on it a drum with a moulding under its lip. 0.17 high, as it was
func round_plinth(sp: Vector3, parent: Node = self) -> void:
	turned(sp, [[0.34, 0.0], [0.34, 0.045], [0.31, 0.07], [0.0, 0.07]], "shade", 20, parent)
	turned(sp, [[0.295, 0.07], [0.295, 0.095], [0.265, 0.11], [0.265, 0.14], [0.285, 0.15], [0.285, 0.17], [0.0, 0.17]], "stone", 20, parent)

## a turned piece (a bollard, a moulded base, a vase): a profile of [radius, height] pairs spun round the upright
## axis. Every edge of the profile is kept crisp, so that it reads as turned stone and not as something soft
func turned(p: Vector3, prof: Array, pl := "stone", seg := 16, parent: Node = self) -> MeshInstance3D:
	var v := PackedVector3Array(); var n := PackedVector3Array()
	for i in prof.size() - 1:
		var r0: float = prof[i][0]; var y0: float = prof[i][1]; var r1: float = prof[i + 1][0]; var y1: float = prof[i + 1][1]
		for j in seg:
			var d0 := Vector3(cos(TAU * j / seg), 0, sin(TAU * j / seg)); var d1 := Vector3(cos(TAU * (j + 1) / seg), 0, sin(TAU * (j + 1) / seg))
			var n0 := (d0 * (y1 - y0) + Vector3.UP * (r0 - r1)).normalized(); var n1 := (d1 * (y1 - y0) + Vector3.UP * (r0 - r1)).normalized()
			var q := [Vector3(0, y0, 0) + d0 * r0, Vector3(0, y1, 0) + d0 * r1, Vector3(0, y1, 0) + d1 * r1, Vector3(0, y0, 0) + d1 * r0]; var qn := [n0, n0, n1, n1]
			for k in ([0, 1, 2] if r0 <= 0.0 else ([0, 2, 3] if r1 <= 0.0 else [0, 1, 2, 0, 2, 3])):
				v.append(q[k]); n.append(qn[k])
	var arr := []; arr.resize(Mesh.ARRAY_MAX); arr[Mesh.ARRAY_VERTEX] = v; arr[Mesh.ARRAY_NORMAL] = n
	var am := ArrayMesh.new(); am.add_surface_from_arrays(Mesh.PRIMITIVE_TRIANGLES, arr)
	return prim(am, p, pal(pl, "2"), parent)

## a bronze point on the head of a bar (added to the mesh that bb_end closes)
func spear(c: Vector3, w := 0.03, h := 0.075) -> void:
	var q := [c + Vector3(-w, 0, -w), c + Vector3(w, 0, -w), c + Vector3(w, 0, w), c + Vector3(-w, 0, w)]
	for i in 4: face_q([q[i], q[(i + 1) % 4], c + Vector3(0, h, 0)], (q[i] + q[(i + 1) % 4]) * 0.5 - c + Vector3(0, w, 0))

func decal(p: Vector3, sx: float, sz: float, a := 0.26, rot := 0.0) -> void:
	return
	var q := QuadMesh.new(); q.size = Vector2(1, 1); q.orientation = PlaneMesh.FACE_Y
	if not umats.has("decal%f" % a):
		var g := Gradient.new(); g.offsets = PackedFloat32Array([0.0, 0.5, 1.0])
		g.colors = PackedColorArray([Color(0.22, 0.17, 0.34, a), Color(0.22, 0.17, 0.34, a * 0.55), Color(0.22, 0.17, 0.34, 0)])
		var gt := GradientTexture2D.new(); gt.gradient = g; gt.fill = GradientTexture2D.FILL_RADIAL
		gt.fill_from = Vector2(0.5, 0.5); gt.fill_to = Vector2(1.0, 0.5); gt.width = 64; gt.height = 64
		var m := StandardMaterial3D.new(); m.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED; m.albedo_texture = gt
		m.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
		umats["decal%f" % a] = m
	var mi := prim(q, p + Vector3(0, 0.007, 0), umats["decal%f" % a])
	mi.scale = Vector3(sx, 1, sz); mi.rotation.y = rot

func under(x0: float, z0: float, x1: float, z1: float, inset := 0.22, p := "stone") -> void:
	var a := Vector3(x0 + inset, -2.45, z0 + inset); var b := Vector3(x1 - inset, -0.18, z1 - inset)
	blk(a, b, p)
	blk(Vector3(a.x - 0.1, -2.45, a.z - 0.1), Vector3(b.x + 0.1, WATER + 0.07, b.z + 0.1), "shade")
	cornice(a.x, a.z, b.x, b.z, -0.42, 0.1, 0.12, "shade")
	foam(a.x - 0.1, a.z - 0.1, b.x + 0.1, b.z + 0.1)
	var nx := maxi(1, int((b.x - a.x) / 1.05)); var nz := maxi(1, int((b.z - a.z) / 1.05))
	for i in nx: win_z(a.x + (b.x - a.x) * (i + 0.5) / nx, -1.2, b.z, 0.4, 0.74)
	for i in nz: win_x(b.x, -1.2, a.z + (b.z - a.z) * (i + 0.5) / nz, 0.4, 0.74)

func tiles(x0: float, z0: float, x1: float, z1: float, step := 0.8) -> void:
	var hx0 := tile_hole.position.x; var hz0 := tile_hole.position.y; var hx1 := tile_hole.end.x; var hz1 := tile_hole.end.y; var hole := tile_hole.size.x > 0.0
	var x := x0 + step
	while x < x1 - 0.1:
		if hole and x > hx0 and x < hx1:
			blk(Vector3(x - 0.008, 0, z0 + 0.1), Vector3(x + 0.008, 0.003, hz0), "shade"); blk(Vector3(x - 0.008, 0, hz1), Vector3(x + 0.008, 0.003, z1 - 0.1), "shade")
		else: blk(Vector3(x - 0.008, 0, z0 + 0.1), Vector3(x + 0.008, 0.003, z1 - 0.1), "shade")
		x += step
	var z := z0 + step
	while z < z1 - 0.1:
		if hole and z > hz0 and z < hz1:
			blk(Vector3(x0 + 0.1, 0, z - 0.008), Vector3(hx0, 0.003, z + 0.008), "shade"); blk(Vector3(hx1, 0, z - 0.008), Vector3(x1 - 0.1, 0.003, z + 0.008), "shade")
		else: blk(Vector3(x0 + 0.1, 0, z - 0.008), Vector3(x1 - 0.1, 0.003, z + 0.008), "shade")
		z += step

## a flat triangle of inlay, for bb_end
func inlay(a: Vector3, b: Vector3, c: Vector3) -> void:
	for q in [a, b, c]:
		bv.append(q); bn.append(Vector3.UP)

## the rosette of the garden floor: a wind rose inlaid in the paving. A border ring, eight long points in two tones
## of stone (each point split down its middle, light and dark), eight short bronze points between them, a red lozenge
## at the head of every other long point, and in the middle a small round basin with a bronze rim
func rosette(c: Vector3, r: float) -> void:
	cyl(c, r, r, 0.005, pal("shade"), 48); cyl(c + Vector3(0, 0.002, 0), r * 0.93, r * 0.93, 0.005, pal("stone"), 48)
	cyl(c + Vector3(0, 0.004, 0), r * 0.8, r * 0.8, 0.004, pal("shade"), 48); cyl(c + Vector3(0, 0.005, 0), r * 0.775, r * 0.775, 0.004, pal("stone"), 48)   # a thin line round the points
	var y0 := 0.0095; var y1 := 0.0105; var y2 := 0.0115
	var at := func(a: float, k: float, y: float) -> Vector3: return c + Vector3(cos(a) * r * k, y, sin(a) * r * k)
	for i in 8:      # the short points lie under the long ones
		var a := TAU * (i + 0.5) / 8.0
		inlay(at.call(a - 0.2, 0.3, y0), at.call(a, 0.56, y0), at.call(a + 0.2, 0.3, y0))
	bb_end("gold")
	for half in 2:
		for i in 8:
			var a := TAU * i / 8.0; var sd := -1.0 if half == 0 else 1.0
			inlay(at.call(a, 0.22, y1), at.call(a, 0.74 if i % 2 == 0 else 0.66, y1), at.call(a + sd * TAU / 16.0, 0.34, y1))
		bb_end("rose" if half == 0 else "shade")
	for i in 4:
		var a := TAU * i / 4.0
		inlay(at.call(a, 0.815, y2), at.call(a + 0.045, 0.865, y2), at.call(a, 0.915, y2)); inlay(at.call(a, 0.815, y2), at.call(a, 0.915, y2), at.call(a - 0.045, 0.865, y2))
	bb_end("crim")
	for i in 4:
		var a := TAU * (i + 0.5) / 4.0
		inlay(at.call(a, 0.83, y2), at.call(a + 0.035, 0.865, y2), at.call(a, 0.9, y2)); inlay(at.call(a, 0.83, y2), at.call(a, 0.9, y2), at.call(a - 0.035, 0.865, y2))
	bb_end("gold")
	cyl(c + Vector3(0, 0.008, 0), r * 0.27, r * 0.27, 0.008, pal("gold"), 40); cyl(c + Vector3(0, 0.0165, 0), r * 0.225, r * 0.225, 0.003, water(), 40)

func parapet(a: Vector3, b: Vector3, h := 0.34) -> void:
	var w := 0.06
	var lo := Vector3(minf(a.x, b.x), 0, minf(a.z, b.z)); var hi := Vector3(maxf(a.x, b.x), 0, maxf(a.z, b.z))
	blk(lo + Vector3(-w, 0, -w), hi + Vector3(w, 0.05, w), "shade")
	blk(lo + Vector3(-w - 0.015, h, -w - 0.015), hi + Vector3(w + 0.015, h + 0.05, w + 0.015), "stone")
	var along_x := (hi.x - lo.x) > (hi.z - lo.z)
	var ln := (hi.x - lo.x) if along_x else (hi.z - lo.z)
	var n := maxi(2, int(ln / 0.2))
	for i in n + 1:
		var c := lo + (Vector3(ln * i / n, 0, 0) if along_x else Vector3(0, 0, ln * i / n))
		if i % 6 == 0 or i == n: bb(c + Vector3(-0.07, 0.05, -0.07), c + Vector3(0.07, h, 0.07))   # (a post at either end: the rail used to end on a thin baluster, or on none)
		else:
			# a baluster with a belly: it swells from its foot, narrows to a neck, and carries a small block under the rail (it was a stick through a cube)
			for sec in [[0.05, 0.024, 0.135, 0.047], [0.135, 0.047, 0.28, 0.019], [0.28, 0.036, h, 0.036]]:
				for sd in [Vector3(1, 0, 0), Vector3(0, 0, 1), Vector3(-1, 0, 0), Vector3(0, 0, -1)]:
					var tn := Vector3(sd.z, 0, -sd.x)
					face_q([c + sd * sec[1] - tn * sec[1] + Vector3(0, sec[0], 0), c + sd * sec[1] + tn * sec[1] + Vector3(0, sec[0], 0), c + sd * sec[3] + tn * sec[3] + Vector3(0, sec[2], 0), c + sd * sec[3] - tn * sec[3] + Vector3(0, sec[2], 0)], sd)
	bb_end("stone")

func tree(p: Vector3, s := 1.0, leaf := "leaf") -> void:
	thing("olive", p, 1.8 * s + 0.25, "leaf:%s~,trunk:trunk,stone:stone,soil:trunk" % leaf, PI * 0.5 * (int(absf(p.x * 3.0 + p.z)) % 4))   # its planter stays square to the court
	decal(p + Vector3(0.3, 0, -0.3), 1.5 * s, 1.1 * s, 0.2, 0.78)

func bush(p: Vector3, s := 1.0, leaf := "leaf2") -> void:
	thing("bush", p, 0.0, "leaf:%s~,flower:crim" % leaf, p.z * 1.9, 0.82 * s)

## a bronze lamp stand: lion paws on a marble footing, a fluted column, a swan-neck arm, and a lantern hanging from it
func lantern(p: Vector3, li: int, dirx := 1.0) -> void:
	var k := 1.78
	var n := Node3D.new(); n.position = p; n.rotation.y = -PI * 0.5 * dirx; add_child(n)      # as made its arm reaches to -Z
	prop_model("lamp", n, 0.0, 0.0, false, false, "gold:gold,stone:marble,glow:lamp,frame:wood").scale = Vector3.ONE * k
	var c := p + Vector3(0.327 * k * dirx, 0.692 * k, 0)      # where the lantern hangs
	var h := halo(0.9, Color(1.0, 0.8, 0.45, 0.5)); h.position = c; add_child(h)
	lights[li] = Vector4(c.x, 0.2, c.z, 0.5)
	blockers.append(Vector3(p.x + 0.26 * dirx, p.z, 0.62))   # the stand and the lantern on its arm: a tap on them sends her beside them, not into them
	decal(p + Vector3(0.1, 0, -0.1), 0.5, 0.36, 0.2, 0.78)

func banner(p: Vector3, w: float, h: float, facing_x := false) -> void:
	var q := QuadMesh.new(); q.size = Vector2(w, h); q.subdivide_depth = 8; q.subdivide_width = 2
	var off := Vector3(0.035, 0, 0) if facing_x else Vector3(0, 0, 0.035)   # clear of the wall: the cloth waves 4 cm either way, and used to dip into the stone
	var mi := prim(q, p + off + Vector3(0, -h * 0.5, 0), cloth(Color("d63a44"), Color("a81f2c"), 1.0))
	if facing_x: mi.rotation.y = PI * 0.5
	blk(p + Vector3(-0.02 if facing_x else -w * 0.5 - 0.03, 0, -w * 0.5 - 0.03 if facing_x else -0.02), p + Vector3(0.055 if facing_x else w * 0.5 + 0.03, 0.04, w * 0.5 + 0.03 if facing_x else 0.055), "gold")

## a lily pad lying on a pool: a round leaf with its notch, and on some a bud
func lily(p: Vector3, r: float, yaw: float, bud: bool) -> void:
	var v := PackedVector3Array(); var n := PackedVector3Array()
	for i in 11:
		var a0 := yaw + 0.27 + (TAU - 0.54) * i / 11.0; var a1 := yaw + 0.27 + (TAU - 0.54) * (i + 1) / 11.0
		for q in [Vector3.ZERO, Vector3(cos(a1), 0, sin(a1)) * r, Vector3(cos(a0), 0, sin(a0)) * r]:
			v.append(q); n.append(Vector3.UP)
	var arr := []; arr.resize(Mesh.ARRAY_MAX); arr[Mesh.ARRAY_VERTEX] = v; arr[Mesh.ARRAY_NORMAL] = n
	var am := ArrayMesh.new(); am.add_surface_from_arrays(Mesh.PRIMITIVE_TRIANGLES, arr)
	prim(am, p, pal("leaf2", "2"))
	if bud:
		var bd := Vector3(cos(yaw + PI), 0, sin(yaw + PI)) * r * 0.3
		cyl(p + bd, 0.03, 0.012, 0.045, pal("rose"), 6); cyl(p + bd, 0.045, 0.03, 0.012, pal("leaf3"), 6)

func pool(x0: float, z0: float, x1: float, z1: float, flow := Vector2.ZERO) -> ShaderMaterial:
	var q := QuadMesh.new(); q.size = Vector2(x1 - x0, z1 - z0); q.orientation = PlaneMesh.FACE_Y
	var wm := water(flow); wm.set_shader_parameter("rect", Vector4(x0, z0, x1, z1))
	prim(q, Vector3((x0 + x1) * 0.5, 0.012, (z0 + z1) * 0.5), wm)
	var r := 0.07
	blk(Vector3(x0 - r, 0, z0 - r), Vector3(x1 + r, 0.05, z0), "shade"); blk(Vector3(x0 - r, 0, z1), Vector3(x1 + r, 0.05, z1 + r), "shade")
	blk(Vector3(x0 - r, 0, z0), Vector3(x0, 0.05, z1), "shade"); blk(Vector3(x1, 0, z0), Vector3(x1 + r, 0.05, z1), "shade")
	return wm

func strip(x0: float, z0: float, x1: float, z1: float, flow: Vector2) -> void:
	var q := QuadMesh.new(); q.size = Vector2(x1 - x0, z1 - z0); q.orientation = PlaneMesh.FACE_Y
	prim(q, Vector3((x0 + x1) * 0.5, 0.006, (z0 + z1) * 0.5), water(flow))

func fall(x: float, zc: float, y0: float, y1: float) -> void:
	var v := PackedVector3Array([Vector3(x, y0, zc + 0.18), Vector3(x, y0, zc - 0.18), Vector3(x, y1, zc - 0.18),
		Vector3(x, y0, zc + 0.18), Vector3(x, y1, zc - 0.18), Vector3(x, y1, zc + 0.18)])
	var arr := []; arr.resize(Mesh.ARRAY_MAX); arr[Mesh.ARRAY_VERTEX] = v
	var am := ArrayMesh.new(); am.add_surface_from_arrays(Mesh.PRIMITIVE_TRIANGLES, arr)
	prim(am, Vector3.ZERO, water(Vector2.ZERO, true))

func islet(o: Vector3, p := "far", q := "far2") -> void:
	blk(o + Vector3(-0.9, -0.14, -0.8), o + Vector3(0.9, 0, 0.8), p)
	blk(o + Vector3(-0.7, -1.1, -0.6), o + Vector3(0.7, -0.14, 0.6), q)
	blk(o + Vector3(-0.45, -2.6, -0.4), o + Vector3(0.45, -1.1, 0.4), p)
	blk(o + Vector3(-0.2, -3.6, -0.2), o + Vector3(0.2, -2.6, 0.2), q)
	blk(o + Vector3(-0.6, 0, -0.62), o + Vector3(0.3, 1.0, -0.36), p); win_z(o.x - 0.15, o.y, o.z - 0.36, 0.36, 0.78, "dark")
	cyl(o + Vector3(0.55, 0, 0.3), 0.04, 0.03, 0.6, pal(q), 8); ball(o + Vector3(0.55, 0.8, 0.3), 0.3, pal("leaf", "sway"))
	for i in 4: blk(o + Vector3(-0.9 - 0.3 * (i + 1), -0.14 - 0.24 * (i + 1), 0.1), o + Vector3(-0.9 - 0.3 * i, -0.24 * (i + 1), 0.5), q)

## a Cycladic head: a smooth shield-shaped face with nothing carved on it but the ridge of the nose
func idol_head(p: Vector3, h: float, yaw := 0.0, tilt := Vector3(-0.22, 0, 0), wide := 1.0, nose := 1.0, parent: Node = self) -> Node3D:
	var n := Node3D.new(); n.position = p; n.rotation = Vector3(tilt.x, yaw, tilt.z); parent.add_child(n)
	var prof := [[0.10, 0.0], [0.25, 0.07], [0.36, 0.22], [0.43, 0.45], [0.45, 0.68], [0.42, 0.86], [0.30, 0.96], [0.0, 1.0]]
	var cs := PackedVector3Array(); var rs := PackedFloat32Array()
	for q in prof:
		cs.append(Vector3(0, q[1] * h, 0)); rs.append(q[0] * h * wide)
	var am := ArrayMesh.new(); am.add_surface_from_arrays(Mesh.PRIMITIVE_TRIANGLES, Fig.lathe(cs, rs, 36))
	prim(am, Vector3.ZERO, pal("marble"), n).scale = Vector3(1, 1, 0.58)
	var pm := PrismMesh.new(); pm.size = Vector3(0.105 * h, 0.1 * h, 0.44 * h * nose)
	var ns := prim(pm, Vector3(0, (0.86 - 0.22 * nose) * h, 0.44 * 0.58 * h * wide + 0.02 * h), pal("marble"), n); ns.rotation.x = PI * 0.5
	cyl(Vector3(0, -0.42 * h, -0.02 * h), 0.17 * h, 0.14 * h, 0.5 * h, pal("marble"), 24, n)
	return n

## a sculpted marble head with some detail, for the large decorative faces
var head_cache := {}
## extra turn for each head so that all of them face the same way
var HEAD_TURN := {1: 0.0, 2: 0.0, 3: 0.0, 4: 0.0}
func _heads_lineup() -> void:
	started = true; title_box.hide(); hint.hide()
	pos = Vector3(60, 0, 60)
	var c := Vector3(0.2, 0, 0.3); var dir := Vector3(1, 0, -1).normalized()
	for i in 4:
		sculpt_head(c + dir * ((i - 1.5) * 1.5) + Vector3(0, 0.6, 0), 1.0, PI * 0.25, Vector3.ZERO, i + 1)
	await get_tree().create_timer(2.0).timeout
	shot = {"c": c + Vector3(0, 0.9, 0), "s": 7.0}; cam.size = 7.0
	await get_tree().create_timer(0.8).timeout
	await RenderingServer.frame_post_draw
	get_viewport().get_texture().get_image().save_png("%s/heads.png" % OS.get_environment("SHOT_DIR"))
	get_tree().quit()
func sculpt_head(p: Vector3, h: float, yaw := 0.0, tilt := Vector3(-0.12, 0, 0), variant := 1, parent: Node = self) -> Node3D:
	var file := ("head%dlp" if OS.get_environment("HEADS") != "smooth" else "head%d") % variant
	if not head_cache.has(file):
		head_cache[file] = null
		var st := GLTFState.new(); var doc := GLTFDocument.new()
		if doc.append_from_buffer(FileAccess.get_file_as_bytes("res://hero_models/%s.glb" % file), "", st) == OK:
			var src := doc.generate_scene(st) as Node3D
			var vs := PackedVector3Array(); var ns := PackedVector3Array(); var ix := PackedInt32Array()
			var turn := Basis(Vector3.UP, (float(OS.get_environment("HEAD_YAW")) if OS.get_environment("HEAD_YAW") != "" else -PI * 0.5) + float(HEAD_TURN.get(variant, 0.0)))
			for m in src.find_children("*", "MeshInstance3D", true, false):
				var mi := m as MeshInstance3D
				var xf := Transform3D.IDENTITY
				var nd: Node = mi
				while nd != null and nd is Node3D:
					xf = (nd as Node3D).transform * xf
					if nd == src: break
					nd = nd.get_parent()
				xf = Transform3D(turn, Vector3.ZERO) * xf
				for si in mi.mesh.get_surface_count():
					var a := mi.mesh.surface_get_arrays(si)
					var base := vs.size()
					var av: PackedVector3Array = a[Mesh.ARRAY_VERTEX]
					var has_n: bool = a[Mesh.ARRAY_NORMAL] != null
					for i in av.size():
						vs.append(xf * av[i]); ns.append((xf.basis * (a[Mesh.ARRAY_NORMAL][i] as Vector3)).normalized() if has_n else Vector3.UP)
					if a[Mesh.ARRAY_INDEX] != null:
						for j in (a[Mesh.ARRAY_INDEX] as PackedInt32Array): ix.append(base + j)
					else:
						for j in av.size(): ix.append(base + j)
			src.free()
			var lo := Vector3.INF; var hi := -Vector3.INF
			for v in vs: lo = lo.min(v); hi = hi.max(v)
			var sc := 1.0 / maxf(hi.y - lo.y, 0.001)
			var c := Vector3((lo.x + hi.x) * 0.5, lo.y, (lo.z + hi.z) * 0.5)
			for i in vs.size(): vs[i] = (vs[i] - c) * sc
			var arr := []; arr.resize(Mesh.ARRAY_MAX); arr[Mesh.ARRAY_VERTEX] = vs; arr[Mesh.ARRAY_NORMAL] = ns; arr[Mesh.ARRAY_INDEX] = ix
			var am := ArrayMesh.new(); am.add_surface_from_arrays(Mesh.PRIMITIVE_TRIANGLES, arr)
			head_cache[file] = am
			print("HEAD ", file, " verts ", vs.size())
	if head_cache[file] == null: return null
	var n := Node3D.new(); n.position = p; n.rotation = Vector3(tilt.x, yaw, tilt.z); parent.add_child(n)
	var mi2 := prim(head_cache[file], Vector3(0, -0.45 * h, 0), pal("marble", "flat2" if file.ends_with("lp") else "2"), n)
	mi2.scale = Vector3.ONE * 1.45 * h
	return n

## a Cycladic figure with folded arms
func idol(p: Vector3, h: float, yaw := 0.0) -> Node3D:
	var n := Node3D.new(); n.position = p; n.rotation.y = yaw; add_child(n)
	cyl(Vector3.ZERO, 0.24 * h / 1.6, 0.22 * h / 1.6, 0.08, pal("shade"), 24, n)
	var prof := [[0.05, 0.0], [0.072, 0.06], [0.082, 0.25], [0.10, 0.42], [0.125, 0.52], [0.097, 0.60], [0.142, 0.735], [0.135, 0.77], [0.055, 0.80], [0.042, 0.86]]
	var cs := PackedVector3Array(); var rs := PackedFloat32Array()
	for q in prof:
		cs.append(Vector3(0, 0.08 + q[1] * h, 0)); rs.append(q[0] * h)
	var am := ArrayMesh.new(); am.add_surface_from_arrays(Mesh.PRIMITIVE_TRIANGLES, Fig.lathe(cs, rs, 36))
	prim(am, Vector3.ZERO, pal("marble"), n).scale = Vector3(1, 1, 0.44)
	for ay in [0.615, 0.655]:
		blk(Vector3(-0.105 * h, 0.08 + ay * h, 0.035 * h), Vector3(0.105 * h, 0.08 + (ay + 0.024) * h, 0.062 * h), "marble", n)
	blk(Vector3(-0.004 * h, 0.08 + 0.02 * h, 0.03 * h), Vector3(0.004 * h, 0.08 + 0.46 * h, 0.047 * h), "shade", n)
	idol_head(Vector3(0, 0.08 + 0.85 * h, 0), 0.17 * h, 0.0, Vector3(-0.3, 0, 0), 1.0, 1.0, n)
	return n

func pose_state(p: Vector3, yaw: float) -> Dictionary:
	return {"pos": p, "yaw": yaw, "dt": 0.016, "phase": 0.0, "wk": 0.0, "wind": Vector3.ZERO, "bob": 0.0, "drop": 0.0, "lean": 0.0, "roll": 0.0, "twist": 0.0,
		"tm": 0.0, "sway": Vector2.ZERO, "pool": 0.0, "kick": 0.0, "head_yaw": 0.0, "head_pitch": 0.12, "swingL": 0.0, "swingR": 0.0, "hold": 0.0, "raise": 0.0, "open": 0.0,
		"wL": 0.0, "wR": 0.0, "tL": Vector3.ZERO, "tR": Vector3.ZERO}

## the sculptor carved her again and again: a veiled figure in marble, in one of a few poses
func her_statue(p: Vector3, yaw: float, pose := "calm", sc := 1.0, parent: Node = self) -> Node3D:
	if shape_file != "":
		var d := spawn_shape(self, "marble")
		var hd: Node3D = d.holder
		hd.position = p; hd.scale = Vector3.ONE * sc
		hd.rotation = Vector3({"mourn": 0.1, "kneel": 0.08, "reach": -0.05}.get(pose, 0.0), yaw, 0.0)
		return hd
	if not hero_real:
		var f = Fig.new(); add_child(f); f.set_style(hero_style); f.build(3, pal, null, null)
		f.scale = Vector3.ONE * sc
		var ps := pose_state(p, yaw)
		var bas := Basis(Vector3.UP, yaw) * sc
		match pose:
			"mourn":
				ps.lean = 0.26; ps.head_pitch = 0.5; ps.drop = 0.06; ps.wL = 1.0; ps.wR = 1.0
				ps.tL = p + bas * Vector3(0.06, 1.5, 0.17); ps.tR = p + bas * Vector3(-0.06, 1.5, 0.17)
			"pray":
				ps.head_pitch = 0.3; ps.wL = 1.0; ps.wR = 1.0
				ps.tL = p + bas * Vector3(0.025, 1.26, 0.2); ps.tR = p + bas * Vector3(-0.025, 1.26, 0.2)
			"kneel": ps.drop = 0.55; ps.pool = 1.0; ps.lean = 0.22; ps.head_pitch = 0.32
			"reach": ps.raise = 1.0; ps.head_pitch = -0.25
			"offer": ps.hold = 1.0; ps.open = 0.25; ps.head_pitch = 0.18
		f.apply(ps)
		return f
	var d := spawn_her(parent, "marble")
	var holder: Node3D = d.holder
	holder.position = p; holder.rotation.y = yaw; holder.scale = Vector3.ONE * sc
	var ap: AnimationPlayer = d.ap; var sk: Skeleton3D = d.sk
	if ap != null and ap.has_animation("idle"):
		ap.play("idle"); ap.seek(fmod(absf(p.x * 1.7 + p.z * 0.9), 12.0), true); ap.stop(true)
	if ap != null and pose == "kneel" and rig_file.begins_with("ione4") and ap.has_animation("kneel") and OS.get_environment("IONE4_KNEEL_STATUE") == "1":      # ione4 has a real kneel (its last frame; she is set forward so that her knee, not her front foot, is over the spot). Off unless asked for: the plinths of the world are cut for a standing figure
		ap.play("kneel"); ap.seek(ap.get_animation("kneel").length, true); ap.stop(true)
		(holder.get_child(0) as Node3D).position.z += 0.3
	if sk == null: return holder
	var la := _bone(sk, "LeftArm"); var ra := _bone(sk, "RightArm")
	if la < 0 or ra < 0: return holder
	var left := (sk.get_bone_global_pose(la).origin - sk.get_bone_global_pose(ra).origin).normalized()
	var up := Vector3.UP; var fwd := left.cross(up).normalized()
	match pose:
		"pray", "offer":
			_aim(sk, "LeftArm", "LeftForeArm", fwd * 0.8 - up * 0.5 - left * 0.25); _aim(sk, "RightArm", "RightForeArm", fwd * 0.8 - up * 0.5 + left * 0.25)
			_bend(sk, "Head", left, 0.3)
		"reach":
			_aim(sk, "RightArm", "RightForeArm", up * 0.9 + fwd * 0.45); _bend(sk, "Head", left, -0.25)
		"point", "pointl", "point2":     # an arm held straight out before her (the right, the left, or both): the way she faces is plain from any side
			var lift := 0.08
			for side in (["Right"] if pose == "point" else ["Left"] if pose == "pointl" else ["Right", "Left"]):
				var out: Vector3 = left * (0.05 if side == "Right" else -0.05)
				_aim(sk, side + "Arm", side + "ForeArm", fwd * 1.0 + up * lift + out); _aim(sk, side + "ForeArm", side + "Hand", fwd * 1.0 + up * lift)
				_gild_arm(holder, sk, side)
		"mourn", "kneel":
			_bend(sk, "Spine", left, 0.3 if pose == "mourn" else 0.45)
			_aim(sk, "LeftArm", "LeftForeArm", fwd * 0.7 + up * 0.25 - left * 0.3); _aim(sk, "RightArm", "RightForeArm", fwd * 0.7 + up * 0.25 + left * 0.3)
			_bend(sk, "Head", left, 0.45)
	return holder

func model(nm: String, pos: Vector3, height: float, yaw := 0.0, tilt := Vector3.ZERO, _p := "marble") -> Node3D:
	if nm.begins_with("kit_face") or nm == "colossus_head_veiled":
		var k := float(nm.unicode_at(nm.length() - 1) % 5)
		if OS.get_environment("HEADS") != "old":
			var hv := 2 if nm == "colossus_head_veiled" else 1 + int(k) % 4
			var sh := sculpt_head(pos + Vector3(0, height * 0.3, 0), height * 0.7, yaw, Vector3(-0.12 + tilt.x, 0, tilt.z), hv)
			if sh != null: return sh
		return idol_head(pos + Vector3(0, height * 0.3, 0), height * 0.7, yaw, Vector3(-0.2 + tilt.x, 0, tilt.z), 0.9 + 0.05 * k, 0.85 + 0.07 * k)
	if nm == "observer_veiled": return her_statue(pos, yaw, "calm", height / 1.7)
	if nm == "statue_veiled_broken": return idol(pos, height, yaw)
	if nm == "statue_veiled_kneeling": return her_statue(pos, yaw, "kneel", 1.0)
	if nm == "statue_veiled_mourning": return her_statue(pos, yaw, "mourn", height / 1.7)
	if nm == "statue_veiled_praying": return her_statue(pos, yaw, "pray", height / 1.7)
	if nm == "statue_veiled_unfinished": return her_statue(pos, yaw, "offer", height / 1.7)
	return null

# ---------------------------------------------------------------- setup
## the hollows under the courts that have a pool (x0, z0, x1, z1): nothing of the sea is drawn inside them. A world
## built by a script that extends this one names its own
func _hollows() -> Array:
	return [[-6.0, -3.5, 3.0, 5.0], [-2.9, -18.1, 5.5, -10.5], [-21.8, -16.4, -13.5, -10.0], [-21.7, -40.3, -13.7, -33.1]]

func _hollow_glsl(v: String) -> String:
	var parts := []
	for h in _hollows(): parts.append("(%s.x > %.3f && %s.x < %.3f && %s.z > %.3f && %s.z < %.3f)" % [v, h[0], v, h[2], v, h[1], v, h[3]])
	return " || ".join(parts) if not parts.is_empty() else "false"

func _ready() -> void:
	for k in [["base", SH], ["two", SH.replace("render_mode ambient_light_disabled, specular_disabled;", "render_mode ambient_light_disabled, specular_disabled, cull_disabled;")],
			["mir", SH.replace("render_mode ambient_light_disabled, specular_disabled;", "render_mode ambient_light_disabled, specular_disabled, cull_disabled, shadows_disabled;")],
			["water", SH_WATER], ["cloth", SH_CLOTH], ["sheet", SH_SHEET], ["mirror", SH_MIRROR], ["ring", SH_RING], ["sea", SH_SEA], ["refl", SH_REFL], ["glass", SH_GLASS], ["pit", SH_PIT], ["face", SH_FACE], ["foam", SH_FOAM], ["fog", SH_FOG], ["shard", SH_SHARD], ["pane", SH_PANE]]:
		var s := Shader.new(); s.code = (k[1] as String).replace("//GLINT", GLSL_GLINT).replace("HOLLOW_Q", _hollow_glsl("q")).replace("HOLLOW_WP", _hollow_glsl("wp")); shaders[k[0]] = s
	# the joined world (see _lighten): one material for every still piece, whatever its colour. The three tones of its
	# palette and its marble, tone and flat-face settings ride in the vertices instead of in the material
	for two in [false, true]:
		var parts := (shaders["two" if two else "base"] as Shader).code.split("void fragment(){")
		var head := parts[0].replace("uniform vec3 c_top : source_color; uniform vec3 c_z : source_color; uniform vec3 c_x : source_color;", "varying vec3 c_top; varying vec3 c_z; varying vec3 c_x; varying vec3 v_par;")
		head = head.replace("void vertex(){\n", "void vertex(){\n	c_top = CUSTOM0.rgb; c_z = CUSTOM1.rgb; c_x = CUSTOM2.rgb; v_par = vec3(CUSTOM0.a, CUSTOM1.a, CUSTOM2.a);\n")
		head = head.replace("if (sway > 0.0) { float k = sway * clamp(VERTEX.y + 0.3, 0.0, 2.0);", "float sw1 = max(CUSTOM2.a - 1.0, 0.0); if (sw1 > 0.0) { float k = sw1 * clamp(VERTEX.y + 0.3, 0.0, 2.0);")
		var body := parts[1]
		var rx := RegEx.new()
		for pair in [["marble", "v_par.x"], ["tone_var", "v_par.y"], ["flat_n", "v_par.z"]]:
			rx.compile("\\b%s\\b" % pair[0]); body = rx.sub(body, pair[1], true)
		var so := Shader.new(); so.code = head + "void fragment(){" + body; shaders["one2" if two else "one"] = so
	if OS.get_environment("MOOD") == "moody":
		sea_c = Color("3a6a7b"); mist_c = Color("b9b4c4"); bg_c = Color("29586a"); shadow_c = Vector3(0.6, 0.61, 0.82); water_deep = Color("2a7d88"); water_shallow = Color("6fc4b8")
	if OS.get_environment("REFL") != "0":
		refl_mat = ShaderMaterial.new(); refl_mat.shader = shaders["refl"]; refl_mat.set_shader_parameter("water_y", WATER)
		refl_mat.set_shader_parameter("under_col", Vector3(bg_c.r, bg_c.g, bg_c.b))
		if OS.get_environment("REFL") != "": refl_mat.set_shader_parameter("strength", float(OS.get_environment("REFL")))
		timed.append(refl_mat)
	pals = PALS.duplicate(true)
	statue_cream = OS.get_environment("STATUES") != "white"
	if OS.get_environment("PAL") == "mono":
		for k in ["leaf", "leaf2", "leaf3"]: pals[k] = ["e6e4e3", "d0ced2", "a8a7b8"]
		pals["cyp"] = ["bfc2ca", "9fa3b1", "787c92"]; pals["trunk"] = ["b3acae", "958e95", "6f6b7d"]
		pals["gold"] = ["ece7de", "d5cfc9", "a4a0b0"]; pals["terra"] = ["f3ede6", "dfd6d0", "aca6b8"]; pals["rose"] = ["f3ede6", "dfd6d0", "aca6b8"]
		pals["wood"] = ["cbc4c2", "aca5a8", "827d8e"]; pals["dark"] = ["9796aa", "86859e", "767592"]; pals["teal"] = ["66728a", "66728a", "66728a"]
		pals["stone"] = ["fbf8f3", "ebe4e0", "b7b2c6"]; pals["shade"] = ["efeae4", "dcd4d0", "a6a1b6"]; pals["sand"] = ["f7f2ec", "e6ddd8", "b0aabf"]
		pals["dress"] = ["dfe0e5", "c5c6d0", "9a9bb0"]; pals["veil"] = ["f6f5f4", "e0dfe3", "b2b2c2"]; pals["skin"] = ["fbf6f0", "e9e0da", "bcb5c6"]; shadow_c = Vector3(0.7, 0.7, 0.84)
		sea_c = Color("a7b8c1"); mist_c = Color("e4e0e3"); water_deep = Color("a3b6be"); water_shallow = Color("dbe5e6"); bg_c = Color("9dafb9")
	var tones := {
		"dusk": [["fbe9d9", "f0cdb8", "b98fa0"], ["f3dcc9", "e2bba6", "a57f94"], "5f4a78", "e9bba9", "8a6a94", "f0b7a6", Vector3(0.74, 0.58, 0.74), ["77708f", "5b567c", "433f66"], ["b9a0ab", "988392", "72617a"]],
		"night": [["dfe6f4", "b9c5e0", "7f8ab8"], ["cfd8ec", "a9b6d6", "7480ae"], "1f2f5c", "3d4d7e", "24407a", "6a90cc", Vector3(0.52, 0.58, 0.84), ["3f5f7a", "2f4a66", "213552"], ["6f8fa8", "567690", "3d5a78"]],
		"jade": [["fbf3e3", "ecdcc6", "b3a9a6"], ["f1e7d4", "dccab2", "a39a98"], "2f8f7f", "cfe6d6", "2a9a86", "9fe6cf", Vector3(0.64, 0.74, 0.76), ["3f7f6a", "2c6457", "1f4a48"], ["a5caa4", "7dab89", "56877b"]],
		"dawn": [["fffaf4", "fbe3dc", "d9b9cf"], ["fbf0e8", "f1d3cc", "c8a8c0"], "e8a6a4", "fde3d6", "e39a9c", "ffd9cc", Vector3(0.84, 0.68, 0.82), ["9a9ab8", "7c7ca6", "5e5e8e"], ["cdbac9", "ae9cb5", "8c7b9e"]],
	}
	var bold := {
		"coral": [["ffe9d2", "ff9f8a", "b0527e"], ["ffd9bd", "f08874", "9a4470"], "1f6f8f", "8fc0cc", "1f8fa0", "8fe6dc", Vector3(0.62, 0.5, 0.78), ["2f7a6a", "1f6058", "154648"], ["8fd0a8", "5fae8c", "3a8474"]],
		"citrus": [["fff3c4", "ffc24a", "e0703c"], ["ffe7a8", "f2ae36", "c85e30"], "2b4a9b", "8ea6dc", "2f5fb8", "9fc4ff", Vector3(0.72, 0.55, 0.62), ["2f7f5a", "226648", "164c3a"], ["9fd27a", "74b05a", "4c8848"]],
		"lagoon": [["eafff4", "7fe0c4", "3a9aa8"], ["d6f7e6", "68cdb2", "2f8696"], "20306e", "7f8fc8", "2a3f8c", "8fb0ff", Vector3(0.5, 0.62, 0.8), ["2a6a7a", "1f5466", "153e52"], ["bfeec0", "8fd09c", "5fa884"]],
		"rosewater": [["fff0f3", "f7a8c4", "9a6ad0"], ["ffe0e8", "e892b2", "865abc"], "3fb8c8", "b9e6ea", "36a8ba", "b6f2ee", Vector3(0.7, 0.56, 0.84), ["5a6ab0", "46549a", "343f80"], ["cfe0a8", "a6c486", "7ea070"]],
	}
	var bn := OS.get_environment("PAL")
	if bold.has(bn):
		var tb: Array = bold[bn]
		pals["stone"] = tb[0]; pals["sand"] = tb[0]; pals["shade"] = tb[1]; pals["terra"] = tb[1]; pals["rose"] = tb[1]
		sea_c = Color(tb[2]); mist_c = Color(tb[3]); water_deep = Color(tb[4]); water_shallow = Color(tb[5]); bg_c = Color(tb[2]).darkened(0.2); shadow_c = tb[6]
		pals["cyp"] = tb[7]; pals["leaf"] = tb[8]; pals["leaf2"] = tb[8]; pals["leaf3"] = tb[8]
		mist_k = 0.55; fog_k = 0.4
	var pn := OS.get_environment("PAL")
	if tones.has(pn):
		var tn: Array = tones[pn]
		pals["stone"] = tn[0]; pals["sand"] = tn[0]; pals["marble"] = tn[0]; pals["skin"] = tn[0]; pals["shade"] = tn[1]; pals["terra"] = tn[1]; pals["rose"] = tn[1]
		sea_c = Color(tn[2]); mist_c = Color(tn[3]); water_deep = Color(tn[4]); water_shallow = Color(tn[5]); bg_c = Color(tn[2]).darkened(0.15); shadow_c = tn[6]
		pals["cyp"] = tn[7]; pals["leaf"] = tn[8]; pals["leaf2"] = tn[8]; pals["leaf3"] = tn[8]
		pals["dress"] = [Color(tn[1][0]).darkened(0.08).to_html(false), Color(tn[1][1]).darkened(0.1).to_html(false), Color(tn[1][2]).darkened(0.1).to_html(false)]
		pals["veil"] = tn[0]
	if OS.get_environment("HERO") != "": hero_style = int(OS.get_environment("HERO"))
	if OS.get_environment("SEPIA") != "0":   # warm sepia cast on the world's marble so a white figure stands out
		var sep := float(OS.get_environment("SEPIA")) if OS.get_environment("SEPIA") != "" else 0.34
		sepia_var = float(OS.get_environment("SEPIA_VAR")) if OS.get_environment("SEPIA_VAR") != "" else 1.0
		for sep_name in ["stone", "shade", "sand", "marble"]:
			var src_p: Array = pals[sep_name]; var out_p := []
			for k in src_p.size():
				var c0 := Color(String(src_p[k])); var tn0 := Color(0.955, 0.875, 0.745) if k < 2 else Color(0.97, 0.92, 0.85)
				out_p.append(Color(lerpf(c0.r, c0.r * tn0.r, sep), lerpf(c0.g, c0.g * tn0.g, sep), lerpf(c0.b, c0.b * tn0.b, sep)).to_html(false))
			pals[sep_name] = out_p
	if statue_cream: pals["marble"] = (pals["stone"] as Array).duplicate(); pals["skin"] = (pals["stone"] as Array).duplicate()
	# the built world a shade deeper than its statues and its heroine, so that they stand out against it. (Found by
	# accident, when the joined world came out much darker; this is a part of that. DEPTH=0 is the old pale world.)
	var depth := float(OS.get_environment("DEPTH")) if OS.get_environment("DEPTH") != "" else WORLD_DEPTH
	if depth > 0.0:
		for dn in ["stone", "shade", "sand", "rose", "terra"]:
			var deep := []
			for hx in pals[dn]:
				var c0 := Color(hx); deep.append(c0.lerp(c0.srgb_to_linear(), depth).to_html(false))
			pals[dn] = deep
	hero_real = OS.get_environment("REAL") == "1"
	if OS.get_environment("RIG") != "": rig_file = OS.get_environment("RIG") if (OS.get_environment("RIG").begins_with("hq") or OS.get_environment("RIG").begins_with("veil") or OS.get_environment("RIG").begins_with("w") or OS.get_environment("RIG").begins_with("lp") or OS.get_environment("RIG").begins_with("sr") or OS.get_environment("RIG").begins_with("nb") or OS.get_environment("RIG").begins_with("ione")) else "min" + OS.get_environment("RIG"); hero_real = true
	elif OS.get_environment("SHAPE") == "" and OS.get_environment("HERO") == "" and not hero_real: rig_file = "wrap3r"; hero_real = true
	if OS.get_environment("SHAPE") != "": shape_file = "min" + OS.get_environment("SHAPE")
	elif not hero_real and OS.get_environment("HERO") == "": shape_file = "min9t"
	var sb := Shader.new()
	sb.code = SH.replace("render_mode ambient_light_disabled, specular_disabled;", "render_mode ambient_light_disabled, specular_disabled, cull_disabled;").replace(
		"void fragment(){", "float bx(vec2 p, vec2 a, vec2 b){ vec2 q = step(a, p) * step(p, b); return q.x * q.y; }\nfloat key(vec2 p){ float m = bx(p, vec2(0.0, 0.76), vec2(0.86, 0.9)); m = max(m, bx(p, vec2(0.72, 0.24), vec2(0.86, 0.9))); m = max(m, bx(p, vec2(0.3, 0.24), vec2(0.86, 0.38))); m = max(m, bx(p, vec2(0.3, 0.24), vec2(0.44, 0.62))); m = max(m, bx(p, vec2(0.3, 0.48), vec2(0.58, 0.62))); m = max(m, bx(p, vec2(0.0, 0.06), vec2(0.14, 0.9))); m = max(m, bx(p, vec2(0.0, 0.06), vec2(1.0, 0.14))); return m; }\nvoid fragment(){").replace(
		"void vertex(){", "void pull(vec3 p, vec3 ra, vec3 rb, vec3 na, vec3 nb, float sig, inout vec3 acc, inout float ws){ vec3 ab = rb - ra; float tt = clamp(dot(p - ra, ab) / max(dot(ab, ab), 1e-5), 0.0, 1.0); vec3 c = ra + ab * tt; float d = length(p - c); float w = exp(-d * d / (sig * sig)); vec3 dl = mix(na, nb, tt) - c; float fr = smoothstep(-0.05, 0.05, p.z - leg_zc); dl.z = mix(min(dl.z, 0.0), max(dl.z, 0.0), fr); acc += w * dl; ws += w * mix(0.35, 1.0, step(0.0001, abs(dl.z))); }\nvoid vertex(){").replace(
		"uniform vec3 fog_col : source_color;", "uniform vec3 fog_col : source_color; uniform sampler2D albedo_tex : source_color, filter_linear_mipmap; uniform float use_tex = 0.0; uniform float tex_gain = 1.22; uniform vec3 veil_col = vec3(0.9, 0.9, 0.92); varying float notex; uniform vec3 trail = vec3(0.0);
uniform vec3 hipL; uniform vec3 kneeL; uniform vec3 footL; uniform vec3 hipR; uniform vec3 kneeR; uniform vec3 footR;
uniform vec3 rkneeL; uniform vec3 rfootL; uniform vec3 rkneeR; uniform vec3 rfootR;
uniform vec4 armp = vec4(0.17, 1.4, -0.01, -0.012); uniform float arm_on = 0.0; uniform float adduct = 0.0; uniform vec2 swing = vec2(0.0);
uniform float design = 0.0; uniform float geo = 0.0; uniform float crim_line = 0.0; uniform vec3 o_rim : source_color = vec3(1.0, 0.95, 0.85); uniform vec3 d_shade = vec3(0.64, 0.62, 0.8); uniform float d_sheen = 0.14; uniform float trim = 1.0;
uniform float orn = 0.0; uniform float plain = 0.0; uniform sampler2D veil_mask : source_color, filter_linear_mipmap; uniform float use_mask = 0.0; uniform float fore_y = -1.0; uniform float key_n = 24.0; uniform float sash_y = -1.0; uniform float brace_y = -1.0; uniform float veil_y = 1.46;
uniform vec3 o_dress_hi : source_color = vec3(0.8, 0.81, 0.86); uniform vec3 o_dress_lo : source_color = vec3(0.55, 0.57, 0.68);
uniform vec3 o_veil : source_color = vec3(0.97, 0.96, 0.93); uniform vec3 o_marble : source_color = vec3(0.99, 0.97, 0.94);
uniform vec3 o_crim : source_color = vec3(0.72, 0.13, 0.18); uniform vec3 o_gold : source_color = vec3(0.87, 0.7, 0.34);
varying vec3 mp; varying float armw; varying float vw;
uniform float pelv = 0.0; uniform float shtw = 0.0; uniform vec2 leg_sig = vec2(0.3, 0.11); uniform vec2 leg_hang = vec2(0.06, 0.25); uniform float leg_zc = 0.0; uniform vec3 grad_lo = vec3(0.74, 0.75, 0.84); varying float hv;").replace(
		"	vec3 w0 = (MODEL_MATRIX * vec4(VERTEX, 1.0)).xyz;", """	float hh = clamp(VERTEX.y / 1.72, 0.0, 1.0); hv = hh; notex = COLOR.g; mp = VERTEX; vw = COLOR.r;
	float wgt = pow(1.0 - smoothstep(0.0, 0.62, hh), 1.5);
	float rr = length(VERTEX.xz); vec2 rad = VERTEX.xz / max(rr, 0.001); float ang = atan(VERTEX.x, VERTEX.z);
	float edge = smoothstep(0.03, 0.16, rr);
	{
		float axx = abs(VERTEX.x - armp.w); float sd = sign(VERTEX.x - armp.w);
		float bl = mix(0.215, 0.127, smoothstep(0.92, 1.16, VERTEX.y));
		float wl = smoothstep(bl - 0.015, bl + 0.015, axx) * step(0.6, VERTEX.y);
		float wu = smoothstep(0.115, 0.19, axx) * (1.0 - smoothstep(1.3, 1.47, VERTEX.y));
		float aw = mix(wl, wu, smoothstep(1.14, 1.26, VERTEX.y)) * arm_on; armw = aw;
		vec3 pv = vec3(armp.w + sd * armp.x, armp.y, armp.z); vec3 q = VERTEX - pv;
		float bb = -adduct * sd * aw; q.xy = vec2(q.x * cos(bb) - q.y * sin(bb), q.x * sin(bb) + q.y * cos(bb));
		float aa = -(sd > 0.0 ? swing.x : swing.y) * aw; q.yz = vec2(q.y * cos(aa) - q.z * sin(aa), q.y * sin(aa) + q.z * cos(aa));
		VERTEX = pv + q;
		float ta = shtw * smoothstep(0.95, 1.3, VERTEX.y) + pelv * smoothstep(0.5, 0.85, VERTEX.y) * (1.0 - smoothstep(1.0, 1.25, VERTEX.y));
		VERTEX.xz = vec2(VERTEX.x * cos(ta) + VERTEX.z * sin(ta), -VERTEX.x * sin(ta) + VERTEX.z * cos(ta));
		if (VERTEX.y < 1.0) {
			vec3 p0 = VERTEX; vec3 acc = vec3(0.0); float ws = 0.0; float lo = smoothstep(0.05, 0.4, p0.y);
			float sig = mix(leg_sig.x, leg_sig.y, lo);
			pull(p0, hipL, rkneeL, hipL, kneeL, sig, acc, ws); pull(p0, rkneeL, rfootL, kneeL, footL, sig, acc, ws);
			pull(p0, hipR, rkneeR, hipR, kneeR, sig, acc, ws); pull(p0, rkneeR, rfootR, kneeR, footR, sig, acc, ws);
			VERTEX += acc / (ws + mix(leg_hang.x, leg_hang.y, lo)) * (1.0 - smoothstep(0.78, 1.0, p0.y));
		}
	}
	VERTEX.xz += trail.xz * wgt;
	vec2 tv = trail.xz * 0.35; tv.y = max(tv.y, -0.012);
	VERTEX.xz += (tv + vec2(sin(time_s * 1.3 + VERTEX.y * 9.0), 0.6 + cos(time_s * 1.05 + VERTEX.x * 14.0)) * 0.006) * COLOR.r;
	VERTEX.xz += rad * (sin(time_s * 1.4 + ang * 3.0 + hh * 5.0) * 0.016 + sin(time_s * 0.8 - ang * 2.0) * 0.01) * wgt * edge;
	VERTEX.y += trail.y * wgt * edge * (0.6 + 0.4 * sin(time_s * 1.1 + ang * 2.0));
	vec3 w0 = (MODEL_MATRIX * vec4(VERTEX, 1.0)).xyz;""").replace(
		"	col *= mix(0.9, 1.0, clamp(smoothstep(-1.6, -0.1, wp.y) + wt, 0.0, 1.0));",
		"	if (use_tex > 0.0) { vec3 t0 = texture(albedo_tex, UV).rgb; float fl = smoothstep(0.035, 0.09, t0.r - t0.g) * (1.0 - smoothstep(0.24, 0.34, t0.r - t0.g)) * smoothstep(0.02, 0.07, t0.g - t0.b) * smoothstep(0.45, 0.6, t0.r); t0 = mix(t0, vec3(0.95, 0.94, 0.93) * (0.86 + 0.14 * dot(t0, vec3(0.34))), fl); vec3 tx = mix(t0, veil_col, notex); tx = mix(tx, vec3(dot(tx, vec3(0.3, 0.55, 0.15))), 0.08); col = tx * tex_gain * (wt * wt + 0.95 * wz * wz + 0.82 * wx * wx + 0.74 * (1.0 - min(s, 1.0))); }\n	col *= mix(mix(grad_lo, vec3(1.0), smoothstep(0.0, 0.86, hv)), vec3(1.0), use_tex);\n" + ORN_FRAG + DESIGN_FRAG)
	shaders["body"] = sb
	var sk2 := Shader.new()
	var i0 := sb.code.find("void pull("); var i1 := sb.code.find("float bx(vec2 p")
	sk2.code = sb.code.substr(0, i0) + "void vertex(){\n	mp = CUSTOM0.xyz; hv = clamp(mp.y / 1.72, 0.0, 1.0); notex = 0.0; vw = 0.0; armw = 0.0;\n	wp = (MODEL_MATRIX * vec4(VERTEX, 1.0)).xyz; wn = normalize((MODEL_MATRIX * vec4(NORMAL, 0.0)).xyz);\n}\n" + sb.code.substr(i1)
	shaders["bodyskin"] = sk2
	var st2 := Shader.new()
	st2.code = SH.replace("uniform vec3 fog_col : source_color;", "uniform vec3 fog_col : source_color; uniform sampler2D albedo_tex : source_color, filter_linear_mipmap; uniform float vcol = 0.0; uniform vec3 tint = vec3(1.0); uniform float floor_y = -1000.0; uniform float snap = 0.0; uniform float recol3 = 0.0; uniform float rc_detail = 1.0; uniform float wrap_lift = 0.0; uniform vec3 wrap_col = vec3(0.76, 0.32, 0.235); uniform float wrap_ref = 0.27; uniform float rc_split = 1.26; uniform float recol2 = 0.0; uniform float recol = 0.0; uniform vec3 rc_gown = vec3(0.8); uniform vec3 rc_veil = vec3(0.6, 0.13, 0.2); uniform vec3 rc_trim = vec3(0.87, 0.7, 0.3); varying vec3 mpos; varying float mveil;").replace(
		"void fragment(){", "float h31(vec3 p){ return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453); } float n3(vec3 p){ vec3 i = floor(p); vec3 f = fract(p); f = f * f * (3.0 - 2.0 * f); return mix(mix(mix(h31(i), h31(i + vec3(1.0, 0.0, 0.0)), f.x), mix(h31(i + vec3(0.0, 1.0, 0.0)), h31(i + vec3(1.0, 1.0, 0.0)), f.x), f.y), mix(mix(h31(i + vec3(0.0, 0.0, 1.0)), h31(i + vec3(1.0, 0.0, 1.0)), f.x), mix(h31(i + vec3(0.0, 1.0, 1.0)), h31(i + vec3(1.0, 1.0, 1.0)), f.x), f.y), f.z); }\nvec3 snapc(vec3 lin){ vec3 c = lin; vec3 best = vec3(0.165, 0.54, 0.58); float bd = distance(c, vec3(0.24, 0.61, 0.65)); float d = distance(c, vec3(0.9, 0.82, 0.65)); if (d < bd) { bd = d; best = vec3(0.955, 0.935, 0.885); } d = distance(c, vec3(0.89, 0.725, 0.3)); if (d < bd) { bd = d; best = vec3(0.86, 0.68, 0.29); } d = distance(c, vec3(0.89, 0.89, 0.88)); if (d < bd) { bd = d; best = vec3(0.965, 0.955, 0.94); } d = distance(c, vec3(0.78, 0.2, 0.18)); if (d < bd) { bd = d; best = vec3(0.75, 0.19, 0.23); } return best; }\nvoid fragment(){").replace(
		"	vec3 w0 = (MODEL_MATRIX * vec4(VERTEX, 1.0)).xyz;", "	mpos = CUSTOM0.xyz; mveil = CUSTOM0.w;\n	vec3 w0 = (MODEL_MATRIX * vec4(VERTEX, 1.0)).xyz;\n	if (w0.y < floor_y + 0.012) { VERTEX += (inverse(MODEL_MATRIX) * vec4(0.0, floor_y + 0.012 - w0.y, 0.0, 0.0)).xyz; w0.y = floor_y + 0.012; }").replace(
		"vec3 col = c_top * wt * wt + c_z * wz * wz + c_x * wx * wx + c_x * 0.86 * (1.0 - min(s, 1.0));",
		"vec3 tx = vcol > 0.5 ? mix(vec3(0.77, 0.765, 0.76), vec3(0.59, 0.246, 0.162), step(0.5, COLOR.a)) : texture(albedo_tex, UV).rgb; if (snap > 0.5) tx = snapc(tx); if (wrap_lift > 0.5) { float rw9 = smoothstep(0.08, 0.2, tx.r - tx.b); float tl9 = dot(tx, vec3(0.3, 0.55, 0.15)); float cr9 = tl9 / wrap_ref; float sr9 = tl9 / 0.84; float ao9 = 1.0; if (vcol > 0.5) { float w9 = clamp(fwidth(COLOR.a) * 0.8, 0.003, 0.2); rw9 = smoothstep(0.5 - w9, 0.5 + w9, COLOR.a); cr9 = COLOR.r * 2.0; sr9 = COLOR.g * 1.824; ao9 = COLOR.b; } float fc9 = wt * wt * 1.1 + wz * wz * 0.96 + wx * wx * 0.7; float gr9 = n3(mpos * 150.0) - 0.5; float mo9 = n3(mpos * 8.0) - 0.5; vec3 cl9 = wrap_col * clamp(cr9, 0.72, 1.14) * mix(1.0, fc9, 0.75) * (1.0 + gr9 * mix(0.09, 0.035, vcol) + mo9 * mix(0.1, 0.06, vcol)); float vn9 = abs(sin((mpos.x * 1.3 + mpos.y * 0.9 + mpos.z * 0.7) * 8.0 + n3(mpos * 5.0) * 6.0)); float vm9 = (1.0 - smoothstep(0.0, 0.07, vn9)) * smoothstep(0.3, 0.55, n3(mpos * 2.3 + 7.0)); float vn8 = abs(sin((mpos.x * -1.1 + mpos.y * 1.2 + mpos.z * 0.5) * 5.0 + n3(mpos * 4.0 + 3.0) * 7.0)); vm9 = max(vm9, (1.0 - smoothstep(0.0, 0.045, vn8)) * 0.7); vec3 mb9 = vec3(0.975, 0.97, 0.962) * clamp(sr9, 0.86, 1.03); mb9 = mix(mb9, mix(vec3(0.6, 0.61, 0.66), vec3(0.74, 0.735, 0.75), vcol), vm9 * mix(0.55, 0.34, vcol)); mb9 = mix(mb9, tx, (1.0 - smoothstep(0.3, 0.5, tl9)) * (1.0 - vcol)); tx = mix(mb9 * mix(0.84, 1.0, ao9), cl9 * mix(0.78, 1.0, smoothstep(0.0, 0.6, ao9)), rw9); } if (recol3 > 0.5) { float lum3 = dot(tx, vec3(0.3, 0.55, 0.15)); float cl3 = smoothstep(0.02, 0.06, tx.b - tx.r); float vw3 = mveil < -0.5 ? smoothstep(rc_split - 0.04, rc_split + 0.04, mpos.y) : smoothstep(0.3, 0.6, mveil); vec3 cc3 = mix(rc_gown, rc_veil, vw3); float gw3 = 1.0 - vw3; float vd3 = mveil - 1.0; float vb3 = step(0.0, vd3) * smoothstep(0.016, 0.022, vd3) * (1.0 - smoothstep(0.034, 0.04, vd3)) * rc_detail; cc3 = mix(cc3, rc_gown, vb3 * 0.5); cc3 *= mix(1.0, 0.9, step(0.5, mveil) * (1.0 - step(0.9, mveil))); float ang3 = atan(mpos.z, mpos.x); float fold3 = clamp(1.0 + (lum3 - 0.66) * 1.5, 0.74, 1.14); float pl3 = smoothstep(-0.35, 0.35, sin(ang3 * 24.0 + sin(mpos.y * 6.0) * 0.7)); float plw3 = gw3 * smoothstep(1.02, 0.55, mpos.y) * rc_detail; float mot3 = sin(mpos.x * 37.0 + mpos.y * 11.0) * sin(mpos.y * 29.0 + mpos.z * 17.0) * sin(mpos.z * 41.0 + mpos.x * 7.0); float thr3 = sin(ang3 * 70.0 + mpos.y * 3.0) * (1.0 - gw3); float rim3 = pow(1.0 - abs(dot(normalize(NORMAL), normalize(VIEW))), 2.2); cc3 *= mix(1.0, mix(0.9, 1.04, pl3), plw3) * (1.0 + (0.035 * mot3 + 0.03 * thr3) * rc_detail); cc3 *= 1.0 - 0.1 * rc_detail * gw3 * smoothstep(rc_split - 0.13, rc_split - 0.03, mpos.y) * step(abs(mpos.x), 0.26); float hb3 = (1.0 - smoothstep(0.05, 0.062, mpos.y)) * rc_detail; float hl3 = smoothstep(0.078, 0.088, mpos.y) * (1.0 - smoothstep(0.104, 0.114, mpos.y)) * rc_detail; cc3 = mix(cc3, rc_gown * vec3(0.72, 0.78, 0.92), hb3); cc3 = mix(cc3, rc_veil, hl3 * 0.85); cc3 = mix(cc3, vec3(1.0), rim3 * mix(0.3, 0.14, gw3) * rc_detail); tx = mix(tx, cc3 * mix(clamp(0.6 + lum3 * 0.5, 0.86, 1.08), fold3, rc_detail), cl3); } if (recol2 > 0.5) { float lv = dot(tx, vec3(0.3, 0.55, 0.15)); float mx = max(tx.r, max(tx.g, tx.b)); float mn = min(tx.r, min(tx.g, tx.b)); float sat = (mx - mn) / max(mx, 0.001); float gold = step(0.5, tx.r) * step(0.38, tx.g) * step(0.22, tx.r - tx.b); float crim = smoothstep(0.2, 0.3, tx.r - tx.g) * (1.0 - step(0.4, tx.g)); float body = step(mpos.y, 1.16) * step(abs(mpos.x), 0.3); float teal = smoothstep(0.02, 0.1, min(tx.g, tx.b) - tx.r) * (1.0 - smoothstep(0.75, 0.9, lv)); float gown = max(max(teal, body), crim); tx = mix(tx, rc_gown * clamp(0.95 + (lv - 0.35) * 0.3, 0.92, 1.08), gown); float lowsat = (1.0 - smoothstep(0.12, 0.26, sat)) * smoothstep(0.45, 0.62, lv); float top = step(1.56, mpos.y); float isveil = max(max(lowsat, gold), top) * step(abs(mpos.x), 0.27) * step(1.16, mpos.y) * (1.0 - gown * (1.0 - top)); tx = mix(tx, rc_veil * mix(0.93, clamp(lv / 0.8, 0.78, 1.08), lowsat), isveil); } if (recol > 0.5) { float rg0 = tx.r - tx.g; float lz0 = dot(tx, vec3(0.3, 0.55, 0.15)); float isv = smoothstep(0.18, 0.3, rg0) * (1.0 - step(0.35, tx.g)); float isg = step(0.5, tx.g) * step(0.25, tx.r - tx.b); float arm = step(0.19, abs(mpos.x)) * step(1.2, mpos.y); vec3 oo = mix(rc_gown * clamp(lz0 / 0.8, 0.8, 1.12), vec3(0.96, 0.955, 0.94) * clamp(lz0 / 0.8, 0.85, 1.1), arm); oo = mix(oo, rc_veil * clamp(lz0 / 0.28, 0.8, 1.15), isv); tx = mix(oo, rc_trim, isg * (1.0 - isv)); } float lum = dot(tx, vec3(0.3, 0.55, 0.15)); vec3 col = mix(vec3(lum), tx, 0.85) * 1.12 * tint * (wt * wt + 0.94 * wz * wz + 0.76 * wx * wx + 0.68 * (1.0 - min(s, 1.0)));")
	shaders["tex"] = st2
	var st3 := Shader.new(); st3.code = st2.code.replace("render_mode ambient_light_disabled, specular_disabled;", "render_mode ambient_light_disabled, specular_disabled, cull_disabled;"); shaders["tex2"] = st3
	auto = "auto" in OS.get_cmdline_user_args()
	hand_play = OS.get_cmdline_user_args().is_empty() or OS.get_environment("HAND") == "1"
	if OS.get_environment("RES") != "": get_viewport().scaling_3d_scale = float(OS.get_environment("RES"))      # (to look at a lowered 3D resolution)
	_env()
	var n0 := get_child_count()
	_world()
	if OS.get_environment("COPLANAR") == "1": _coplanar_check()
	world = Node3D.new(); world.name = "World"; add_child(world)
	for c in get_children().slice(n0):
		if c != world: c.reparent(world)
	_refl_margins(world)
	_lighten(world)
	_join_foam(world)
	# the old upside-down copy of the whole world under the sea is gone: it fought with the dark reflections
	# that now lie on the water, and it doubled the scene. The node stays for the few things made only for it
	refl = world.duplicate() if OS.get_environment("OLDREFL") == "1" else Node3D.new()
	refl.name = "Refl"; add_child(refl)
	for nm in ["MirrorPool", "PoolSky"]:   # the copy of the world under the sea must not repeat the pool's own mirror
		var extra := refl.get_node_or_null(nm)
		if extra != null: refl.remove_child(extra); extra.queue_free()
	refl.scale = Vector3(1, -1, 1); refl.position.y = 2.0 * WATER
	if old_world:
		slab(-0.6, -7.8, 0.6, -5.8, 0.0, "stone", refl)
		for e in [-1.0, 1.0]: blk(Vector3(e * 0.54 - 0.03, 0, -7.8), Vector3(e * 0.54 + 0.03, 0.06, -5.8), "shade", refl)
	_actors(); _fog(); _nav(); _ui()
	cam_t = pos
	get_viewport().size_changed.connect(_fit)
	_fit()
	if "gallery" in OS.get_cmdline_user_args(): _gallery()
	if OS.get_environment("DEBUG_POOL") == "1":
		for mm in find_children("*", "MeshInstance3D", true, false):
			var mi := mm as MeshInstance3D
			if mi.mesh == null: continue
			var bb: AABB = mi.global_transform * mi.mesh.get_aabb()
			if bb.position.x < 0.6 and bb.end.x > 0.9 and bb.position.z < 0.3 and bb.end.z > 0.6 and bb.end.y > -2.3 and bb.position.y < 0.05:
				var mo := mi.material_override
				print("POOLDBG ", mi.get_path(), " y ", snappedf(bb.position.y, 0.01), "..", snappedf(bb.end.y, 0.01), " size ", bb.size.snapped(Vector3.ONE * 0.1), " mat ", (mo as ShaderMaterial).shader.resource_path if mo is ShaderMaterial else str(mo), " ", shaders.find_key((mo as ShaderMaterial).shader) if mo is ShaderMaterial else "")
	if "shots" in OS.get_cmdline_user_args(): _shots()
	if "ione4" in OS.get_cmdline_user_args(): _ione4_proof()
	if "lineup" in OS.get_cmdline_user_args(): _lineup()
	if "reals" in OS.get_cmdline_user_args(): _real_lineup()
	if "mins" in OS.get_cmdline_user_args(): _min_lineup()
	if "heads" in OS.get_cmdline_user_args(): _heads_lineup()
	if "zoom" in OS.get_cmdline_user_args(): cam.size = 3.3
	if "statue" in OS.get_cmdline_user_args():
		get_viewport().msaa_3d = Viewport.MSAA_2X
		_solve_statue()
	if "tour" in OS.get_cmdline_user_args():
		get_viewport().msaa_3d = Viewport.MSAA_2X
		_tour()
	if "flow" in OS.get_cmdline_user_args():
		get_viewport().msaa_3d = Viewport.MSAA_2X
		_tour(true)
	if "handtest" in OS.get_cmdline_user_args(): _hand_test()
	if "handtest4" in OS.get_cmdline_user_args(): _hand_test4()
	if "looktest" in OS.get_cmdline_user_args(): _look_test()
	if "pantest" in OS.get_cmdline_user_args(): _pan_test()
	if "turndiag" in OS.get_cmdline_user_args(): _turn_diag()
	if "refltest" in OS.get_cmdline_user_args(): _refl_test()
	if "solve2" in OS.get_cmdline_user_args():
		get_viewport().msaa_3d = Viewport.MSAA_2X
		_solve2()
	if "solve3" in OS.get_cmdline_user_args():
		get_viewport().msaa_3d = Viewport.MSAA_2X
		_solve3()
	if "solve4" in OS.get_cmdline_user_args():
		get_viewport().msaa_3d = Viewport.MSAA_2X
		_solve4()
	if "covered" in OS.get_cmdline_user_args() and COVERED:
		get_viewport().msaa_3d = Viewport.MSAA_2X
		_solve_covered()
	if "glide" in OS.get_cmdline_user_args():
		get_viewport().msaa_3d = Viewport.MSAA_2X
		RenderingServer.directional_shadow_atlas_set_size(2048, true)
		_glide()
	if auto:
		get_viewport().msaa_3d = Viewport.MSAA_2X
		RenderingServer.directional_shadow_atlas_set_size(2048, true)
		_auto()

func _gallery() -> void:
	var names := ["kit_face1", "kit_face2", "kit_face3", "kit_face4", "kit_face5", "kit_face6", "colossus_head_veiled", "observer_veiled",
		"statue_veiled_broken", "statue_veiled_bust", "statue_veiled_kneeling", "statue_veiled_mourning", "statue_veiled_praying", "statue_veiled_unfinished",
		"column_doric", "column_fallen", "column_stump", "pediment_fragment", "rubble_pile", "kit_urns", "kit_fountain", "archway_ruined"]
	var o := Vector3(60, 0, 60)
	blk(o + Vector3(-9, -0.2, -9), o + Vector3(9, 0, 9), "shade")
	for i in names.size():
		var c := o + Vector3(-4.2 + (i % 4) * 2.8, 0, 5.5 - (i / 4) * 2.4) + Vector3(1, 0, -1) * ((i / 4) * 1.1)
		model(names[i], c, 1.6)
		var l := Label3D.new(); l.text = "%d %s" % [i, names[i].replace("statue_veiled_", "st_").replace("kit_", "")]; l.font_size = 40; l.pixel_size = 0.004
		l.billboard = BaseMaterial3D.BILLBOARD_ENABLED; l.position = c + Vector3(0.9, 0.1, 0.9); l.modulate = Color(0.2, 0.1, 0.2); l.no_depth_test = true; add_child(l)
	started = true; title_box.hide()
	cam.size = 16.0
	set_process(false)
	cam.position = o + Vector3(0, 1.0, 0) + cam.basis.z * 34.0
	await get_tree().create_timer(0.5).timeout
	await RenderingServer.frame_post_draw
	get_viewport().get_texture().get_image().save_png(OS.get_environment("SHOT_DIR") + "/gallery.png")
	get_tree().quit()

func _shots() -> void:
	started = true; title_box.hide(); hint.hide()
	if OS.get_environment("SHOT_HINT") != "": hint.show(); hint.text = OS.get_environment("SHOT_HINT"); hint.modulate.a = 1.0   # to look at the hint line in a still
	var dir := OS.get_environment("SHOT_DIR")
	await get_tree().create_timer(2.0).timeout
	for tp in OS.get_environment("TAP_TEST").split(";", false):   # "x,z,from x,from z;...": she stands at the one point, the other is tapped, and it says where she is sent
		var tf := tp.split(","); pos = Vector3(float(tf[2]), 0, float(tf[3])); cam_t = pos; route.clear()
		await get_tree().process_frame; await get_tree().process_frame
		tap(cam.unproject_position(Vector3(float(tf[0]), 0, float(tf[1]))))
		print("TAP ", tp, " -> ", (route.back().p as Vector3) if not route.is_empty() else "no way")
	var list := [
		{"n": "00-key-art", "p": Vector3(1.6, 0, 2.2), "y": 0.9, "c": Vector3(2.3, 1.6, -0.6), "s": 15.5},
		{"n": "01-map", "p": Vector3(0.5, 0, 2.0), "y": 0.6, "c": Vector3(-8.5, 0, -11.5), "s": 36.0},
		{"n": "02-arrival-court", "p": Vector3(0.6, 0, 1.4), "y": 0.5, "c": Vector3(0.2, 0.4, 0.0), "s": 13.0},
		{"n": "03-colossus", "p": Vector3(4.4, 0, 1.0), "y": 1.3, "c": Vector3(6.2, 0.9, 1.0), "s": 10.5},
		{"n": "04-steps-and-boat", "p": Vector3(0.3, 0, 2.9), "y": 0.3, "c": Vector3(1.0, 0.0, 3.8), "s": 7.0},
		{"n": "05-bridge-only-in-the-water", "p": Vector3(0.0, 0, -5.5), "y": PI, "c": Vector3(0.0, 0.0, -6.8), "s": 8.5},
		{"n": "06-lever-court", "p": Vector3(0.4, 0, -10.9), "y": -1.2, "c": Vector3(0.6, 0.4, -13.8), "s": 13.5},
		{"n": "07-turning-bridge", "p": Vector3(-2.6, 0, -13.0), "y": -1.57, "c": Vector3(-7.0, 0.2, -13.0), "s": 11.0},
		{"n": "08-half-gate", "p": Vector3(-16.3, 0, -15.0), "y": PI, "c": Vector3(-16.3, 0.4, -16.6), "s": 12.5},
		{"n": "09-mirror-garden", "p": Vector3(MX + 0.52, 0, MZ), "y": -PI * 0.5, "c": Vector3(-16.6, 0.8, -23.6), "s": 12.5, "touch": true},
		{"n": "10-heroine", "p": Vector3(0.9, 0, 1.2), "y": 0.78, "c": Vector3(0.9, 0.95, 1.2), "s": 3.1},
		{"n": "11-heroine-back", "p": Vector3(0.9, 0, 1.2), "y": -2.3, "c": Vector3(0.9, 0.95, 1.2), "s": 3.1},
		{"n": "12-strange-heads", "p": Vector3(-2.2, 0, 0.3), "y": -1.2, "c": Vector3(-3.1, 0.7, 0.0), "s": 5.0},
		{"n": "14-start-zone", "p": Vector3(-2.55, 0, 1.75), "y": 1.2, "c": Vector3(0.2, 0.5, -0.3), "s": 11.5},
		{"n": "15-statue-row", "p": Vector3(-2.55, 0, 1.75), "y": 1.2, "c": Vector3(-2.7, 0.8, -0.4), "s": 6.6},
		{"n": "16-sculptors-corner", "p": Vector3(1.9, 0, -2.2), "y": 2.6, "c": Vector3(2.4, 0.8, -3.0), "s": 5.6},
		{"n": "17-east-landing", "p": Vector3(4.3, 0, 1.0), "y": 1.57, "c": Vector3(5.2, -0.2, 1.3), "s": 7.6},
		{"n": "18-mirror-pool", "p": Vector3(-1.4, 0, -1.14), "y": 0.0, "c": Vector3(-0.8, 0.1, -0.1), "s": 5.2},
		{"n": "19-mirror-pool-wide", "p": Vector3(-1.4, 0, -1.14), "y": 0.0, "c": Vector3(-1.4, 0.3, 0.7), "s": 13.5},
		{"n": "21-sea-check", "p": Vector3(-4.9, 0, 0.4), "y": PI, "c": Vector3(-4.9, 1.9, 0.4), "s": 6.2},
		{"n": "24-statue-row", "p": Vector3(-0.5, 0, MYPL.z), "y": -PI * 0.5, "c": Vector3(-2.2, 0.3, -0.5), "s": 6.0},
		{"n": "25-crossing-court", "p": Vector3(CROSS_X, 0, QZ1 + 0.3), "y": PI, "c": Vector3(1.2, 0.3, -13.7), "s": 10.2},
		{"n": "28-turned-ones", "p": Vector3(-16.32, 0, -14.4), "y": -PI * 0.5, "c": Vector3(-17.9, 0.2, -13.0), "s": 9.8},
		{"n": "30-crane-court", "p": Vector3(-18.8, 0, -37.0), "y": PI * 0.5, "c": Vector3(-17.3, 0.2, -36.6), "s": 10.0},
		{"n": "26-causeway-mirrors", "p": Vector3(0, 0, -7.0), "y": -PI * 0.6, "c": Vector3(-0.8, 1.75, -7.8), "s": 8.6, "quote": true},   # framed as the run frames it
		{"n": "22-covered-pool", "p": Vector3(1.37, 0, -13.2), "y": -PI * 0.5, "c": Vector3(-1.0, 0.4, -13.0), "s": 7.5},
		{"n": "23-door-in-water", "p": Vector3(0.25, 0, -12.4), "y": -PI * 0.6, "c": Vector3(-1.2, 0.4, -13.0), "s": 6.2, "nosheet": true},
		{"n": "13-statues", "p": Vector3(-17.0, 0, -22.0), "y": 0.4, "c": Vector3(-16.4, 0.8, -24.4), "s": 8.0},
	]
	for at in OS.get_environment("SHOT_AT").split(";", false):   # extra views: "name,x,z,size;..." (she stands aside)
		var f := at.split(","); list.append({"n": f[0], "p": Vector3(60, 0, 60), "y": 0.0, "c": Vector3(float(f[1]), 0.6, float(f[2])), "s": float(f[3])})
	var only := OS.get_environment("SHOT_ONLY")
	for sh in list:
		if only != "":
			var hit := false
			for pre in only.split(","):
				if (sh.n as String).begins_with(pre): hit = true
			if not hit: continue
		shot = sh
		quote_box.visible = sh.get("quote", false)   # the line about the mirrors belongs to one still: it used to hang over those taken after any still on the causeway
		if sh.get("quote", false): quotes_shown.clear()
		route.clear(); pos = sh.p; yaw = sh.y; cam.size = sh.s; cam_t = pos
		a_wL = 0.0
		if sheet != null: sheet.visible = not sh.get("nosheet", false)
		quote_box.visible = (sh.n as String).begins_with("26")   # the line of the causeway shows in the causeway's own still, not over the five that follow it
		if sh.get("touch", false):
			tgtL = Vector3(MX + 0.012, 1.30, MZ + 0.13); a_wL = 1.0; a_lean = 0.09
			door.position.y = 1.05 - 2.15; door_energy = 1.0; ripple.position = Vector3(MX - 0.03, 1.30, MZ + 0.13); ripple_p = 0.3; flash = 0.6
		fig.veil_ready = false; wfig.veil_ready = false; ghost.veil_ready = false
		await get_tree().create_timer(1.2).timeout
		if sh.get("touch", false): ripple_p = 0.3
		await RenderingServer.frame_post_draw
		get_viewport().get_texture().get_image().save_png("%s/%s.png" % [dir, sh.n])
		print("SHOT ", sh.n)
	get_tree().quit()

## Pictures to compare heroines (run once per RIG): PROOF=close | pool | poses | kneel | walk (a film: use --write-movie).
## Stills go to SHOT_DIR as <PROOF_TAG>-<name>.png
func _ione4_proof() -> void:
	started = true; title_box.hide(); hint.hide()
	var dir := OS.get_environment("SHOT_DIR"); var tag := OS.get_environment("PROOF_TAG"); var what := OS.get_environment("PROOF")
	var snap := func(n: String) -> void:
		await RenderingServer.frame_post_draw
		get_viewport().get_texture().get_image().save_png("%s/%s-%s.png" % [dir, tag, n]); print("SHOT ", tag, "-", n)
	var spot := Vector3(0.9, 0, 1.2)
	if OS.get_environment("PROOF_AT") != "": var f := OS.get_environment("PROOF_AT").split(","); spot = Vector3(float(f[0]), 0, float(f[1]))
	var zoom := float(OS.get_environment("PROOF_ZOOM")) if OS.get_environment("PROOF_ZOOM") != "" else 2.0
	if what == "walk": pos = Vector3(-12.95, 0, -20.7); yaw = PI; cam.size = PLAY_SIZE / zoom; cam_t = pos      # (the film begins where she begins)
	else: await get_tree().create_timer(1.5).timeout
	if what == "close":      # front, three-quarter, side, back, at twice the size of play (or PROOF_ZOOM times)
		for v in [["front", PI * 0.25], ["threeq", PI * 0.25 - 0.75], ["side", PI * 0.25 + PI * 0.5], ["back", PI * 1.25], ["backq", PI * 1.25 - 0.75]]:
			route.clear(); pos = spot; yaw = v[1]; cam.size = PLAY_SIZE / zoom; cam_t = pos; shot = {"c": pos + Vector3(0, 0.82, 0), "s": cam.size}
			for h in H.values():
				if h.ap != null: h.ap.play("idle"); h.ap.seek(2.0, true)
			await get_tree().create_timer(0.6).timeout
			await snap.call(v[0])
	elif what == "pool":      # beside the garden's pool and at the sea's edge, at the size of play
		for v in [["pool", Vector3(-14.85, 0, -24.9), PI * 0.25, 1.0], ["pool2x", Vector3(-14.85, 0, -24.9), PI * 0.25, 2.0], ["sea", Vector3(0.0, 0, -7.0), PI * 0.25, 1.0], ["sea2x", Vector3(0.0, 0, -7.0), PI * 0.25, 2.0]]:
			route.clear(); pos = v[1]; yaw = v[2]; cam.size = PLAY_SIZE / float(v[3]); cam_t = pos; shot = {"c": pos + Vector3(0, 0.4 if float(v[3]) > 1.5 else 0.0, 0), "s": cam.size}
			for h in H.values():
				if h.ap != null: h.ap.play("idle"); h.ap.seek(2.0, true)
			await get_tree().create_timer(1.0).timeout
			await snap.call(v[0])
	elif what == "poses":      # the statues of her, in every pose the game makes
		pos = Vector3(60, 0, 60)
		var names := ["calm", "pray", "offer", "reach", "point", "pointl", "point2", "mourn", "kneel"]
		var c := Vector3(0.6, 0, 0.9); var across := Vector3(1, 0, -1).normalized(); var deep := Vector3(1, 0, 1).normalized()
		for i in names.size():
			var row := i / 5; var col := i % 5; var n := 5 if row == 0 else 4
			her_statue(c + across * ((col - (n - 1) * 0.5) * 1.15) + deep * (1.3 - row * 2.6), PI * 0.25 - 0.55, names[i])
		for v in [["poses", c + Vector3(0, 0.75, 0), 6.4], ["poses-a", c + deep * 1.3 + Vector3(0, 0.8, 0) - across * 1.1, 3.6], ["poses-b", c + deep * 1.3 + Vector3(0, 0.8, 0) + across * 1.3, 3.6], ["poses-c", c - deep * 1.3 + Vector3(0, 0.8, 0) - across * 0.9, 3.6], ["poses-d", c - deep * 1.3 + Vector3(0, 0.8, 0) + across * 0.9, 3.6]]:
			shot = {"c": v[1], "s": v[2]}; cam.size = v[2]
			await get_tree().create_timer(0.5).timeout
			await snap.call(v[0])
	elif what == "kneel":      # as the game does it at the water: a_drop, a_lean, the right hand to a point before her
		for v in [["a", PI * 0.25 - 0.9], ["b", PI * 0.25 + 1.3]]:
			route.clear(); pos = spot; yaw = v[1]; cam.size = PLAY_SIZE / zoom; cam_t = pos; shot = {"c": pos + Vector3(0, 0.6, 0), "s": cam.size}
			a_drop = 0.0; a_lean = 0.0; a_headp = 0.0; a_wR = 0.0
			await get_tree().create_timer(0.8).timeout
			tgtR = pos + Vector3(sin(yaw), 0, cos(yaw)) * 0.56 + Vector3(0, 0.02, 0)
			var a := tw()
			a.tween_property(self, "a_drop", 0.5, 0.8); a.tween_property(self, "a_lean", 0.5, 0.8); a.tween_property(self, "a_headp", 0.3, 0.8); a.tween_property(self, "a_wR", 1.0, 0.8)
			await get_tree().create_timer(0.4).timeout
			await snap.call("kneel-half-" + v[0])
			await a.finished
			await get_tree().create_timer(0.5).timeout
			await snap.call("kneel-" + v[0])
			a_drop = 0.0; a_lean = 0.0; a_headp = 0.0; a_wR = 0.0
	elif what == "walk":      # a film: along the garden's pool, a halt, standing, a turn where she stands, and back
		await get_tree().create_timer(0.5).timeout
		await go([Vector3(-12.95, 0, -24.7)])
		await wait(2.4)
		await face(pos + Vector3(-0.3, 0, 1.0))
		await wait(0.5)
		await go([Vector3(-12.95, 0, -22.3)])
		await wait(0.3)
	get_tree().quit()

func _fog() -> void:
	var fn := FastNoiseLite.new(); fn.noise_type = FastNoiseLite.TYPE_SIMPLEX_SMOOTH; fn.frequency = 0.012; fn.fractal_octaves = 3
	var nt := NoiseTexture2D.new(); nt.noise = fn; nt.seamless = true; nt.width = 256; nt.height = 256
	var q := QuadMesh.new(); q.size = Vector2(260, 260); q.orientation = PlaneMesh.FACE_Y
	for L in [[WATER + 0.18, 0.5, 0.02, Vector2(0.006, 0.003), 0.0, 1], [WATER + 0.8, 0.42, 0.015, Vector2(-0.004, 0.005), 0.0, 2], [0.25, 0.3, 0.02, Vector2(0.008, -0.005), 0.0, 3]]:
		var m := ShaderMaterial.new(); m.shader = shaders["fog"]; m.render_priority = L[5]
		m.set_shader_parameter("noise_tex", nt); m.set_shader_parameter("dens", L[1] * fog_k); m.set_shader_parameter("scale", L[2])
		m.set_shader_parameter("vel", L[3]); m.set_shader_parameter("clear_r", L[4]); m.set_shader_parameter("col", Color("f1e8ef"))
		prim(q, Vector3(0, L[0], 0), m); fogs.append(m); timed.append(m)

## one of the real sculpted heroine models, dressed in the flat style of this world
func real_hero(file: String, at: Vector3, yaw: float, anim := "", arms_down := false) -> Node3D:
	var st := GLTFState.new(); var doc := GLTFDocument.new()
	if doc.append_from_buffer(FileAccess.get_file_as_bytes("res://hero_models/%s.glb" % file), "", st) != OK: return null
	var src := doc.generate_scene(st) as Node3D
	var holder := Node3D.new(); holder.position = at; holder.rotation.y = yaw; add_child(holder); holder.add_child(src)
	if file == "tripo_v1": src.rotation.y = -PI * 0.5
	var bb := AABB(); var first := true
	for m in src.find_children("*", "MeshInstance3D", true, false):
		var mi := m as MeshInstance3D
		for si in mi.mesh.get_surface_count():
			var om := mi.mesh.surface_get_material(si)
			var sm := ShaderMaterial.new(); sm.shader = shaders["tex"]
			sm.set_shader_parameter("fog_col", sea_c); sm.set_shader_parameter("mist_col", mist_c); sm.set_shader_parameter("shadow_col", shadow_c); sm.set_shader_parameter("mist_k", mist_k)
			if om is BaseMaterial3D and (om as BaseMaterial3D).albedo_texture != null: sm.set_shader_parameter("albedo_tex", (om as BaseMaterial3D).albedo_texture)
			mi.set_surface_override_material(si, sm); pmats["tex|%s|%d" % [file, si]] = sm
		var a: AABB = mi.global_transform * mi.get_aabb()
		if first: bb = a; first = false
		else: bb = bb.merge(a)
	var a2 := holder.global_transform.affine_inverse() * bb
	var sc := 1.72 / maxf(a2.size.y, 0.001)
	src.scale *= sc; src.position -= Vector3(a2.get_center().x, a2.position.y, a2.get_center().z) * sc
	var ap := src.find_children("*", "AnimationPlayer", true, false)
	if anim != "" and not ap.is_empty():
		var pl := ap[0] as AnimationPlayer
		if pl.has_animation(anim):
			pl.get_animation(anim).loop_mode = Animation.LOOP_LINEAR; pl.play(anim)
	if arms_down:
		for sk in src.find_children("*", "Skeleton3D", true, false):
			var skel := sk as Skeleton3D
			for side in [["L_Upperarm", "L_Forearm", 1.0], ["R_Upperarm", "R_Forearm", -1.0]]:
				var bi := skel.find_bone(side[0]); var ci := skel.find_bone(side[1])
				if bi < 0 or ci < 0: continue
				var g := skel.get_bone_global_rest(bi); var c := skel.get_bone_global_rest(ci)
				var cur := (c.origin - g.origin).normalized()
				var side_dir := signf(cur.x) if absf(cur.x) > 0.2 else float(side[2])
				var want := Vector3(side_dir * 0.2, -1.0, 0.06).normalized()
				var q := Quaternion(cur, want)
				skel.set_bone_global_pose(bi, Transform3D(Basis(q) * g.basis, g.origin))
	return holder

## the idle and walk clips must stand on the same spot, or she slides sideways whenever she stops
func align_clips(src: Node3D) -> void:
	var aps := src.find_children("*", "AnimationPlayer", true, false)
	if aps.is_empty(): return
	var ap: AnimationPlayer = aps[0]
	var mean := {}
	for an in ["walk", "idle"]:
		if not ap.has_animation(an): return
		var a := ap.get_animation(an)
		for ti in a.get_track_count():
			if a.track_get_type(ti) == Animation.TYPE_POSITION_3D and String(a.track_get_path(ti)).ends_with("Hips"):
				var m := Vector3.ZERO
				for ki in a.track_get_key_count(ti): m += a.track_get_key_value(ti, ki)
				mean[an] = [ti, m / maxf(a.track_get_key_count(ti), 1.0)]
	if mean.size() < 2: return
	var d: Vector3 = mean["idle"][1] - mean["walk"][1]; d.y = 0.0
	var ia := ap.get_animation("idle"); var it: int = mean["idle"][0]
	for ki in ia.track_get_key_count(it): ia.track_set_key_value(it, ki, (ia.track_get_key_value(it, ki) as Vector3) - d)
	print("RIG clips aligned, idle moved by ", -d)

## colourways for the column woman: [gown, veil]
const RECOLS := {
	1: [Vector3(0.2, 0.22, 0.48), Vector3(0.62, 0.13, 0.2)],
	2: [Vector3(0.14, 0.48, 0.52), Vector3(0.95, 0.93, 0.88)],
	3: [Vector3(0.66, 0.14, 0.2), Vector3(0.95, 0.93, 0.88)],
	4: [Vector3(0.17, 0.16, 0.21), Vector3(0.62, 0.13, 0.2)],
	5: [Vector3(0.8, 0.42, 0.3), Vector3(0.12, 0.42, 0.47)],
	6: [Vector3(0.85, 0.65, 0.27), Vector3(0.62, 0.13, 0.2)],
	7: [Vector3(0.36, 0.2, 0.46), Vector3(0.86, 0.82, 0.95)],
}

# Finds the veil on the mesh itself: spread from the top of the head across the surface and stop
# where the cloth turns under at its hem. cu.w becomes 1 + distance to the hem (veil), 0.75 (its
# underside) or 0 (everything else); -1 everywhere if the spread escapes onto the gown.
func veil_mask(cu: PackedFloat32Array, a: Array) -> void:
	var nrm: PackedVector3Array = a[Mesh.ARRAY_NORMAL]; var idx: PackedInt32Array = a[Mesh.ARRAY_INDEX]
	var n: int = cu.size() / 4
	if nrm.size() != n or idx.is_empty(): return
	var ids := {}; var wid := PackedInt32Array(); wid.resize(n); var wy := PackedFloat32Array(); var wny := PackedFloat32Array(); var wc := PackedFloat32Array(); var wp := PackedVector3Array()
	for i in n:
		var pv := Vector3(cu[i * 4], cu[i * 4 + 1], cu[i * 4 + 2])
		var k := Vector3i(roundi(pv.x * 8000.0), roundi(pv.y * 8000.0), roundi(pv.z * 8000.0))
		if not ids.has(k): ids[k] = wp.size(); wp.append(pv); wy.append(pv.y); wny.append(0.0); wc.append(0.0)
		wid[i] = ids[k]; wny[wid[i]] += nrm[i].y; wc[wid[i]] += 1.0
	var nw := wp.size(); var adj: Array = []; adj.resize(nw)
	for i in nw: adj[i] = []
	for t in range(0, idx.size(), 3):
		var v0 := wid[idx[t]]; var v1 := wid[idx[t + 1]]; var v2 := wid[idx[t + 2]]
		adj[v0].append(v1); adj[v0].append(v2); adj[v1].append(v0); adj[v1].append(v2); adj[v2].append(v0); adj[v2].append(v1)
	var blocked := PackedByteArray(); blocked.resize(nw); var seed := 0
	for i in nw:
		blocked[i] = 1 if wny[i] / maxf(wc[i], 1.0) < -0.25 else 0
		if wy[i] > wy[seed]: seed = i
	var seen := PackedByteArray(); seen.resize(nw); seen[seed] = 1
	var q := PackedInt32Array([seed]); var qi := 0; var low := 9.0
	while qi < q.size():
		var v := q[qi]; qi += 1; low = minf(low, wy[v])
		for nb in adj[v]:
			if seen[nb] == 0 and blocked[nb] == 0: seen[nb] = 1; q.append(nb)
	print("VEIL mask: ", q.size(), " of ", nw, " verts, hem at ", snappedf(low, 0.001))
	if low < 0.8:
		for i in n: cu[i * 4 + 3] = -1.0
		print("VEIL mask leaked onto the gown, using the height split")
		return
	# small pockets the spread skipped (folds turned downwards) belong to the veil too:
	# everything not reached, except the one big remainder (body, gown, underside), joins it
	var comp := PackedInt32Array(); comp.resize(nw); comp.fill(-1); var sizes := PackedInt32Array(); var big := 0
	for i in nw:
		if seen[i] == 1 or comp[i] >= 0: continue
		var c := sizes.size(); var st := PackedInt32Array([i]); comp[i] = c; var cnt := 0
		while not st.is_empty():
			var v: int = st[st.size() - 1]; st.remove_at(st.size() - 1); cnt += 1
			for nb in adj[v]:
				if seen[nb] == 0 and comp[nb] < 0: comp[nb] = c; st.append(nb)
		sizes.append(cnt)
		if cnt > sizes[big]: big = c
	for i in nw:
		if seen[i] == 0 and comp[i] != big and sizes[comp[i]] < 400: seen[i] = 1; q.append(i)
	# distance from the hem, measured along the veil
	var dist := PackedFloat32Array(); dist.resize(nw); dist.fill(9.0)
	var under := PackedInt32Array(); under.resize(nw); under.fill(-1)
	var q2 := PackedInt32Array(); var q3 := PackedInt32Array()
	for v in q:
		for nb in adj[v]:
			if seen[nb] == 0:
				if dist[v] > 0.0: dist[v] = 0.0; q2.append(v)
				if under[nb] < 0: under[nb] = 0; q3.append(nb)
	qi = 0
	while qi < q2.size():
		var v := q2[qi]; qi += 1
		for nb in adj[v]:
			if seen[nb] == 1:
				var d := dist[v] + wp[v].distance_to(wp[nb])
				if d < dist[nb] - 0.0005: dist[nb] = d; q2.append(nb)
	qi = 0
	while qi < q3.size():
		var v := q3[qi]; qi += 1
		if under[v] >= 7: continue
		for nb in adj[v]:
			if seen[nb] == 0 and blocked[nb] == 1 and under[nb] < 0 and wy[nb] > low - 0.06: under[nb] = under[v] + 1; q3.append(nb)
	for i in n:
		var w := wid[i]
		cu[i * 4 + 3] = 1.0 + minf(dist[w], 0.6) if seen[w] == 1 else (0.75 if under[w] >= 0 else 0.0)

func add_rest_coords(src: Node3D) -> void:
	for m in src.find_children("*", "MeshInstance3D", true, false):
		var mi := m as MeshInstance3D
		var am := ArrayMesh.new()
		for si in mi.mesh.get_surface_count():
			var a := mi.mesh.surface_get_arrays(si)
			var raw: PackedVector3Array = a[Mesh.ARRAY_VERTEX]
			var av := PackedVector3Array(); av.resize(raw.size())
			for i in raw.size(): av[i] = Vector3(-raw[i].z, raw[i].y, raw[i].x)
			var lo := Vector3.INF; var hi := -Vector3.INF
			for v in av: lo = lo.min(v); hi = hi.max(v)
			var hgt := hi.y - lo.y; var cx := 0.0; var cz := 0.0; var cn := 0.0
			for v in av:
				if v.y > lo.y + hgt * 0.62: cx += v.x; cz += v.z; cn += 1.0
			cx /= maxf(cn, 1.0); cz /= maxf(cn, 1.0)
			var sc := 1.72 / maxf(hgt, 0.001)
			var cu := PackedFloat32Array(); cu.resize(av.size() * 4)
			for i in av.size():
				cu[i * 4] = (av[i].x - cx) * sc; cu[i * 4 + 1] = (av[i].y - lo.y) * sc; cu[i * 4 + 2] = (av[i].z - cz) * sc; cu[i * 4 + 3] = 0.0
			if rig_file.begins_with("ione") and not rig_file.begins_with("ione4") and OS.get_environment("VEILMASK") != "0": veil_mask(cu, a)
			a[Mesh.ARRAY_CUSTOM0] = cu
			rig_norm = {"cx": cx, "lo": lo.y, "cz": cz, "sc": sc, "veil": Color("e8e2d2")}
			var om0 := mi.mesh.surface_get_material(si)
			var bare := PackedByteArray(); bare.resize(av.size())   # 1 = bare marble body (wrapped figure), follows the leg bones fully
			if a[Mesh.ARRAY_COLOR] != null and rig_file.begins_with("wrap") and not (om0 is BaseMaterial3D and (om0 as BaseMaterial3D).albedo_texture != null):
				var vcs: PackedColorArray = a[Mesh.ARRAY_COLOR]   # the light model carries her colours in its vertices
				for i in av.size(): bare[i] = 1 if vcs[i].a <= 0.5 else 0
			if a[Mesh.ARRAY_TEX_UV] != null and om0 is BaseMaterial3D and (om0 as BaseMaterial3D).albedo_texture != null:
				var img := (om0 as BaseMaterial3D).albedo_texture.get_image()
				if img != null:
					if img.is_compressed(): img.decompress()
					if rig_file.begins_with("wrap"):
						var uvs: PackedVector2Array = a[Mesh.ARRAY_TEX_UV]
						for i in av.size():
							var cpx := img.get_pixel(clampi(int(fposmod(uvs[i].x, 1.0) * img.get_width()), 0, img.get_width() - 1), clampi(int(fposmod(uvs[i].y, 1.0) * img.get_height()), 0, img.get_height() - 1))
							bare[i] = 1 if cpx.r - cpx.b < 0.12 else 0
					var best := -1; var bd := 9.0
					for i in av.size():
						var yy := cu[i * 4 + 1]; var zz := cu[i * 4 + 2]
						if yy > 1.5 and yy < 1.66 and zz < -0.04 and absf(cu[i * 4]) < bd: bd = absf(cu[i * 4]); best = i
					if best >= 0:
						var uv: Vector2 = (a[Mesh.ARRAY_TEX_UV] as PackedVector2Array)[best]
						rig_norm.veil = img.get_pixel(clampi(int(fposmod(uv.x, 1.0) * img.get_width()), 0, img.get_width() - 1), clampi(int(fposmod(uv.y, 1.0) * img.get_height()), 0, img.get_height() - 1))
						print("RIG veil colour ", rig_norm.veil)
			# the gown hangs from the hips: take most of the leg bones' pull out of the skirt
			var bones: PackedInt32Array = a[Mesh.ARRAY_BONES]; var wts: PackedFloat32Array = a[Mesh.ARRAY_WEIGHTS]
			var per: int = bones.size() / maxi(av.size(), 1)
			var skin := mi.skin; var hips := -1; var legs := {}
			var sks := src.find_children("*", "Skeleton3D", true, false)
			if skin != null and per > 0:
				for bi in skin.get_bind_count():
					var bn := String(skin.get_bind_name(bi))
					if bn == "" and not sks.is_empty(): bn = (sks[0] as Skeleton3D).get_bone_name(skin.get_bind_bone(bi))
					if bn.ends_with("Hips"): hips = bi
					for key in ["UpLeg", "Leg", "Foot", "Toe"]:
						if bn.contains(key): legs[bi] = true
				var keep_mid := float(OS.get_environment("SK_MID")) if OS.get_environment("SK_MID") != "" else 0.45
				var keep_low := float(OS.get_environment("SK_LOW")) if OS.get_environment("SK_LOW") != "" else 0.15
				if rig_file.begins_with("wrap") or rig_file.begins_with("ione4"):   # a fitted wrap moves with the legs, or the bare legs push through the cloth (ione4: her weights are made for this in tools/ione4_build.py)
					if OS.get_environment("SK_MID") == "": keep_mid = 1.0
					if OS.get_environment("SK_LOW") == "": keep_low = 1.0
				if hips >= 0:
					for i in av.size():
						var y := cu[i * 4 + 1]
						var keep := 1.0
						if y < 0.98: keep = lerpf(keep_mid, 1.0, smoothstep(0.6, 0.98, y)) if y > 0.6 else lerpf(keep_low, keep_mid, smoothstep(0.05, 0.6, y))
						if keep >= 0.999 or bare[i] == 1: continue
						var moved := 0.0; var hslot := -1; var minslot := 0
						for k in per:
							var o := i * per + k
							if legs.has(bones[o]): moved += wts[o] * (1.0 - keep); wts[o] *= keep
							if bones[o] == hips: hslot = k
							if wts[o] < wts[i * per + minslot]: minslot = k
						if moved <= 0.0: continue
						if hslot < 0:
							hslot = minslot; moved += wts[i * per + hslot]; bones[i * per + hslot] = hips; wts[i * per + hslot] = 0.0
						wts[i * per + hslot] += moved
				# the veil hangs from the head and the back: nothing outside the arms themselves may follow the arm bones
				var arms := {}; var spine := {}
				for bi in skin.get_bind_count():
					var bn2 := String(skin.get_bind_name(bi))
					if bn2 == "" and not sks.is_empty(): bn2 = (sks[0] as Skeleton3D).get_bone_name(skin.get_bind_bone(bi))
					if bn2.contains("Shoulder") or bn2.contains("Arm") or bn2.contains("Hand"): arms[bi] = true
					for key in ["Head", "Neck", "Spine2", "Spine1", "Spine", "Hips"]:
						if bn2.ends_with(key): spine[key] = bi
				var ay := 0.0; var az := 0.0; var an := 0.0
				for i in av.size():
					if absf(cu[i * 4]) > 0.55 and cu[i * 4 + 1] > 1.0: ay += cu[i * 4 + 1]; az += cu[i * 4 + 2]; an += 1.0
				if an > 20.0 and spine.size() == 6 and OS.get_environment("ARM_FIX") == "1":
					ay /= an; az /= an
					var tube := float(OS.get_environment("ARM_TUBE")) if OS.get_environment("ARM_TUBE") != "" else 0.085
					var fixed := 0
					for i in av.size():
						var x := cu[i * 4]; var y := cu[i * 4 + 1]; var z := cu[i * 4 + 2]
						var dist := Vector2(y - ay, z - az).length()
						var t := smoothstep(tube, tube + 0.04, dist) if absf(x) > 0.13 else 1.0
						if t <= 0.0: continue
						var moved := 0.0; var slot := -1
						for k in per:
							var o := i * per + k
							if arms.has(bones[o]) and wts[o] > 0.0:
								moved += wts[o] * t; wts[o] *= 1.0 - t
								if slot < 0 and t >= 0.999: slot = k
						if moved <= 0.0: continue
						var tgt: int = spine["Head"] if y > 1.52 else spine["Neck"] if y > 1.42 else spine["Spine2"] if y > 1.2 else spine["Spine1"] if y > 1.05 else spine["Spine"] if y > 0.95 else spine["Hips"]
						for k in per:
							if bones[i * per + k] == tgt: slot = k
						if slot < 0:
							slot = 0
							for k in per:
								if wts[i * per + k] < wts[i * per + slot]: slot = k
							moved += wts[i * per + slot]; wts[i * per + slot] = 0.0
						bones[i * per + slot] = tgt; wts[i * per + slot] += moved; fixed += 1
					print("RIG veil freed from the arms: ", fixed, " verts, arm height ", ay)
				a[Mesh.ARRAY_BONES] = bones; a[Mesh.ARRAY_WEIGHTS] = wts
				print("RIG skirt reweighted, hips bind ", hips, " leg binds ", legs.size(), " per ", per)
			var fl: int = Mesh.ARRAY_CUSTOM_RGBA_FLOAT << Mesh.ARRAY_FORMAT_CUSTOM0_SHIFT
			if a[Mesh.ARRAY_BONES] != null and (a[Mesh.ARRAY_BONES] as PackedInt32Array).size() == av.size() * 8: fl |= Mesh.ARRAY_FLAG_USE_8_BONE_WEIGHTS
			am.add_surface_from_arrays(Mesh.PRIMITIVE_TRIANGLES, a, [], {}, fl)
			am.surface_set_material(si, mi.mesh.surface_get_material(si))
			print("RIG mesh verts ", av.size(), " size ", hi - lo)
		mi.mesh = am

## a small faceted cloth that hangs from the circlet in front of the face, so the veil really hides it
func add_face_panel(src: Node3D, mode: String) -> void:
	var sks := src.find_children("*", "Skeleton3D", true, false)
	if sks.is_empty() or rig_norm.is_empty(): return
	var sk: Skeleton3D = sks[0]
	var hb := _bone(sk, "Head")
	if hb < 0: return
	var inv := sk.get_bone_global_rest(hb).affine_inverse()
	var to_local := func(n: Vector3) -> Vector3:
		var avx: float = n.x / rig_norm.sc + rig_norm.cx; var avy: float = n.y / rig_norm.sc + rig_norm.lo; var avz: float = n.z / rig_norm.sc + rig_norm.cz
		return inv * Vector3(avz, avy, -avx)
	# rows from the circlet down to the chest: [height, half width, forward at the edge, forward at the ridge]
	var rows := [[1.705, 0.07, 0.085, 0.112], [1.63, 0.092, 0.125, 0.158], [1.53, 0.108, 0.135, 0.176], [1.405, 0.118, 0.15, 0.19]]
	var vs := PackedVector3Array(); var ns := PackedVector3Array()
	var gv := PackedVector3Array(); var gn := PackedVector3Array()
	var tri := func(a: Vector3, b: Vector3, c: Vector3, arr_v: PackedVector3Array, arr_n: PackedVector3Array) -> void:
		var nn := (b - a).cross(c - a).normalized()
		for q in [a, b, c]: arr_v.append(q); arr_n.append(nn)
	for r in rows.size() - 1:
		var t: Array = rows[r]; var b2: Array = rows[r + 1]
		var tl: Vector3 = to_local.call(Vector3(-t[1], t[0], t[2])); var tm: Vector3 = to_local.call(Vector3(0, t[0], t[3])); var tr: Vector3 = to_local.call(Vector3(t[1], t[0], t[2]))
		var bl: Vector3 = to_local.call(Vector3(-b2[1], b2[0], b2[2])); var bm: Vector3 = to_local.call(Vector3(0, b2[0] - (0.03 if r == rows.size() - 2 else 0.0), b2[3])); var br: Vector3 = to_local.call(Vector3(b2[1], b2[0], b2[2]))
		tri.call(tl, bl, tm, vs, ns); tri.call(tm, bl, bm, vs, ns); tri.call(tm, bm, tr, vs, ns); tri.call(tr, bm, br, vs, ns)
		# wings that tuck back into the veil at the sides
		var tlb: Vector3 = to_local.call(Vector3(-t[1] - 0.012, t[0], t[2] - 0.09)); var blb: Vector3 = to_local.call(Vector3(-b2[1] - 0.012, b2[0], b2[2] - 0.09))
		var trb: Vector3 = to_local.call(Vector3(t[1] + 0.012, t[0], t[2] - 0.09)); var brb: Vector3 = to_local.call(Vector3(b2[1] + 0.012, b2[0], b2[2] - 0.09))
		tri.call(tlb, blb, tl, vs, ns); tri.call(tl, blb, bl, vs, ns); tri.call(tr, br, trb, vs, ns); tri.call(trb, br, brb, vs, ns)
	var l: Array = rows[rows.size() - 1]
	for sd in [-1.0, 1.0]:
		var e0 := Vector3(sd * l[1], l[0], l[2] + 0.004); var e1 := Vector3(0, l[0] - 0.03, l[3] + 0.004)
		var up := Vector3(0, 0.02, 0)
		tri.call(to_local.call(e0), to_local.call(e1), to_local.call(e0 + up), gv, gn); tri.call(to_local.call(e0 + up), to_local.call(e1), to_local.call(e1 + up), gv, gn)
	var ba := BoneAttachment3D.new(); sk.add_child(ba); ba.bone_idx = hb
	var vc: Color = rig_norm.veil
	for part in [[vs, ns, "cloth"], [gv, gn, "gold"]]:
		var arr := []; arr.resize(Mesh.ARRAY_MAX); arr[Mesh.ARRAY_VERTEX] = part[0]; arr[Mesh.ARRAY_NORMAL] = part[1]
		var am := ArrayMesh.new(); am.add_surface_from_arrays(Mesh.PRIMITIVE_TRIANGLES, arr)
		var mi := MeshInstance3D.new(); mi.mesh = am; ba.add_child(mi)
		mi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_ON if mode in ["tex", "marble"] else GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
		if mode == "flat": mi.material_override = ghost_flat
		elif mode == "marble": mi.material_override = pal("marble", "2")
		elif mode == "crim": mi.material_override = pal("crim", "2")
		elif part[2] == "gold": mi.material_override = pal("gold", "2")
		else:
			var m := ShaderMaterial.new(); m.shader = shaders["two"]
			m.set_shader_parameter("c_top", Color(minf(vc.r * 1.1, 1.0), minf(vc.g * 1.1, 1.0), minf(vc.b * 1.1, 1.0))); m.set_shader_parameter("c_z", vc); m.set_shader_parameter("c_x", Color(vc.r * 0.84, vc.g * 0.84, vc.b * 0.86))
			m.set_shader_parameter("fog_col", sea_c); m.set_shader_parameter("mist_col", mist_c); m.set_shader_parameter("shadow_col", shadow_c); m.set_shader_parameter("mist_k", mist_k)
			pmats["panel|%d" % mi.get_instance_id()] = m; mi.material_override = m

func spawn_her(parent: Node, mode: String) -> Dictionary:
	# two weights of the same rigged model: "_m" for her (about 14,000 triangles), "_s" for every copy of her that is
	# marble, a reflection or a ghost (about 5,000). HERO_FULL=1 loads the heavy original, to compare
	var hf := rig_file if rig_file != "" else "tripo_v1"
	if OS.get_environment("HERO_FULL") != "1":
		var lod := "_m" if mode == "tex" else "_s"
		if FileAccess.file_exists("res://hero_models/%s%s.glb" % [hf, lod]): hf += lod
	if not hero_srcs.has(hf):
		var st := GLTFState.new(); var doc := GLTFDocument.new()
		doc.append_from_buffer(FileAccess.get_file_as_bytes("res://hero_models/%s.glb" % hf), "", st)
		hero_srcs[hf] = doc.generate_scene(st) as Node3D
		if rig_file != "":
			add_rest_coords(hero_srcs[hf])
			if not rig_file.begins_with("ione4"): align_clips(hero_srcs[hf])   # (ione4's clips are brought to one standing place when she is built)
	hero_src = hero_srcs[hf]
	var i4 := rig_file.begins_with("ione4") and OS.get_environment("IONE4") != "vcol"
	var i4v := rig_file.begins_with("ione4") and not i4      # IONE4=vcol: the same data read from her vertices by the older wrap's shader, to compare with the picture
	if i4 and not shaders.has("tex4"): _ione4_shaders()
	var src: Node3D = hero_src.duplicate()
	var holder := Node3D.new(); parent.add_child(holder); holder.add_child(src)
	src.scale = Vector3.ONE * 1.72; src.rotation.y = float(OS.get_environment("RIG_YAW")) if OS.get_environment("RIG_YAW") != "" else (PI * 0.5 if rig_file == "lp1r" else -PI * 0.5)
	if rig_file != "" and OS.get_environment("RIG_YAW") == "":
		var sk0 := src.find_children("*", "Skeleton3D", true, false)
		if not sk0.is_empty():
			var skq: Skeleton3D = sk0[0]; var fb := _bone(skq, "LeftFoot"); var tb := _bone(skq, "LeftToeBase")
			if fb >= 0 and tb >= 0:
				var fw := skq.get_bone_global_rest(tb).origin - skq.get_bone_global_rest(fb).origin
				var fb2 := _bone(skq, "RightFoot"); var tb2 := _bone(skq, "RightToeBase")
				if fb2 >= 0 and tb2 >= 0: fw += skq.get_bone_global_rest(tb2).origin - skq.get_bone_global_rest(fb2).origin
				fw.y = 0.0
				if fw.length() > 0.001:
					src.rotation.y = -atan2(fw.x, fw.z)
					if hero_src_yaw_note: print("RIG faces ", fw.normalized(), " -> yaw ", src.rotation.y); hero_src_yaw_note = false
	for m in src.find_children("*", "MeshInstance3D", true, false):
		var mi := m as MeshInstance3D
		mi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_ON if mode in ["tex", "marble"] else GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
		for si in mi.mesh.get_surface_count():
			var om := mi.mesh.surface_get_material(si)
			if mode == "flat": mi.set_surface_override_material(si, ghost_flat)
			elif mode == "marble": mi.set_surface_override_material(si, pal("marble", "2r" if rig_file != "" else ""))
			elif rig_file != "" and mode == "crim": mi.set_surface_override_material(si, pal("crim", "2"))
			elif rig_file == "min14r":
				var bm := body_mat("veil", "rig" + str(holder.get_instance_id())); bm.shader = shaders["bodyskin"]
				var did := int(OS.get_environment("DESIGN")) if OS.get_environment("DESIGN") != "" else 32
				apply_design(bm, did, rig_file); bm.set_shader_parameter("geo", 1.0)
				mi.set_surface_override_material(si, bm)
			else:
				var sm := ShaderMaterial.new(); sm.shader = shaders[("tex4m" if mode == "mirror" else "tex4") if i4 else ("tex2" if mode == "mirror" else "tex")]
				if refl_mat != null and mode == "tex":   # her own reflection keeps her colours and lies over the others
					var rm := ShaderMaterial.new(); rm.shader = shaders["refl"]; rm.set_shader_parameter("water_y", WATER); rm.set_shader_parameter("lift", 0.006); rm.set_shader_parameter("use_tex", 1.0); rm.set_shader_parameter("fade_a", 0.6)   # (thinner than it was: it lay on the sea as bright as she is, and read as a thing standing in the water)
					if om is BaseMaterial3D and (om as BaseMaterial3D).albedo_texture != null and not i4: rm.set_shader_parameter("albedo_tex", (om as BaseMaterial3D).albedo_texture)
					elif mi.mesh.surface_get_format(si) & Mesh.ARRAY_FORMAT_COLOR: rm.set_shader_parameter("vcol", 1.0)   # her colours are in the vertices (ione4: her picture holds data, not colours)
					timed.append(rm); sm.next_pass = rm
					if mode == "tex": her_mats.append(sm)
				sm.set_shader_parameter("fog_col", sea_c); sm.set_shader_parameter("mist_col", mist_c); sm.set_shader_parameter("shadow_col", shadow_c); sm.set_shader_parameter("mist_k", mist_k)
				if i4: _ione4_dress(sm, om, hero_src, mode)
				elif om is BaseMaterial3D and (om as BaseMaterial3D).albedo_texture != null and not i4v: sm.set_shader_parameter("albedo_tex", (om as BaseMaterial3D).albedo_texture)
				elif mi.mesh.surface_get_format(si) & Mesh.ARRAY_FORMAT_COLOR: sm.set_shader_parameter("vcol", 1.0)
				if mode == "crim": sm.set_shader_parameter("tint", Vector3(1.75, 0.42, 0.5))
				if mode == "mirror": sm.set_shader_parameter("tint", Vector3(0.4, 0.48, 0.62))   # her reflection is dark, and the water blurs it
				if mode == "tex": floor_mats.append(sm)
				if rig_file.begins_with("lp") or rig_file.begins_with("sr") or rig_file.begins_with("nb") or (rig_file.begins_with("wrap") and OS.get_environment("WRAP_FLAT") == "1"): sm.set_shader_parameter("flat_n", 1.0)
				if rig_file == "lp1r" and OS.get_environment("NOSNAP") != "1": sm.set_shader_parameter("snap", 1.0)
				if (rig_file == "wrap3r" or i4v) and mode == "tex": sm.set_shader_parameter("wrap_col", Vector3(0.82, 0.31, 0.215)); sm.set_shader_parameter("wrap_ref", 0.34); sm.set_shader_parameter("rim", 1.3)   # (rim: her turned-away faces a little deeper, so that her wrap and her limbs read as round)
				if (rig_file.begins_with("wrap") or i4v) and mode == "tex": sm.set_shader_parameter("wrap_lift", float(OS.get_environment("WRAP_LIFT")) if OS.get_environment("WRAP_LIFT") != "" else 1.55)
				if rig_file.begins_with("ione") and not rig_file.begins_with("ione4") and mode == "tex" and OS.get_environment("IONE") != "old":
					var dark_veil := OS.get_environment("IONE") == "dark"
					var gown_c := Vector3(0.184, 0.702, 0.678); var veil_c := Vector3(0.827, 0.953, 0.941)   # turquoise gown, pale veil
					if dark_veil: gown_c = Vector3(0.7, 0.84, 0.96); veil_c = Vector3(0.15, 0.28, 0.53)
					elif OS.get_environment("IONE") == "blue": gown_c = Vector3(0.42, 0.63, 0.87); veil_c = Vector3(0.75, 0.89, 0.98)
					var ione_col := OS.get_environment("IONE_COL").split(",")   # "gownhex,veilhex"
					if ione_col.size() == 2: var cg := Color(ione_col[0]); var cv := Color(ione_col[1]); gown_c = Vector3(cg.r, cg.g, cg.b); veil_c = Vector3(cv.r, cv.g, cv.b)
					sm.set_shader_parameter("recol3", 1.0); sm.set_shader_parameter("rc_gown", gown_c); sm.set_shader_parameter("rc_veil", veil_c)
					sm.set_shader_parameter("rc_split", {"ione1r": 1.27, "ione2r": 1.2, "ione3r": 1.27}.get(rig_file, 1.26))
				if rig_file == "w2r" and mode == "tex" and OS.get_environment("IONE") != "old":
					sm.set_shader_parameter("recol2", 1.0); sm.set_shader_parameter("rc_gown", Vector3(0.42, 0.63, 0.87)); sm.set_shader_parameter("rc_veil", Vector3(0.72, 0.87, 0.97))
				var rcid := int(OS.get_environment("RECOL")) if OS.get_environment("RECOL") != "" else 0
				if RECOLS.has(rcid) and mode == "tex":
					sm.set_shader_parameter("recol", 1.0); sm.set_shader_parameter("rc_gown", RECOLS[rcid][0]); sm.set_shader_parameter("rc_veil", RECOLS[rcid][1])
				mi.set_surface_override_material(si, sm); pmats["her|%d|%d" % [holder.get_instance_id(), si]] = sm
	if rig_file == "lp3r" and OS.get_environment("NOPANEL") != "1": add_face_panel(src, mode)
	var aps := src.find_children("*", "AnimationPlayer", true, false); var sks := src.find_children("*", "Skeleton3D", true, false)
	var ap: AnimationPlayer = aps[0] if not aps.is_empty() else null
	var sk: Skeleton3D = sks[0] if not sks.is_empty() else null
	if ap != null:
		for an in ["idle", "walk", "turn_step"]:
			if ap.has_animation(an): ap.get_animation(an).loop_mode = Animation.LOOP_LINEAR
	return {"holder": holder, "ap": ap, "sk": sk}

## The heroine "ione4" (made again from the owner's four views; tools/ione4_tex.py and ione4_build.py). Her picture
## holds no colours but data (R light and dark of folds, facets, veins; G cloth or marble; B shade under the bands),
## and the shader lays the world's red and the world's marble over it, with a woven grain that is drawn only as fine
## as the screen can show (each layer of the grain fades out before it would shimmer).
func _ione4_shaders() -> void:
	var uni := "uniform float ione4 = 0.0; uniform sampler2D data_tex : filter_linear_mipmap, repeat_disable; uniform vec3 i4_marble = vec3(0.975, 0.97, 0.962); uniform float i4_grain = 1.35; uniform float i4_tone = 1.0; uniform float i4_shade = 1.0; uniform float i4_hand = -1.0; varying vec3 mpos; varying float mveil;"
	var frag := "if (snap > 0.5) tx = snapc(tx); if (ione4 > 0.5) { vec3 d4 = texture(data_tex, UV).rgb; float w4 = clamp(fwidth(d4.g) * 0.7, 0.02, 0.3); float cm4 = smoothstep(0.5 - w4, 0.5 + w4, d4.g); float tn4 = 1.0 + (d4.r * 2.0 - 1.0) * i4_tone; float ao4 = smoothstep(0.0, 0.92, d4.b); float px4 = max(length(dFdx(mpos)), length(dFdy(mpos))); float th4 = atan(mpos.z, mpos.x); vec2 hv4 = vec2(th4 * 0.13, mpos.y); float u4 = hv4.x * 0.866 + hv4.y * 0.5 * i4_hand; float v4 = -hv4.x * 0.5 * i4_hand + hv4.y * 0.866; float f1 = 1.0 - smoothstep(0.25, 0.55, px4 / 0.009); float f2 = 1.0 - smoothstep(0.3, 0.62, px4 / 0.026); float thr4 = sin(u4 * 698.0) * sin(v4 * 698.0) + 0.5 * (n3(vec3(u4 * 40.0, v4 * 349.0, 3.1)) - 0.5); float sl4 = smoothstep(0.3, 0.7, n3(vec3(u4 * 18.0, v4 * 44.0, 1.7))) - 0.5; float f3 = 1.0 - smoothstep(0.3, 0.62, px4 / 0.012); float sf4 = n3(mpos * 83.0) - 0.5; float sm4 = n3(mpos * 45.0 + 9.0) - 0.5; float mo4 = n3(mpos * 9.0) - 0.5; float gr4 = (0.1 * f1 * thr4 + 0.085 * f2 * sl4 + 0.18 * f3 * sf4 + 0.1 * f2 * sm4 + 0.04 * mo4) * i4_grain; float fc4 = wt * wt * 1.1 + wz * wz * 0.96 + wx * wx * 0.7; vec3 cl4 = wrap_col * clamp(tn4, 0.55, 1.4) * (1.0 + gr4) * mix(1.0, fc4, 0.75); cl4 *= mix(vec3(1.0), mix(vec3(0.46, 0.33, 0.4), vec3(1.0), ao4), i4_shade); vec3 mb4 = i4_marble * clamp(tn4, 0.45, 1.25) * (1.0 + 0.03 * mo4); mb4 *= mix(vec3(1.0), mix(vec3(0.7, 0.71, 0.82), vec3(1.0), ao4), i4_shade); tx = mix(mb4, cl4, cm4); }"
	for pair in [["tex4", "tex"], ["tex4m", "tex2"]]:
		var code: String = (shaders[pair[1]] as Shader).code
		if not code.contains("varying vec3 mpos; varying float mveil;") or not code.contains("if (snap > 0.5) tx = snapc(tx);"): push_error("ione4: the heroine's shader has changed; her dress is not drawn"); shaders[pair[0]] = shaders[pair[1]]; continue
		var sh := Shader.new(); sh.code = code.replace("varying vec3 mpos; varying float mveil;", uni).replace("if (snap > 0.5) tx = snapc(tx);", frag)
		shaders[pair[0]] = sh

func _ione4_dress(sm: ShaderMaterial, om: Material, src: Node, _mode: String) -> void:
	if not (om is BaseMaterial3D) or (om as BaseMaterial3D).albedo_texture == null:
		sm.set_shader_parameter("vcol", 1.0); return
	if not src.has_meta("i4tex"):      # the data picture, with its smaller sizes made (they are what is shown when she is small)
		var img := (om as BaseMaterial3D).albedo_texture.get_image()
		if OS.get_environment("I4_TEX") != "": img = Image.load_from_file(OS.get_environment("I4_TEX"))      # (to try another data picture without building her again)
		if img.is_compressed(): img.decompress()
		if not img.has_mipmaps(): img.generate_mipmaps()
		src.set_meta("i4tex", ImageTexture.create_from_image(img))
	sm.set_shader_parameter("data_tex", src.get_meta("i4tex")); sm.set_shader_parameter("ione4", 1.0)
	sm.set_shader_parameter("wrap_col", Vector3(0.82, 0.31, 0.215)); sm.set_shader_parameter("rim", 1.3)      # the red of the present heroine
	for k in ["i4_grain", "i4_tone", "i4_shade", "i4_hand"]:
		if OS.get_environment(k.to_upper()) != "": sm.set_shader_parameter(k, float(OS.get_environment(k.to_upper())))

func _bone(sk: Skeleton3D, n: String) -> int:
	var i := sk.find_bone("mixamorig:" + n)
	return i if i >= 0 else sk.find_bone("mixamorig_" + n)

func _aim(sk: Skeleton3D, bone: String, child: String, want: Vector3) -> void:
	var bi := _bone(sk, bone); var ci := _bone(sk, child)
	if bi < 0 or ci < 0: return
	var g := sk.get_bone_global_pose(bi); var c := sk.get_bone_global_pose(ci).origin
	sk.set_bone_global_pose(bi, Transform3D(Basis(Quaternion((c - g.origin).normalized(), want.normalized())) * g.basis, g.origin))

## The arm a statue points with is gilded from above the elbow to the fingertips, so that the way it points is plain
## at any size, and in the water too. The gilding is the arm's own faces (those that follow its bones), set where the
## pose has put them and stood a little off the marble
func _gild_arm(holder: Node3D, sk: Skeleton3D, side: String) -> void:
	var ai := _bone(sk, side + "Arm"); var ei := _bone(sk, side + "ForeArm"); var hi := _bone(sk, side + "Hand")
	if ai < 0 or ei < 0 or hi < 0: return
	var from_k := 0.45      # of the way from shoulder to elbow
	var fat := 0.16      # how far off the marble it stands, in forearms
	var sh := sk.get_bone_global_pose(ai).origin; var el := sk.get_bone_global_pose(ei).origin; var wr := sk.get_bone_global_pose(hi).origin
	var fl := (wr - el).length()
	var a := sh.lerp(el, from_k); var b := wr + (wr - el).normalized() * fl * 1.5
	for m in holder.find_children("*", "MeshInstance3D", true, false):
		var mi := m as MeshInstance3D
		if mi.skin == null or mi.mesh == null: continue
		var skin := mi.skin
		var xf: Array = []; var arm: Array = []      # for each bind of the skin: where its bone has taken it, and whether it is of this arm
		for bi in skin.get_bind_count():
			var bone := skin.get_bind_bone(bi)
			if bone < 0: bone = sk.find_bone(skin.get_bind_name(bi))
			if bone < 0: xf.append(Transform3D.IDENTITY); arm.append(false); continue
			xf.append(sk.get_bone_global_pose(bone) * skin.get_bind_pose(bi))
			var bn := sk.get_bone_name(bone)
			var cut := bn.find(side)
			var tail := bn.substr(cut + side.length()) if cut >= 0 else ""
			arm.append(cut >= 0 and (tail.begins_with("Arm") or tail.begins_with("ForeArm") or tail.begins_with("Hand")))
		var st := SurfaceTool.new(); st.begin(Mesh.PRIMITIVE_TRIANGLES)
		var got := 0
		for si in mi.mesh.get_surface_count():
			var arr := mi.mesh.surface_get_arrays(si)
			var v: PackedVector3Array = arr[Mesh.ARRAY_VERTEX]
			if arr[Mesh.ARRAY_BONES] == null or arr[Mesh.ARRAY_WEIGHTS] == null: continue
			var bs: PackedInt32Array = arr[Mesh.ARRAY_BONES]; var ws: PackedFloat32Array = arr[Mesh.ARRAY_WEIGHTS]
			var per := bs.size() / v.size()
			var ix: PackedInt32Array = arr[Mesh.ARRAY_INDEX] if arr[Mesh.ARRAY_INDEX] != null else PackedInt32Array(range(v.size()))
			var at := PackedVector3Array(); at.resize(v.size()); var of_arm := PackedFloat32Array(); of_arm.resize(v.size())
			for j in v.size():
				var p := Vector3.ZERO; var wsum := 0.0; var wa := 0.0
				for k in per:
					var w := ws[j * per + k]
					if w <= 0.0: continue
					var bi2 := bs[j * per + k]
					if bi2 >= xf.size(): continue
					p += ((xf[bi2] as Transform3D) * v[j]) * w; wsum += w
					if arm[bi2]: wa += w
				at[j] = p / wsum if wsum > 0.0 else v[j]; of_arm[j] = wa / wsum if wsum > 0.0 else 0.0
			for t in range(0, ix.size() - 2, 3):
				var ok := true
				var outp := []
				for q in 3:
					var j2 := ix[t + q]; var p2 := at[j2]
					if of_arm[j2] < 0.5 or (p2 - a).dot(b - a) < 0.0: ok = false; break
					var c := Geometry3D.get_closest_point_to_segment(p2, a, b)
					outp.append(p2 + (p2 - c).normalized() * fl * fat)
				if not ok: continue
				for p3 in outp: st.add_vertex(p3)
				got += 1
		if got == 0: continue
		st.generate_normals()
		var gm := MeshInstance3D.new(); gm.mesh = st.commit(); gm.material_override = pal("gold", "flat")
		if mroot != null and mroot.is_ancestor_of(holder):      # in the water the haze of the world below would take its colour: there it keeps a plain gold
			var um := StandardMaterial3D.new(); um.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED; um.cull_mode = BaseMaterial3D.CULL_DISABLED
			um.albedo_color = Color("d79a2f")
			gm.material_override = um; gm.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
		gm.transform = mi.transform; mi.get_parent().add_child(gm)

func _bend(sk: Skeleton3D, bone: String, axis: Vector3, ang: float) -> void:
	var bi := _bone(sk, bone)
	if bi < 0: return
	var g := sk.get_bone_global_pose(bi)
	sk.set_bone_global_pose(bi, Transform3D(Basis(axis, ang) * g.basis, g.origin))

func _real_lineup() -> void:
	started = true; title_box.hide(); hint.hide()
	pos = Vector3(60, 0, 60)
	var c := Vector3(0.2, 0, 0.3)
	var dir := Vector3(1, 0, -1).normalized()
	var names := [["tripo_v1", "idle", false], ["porcelain", "", true], ["h4", "", true]]
	var labels := ["A", "B", "C"]; var gap := 1.5; var vs := 5.4
	if OS.get_environment("REALS") != "":
		names = []; labels = []
		for nm in OS.get_environment("REALS").split(","): names.append([nm, "", true]); labels.append(nm.right(1))
		gap = 2.0; vs = 7.6
	var hs := []
	for i in names.size():
		hs.append(real_hero(names[i][0], c + dir * ((i - (names.size() - 1) * 0.5) * gap), PI * 0.25, names[i][1], names[i][2]))
		var l := Label3D.new(); l.text = labels[i]; l.font_size = 96; l.pixel_size = 0.004 * vs / 5.4; l.billboard = BaseMaterial3D.BILLBOARD_ENABLED
		l.modulate = Color(0.72, 0.14, 0.18); l.outline_modulate = Color(1, 1, 1, 0.9); l.no_depth_test = true
		l.position = c + dir * ((i - (names.size() - 1) * 0.5) * gap) + Vector3(0.75, 0.05, 0.75) * (vs / 5.4); add_child(l)
	var dirn := OS.get_environment("SHOT_DIR")
	await get_tree().create_timer(2.5).timeout
	for view in [["real-front", PI * 0.25], ["real-back", PI * 1.12]]:
		shot = {"c": c + Vector3(0, 0.95, 0), "s": vs}
		cam.size = vs
		for h in hs:
			if h != null: (h as Node3D).rotation.y = view[1] + (float(OS.get_environment("REAL_OFF")) if OS.get_environment("REAL_OFF") != "" else 0.0)
		await get_tree().create_timer(0.8).timeout
		await RenderingServer.frame_post_draw
		get_viewport().get_texture().get_image().save_png("%s/%s.png" % [dirn, view[0]])
		print("SHOT ", view[0])
	get_tree().quit()

func bake_shape(file: String) -> ArrayMesh:
	shape_tex = null
	var st := GLTFState.new(); var doc := GLTFDocument.new()
	if doc.append_from_buffer(FileAccess.get_file_as_bytes("res://hero_models/%s.glb" % file), "", st) != OK: return null
	var src := doc.generate_scene(st) as Node3D
	var vs := PackedVector3Array(); var ns := PackedVector3Array(); var ix := PackedInt32Array(); var uvs := PackedVector2Array()
	for m in src.find_children("*", "MeshInstance3D", true, false):
		var mi := m as MeshInstance3D
		var xf := Transform3D.IDENTITY
		var n: Node = mi
		while n != null and n is Node3D:
			xf = (n as Node3D).transform * xf
			if n == src: break
			n = n.get_parent()
		xf = Transform3D(Basis(Vector3.UP, -PI * 0.5), Vector3.ZERO) * xf
		for si in mi.mesh.get_surface_count():
			var a := mi.mesh.surface_get_arrays(si)
			var base := vs.size()
			var av: PackedVector3Array = a[Mesh.ARRAY_VERTEX]
			var has_n: bool = a[Mesh.ARRAY_NORMAL] != null
			var has_uv: bool = a[Mesh.ARRAY_TEX_UV] != null
			var om := mi.mesh.surface_get_material(si)
			if om is BaseMaterial3D and (om as BaseMaterial3D).albedo_texture != null: shape_tex = (om as BaseMaterial3D).albedo_texture
			for i in av.size():
				uvs.append((a[Mesh.ARRAY_TEX_UV][i] as Vector2) if has_uv else Vector2.ZERO)
				vs.append(xf * av[i])
				ns.append((xf.basis * (a[Mesh.ARRAY_NORMAL][i] as Vector3)).normalized() if has_n else Vector3.UP)
			if a[Mesh.ARRAY_INDEX] != null:
				for j in (a[Mesh.ARRAY_INDEX] as PackedInt32Array): ix.append(base + j)
			else:
				for j in av.size(): ix.append(base + j)
	src.free()
	var lo := Vector3.INF; var hi := -Vector3.INF
	for v in vs: lo = lo.min(v); hi = hi.max(v)
	var cx := 0.0; var cz := 0.0; var cn := 0.0
	for v in vs:
		if v.y > lo.y + (hi.y - lo.y) * 0.62: cx += v.x; cz += v.z; cn += 1.0
	var sc := 1.72 / maxf(hi.y - lo.y, 0.001)
	var c := Vector3(cx / maxf(cn, 1.0), lo.y, cz / maxf(cn, 1.0))
	for i in vs.size(): vs[i] = (vs[i] - c) * sc
	var cols := PackedColorArray(); cols.resize(vs.size()); cols.fill(Color(0, 0, 0))
	var vk := file.substr(0, file.find("t")) if file.find("t") > 0 else file
	if FACE_VEIL.has(vk) and OS.get_environment("NOVEIL") != "1": add_face_veil(FACE_VEIL[vk], vs, ns, cols, ix)
	uvs.resize(vs.size())
	var arr := []; arr.resize(Mesh.ARRAY_MAX); arr[Mesh.ARRAY_VERTEX] = vs; arr[Mesh.ARRAY_NORMAL] = ns; arr[Mesh.ARRAY_COLOR] = cols; arr[Mesh.ARRAY_TEX_UV] = uvs; arr[Mesh.ARRAY_INDEX] = ix
	var am := ArrayMesh.new(); am.add_surface_from_arrays(Mesh.PRIMITIVE_TRIANGLES, arr)
	print("SHAPE ", file, " verts ", vs.size(), " tris ", ix.size() / 3)
	return am

## the costume, redesigned: soft two-tone shading, a light on the outline, a satin sheen, one thin gold line
const DESIGN_FRAG := """	if (design > 0.5) {
		vec3 L = normalize(vec3(-0.62, 0.56, 0.5)); vec3 V = vec3(0.57735);
		float kf = 0.0; float kw = smoothstep(veil_y - 0.015, veil_y + 0.015, mp.y); float fold = 1.0;
		if (use_tex > 0.0) {
			vec3 t1 = texture(albedo_tex, UV).rgb; float lum = dot(t1, vec3(0.3, 0.55, 0.15)); float rg = t1.r - t1.g; float kc = smoothstep(0.2, 0.34, rg);
			kf = smoothstep(0.035, 0.09, rg) * (1.0 - kc) * smoothstep(0.02, 0.07, t1.g - t1.b) * smoothstep(0.45, 0.6, t1.r);
			kw = smoothstep(0.7, 0.8, lum) * (1.0 - kc) * (1.0 - kf);
			fold = clamp(mix(lum / 0.56, lum / 0.92, kw), 0.8, 1.08);
			if (use_mask > 0.5) { vec3 t2 = texture(veil_mask, UV).rgb; kw = smoothstep(0.2, 0.34, t2.r - t2.g); kf *= 1.0 - kw; }
		}
		if (geo > 0.5) {
			float ax = abs(mp.x);
			float isarm = smoothstep(0.165, 0.18, ax) * (1.0 - smoothstep(1.3, 1.42, mp.y)) * step(0.6, mp.y);
			float vth = mix(1.33, 1.43 - 0.21 * max(0.0, 1.0 - ax / 0.12), step(0.02, mp.z));
			kw = step(vth, mp.y) * (1.0 - isarm);
			kf = isarm * step(mp.y, 1.02);
		}
		kf = max(kf, step(0.5, armw) * step(mp.y, fore_y));
		float isveil = max(notex, kw); float ismar = kf * (1.0 - isveil);
		float ndl = dot(n, L); float ramp = smoothstep(-0.2, 0.55, ndl);
		float fres = pow(1.0 - clamp(dot(n, V), 0.0, 1.0), 2.4);
		float sheen = pow(clamp(dot(n, normalize(L + V)), 0.0, 1.0), 14.0);
		vec3 dc = mix(o_dress_lo, o_dress_hi, smoothstep(0.0, 1.0, mp.y));
		dc *= mix(d_shade, vec3(1.0), ramp) * mix(1.0, fold, 0.6 * (1.0 - notex));
		dc += o_rim * fres * 0.38 + vec3(1.0, 0.96, 0.9) * sheen * d_sheen;
		vec3 gold = o_gold * (0.82 + 0.34 * ramp) + vec3(1.0, 0.9, 0.6) * sheen * 0.3;
		dc = mix(dc, gold, step(abs(mp.y - 0.052), 0.008) * trim);
		dc = mix(dc, o_crim * (0.8 + 0.3 * ramp), step(abs(mp.y - 0.075), 0.006) * crim_line);
		vec3 vc = o_veil * mix(mix(d_shade, vec3(1.0), 0.25), vec3(1.0), ramp) * mix(1.0, fold, 0.35 * (1.0 - notex)) + o_rim * fres * 0.3;
		vc = mix(vc, gold, step(0.93, vw) * trim);
		vec3 q2 = mp * 7.0; float w2 = fbm(q2 + vec3(fbm(q2 * 0.6 + 11.0), 0.0, fbm(q2 * 0.6 + 5.0)) * 1.6);
		vec3 mc = o_marble * (1.0 + (w2 - 0.5) * 0.08) * mix(vec3(0.76, 0.76, 0.9), vec3(1.0), ramp);
		mc = mix(mc, mc * vec3(0.72, 0.75, 0.88), (1.0 - smoothstep(0.0, 0.035, abs(w2 - 0.5))) * 0.65);
		mc = mix(mc, mc * vec3(0.8, 0.81, 0.9), (1.0 - smoothstep(0.0, 0.007, abs(fbm(q2 * 1.7 + 20.0) - 0.47))) * 0.8);
		mc += vec3(0.92, 0.94, 1.0) * fres * 0.12;
		col = mix(mix(dc, mc, step(0.5, ismar)), vc, step(0.5, isveil));
	}
"""
const DESIGNS := {
	1: {"hi": "f1ebe1", "lo": "c9beb6", "veil": "fdfbf6", "rim": "fff4dc", "sheen": 0.1},
	2: {"hi": "23808a", "lo": "144a59", "veil": "c9ebe6", "rim": "9fe8e0", "sheen": 0.2},
	3: {"hi": "363d80", "lo": "1c2050", "veil": "d3d7f6", "rim": "a9b4ff", "sheen": 0.22},
	4: {"hi": "8c2239", "lo": "50162e", "veil": "f4deda", "rim": "ff9aa0", "sheen": 0.2},
	5: {"hi": "302d3a", "lo": "16151d", "veil": "f6f3eb", "rim": "9a94c8", "sheen": 0.24},
	6: {"hi": "d37050", "lo": "9a4536", "veil": "f9e9d6", "rim": "ffc79a", "sheen": 0.14},
	7: {"hi": "8c9e76", "lo": "596a4f", "veil": "f0f3e2", "rim": "dff0b8", "sheen": 0.14},
	8: {"hi": "dfae47", "lo": "a6762a", "veil": "fff6da", "rim": "ffe9a0", "sheen": 0.18},
	31: {"hi": "4f4c8c", "lo": "2e2b5c", "veil": "ece7f6", "rim": "cbc4ff", "sheen": 0.2},
	32: {"hi": "2d5f7b", "lo": "1a3a55", "veil": "dceeee", "rim": "a5e6e6", "sheen": 0.2},
	33: {"hi": "5d3c7a", "lo": "361f50", "veil": "f3e6ef", "rim": "e3b8ff", "sheen": 0.2},
	34: {"hi": "484e86", "lo": "2a2e5e", "veil": "f7f1e6", "rim": "ffe9c8", "sheen": 0.2, "crim": 1.0},
}

func apply_design(m: ShaderMaterial, id: int, file: String) -> void:
	var d: Dictionary = DESIGNS[id]; var rr := rig_of(file)
	m.set_shader_parameter("design", 1.0); m.set_shader_parameter("orn", 0.0); m.set_shader_parameter("marble", 0.0)
	m.set_shader_parameter("o_dress_hi", Color(d.hi)); m.set_shader_parameter("o_dress_lo", Color(d.lo)); m.set_shader_parameter("o_veil", Color(d.veil))
	m.set_shader_parameter("o_rim", Color(d.rim)); m.set_shader_parameter("d_sheen", d.sheen); m.set_shader_parameter("crim_line", d.get("crim", 0.0)); m.set_shader_parameter("fore_y", rr.get("fore", -1.0))

## the drawn-on costume: marble limbs with gold seams, a pleated gown with a meander hem, a trimmed veil
const ORN_FRAG := """	if (orn > 0.5) {
		float shd = wt * wt + 0.95 * wz * wz + 0.84 * wx * wx + 0.76 * (1.0 - min(s, 1.0));
		float ang = atan(mp.x, mp.z);
		float kc = 0.0; float kf = armw; float kw = smoothstep(veil_y - 0.015, veil_y + 0.015, mp.y); float fold = 1.0;
		if (use_tex > 0.0) {
			vec3 t1 = texture(albedo_tex, UV).rgb; float lum = dot(t1, vec3(0.3, 0.55, 0.15)); float rg = t1.r - t1.g;
			kc = smoothstep(0.2, 0.34, rg);
			kf = smoothstep(0.035, 0.09, rg) * (1.0 - kc) * smoothstep(0.02, 0.07, t1.g - t1.b) * smoothstep(0.45, 0.6, t1.r);
			kw = smoothstep(0.7, 0.8, lum) * (1.0 - kc) * (1.0 - kf);
			fold = clamp(mix(lum / 0.56, lum / 0.92, kw), 0.86, 1.06);
			if (use_mask > 0.5) { vec3 t2 = texture(veil_mask, UV).rgb; kw = smoothstep(0.2, 0.34, t2.r - t2.g); kf *= 1.0 - kw; }
		}
		kf = max(kf, step(0.5, armw) * step(mp.y, fore_y));
		float isveil = max(notex, kw); float ismar = kf * (1.0 - isveil);
		float pl = smoothstep(0.2, 0.95, sin(ang * 44.0) * 0.5 + 0.5);
		vec3 dc = mix(o_dress_lo, o_dress_hi, smoothstep(0.1, 1.25, mp.y)) * (1.0 - 0.08 * (1.0 - plain) * pl * (1.0 - smoothstep(0.35, 0.9, mp.y))) * mix(1.0, mix(fold, 1.0, plain * 0.5), 1.0 - notex);
		dc = mix(dc, o_crim * 0.92, kc * (1.0 - plain));
		float bv = (mp.y - 0.05) / 0.1;
		if (bv > 0.0 && bv < 1.0 && plain < 0.5) dc = mix(o_crim, o_gold, key(vec2(fract(ang / 6.28318 * key_n), bv)));
		float ln = step(abs(mp.y - 0.046), 0.004) + step(abs(mp.y - 0.154), 0.004) + step(abs(mp.y - 0.172), 0.0025);
		dc = mix(dc, o_gold, clamp(ln, 0.0, 1.0) * (1.0 - plain));
		float sv = abs(mp.y - sash_y);
		if (sv < 0.032 && armw < 0.5 && plain < 0.5) dc = mix(o_crim, o_gold, step(0.024, sv));
		vec3 q2 = mp * 7.0; float w2 = fbm(q2 + vec3(fbm(q2 * 0.6 + 11.0), 0.0, fbm(q2 * 0.6 + 5.0)) * 1.6);
		vec3 mc = o_marble * (1.0 + (w2 - 0.5) * 0.08);
		mc = mix(mc, mc * vec3(0.74, 0.76, 0.88), (1.0 - smoothstep(0.0, 0.035, abs(w2 - 0.5))) * mix(0.5, 0.7, plain));
		mc = mix(mc, mix(o_gold, mc * vec3(0.8, 0.81, 0.9), plain), (1.0 - smoothstep(0.0, 0.007, abs(fbm(q2 * 1.7 + 20.0) - 0.47))) * 0.9);
		mc = mix(mc, o_gold, step(abs(mp.y - brace_y), 0.011) * step(0.5, armw) * (1.0 - plain));
		vec3 vc = o_veil * mix(1.0, fold, 1.0 - notex);
		vc = mix(vc, o_crim, step(0.8, vw) * step(vw, 0.86) * (1.0 - plain)); vc = mix(vc, o_gold, step(0.92, vw) * (1.0 - plain));
		col = mix(mix(dc, mc, step(0.5, ismar)), vc, step(0.5, isveil)) * shd * 1.05;
	}
"""

## where the head of each figure is, so a cloth can be laid over the face
const FACE_VEIL := {"min9": {"cx": -0.008, "cz": 0.03, "rx": 0.108, "rzf": 0.139, "rzb": 0.12, "top": 1.731, "eq": 1.62, "chin": 1.5, "hem": 1.365},
	"min13": {"cx": 0.006, "cz": -0.03, "rx": 0.116, "rzf": 0.14, "rzb": 0.125, "top": 1.732, "eq": 1.62, "chin": 1.5, "hem": 1.41}}
const VEIL_COL := {"min13tb": Vector3(0.80, 0.11, 0.14), "min13ta": Vector3(0.93, 0.91, 0.86)}

func add_face_veil(d: Dictionary, vs: PackedVector3Array, ns: PackedVector3Array, cols: PackedColorArray, ix: PackedInt32Array) -> void:
	var NT := 30; var NV := 20; var TH := deg_to_rad(104.0)
	var base := vs.size()
	var pts: Array = []; var wts: Array = []
	for iv in NV + 1:
		var v := float(iv) / NV
		for it in NT + 1:
			var th := lerpf(-TH, TH, float(it) / NT)
			var a := absf(th) / TH
			var hem: float = d.hem + 0.11 * a * a + 0.006 * cos(th * 9.0)
			var f := 1.0; var y := 0.0; var w := 0.0
			var tuck := 0.2 * smoothstep(0.55, 1.0, a)
			if v < 0.4:
				var ph := v / 0.4 * PI * 0.5
				f = pow(sin(ph), 0.36) * (1.0 - tuck)
				y = d.top - (d.top - d.eq) * (1.0 - cos(ph))
			else:
				var q := (v - 0.4) / 0.6
				y = lerpf(d.eq, hem, q)
				var below := clampf((d.eq - y) / (d.eq - d.chin), 0.0, 1.0)
				f = (1.0 - tuck * (1.0 - below)) * (1.0 + 0.05 * q + 0.012 * cos(th * 8.0) * q)
				w = q
			var rz: float = d.rzf if cos(th) > 0.0 else d.rzb
			pts.append(Vector3(d.cx + d.rx * f * sin(th), y, d.cz + rz * f * cos(th))); wts.append(w)
	var W := NT + 1
	for iv in NV + 1:
		for it in NT + 1:
			var pp: Vector3 = pts[iv * W + it]
			var du: Vector3 = pts[iv * W + mini(it + 1, NT)] - pts[iv * W + maxi(it - 1, 0)]
			var dv: Vector3 = pts[mini(iv + 1, NV) * W + it] - pts[maxi(iv - 1, 0) * W + it]
			var n := dv.cross(du)
			var out := Vector3(pp.x - d.cx, 0.0, pp.z - d.cz)
			if n.length() < 1e-7: n = Vector3.UP
			elif n.dot(out) < 0.0: n = -n
			vs.append(pp); ns.append(n.normalized()); cols.append(Color(wts[iv * W + it], 1, 0))
	for iv in NV:
		for it in NT:
			var a0 := base + iv * W + it
			ix.append_array(PackedInt32Array([a0, a0 + 1, a0 + W, a0 + 1, a0 + W + 1, a0 + W]))

## where the joints are inside each figure (model space, 1.72 m tall, facing +Z)
const RIGS := {"min9": {"cx": -0.012, "hx": 0.065, "hy": 0.9, "zc": -0.02, "A": 0.26, "l1": 0.43, "l2": 0.43, "arm": Vector4(0.17, 1.4, -0.01, -0.012), "arm_on": 1.0, "adduct": 0.1, "sash": 1.09, "brace": 0.835, "fore": 1.0},
	"min14": {"cx": 0.0, "hx": 0.06, "hy": 0.9, "zc": 0.0, "A": 0.24, "l1": 0.43, "l2": 0.43, "arm": Vector4(0.19, 1.38, 0.0, 0.0), "arm_on": 0.0, "adduct": 0.0, "sash": -1.0, "brace": -1.0},
	"min13": {"cx": 0.0, "hx": 0.065, "hy": 0.9, "zc": 0.03, "A": 0.24, "l1": 0.43, "l2": 0.43, "arm": Vector4(0.17, 1.4, 0.0, 0.0), "arm_on": 0.0, "adduct": 0.0, "sash": -1.0, "brace": -1.0, "keys": 44.0, "mask": "min13tb"}}

func rig_of(file: String) -> Dictionary:
	var k := file.substr(0, file.find("t")) if file.find("t") > 0 else file
	return RIGS.get(k, RIGS["min13"])

func leg_pose(ph: float, side: float, amt: float, R: Dictionary) -> Array:
	var hip := Vector3(R.cx + side * R.hx, R.hy, R.zc)
	var u := fposmod(ph, TAU) / TAU
	var z := 0.0; var lift := 0.0
	if u < 0.62: z = lerpf(1.0, -1.0, u / 0.62)
	else:
		var q := (u - 0.62) / 0.38
		z = -cos(q * PI); lift = sin(q * PI)
	var foot := Vector3(hip.x - side * 0.012, 0.06 + 0.08 * lift * amt, R.zc + z * R.A * amt)
	var d := foot - hip
	var L := minf(d.length(), R.l1 + R.l2 - 0.002)
	var a := acos(clampf((R.l1 * R.l1 + L * L - R.l2 * R.l2) / (2.0 * R.l1 * L), -1.0, 1.0))
	var dn := d.normalized()
	var fw := (Vector3(0, 0, 1) - dn * dn.z).normalized()
	return [hip, hip + (dn * cos(a) + fw * sin(a)) * R.l1, foot]

func body_mat(pl: String, key: String) -> ShaderMaterial:
	var m := ShaderMaterial.new(); m.shader = shaders["body"]
	m.set_shader_parameter("c_top", Color(pals[pl][0])); m.set_shader_parameter("c_z", Color(pals[pl][1])); m.set_shader_parameter("c_x", Color(pals[pl][2]))
	m.set_shader_parameter("fog_col", sea_c); m.set_shader_parameter("mist_col", mist_c); m.set_shader_parameter("shadow_col", shadow_c); m.set_shader_parameter("mist_k", mist_k)
	if OS.get_environment("FACET") == "1": m.set_shader_parameter("flat_n", 1.0)
	pmats["body|" + key] = m; timed.append(m); body_mats.append(m)
	return m

func spawn_shape(parent: Node, mode: String, file := "", design_id := -1) -> Dictionary:
	if file == "": file = shape_file
	if not shape_cache.has(file):
		var bm := bake_shape(file); shape_cache[file] = {"mesh": bm, "tex": shape_tex}
	var stex: Texture2D = shape_cache[file].tex
	var holder := Node3D.new(); parent.add_child(holder)
	var mi := MeshInstance3D.new(); mi.mesh = shape_cache[file].mesh; holder.add_child(mi)
	mi.extra_cull_margin = 6.0   # her reflection lies on the water beside her
	match mode:
		"main":
			var m := body_mat("veil", "main" + file + str(holder.get_instance_id())); m.set_shader_parameter("marble", 0.22); mi.material_override = m
			if stex != null:
				m.set_shader_parameter("albedo_tex", stex); m.set_shader_parameter("use_tex", 1.0); m.set_shader_parameter("marble", 0.0)
				if VEIL_COL.has(file): m.set_shader_parameter("veil_col", VEIL_COL[file])
			if OS.get_environment("ORN") != "0":
				var rr := rig_of(file)
				m.set_shader_parameter("orn", 1.0); m.set_shader_parameter("marble", 0.0); m.set_shader_parameter("sash_y", rr.sash); m.set_shader_parameter("brace_y", rr.brace); m.set_shader_parameter("key_n", rr.get("keys", 24.0))
				if OS.get_environment("COSTUME") != "ornate":
					m.set_shader_parameter("plain", 1.0)
					m.set_shader_parameter("o_dress_hi", Color("c22a35")); m.set_shader_parameter("o_dress_lo", Color("ad202c")); m.set_shader_parameter("o_veil", Color("e0656e"))
					m.set_shader_parameter("fore_y", rr.get("fore", -1.0))
					if rr.has("mask") and stex != null:
						if not shape_cache.has(rr.mask):
							var mm := bake_shape(rr.mask); shape_cache[rr.mask] = {"mesh": mm, "tex": shape_tex}
						if shape_cache[rr.mask].tex != null: m.set_shader_parameter("veil_mask", shape_cache[rr.mask].tex); m.set_shader_parameter("use_mask", 1.0)
			if design_id < 0 and OS.get_environment("DESIGN") != "": design_id = int(OS.get_environment("DESIGN"))
			if design_id < 0 and OS.get_environment("COSTUME") == "": design_id = 32
			if design_id > 0: apply_design(m, design_id, file)
			var r0 := rig_of(file)
			m.set_shader_parameter("armp", r0.arm); m.set_shader_parameter("arm_on", r0.arm_on)
			mi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_ON
		"crim":
			var m2 := body_mat("crim", "refl"); m2.set_shader_parameter("grad_lo", Vector3(0.8, 0.8, 0.85)); mi.material_override = m2
			mi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
		"flat":
			mi.material_override = ghost_flat; mi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
		"marble":
			mi.material_override = pal("marble", "2"); mi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_ON
	return {"holder": holder, "mi": mi}

func load_shape(file: String, at: Vector3, yaw: float, pl := "veil") -> Node3D:
	var st := GLTFState.new(); var doc := GLTFDocument.new()
	if doc.append_from_buffer(FileAccess.get_file_as_bytes("res://hero_models/%s.glb" % file), "", st) != OK: return null
	var src := doc.generate_scene(st) as Node3D
	var holder := Node3D.new(); holder.position = at; holder.rotation.y = yaw; add_child(holder); holder.add_child(src)
	src.rotation.y = -PI * 0.5
	var bb := AABB(); var first := true
	for m in src.find_children("*", "MeshInstance3D", true, false):
		var mi := m as MeshInstance3D
		for si in mi.mesh.get_surface_count(): mi.set_surface_override_material(si, pal(pl, "2"))
		var a: AABB = mi.global_transform * mi.get_aabb()
		if first: bb = a; first = false
		else: bb = bb.merge(a)
	var a2 := holder.global_transform.affine_inverse() * bb
	var sc := 1.72 / maxf(a2.size.y, 0.001)
	src.scale *= sc; src.position -= Vector3(a2.get_center().x, a2.position.y, a2.get_center().z) * sc
	return holder

func _min_lineup() -> void:
	started = true; title_box.hide(); hint.hide()
	pos = Vector3(60, 0, 60)
	var c := Vector3(0.2, 0, 0.3)
	var dir := Vector3(1, 0, -1).normalized()
	var hs := []
	var names := (OS.get_environment("MINS") if OS.get_environment("MINS") != "" else "1,2,3,4").split(",")
	var tag := OS.get_environment("MIN_TAG")
	var dz := OS.get_environment("DESIGNS").split(",") if OS.get_environment("DESIGNS") != "" else PackedStringArray()
	var gap := float(OS.get_environment("MIN_SPACE")) if OS.get_environment("MIN_SPACE") != "" else 1.35
	var vsz := float(OS.get_environment("MIN_SIZE")) if OS.get_environment("MIN_SIZE") != "" else 6.4
	for i in names.size():
		var off := (i - (names.size() - 1) * 0.5) * gap
		if OS.get_environment("TEX") == "1":
			var sd := spawn_shape(self, "main", "min" + names[i], int(dz[i]) if i < dz.size() else -1); (sd.holder as Node3D).position = c + dir * off; hs.append(sd.holder)
		else:
			hs.append(load_shape("min" + names[i], c + dir * off, PI * 0.25))
		var l := Label3D.new(); l.text = names[i] if OS.get_environment("TEX") != "1" else (dz[i] if i < dz.size() else "ABCDEF"[i])
		if OS.get_environment("MIN_LABELS") != "": l.text = OS.get_environment("MIN_LABELS").split(",")[i]
		l.font_size = 96; l.pixel_size = 0.004 * vsz / 6.4; l.billboard = BaseMaterial3D.BILLBOARD_ENABLED
		l.modulate = Color(0.72, 0.14, 0.18); l.outline_modulate = Color(1, 1, 1, 0.9); l.no_depth_test = true
		l.position = c + dir * off + Vector3(0.75, 0.05, 0.75) * (vsz / 6.4); add_child(l)
	var dirn := OS.get_environment("SHOT_DIR")
	await get_tree().create_timer(2.5).timeout
	for view in [["minimal-front", PI * 0.25], ["minimal-back", PI * 1.12], ["minimal-side", -PI * 0.2]]:
		shot = {"c": c + Vector3(0, 0.95 if vsz > 5.0 else 0.6, 0), "s": vsz}
		cam.size = vsz
		for h in hs:
			if h != null: (h as Node3D).rotation.y = view[1]
		await get_tree().create_timer(0.8).timeout
		await RenderingServer.frame_post_draw
		get_viewport().get_texture().get_image().save_png("%s/%s%s.png" % [dirn, view[0], tag])
		print("SHOT ", view[0])
	get_tree().quit()

func _lineup() -> void:
	started = true; title_box.hide(); hint.hide()
	pos = Vector3(60, 0, 60)
	var c := Vector3(0.2, 0, 0.3)
	var dir := Vector3(1, 0, -1).normalized()
	var figs := []
	for i in 5:
		var f = Fig.new(); add_child(f); f.set_style(i + 1); f.build(0, pal, veil_m, face_m)
		figs.append(f)
		var l := Label3D.new(); l.text = str(i + 1); l.font_size = 96; l.pixel_size = 0.004; l.billboard = BaseMaterial3D.BILLBOARD_ENABLED
		l.modulate = Color(0.72, 0.14, 0.18); l.outline_modulate = Color(1, 1, 1, 0.9); l.no_depth_test = true
		l.position = c + dir * ((i - 2) * 1.3) + Vector3(0.75, 0.05, 0.75); add_child(l)
	var dirn := OS.get_environment("SHOT_DIR")
	await get_tree().create_timer(2.0).timeout
	for view in [["heroines-front", PI * 0.25], ["heroines-back", PI * 1.12], ["heroines-side", -PI * 0.25]]:
		shot = {"c": c + Vector3(0, 1.0, 0), "s": 7.6}
		cam.size = 7.6
		for i in 5:
			figs[i].veil_ready = false
			figs[i].apply(pose_state(c + dir * ((i - 2) * 1.3), view[1]))
		await get_tree().create_timer(0.6).timeout
		await RenderingServer.frame_post_draw
		get_viewport().get_texture().get_image().save_png("%s/%s.png" % [dirn, view[0]])
		print("SHOT ", view[0])
	get_tree().quit()

func ring_mat(tint: Vector3) -> ShaderMaterial:
	var m := ShaderMaterial.new(); m.shader = shaders["ring"]; m.set_shader_parameter("tint", tint); m.render_priority = 2
	return m

func _env() -> void:
	var env := Environment.new()
	env.background_mode = Environment.BG_COLOR; env.background_color = bg_c
	if OS.get_environment("MOOD") == "moody":
		env.adjustment_enabled = true; env.adjustment_brightness = 0.94; env.adjustment_contrast = 1.04; env.adjustment_saturation = 0.84
	var we := WorldEnvironment.new(); we.environment = env; add_child(we)
	var sunl := DirectionalLight3D.new()
	sunl.look_at_from_position(Vector3.ZERO, Vector3(0.62, -0.56, -0.5), Vector3.UP)
	sunl.light_energy = 1.0; sunl.shadow_enabled = true; sunl.shadow_blur = 0.8; sunl.shadow_bias = 0.04; sunl.shadow_normal_bias = 1.2
	sunl.directional_shadow_mode = DirectionalLight3D.SHADOW_ORTHOGONAL; sunl.directional_shadow_max_distance = 70.0
	add_child(sunl); sun_light = sunl
	cam = Camera3D.new(); cam.projection = Camera3D.PROJECTION_ORTHOGONAL
	cam.keep_aspect = Camera3D.KEEP_WIDTH; cam.size = 11.0; cam.near = 0.1; cam.far = 150.0
	cam.rotation_degrees = Vector3(-35.264, 45, 0)
	add_child(cam); cam.current = true
	var sq := QuadMesh.new(); sq.size = Vector2(260, 260); sq.orientation = PlaneMesh.FACE_Y
	foam_mat = ShaderMaterial.new(); foam_mat.shader = shaders["foam"]; foam_mat.render_priority = 1; timed.append(foam_mat)
	sea_mat = ShaderMaterial.new(); sea_mat.shader = shaders["sea"]
	sea_mat.set_shader_parameter("near_col", sea_c); sea_mat.set_shader_parameter("far_col", mist_c); sea_mat.set_shader_parameter("mist_k", clampf(mist_k + 0.15, 0.0, 1.0))
	prim(sq, Vector3(0, WATER, 0), sea_mat)
	var flies := _particles(26, 7.0, Vector3(5, 0.6, 9), 0.05, Color(1.0, 0.82, 0.45, 0.85), Vector3(0, 0.02, 0), 0.12, true)
	flies.position = Vector3(0, 0.5, -48); flies.rotation.x = PI * 0.5; cam.add_child(flies)
	var petals := _particles(16, 9.0, Vector3(5, 0.5, 9), 0.05, Color(0.86, 0.25, 0.3, 0.85), Vector3(0.06, -0.12, 0), 0.05)
	petals.position = Vector3(0, 3.0, -46); petals.rotation.x = PI * 0.5; cam.add_child(petals)

func _particles(n: int, life: float, ext: Vector3, size: float, c: Color, grav: Vector3, v: float, add := false) -> CPUParticles3D:
	var p := CPUParticles3D.new()
	p.amount = n; p.lifetime = life; p.preprocess = life
	p.emission_shape = CPUParticles3D.EMISSION_SHAPE_BOX; p.emission_box_extents = ext
	p.gravity = grav; p.initial_velocity_min = v * 0.3; p.initial_velocity_max = v; p.spread = 180.0
	p.scale_amount_min = 0.5; p.scale_amount_max = 1.2
	var g := Gradient.new(); g.offsets = PackedFloat32Array([0.0, 0.2, 0.8, 1.0])
	g.colors = PackedColorArray([Color(c.r, c.g, c.b, 0), c, c, Color(c.r, c.g, c.b, 0)]); p.color_ramp = g
	var q := QuadMesh.new(); q.size = Vector2(size, size)
	var m := StandardMaterial3D.new(); m.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	m.billboard_mode = BaseMaterial3D.BILLBOARD_ENABLED; m.vertex_color_use_as_albedo = true
	m.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	if add: m.blend_mode = BaseMaterial3D.BLEND_MODE_ADD
	q.material = m; p.mesh = q
	return p

func _fit() -> void:
	pass

## one stone of an arch that stands in the plane of x and y: the wedge between two angles and two radii, hz deep either way
func wedge(c: Vector3, r0: float, r1: float, th0: float, th1: float, hz: float) -> void:
	var d0 := Vector3(cos(th0), sin(th0), 0); var d1 := Vector3(cos(th1), sin(th1), 0); var dm := Vector3(cos((th0 + th1) * 0.5), sin((th0 + th1) * 0.5), 0)
	var zf := Vector3(0, 0, hz)
	var a := c + d0 * r0; var b := c + d0 * r1; var e := c + d1 * r1; var f := c + d1 * r0
	for q in [[[a + zf, b + zf, e + zf, f + zf], Vector3.BACK], [[a - zf, b - zf, e - zf, f - zf], Vector3.FORWARD], [[b - zf, b + zf, e + zf, e - zf], dm], [[a - zf, a + zf, f + zf, f - zf], -dm],
			[[a - zf, a + zf, b + zf, b - zf], Vector3(d0.y, -d0.x, 0)], [[f - zf, f + zf, e + zf, e - zf], Vector3(-d1.y, d1.x, 0)]]:
		for i in [0, 1, 2, 0, 2, 3]:
			bv.append(q[0][i]); bn.append(q[1])

## the ring gate: an arch of cut stones that springs from two round piers in the sea, over the way to the garden. Its
## stones are wedges that meet face to face (they were square blocks turned on a circle, with gaps between their
## corners), in two tones by turns, with a keystone that stands a little proud
func ring_gate(c: Vector3, rad: float, n := 17) -> void:
	for tone in 2:
		for i in n:
			if i % 2 != tone or i == n / 2: continue
			wedge(c, rad - 0.2, rad + 0.2, PI * i / n, PI * (i + 1) / n, 0.21)
		bb_end("stone" if tone == 0 else "shade")
	wedge(c, rad - 0.22, rad + 0.29, PI * (n / 2) / n, PI * (n / 2 + 1) / n, 0.25); bb_end("stone")
	for sx in [-1.0, 1.0]:
		cyl(c + Vector3(sx * rad, -1.2, 0), 0.34, 0.3, 1.25, pal("shade"), 16); foam(c.x + sx * rad - 0.34, c.z - 0.34, c.x + sx * rad + 0.34, c.z + 0.34, 0.3)
		blk(c + Vector3(sx * rad - 0.26, 0.05, -0.26), c + Vector3(sx * rad + 0.26, 0.13, 0.26), "stone")      # the impost each side springs from

## a thing to look at: its place on the ground, how tall it stands, and the lines it gives (one at each look, in turn)
func _look_add(key: String, foot: Vector3, h: float, lines: Array, big := false) -> void:
	if key == "": look_n += 1; key = "look%d" % look_n
	looks[key] = {"foot": foot, "top": foot + Vector3(0, h, 0), "lines": lines, "i": 0, "big": big}

## a stele of the sculptor's: an upright slab with lines of his writing on it
func stele(key: String, p: Vector3, yaw: float, lines: Array) -> void:
	if FileAccess.file_exists("res://props/stele.glb"): thing("stele", p, 0.0, STELE_PARTS, yaw)
	else:
		var n := Node3D.new(); n.position = p; n.rotation.y = yaw; add_child(n)
		blk(Vector3(-0.34, 0, -0.16), Vector3(0.34, 0.07, 0.16), "shade", n); blk(Vector3(-0.29, 0.07, -0.12), Vector3(0.29, 0.13, 0.12), "stone", n)
		blk(Vector3(-0.24, 0.13, -0.07), Vector3(0.24, 1.12, 0.07), "marble", n)
		var pd := PrismMesh.new(); pd.size = Vector3(0.56, 0.16, 0.16); prim(pd, Vector3(0, 1.2, 0), pal("stone", "flat"), n)
		for r in 6:
			for c in 4: blk(Vector3(-0.19 + 0.1 * c, 0.92 - 0.12 * r, 0.07), Vector3(-0.12 + 0.1 * c - 0.02 * ((r + c) % 2), 0.935 - 0.12 * r, 0.074), "dark", n)
	solids.append(Vector3(p.x, p.z, 0.36))
	_look_add(key, p, 1.25, lines, true)

func plinth_head(nm: String, fp: Vector3, yaw: float) -> void:
	_look_add("", fp, 1.3, LOOK_LINES["head"])
	pedestal(fp)
	model(nm, fp + Vector3(0, 0.78, 0), 0.62, yaw)
	decal(fp + Vector3(0.12, 0, -0.12), 0.9, 0.7, 0.2, 0.78)

func statue_on(nm: String, sp: Vector3, h: float, yaw: float) -> void:
	_look_add("", sp, 0.17 + h, LOOK_LINES.get(nm, LOOK_LINES["observer_veiled"]))
	cyl(sp, 0.32, 0.3, 0.07, pal("shade"), 20); cyl(sp + Vector3(0, 0.07, 0), 0.26, 0.26, 0.1, pal("stone"), 20)
	model(nm, sp + Vector3(0, 0.17, 0), h, yaw)
	decal(sp + Vector3(0.15, 0, -0.15), 1.1, 0.8, 0.2, 0.78)

## mirrored things need their own materials: two-sided, and without the pass that lays a reflection on the sea
## A reflection lies on the water well away from the thing that casts it, so that thing must still be drawn when
## it is itself just off the screen. Without this, each piece's reflection came and went as the camera moved.
## Makes the built world cheap to draw, without changing how it looks.
## 1. The dark reflection on the sea is a second drawing of every piece. A piece whose reflection would fall wholly
##    under a floor (seen from the fixed eye) is never seen there, so it loses that second drawing.
## 2. The world is thousands of small boxes and cylinders, each drawn by a call of its own. Those that never move and
##    share a material are joined into one mesh per material and per square of ground.
## A piece is left alone if any variable of this script holds it (or a node above it): gates, wheels, doors, the pools'
## mirrored halves, anything named. LIGHTEN=0 turns this off; LIGHTEN=check joins nothing and reports any piece that
## would have been joined and later moved or hid.
func _lighten(root: Node3D) -> void:
	var mode := OS.get_environment("LIGHTEN")
	if mode == "0": return
	var held := {}
	for pi in get_script().get_script_property_list():
		if pi.name in ["world", "lighten_check"]: continue
		_held(get(pi.name), held, 0)
	var groups := {}; var stripped := 0; var seen := 0
	for mm in root.find_children("*", "MeshInstance3D", true, false):
		var mi := mm as MeshInstance3D
		if mi.mesh == null or mi.skin != null or mi.get_child_count() > 0 or not mi.is_visible_in_tree(): continue
		if not (mi.mesh is ArrayMesh or mi.mesh is PrimitiveMesh): continue
		var m := mi.material_override
		var pal_m: bool = m is ShaderMaterial and ((m as ShaderMaterial).shader == shaders["base"] or (m as ShaderMaterial).shader == shaders["two"])
		var plain: bool = m is StandardMaterial3D and (m as StandardMaterial3D).albedo_texture == null
		if not pal_m and not plain: continue
		if pal_m:
			var sw = (m as ShaderMaterial).get_shader_parameter("sway")
			if sw != null and float(sw) > 0.0: continue
		var fixed := true; var up: Node = mi
		while up != root and up != null:
			if held.has(up) or not String(up.name).begins_with("@"): fixed = false; break
			up = up.get_parent()
		if not fixed: continue
		var tri := true
		for si in mi.mesh.get_surface_count():
			if mi.mesh is ArrayMesh and (mi.mesh as ArrayMesh).surface_get_primitive_type(si) != Mesh.PRIMITIVE_TRIANGLES: tri = false
		if not tri: continue
		seen += 1
		var box: AABB = mi.global_transform * mi.get_aabb()
		var refl_on: bool = pal_m and refl_mat != null and (m as ShaderMaterial).next_pass == refl_mat
		if refl_on:
			var shows := false
			for i in 10:
				var c := (box.get_center() + Vector3(0, box.size.y * (0.5 if i == 8 else -0.5), 0)) if i >= 8 else box.get_endpoint(i)
				var h := c.y - WATER
				if h < 0.03: continue
				var hid := false
				for f in floors:     # the place on the sea where this point is mirrored, followed up to the floor's underside
					var k: float = h + (f[4] - WATER)
					if c.x + k > f[0] + 0.04 and c.x + k < f[2] - 0.04 and c.z + k > f[1] + 0.04 and c.z + k < f[3] - 0.04: hid = true; break
				if not hid: shows = true; break
			if not shows: refl_on = false; stripped += 1
		var ce := box.get_center()
		var two_m: bool = pal_m and (m as ShaderMaterial).shader == shaders["two"]
		var key := ""
		if pal_m: key = "pal|%s|%s|%d|%d|%d|%d" % [two_m, refl_on, mi.cast_shadow, mi.layers, floori(ce.x / 12.0), floori(ce.z / 12.0)]
		else: key = "plain|%d|%d|%d|%d|%d" % [m.get_instance_id(), mi.cast_shadow, mi.layers, floori(ce.x / 12.0), floori(ce.z / 12.0)]
		if not groups.has(key): groups[key] = {"m": m, "pal": pal_m, "two": two_m, "refl": refl_on, "list": []}
		groups[key].list.append(mi)
	# pieces that stay their own (statues, models): they too lose the sea reflection where it could never be seen
	var own := 0
	for mm in root.find_children("*", "MeshInstance3D", true, false):
		var mi := mm as MeshInstance3D
		if mi.mesh == null or not mi.is_visible_in_tree() or refl_mat == null: continue
		var moves := false; var up2: Node = mi
		while up2 != root and up2 != null:
			if held.has(up2): moves = true; break
			up2 = up2.get_parent()
		if moves: continue
		var box2: AABB = (mi.global_transform * mi.get_aabb()).grow(0.5 if mi.skin != null else 0.0)
		var shows2 := false
		for i in 8:
			var c2p := box2.get_endpoint(i); var h2 := c2p.y - WATER
			if h2 < 0.03: continue
			var hid2 := false
			for f in floors:
				var k2: float = h2 + (f[4] - WATER)
				if c2p.x + k2 > f[0] + 0.04 and c2p.x + k2 < f[2] - 0.04 and c2p.z + k2 > f[1] + 0.04 and c2p.z + k2 < f[3] - 0.04: hid2 = true; break
			if not hid2: shows2 = true; break
		if shows2: continue
		var ov := mi.material_override as ShaderMaterial
		if ov != null and ov.next_pass == refl_mat: mi.material_override = _norefl(ov); own += 1
		for si in mi.mesh.get_surface_count():
			var so := mi.get_surface_override_material(si) as ShaderMaterial
			if so != null and so.next_pass == refl_mat: mi.set_surface_override_material(si, _norefl(so)); own += 1
	var joined := 0; var made := 0
	var lin := false   # the tones go in as the palette writes them: this renderer hands a colour to the shader unchanged
	for key in groups:
		var g: Dictionary = groups[key]
		if mode == "check":
			for mi in g.list: lighten_check.append([mi, (mi as MeshInstance3D).global_transform, (mi as MeshInstance3D).get_path()])
			joined += g.list.size(); continue
		var vs := PackedVector3Array(); var ns := PackedVector3Array(); var ix := PackedInt32Array(); var margin := 0.0
		var c0 := PackedFloat32Array(); var c1 := PackedFloat32Array(); var c2 := PackedFloat32Array()
		var inv := root.global_transform.affine_inverse()
		for mi2 in g.list:
			var mi := mi2 as MeshInstance3D
			var xf := inv * mi.global_transform; var nb := xf.basis.inverse().transposed(); var flip := xf.basis.determinant() < 0.0
			var tone := [Color.WHITE, Color.WHITE, Color.WHITE]; var par := [0.0, 0.0, 0.0]
			if g.pal:
				var sm := mi.material_override as ShaderMaterial
				for ti in 3:
					var cc = sm.get_shader_parameter(["c_top", "c_z", "c_x"][ti])
					var col: Color = Color(cc.x, cc.y, cc.z) if cc is Vector3 else (cc as Color)
					tone[ti] = col.srgb_to_linear() if lin else col
				for pi2 in 3:
					var pv = sm.get_shader_parameter(["marble", "tone_var", "flat_n"][pi2])
					par[pi2] = float(pv) if pv != null else 0.0
			for si in mi.mesh.get_surface_count():
				var a := mi.mesh.surface_get_arrays(si)
				var v: PackedVector3Array = a[Mesh.ARRAY_VERTEX]; var n = a[Mesh.ARRAY_NORMAL]; var id = a[Mesh.ARRAY_INDEX]
				var base := vs.size()
				for i in v.size():
					vs.append(xf * v[i]); ns.append((nb * (n[i] if n != null else Vector3.UP)).normalized())
					if g.pal:
						c0.append(tone[0].r); c0.append(tone[0].g); c0.append(tone[0].b); c0.append(par[0])
						c1.append(tone[1].r); c1.append(tone[1].g); c1.append(tone[1].b); c1.append(par[1])
						c2.append(tone[2].r); c2.append(tone[2].g); c2.append(tone[2].b); c2.append(par[2])
				var cnt: int = id.size() if id != null else v.size()
				for i in range(0, cnt, 3):
					var i0: int = id[i] if id != null else i; var i1: int = id[i + 1] if id != null else i + 1; var i2: int = id[i + 2] if id != null else i + 2
					ix.append(base + i0); ix.append(base + (i2 if flip else i1)); ix.append(base + (i1 if flip else i2))
			margin = maxf(margin, mi.extra_cull_margin)
		var arr := []; arr.resize(Mesh.ARRAY_MAX); arr[Mesh.ARRAY_VERTEX] = vs; arr[Mesh.ARRAY_NORMAL] = ns; arr[Mesh.ARRAY_INDEX] = ix
		var am := ArrayMesh.new(); var out_m: Material = g.m
		if g.pal:
			arr[Mesh.ARRAY_CUSTOM0] = c0; arr[Mesh.ARRAY_CUSTOM1] = c1; arr[Mesh.ARRAY_CUSTOM2] = c2
			var fl := (Mesh.ARRAY_CUSTOM_RGBA_FLOAT << Mesh.ARRAY_FORMAT_CUSTOM0_SHIFT) | (Mesh.ARRAY_CUSTOM_RGBA_FLOAT << Mesh.ARRAY_FORMAT_CUSTOM1_SHIFT) | (Mesh.ARRAY_CUSTOM_RGBA_FLOAT << Mesh.ARRAY_FORMAT_CUSTOM2_SHIFT)
			am.add_surface_from_arrays(Mesh.PRIMITIVE_TRIANGLES, arr, [], {}, fl)
			out_m = _one_mat(g.two, g.refl)
		else: am.add_surface_from_arrays(Mesh.PRIMITIVE_TRIANGLES, arr)
		var out := MeshInstance3D.new(); out.mesh = am; out.material_override = out_m; out.cast_shadow = (g.list[0] as MeshInstance3D).cast_shadow; out.layers = (g.list[0] as MeshInstance3D).layers
		out.extra_cull_margin = margin; root.add_child(out); made += 1
		for mi3 in g.list:
			joined += 1; (mi3 as Node).get_parent().remove_child(mi3); (mi3 as Node).queue_free()
	print("LIGHTEN ", seen, " still pieces; ", stripped, " lose their sea reflection (and ", own, " statues and models); ", joined, " joined into ", made, " meshes")

## Every ring of foam in the sea was a mesh of its own, drawn by a call of its own (some forty of them). None of them
## moves and all share one material: they become one mesh. It is drawn after the sea, always (render_priority): each
## ring used to be sorted against the sea by its own distance, so those beyond the middle of the map lay under the
## sea's own colour and were fainter than the near ones
func _join_foam(root: Node3D) -> void:
	if OS.get_environment("LIGHTEN") == "0": return
	var v := PackedVector3Array(); var uv := PackedVector2Array(); var n := 0
	var inv := root.global_transform.affine_inverse()
	for mm in root.find_children("*", "MeshInstance3D", true, false):
		var mi := mm as MeshInstance3D
		if mi.material_override != foam_mat or mi.mesh == null: continue
		var xf := inv * mi.global_transform
		var a := mi.mesh.surface_get_arrays(0); var av: PackedVector3Array = a[Mesh.ARRAY_VERTEX]; var au: PackedVector2Array = a[Mesh.ARRAY_TEX_UV]
		for i in av.size():
			v.append(xf * av[i]); uv.append(au[i])
		mi.get_parent().remove_child(mi); mi.queue_free(); n += 1
	if v.is_empty(): return
	var arr := []; arr.resize(Mesh.ARRAY_MAX); arr[Mesh.ARRAY_VERTEX] = v; arr[Mesh.ARRAY_TEX_UV] = uv
	var am := ArrayMesh.new(); am.add_surface_from_arrays(Mesh.PRIMITIVE_TRIANGLES, arr)
	var out := MeshInstance3D.new(); out.mesh = am; out.material_override = foam_mat; out.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	root.add_child(out)
	print("FOAM ", n, " rings joined into one mesh")

## the same material without the second drawing on the sea (kept among the materials that follow the lights and the mist)
func _norefl(m: ShaderMaterial) -> ShaderMaterial:
	var k := "norefl|%d" % m.get_instance_id()
	if not pmats.has(k):
		var m2 := m.duplicate() as ShaderMaterial; m2.next_pass = null; pmats[k] = m2
	return pmats[k]

func _held(v, held: Dictionary, depth: int) -> void:
	if depth > 4: return
	if v is Node: held[v] = true
	elif v is Array:
		for e in v: _held(e, held, depth + 1)
	elif v is Dictionary:
		for k in v: _held(k, held, depth + 1); _held(v[k], held, depth + 1)

func _refl_margins(n: Node) -> void:
	if n is GeometryInstance3D and n.is_inside_tree():
		var g := n as GeometryInstance3D
		var top := (g.global_transform * g.get_aabb()).end.y
		g.extra_cull_margin = maxf(g.extra_cull_margin, clampf((top - WATER) * 2.0, 0.0, 40.0))
	for c in n.get_children(): _refl_margins(c)

## skip: how many of the root's children were already done. sh: the shader the copies get ("mir" takes no shadows:
## a thing that hangs under the floor must not be darkened by that floor). k: how much of the water's colour they take
## the same for a model whose materials sit on its surfaces (a statue of her): no shadows from the floor above, no
## reflection pass, and some of the water's colour
func _mirror_mats(root: Node, k := 0.3) -> void:
	var cache := {}
	for mm in root.find_children("*", "MeshInstance3D", true, false):
		var mi := mm as MeshInstance3D
		for si in mi.mesh.get_surface_count():
			var m := mi.get_surface_override_material(si) as ShaderMaterial
			if m == null: continue
			if not cache.has(m):
				var d: ShaderMaterial = m.duplicate(); d.next_pass = null
				if m.shader == shaders["base"] or m.shader == shaders["two"]: d.shader = shaders["mir"]
				for cn in ["c_top", "c_z", "c_x"]:
					var c0 = d.get_shader_parameter(cn)
					if c0 is Color: d.set_shader_parameter(cn, (c0 as Color).lerp(Color(0.42, 0.62, 0.74), k).darkened(0.16))   # dark enough to read against the pale water
				cache[m] = d
			mi.set_surface_override_material(si, cache[m])
		mi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF

func _strip_refl(root: Node, skip := 0, sh := "two", k := 0.38) -> void:
	var cache := {}
	var list: Array = []
	for c in root.get_children().slice(skip):
		if c is MeshInstance3D: list.append(c)
		list.append_array(c.find_children("*", "MeshInstance3D", true, false))
	for mm in list:
		var mi := mm as MeshInstance3D
		var m := mi.material_override as ShaderMaterial
		if m == null: continue
		if not cache.has(m):
			var d: ShaderMaterial = m.duplicate(); d.next_pass = null
			if m.shader == shaders["base"]: d.shader = shaders[sh]
			for cn in ["c_top", "c_z", "c_x"]:   # what stands in the water takes some of the water's colour
				var c0 = d.get_shader_parameter(cn)
				if c0 is Color: d.set_shader_parameter(cn, (c0 as Color).lerp(Color(0.5, 0.78, 0.83), k).darkened(0.06 if k > 0.2 else 0.0))
			cache[m] = d
		mi.material_override = cache[m]; mi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF

## the arrival court: its floor has an opening for the mirror pool and its base is hollow, so that
## the court can stand upside down inside it
## open_n: the pool lies up to a wall on the court's north edge, and that wall is mirrored in it: the hollow has no
## north wall of its own (the mirrored one stands there), and it is deep enough for what stands tall over the water
func _pool_court(x0: float, z0: float, x1: float, z1: float, qx0: float, qz0: float, qx1: float, qz1: float, wall_p := "stone", sky_name := "PoolSky", open_n := false) -> void:
	floors.append([x0, z0, x1, z1, -0.18])   # the pool's hollow hides the sea as the floor does
	for r in ([[x0, z0, qx0, qz0], [qx1, z0, x1, qz0]] if open_n else [[x0, z0, x1, qz0]]) + [[x0, qz1, x1, z1], [x0, qz0, qx0, qz1], [qx1, qz0, x1, qz1]]:
		blk(Vector3(r[0], -0.13, r[1]), Vector3(r[2], 0.0, r[3]), "stone")
	for r in ([[x0 - 0.03, z0 - 0.03, qx0, qz0], [qx1, z0 - 0.03, x1 + 0.03, qz0]] if open_n else [[x0 - 0.03, z0 - 0.03, x1 + 0.03, qz0]]) + [[x0 - 0.03, qz1, x1 + 0.03, z1 + 0.03], [x0 - 0.03, qz0, qx0, qz1], [qx1, qz0, x1 + 0.03, qz1]]:
		blk(Vector3(r[0], -0.18, r[1]), Vector3(r[2], -0.13, r[3]), "shade")
	dentils(x0, z0, x1, z1, -0.18)
	var kr := 0.07   # the kerb of the pool
	blk(Vector3(qx0 - kr, 0, qz0 - kr), Vector3(qx1 + kr, 0.04, qz0), "shade"); blk(Vector3(qx0 - kr, 0, qz1), Vector3(qx1 + kr, 0.04, qz1 + kr), "shade")
	blk(Vector3(qx0 - kr, 0, qz0), Vector3(qx0, 0.04, qz1), "shade"); blk(Vector3(qx1, 0, qz0), Vector3(qx1 + kr, 0.04, qz1), "shade")
	var ins := 0.22; var a := Vector3(x0 + ins, -2.45, z0 + ins); var b := Vector3(x1 - ins, -0.18, z1 - ins); var th := 0.3
	for w in ([] if open_n else [[a.x, a.z, b.x, a.z + th]]) + [[a.x, b.z - th, b.x, b.z], [a.x, a.z + (0.0 if open_n else th), a.x + th, b.z - th], [b.x - th, a.z + (0.0 if open_n else th), b.x, b.z - th]]:
		blk(Vector3(w[0], a.y, w[1]), Vector3(w[2], b.y, w[3]), wall_p)
	var ring := ([] if open_n else [[a.x - 0.1, a.z - 0.1, b.x + 0.1, a.z + th]]) + [[a.x - 0.1, b.z - th, b.x + 0.1, b.z + 0.1], [a.x - 0.1, a.z + (-0.1 if open_n else th), a.x + th, b.z - th], [b.x - th, a.z + (-0.1 if open_n else th), b.x + 0.1, b.z - th]]
	for w in ring:
		blk(Vector3(w[0], -2.45, w[1]), Vector3(w[2], WATER + 0.07, w[3]), "shade")
	for w in ring:
		blk(Vector3(w[0], -0.42, w[1]), Vector3(w[2], -0.3, w[3]), "shade")   # the cornice, as a ring: a full plate would close the pool from below
	foam(a.x - 0.1, a.z - 0.1, b.x + 0.1, b.z + 0.1)
	var nx := maxi(1, int((b.x - a.x) / 1.05)); var nz := maxi(1, int((b.z - a.z) / 1.05))
	for i in nx: win_z(a.x + (b.x - a.x) * (i + 0.5) / nx, -1.2, b.z, 0.4, 0.74)
	for i in nz: win_x(b.x, -1.2, a.z + (b.z - a.z) * (i + 0.5) / nz, 0.4, 0.74)
	var pit := MeshInstance3D.new(); pit.name = sky_name; var pm := BoxMesh.new(); pm.size = Vector3(b.x - a.x - th * 2.0 - 0.03, 2.16, b.z - a.z - th * 2.0 - 0.03); pit.mesh = pm
	pit.position = Vector3((a.x + b.x) * 0.5, -0.185 - 1.08, (a.z + b.z) * 0.5)   # its floor stays above the copy of the court that lies under the sea
	if open_n:      # up to the middle of the mirrored wall on the north side, and as deep as the tallest thing over this water is high
		var zn := z0 + 0.1; var zs := b.z - th - 0.015
		pm.size = Vector3(pm.size.x, 4.4, zs - zn); pit.position = Vector3(pit.position.x, -0.185 - 2.2, (zn + zs) * 0.5)
	var pmat := ShaderMaterial.new(); pmat.shader = shaders["pit"]; pit.material_override = pmat; pit.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF; add_child(pit)
	if OS.get_environment("NOPIT") == "1": pit.visible = false

## the first zone, "the quay of the last statues": she wakes on the one empty plinth of a row of
## statues of herself, passes the sculptor's corner, and meets the footbridge that is only a shadow
func _start_zone() -> void:
	# the row of statues of her: four finished ones, and in the middle the plinth she stepped down from. Before them
	# lies a long rug, as long as the row, a little rucked up where feet have dragged it
	var poses := ["calm", "pray", "", "mourn", "kneel"]
	mroot = Node3D.new(); mroot.name = "MirrorPool"; mroot.transform = Transform3D(Basis(Vector3(1, 0, 0), Vector3(0, -1, 0), Vector3(0, 0, 1)), Vector3.ZERO); add_child(mroot)
	for i in 5:
		var sp := Vector3(MYPL.x, 0, MYPL.z + 0.9 * (i - 2))
		round_plinth(sp)
		blk(sp + Vector3(0.26, 0.1, -0.08), sp + Vector3(0.274, 0.14, 0.08), "gold")           # a small name plate, blank, on the drum
		if poses[i] != "": her_statue(sp + Vector3(0, 0.17, 0), PI * 0.5, poses[i], 0.96)
	var rx0 := MYPL.x + 0.55; var rx1 := rx0 + 2.6; var rz0 := MYPL.z - 2.35; var rz1 := rz0 + 4.7
	var rim2 := _png("res://props/rug.png"); rim2.generate_mipmaps()
	var rm := ShaderMaterial.new(); rm.shader = shaders["tex"]; rm.set_shader_parameter("albedo_tex", ImageTexture.create_from_image(rim2))
	rm.set_shader_parameter("fog_col", sea_c); rm.set_shader_parameter("mist_col", mist_c); rm.set_shader_parameter("shadow_col", shadow_c); rm.set_shader_parameter("mist_k", mist_k); pmats["rug"] = rm
	# the rug is not flat: a few long rucks run across it, one corner is turned up, and it lies unevenly everywhere
	var gx := 44; var gz := 80; var rv := PackedVector3Array(); var ruv := PackedVector2Array(); var rix := PackedInt32Array()
	var rucks := [[Vector2(0.9, 1.1), 0.5, 0.1, 0.13, 1.5], [Vector2(1.7, 3.3), -0.35, 0.085, 0.12, 1.3], [Vector2(1.3, 2.3), 1.2, 0.06, 0.16, 1.0], [Vector2(0.5, 3.9), 0.9, 0.07, 0.1, 0.8], [Vector2(2.1, 0.8), -1.0, 0.06, 0.1, 0.7], [Vector2(0.6, 2.9), -0.2, 0.05, 0.09, 0.6]]   # a point on it, its direction, height, width, half length
	for j in gz + 1:
		for i in gx + 1:
			var u := (rx1 - rx0) * i / gx; var v := (rz1 - rz0) * j / gz; var h := 0.0
			for rk in rucks:
				var dir := Vector2(cos(rk[1]), sin(rk[1])); var rel := Vector2(u, v) - (rk[0] as Vector2)
				var along := rel.dot(dir); var across := rel.dot(Vector2(-dir.y, dir.x)) + 0.05 * sin(along * 3.0)
				h += rk[2] * exp(-pow(across / rk[3], 2)) * smoothstep(rk[4], rk[4] * 0.4, absf(along))
			h += 0.085 * pow(clampf(1.0 - Vector2(u - (rx1 - rx0), v - (rz1 - rz0)).length() / 0.55, 0.0, 1.0), 2.0)   # the turned-up corner
			h += 0.005 * (2.0 + sin(u * 7.0 + v * 3.0) + sin(v * 9.0 - u * 2.0))
			rv.append(Vector3(rx0 + u, 0.016 + h, rz0 + v)); ruv.append(Vector2(float(i) / gx, float(j) / gz))
	var rn := PackedVector3Array(); rn.resize(rv.size())
	for j in gz + 1:
		for i in gx + 1:
			var k := j * (gx + 1) + i
			rn[k] = (rv[k + ((gx + 1) if j < gz else 0)] - rv[k - ((gx + 1) if j > 0 else 0)]).cross(rv[k + (1 if i < gx else 0)] - rv[k - (1 if i > 0 else 0)]).normalized()
	for j in gz:
		for i in gx:
			var k := j * (gx + 1) + i
			rix.append_array(PackedInt32Array([k, k + 1, k + gx + 1, k + 1, k + gx + 2, k + gx + 1]))
	var ra := []; ra.resize(Mesh.ARRAY_MAX); ra[Mesh.ARRAY_VERTEX] = rv; ra[Mesh.ARRAY_NORMAL] = rn; ra[Mesh.ARRAY_TEX_UV] = ruv; ra[Mesh.ARRAY_INDEX] = rix
	var rmesh := ArrayMesh.new(); rmesh.add_surface_from_arrays(Mesh.PRIMITIVE_TRIANGLES, ra)
	prim(rmesh, Vector3.ZERO, rm)
	blk(Vector3(rx0 - 0.004, 0, rz0 - 0.004), Vector3(rx1 + 0.004, 0.011, rz1 + 0.004), "teal")   # its thickness
	var fr := mat(Color("eadcbe"))
	for i in 52:   # the fringe at its two ends
		var fx := rx0 + 0.03 + (rx1 - rx0 - 0.06) * i / 51.0
		for e in [[rz0 - 0.13, rz0], [rz1, rz1 + 0.13]]:
			var tq := BoxMesh.new(); tq.size = Vector3(0.022, 0.008, 0.13 - 0.02 * (i % 2)); prim(tq, Vector3(fx, 0.005, (e[0] + e[1]) * 0.5 + 0.005 * sin(i * 2.3)), fr).rotation.y = 0.06 * sin(i * 1.7)
	var ep := MYPL
	for c in [[-0.42, 0.1, 0.4], [-0.55, -0.22, 1.1], [-0.3, 0.34, 2.0], [-0.7, 0.05, 0.2], [-0.48, 0.4, 2.7], [-0.62, -0.38, 1.6], [-0.36, -0.3, 0.7]]:
		var ch := blk(Vector3(-0.07, 0, -0.05), Vector3(0.07, 0.07, 0.05), "stone"); ch.position = ep + Vector3(c[0], 0.0, c[1]); ch.rotation = Vector3(0.3, c[2], 0.2)
	# a stele with the sculptor's first lines, at the head of the row
	# (it was a bare slab with six faint strokes: now it stands on a stepped foot under a small pediment, and its lines are cut inside a frame)
	var tx := -4.92; var tz := -3.5
	blk(Vector3(tx - 0.34, 0, tz - 0.15), Vector3(tx + 0.34, 0.07, tz + 0.15), "shade"); blk(Vector3(tx - 0.29, 0.07, tz - 0.11), Vector3(tx + 0.29, 0.13, tz + 0.11), "stone")
	blk(Vector3(tx - 0.23, 0.13, tz - 0.07), Vector3(tx + 0.23, 1.0, tz + 0.07), "stone"); blk(Vector3(tx - 0.265, 1.0, tz - 0.095), Vector3(tx + 0.265, 1.04, tz + 0.095), "shade")
	var tpm := PrismMesh.new(); tpm.size = Vector3(0.53, 0.17, 0.17); prim(tpm, Vector3(tx, 1.125, tz), pal("stone", "flat"))
	var tpm2 := PrismMesh.new(); tpm2.size = Vector3(0.33, 0.095, 0.01); prim(tpm2, Vector3(tx, 1.097, tz + 0.086), pal("shade", "flat"))
	var tgd := cyl(Vector3(tx, 1.074, tz + 0.09), 0.024, 0.024, 0.012, pal("gold"), 12); tgd.rotation.x = PI * 0.5
	for fr2 in [[-0.18, 0.24, 0.18, 0.252], [-0.18, 0.9, 0.18, 0.912], [-0.18, 0.24, -0.168, 0.912], [0.168, 0.24, 0.18, 0.912]]:
		blk(Vector3(tx + fr2[0], fr2[1], tz + 0.07), Vector3(tx + fr2[2], fr2[3], tz + 0.075), "shade")
	for i in 7: blk(Vector3(tx - 0.13 + (0.06 if i == 0 else 0.0), 0.815 - 0.085 * i, tz + 0.07), Vector3(tx + 0.13 - 0.06 * (i % 3), 0.833 - 0.085 * i, tz + 0.075), "trunk")
	blk(Vector3(tx - 0.13, 0.8, tz + 0.07), Vector3(tx - 0.085, 0.845, tz + 0.076), "crim")
	# the sculptor's corner: a block with a figure half out of it, a scaffold, a bench with his tools
	blk(Vector3(2.45, 0, -3.62), Vector3(3.28, 1.36, -2.92), "stone"); blk(Vector3(2.4, 0, -3.66), Vector3(3.32, 0.09, -2.88), "shade")
	blk(Vector3(2.45, 1.36, -3.62), Vector3(2.95, 1.62, -3.2), "stone"); blk(Vector3(2.95, 1.36, -3.62), Vector3(3.28, 1.5, -3.36), "shade")
	her_statue(Vector3(2.86, 0.02, -3.0), 0.0, "offer", 0.9)
	blk(Vector3(2.56, 0.09, -2.92), Vector3(3.16, 1.3, -2.914), "shade")      # the face of the block cut back round her
	# his scaffold: four posts on pads, lashed with rope to a frame at the top and to rails half way up on three sides
	# (the side he works from is open), braced across, with a walk of two planks on the west side and a hoist beam
	# over the block. (It was two bare goalposts and a board.)
	for sx in [2.3, 3.42]:
		for sz in [-3.76, -2.8]:
			blk(Vector3(sx - 0.035, 0, sz - 0.035), Vector3(sx + 0.035, 2.14, sz + 0.035), "wood"); blk(Vector3(sx - 0.07, 0, sz - 0.07), Vector3(sx + 0.07, 0.03, sz + 0.07), "trunk")
			for ly in [1.13, 2.05]: blk(Vector3(sx - 0.05, ly - 0.04, sz - 0.05), Vector3(sx + 0.05, ly + 0.04, sz + 0.05), "rope")
		blk(Vector3(sx - 0.028, 2.06, -3.84), Vector3(sx + 0.028, 2.115, -2.72), "wood"); blk(Vector3(sx - 0.028, 1.1, -3.84), Vector3(sx + 0.028, 1.155, -2.72), "wood")
	for sz in [-3.76, -2.8]: blk(Vector3(2.22, 2.005, sz - 0.028), Vector3(3.5, 2.06, sz + 0.028), "wood")
	blk(Vector3(2.22, 1.045, -3.788), Vector3(3.5, 1.1, -3.732), "wood"); blk(Vector3(2.14, 1.045, -2.828), Vector3(2.46, 1.1, -2.772), "wood"); blk(Vector3(2.14, 1.045, -3.3), Vector3(2.46, 1.1, -3.244), "wood")
	stick(Vector3(3.42, 0.1, -3.76), Vector3(3.42, 1.1, -2.8), 0.02, "trunk"); stick(Vector3(3.42, 1.16, -2.8), Vector3(3.42, 2.06, -3.76), 0.02, "trunk")
	stick(Vector3(2.3, 1.16, -3.76), Vector3(3.42, 2.0, -3.76), 0.02, "trunk"); stick(Vector3(2.3, 1.04, -3.76), Vector3(3.42, 0.1, -3.76), 0.02, "trunk")
	blk(Vector3(2.15, 1.155, -3.86), Vector3(2.268, 1.19, -2.7), "wood"); blk(Vector3(2.278, 1.155, -3.82), Vector3(2.396, 1.19, -2.74), "trunk")
	blk(Vector3(2.2, 2.115, -3.3), Vector3(3.52, 2.18, -3.24), "wood")                                   # the hoist beam, its block and its line down to the stone
	blk(Vector3(2.7, 2.03, -3.3), Vector3(2.76, 2.115, -3.24), "dark"); blk(Vector3(2.724, 1.62, -3.276), Vector3(2.736, 2.04, -3.264), "rope")
	blk(Vector3(2.69, 1.62, -3.31), Vector3(2.77, 1.65, -3.23), "rope")
	var lad := Node3D.new(); lad.position = Vector3(2.27, 0, -2.42); lad.rotation = Vector3(0, PI * 0.5, -0.2); add_child(lad)   # the ladder leans on the south end of the walk
	for lz in [-0.14, 0.14]: blk(Vector3(-0.02, 0, lz - 0.02), Vector3(0.02, 1.35, lz + 0.02), "wood", lad)
	for i in 5: blk(Vector3(-0.015, 0.2 + 0.24 * i, -0.14), Vector3(0.015, 0.23 + 0.24 * i, 0.14), "wood", lad)
	# his workbench is a model now (props/workbench): mallet, chisels, calipers, a cloth, a small bust he tried her face on (it was a board on four sticks)
	# It stands by the east rail, clear of the scaffold, where it can be seen; where the old one stood, under the lamp, lie two offcuts of his marble
	thing("workbench", Vector3(2.99, 0, -1.5), 0.8, "wood:wood,stone:marble,gold:gold,dark:dark")
	blk(Vector3(1.52, 0, -3.76), Vector3(2.04, 0.3, -3.4), "stone"); var oc := blk(Vector3(-0.17, 0, -0.13), Vector3(0.17, 0.2, 0.13), "shade"); oc.position = Vector3(1.74, 0.4, -3.58); oc.rotation.y = 0.3
	for c in [[2.0, -2.75, 0.3, 1.0], [2.25, -2.6, 1.2, 0.8], [2.7, -2.55, 2.2, 1.2], [3.05, -2.62, 0.7, 0.7], [2.45, -2.4, 1.9, 0.6], [1.85, -2.95, 2.6, 0.9], [2.95, -2.36, 0.1, 0.5], [2.15, -3.05, 1.5, 1.1]]:
		var rb := blk(Vector3(-0.08, 0, -0.06), Vector3(0.08, 0.08, 0.06), "stone" if int(c[2] * 10.0) % 2 == 0 else "shade"); rb.position = Vector3(c[0], 0, c[1]); rb.rotation = Vector3(0.25, c[2], 0.15); rb.scale = Vector3.ONE * c[3]
	urn(Vector3(1.45, 0, -3.0), 0.8, "terra")
	# the two strange heads now watch the gate from either side
	plinth_head("kit_face2", Vector3(-1.5, 0, -3.5), 0.0); plinth_head("kit_face3", Vector3(-4.0, 0, AZ1 - 0.48), PI)
	# the gate of the court is a bronze grille until the row of statues is whole
	gate_slot(Vector3(0, 0, -3.9), 0.58, true)
	gate_a = Node3D.new(); gate_a.position = Vector3(0, 0, -3.9); add_child(gate_a)
	# its bars are one mesh, its rails and the bronze point on every bar another (each bar and each rail used to be drawn by itself)
	for i in 7: bb(Vector3(-0.54 + 0.18 * i - 0.018, 0, -0.018), Vector3(-0.54 + 0.18 * i + 0.018, 1.965, 0.018))
	bb_end("dark", gate_a)
	for gy in [0.5, 1.2, 1.9]: bb(Vector3(-0.58, gy, -0.024), Vector3(0.58, gy + 0.04, 0.024))
	for i in 7: spear(Vector3(-0.54 + 0.18 * i, 1.955, 0))
	bb_end("gold", gate_a)
	if not ("shots" in OS.get_cmdline_user_args()) or OS.get_environment("GATE_A") == "open": gate_a.position.y = -2.4
	vine(AX0 + 0.7, AZ1 - 0.08, true, 2.0); vine(1.2, AZ1 - 0.08, true, 1.9)

## a dark arched niche on a wall that faces east
func niche_x(x: float, y: float, z: float, w: float, h: float, parent: Node) -> void:
	blk(Vector3(x, y, z - w * 0.5), Vector3(x + 0.012, y + h - w * 0.5, z + w * 0.5), "dark", parent)
	var d := cyl(Vector3(x + 0.006, y + h - w * 0.5, z), w * 0.5, w * 0.5, 0.012, pal("dark"), 24, parent); d.rotation.z = PI * 0.5

## a detailed prop (a Tripo model in props/): loaded, given the lit textured material of the world, scaled so that its
## height (or, with across > 0, its width) is as asked, and set with its foot at the origin of the node returned.
## mirror: the copy that stands in the water
## a picture file, read through the engine's file layer (so it is found inside an exported package as well)
func _png(path: String) -> Image:
	var im := Image.new(); im.load_png_from_buffer(FileAccess.get_file_as_bytes(path))
	return im

## the one material of the joined world (see _lighten), two-sided or not, with or without the dark reflection on the sea
func _one_mat(two: bool, with_refl: bool) -> ShaderMaterial:
	var k := "one|%s|%s" % [two, with_refl]
	if pmats.has(k): return pmats[k]
	var om := pal("stone").duplicate() as ShaderMaterial; om.shader = shaders["one2" if two else "one"]
	om.next_pass = refl_mat if with_refl else null
	pmats[k] = om; timed.append(om)   # (timed: the leaves it draws sway)
	return om

## The surfaces of a model that are painted with palettes, fused into one surface that the one material draws:
## pal_of gives for each surface its palette name, or "" to leave it as it is (the glass of a mirror)
func _fuse_pal(mesh: Mesh, pal_of: Array) -> ArrayMesh:
	var am := ArrayMesh.new()
	var vs := PackedVector3Array(); var ns := PackedVector3Array(); var ix := PackedInt32Array()
	var c0 := PackedFloat32Array(); var c1 := PackedFloat32Array(); var c2 := PackedFloat32Array()
	for si in mesh.get_surface_count():
		if pal_of[si] == "": continue
		var pn: String = pal_of[si]; var sways := pn.ends_with("~")   # "leaf~": this part sways in the wind
		if sways: pn = pn.trim_suffix("~")
		var a := mesh.surface_get_arrays(si); var t: Array = pals[pn]
		var tone := [Color(t[0]), Color(t[1]), Color(t[2])]
		var v: PackedVector3Array = a[Mesh.ARRAY_VERTEX]; var n = a[Mesh.ARRAY_NORMAL]; var id = a[Mesh.ARRAY_INDEX]; var base := vs.size()
		for i in v.size():
			vs.append(v[i]); ns.append(n[i] if n != null else Vector3.UP)
			c0.append(tone[0].r); c0.append(tone[0].g); c0.append(tone[0].b); c0.append(1.0 if pn in ["stone", "shade", "sand", "rose"] else 0.0)
			c1.append(tone[1].r); c1.append(tone[1].g); c1.append(tone[1].b); c1.append(0.0)
			c2.append(tone[2].r); c2.append(tone[2].g); c2.append(tone[2].b); c2.append(1.3 if sways else 1.0)   # flat faces; and a little wind
		if id != null:
			for i in id: ix.append(base + i)
		else:
			for i in v.size(): ix.append(base + i)
	if not vs.is_empty():
		var arr := []; arr.resize(Mesh.ARRAY_MAX); arr[Mesh.ARRAY_VERTEX] = vs; arr[Mesh.ARRAY_NORMAL] = ns; arr[Mesh.ARRAY_INDEX] = ix
		arr[Mesh.ARRAY_CUSTOM0] = c0; arr[Mesh.ARRAY_CUSTOM1] = c1; arr[Mesh.ARRAY_CUSTOM2] = c2
		am.add_surface_from_arrays(Mesh.PRIMITIVE_TRIANGLES, arr, [], {}, (Mesh.ARRAY_CUSTOM_RGBA_FLOAT << Mesh.ARRAY_FORMAT_CUSTOM0_SHIFT) | (Mesh.ARRAY_CUSTOM_RGBA_FLOAT << Mesh.ARRAY_FORMAT_CUSTOM1_SHIFT) | (Mesh.ARRAY_CUSTOM_RGBA_FLOAT << Mesh.ARRAY_FORMAT_CUSTOM2_SHIFT))
	for si in mesh.get_surface_count():   # the rest, as it was
		if pal_of[si] != "": continue
		am.add_surface_from_arrays(Mesh.PRIMITIVE_TRIANGLES, mesh.surface_get_arrays(si))
		am.surface_set_material(am.get_surface_count() - 1, mesh.surface_get_material(si))
	return am

func prop_model(file: String, parent: Node, height: float, across := 0.0, mirror := false, sea_refl := false, flat_pal := "", ground_y := 0.0) -> Node3D:
	if not prop_src.has(file):   # each file is read once; every use of it is a copy that shares its meshes and pictures
		var st := GLTFState.new(); var doc := GLTFDocument.new()
		doc.append_from_buffer(FileAccess.get_file_as_bytes("res://props/%s.glb" % file), "", st)
		prop_src[file] = doc.generate_scene(st)
	var src := (prop_src[file] as Node3D).duplicate() as Node3D
	var holder := Node3D.new(); parent.add_child(holder); holder.add_child(src)
	var box := AABB(); var first := true
	for m in src.find_children("*", "MeshInstance3D", true, false):
		var mi := m as MeshInstance3D
		var b: AABB = mi.transform * mi.mesh.get_aabb()
		box = b if first else box.merge(b); first = false
		mi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF if mirror else GeometryInstance3D.SHADOW_CASTING_SETTING_ON
		if flat_pal != "":   # no texture: colours of the world's own palette, flat faces, like its marbles
			var by_part := {}     # "cloth:linen,rope:rope,base:stone" paints each named material of the model with its own
			for kv in flat_pal.split(","):
				if ":" in kv: by_part[kv.get_slice(":", 0)] = kv.get_slice(":", 1)
			if by_part.is_empty(): mi.material_override = pal(flat_pal, "flat2" if mirror else "flat")
			else:
				var fk := "%s|%s|%d" % [file, flat_pal, mi.mesh.get_instance_id()]
				if not prop_fused.has(fk):   # its palette-painted surfaces become one surface, drawn by the one material
					var pal_of := []
					for si in mi.mesh.get_surface_count():
						var om3 := mi.mesh.surface_get_material(si)
						var nm3 := om3.resource_name if om3 != null else ""
						pal_of.append("" if nm3 == "glass" else by_part.get(nm3, by_part.values()[0]))
					prop_fused[fk] = _fuse_pal(mi.mesh, pal_of) if not mirror else mi.mesh
				mi.mesh = prop_fused[fk]
				for si in mi.mesh.get_surface_count():
					var om2 := mi.mesh.surface_get_material(si)
					var nm := om2.resource_name if om2 != null else ""
					if nm == "glass":   # the pane of a mirror shows what stands before it
						var gm2 := ShaderMaterial.new(); gm2.shader = shaders["mirror"]; gm2.set_shader_parameter("ground_y", ground_y); timed.append(gm2)
						mi.set_surface_override_material(si, gm2); mi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF; continue
					if om2 == null and not mirror:
						mi.set_surface_override_material(si, _one_mat(true, true)); continue
					mi.set_surface_override_material(si, pal(by_part.get(nm, by_part.values()[0]), "flat2" if (mirror or nm == "cloth") else "flat"))   # cloth is seen from within too
			continue
		for si in mi.mesh.get_surface_count():
			var om := mi.mesh.surface_get_material(si)
			if om != null and om.resource_name == "glass":   # the pane of a mirror shows what lies before it
				var gm := ShaderMaterial.new(); gm.shader = shaders["mirror"]; gm.set_shader_parameter("ground_y", ground_y); timed.append(gm)
				mi.set_surface_override_material(si, gm); mi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF; continue
			var sm := ShaderMaterial.new(); sm.shader = shaders["tex2" if mirror else "tex"]
			sm.set_shader_parameter("fog_col", sea_c); sm.set_shader_parameter("mist_col", mist_c); sm.set_shader_parameter("shadow_col", shadow_c); sm.set_shader_parameter("mist_k", mist_k)
			if om is BaseMaterial3D and (om as BaseMaterial3D).albedo_texture != null: sm.set_shader_parameter("albedo_tex", (om as BaseMaterial3D).albedo_texture)
			sm.set_shader_parameter("flat_n", 1.0)   # flat faces, like everything else in this world
			sm.set_shader_parameter("tint", Vector3(1.0, 1.14, 1.2) if mirror else Vector3(1.0, 0.96, 0.9))   # a little of the world's warm cast
			if sea_refl and refl_mat != null: sm.next_pass = refl_mat   # what stands in the sea lies dark on it, like everything else
			mi.set_surface_override_material(si, sm); pmats["prop|%d|%d" % [holder.get_instance_id(), si]] = sm
	if height <= 0.0 and across <= 0.0: return holder   # as it was made: its own size and place
	var k := (across / maxf(box.size.x, box.size.z)) if across > 0.0 else (height / box.size.y)
	src.scale = Vector3.ONE * k
	src.position = -Vector3(box.position.x + box.size.x * 0.5, box.position.y, box.position.z + box.size.z * 0.5) * k
	return holder

## the sight between the first two courts: "he hid every mirror". Tall mirrors stand in the sea on either side of the
## causeway, each wrapped in a sheet and tied round with rope, like shrouded figures. One or two have begun to come undone
func _shrouds() -> void:
	if not FileAccess.file_exists("res://props/mirror_tied.glb"): return
	# x, z, turn, size, kind. Those whose sheet lies spread on the ground stand on a wider footing
	var spots := [[-2.6, -5.9, 0.75, 1.0, "slip"], [-5.7, -5.3, 0.3, 1.04, "oval"], [-4.6, -7.7, 0.4, 1.08, "tied"], [-2.3, -8.9, 0.62, 1.0, "low"], [-7.2, -8.1, 1.15, 1.05, "round"],
		[2.4, -6.2, 0.95, 1.0, "wide"], [3.9, -8.0, 1.3, 1.1, "tied"], [7.3, -8.3, 0.5, 1.0, "hem"], [6.95, -10.3, 1.0, 1.0, "ovalh"]]   # no two of a kind turned alike
	for sp in spots:
		var base := Vector3(sp[0], WATER + 0.22, sp[1])
		var m := mirror_stand(base, sp[2], self, WATER, sp[4], true); m.scale = Vector3.ONE * sp[3]
		_look_add("", base, 1.7, LOOK_LINES["shroud"])
		if sp[4] == "slip" or sp[4] == "wide":   # a long plinth, turned with the mirror
			var hx := 1.2 if sp[4] == "slip" else 1.0; var hz := 0.74 if sp[4] == "slip" else 0.46
			blk(Vector3(-hx + 0.06, -1.0, -hz + 0.06), Vector3(hx - 0.06, -0.05, hz - 0.06), "stone", m); blk(Vector3(-hx, -0.05, -hz), Vector3(hx, 0.0, hz), "shade", m)
		else:
			var r: float = 0.66 * sp[3]
			cyl(Vector3(sp[0], WATER - 0.5, sp[1]), r - 0.06, r + 0.02, 0.67, pal("stone"), 14); cyl(base - Vector3(0, 0.05, 0), r, r, 0.05, pal("shade"), 14)   # (the cap lies on the drum: with both tops level the two surfaces fought, and flickered as the view moved)

## the second court, "the crossing the water keeps". In its pool stands the winch of the west gate, on a pedestal no
## one can reach: the crossing to it fell long ago. The water still holds its shadow, and her reflection can walk it
func _pool_c() -> void:
	if COVERED:
		_pool_c_covered(); return
	var args := OS.get_cmdline_user_args()
	for both in [self, mroot]:
		var pg := Node3D.new(); both.add_child(pg)
		# the winch, a capstan: a marble pedestal with a lion ring, a wooden drum wound with rope under a bronze gear,
		# and on a rope-wound axle the handwheel that turns it. Two models cut from one (tools/winch_prop.py): the base,
		# and the wheel with its hub at its own origin and its axle along x. It stands turned about, the wheel to the
		# west, where the lost crossing comes up to it
		var parts := "wood:wood,rope:linen,gold:gold,stone:stone"
		var wb := prop_model("winch_base", pg, 0.0, 0.0, both == mroot, false, parts); wb.position = PED; wb.rotation.y = PI; wb.scale = Vector3.ONE * WINCH_K
		var wn := Node3D.new(); wn.position = PED + Vector3(-WINCH_HUB.x, WINCH_HUB.y, 0) * WINCH_K; wn.rotation.y = PI; pg.add_child(wn)
		prop_model("winch_wheel", wn, 0.0, 0.0, both == mroot, false, parts).scale = Vector3.ONE * WINCH_K
		if both == self: winch_a = wn; ped_a = pg
		else: winch_m = wn; ped_m = pg
		blk(Vector3(CROSS_X - 0.3, 0.0, QZ1 - 0.2), Vector3(CROSS_X + 0.3, 0.07, QZ1), "stone", both)   # the stub of the crossing at the front rim
		for rb3 in [[Vector3(CROSS_X - 0.16, 0.035, QZ1 - 0.27), 0.5 + PI * 0.5], [Vector3(CROSS_X + 0.2, 0.03, QZ1 - 0.24), -0.4 + PI * 0.5]]:
			var bk3 := blk(Vector3(-0.07, -0.035, -0.1), Vector3(0.07, 0.035, 0.1), "stone", both); bk3.position = rb3[0]; bk3.rotation.y = rb3[1]
		if both == mroot:      # in the water only: the crossing itself, stone by stone, as it lay before it fell. Above the water there is nothing
			var z_a := QZ1 - 0.2; var z_b := PED.z - 0.3; var n1 := 6
			var stones := []      # each: its middle, its half size along x and along z
			var cross_mat := StandardMaterial3D.new(); cross_mat.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED; cross_mat.albedo_color = Color("857fa4")
			for k in n1:      # the first leg, from the rim into the pool (its last stone is the corner)
				var s0 := z_a + (z_b - z_a) * k / n1; var s1 := z_a + (z_b - z_a) * (k + 1) / n1
				stones.append([Vector3(CROSS_X, 0, (s0 + s1) * 0.5), 0.3 - 0.02 * (k % 2), absf(s1 - s0) * 0.5 - 0.045])
			var x_a := CROSS_X + 0.3; var x_b := PED.x - 0.46; var n2 := 4
			for k in n2:      # the second leg, east to the winch
				var t0 := x_a + (x_b - x_a) * k / n2; var t1 := x_a + (x_b - x_a) * (k + 1) / n2
				stones.append([Vector3((t0 + t1) * 0.5, 0, PED.z), absf(t1 - t0) * 0.5 - 0.045, 0.3 - 0.02 * ((k + 1) % 2)])
			for k in stones.size():      # stones with water between them, none quite square to the next: old work, long under the water's memory
				var st: Array = stones[k]
				var sb := blk(Vector3(-st[1], 0.0, -st[2]), Vector3(st[1], CROSS_H, st[2]), "stone", both)
				sb.material_override = cross_mat      # a darker stone than the court's, in its own plain colour (the haze of the water pales everything else that lies in it): it stands out in the pale water
				sb.position = (st[0] as Vector3) + Vector3(0, CROSS_H * 0.5, 0); sb.rotation.y = 0.035 * sin(k * 2.3 + 0.7)
		for cx3 in [CROSS_X - 1.05, CROSS_X + 1.05]:   # two low posts on the front rim: the head of the old crossing
			var cp := Vector3(cx3, 0, QZ1 + 0.22)
			# each a turned post: a square foot, a moulded base, a shaft with a necking, a cap, and a bronze ball (they were three plain drums)
			blk(cp + Vector3(-0.18, 0, -0.18), cp + Vector3(0.18, 0.05, 0.18), "shade", both)
			turned(cp, [[0.165, 0.05], [0.165, 0.085], [0.13, 0.11], [0.13, 0.135], [0.1, 0.16], [0.09, 0.76], [0.108, 0.775], [0.108, 0.8], [0.09, 0.815], [0.09, 0.86], [0.15, 0.9], [0.15, 0.94], [0.07, 0.975], [0.0, 0.975]], "stone", 16, both)
			ball(cp + Vector3(0, 1.06, 0), 0.1, pal("gold"), both)
	_strip_refl(mroot)
	if OS.get_environment("NOMIR") == "1": mroot.visible = false
	var wq := QuadMesh.new(); wq.size = Vector2(QX1 - QX0, QZ1 - QZ0); wq.orientation = PlaneMesh.FACE_Y
	glass2 = ShaderMaterial.new(); glass2.shader = shaders["glass"]; timed.append(glass2)
	glass2.set_shader_parameter("lost_rect", Vector4(CROSS_X - 0.3, PED.z - 0.3, CROSS_X + 0.3, QZ1 - 0.16)); glass2.set_shader_parameter("lost_a", 0.0); glass2.set_shader_parameter("lost_x", 0.0)      # from the front rim into the pool
	glass2.set_shader_parameter("lost_rect2", Vector4(CROSS_X - 0.3, PED.z - 0.3, PED.x - 0.46, PED.z + 0.3)); glass2.set_shader_parameter("lost_x2", 1.0)      # and, turning, east to the winch
	glass2.set_shader_parameter("blur_px", 1.7); glass2.set_shader_parameter("lod", 0.7)   # what this water shows is a little soft, but the stones of the crossing can be told apart
	prim(wq, Vector3((QX0 + QX1) * 0.5, 0.012, (QZ0 + QZ1) * 0.5), glass2).cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	# the west gate: two piers, a lintel, and a bronze grille until the winch is turned
	for gz in [-13.86, -12.14]:
		blk(Vector3(CX0 - 0.04, 0, gz - 0.14), Vector3(CX0 + 0.24, 2.1, gz + 0.14), "stone"); blk(Vector3(CX0 - 0.07, 0, gz - 0.17), Vector3(CX0 + 0.27, 0.1, gz + 0.17), "shade")
	blk(Vector3(CX0 - 0.04, 2.1, -14.0), Vector3(CX0 + 0.24, 2.42, -12.0), "stone")
	cornice(CX0 - 0.04, -14.0, CX0 + 0.24, -12.0, 2.42, 0.04, 0.06); dentils(CX0 - 0.04, -14.0, CX0 + 0.24, -12.0, 2.42)
	for gz in [-13.86, -12.14]:   # the piers as at the first gate: a second step, sunk panels, an impost under the lintel
		blk(Vector3(CX0 - 0.055, 0.1, gz - 0.155), Vector3(CX0 + 0.255, 0.15, gz + 0.155), "stone")
		pier_panels(CX0 + 0.1, gz, 0.14, 0.32, 1.84, 0.075)
		blk(Vector3(CX0 - 0.065, 2.0, gz - 0.165), Vector3(CX0 + 0.265, 2.07, gz + 0.165), "shade")
	blk(Vector3(CX0 + 0.24, 2.17, -13.86), Vector3(CX0 + 0.245, 2.34, -12.14), "shade")      # the frieze of the lintel, a tablet at its middle, bronze studs
	blk(Vector3(CX0 + 0.24, 2.15, -13.16), Vector3(CX0 + 0.262, 2.36, -12.84), "stone"); blk(Vector3(CX0 + 0.262, 2.215, -13.04), Vector3(CX0 + 0.27, 2.295, -12.96), "crim")
	for fz in [-13.62, -13.4, -12.6, -12.38]: blk(Vector3(CX0 + 0.245, 2.23, fz - 0.025), Vector3(CX0 + 0.255, 2.28, fz + 0.025), "gold")
	var gpm := PrismMesh.new(); gpm.size = Vector3(2.0, 0.27, 0.26)       # and over its cornice a low pediment, where the first gate has its arch
	prim(gpm, Vector3(CX0 + 0.1, 2.48 + 0.135, -13.0), pal("stone", "flat")).rotation.y = PI * 0.5
	var gpm2 := PrismMesh.new(); gpm2.size = Vector3(1.36, 0.15, 0.012)
	prim(gpm2, Vector3(CX0 + 0.236, 2.48 + 0.105, -13.0), pal("shade", "flat")).rotation.y = PI * 0.5
	var gpd := cyl(Vector3(CX0 + 0.238, 2.48 + 0.07, -13.0), 0.04, 0.04, 0.014, pal("gold"), 12); gpd.rotation.z = PI * 0.5
	gate_slot(Vector3(CX0 + 0.1, 0, -13.0), 0.7, false)
	gate_c = Node3D.new(); gate_c.position = Vector3(CX0 + 0.1, 0, -13.0); add_child(gate_c)
	for i in 8: bb(Vector3(-0.018, 0, -0.63 + 0.18 * i - 0.018), Vector3(0.018, 1.965, -0.63 + 0.18 * i + 0.018))
	bb_end("dark", gate_c)       # as at the first gate: one mesh for the bars, one for the rails and the points
	for gy in [0.5, 1.2, 1.9]: bb(Vector3(-0.024, gy, -0.7), Vector3(0.024, gy + 0.04, 0.7))
	for i in 8: spear(Vector3(0, 1.955, -0.63 + 0.18 * i))
	bb_end("gold", gate_c)
	if not ("shots" in args or "solve2" in args or "tour" in args or "flow" in args): gate_c.position.y = -2.4

## A turning plinth with a statue of her on it. Fixed: a stone base and a bronze ring ticked at the four quarters.
## Turning: a drum with a bronze band, a toothed bronze rim and a red pointer at its front, and the statue. Beside
## it a small bronze pinion meshes with the rim and turns the other way. Returns [the turning part, the pinion]
const PLINTH_K := 1.05     # the turning plinth: a marble base, and on it a bronze gear wheel that carries the drum and the statue
const PLINTH_TOP := 0.619   # as made: how high the drum stands, where the wheel lies on the base, how wide the wheel is
const PLINTH_CUT := 0.138
const PLINTH_GEAR := 0.419
const PLINTH_PARTS := "stone:marble,gold:gold,crim:crim"     # the statues' own marble, paler than the court it stands in
# The gearing. The great wheel has 28 teeth, the pinion 10: for a quarter turn of the statue (7 teeth) the pinion goes
# 0.7 of a turn the other way. As made (tools/gear_even.py, which prints it) a tooth of the great wheel is centred at
# yaw PLINTH_TOOTH0 of its model and the rest follow every 360/28 degrees; a tooth of the pinion at PINION_TOOTH0 and
# every 36. The pinion stands off at yaw PINION_SIDE from the plinth's axis, as far out as lets the teeth of each
# reach 2.3 cm into the gaps of the other without touching their floor
const PLINTH_RATIO := 2.8
const PLINTH_TOOTH0 := 5.373
const PINION_TOOTH0 := 5.7
const PINION_SIDE := -45.0
const PINION_R := 0.155         # half the pinion's width over its teeth, before PLINTH_K
const PINION_OFF := 0.5524      # from the plinth's axis to the pinion's, before PLINTH_K (0.58 m)

## how the pinion stands when the great wheel stands at yaw th: one of its teeth in the middle of the gap that faces it.
## (With the wheel at rest the gap nearest the pinion lies off the line between the two axes by some angle; the same
## length of rim on the pinion is 2.8 times that angle, the other way round.)
func _pinion_yaw(th: float) -> float:
	var gap := PLINTH_TOOTH0 + 180.0 / 28.0 - PINION_SIDE      # (degrees) a gap of the wheel, measured from the line of axes, when th = 0
	return deg_to_rad(PINION_SIDE + 180.0 - PINION_TOOTH0 - PLINTH_RATIO * gap) - PLINTH_RATIO * th

func _turn_plinth(parent: Node, p: Vector3, q: int, pose := "point") -> Array:
	var twin := parent == mroot
	var k := PLINTH_K
	# (the base as made has only scraps of its bronze ring: they are painted as the marble, and the ring is laid whole round the upper step)
	var pb := prop_model("plinth_base", parent, 0.0, 0.0, twin, false, "stone:marble,gold:marble,crim:crim"); pb.position = p; pb.scale = Vector3.ONE * k
	cyl(p + Vector3(0, 0.078 * k, 0), 0.4615 * k + 0.004, 0.4615 * k + 0.004, 0.02 * k, pal("gold", "flat2" if twin else "flat"), 32, parent)
	for t in 4:      # the four quarters, marked in bronze on the lower step
		var tk := blk(Vector3(-0.016, 0.0, -0.02), Vector3(0.016, 0.016, 0.02), "gold", parent); tk.rotation.y = t * PI * 0.5
		tk.position = p + Vector3(sin(t * PI * 0.5), 0, cos(t * PI * 0.5)) * 0.483 * k + Vector3(0, 0.048 * k, 0)
	var n := Node3D.new(); n.position = p; n.rotation.y = TURN_YAW0 - q * PI * 0.5; parent.add_child(n)
	prop_model("plinth_top", n, 0.0, 0.0, twin, false, PLINTH_PARTS).scale = Vector3.ONE * k    # its red pointer looks the way she does
	her_statue(Vector3(0, PLINTH_TOP * k - 0.006, 0), 0.0, pose, 0.9, n)
	# the pinion: a small wheel on its own post beside the base, its teeth in the great wheel's, turning the other way.
	# The post stands on a lug of the base's lower step, of the same marble and level with it
	var pr := PINION_R * k
	var sd := deg_to_rad(PINION_SIDE)
	var at := p + Vector3(sin(sd), 0.0, cos(sd)) * PINION_OFF * k      # on the side one sees
	var lug := 0.047 * k
	cyl(at, 0.12, 0.12, lug, pal("marble", "flat2" if twin else "flat"), 20, parent); cyl(at + Vector3(0, lug, 0), 0.085, 0.1, PLINTH_CUT * k - lug, pal("shade"), 12, parent)
	var pin := Node3D.new(); pin.position = at + Vector3(0, PLINTH_CUT * k, 0); pin.rotation.y = _pinion_yaw(n.rotation.y); parent.add_child(pin)
	prop_model("pinion", pin, 0.0, 0.0, twin, false, "stone:gold,gold:gold").scale = Vector3(pr * 2.0, pr * 2.0 * 0.66, pr * 2.0)
	return [n, pin]

## How far the marble of a statue stands out from the axis of its plinth at the height of her hands, for every 10
## degrees round it (a yaw in the turning part's own frame), so that her palms can lie on it wherever it has got to.
## Read off the statue as it is posed: every face of it that crosses that height
const TURN_HAND_Y := 1.34
const TURN_STAND := 0.68      # how far from a plinth's axis she stands to turn it: a hand's breadth clear of its base, and her arms reach the marble
func _statue_girth(frame: Node3D) -> PackedFloat32Array:
	var g := PackedFloat32Array(); g.resize(36); g.fill(0.0)
	var inv := frame.global_transform.affine_inverse()
	for m in frame.find_children("*", "MeshInstance3D", true, false):
		var mi := m as MeshInstance3D
		if mi.skin == null: continue
		var bk: ArrayMesh = mi.bake_mesh_from_current_skeleton_pose()
		if bk == null: continue
		var xf := inv * mi.global_transform
		for si in bk.get_surface_count():
			var a := bk.surface_get_arrays(si); var v: PackedVector3Array = a[Mesh.ARRAY_VERTEX]
			var ix: PackedInt32Array = a[Mesh.ARRAY_INDEX] if a[Mesh.ARRAY_INDEX] != null else PackedInt32Array(range(v.size()))
			var w := PackedVector3Array(); w.resize(v.size())
			for j in v.size(): w[j] = xf * v[j]
			for t in range(0, ix.size() - 2, 3):
				var p0 := w[ix[t]]; var p1 := w[ix[t + 1]]; var p2 := w[ix[t + 2]]
				if minf(p0.y, minf(p1.y, p2.y)) > TURN_HAND_Y + 0.06 or maxf(p0.y, maxf(p1.y, p2.y)) < TURN_HAND_Y - 0.06: continue
				for q in [p0, p1, p2, (p0 + p1) * 0.5, (p1 + p2) * 0.5, (p2 + p0) * 0.5, (p0 + p1 + p2) / 3.0]:
					if absf(q.y - TURN_HAND_Y) > 0.045: continue
					var b := int(fposmod(atan2(q.x, q.z), TAU) / TAU * 36.0) % 36
					g[b] = maxf(g[b], Vector2(q.x, q.z).length())
	var mean := 0.0; var got := 0
	for b in 36:
		if g[b] > 0.0: mean += g[b]; got += 1
	mean = mean / got if got > 0 else 0.13
	var out := PackedFloat32Array(); out.resize(36)
	for b in 36:      # a bin nothing fell in takes its neighbours'; then each is evened a little with those beside it
		var c := g[b]
		if c <= 0.0:
			var l := g[(b + 35) % 36]; var r := g[(b + 1) % 36]
			c = maxf(l, r) if maxf(l, r) > 0.0 else mean
		out[b] = c
	for b in 36: g[b] = out[(b + 35) % 36] * 0.25 + out[b] * 0.5 + out[(b + 1) % 36] * 0.25
	if OS.get_environment("S3_ONE") != "": print("GIRTH at ", TURN_HAND_Y, " faces hit ", got, "/36 mean ", snappedf(mean, 0.001), " ", g)
	return g

## the point of a statue's marble that lies at world yaw `wy` from its plinth's axis, at the height of her hands
func _girth_at(i: int, wy: float) -> Vector3:
	var g: PackedFloat32Array = turn_girth[i]
	var f := fposmod(wy - (turn_n[i] as Node3D).rotation.y, TAU) / TAU * 36.0 - 0.5
	var b := int(floor(f)); var k := f - b
	var r := lerpf(g[(b + 36) % 36], g[(b + 1) % 36], k)
	return (TURN_AT[i] as Vector3) + Vector3(sin(wy) * r, TURN_HAND_Y, cos(wy) * r)

func _turned_ones() -> void:
	var m0 := mroot.get_child_count()
	for i in 3:
		var pose: String = ["point", "pointl", "point2"][i]
		var made := _turn_plinth(self, TURN_AT[i], 0, pose)
		turn_n.append(made[0]); turn_pin.append(made[1]); turn_girth.append(_statue_girth(made[0]))
		var gem := ball(TURN_AT[i] + Vector3(0.341 * PLINTH_K, 0.048 * PLINTH_K + 0.03, 0.341 * PLINTH_K), 0.036, mat(Color("ff5a62"))); turn_gem.append(gem)
		cyl(TURN_AT[i] + Vector3(0.341 * PLINTH_K, 0.048 * PLINTH_K, 0.341 * PLINTH_K), 0.056, 0.048, 0.016, pal("gold"), 12)      # the stud sits in a bronze collar
		_turn_plinth(mroot, TURN_AT[i], TURN_GOAL[i], pose)      # in the water she stands as she should
	_strip_refl(mroot, m0, "mir", 0.3)
	var wq := QuadMesh.new(); wq.size = Vector2(RX1 - RX0, RZ1 - RZ0); wq.orientation = PlaneMesh.FACE_Y
	var g3 := ShaderMaterial.new(); g3.shader = shaders["glass"]; timed.append(g3)
	g3.set_shader_parameter("lost_a", 0.0); g3.set_shader_parameter("blur_px", 0.6); g3.set_shader_parameter("lod", 0.0)   # this water shows them clearly
	prim(wq, Vector3((RX0 + RX1) * 0.5, 0.012, (RZ0 + RZ1) * 0.5), g3).cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	# the south gate: two piers, a lintel, and a bronze grille that sinks into its slot when the three stand right
	for gx in [-17.02, -15.58]:
		blk(Vector3(gx - 0.14, 0, EZ0 - 0.04), Vector3(gx + 0.14, 2.1, EZ0 + 0.24), "stone"); blk(Vector3(gx - 0.17, 0, EZ0 - 0.07), Vector3(gx + 0.17, 0.1, EZ0 + 0.27), "shade")
		blk(Vector3(gx - 0.155, 0.1, EZ0 - 0.055), Vector3(gx + 0.155, 0.16, EZ0 + 0.255), "stone")      # a second step to its foot, a necking band and a capital under the lintel
		blk(Vector3(gx - 0.155, 1.86, EZ0 - 0.055), Vector3(gx + 0.155, 1.9, EZ0 + 0.255), "shade"); blk(Vector3(gx - 0.17, 2.0, EZ0 - 0.07), Vector3(gx + 0.17, 2.1, EZ0 + 0.27), "shade")
	blk(Vector3(-17.16, 2.1, EZ0 - 0.04), Vector3(-15.44, 2.42, EZ0 + 0.24), "stone")
	cornice(-17.16, EZ0 - 0.04, -15.44, EZ0 + 0.24, 2.42, 0.04, 0.06); dentils(-17.16, EZ0 - 0.04, -15.44, EZ0 + 0.24, 2.42)
	gate_slot(Vector3(-16.3, 0, EZ0 + 0.1), 0.58, true)
	gate_e = Node3D.new(); gate_e.position = Vector3(-16.3, 0, EZ0 + 0.1); add_child(gate_e)
	for i in 7: blk(Vector3(-0.54 + 0.18 * i - 0.018, 0, -0.018), Vector3(-0.54 + 0.18 * i + 0.018, 2.02, 0.018), "dark", gate_e)
	for gy in [0.5, 1.2, 1.9]: blk(Vector3(-0.58, gy, -0.024), Vector3(0.58, gy + 0.04, 0.024), "gold", gate_e)

## the second court, "the mirror he covered". Its pool lies under a great cloth, as the sculptor covered every mirror.
## With the cloth drawn off, the water shows the west wall with a door in it, where the wall itself is plain stone.
## Only after that has been seen can the stone be pushed
func _pool_c_covered() -> void:
	var args := OS.get_cmdline_user_args()
	_strip_refl(mroot)
	var m0 := mroot.get_child_count()
	var x := WALLX; var h := WALLH; var z0 := -16.18; var z1 := -11.6; var da := DOORZ - 0.45; var db := DOORZ + 0.45; var dh := 1.85
	# the wall itself: three masses round the place of the door, and a leaf of the same stone that closes it
	blk(Vector3(CX0, 0, z0), Vector3(x, h, da), "stone"); blk(Vector3(CX0, 0, db), Vector3(x, h, z1), "stone"); blk(Vector3(CX0, dh, da), Vector3(x, h, db), "stone")
	blk(Vector3(CX0 - 0.03, 0, z0), Vector3(x + 0.03, 0.1, da), "shade"); blk(Vector3(CX0 - 0.03, 0, db), Vector3(x + 0.03, 0.1, z1 + 0.03), "shade")
	cornice(CX0, z0, x, z1, h); dentils(CX0, z0, x, z1, h); crenels(Vector3(x - 0.09, h + 0.06, z0 + 0.1), Vector3(x - 0.09, h + 0.06, z1 - 0.1), 0.335)
	door_a = Node3D.new(); add_child(door_a)
	blk(Vector3(x - 0.16, 0, da), Vector3(x, dh, db), "stone", door_a)
	blk(Vector3(x - 0.02, 0, da), Vector3(x + 0.03, 0.1, db), "shade", door_a)   # the skirting runs on unbroken: nothing gives the leaf away
	seam_a = Node3D.new(); seam_a.position = Vector3(x + 0.003, 0, DOORZ); seam_a.scale = Vector3(1, 0.001, 1); seam_a.visible = false; door_a.add_child(seam_a)
	for sz in [-0.45, 0.45]: blk(Vector3(0, 0, sz - 0.014), Vector3(0.004, dh, sz + 0.014), "dark", seam_a)
	blk(Vector3(0, dh - 0.028, -0.45), Vector3(0.004, dh, 0.45), "dark", seam_a)
	blk(Vector3(0, 0, -0.01), Vector3(0.004, dh - 0.028, 0.01), "dark", seam_a)
	# in the water the same wall hangs upside down, and there the bay that is blank above has a door
	var xm := x - 0.012
	blk(Vector3(xm, 0, -15.86), Vector3(x, h, da), "stone", mroot); blk(Vector3(xm, 0, db), Vector3(x, h, z1), "stone", mroot); blk(Vector3(xm, dh, da), Vector3(x, h, db), "stone", mroot)
	blk(Vector3(xm, h, -15.86), Vector3(x + 0.03, h + 0.07, z1), "shade", mroot)
	for i in 13: blk(Vector3(xm, h + 0.07, -15.8 + 0.335 * i), Vector3(x, h + 0.19, -15.8 + 0.335 * i + 0.13), "stone", mroot)
	blk(Vector3(x, 0, -15.86), Vector3(x + 0.03, 0.1, da), "shade", mroot); blk(Vector3(x, 0, db), Vector3(x + 0.03, 0.1, z1), "shade", mroot)
	for jz in [da - 0.06, db + 0.06]: blk(Vector3(x, 0, jz - 0.06), Vector3(x + 0.04, dh + 0.12, jz + 0.06), "dark", mroot)   # the frame of the door
	blk(Vector3(x, dh, da - 0.12), Vector3(x + 0.05, dh + 0.14, db + 0.12), "dark", mroot)
	blk(Vector3(x, dh + 0.14, da - 0.18), Vector3(x + 0.06, dh + 0.2, db + 0.18), "gold", mroot)
	door_m = Node3D.new()
	blk(Vector3(x - 0.01, 0, da), Vector3(x + 0.02, dh, db), "crim", door_m)
	blk(Vector3(x + 0.02, 0, DOORZ - 0.02), Vector3(x + 0.026, dh, DOORZ + 0.02), "dark", door_m)
	for sy in [0.4, 0.95, 1.5]:
		for sz in [-0.24, 0.24]: blk(Vector3(x + 0.02, sy - 0.05, DOORZ + sz - 0.05), Vector3(x + 0.034, sy + 0.05, DOORZ + sz + 0.05), "gold", door_m)
	for both in [self, mroot]:
		for nz in [-15.3, -12.7]: niche_x(x, 0.35, nz, 0.5, 1.05, both)
	_strip_refl(mroot, m0, "mir", 0.2)
	_strip_refl(door_m, 0, "mir", 0.0)   # the door keeps its own colour: it is the thing to be seen
	var leaf_m := (door_m.get_child(0) as MeshInstance3D).material_override as ShaderMaterial
	for cn in ["c_top", "c_z", "c_x"]: leaf_m.set_shader_parameter(cn, Color("cf1f2d"))   # deep enough to stay red through the water
	mroot.add_child(door_m)
	if OS.get_environment("NOMIR") == "1": mroot.visible = false
	var wq := QuadMesh.new(); wq.size = Vector2(QX1 - QX0, QZ1 - QZ0); wq.orientation = PlaneMesh.FACE_Y
	glass2 = ShaderMaterial.new(); glass2.shader = shaders["glass"]; timed.append(glass2)
	glass2.set_shader_parameter("blur_px", 1.9); glass2.set_shader_parameter("wave", 0.7)   # a little clearer than the first pool: here there is something to read
	prim(wq, Vector3((QX0 + QX1) * 0.5, 0.012, (QZ0 + QZ1) * 0.5), glass2).cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	# the cloth over the pool
	var sj := "res://props/sheet.json"
	if FileAccess.file_exists(sj) and OS.get_environment("NOSHEET") != "1":
		sheet_meta = JSON.parse_string(FileAccess.get_file_as_string(sj))
		sheet_data = FileAccess.get_file_as_bytes("res://props/sheet.bin").to_float32_array()
		var nx := int(sheet_meta.nx); var ny := int(sheet_meta.ny)
		for j in ny + 1:
			for i in nx + 1: sheet_uv.append(Vector2(float(i) / nx, 1.0 - float(j) / ny))
		for j in ny:
			for i in nx:
				var k := j * (nx + 1) + i
				sheet_ix.append_array(PackedInt32Array([k, k + nx + 1, k + 1, k + 1, k + nx + 1, k + nx + 2]))
		var im := _png("res://props/sheet.png")
		var small: Image = im.duplicate(); small.resize(1, 1, Image.INTERPOLATE_LANCZOS); var mean := small.get_pixel(0, 0)   # tinted so that on the whole it is the terracotta of her own cloth
		im.generate_mipmaps()
		var sm := ShaderMaterial.new(); sm.shader = shaders["sheet"]; sm.set_shader_parameter("albedo_tex", ImageTexture.create_from_image(im))
		var ml := mean.srgb_to_linear()   # (the texture is read as linear light, so its mean is taken there)
		sm.set_shader_parameter("mean_l", maxf((ml.r + ml.g + ml.b) / 3.0, 0.01)); sm.set_shader_parameter("base", Color(0.78, 0.35, 0.25))
		sheet_mesh = ArrayMesh.new(); sheet = MeshInstance3D.new(); sheet.mesh = sheet_mesh; sheet.material_override = sm; sheet.extra_cull_margin = 6.0; add_child(sheet)
		sheet_f = float(OS.get_environment("SHEET_F")) if OS.get_environment("SHEET_F") != "" else 1.0
		sheet_set(sheet_f)

## the cloth as it lies at frame f of its simulation (the stored frames are every second one; between them it is blended)
func sheet_set(f: float) -> void:
	if sheet_mesh == null: return
	var nx := int(sheet_meta.nx); var ny := int(sheet_meta.ny); var nv := (nx + 1) * (ny + 1); var step := float(sheet_meta.step)
	var q := clampf((f - 1.0) / step, 0.0, float(sheet_meta.frames) - 1.0); var a := int(q); var b := mini(a + 1, int(sheet_meta.frames) - 1); var u := q - a
	var vs := PackedVector3Array(); vs.resize(nv); var o0 := a * nv * 3; var o1 := b * nv * 3
	for k in nv:   # Blender's x east, y north, z up -> x, -z, y here
		var k3 := k * 3
		vs[k] = Vector3(lerpf(sheet_data[o0 + k3], sheet_data[o1 + k3], u) + SHEET_C.x, lerpf(sheet_data[o0 + k3 + 2], sheet_data[o1 + k3 + 2], u) + SHEET_C.y, -lerpf(sheet_data[o0 + k3 + 1], sheet_data[o1 + k3 + 1], u) + SHEET_C.z)
	var ns := PackedVector3Array(); ns.resize(nv)
	for j in ny + 1:
		for i in nx + 1:
			var k := j * (nx + 1) + i
			var dx := vs[k + (1 if i < nx else 0)] - vs[k - (1 if i > 0 else 0)]
			var dy := vs[k + ((nx + 1) if j < ny else 0)] - vs[k - ((nx + 1) if j > 0 else 0)]
			ns[k] = dy.cross(dx).normalized()
	var arr := []; arr.resize(Mesh.ARRAY_MAX)
	arr[Mesh.ARRAY_VERTEX] = vs; arr[Mesh.ARRAY_NORMAL] = ns; arr[Mesh.ARRAY_TEX_UV] = sheet_uv; arr[Mesh.ARRAY_INDEX] = sheet_ix
	sheet_mesh.clear_surfaces(); sheet_mesh.add_surface_from_arrays(Mesh.PRIMITIVE_TRIANGLES, arr)

## where one vertex of the cloth is at frame f
func sheet_vpos(v: int, f: float) -> Vector3:
	var nv := (int(sheet_meta.nx) + 1) * (int(sheet_meta.ny) + 1); var step := float(sheet_meta.step)
	var q := clampf((f - 1.0) / step, 0.0, float(sheet_meta.frames) - 1.0); var a := int(q); var b := mini(a + 1, int(sheet_meta.frames) - 1); var u := q - a
	var o0 := (a * nv + v) * 3; var o1 := (b * nv + v) * 3
	return Vector3(lerpf(sheet_data[o0], sheet_data[o1], u) + SHEET_C.x, lerpf(sheet_data[o0 + 2], sheet_data[o1 + 2], u) + SHEET_C.y, -lerpf(sheet_data[o0 + 1], sheet_data[o1 + 1], u) + SHEET_C.z)

## her hands while she gathers the cloth. Each patch of its middle line is taken by one hand in turn (right, left,
## right ...): the hand reaches for it as it comes, goes with it to her waist, and lets it fall on the heap
func sheet_hands(dt: float) -> void:
	var wl := 0.0; var wr := 0.0; var hi := 0.0
	var grabs: Array = sheet_meta.grabs
	for k in grabs.size():
		var g: Dictionary = grabs[k]; var arr := float(g.arr); var drop := float(g.drop)
		var w := clampf((sheet_f - (arr - 11.0)) / 9.0, 0.0, 1.0) * clampf((drop + 5.0 - sheet_f) / 5.0, 0.0, 1.0)
		if w <= 0.0: continue
		var p := sheet_vpos(int(g.v), sheet_f) + Vector3(0.0, 0.03, 0.0)
		if k % 2 == 0:
			if w > wr: wr = w; tgtR = p + Vector3(0, 0, -0.05)
		else:
			if w > wl: wl = w; tgtL = p + Vector3(0, 0, 0.05)
		hi = maxf(hi, w * clampf(1.0 - (p.y - 0.45) / 0.5, 0.0, 1.0))
	a_wR = lerpf(a_wR, wr, 1.0 - exp(-14.0 * dt)); a_wL = lerpf(a_wL, wl, 1.0 - exp(-14.0 * dt))
	a_lean = lerpf(a_lean, 0.05 + 0.2 * hi, 1.0 - exp(-7.0 * dt))   # she bends to the cloth and straightens as she draws it up

func _world() -> void:
	# ---- A. the arrival court (10 x 9.5 m, open floor all round the mirror pool)
	slab(AX0, AZ0, AX1, AZ1, 0.0); under(AX0, AZ0, AX1, AZ1, 0.22, "stone")   # no pool here any more: the water belongs to the second court
	tiles(AX0, AZ0, AX1, AZ1, 1.0); meander(AX0 + 0.7, AZ0 + 0.7, AX1 - 0.2, AZ1 - 0.2)
	parapet(Vector3(AX0 + 0.1, 0, -3.9), Vector3(AX0 + 0.1, 0, AZ1 - 0.1)); parapet(Vector3(AX0 + 0.1, 0, -3.9), Vector3(-0.85, 0, -3.9)); parapet(Vector3(0.85, 0, -3.9), Vector3(3.4, 0, -3.9))
	parapet(Vector3(3.4, 0, -3.9), Vector3(3.4, 0, -0.3)); parapet(Vector3(3.4, 0, 2.3), Vector3(3.4, 0, AZ1 - 0.1))
	parapet(Vector3(AX0 + 0.1, 0, AZ1 - 0.1), Vector3(-0.95, 0, AZ1 - 0.1)); parapet(Vector3(0.95, 0, AZ1 - 0.1), Vector3(3.4, 0, AZ1 - 0.1))
	tree(Vector3(AX0 + 0.405, 0, AZ1 - 0.549), 1.2); cypress(Vector3(AX0 + 0.45, 0, -3.5), 2.6)
	_start_zone()
	lantern(Vector3(1.0, 0, -3.46), 2); urn(Vector3(2.9, 0, AZ1 - 0.5), 1.0); urn(Vector3(3.1, 0, AZ1 - 0.78), 0.7, "rose")
	for gx in [-0.72, 0.72]:
		blk(Vector3(gx - 0.14, 0, -4.04), Vector3(gx + 0.14, 2.1, -3.76), "stone"); blk(Vector3(gx - 0.17, 0, -4.07), Vector3(gx + 0.17, 0.1, -3.73), "shade")
	var gw := CSGBox3D.new(); gw.size = Vector3(1.72, 0.66, 0.28); gw.position = Vector3(0, 2.43, -3.9); gw.material = pal("stone")
	var gc := CSGCylinder3D.new(); gc.operation = CSGShape3D.OPERATION_SUBTRACTION; gc.radius = 0.58; gc.height = 0.5; gc.sides = 32
	gc.rotation.x = PI * 0.5; gc.position = Vector3(0, -0.33, 0); gc.material = pal("shade"); gw.add_child(gc); add_child(gw)
	cornice(-0.86, -4.04, 0.86, -3.76, 2.76, 0.04, 0.06); dentils(-0.86, -4.04, 0.86, -3.76, 2.76); blk(Vector3(-0.06, 2.82, -3.94), Vector3(0.06, 2.94, -3.86), "crim")
	for gx in [-0.72, 0.72]:   # each pier has a second step to its foot, a sunk panel on the faces seen, and an impost where the arch springs
		blk(Vector3(gx - 0.155, 0.1, -4.055), Vector3(gx + 0.155, 0.15, -3.745), "stone")
		pier_panels(gx, -3.9, 0.14, 0.32, 1.86, 0.075)
		blk(Vector3(gx - 0.165, 2.03, -4.065), Vector3(gx + 0.165, 2.1, -3.735), "shade")
	arch_band(Vector3(0, 2.1, -3.76), 0.58, 0.67, 0.014); bb_end("shade")     # the moulding round the arch, and its keystone
	blk(Vector3(-0.075, 2.63, -3.77), Vector3(0.075, 2.76, -3.715), "stone"); blk(Vector3(-0.028, 2.67, -3.715), Vector3(0.028, 2.726, -3.708), "gold")
	# the head of the arch is closed by a fixed bronze fan over a transom: only the grille under it sinks
	blk(Vector3(-0.58, 2.04, -3.925), Vector3(0.58, 2.085, -3.875), "gold")
	for i in 7:
		var fa := PI * (i + 1) / 8.0
		stick(Vector3(0, 2.085, -3.9), Vector3(cos(fa) * 0.575, 2.085 + sin(fa) * 0.575, -3.9), 0.011, "dark")
	arch_band(Vector3(0, 2.085, -3.914), 0.29, 0.325, 0.028); arch_band(Vector3(0, 2.085, -3.918), 0.0, 0.1, 0.036, false, 8); bb_end("gold")
	for i in 5:   # solid stone steps, each standing on the one below; the last is a hand above the water, not level with it. Each is a riser and, on it, a tread with a nosing
		var st := -0.25 * (i + 1); var sz0 := AZ1 + 0.26 * i
		blk(Vector3(-0.8, st - 0.6, sz0), Vector3(0.8, st - 0.04, sz0 + 0.26), "shade"); blk(Vector3(-0.8, st - 0.04, sz0), Vector3(0.8, st, sz0 + 0.285), "stone")
	for e in [-1.0, 1.0]:   # its two cheeks step down with it, each stage under a cap of its own (they were two plain slabs); at its head a newel ends each parapet
		for k in 3:
			var ct := 0.1 - 0.5 * k; var cz0 := AZ1 + 0.52 * k; var cz1 := AZ1 + (0.52 * (k + 1) if k < 2 else 1.36)
			blk(Vector3(e * 0.8, -2.45, cz0), Vector3(e * 0.98, ct, cz1), "shade"); blk(Vector3(e * 0.785, ct, cz0), Vector3(e * 0.995, ct + 0.045, cz1 + 0.02), "stone")
		var nw := Vector3(e * 0.93, 0, AZ1 - 0.1)
		blk(nw + Vector3(-0.11, 0, -0.11), nw + Vector3(0.11, 0.47, 0.11), "stone"); pier_panels(nw.x, nw.z, 0.11, 0.1, 0.4, 0.055)
		blk(nw + Vector3(-0.135, 0.47, -0.135), nw + Vector3(0.135, 0.51, 0.135), "shade"); blk(nw + Vector3(-0.1, 0.51, -0.1), nw + Vector3(0.1, 0.54, 0.1), "stone")
		prim(_lowball(0.068), nw + Vector3(0, 0.6, 0), pal("gold", "flat"))
	blk(Vector3(-1.04, -2.45, AZ1 + 0.05), Vector3(1.04, WATER + 0.035, AZ1 + 1.42), "shade")   # the foot of the stair at the water
	foam(-1.04, AZ1 + 0.05, 1.04, AZ1 + 1.42, 0.3)
	boat = Node3D.new(); boat.name = "Boat"; boat.position = Vector3(2.5, WATER - 0.12, AZ1 + 1.4); boat.rotation.y = 1.0; add_child(boat)
	build_boat(boat)
	# the mooring pile of her boat: it stands in the sea beside the steps, with the boat's line coiled round it
	cyl(Vector3(1.32, -2.45, AZ1 + 0.72), 0.065, 0.055, 2.45 - 0.5, pal("wood"), 8); cyl(Vector3(1.32, -0.5, AZ1 + 0.72), 0.068, 0.05, 0.03, pal("trunk"), 8)
	for ry in 3: cyl(Vector3(1.32, -0.78 + 0.035 * ry, AZ1 + 0.72), 0.074, 0.074, 0.03, pal("rope"), 8)
	foam(1.32 - 0.06, AZ1 + 0.72 - 0.06, 1.32 + 0.06, AZ1 + 0.72 + 0.06, 0.22)
	stick(Vector3(1.36, -0.75, AZ1 + 0.735), Vector3(1.6, -0.9, AZ1 + 0.815), 0.011, "rope")      # and the line itself, from the pile down to the boat's bow
	slab(3.5, -0.3, 5.1, 2.3, 0.0); under(3.5, -0.3, 5.1, 2.3, 0.2, "sand"); parapet(Vector3(5.0, 0, -0.2), Vector3(5.0, 0, 2.2))
	parapet(Vector3(3.4, 0, -0.2), Vector3(5.0, 0, -0.2)); parapet(Vector3(3.4, 0, 2.2), Vector3(5.0, 0, 2.2))   # the landing is a lookout now: railed on its two open sides as well
	for bz in [2.005, -0.005]:   # a stone bench along either rail (there was one plain block), a medallion in the floor between them, a pair of jars at the far rail
		for bx in [3.98, 4.42]: blk(Vector3(bx, 0, bz - 0.085), Vector3(bx + 0.1, 0.2, bz + 0.085), "shade")
		blk(Vector3(3.88, 0.2, bz - 0.115), Vector3(4.62, 0.255, bz + 0.115), "stone")
	var mc := Vector3(4.2, 0, 1.0)
	for i in 4: cyl(mc + Vector3(0, 0.002 * i, 0), 0.5 * [1.0, 0.9, 0.62, 0.5][i], 0.5 * [1.0, 0.9, 0.62, 0.5][i], 0.005, pal(["shade", "stone", "rose", "stone"][i]), 28)
	cyl(mc + Vector3(0, 0.008, 0), 0.13, 0.13, 0.004, pal("gold"), 24); cyl(mc + Vector3(0, 0.01, 0), 0.085, 0.085, 0.004, pal("stone"), 24)
	for i in 8:
		var ma := TAU * i / 8.0
		var md := blk(Vector3(-0.035, 0.008, -0.035), Vector3(0.035, 0.013, 0.035), "shade" if i % 2 == 0 else "gold")
		md.position = mc + Vector3(cos(ma), 0, sin(ma)) * 0.38 + Vector3(0, 0.0105, 0); md.rotation.y = PI * 0.25 - ma
	urn(Vector3(4.76, 0, 1.93), 0.8); urn(Vector3(4.76, 0, 0.07), 0.8, "rose")
	# (the great veiled head that lay here is taken out of this view: it is kept for another place)
	slab(-10.6, -2.2, -9.2, 2.2, 0.0); under(-10.6, -2.2, -9.2, 2.2, 0.18, "sand")
	for cz in [-1.6, -0.55, 0.55, 1.6]: column(Vector3(-9.9, 0, cz), 2.4, 0.15)
	blk(Vector3(-10.14, 2.45, -1.9), Vector3(-9.66, 2.66, 1.9), "stone"); cornice(-10.14, -1.9, -9.66, 1.9, 2.66, 0.04, 0.06); dentils(-10.14, -1.9, -9.66, 1.9, 2.66)   # the dentils under the cornice (they hung under the beam itself), and a fillet between architrave and frieze
	blk(Vector3(-10.14, 2.52, -1.9), Vector3(-9.648, 2.545, 1.912), "shade")
	# ---- B. the causeway between the two courts, whole. On either side of it, in the sea, stand the mirrors he hid
	slab(-0.6, -10.0, 0.6, -4.0, 0.0)
	pier(0.0, -5.0, -0.18, 0.7); pier(0.0, -7.0, -0.18, 0.7); pier(0.0, -8.9, -0.18, 0.7)
	for e in [-1.0, 1.0]: blk(Vector3(e * 0.54 - 0.03, 0, -9.94), Vector3(e * 0.54 + 0.03, 0.06, -4.06), "shade")   # a low kerb along either edge, as on the turning bridge, and the joints of its paving
	for jz in [-5.0, -6.0, -7.0, -8.0, -9.0]: blk(Vector3(-0.51, 0, jz - 0.008), Vector3(0.51, 0.003, jz + 0.008), "shade")
	_shrouds()
	# ---- C. the court of the crossing (9.4 x 8.6 m): a wide pool, the winch deep in it, room to walk all round
	_pool_court(CX0, CZ0, CX1, CZ1, QX0, QZ0, QX1, QZ1, "sand", "PoolSky2")
	tile_hole = Rect2(QX0 - 0.08, QZ0 - 0.08, QX1 - QX0 + 0.16, QZ1 - QZ0 + 0.16); tiles(CX0, CZ0, CX1, CZ1, 1.0); tile_hole = Rect2()
	if COVERED: rosette(Vector3(1.3, 0, -13.0), 1.2)
	# its back wall. The blind arches are real niches now, a hand deep, each with a sill and a moulding round it
	# (they were dark shapes laid flat on the stone); a skirting runs along its foot
	var cw := CSGBox3D.new(); cw.size = Vector3(CX1 - CX0, 1.6, 0.22); cw.position = Vector3((CX0 + CX1) * 0.5, 0.8, CZ0 + 0.11); cw.material = pal("stone")
	var wmid := (CX0 + CX1) * 0.5
	for wx in [-2.2, -0.8, 0.6, 2.0, 3.4, 4.8]:
		var nb := CSGBox3D.new(); nb.operation = CSGShape3D.OPERATION_SUBTRACTION; nb.size = Vector3(0.5, 0.8, 0.2); nb.position = Vector3(wx - wmid, -0.15, 0.11); nb.material = pal("shade"); cw.add_child(nb)
		var nc := CSGCylinder3D.new(); nc.operation = CSGShape3D.OPERATION_SUBTRACTION; nc.radius = 0.25; nc.height = 0.2; nc.sides = 24
		nc.rotation.x = PI * 0.5; nc.position = Vector3(wx - wmid, 0.25, 0.11); nc.material = pal("shade"); cw.add_child(nc)
		win_z(wx, 0.25, CZ0 + 0.12, 0.5, 1.05)
		blk(Vector3(wx - 0.33, 0.19, CZ0 + 0.22), Vector3(wx + 0.33, 0.25, CZ0 + 0.275), "shade")
		arch_band(Vector3(wx, 1.05, CZ0 + 0.22), 0.25, 0.315, 0.014)
		bb(Vector3(wx - 0.315, 0.25, CZ0 + 0.22), Vector3(wx - 0.25, 1.05, CZ0 + 0.234)); bb(Vector3(wx + 0.25, 0.25, CZ0 + 0.22), Vector3(wx + 0.315, 1.05, CZ0 + 0.234))
	bb_end("shade"); add_child(cw)
	blk(Vector3(CX0, 0, CZ0 + 0.22), Vector3(CX1, 0.09, CZ0 + 0.25), "shade")
	cornice(CX0, CZ0, CX1, CZ0 + 0.22, 1.6); dentils(CX0, CZ0, CX1, CZ0 + 0.22, 1.6)
	crenels(Vector3(CX0 + 0.1, 1.66, CZ0 + 0.18), Vector3(CX1 - 0.1, 1.66, CZ0 + 0.18), 0.335)
	meander(CX0 + 0.68, CZ0 + 0.85, CX1 - 0.68, CZ1 - 0.97)      # a Greek key round its floor, as in the other courts
	banner(Vector3(-0.1, 1.5, CZ0 + 0.268), 0.34, 0.95); banner(Vector3(2.7, 1.5, CZ0 + 0.268), 0.34, 0.95)   # clear of the wall by more than the cloth waves: it used to dip into the stone
	plinth_head("kit_face6", Vector3(-2.42, 0, -15.72) if COVERED else Vector3(-2.95, 0, CZ0 + 0.45), 0.5); plinth_head("kit_face4", Vector3(CX1 - 0.45, 0, CZ0 + 0.5), -0.4)
	if COVERED: parapet(Vector3(-3.3, 0, -11.6), Vector3(-3.3, 0, -10.1))
	else: parapet(Vector3(-3.3, 0, CZ0 + 0.4), Vector3(-3.3, 0, -13.82)); parapet(Vector3(-3.3, 0, -12.18), Vector3(-3.3, 0, -10.1))   # they end inside the gate's piers (their ends used to stick out into the gateway)
	parapet(Vector3(CX1 - 0.1, 0, CZ0 + 0.4), Vector3(CX1 - 0.1, 0, -10.1))
	parapet(Vector3(-3.3, 0, -10.1), Vector3(-0.85, 0, -10.1)); parapet(Vector3(0.85, 0, -10.1), Vector3(CX1 - 0.1, 0, -10.1))
	lantern(Vector3(CX1 - 0.4, 0, -10.56), 3, -1.0); cypress(Vector3(-3.0, 0, -10.5), 2.1); urn(Vector3(CX1 - 1.3, 0, CZ0 + 0.5), 0.9); urn(Vector3(CX1 - 1.05, 0, CZ0 + 0.65), 0.65, "rose")   # (the lamp stands in the court's near corner, clear of both rails)
	cyl(CAP, 0.3, 0.26, 0.05, pal("shade"), 32).visible = SHOW_CAPSTAN; cyl(CAP + Vector3(0, 0.05, 0), 0.065, 0.05, 0.95, pal("stone"), 16).visible = SHOW_CAPSTAN
	cap_rot = Node3D.new(); cap_rot.name = "Cap"; cap_rot.position = CAP + Vector3(0, 0.98, 0); cap_rot.rotation.y = -0.42; cap_rot.visible = SHOW_CAPSTAN; add_child(cap_rot)
	blk(Vector3(-0.022, -0.022, -0.2), Vector3(0.022, 0.022, 0.84), "dark", cap_rot)
	ball(Vector3(0, 0, 0.86), 0.045, pal("crim"), cap_rot); ball(Vector3(0, 0.06, 0), 0.045, pal("crim"), cap_rot)
	if SHOW_CAPSTAN: decal(CAP + Vector3(0.12, 0, -0.12), 0.9, 0.7, 0.22, 0.78)
	_pool_c()
	# ---- the turning bridge and the long walk west
	slab(-4.2, -13.6, -3.4, -12.4, 0.0)
	if COVERED: slab(-4.2, -14.6, -3.4, -13.6, 0.0)
	bridge = Node3D.new(); bridge.name = "Bridge"; bridge.position = PIV; bridge.rotation.y = PI * 0.5; add_child(bridge)
	slab(-1.7, -0.6, 1.7, 0.6, 0.0, "stone", bridge)
	blk(Vector3(-1.6, 0, -0.03), Vector3(1.6, 0.004, 0.03), "crim", bridge)
	for e in [-1.0, 1.0]: blk(Vector3(-1.65, 0, e * 0.54 - 0.03), Vector3(1.65, 0.06, e * 0.54 + 0.03), "shade", bridge)
	# where it turns: a bronze boss let into the deck over the pivot, and under the deck the bronze collar it rides on
	# (the boss is round and sits on the axis, so it need not turn with the deck: it is part of the still world)
	cyl(PIV, 0.17, 0.17, 0.007, pal("gold"), 24); cyl(PIV + Vector3(0, 0.007, 0), 0.115, 0.115, 0.004, pal("shade"), 24); cyl(PIV + Vector3(0, 0.011, 0), 0.05, 0.04, 0.012, pal("gold"), 12)
	cyl(PIV + Vector3(0, -2.45, 0), 0.26, 0.24, 2.25, pal("stone"), 24); cyl(PIV + Vector3(0, -2.45, 0), 0.34, 0.34, 2.45 + WATER + 0.06, pal("shade"), 24)
	cyl(PIV + Vector3(0, -0.42, 0), 0.25, 0.33, 0.09, pal("stone"), 24); cyl(PIV + Vector3(0, -0.33, 0), 0.36, 0.36, 0.06, pal("gold"), 24); cyl(PIV + Vector3(0, -0.27, 0), 0.3, 0.3, 0.09, pal("shade"), 24)
	foam(PIV.x - 0.34, PIV.z - 0.34, PIV.x + 0.34, PIV.z + 0.34, 0.3)
	slab(-13.0, -13.6, -7.6, -12.4, 0.0)
	for px in [-8.6, -10.3, -12.0]: pier(px, -13.0, -0.18, 0.7)
	for e in [-1.0, 1.0]: blk(Vector3(-12.94, 0, -13.0 + e * 0.54 - 0.03), Vector3(-7.66, 0.06, -13.0 + e * 0.54 + 0.03), "shade")   # the long walk: a low kerb along either edge and the joints of its paving, as on the causeway and the bridge
	for jx in [-8.6, -9.45, -10.3, -11.15, -12.0]: blk(Vector3(jx - 0.008, 0, -13.51), Vector3(jx + 0.008, 0.003, -12.49), "shade")
	slab(-11.1, -10.6, -9.5, -9.0, 0.0); under(-11.1, -10.6, -9.5, -9.0, 0.2, "sand")
	# the broken statue: headless on its drum, her veiled head and two splinters of her lying on the floor beside it
	thing("broken_statue", Vector3(-10.3, 0, -9.8), 2.0, "stone:marble", -PI * 0.5)
	# ---- E. the court of the turned ones (9.3 x 7.4 m): three statues on turning plinths at the far rim of a wide pool
	_pool_court(EX0, EZ0, EX1, EZ1, RX0, RZ0, RX1, RZ1, "stone", "PoolSky3")
	tile_hole = Rect2(RX0 - 0.08, RZ0 - 0.08, RX1 - RX0 + 0.16, RZ1 - RZ0 + 0.16); tiles(EX0, EZ0, EX1, EZ1, 1.0); tile_hole = Rect2(); meander(EX0 + 0.55, -16.35, -13.2, EZ1 - 0.2)
	_turned_ones()
	parapet(Vector3(EX0 + 0.1, 0, -16.8), Vector3(EX0 + 0.1, 0, EZ1 - 0.1)); parapet(Vector3(EX0 + 0.1, 0, -16.8), Vector3(-17.15, 0, -16.8)); parapet(Vector3(-15.45, 0, -16.8), Vector3(-13.1, 0, -16.8))
	parapet(Vector3(EX0 + 0.1, 0, EZ1 - 0.1), Vector3(-13.1, 0, EZ1 - 0.1)); parapet(Vector3(-13.1, 0, -16.8), Vector3(-13.1, 0, -13.75)); parapet(Vector3(-13.1, 0, -12.25), Vector3(-13.1, 0, EZ1 - 0.1))
	for pp in [Vector3(-13.1, 0, -13.75), Vector3(-13.1, 0, EZ1 - 0.1)]:      # a post where the balusters would otherwise end on a thin one: the north jamb of the east entry, the south-east corner
		blk(pp + Vector3(-0.07, 0.05, -0.07), pp + Vector3(0.07, 0.34, 0.07), "stone")
	statue_on("statue_veiled_unfinished", Vector3(-21.7, 0, -10.15), 1.5, 0.8); plinth_head("kit_face1", Vector3(-21.845, 0, -15.38), PI * 0.5)   # its plinth close against the west parapet, and over the whole width of the border
	# the planter sits square in the north-west corner, its two back faces against the two parapets (its box is 0.82 m and lies off the tree's own middle);
	# the lamp stand keeps its lion paws inside the south parapet; the cypress stands clear of the rails of its corner
	tree(Vector3(-21.912, 0, -16.251), 1.1, "leaf3"); lantern(Vector3(-20.3, 0, -10.12), 4, 1.0); cypress(Vector3(-13.5, 0, -16.41), 2.2)
	urn(Vector3(-21.0, 0, -16.4), 1.0); urn(Vector3(-20.75, 0, -16.25), 0.7, "rose")
	slab(-16.9, -20.0, -15.7, -16.9, 0.0); pier(-16.3, -18.4, -0.18, 0.8)
	for e in [-1.0, 1.0]: blk(Vector3(-16.3 + e * 0.54 - 0.03, 0, -19.94), Vector3(-16.3 + e * 0.54 + 0.03, 0.06, -16.97), "shade")   # its kerbs, from the gate's piers to the garden
	for jz in [-17.6, -18.4, -19.2]: blk(Vector3(-16.81, 0, jz - 0.008), Vector3(-15.79, 0.003, jz + 0.008), "shade")
	ring_gate(Vector3(-16.3, WATER, -18.4), 2.5)
	# ---- F. the mirror garden (8 x 7 m)
	slab(-20.5, -27.0, -12.5, -20.0, 0.0); under(-20.5, -27.0, -12.5, -20.0)
	tiles(-19.4, -26.6, -12.5, -20.0, 1.0); rosette(Vector3(-17.0, 0, -23.5), 1.3); meander(-19.25, -26.45, -15.0, -20.2)
	var w1 := CSGBox3D.new(); w1.size = Vector3(1.1, 3.0, 1.9); w1.position = Vector3(MX - 0.55, 1.5, MZ); w1.material = pal("stone")
	var n1 := CSGBox3D.new(); n1.operation = CSGShape3D.OPERATION_SUBTRACTION; n1.size = Vector3(1.0, 2.2, 1.2)
	n1.position = Vector3(0.06, -0.4, 0.0); n1.material = pal("teal"); w1.add_child(n1); add_child(w1)
	cornice(MX - 1.1, MZ - 0.95, MX, MZ + 0.95, 3.0); dentils(MX - 1.1, MZ - 0.95, MX, MZ + 0.95, 3.0); crenels(Vector3(MX, 3.06, MZ - 0.85), Vector3(MX, 3.06, MZ + 0.87), 0.287)
	for fz in [MZ - 0.64, MZ + 0.6]: blk(Vector3(MX - 0.02, 0, fz), Vector3(MX + 0.03, 2.24, fz + 0.04), "gold")
	blk(Vector3(MX - 0.02, 2.2, MZ - 0.64), Vector3(MX + 0.03, 2.24, MZ + 0.64), "gold")
	var gq := QuadMesh.new(); gq.size = Vector2(1.2, 2.2)
	var gpm := ShaderMaterial.new(); gpm.shader = shaders["pane"]; timed.append(gpm)      # the glass of the great mirror: dark, with a pale head and two slow glints across it (it was an empty dark doorway)
	prim(gq, Vector3(MX - 0.012, 1.1, MZ), gpm).rotation.y = PI * 0.5
	blk(Vector3(MX - 0.02, 0, MZ - 0.64), Vector3(MX + 0.05, 0.035, MZ + 0.64), "gold")      # the foot of its frame
	# and its head, as on the standing mirrors: a gilt cornice, a low pediment and a red stone in it
	blk(Vector3(MX - 0.02, 2.24, MZ - 0.7), Vector3(MX + 0.06, 2.3, MZ + 0.7), "gold")
	var mpd := PrismMesh.new(); mpd.size = Vector3(1.4, 0.26, 0.07)
	prim(mpd, Vector3(MX + 0.015, 2.43, MZ), pal("gold")).rotation.y = PI * 0.5
	var mgem := blk(Vector3(-0.012, -0.045, -0.045), Vector3(0.022, 0.045, 0.045), "crim"); mgem.position = Vector3(MX + 0.05, 2.39, MZ); mgem.rotation.x = PI * 0.25
	blk(Vector3(MX - 1.1, 0, -27.0), Vector3(MX, 2.2, MZ - 0.95), "stone"); blk(Vector3(MX - 1.1, 0, MZ + 0.95), Vector3(MX, 1.2, -20.0), "stone")
	cornice(MX - 1.1, MZ + 0.95, MX, -20.0, 1.2, 0.03, 0.05); cornice(MX - 1.1, -27.0, MX, MZ - 0.95, 2.2, 0.03, 0.05)
	bush(Vector3(MX - 0.5, 1.2, -20.5), 1.1); bush(Vector3(MX - 0.55, 1.2, -21.4), 0.9, "leaf3"); cypress(Vector3(MX - 0.55, 1.2, -22.1), 2.0)
	var rq := QuadMesh.new(); rq.size = Vector2(2.4, 2.4)
	ripple = prim(rq, Vector3.ZERO, ring_mat(Vector3(1.0, 0.36, 0.40))); ripple.rotation.y = PI * 0.5
	var w2 := CSGBox3D.new(); w2.size = Vector3(6.9, 2.7, 0.4); w2.position = Vector3(-15.95, 1.35, -26.8); w2.material = pal("stone")
	var d1 := CSGBox3D.new(); d1.operation = CSGShape3D.OPERATION_SUBTRACTION; d1.size = Vector3(0.9, 1.6, 0.6)
	d1.position = Vector3(DX + 15.95, -0.55, 0); d1.material = pal("shade"); w2.add_child(d1)
	var d2 := CSGCylinder3D.new(); d2.operation = CSGShape3D.OPERATION_SUBTRACTION; d2.radius = 0.45; d2.height = 0.6; d2.sides = 32
	d2.rotation.x = PI * 0.5; d2.position = Vector3(DX + 15.95, 0.25, 0); d2.material = pal("shade"); w2.add_child(d2)
	add_child(w2)
	cornice(MX, -27.0, -12.5, -26.6, 2.7); dentils(MX, -27.0, -12.5, -26.6, 2.7); crenels(Vector3(MX + 0.15, 2.76, -26.63), Vector3(-12.6, 2.76, -26.63), 0.31)
	blk(Vector3(DX - 0.47, 0, -26.99), Vector3(DX + 0.47, 2.1, -26.98), "cream")
	door = blk(Vector3(DX - 0.47, 0, -26.84), Vector3(DX + 0.47, 2.1, -26.76), "crim"); door.name = "Door"
	for py in [0.25, 1.15]:
		for px in [-0.36, 0.04]: blk(Vector3(px, py - 1.05, 0.04), Vector3(px + 0.32, py - 0.35, 0.05), "crim2", door)
	# its furniture: a bronze plate along the foot, and a ring to pull it by
	bb(Vector3(-0.45, -1.05, 0.04), Vector3(0.45, -0.93, 0.05)); bb(Vector3(0.3, -0.07, 0.04), Vector3(0.36, -0.01, 0.066))
	for rg in [[0.272, -0.2, 0.388, -0.178], [0.272, -0.09, 0.388, -0.068], [0.272, -0.2, 0.294, -0.068], [0.366, -0.2, 0.388, -0.068]]: bb(Vector3(rg[0], rg[1], 0.05), Vector3(rg[2], rg[3], 0.066))
	bb_end("gold", door)      # (one mesh: the door is a thing that moves, and every piece of it is drawn on its own)
	# the doorway's surround: jambs on small feet, and an arch of stones round its head with a keystone
	for e in [-1.0, 1.0]:
		blk(Vector3(DX + e * 0.49 - 0.04, 0, -26.6), Vector3(DX + e * 0.49 + 0.04, 1.6, -26.572), "shade"); blk(Vector3(DX + e * 0.49 - 0.06, 0, -26.6), Vector3(DX + e * 0.49 + 0.06, 0.12, -26.556), "stone")
		blk(Vector3(DX + e * 0.49 - 0.055, 1.54, -26.6), Vector3(DX + e * 0.49 + 0.055, 1.6, -26.56), "stone")
	for i in 9:
		var th := PI * (i + 0.5) / 9.0; var key := i == 4
		var vb := blk(Vector3(-0.04, -0.089, -0.014), Vector3(0.04 + (0.03 if key else 0.0), 0.089, 0.014 + (0.012 if key else 0.0)), "stone" if key else "shade")
		vb.position = Vector3(DX + cos(th) * 0.49, 1.6 + sin(th) * 0.49, -26.586); vb.rotation.z = th
	banner(Vector3(-14.3, 2.25, -26.585), 0.34, 1.15); banner(Vector3(-18.3, 2.25, -26.585), 0.34, 1.15)
	for wx in [-13.3, -17.5]: win_z(wx, 0.3, -26.6, 0.4, 0.9)
	statue_on("statue_veiled_mourning", Vector3(-19.05, 0, -20.5), 1.8, 0.8); statue_on("statue_veiled_praying", Vector3(-15.2, 0, -26.3), 1.8, 0.2)      # (the mourner stands in the corner of wall and rail)
	# the garden is railed on its two open sides like the courts: the north rail on either side of the way in, the east rail down to the south wall
	parapet(Vector3(-19.4, 0, -20.1), Vector3(-17.0, 0, -20.1)); parapet(Vector3(-15.6, 0, -20.1), Vector3(-12.6, 0, -20.1)); parapet(Vector3(-12.6, 0, -26.6), Vector3(-12.6, 0, -20.1))
	blk(Vector3(-12.67, 0.05, -20.17), Vector3(-12.53, 0.34, -20.03), "stone")      # the post of their corner
	plinth_head("kit_face5", Vector3(-19.0, 0, -26.25), 0.6)
	var gpool := pool(-14.4, -25.4, -13.2, -22.0); model("statue_veiled_kneeling", Vector3(-14.72, 0.06, -23.7), 1.1, PI * 0.5)
	cyl(Vector3(-14.72, 0, -23.7), 0.245, 0.235, 0.03, pal("shade"), 20); cyl(Vector3(-14.72, 0.03, -23.7), 0.2, 0.2, 0.03, pal("stone"), 20)      # she too stands on a foot of stone, a low one: she was set straight on the paving
	var lpi := 0
	for lp in [Vector3(-13.9, 0.021, -24.6), Vector3(-13.6, 0.021, -23.2), Vector3(-14.1, 0.021, -22.5)]:   # lily pads on the pool, in twos, one of each pair in bud
		lily(lp, 0.13, lp.z * 2.3, true); lily(lp + Vector3(0.19 * cos(lp.z * 1.7), 0, 0.19 * sin(lp.z * 1.7)), 0.085, lp.z * 5.1, false)
		gpool.set_shader_parameter("ring%d" % lpi, Vector3(lp.x, lp.z, 0.42)); lpi += 1      # a slow ring opens on the water round each pair
	lantern(Vector3(-14.9, 0, -20.62), 5, -1.0); cypress(Vector3(-13.0, 0, -26.2), 2.3)      # the lamp's paws stand clear of the north rail, the cypress of the east one
	blk(Vector3(MX + 0.1, 0, MZ - 0.45), Vector3(MX + 0.95, 0.004, MZ + 0.45), "shade"); blk(Vector3(MX + 0.15, 0, MZ - 0.4), Vector3(MX + 0.9, 0.006, MZ + 0.4), "stone")
	blk(Vector3(DX - 0.03, 0, -26.6), Vector3(DX + 0.03, 0.005, -25.2), "crim")
	slab(-20.5, -28.8, -12.5, -27.0, 0.0, "sand"); under(-20.5, -28.8, -12.5, -27.0, 0.22, "sand")
	tree(Vector3(-18.6, 0, -27.8), 1.5); tree(Vector3(-13.6, 0, -27.9), 1.35, "leaf3"); cypress(Vector3(-15.0, 0, -28.2), 2.9); cypress(Vector3(-17.4, 0, -28.3), 2.4)
	_crane_court()
	# ---- the sea around: colossi, ruins, vines, mist
	model("observer_veiled", Vector3(-31.0, WATER - 1.2, -27.0), 11.0, 0.75)
	model("kit_face5", Vector3(-4.5, WATER - 1.15, -23.7), 4.4, 0.7, Vector3(0.2, 0, -0.15))      # (as far behind the second court's back wall as it was before that court grew)
	model("kit_face2", Vector3(-10.0, WATER - 1.15, -4.2), 4.1, 0.5, Vector3(-0.15, 0, 0.12))
	# the fallen pediment off the first court: a broken gable with its cornice, dentils and rosette, and two drums of a
	# column beside it, lying half in the sea (props/pediment, made in Tripo; it was one plain prism)
	for m in thing("pediment", Vector3(5.3, WATER - 0.24, 5.95), 0.0, "stone:stone", 0.35, 2.7).find_children("*", "MeshInstance3D", true, false): (m as MeshInstance3D).cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	model("column_fallen", Vector3(-24.5, WATER - 0.25, -12.5), 0.6, 0.9)
	for cp in [Vector3(6.6, 0, -4.8), Vector3(7.6, 0, -6.0), Vector3(-4.6, 0, -9.2), Vector3(-9.0, 0, -17.4), Vector3(-10.2, 0, -18.4), Vector3(-22.6, 0, -8.8), Vector3(-23.6, 0, -19.6), Vector3(-9.0, 0, -24.4)]:
		cyl(Vector3(cp.x, -2.45, cp.z), 0.3, 0.3, 2.45 + WATER + 0.12, pal("shade"), 20)
		column(Vector3(cp.x, WATER + 0.12, cp.z), 2.6 + 0.9 * sin(cp.x * 3.0), 0.19, int(absf(cp.x * 10.0)) % 2 == 0)
		foam(cp.x - 0.3, cp.z - 0.3, cp.x + 0.3, cp.z + 0.3, 0.3)
	vine(-3.6, AZ1 - 0.08, true, 1.8); vine(3.52, -3.4, false, 1.4); vine(-3.2, -9.98, true, 1.6); vine(CX1 + 0.02, CZ0 + 0.8, false, 2.0)
	vine(-21.4, EZ1 + 0.02, true, 2.4); vine(-12.98, -16.4, false, 1.6); vine(-20.2, -19.98, true, 2.6); vine(-12.48, -25.6, false, 2.2)
	# crimson veils in the wind, mirrors, the tree of shards, reeds and rocks
	for sp in [[Vector3(-9.9, 2.92, 1.9), 2.6], [Vector3(0.0, 2.95, -3.9), 1.9], [Vector3(-16.3, WATER + 2.72, -18.4), 2.4], [Vector3(MX - 0.5, 3.12, MZ + 0.9), 2.2],
			[Vector3(6.6, WATER + 2.3, -4.8), 2.0], [Vector3(-10.2, WATER + 2.7, -18.4), 2.3], [Vector3(-22.6, WATER + 2.5, -8.8), 2.1], [Vector3(CX1 - 0.1, 1.75, CZ0 + 0.1), 1.8]]:
		streamer(sp[0], sp[1], 0.32)
		cyl(sp[0] + Vector3(0, -0.2, 0), 0.012, 0.012, 0.4, pal("dark"), 6)
	for lp in [Vector3(-17.9, 0, -16.5), Vector3(-14.7, 0, -16.5), Vector3(3.05, 0, -14.6) if COVERED else Vector3(-3.05, 0, -14.6)]: _look_add("", lp, 1.8, LOOK_LINES["mirror"])
	_look_add("", Vector3(-14.72, 0, -23.7), 1.1, LOOK_LINES["statue_veiled_kneeling"]); _look_add("", Vector3(-10.3, 0, -9.8), 1.7, ["broken, and not by the sea"])
	_look_add("", Vector3(2.99, 0, -1.5), 0.9, ["his tools, laid down in the middle of a stroke", "a small head: he tried her face on it first"])
	for i in 5:
		if i != 2: _look_add("", Vector3(MYPL.x, 0, MYPL.z + 0.9 * (i - 2)), 1.8, ["one of five. the fifth place is empty", "veiled, like all of them"])
	# the sculptor's steles: one in each court. His own words, and in them, sideways, what the court asks
	stele("stele_a", Vector3(-2.6, 0, -3.5), 0.0, ["I carved her five times for this row.\nFour of them stay where I put them.", "The fifth plinth I left for her.\nShe has only to stand as they stand."])
	stele("stele_c", Vector3(-3.03, 0, -11.45), PI * 0.5, ["I let the crossing fall,\nstone by stone, so that nothing\nof hers could reach the wheel.", "Still water forgets nothing.\nIt keeps the stones I took away."])
	stele("stele_e", Vector3(-21.88, 0, -12.6), PI * 0.5, ["I turned each of them to face where I chose.", "The water would not have it.\nIt shows them as they mean to stand."])
	stele("stele_f", Vector3(-18.3, 0, -26.32), 0.0, ["One mirror I could not\nbring myself to break. I gave it\na wall, and a cloth, and my back.", "A mirror keeps whatever it is shown.\nSo I showed it nothing."])
	stele("stele_k", Vector3(KX0 + 0.42, 0, -35.2), PI * 0.5, ["The key I gave to no one.\nI hung it where a hand of stone\ncannot close.", "I walled the door up from this side.\nI forgot the water\nhas a side of its own."])
	_look_add("", KISLE + Vector3(0.08, 0, 0), 1.5, ["her hand is open, and empty", "in the water the hand is not empty"])
	_look_add("kwall", Vector3(KDOOR_X, 0.3, WZ0), 1.6, ["a wall of plain stone", "in the water this wall has a door"])
	mirror_stand(Vector3(-17.9, 0, -16.5), 0.32); mirror_stand(Vector3(-14.7, 0, -16.5), -0.18); mirror_stand(Vector3(3.05, 0, -14.6) if COVERED else Vector3(-3.05, 0, -14.6), -PI * 0.5 if COVERED else PI * 0.5)
	shard_tree(Vector3(-13.7, 0, -20.9))
	reeds(Vector3(-2.35, 0, 6.4)); reeds(Vector3(4.4, 0, 3.0), 7); reeds(Vector3(-4.6, 0, -11.2)); reeds(Vector3(-12.2, 0, -10.0), 8); reeds(Vector3(-20.8, 0, -18.6)); reeds(Vector3(-11.8, 0, -21.6), 7)
	rock(Vector3(6.0, 0, 4.2), 1.2); rock(Vector3(6.9, 0, 3.6), 0.7); rock(Vector3(-6.4, 0, -7.2), 1.0); rock(Vector3(-24.2, 0, -13.2), 1.3); rock(Vector3(-10.8, 0, -22.8), 0.9); rock(Vector3(5.6, 0, -8.8), 1.0)
	for mp in [Vector3(6.5, WATER + 0.3, 8.5), Vector3(-13.0, WATER + 0.3, 3.5), Vector3(9.5, WATER + 0.4, -12.0), Vector3(-25.0, WATER + 0.3, -4.0),
			Vector3(-4.0, WATER + 0.4, -26.0), Vector3(-27.0, WATER + 0.3, -18.0), Vector3(-2.0, WATER + 0.2, 9.5), Vector3(-9.0, WATER + 0.3, -31.0)]:
		var mh := halo(11.0 + 2.0 * sin(mp.x), Color(mist_c.r, mist_c.g, mist_c.b, 0.14))
		(mh.material_override as StandardMaterial3D).blend_mode = BaseMaterial3D.BLEND_MODE_MIX
		mh.position = mp; add_child(mh)

## the way the crane's arm points (a unit vector on the ground) when it stands at its i-th place (-1: where it stands now)
func _crane_dir(i := -1) -> Vector3:
	var a := deg_to_rad(KANG[crane_i if i < 0 else i])
	return Vector3(cos(a), 0, sin(a))

## a toothed wheel lying flat: a disc and n square teeth round it
func _gear(parent: Node, r: float, n: int, h: float, p := "gold") -> void:
	cyl(Vector3.ZERO, r - 0.012, r - 0.012, h, pal(p), maxi(n, 16), parent)
	for i in n:
		var tb := blk(Vector3(-0.016, 0.0, -r * PI / n * 0.5), Vector3(0.016, h, r * PI / n * 0.5), p, parent)
		tb.position = Vector3(cos(TAU * i / n) * r, h * 0.5, sin(TAU * i / n) * r); tb.rotation.y = -TAU * i / n

## the crane: a round turntable with a toothed bronze rim, a mast, a long level arm with its brace and its counterweight,
## and under the arm, on two chains, a squared timber that hangs a hand above the water. All of it turns as one
func _crane(parent: Node) -> Node3D:
	var twin := parent == mroot
	var n := Node3D.new(); n.position = KPIV; n.rotation.y = -deg_to_rad(KANG[0]); parent.add_child(n)
	if FileAccess.file_exists("res://props/crane.glb"):      # (props/crane, made in Tripo: its turntable with a toothed bronze ring, mast, level arm, brace, windlass, counterweight in a sling)
		prop_model("crane", n, 0.0, 0.0, twin, false, "wood:wood,rope:rope,gold:gold,stone:stone,dark:dark").position.y = 0.05
	else:      # (without the model) a plain turntable, mast, arm, brace and counterweight
		var tt := Node3D.new(); tt.position = Vector3(0, 0.05, 0); n.add_child(tt)
		cyl(Vector3.ZERO, 0.4, 0.4, 0.05, pal("wood"), 28, tt)
		var gr := Node3D.new(); gr.position = Vector3(0, 0.05, 0); tt.add_child(gr); _gear(gr, 0.42, 48, 0.035)
		blk(Vector3(-0.1, 0.1, -0.1), Vector3(0.1, 3.05, 0.1), "wood", n)
		blk(Vector3(-0.9, 2.85, -0.08), Vector3(3.6, 3.02, 0.08), "wood", n)
		var br := blk(Vector3(-0.9, -0.05, -0.05), Vector3(0.9, 0.05, 0.05), "wood", n); br.position = Vector3(0.75, 2.2, 0); br.rotation.z = 0.72
		blk(Vector3(-1.05, 2.45, -0.2), Vector3(-0.65, 2.85, 0.2), "stone", n)
	# the timber and its chains
	var tm := blk(Vector3(BEAM_R0, 0.05, -0.15), Vector3(BEAM_R1, BEAM_TOP, 0.15), "wood", n)
	if twin:      # in the water it keeps a plain, deeper colour of its own: the haze of the world below would leave it pale as the water
		var um := StandardMaterial3D.new(); um.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED; um.cull_mode = BaseMaterial3D.CULL_DISABLED; um.albedo_color = Color("8f6a5c"); tm.material_override = um
	for bx in [BEAM_R0 + 0.3, BEAM_R1 - 0.3]:
		blk(Vector3(bx - 0.04, 0.045, -0.158), Vector3(bx + 0.04, BEAM_TOP + 0.006, 0.158), "gold", n)
		cyl(Vector3(bx, BEAM_TOP, 0), 0.012, 0.012, KJIB_Y - BEAM_TOP, pal("dark"), 6, n)
		var rg := TorusMesh.new(); rg.inner_radius = 0.022; rg.outer_radius = 0.04
		prim(rg, Vector3(bx, BEAM_TOP + 0.04, 0), pal("gold"), n).rotation.x = PI * 0.5
	return n

## K. the court of the crane. A pool that lies up to the foot of a plain north wall; in it an islet with a statue of
## her; at its east rim, on a round quay, a crane whose timber hangs over the water; a workbench; and beside the
## turntable the post of the crank that turns it. In the water the wall has a door, and the statue's hand holds a key
func _crane_court() -> void:
	# the way from the garden's door: over the strip behind its wall and a short bridge
	slab(DX - 0.6, KZ1, DX + 0.6, -28.8, 0.0); pier(DX, -30.1, -0.18, 0.7); pier(DX, -31.4, -0.18, 0.7)
	for e in [-1.0, 1.0]: blk(Vector3(DX + e * 0.54 - 0.03, 0, KZ1 + 0.03), Vector3(DX + e * 0.54 + 0.03, 0.06, -28.83), "shade")
	for jz in [-29.45, -30.1, -30.75, -31.4, -32.05]: blk(Vector3(DX - 0.51, 0, jz - 0.008), Vector3(DX + 0.51, 0.003, jz + 0.008), "shade")
	_pool_court(KX0, KZ0, KX1, KZ1, WX0, WZ0, WX1, WZ1, "stone", "PoolSky4", true)
	tile_hole = Rect2(WX0 - 0.08, WZ0 - 0.5, WX1 - WX0 + 0.16, WZ1 - WZ0 + 0.58); tiles(KX0, WZ0, KX1, KZ1, 1.0); tile_hole = Rect2()
	meander(KX0 + 0.55, WZ1 + 0.5, KX1 - 0.2, KZ1 - 0.2)
	var m0 := mroot.get_child_count()
	for both in [self, mroot]:
		var twin: bool = both == mroot
		# (in the water the wall keeps plain colours of its own, a little deeper than the stone above: the haze of the world
		# below would leave it a grey mass)
		var wb := func(a: Vector3, b: Vector3, p: String, par: Node) -> void:
			var mi := blk(a, b, p, par)
			if par == mroot:
				var um := StandardMaterial3D.new(); um.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED; um.cull_mode = BaseMaterial3D.CULL_DISABLED      # (mirrored things are wound the other way)
				um.albedo_color = Color({"stone": "d8ccb9", "shade": "b9ab98", "cream": "fff3d2"}.get(p, "d8ccb9")); mi.material_override = um
				mi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
		# the north wall, in courses of ashlar. Above the water it is whole; in the water it has a doorway
		wb.call(Vector3(KX0, 0, KZ0), Vector3(KDOOR_X - 0.5, KWALL_H, WZ0), "stone", both)
		wb.call(Vector3(KDOOR_X + 0.5, 0, KZ0), Vector3(KX1, KWALL_H, WZ0), "stone", both)
		wb.call(Vector3(KDOOR_X - 0.5, KDOOR_H, KZ0), Vector3(KDOOR_X + 0.5, KWALL_H, WZ0), "stone", both)
		wb.call(Vector3(KX0 - 0.045, KWALL_H, KZ0 - 0.045), Vector3(KX1 + 0.045, KWALL_H + 0.06, WZ0 + 0.045), "shade", both)
		var nc := int((KX1 - KX0 - 0.25) / 0.31)
		for i in nc + 1:
			var cx := lerpf(KX0 + 0.15, KX1 - 0.1, float(i) / nc)
			wb.call(Vector3(cx - 0.065, KWALL_H + 0.06, WZ0 - 0.095), Vector3(cx + 0.065, KWALL_H + 0.177, WZ0 + 0.035), "stone", both)
		for r in 5:
			var y0 := 0.52 * r
			if r > 0:
				for seg in [[KX0, KDOOR_X - 0.5], [KDOOR_X + 0.5, KX1]]: wb.call(Vector3(seg[0], y0 - 0.006, WZ0), Vector3(seg[1], y0 + 0.006, WZ0 + 0.004), "shade", both)
				if r == 4: wb.call(Vector3(KDOOR_X - 0.5, y0 - 0.006, WZ0), Vector3(KDOOR_X + 0.5, y0 + 0.006, WZ0 + 0.004), "shade", both)
			var jx := KX0 + 0.5 + (0.52 if r % 2 == 1 else 0.0)
			while jx < KX1 - 0.2:      # the upright joints, each course half a stone off the one below
				if absf(jx - KDOOR_X) > 0.5 or r == 4:
					wb.call(Vector3(jx - 0.006, y0, WZ0), Vector3(jx + 0.006, minf(y0 + 0.52, KWALL_H), WZ0 + 0.004), "shade", both)
				jx += 1.04
		wb.call(Vector3(KDOOR_X - 0.47, 0, KZ0 + 0.02), Vector3(KDOOR_X + 0.47, KDOOR_H, KZ0 + 0.04), "cream", both)      # the light behind the door
		# the crane's quay, and the islet with its drum
		cyl(KPIV, KQUAY, KQUAY, 0.05, pal("stone", "flat2" if twin else "flat"), 44, both)
		cyl(KPIV + Vector3(0, 0.05, 0), 0.5, 0.5, 0.012, pal("shade", "flat2" if twin else "flat"), 32, both)
		cyl(KISLE, 0.57, 0.55, 0.07, pal("stone", "flat2" if twin else "flat"), 28, both)
		round_plinth(KISLE + Vector3(0.08, 0.07, 0), both)
		var ist := her_statue(KISLE + Vector3(0.08, 0.24, 0), -PI * 0.5, "point", 0.8, both)
		if not twin:      # where its pointing hand is: in the water a key hangs from it
			kkey_top = KISLE + Vector3(-0.42, 1.2, 0)
			var isk := ist.find_children("*", "Skeleton3D", true, false)
			if not isk.is_empty() and _bone(isk[0], "RightHand") >= 0:
				var hp: Vector3 = (isk[0] as Skeleton3D).global_transform * (isk[0] as Skeleton3D).get_bone_global_pose(_bone(isk[0], "RightHand")).origin
				kkey_top = hp + Vector3(-0.06, -0.05, 0)
		var cn := _crane(both)
		if twin: crane_m = cn
		else: crane_n = cn
	# above the water only: the stone that closes the doorway, of the wall's own courses (it cannot be told from the wall)
	kplug = Node3D.new(); kplug.position = Vector3(KDOOR_X, 0, 0); add_child(kplug)
	blk(Vector3(-0.5, 0, KZ0 + 0.06), Vector3(0.5, KDOOR_H, WZ0), "stone", kplug)
	for r in range(1, 4): blk(Vector3(-0.5, 0.52 * r - 0.006, WZ0), Vector3(0.5, 0.52 * r + 0.006, WZ0 + 0.004), "shade", kplug)
	for r in 4:
		var jx2 := KX0 + 0.5 + (0.52 if r % 2 == 1 else 0.0)
		while jx2 < KX1 - 0.2:
			if absf(jx2 - KDOOR_X) <= 0.5: blk(Vector3(jx2 - KDOOR_X - 0.006, 0.52 * r, WZ0), Vector3(jx2 - KDOOR_X + 0.006, 0.52 * r + 0.52, WZ0 + 0.004), "shade", kplug)
			jx2 += 1.04
	# in the water only: the door in its frame, and the key that hangs from the statue's hand on a red ribbon
	for e in [-1.0, 1.0]: blk(Vector3(KDOOR_X + e * 0.53 - 0.045, 0, WZ0), Vector3(KDOOR_X + e * 0.53 + 0.045, KDOOR_H + 0.05, WZ0 + 0.05), "dark", mroot)
	blk(Vector3(KDOOR_X - 0.62, KDOOR_H + 0.05, WZ0), Vector3(KDOOR_X + 0.62, KDOOR_H + 0.17, WZ0 + 0.06), "gold", mroot)
	var stp := blk(Vector3(KDOOR_X - 0.6, 0, WZ0), Vector3(KDOOR_X + 0.6, BEAM_TOP, WZ0 + KSTEP), "stone", mroot)      # and its step: the timber comes to its edge
	var sm := StandardMaterial3D.new(); sm.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED; sm.cull_mode = BaseMaterial3D.CULL_DISABLED; sm.albedo_color = Color("c3b5a1"); stp.material_override = sm
	kdoor_m = Node3D.new(); kdoor_m.position = Vector3(KDOOR_X - 0.47, 0, WZ0 - 0.035); mroot.add_child(kdoor_m)
	var leaf := blk(Vector3(0, 0, -0.03), Vector3(0.94, KDOOR_H, 0.03), "crim", kdoor_m)
	var lm := StandardMaterial3D.new(); lm.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED; lm.cull_mode = BaseMaterial3D.CULL_DISABLED; lm.albedo_color = Color("c2333d"); leaf.material_override = lm
	var gm := StandardMaterial3D.new(); gm.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED; gm.cull_mode = BaseMaterial3D.CULL_DISABLED; gm.albedo_color = Color("d79a2f")
	for py in [0.25, 1.15]:
		for px in [0.1, 0.52]:
			var pn := blk(Vector3(px, py, 0.03), Vector3(px + 0.32, py + 0.7, 0.04), "crim2", kdoor_m)
			var pm2: StandardMaterial3D = lm.duplicate(); pm2.albedo_color = Color("d84a52"); pn.material_override = pm2
	for q in [blk(Vector3(0.02, 0.0, 0.03), Vector3(0.92, 0.12, 0.045), "gold", kdoor_m), blk(Vector3(0.74, 0.92, 0.03), Vector3(0.88, 1.16, 0.05), "gold", kdoor_m)]: (q as MeshInstance3D).material_override = gm
	_strip_refl(mroot, m0, "mir", 0.3)
	kribbon = Node3D.new(); kribbon.position = kkey_top; mroot.add_child(kribbon)
	var rb := blk(Vector3(-0.012, -0.3, -0.004), Vector3(0.012, 0.0, 0.004), "crim", kribbon)
	var rm2: StandardMaterial3D = lm.duplicate(); rm2.albedo_color = Color("d23a44"); rb.material_override = rm2
	kkey = Node3D.new(); kkey.name = "Key"; add_child(kkey); kkey.position = Vector3(kkey_top.x, -(kkey_top.y - 0.5), kkey_top.z); kkey.rotation.z = PI * 0.5      # (in the water it hangs upside down: its ring, at the ribbon, is the deeper end)
	khalo = halo(2.6, Color(1.0, 0.86, 0.6, 0.5)); khalo.position = Vector3(KDOOR_X, 1.0, WZ0 + 0.1); khalo.scale = Vector3.ONE * 0.001; khalo.visible = false; add_child(khalo)
	if OS.get_environment("KI") != "":      # (stills) the crane as it stands at another of its places
		crane_i = int(OS.get_environment("KI"))
		crane_n.rotation.y = -deg_to_rad(KANG[crane_i]); crane_m.rotation.y = crane_n.rotation.y
	if FileAccess.file_exists("res://props/key.glb"):      # (props/key: as made it lies flat, its ring toward -x)
		var km := prop_model("key", kkey, 0.0, 0.0, false, false, "gold:gold,crim:crim"); km.scale = Vector3.ONE * 1.45; km.position = Vector3(0, -0.03, 0)
		for q in km.find_children("*", "MeshInstance3D", true, false): (q as MeshInstance3D).material_override = gm; (q as MeshInstance3D).cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	else:
		var k1 := cyl(Vector3(0, -0.2, 0), 0.014, 0.014, 0.2, gm, 8, kkey); k1.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
		var kt := TorusMesh.new(); kt.inner_radius = 0.03; kt.outer_radius = 0.055
		prim(kt, Vector3(0, 0.05, 0), gm, kkey).rotation.x = PI * 0.5
		blk(Vector3(0.0, -0.2, -0.006), Vector3(0.06, -0.13, 0.006), "gold", kkey).material_override = gm
	var wq := QuadMesh.new(); wq.size = Vector2(WX1 - WX0, WZ1 - WZ0); wq.orientation = PlaneMesh.FACE_Y
	var g4 := ShaderMaterial.new(); g4.shader = shaders["glass"]; timed.append(g4)
	g4.set_shader_parameter("lost_a", 0.0); g4.set_shader_parameter("blur_px", 0.6); g4.set_shader_parameter("lod", 0.0)
	prim(wq, Vector3((WX0 + WX1) * 0.5, 0.012, (WZ0 + WZ1) * 0.5), g4).cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	# the ledge that comes out of the wall's foot when the door opens: six stones, drawn back into the wall until then
	for i in 6:
		var lx0 := WX0 + 0.55 * i
		var st := Node3D.new(); st.position = Vector3(0, 0, -0.66); add_child(st)
		blk(Vector3(lx0 + 0.012, -0.05, WZ0 - 0.02), Vector3(lx0 + 0.538, 0.045, WZ0 + 0.6), "stone", st)
		blk(Vector3(lx0 + 0.012, -0.1, WZ0 - 0.02), Vector3(lx0 + 0.538, -0.05, WZ0 + 0.63), "shade", st)
		kledge.append(st)
	# the crank post beside the turntable: a stone foot, a bronze shaft with a small wheel in the turntable's teeth, and a
	# square head for the crank. The crank itself lies on the workbench until she brings it
	turned(KPOST, [[0.14, 0.05], [0.14, 0.1], [0.1, 0.13], [0.085, 0.16], [0.0, 0.16]], "stone", 16)
	kpin = Node3D.new(); kpin.position = KPOST; add_child(kpin)
	var pg := Node3D.new(); pg.position = Vector3(0, 0.2, 0); kpin.add_child(pg); _gear(pg, 0.25, 16, 0.05)      # its wheel reaches over the turntable's rim to the toothed ring
	cyl(Vector3(0, 0.1, 0), 0.03, 0.03, 0.84, pal("gold"), 10, kpin)
	blk(Vector3(-0.035, 0.94, -0.035), Vector3(0.035, 1.02, 0.035), "gold", kpin)
	kcrank = Node3D.new(); kcrank.position = Vector3(0, 0.955, 0); kpin.add_child(kcrank); kcrank.visible = false
	var ck := _crank_handle(kcrank); ck.rotation.x = -PI * 0.5; ck.position = Vector3(0, 0, 0.046)      # on the post it lies level: its socket over the square head, its grip standing up
	# the workbench in the south-west corner, the crank on it
	thing("workbench", KBENCH, 0.8, "wood:wood,stone:marble,gold:gold,dark:dark", 0.0)
	kcrank_bench = _crank_handle(self); kcrank_bench.position = KBENCH + Vector3(float(OS.get_environment("KB_X")) if OS.get_environment("KB_X") != "" else 0.05, float(OS.get_environment("KB_Y")) if OS.get_environment("KB_Y") != "" else 0.82, float(OS.get_environment("KB_Z")) if OS.get_environment("KB_Z") != "" else 0.25); kcrank_bench.rotation = Vector3(0, 0.6, 0)
	# rails on the three open sides, the way in between two posts
	parapet(Vector3(KX0 + 0.1, 0, WZ0 + 0.1), Vector3(KX0 + 0.1, 0, KZ1 - 0.1)); parapet(Vector3(KX0 + 0.1, 0, KZ1 - 0.1), Vector3(DX - 0.75, 0, KZ1 - 0.1))
	parapet(Vector3(DX + 0.75, 0, KZ1 - 0.1), Vector3(KX1 - 0.1, 0, KZ1 - 0.1)); parapet(Vector3(KX1 - 0.1, 0, WZ0 + 0.1), Vector3(KX1 - 0.1, 0, KZ1 - 0.1))
	for px in [DX - 0.75, DX + 0.75]: blk(Vector3(px - 0.07, 0.05, KZ1 - 0.17), Vector3(px + 0.07, 0.34, KZ1 - 0.03), "stone")
	lantern(Vector3(KX0 + 0.75, 0, KZ1 - 0.62), 6, 1.0); cypress(Vector3(KX1 - 0.5, 0, WZ0 + 0.45), 2.2)
	urn(Vector3(KX1 - 0.55, 0, WZ0 + 1.2), 1.0); urn(Vector3(KX1 - 0.8, 0, WZ0 + 1.05), 0.7, "rose")

## the crank: a square bronze socket, a bronze arm, and a turned wooden grip standing at its end
func _crank_handle(parent: Node) -> Node3D:
	var n := Node3D.new(); parent.add_child(n)
	if FileAccess.file_exists("res://props/crank.glb"):
		prop_model("crank", n, 0.0, 0.0, false, false, "gold:gold,wood:wood,dark:dark")
	else:
		blk(Vector3(-0.045, -0.03, -0.045), Vector3(0.045, 0.03, 0.045), "gold", n)
		blk(Vector3(0.0, -0.014, -0.02), Vector3(0.3, 0.014, 0.02), "gold", n)
		cyl(Vector3(0.28, 0.0, 0), 0.022, 0.026, 0.13, pal("wood"), 10, n)
	return n

func _actors() -> void:
	var veil := cloth(Color("f1f1f4"), Color("dcdce4"))
	var face := ShaderMaterial.new(); face.shader = shaders["face"]; timed.append(face)
	face_m = face; veil_m = veil
	fig = Fig.new(); add_child(fig); fig.set_style(hero_style); fig.build(0, pal, veil, face)
	var wm := Node3D.new(); wm.transform = Transform3D(Basis(Vector3(1, 0, 0), Vector3(0, -1, 0), Vector3(0, 0, 1)), Vector3(0, 2.0 * WATER, 0)); add_child(wm)
	wfig = Fig.new(); wm.add_child(wfig); wfig.set_style(hero_style); wfig.build(2, pal, veil, face)
	var mir := Node3D.new()
	mir.transform = Transform3D(Basis(Vector3(-1, 0, 0), Vector3(0, 1, 0), Vector3(0, 0, 1)), Vector3(2.0 * MX, 0, 0))
	add_child(mir)
	ghost = Fig.new(); mir.add_child(ghost); ghost.set_style(hero_style); ghost.build(1, pal, veil, face)
	var bq := QuadMesh.new(); bq.size = Vector2(0.95, 0.95); bq.orientation = PlaneMesh.FACE_Y
	var g := Gradient.new(); g.offsets = PackedFloat32Array([0.0, 0.55, 1.0])
	g.colors = PackedColorArray([Color(0.2, 0.17, 0.33, 0.36), Color(0.2, 0.17, 0.33, 0.2), Color(0.2, 0.17, 0.33, 0)])
	var gt := GradientTexture2D.new(); gt.gradient = g; gt.fill = GradientTexture2D.FILL_RADIAL
	gt.fill_from = Vector2(0.5, 0.5); gt.fill_to = Vector2(1.0, 0.5); gt.width = 96; gt.height = 96
	var bmt := StandardMaterial3D.new(); bmt.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED; bmt.albedo_texture = gt
	bmt.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	blob = prim(bq, Vector3.ZERO, bmt)
	var pq := QuadMesh.new(); pq.size = Vector2(7, 7); pq.orientation = PlaneMesh.FACE_Y
	pulse = prim(pq, Vector3.ZERO, ring_mat(Vector3(1.0, 0.8, 0.45)))
	var tq := QuadMesh.new(); tq.size = Vector2(1.1, 1.1); tq.orientation = PlaneMesh.FACE_Y
	tapring = prim(tq, Vector3.ZERO, ring_mat(Vector3(1.0, 0.9, 0.7)))
	var uq := QuadMesh.new(); uq.size = Vector2(2.4, 2.4); uq.orientation = PlaneMesh.FACE_Y
	var wq2 := QuadMesh.new(); wq2.size = Vector2(1.5, 1.5); wq2.orientation = PlaneMesh.FACE_Y
	refl_ring = prim(wq2, Vector3(0, -50, 0), ring_mat(Vector3(0.78, 0.94, 1.0)))      # the answer to a tap on still water: a pale ripple where her reflection will go
	usering = prim(uq, Vector3(0, -50, 0), ring_mat(Vector3(1.0, 0.74, 0.3)))      # the answer to a tap on a thing that can be used: a wide gold ripple at its foot
	lamp = Node3D.new(); add_child(lamp); lamp.position = Vector3(0, -50, 0); lamp.visible = false; lamp_energy = 0.0
	ball(Vector3.ZERO, 0.055, mat(Color("ffd98a")), lamp)
	cyl(Vector3(0, 0.055, 0), 0.07, 0.01, 0.055, pal("gold"), 16, lamp); cyl(Vector3(0, -0.082, 0), 0.04, 0.055, 0.028, pal("gold"), 16, lamp)
	var ring := TorusMesh.new(); ring.inner_radius = 0.02; ring.outer_radius = 0.031
	prim(ring, Vector3(0, 0.14, 0), pal("gold"), lamp).rotation.x = PI * 0.5
	lamp_halo = halo(1.0, Color(1.0, 0.78, 0.42, 0.55)); lamp.add_child(lamp_halo)
	door_halo = halo(3.2, Color(1.0, 0.86, 0.6, 0.5)); door_halo.position = Vector3(DX, 1.0, -26.7); add_child(door_halo)
	# gulls: two swept wings with grey tips and a small body, so that from above each reads as a bird (they were two plain
	# white strips, which read as scraps of paper over the scene)
	var gwm := StandardMaterial3D.new(); gwm.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED; gwm.albedo_color = Color(0.98, 0.97, 0.95); gwm.cull_mode = BaseMaterial3D.CULL_DISABLED
	var gtm: StandardMaterial3D = gwm.duplicate(); gtm.albedo_color = Color(0.5, 0.53, 0.64)
	for i in 3:
		var gn := Node3D.new(); add_child(gn)
		for sgn in [-1.0, 1.0]:
			var wn2 := Node3D.new(); gn.add_child(wn2)
			var r0 := Vector3(0, 0, 0.06); var r1 := Vector3(0, 0, -0.05); var m0 := Vector3(sgn * 0.17, 0, 0.085); var m1 := Vector3(sgn * 0.17, 0, -0.015)
			var t0 := Vector3(sgn * 0.3, 0, 0.02); var t1 := Vector3(sgn * 0.29, 0, -0.05); var tip := Vector3(sgn * 0.39, 0, -0.07)
			for part in [[[r0, m0, m1, r0, m1, r1, m0, t0, t1, m0, t1, m1], gwm], [[t0, tip, t1], gtm]]:
				var ga2 := []; ga2.resize(Mesh.ARRAY_MAX); ga2[Mesh.ARRAY_VERTEX] = PackedVector3Array(part[0])
				var gam := ArrayMesh.new(); gam.add_surface_from_arrays(Mesh.PRIMITIVE_TRIANGLES, ga2)
				prim(gam, Vector3.ZERO, part[1], wn2)
		var gb := []; gb.resize(Mesh.ARRAY_MAX)
		gb[Mesh.ARRAY_VERTEX] = PackedVector3Array([Vector3(0, 0.004, 0.14), Vector3(0.036, 0.004, 0.03), Vector3(-0.036, 0.004, 0.03), Vector3(0.036, 0.004, 0.03), Vector3(0.03, 0.004, -0.1), Vector3(-0.03, 0.004, -0.1), Vector3(0.036, 0.004, 0.03), Vector3(-0.03, 0.004, -0.1), Vector3(-0.036, 0.004, 0.03), Vector3(0.03, 0.004, -0.1), Vector3(0.0, 0.004, -0.17), Vector3(-0.03, 0.004, -0.1)])
		var gbm := ArrayMesh.new(); gbm.add_surface_from_arrays(Mesh.PRIMITIVE_TRIANGLES, gb)
		prim(gbm, Vector3.ZERO, gwm, gn)
		gulls.append(gn)
	ghost_flat = StandardMaterial3D.new(); ghost_flat.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	ghost_flat.cull_mode = BaseMaterial3D.CULL_DISABLED; ghost_flat.albedo_color = Color("b8232f")
	if hero_real:
		H["main"] = spawn_her(self, "tex"); H["refl"] = spawn_her(wm, "crim"); H["ghost"] = spawn_her(mir, "flat")
		if mroot != null and rig_file != "": H["mir"] = spawn_her(mroot, "mirror")
		for k in H:
			var sk: Skeleton3D = H[k].sk
			if sk != null:
				var hm := HerMod.new(); hm.main = self; sk.add_child(hm)
			if H[k].ap != null: H[k].ap.play("idle")
		fig.visible = false; wfig.visible = false
	if shape_file != "":
		SHP["main"] = spawn_shape(self, "main"); SHP["refl"] = spawn_shape(wm, "crim"); SHP["ghost"] = spawn_shape(mir, "flat")
		fig.visible = false; wfig.visible = false
	_things()
	for k in objs:
		var n := Node3D.new(); add_child(n); n.position = objs[k].at + Vector3(0, 0.55 if k != "mirror" else 1.35, 0)
		var quiet: bool = k in QUIET      # these give themselves away only when she is near: a small gold mark
		if k in NOMARK or not objs[k].get("mark", true):      # nothing floats over a turning statue (the place is kept: a tap up there still counts as a tap on it)
			markers[k] = n; continue
		var d := blk(Vector3(-0.05, -0.05, -0.05), Vector3(0.05, 0.05, 0.05), "crim", n)
		d.material_override = mat(Color("ffd36b") if quiet else Color("ff5a62")); d.rotation = Vector3(0.6155, PI * 0.25, 0)
		if quiet: d.scale = Vector3.ONE * 0.8
		var h := halo(0.5, Color(1.0, 0.82, 0.45, 0.5) if quiet else Color(1.0, 0.4, 0.42, 0.5)); n.add_child(h)
		if quiet: n.scale = Vector3.ONE * 0.001
		markers[k] = n

## the things to tap
func _things() -> void:
	if SHOW_CAPSTAN: objs["capstan"] = {"at": CAP + Vector3(0, 0.9, 0), "stand": CAP + Vector3(0, 0, 0.66)}   # the old capstan is gone, and its red mark with it
	objs["mirror"] = {"at": Vector3(MX, 1.2, MZ), "stand": Vector3(MX + 0.52, 0, MZ), "hits": [Vector3(MX, 0.2, MZ), Vector3(MX, 1.2, MZ)]}
	objs["plinth"] = {"at": MYPL + Vector3(0, 0.45, 0), "stand": MYPL + Vector3(0.75, 0, 0), "hits": [MYPL + Vector3(0, 0.05, 0), MYPL + Vector3(0, 0.45, 0)]}      # her own empty plinth (first puzzle)
	objs["winch"] = {"at": PED + Vector3(-WINCH_HUB.x, WINCH_HUB.y, 0) * WINCH_K, "stand": Vector3(CROSS_X, 0, QZ1 + 0.39), "hits": [PED + Vector3(0, 0.15, 0), PED + Vector3(0, WINCH_HUB.y * WINCH_K, 0), PED + Vector3(-WINCH_HUB.x, WINCH_HUB.y, 0) * WINCH_K]}   # the wheel in the water (second puzzle)
	for i in 3: objs["turn%d" % (i + 1)] = {"at": TURN_AT[i] + Vector3(0, 1.88, 0), "stand": TURN_AT[i] + Vector3(TURN_STAND, 0, 0), "hits": [TURN_AT[i] + Vector3(0, 0.12, 0), TURN_AT[i] + Vector3(0, 1.88, 0)]}   # (its mark floats 0.55 above "at": clear of the statue's head)
	# the fourth puzzle: the workbench with the crank on it, the crank post of the crane, and in the water the key and the door
	objs["bench"] = {"at": KBENCH + Vector3(0, 0.8, 0), "stand": KBENCH + Vector3(0, 0, -0.72), "hits": [KBENCH + Vector3(0, 0.3, 0), KBENCH + Vector3(0, 0.8, 0)]}
	objs["crane"] = {"at": KPOST + Vector3(0, 1.0, 0), "stand": KPOST + Vector3(-0.47, 0, 0.3), "hits": [KPOST + Vector3(0, 0.2, 0), KPOST + Vector3(0, 1.0, 0), KPIV + Vector3(0, 1.3, 0), KPIV + Vector3(0, 2.7, 0)]}
	objs["wkey"] = {"at": Vector3(kkey_top.x, -(kkey_top.y - 0.45), kkey_top.z), "stand": KPIV + _crane_dir() * KSTAND, "hits": [Vector3(kkey_top.x, -(kkey_top.y - 0.05), kkey_top.z), Vector3(kkey_top.x, -(kkey_top.y - 0.6), kkey_top.z)]}
	objs["wdoor"] = {"at": Vector3(KDOOR_X, -1.0, WZ0), "stand": KPIV + _crane_dir() * KSTAND, "hits": [Vector3(KDOOR_X, -0.25, WZ0), Vector3(KDOOR_X, -1.9, WZ0)]}

func _nav() -> void:
	for r in [["A", AX0 + 0.85, -3.15, 3.15, AZ1 - 0.35], ["S", 3.15, 0.7, 4.6, 1.3], ["B1", -0.25, -5.8, 0.25, -3.15], ["Bg", -0.25, -7.8, 0.25, -5.8], ["B2", -0.25, -10.35, 0.25, -7.8],
			["C", -2.65, -11.3, CX1 - 0.5, -10.35], ["Cl", -2.65, CZ0 + 0.75, -1.6, -10.35], ["Cs", -2.65, CZ0 + 0.75, CX1 - 0.5, QZ0 - 0.3], ["Ce", QX1 + 0.3, CZ0 + 0.75, CX1 - 0.5, -10.35],      # round the pool, not over it
			 ["Cw", -4.2, -13.25, -2.65, -12.75], ["BR", -7.6, -13.25, -4.2, -12.75], ["D", -13.35, -13.25, -7.6, -12.75],
			["E", -21.2, -10.75, -13.33, -10.64], ["Ee", -13.65, -15.9, -13.33, -10.05], ["Es", -21.1, -15.9, -13.33, -15.08], ["Em", -16.32, -15.1, -13.5, -14.05], ["Ew", -21.5, -15.5, -21.05, -10.6],
			["T1", -19.34, -15.1, -19.2, -14.3], ["T2", -17.84, -15.1, -17.7, -14.3], ["T3", -16.34, -15.1, -16.2, -14.3], ["G1", -16.55, -20.35, -16.05, -15.88], ["F", -18.9, -26.2, -15.0, -20.35], ["G", DX - 0.2, KZ1 - 0.4, DX + 0.2, -26.2],
			["Ks", KX0 + 0.5, WZ1 + 0.35, KX1 - 0.5, KZ1 + 0.3], ["Kw", KX0 + 0.5, WZ0 + 0.3, KPIV.x - 0.78, KZ1 + 0.3], ["Ke", WX1 + 0.35, WZ0 + 0.5, KX1 - 0.5, KZ1 + 0.3],      # the crane's court: round its pool
			["Kpn", KPIV.x - 0.78, KPIV.z - 1.0, KPIV.x + 1.06, KPIV.z - 0.78], ["Kps", KPIV.x - 0.78, KPIV.z + 0.78, KPIV.x + 1.06, KPIV.z + 1.0], ["Kpe", KPIV.x + 0.78, KPIV.z - 1.0, KPIV.x + 1.06, KPIV.z + 1.0],      # its quay: round the mast
			["Kl", KPIV.x - 1.1, WZ0 + 0.18, KDOOR_X + 0.3, WZ0 + 0.42], ["Kd", KDOOR_X - 0.15, KZ0 - 1.2, KDOOR_X + 0.15, WZ0 + 0.42]]:      # the ledge and the doorway (shut until the door opens)
		rects[r[0]] = {"x0": r[1], "z0": r[2], "x1": r[3], "z1": r[4], "on": true}
	rects["BR"].on = false; rects["G"].on = false; rects["G1"].on = false; rects["Kl"].on = false; rects["Kd"].on = false
	for i in 5: solids.append(Vector3(MYPL.x, MYPL.z + 0.9 * (i - 2), 0.5))      # the row of plinths of the first court
	solids.append(Vector3(1.45, -3.0, 0.32))      # the urn by its gate
	solids.append(Vector3(2.86, -3.25, 0.66)); solids.append(Vector3(2.27, -2.6, 0.3)); solids.append(Vector3(2.99, -1.5, 0.5))      # the sculptor's block in its scaffold, and the ladder: she could walk through both
	if hand_play:      # played by hand, the first two courts are shut until their puzzles are solved
		gate_a.position.y = 0.0; gate_c.position.y = 0.0
		rects["B1"].on = false; rects["Cw"].on = false
	else: done["plinth"] = true; done["winch"] = true      # in the scripted runs and the stills these are not things to tap
	solids.append(Vector3(KPIV.x, KPIV.z, 0.76)); solids.append(Vector3(KPOST.x, KPOST.z, 0.3)); solids.append(Vector3(KBENCH.x, KBENCH.z, 0.55))      # the crane's turntable with its crank post, and the workbench
	if OS.get_environment("START") == "K":      # (to try the fourth court by hand) she begins on the bridge to it, the garden's door open behind her
		pos = Vector3(DX, 0, -30.4); yaw = PI; cam_t = pos; rects["G"].on = true; done["mirror"] = true; door.position.y -= 2.15

## floor she may stand on: inside a walkable area that is open, and not in a lamp stand
func _walkable(p: Vector3) -> bool:
	for b in blockers:
		if Vector2(p.x - b.x, p.z - b.y).length() < 0.34: return false
	for b in solids:
		if Vector2(p.x - b.x, p.z - b.y).length() < b.z: return false
	for n in rects:
		if rects[n].on and in_rect(rects[n], p): return true
	return false

func in_rect(r: Dictionary, p: Vector3, m := 0.0) -> bool:
	return p.x >= r.x0 - m and p.x <= r.x1 + m and p.z >= r.z0 - m and p.z <= r.z1 + m

func rect_of(p: Vector3) -> String:
	for m in [0.0, 0.12, 0.4]:
		for n in rects:
			if rects[n].on and in_rect(rects[n], p, m): return n
	return ""

func portal(a: Dictionary, b: Dictionary):
	var x0 := maxf(a.x0, b.x0); var x1 := minf(a.x1, b.x1); var z0 := maxf(a.z0, b.z0); var z1 := minf(a.z1, b.z1)
	if x1 - x0 < -0.02 or z1 - z0 < -0.02: return null
	if maxf(x1 - x0, z1 - z0) < 0.1: return null
	return [x0, z0, maxf(x1, x0), maxf(z1, z0)]

func find_path(from: Vector3, to: Vector3) -> Array:
	var a := rect_of(from); var b := rect_of(to)
	if a == "" or b == "": return []
	var prev := {a: ""}
	var q := [a]
	while not q.is_empty() and not prev.has(b):
		var c: String = q.pop_front()
		for n in rects:
			if rects[n].on and not prev.has(n) and portal(rects[c], rects[n]) != null:
				prev[n] = c; q.append(n)
	if not prev.has(b): return []
	var chain := [b]
	while prev[chain[0]] != "": chain.push_front(prev[chain[0]])
	var pts := []
	var cur := from
	for i in range(chain.size() - 1):
		var pr: Array = portal(rects[chain[i]], rects[chain[i + 1]])
		var mid := cur.lerp(to, 0.5)
		var pt := Vector3(clampf(mid.x, pr[0], pr[2]), 0, clampf(mid.z, pr[1], pr[3]))
		pts.append(pt); cur = pt
	pts.append(Vector3(to.x, 0, to.z))
	return pts

func _ui() -> void:
	var cl := CanvasLayer.new(); add_child(cl)
	var vg := Gradient.new(); vg.offsets = PackedFloat32Array([0.0, 0.62, 1.0])
	vg.colors = PackedColorArray([Color(0.05, 0.06, 0.14, 0), Color(0.05, 0.06, 0.14, 0), Color(0.05, 0.06, 0.14, 0.3)])
	var vt := GradientTexture2D.new(); vt.gradient = vg; vt.fill = GradientTexture2D.FILL_RADIAL
	vt.fill_from = Vector2(0.5, 0.5); vt.fill_to = Vector2(1.05, 0.5); vt.width = 128; vt.height = 128
	var vr := TextureRect.new(); vr.texture = vt; vr.stretch_mode = TextureRect.STRETCH_SCALE; vr.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	vr.set_anchors_preset(Control.PRESET_FULL_RECT); vr.mouse_filter = Control.MOUSE_FILTER_IGNORE; cl.add_child(vr)
	for i in 3:
		var rg2 := Gradient.new(); rg2.offsets = PackedFloat32Array([0.0, 0.5, 1.0])
		rg2.colors = PackedColorArray([Color(1, 0.93, 0.78, 0), Color(1, 0.93, 0.78, 0.085 - 0.015 * i), Color(1, 0.93, 0.78, 0)])
		var rt := GradientTexture2D.new(); rt.gradient = rg2; rt.fill_from = Vector2(0, 0); rt.fill_to = Vector2(1, 0); rt.width = 64; rt.height = 8
		var ray := TextureRect.new(); ray.texture = rt; ray.stretch_mode = TextureRect.STRETCH_SCALE; ray.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
		ray.size = Vector2(190 + 70 * i, 2600); ray.position = Vector2(430 - 250 * i, -500); ray.rotation = 0.42
		var cm := CanvasItemMaterial.new(); cm.blend_mode = CanvasItemMaterial.BLEND_MODE_ADD; ray.material = cm
		ray.mouse_filter = Control.MOUSE_FILTER_IGNORE; cl.add_child(ray)
	var sg := Gradient.new(); sg.offsets = PackedFloat32Array([0.0, 0.5, 1.0])
	sg.colors = PackedColorArray([Color(1.0, 0.9, 0.74, 0.22), Color(1.0, 0.86, 0.72, 0.08), Color(1.0, 0.86, 0.72, 0)])
	var sgt := GradientTexture2D.new(); sgt.gradient = sg; sgt.fill = GradientTexture2D.FILL_RADIAL; sgt.fill_from = Vector2(0.5, 0.5); sgt.fill_to = Vector2(1.0, 0.5); sgt.width = 128; sgt.height = 128
	var sun := TextureRect.new(); sun.texture = sgt; sun.stretch_mode = TextureRect.STRETCH_SCALE; sun.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	sun.size = Vector2(1300, 1300); sun.position = Vector2(180, -560)
	var scm := CanvasItemMaterial.new(); scm.blend_mode = CanvasItemMaterial.BLEND_MODE_ADD; sun.material = scm; sun.mouse_filter = Control.MOUSE_FILTER_IGNORE; cl.add_child(sun)
	hint = Label.new(); hint.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	hint.add_theme_font_size_override("font_size", 24); hint.add_theme_color_override("font_color", Color(0.24, 0.16, 0.22, 0.9))
	hint.anchor_left = 0; hint.anchor_right = 1; hint.anchor_top = 1; hint.anchor_bottom = 1; hint.offset_top = -92; hint.offset_bottom = -52
	hint.mouse_filter = Control.MOUSE_FILTER_IGNORE; hint.modulate.a = 0.0; cl.add_child(hint)
	# a line of the story over the scene: luminous italic letters (EB Garamond) with a glow about them, under a short
	# red rule. The glow is the same text drawn several times behind itself, each wider and fainter: first a dark
	# haze, so the words read over pale stone as well as over the sea, then warm light, added to the picture
	quote_box = Control.new(); quote_box.set_anchors_preset(Control.PRESET_FULL_RECT); quote_box.mouse_filter = Control.MOUSE_FILTER_IGNORE; quote_box.modulate.a = 0.0; cl.add_child(quote_box)
	var qfont: Font = null
	if FileAccess.file_exists("res://fonts/EBGaramond-Italic.ttf"):
		var ff := FontFile.new(); ff.data = FileAccess.get_file_as_bytes("res://fonts/EBGaramond-Italic.ttf")
		var fv := FontVariation.new(); fv.base_font = ff; fv.variation_opentype = {"wght": 560}; qfont = fv
	if qfont != null: hint.add_theme_font_override("font", qfont); hint.add_theme_font_size_override("font_size", 32)
	hint.add_theme_color_override("font_color", Color(1.0, 0.985, 0.94)); hint.add_theme_color_override("font_outline_color", Color(0.06, 0.1, 0.25, 0.4)); hint.add_theme_constant_override("outline_size", 12)   # pale with a dark edge: it used to be dark, and was lost over the sea
	var qr := ColorRect.new(); qr.color = Color("e8525a"); qr.anchor_left = 0.5; qr.anchor_right = 0.5; qr.anchor_top = 0.095; qr.anchor_bottom = 0.095
	qr.offset_left = -34; qr.offset_right = 34; qr.offset_top = -4; qr.offset_bottom = -1; quote_box.add_child(qr)
	quote_glow = Control.new(); quote_glow.set_anchors_preset(Control.PRESET_FULL_RECT); quote_glow.mouse_filter = Control.MOUSE_FILTER_IGNORE; quote_box.add_child(quote_glow)
	quote_lbls = []
	# [width of the edge, its colour, added to the picture?, does it breathe?]
	# (the haze in many thin steps: in four it showed as rings round the letters)
	for lay in [[36, Color(0.06, 0.1, 0.25, 0.045), false, false], [30, Color(0.06, 0.1, 0.25, 0.05), false, false], [25, Color(0.06, 0.1, 0.25, 0.055), false, false], [20, Color(0.06, 0.1, 0.25, 0.06), false, false], [16, Color(0.06, 0.1, 0.25, 0.07), false, false],
			[12, Color(0.06, 0.1, 0.25, 0.08), false, false], [9, Color(0.06, 0.1, 0.25, 0.09), false, false], [6, Color(0.06, 0.1, 0.25, 0.1), false, false], [4, Color(0.06, 0.1, 0.25, 0.12), false, false], [2, Color(0.06, 0.1, 0.25, 0.14), false, false],
			[26, Color(1.0, 0.8, 0.5, 0.05), true, true], [17, Color(1.0, 0.84, 0.56, 0.08), true, true], [10, Color(1.0, 0.88, 0.66, 0.13), true, true], [5, Color(1.0, 0.93, 0.8, 0.2), true, true],
			[0, Color(1.0, 0.985, 0.94, 1.0), false, false]]:
		var ql := Label.new(); ql.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER; ql.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
		if qfont != null: ql.add_theme_font_override("font", qfont)
		ql.add_theme_font_size_override("font_size", 40 if qfont != null else 31); ql.add_theme_constant_override("line_spacing", 4 if qfont != null else 8)
		if lay[0] > 0:
			ql.add_theme_color_override("font_color", Color(lay[1].r, lay[1].g, lay[1].b, 0.0))
			ql.add_theme_color_override("font_outline_color", lay[1]); ql.add_theme_constant_override("outline_size", lay[0])
		else: ql.add_theme_color_override("font_color", lay[1])
		if lay[2]:
			var qm := CanvasItemMaterial.new(); qm.blend_mode = CanvasItemMaterial.BLEND_MODE_ADD; ql.material = qm
		ql.anchor_left = 0.07; ql.anchor_right = 0.93; ql.anchor_top = 0.095; ql.anchor_bottom = 0.095; ql.offset_top = 14; ql.offset_bottom = 260
		ql.mouse_filter = Control.MOUSE_FILTER_IGNORE
		(quote_glow if lay[3] else quote_box).add_child(ql); quote_lbls.append(ql)
	quote_box.move_child(quote_glow, quote_box.get_child_count() - 2)   # the light lies under the letters, over the haze
	pocket_ui = Pocket.new(); pocket_ui.set_anchors_preset(Control.PRESET_FULL_RECT); pocket_ui.mouse_filter = Control.MOUSE_FILTER_IGNORE; cl.add_child(pocket_ui)
	title_box = _card("EIDOLON", title_sub, cl, qfont)
	if hand_play and STICK:
		ctl = Joy.new(); add_child(ctl)
		ctl.interact.connect(func() -> void:
			if reach != "" and not busy: use(reach))
	end_box = _card("EIDOLON", end_sub, cl, qfont); end_box.modulate.a = 0.0; end_box.visible = false

## the title and the end card. f: the typeface of the lines of the story (EB Garamond italic), so that the cards and those lines are set alike.
## The scene stays clear behind the card and is veiled only where the words stand: dusk at the head and the foot of the
## picture and a band of it behind the title (it used to be one flat grey wash over everything, which made the scene
## muddy and left the words hard to read over pale stone). The title has the same haze and warm light about its letters
## as the lines of the story; under it a red rule with a lozenge at its middle, and the small line, which breathes
func _card(big: String, small: String, cl: CanvasLayer, f: Font = null) -> Control:
	var c := Control.new(); c.set_anchors_preset(Control.PRESET_FULL_RECT); c.mouse_filter = Control.MOUSE_FILTER_IGNORE; cl.add_child(c)
	var top := 0.3
	var vg := Gradient.new(); vg.offsets = PackedFloat32Array([0.0, 0.17, 0.3, 0.38, 0.47, 0.64, 1.0])
	var vcol := PackedColorArray()
	for va in [0.7, 0.3, 0.6, 0.7, 0.58, 0.22, 0.62]: vcol.append(Color(0.07, 0.1, 0.23, va))
	vg.colors = vcol
	var vt := GradientTexture2D.new(); vt.gradient = vg; vt.fill_from = Vector2(0.5, 0.0); vt.fill_to = Vector2(0.5, 1.0); vt.width = 8; vt.height = 256
	var bg := TextureRect.new(); bg.texture = vt; bg.stretch_mode = TextureRect.STRETCH_SCALE; bg.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	bg.set_anchors_preset(Control.PRESET_FULL_RECT); bg.mouse_filter = Control.MOUSE_FILTER_IGNORE; c.add_child(bg)
	var tf: Font = null
	if f != null:
		var tfv := FontVariation.new(); tfv.base_font = (f as FontVariation).base_font; tfv.variation_opentype = {"wght": 500}; tfv.spacing_glyph = 7; tf = tfv
	var navy := Color(0.05, 0.08, 0.22)
	# [width of the edge, its colour, added to the picture?]: a dark haze, then warm light, then the letters
	for lay in [[34, Color(navy, 0.05), false], [24, Color(navy, 0.07), false], [15, Color(navy, 0.09), false], [8, Color(navy, 0.12), false], [3, Color(navy, 0.18), false],
			[26, Color(1.0, 0.8, 0.5, 0.04), true], [13, Color(1.0, 0.86, 0.6, 0.07), true], [5, Color(1.0, 0.92, 0.76, 0.1), true], [0, Color(0.99, 0.965, 0.9), false]]:
		var a := Label.new(); a.text = big; a.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER; a.mouse_filter = Control.MOUSE_FILTER_IGNORE
		a.add_theme_font_size_override("font_size", 76 if f == null else 92)
		if tf != null: a.add_theme_font_override("font", tf)
		if lay[0] > 0:
			a.add_theme_color_override("font_color", Color(lay[1].r, lay[1].g, lay[1].b, 0.0))
			a.add_theme_color_override("font_outline_color", lay[1]); a.add_theme_constant_override("outline_size", lay[0])
		else: a.add_theme_color_override("font_color", lay[1])
		if lay[2]:
			var am := CanvasItemMaterial.new(); am.blend_mode = CanvasItemMaterial.BLEND_MODE_ADD; a.material = am
		a.anchor_left = 0; a.anchor_right = 1; a.anchor_top = top; a.anchor_bottom = top; a.offset_bottom = 110; c.add_child(a)
	for e in [-1.0, 1.0]:      # the rule: two red strokes and a lozenge between them
		var ln := ColorRect.new(); ln.color = Color("dc3d46"); ln.anchor_left = 0.5; ln.anchor_right = 0.5; ln.anchor_top = top; ln.anchor_bottom = top; ln.mouse_filter = Control.MOUSE_FILTER_IGNORE
		ln.offset_left = -74.0 if e < 0.0 else 14.0; ln.offset_right = -14.0 if e < 0.0 else 74.0; ln.offset_top = 122; ln.offset_bottom = 124; c.add_child(ln)
	var lz := ColorRect.new(); lz.color = Color("e8525a"); lz.anchor_left = 0.5; lz.anchor_right = 0.5; lz.anchor_top = top; lz.anchor_bottom = top; lz.mouse_filter = Control.MOUSE_FILTER_IGNORE
	lz.offset_left = -4.5; lz.offset_right = 4.5; lz.offset_top = 118.5; lz.offset_bottom = 127.5; lz.pivot_offset = Vector2(4.5, 4.5); lz.rotation = PI * 0.25; c.add_child(lz)
	var b := Label.new(); b.text = small; b.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER; b.mouse_filter = Control.MOUSE_FILTER_IGNORE
	b.add_theme_font_size_override("font_size", 24 if f == null else 34); b.add_theme_color_override("font_color", Color(0.99, 0.94, 0.86))
	b.add_theme_color_override("font_outline_color", Color(navy, 0.5)); b.add_theme_constant_override("outline_size", 14)
	if f != null: b.add_theme_font_override("font", f)
	b.anchor_left = 0; b.anchor_right = 1; b.anchor_top = top; b.anchor_bottom = top; b.offset_top = 144; b.offset_bottom = 186; c.add_child(b)
	var bt := create_tween().set_loops()      # the small line breathes: it asks for a tap
	bt.tween_property(b, "modulate:a", 0.72, 1.3).set_trans(Tween.TRANS_SINE); bt.tween_property(b, "modulate:a", 1.0, 1.3).set_trans(Tween.TRANS_SINE)
	return c

## a line of the story, once: it comes up over the scene, stays long enough to be read, and goes
func quote(key: String, text: String, hold := 5.0, again := false) -> void:
	if quotes_shown.has(key) and not again: return
	quotes_shown[key] = true
	for ql in quote_lbls: (ql as Label).text = text
	var qt := create_tween(); qt.tween_property(quote_box, "modulate:a", 1.0, 1.3); qt.tween_interval(hold); qt.tween_property(quote_box, "modulate:a", 0.0, 1.6)
	quote_glow.modulate.a = 1.0     # the light about the letters breathes while they are up
	var gl := create_tween().set_loops(int(ceil((hold + 3.0) / 2.4)))
	gl.tween_property(quote_glow, "modulate:a", 0.62, 1.2).set_trans(Tween.TRANS_SINE); gl.tween_property(quote_glow, "modulate:a", 1.0, 1.2).set_trans(Tween.TRANS_SINE)

func say(s: String) -> void:
	hint.text = s
	var tw2 := create_tween(); tw2.tween_property(hint, "modulate:a", 1.0, 0.4); tw2.tween_interval(3.2); tw2.tween_property(hint, "modulate:a", 0.0, 0.8)

# ---------------------------------------------------------------- input
func _unhandled_input(ev: InputEvent) -> void:
	if ev is InputEventScreenTouch:
		if ev.pressed:
			hold_id = ev.index; hold_at = ev.position; hold_t = 0.0; hold_next = 0.0
			tap(ev.position)
		elif ev.index == hold_id: hold_id = -1
	elif ev is InputEventScreenDrag and ev.index == hold_id: hold_at = ev.position

func tap(sp: Vector2) -> void:
	if ended:
		if end_box.modulate.a > 0.9: get_tree().reload_current_scene()
		return
	if not started:
		started = true
		var tw2 := create_tween(); tw2.tween_property(title_box, "modulate:a", 0.0, 0.7); tw2.tween_callback(title_box.hide)
		if hand_play: create_tween().tween_property(cam, "size", PLAY_SIZE, 2.2).set_trans(Tween.TRANS_SINE).set_ease(Tween.EASE_IN_OUT)
		say("drag to walk" if ctl != null else "tap to walk  ·  hold to keep walking")
		return
	if busy: return
	if ctl != null: return      # with the stick, a touch is the thumb landing: she walks by the stick and acts by the button
	var px := get_viewport().get_visible_rect().size.x / 720.0
	for k in objs:
		if done.has(k): continue
		if _tap_hits(k, sp, px):
			usering.position = Vector3(objs[k].at.x, 0.03, objs[k].at.z); use_p = 0.0
			use(k); return
	for k in looks:      # a thing to look at: she goes up to it if she can, and looks
		if _look_hits(k, sp, px): _look(k); return
	if cam.unproject_position(pos + Vector3(0, 0.9, 0)).distance_to(sp) < 62.0 * px:
		_self(); return
	var wu = _water_under(sp)
	if wu != null and hand_play:      # still water: her reflection is sent there (she stands at the rim; if she is not there yet, she goes first)
		hold_id = -1
		_send_reflection(wu[0], wu[1], sp); return
	var run := (t - last_tap) < 0.38
	last_tap = t
	var bp2 = _ground_under(sp)
	if bp2 == null: return
	pending = ""
	walk_to(bp2, 2.7 if run else PLAY_WALK)
	tapring.position = (bp2 as Vector3) + Vector3(0, 0.02, 0); tap_p = 0.0

## (play) keeps the game smooth on slow devices: it watches the real frame rate, and when that falls it draws the 3D
## picture at a lower resolution (the screen furniture stays sharp), step by step; when there is room again it tries
## one step back up, and remembers if that did not hold
var _res_last := 0
func _keep_smooth() -> void:
	var now := Time.get_ticks_usec()
	if _res_last == 0: _res_last = now; return
	var real := (now - _res_last) / 1000000.0; _res_last = now
	if real > 0.5: return      # a pause (the tab was hidden): not a slow frame
	if res_hold > 0.0: res_hold -= real; res_t = 0.0; res_frames = 0; return
	res_t += real; res_frames += 1
	if res_t < 1.2: return
	var fps := res_frames / res_t
	res_t = 0.0; res_frames = 0
	if fps < 44.0 and res_level < RES_STEPS.size() - 1:
		if res_probe: res_top = res_level + 1      # the step back up did not hold: the step below it is as high as it goes from now on
		res_level += 1; res_probe = false; res_hold = 1.5
		if res_level == RES_STEPS.size() - 1: RenderingServer.directional_shadow_atlas_set_size(2048, true); get_viewport().msaa_3d = Viewport.MSAA_DISABLED
	elif fps > 57.0 and res_level > res_top:
		res_level -= 1; res_probe = true; res_hold = 4.0      # room to spare: one careful step back up
	else: return
	get_viewport().scaling_3d_scale = RES_STEPS[res_level]

## the still waters in which her reflection has something to walk on (x0, z0, x1, z1): the pool of the second court,
## where the lost crossing still stands in the water. On open water, where nothing is reflected underfoot, it does not walk
func _pools() -> Array:
	return [[QX0, QZ0, QX1, QZ1], [WX0, WZ0, WX1, WZ1]]

## where she stands to send her reflection out on a water, and how high over that water its way lies
func _refl_head(pi: int) -> Vector3:
	return Vector3(CROSS_X, 0, QZ1 + 0.39) if pi == 0 else KPIV + _crane_dir() * KSTAND
func _refl_h(pi: int) -> float:
	return CROSS_H if pi == 0 else BEAM_TOP

func _rect_dist(p: Vector3, r: Array) -> float:
	return Vector2(maxf(maxf(r[0] - p.x, p.x - r[2]), 0.0), maxf(maxf(r[1] - p.z, p.z - r[3]), 0.0)).length()

## the still water under a point of the screen: [which pool, the place on it] or null
func _water_under(sp: Vector2):
	var o := cam.project_ray_origin(sp); var d := cam.project_ray_normal(sp)
	var g := o + d * ((0.012 - o.y) / d.y)
	var pl := _pools()
	for i in pl.size():
		var r: Array = pl[i]
		if g.x > r[0] and g.x < r[2] and g.z > r[1] and g.z < r[3]:
			if i == 1 and Vector2(g.x - KPIV.x, g.z - KPIV.z).length() < KQUAY + 0.05: return null      # the crane's quay stands in that water: it is floor
			if i == 1 and rects["Kl"].on and g.z < WZ0 + 0.66 and g.x < KDOOR_X + 0.6: return null      # and so is the ledge, once it has come out of the wall
			return [i, Vector3(clampf(g.x, r[0] + 0.28, r[2] - 0.28), 0, clampf(g.z, r[1] + 0.28, r[3] - 0.28))]
	return null

## the lost crossing of the second court's pool, as the line her reflection walks: from its head at the front rim
## into the pool, the turn, and its end an arm's length before the wheel
func _cross_line(pi := 0) -> Array:
	if pi == 1:      # the fourth court: the timber that hangs from the crane, from the quay's edge to an arm's length short of its end
		var d := _crane_dir()
		if crane_i == 2: return [KPIV + d * (KQUAY + 0.12), KPIV + d * (BEAM_R1 - 0.12), Vector3(KDOOR_X, 0, WZ0 + 0.36)]      # ...and on, over the step, to the door
		return [KPIV + d * (KQUAY + 0.12), KPIV + d * (BEAM_R1 - 0.3)]
	var hub_x := PED.x - WINCH_HUB.x * WINCH_K
	return [Vector3(CROSS_X, 0, QZ1 - 0.3), Vector3(CROSS_X, 0, PED.z), Vector3(hub_x - 0.56, 0, PED.z)]

## how far along the crossing the point of it nearest to p lies (0 at its head), and that point
func _cross_near(p: Vector3, pi := 0) -> Array:
	var ln := _cross_line(pi); var best := [0.0, ln[0]]; var bd := 1e9; var run := 0.0
	for k in ln.size() - 1:
		var a: Vector3 = ln[k]; var b: Vector3 = ln[k + 1]; var ab := b - a
		var u := clampf(Vector3(p.x - a.x, 0, p.z - a.z).dot(ab) / maxf(ab.length_squared(), 0.001), 0.0, 1.0)
		var q := a + ab * u; var dd := Vector2(p.x - q.x, p.z - q.z).length()
		if dd < bd: bd = dd; best = [run + ab.length() * u, q]
		run += ab.length()
	return best

## the way of the reflection over a pool from one place to another. On the second court's pool it keeps to the lost
## crossing (the water remembers it, and only there can it walk): along it, round its turn. On open water, straight
func _refl_way(pi: int, from: Vector3, to: Vector3) -> Array:
	var ln := _cross_line(pi); var a := _cross_near(from, pi); var b := _cross_near(to, pi)
	var turn_at: float = (ln[1] - ln[0]).length()
	var way := []
	if Vector2(from.x - (a[1] as Vector3).x, from.z - (a[1] as Vector3).z).length() > 0.05: way.append(a[1])      # first onto the crossing, if it is off it (she stands at its head, on the floor)
	if ln.size() > 2 and ((a[0] < turn_at - 0.02 and b[0] > turn_at + 0.02) or (a[0] > turn_at + 0.02 and b[0] < turn_at - 0.02)): way.append(ln[1])
	way.append(b[1])
	return way

## (play) a tap on still water: her reflection leaves her and walks to that place on it. She has to stand at the
## pool's rim for it; if she does not, she goes to the rim nearest the place first. A newer order overtakes this one
func _send_reflection(pi: int, to: Vector3, sp: Vector2) -> void:
	var r: Array = _pools()[pi]
	if busy: return
	if not refl_out.is_empty() and _rect_dist(pos, r) > 1.2: return      # it is on its way back to her, and she has left the water
	refl_token += 1; var my := refl_token
	var head := _refl_head(pi)      # where she stands for it: the head of the lost crossing, or under the crane's arm
	to = _cross_near(to, pi)[1]
	refl_ring.position = Vector3(to.x, 0.03, to.z); refl_p = 0.0
	if refl_out.is_empty():
		if not H.has("mir"): return
		if Vector2(pos.x - head.x, pos.z - head.z).length() > 0.4:
			var rp = head
			refl_stay = true
			var ok: bool = rp != null and walk_to(rp, PLAY_WALK)
			refl_stay = false
			if not ok: return
			pending = ""
			while not route.is_empty() and refl_token == my: await get_tree().process_frame
			if refl_token != my or _rect_dist(pos, r) > 1.15 or Vector2(pos.x - head.x, pos.z - head.z).length() > 0.5: return
		face_to = Vector3(to.x, 0, to.z)
		var e0: Dictionary = H["mir"]; H.erase("mir"); refl_out = e0
	var e: Dictionary = refl_out; var hd: Node3D = e.holder
	hd.position.y = _refl_h(pi)      # on the stones of the crossing (or on the timber), not on the water
	(e.ap as AnimationPlayer).play("walk", 0.25); (e.ap as AnimationPlayer).speed_scale = 1.15
	for wp in _refl_way(pi, hd.position, to):
		var d: Vector3 = wp - hd.position; d.y = 0.0
		if d.length() > 0.02: hd.rotation.y = atan2(d.x, d.z)
		while refl_token == my and Vector2(hd.position.x - wp.x, hd.position.z - wp.z).length() > 0.03:
			hd.position = hd.position.move_toward(Vector3(wp.x, hd.position.y, wp.z), 1.3 * get_process_delta_time())
			await get_tree().process_frame
		if refl_token != my: return
	(e.ap as AnimationPlayer).play("idle", 0.4); (e.ap as AnimationPlayer).speed_scale = 1.0

## her reflection comes back under her feet, wherever she has gone meanwhile, and is hers again
func _refl_return() -> void:
	refl_token += 1; var my := refl_token
	var e: Dictionary = refl_out; var hd: Node3D = e.holder
	(e.ap as AnimationPlayer).play("walk", 0.2); (e.ap as AnimationPlayer).speed_scale = 1.9
	var pi := 0
	var r0: Array = _pools()[0]
	if _rect_dist(hd.position, _pools()[1]) < 0.01: pi = 1; r0 = _pools()[1]
	if hd.position.x > r0[0] and hd.position.x < r0[2] and hd.position.z > r0[1] and hd.position.z < r0[3]:      # on a pool: back along its crossing to the head of it, and only then over the floor to her
		for wp in _refl_way(pi, hd.position, _cross_line(pi)[0]):
			var d0: Vector3 = wp - hd.position; d0.y = 0.0
			if d0.length() > 0.02: hd.rotation.y = atan2(d0.x, d0.z)
			while refl_token == my and Vector2(hd.position.x - wp.x, hd.position.z - wp.z).length() > 0.04:
				hd.position = hd.position.move_toward(Vector3(wp.x, hd.position.y, wp.z), 2.8 * get_process_delta_time())
				await get_tree().process_frame
			if refl_token != my: return
	while refl_token == my:
		var d := Vector3(pos.x - hd.position.x, 0, pos.z - hd.position.z)
		if d.length() < 0.18: break
		hd.rotation.y = atan2(d.x, d.z)
		hd.position = hd.position.move_toward(Vector3(pos.x, hd.position.y, pos.z), 2.8 * get_process_delta_time())
		await get_tree().process_frame
	if refl_token != my: return
	(e.ap as AnimationPlayer).play("walk" if walk_on else "idle", 0.3)
	hd.position.y = 0.0
	H["mir"] = e; refl_out = {}

func _look_hits(k: String, sp: Vector2, px: float) -> bool:
	var a := cam.unproject_position(looks[k].foot + Vector3(0, 0.15, 0)); var b := cam.unproject_position(looks[k].top)
	var ab := b - a
	var u := clampf((sp - a).dot(ab) / maxf(ab.length_squared(), 0.001), 0.0, 1.0)
	return sp.distance_to(a + ab * u) < 40.0 * px

## the floor nearest to a thing, a step back from it: where she stands to look at it. Null if no floor is near
func _floor_by(p: Vector3):
	var bd := 1e9; var bp := Vector3.ZERO; var br := {}
	for n in rects:
		var r: Dictionary = rects[n]
		if not r.on: continue
		var c := Vector3(clampf(p.x, r.x0, r.x1), 0, clampf(p.z, r.z0, r.z1))
		var d := Vector2(c.x - p.x, c.z - p.z).length()
		if d < bd: bd = d; bp = c; br = r
	if bd > 1.7: return null
	if bd < 0.7:      # the nearest floor is at its very foot: a step away from it, toward the middle of that floor
		var mid := Vector3((br.x0 + br.x1) * 0.5, 0, (br.z0 + br.z1) * 0.5)
		var dir := Vector3(mid.x - p.x, 0, mid.z - p.z)
		for dd in [dir.normalized(), Vector3(1, 0, 0), Vector3(0, 0, 1), Vector3(-1, 0, 0), Vector3(0, 0, -1)]:
			var c2: Vector3 = Vector3(p.x, 0, p.z) + dd * 0.78
			if in_rect(br, c2) and _walkable(c2): return c2
	return bp if _walkable(bp) else null

func _look(k: String) -> void:
	var L: Dictionary = looks[k]
	tapring.position = Vector3(L.foot.x, maxf(L.foot.y, 0.0) + 0.02, L.foot.z); tap_p = 0.0
	var c = _floor_by(L.foot)
	if c != null and Vector2(pos.x - c.x, pos.z - c.z).length() > 0.45 and walk_to(c):
		pending = "look:" + k; return
	route.clear(); pending = ""; busy = true
	await _look_now(k)
	busy = false; settled.emit()

func _look_now(k: String) -> void:
	var L: Dictionary = looks[k]
	await face(Vector3(L.foot.x, 0, L.foot.z))
	var line: String = L.lines[L.i]; L.i = (L.i + 1) % L.lines.size()
	if L.big:
		create_tween().tween_property(self, "a_headp", 0.12, 0.5)
		quote("look", line, 4.2, true)
		await wait(1.6)
		create_tween().tween_property(self, "a_headp", 0.0, 0.6)
	else:
		say(line)
		var h := create_tween().set_trans(Tween.TRANS_SINE); h.tween_property(self, "a_headp", -0.12 if L.top.y > 1.5 else 0.14, 0.4); h.tween_interval(0.7); h.tween_property(self, "a_headp", 0.0, 0.5)
		await wait(0.9)

## does a tap at sp fall on the thing k: anywhere along it, from its foot (or the points it names in "hits") up to
## its floating mark. A statue is hit on its gear and drum as well as on its body
func _tap_hits(k: String, sp: Vector2, px: float) -> bool:
	var pts := []
	for q in objs[k].get("hits", [objs[k].at]): pts.append(cam.unproject_position(q))
	pts.append(cam.unproject_position(markers[k].position))
	var r := 64.0 * px
	for i in pts.size() - 1:
		var a: Vector2 = pts[i]; var b: Vector2 = pts[i + 1]
		var ab := b - a
		var u := clampf((sp - a).dot(ab) / maxf(ab.length_squared(), 0.001), 0.0, 1.0)
		if sp.distance_to(a + ab * u) < r: return true
	return pts.size() == 1 and sp.distance_to(pts[0]) < r

## the place on walkable floor that a point of the screen names (the nearest such place, if the point is off the
## floor; never inside a lamp stand or a plinth), or null if there is none near it
func _ground_under(sp: Vector2):
	var px := get_viewport().get_visible_rect().size.x / 720.0
	var o := cam.project_ray_origin(sp); var d := cam.project_ray_normal(sp)
	var g := o + d * (-o.y / d.y)
	var best := ""; var bp := Vector3.ZERO; var bd := 1e9
	for n in rects:
		var r: Dictionary = rects[n]
		if not r.on: continue
		var c := Vector3(clampf(g.x, r.x0, r.x1), 0, clampf(g.z, r.z0, r.z1))
		var dd := cam.unproject_position(c).distance_to(sp)
		if dd < bd: bd = dd; best = n; bp = c
	if best == "" or bd > 150.0 * px: return null
	for b in blockers + solids:   # sent into a lamp stand or a plinth, she stops beside it: on the side of the tap if that is floor, else towards the middle of the place
		var bc := Vector3(b.x, 0, b.y); var off: Vector3 = bp - bc; var br: float = b.z
		if off.length() >= br: continue
		var rr: Dictionary = rects[best]
		var cand: Vector3 = bc + off.normalized() * br
		if off.length() < 0.01 or not in_rect(rr, cand): cand = bc + (Vector3((rr.x0 + rr.x1) * 0.5, 0, (rr.z0 + rr.z1) * 0.5) - bc).normalized() * br
		if in_rect(rr, cand): bp = cand
	return bp

func walk_to(p: Vector3, cap := WALK) -> bool:
	var pts := find_path(pos, p)
	if pts.is_empty(): return false
	if not refl_out.is_empty() and not refl_stay: _refl_return()      # she walks on: her reflection comes back to her
	speed_cap = cap; face_to = null
	route.clear()
	for q in pts: route.append({"p": q})
	return true

func use(k: String) -> void:
	if k == "winch" and not refl_out.is_empty() and _rect_dist(pos, _pools()[0]) < 1.2:      # her reflection is out on that water: it goes to the wheel from where it is, and she stays where she stands
		route.clear(); pending = ""; busy = true
		await _do_winch()
		busy = false; settled.emit(); return
	if k == "wkey" or k == "wdoor":      # a thing in the water of the crane's court: she stands under the crane's arm, wherever that points now
		var hd := KPIV + _crane_dir() * KSTAND
		objs[k].stand = hd
		if Vector2(pos.x - hd.x, pos.z - hd.z).length() < 0.45:      # she is there already (her reflection may be out on the timber): no step is needed
			route.clear(); pending = ""; busy = true
			await call("_do_" + k)
			busy = false; settled.emit(); return
		refl_stay = true
		var okw := walk_to(hd)
		refl_stay = false
		if not okw: say("there is no way there yet")
		else: pending = k
		return
	if not walk_to(objs[k].stand):
		say("there is no way there yet"); return
	pending = k

func _arrive() -> void:
	arrived.emit()
	if busy: return
	if pending != "":
		var k := pending; pending = ""
		busy = true
		if k.begins_with("look:"): await _look_now(k.substr(5))
		else: await call("_do_" + k)
		busy = false
	settled.emit()

# ---------------------------------------------------------------- frame
func _process(dt: float) -> void:
	if not lighten_check.is_empty() and Engine.get_process_frames() % 400 == 399:   # (counted in frames of the game, not frames drawn: the check runs without a screen too, where nothing is drawn)
		var moved := 0; var names := []
		for r in lighten_check:
			if not is_instance_valid(r[0]) or not (r[0] as MeshInstance3D).is_visible_in_tree() or not (r[0] as MeshInstance3D).global_transform.is_equal_approx(r[1]):
				moved += 1
				if names.size() < 6: names.append(str(r[2]).right(60))
		print("LIGHTEN check at frame ", Engine.get_process_frames(), ": ", moved, " of ", lighten_check.size(), " moved or hid ", names)
	if Engine.get_frames_drawn() == 45 and OS.get_environment("STATS") == "3":   # what the frame is made of: the heaviest meshes, and every texture
		var rows := {}; var texs := {}
		for mm in find_children("*", "MeshInstance3D", true, false):
			var mi := mm as MeshInstance3D
			if mi.mesh == null or not mi.is_visible_in_tree(): continue
			var id := mi.mesh.get_instance_id()
			if not rows.has(id): rows[id] = {"t": mi.mesh.get_faces().size() / 3, "n": 0, "who": str(mi.get_path()).right(70), "surf": mi.mesh.get_surface_count(), "two": 0, "skin": mi.skin != null}
			rows[id].n += 1
			for si in mi.mesh.get_surface_count():
				var mo: Material = mi.material_override if mi.material_override != null else (mi.get_surface_override_material(si) if mi.get_surface_override_material(si) != null else mi.mesh.surface_get_material(si))
				if mo is ShaderMaterial:
					if (mo as ShaderMaterial).next_pass != null: rows[id].two += 1
					for u in (mo as ShaderMaterial).shader.get_shader_uniform_list():
						var v = (mo as ShaderMaterial).get_shader_parameter(u.name)
						if v is Texture2D: texs[(v as Texture2D).get_rid().get_id()] = "%dx%d %s" % [(v as Texture2D).get_width(), (v as Texture2D).get_height(), u.name]
				elif mo is BaseMaterial3D and (mo as BaseMaterial3D).albedo_texture != null:
					var v2 := (mo as BaseMaterial3D).albedo_texture; texs[v2.get_rid().get_id()] = "%dx%d albedo(std)" % [v2.get_width(), v2.get_height()]
		var list := rows.values(); list.sort_custom(func(x, y): return x.t * x.n > y.t * y.n)
		var tot := 0; var draws := 0
		for r in list: tot += r.t * r.n; draws += r.n * r.surf + r.two * r.n
		print("STATS3 total tris ", tot, " in ", list.size(), " meshes; draws about ", draws)
		for r in list.slice(0, 28): print("STATS3 ", r.t * r.n, " = ", r.t, " x ", r.n, "  surf ", r.surf, " refl ", r.two, " skin ", r.skin, "  ", r.who)
		var small := 0; var small_n := 0
		for r in list:
			if r.t <= 200: small += r.n; small_n += 1
		print("STATS3 instances of meshes of 200 triangles or fewer: ", small, " (", small_n, " meshes)")
		for k in texs: print("STATS3 tex ", texs[k])
		var tops := {}    # where the separate pieces hang: the child of the world (or of the scene) each one is under
		for mm in find_children("*", "MeshInstance3D", true, false):
			var mi := mm as MeshInstance3D
			if mi.mesh == null or not mi.is_visible_in_tree(): continue
			var up: Node = mi
			while up.get_parent() != null and up.get_parent() != world and up.get_parent() != self: up = up.get_parent()
			var nm := "%s/%s" % [up.get_parent().name if up.get_parent() != null else "", "(mesh)" if up == mi else String(up.name)]
			var mo2: Material = mi.material_override
			var sh := "std"
			if mo2 is ShaderMaterial:
				for kk in shaders:
					if shaders[kk] == (mo2 as ShaderMaterial).shader: sh = kk
			elif mo2 == null: sh = "surface"
			var k2 := nm if up != mi else "%s %s" % [nm, sh]
			tops[k2] = tops.get(k2, 0) + 1
		var tl := tops.keys(); tl.sort_custom(func(x, y): return tops[x] > tops[y])
		for k3 in tl.slice(0, 24): print("STATS3 where ", tops[k3], "  ", k3)
	if Engine.get_frames_drawn() == 45 and OS.get_environment("STATS") == "2":
		var g := {"figures": 0, "figures_n": 0, "heads": 0, "world": 0, "world_n": 0, "copy_under_sea": 0, "second_pass": 0}
		var cache := {}
		for mm in find_children("*", "MeshInstance3D", true, false):
			var mi := mm as MeshInstance3D
			if mi.mesh == null or not mi.is_visible_in_tree(): continue
			if not cache.has(mi.mesh): cache[mi.mesh] = mi.mesh.get_faces().size() / 3
			var t: int = cache[mi.mesh]
			var in_copy := refl != null and refl.is_ancestor_of(mi)
			var two := false
			var mo := mi.material_override
			if mo == null and mi.mesh.get_surface_count() > 0: mo = mi.get_surface_override_material(0)
			if mo is ShaderMaterial and (mo as ShaderMaterial).next_pass != null: two = true
			if in_copy: g.copy_under_sea += t
			elif t > 20000: g.figures += t; g.figures_n += 1
			elif t > 1500: g.heads += t
			else: g.world += t; g.world_n += 1
			if two: g.second_pass += t
		print("STATS2 ", g)
	if Engine.get_frames_drawn() == 45 and OS.get_environment("STATS") == "1":
		print("STATS objects ", RenderingServer.get_rendering_info(RenderingServer.RENDERING_INFO_TOTAL_OBJECTS_IN_FRAME), " triangles ", RenderingServer.get_rendering_info(RenderingServer.RENDERING_INFO_TOTAL_PRIMITIVES_IN_FRAME), " draw calls ", RenderingServer.get_rendering_info(RenderingServer.RENDERING_INFO_TOTAL_DRAW_CALLS_IN_FRAME), " texture MB ", snappedf(RenderingServer.get_rendering_info(RenderingServer.RENDERING_INFO_TEXTURE_MEM_USED) / 1048576.0, 0.1), " mesh instances ", find_children("*", "MeshInstance3D", true, false).size())
	t += dt
	if old_world and started and absf(pos.x) < 0.8 and pos.z < -5.2 and pos.z > -9.6:   # on the causeway, among the hidden mirrors
		quote("mirrors", "He hid every mirror.\nAs long as she had not seen her face,\nshe was still only what he had made.")
	if hold_id >= 0 and started and not ended and not busy and ctl == null and pending == "":
		hold_t += dt
		if hold_t > 0.24 and hold_t >= hold_next:      # held: every tenth of a second she is sent again to where the finger is
			hold_next = hold_t + 0.1
			var hp = _ground_under(hold_at)
			if hp != null:
				var far := Vector2((hp as Vector3).x - pos.x, (hp as Vector3).z - pos.z).length()
				if far > 0.25: walk_to(hp, clampf(far * 0.95, WALK, 2.7))
	if hand_play and OS.get_environment("HAND") == "": _keep_smooth()
	var target := 0.0
	var want_yaw := yaw
	var jv := Vector3.ZERO      # where the stick (or the arrow keys) sends her, on the ground
	if ctl != null:
		ctl.enabled = started and not ended and not busy
		if ctl.enabled:
			var sv: Vector2 = ctl.vec
			var kv := Vector2(float(Input.is_key_pressed(KEY_RIGHT) or Input.is_key_pressed(KEY_D)) - float(Input.is_key_pressed(KEY_LEFT) or Input.is_key_pressed(KEY_A)), float(Input.is_key_pressed(KEY_DOWN) or Input.is_key_pressed(KEY_S)) - float(Input.is_key_pressed(KEY_UP) or Input.is_key_pressed(KEY_W)))
			if kv != Vector2.ZERO: sv = kv.normalized()
			if sv != Vector2.ZERO:
				var cb := cam.global_transform.basis
				jv = Vector3(cb.x.x, 0, cb.x.z).normalized() * sv.x - Vector3(cb.y.x, 0, cb.y.z).normalized() * sv.y
			# what is in reach: the nearest thing not yet done, close to where she would stand for it
			reach = ""; var rb := 1.45
			for k in objs:
				if done.has(k): continue
				var rd := Vector2(pos.x - objs[k].stand.x, pos.z - objs[k].stand.z).length()
				if rd < rb: rb = rd; reach = k
			ctl.show_interact("" if reach == "" else ("wait" if reach == "plinth" else ("touch" if reach == "mirror" else "turn")))
			if reach != "" and (Input.is_key_pressed(KEY_E) or Input.is_key_pressed(KEY_SPACE) or Input.is_key_pressed(KEY_ENTER)): use(reach)
		else: ctl.show_interact("")
	if jv.length() > 0.01 and (route.is_empty() or pending == ""):
		route.clear(); pending = ""; face_to = null; rem_dist = 1.0
		var jd := jv.normalized()
		want_yaw = atan2(jd.x, jd.z)
		target = (2.1 if jv.length() > 0.9 else WALK * clampf(jv.length() * 1.3, 0.45, 1.0)) * clampf(1.25 - absf(angle_difference(yaw, want_yaw)) * 0.8, 0.25, 1.0)
		spd = move_toward(spd, target, 2.6 * dt)
		var js := spd * dt
		for tr in [Vector3(jd.x, 0, jd.z), Vector3(jd.x, 0, 0), Vector3(0, 0, jd.z)]:      # straight on, or sliding along an edge
			var np: Vector3 = pos + tr * js
			if _walkable(np): pos.x = np.x; pos.z = np.z; break
		vel = Vector3(sin(yaw), 0, cos(yaw)) * spd
	elif not route.is_empty():
		var p3: Vector3 = route[0].p
		var to := Vector3(p3.x - pos.x, 0, p3.z - pos.z)
		var left := to.length()
		for i in range(1, mini(route.size(), 5)): left += Vector2(route[i].p.x - route[i - 1].p.x, route[i].p.z - route[i - 1].p.z).length()
		rem_dist = left
		target = minf(speed_cap, sqrt(2.0 * (2.4 if shape_file != "" else 1.25 if rig_file != "" else 1.1) * left) + 0.03)   # she slows over a good pace or two, not in one
		if to.length() > 0.02: want_yaw = atan2(to.x, to.z)
		target *= clampf(1.25 - absf(angle_difference(yaw, want_yaw)) * 0.8, 0.25, 1.0)
		spd = move_toward(spd, target, (3.4 if shape_file != "" else (3.0 if hand_play else (1.5 if speed_cap <= WALK else 2.6))) * dt)
		if hand_play and route.size() > 1 and to.length() < 0.2: route.pop_front()      # (play) a corner of the way is rounded, not walked into and out of
		var step := spd * dt
		if step >= to.length():
			pos.x = p3.x; pos.z = p3.z
			route.pop_front()
			if route.is_empty(): spd = 0.0; _arrive()
		else:
			var d := to.normalized(); pos.x += d.x * step; pos.z += d.z * step
		vel = Vector3(sin(yaw), 0, cos(yaw)) * spd
	else:
		spd = move_toward(spd, 0.0, 6.0 * dt); vel = Vector3.ZERO; rem_dist = 0.0
		if face_to != null:
			want_yaw = atan2(face_to.x - pos.x, face_to.z - pos.z)
			if absf(angle_difference(yaw, want_yaw)) < 0.02: face_to = null; faced.emit()
	turn_amt = absf(angle_difference(yaw, want_yaw)) if (route.is_empty() and face_to != null) else 0.0
	if rig_file != "" and shape_file == "":   # a turn that gathers and settles, instead of one that starts at full speed
		yaw_v += (angle_difference(yaw, want_yaw) * 34.0 - yaw_v * 11.8) * dt
		yaw_v = clampf(yaw_v, -3.2, 3.2); yaw += yaw_v * dt
	else:
		yaw = lerp_angle(yaw, want_yaw, 1.0 - exp(-(7.5 if shape_file != "" else 4.2) * dt))
	var wk := clampf(spd / WALK, 0.0, 1.0)
	var rk := clampf((spd - WALK) / 1.2, 0.0, 1.0)
	phase += spd * dt / lerpf(0.92, 1.15, rk) * PI
	if pushing:
		var ph := atan2(pos.x - CAP.x, pos.z - CAP.z)
		var th := ph - 0.42
		cap_rot.rotation.y = th
		bridge.rotation.y = PI * 0.5 * (1.0 - smoothstep(0.0, 1.0, clampf(-ph / (PI * 0.5), 0.0, 1.0)))
		var dir := Vector3(sin(th), 0, cos(th))
		tgtR = CAP + Vector3(0, 0.98, 0) + dir * 0.5; tgtL = CAP + Vector3(0, 0.98, 0) + dir * 0.74
	if sheet_held: sheet_hands(dt)   # she hauls the cloth in hand over hand: each hand goes with the patch it holds
	var lv := Vector2(vel.x * cos(yaw) - vel.z * sin(yaw), vel.x * sin(yaw) + vel.z * cos(yaw))
	sway_v += ((-lv * 0.17 + Vector2(sin(t * 0.6), cos(t * 0.45)) * 0.02 - sway) * 16.0 - sway_v * 3.4) * dt
	sway += sway_v * dt
	var hy := a_hy
	if look_at_pt != null: hy += clampf(angle_difference(yaw, atan2(look_at_pt.x - pos.x, look_at_pt.z - pos.z)), -1.0, 1.0)
	head_yaw = lerpf(head_yaw, hy, 1.0 - exp(-5.0 * dt))
	var breath := sin(t * 1.7)
	var st := {
		"pos": pos, "yaw": yaw, "dt": dt, "phase": phase, "wk": wk,
		"wind": Vector3(0.10 + 0.07 * sin(t * 0.7), 0, -0.05 + 0.05 * sin(t * 1.1 + 1.0)) - vel * 0.16,
		"bob": 0.02 + 0.013 * sin(t * 1.3) + 0.005 * (wk + rk) * (0.5 - 0.5 * cos(2.0 * phase)), "tm": t,
		"drop": a_drop, "lean": 0.045 * wk + 0.1 * rk + a_lean + 0.008 * breath,
		"roll": 0.012 * wk * sin(phase) + 0.012 * sin(t * 0.8), "twist": (0.02 + 0.04 * rk) * wk * sin(phase) + head_yaw * 0.18,
		"sway": sway, "pool": a_pool, "kick": 0.5 * wk * sin(phase),
		"head_yaw": head_yaw * 0.82, "head_pitch": a_headp + 0.03 * wk,
		"swingL": ((0.03 + 0.08 * rk) * wk * sin(phase) + 0.012 * sin(t * 0.9)) * (1.0 - a_wL), "swingR": (-(0.03 + 0.08 * rk) * wk * sin(phase) + 0.012 * sin(t * 0.9 + 1.7)) * (1.0 - a_wR),
		"hold": a_hold, "raise": a_raise, "open": a_open, "wL": a_wL, "wR": a_wR, "tL": tgtL, "tR": tgtR,
	}
	fig.apply(st); wfig.apply(st)
	for k in ["Bridge", "Cap", "Door", "Boat"]:
		if refl.has_node(k): (refl.get_node(k) as Node3D).transform = (world.get_node(k) as Node3D).transform
	var near := smoothstep(MX + 2.2, MX + 1.5, pos.x) * smoothstep(MZ - 0.8, MZ - 0.5, pos.z) * smoothstep(MZ + 0.8, MZ + 0.5, pos.z) * float(old_world)
	ghost.visible = (not hero_real) and shape_file == "" and near > 0.01
	if shape_file != "":
		var R := rig_of(shape_file)
		gph += spd * dt / lerpf(GT.step, 0.85, rk) * PI
		gait = lerpf(gait, clampf(spd / 0.8, 0.0, 1.0) * (1.0 + 0.3 * rk), 1.0 - exp(-9.0 * dt))
		var gp := gph - 0.37
		hover = 0.003 * sin(t * 1.3) - GT.bob * gait * cos(2.0 * gp)
		var turn := angle_difference(yaw_prev, yaw) / maxf(dt, 0.001); yaw_prev = yaw
		tilt_r = lerpf(tilt_r, clampf(-turn * 0.02, -0.05, 0.05), 1.0 - exp(-5.0 * dt))
		tilt_f = lerpf(tilt_f, GT.lean * wk + 0.04 * rk + clampf((spd - spd_prev) / maxf(dt, 0.001) * 0.005, -0.012, 0.012) + a_lean, 1.0 - exp(-5.0 * dt)); spd_prev = spd
		var side: Vector3 = Vector3(cos(yaw), 0, -sin(yaw)) * (float(GT.shift) * gait * sin(gp))
		for k in SHP:
			var sh: Node3D = SHP[k].holder
			sh.position = pos + side + Vector3(0, hover, 0); sh.rotation = Vector3(tilt_f, yaw + head_yaw * 0.4, tilt_r - 0.012 * gait * sin(gp))
		var lg := leg_pose(gph, 1.0, gait * GT.stride, R); var rg := leg_pose(gph + PI, -1.0, gait * GT.stride, R)
		var l0 := leg_pose(0.0, 1.0, 0.0, R); var r0 := leg_pose(0.0, -1.0, 0.0, R)
		for bm in body_mats:
			bm.set_shader_parameter("trail", Vector3(sway.x, 0.0, sway.y) * GT.trail)
			bm.set_shader_parameter("hipL", lg[0]); bm.set_shader_parameter("kneeL", lg[1]); bm.set_shader_parameter("footL", lg[2])
			bm.set_shader_parameter("hipR", rg[0]); bm.set_shader_parameter("kneeR", rg[1]); bm.set_shader_parameter("footR", rg[2])
			bm.set_shader_parameter("rkneeL", l0[1]); bm.set_shader_parameter("rfootL", l0[2]); bm.set_shader_parameter("rkneeR", r0[1]); bm.set_shader_parameter("rfootR", r0[2])
			bm.set_shader_parameter("leg_zc", R.zc)
			bm.set_shader_parameter("armp", R.arm); bm.set_shader_parameter("arm_on", R.arm_on); bm.set_shader_parameter("adduct", R.adduct)
			bm.set_shader_parameter("swing", Vector2(-GT.arm * gait * cos(gph), GT.arm * gait * cos(gph)) + Vector2(0.012 * sin(t * 0.9), 0.012 * sin(t * 0.9 + 1.7)))
			bm.set_shader_parameter("pelv", -GT.pelv * gait * cos(gph)); bm.set_shader_parameter("shtw", GT.shtw * gait * cos(gph))
		(SHP["ghost"].holder as Node3D).visible = near > 0.01
	if ghost.visible: ghost.apply(st)
	var moving := spd > 0.15
	if rig_file != "": moving = (spd > 0.2 if walk_on else (not route.is_empty() and rem_dist > 0.05)) or turn_amt > (0.3 if walk_on else 0.7)   # a big turn on the spot is made with steps
	for fm in floor_mats: fm.set_shader_parameter("floor_y", pos.y)
	var i4c := ""      # ione4: the clip she should be in. She has steps on the spot for a turn where she stands, and a kneel that a_drop runs forward and back
	if rig_file.begins_with("ione4") and H.has("main") and H["main"].ap != null and (H["main"].ap as AnimationPlayer).has_animation("kneel") and OS.get_environment("IONE4_CLIPS") != "0":
		i4c = "kneel" if a_drop > 0.01 else ("turn_step" if (moving and spd < 0.12 and route.is_empty()) else ("walk" if moving else "idle"))
	if moving != walk_on or (i4c != "" and i4c != String(H["main"].get("clip", "idle"))):
		walk_on = moving
		for h in H.values():
			if h.ap == null: continue
			if i4c != "": h["clip"] = i4c; h.ap.play(i4c, 0.25 if i4c == "kneel" else 0.38 if i4c == "walk" else 0.55)
			else: h.ap.play("walk" if moving else "idle", (0.38 if moving else 0.6) if rig_file != "" else 0.25)
	pose_k = move_toward(pose_k, 1.0 if posing else 0.0, dt / 0.9)   # she comes to stillness, and out of it, over most of a second
	for k in H:
		var hd: Node3D = H[k].holder
		hd.position = pos; hd.rotation.y = yaw
		if H[k].ap == null: continue
		var hap: AnimationPlayer = H[k].ap
		hap.speed_scale = (1.0 - smoothstep(0.0, 1.0, pose_k)) * (clampf(spd / 1.1, 0.4 if rig_file != "" else 0.7, 2.3) if moving else 1.0)
		if i4c == "walk": hap.speed_scale = (1.0 - smoothstep(0.0, 1.0, pose_k)) * clampf(spd / 1.1, 0.25, 2.3)      # her walk is timed for 1.1 m/s: the feet hold the floor at any speed
		elif i4c == "turn_step": hap.speed_scale = (1.0 - smoothstep(0.0, 1.0, pose_k)) * 1.1
		elif i4c == "kneel" and hap.current_animation == "kneel":
			hap.speed_scale = 1.0; hap.seek(clampf(a_drop / 0.5, 0.0, 1.0) * (hap.current_animation_length - 0.06), true)
	if hero_real: (H["ghost"].holder as Node3D).visible = near > 0.01
	var prox := clampf(1.0 - (pos.x - MX - 0.5) / 1.4, 0.0, 1.0)
	flash = move_toward(flash, 0.0, dt * 0.7)
	ghost_flat.albedo_color = TEAL_D.lerp(CRIMSON, near * (0.3 + 0.7 * prox)).lerp(Color("ff5a62"), flash)
	ghost.ghost_mat.albedo_color = ghost_flat.albedo_color
	ripple_p = move_toward(ripple_p, 1.0, dt * 0.75)
	if ripple != null: (ripple.material_override as ShaderMaterial).set_shader_parameter("p", ripple_p)
	pulse_p = move_toward(pulse_p, 1.0, dt * 0.6); (pulse.material_override as ShaderMaterial).set_shader_parameter("p", pulse_p)
	tap_p = move_toward(tap_p, 1.0, dt * 1.6); (tapring.material_override as ShaderMaterial).set_shader_parameter("p", tap_p)
	use_p = move_toward(use_p, 1.0, dt * 1.1); (usering.material_override as ShaderMaterial).set_shader_parameter("p", use_p)
	refl_p = move_toward(refl_p, 1.0, dt * 1.3); (refl_ring.material_override as ShaderMaterial).set_shader_parameter("p", refl_p)
	for gi in turn_gem.size():      # the stud on a turning statue's base beats while she is near enough to use it
		var nearg: bool = hand_play and started and not turned_done and not busy and Vector2(pos.x - TURN_AT[gi].x, pos.z - TURN_AT[gi].z).length() < NEAR_MARK
		(turn_gem[gi] as Node3D).scale = Vector3.ONE * (1.0 + (0.45 * (0.5 + 0.5 * sin(t * 4.2)) if nearg else 0.0))
		if nearg and not turn_hinted: turn_hinted = true; say("tap a statue to turn it")
	if hand_play and started and not water_hinted and not busy and H.has("mir"):
		for pr in _pools():
			if _rect_dist(pos, pr) < 0.8: water_hinted = true; say("tap the water: her reflection can cross where you cannot")
	if lamp_held:
		lamp_vel += ((-vel * 0.045 - lamp_off) * 40.0 - lamp_vel * 4.0) * dt
		lamp_off += lamp_vel * dt
		lamp.position = fig.hand_pos("R") + Vector3(0, -0.175, 0) + lamp_off
	var le := lamp_energy * (1.0 + 0.03 * sin(t * 9.0))
	lamp_halo.scale = Vector3.ONE * (0.35 + le * 1.5)
	door_halo.scale = Vector3.ONE * door_energy; door_halo.visible = door_energy > 0.01
	lights[0] = Vector4(lamp.position.x, lamp.position.y, lamp.position.z, le)
	lights[1] = Vector4(DX, 0.8, -26.5, door_energy)
	var cc := cam_t if shot == null else (shot.c as Vector3)
	for m in pmats.values():
		for i in 7: m.set_shader_parameter("l%d" % i, lights[i])
		m.set_shader_parameter("centre", cc); m.set_shader_parameter("mist_r", maxf(cam.size * 0.64, 6.5))
	for fm in fogs:
		fm.set_shader_parameter("hero", cc); fm.set_shader_parameter("far_a", maxf(cam.size * 0.3, 3.5)); fm.set_shader_parameter("far_b", maxf(cam.size * 0.95, 10.0))
	sea_mat.set_shader_parameter("centre", cc); sea_mat.set_shader_parameter("mist_r", maxf(cam.size * 0.64, 6.5)); sea_mat.set_shader_parameter("time_s", t)
	for m in timed: m.set_shader_parameter("time_s", t)
	for i in gulls.size():
		var gn: Node3D = gulls[i]
		var ga := t * (0.16 + 0.03 * i) + i * 2.1
		var gk := 1.9 + 0.27 * cam.size + 0.18 * i   # their rings lie over the far (upper) part of the picture: they used to cross its very middle, over her head
		gn.position = cam_t + Vector3(cos(ga) * (4.0 + i), 3.2 + i * 0.6 + 0.3 * sin(t * 0.7 + i), sin(ga) * (3.0 + i * 0.8)) + Vector3(-gk, 0, -gk)
		gn.rotation.y = -ga
		var flap := sin(t * 5.0 + i) * 0.45
		(gn.get_child(0) as Node3D).rotation.z = -flap; (gn.get_child(1) as Node3D).rotation.z = flap
	if boat != null: boat.position.y = WATER - 0.12 + 0.03 * sin(t * 1.1); boat.rotation.z = 0.04 * sin(t * 0.8)
	blob.visible = false
	for k in markers:
		var n: Node3D = markers[k]
		n.visible = started and not done.has(k) and shot == null
		if k in NOMARK or not objs[k].get("mark", true): n.visible = false; continue
		if k in QUIET:      # seen only from near (a few steps): it grows out of nothing as she comes, and goes as she leaves
			var nearby := Vector2(pos.x - objs[k].stand.x, pos.z - objs[k].stand.z).length() < NEAR_MARK and not busy
			n.scale = Vector3.ONE * move_toward(n.scale.x, 1.0 if nearby else 0.001, dt * 2.5)
			if n.scale.x < 0.01: n.visible = false
		n.position.y = objs[k].at.y + (0.55 if k != "mirror" else 1.35) + 0.05 * sin(t * 2.4)
		n.rotation.y = t * 1.2
	if not carry.is_empty():      # a thing in a hand goes where the hand goes
		var csk: Skeleton3D = carry.sk
		(carry.node as Node3D).global_position = csk.global_transform * csk.get_bone_global_pose(carry.bone).origin + Vector3(0, 0.24 if carry.flip else -0.24, 0)
	if cam_focus_on: cam_t = cam_t.lerp(cam_focus, 1.0 - exp(-1.8 * dt))
	elif rig_file != "": cam_t = cam_t.lerp(pos + vel * 0.25, 1.0 - exp(-4.0 * dt))
	else: cam_t = cam_t.lerp(pos + vel * 0.55, 1.0 - exp(-2.4 * dt))
	cam.position = cam_t + cam.basis.y * (1.9 if cam.size > 5.0 else 0.85) + cam.basis.z * 34.0
	if shot != null: cam.position = (shot.c as Vector3) + cam.basis.z * maxf(34.0, cam.size * 1.33)   # a very wide still (the map) from further back, or the sea at its foot falls behind the eye and is cut off
	if old_world and started and not ended and pos.z < KZ0 - 0.25: _end()

# ---------------------------------------------------------------- what she can do
func wait(s: float) -> void:
	await get_tree().create_timer(s).timeout

func go(pts: Array, cap := WALK) -> void:
	speed_cap = cap
	route.clear()
	for q in pts: route.append({"p": q})
	await arrived

func face(p: Vector3) -> void:
	face_to = p
	await faced

func tw() -> Tween:
	return create_tween().set_parallel().set_trans(Tween.TRANS_SINE).set_ease(Tween.EASE_IN_OUT).set_speed_scale(0.7)

func _self() -> void:
	busy = true
	if lamp_held:
		var f := tw()
		f.tween_property(self, "a_raise", 1.0, 0.6); f.tween_property(self, "a_headp", -0.22, 0.6); f.tween_property(self, "lamp_energy", 1.7, 0.8)
		await f.finished
		pulse.position = Vector3(pos.x, 0.03, pos.z); pulse_p = 0.0
		await wait(0.9)
		var g := tw()
		g.tween_property(self, "a_raise", 0.0, 0.6); g.tween_property(self, "a_headp", 0.0, 0.6); g.tween_property(self, "lamp_energy", 1.0, 0.8)
		await g.finished
	else:
		var h := create_tween().set_trans(Tween.TRANS_SINE).set_ease(Tween.EASE_IN_OUT)
		h.tween_property(self, "a_hy", -0.85, 0.7); h.tween_interval(0.3)
		h.tween_property(self, "a_hy", 0.7, 0.9); h.tween_interval(0.3); h.tween_property(self, "a_hy", 0.0, 0.5)
		await h.finished
	busy = false
	settled.emit()

func _do_capstan() -> void:
	await face(CAP + Vector3(-1.4, 0, 0.66))
	pushing = true
	var a := tw()
	a.tween_property(self, "a_wL", 1.0, 0.45); a.tween_property(self, "a_wR", 1.0, 0.45); a.tween_property(self, "a_lean", 0.2, 0.45)
	await a.finished
	var arc := []
	for i in range(1, 10): arc.append(CAP + Vector3(sin(-PI * 0.5 * i / 9.0), 0, cos(-PI * 0.5 * i / 9.0)) * 0.66)
	await go(arc, 0.5)
	await wait(0.15)
	pushing = false
	var b := tw()
	b.tween_property(self, "a_wL", 0.0, 0.45); b.tween_property(self, "a_wR", 0.0, 0.45); b.tween_property(self, "a_lean", 0.0, 0.45)
	await b.finished
	rects["BR"].on = true; done["capstan"] = true
	say("the bridge has turned")

func _do_turn1() -> void: await _turn(0)
func _do_turn2() -> void: await _turn(1)
func _do_turn3() -> void: await _turn(2)

## Her palms lie flat on the marble, on the side of it that faces her, and go round with it: the statue turns clockwise
## (seen from above), so what she pushes passes from her right to her left. s: how far the quarter turn has got, 0..1.
## Each palm stays on the marble (see _statue_girth) and faces the way the marble faces there
func _turn_hands(i: int, hy: float, s: float) -> void:
	for sd in 2:
		var wy := hy + deg_to_rad((34.0 if sd == 1 else 8.0) - 42.0 * s)      # the right hand begins well to her right, the left ends well to her left
		var p := _girth_at(i, wy); var a := _girth_at(i, wy - 0.12); var b := _girth_at(i, wy + 0.12)
		var along := b - a; var nrm := Vector3(-along.z, 0, along.x).normalized()      # square to the marble's outline there, outward
		if nrm.dot(p - (TURN_AT[i] as Vector3)) < 0.0: nrm = -nrm
		if sd == 1: tgtR = p; palm_nR = nrm
		else: tgtL = p; palm_nL = nrm

## she lays her hands on a statue and turns it a quarter round on its plinth; the pinion beside it runs the other way.
## more: another quarter of the same statue follows at once, so her hands stay up and only come back across it
func _turn(i: int, more := false) -> void:
	if turned_done: return
	var at: Vector3 = TURN_AT[i]
	await face(at)
	var hy := atan2(pos.x - at.x, pos.z - at.z)      # where she stands, as a yaw about the plinth's axis
	if palm_on and a_wL > 0.5:      # her hands are still on it from the quarter before: they let go a little and come back to her right
		var back := create_tween().set_trans(Tween.TRANS_SINE).set_ease(Tween.EASE_IN_OUT)
		back.tween_method(func(s: float) -> void: _turn_hands(i, hy, s), 1.0, 0.0, 0.5)
		var off := create_tween().set_parallel().set_trans(Tween.TRANS_SINE)
		off.tween_property(self, "a_wL", 0.8, 0.25); off.tween_property(self, "a_wR", 0.8, 0.25)
		off.chain().tween_property(self, "a_wL", 1.0, 0.25); off.parallel().tween_property(self, "a_wR", 1.0, 0.25)
		await back.finished
	else:
		_turn_hands(i, hy, 0.0); palm_on = true; palm_gap = 0.0
		var up := tw(); up.tween_property(self, "a_wL", 1.0, 0.55); up.tween_property(self, "a_wR", 1.0, 0.55); up.tween_property(self, "a_lean", 0.4, 0.55)
		await up.finished
	var n: Node3D = turn_n[i]; var pn: Node3D = turn_pin[i]
	var y0 := n.rotation.y
	var step := func(a: float) -> void:      # the wheel carries drum and statue; the pinion keeps its teeth in the wheel's; her palms go with the marble
		n.rotation.y = a; pn.rotation.y = _pinion_yaw(a); _turn_hands(i, hy, (y0 - a) / (PI * 0.5))
	var rt := create_tween().set_trans(Tween.TRANS_SINE).set_ease(Tween.EASE_IN_OUT)
	rt.tween_method(step, y0, y0 - PI * 0.5, 1.5)
	await rt.finished
	turn_q[i] = (turn_q[i] + 1) % 4
	if OS.get_environment("S3_ONE") != "": print("TURN ", i, " palms fell short by at most ", snappedf(palm_gap, 0.01), " hand lengths")
	if not more:
		var dn := tw(); dn.tween_property(self, "a_wL", 0.0, 0.5); dn.tween_property(self, "a_wR", 0.0, 0.5); dn.tween_property(self, "a_lean", 0.0, 0.5)
		await dn.finished
		palm_on = false
	await _turned_check()

## each stud turns gold when its statue stands as the water shows; when all three do, the south gate goes down
func _turned_check() -> void:
	var all := true
	for i in 3:
		var ok: bool = turn_q[i] == TURN_GOAL[i]
		(turn_gem[i] as MeshInstance3D).material_override = mat(Color("ffd36b") if ok else Color("ff5a62"))
		if not ok: all = false
	if not all or turned_done: return
	turned_done = true
	for i in 3: done["turn%d" % (i + 1)] = true
	await wait(0.7)
	var gt := create_tween(); gt.tween_property(gate_e, "position:y", -2.4, 2.4).set_trans(Tween.TRANS_SINE)
	await gt.finished
	rects["G1"].on = true

func _do_mirror() -> void:
	await face(Vector3(MX, 0, MZ))
	var i := tw()
	i.tween_property(self, "a_drop", 0.16, 0.6); i.tween_property(self, "a_lean", 0.36, 0.6); i.tween_property(self, "a_headp", 0.3, 0.6)
	i.tween_property(self, "a_open", 1.0, 0.6); i.tween_property(self, "a_pool", 0.3, 0.6)
	await i.finished
	await wait(0.35)
	var j := tw()
	j.tween_property(self, "a_drop", 0.0, 0.6); j.tween_property(self, "a_lean", 0.0, 0.6); j.tween_property(self, "a_headp", 0.0, 0.6)
	j.tween_property(self, "a_open", 0.0, 0.6); j.tween_property(self, "a_pool", 0.0, 0.6)
	await j.finished
	tgtL = Vector3(MX + 0.012, 1.30, MZ + 0.13)
	ripple.position = Vector3(MX - 0.03, 1.30, MZ + 0.13)
	var k := tw()
	k.tween_property(self, "a_wL", 1.0, 0.8); k.tween_property(self, "a_lean", 0.09, 0.8)
	await k.finished
	ripple_p = 0.0; flash = 1.0
	var l := tw()
	l.tween_property(door, "position:y", door.position.y - 2.15, 1.7).set_delay(0.3)
	l.tween_property(self, "door_energy", 1.0, 1.7).set_delay(0.3)
	await wait(1.5)
	var m := tw()
	m.tween_property(self, "a_wL", 0.0, 0.7); m.tween_property(self, "a_lean", 0.0, 0.7)
	await m.finished
	rects["G"].on = true; done["mirror"] = true
	say("the door has opened")

func _end() -> void:
	ended = true
	end_box.visible = true
	create_tween().tween_property(end_box, "modulate:a", 1.0, 1.6)

# ---------------------------------------------------------------- the court of the crane
func _pocket_add(k: String) -> void:
	if pocket.size() >= 3: return
	pocket.append(k); (pocket_ui as Pocket).items = pocket.duplicate(); (pocket_ui as Pocket).pop = 1.0; pocket_ui.queue_redraw()
func _pocket_take(k: String) -> void:
	pocket.erase(k); (pocket_ui as Pocket).items = pocket.duplicate(); pocket_ui.queue_redraw()

func _hold(node: Node3D, who: String) -> void:      # a thing goes into her right hand ("main") or her reflection's (an entry of H, or the body that is out)
	var e: Dictionary = refl_out if who == "out" else H[who]
	var sk: Skeleton3D = e.sk
	carry = {"node": node, "sk": sk, "bone": _bone(sk, "RightHand"), "flip": who != "main"}
	node.visible = true; node.rotation = Vector3(0, 0, PI * 0.5 if who != "main" else -PI * 0.5)      # it hangs from the hand by its ring

func _hermod(e: Dictionary) -> HerMod:
	for c in (e.sk as Skeleton3D).get_children():
		if c is HerMod: return c
	return null

## her reflection as a body to direct: taken from under her, or from where it already stands on the water
func _refl_take() -> Dictionary:
	var e: Dictionary
	if refl_out.is_empty(): e = H["mir"]; H.erase("mir")
	else: refl_token += 1; e = refl_out; refl_out = {}
	if not carry.is_empty() and carry.flip: carry.sk = e.sk
	return e

func _refl_walk(e: Dictionary, pi: int, to: Vector3, speed := 0.85) -> void:
	for wp in _refl_way(pi, (e.holder as Node3D).position, to): await _eid_go(e, Vector3(wp.x, _refl_h(pi), wp.z), speed)

## it walks back along its way to the head of it, then under her feet, turns to stand as she stands, and is hers again
func _refl_back(e: Dictionary, pi: int) -> void:
	await _refl_walk(e, pi, _cross_line(pi)[0])
	await _eid_go(e, Vector3(pos.x, 0, pos.z), 0.8)
	var hd: Node3D = e.holder
	var rt := create_tween(); rt.tween_property(hd, "rotation:y", hd.rotation.y + angle_difference(hd.rotation.y, yaw), 0.4).set_trans(Tween.TRANS_SINE)
	await rt.finished
	H["mir"] = e

## she takes the crank from the workbench
func _do_bench() -> void:
	await face(KBENCH)
	tgtR = kcrank_bench.global_position + Vector3(0, 0.03, 0)
	var a := tw(); a.tween_property(self, "a_wR", 1.0, 0.5); a.tween_property(self, "a_lean", 0.3, 0.5); a.tween_property(self, "a_headp", 0.25, 0.5)
	await a.finished
	await wait(0.25)
	kcrank_bench.visible = false
	var b := tw(); b.tween_property(self, "a_wR", 0.0, 0.5); b.tween_property(self, "a_lean", 0.0, 0.5); b.tween_property(self, "a_headp", 0.0, 0.5)
	await b.finished
	_pocket_add("crank"); done["bench"] = true

## the crank post: without the crank there is nothing to turn it by. With it: the first time she fits it; after that
## each use turns the crane to its next place (the islet, the door, the islet...)
func _do_crane() -> void:
	while not refl_out.is_empty(): await get_tree().process_frame
	await face(KPOST)
	var head := KPOST + Vector3(0, 1.0, 0)
	if not crank_on:
		tgtR = head
		var a := tw(); a.tween_property(self, "a_wR", 1.0, 0.5); a.tween_property(self, "a_lean", 0.14, 0.5)
		await a.finished
		if pocket.has("crank"):
			_pocket_take("crank"); kcrank.visible = true; crank_on = true
			kcrank.scale = Vector3.ONE * 1.25; create_tween().tween_property(kcrank, "scale", Vector3.ONE, 0.3)
		else: say("a square head, and nothing to turn it by")
		await wait(0.35)
		var b := tw(); b.tween_property(self, "a_wR", 0.0, 0.5); b.tween_property(self, "a_lean", 0.0, 0.5)
		await b.finished
		return
	await _crane_turn(2 if crane_i == 1 else 1)

## she pushes the crank round; the small wheel on its post drives the turntable, and the crane swings to its i-th place
func _crane_turn(i: int) -> void:
	var a0: float = KANG[crane_i]; var a1: float = KANG[i]
	var grip := func() -> Vector3: return kpin.global_transform * Vector3(0.293, 1.12, 0.0)
	tgtR = grip.call()
	var up := tw(); up.tween_property(self, "a_wR", 1.0, 0.45); up.tween_property(self, "a_lean", 0.16, 0.45)
	await up.finished
	var p0 := kpin.rotation.y
	var step := func(a: float) -> void:
		crane_n.rotation.y = -deg_to_rad(a); crane_m.rotation.y = -deg_to_rad(a)
		kpin.rotation.y = p0 + deg_to_rad(a - a0) * KGEAR
		tgtR = grip.call()
	var rt := create_tween().set_trans(Tween.TRANS_SINE).set_ease(Tween.EASE_IN_OUT)
	rt.tween_method(step, a0, a1, 1.2 + absf(a1 - a0) / 22.0)
	await rt.finished
	crane_i = i
	var dn := tw(); dn.tween_property(self, "a_wR", 0.0, 0.45); dn.tween_property(self, "a_lean", 0.0, 0.45)
	await dn.finished

## she kneels at the quay's edge and puts her right hand to the water; her reflection does the same from below, and
## their hands meet at the surface. give: the key goes down from her hand to its hand; else it comes up
func _through_water(give: bool) -> void:
	var d := _crane_dir()
	var edge := KPIV + d * (KQUAY - 0.2)
	await go([edge])
	await face(KPIV + d * 3.0)
	if give: _pocket_take("key"); _hold(kkey, "main")
	tgtR = KPIV + d * (KQUAY + 0.16) + Vector3(0, 0.02, 0)
	var a := tw()
	a.tween_property(self, "a_drop", 0.5, 0.8); a.tween_property(self, "a_lean", 0.5, 0.8); a.tween_property(self, "a_headp", 0.3, 0.8); a.tween_property(self, "a_wR", 1.0, 0.8)
	await a.finished
	refl_ring.position = Vector3(tgtR.x, 0.03, tgtR.z); refl_p = 0.0
	await wait(0.3)
	_hold(kkey, "mir" if give else "main")
	await wait(0.3)
	var b := tw()
	b.tween_property(self, "a_drop", 0.0, 0.8); b.tween_property(self, "a_lean", 0.0, 0.8); b.tween_property(self, "a_headp", 0.0, 0.8); b.tween_property(self, "a_wR", 0.0, 0.8)
	await b.finished
	if not give:
		await wait(0.2); carry = {}; kkey.visible = false; _pocket_add("key")
	await go([KPIV + d * KSTAND])
	await face(KPIV + d * 3.0)

## the key that hangs in the water: her reflection goes out along the timber for it. It reaches it only when the
## timber lies toward the islet; then it brings the key back, and she takes it out of the water
func _do_wkey() -> void:
	if not H.has("mir") and refl_out.is_empty(): return
	var d := _crane_dir()
	await face(KPIV + d * 3.0)
	var e := _refl_take(); var hd: Node3D = e.holder
	await _refl_walk(e, 1, KPIV + d * BEAM_R1)
	if crane_i != 1:
		await wait(0.7)
		say("the key is out of its reach")
		await _refl_back(e, 1); return
	hd.rotation.y = atan2(d.x, d.z)
	var hm := _hermod(e)
	hm.tR = Vector3(kkey_top.x, -(kkey_top.y - 0.3), kkey_top.z); hm.own = true
	var up := create_tween().set_parallel(); up.tween_property(hm, "wR", 1.0, 0.6); up.tween_property(hm, "bow", 0.06, 0.6)
	await up.finished
	await wait(0.3)
	kribbon.visible = false
	carry = {"node": kkey, "sk": e.sk, "bone": _bone(e.sk, "RightHand"), "flip": true}; kkey.rotation = Vector3(0, 0, PI * 0.5)
	var dn := create_tween().set_parallel(); dn.tween_property(hm, "wR", 0.0, 0.6); dn.tween_property(hm, "bow", 0.0, 0.6)
	await dn.finished
	hm.own = false
	await _refl_back(e, 1)
	carry.sk = H["mir"].sk
	await _through_water(false)
	done["wkey"] = true

## the door that only the water has: her reflection goes to it along the timber when the timber lies that way. With
## the key (she gives it down through the water first) it opens; and then the wall above opens too
func _do_wdoor() -> void:
	if not H.has("mir") and refl_out.is_empty(): return
	var d := _crane_dir()
	await face(KPIV + d * 3.0)
	var has_key := pocket.has("key")
	if crane_i == 2 and has_key:
		if not refl_out.is_empty(): await _refl_back(_refl_take(), 1)
		await _through_water(true)
	var e := _refl_take(); var hd: Node3D = e.holder
	if not carry.is_empty(): carry.sk = e.sk
	await _refl_walk(e, 1, Vector3(KDOOR_X, 0, WZ0 + 0.36) if crane_i == 2 else KPIV + d * BEAM_R1)
	if crane_i != 2:
		await wait(0.7)
		say("the door is out of its reach")
		await _refl_back(e, 1); return
	var trn := create_tween(); trn.tween_property(hd, "rotation:y", hd.rotation.y + angle_difference(hd.rotation.y, PI), 0.35)      # it turns to the door
	await trn.finished
	var hm := _hermod(e)
	hm.tR = Vector3(KDOOR_X + 0.34, -1.04, WZ0 + 0.02); hm.own = true
	var up := create_tween().set_parallel(); up.tween_property(hm, "wR", 1.0, 0.6); up.tween_property(hm, "bow", 0.06, 0.6)
	await up.finished
	if not has_key:
		await wait(0.8)
		var dn0 := create_tween().set_parallel(); dn0.tween_property(hm, "wR", 0.0, 0.5); dn0.tween_property(hm, "bow", 0.0, 0.5)
		await dn0.finished
		hm.own = false
		say("locked")
		await _refl_back(e, 1); return
	await wait(0.4)
	carry = {}; kkey.visible = false      # the key is in the lock
	var s0 := cam.size
	cam_focus = Vector3(KDOOR_X + 0.6, 0.4, WZ0 + 1.6); cam_focus_on = true
	create_tween().tween_property(cam, "size", minf(s0, 7.6), 1.6).set_trans(Tween.TRANS_SINE)
	var op := create_tween().set_parallel().set_trans(Tween.TRANS_SINE).set_ease(Tween.EASE_IN_OUT)
	op.tween_property(kdoor_m, "rotation:y", 1.75, 1.8)
	await wait(0.6)
	var dn := create_tween().set_parallel(); dn.tween_property(hm, "wR", 0.0, 0.6); dn.tween_property(hm, "bow", 0.0, 0.6)
	await op.finished
	hm.own = false
	await wait(0.4)
	# above the water the wall answers: the stone that closed the doorway goes down, light comes through, and a
	# ledge comes out of the wall's foot, stone by stone, from the court's floor to the door
	khalo.visible = true
	var pl := create_tween().set_parallel().set_trans(Tween.TRANS_SINE).set_ease(Tween.EASE_IN_OUT)
	pl.tween_property(kplug, "position:y", -(KDOOR_H + 0.1), 2.6); pl.tween_property(khalo, "scale", Vector3.ONE, 2.6)
	await wait(1.6)
	for i in kledge.size():
		create_tween().tween_property(kledge[i], "position:z", 0.0, 0.7).set_trans(Tween.TRANS_BACK).set_ease(Tween.EASE_OUT)
		await wait(0.28)
	if pl.is_running(): await pl.finished
	await wait(0.5)
	rects["Kl"].on = true; rects["Kd"].on = true
	done["wdoor"] = true; done["crane"] = true; done["wkey"] = true
	looks.erase("kwall")
	await _refl_back(e, 1)
	cam_focus_on = false
	create_tween().tween_property(cam, "size", s0, 1.4)
	say("the wall has opened")

## (to look at) she is by the crane's court; a stele is tapped, then the statue on the islet
func _look_test() -> void:
	started = true; title_box.hide(); hint.hide(); cam.size = PLAY_SIZE
	await wait(0.4)
	tap(cam.unproject_position(looks["stele_k"].foot + Vector3(0, 0.7, 0)))
	await wait(9.0)
	for k in looks:
		if (looks[k].foot as Vector3).distance_to(KISLE + Vector3(0.08, 0, 0)) < 0.1: tap(cam.unproject_position(looks[k].foot + Vector3(0, 0.9, 0)))
	await wait(4.0)
	get_tree().quit()

## (test) the fourth court played by taps alone, from the bridge to the end of the demo. Prints what each tap led to
func _hand_test4() -> void:
	started = true; title_box.hide(); hint.hide(); cam.size = PLAY_SIZE
	var settle := func(secs: float) -> void:
		for i in int(secs * 30.0): await get_tree().process_frame
		var n := 0
		while (busy or not route.is_empty() or pending != "") and n < 3000: n += 1; await get_tree().process_frame
		for i in 10: await get_tree().process_frame
	var tap_at := func(p: Vector3) -> void:
		cam_t = pos
		for i in 40: await get_tree().process_frame
		tap(cam.unproject_position(p))
	await wait(0.5)
	print("HAND4 start at ", pos.snapped(Vector3.ONE * 0.01), " pocket ", pocket)
	await tap_at.call(looks["stele_k"].foot + Vector3(0, 0.7, 0)); await settle.call(2.0)
	print("HAND4 a tap on the stele: she stands at ", pos.snapped(Vector3.ONE * 0.01), " (", snappedf(Vector2(pos.x - looks["stele_k"].foot.x, pos.z - looks["stele_k"].foot.z).length(), 0.01), " m from it), its next line is no. ", looks["stele_k"].i)
	await tap_at.call(objs["crane"].at); await settle.call(1.0)
	print("HAND4 a tap on the crank post without the crank: crank on ", crank_on, " crane at place ", crane_i)
	await tap_at.call(Vector3(-17.4, 0.012, -36.0)); await settle.call(6.0)
	print("HAND4 a tap on the water: she is at ", pos.snapped(Vector3.ONE * 0.01), " her reflection is ", "out, at " + str((refl_out.holder as Node3D).position.snapped(Vector3.ONE * 0.01)) if not refl_out.is_empty() else "not out")
	await tap_at.call(objs["wkey"].at); await settle.call(2.0)
	print("HAND4 a tap on the key while the timber points away: pocket ", pocket, " key taken ", done.has("wkey"))
	await tap_at.call(objs["bench"].at); await settle.call(1.0)
	print("HAND4 a tap on the workbench: pocket ", pocket)
	await tap_at.call(objs["crane"].at); await settle.call(1.0)
	print("HAND4 a tap on the crank post: crank on ", crank_on, " pocket ", pocket, " crane at place ", crane_i)
	await tap_at.call(objs["crane"].at); await settle.call(1.0)
	print("HAND4 a second tap on it: crane at place ", crane_i, " (its arm at ", snappedf(rad_to_deg(-crane_n.rotation.y), 0.1), " degrees)")
	await tap_at.call(objs["wdoor"].at); await settle.call(2.0)
	print("HAND4 a tap on the door while the timber points at the islet: open ", done.has("wdoor"))
	await tap_at.call(objs["wkey"].at); await settle.call(2.0)
	print("HAND4 a tap on the key: pocket ", pocket, " key taken ", done.has("wkey"), " she is at ", pos.snapped(Vector3.ONE * 0.01))
	await tap_at.call(objs["crane"].at); await settle.call(1.0)
	print("HAND4 a third tap on the crank post: crane at place ", crane_i)
	await tap_at.call(objs["wdoor"].at); await settle.call(2.0)
	print("HAND4 a tap on the door in the water: open ", done.has("wdoor"), " pocket ", pocket, " ledge ", rects["Kl"].on, " plug at ", snappedf(kplug.position.y, 0.01))
	await tap_at.call(Vector3(KDOOR_X, 0, WZ0 + 0.3)); await settle.call(1.0)
	print("HAND4 a tap on the ledge before the door: she is at ", pos.snapped(Vector3.ONE * 0.01))
	await tap_at.call(Vector3(KDOOR_X, 0, KZ0 - 0.6)); await settle.call(2.0)
	print("HAND4 a tap through the doorway: she is at ", pos.snapped(Vector3.ONE * 0.01), " ended ", ended)
	get_tree().quit()

## the fourth puzzle, "the crane", solved from the way in to the open wall (for recordings)
func _solve4() -> void:
	started = true; title_box.hide(); hint.hide()
	rects["G"].on = true; door.position.y -= 2.15
	pos = Vector3(DX, 0, -30.4); yaw = PI; cam_t = pos + Vector3(-0.6, 0, -3.4); cam.size = 10.2
	cam_focus = Vector3(-17.3, 0.2, -36.6); cam_focus_on = true
	var from := OS.get_environment("K4_FROM")      # (to look closely) "key": from her place under the arm, the timber at the islet; "door": the same at the door, the key in her pocket
	if from != "":
		crank_on = true; kcrank.visible = true; kcrank_bench.visible = false; done["bench"] = true
		crane_i = 1 if from == "key" else 2
		crane_n.rotation.y = -deg_to_rad(KANG[crane_i]); crane_m.rotation.y = crane_n.rotation.y
		pos = KPIV + _crane_dir() * KSTAND; yaw = atan2(_crane_dir().x, _crane_dir().z); cam.size = float(OS.get_environment("K4_SIZE")) if OS.get_environment("K4_SIZE") != "" else 6.0
		cam_focus = Vector3(-18.0, 0.2, -37.6) if from == "key" else Vector3(-17.9, 0.2, -38.3); cam_t = cam_focus
		await wait(0.6)
		if from == "key": await _do_wkey()
		else:
			kribbon.visible = false; kkey.visible = false; done["wkey"] = true; _pocket_add("key")
			await _do_wdoor()
			await wait(0.6)
			await go([Vector3(KPIV.x + 0.92, 0, KPIV.z - 0.89), Vector3(KPIV.x - 0.95, 0, KPIV.z - 0.89), Vector3(KPIV.x - 0.95, 0, WZ0 + 0.3), Vector3(KDOOR_X, 0, WZ0 + 0.3), Vector3(KDOOR_X, 0, KZ0 - 0.6)])
		await wait(1.5)
		get_tree().quit(); return
	await wait(0.8)
	if OS.get_environment("K4LOG") == "1": print("K4 step 1 at ", pos, " frame ", Engine.get_frames_drawn())
	await go([Vector3(DX, 0, KZ1 - 0.9), Vector3(DX - 0.2, 0, WZ1 + 0.7)])
	if OS.get_environment("K4LOG") == "1": print("K4 step 2 at ", pos, " frame ", Engine.get_frames_drawn())
	await face(Vector3(-17.2, 0, -38.0))
	if OS.get_environment("K4LOG") == "1": print("K4 step 3 at ", pos, " frame ", Engine.get_frames_drawn())
	await wait(2.2)
	if OS.get_environment("K4LOG") == "1": print("K4 step 4 at ", pos, " frame ", Engine.get_frames_drawn())
	await go([Vector3((objs["bench"].stand as Vector3).x, 0, WZ1 + 0.9), objs["bench"].stand])
	if OS.get_environment("K4LOG") == "1": print("K4 step 5 at ", pos, " frame ", Engine.get_frames_drawn())
	await _do_bench()
	if OS.get_environment("K4LOG") == "1": print("K4 step 6 at ", pos, " frame ", Engine.get_frames_drawn())
	await wait(0.4)
	if OS.get_environment("K4LOG") == "1": print("K4 step 7 at ", pos, " frame ", Engine.get_frames_drawn())
	await go([Vector3(-18.0, 0, WZ1 + 0.9), Vector3(KPIV.x - 1.2, 0, WZ1 + 0.9), objs["crane"].stand])
	if OS.get_environment("K4LOG") == "1": print("K4 step 8 at ", pos, " frame ", Engine.get_frames_drawn())
	await _do_crane()
	if OS.get_environment("K4LOG") == "1": print("K4 step 9 at ", pos, " frame ", Engine.get_frames_drawn())
	await wait(0.3)
	if OS.get_environment("K4LOG") == "1": print("K4 step 10 at ", pos, " frame ", Engine.get_frames_drawn())
	await _do_crane()
	if OS.get_environment("K4LOG") == "1": print("K4 step 11 at ", pos, " frame ", Engine.get_frames_drawn())
	await wait(0.4)
	if OS.get_environment("K4LOG") == "1": print("K4 step 12 at ", pos, " frame ", Engine.get_frames_drawn())
	var way := func(i: int) -> Array:      # from the crank post round the mast to her place under the arm
		var h := KPIV + _crane_dir(i) * KSTAND
		return [Vector3(KPIV.x - 0.9, 0, KPIV.z + 0.89), Vector3(KPIV.x + 0.92, 0, KPIV.z + 0.89), h]
	await go(way.call(1))
	if OS.get_environment("K4LOG") == "1": print("K4 step 13 at ", pos, " frame ", Engine.get_frames_drawn())
	await _do_wkey()
	if OS.get_environment("K4LOG") == "1": print("K4 step 14 at ", pos, " frame ", Engine.get_frames_drawn())
	await wait(0.5)
	if OS.get_environment("K4LOG") == "1": print("K4 step 15 at ", pos, " frame ", Engine.get_frames_drawn())
	var back := func() -> Array:
		return [Vector3(KPIV.x + 0.92, 0, KPIV.z + 0.89), Vector3(KPIV.x - 0.9, 0, KPIV.z + 0.89), objs["crane"].stand]
	await go(back.call())
	if OS.get_environment("K4LOG") == "1": print("K4 step 16 at ", pos, " frame ", Engine.get_frames_drawn())
	await _do_crane()
	if OS.get_environment("K4LOG") == "1": print("K4 step 17 at ", pos, " frame ", Engine.get_frames_drawn())
	await wait(0.4)
	if OS.get_environment("K4LOG") == "1": print("K4 step 18 at ", pos, " frame ", Engine.get_frames_drawn())
	await go(way.call(2))
	if OS.get_environment("K4LOG") == "1": print("K4 step 19 at ", pos, " frame ", Engine.get_frames_drawn())
	await _do_wdoor()
	if OS.get_environment("K4LOG") == "1": print("K4 step 20 at ", pos, " frame ", Engine.get_frames_drawn())
	await wait(0.8)
	if OS.get_environment("K4LOG") == "1": print("K4 step 21 at ", pos, " frame ", Engine.get_frames_drawn())
	await go([Vector3(KPIV.x + 0.92, 0, KPIV.z - 0.89), Vector3(KPIV.x - 0.95, 0, KPIV.z - 0.89), Vector3(KPIV.x - 0.95, 0, WZ0 + 0.3), Vector3(KDOOR_X, 0, WZ0 + 0.3), Vector3(KDOOR_X, 0, KZ0 - 0.6)])
	if OS.get_environment("K4LOG") == "1": print("K4 step 22 at ", pos, " frame ", Engine.get_frames_drawn())
	if DisplayServer.get_name() == "headless": print("SOLVE4 end at frame ", Engine.get_process_frames(), " ", pos, " ended ", ended, " pocket ", pocket, " crane at ", crane_i, " done ", done.keys())

# ---------------------------------------------------------------- scripted run (for recordings and tests)
func _auto() -> void:
	get_tree().create_timer(140.0).timeout.connect(func() -> void: print("AUTO watchdog at ", pos, " busy ", busy, " pending ", pending); get_tree().quit())
	await wait(1.2)
	tap(Vector2(360, 600))
	await wait(1.0)
	await _a_walk(Vector3(-1.8, 0, 1.6))
	_self(); await settled
	await _a_walk(Vector3(4.4, 0, 1.0))
	await wait(0.5)
	if objs.has("capstan"): await _a_use("capstan")
	await _a_walk(Vector3(-16.3, 0, -13.5), 2.7)
	_self(); await settled
	await _a_use("mirror")
	await wait(0.5)
	await _a_walk(Vector3(DX, 0, -28.2))
	await wait(3.0)
	print("AUTO done ended=", ended, " done=", done)
	get_tree().quit()

## (to look at, with HAND=1 and --write-movie) she stands by the pool of the second court; the water is tapped twice,
## the second time beyond the winch, and then the floor
func _refl_test() -> void:
	started = true; title_box.hide(); hint.hide(); cam.size = PLAY_SIZE
	rects["B1"].on = true; gate_a.position.y = -2.4
	pos = Vector3(0.6, 0, -10.8); yaw = PI; cam_t = pos
	for i in 30: await get_tree().process_frame
	tap(cam.unproject_position(Vector3(-0.2, 0.012, -13.0)))
	for i in 130: await get_tree().process_frame
	tap(cam.unproject_position(Vector3(1.2, 0.012, -14.4)))
	for i in 130: await get_tree().process_frame
	tap(cam.unproject_position(Vector3(-2.0, 0, -10.8)))
	for i in 90: await get_tree().process_frame
	get_tree().quit()

## (a check) can the three turning statues be reached and used by taps, from different places in their court, and
## what does a tap on a statue's body, its drum or its gear do
func _turn_diag() -> void:
	started = true; title_box.hide(); hint.hide(); cam.size = PLAY_SIZE
	rects["B1"].on = true; rects["Cw"].on = true; rects["BR"].on = true
	for from in [Vector3(-13.5, 0, -13.0), Vector3(-13.6, 0, -10.4), Vector3(-17.0, 0, -10.4), Vector3(-21.2, 0, -12.0), Vector3(-15.0, 0, -15.6)]:
		var line := "from %s (in '%s'):" % [from, rect_of(from)]
		for i in 3:
			var st: Vector3 = objs["turn%d" % (i + 1)].stand
			line += "  statue %d stand %s in '%s' path %d" % [i + 1, st.snapped(Vector3.ONE * 0.01), rect_of(st), find_path(from, st).size()]
		print("TURN ", line)
	pos = Vector3(-13.5, 0, -13.0); cam_t = pos
	for i in 30: await get_tree().process_frame
	var px := get_viewport().get_visible_rect().size.x / 720.0
	for i in 3:
		var base: Vector3 = TURN_AT[i]
		for part in [["mark", markers["turn%d" % (i + 1)].position], ["head", base + Vector3(0, 2.1, 0)], ["body", base + Vector3(0, 1.4, 0)], ["drum", base + Vector3(0, 0.45, 0)], ["gear", base + Vector3(0.3, 0.17, 0.3)]]:
			var sp := cam.unproject_position(part[1])
			var hit := ""
			for k in objs:
				if done.has(k): continue
				if _tap_hits(k, sp, px): hit = k; break
			print("TURN a tap on statue ", i + 1, "'s ", part[0], " at screen ", Vector2i(sp), " -> ", hit if hit != "" else "nothing (she would walk to the floor nearby)")
	get_tree().quit()

## a search for surfaces that fight for the same pixels (COPLANAR=1 on any run): two boxes or drums of different
## colour whose tops lie level and overlap flicker in stripes whenever the view moves. Lists every such pair
func _coplanar_check() -> void:
	var tops := []
	for mm in find_children("*", "MeshInstance3D", true, false):
		var mi := mm as MeshInstance3D
		if not mi.is_visible_in_tree() or mi.material_override == null: continue
		var gt := mi.global_transform
		if absf(gt.basis.y.normalized().y) < 0.999: continue      # tilted: not a level top
		var hx := 0.0; var hz := 0.0; var hy := 0.0; var round := false
		if mi.mesh is BoxMesh:
			var sz := (mi.mesh as BoxMesh).size; hy = sz.y * 0.5 * gt.basis.y.length()
			var ex := gt.basis.x * sz.x * 0.5; var ez := gt.basis.z * sz.z * 0.5
			hx = absf(ex.x) + absf(ez.x); hz = absf(ex.z) + absf(ez.z)
			if absf(gt.basis.x.normalized().x) < 0.999 and absf(gt.basis.x.normalized().z) < 0.999: round = true      # turned: its bounding square is too generous, so count it like a drum
		elif mi.mesh is CylinderMesh:
			var cm := mi.mesh as CylinderMesh; hy = cm.height * 0.5 * gt.basis.y.length(); hx = cm.top_radius * gt.basis.x.length(); hz = hx; round = true
			if cm.top_radius < 0.01: continue
		else: continue
		for up in [1.0, -1.0] if gt.basis.y.y > 0.0 else [-1.0, 1.0]:
			tops.append({"y": gt.origin.y + hy * up, "x0": gt.origin.x - hx, "x1": gt.origin.x + hx, "z0": gt.origin.z - hz, "z1": gt.origin.z + hz, "m": mi.material_override, "top": up > 0.0, "round": round, "who": str(mi.get_path()).right(46), "c": gt.origin})
			break      # only the upper face
	tops.sort_custom(func(a, b): return a.y < b.y)
	var found := []
	for i in tops.size():
		var a: Dictionary = tops[i]
		var j := i + 1
		while j < tops.size() and tops[j].y - a.y < 0.0008:
			var b: Dictionary = tops[j]; j += 1
			if a.m == b.m: continue
			var ox := minf(a.x1, b.x1) - maxf(a.x0, b.x0); var oz := minf(a.z1, b.z1) - maxf(a.z0, b.z0)
			if ox <= 0.01 or oz <= 0.01: continue
			var area := ox * oz * (0.6 if (a.round or b.round) else 1.0)
			if area < 0.004: continue
			found.append([area, "y %.3f  area %.3f  at (%.2f, %.2f)  %s  |  %s" % [a.y, area, (maxf(a.x0, b.x0) + minf(a.x1, b.x1)) * 0.5, (maxf(a.z0, b.z0) + minf(a.z1, b.z1)) * 0.5, a.who, b.who]])
	# and the upright faces that look toward the eye (+x and +z) of boxes that stand square to the world
	for ax in 2:
		var faces := []
		for mm in find_children("*", "MeshInstance3D", true, false):
			var mi := mm as MeshInstance3D
			if not (mi.mesh is BoxMesh) or not mi.is_visible_in_tree() or mi.material_override == null: continue
			var gt := mi.global_transform
			if absf(gt.basis.y.normalized().y) < 0.999 or absf(gt.basis.x.normalized().x) < 0.999: continue
			var h := (mi.mesh as BoxMesh).size * 0.5 * Vector3(gt.basis.x.length(), gt.basis.y.length(), gt.basis.z.length())
			var o := gt.origin
			if ax == 0: faces.append({"c": o.x + h.x, "u0": o.z - h.z, "u1": o.z + h.z, "v0": o.y - h.y, "v1": o.y + h.y, "m": mi.material_override, "who": str(mi.get_path()).right(46), "o": o})
			else: faces.append({"c": o.z + h.z, "u0": o.x - h.x, "u1": o.x + h.x, "v0": o.y - h.y, "v1": o.y + h.y, "m": mi.material_override, "who": str(mi.get_path()).right(46), "o": o})
		faces.sort_custom(func(a, b): return a.c < b.c)
		for i in faces.size():
			var a: Dictionary = faces[i]
			var j := i + 1
			while j < faces.size() and faces[j].c - a.c < 0.0008:
				var b: Dictionary = faces[j]; j += 1
				if a.m == b.m: continue
				var ou := minf(a.u1, b.u1) - maxf(a.u0, b.u0); var ov := minf(a.v1, b.v1) - maxf(a.v0, b.v0)
				if ou <= 0.01 or ov <= 0.01 or ou * ov < 0.004: continue
				found.append([ou * ov, "%s-face at %s %.3f  area %.3f  near (%.2f, %.2f, %.2f)  %s  |  %s" % ["+x" if ax == 0 else "+z", "x" if ax == 0 else "z", a.c, ou * ov, a.o.x, (maxf(a.v0, b.v0) + minf(a.v1, b.v1)) * 0.5, a.o.z, a.who, b.who]])
	found.sort_custom(func(a, b): return a[0] > b[0])
	print("COPLANAR ", found.size(), " pairs of level tops or upright faces of different colour that overlap (of ", tops.size(), " tops)")
	for f in found.slice(0, 70): print("COPLANAR ", f[1])

## a check of how steady the shadows are while the view moves (argument pantest, recorded with --write-movie): the
## camera glides slowly past a mirror on its footing in the sea; each frame it says where that footing is on the screen,
## so that the frames can be cut round it and laid side by side
func _pan_test() -> void:
	started = true; title_box.hide(); hint.hide()
	pos = Vector3(0, 0, -4.4); cam.size = 5.0
	var ev := func(k: String, dflt: float) -> float: return float(OS.get_environment(k)) if OS.get_environment(k) != "" else dflt
	cam.near = ev.call("SH_NEAR", cam.near); sun_light.directional_shadow_max_distance = ev.call("SH_MAX", sun_light.directional_shadow_max_distance)
	sun_light.shadow_blur = ev.call("SH_BLUR", sun_light.shadow_blur); sun_light.shadow_bias = ev.call("SH_BIAS", sun_light.shadow_bias); sun_light.shadow_normal_bias = ev.call("SH_NB", sun_light.shadow_normal_bias)
	if OS.get_environment("SH_OFF") == "1": sun_light.shadow_enabled = false
	if OS.get_environment("SH_MODE") != "": sun_light.directional_shadow_mode = int(OS.get_environment("SH_MODE")) as DirectionalLight3D.ShadowMode
	if OS.get_environment("SH_Q") != "": RenderingServer.directional_soft_shadow_filter_set_quality(int(OS.get_environment("SH_Q")) as RenderingServer.ShadowQuality)
	if OS.get_environment("SH_ATLAS") != "": RenderingServer.directional_shadow_atlas_set_size(int(OS.get_environment("SH_ATLAS")), true)
	var at := Vector3(2.4, WATER + 0.9, -6.2)
	cam_focus = Vector3(2.6, -0.6, -5.6); cam_focus_on = true; cam_t = cam_focus
	var still := OS.get_environment("PAN_STILL") != ""      # PAN_STILL="x,z": the view holds still on the waterline at that place
	if still:
		var pv := OS.get_environment("PAN_STILL").split(","); at = Vector3(float(pv[0]), WATER + 0.1, float(pv[1])); cam_focus = at + Vector3(0, -1.2, 0); cam_t = cam_focus; cam.size = float(pv[2]) if pv.size() > 2 else 4.0
	for i in 20: await get_tree().process_frame
	for i in 60:
		if not still or OS.get_environment("PAN_MOVE") == "1": cam_focus += Vector3(-0.012, 0, -0.02); cam_t = cam_focus      # (PAN_MOVE=1 with PAN_STILL: glide past that place)
		await get_tree().process_frame
		var sp := cam.unproject_position(at)
		print("PAN ", i, " ", int(sp.x), " ", int(sp.y))
	get_tree().quit()

## a check of play by hand (run with HAND=1 and the argument handtest): holds the stick and presses the interact
## button as a player would, through the first two puzzles and west over the bridge; says what each step did
func _hand_test() -> void:
	started = true; title_box.hide(); hint.hide()
	if ctl == null:      # play by taps: on the ground to walk, on a thing to use it
		var walk := func(to: Vector3) -> void:
			var ok := walk_to(to)
			var n := 0
			while ok and pos.distance_to(to) > 0.15 and n < 1500: n += 1; await get_tree().process_frame
			for i in 20: await get_tree().process_frame
		var tap_on := func(k: String) -> void:
			cam_t = pos
			for i in 60: await get_tree().process_frame
			tap(cam.unproject_position(objs[k].at))
			var n := 0
			while not done.has(k) and n < 2400: n += 1; await get_tree().process_frame
			while busy: await get_tree().process_frame
		cam.size = PLAY_SIZE
		await wait(0.5)
		print("HAND (taps) start: at ", pos.snapped(Vector3.ONE * 0.01), " gate A ", gate_a.position.y, " | a walk beyond gate A is ", "possible" if not find_path(pos, Vector3(0, 0, -7.0)).is_empty() else "shut")
		var far_pt := Vector3(2.6, 0, 4.4)
		cam_t = pos
		for i in 40: await get_tree().process_frame
		hold_id = 0; hold_at = cam.unproject_position(far_pt); hold_t = 0.0; hold_next = 0.0
		for i in 100: await get_tree().process_frame
		hold_id = -1
		for i in 30: await get_tree().process_frame
		print("HAND a finger held on the floor at ", far_pt, " for 3.3 s leads her to ", pos.snapped(Vector3.ONE * 0.01), " (", snappedf(pos.distance_to(far_pt), 0.01), " m from it)")
		await tap_on.call("plinth")
		print("HAND after a tap on the empty plinth: at ", pos.snapped(Vector3.ONE * 0.01), " gate A ", snappedf(gate_a.position.y, 0.01), " way north ", rects["B1"].on)
		await walk.call(Vector3(-2.0, 0, -11.0))
		print("HAND walked by taps to court C: at ", pos.snapped(Vector3.ONE * 0.01), " | onto its pool: ", "possible (wrong)" if rect_of(Vector3(0.5, 0, -13.5)) != "" else "not possible", " | beyond gate C: ", "possible" if not find_path(pos, Vector3(-3.9, 0, -13.0)).is_empty() else "shut")
		var water := func(to: Vector3, secs: float) -> float:      # a tap on the water there; says how near the winch's axis the reflection came on its way
			cam_t = pos
			for i in 20: await get_tree().process_frame
			tap(cam.unproject_position(Vector3(to.x, 0.012, to.z)))
			var nearest := 99.0
			for i in int(secs * 30.0):
				await get_tree().process_frame
				if not refl_out.is_empty(): nearest = minf(nearest, Vector2((refl_out.holder as Node3D).position.x - PED.x, (refl_out.holder as Node3D).position.z - PED.z).length())
			return nearest
		await water.call(Vector3(0.0, 0, -12.6), 8.0)
		print("HAND a tap on the water at (0.0, -12.6): she stands at ", pos.snapped(Vector3.ONE * 0.01), " (", snappedf(_rect_dist(pos, _pools()[0]), 0.01), " m from the water), her reflection is ", "out, at " + str((refl_out.holder as Node3D).position.snapped(Vector3.ONE * 0.01)) if not refl_out.is_empty() else "still under her")
		var nr: float = await water.call(Vector3(3.6, 0, -16.2), 9.0)
		print("HAND a tap on open water far from the crossing at (3.6, -16.2): her reflection keeps to the crossing, at ", (refl_out.holder as Node3D).position.snapped(Vector3.ONE * 0.01) if not refl_out.is_empty() else "?", " (its end is ", (_cross_line()[2] as Vector3).snapped(Vector3.ONE * 0.01), "); nearest it came to the winch's axis ", snappedf(nr, 0.01), " m")
		var back := Vector3(pos.x - 1.7, 0, pos.z + 0.5)
		tap(cam.unproject_position(back))
		for i in 200: await get_tree().process_frame
		print("HAND a tap on the floor: she walks to ", pos.snapped(Vector3.ONE * 0.01), " and her reflection is ", "back under her" if H.has("mir") and refl_out.is_empty() else "still out")
		await water.call(Vector3(-0.4, 0, -13.6), 8.0)
		print("HAND sent out again to (-0.4, -13.6): at ", (refl_out.holder as Node3D).position.snapped(Vector3.ONE * 0.01) if not refl_out.is_empty() else "?")
		await tap_on.call("winch")
		print("HAND after a tap on the wheel in the water: at ", pos.snapped(Vector3.ONE * 0.01), " gate C ", snappedf(gate_c.position.y, 0.01), " way west ", rects["Cw"].on, " bridge on ", rects["BR"].on, " bridge angle ", snappedf(bridge.rotation.y, 0.01))
		await walk.call(Vector3(-13.5, 0, -13.0))
		print("HAND walked by taps west over the bridge: at ", pos.snapped(Vector3.ONE * 0.01))
		await walk.call(Vector3(-15.0, 0, -15.5))
		cam_t = pos
		for i in 60: await get_tree().process_frame
		tap(cam.unproject_position(markers["turn3"].position))
		for i in 400: await get_tree().process_frame
		while busy: await get_tree().process_frame
		print("HAND after a tap on the third statue's mark: it has been turned ", turn_q[2], " quarter(s)")
		get_tree().quit(); return
	var cb := cam.global_transform.basis
	var gr := Vector3(cb.x.x, 0, cb.x.z).normalized(); var gu := Vector3(cb.y.x, 0, cb.y.z).normalized()
	var stick := func(to: Vector3, secs: float) -> void:      # hold the stick toward a point on the ground, until she is there or the time is up
		for i in int(secs * 30.0):
			var d := Vector3(to.x - pos.x, 0, to.z - pos.z)
			if d.length() < 0.2: break
			ctl.vec = Vector2(d.normalized().dot(gr), -d.normalized().dot(gu)).normalized()
			ctl.joy_index = 0; ctl.joy_base = Vector2(ctl.canvas.size.x * 0.28, ctl.canvas.size.y * 0.78); ctl.joy_knob = ctl.joy_base + ctl.vec * Joy.JOY_R   # drawn as a thumb would hold it
			await get_tree().process_frame
		ctl.reset()
		for i in 25: await get_tree().process_frame
	var press := func() -> void:      # the interact button
		if reach == "": print("HAND   (nothing in reach: the button is not there)"); return
		ctl.interact.emit()
		await settled
	await wait(0.5)
	print("HAND start: at ", pos.snapped(Vector3.ONE * 0.01), " gate A ", gate_a.position.y, " way north ", rects["B1"].on)
	await stick.call(Vector3(0.0, 0, -6.0), 7.0)
	print("HAND stick north against the shut gate A: stops at ", pos.snapped(Vector3.ONE * 0.01), " (the gate is at z -3.9)")
	await stick.call(Vector3(MYPL.x - 1.0, 0, MYPL.z + 0.9), 6.0)
	print("HAND stick west into the row of statues: stops at ", pos.snapped(Vector3.ONE * 0.01), " (the plinths stand at x ", MYPL.x, ")")
	await stick.call(MYPL + Vector3(0.9, 0, 0), 5.0)
	print("HAND stick to the empty plinth: at ", pos.snapped(Vector3.ONE * 0.01), " in reach '", reach, "' icon ", ctl.icon)
	await press.call()
	print("HAND after the button: at ", pos.snapped(Vector3.ONE * 0.01), " gate A ", snappedf(gate_a.position.y, 0.01), " way north ", rects["B1"].on, " done ", done.has("plinth"))
	await stick.call(Vector3(0, 0, -3.0), 8.0)
	await stick.call(Vector3(0, 0, -10.6), 12.0)
	print("HAND stick north through the open gate and up the causeway: at ", pos.snapped(Vector3.ONE * 0.01))
	await stick.call(Vector3(-2.0, 0, -11.0), 5.0)
	await stick.call(Vector3(-1.8, 0, -13.2), 5.0)
	print("HAND by the pool of court C: at ", pos.snapped(Vector3.ONE * 0.01), " in reach '", reach, "' icon ", ctl.icon)
	await stick.call(Vector3(1.0, 0, -13.2), 3.0)
	print("HAND stick east at the pool: stops at ", pos.snapped(Vector3.ONE * 0.01), " (the water begins at x ", QX0, ")")
	print("HAND beyond gate C is ", "possible" if not find_path(pos, Vector3(-3.9, 0, -13.0)).is_empty() else "shut", "; in reach '", reach, "'")
	await press.call()
	print("HAND after the button: at ", pos.snapped(Vector3.ONE * 0.01), " gate C ", snappedf(gate_c.position.y, 0.01), " way west ", rects["Cw"].on, " bridge on ", rects["BR"].on, " bridge angle ", snappedf(bridge.rotation.y, 0.01), " done ", done.has("winch"))
	await stick.call(Vector3(-2.3, 0, -13.0), 4.0)
	await stick.call(Vector3(-13.6, 0, -13.0), 14.0)
	print("HAND stick west through gate C and over the bridge: at ", pos.snapped(Vector3.ONE * 0.01), " in reach '", reach, "'")
	await stick.call(Vector3(-13.6, 0, -14.6), 4.0)
	await stick.call(TURN_AT[2] + Vector3(TURN_STAND + 0.3, 0, 0), 6.0)
	print("HAND by the third statue: at ", pos.snapped(Vector3.ONE * 0.01), " in reach '", reach, "' icon ", ctl.icon)
	await press.call()
	print("HAND after the button: statue 3 has been turned ", turn_q[2], " quarter(s)")
	get_tree().quit()

## the act of the first puzzle, the same in the scripted run and in play: from before her own plinth she steps up
## onto it, takes the pose of the statue beside her, and is still. The row is whole, and the court's gate goes down
func _statue_act() -> void:
	var twin: Node3D = H["mir"].holder
	create_tween().tween_property(cam, "size", 5.8, 1.6)
	go([Vector3(MYPL.x, 0, MYPL.z)], 0.8)
	while pos.x > MYPL.x + 0.66: await get_tree().process_frame
	create_tween().tween_property(self, "pos:y", 0.17, 0.45).set_trans(Tween.TRANS_SINE)   # she is up before the hem of her dress is over the plinth's rim
	twin.visible = false
	await arrived
	await wait(0.3)
	await face(Vector3(0.0, 0, MYPL.z))
	await wait(1.4)
	tgtL = MYPL + Vector3(0.21, 1.44, -0.03); tgtR = MYPL + Vector3(0.21, 1.44, 0.03)   # her hands come together before her, as the statue's beside her
	var up := tw(); up.tween_property(self, "a_wR", 1.0, 1.2); up.tween_property(self, "a_wL", 1.0, 1.2)
	await up.finished
	await wait(0.3)
	posing = true                                       # and she is still
	await wait(2.6)
	# the row is whole: the gate of the court goes down
	cam_focus = Vector3(-1.6, 0.6, -1.6)
	create_tween().tween_property(cam, "size", 7.8, 1.6)   # wide enough to hold her and the whole gate, both piers
	await wait(1.4)
	var gt := create_tween(); gt.tween_property(gate_a, "position:y", -2.4, 2.6).set_trans(Tween.TRANS_SINE)
	await gt.finished
	await wait(0.8)
	posing = false
	var dn := tw(); dn.tween_property(self, "a_wR", 0.0, 0.8); dn.tween_property(self, "a_wL", 0.0, 0.8)
	await dn.finished
	await wait(0.4)

## she steps down off the plinth during the walk that has just been started
func _statue_down() -> void:
	while pos.x < MYPL.x + 0.14: await get_tree().process_frame
	create_tween().tween_property(self, "pos:y", 0.0, 0.55).set_trans(Tween.TRANS_SINE)
	(H["mir"].holder as Node3D).visible = true

## (play) a tap on the empty plinth: she goes to it and does as the scripted run does
func _do_plinth() -> void:
	var s0 := cam.size
	cam_focus = Vector3(-2.2, 0.3, -0.5); cam_focus_on = true
	await _statue_act()
	done["plinth"] = true; rects["B1"].on = true
	cam_focus_on = false
	create_tween().tween_property(cam, "size", s0, 1.4)
	go([MYPL + Vector3(0.75, 0, 0)])
	await _statue_down()
	await arrived

## the solution of the first puzzle, played out: she stands on the carved feet, her reflection
## leaves her, crosses on the reflection of the lost footbridge and turns the winch in the water
func _eid_go(e: Dictionary, to: Vector3, speed := 0.8) -> void:
	var hd: Node3D = e.holder; var d := to - hd.position; d.y = 0.0
	hd.rotation.y = atan2(d.x, d.z)
	(e.ap as AnimationPlayer).play("walk", 0.25); (e.ap as AnimationPlayer).speed_scale = clampf(speed / 1.1, 0.45, 2.3)
	var t := create_tween(); t.tween_property(hd, "position", to, d.length() / speed)
	await t.finished
	(e.ap as AnimationPlayer).play("idle", 0.4); (e.ap as AnimationPlayer).speed_scale = 1.0

## the first puzzle, "become the statue", solved. No captions: the gate is shut and the pool is empty of any way
## across. The water shows the row of statues whole, the fifth with one arm raised, where her own plinth stands
## empty. She goes back up onto it, raises her arm, and is still. Then the winch rises out of the water
func _solve_statue(alone := true) -> void:
	started = true; title_box.hide(); hint.hide()
	gate_a.position.y = 0.0
	done["capstan"] = true        # (no mark over the old capstan of the second court: it is not there any more)
	pos = Vector3(0.9, 0, 3.4); yaw = PI * 1.2; cam_t = pos; cam.size = 6.6
	await wait(1.0)
	cam_focus = Vector3(-2.2, 0.3, -0.5); cam_focus_on = true
	await go([Vector3(-0.35, 0, 1.2), Vector3(-0.5, 0, MYPL.z)])
	await face(Vector3(-3.0, 0, MYPL.z))
	create_tween().tween_property(cam, "size", 5.2, 1.8)
	await wait(2.6)                                     # four statues, and one plinth with nobody on it
	await _statue_act()
	# down from the plinth and out through the gate, in one walk
	cam_focus_on = false
	create_tween().tween_property(cam, "size", 6.4, 1.4)
	go([Vector3(MYPL.x + 0.7, 0, MYPL.z), Vector3(-0.4, 0, -2.2), Vector3(0, 0, -3.1), Vector3(0, 0, -4.9 if alone else -7.0)])
	await _statue_down()
	if not alone:   # on to the causeway: the view opens on the sea and what stands in it
		while pos.z > -3.6: await get_tree().process_frame
		create_tween().tween_property(cam, "size", 8.6, 3.0).set_trans(Tween.TRANS_SINE)
	await arrived
	if alone:
		await wait(0.8)
		get_tree().quit()

## the first two puzzles and the walk between them, in one piece: the statue, the causeway among the hidden mirrors,
## the crossing the water keeps
## With all = true it goes on: over the bridge that the winch swings into place, and through the third puzzle
func _tour(all := false) -> void:
	await _solve_statue(false)
	await face(Vector3(-4.0, 0, -7.6))                   # she stops among them, while the line about them is on the screen
	await wait(4.6)
	await _solve2(false)
	if all:
		create_tween().tween_property(cam, "size", 7.4, 2.0).set_trans(Tween.TRANS_SINE)
		go([Vector3(-7.6, 0, -13.0), Vector3(-13.5, 0, -13.0)])      # one walk, without a halt where the third court's run takes over
		while pos.x > -11.6: await get_tree().process_frame
		await _solve3(false)
	await wait(0.8)
	get_tree().quit()

## The camera of the third court. It looks at a point of the floor (mid: what lies in the middle of the picture) from
## as far as `size` says, and goes there the way a damped spring would: it starts gently, never overshoots, and a new
## aim given while it is still moving bends its way instead of cutting it. quick: how fast (about 4.7 / quick seconds)
var cam3_on := false
var cam3_to := Vector3.ZERO
var cam3_size := 7.0
var cam3_quick := 1.7
func _cam3(mid: Vector3, size: float, quick := 1.7) -> void:
	if OS.get_environment("S3_CAM") != "": return      # a view held still, to look closely
	cam3_to = mid + Vector3(1, 0, 1) * (1.9 / 0.8165)      # the middle of the picture lies 1.9 m up the screen from the point the camera keeps
	cam3_size = size; cam3_quick = quick
	if cam3_on: return
	cam3_on = true
	var v := Vector3.ZERO; var sv := 0.0
	if not cam_focus_on:      # until now it followed her: it goes on as it was going
		v = vel; cam_focus = cam_t + v / 1.8; cam_focus_on = true
	while cam3_on:
		var dt := get_process_delta_time(); var w := cam3_quick
		v += ((cam3_to - cam_focus) * w * w - v * 2.0 * w) * dt; cam_focus += v * dt
		sv += ((cam3_size - cam.size) * w * w - sv * 2.0 * w) * dt; cam.size += sv * dt
		await get_tree().process_frame

## the third puzzle, "the turned ones", solved. No captions: she comes in from the bridge, sees the three statues and
## the three in the water that stand otherwise, and turns each until it matches; the south gate goes down
func _solve3(alone := true) -> void:
	started = true; title_box.hide(); hint.hide()
	if OS.get_environment("S3_ONE") != "":      # to look closely: S3_ONE=<0..2> turns that one statue (S3_N times), S3_CAM="x,z,size" holds the view
		var cv := OS.get_environment("S3_CAM").split(",")
		var oi := int(OS.get_environment("S3_ONE")); var on := maxi(1, int(OS.get_environment("S3_N")))
		pos = TURN_AT[oi] + Vector3(TURN_STAND, 0, 0); yaw = -PI * 0.5; cam.size = float(cv[2]); cam_focus = Vector3(float(cv[0]), 0, float(cv[1])); cam_focus_on = true; cam_t = cam_focus
		await wait(0.5)
		for k in on: await _turn(oi, k < on - 1)
		await wait(0.3)
		get_tree().quit(); return
	var stand := []
	for i in 3: stand.append(TURN_AT[i] + Vector3(TURN_STAND, 0, 0))
	var first := 0
	if alone and OS.get_environment("S3_END") == "1":      # only the end of it: the first two stand right already, and she is by the third
		for i in 2:
			(turn_n[i] as Node3D).rotation.y -= PI * 0.5 * TURN_GOAL[i]; (turn_pin[i] as Node3D).rotation.y = _pinion_yaw((turn_n[i] as Node3D).rotation.y); turn_q[i] = TURN_GOAL[i]
		_turned_check()
		first = 2; pos = stand[1]; yaw = -PI * 0.5; cam.size = 5.6; cam_t = Vector3(-18.38, 0, -14.56) + Vector3(1, 0, 1) * (1.9 / 0.8165); cam_focus = cam_t; cam_focus_on = true
		await wait(0.5)
	elif alone and OS.get_environment("S3_WALK") == "1":      # the way here as the long run walks it: out of the second court's gate, over the bridge, along the slab
		bridge.rotation.y = 0.0; rects["BR"].on = true
		pos = Vector3(-3.95, 0, -13.0); yaw = -PI * 0.5; cam_t = pos; cam.size = 6.4
		await wait(0.6)
		create_tween().tween_property(cam, "size", 7.4, 2.0).set_trans(Tween.TRANS_SINE)
		if OS.get_environment("S3_HALT") == "1": await go([Vector3(-7.6, 0, -13.0), Vector3(-11.6, 0, -13.0)])      # exactly as _tour has it: she comes to a stand on the slab before going on
		else:      # without that halt: she walks on while the court's run takes over
			go([Vector3(-7.6, 0, -13.0), Vector3(-13.5, 0, -13.0)])
			while pos.x > -11.6: await get_tree().process_frame
	elif alone:
		pos = Vector3(-11.6, 0, -13.0); yaw = -PI * 0.5; cam_t = pos; cam.size = 7.2
		await wait(1.0)
	if first == 0:
		# the court opens before her: the three statues along the far rim, the pool, and the three in the water
		_cam3(Vector3(-17.5, 0, -14.1), 8.6, 1.3)
		await go([Vector3(-13.5, 0, -13.0)])
		await face(Vector3(-17.0, 0, -12.8))                # the water, and what stands in it
		await wait(2.4)
	# She begins with the farthest and works back toward the gate. Round behind the row to the first; from one to the
	# next she goes round the back of the plinth between, a step clear of its base
	for i in range(first, 3):
		# the picture closes on the one she turns and on its twin in the water under it; the other two stay in it
		var near := Vector3(-18.38 + 0.45 * (i - 1), 0, -14.56 - 0.455 * (i - 1))
		if i == 0:
			go([Vector3(-13.5, 0, -14.3), Vector3(-13.9, 0, -15.0), Vector3(-14.6, 0, -15.35), Vector3(-18.55, 0, -15.35), Vector3(-19.1, 0, -15.15), Vector3(-19.32, 0, -14.8), stand[0]])
			while pos.x > -15.0: await get_tree().process_frame      # (the picture stays wide until she is well into the court: it must not close and leave her outside it)
			_cam3(near, 5.6, 1.5)
			await arrived
		else:
			_cam3(near, 5.6, 1.9)
			var c: Vector3 = TURN_AT[i]; var arc := []
			for a in [150.0, 120.0, 90.0, 60.0, 30.0]:
				var ra := deg_to_rad(a); arc.append(c + Vector3(cos(ra), 0, -sin(ra)) * (lerpf(1.5 - TURN_STAND, TURN_STAND, (180.0 - a) / 180.0) + 0.15 * sin(ra)))      # from where she stood by the last one, out round its back, in to where she stands by this one
			arc.append(stand[i])
			await go(arc)
		for k in TURN_GOAL[i]:
			if i == 2 and k == TURN_GOAL[i] - 1: break      # the last quarter of the last one: see below
			await _turn(i, k < TURN_GOAL[i] - 1)
		if i < 2: await wait(0.3)
	# the last quarter. As the third comes to stand like its twin the gate behind her starts down, and she turns to it
	_turn(2)
	while not turned_done: await get_tree().process_frame
	_cam3(Vector3(-17.3, 0, -16.75), 5.8, 1.5)
	await face(Vector3(-16.3, 0, -16.8))
	while not rects["G1"].on: await get_tree().process_frame
	await wait(0.5)
	await go([Vector3(-16.28, 0, -15.2), Vector3(-16.3, 0, -16.0), Vector3(-16.3, 0, -18.2)])
	if alone:
		await wait(0.8)
		get_tree().quit()

## the act of the second puzzle, the same in the scripted run and in play: she goes to the rim of the pool and can
## go no further; her reflection walks on across the water, lays its hands on the wheel and turns it; the gate goes
## down and the bridge beyond it swings into line; the reflection comes back under her feet
func _winch_act() -> void:
	var rim := Vector3(CROSS_X, 0, QZ1 + 0.14)      # the head of the lost crossing, at the front rim of the pool
	var e: Dictionary
	var hub := PED + Vector3(-WINCH_HUB.x, WINCH_HUB.y, 0) * WINCH_K     # the hub of the handwheel
	create_tween().tween_property(cam, "size", 6.8, 2.0)
	if refl_out.is_empty():
		await wait(0.5)
		go([rim])
		while pos.z > rim.z + 0.12: await get_tree().process_frame
		e = H["mir"]; H.erase("mir")
		for wp in _refl_way(0, (e.holder as Node3D).position, Vector3(hub.x - 0.56, 0.0, PED.z)): await _eid_go(e, Vector3(wp.x, CROSS_H, wp.z), 0.8)      # along the crossing and round its turn, to an arm's length from the wheel
		(e.holder as Node3D).rotation.y = PI * 0.5
	else:      # (play) it is out on this water already: it goes on from where it stands, round the pedestal if that is in its way
		refl_token += 1; e = refl_out; refl_out = {}
		for wp in _refl_way(0, (e.holder as Node3D).position, Vector3(hub.x - 0.56, 0.0, PED.z)): await _eid_go(e, Vector3(wp.x, CROSS_H, wp.z), 0.95)
		(e.holder as Node3D).rotation.y = PI * 0.5      # it faces the wheel
	# her reflection lays its hands on the wheel and turns it hand over hand: each hand goes round with the rim for a
	# part of a turn, lets go, and comes back for the next hold. The gate and the bridge move while the wheel turns
	var hm: HerMod = null
	for c in (e.sk as Skeleton3D).get_children():
		if c is HerMod: hm = c
	var crank := func(_v: float) -> void:
		var a: float = winch_m.rotation.x
		for sd in 2:
			var u := fposmod(a / 2.8 + 0.5 * sd, 1.0)
			var hold := u < 0.57
			var k := (u / 0.57) if hold else smoothstep(1.0, 0.0, (u - 0.57) / 0.43)
			var psi := (0.4 + 1.6 * k) if sd == 0 else (-2.0 + 1.6 * k)       # the left hand draws its side of the rim down, the right pushes its side up
			var off := 0.0 if hold else 0.08 * sin(PI * (u - 0.57) / 0.43)     # off the rim on the way back
			var pt := Vector3(hub.x - 0.06 - off, -(hub.y + 0.35 * cos(psi)), hub.z - 0.35 * sin(psi))   # (under the water: the mirrored wheel)
			if sd == 0: hm.tL = pt
			else: hm.tR = pt
	crank.call(0.0); hm.own = true
	var hu := create_tween().set_parallel(); hu.tween_property(hm, "wL", 1.0, 0.5); hu.tween_property(hm, "wR", 1.0, 0.5); hu.tween_property(hm, "bow", 0.1, 0.5)
	await hu.finished
	var wt := create_tween().set_parallel(); wt.tween_property(winch_a, "rotation:x", PI * 3.5, 5.6).set_trans(Tween.TRANS_SINE); wt.tween_property(winch_m, "rotation:x", PI * 3.5, 5.6).set_trans(Tween.TRANS_SINE)
	wt.tween_method(crank, 0.0, 1.0, 5.6)
	await wait(1.4)
	cam_focus = Vector3(-1.9, 0.5, -13.3)                 # the view opens on the gate and the whole of the bridge beyond it, with the wheel still in it
	create_tween().tween_property(cam, "size", 9.4, 1.6)
	await wait(1.0)
	var gt := create_tween(); gt.tween_property(gate_c, "position:y", -2.4, 2.6).set_trans(Tween.TRANS_SINE)
	create_tween().tween_property(bridge, "rotation:y", 0.0, 3.2).set_trans(Tween.TRANS_SINE).set_ease(Tween.EASE_IN_OUT)   # and the bridge beyond it swings into place
	await gt.finished
	rects["BR"].on = true
	await wt.finished                                   # the wheel and the bridge come to rest together
	var hd2 := create_tween().set_parallel(); hd2.tween_property(hm, "wL", 0.0, 0.5); hd2.tween_property(hm, "wR", 0.0, 0.5); hd2.tween_property(hm, "bow", 0.0, 0.5)
	await hd2.finished
	hm.own = false
	await wait(0.3)
	for wp in _refl_way(0, (e.holder as Node3D).position, _cross_line()[0]): await _eid_go(e, Vector3(wp.x, CROSS_H, wp.z), 0.8)      # back along the crossing to its head
	await _eid_go(e, Vector3(pos.x, 0, pos.z), 0.8)
	var hd3: Node3D = e.holder     # back under her feet it turns to stand as she stands (it used to flip round in one frame)
	var rt := create_tween(); rt.tween_property(hd3, "rotation:y", hd3.rotation.y + angle_difference(hd3.rotation.y, yaw), 0.5).set_trans(Tween.TRANS_SINE)
	await rt.finished
	H["mir"] = e
	await wait(0.5)

## (play) a tap on the wheel in the water: she goes to the rim and it happens as in the scripted run
func _do_winch() -> void:
	var s0 := cam.size
	cam_focus = Vector3(1.2, 0.1, -13.5); cam_focus_on = true
	await _winch_act()
	done["winch"] = true; rects["Cw"].on = true
	cam_focus_on = false
	create_tween().tween_property(cam, "size", s0, 1.4)
	if pos.z < QZ1 + 0.3: await go([Vector3(CROSS_X, 0, QZ1 + 0.39)])      # back a step from the rim

## the second puzzle, "the crossing the water keeps", solved. No captions: she walks on toward the winch; at the rim
## her body can go no further, and her reflection does not stop
func _solve2(alone := true) -> void:
	started = true; title_box.hide(); hint.hide()
	gate_c.position.y = 0.0
	done["capstan"] = true        # (no mark over the old capstan of this court: it is not there any more)
	var head := Vector3(CROSS_X, 0, QZ1 + 0.39)      # before the head of the lost crossing, at the pool's front rim
	if alone:
		pos = Vector3(0.0, 0, -10.3); yaw = PI; cam_t = pos; cam.size = 7.4
		await wait(1.0)
		cam_focus = Vector3(1.2, 0.1, -13.5); cam_focus_on = true
		await go([Vector3(CROSS_X, 0, -10.75), head])
	else:   # she comes in from the causeway: the camera closes on the court as she reaches it
		go([Vector3(0, 0, -10.2), Vector3(CROSS_X, 0, -10.75), head])
		while pos.z > -9.3: await get_tree().process_frame
		cam_focus = Vector3(1.2, 0.1, -13.5); cam_focus_on = true
		create_tween().tween_property(cam, "size", 7.4, 2.4).set_trans(Tween.TRANS_SINE)
		await arrived
	await _winch_act()
	cam_focus_on = false
	create_tween().tween_property(cam, "size", 6.4, 1.4)
	await go([Vector3(-2.1, 0, -11.0), Vector3(-2.3, 0, -13.0), Vector3(-3.95, 0, -13.0)])
	if alone:
		await wait(0.8)
		get_tree().quit()

## the covered mirror, solved. No captions: she finds the court closed, draws the cloth off the pool, sees in the
## water a door that the wall does not have, goes to that place on the wall and lays her hands on it. Only then do the
## joints of the door show in the stone, and it gives way
func _solve_covered() -> void:
	started = true; title_box.hide(); hint.hide()
	var grabs: Array = sheet_meta.grabs
	var stand := Vector3(SHEET_C.x + float(sheet_meta.xr) + 0.4, 0, SHEET_C.z)
	var done_f := float((grabs[grabs.size() - 1] as Dictionary).drop) + 8.0; var FE := float(sheet_meta.end)
	pos = Vector3(0.4, 0, -10.3); yaw = PI; cam_t = pos; cam.size = 6.8
	await wait(1.0)
	cam_focus = Vector3(-0.2, 0.2, -12.6); cam_focus_on = true
	await go([Vector3(1.5, 0, -11.6), stand])
	await face(Vector3(-1.0, 0, stand.z))
	await wait(0.6)
	# she gathers the cloth in, hand over hand, and it heaps at her feet
	create_tween().tween_property(cam, "size", 5.8, 2.0)
	sheet_f = float(sheet_meta.t0) - 4.0; sheet_held = true
	while sheet_f < done_f:
		sheet_f = minf(sheet_f + get_process_delta_time() * 30.0, done_f); sheet_set(sheet_f)
		await get_tree().process_frame
	sheet_held = false
	var r := tw(); r.tween_property(self, "a_wR", 0.0, 0.5); r.tween_property(self, "a_wL", 0.0, 0.5); r.tween_property(self, "a_lean", 0.0, 0.5)
	var settle := func():   # the heap settles by itself while she turns to the water
		while sheet_f < FE:
			sheet_f = minf(sheet_f + get_process_delta_time() * 30.0, FE); sheet_set(sheet_f)
			await get_tree().process_frame
	settle.call()
	await wait(0.9)
	# the water: the wall upside down, and in it a door
	cam_focus = Vector3(-1.0, 0.3, -12.7)
	create_tween().tween_property(cam, "size", 4.9, 1.8)
	await go([Vector3(1.25, 0, -11.9), Vector3(0.35, 0, -11.75)])
	await face(Vector3(-1.5, 0, -12.9))
	await wait(3.0)
	door_seen = true
	# she goes to that place on the wall. There is nothing to see there, until she lays her hands on the stone
	create_tween().tween_property(cam, "size", 5.8, 1.6)
	cam_focus = Vector3(-1.5, 0.5, -13.2)
	await go([Vector3(0.3, 0, -10.95), Vector3(-2.55, 0, -10.95), Vector3(-2.5, 0, DOORZ)])
	await face(Vector3(WALLX, 0, DOORZ))
	await wait(0.4)
	tgtL = Vector3(WALLX + 0.02, 1.12, DOORZ + 0.16); tgtR = Vector3(WALLX + 0.02, 1.12, DOORZ - 0.16)
	var ph := tw(); ph.tween_property(self, "a_wL", 1.0, 0.5); ph.tween_property(self, "a_wR", 1.0, 0.5); ph.tween_property(self, "a_lean", 0.14, 0.5)
	await ph.finished
	if door_seen:
		seam_a.visible = true   # now the joints show, drawn up the stone from the floor
		var st := create_tween(); st.tween_property(seam_a, "scale:y", 1.0, 1.5).set_trans(Tween.TRANS_SINE)
		await st.finished
		await wait(0.5)
		# and the stone gives way: back into the wall, then down
		create_tween().tween_property(self, "a_lean", 0.2, 0.4)
		var dt1 := create_tween().set_parallel()
		dt1.tween_property(door_a, "position:x", -0.3, 1.1).set_trans(Tween.TRANS_SINE); dt1.tween_property(door_m, "position:x", -0.3, 1.1).set_trans(Tween.TRANS_SINE)
		await wait(0.7)
		var pb := tw(); pb.tween_property(self, "a_wL", 0.0, 0.5); pb.tween_property(self, "a_wR", 0.0, 0.5); pb.tween_property(self, "a_lean", 0.0, 0.5)
		await wait(0.6)
		var dt2 := create_tween().set_parallel()
		dt2.tween_property(door_a, "position:y", -1.95, 2.0).set_trans(Tween.TRANS_SINE); dt2.tween_property(door_m, "position:y", -1.95, 2.0).set_trans(Tween.TRANS_SINE)
		await dt2.finished
	await wait(0.6)
	await go([Vector3(-3.95, 0, DOORZ)])
	await wait(0.8)
	get_tree().quit()

func _glide() -> void:
	started = true; title_box.hide(); hint.hide()
	pos = Vector3(0.9, 0, 1.2); yaw = 0.78; cam_t = pos; cam.size = 4.8
	for kv in OS.get_environment("GT").split(",", false): GT[kv.split("=")[0]] = float(kv.split("=")[1])
	if OS.get_environment("PROFILE") == "1":
		pos = Vector3(-2.6, 0, 1.7); yaw = atan2(1.0, -1.0); cam_t = pos + Vector3(1.2, 0, -1.2); cam.size = 3.6
		await wait(0.6)
		await go([Vector3(1.6, 0, -2.5)])
		await wait(0.5)
		get_tree().quit(); return
	await wait(1.4)
	if OS.get_environment("HIPS") == "1" and H.has("main") and H["main"].sk != null:
		var skd: Skeleton3D = H["main"].sk; var hb := _bone(skd, "Hips")
		print("HIPS idle ", skd.get_bone_global_pose(hb).origin)
		get_tree().create_timer(2.6).timeout.connect(func() -> void: print("HIPS walk ", skd.get_bone_global_pose(hb).origin, " spd ", spd))
		get_tree().create_timer(3.1).timeout.connect(func() -> void: print("HIPS walk ", skd.get_bone_global_pose(hb).origin, " spd ", spd))
	await go([Vector3(-1.9, 0, 1.7), Vector3(-2.1, 0, -1.5)])
	if OS.get_environment("HIPS") == "1" and H.has("main") and H["main"].sk != null:
		get_tree().create_timer(1.0).timeout.connect(func() -> void: print("HIPS idle after stop ", (H["main"].sk as Skeleton3D).get_bone_global_pose(_bone(H["main"].sk, "Hips")).origin))
	await wait(1.3)
	await go([Vector3(1.7, 0, -1.3)])
	await wait(1.4)
	await go([Vector3(1.3, 0, 1.5)])
	await wait(1.8)
	get_tree().quit()

func _a_walk(p: Vector3, cap := WALK) -> void:
	print("AUTO walk ", p, " from ", pos, " f=", Engine.get_frames_drawn())
	if walk_to(p, cap): await settled
	else: print("AUTO no path to ", p)

func _a_use(k: String) -> void:
	print("AUTO use ", k, " f=", Engine.get_frames_drawn())
	use(k)
	if pending == k: await settled
	else: print("AUTO cannot reach ", k)
