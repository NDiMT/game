class_name FogInk
extends GlassTalk.Ink
## v1.0 (Agent A, rendering helper): a HUMAN FINGERTIP on condensation, as a drop-in for GlassTalk.Ink.
## Swap `Ink.new()` for `FogInk.new()` (both instances) in glass_talk.gd; nothing else has to change.
##
## What it adds over the brush Ink (the wipe-mask conventions stay: R = clear glass, G = hint, B = her fingertip):
##  * HER strokes are written with an irregular human speed: they accelerate out of the start, slow on
##    curves and corners, ease off at the end, with a little wobble. GlassTalk tweens a stroke's progress
##    as a TIME fraction; this maps it to the arc length actually wiped, and keeps her hand on the real tip
##    (it pushes the corrected `finger` to the pane shader itself).
##  * The width follows the PRESSURE: the fingertip lands (a rounder, wider start pad), presses unevenly
##    along the stroke, lifts off in a taper. YOUR strokes thin out when you draw fast.
##  * Soft cross-section: three nested strips (additive): the wipe is cleanest down the middle and thins to
##    the edges, where the shader gathers the water into ragged, beaded rims.
##  * An AGE mask (its own SubViewport, `mask_age` on the pane): for every wiped texel, when it was wiped
##    (16 bits of seconds, modulo 512) and a per-stroke seed. The shader grows droplets along the edges,
##    lets some run down with clear streaks, and slowly re-condenses the fog over old strokes.
##  * Fingerprints: the start of each stroke (up to 8) is pushed to the shader (`prints`), which leaves a
##    faint whorl of fog lines in the landing pad.

const MOD := 512.0                 # birth times are stored modulo this (seconds)
const STEP := 2.5                  # resample step (mask pixels)
const LAYERS := [[1.0, 0.36], [0.74, 0.34], [0.44, 0.42]]   # (width scale, value): centre 1.12, edge 0.36

var age_vp: SubViewport
var _age_draw: Node2D
var _rec := {}                     # "h<i>" / "m<i>" -> stroke record (see _record)
var _prints: Array = []            # [uv, birth, strength]
var _tip := Vector2(-99, -99)
var _shader_ready := false

func _ready() -> void:
	if is_equal_approx(width, 21.0): width = 25.0     # (a fingertip is wider than the old brush's nib)
	if only_mine: return
	age_vp = SubViewport.new()
	age_vp.size = GlassTalk.MASK
	age_vp.transparent_bg = true
	age_vp.disable_3d = true
	age_vp.render_target_update_mode = SubViewport.UPDATE_DISABLED
	add_child(age_vp)
	_age_draw = AgeDraw.new()
	_age_draw.ink = self
	age_vp.add_child(_age_draw)

func _now() -> float:
	return host._t if host else 0.0

func _process(_dt: float) -> void:
	if only_mine or age_vp == null: return
	# the age mask renders exactly when the wipe mask does
	var vp := get_viewport() as SubViewport
	if vp and age_vp.render_target_update_mode != vp.render_target_update_mode:
		age_vp.render_target_update_mode = vp.render_target_update_mode
	if host and host.glass_mat and not _shader_ready:
		host.glass_mat.set_shader_parameter("mask_age", age_vp.get_texture())
		host.glass_mat.set_shader_parameter("ink_w", width / float(GlassTalk.MASK.x))
		_shader_ready = true

# ------------------------------------------------------------------ stroke records
## a stroke resampled every STEP px: arc fraction, pressure, birth time (-1: not wiped yet), and for her
## strokes the time -> arc map of a human hand
func _record(key: String, pts: PackedVector2Array, hers: bool) -> Dictionary:
	var r: Dictionary = _rec.get(key, {})
	if not r.is_empty() and r["src"] == pts: return r
	var grow: bool = not r.is_empty() and not hers and pts.size() >= r["n_src"] and r["n_src"] > 0 and pts[0] == r["first"]
	if not grow: _forget_print(key)
	var old_birth: PackedFloat32Array = r["birth"] if grow else PackedFloat32Array()
	var old_n: int = r["sp"].size() if grow else 0
	var seed: float = r.get("seed", randf()) if grow else randf()
	var L := 0.0
	for i in pts.size() - 1: L += pts[i].distance_to(pts[i + 1])
	var sp := PackedVector2Array()
	var ss := PackedFloat32Array()
	if pts.size() >= 2 and L > 0.5:
		var n := clampi(int(L / STEP), 2, 600)
		var acc := 0.0
		var i := 0
		for k in n + 1:
			var d := L * float(k) / n
			while i < pts.size() - 2 and acc + pts[i].distance_to(pts[i + 1]) < d:
				acc += pts[i].distance_to(pts[i + 1])
				i += 1
			var seg := maxf(pts[i].distance_to(pts[i + 1]), 0.0001)
			sp.append(pts[i].lerp(pts[i + 1], clampf((d - acc) / seg, 0.0, 1.0)))
			ss.append(d / L)
	elif pts.size() >= 1:
		sp.append(pts[0]); ss.append(0.0)
	var m := sp.size()
	# curvature per sample (turn angle over a short window, 0..1)
	var curv := PackedFloat32Array(); curv.resize(m)
	for k in m:
		var a := sp[maxi(k - 3, 0)]; var b := sp[k]; var c := sp[mini(k + 3, m - 1)]
		var u := b - a; var v := c - b
		curv[k] = clampf(absf(u.angle_to(v)) / 1.2, 0.0, 1.0) if u.length() > 0.01 and v.length() > 0.01 else 0.0
	var birth := PackedFloat32Array(); birth.resize(m)
	var press := PackedFloat32Array(); press.resize(m)
	var now := _now()
	for k in m:
		var s := ss[k]
		# pressure: lands with a pad, presses unevenly (slow wander + a little grain), lifts off in a taper;
		# a curve is pressed a little harder (the finger slows into it)
		var wander := 0.86 + 0.1 * sin(s * L * 0.021 + seed * 6.3) + 0.05 * sin(s * L * 0.083 + seed * 17.0)
		var land := 1.0 + 0.32 * (1.0 - smoothstep(0.0, minf(0.06, 9.0 / maxf(L, 1.0) * 1.0), s))
		var lift := 1.0 - 0.72 * smoothstep(0.82, 1.0, s)
		press[k] = wander * land * lift * (1.0 + 0.1 * curv[k])
		birth[k] = old_birth[k] if k < old_n and k < old_birth.size() else (-1.0 if hers else now)
	if not hers and m > 2:
		# your strokes: fast = lighter (the finger skims), from the times the points arrived
		for k in range(1, m):
			if birth[k] < 0.0 or birth[k - 1] < 0.0: continue
			var dt := maxf(birth[k] - birth[maxi(k - 4, 0)], 0.001)
			var v := sp[k].distance_to(sp[maxi(k - 4, 0)]) / dt
			press[k] *= clampf(1.18 - v / 1600.0, 0.72, 1.1)
	r = {"src": pts, "n_src": pts.size(), "first": pts[0] if pts.size() > 0 else Vector2.ZERO, "sp": sp, "ss": ss,
		"birth": birth, "press": press, "seed": seed, "L": L, "t2s": _speed_map(ss, curv, L, seed) if hers else PackedFloat32Array()}
	_rec[key] = r
	return r

## a human writing speed along the stroke: out of the start it accelerates, it slows into curves and
## corners, eases off at the end, with a slight irregular wobble. Returns time fraction -> arc fraction
## (64 entries).
func _speed_map(ss: PackedFloat32Array, curv: PackedFloat32Array, L: float, seed: float) -> PackedFloat32Array:
	var m := ss.size()
	var out := PackedFloat32Array(); out.resize(65)
	if m < 2:
		for i in 65: out[i] = float(i) / 64.0
		return out
	var tt := PackedFloat32Array(); tt.resize(m)
	tt[0] = 0.0
	for k in range(1, m):
		var s := ss[k]
		var ramp := 0.35 + 0.65 * smoothstep(0.0, 0.16, s)              # accelerating out of the start
		var ease := 1.0 - 0.45 * smoothstep(0.78, 1.0, s)                  # easing off as it ends
		var c := 0.0
		for j in range(maxi(k - 4, 0), mini(k + 5, m)): c = maxf(c, curv[j])
		var slow := 1.0 - 0.62 * c                                         # slowing into curves
		var wob := 1.0 + 0.16 * sin(s * L * 0.05 + seed * 11.0) + 0.08 * sin(s * L * 0.17 + seed * 3.0)
		var v := maxf(ramp * ease * slow * wob, 0.12)
		tt[k] = tt[k - 1] + (ss[k] - ss[k - 1]) / v
	var T := tt[m - 1]
	var j := 0
	for i in 65:
		var want := T * float(i) / 64.0
		while j < m - 2 and tt[j + 1] < want: j += 1
		var f := clampf((want - tt[j]) / maxf(tt[j + 1] - tt[j], 1e-6), 0.0, 1.0)
		out[i] = lerpf(ss[j], ss[j + 1], f)
	return out

## time fraction (what GlassTalk tweens) -> arc fraction wiped
func arc_of(r: Dictionary, v: float) -> float:
	var map: PackedFloat32Array = r["t2s"]
	if map.size() < 2: return clampf(v, 0.0, 1.0)
	var x := clampf(v, 0.0, 1.0) * 64.0
	var i := mini(int(x), 63)
	return lerpf(map[i], map[i + 1], x - i)

## the point on a stroke at arc fraction s
func point_at(r: Dictionary, s: float) -> Vector2:
	var sp: PackedVector2Array = r["sp"]
	if sp.size() == 0: return Vector2(-99, -99)
	var x := clampf(s, 0.0, 1.0) * (sp.size() - 1)
	var i := mini(int(x), sp.size() - 2) if sp.size() > 1 else 0
	return sp[i].lerp(sp[mini(i + 1, sp.size() - 1)], x - i)

## (public) where HER fingertip is on stroke `idx` at time fraction v (for callers that want it)
func tip(idx: int, v: float) -> Vector2:
	if idx < 0 or idx >= her.size(): return Vector2(-99, -99)
	var r := _record("h%d" % idx, her[idx][0], true)
	return point_at(r, arc_of(r, v))

# ------------------------------------------------------------------ drawing
func _draw() -> void:
	if only_mine:
		for k in mine.size():
			var r := _record("m%d" % k, mine[k][0], false)
			_finger_strip(r, 1.0, Color(mine[k][1], 0, 0), width * 1.12)
		return
	if twin: twin.queue_redraw()
	var now := _now()
	var active := -1
	for k in her.size():
		var h: Array = her[k]
		var r := _record("h%d" % k, h[0], true)
		var s := arc_of(r, h[1])
		var births: PackedFloat32Array = r["birth"]
		var ss: PackedFloat32Array = r["ss"]
		for i in births.size():
			if births[i] < 0.0 and ss[i] <= s + 0.0001 and s > 0.0: births[i] = now
		if h[1] > 0.0 and h[1] < 1.0: active = k
		_finger_strip(r, s, Color(1, 0, 0), width)
		if s > 0.0: _note_print("h%d" % k, r)
	for k in mine.size():
		var r := _record("m%d" % k, mine[k][0], false)
		if r["sp"].size() > 1: _note_print("m%d" % k, r, mine[k][1])
	# drop records of strokes that are gone (a cleared pane, a popped stroke)
	for key in _rec.keys():
		var idx := int(key.substr(1))
		if (key[0] == "h" and idx >= her.size()) or (key[0] == "m" and idx >= mine.size()):
			_rec.erase(key)
			_forget_print(key)
	for h in hint:
		if h.size() > 3 and h[3]: _dots(h[0], h[1], Color(0, h[2], 0), width * 0.32)
		else: _poly(h[0], h[1], Color(0, h[2], 0), width * 0.8)
	if active >= 0:
		var r: Dictionary = _rec["h%d" % active]
		_tip = point_at(r, arc_of(r, her[active][1]))
		finger = _tip
	if finger_k > 0.0:
		for i in 4: draw_circle(finger, 9.0 - i * 2.0, Color(0, 0, 0.25 * finger_k))
	_push()
	if _age_draw: _age_draw.queue_redraw()

## one fingertip stroke up to arc fraction `upto`: three nested strips (soft cross-section), width by
## pressure; a round pad where the finger landed
func _finger_strip(r: Dictionary, upto: float, col: Color, w: float) -> void:
	var sp: PackedVector2Array = r["sp"]
	var ss: PackedFloat32Array = r["ss"]
	var press: PackedFloat32Array = r["press"]
	if sp.size() == 0 or upto <= 0.0: return
	var n := 0
	while n < sp.size() and ss[n] <= upto + 0.0001: n += 1
	if n < 2:
		for L in LAYERS: draw_circle(sp[0], w * 0.5 * L[0] * press[0], col * L[1])
		return
	for L in LAYERS:
		var ws: float = w * 0.5 * L[0]
		var c: Color = Color(col.r * L[1], col.g * L[1], col.b * L[1], 1.0)
		var left := PackedVector2Array(); var right := PackedVector2Array()
		left.resize(n); right.resize(n)
		for k in n:
			var t := sp[mini(k + 1, sp.size() - 1)] - sp[maxi(k - 1, 0)]
			t = t.normalized() if t.length() > 0.0001 else Vector2.RIGHT
			var rr := maxf(ws * press[k], 0.6)
			var nn := Vector2(-t.y, t.x) * rr
			left[k] = sp[k] + nn
			right[k] = sp[k] - nn
		var cs := PackedColorArray([c, c, c, c])
		for k in n - 1:
			draw_primitive(PackedVector2Array([left[k], left[k + 1], right[k + 1], right[k]]), cs, PackedVector2Array())
		# the landing pad: a rounder blob under the first samples (overlaps the strip a little: fine,
		# it is where the finger pressed hardest)
		draw_circle(sp[0], ws * press[0] * 0.92, Color(c.r * 0.55, c.g * 0.55, c.b * 0.55, 1.0))

func _note_print(key: String, r: Dictionary, k := 1.0) -> void:
	for p in _prints:
		if p[3] == key:
			p[2] = k
			return
	var b: PackedFloat32Array = r["birth"]
	_prints.append([r["sp"][0] / Vector2(GlassTalk.MASK), b[0] if b.size() > 0 and b[0] >= 0.0 else _now(), k, key])
	while _prints.size() > 8: _prints.pop_front()

func _forget_print(key: String) -> void:
	for i in range(_prints.size() - 1, -1, -1):
		if _prints[i][3] == key: _prints.remove_at(i)

## (for GlassTalk.open / close) forget every stroke, print and age: the next pane starts clean. The
## masks are redrawn from the (cleared) stroke arrays on the next frame; call this right after clearing them.
func reset_state() -> void:
	_rec.clear()
	_prints.clear()
	_tip = Vector2(-99, -99)
	if twin is FogInk: (twin as FogInk)._rec.clear()
	_push()
	if age_vp and _age_draw:
		_age_draw.queue_redraw()
		age_vp.render_target_update_mode = SubViewport.UPDATE_ONCE

func _push() -> void:
	if not host or not host.glass_mat: return
	var arr := PackedVector4Array()
	for i in 8:
		if i < _prints.size():
			var p: Array = _prints[i]
			arr.append(Vector4(p[0].x, p[0].y, fposmod(p[1], MOD), p[2]))
		else:
			arr.append(Vector4(-9, -9, 0, 0))
	host.glass_mat.set_shader_parameter("prints", arr)
	if _tip.x > -50.0 and finger_k > 0.0:
		host.glass_mat.set_shader_parameter("finger", _tip / Vector2(GlassTalk.MASK))

## the age mask: every wiped texel stores when it was wiped (R:G = 16 bits of seconds mod 512) and the
## stroke's seed (B); A = 1 where any finger passed. Mix blend: the latest pass wins.
class AgeDraw extends Node2D:
	var ink: FogInk
	func _draw() -> void:
		for key in ink._rec:
			var r: Dictionary = ink._rec[key]
			var sp: PackedVector2Array = r["sp"]
			var births: PackedFloat32Array = r["birth"]
			var press: PackedFloat32Array = r["press"]
			var n := 0
			while n < sp.size() and births[n] >= 0.0: n += 1
			if n == 0: continue
			var w := ink.width * (1.12 if key[0] == "m" else 1.0) * 0.95     # (wider than the wipe: the wet halo where drops form)
			if n == 1:
				draw_circle(sp[0], w * press[0], _enc(births[0], r["seed"]))
				continue
			for k in n - 1:
				var t := sp[k + 1] - sp[k]
				t = t.normalized() if t.length() > 0.0001 else Vector2.RIGHT
				var a := Vector2(-t.y, t.x) * w * press[k]
				var b := Vector2(-t.y, t.x) * w * press[k + 1]
				var c := _enc(births[k], r["seed"])
				draw_primitive(PackedVector2Array([sp[k] + a, sp[k + 1] + b, sp[k + 1] - b, sp[k] - a]), PackedColorArray([c, c, c, c]), PackedVector2Array())
			draw_circle(sp[0], w * press[0] * 1.05, _enc(births[0], r["seed"]))
	static func _enc(birth: float, seed: float) -> Color:
		var v := int(fposmod(birth, FogInk.MOD) / FogInk.MOD * 65535.0)
		return Color(float(v >> 8) / 255.0, float(v & 255) / 255.0, seed, 1.0)
