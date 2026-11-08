class_name PolishArt
## v3 (Agent A, a5: phase 5 polish) the last placeholders, by name, after WingArt (WingArt.dress_all calls dress_all here:
## W needs no new call). Same rules: W's nodes, materials, params and tweens are kept; a shader is swapped inside W's own
## material (its uniform names kept), new pieces are not marble (no marble instances added).
##   *_Veil_* (Kit3.veil: ER, E1, IBE, EH, VW, IBN)  torn gauze: frayed tongues, moth holes, a crimson-dyed hem, sheer
##                    against the light; `wind`, `phase` as before, + `stream` (the free end blown along the veil's +x)
##   IBN              the Wind Ramp's veils: four iron poles on its east side, veils streaming UPHILL (north)
##   N4 rugs          mosaic rugs (tesserae, a meander border, her rosette that lights crimson-gold with W's `lit`)
##   N4_Knock         her two knocks on the glass: a ring that runs out from the knuckles (W's `intensity` tween)
##   N5_Beam          the sun's beam: a soft gold core with dust drifting along it (W's ribbon, any path)
##   N5_Fresco        her fresco: the veiled woman in four panels on old plaster, each panel waking with W's `lit`
##   E3_Mist_*        breath-mist on the glass where he looks (`k` 0..1): beads, a blooming edge
##   E4_Spring        the rope of water rising: clear, bright streaks running up, a fresnel rim
##   I23              the chapter's end: EndingFx (a light rig, crimson under the palms, the shrine's light returning)

static func dress_all(game: Game) -> void:
	var ch: Variant = game.get("ch")
	if ch == null: return
	var pz: Dictionary = ch.get("pz")
	for id in pz:
		var p: Node3D = pz[id]
		if p.has_meta("a5_dressed"): continue
		p.set_meta("a5_dressed", true)
		for c in p.get_children(): _dress(c, p, game)
		match str(id):
			"IBN": _ibn(p, game)
			"N4": _n4_rugs(p)
			"I23": EndingFx.attach(p, game)

static func _dress(c: Node, p: Node3D, game: Game) -> void:
	var nm := str(c.name)
	if nm.contains("_Veil_"): veil(c as MeshInstance3D, game)
	elif nm == "N4_Knock": _swap(c as MeshInstance3D, KNOCK_SH)
	elif nm == "N5_Beam": _beam(c as MeshInstance3D, p)
	elif nm == "N5_Fresco": _fresco(c as Node3D, game)
	elif nm.begins_with("E3_Mist_"): _swap(c as MeshInstance3D, MIST_SH)
	elif nm == "E4_Spring":
		_swap(c as MeshInstance3D, SPRING_SH)
		(c as Node3D).scale = Vector3(1.7, 1.0, 1.7)      # (a rope of water that can hold the temple up, not a wire)

# ------------------------------------------------------------------ helpers
static var _shaders := {}
static func shader(code: String) -> Shader:
	if not _shaders.has(code):
		var s := Shader.new()
		s.code = code
		_shaders[code] = s
	return _shaders[code]

## swap the shader inside W's own material, keeping every uniform value W set or tweens
static func _swap(mi: MeshInstance3D, code: String) -> ShaderMaterial:
	if mi == null or not (mi.material_override is ShaderMaterial): return null
	var m := mi.material_override as ShaderMaterial
	var keep := {}
	if m.shader:
		for u in m.shader.get_shader_uniform_list(): keep[u["name"]] = m.get_shader_parameter(u["name"])
	m.shader = shader(code)
	for k in keep:
		if keep[k] != null: m.set_shader_parameter(k, keep[k])
	return m

static func _const(p: Node, n: String) -> Variant:
	var s := p.get_script() as Script
	return s.get_script_constant_map().get(n) if s else null

# ------------------------------------------------------------------ the veils
static func veil(mi: MeshInstance3D, game: Game, stream := 0.0) -> void:
	var m := _swap(mi, VEIL_SH)
	if m == null: return
	m.set_shader_parameter("noise_tex", game.level.noise_tex)
	if stream > 0.0: m.set_shader_parameter("stream", stream)

const VEIL_SH := """
shader_type spatial;
render_mode cull_disabled, diffuse_lambert, specular_disabled;
uniform float wind = 1.0;
uniform float phase = 0.0;
uniform float stream = 0.0;               // the free end blown along +x (radians from hanging straight)
uniform sampler2D noise_tex : repeat_enable, filter_linear;
uniform vec4 tint : source_color = vec4(0.82, 0.80, 0.775, 1.0);
uniform vec4 hem : source_color = vec4(0.44, 0.03, 0.06, 1.0);
varying float drop;
void vertex() {
	drop = UV.y;
	float w = wind * drop * drop;
	float t = TIME * (1.4 + 0.35 * wind) + phase;
	VERTEX.z += (sin(t + VERTEX.x * 3.1 + drop * 2.4) * 0.09 + sin(t * 2.3 + drop * 5.0) * 0.03 + sin(t * 4.3 + VERTEX.x * 9.0 + drop * 11.0) * 0.012) * w;
	VERTEX.x += sin(t * 0.7 + phase) * 0.05 * w;
	VERTEX.y += (1.0 - cos(clamp(w * 0.25, 0.0, 1.0))) * 0.2;
	if (stream > 0.0) {
		float L = -VERTEX.y;
		float a = stream * (0.55 + 0.45 * drop) * (0.92 + 0.10 * sin(t * 1.3 + drop * 3.0 + VERTEX.x * 2.0));
		VERTEX.x += L * sin(a);
		VERTEX.y = -L * cos(a);
	}
}
void fragment() {
	// the torn foot: long frayed tongues, finer threads between them
	float n1 = texture(noise_tex, vec2(UV.x * 0.9 + phase * 0.13, 0.37)).r;
	float rag = 0.80 + 0.17 * n1 + 0.035 * sin(UV.x * 57.0 + phase * 3.0) + 0.02 * sin(UV.x * 131.0 + phase);
	if (UV.y > rag) discard;
	// moth holes and thin wear, more toward the foot
	float hn = texture(noise_tex, UV * vec2(1.6, 2.4) + vec2(phase * 0.21, 0.5)).r;
	if (hn > 0.88 - 0.14 * UV.y * UV.y) discard;
	float thin = smoothstep(0.66, 0.86, hn);
	// a crimson dye bleeding up from the hem (it reads in the shade too), the weave just visible
	float h = smoothstep(0.62, 0.93, UV.y) * 0.45 + smoothstep(rag - 0.06, rag - 0.005, UV.y) * 0.4;
	float weave = 0.5 + 0.5 * sin(UV.x * 380.0) * sin(UV.y * 520.0);
	float fold = 0.92 + 0.08 * sin(UV.x * 23.0 + n1 * 4.0 + phase);
	vec3 c = mix(tint.rgb, hem.rgb, h) * (0.96 + 0.05 * weave) * fold * (1.0 - 0.12 * thin);
	c *= 0.92 + 0.08 * smoothstep(0.0, 0.06, UV.y);       // (the seam under the rod)
	ALBEDO = c;
	ROUGHNESS = 0.95;
	BACKLIGHT = mix(vec3(0.55, 0.52, 0.5), vec3(0.6, 0.08, 0.1), h) * (0.7 + 0.5 * thin);
}
"""

## IBN: the Wind Ramp. Four iron poles against the east wall (behind her from the camera: never in the way), a short
## arm each; the veils stream UPHILL (north, toward the Court) in the wind that W's gust sound blows
static func _ibn(p: Node3D, game: Game) -> void:
	var r := Map3.rect("IBN")
	var x := r.end.x - Map3.WALL_IN - 0.11
	var m := MB.new()
	var veils: Array = []
	var i := 0
	for z in [-34.6, -37.9, -41.2, -44.5]:
		if z < r.position.y + 0.5 or z > r.end.y - 0.5: continue
		var g: Variant = game.level.region_at(Vector2(x - 0.3, z))
		var y: float = (g as Level.Region).height(Vector2(x - 0.3, z)) if g != null else Map3.height("IBN", Vector2(x - 0.3, z))
		m.cyl(Vector3(x, y + 1.32, z), 0.026, 0.034, 2.64, StillRoomFx._c(StillRoomFx.IRON, 0.2), 8)
		m.cyl(Vector3(x, y + 0.04, z), 0.07, 0.085, 0.08, StillRoomFx._c(StillRoomFx.IRON, 0.5), 10)       # its foot
		m.box(Vector3(x - 0.2, y + 2.5, z), Vector3(0.42, 0.035, 0.035), StillRoomFx._c(StillRoomFx.IRON, 0.2))      # the arm
		m.cyl(Vector3(x, y + 2.67, z), 0.0, 0.04, 0.07, StillRoomFx._c(StillRoomFx.ENAMEL, 0.0), 8)       # a crimson finial
		game.level.ob_circle(Vector2(x, z), 0.09)
		var v := Kit3.veil(p, "IBN_Veil_%d" % i, Vector3(x - 0.36, y + 2.48, z + 0.02), Vector2(0.5, 1.75), Basis(Vector3.UP, PI * 0.5), 1.3)
		veil(v, game, 0.55 + 0.08 * (i % 2))
		veils.append(v)
		i += 1
	var mi := StillRoomFx._mesh(p, m.commit(), StillRoomFx.mat(), false)
	mi.name = "IBN_Poles"
	p.set_meta("veils", veils)

# ------------------------------------------------------------------ N.4: the rugs, the knock
static func _n4_rugs(p: Node3D) -> void:
	var rugs: Variant = p.get("rugs")
	if not rugs is Dictionary: return
	var mats := (rugs as Dictionary).values()
	for c in p.get_children():
		if c is MeshInstance3D and (c as MeshInstance3D).material_override in mats:
			var mi := c as MeshInstance3D
			var k := mats.find(mi.material_override)
			mi.name = "N4_Rug_%s" % str((rugs as Dictionary).keys()[k])
			var m := _swap(mi, RUG_SH)
			m.set_shader_parameter("seed", float(k) * 1.37)
			mi.position.y += 0.002                  # (1.4 cm over the floor: clear of its tiles)

const RUG_SH := """
shader_type spatial;
render_mode cull_back, specular_disabled;
global uniform vec4 accent;
uniform float lit = 0.0;
uniform float seed = 0.0;
uniform float design = 0.0;
float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7)) + seed * 13.1) * 43758.5453); }
void fragment() {
	vec2 uv = UV * 2.0 - 1.0;
	float N = 44.0;
	vec2 cell = floor(UV * N);
	vec2 f = fract(UV * N);
	float grout = smoothstep(0.0, 0.12, min(min(f.x, f.y), min(1.0 - f.x, 1.0 - f.y)));
	vec2 cu = (cell + 0.5) / N * 2.0 - 1.0;            // the tessera's centre, -1..1
	float e = max(abs(cu.x), abs(cu.y));
	float rr = length(cu);
	float hv = hash(cell);
	vec3 field = vec3(0.30, 0.33, 0.36);
	vec3 bone = vec3(0.80, 0.77, 0.70);
	vec3 crim = vec3(0.50, 0.05, 0.07);
	vec3 ochre = vec3(0.62, 0.46, 0.24);
	vec3 c = field;
	float glow = 0.0;
	// the border: a bone band, a crimson meander (a running key), a bone band
	if (e > 0.80) {
		c = bone;
		if (e > 0.85 && e < 0.95) {
			vec2 q = (abs(cu.x) > abs(cu.y)) ? vec2(cu.y, e) : vec2(cu.x, e);
			float run = fract(q.x * 3.5 + 0.25);
			float rowk = (q.y - 0.85) / 0.10;
			bool key = (rowk < 0.25) || (run < 0.25 && rowk < 0.75) || (run > 0.25 && run < 0.75 && rowk > 0.5 && rowk < 0.75) || (run > 0.5 && run < 0.75 && rowk > 0.25);
			c = key ? crim : bone * 0.92;
		}
		if (e > 0.97) c = ochre * 0.8;
	} else {
		// the field: scattered darker tesserae; her rosette in the middle (the mirror-oval, rays, a ring)
		c = field * (0.9 + 0.2 * hv);
		float ring = abs(rr - 0.52);
		if (ring < 0.035) { c = ochre; glow = 0.5; }
		float ang = atan(cu.y, cu.x);
		float ray = abs(fract(ang / 6.2832 * 12.0) - 0.5);
		if (rr > 0.22 && rr < 0.46 && ray < 0.12) { c = bone * 0.9; glow = 0.3; }
		float oval = length(cu * vec2(1.0, 0.78));
		if (oval < 0.20) { c = mix(vec3(0.86, 0.84, 0.80), crim, smoothstep(0.12, 0.19, oval)); glow = 1.0; }
		if (e > 0.70 && e < 0.74) c = crim * 0.9;
	}
	c *= 0.9 + 0.16 * hv;
	// worn: a few tesserae lost at the corners and edges
	float lost = step(0.93, hv) * smoothstep(0.55, 0.95, e);
	c = mix(c, vec3(0.22, 0.21, 0.20), lost);
	c *= mix(0.55, 1.0, grout);
	ALBEDO = c;
	ROUGHNESS = 0.7;
	vec3 g = mix(vec3(1.0, 0.72, 0.38), accent.rgb, 0.45);
	EMISSION = g * glow * lit * grout * (1.0 - lost) * 1.1;
}
"""

const KNOCK_SH := """
shader_type spatial;
render_mode unshaded, blend_add, depth_draw_never, cull_disabled, shadows_disabled, fog_disabled;
global uniform vec4 accent;
uniform vec4 color : source_color = vec4(0.86, 0.1, 0.16, 1.0);
uniform float intensity = 0.0;
void fragment() {
	float r = length(UV * 2.0 - 1.0);
	float grow = clamp((0.9 - intensity) / 0.9, 0.0, 1.0);
	float R = 0.12 + 0.62 * grow;
	float ring = smoothstep(0.06, 0.0, abs(r - R)) * (1.0 - grow * 0.6);
	float ring2 = smoothstep(0.04, 0.0, abs(r - R * 0.6)) * 0.5;
	float spot = smoothstep(0.16, 0.0, r);
	float a = (ring + ring2 + spot * 1.3) * intensity * (1.0 - smoothstep(0.85, 1.0, r));
	ALBEDO = mix(color.rgb, accent.rgb, 0.5) * a + vec3(1.0, 0.85, 0.8) * spot * intensity * 0.6;
}
"""

# ------------------------------------------------------------------ N.5: the beam, the fresco
static func _beam(mi: MeshInstance3D, p: Node3D) -> void:
	if mi == null: return
	var Y: Variant = _const(p, "Y")
	var BY: Variant = _const(p, "BEAM_Y")
	var m := ShaderMaterial.new()
	m.shader = shader(BEAM_SH)
	m.set_shader_parameter("beam_y", float(Y if Y != null else 2.0) + float(BY if BY != null else 1.25))
	m.render_priority = 2
	mi.material_override = m

const BEAM_SH := """
shader_type spatial;
render_mode unshaded, blend_add, depth_draw_never, cull_disabled, shadows_disabled;
uniform float beam_y = 3.25;
varying float across;
varying vec3 wp;
void vertex() {
	vec3 w = (MODEL_MATRIX * vec4(VERTEX, 1.0)).xyz;
	// W's ribbon: its vertices stand 7 cm over / under the beam line (the last span rises 25 cm to the fresco)
	float c = abs(w.y - beam_y) < abs(w.y - beam_y - 0.25) ? beam_y : beam_y + 0.25;
	float s = sign(w.y - c);
	across = s;
	VERTEX.y += s * 0.13;                          // a soft 40 cm band round a bright core
	wp = w;
}
void fragment() {
	float a = 1.0 - abs(across);
	float core = pow(a, 6.0);
	float halo = a * a * 0.32;
	float along = wp.x + wp.z;
	float dust = smoothstep(0.82, 1.0, sin(along * 7.0 - TIME * 1.6) * sin(along * 2.3 + TIME * 0.7 + across * 3.0));
	vec3 gold = vec3(1.0, 0.86, 0.6);
	ALBEDO = gold * (core * 1.15 + halo + dust * a * 0.35);
}
"""

static func _fresco(f: Node3D, game: Game) -> void:
	if f == null: return
	for c in f.get_children():
		if not (c is MeshInstance3D): continue
		var mi := c as MeshInstance3D
		var m := _swap(mi, FRESCO_SH)
		if m == null: continue
		m.set_shader_parameter("head", WingArt.head_tex())
		m.set_shader_parameter("noise_tex", game.level.noise_tex)
		mi.position.z += 0.01
		# a thin bronze frame round it (behind the plaster's face: never coplanar)
		var sz := (mi.mesh as QuadMesh).size if mi.mesh is QuadMesh else Vector2(2.2, 2.2)
		var b := MB.new()
		var t := 0.07
		var col := StillRoomFx._c(StillRoomFx.BRONZE, 0.3)
		b.box(Vector3(0, sz.y * 0.5 + t * 0.5, 0.0), Vector3(sz.x + t * 2.0, t, 0.06), col)
		b.box(Vector3(0, -sz.y * 0.5 - t * 0.5, 0.0), Vector3(sz.x + t * 2.0, t, 0.06), col)
		for sx in [-1.0, 1.0]: b.box(Vector3(sx * (sz.x * 0.5 + t * 0.5), 0, 0.0), Vector3(t, sz.y, 0.06), col)
		for k in 3: b.box(Vector3(-sz.x * 0.5 + sz.x * (k + 1) / 4.0, 0, 0.005), Vector3(0.018, sz.y, 0.02), StillRoomFx._c(StillRoomFx.BRONZE, 0.6))
		var fr := StillRoomFx._mesh(f, b.commit(), StillRoomFx.mat(), false)
		fr.name = "N5_FrescoFrame"
		fr.transform = mi.transform

const FRESCO_SH := """
shader_type spatial;
render_mode cull_back, specular_disabled;
global uniform vec4 accent;
uniform float lit = 0.0;
uniform sampler2D head : filter_linear, repeat_disable;
uniform sampler2D noise_tex : filter_linear, repeat_enable;
uniform float design = 0.0;
void fragment() {
	vec2 uv = UV;
	float n = texture(noise_tex, uv * 1.3 + 0.2).r;
	float n2 = texture(noise_tex, uv * 5.0 + 1.7).r;
	// four panels: panel k wakes as lit passes its share (W: 0.05 + 0.95 * sections / 4)
	float k = floor(uv.x * 4.0);
	float wake = smoothstep(0.05 + 0.2375 * k, 0.05 + 0.2375 * (k + 1.0), lit + 0.02);
	// old plaster: ochre and bone, damp blooms, flaked patches
	vec3 plaster = mix(vec3(0.70, 0.62, 0.50), vec3(0.80, 0.75, 0.66), n);
	plaster *= 0.88 + 0.16 * n2;
	// the painting: a dusk ground, her veiled figure (head-and-shoulders, the mirror-oval face) in a crimson gown
	vec3 sky = mix(vec3(0.20, 0.18, 0.24), vec3(0.62, 0.40, 0.30), smoothstep(0.1, 0.95, uv.y));
	vec2 hu = vec2((uv.x - 0.5) * 1.15 + 0.5, uv.y * 1.2 - 0.12);
	float fig = (hu.x > 0.0 && hu.x < 1.0 && hu.y > 0.0 && hu.y < 1.0) ? texture(head, hu).a : 0.0;
	float gown = smoothstep(0.62, 0.9, uv.y) * (1.0 - smoothstep(0.24, 0.40, abs(uv.x - 0.5)));
	vec3 paint = mix(sky, vec3(0.10, 0.09, 0.11), fig);
	paint = mix(paint, vec3(0.50, 0.06, 0.09), max(gown, 0.0) * (1.0 - fig * 0.5));
	float face = 1.0 - smoothstep(0.050, 0.065, length((uv - vec2(0.5, 0.40)) * vec2(1.0, 0.8)));
	paint = mix(paint, vec3(0.88, 0.86, 0.82), face);
	// a halo of gold leaf round her head, the lines between the panels
	float halo = smoothstep(0.012, 0.0, abs(length((uv - vec2(0.5, 0.40)) * vec2(1.0, 0.85)) - 0.15));
	paint = mix(paint, vec3(0.85, 0.66, 0.30), halo * 0.85);
	float flake = smoothstep(0.62, 0.70, n2 * 0.6 + n * 0.5);
	vec3 asleep = mix(plaster, mix(plaster, paint, 0.22), 1.0 - flake);
	vec3 awake = mix(paint, plaster, flake * 0.7);
	vec3 c = mix(asleep, awake, wake);
	ALBEDO = c;
	ROUGHNESS = 0.9;
	EMISSION = (vec3(1.0, 0.78, 0.45) * halo * 0.9 + accent.rgb * face * 0.25) * wake;
}
"""

# ------------------------------------------------------------------ E.3 the mist; E.4 the spring
const MIST_SH := """
shader_type spatial;
render_mode unshaded, blend_mix, depth_draw_never, cull_disabled, shadows_disabled;
uniform sampler2D noise_tex : repeat_enable, filter_linear;
uniform float k = 0.0;
void fragment() {
	vec2 c = (UV - 0.5) * vec2(1.0, 1.25);
	float r = length(c);
	float n = texture(noise_tex, UV * 1.4 + vec2(0.0, TIME * 0.015)).r;
	float n2 = texture(noise_tex, UV * 4.5 + 3.1).r;
	// it blooms from the middle (his breath), the edge broken and feathered
	float reach = k * 0.62;
	float body = 1.0 - smoothstep(reach - 0.12, reach + 0.02, r + (n - 0.5) * 0.22);
	// condensation beads, and a few that have run
	vec2 g = UV * vec2(38.0, 30.0);
	vec2 id = floor(g);
	float h = fract(sin(dot(id, vec2(12.9898, 78.233))) * 43758.5453);
	float bead = smoothstep(0.32, 0.12, length(fract(g) - 0.5 - (h - 0.5) * 0.3)) * step(0.72, h);
	float run = smoothstep(0.985, 1.0, sin(UV.x * 140.0 + h) * 0.5 + 0.5) * smoothstep(0.0, 0.6, UV.y) * step(0.5, k);
	float a = body * (0.62 + 0.25 * n2) - bead * body * 0.35 - run * body * 0.4;
	ALBEDO = mix(vec3(0.80, 0.83, 0.86), vec3(0.95, 0.96, 0.97), n2) + vec3(0.1) * bead * body;
	ALPHA = clamp(a, 0.0, 0.9);
}
"""

const SPRING_SH := """
shader_type spatial;
render_mode blend_mix, cull_disabled, depth_draw_never, specular_schlick_ggx, shadows_disabled;
uniform sampler2D noise_tex : repeat_enable, filter_linear;
void fragment() {
	float fres = pow(1.0 - abs(dot(NORMAL, VIEW)), 2.0);
	float n = texture(noise_tex, vec2(UV.x * 2.0, UV.y * 0.7 + TIME * 0.32)).r;
	float n2 = texture(noise_tex, vec2(UV.x * 6.0 + 0.3, UV.y * 2.2 + TIME * 0.75)).r;
	float streak = smoothstep(0.50, 0.82, n * 0.55 + n2 * 0.55);
	float bead = smoothstep(0.86, 0.95, texture(noise_tex, vec2(UV.x * 9.0, UV.y * 5.0 + TIME * 1.1)).r);
	ALBEDO = mix(vec3(0.42, 0.52, 0.58), vec3(0.92, 0.96, 0.98), streak * 0.8 + bead);
	ROUGHNESS = 0.05;
	METALLIC = 0.0;
	SPECULAR = 0.9;
	EMISSION = vec3(0.10, 0.13, 0.15) * (streak + bead * 2.0);
	ALPHA = clamp(0.22 + 0.45 * fres + 0.35 * streak + 0.4 * bead, 0.0, 0.92);
}
"""
