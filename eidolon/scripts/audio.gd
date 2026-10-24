class_name Sfx
extends Node
## Every sound is synthesised here at start-up into AudioStreamWAV buffers (no audio files).

const RATE := 22050

var streams := {}
var players: Array[AudioStreamPlayer] = []
var drone: AudioStreamPlayer
var _next := 0
var ready_ok := false

func _ready() -> void:
	for i in 8:
		var p := AudioStreamPlayer.new()
		add_child(p)
		players.append(p)
	drone = AudioStreamPlayer.new()
	drone.volume_db = -80.0
	add_child(drone)

var _build_step := 0
var _build_ms := 0

## Synthesises one sound per call so start-up never hitches (call every frame until it returns true).
func build_step() -> bool:
	if ready_ok: return true
	var t0 := Time.get_ticks_msec()
	match _build_step:
		0: streams["thud"] = _wav(_thud(0.42))
		1: streams["chime"] = _wav(_chime(1318.5, 1.6))
		2: streams["piano"] = _wav(_piano(261.63, 2.6))
		3: streams["grind"] = _wav(_grind(0.62))
		4: streams["whoosh"] = _wav(_whoosh(2.4))
		5:
			var dr := _wav(_drone(8.0))
			dr.loop_mode = AudioStreamWAV.LOOP_FORWARD
			dr.loop_begin = 0
			dr.loop_end = int(8.0 * RATE)
			streams["drone"] = dr
	_build_step += 1
	_build_ms += Time.get_ticks_msec() - t0
	if _build_step > 5:
		ready_ok = true
		print("[sfx] synthesised in %d ms" % _build_ms)
	return ready_ok

func build() -> void:
	while not build_step(): pass

var _want_drone := false

func start_drone() -> void:
	_want_drone = true
	if not ready_ok or drone.playing: return
	drone.stream = streams["drone"]
	drone.play()
	var tw := create_tween()
	tw.tween_property(drone, "volume_db", -9.0, 4.0)

func _process(_dt: float) -> void:
	if not ready_ok:
		build_step()
		if ready_ok and _want_drone: start_drone()

func play(name: String, vol_db := 0.0, pitch := 1.0) -> void:
	if not ready_ok or not streams.has(name): return
	var p := players[_next]
	_next = (_next + 1) % players.size()
	p.stream = streams[name]
	p.volume_db = vol_db
	p.pitch_scale = pitch
	p.play()

## Soft piano chord: notes in semitones above middle C.
func chord(semis: Array, vol_db := -6.0, spread := 0.09) -> void:
	var i := 0
	for s in semis:
		var d := i * spread
		var semi: float = s
		if d <= 0.0:
			play("piano", vol_db, pow(2.0, semi / 12.0))
		else:
			get_tree().create_timer(d).timeout.connect(func() -> void: play("piano", vol_db, pow(2.0, semi / 12.0)))
		i += 1

# ------------------------------------------------------------------ synthesis
func _wav(samples: PackedFloat32Array) -> AudioStreamWAV:
	var bytes := PackedByteArray()
	bytes.resize(samples.size() * 2)
	for i in samples.size():
		bytes.encode_s16(i * 2, int(clampf(samples[i], -1.0, 1.0) * 32000.0))
	var w := AudioStreamWAV.new()
	w.format = AudioStreamWAV.FORMAT_16_BITS
	w.mix_rate = RATE
	w.stereo = false
	w.data = bytes
	return w

func _piano(f: float, dur: float) -> PackedFloat32Array:
	var n := int(dur * RATE)
	var out := PackedFloat32Array()
	out.resize(n)
	var parts := [[1.0, 1.0, 2.2], [2.0, 0.45, 3.2], [3.0, 0.22, 4.5], [4.0, 0.12, 6.0], [5.0, 0.06, 8.0]]
	for i in n:
		var t := float(i) / RATE
		var env := minf(t * 180.0, 1.0)
		var v := 0.0
		for p in parts:
			var k: float = p[0]
			var fk := f * k * (1.0 + 0.0004 * k * k)
			v += sin(TAU * fk * t) * p[1] * exp(-t * p[2])
		# felt hammer thump
		v += sin(TAU * f * 0.5 * t) * 0.15 * exp(-t * 30.0)
		out[i] = v * env * 0.33
	return out

func _chime(f: float, dur: float) -> PackedFloat32Array:
	var n := int(dur * RATE)
	var out := PackedFloat32Array()
	out.resize(n)
	var parts := [[1.0, 1.0, 2.5], [2.76, 0.5, 4.0], [5.40, 0.28, 6.0], [8.93, 0.14, 9.0]]
	for i in n:
		var t := float(i) / RATE
		var v := 0.0
		for p in parts:
			v += sin(TAU * f * float(p[0]) * t) * float(p[1]) * exp(-t * float(p[2]))
		out[i] = v * minf(t * 400.0, 1.0) * 0.22
	return out

func _thud(dur: float) -> PackedFloat32Array:
	var n := int(dur * RATE)
	var out := PackedFloat32Array()
	out.resize(n)
	var rng := RandomNumberGenerator.new()
	rng.seed = 7
	var lp := 0.0
	var lp2 := 0.0
	for i in n:
		var t := float(i) / RATE
		var noise := rng.randf() * 2.0 - 1.0
		lp += (noise - lp) * 0.08
		lp2 += (lp - lp2) * 0.2
		var body := sin(TAU * (62.0 - 18.0 * t) * t) * exp(-t * 16.0)
		var knock := sin(TAU * 180.0 * t) * exp(-t * 55.0) * 0.35
		var grit := lp2 * exp(-t * 22.0) * 2.4
		out[i] = (body * 0.8 + knock + grit) * minf(t * 900.0, 1.0) * 0.8
	return out

func _grind(dur: float) -> PackedFloat32Array:
	var n := int(dur * RATE)
	var out := PackedFloat32Array()
	out.resize(n)
	var rng := RandomNumberGenerator.new()
	rng.seed = 11
	var lp := 0.0
	var bp := 0.0
	for i in n:
		var t := float(i) / RATE
		var noise := rng.randf() * 2.0 - 1.0
		lp += (noise - lp) * 0.12
		bp += (lp - bp) * 0.35
		var env := smoothstep(0.0, 0.06, t) * (1.0 - smoothstep(dur * 0.6, dur, t))
		var rough := 0.6 + 0.4 * sin(TAU * 31.0 * t + sin(TAU * 7.0 * t) * 2.0)
		var rumble := sin(TAU * 48.0 * t) * 0.35 + sin(TAU * 73.0 * t) * 0.2
		out[i] = ((lp - bp) * 3.2 * rough + rumble * 0.6) * env * 0.55
	return out

func _whoosh(dur: float) -> PackedFloat32Array:
	var n := int(dur * RATE)
	var out := PackedFloat32Array()
	out.resize(n)
	var rng := RandomNumberGenerator.new()
	rng.seed = 5
	var lp := 0.0
	for i in n:
		var t := float(i) / RATE
		var noise := rng.randf() * 2.0 - 1.0
		var cut := 0.02 + 0.06 * sin(PI * t / dur)
		lp += (noise - lp) * cut
		out[i] = lp * sin(PI * t / dur) * 1.6
	return out

## Seamless 8 s loop: low open fifths with slow beating + soft wind.
func _drone(dur: float) -> PackedFloat32Array:
	var n := int(dur * RATE)
	var out := PackedFloat32Array()
	out.resize(n)
	# all partial frequencies are multiples of 1/dur so the loop is seamless
	var q := 1.0 / dur
	var tones := [[55.0, 0.30], [55.0 + q, 0.22], [82.5, 0.16], [110.0 - q, 0.12], [164.875, 0.05], [220.0 + q * 2.0, 0.035]]
	var rng := RandomNumberGenerator.new()
	rng.seed = 3
	var lp := 0.0
	var lp2 := 0.0
	var wind := PackedFloat32Array()
	var xr := int(RATE)
	wind.resize(n + xr)
	for i in n + xr:
		var noise := rng.randf() * 2.0 - 1.0
		lp += (noise - lp) * 0.02
		lp2 += (lp - lp2) * 0.05
		wind[i] = lp2
	for i in n:
		var t := float(i) / RATE
		var v := 0.0
		for tn in tones:
			v += sin(TAU * float(tn[0]) * t) * float(tn[1])
		var swell := 0.75 + 0.25 * sin(TAU * q * t)
		# the first second crossfades from the noise that follows the loop end -> seamless
		var wv := wind[i]
		if i < xr:
			var xf := float(i) / xr
			wv = wind[i + n] * (1.0 - xf) + wind[i] * xf
		var gust := 0.6 + 0.4 * sin(TAU * q * 2.0 * t + 1.3)
		out[i] = (v * swell * 0.5 + wv * 6.0 * gust) * 0.55
	return out
