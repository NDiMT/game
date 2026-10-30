extends Node
## (Agent A, dev) the breath close-up on its own: she writes "follow" and half of "together", you answer
## (a scripted stroke drawn over time, like a finger), her palm presses, then the pane lingers so the
## droplets run and the fog re-condenses.
##   godot --path . res://dev_fx/fog_test.tscn                         (interactive: draw with the mouse)
##   godot --path . --rendering-driver opengl3 --fixed-fps 30 res://dev_fx/fog_test.tscn -- --shots=/abs/dir --ink=new|old
## `--ink=old` keeps GlassTalk's brush Ink (the "before"); `new` swaps in FogInk (the "after").

const MOMENTS := {"a_writing": 2.4, "b_writing2": 4.6, "c_waiting": 8.5, "d_drops": 15.0, "e_late": 23.0, "f_yours": 25.3, "g_palm": 28.0}
const YOU_AT := 23.3

var gt: GlassTalk
var args := {}
var shots := ""
var queue := []
var t := 0.0
var _you := PackedVector2Array()
var _you_k := -1

func _ready() -> void:
	for a in OS.get_cmdline_user_args():
		var kv := a.trim_prefix("--").split("=")
		args[kv[0]] = kv[1] if kv.size() > 1 else "1"
	shots = args.get("shots", "")
	var bg := ColorRect.new()
	bg.color = Color(0.2, 0.22, 0.24)
	bg.set_anchors_preset(Control.PRESET_FULL_RECT)
	var layer := CanvasLayer.new()
	add_child(layer)
	layer.add_child(bg)
	gt = GlassTalk.new()
	layer.add_child(gt)
	if args.get("ink", "new") == "new": _swap_ink()
	gt.size = get_viewport().get_visible_rect().size
	gt.open({"id": "test", "first": "follow", "question": "together_half"})
	if shots != "":
		DirAccess.make_dir_recursive_absolute(shots)
		for m in MOMENTS: queue.append([MOMENTS[m], m])
		queue.sort_custom(func(a: Array, b: Array) -> bool: return a[0] < b[0])

## FogInk in place of both brush Inks (what glass_talk.gd will do with two `FogInk.new()`)
func _swap_ink() -> void:
	var old: GlassTalk.Ink = gt.ink
	var fi := FogInk.new()
	fi.host = gt
	fi.material = old.material
	var p := old.get_parent()
	p.remove_child(old)
	p.add_child(fi)
	var oim: GlassTalk.Ink = old.twin
	var fim := FogInk.new()
	fim.host = gt
	fim.only_mine = true
	fim.mine = fi.mine
	fim.material = oim.material
	var p2 := oim.get_parent()
	p2.remove_child(oim)
	p2.add_child(fim)
	fi.twin = fim
	gt.ink = fi
	old.free(); oim.free()

func _process(dt: float) -> void:
	t += dt
	# your answer: the mirror of her half, drawn like a finger (fast in the middle, slower at the hook)
	if t > YOU_AT and t < YOU_AT + 2.4 and gt.phase in ["waiting", "drawing"]:
		var tg: PackedVector2Array = GlassTalk.resample(gt.target[0], 60)
		var u := clampf((t - YOU_AT) / 2.0, 0.0, 1.0)
		u = u * u * (3.0 - 2.0 * u)
		var n := int(u * 59.0) + 1
		_you = PackedVector2Array()
		for i in n: _you.append(tg[i] + Vector2(0.012 * sin(i * 0.7), 0.01 * sin(i * 1.3)))
		if _you_k < 0:
			gt.ink.mine.append([gt._px(_you), 1.0])
			_you_k = gt.ink.mine.size() - 1
			gt.phase = "drawing"
		gt.ink.mine[_you_k][0] = gt._px(_you)
		gt.ink.queue_redraw()
		if n >= 60: gt.answer(_you)
	if shots != "" and not queue.is_empty() and t >= queue[0][0]:
		var m: String = queue.pop_front()[1]
		await RenderingServer.frame_post_draw
		get_viewport().get_texture().get_image().save_png("%s/fog-%s-%s.png" % [shots, args.get("ink", "new"), m])
		print("shot ", m, " t=", snappedf(t, 0.01))
		if queue.is_empty(): get_tree().quit()
