extends Puzzle
## W.4 "The Star Corridor" (CH1_V3 §1 #13, story: it teaches the Shard). A low corridor with no roof in your world; in
## hers it is roofed, and a star is carved in that ceiling. Raise the Shard here (its slot glints until you do): through
## its circle the roof and the star show over her head, and the far door opens. Done = the star seen.

const STAR := Vector3(-35.0, 4.0, -21.5)
var roof: ShaderMaterial
var star: ShaderMaterial

func build() -> void:
	jingle = false
	gate("W4", "W5")

func post() -> void:
	roof = _lens_quad(Vector2(5.4, 2.6), STAR - Vector3(0, 0.02, 0), 1.0, 3)
	star = _lens_quad(Vector2(1.7, 1.7), STAR, 3.0, 4)
	star.set_shader_parameter("design", 5.0)

## a quad seen only through the raised Shard (lens_only.gdshader; A's), facing down
func _lens_quad(size: Vector2, at: Vector3, kind: float, prio: int) -> ShaderMaterial:
	var m := ShaderMaterial.new()
	m.shader = preload("res://shaders/lens_only.gdshader")
	m.set_shader_parameter("noise_tex", game.level.noise_tex)
	m.set_shader_parameter("kind", kind)
	m.render_priority = prio
	var q := QuadMesh.new()
	q.size = size
	var mi := MeshInstance3D.new()
	mi.name = "W4_Star" if kind == 3.0 else "W4_Roof"
	mi.mesh = q
	mi.material_override = m
	mi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	mi.transform = Transform3D(Basis(Vector3.RIGHT, PI * 0.5), at)
	mi.layers = TwoWorld.MINE
	add_child(mi)
	return m

func tick(_dt: float) -> void:
	if _auto and not done and here() and game.mode == "play" and not game.get("lens_on"): game.cmd("lens:1")          # (tests: raise it once there)
	var h := here()
	if h and not done:
		game.set("lens_at", STAR)
		if game.controls: game.controls.inv_pulse = not game.get("lens_on")
		if game.get("lens_on"):
			solve()
			game.ui.show_text("A star, carved in a ceiling\nthat is not there.", game.player.position, 4.5)
			if game.sfx: game.sfx.play_later("chime_hall", 0.4, -14.0, 0.9)
	elif game.get("lens_at") == STAR:
		game.set("lens_at", Vector3.INF)
		if game.controls: game.controls.inv_pulse = false

var _auto := false

func autosolve() -> void:
	if not game.call("has_item", "shard"): game.call("give", "shard", false)
	game.cmd("walk:%f:%f" % [STAR.x, STAR.z])
	_auto = true
