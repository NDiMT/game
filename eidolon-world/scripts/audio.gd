class_name Sfx
extends Node
## EIDOLON soundscape v0.3: REAL recordings (CC0, see CREDITS.md), no noise synthesis.
##
## Why v0.2 sounded like static on a phone: its synthesised beds (drone, pads, hum, wind, steps,
## grinds) put 92-100 % of their energy below 200 Hz, which phone speakers cannot reproduce; what was
## left audible was the thin noise residue. v0.3 plays recorded music and effects whose energy sits in
## the 200 Hz - 2 kHz band phones reproduce well, and every file is tonal (spectral flatness ~0).
##
## Web rules kept: static bus layout (default_bus_layout.tres), Sample playback, start on a gesture.
## Music: one track per area group, crossfaded; long tracks loop by crossfading their tail into a
## second player; tracks are loaded on first use (Sample playback decodes whole files to PCM).

const MUSIC := {
	"first_light": "res://assets/audio/music/first_light.ogg",    # Yoiyami - First Light Particles
	"heavenly": "res://assets/audio/music/heavenly_loop.ogg",     # isaiah658 - Heavenly Loop (seamless)
	"cathedral": "res://assets/audio/music/cathedral.ogg",        # Umplix - Cathedral
}
const AREA_TRACK := {"gate": "first_light", "garden": "first_light", "hall": "heavenly", "court": "cathedral", "shrine": "cathedral"}
const TRACK_DB := {"first_light": -4.0, "heavenly": -2.0, "cathedral": -5.0}
const XFADE := 5.0

const SFX := {
	"step_stone": 10, "step_hall": 5, "step_wood": 4, "step_wet": 3, "cloth": 4,
	"bell": 2, "glass": 2,
}
const SINGLE := ["water_loop", "hum_loop", "stone_door", "stone_turn", "bell_far", "glass_tink", "click", "flip",
	"rattle", "thud", "whoosh", "page"]
## v0.2 names the game still uses -> recorded sounds
const ALIAS := {"chime": "glass", "chime_hall": "glass", "tinkle": "glass_tink", "grind": "stone_turn", "turn": "stone_turn",
	"door": "stone_door", "piano": "bell", "step": "step_stone"}

var streams := {}            # name -> Array[AudioStream]
var players: Array[AudioStreamPlayer] = []
var music_a: Dictionary = {}  # track -> [player0, player1]
var _music_cur := ""
var _music_slot := 0
var _music_started := false
var water_player: AudioStreamPlayer
var hum_player: AudioStreamPlayer
var drone: AudioStreamPlayer   # kept for the state hook: the current music player
var _next := 0
var ready_ok := false
var music_bus := 0
var sfx_bus := 0
var music_on := true
var area := "gate"
var water_target := 0.0
var _bell_t := 18.0
var _tinkle_t := 5.0
var _rng := RandomNumberGenerator.new()
var played := {}

func _ready() -> void:
	_rng.randomize()
	music_bus = AudioServer.get_bus_index("Music")
	sfx_bus = AudioServer.get_bus_index("SFX")
	AudioServer.set_bus_volume_db(music_bus, -40.0)
	AudioServer.set_bus_volume_db(sfx_bus, -3.0)
	for i in 12: players.append(_player("SFX"))
	water_player = _player("SFX")
	hum_player = _player("SFX")
	drone = _player("Music")
	for k in SFX.keys():
		var arr: Array = []
		for i in SFX[k]: arr.append(load("res://assets/audio/sfx/%s_%d.ogg" % [k, i]))
		streams[k] = arr
	for k in SINGLE: streams[k] = [load("res://assets/audio/sfx/%s.ogg" % k)]
	for k in ["water_loop", "hum_loop"]:
		var s: AudioStreamOggVorbis = streams[k][0]
		s.loop = true
	ready_ok = true

func _player(bus: String, vol := -80.0) -> AudioStreamPlayer:
	var p := AudioStreamPlayer.new()
	p.bus = bus
	p.volume_db = vol
	add_child(p)
	return p

func build_step() -> bool:
	return true

func build() -> void:
	pass

# ------------------------------------------------------------------ music
func _track(name: String) -> Array:
	if not music_a.has(name):
		var st: AudioStreamOggVorbis = load(MUSIC[name])
		st.loop = name == "heavenly"
		music_a[name] = [_player("Music"), _player("Music")]
		for p in music_a[name]: p.stream = st
	return music_a[name]

func start_music() -> void:
	if _music_started: return
	_music_started = true
	water_player.stream = streams["water_loop"][0]
	water_player.play()
	_switch(AREA_TRACK[area], 3.0)
	var tw := create_tween()
	tw.tween_method(func(v: float) -> void: AudioServer.set_bus_volume_db(music_bus, v), -40.0, 0.0, 4.0)

func _switch(track: String, fade: float, from_start := false) -> void:
	if track == _music_cur and not from_start: return
	if _music_cur != "":
		for p in music_a[_music_cur]:
			if p.playing:
				var tw := create_tween()
				tw.tween_property(p, "volume_db", -60.0, fade).set_trans(Tween.TRANS_SINE)
				tw.tween_callback(p.stop)
	_music_cur = track
	_music_slot = 0
	var pl: Array = _track(track)
	var p0: AudioStreamPlayer = pl[0]
	p0.volume_db = -50.0
	var start := 0.0 if from_start else _rng.randf_range(0.0, 0.25) * p0.stream.get_length()
	p0.play(start)
	create_tween().tween_property(p0, "volume_db", TRACK_DB[track], fade).set_trans(Tween.TRANS_SINE)
	drone = p0

func set_music(on: bool) -> void:
	music_on = on
	AudioServer.set_bus_mute(music_bus, not on)

func set_area(key: String) -> void:
	area = key
	if _music_started and AREA_TRACK.has(key): _switch(AREA_TRACK[key], XFADE)

func set_wind(_k: float) -> void:
	pass    # no noise beds in v0.3 (they read as static on phones)

func set_water(k: float) -> void:
	water_target = k

func _process(dt: float) -> void:
	if not _music_started: return
	water_player.volume_db = move_toward(water_player.volume_db, linear_to_db(maxf(water_target, 0.0001)) - 15.0, dt * 14.0)
	# long tracks: crossfade the tail into the other player (seamless loop)
	if _music_cur != "" and _music_cur != "heavenly":
		var pl: Array = music_a[_music_cur]
		var p: AudioStreamPlayer = pl[_music_slot]
		var L: float = p.stream.get_length()
		if p.playing and p.get_playback_position() > L - XFADE - 0.2:
			_music_slot = 1 - _music_slot
			var q: AudioStreamPlayer = pl[_music_slot]
			q.volume_db = -50.0
			q.play(0.0)
			create_tween().tween_property(q, "volume_db", TRACK_DB[_music_cur], XFADE).set_trans(Tween.TRANS_SINE)
			var tw := create_tween()
			tw.tween_property(p, "volume_db", -60.0, XFADE).set_trans(Tween.TRANS_SINE)
			tw.tween_callback(p.stop)
			drone = q
	_bell_t -= dt
	if _bell_t <= 0.0:
		_bell_t = _rng.randf_range(22.0, 40.0)
		play("bell_far", -20.0 + _rng.randf_range(-3.0, 0.0), _rng.randf_range(0.8, 1.0))
	if area == "hall":
		_tinkle_t -= dt
		if _tinkle_t <= 0.0:
			_tinkle_t = _rng.randf_range(4.0, 9.0)
			play("glass_tink", -26.0 + _rng.randf_range(-3.0, 1.0), _rng.randf_range(0.85, 1.25))

# ------------------------------------------------------------------ effects
func play(name: String, vol_db := 0.0, pitch := 1.0) -> void:
	if not ready_ok: return
	var key: String = ALIAS.get(name, name)
	if not streams.has(key): return
	played[name] = played.get(name, 0) + 1
	var arr: Array = streams[key]
	var p := players[_next]
	_next = (_next + 1) % players.size()
	p.stream = arr[_rng.randi_range(0, arr.size() - 1)]
	p.volume_db = vol_db
	p.pitch_scale = pitch
	p.play()

## soft, quiet footsteps: 4-10 recorded variants per surface, random pitch +-5 %, random level
func footstep(surface: String, strength: float) -> void:
	var key := "step_stone"
	match surface:
		"hall": key = "step_hall"
		"wood": key = "step_wood"
		"water": key = "step_wet"
	var base: float = {"step_stone": -17.0, "step_hall": -12.0, "step_wood": -19.0, "step_wet": -17.0}[key]
	play(key, base + strength * 2.0 + _rng.randf_range(-2.0, 1.0), _rng.randf_range(0.95, 1.05))
	played["step"] = played.get("step", 0) + 1

func set_hum(level: float) -> void:
	if level > 0.01 and not hum_player.playing:
		hum_player.stream = streams["hum_loop"][0]
		hum_player.play()
	hum_player.volume_db = linear_to_db(maxf(level, 0.0001)) - 17.0
	if level <= 0.01 and hum_player.playing: hum_player.stop()

## a puzzle solved: a struck bell and a glass answer, gently
func resolve(root := 0) -> void:
	played["resolve"] = played.get("resolve", 0) + 1
	play("bell", -11.0, pow(2.0, root / 24.0))
	get_tree().create_timer(0.45).timeout.connect(func() -> void: play("glass", -15.0, 1.0))

## the shrine wakes: the Cathedral theme from its first bar, bells and glass
func swell() -> void:
	played["swell"] = played.get("swell", 0) + 1
	if _music_started:
		_switch("cathedral", 2.0, true)
		var p: AudioStreamPlayer = music_a["cathedral"][_music_slot]
		var tw := create_tween()
		tw.tween_interval(2.0)
		tw.tween_property(p, "volume_db", TRACK_DB["cathedral"] + 3.0, 4.0)
		tw.tween_interval(10.0)
		tw.tween_property(p, "volume_db", TRACK_DB["cathedral"], 6.0)
	play("bell_far", -8.0, 0.9)
	get_tree().create_timer(1.6).timeout.connect(func() -> void: play("bell", -10.0, 0.75))
	for i in 4:
		get_tree().create_timer(3.0 + i * 0.45).timeout.connect(func() -> void: play("glass", -16.0, [1.0, 1.12, 1.26, 1.5][i]))

func chord(_semis: Array, vol_db := -6.0, _spread := 0.09) -> void:
	play("bell", vol_db - 2.0, 0.8)
