extends SceneTree
## (Agent A, dev) IntroCard alone: frames of one card at 390x844.  -s res://dev_fx/card_test.gd -- --out=/abs/prefix
var out := ""
var t := 0.0
var times := [0.5, 1.2, 1.75, 2.0, 2.8, 4.2]
var k := 0
func _initialize() -> void:
	for a in OS.get_cmdline_user_args(): if a.begins_with("--out="): out = a.get_slice("=", 1)
	var cl := CanvasLayer.new(); root.add_child(cl)
	var ic := IntroCard.new(); cl.add_child(ic)
	ic.play("Η Αφροδίτη της έδωσε ζωή, με έναν όρο:\n*«Άφησε το πρόσωπό της λείο.\nΤο πρόσωπο το σκαλίζει η ζωή, από μέσα.»*", 1.2)
func _process(dt: float) -> bool:
	t += minf(dt, 0.05)
	if k < times.size() and t > times[k]:
		root.get_texture().get_image().save_png("%s%d.png" % [out, k]); k += 1
	return k >= times.size()
