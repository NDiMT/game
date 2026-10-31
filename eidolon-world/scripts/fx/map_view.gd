class_name MapView
extends TextureRect
## v1.0 M3c (Agent A) the chapter map: a hand-drawn parchment plan (assets/textures/map, made by
## dev_rig/tools/make_map.py from tests/dump_layout) with fog of war by walk region. Drop it into the UI:
##   var map := MapView.new(); add_child(map)            (it keeps its aspect: 1024 x 1536)
##   map.reveal_region("A")                              a walk region (Level region name) fades in (1.2 s)
##   map.reveal_area("atrium")                           every region of an area (Names.REGION_AREA keys)
##   map.set_player(player.position)                     the crimson "you are here" dot (Vector3.INF hides it)
##   save: map.get_revealed() -> Array[String]; load: map.set_revealed(names) (instant)
## Regenerate the textures after the layout changes (see make_map.py; new regions need a re-run to appear).

const DIR := "res://assets/textures/map/"
const FADE := 1.2

var meta := {}
var _lut := Image.create(256, 1, false, Image.FORMAT_R8)
var _lut_tex: ImageTexture
var _k := {}                # region name -> reveal 0..1
var _target := {}           # region name -> 1 while fading in
var _mat: ShaderMaterial

func _init() -> void:
	texture = load(DIR + "map_paper.jpg")
	expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
	meta = JSON.parse_string(FileAccess.get_file_as_string(DIR + "map_meta.json"))
	_lut.fill(Color(0, 0, 0))
	_lut_tex = ImageTexture.create_from_image(_lut)
	_mat = ShaderMaterial.new()
	_mat.shader = preload("res://shaders/map_reveal.gdshader")
	_mat.set_shader_parameter("ink_tex", load(DIR + "map_ink.png"))
	_mat.set_shader_parameter("id_tex", load(DIR + "map_ids.png"))
	_mat.set_shader_parameter("reveal", _lut_tex)
	material = _mat

func reveal_region(n: String, instant := false) -> void:
	if not meta["ids"].has(n): return
	if instant:
		_k[n] = 1.0
		_write(n)
	elif _k.get(n, 0.0) < 1.0:
		_target[n] = true

func reveal_area(key: String, instant := false) -> void:
	for n in meta["areas"].get(key, []): reveal_region(n, instant)

func is_revealed(n: String) -> bool:
	return _k.get(n, 0.0) > 0.0

func get_revealed() -> Array[String]:
	var out: Array[String] = []
	for n in _k:
		if _k[n] > 0.0: out.append(n)
	return out

func set_revealed(names: Array) -> void:
	for n in names: reveal_region(String(n), true)

## the "you are here" dot (world position; Vector3.INF hides it)
func set_player(p: Vector3) -> void:
	_mat.set_shader_parameter("player_uv", world_to_uv(p) if p != Vector3.INF else Vector2(-1, -1))

func world_to_uv(p: Vector3) -> Vector2:
	var o: Array = meta["world_origin"]
	var s: float = meta["px_per_m"]
	var sz: Array = meta["size"]
	return Vector2((p.x - float(o[0])) * s / float(sz[0]), (p.z - float(o[1])) * s / float(sz[1]))

func _process(dt: float) -> void:
	if _target.is_empty(): return
	for n in _target.keys():
		_k[n] = minf(_k.get(n, 0.0) + dt / FADE, 1.0)
		_write(n, false)
		if _k[n] >= 1.0: _target.erase(n)
	_lut_tex.update(_lut)

func _write(n: String, push := true) -> void:
	var id := int(meta["ids"][n])
	_lut.set_pixel(id, 0, Color(_k[n], 0, 0))
	if push: _lut_tex.update(_lut)
