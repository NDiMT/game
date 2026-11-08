extends Puzzle
## IBE "The Veil Stair" (CH1_V3 §1 #29, between): a short stair up to the Mirror Walk, hung with torn veils on a
## bronze rod over the flight (A: "IBE_Veil_*"). They part as she climbs past them and fall closed behind her; at
## the head the air goes still and cold (the glass is near). Done = the head of the stair (no gate, no jingle).

const ROD_Z := -24.0
const XS := [28.7, 29.5, 30.3]
var veils: Array = []
var _parted := []

func build() -> void:
	jingle = false
	hint_after = 1.0e9
	var m := MB.new()
	var top := Map3.height("IBE", Vector2(31.0, ROD_Z)) + 2.35
	# a bronze rod across the flight at each curtain: set in the north wall, carried on a slim post by the south rail
	const ZN := -26.8
	const ZS := -21.55
	for x: float in XS:
		var fy := Map3.height("IBE", Vector2(x, ZS))
		m.box(Vector3(x, top + 0.02, (ZN + ZS) * 0.5), Vector3(0.04, 0.04, ZS - ZN + 0.02), Color(0.5, 0.9, 0.0))
		m.cyl(Vector3(x, (fy + top + 0.04) * 0.5, ZS), 0.04, 0.05, top + 0.04 - fy, Color(0.5, 0.9, 0.0), 6)
		game.level.ob_circle(Vector2(x, ZS), 0.08)
	Kit3.marble(game, m.commit(), self).name = "IBE_Rods"

func post() -> void:
	var top := Map3.height("IBE", Vector2(31.0, ROD_Z)) + 2.33
	for i in XS.size():
		for side in [-1.0, 1.0]:
			var v := Kit3.veil(self, "IBE_Veil_%d_%s" % [i, "n" if side < 0.0 else "s"], Vector3(XS[i], top, ROD_Z + side * 0.62),
				Vector2(1.1, 1.75 - 0.25 * i), Basis(Vector3.UP, PI * 0.5), 0.7)
			v.set_meta("z0", v.position.z)
			v.set_meta("side", side)
			veils.append(v)
			_parted.append(0.0)

func tick(dt: float) -> void:
	var p := game.player.position
	for i in veils.size():
		var v: MeshInstance3D = veils[i]
		var near_k := 1.0 - smoothstep(0.4, 1.4, absf(p.x - v.position.x)) if absf(p.z - ROD_Z) < 1.6 else 0.0
		_parted[i] = move_toward(_parted[i], near_k, dt * 1.6)
		v.position.z = float(v.get_meta("z0")) + float(v.get_meta("side")) * 0.55 * _parted[i]
		v.rotation.z = -float(v.get_meta("side")) * 0.5 * _parted[i]
	if done or not here() or game.mode != "play" or p.x < 30.3: return
	solve()
	if game.sfx: game.sfx.play("glass", -24.0, 0.45)

func autosolve() -> void:
	game.cmd("walk:%f:%f" % [30.6, ROD_Z])
