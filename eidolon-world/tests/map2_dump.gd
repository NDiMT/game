extends SceneTree
## (v2 rebuild tools) Chapter I's new layout as JSON on stdout (tests/render_map2.py draws it)
func _init() -> void:
	print("MAP2JSON " + Map2.to_json())
	quit()
