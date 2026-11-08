extends Puzzle
## E.4 "The Upward Spring" (CH1_V3 §1 #31, landmark): a quiet side room off the Mirror Walk (the glass cannot see in:
## a safe place). From a round basin the water runs UP, a slow rope of it, into a small temple that hangs upside-down
## overhead. Touch it: she kneels, and the drops leave her fingers upward. Done = touched (no gate, no jingle).
## A: "E4_Spring" (the rising water, a placeholder shader here), "E4_Temple" (marble, merged), E4_Basin.

const BASIN := Vector3(28.4, 0.0, -39.0)
const TEMPLE_Y := 4.3                        # the hanging temple's lowest point over the floor
var spring: MeshInstance3D

const SPRING_SHADER := """
shader_type spatial;
render_mode cull_disabled, depth_draw_opaque, specular_schlick_ggx;
uniform sampler2D noise_tex : repeat_enable, filter_linear;
void fragment() {
	float n = texture(noise_tex, vec2(UV.x * 2.0, UV.y * 0.6 + TIME * 0.22)).r;
	float n2 = texture(noise_tex, vec2(UV.x * 5.0 + 0.3, UV.y * 1.4 + TIME * 0.5)).r;
	float streak = smoothstep(0.45, 0.8, n * 0.6 + n2 * 0.5);
	ALBEDO = mix(vec3(0.16, 0.2, 0.23), vec3(0.78, 0.84, 0.88), streak);
	ROUGHNESS = 0.08;
	METALLIC = 0.1;
	ALPHA = 0.55 + 0.35 * streak;
	EMISSION = vec3(0.05, 0.07, 0.08) * streak;
}
"""

func build() -> void:
	jingle = false
	hint_after = 1.0e9
	var y := Map3.height("E4", Vector2(BASIN.x, BASIN.z))
	var b := BASIN + Vector3(0, y, 0)
	var m := MB.new()
	m.cyl(b + Vector3(0, 0.22, 0), 0.82, 0.88, 0.44, Color(0.5, 0.25, 0.0), 24)
	m.cyl(b + Vector3(0, 0.46, 0), 0.9, 0.86, 0.06, Color(0.5, 0.0, 0.0), 24)
	Kit3.marble(game, m.commit(), self).name = "E4_Basin"
	game.level.ob_circle(Vector2(BASIN.x, BASIN.z), 0.9)
	# the temple that hangs upside-down: its floor is the roof, its pediment points down at the basin
	var t := MB.new()
	var top := b + Vector3(0, TEMPLE_Y + 1.5, 0)
	t.box(top, Vector3(2.2, 0.22, 1.7), Color(0.5, 0.25, 0.0))
	for sx in [-0.8, 0.8]:
		for sz in [-0.55, 0.55]:
			t.cyl(top + Vector3(sx, -0.62, sz), 0.1, 0.11, 1.02, Color(0.5, 0.0, 0.0), 10)
	t.box(top + Vector3(0, -1.2, 0), Vector3(2.0, 0.16, 1.55), Color(0.5, 0.25, 0.0))
	t.box(top + Vector3(0, -1.38, 0), Vector3(1.7, 0.2, 1.2), Color(0.5, 0.0, 0.0))
	t.cyl(top + Vector3(0, -1.55, 0), 0.08, 0.35, 0.2, Color(0.5, 0.0, 0.0), 12)
	Kit3.marble(game, t.commit(), self).name = "E4_Temple"
	game.level.add_interact("e4_touch", b + Vector3(1.25, -y, 0.0) + Vector3(0, y, 0), "touch", touch, 1.1, func() -> bool: return not done)

func post() -> void:
	var y := Map3.height("E4", Vector2(BASIN.x, BASIN.z))
	var sh := Shader.new()
	sh.code = SPRING_SHADER
	var mat := ShaderMaterial.new()
	mat.shader = sh
	mat.set_shader_parameter("noise_tex", game.level.noise_tex)
	var cm := CylinderMesh.new()
	cm.top_radius = 0.06
	cm.bottom_radius = 0.13
	var h := TEMPLE_Y + 0.05 - 0.48
	cm.height = h
	cm.radial_segments = 12
	cm.rings = 6
	cm.cap_top = false
	cm.cap_bottom = false
	spring = MeshInstance3D.new()
	spring.name = "E4_Spring"
	spring.mesh = cm
	spring.material_override = mat
	spring.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	spring.position = BASIN + Vector3(0, y + 0.48 + h * 0.5, 0)
	add_child(spring)
	var pool := MeshInstance3D.new()
	pool.name = "E4_Water"
	var pm := CylinderMesh.new()
	pm.top_radius = 0.78
	pm.bottom_radius = 0.78
	pm.height = 0.02
	pool.mesh = pm
	pool.material_override = Kit3.water_mat()
	pool.position = BASIN + Vector3(0, y + 0.42, 0)
	add_child(pool)

func touch() -> void:
	var y := Map3.height("E4", Vector2(BASIN.x, BASIN.z))
	game.call("perform", "kneel_touch", BASIN + Vector3(0.45, y + 0.45, 0), func() -> void:
		solve()
		var at := BASIN + Vector3(0.4, y + 0.5, 0)
		if game.juice:
			game.juice.burst(at, "drops_up", 18, Vector3(0.25, 0.05, 0.25), Vector3(0, 1, 0), 20.0, Vector2(0.6, 1.3),
				Vector2(0.025, 0.045), Color(0.78, 0.86, 0.92, 0.9), 2.4, Vector3(0, 0.9, 0))
			game.juice.ring(BASIN + Vector3(0, y + 0.44, 0), 1.0, 1.4)
		if game.sfx:
			game.sfx.play("step_wet", -18.0, 1.3)
			game.sfx.play_later("glass_tink", 0.9, -22.0, 1.4)
		game.ui.show_text("The water falls upward,\ninto a temple built the wrong way round.", game.player.position, 4.5), Vector3.UP, 0.8)

func autosolve() -> void:
	game.cmd("walk:%f:%f" % [BASIN.x + 1.25, BASIN.z])
	get_tree().create_timer(3.0).timeout.connect(func() -> void: game.try_interact())
