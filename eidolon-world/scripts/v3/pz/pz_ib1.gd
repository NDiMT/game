extends Puzzle
## IB1 "The Reed Bank" (between): a breath after the first glass. Reeds round a still shallow by the east wall, the
## water laps, and her reflection lingers in it a beat after you have walked on (a planar sheet, lag 0.9 s). You may
## wade it (wet steps). Done = stood at the water once (no jingle, no gate).

const POOL := Rect2(18.4, 10.6, 2.25, 4.1)
var refl: Reflector

func build() -> void:
	jingle = false
	hint_after = 1.0e9
	_reeds()

func post() -> void:
	var c := POOL.get_center()
	refl = TwoWorld.still_water(self, game, Vector3(c.x, 0.012, c.y), POOL.size * 0.5, Map3.rect("IB1"), 0.9)
	(game.get("ch") as Ch1v3).add_refl(refl)

## clumps of reeds round the shallow (one mesh, a dull olive-grey, no shadow)
func _reeds() -> void:
	var rng := RandomNumberGenerator.new()
	rng.seed = 41
	var st := SurfaceTool.new()
	st.begin(Mesh.PRIMITIVE_TRIANGLES)
	var clumps := [Vector2(20.55, 10.75), Vector2(18.55, 10.8), Vector2(20.6, 12.6), Vector2(20.55, 14.5), Vector2(18.3, 14.75), Vector2(19.6, 10.7)]
	for c: Vector2 in clumps:
		for k in 14:
			var p := c + Vector2(rng.randf_range(-0.28, 0.28), rng.randf_range(-0.22, 0.22))
			var h := rng.randf_range(0.55, 1.15)
			var lean := Vector3(rng.randf_range(-0.12, 0.12), 0, rng.randf_range(-0.12, 0.12))
			var w := rng.randf_range(0.012, 0.022)
			var a := Vector3(p.x, 0.0, p.y)
			var b := a + Vector3(0, h, 0) + lean * h
			for ang in [0.0, PI * 0.5]:
				var side := Vector3(cos(ang), 0, sin(ang)) * w
				for v in [a - side, a + side, b, a + side, b + side * 0.15, b]: st.add_vertex(v)
	var mesh := st.commit()
	var mi := MeshInstance3D.new()
	mi.mesh = mesh
	var m := StandardMaterial3D.new()
	m.albedo_color = Color(0.43, 0.45, 0.37)
	m.roughness = 0.95
	m.cull_mode = BaseMaterial3D.CULL_DISABLED
	mi.material_override = m
	mi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	add_child(mi)

func wet_at(p: Vector3) -> bool:
	return POOL.has_point(Vector2(p.x, p.z))

func tick(_dt: float) -> void:
	if not done and here() and POOL.grow(0.6).has_point(Vector2(game.player.position.x, game.player.position.z)): solve()

func autosolve() -> void:
	game.cmd("walk:%f:%f" % [POOL.position.x + 0.3, POOL.get_center().y])
