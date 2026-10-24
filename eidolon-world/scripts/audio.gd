class_name Sfx
extends Node
## EIDOLON soundscape v0.2. Every sound is synthesised at start-up (no audio files), one piece per
## frame (chunked) so loading never hitches.
##
## Web-audio rules (learned on the puzzle game): buses come ONLY from the static default_bus_layout.tres
## (never AudioServer.add_bus at runtime: on the web it re-orders Godot's Web Audio mirror and wires a
## feedback loop = silence); Sample playback ignores bus effects, so every reverb is BAKED into the
## samples (two characters: "open" air and the big "hall"); music starts on the first gesture.
##
## Layers:  pads (6 s seamless loop as 4-voice chords) + a choir "aah" (formant wavetable, 3 detuned
## voices) + drone + a distant WIND bed (louder on bridges and ledges) + WATER lapping near pools +
## sparse motifs whose instrument and register change per area (gate: piano + glass; hall: glass
## bells + tinkles; garden: sparse piano; court: warmer, choir; shrine: choir + glass), all
## crossfaded. Footsteps are soft cloth-wrapped thumps (no transient), varied per foot and surface.

const RATE := 22050
const PAD_LEN := 6.0
const CHUNK := 7000

const AREA_MUSIC := {
	"gate":   {"piano": 0.65, "glass": 0.35, "choir": 0.10, "gap": 1.0, "low": 0.0},
	"hall":   {"piano": 0.15, "glass": 0.85, "choir": 0.18, "gap": 0.9, "low": 0.0},
	"garden": {"piano": 1.00, "glass": 0.00, "choir": 0.00, "gap": 1.5, "low": 0.0},
	"court":  {"piano": 0.55, "glass": 0.20, "choir": 0.45, "gap": 1.1, "low": 0.5},
	"shrine": {"piano": 0.25, "glass": 0.75, "choir": 0.55, "gap": 1.0, "low": 0.0},
}

var streams := {}
var players: Array[AudioStreamPlayer] = []
var drone: AudioStreamPlayer
var _next := 0
var ready_ok := false
var music_bus := 0
var sfx_bus := 0
var music_on := true
var pad_players: Array[AudioStreamPlayer] = []
var choir_players: Array[AudioStreamPlayer] = []
var motif_players: Array[AudioStreamPlayer] = []
var swell_players: Array[AudioStreamPlayer] = []
var hum_player: AudioStreamPlayer
var wind_player: AudioStreamPlayer
var water_player: AudioStreamPlayer
var _motif_next := 0
var _pad_group := 0
var _chord := -1
var _chord_t := 0.0
var _motif_t := 3.0
var _bell_t := 12.0
var _tinkle_t := 4.0
var _music_started := false
var _rng := RandomNumberGenerator.new()
var _hum_level := 0.0
var area := "gate"
var choir_level := 0.0
var _choir_target := 0.0
var wind_level := 0.0
var wind_target := 0.35
var water_target := 0.0
var _foot := 0
var played := {}                   # name -> count (test evidence)

# A aeolian chords, semitones above A2 (110 Hz): Am, F, C, G, Dm, Em
const CHORDS := [[0, 7, 12, 15], [-4, 3, 8, 12], [3, 10, 15, 19], [-2, 5, 10, 14], [-7, 0, 5, 8], [-5, 2, 7, 10]]
const CHORD_NEXT := [[1, 4, 3, 5], [2, 0, 3], [3, 1, 5, 0], [0, 1, 5], [0, 1, 5], [0, 1, 4]]
const SCALE := [-3, -1, 0, 2, 4, 5, 7, 9, 11, 12, 14, 16]

func _ready() -> void:
	_rng.randomize()
	music_bus = AudioServer.get_bus_index("Music")
	sfx_bus = AudioServer.get_bus_index("SFX")
	AudioServer.set_bus_volume_db(music_bus, -40.0)
	AudioServer.set_bus_volume_db(sfx_bus, -2.0)
	for i in 10: players.append(_player("SFX"))
	drone = _player("Music")
	for i in 8: pad_players.append(_player("Music"))
	for i in 6: choir_players.append(_player("Music"))
	for i in 8: motif_players.append(_player("Music", 0.0))
	for i in 8: swell_players.append(_player("Music"))
	hum_player = _player("SFX")
	wind_player = _player("Music")
	water_player = _player("SFX")

func _player(bus: String, vol := -80.0) -> AudioStreamPlayer:
	var p := AudioStreamPlayer.new()
	p.bus = bus
	p.volume_db = vol
	add_child(p)
	return p

# ------------------------------------------------------------------ build (one piece per frame)
var _build_step := 0
var _build_ms := 0
var _buf := PackedFloat32Array()
var _bi := 0
var _table := PackedFloat32Array()

func build_step() -> bool:
	if ready_ok: return true
	var t0 := Time.get_ticks_msec()
	match _build_step:
		0: streams["step_a"] = _wav(_reverb(_step(0.30, 11), 0.35, 0.10, 0.55, 0.55))
		1: streams["step_b"] = _wav(_reverb(_step(0.30, 29, 0.93), 0.35, 0.10, 0.55, 0.55))
		2: streams["step_hall"] = _wav(_reverb(_step(0.30, 47, 0.97), 1.6, 0.30, 1.5, 0.84))
		3: streams["step_water"] = _wav(_reverb(_step_water(0.42), 0.4, 0.10, 0.6, 0.6))
		4: streams["step_wood"] = _wav(_reverb(_step_wood(0.30), 0.4, 0.12, 0.6, 0.6))
		5: streams["cloth"] = _wav(_cloth(0.40))
		6: streams["chime"] = _wav(_reverb(_lp(_chime(1046.5, 1.8), 0.35), 1.2, 0.32))
		7: streams["chime_hall"] = _wav(_reverb(_lp(_chime(1046.5, 1.8), 0.35), 2.4, 0.45, 1.5, 0.85))
		8: streams["piano"] = _wav(_reverb(_lp(_piano(261.63, 2.8), 0.45), 1.6, 0.34))
		9: streams["glass"] = _wav(_reverb(_glassbell(659.25, 3.0), 2.2, 0.42, 1.4, 0.82))
		10: streams["bell"] = _wav(_reverb(_lp(_bell(523.25, 3.4), 0.4), 1.8, 0.40))
		11: streams["bell_far"] = _wav(_reverb(_lp(_bell(261.63, 3.0), 0.18), 3.0, 0.75, 1.6, 0.88))
		12: streams["tinkle"] = _wav(_reverb(_glassbell(1318.5, 1.0), 1.5, 0.5, 1.4, 0.82))
		13: streams["grind"] = _wav(_reverb(_grind(0.95), 0.6, 0.18))
		14: streams["turn"] = _wav(_reverb(_turn(0.75), 0.6, 0.2))
		15: streams["click"] = _wav(_reverb(_click(0.25), 0.5, 0.22))
		16: streams["door"] = _wav(_reverb(_door(4.0), 1.4, 0.30))
		17: streams["thud"] = _wav(_reverb(_thud(0.6), 1.0, 0.25))
		18: streams["whoosh"] = _wav(_whoosh(2.4))
		19: streams["rattle"] = _wav(_reverb(_lp(_rattle(0.6), 0.3), 0.6, 0.2))
		20: streams["hum"] = _loop(_hum(4.0))
		21: streams["drone"] = _loop(_drone(8.0))
		22:
			if _chunked(int(PAD_LEN * RATE), _pad_chunk): return _yield(t0)
			streams["pad"] = _loop(_buf)
		23:
			if _bi == 0: _table = _formant_table()
			if _chunked(int(PAD_LEN * RATE), _choir_chunk): return _yield(t0)
			streams["choir"] = _loop(_buf)
		24: streams["wind"] = _loop(_seamless(_wind_raw(9.0), 8.0))
		25: streams["water"] = _loop(_seamless(_water_raw(7.0), 6.0))
	_build_step += 1
	_build_ms += Time.get_ticks_msec() - t0
	if _build_step > 25:
		ready_ok = true
		print("[sfx] synthesised in %d ms" % _build_ms)
	return ready_ok

func _yield(t0: int) -> bool:
	_build_ms += Time.get_ticks_msec() - t0
	return false

func _chunked(n: int, f: Callable) -> bool:
	## true while there is more to render (the buffer is in _buf when it returns false)
	if _bi == 0:
		_buf = PackedFloat32Array()
		_buf.resize(n)
	_bi = f.call(_buf, _bi, CHUNK)
	if _bi < n: return true
	_bi = 0
	return false

func build() -> void:
	while not build_step(): pass

func _loop(buf: PackedFloat32Array) -> AudioStreamWAV:
	var w := _wav(buf)
	w.loop_mode = AudioStreamWAV.LOOP_FORWARD
	w.loop_end = buf.size()
	return w

# ------------------------------------------------------------------ music
func start_music() -> void:
	_music_started = true
	if not ready_ok: return
	if not drone.playing:
		drone.stream = streams["drone"]
		drone.volume_db = -15.0
		drone.play()
	if not wind_player.playing:
		wind_player.stream = streams["wind"]
		wind_player.volume_db = -60.0
		wind_player.play()
	if not water_player.playing:
		water_player.stream = streams["water"]
		water_player.volume_db = -60.0
		water_player.play()
	if _chord < 0: _next_chord(true)
	var tw := create_tween()
	tw.tween_method(func(v: float) -> void: AudioServer.set_bus_volume_db(music_bus, v), AudioServer.get_bus_volume_db(music_bus), 0.0, 5.0)

func set_music(on: bool) -> void:
	music_on = on
	AudioServer.set_bus_mute(music_bus, not on)

## the music and air of a space; layers crossfade over a few seconds
func set_area(key: String) -> void:
	if not AREA_MUSIC.has(key): return
	area = key
	_choir_target = float(AREA_MUSIC[key]["choir"])
	_motif_t = minf(_motif_t, 1.5)

## exposure 0..1: more wind on bridges and ledges
func set_wind(k: float) -> void:
	wind_target = k

func set_water(k: float) -> void:
	water_target = k

func _process(dt: float) -> void:
	if not ready_ok:
		build_step()
		if ready_ok and _music_started: start_music()
		return
	if not _music_started: return
	# continuous layers
	choir_level = move_toward(choir_level, _choir_target, dt * 0.12)
	for i in choir_players.size():
		var p := choir_players[i]
		if p.playing and p.has_meta("on"):
			p.volume_db = linear_to_db(maxf(choir_level * 0.55, 0.0001)) - 9.0 - (i % 3) * 2.0
	wind_level = move_toward(wind_level, wind_target, dt * 0.15)
	wind_player.volume_db = linear_to_db(maxf(wind_level, 0.0001)) - 13.0
	water_player.volume_db = move_toward(water_player.volume_db, linear_to_db(maxf(water_target, 0.0001)) - 19.0, dt * 12.0)
	if _chord < 0: return
	_chord_t -= dt
	if _chord_t <= 0.0: _next_chord(false)
	_motif_t -= dt
	if _motif_t <= 0.0: _motif()
	_bell_t -= dt
	if _bell_t <= 0.0:
		_bell_t = _rng.randf_range(16.0, 34.0)
		var semi: int = [-12, -7, -5, 0][_rng.randi_range(0, 3)]
		play("bell_far", -21.0 + _rng.randf_range(-3.0, 0.0), pow(2.0, semi / 12.0))
	if area == "hall":
		_tinkle_t -= dt
		if _tinkle_t <= 0.0:
			_tinkle_t = _rng.randf_range(2.5, 7.0)
			for k in _rng.randi_range(1, 3):
				var s2: int = SCALE[_rng.randi_range(4, SCALE.size() - 1)]
				var d := k * _rng.randf_range(0.12, 0.3)
				get_tree().create_timer(d).timeout.connect(func() -> void: play("tinkle", -31.0 + _rng.randf_range(-3.0, 2.0), pow(2.0, s2 / 12.0) * 0.5))

func _next_chord(first: bool) -> void:
	var opts: Array = CHORD_NEXT[_chord] if _chord >= 0 else [0]
	_chord = opts[_rng.randi_range(0, opts.size() - 1)]
	_chord_t = _rng.randf_range(10.0, 16.0)
	var old := _pad_group
	_pad_group = 1 - _pad_group
	var notes: Array = CHORDS[_chord]
	var low: float = AREA_MUSIC[area]["low"]
	for k in 4:
		var p := pad_players[_pad_group * 4 + k]
		p.stream = streams["pad"]
		p.pitch_scale = pow(2.0, float(notes[k]) / 12.0) * (1.0 + _rng.randf_range(-0.002, 0.002))
		p.volume_db = -60.0
		p.play(_rng.randf_range(0.0, PAD_LEN - 0.1))
		var target := -11.0 - k * 1.5 + low * 1.5
		create_tween().tween_property(p, "volume_db", target, 0.5 if first else 5.0).set_trans(Tween.TRANS_SINE)
	# the choir sings the upper chord tones, an octave above the pad
	for k in 3:
		var c := choir_players[_pad_group * 3 + k]
		c.stream = streams["choir"]
		c.pitch_scale = pow(2.0, float(notes[k + 1] - 12) / 12.0)
		c.volume_db = -60.0
		c.set_meta("on", false)
		c.play(_rng.randf_range(0.0, PAD_LEN - 0.1))
		var tw2 := create_tween()
		tw2.tween_property(c, "volume_db", linear_to_db(maxf(choir_level * 0.55, 0.0001)) - 9.0 - k * 2.0, 4.0)
		tw2.tween_callback(func() -> void: c.set_meta("on", true))
	if not first:
		for k in 4:
			var q := pad_players[old * 4 + k]
			var tw := create_tween()
			tw.tween_property(q, "volume_db", -60.0, 7.0).set_trans(Tween.TRANS_SINE)
			tw.tween_callback(q.stop)
		for k in 3:
			var q2 := choir_players[old * 3 + k]
			q2.set_meta("on", false)
			var tw3 := create_tween()
			tw3.tween_property(q2, "volume_db", -60.0, 6.0).set_trans(Tween.TRANS_SINE)
			tw3.tween_callback(q2.stop)

func _motif() -> void:
	var m: Dictionary = AREA_MUSIC[area]
	_motif_t = _rng.randf_range(4.5, 9.0) * float(m["gap"])
	if _rng.randf() > 0.7: return
	var tones: Array = []
	for n in CHORDS[_chord]:
		var c := int(n) - 15
		while c < -3: c += 12
		tones.append(c)
	var inst := "piano" if _rng.randf() < float(m["piano"]) else "glass"
	var count := _rng.randi_range(1, 4 if inst == "piano" else 3)
	var t := 0.0
	for i in count:
		var semi: int = tones[_rng.randi_range(0, tones.size() - 1)] if _rng.randf() < 0.65 else SCALE[_rng.randi_range(0, SCALE.size() - 1)]
		if _rng.randf() < 0.25: semi += 12
		if _rng.randf() < float(m["low"]): semi -= 12
		var vol := _rng.randf_range(-19.0, -14.0)
		_note_later(t, inst, semi, vol)
		if inst == "piano": _note_later(t + 0.45, inst, semi, vol - 11.0)     # a soft echo
		t += _rng.randf_range(0.5, 1.2) * (1.3 if inst == "glass" else 1.0)

func _note_later(delay: float, inst: String, semi: int, vol: float) -> void:
	var f := func() -> void:
		if not streams.has(inst): return
		var p := motif_players[_motif_next]
		_motif_next = (_motif_next + 1) % motif_players.size()
		p.stream = streams[inst]
		var base := 1.0
		if inst == "bell": base = 0.5
		elif inst == "glass": base = 0.4
		p.pitch_scale = pow(2.0, semi / 12.0) * base
		p.volume_db = vol
		p.play()
	if delay <= 0.0: f.call()
	else: get_tree().create_timer(delay).timeout.connect(f)

## Beam hum: 0..1 (distance-scaled by the caller).
func set_hum(level: float) -> void:
	if not ready_ok: return
	_hum_level = level
	if level > 0.01 and not hum_player.playing:
		hum_player.stream = streams["hum"]
		hum_player.play()
	hum_player.volume_db = linear_to_db(maxf(level, 0.0001)) - 15.0
	if level <= 0.01 and hum_player.playing: hum_player.stop()

## Footstep: soft, muffled, alternating feet; surface = stone | hall | water | wood
func footstep(surface: String, strength: float) -> void:
	_foot = 1 - _foot
	var name := "step_a" if _foot == 0 else "step_b"
	if surface == "hall": name = "step_hall"
	elif surface == "water": name = "step_water"
	elif surface == "wood": name = "step_wood"
	var vol := -24.0 + strength * 3.0 + _rng.randf_range(-2.5, 1.0)
	play(name, vol, _rng.randf_range(0.9, 1.05) * (0.97 if _foot == 1 else 1.0))

## A puzzle solved: a soft resolving chord (piano + glass + choir breath), never harsh.
func resolve(root := 0) -> void:
	if not ready_ok: return
	played["resolve"] = played.get("resolve", 0) + 1
	var chord := [root - 3, root + 4, root + 7, root + 11]
	for i in chord.size():
		_note_later(i * 0.11, "piano", chord[i], -15.0 - i)
	_note_later(0.5, "glass", root + 16, -17.0)
	_choir_burst([root - 3, root + 4, root + 9], 2.0, 3.5, -13.0)

func _choir_burst(semis: Array, rise: float, hold: float, vol: float) -> void:
	if not streams.has("choir"): return
	for k in semis.size():
		var p := swell_players[k % swell_players.size()]
		p.stream = streams["choir"]
		p.pitch_scale = pow(2.0, float(semis[k]) / 12.0)
		p.volume_db = -50.0
		p.play(_rng.randf_range(0.0, PAD_LEN - 0.1))
		var tw := create_tween()
		tw.tween_property(p, "volume_db", vol - k * 1.5, rise).set_trans(Tween.TRANS_SINE)
		tw.tween_interval(hold)
		tw.tween_property(p, "volume_db", -60.0, 6.0).set_trans(Tween.TRANS_SINE)
		tw.tween_callback(p.stop)

## The shrine wakes: the choir swells on an A-major chord over the pads, a bell, glass cascades.
func swell() -> void:
	if not ready_ok: return
	played["swell"] = played.get("swell", 0) + 1
	_choir_burst([0, 4, 7, 12], 4.0, 4.0, -7.0)
	var notes := [-12, 0, 7, 12]
	for k in 4:
		var p := swell_players[4 + k]
		p.stream = streams["pad"]
		p.pitch_scale = pow(2.0, float(notes[k]) / 12.0)
		p.volume_db = -50.0
		p.play(_rng.randf_range(0.0, PAD_LEN - 0.1))
		var tw := create_tween()
		tw.tween_property(p, "volume_db", -9.0 - k * 1.2, 3.6).set_trans(Tween.TRANS_SINE)
		tw.tween_interval(3.0)
		tw.tween_property(p, "volume_db", -60.0, 10.0).set_trans(Tween.TRANS_SINE)
		tw.tween_callback(p.stop)
	get_tree().create_timer(2.6).timeout.connect(func() -> void: play("bell", -9.0, 0.5))
	for i in 6:
		var semi: int = [0, 4, 7, 12, 16, 19][i]
		_note_later(3.2 + i * 0.34, "glass", semi + 9, -15.0)

func play(name: String, vol_db := 0.0, pitch := 1.0) -> void:
	if not ready_ok or not streams.has(name): return
	played[name] = played.get(name, 0) + 1
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
		_note_later(i * spread, "piano", int(s), vol_db)
		i += 1

# ------------------------------------------------------------------ synthesis helpers
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

## one-pole low-pass in place (k: 0..1, smaller = darker) -- tames every high edge
func _lp(buf: PackedFloat32Array, k: float) -> PackedFloat32Array:
	var y := 0.0
	for i in buf.size():
		y += (buf[i] - y) * k
		buf[i] = y
	return buf

func _normalize(buf: PackedFloat32Array, peak: float) -> PackedFloat32Array:
	var m := 0.0001
	for v in buf: m = maxf(m, absf(v))
	var g := peak / m
	for i in buf.size(): buf[i] *= g
	return buf

## loop made seamless: the last `xf` part of a raw buffer (len = loop + 1 s) crossfades into its start
func _seamless(raw: PackedFloat32Array, loop_s: float) -> PackedFloat32Array:
	var n := int(loop_s * RATE)
	var xr := raw.size() - n
	var out := PackedFloat32Array()
	out.resize(n)
	for i in n:
		var v := raw[i]
		if i < xr:
			var k := float(i) / xr
			v = raw[i + n] * (1.0 - k) + raw[i] * k
		out[i] = v
	return out

## Baked Schroeder reverb (4 combs + 2 allpasses) appended as a tail. size scales the room (1.5 =
## the hall), fb sets the decay.
func _reverb(dry: PackedFloat32Array, tail: float, wet: float, size := 1.0, fb := 0.80) -> PackedFloat32Array:
	var n := dry.size() + int(tail * RATE)
	var out := PackedFloat32Array()
	out.resize(n)
	var bufs := []
	var idx := [0, 0, 0, 0]
	for c in [1116, 1188, 1277, 1356]:
		var b := PackedFloat32Array()
		b.resize(maxi(8, int(c * size * RATE / 44100.0)))
		bufs.append(b)
	var ap := [PackedFloat32Array(), PackedFloat32Array()]
	ap[0].resize(int(556 * RATE / 44100.0)); ap[1].resize(int(441 * RATE / 44100.0))
	var api := [0, 0]
	var damp := [0.0, 0.0, 0.0, 0.0]
	for i in n:
		var x := dry[i] if i < dry.size() else 0.0
		var acc := 0.0
		for k in 4:
			var b: PackedFloat32Array = bufs[k]
			var j: int = idx[k]
			var y := b[j]
			damp[k] = damp[k] + (y - damp[k]) * 0.45          # damped (dark) tail
			b[j] = x + damp[k] * fb
			idx[k] = (j + 1) % b.size()
			acc += y
		acc *= 0.25
		for k in 2:
			var b2: PackedFloat32Array = ap[k]
			var j2: int = api[k]
			var bv := b2[j2]
			var y2 := -acc + bv
			b2[j2] = acc + bv * 0.5
			api[k] = (j2 + 1) % b2.size()
			acc = y2
		out[i] = x + acc * wet
	return out

# ------------------------------------------------------------------ voices
## Footfall: a gentle low thump with a short soft grit; slow attack (no transient), low-passed.
func _step(dur: float, seed: int, tone := 1.0) -> PackedFloat32Array:
	var n := int(dur * RATE)
	var out := PackedFloat32Array()
	out.resize(n)
	var rng := RandomNumberGenerator.new()
	rng.seed = seed
	var a := 0.0
	var b := 0.0
	var c := 0.0
	for i in n:
		var t := float(i) / RATE
		var noise := rng.randf() * 2.0 - 1.0
		a += (noise - a) * 0.10
		b += (a - b) * 0.18
		c += (noise - c) * 0.30
		var att := 1.0 - exp(-t * 160.0)                      # ~6 ms soft attack
		var thump := sin(TAU * (68.0 * tone - 16.0 * t / dur) * t) * exp(-t * 26.0) * att
		var grit := b * exp(-t * 32.0) * att * 2.2
		var scuff_env := smoothstep(0.03, 0.06, t) * (1.0 - smoothstep(0.06, 0.16, t))
		var scuff := (c - a) * scuff_env * 0.35
		out[i] = thump * 0.8 + grit + scuff
	return _normalize(_lp(out, 0.32), 0.55)

## Wet stone at a pool's edge: a soft splashy pat with a little bubbling.
func _step_water(dur: float) -> PackedFloat32Array:
	var n := int(dur * RATE)
	var out := PackedFloat32Array()
	out.resize(n)
	var rng := RandomNumberGenerator.new()
	rng.seed = 61
	var a := 0.0
	var b := 0.0
	for i in n:
		var t := float(i) / RATE
		var noise := rng.randf() * 2.0 - 1.0
		a += (noise - a) * 0.25
		b += (a - b) * 0.08
		var att := 1.0 - exp(-t * 120.0)
		var splash := (a - b) * exp(-t * 14.0) * att * (0.6 + 0.4 * sin(TAU * 34.0 * t))
		var plip := sin(TAU * (420.0 + 900.0 * t) * t) * exp(-maxf(t - 0.05, 0.0) * 40.0) * smoothstep(0.04, 0.06, t) * 0.12
		var thump := sin(TAU * 62.0 * t) * exp(-t * 30.0) * att * 0.5
		out[i] = splash * 1.4 + plip + thump
	return _normalize(_lp(out, 0.38), 0.45)

## Old wood: a hollow, dull knock.
func _step_wood(dur: float) -> PackedFloat32Array:
	var n := int(dur * RATE)
	var out := PackedFloat32Array()
	out.resize(n)
	var rng := RandomNumberGenerator.new()
	rng.seed = 71
	var a := 0.0
	for i in n:
		var t := float(i) / RATE
		a += (rng.randf() * 2.0 - 1.0 - a) * 0.12
		var att := 1.0 - exp(-t * 200.0)
		var body := (sin(TAU * 118.0 * t) + sin(TAU * 251.0 * t) * 0.35 * exp(-t * 18.0)) * exp(-t * 24.0) * att
		out[i] = body * 0.8 + a * exp(-t * 40.0) * 0.8
	return _normalize(_lp(out, 0.3), 0.5)

func _cloth(dur: float) -> PackedFloat32Array:
	var n := int(dur * RATE)
	var out := PackedFloat32Array()
	out.resize(n)
	var rng := RandomNumberGenerator.new()
	rng.seed = 43
	var a := 0.0
	var b := 0.0
	for i in n:
		var t := float(i) / RATE
		a += (rng.randf() * 2.0 - 1.0 - a) * 0.16
		b += (a - b) * 0.04
		var env := pow(sin(PI * t / dur), 2.0) * (0.75 + 0.25 * sin(TAU * 7.0 * t))
		out[i] = (a - b) * env
	return _normalize(_lp(out, 0.5), 0.4)

func _piano(f: float, dur: float) -> PackedFloat32Array:
	var n := int(dur * RATE)
	var out := PackedFloat32Array()
	out.resize(n)
	var parts := [[1.0, 1.0, 2.0], [2.0, 0.42, 3.0], [3.0, 0.18, 4.2], [4.0, 0.08, 6.0]]
	for i in n:
		var t := float(i) / RATE
		var env := minf(t * 120.0, 1.0)
		var v := 0.0
		for p in parts:
			var k: float = p[0]
			v += sin(TAU * f * k * (1.0 + 0.0004 * k * k) * t) * p[1] * exp(-t * p[2])
		v += sin(TAU * f * 0.5 * t) * 0.12 * exp(-t * 25.0)
		out[i] = v * env * 0.33
	return out

func _chime(f: float, dur: float) -> PackedFloat32Array:
	var n := int(dur * RATE)
	var out := PackedFloat32Array()
	out.resize(n)
	var parts := [[1.0, 1.0, 2.2], [2.76, 0.35, 3.6], [5.40, 0.12, 6.0]]
	for i in n:
		var t := float(i) / RATE
		var v := 0.0
		for p in parts:
			v += sin(TAU * f * float(p[0]) * t) * float(p[1]) * exp(-t * float(p[2]))
		out[i] = v * minf(t * 150.0, 1.0) * 0.22
	return out

## Glass bell: soft-struck, slightly inharmonic, long and pure.
func _glassbell(f: float, dur: float) -> PackedFloat32Array:
	var n := int(dur * RATE)
	var out := PackedFloat32Array()
	out.resize(n)
	var parts := [[1.0, 1.0, 1.4], [2.32, 0.30, 2.6], [4.25, 0.10, 4.5], [0.5, 0.18, 1.0]]
	for i in n:
		var t := float(i) / RATE
		var v := 0.0
		for p in parts:
			v += sin(TAU * f * float(p[0]) * t + float(p[0])) * float(p[1]) * exp(-t * float(p[2]))
		out[i] = v * minf(t * 90.0, 1.0) * 0.24
	return _lp(out, 0.55)

func _bell(f: float, dur: float) -> PackedFloat32Array:
	var n := int(dur * RATE)
	var out := PackedFloat32Array()
	out.resize(n)
	var parts := [[1.0, 1.0, 1.0], [2.0, 0.32, 1.8], [2.76, 0.22, 2.4], [4.07, 0.08, 3.6], [0.5, 0.25, 0.7]]
	for i in n:
		var t := float(i) / RATE
		var v := 0.0
		for p in parts:
			v += sin(TAU * f * float(p[0]) * t) * float(p[1]) * exp(-t * float(p[2]))
		out[i] = v * minf(t * 160.0, 1.0) * 0.26
	return out

## Stone grinding: a deep, soft rumble with a rough low texture; slow in, slow out.
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
		lp += (rng.randf() * 2.0 - 1.0 - lp) * 0.06
		bp += (lp - bp) * 0.25
		var env := smoothstep(0.0, 0.18, t) * (1.0 - smoothstep(dur * 0.55, dur, t))
		var rough := 0.6 + 0.4 * sin(TAU * 17.0 * t + sin(TAU * 4.0 * t) * 2.0)
		var rumble := sin(TAU * 38.0 * t) * 0.5 + sin(TAU * 55.0 * t) * 0.25
		out[i] = ((lp - bp) * 2.6 * rough + rumble * 0.55) * env
	return _normalize(_lp(out, 0.28), 0.5)

## A mirror stand turning on its stone socket: a short deep grind ending in a soft wooden seat.
func _turn(dur: float) -> PackedFloat32Array:
	var g := _grind(dur * 0.8)
	var c := _click(0.25)
	var n := int(dur * RATE)
	var out := PackedFloat32Array()
	out.resize(n)
	var off := int(dur * 0.62 * RATE)
	for i in n:
		var v := g[i] * 0.8 if i < g.size() else 0.0
		if i >= off and i - off < c.size(): v += c[i - off] * 0.7
		out[i] = v
	return out

## A soft stone click (rune slot turning): low knock, no sharp edge.
func _click(dur: float) -> PackedFloat32Array:
	var n := int(dur * RATE)
	var out := PackedFloat32Array()
	out.resize(n)
	var rng := RandomNumberGenerator.new()
	rng.seed = 17
	var a := 0.0
	for i in n:
		var t := float(i) / RATE
		a += (rng.randf() * 2.0 - 1.0 - a) * 0.2
		var att := 1.0 - exp(-t * 400.0)
		out[i] = (sin(TAU * (190.0 - 60.0 * t) * t) * exp(-t * 48.0) + a * exp(-t * 70.0) * 0.5) * att
	return _normalize(_lp(out, 0.4), 0.45)

## Heavy stone door sinking: a long deep grind that settles with a muffled boom.
func _door(dur: float) -> PackedFloat32Array:
	var n := int(dur * RATE)
	var out := PackedFloat32Array()
	out.resize(n)
	var rng := RandomNumberGenerator.new()
	rng.seed = 13
	var lp := 0.0
	var bp := 0.0
	var boom := _thud(0.7)
	var ts := int((dur - 0.75) * RATE)
	for i in n:
		var t := float(i) / RATE
		lp += (rng.randf() * 2.0 - 1.0 - lp) * 0.05
		bp += (lp - bp) * 0.22
		var env := smoothstep(0.0, 0.5, t) * (1.0 - smoothstep(dur - 1.1, dur - 0.7, t))
		var rough := 0.55 + 0.45 * sin(TAU * 13.0 * t + sin(TAU * 2.0 * t) * 3.0)
		var rumble := sin(TAU * 31.0 * t) * 0.5 + sin(TAU * 44.0 * t) * 0.3
		var v := ((lp - bp) * 2.6 * rough + rumble * 0.7) * env * 0.5
		if i >= ts and i - ts < boom.size(): v += boom[i - ts] * 1.0
		out[i] = v
	return _normalize(_lp(out, 0.25), 0.6)

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
		lp += (rng.randf() * 2.0 - 1.0 - lp) * 0.06
		lp2 += (lp - lp2) * 0.15
		var att := 1.0 - exp(-t * 220.0)
		var body := sin(TAU * (52.0 - 14.0 * t) * t) * exp(-t * 9.0)
		out[i] = (body * 0.9 + lp2 * exp(-t * 16.0) * 2.0) * att * 0.8
	return _lp(out, 0.3)

func _whoosh(dur: float) -> PackedFloat32Array:
	var n := int(dur * RATE)
	var out := PackedFloat32Array()
	out.resize(n)
	var rng := RandomNumberGenerator.new()
	rng.seed = 5
	var lp := 0.0
	for i in n:
		var t := float(i) / RATE
		var cut := 0.015 + 0.04 * sin(PI * t / dur)
		lp += (rng.randf() * 2.0 - 1.0 - lp) * cut
		out[i] = lp * sin(PI * t / dur) * 1.6
	return out

func _rattle(dur: float) -> PackedFloat32Array:
	var n := int(dur * RATE)
	var out := PackedFloat32Array()
	out.resize(n)
	var hits := [0.0, 0.08, 0.17, 0.29]
	var freqs := [610.0, 940.0, 1350.0]
	for i in n:
		var t := float(i) / RATE
		var v := 0.0
		for h in hits:
			var u: float = t - h
			if u < 0.0: continue
			var e := exp(-u * 22.0) * (1.0 - exp(-u * 300.0))
			for k in freqs.size():
				v += sin(TAU * float(freqs[k]) * (1.0 + float(h) * 0.2) * u) * e * (0.3 / (k + 1))
		out[i] = v * 0.4
	return out

## Beam hum: deep and soft (all partials multiples of 1/4 Hz -> seamless 4 s loop).
func _hum(dur: float) -> PackedFloat32Array:
	var n := int(dur * RATE)
	var out := PackedFloat32Array()
	out.resize(n)
	for i in n:
		var t := float(i) / RATE
		var v := sin(TAU * 55.0 * t) * 0.5 + sin(TAU * 110.25 * t) * 0.3 + sin(TAU * 165.0 * t) * 0.1 + sin(TAU * 220.5 * t) * 0.05
		out[i] = v * (0.8 + 0.2 * sin(TAU * 0.25 * t)) * 0.45
	return out

## Seamless 8 s loop: low open fifths with slow beating + soft air.
func _drone(dur: float) -> PackedFloat32Array:
	var n := int(dur * RATE)
	var out := PackedFloat32Array()
	out.resize(n)
	var q := 1.0 / dur
	var tones := [[55.0, 0.30], [55.0 + q, 0.22], [82.5, 0.14], [110.0 - q, 0.10], [164.875, 0.04]]
	for i in n:
		var t := float(i) / RATE
		var v := 0.0
		for tn in tones:
			v += sin(TAU * float(tn[0]) * t) * float(tn[1])
		out[i] = v * (0.75 + 0.25 * sin(TAU * q * t)) * 0.5
	return out

## Pad: one seamless 6 s note at A2, warm detuned partials, slow breathing; wide in the mix.
func _pad_chunk(buf: PackedFloat32Array, start: int, count: int) -> int:
	var q := 1.0 / PAD_LEN
	var end := mini(start + count, buf.size())
	var f0 := 110.0
	for i in range(start, end):
		var t := float(i) / RATE
		var v := sin(TAU * f0 * t) * 0.55 + sin(TAU * (f0 + 2.0 * q) * t + 1.3) * 0.45 + sin(TAU * (f0 - 2.0 * q) * t + 2.1) * 0.4
		v += sin(TAU * (f0 * 2.0 + 2.0 * q) * t) * 0.2 + sin(TAU * (f0 * 2.0 - q) * t + 0.4) * 0.12
		v += sin(TAU * f0 * 3.0 * t + 0.7) * 0.07 + sin(TAU * (f0 * 0.5) * t) * 0.18
		buf[i] = v * (0.8 + 0.2 * sin(TAU * q * t)) * 0.2
	return end

## One period of a sung "aah": harmonics shaped by three vowel formants (~800, 1150, 2900 Hz).
func _formant_table() -> PackedFloat32Array:
	var size := 2048
	var tab := PackedFloat32Array()
	tab.resize(size)
	var f0 := 220.0
	var amps := []
	for k in range(1, 22):
		var fk := f0 * k
		var a := exp(-pow((fk - 800.0) / 160.0, 2.0)) + 0.5 * exp(-pow((fk - 1150.0) / 180.0, 2.0)) + 0.18 * exp(-pow((fk - 2900.0) / 300.0, 2.0))
		a += 0.25 / k
		amps.append(a / sqrt(k))
	for i in size:
		var ph := TAU * float(i) / size
		var v := 0.0
		for k in amps.size():
			v += sin(ph * (k + 1) + k * 0.7) * float(amps[k])
		tab[i] = v
	return _normalize(tab, 1.0)

## Choir: three detuned voices reading the formant table with a slow vibrato. Every frequency is a
## multiple of 1/6 Hz, so the 6 s buffer loops seamlessly.
func _choir_chunk(buf: PackedFloat32Array, start: int, count: int) -> int:
	var end := mini(start + count, buf.size())
	var size := float(_table.size())
	var q := 1.0 / PAD_LEN
	var voices := [[220.0, 0.0], [220.0 + 5.0 * q, 1.7], [220.0 - 4.0 * q, 3.1]]
	for i in range(start, end):
		var t := float(i) / RATE
		var v := 0.0
		for vc in voices:
			var f: float = vc[0]
			# phase of f with a +-0.3 % vibrato at 5 Hz (its integral is periodic too)
			var ph := f * t + f * 0.003 * (1.0 - cos(TAU * 5.0 * t + float(vc[1]))) / (TAU * 5.0)
			var x := fmod(ph, 1.0) * size
			var j := int(x)
			var fr := x - j
			v += _table[j] * (1.0 - fr) + _table[(j + 1) % int(size)] * fr
		buf[i] = v * (0.82 + 0.18 * sin(TAU * q * t)) * 0.13
	return end

## Distant wind: band-limited noise, slow gusts and a faint high whistle (raw = 9 s; loop 8 s).
func _wind_raw(dur: float) -> PackedFloat32Array:
	var n := int(dur * RATE)
	var out := PackedFloat32Array()
	out.resize(n)
	var rng := RandomNumberGenerator.new()
	rng.seed = 3
	var a := 0.0
	var b := 0.0
	var c := 0.0
	var d := 0.0
	for i in n:
		var t := float(i) / RATE
		var noise := rng.randf() * 2.0 - 1.0
		var gust := 0.55 + 0.3 * sin(TAU * t / 8.0) + 0.15 * sin(TAU * t / 2.7 + 1.0)
		var cut := 0.008 + 0.02 * gust
		a += (noise - a) * cut
		b += (a - b) * cut
		c += (noise - c) * 0.09
		d += (c - d) * 0.06
		var whistle := (c - d) * (0.25 + 0.25 * sin(TAU * t / 4.5 + 2.0)) * 0.25
		out[i] = (b * 9.0 * gust + whistle) * 0.9
	return _normalize(out, 0.5)

## Water lapping at a pool's edge: small soft laps with a low gurgle (raw = 7 s; loop 6 s).
func _water_raw(dur: float) -> PackedFloat32Array:
	var n := int(dur * RATE)
	var out := PackedFloat32Array()
	out.resize(n)
	var rng := RandomNumberGenerator.new()
	rng.seed = 23
	var laps := []
	var tt := 0.1
	while tt < dur:
		laps.append([tt, rng.randf_range(0.25, 0.6), rng.randf_range(0.4, 1.0)])
		tt += rng.randf_range(0.35, 0.9)
	var a := 0.0
	var b := 0.0
	for i in n:
		var t := float(i) / RATE
		var noise := rng.randf() * 2.0 - 1.0
		a += (noise - a) * 0.12
		b += (a - b) * 0.05
		var env := 0.0
		for l in laps:
			var u: float = t - float(l[0])
			if u > 0.0 and u < float(l[1]):
				env += sin(PI * u / float(l[1])) * float(l[2])
		var gurgle := sin(TAU * (180.0 + 60.0 * sin(TAU * 3.0 * t)) * t) * 0.04 * env
		out[i] = ((a - b) * env * 1.6 + gurgle)
	return _normalize(_lp(out, 0.4), 0.45)
