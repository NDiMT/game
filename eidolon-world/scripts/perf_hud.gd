class_name PerfHud
extends CanvasLayer
## Debug performance overlay (web: add ?perf to the URL; tests: cmd "perf:1").
## frame ms (mean over ~0.5 s, from real frame deltas), draw calls, primitives, an approximate fill
## estimate (screens of pixels shaded per frame, see World.fill_estimate) and the render scale.

var world: World
var label: Label
var _acc := 0.0
var _n := 0
var _t := 0.0
var ms := 0.0

func _ready() -> void:
	layer = 60
	label = Label.new()
	label.position = Vector2(8, 52)
	label.add_theme_font_size_override("font_size", 11)
	label.add_theme_color_override("font_color", Color(0.05, 0.05, 0.06))
	label.add_theme_color_override("font_outline_color", Color(0.95, 0.95, 0.92, 0.85))
	label.add_theme_constant_override("outline_size", 4)
	label.mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_child(label)

func _process(dt: float) -> void:
	_acc += dt
	_n += 1
	_t += dt
	if _t < 0.5: return
	ms = _acc / maxf(_n, 1) * 1000.0
	_acc = 0.0; _n = 0; _t = 0.0
	var vp := get_viewport()
	label.text = "%.1f ms  (%d fps)\ndraw calls %d\nprimitives %dk\nfill ~%.1f screens\nscale %.2f  %s" % [ms, Engine.get_frames_per_second(),
		Performance.get_monitor(Performance.RENDER_TOTAL_DRAW_CALLS_IN_FRAME),
		int(Performance.get_monitor(Performance.RENDER_TOTAL_PRIMITIVES_IN_FRAME) / 1000.0),
		world.fill_estimate() if world else 0.0, vp.scaling_3d_scale, world.tier_name() if world else ""]
