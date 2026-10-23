class_name Sfx
extends Node
## Procedural sound: tiny PCM clips synthesised at startup (engine loop + one-shots).
## Pre-baked AudioStreamWAV instead of AudioStreamGenerator so it works with the
## single-threaded web build (sample playback) and costs nothing per frame.

const RATE := 22050

var streams := {}
var _pool: Array[AudioStreamPlayer] = []

func _ready() -> void:
	var rng := RandomNumberGenerator.new(); rng.seed = 5
	streams["engine"] = _engine_loop()
	streams["boom"] = _make(1.5, func(t: float, st: Dictionary) -> float:
		var nz := rng.randf_range(-1, 1)
		st.lp = lerpf(st.lp, nz, clampf(0.25 * exp(-t * 2.2) + 0.02, 0.0, 1.0))
		return (st.lp * 2.6 + sin(TAU * (48.0 - t * 18.0) * t) * 0.8 * exp(-t * 5.0)) * exp(-t * 2.6) * minf(1.0, t * 300.0))
	streams["launch"] = _make(0.7, func(t: float, st: Dictionary) -> float:
		var nz := rng.randf_range(-1, 1)
		st.lp = lerpf(st.lp, nz, 0.35)
		var env := minf(1.0, t * 30.0) * exp(-t * 4.5)
		return (st.lp * 0.9 + sin(TAU * (520.0 - t * 500.0) * t) * 0.25) * env)
	streams["beep"] = _make(0.2, func(t: float, _st: Dictionary) -> float:
		return signf(sin(TAU * 660.0 * t)) * 0.25 * minf(1.0, (0.2 - t) * 40.0))
	streams["go"] = _make(0.55, func(t: float, _st: Dictionary) -> float:
		return signf(sin(TAU * 990.0 * t)) * 0.25 * minf(1.0, (0.55 - t) * 10.0))
	streams["coin"] = _make(0.28, func(t: float, _st: Dictionary) -> float:
		var f := 1320.0 if t < 0.07 else 1760.0
		return signf(sin(TAU * f * t)) * 0.18 * exp(-t * 7.0))
	streams["clank"] = _make(0.3, func(t: float, _st: Dictionary) -> float:
		var nz := rng.randf_range(-1, 1)
		return (sin(TAU * 310.0 * t) * 0.5 + sin(TAU * 737.0 * t) * 0.35 + sin(TAU * 1210.0 * t) * 0.25 + nz * 0.5 * exp(-t * 40.0)) * exp(-t * 14.0) * 0.6)
	streams["nitro"] = _make(0.6, func(t: float, st: Dictionary) -> float:
		var nz := rng.randf_range(-1, 1)
		st.lp = lerpf(st.lp, nz, 0.08 + t * 0.4)
		return st.lp * 1.6 * minf(1.0, t * 12.0) * exp(-t * 3.0))
	streams["mine"] = _make(0.25, func(t: float, _st: Dictionary) -> float:
		return sin(TAU * (180.0 - t * 300.0) * t) * 0.5 * exp(-t * 10.0))
	streams["warn"] = _make(0.16, func(t: float, _st: Dictionary) -> float:
		return signf(sin(TAU * (1480.0 if t < 0.07 else 1180.0) * t)) * 0.16 * minf(1.0, (0.16 - t) * 60.0))
	for i in 8:
		var p := AudioStreamPlayer.new()
		add_child(p)
		_pool.append(p)

func _make(dur: float, f: Callable) -> AudioStreamWAV:
	var n := int(dur * RATE)
	var data := PackedByteArray(); data.resize(n * 2)
	var st := {"lp": 0.0}
	for i in n:
		var v := clampf(f.call(float(i) / RATE, st), -1.0, 1.0)
		data.encode_s16(i * 2, int(v * 32000.0))
	var w := AudioStreamWAV.new()
	w.format = AudioStreamWAV.FORMAT_16_BITS
	w.mix_rate = RATE
	w.stereo = false
	w.data = data
	return w

func _engine_loop() -> AudioStreamWAV:
	# 0.5 s loop, 4-cylinder-ish growl at 60 Hz (integer cycles -> seamless)
	var n := RATE / 2
	var data := PackedByteArray(); data.resize(n * 2)
	for i in n:
		var t := float(i) / RATE
		var w := TAU * 60.0 * t
		var fire := pow(absf(sin(w * 2.0)), 6.0)
		var v := sin(w) * 0.35 + sin(w * 2.0 + 0.4) * 0.3 + sin(w * 3.0 + 1.1) * 0.18 + sin(w * 5.0) * 0.08
		v = v * (0.55 + 0.45 * fire) + (fmod(t * 120.0, 1.0) - 0.5) * 0.2
		data.encode_s16(i * 2, int(clampf(v, -1.0, 1.0) * 26000.0))
	var s := AudioStreamWAV.new()
	s.format = AudioStreamWAV.FORMAT_16_BITS
	s.mix_rate = RATE
	s.data = data
	s.loop_mode = AudioStreamWAV.LOOP_FORWARD
	s.loop_begin = 0
	s.loop_end = n
	return s

func play(name: String, vol_db := 0.0, pitch := 1.0) -> void:
	for p in _pool:
		if not p.playing:
			p.stream = streams[name]
			p.volume_db = vol_db
			p.pitch_scale = pitch
			p.play()
			return

func play_at(name: String, at: Vector3, parent: Node, vol_db := 0.0) -> void:
	var p := AudioStreamPlayer3D.new()
	p.stream = streams[name]
	p.volume_db = vol_db
	p.unit_size = 14.0
	p.max_distance = 220.0
	parent.add_child(p)
	p.global_position = at
	p.play()
	p.finished.connect(p.queue_free)
