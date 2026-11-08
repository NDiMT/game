extends Puzzle
## W.5 "Where Her Shadow Fell" (CH1_V3 §2, ★★★★): her veiled statue in the middle of the chamber, five braziers round
## it, and on the north and east walls three pairs of red eyes, waiting for a face. A lit brazier throws the statue's
## head-shadow onto the wall, away from the fire (real geometry: flame -> head -> wall). Light the braziers whose
## shadow "wears" each pair: the eyes blaze in it.
##   Teach   one brazier burns already and its shadow misses (it falls on bare wall)
##   Test    a pair under one shadow
##   Twist   the great pair on the north wall: its eyes are far apart: each needs its own brazier, both at once
## Solved when every pair is worn and no lit brazier's shadow falls on bare wall. Toggles are free (tap a brazier with
## the Lamp); the urn by the door snuffs them all. Owner rules: bold red eyes; no brazier ever covers an eye.

const Y := 1.0
const HEAD := Vector3(-43.5, Y + 1.55, -24.0)
const NZ := -27.8                        # the north wall's face
const EX := -38.2                        # the east wall's face
const FLAME_Y := Y + 1.2
## the braziers (x, z); b0 is the wrong one (lit at the start)
const BRAZ := [Vector2(-45.6, -21.2), Vector2(-44.8, -20.4), Vector2(-41.4, -22.0), Vector2(-46.4, -22.6), Vector2(-43.1, -19.7)]
## the pairs: [name, [braziers whose shadow each eye needs]]: one shadow for both eyes, or one per eye (the great pair)
const PAIRS := [["P1", [1]], ["P2", [3]], ["P3", [4, 2]]]
const URN := Vector3(-39.0, Y, -18.0)
var lit: Array = [true, false, false, false, false]
var flames: Array = []
var shadows: Array = []          # MeshInstance3D per brazier (its head-shadow on the wall)
var spots: Array = []            # [Vector3 wall point, Vector3 wall normal, float scale] per brazier
var eyes := {}                   # pair -> [ShaderMaterial] (one or two eye glows)
var _auto: Array = []
var _auto_t := 0.0

func build() -> void:
	test_s = 60.0
	gate("W5", "IBW")
	var lv := game.level
	for i in BRAZ.size():
		var b: Vector2 = BRAZ[i]
		lv.ob_circle(b, 0.34)
		var side := Vector3(-0.42, 0, 0.42) if i == 2 else Vector3(0, 0, 0.55)          # (b2: its south-west side, clear of b4)
		lv.add_interact("w5_b%d" % i, Vector3(b.x, Y, b.y) + side, "light", func() -> void: toggle(i), 1.0,
			func() -> bool: return not done and game.call("has_item", "lamp"))
	# the statue's plinth
	var m := MB.new()
	m.box(Vector3(HEAD.x, Y + 0.15, HEAD.z), Vector3(0.9, 0.3, 0.9), Color(0.5, 0.25, 0.0))
	m.cyl(URN + Vector3(0, 0.35, 0), 0.22, 0.3, 0.7, Color(0.5, 0.9, 0.0), 12)
	Kit3.marble(game, m.commit(), self).name = "W5_Plinth"
	lv.ob_rect(Rect2(HEAD.x - 0.48, HEAD.z - 0.48, 0.96, 0.96))
	lv.ob_circle(Vector2(URN.x, URN.z), 0.32)
	lv.add_interact("w5_urn", URN + Vector3(-0.8, 0, 0), "reset", snuff_all, 1.0, func() -> bool: return not done and lit.has(true))
	for i in BRAZ.size(): spots.append(_shadow_at(i))

## where brazier i throws the head's shadow: the first wall the ray flame -> head meets beyond the head
func _shadow_at(i: int) -> Array:
	var b: Vector2 = BRAZ[i]
	var f := Vector3(b.x, FLAME_Y, b.y)
	var d := HEAD - f
	var best := []
	if d.z < 0.0:
		var t := (NZ - f.z) / d.z
		var p := f + d * t
		if p.x > -47.8 and p.x < EX: best = [p + Vector3(0, 0, 0.02), Vector3.BACK, t]
	if d.x > 0.0:
		var t2 := (EX - f.x) / d.x
		var p2 := f + d * t2
		if p2.z > NZ and p2.z < -17.2 and (best.is_empty() or t2 < best[2]): best = [p2 + Vector3(-0.02, 0, 0), Vector3.LEFT, t2]
	return best

func post() -> void:
	Kit3.prop(self, "statue_veiled_mourning", Vector3(HEAD.x, Y + 0.3, HEAD.z), 1.5, 30.0)
	for i in BRAZ.size():
		var b: Vector2 = BRAZ[i]
		Kit3.prop(self, "brazier", Vector3(b.x, Y, b.y), 1.1, 0.0)
		flames.append(Kit3.flame(game, self, Vector3(b.x, FLAME_Y, b.y), 0.3, lit[i]))
		shadows.append(_shadow_quad(i))
	for p in PAIRS:
		var mats: Array = []
		var bs: Array = p[1]
		if bs.size() == 1:
			var s: Array = spots[bs[0]]
			for sx in [-1.0, 1.0]: mats.append(_eye(s, sx * 0.15))
		else:
			for bi in bs: mats.append(_eye(spots[bi], 0.0))
		eyes[p[0]] = mats
	_refresh(true)

## (placeholder: A's "W5_Shadow") a soft dark head on the wall, its size by the throw
func _shadow_quad(i: int) -> MeshInstance3D:
	var s: Array = spots[i]
	var g := Gradient.new()
	g.set_color(0, Color(0.02, 0.02, 0.03, 0.82))
	g.set_color(1, Color(0.02, 0.02, 0.03, 0.0))
	g.add_point(0.55, Color(0.02, 0.02, 0.03, 0.7))
	var gt := GradientTexture2D.new()
	gt.gradient = g
	gt.fill = GradientTexture2D.FILL_RADIAL
	gt.fill_from = Vector2(0.5, 0.5)
	gt.fill_to = Vector2(0.5, 0.0)
	var m := StandardMaterial3D.new()
	m.albedo_texture = gt
	m.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	m.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	var q := QuadMesh.new()
	var k: float = s[2]
	q.size = Vector2(0.28, 0.36) * k
	var mi := MeshInstance3D.new()
	mi.name = "W5_Shadow_%d" % i
	mi.mesh = q
	mi.material_override = m
	mi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	mi.transform = Transform3D(Basis.looking_at(-(s[1] as Vector3), Vector3.UP), s[0])
	add_child(mi)
	return mi

## one red eye on the wall (a glow + a hard core): dim until worn
func _eye(s: Array, along: float) -> ShaderMaterial:
	var n: Vector3 = s[1]
	var side := Vector3.UP.cross(n).normalized()
	var at: Vector3 = (s[0] as Vector3) + side * along + Vector3(0, 0.05, 0) + n * 0.02
	var m := Kit3.glow(self, at, 0.27, Palette.HER, 0.5)
	get_child(get_child_count() - 1).name = "W5_Eye"
	return m

func toggle(i: int) -> void:
	game.call("perform", "reach", Vector3(BRAZ[i].x, FLAME_Y - 0.2, BRAZ[i].y), func() -> void:
		lit[i] = not lit[i]
		state["lit"] = lit.duplicate()
		progress()
		if game.sfx: game.sfx.play("flip" if lit[i] else "click", -14.0, 1.1 if lit[i] else 0.8)
		if lit[i] and game.juice: game.juice.sparks(Vector3(BRAZ[i].x, FLAME_Y, BRAZ[i].y))
		_refresh(false)
		_check())

func snuff_all() -> void:
	game.call("perform", "reach", URN + Vector3(0, 0.7, 0), func() -> void:
		for i in lit.size(): lit[i] = false
		state["lit"] = lit.duplicate()
		if game.sfx: game.sfx.play("hollow", -14.0, 0.9)
		_refresh(false))

func worn(pair: Array) -> bool:
	for bi in pair[1]:
		if not lit[bi]: return false
	return true

## every lit brazier's shadow must wear an eye
func _wasted() -> bool:
	for i in lit.size():
		if not lit[i]: continue
		var used := false
		for p in PAIRS:
			if i in p[1]: used = true
		if not used: return true
	return false

func _refresh(snap: bool) -> void:
	for i in lit.size():
		flames[i].mat.set_shader_parameter("intensity", 0.95 if lit[i] else 0.0)
		(shadows[i] as MeshInstance3D).visible = lit[i]
	for p in PAIRS:
		var w := worn(p)
		var bs: Array = p[1]
		var mats: Array = eyes[p[0]]
		for j in mats.size():
			var on: bool = w if bs.size() == 1 else bool(lit[bs[j]])
			var to: float = 2.6 if (on and w) else (1.2 if on else 0.5)
			if snap: mats[j].set_shader_parameter("intensity", to)
			else:
				var tw := create_tween()
				tw.tween_method(func(v: float) -> void: mats[j].set_shader_parameter("intensity", v), float(mats[j].get_shader_parameter("intensity")), to, 0.5)

func _check() -> void:
	for p in PAIRS:
		if not worn(p): return
	if _wasted(): return
	solve()

func on_solved() -> void:
	if game.juice: game.juice.shake(0.05)
	if game.sfx: game.sfx.play_later("door", 0.6, -12.0, 0.8)

func apply() -> void:
	super.apply()
	var l: Array = state.get("lit", [true, false, false, false, false])
	if done: l = [false, true, true, true, true]
	for i in lit.size(): lit[i] = bool(l[i]) if i < l.size() else false
	if flames.size() == lit.size(): _refresh(true)

## her knuckles on the wall by the pair that is still blind
func hint() -> void:
	for p in PAIRS:
		if not worn(p):
			var s: Array = spots[p[1][0]]
			if game.juice: game.juice.glint(s[0])
			break
	if game.sfx:
		game.sfx.play("glass_tink", -14.0, 0.8)
		game.sfx.play_later("glass_tink", 0.4, -14.0, 0.8)

func autosolve() -> void:
	if not game.call("has_item", "lamp"): game.call("give", "lamp", false)
	_auto = []
	for i in [0, 1, 4, 2, 3]:
		_auto.append(["walk", BRAZ[i].x + (0.75 if i != 3 else 0.0), BRAZ[i].y + (0.0 if i != 3 else 0.75)])
		_auto.append(["t", i])

func tick(dt: float) -> void:
	if _auto.is_empty(): return
	_auto_t += dt
	if game.auto_target != Vector3.INF or game.get("_acting") or _auto_t < 0.8: return
	var a: Array = _auto.pop_front()
	_auto_t = 0.0
	match a[0]:
		"walk": game.cmd("walk:%f:%f" % [a[1], a[2]])
		"t": toggle(a[1])
