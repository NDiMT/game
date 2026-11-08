extends Puzzle
## WS "The Waking Shore" (CH1_V3 §1 #1, §4): the marble lip of the waking pool (P, black still water) where she lies.
## Its pieces serve the prologue (Prologue3): the pool's real planar reflection (her double, half a second late), the
## Observer's veiled head far out in the inlet, the path lanterns that light when it ends. Done = the prologue seen.

const LIE := Vector3(-4.6, 0.0, 31.3)            # where she lies, on the lip, facing the water (north)
const LIE_YAW := 0.0
const LIP_Z := 31.0
const SURF_Y := -0.35                           # the pool's surface (Map3.WATER)
const COMB_LAND := Vector3(-4.1, 0.0, 30.95)    # where the comb clinks down on the marble
## the path lanterns, in the order they light (toward the door into I.1)
const LANTERNS := [Vector3(-2.4, 0.0, 34.45), Vector3(-0.3, 0.0, 34.45), Vector3(1.55, 0.0, 34.4), Vector3(1.55, 0.0, 31.6)]
var pool: Reflector
var pool_fx: WaterFX
var observer: MeshInstance3D
var flames: Array[Flame] = []

func build() -> void:
	hint_after = 1.0e9          # (a story space: no hint)
	var m := MB.new()
	for p: Vector3 in LANTERNS:
		m.cyl(p + Vector3(0, 0.36, 0), 0.11, 0.14, 0.72, Color(0.5, 0.25, 0.0), 8)
		m.cyl(p + Vector3(0, 0.75, 0), 0.15, 0.1, 0.06, Color(0.5, 0.9, 0.0), 10)
		game.level.ob_circle(Vector2(p.x, p.z), 0.18)
	Kit3.marble(game, m.commit(), self)

func post() -> void:
	var r := Map3.rect("P")
	var c := Vector3(r.get_center().x, SURF_Y + 0.012, r.get_center().y)
	pool = TwoWorld.still_water(self, game, c, r.size * 0.5 - Vector2(0.25, 0.25), Rect2(r.position.x, r.position.y, 12.0, 11.0), 0.5)
	pool.planar.cam.far = 60.0          # (the prologue looks far across it: the Observer is 25 m out)
	(game.get("ch") as Ch1v3).add_refl(pool)
	pool_fx = WaterFX.new()
	add_child(pool_fx)
	for w in World3.waters:
		var wm := w.material_override as ShaderMaterial
		if wm and not (wm in pool_fx.mats): pool_fx.mats.append(wm)
	observer = Dress.observer(self, Map3.OBSERVER + Vector3(0, SURF_Y, 0), -135.0, 22.0, SURF_Y, 0.7)
	for p: Vector3 in LANTERNS:
		var f := Flame.new(0.0, 0.22, Palette.FIRE_LIGHT, game.level.noise_tex)
		f.position = p + Vector3(0, 0.8, 0)
		f.mat.set_shader_parameter("intensity", 0.0)
		f.bounce = false
		add_child(f)
		flames.append(f)

func apply() -> void:
	super.apply()
	for f in flames: f.mat.set_shader_parameter("intensity", 0.8 if done else 0.0)

## the lanterns light one after another along the shore (the prologue's last shot)
func light_path(gap := 0.45) -> void:
	for i in flames.size():
		var f := flames[i]
		var tw := f.create_tween()
		tw.tween_interval(gap * i)
		tw.tween_callback(func() -> void: if game.sfx: game.sfx.play("flip", -26.0, 1.3 + 0.08 * i))
		tw.tween_method(func(v: float) -> void: f.mat.set_shader_parameter("intensity", v), 0.0, 0.8, 0.7).set_trans(Tween.TRANS_SINE)

func on_solved() -> void:
	for f in flames: f.mat.set_shader_parameter("intensity", 0.8)

func autosolve() -> void:
	solve()
