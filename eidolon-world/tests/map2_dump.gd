extends SceneTree
## (v2 rebuild tools) Chapter I's new layout as JSON on stdout (tests/render_map2.py draws it); the v1 rooms' own
## walk regions (WingsGeo) are built into a scratch Level and added
func _init() -> void:
	var img := Image.create(4, 4, false, Image.FORMAT_RGBA8)
	var lv := Level.new(ImageTexture.create_from_image(img))
	WingsGeo.build(lv)
	var extra := []
	for g: Level.Region in lv.regions:
		var k := Map2.key_of_region(g.name)
		if k != "": extra.append([k, g.r, g.y0, g.y1, g.axis])
	print("MAP2JSON " + Map2.to_json(extra))
	lv.free()
	quit()
