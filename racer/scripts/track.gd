class_name Track
extends Node3D
## Procedural test track: a closed Curve3D (Path3D) extruded into a banked road, with
## sand terrain that blends into embankments, jersey barriers, tyre stacks, rocks, a
## start/finish gate, money pickups and a desert-planet sky. Also the query API used by
## the race logic and the AI (nearest sample, racing line, curvature, spawn transforms).

const STEP := 2.0          # metres between track samples
const WIDTH := 15.0
const HALF := WIDTH * 0.5
const SHOULDER := 2.6
const BARRIER_OFF := HALF + 0.9

# control points: x, y (height), z, bank (deg, sign comes from the turn direction)
const CONTROL := [
	[0, 0, 0, 0], [140, 0, 0, 0], [290, 1, 6, 0], [380, 3, 55, 14], [395, 5, 150, 12],
	[330, 6, 215, 12], [240, 5, 205, 0], [180, 3, 150, 8], [110, 2, 165, 8], [50, 2, 230, 0],
	[-50, 1, 255, 0], [-150, 0, 225, 14], [-205, 0, 140, 14], [-175, 0, 55, 10], [-95, 0, 8, 0],
]

var path: Path3D
var n := 0
var length := 0.0
var pos := PackedVector3Array()    # centre line
var fwd := PackedVector3Array()    # unit tangent
var right := PackedVector3Array()  # banked lateral unit vector (driver's right)
var up := PackedVector3Array()     # road normal
var curv := PackedFloat32Array()   # signed curvature of the racing line (+ = right turn)
var line_off := PackedFloat32Array() # racing line lateral offset (m, + = right)
var line_curv := PackedFloat32Array() # |curvature| along the racing line, for speed planning
var jump_idx := 0
var pickup_spots: Array[Vector3] = []
var noise_tex: ImageTexture
var sun: DirectionalLight3D

var _terrain_noise := FastNoiseLite.new()
var _th := PackedFloat32Array()
var _tg := []

func build() -> void:
	_terrain_noise.seed = 7
	_terrain_noise.frequency = 0.006
	_terrain_noise.fractal_octaves = 3
	_make_noise_texture()
	_build_curve()
	_sample_curve()
	_build_racing_line()
	_build_environment()
	_build_road()
	_build_terrain()
	_build_barriers()
	_build_tyres()
	_build_rocks()
	_build_gate()
	_build_pickup_spots()

# ------------------------------------------------------------------ geometry
func _build_curve() -> void:
	var c := Curve3D.new()
	var m := CONTROL.size()
	for i in m + 1:
		var p := _cp(i % m)
		var prev := _cp((i - 1 + m) % m)
		var nxt := _cp((i + 1) % m)
		var t := (nxt - prev) / 6.0 # Catmull-Rom -> Bezier handles
		c.add_point(p, -t, t)
	c.bake_interval = 0.5
	path = Path3D.new()
	path.name = "TrackPath"
	path.curve = c
	add_child(path)

func _cp(i: int) -> Vector3:
	var a: Array = CONTROL[i]
	return Vector3(a[0], a[1], a[2])

func _sample_curve() -> void:
	var c := path.curve
	var total := c.get_baked_length()
	n = int(round(total / STEP))
	var step := total / n
	length = total
	pos.resize(n); fwd.resize(n); right.resize(n); up.resize(n); curv.resize(n)
	for i in n:
		pos[i] = c.sample_baked(i * step, true)
	for i in n:
		fwd[i] = (pos[(i + 1) % n] - pos[(i - 1 + n) % n]).normalized()
	# signed turn rate (xz) smoothed
	var raw := PackedFloat32Array(); raw.resize(n)
	for i in n:
		var a := fwd[(i - 2 + n) % n]; var b := fwd[(i + 2) % n]
		var ang := atan2(a.x * b.z - a.z * b.x, a.x * b.x + a.z * b.z)
		raw[i] = ang / (4.0 * step)
	curv = _smooth(raw, 4)
	# jump: a kicker ramp on the segment between control points 9 and 10
	var jp := Vector3(0, 0, 243)
	var best := 1e9
	for i in n:
		var d := Vector2(pos[i].x - jp.x, pos[i].z - jp.z).length()
		if d < best: best = d; jump_idx = i
	var ramp := 8 # samples (16 m) of ramp
	for k in range(-ramp, 3):
		var i := (jump_idx + k) % n
		var h := 0.0
		if k <= 0: h = 2.3 * pow(float(k + ramp) / ramp, 1.6)
		else: h = 2.3 * (1.0 - float(k) / 3.0)
		pos[i].y += h
	for i in n:
		fwd[i] = (pos[(i + 1) % n] - pos[(i - 1 + n) % n]).normalized()
	# bank: control-point bank magnitude, signed by turn direction, smoothed
	var bank := PackedFloat32Array(); bank.resize(n)
	for i in n:
		var b := _bank_at(i * step / total)
		bank[i] = deg_to_rad(b) * clamp(curv[i] / 0.012, -1.0, 1.0)
	bank = _smooth(bank, 10)
	for i in n:
		var f := fwd[i]
		var r := f.cross(Vector3.UP).normalized()
		if abs(i - jump_idx) < 12: bank[i] = 0.0
		r = (r * cos(bank[i]) - Vector3.UP * sin(bank[i])).normalized()
		right[i] = r
		up[i] = r.cross(f).normalized()

func _bank_at(t: float) -> float:
	# bank magnitude of the nearest control point (by curve offset)
	var c := path.curve
	var best := 1e9; var bi := 0
	var p := c.sample_baked(t * c.get_baked_length())
	for i in CONTROL.size():
		var d := p.distance_to(_cp(i))
		if d < best: best = d; bi = i
	return CONTROL[bi][3]

func _smooth(a: PackedFloat32Array, r: int) -> PackedFloat32Array:
	var out := PackedFloat32Array(); out.resize(a.size())
	var m := a.size()
	for i in m:
		var s := 0.0
		for k in range(-r, r + 1): s += a[(i + k + m) % m]
		out[i] = s / (2 * r + 1)
	return out

func _build_racing_line() -> void:
	# iterative relaxation: pull each point towards the midpoint of its neighbours, clamp to the road
	line_off.resize(n)
	var lim := HALF - 2.4
	for it in 160:
		for i in n:
			var a := sample_point(i - 3, line_off[(i - 3 + n) % n])
			var b := sample_point(i + 3, line_off[(i + 3) % n])
			var mid := (a + b) * 0.5
			var o := (mid - pos[i]).dot(right[i])
			line_off[i] = clamp(lerp(line_off[i], o, 0.5), -lim, lim)
	line_curv.resize(n)
	for i in n:
		var a := sample_point(i - 3, line_off[(i - 3 + n) % n])
		var b := sample_point(i, line_off[i])
		var c := sample_point(i + 3, line_off[(i + 3) % n])
		var d1 := Vector2(b.x - a.x, b.z - a.z); var d2 := Vector2(c.x - b.x, c.z - b.z)
		var ang := absf(d1.angle_to(d2))
		line_curv[i] = ang / maxf(0.1, (d1.length() + d2.length()) * 0.5)
	line_curv = _smooth(line_curv, 2)

# ------------------------------------------------------------------ queries
func wrapi_(i: int) -> int:
	return ((i % n) + n) % n

func sample_point(i: int, lateral: float) -> Vector3:
	i = wrapi_(i)
	return pos[i] + right[i] * lateral

func nearest(p: Vector3, hint: int, back := 10, ahead := 40) -> int:
	var best := 1e18; var bi := hint
	for k in range(-back, ahead + 1):
		var i := wrapi_(hint + k)
		var d := p.distance_squared_to(pos[i])
		if d < best: best = d; bi = i
	return bi

func nearest_global(p: Vector3) -> int:
	var best := 1e18; var bi := 0
	for i in n:
		var d := p.distance_squared_to(pos[i])
		if d < best: best = d; bi = i
	return bi

func lateral_of(p: Vector3, i: int) -> float:
	i = wrapi_(i)
	return (p - pos[i]).dot(right[i])

func frame(i: int, lateral := 0.0, lift := 0.0) -> Transform3D:
	i = wrapi_(i)
	var f := fwd[i]; var u := up[i]
	var b := Basis(u.cross(f).normalized(), u, f)
	return Transform3D(b, pos[i] + right[i] * lateral + u * lift)

func grid_transform(slot: int) -> Transform3D:
	# 2-wide staggered grid just after the start line, slot 0 = pole
	var s := 36.0 - slot * 7.0
	var lat := -3.2 if slot % 2 == 0 else 3.2
	return frame(int(s / STEP), lat, 0.6)

func minimap_points() -> PackedVector2Array:
	var out := PackedVector2Array()
	for i in range(0, n, 2): out.append(Vector2(pos[i].x, pos[i].z))
	return out

# ------------------------------------------------------------------ materials
func _make_noise_texture() -> void:
	var fn := FastNoiseLite.new()
	fn.seed = 3
	fn.frequency = 0.03
	fn.fractal_octaves = 4
	var img := fn.get_seamless_image(256, 256)
	img.convert(Image.FORMAT_RGBA8)
	img.generate_mipmaps()
	noise_tex = ImageTexture.create_from_image(img)

func _shader_mat(code: String) -> ShaderMaterial:
	var sh := Shader.new()
	sh.code = code
	var m := ShaderMaterial.new()
	m.shader = sh
	m.set_shader_parameter("noise_tex", noise_tex)
	return m

const ROAD_SHADER := """
shader_type spatial;
render_mode specular_schlick_ggx;
uniform sampler2D noise_tex : filter_linear_mipmap, repeat_enable;
uniform float track_len = 1500.0;
varying vec3 wpos;
void vertex() { wpos = (MODEL_MATRIX * vec4(VERTEX, 1.0)).xyz; }
void fragment() {
	float u = UV.x; float s = UV.y;
	float n1 = texture(noise_tex, wpos.xz * 0.013).r;
	float n2 = texture(noise_tex, wpos.xz * 0.19).r;
	float n3 = texture(noise_tex, wpos.xz * 0.9).r;
	vec3 base = mix(vec3(0.30, 0.22, 0.18), vec3(0.43, 0.32, 0.25), n1);
	base *= 0.82 + 0.3 * n2 + 0.12 * n3;
	float lane = abs(u - 0.5);
	base *= 1.0 - 0.16 * smoothstep(0.09, 0.0, abs(lane - 0.2));
	float dash = step(0.55, fract(s / 9.0)) * (1.0 - smoothstep(0.006, 0.011, abs(u - 0.5)));
	base = mix(base, vec3(0.9, 0.72, 0.3), dash * 0.7 * (0.6 + 0.4 * n2));
	float inroad = step(0.0, u) * step(u, 1.0);
	float kerb = (1.0 - step(0.05, u)) + step(0.95, u);
	float stripe = step(0.5, fract(s / 4.0));
	vec3 kc = mix(vec3(0.75, 0.13, 0.08), vec3(0.9, 0.86, 0.78), stripe) * (0.85 + 0.2 * n3);
	base = mix(base, kc, kerb * inroad);
	vec3 grav = mix(vec3(0.55, 0.39, 0.27), vec3(0.7, 0.52, 0.36), n2) * (0.85 + 0.25 * n3);
	base = mix(base, grav, 1.0 - inroad);
	if (COLOR.r > 0.5 && inroad > 0.5) {
		float ch = step(0.5, fract((s + abs(u - 0.5) * 18.0) / 3.0));
		base = mix(base, mix(vec3(0.08), vec3(0.95, 0.72, 0.1), ch), 0.85);
	}
	float sd = mod(s, track_len);
	if (sd < 3.0 && inroad > 0.5) {
		float ck = mod(floor(u * 16.0) + floor(sd / 1.0), 2.0);
		base = mix(vec3(0.08), vec3(0.95), ck);
	}
	ALBEDO = base;
	ROUGHNESS = 0.92 - 0.1 * kerb;
	SPECULAR = 0.25;
}
"""

const GROUND_SHADER := """
shader_type spatial;
uniform sampler2D noise_tex : filter_linear_mipmap, repeat_enable;
varying vec3 wpos;
varying vec3 wnrm;
void vertex() { wpos = (MODEL_MATRIX * vec4(VERTEX, 1.0)).xyz; wnrm = NORMAL; }
void fragment() {
	float n1 = texture(noise_tex, wpos.xz * 0.004).r;
	float n2 = texture(noise_tex, wpos.xz * 0.045).r;
	float n3 = texture(noise_tex, wpos.xz * 0.37 + vec2(0.3)).r;
	vec3 sand = mix(vec3(0.80, 0.52, 0.31), vec3(0.92, 0.66, 0.42), n1);
	vec3 rust = vec3(0.56, 0.28, 0.16);
	sand = mix(sand, rust, smoothstep(0.55, 0.75, n2) * 0.6);
	float ripple = sin(wpos.x * 0.9 + wpos.z * 0.35 + n2 * 9.0) * 0.5 + 0.5;
	sand *= 0.9 + 0.1 * ripple + 0.18 * (n3 - 0.5);
	float slope = 1.0 - clamp(wnrm.y, 0.0, 1.0);
	vec3 rock = vec3(0.45, 0.30, 0.22) * (0.8 + 0.4 * n3);
	sand = mix(sand, rock, smoothstep(0.12, 0.3, slope));
	sand = mix(sand, vec3(0.5, 0.36, 0.27) * (0.85 + 0.3 * n3), COLOR.r * 0.7);
	ALBEDO = sand;
	ROUGHNESS = 0.97;
	SPECULAR = 0.15;
}
"""

const BARRIER_SHADER := """
shader_type spatial;
uniform sampler2D noise_tex : filter_linear_mipmap, repeat_enable;
void fragment() {
	float s = UV.x; float h = UV.y;
	float n2 = texture(noise_tex, vec2(s * 0.13, h * 0.7)).r;
	float n3 = texture(noise_tex, vec2(s * 0.9, h * 2.0)).r;
	vec3 c = mix(vec3(0.62, 0.58, 0.52), vec3(0.74, 0.70, 0.63), n2) * (0.85 + 0.25 * n3);
	float seam = 1.0 - smoothstep(0.0, 0.06, abs(fract(s / 4.0) - 0.5) - 0.44);
	float band = step(0.48, h) * step(h, 0.86);
	float diag = step(0.5, fract((s + h * 1.6) / 1.1));
	vec3 hz = mix(vec3(0.07, 0.06, 0.05), vec3(0.95, 0.7, 0.08), diag);
	c = mix(c, hz, band * COLOR.r * 0.92);
	vec3 rw = mix(vec3(0.75, 0.1, 0.08), vec3(0.92), step(0.5, fract(s / 2.0)));
	c = mix(c, rw, band * (1.0 - COLOR.r) * 0.25 * step(0.62, h) * step(h, 0.74) * 3.0);
	c *= 1.0 - seam * 0.45;
	c *= mix(0.7, 1.0, smoothstep(0.0, 0.35, h));
	c = mix(c, vec3(0.42, 0.25, 0.15), smoothstep(0.6, 0.85, n3) * 0.35);
	ALBEDO = c;
	ROUGHNESS = 0.9;
}
"""

const SKY_SHADER := """
shader_type sky;
uniform vec3 planet_dir = vec3(0.75, 0.2, 0.35);
uniform vec3 moon1_dir = vec3(0.35, 0.42, -0.7);
uniform vec3 moon2_dir = vec3(-0.25, 0.3, -0.8);
vec3 basis_u(vec3 c) { return normalize(cross(abs(c.y) > 0.95 ? vec3(1, 0, 0) : vec3(0, 1, 0), c)); }
// draws a lit sphere of angular radius r in direction c; returns rgb + coverage in a
vec4 body(vec3 d, vec3 c, float r, vec3 col_a, vec3 col_b, float bands, vec3 ldir) {
	c = normalize(c);
	vec3 u = basis_u(c); vec3 v = cross(c, u);
	vec2 p = vec2(dot(d, u), dot(d, v)) / sin(r);
	float rr = dot(p, p);
	if (dot(d, c) < 0.0 || rr > 1.0) return vec4(0.0);
	vec3 nrm = p.x * u + p.y * v + sqrt(1.0 - rr) * c;
	float lit = clamp(dot(nrm, ldir) * 1.1 + 0.08, 0.0, 1.0);
	float b = sin(p.y * bands + sin(p.x * 3.0) * 0.6) * 0.5 + 0.5;
	vec3 col = mix(col_a, col_b, b) * (0.12 + lit);
	float edge = smoothstep(1.0, 0.96, rr);
	return vec4(col, edge);
}
void sky() {
	vec3 d = EYEDIR;
	vec3 sdir = LIGHT0_DIRECTION;
	float h = d.y;
	vec3 zen = vec3(0.24, 0.32, 0.46);
	vec3 mid = vec3(0.66, 0.55, 0.50);
	vec3 hor = vec3(0.98, 0.70, 0.46);
	vec3 col = mix(hor, mid, smoothstep(0.0, 0.18, h));
	col = mix(col, zen, smoothstep(0.15, 0.75, h));
	col = mix(col, vec3(0.62, 0.42, 0.3), smoothstep(0.0, -0.12, h));
	float sd = max(dot(d, sdir), 0.0);
	col += vec3(1.0, 0.7, 0.4) * pow(sd, 6.0) * 0.35 + vec3(1.0, 0.8, 0.55) * pow(sd, 60.0) * 0.6;
	col = mix(col, vec3(1.0, 0.96, 0.85) * 3.0, smoothstep(0.9993, 0.9996, sd));
	if (!AT_CUBEMAP_PASS) {
		vec4 pl = body(d, planet_dir, 0.2, vec3(0.78, 0.55, 0.38), vec3(0.55, 0.32, 0.25), 14.0, sdir);
		// ring
		vec3 pc = normalize(planet_dir); vec3 ru = basis_u(pc); vec3 rv = cross(pc, ru);
		vec2 q = vec2(dot(d, ru), dot(d, rv)) / sin(0.2);
		vec2 rq = vec2(q.x * 0.95 + q.y * 0.3, (q.y - q.x * 0.3) * 4.2);
		float rl = length(rq);
		float ring = smoothstep(1.35, 1.4, rl) * smoothstep(2.1, 2.0, rl) * (0.55 + 0.45 * sin(rl * 40.0));
		bool behind = rq.y > 0.0 && pl.a > 0.0;
		vec3 ringc = vec3(0.9, 0.78, 0.62) * 0.75;
		col = mix(col, pl.rgb * 1.2 + col * 0.3, pl.a * 0.9);
		if (!behind && dot(d, pc) > 0.0) col = mix(col, ringc, ring * 0.7);
		vec4 m1 = body(d, moon1_dir, 0.045, vec3(0.8, 0.8, 0.82), vec3(0.6, 0.6, 0.65), 30.0, sdir);
		col = mix(col, m1.rgb + col * 0.25, m1.a);
		vec4 m2 = body(d, moon2_dir, 0.028, vec3(0.75, 0.6, 0.5), vec3(0.55, 0.42, 0.36), 20.0, sdir);
		col = mix(col, m2.rgb + col * 0.25, m2.a);
	}
	float haze = exp(-abs(h) * 14.0);
	col = mix(col, vec3(0.96, 0.74, 0.54), haze * 0.55);
	COLOR = col;
}
"""

# ------------------------------------------------------------------ environment
func _build_environment() -> void:
	var env := Environment.new()
	var sky := Sky.new()
	var sm := ShaderMaterial.new()
	var sh := Shader.new(); sh.code = SKY_SHADER
	sm.shader = sh
	sky.sky_material = sm
	sky.radiance_size = Sky.RADIANCE_SIZE_64
	sky.process_mode = Sky.PROCESS_MODE_QUALITY
	env.background_mode = Environment.BG_SKY
	env.sky = sky
	env.ambient_light_source = Environment.AMBIENT_SOURCE_SKY
	env.ambient_light_energy = 0.75
	env.reflected_light_source = Environment.REFLECTION_SOURCE_SKY
	env.tonemap_mode = Environment.TONE_MAPPER_FILMIC
	env.tonemap_exposure = 1.0
	env.tonemap_white = 6.0
	env.fog_enabled = true
	env.fog_light_color = Color(0.93, 0.72, 0.55)
	env.fog_density = 0.0022
	env.fog_sky_affect = 0.0
	env.fog_aerial_perspective = 0.3
	env.glow_enabled = true
	env.glow_intensity = 0.6
	env.glow_bloom = 0.05
	env.glow_hdr_threshold = 1.1
	env.adjustment_enabled = true
	env.adjustment_saturation = 1.12
	env.adjustment_contrast = 1.06
	var we := WorldEnvironment.new()
	we.environment = env
	add_child(we)
	sun = DirectionalLight3D.new()
	sun.light_color = Color(1.0, 0.86, 0.68)
	sun.light_energy = 1.35
	sun.shadow_enabled = true
	sun.directional_shadow_mode = DirectionalLight3D.SHADOW_ORTHOGONAL
	sun.directional_shadow_max_distance = 70.0
	sun.shadow_blur = 1.5
	sun.shadow_bias = 0.05
	sun.shadow_normal_bias = 1.5
	sun.sky_mode = DirectionalLight3D.SKY_MODE_LIGHT_AND_SKY
	add_child(sun)
	var sdir := Vector3(-0.55, 0.62, 0.45).normalized()
	sun.look_at_from_position(sdir * 100.0, Vector3.ZERO, Vector3.UP)

# ------------------------------------------------------------------ road
func _build_road() -> void:
	# cross section: shoulder L, edge L, edge R, shoulder R (u = 0..1 between the edges)
	var lats := [-HALF - SHOULDER, -HALF, HALF, HALF + SHOULDER]
	var drops := [-0.45, 0.0, 0.0, -0.45]
	var us := [-SHOULDER / WIDTH, 0.0, 1.0, 1.0 + SHOULDER / WIDTH]
	var verts := PackedVector3Array(); var norms := PackedVector3Array()
	var uvs := PackedVector2Array(); var cols := PackedColorArray(); var idx := PackedInt32Array()
	for i in n + 1:
		var k := i % n
		var ramp := 1.0 if (k > jump_idx - 9 and k <= jump_idx) else 0.0
		for j in 4:
			verts.append(pos[k] + right[k] * lats[j] + Vector3.UP * drops[j])
			norms.append(up[k])
			uvs.append(Vector2(us[j], i * STEP * length / (n * STEP)))
			cols.append(Color(ramp, 0, 0))
	for i in n:
		for j in 3:
			var a := i * 4 + j; var b := a + 4
			idx.append_array([a, b, a + 1, a + 1, b, b + 1])
	var mesh := _mesh(verts, norms, uvs, cols, idx)
	var mat := _shader_mat(ROAD_SHADER)
	mat.set_shader_parameter("track_len", length)
	var mi := MeshInstance3D.new()
	mi.mesh = mesh
	mi.material_override = mat
	mi.name = "Road"
	add_child(mi)
	_static_body(verts, idx, "road", 0.9)

func _mesh(verts: PackedVector3Array, norms: PackedVector3Array, uvs: PackedVector2Array, cols: PackedColorArray, idx: PackedInt32Array) -> ArrayMesh:
	var arr := []
	arr.resize(Mesh.ARRAY_MAX)
	arr[Mesh.ARRAY_VERTEX] = verts
	arr[Mesh.ARRAY_NORMAL] = norms
	if uvs.size() > 0: arr[Mesh.ARRAY_TEX_UV] = uvs
	if cols.size() > 0: arr[Mesh.ARRAY_COLOR] = cols
	arr[Mesh.ARRAY_INDEX] = idx
	var m := ArrayMesh.new()
	m.add_surface_from_arrays(Mesh.PRIMITIVE_TRIANGLES, arr)
	return m

func _static_body(verts: PackedVector3Array, idx: PackedInt32Array, group: String, friction: float) -> StaticBody3D:
	var faces := PackedVector3Array()
	faces.resize(idx.size())
	for i in idx.size(): faces[i] = verts[idx[i]]
	var shape := ConcavePolygonShape3D.new()
	shape.set_faces(faces)
	shape.backface_collision = true
	var body := StaticBody3D.new()
	body.collision_layer = 1
	body.collision_mask = 0
	body.add_to_group(group)
	var pm := PhysicsMaterial.new()
	pm.friction = friction
	body.physics_material_override = pm
	var cs := CollisionShape3D.new()
	cs.shape = shape
	body.add_child(cs)
	add_child(body)
	return body

# ------------------------------------------------------------------ terrain
func _natural_height(x: float, z: float) -> float:
	return _terrain_noise.get_noise_2d(x, z) * 9.0 + 1.0

func _build_terrain() -> void:
	var cell := 8.0
	var x0 := -460.0; var z0 := -300.0
	var nx := 140; var nz := 110
	var cnt := (nx + 1) * (nz + 1)
	var best_d := PackedFloat32Array(); best_d.resize(cnt); best_d.fill(1e9)
	var best_i := PackedInt32Array(); best_i.resize(cnt)
	var reach := 60.0
	var rc := int(ceil(reach / cell))
	for i in n:
		var p := pos[i]
		var cx := int(round((p.x - x0) / cell)); var cz := int(round((p.z - z0) / cell))
		for gz in range(maxi(0, cz - rc), mini(nz, cz + rc) + 1):
			for gx in range(maxi(0, cx - rc), mini(nx, cx + rc) + 1):
				var vx := x0 + gx * cell; var vz := z0 + gz * cell
				var d := Vector2(vx - p.x, vz - p.z).length()
				var gi := gz * (nx + 1) + gx
				if d < best_d[gi]: best_d[gi] = d; best_i[gi] = i
	var hs := PackedFloat32Array(); hs.resize(cnt)
	var near := PackedFloat32Array(); near.resize(cnt)
	for gz in nz + 1:
		for gx in nx + 1:
			var gi := gz * (nx + 1) + gx
			var vx := x0 + gx * cell; var vz := z0 + gz * cell
			var nat := _natural_height(vx, vz)
			var h := nat
			if best_d[gi] < reach:
				var si := best_i[gi]
				var p := Vector3(vx, 0, vz)
				var r := right[si]
				var rflat := Vector2(r.x, r.z)
				var lat := Vector2(p.x - pos[si].x, p.z - pos[si].z).dot(rflat.normalized())
				var latc := clampf(lat, -HALF, HALF)
				var road_h := pos[si].y + latc * r.y / maxf(0.2, rflat.length()) - 0.75
				var t := smoothstep(HALF + SHOULDER - 2.0, HALF + 42.0, best_d[gi])
				h = lerpf(road_h, minf(nat, road_h + 30.0), t)
				near[gi] = 1.0 - smoothstep(HALF, HALF + 18.0, best_d[gi])
			hs[gi] = h
	_th = hs
	_tg = [x0, z0, cell, float(nx), float(nz)]
	var verts := PackedVector3Array(); var norms := PackedVector3Array(); var cols := PackedColorArray()
	verts.resize(cnt); norms.resize(cnt); cols.resize(cnt)
	for gz in nz + 1:
		for gx in nx + 1:
			var gi := gz * (nx + 1) + gx
			verts[gi] = Vector3(x0 + gx * cell, hs[gi], z0 + gz * cell)
			var hl := hs[gz * (nx + 1) + maxi(gx - 1, 0)]; var hr := hs[gz * (nx + 1) + mini(gx + 1, nx)]
			var hd := hs[maxi(gz - 1, 0) * (nx + 1) + gx]; var hu := hs[mini(gz + 1, nz) * (nx + 1) + gx]
			norms[gi] = Vector3(hl - hr, 2.0 * cell, hd - hu).normalized()
			cols[gi] = Color(near[gi], 0, 0)
	var idx := PackedInt32Array()
	for gz in nz:
		for gx in nx:
			var a := gz * (nx + 1) + gx; var b := a + nx + 1
			idx.append_array([a, a + 1, b, a + 1, b + 1, b])
	var mi := MeshInstance3D.new()
	mi.mesh = _mesh(verts, norms, PackedVector2Array(), cols, idx)
	mi.material_override = _shader_mat(GROUND_SHADER)
	mi.name = "Terrain"
	add_child(mi)
	_static_body(verts, idx, "terrain", 0.8)
	# far skirt so the horizon never shows a hard edge
	var far := MeshInstance3D.new()
	var pm := PlaneMesh.new(); pm.size = Vector2(4000, 4000)
	far.mesh = pm
	far.position = Vector3(100, -6, 120)
	far.material_override = mi.material_override
	add_child(far)

# ------------------------------------------------------------------ barriers
func _build_barriers() -> void:
	# jersey barrier profile (lateral offset outward, height) and its v coordinate
	var prof := [[-0.34, -0.3], [-0.32, 0.18], [-0.13, 0.36], [-0.1, 0.86], [0.1, 0.86], [0.13, 0.36], [0.32, 0.18], [0.34, -0.3]]
	var vs := [0.0, 0.2, 0.42, 0.85, 0.9, 0.85, 0.42, 0.0]
	for side: int in [-1, 1]:
		var verts := PackedVector3Array(); var norms := PackedVector3Array()
		var uvs := PackedVector2Array(); var cols := PackedColorArray(); var idx := PackedInt32Array()
		var cverts := PackedVector3Array(); var cidx := PackedInt32Array()
		var m := prof.size()
		for i in n + 1:
			var k := i % n
			var r := right[k] * side
			var flat_r := Vector3(r.x, 0, r.z).normalized()
			var base := pos[k] + right[k] * (BARRIER_OFF * side)
			var hazard := 1.0 if absf(curv[k]) > 0.006 or absi(k - jump_idx) < 14 or k < 6 or k > n - 6 else 0.0
			for j in m:
				var o: float = prof[j][0]; var h: float = prof[j][1]
				verts.append(base + flat_r * o + Vector3.UP * h)
				var nr := flat_r * signf(o) * 0.8 + Vector3.UP * (0.6 if absf(o) < 0.15 else 0.25)
				norms.append(nr.normalized())
				uvs.append(Vector2(i * STEP, vs[j]))
				cols.append(Color(hazard, 0, 0))
			# collision wall: thick slab, taller than the visual so cars don't climb it
			cverts.append(base - flat_r * 0.35 + Vector3.UP * -1.0)
			cverts.append(base - flat_r * 0.35 + Vector3.UP * 1.7)
			cverts.append(base + flat_r * 0.6 + Vector3.UP * 1.7)
		for i in n:
			for j in m - 1:
				var a := i * m + j; var b := a + m
				if side > 0: idx.append_array([a, a + 1, b, a + 1, b + 1, b])
				else: idx.append_array([a, b, a + 1, a + 1, b, b + 1])
			for j in 2:
				var a := i * 3 + j; var b := a + 3
				cidx.append_array([a, b, a + 1, a + 1, b, b + 1])
		var mi := MeshInstance3D.new()
		mi.mesh = _mesh(verts, norms, uvs, cols, idx)
		var mat := _shader_mat(BARRIER_SHADER)
		mi.material_override = mat
		mi.name = "Barrier%d" % side
		add_child(mi)
		_static_body(cverts, cidx, "barrier", 0.2)

func _build_tyres() -> void:
	var tm := TorusMesh.new()
	tm.inner_radius = 0.28; tm.outer_radius = 0.6
	tm.rings = 10; tm.ring_segments = 6
	var mat := StandardMaterial3D.new()
	mat.albedo_color = Color(0.09, 0.08, 0.08)
	mat.roughness = 0.85
	tm.material = mat
	var xf: Array[Transform3D] = []
	var cols: Array[Color] = []
	var i := 0
	while i < n:
		if absf(curv[i]) > 0.008:
			var side := -1.0 if curv[i] > 0 else 1.0 # outside of the turn
			var base := pos[i] + right[i] * (BARRIER_OFF + 1.3) * side
			for s in 3:
				xf.append(Transform3D(Basis(), base + Vector3.UP * (0.12 + s * 0.3)))
				var stripe := (i / 3 + s) % 3 == 0
				cols.append(Color(0.9, 0.85, 0.8) if stripe else Color(0.12, 0.11, 0.1))
			i += 2
		else:
			i += 1
	var mm := MultiMesh.new()
	mm.transform_format = MultiMesh.TRANSFORM_3D
	mm.use_colors = true
	mm.mesh = tm
	mm.instance_count = xf.size()
	for k in xf.size():
		mm.set_instance_transform(k, xf[k])
		mm.set_instance_color(k, cols[k])
	mat.vertex_color_use_as_albedo = true
	var mmi := MultiMeshInstance3D.new()
	mmi.multimesh = mm
	mmi.name = "Tyres"
	add_child(mmi)

# ------------------------------------------------------------------ rocks
func _rock_mesh(seed_: int) -> ArrayMesh:
	var sm := SphereMesh.new()
	sm.radial_segments = 9; sm.rings = 5
	var arr := sm.get_mesh_arrays()
	var v: PackedVector3Array = arr[Mesh.ARRAY_VERTEX]
	var idx: PackedInt32Array = arr[Mesh.ARRAY_INDEX]
	var fn := FastNoiseLite.new(); fn.seed = seed_; fn.frequency = 0.9
	for i in v.size():
		var p := v[i]
		var k := 1.0 + fn.get_noise_3dv(p * 1.3) * 0.45
		p *= k
		p.y = p.y * 0.75 if p.y > 0 else p.y * 0.3
		v[i] = p
	var st := SurfaceTool.new()
	st.begin(Mesh.PRIMITIVE_TRIANGLES)
	st.set_smooth_group(0xFFFFFFFF)
	var rng := RandomNumberGenerator.new(); rng.seed = seed_
	for t in range(0, idx.size(), 3):
		var c := Color(0.52, 0.32, 0.22).lerp(Color(0.68, 0.46, 0.32), rng.randf())
		for j in 3:
			st.set_color(c)
			st.add_vertex(v[idx[t + j]])
	st.generate_normals()
	return st.commit()

func _build_rocks() -> void:
	var mat := StandardMaterial3D.new()
	mat.vertex_color_use_as_albedo = true
	mat.roughness = 0.95
	var rng := RandomNumberGenerator.new(); rng.seed = 42
	var meshes: Array[ArrayMesh] = []
	for s in 3: meshes.append(_rock_mesh(11 + s * 7))
	var groups: Array = [[], [], []]
	# outcrops near the track (outside of the barriers), plus scattered boulders and far mesas
	var spots := []
	for k in 9:
		var i := rng.randi_range(0, n - 1)
		var side := -1.0 if rng.randf() < 0.5 else 1.0
		var c := pos[i] + right[i] * side * rng.randf_range(24.0, 40.0)
		spots.append([c, rng.randf_range(4.0, 9.0), 6])
	for k in 70:
		var c := Vector3(rng.randf_range(-440, 620), 0, rng.randf_range(-280, 560))
		spots.append([c, rng.randf_range(1.0, 3.5), 1])
	for k in 14:
		var a := k / 14.0 * TAU + rng.randf() * 0.2
		var c := Vector3(90 + cos(a) * rng.randf_range(480, 620), 0, 120 + sin(a) * rng.randf_range(420, 560))
		spots.append([c, rng.randf_range(40.0, 75.0), 3])
	for sp in spots:
		var c: Vector3 = sp[0]; var sz: float = sp[1]; var cnt: int = sp[2]
		for j in cnt:
			var p := c + Vector3(rng.randf_range(-1, 1), 0, rng.randf_range(-1, 1)) * sz * 0.9 * (1 if j > 0 else 0)
			if _dist_to_track(p) < HALF + 5.0 + sz: continue
			var s := sz * rng.randf_range(0.5, 1.0)
			var b := Basis(Vector3.UP, rng.randf() * TAU).scaled(Vector3(s, s * rng.randf_range(0.6, 1.3), s))
			p.y = _ground_h(p) - s * 0.15
			groups[rng.randi() % 3].append(Transform3D(b, p))
	for g in 3:
		var arr: Array = groups[g]
		var mm := MultiMesh.new()
		mm.transform_format = MultiMesh.TRANSFORM_3D
		mm.mesh = meshes[g]
		mm.instance_count = arr.size()
		for k in arr.size(): mm.set_instance_transform(k, arr[k])
		var mmi := MultiMeshInstance3D.new()
		mmi.multimesh = mm
		mmi.material_override = mat
		add_child(mmi)

func _dist_to_track(p: Vector3) -> float:
	var i := nearest_global(p)
	return Vector2(p.x - pos[i].x, p.z - pos[i].z).length()

func _ground_h(p: Vector3) -> float:
	return ground_height(p.x, p.z)

## bilinear terrain height (grid built in _build_terrain)
func ground_height(x: float, z: float) -> float:
	var fx := clampf((x - _tg[0]) / _tg[2], 0.0, _tg[3] - 0.001)
	var fz := clampf((z - _tg[1]) / _tg[2], 0.0, _tg[4] - 0.001)
	var gx := int(fx); var gz := int(fz)
	var w := int(_tg[3]) + 1
	var tx := fx - gx; var tz := fz - gz
	var a := lerpf(_th[gz * w + gx], _th[gz * w + gx + 1], tx)
	var b := lerpf(_th[(gz + 1) * w + gx], _th[(gz + 1) * w + gx + 1], tx)
	return lerpf(a, b, tz)

# ------------------------------------------------------------------ start gate
func _build_gate() -> void:
	var gate := Node3D.new()
	gate.name = "StartGate"
	gate.transform = frame(0)
	add_child(gate)
	var metal := StandardMaterial3D.new()
	metal.albedo_color = Color(0.32, 0.26, 0.22); metal.metallic = 0.6; metal.roughness = 0.55
	var hz := _shader_mat(BARRIER_SHADER)
	for side: int in [-1, 1]:
		var col := MeshInstance3D.new()
		var bm := BoxMesh.new(); bm.size = Vector3(1.4, 9.0, 1.4)
		col.mesh = bm; col.material_override = metal
		col.position = Vector3(side * (HALF + 2.4), 4.5, 0)
		gate.add_child(col)
		var foot := MeshInstance3D.new()
		var fm := BoxMesh.new(); fm.size = Vector3(2.2, 1.2, 2.2)
		foot.mesh = fm; foot.material_override = hz
		foot.position = Vector3(side * (HALF + 2.4), 0.3, 0)
		gate.add_child(foot)
		var lamp := MeshInstance3D.new()
		var lm := SphereMesh.new(); lm.radius = 0.35; lm.height = 0.7
		var lmat := StandardMaterial3D.new()
		lmat.albedo_color = Color(1, 0.5, 0.1); lmat.emission_enabled = true
		lmat.emission = Color(1, 0.45, 0.1); lmat.emission_energy_multiplier = 3.0
		lamp.mesh = lm; lamp.material_override = lmat
		lamp.position = Vector3(side * (HALF + 2.4), 9.4, 0)
		gate.add_child(lamp)
	var beam := MeshInstance3D.new()
	var bb := BoxMesh.new(); bb.size = Vector3(WIDTH + 6.2, 1.8, 0.8)
	beam.mesh = bb
	var cm := _shader_mat("""
shader_type spatial;
uniform sampler2D noise_tex : filter_linear_mipmap, repeat_enable;
void fragment() {
	vec2 g = floor(UV * vec2(36.0, 4.0));
	float ck = mod(g.x + g.y, 2.0);
	ALBEDO = mix(vec3(0.06), vec3(0.92), ck);
	ROUGHNESS = 0.7;
}
""")
	beam.material_override = cm
	beam.position = Vector3(0, 8.2, 0)
	gate.add_child(beam)
	for face: int in [-1, 1]:
		var lbl := Label3D.new()
		lbl.text = "SCRAP RALLY"
		lbl.font_size = 160
		lbl.pixel_size = 0.01
		lbl.outline_size = 24
		lbl.modulate = Color(1.0, 0.75, 0.15)
		lbl.outline_modulate = Color(0.12, 0.05, 0.02)
		lbl.position = Vector3(0, 10.0, 0.45 * face)
		lbl.rotation.y = 0.0 if face < 0 else PI
		lbl.shaded = false
		lbl.double_sided = false
		gate.add_child(lbl)

# ------------------------------------------------------------------ pickups (positions only; Race spawns them)
func _build_pickup_spots() -> void:
	var rng := RandomNumberGenerator.new(); rng.seed = 9
	var k := 40
	while k < n - 20:
		var lat := rng.randf_range(-HALF + 2.5, HALF - 2.5)
		if absi(k - jump_idx) < 14: k += 30; continue
		for j in 3:
			pickup_spots.append(sample_point(k + j * 3, lat) + up[wrapi_(k + j * 3)] * 1.0)
		k += rng.randi_range(55, 85)
