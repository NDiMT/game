class_name Sfx
extends Node
## Every sound is synthesised here at start-up into AudioStreamWAV buffers (no audio files).
## SFX and MUSIC run on separate buses (Music has a reverb for long tails; Master has a limiter so the
## mix never clips). The ambient music is a light sequencer over pre-rendered loops: an evolving pad
## (one seamless 6 s note, played as 4-voice chords via pitch_scale, crossfaded every 9-15 s in a random
## A-aeolian chord order), the low drone, and a sparse random piano/bell motif with a faked echo.

const RATE := 22050
const PAD_LEN := 6.0
const PAD_CHUNK := 6000

var streams := {}
var players: Array[AudioStreamPlayer] = []
var drone: AudioStreamPlayer
var _next := 0
var ready_ok := false
var music_bus := 0
var sfx_bus := 0
var music_on := true
var pad_players: Array[AudioStreamPlayer] = []
var motif_players: Array[AudioStreamPlayer] = []
var _motif_next := 0
var _pad_group := 0
var _chord := -1
var _chord_t := 0.0
var _motif_t := 3.0
var _music_started := false
var _rng := RandomNumberGenerator.new()

# A aeolian pad chords, semitones above A2 (110 Hz): Am, F, C, G, Dm, Em
const CHORDS := [[0, 7, 12, 15], [-4, 3, 8, 12], [3, 10, 15, 19], [-2, 5, 10, 14], [-7, 0, 5, 8], [-5, 2, 7, 10]]
const CHORD_NEXT := [[1, 4, 3, 5], [2, 0, 3], [3, 1, 5, 0], [0, 1, 5], [0, 1, 5], [0, 1, 4]]
# motif scale, semitones above middle C (A aeolian, A3..E5)
const SCALE := [-3, -1, 0, 2, 4, 5, 7, 9, 11, 12, 14, 16]

func _ready() -> void:
	_rng.randomize()
	music_bus = _bus("Music", -40.0)
	sfx_bus = _bus("SFX", 0.0)
	var rv := AudioEffectReverb.new()
	rv.room_size = 0.9
	rv.damping = 0.45
	rv.spread = 0.8
	rv.wet = 0.42
	rv.dry = 0.85
	rv.predelay_msec = 60.0
	AudioServer.add_bus_effect(music_bus, rv)
	var lim := AudioEffectHardLimiter.new()
	lim.ceiling_db = -0.8
	AudioServer.add_bus_effect(0, lim)
	for i in 8:
		var p := AudioStreamPlayer.new()
		p.bus = "SFX"
		add_child(p)
		players.append(p)
	drone = AudioStreamPlayer.new()
	drone.volume_db = -80.0
	drone.bus = "Music"
	add_child(drone)
	for i in 8:
		var pp := AudioStreamPlayer.new()
		pp.bus = "Music"
		pp.volume_db = -80.0
		add_child(pp)
		pad_players.append(pp)
	for i in 6:
		var mp := AudioStreamPlayer.new()
		mp.bus = "Music"
		add_child(mp)
		motif_players.append(mp)

func _bus(name: String, vol: float) -> int:
	var idx := AudioServer.get_bus_index(name)
	if idx < 0:
		idx = AudioServer.bus_count
		AudioServer.add_bus(idx)
		AudioServer.set_bus_name(idx, name)
		AudioServer.set_bus_send(idx, "Master")
	AudioServer.set_bus_volume_db(idx, vol)
	return idx

var _build_step := 0
var _build_ms := 0
var _pad_buf := PackedFloat32Array()
var _pad_i := 0

## Synthesises one piece per call so start-up never hitches (called every frame until done).
func build_step() -> bool:
	if ready_ok: return true
	var t0 := Time.get_ticks_msec()
	match _build_step:
		0: streams["thud"] = _wav(_thud(0.42))
		1: streams["chime"] = _wav(_chime(1318.5, 1.6))
		2: streams["piano"] = _wav(_piano(261.63, 2.6))
		3: streams["grind"] = _wav(_grind(0.62))
		4: streams["whoosh"] = _wav(_whoosh(2.4))
		5: streams["glitch"] = _wav(_glitch_snd(0.32))
		6: streams["bell"] = _wav(_bell(523.25, 3.2))
		7:
			var dr := _wav(_drone(8.0))
			dr.loop_mode = AudioStreamWAV.LOOP_FORWARD
			dr.loop_end = int(8.0 * RATE)
			streams["drone"] = dr
		8:
			# the pad is rendered in chunks over several frames
			if _pad_i == 0: _pad_buf.resize(int(PAD_LEN * RATE))
			_pad_i = _pad_chunk(_pad_buf, _pad_i, PAD_CHUNK)
			_build_ms += Time.get_ticks_msec() - t0
			if _pad_i < _pad_buf.size(): return false
			var pw := _wav(_pad_buf)
			pw.loop_mode = AudioStreamWAV.LOOP_FORWARD
			pw.loop_end = _pad_buf.size()
			streams["pad"] = pw
			t0 = Time.get_ticks_msec()
	_build_step += 1
	_build_ms += Time.get_ticks_msec() - t0
	if _build_step > 8:
		ready_ok = true
		print("[sfx] synthesised in %d ms" % _build_ms)
	return ready_ok

func build() -> void:
	while not build_step(): pass

## Starts the ambient bed (fades in). Safe to call before synthesis finishes.
func start_music() -> void:
	_music_started = true
	if not ready_ok: return
	if not drone.playing:
		drone.stream = streams["drone"]
		drone.volume_db = -15.0
		drone.play()
	if _chord < 0: _next_chord(true)
	var tw := create_tween()
	tw.tween_method(func(v: float) -> void: AudioServer.set_bus_volume_db(music_bus, v), AudioServer.get_bus_volume_db(music_bus), 0.0, 5.0)

func start_drone() -> void:
	start_music()

func set_music(on: bool) -> void:
	music_on = on
	AudioServer.set_bus_mute(music_bus, not on)

## Duck the music under a solve, then bring it back.
func duck(db := -8.0, hold := 2.5) -> void:
	var tw := create_tween()
	tw.tween_method(func(v: float) -> void: AudioServer.set_bus_volume_db(music_bus, v), 0.0, db, 0.4)
	tw.tween_interval(hold)
	tw.tween_method(func(v: float) -> void: AudioServer.set_bus_volume_db(music_bus, v), db, 0.0, 2.5)

func _process(dt: float) -> void:
	if not ready_ok:
		build_step()
		if ready_ok and _music_started: start_music()
		return
	if not _music_started or _chord < 0: return
	_chord_t -= dt
	if _chord_t <= 0.0: _next_chord(false)
	_motif_t -= dt
	if _motif_t <= 0.0: _motif()

func _next_chord(first: bool) -> void:
	var opts: Array = CHORD_NEXT[_chord] if _chord >= 0 else [0]
	_chord = opts[_rng.randi_range(0, opts.size() - 1)]
	_chord_t = _rng.randf_range(9.0, 15.0)
	var old := _pad_group
	_pad_group = 1 - _pad_group
	var notes: Array = CHORDS[_chord]
	for k in 4:
		var p := pad_players[_pad_group * 4 + k]
		p.stream = streams["pad"]
		p.pitch_scale = pow(2.0, float(notes[k]) / 12.0) * (1.0 + _rng.randf_range(-0.002, 0.002))
		p.volume_db = -60.0
		p.play(_rng.randf_range(0.0, PAD_LEN - 0.1))
		var target := -13.0 - k * 1.5
		create_tween().tween_property(p, "volume_db", target, 0.5 if first else 4.5).set_trans(Tween.TRANS_SINE)
	if not first:
		for k in 4:
			var q := pad_players[old * 4 + k]
			var tw := create_tween()
			tw.tween_property(q, "volume_db", -60.0, 6.0).set_trans(Tween.TRANS_SINE)
			tw.tween_callback(q.stop)

func _motif() -> void:
	_motif_t = _rng.randf_range(4.0, 8.5)
	if _rng.randf() > 0.72: return
	# chord tones (relative to middle C) are favoured, the rest of the scale colours the line
	var tones: Array = []
	for n in CHORDS[_chord]:
		var c := int(n) - 15
		while c < -3: c += 12
		tones.append(c)
	var count := _rng.randi_range(1, 4)
	var t := 0.0
	var inst := "piano" if _rng.randf() < 0.6 else "bell"
	for i in count:
		var semi: int = tones[_rng.randi_range(0, tones.size() - 1)] if _rng.randf() < 0.65 else SCALE[_rng.randi_range(0, SCALE.size() - 1)]
		if _rng.randf() < 0.3: semi += 12
		var vol := _rng.randf_range(-19.0, -14.0)
		_note_later(t, inst, semi, vol)
		_note_later(t + 0.43, inst, semi, vol - 10.0)   # faked echo
		t += _rng.randf_range(0.45, 1.1)

func _note_later(delay: float, inst: String, semi: int, vol: float) -> void:
	var f := func() -> void:
		var p := motif_players[_motif_next]
		_motif_next = (_motif_next + 1) % motif_players.size()
		p.stream = streams[inst]
		p.pitch_scale = pow(2.0, semi / 12.0) * (0.5 if inst == "bell" else 1.0)
		p.volume_db = vol + (2.0 if inst == "bell" else 0.0)
		p.play()
	if delay <= 0.0: f.call()
	else: get_tree().create_timer(delay).timeout.connect(f)

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

## One seamless 6 s pad note at A2: detuned partials (all multiples of 1/6 Hz) with a soft, low-passed
## spectrum and slow breathing. Rendered in chunks; returns the next sample index.
func _pad_chunk(buf: PackedFloat32Array, start: int, count: int) -> int:
	var q := 1.0 / PAD_LEN
	var end := mini(start + count, buf.size())
	var f0 := 110.0
	for i in range(start, end):
		var t := float(i) / RATE
		var v := sin(TAU * f0 * t) * 0.55 + sin(TAU * (f0 + 2.0 * q) * t + 1.3) * 0.45 + sin(TAU * (f0 - 2.0 * q) * t + 2.1) * 0.4
		v += sin(TAU * (f0 * 2.0 + 2.0 * q) * t) * 0.22 + sin(TAU * f0 * 3.0 * t + 0.7) * 0.10 + sin(TAU * (f0 * 4.0 + q) * t) * 0.05
		var breathe := 0.8 + 0.2 * sin(TAU * q * t)
		buf[i] = v * breathe * 0.22
	return end

func _bell(f: float, dur: float) -> PackedFloat32Array:
	var n := int(dur * RATE)
	var out := PackedFloat32Array()
	out.resize(n)
	var parts := [[1.0, 1.0, 1.2], [2.0, 0.35, 2.0], [2.76, 0.25, 2.6], [4.07, 0.12, 4.0]]
	for i in n:
		var t := float(i) / RATE
		var v := 0.0
		for p in parts:
			v += sin(TAU * f * float(p[0]) * t) * float(p[1]) * exp(-t * float(p[2]))
		out[i] = v * minf(t * 300.0, 1.0) * 0.26
	return out

## Glassy tear for a blocked Eidolon: falling pitch + crackle.
func _glitch_snd(dur: float) -> PackedFloat32Array:
	var n := int(dur * RATE)
	var out := PackedFloat32Array()
	out.resize(n)
	var rng := RandomNumberGenerator.new()
	rng.seed = 23
	var ph := 0.0
	for i in n:
		var t := float(i) / RATE
		ph += TAU * (1900.0 - 1500.0 * t / dur) / RATE
		var crack := (rng.randf() * 2.0 - 1.0) * step_f(0.82, rng.randf())
		var env := exp(-t * 11.0)
		out[i] = (sin(ph) * 0.35 + sin(ph * 1.5) * 0.15 + crack * 0.3) * env * 0.5
	return out

func step_f(edge: float, x: float) -> float:
	return 1.0 if x >= edge else 0.0
