extends Puzzle
## VW "The Veiled Way" (CH1_V3 §1 #34, between): the way south out of the Atrium, shut until the three Beacons burn
## (pz_a's bars). Three curtains of torn veils hang across it on bronze rods (A: "VW_Veil_*"); each parts before her and
## falls closed behind. At its end the waking pool lies open, the fog gone. Done = the way's end (no jingle, no gate).

const RODS_Z := [13.2, 16.8, 20.4]
const X0 := -9.0
const X1 := -5.0
var veils: Array = []
var _parted := []

func build() -> void:
	jingle = false
	hint_after = 1.0e9
	var m := MB.new()
	# each rod is set in the east wall and carried on a slim post by the low west parapet
	const XE := -5.21
	const XW := -8.66
	for z: float in RODS_Z:
		m.box(Vector3((XW + XE) * 0.5, 2.42, z), Vector3(XE - XW + 0.04, 0.05, 0.05), Color(0.5, 0.9, 0.0))
		m.cyl(Vector3(XW, 1.235, z), 0.04, 0.05, 2.47, Color(0.5, 0.9, 0.0), 6)
		game.level.ob_circle(Vector2(XW, z), 0.08)
	Kit3.marble(game, m.commit(), self).name = "VW_Rods"

func post() -> void:
	for i in RODS_Z.size():
		for side in [-1.0, 1.0]:
			var x: float = (X0 + X1) * 0.5 + side * 0.92
			var v := Kit3.veil(self, "VW_Veil_%d_%s" % [i, "w" if side < 0.0 else "e"], Vector3(x, 2.4, RODS_Z[i]), Vector2(1.72, 1.45 + 0.12 * i), Basis(), 0.6)
			v.set_meta("x0", x)
			v.set_meta("side", side)
			veils.append(v)
			_parted.append(0.0)

func tick(dt: float) -> void:
	var p := game.player.position
	var inside := p.x > X0 - 0.5 and p.x < X1 + 0.5 and p.z > 9.0 and p.z < 25.0
	if not inside and _parted.max() <= 0.0: return
	for i in veils.size():
		var v: MeshInstance3D = veils[i]
		var k := (1.0 - smoothstep(0.6, 1.8, absf(p.z - v.position.z))) if inside else 0.0
		_parted[i] = move_toward(_parted[i], k, dt * 1.4)
		var s := float(v.get_meta("side"))
		v.position.x = float(v.get_meta("x0")) + s * 0.45 * _parted[i]
		v.rotation.z = s * 0.28 * _parted[i]
	if done or game.mode != "play" or p.z < 22.6 or not inside: return
	solve()
	if game.sfx: game.sfx.play("whoosh", -24.0, 0.5)

func apply() -> void:
	super.apply()
	for i in _parted.size(): _parted[i] = 0.0

func autosolve() -> void:
	game.cmd("walk:%f:%f" % [-7.0, 23.2])
