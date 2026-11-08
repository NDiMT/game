extends SceneTree
## Parse check (headless): loads every .gd under res://scripts and res://tests and every .tscn under res://scenes,
## and fails if one does not compile or load. Prints PARSE PASS n / PARSE FAIL n.
##   godot --headless --path . -s res://tests/parse_all.gd

var bad := 0
var n := 0

func _walk(dir: String, ext: String, out: Array) -> void:
	var d := DirAccess.open(dir)
	if d == null: return
	for f in d.get_files():
		if f.ends_with(ext): out.append(dir.path_join(f))
	for s in d.get_directories():
		if not s.begins_with("."): _walk(dir.path_join(s), ext, out)

func _initialize() -> void:
	var files: Array = []
	_walk("res://scripts", ".gd", files)
	_walk("res://tests", ".gd", files)
	for f in files:
		if f == "res://tests/parse_all.gd": continue
		n += 1
		var s := ResourceLoader.load(f, "", ResourceLoader.CACHE_MODE_IGNORE) as Script
		if s == null or not s.can_instantiate():
			bad += 1
			print("FAIL  parse %s" % f)
	var scenes: Array = []
	_walk("res://scenes", ".tscn", scenes)
	for f in scenes:
		n += 1
		var p := ResourceLoader.load(f) as PackedScene
		if p == null or not p.can_instantiate():
			bad += 1
			print("FAIL  load %s" % f)
	print("PARSE %s  files=%d  failed=%d" % ["PASS" if bad == 0 else "FAIL", n, bad])
	quit(0 if bad == 0 else 1)
