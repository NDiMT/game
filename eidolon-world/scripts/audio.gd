class_name Sfx
extends Node
## EIDOLON sound v0.5: the composed score (assets/audio/v5/manifest.json, dev/ROOMS.md).
##   - every room has its own bed (+ the shared water_lap layer by the water), crossfading in ~3 s;
##   - sparse musical events per room, every min_s..max_s seconds, never the same twice in a row;
##   - cues: solve_<room>, shrine_awaken, cinematic_hand (59 s, the closing scene), glimpse, breath,
##     touch_glass; long cues get their own players so footsteps never cut them;
##   - recorded SFX families (footsteps, cloth, statue_turn, door_stone, gate, glass_tap, glass_hum,
##     beam_hum, hollow_scrape, scale_creak, shard_pickup, ui_click, rune_flip).
## The game's older sound names are mapped onto the score's SFX (ALIAS). Only three v0.4 sounds
## remain (thud, whoosh, the wind gusts on exposed bridges); every other v0.4 file is superseded and
## left out of the web export.
## Web rules kept: static bus layout, Sample playback, start on a gesture, beds load on first use.

const MANIFEST := "res://assets/audio/v5/manifest.json"
const XFADE := 3.0
const V04 := {"thud": "res://assets/audio/sfx/thud.ogg", "whoosh": "res://assets/audio/sfx/whoosh.ogg",
	"wind_gust": "res://assets/audio/amb/wind_gust.ogg"}
## game sound name -> [score SFX key, gain dB, the level the game asks for at "normal" (the call's dB
## is applied relative to it, so a quiet echo stays quiet)]
const ALIAS := {
	"step_stone": ["footsteps_stone", 0.0, -17.0], "step_hall": ["footsteps_stone", 0.0, -12.0],
	"step_wet": ["footsteps_water", 0.0, -17.0], "step_wood": ["footsteps_wood", 0.0, -19.0],
	"cloth": ["cloth", -2.0, -31.0], "turn": ["statue_turn", -1.0, -6.0], "grind": ["statue_turn", -3.0, -20.0],
	"door": ["door_stone", 0.0, 0.0], "rattle": ["gate", -2.0, -16.0], "flip": ["rune_flip", 0.0, -13.0],
	"glass": ["glass_hum", -3.0, -15.0], "chime": ["glass_hum", -3.0, -16.0], "chime_hall": ["glass_hum", -3.0, -16.0],
	"glass_tink": ["glass_tap", -2.0, -20.0], "click": ["ui_click", 0.0, 0.0], "page": ["ui_click", -2.0, -14.0],
	"bell": ["@ev_bell_far_a", -4.0, -14.0], "bell_far": ["@ev_bell_far_d", -4.0, -12.0],
	"hollow": ["hollow_scrape", -1.0, 0.0], "creak": ["scale_creak", 0.0, 0.0], "shard": ["shard_pickup", 0.0, 0.0],
}
## cues that are music: their own players on the Music bus (never stolen by footsteps)
const LONG := ["cinematic_hand", "shrine_awaken", "glimpse", "breath", "touch_glass"]

var manifest := {}
var streams := {}            # key -> Array[AudioStream]
var players: Array[AudioStreamPlayer] = []
var cue_players: Array[AudioStreamPlayer] = []
var cue_now := {}            # cue name -> its AudioStreamPlayer while playing
var layer_p := {}            # layer file -> AudioStreamPlayer (created on first use)
var layer_db := {}
var rooms := {}              # room id -> {layer file: gain dB}
var room_events := {}        # room id -> [[file, gain dB, min_s, max_s]]
var _started := false
var _music_cur := ""
var hum_player: AudioStreamPlayer
var gust_player: AudioStreamPlayer
var drone: AudioStreamPlayer   # state hook: the current room's bed
var _next := 0
var _next_cue := 0
var ready_ok := false
var music_bus := 0
var sfx_bus := 0
var music_on := true
var area := "waking_pool"
var wind_target := 0.0
var swell_boost := 0.0
var duck := 0.0              # the cinematic: room beds step back (dB, <= 0)
var _event_t := 14.0
var _last_event := ""
var _rng := RandomNumberGenerator.new()
var played := {}
var far_voice := false       # the shrine is awake: now and then a voice sings far off in the fog
var _voice_t := 25.0
var _bed_check := 1.0
const FAR_VOICE := "res://assets/audio/v5/events/ev_voice_sigh.ogg"

func _ready() -> void:
	_rng.randomize()
	music_bus = AudioServer.get_bus_index("Music")
	sfx_bus = AudioServer.get_bus_index("SFX")
	AudioServer.set_bus_volume_db(music_bus, -40.0)
	AudioServer.set_bus_volume_db(sfx_bus, -3.0)
	for i in 12: players.append(_player("SFX"))
	for i in 4: cue_players.append(_player("Music"))
	hum_player = _player("Music")
	gust_player = _player("Music")
	drone = _player("Music")
	for k in V04: streams[k] = [load(V04[k])]
	(streams["wind_gust"][0] as AudioStreamOggVorbis).loop = true
	_load_manifest()
	ready_ok = true

func _player(bus: String, vol := -80.0) -> AudioStreamPlayer:
	var p := AudioStreamPlayer.new()
	p.bus = bus
	p.volume_db = vol
	add_child(p)
	return p

static func _res(f: String) -> String:
	return f if f.begins_with("res://") else "res://assets/audio/v5/" + f

func _load_manifest() -> void:
	if not FileAccess.file_exists(MANIFEST):
		push_warning("audio: no v5 manifest; the world is silent but for the wind")
		return
	var d = JSON.parse_string(FileAccess.get_file_as_string(MANIFEST))
	if not d is Dictionary: return
	manifest = d
	var rs: Dictionary = d.get("rooms", {})
	for room in rs:
		var r: Dictionary = rs[room]
		var mix := {}
		for L in r.get("layers", []):
			var f := _res(str(L.get("file", "")))
			if ResourceLoader.exists(f): mix[f] = float(L.get("gain_db", 0.0))
		rooms[room] = mix
		var evs := []
		for e in r.get("events", []):
			var f2 := _res(str(e.get("file", "")))
			if ResourceLoader.exists(f2):
				evs.append([f2, float(e.get("gain_db", -8.0)), float(e.get("min_s", 20.0)), float(e.get("max_s", 60.0))])
		room_events[room] = evs
	var cues: Dictionary = d.get("cues", {})
	for k in cues:
		var arr: Array = cues[k] if cues[k] is Array else [cues[k]]
		var ok: Array = []
		for f3 in arr:
			var f4 := _res(str(f3))
			if ResourceLoader.exists(f4): ok.append(load(f4))
		if not ok.is_empty(): streams[k] = ok
	if streams.has("beam_hum") and streams["beam_hum"][0] is AudioStreamOggVorbis:
		(streams["beam_hum"][0] as AudioStreamOggVorbis).loop = true
	var n_ev := 0
	var n_ev_listed := 0
	for room in rs: n_ev_listed += (rs[room] as Dictionary).get("events", []).size()
	for room in room_events: n_ev += (room_events[room] as Array).size()
	print("[audio] v5 manifest: %d rooms, %d cues, %d/%d room events" % [rooms.size(), cues.size(), n_ev, n_ev_listed])
	_pw_fill()

## an event file (also the bells), loaded on first use
func _file_stream(f: String) -> Array:
	if not streams.has(f): streams[f] = [load(f)]
	return streams[f]

func build_step() -> bool:
	return true

func build() -> void:
	pass

# ------------------------------------------------------------------ beds
func _layer(f: String) -> AudioStreamPlayer:
	if not layer_p.has(f):
		var st: AudioStream = load(f)
		if st is AudioStreamOggVorbis: (st as AudioStreamOggVorbis).loop = true
		var p := _player("Music")
		p.stream = st
		layer_p[f] = p
		layer_db[f] = -60.0
		p.volume_db = -60.0
		p.play(_rng.randf_range(0.0, st.get_length() * 0.8))
	return layer_p[f]

func _target(f: String) -> float:
	var room: Dictionary = rooms.get(area, {})
	if not room.has(f): return -60.0
	var db: float = room[f] + duck + jingle_duck
	if area in ["first_shrine", "gate_four", "court_light"]: db += swell_boost * 0.5
	return db

func start_music() -> void:
	if _started: return
	_started = true
	# (v0.8.5) at the first gesture (the web audio context exists now): the short streams (events and
	# cues) become web samples ahead of their first play, one per frame
	for k in streams:
		if (k as String).begins_with("res://"): continue      # (events: per room, see _bed_plan)
		for st in streams[k]: _pw_reg.append(st)
	gust_player.stream = streams["wind_gust"][0]
	gust_player.play(_rng.randf_range(0.0, 30.0))
	_enter(area)
	var tw := create_tween()
	tw.tween_method(func(v: float) -> void: AudioServer.set_bus_volume_db(music_bus, v), -40.0, 0.0, 4.0)

func _enter(key: String) -> void:
	_music_cur = key
	var room: Dictionary = rooms.get(key, {})
	var first := true
	for f in room:
		_layer(f)
		if first: drone = layer_p[f]
		first = false
	_event_t = _rng.randf_range(10.0, 25.0)

## (v0.8.5) pre-warm: every bed and event file is LOADED while the title screen shows (one every other
## frame), so no stream is read from the pack mid-walk; on the web, the short ones are also registered as
## samples after the first gesture (the long beds stay on demand: decoded, they are large)
var _pw: Array = []            # files to load
var _pw_reg: Array = []        # streams to register as web samples
var _pw_keep := {}             # file -> stream (held, so a later load() is instant)
var _pw_t := 0
func _pw_fill() -> void:
	for f in _wanted_beds(area):
		if not _pw.has(f): _pw.append(f)


func _pw_step() -> void:
	_pw_t += 1
	if _pw_t % 40 == 0: _bed_step()
	if _pw_t % 2 != 0: return
	if not _pw.is_empty():
		var f: String = _pw.pop_front()
		var st: AudioStream = load(f)
		if st == null: return
		if st is AudioStreamOggVorbis and (f.contains("/beds/")): (st as AudioStreamOggVorbis).loop = true
		_pw_keep[f] = st
		if not f.contains("/beds/") and not streams.has(f): streams[f] = [st]
		played["prewarm"] = played.get("prewarm", 0) + 1
		return
	if _started and not _pw_reg.is_empty() and OS.has_feature("web"):
		var st2: AudioStream = _pw_reg.pop_front()
		if st2 and st2.get_length() <= 12.0 and not AudioServer.is_stream_registered_as_sample(st2):
			AudioServer.register_stream_as_sample(st2)
	elif not OS.has_feature("web"):
		_pw_reg.clear()

## (v0.8.5) the beds of this room and its neighbours are loaded (and held) ahead of time, one at a time,
## so walking into a room never reads its bed from the pack on the spot (the music streams: see _player)
func _neighbours(key: String) -> Array:
	var i := Names.ORDER.find(key)
	var out := []
	for j in [i + 1, i - 1]:
		if j >= 0 and j < Names.ORDER.size(): out.append(Names.ORDER[j])
	return out

var _hook := -1
func _hook_ok() -> bool:
	if _hook < 0: _hook = 1 if JavaScriptBridge.eval("typeof window.__eidRelease === 'function' && !!window.__eidSamples") else 0
	return _hook == 1

## free a registered stream's decoded web sample (its id is the stream's instance id). Deferred: the
## engine lets go of a stopped player's playback a little later, and must not find its sample gone; if
## the stream is in use again by then (you walked back), it is kept.
var _rel: Array = []             # [stream, release time]
func _web_release(st: AudioStream) -> void:
	if st == null or not AudioServer.is_stream_registered_as_sample(st): return
	_rel.append([st, Time.get_ticks_msec() / 1000.0 + 1.5])

func _rel_step() -> void:
	if _rel.is_empty(): return
	var now := Time.get_ticks_msec() / 1000.0
	var keep: Array = []
	for e in _rel:
		if now < e[1]:
			keep.append(e)
			continue
		var st: AudioStream = e[0]
		if _in_use(st): continue                       # (back in use: keep its sample)
		var r = JavaScriptBridge.eval("window.__eidRelease('%s')" % str(st.get_instance_id()))
		if int(r) == 1: played["web_release"] = played.get("web_release", 0) + 1
	_rel = keep

func _in_use(st: AudioStream) -> bool:
	for p in cue_players + players:
		if p.stream == st: return true
	for f in layer_p:
		if (layer_p[f] as AudioStreamPlayer).stream == st: return true
	for f in _pw_keep:
		if _pw_keep[f] == st: return true
	for k in streams:
		for x in streams[k]:
			if x == st: return true
	return false

func _playing_stream(st: AudioStream) -> bool:
	for p in cue_players:
		if p.playing and p.stream == st: return true
	return false

func _wanted_beds(key: String) -> Dictionary:
	var out := {}
	var i := Names.ORDER.find(key)
	for j in [i, i + 1, i - 1]:
		if j < 0 or j >= Names.ORDER.size(): continue
		for f in rooms.get(Names.ORDER[j], {}): out[f] = true
	return out

var _bed_q: Array = []
var calm := true                 # (main: the wanderer stands still / no walking: a good moment to decode ahead)
var _bed_reg := {}
func _bed_plan() -> void:
	var want := _wanted_beds(area)
	# (v0.8.5, web memory) a web sample is stereo float32 at the context rate (~350 KB a second) and
	# Godot never frees it; a whole play-through would keep ~350 MB of decoded music. A bed or an event
	# far from here (not this room's, not a neighbour's), silent now, is let go: its decoded buffer is
	# freed through the page's hook (export head_include: window.__eidRelease) and its stream dropped.
	# Without the hook nothing is let go (a dropped stream would only come back as a second copy).
	if OS.has_feature("web") and _hook_ok():
		for f in layer_p.keys():
			if want.has(f) or (f as String).ends_with("water_lap.ogg"): continue
			if layer_db.get(f, -60.0) > -59.5 or _target(f) > -59.5: continue
			var p: AudioStreamPlayer = layer_p[f]
			var st: AudioStream = p.stream
			p.stop()
			p.stream = null
			p.queue_free()
			layer_p.erase(f)
			layer_db.erase(f)
			_pw_keep.erase(f)
			_bed_reg.erase(f)
			_web_release(st)
		var ev_want := {}
		for e in room_events.get(area, []): ev_want[e[0]] = true          # (events: this room's only)
		for f in streams.keys():
			if not (f as String).begins_with("res://") or ev_want.has(f) or f == FAR_VOICE: continue
			var est: AudioStream = streams[f][0]
			if _playing_stream(est): continue
			streams.erase(f)
			_pw_keep.erase(f)
			_bed_reg.erase(f)
			# no player may keep it either: a stream still held would be handed back by load() as "already
			# registered", with its decoded sample gone
			for cp in cue_players:
				if cp.stream == est: cp.stream = null
			_web_release(est)
	for f in want:
		if layer_p.has(f): _bed_reg[f] = true          # (playing: registered by its play)
		elif not _bed_reg.has(f) and not _bed_q.has(f): _bed_q.append(f)
	for e in room_events.get(area, []):
		if not _bed_reg.has(e[0]) and not _bed_q.has(e[0]): _bed_q.append(e[0])

func _bed_step() -> void:
	if _bed_q.is_empty(): return
	var f: String = _bed_q.pop_front()
	if layer_p.has(f) or _bed_reg.has(f): return
	var bed := f.contains("/beds/")
	var st: AudioStream = _pw_keep[f] if _pw_keep.has(f) else (streams[f][0] if streams.has(f) else load(f))
	if st == null: return
	if bed and st is AudioStreamOggVorbis: (st as AudioStreamOggVorbis).loop = true     # (before it becomes a sample)
	_pw_keep[f] = st
	if not bed and not streams.has(f): streams[f] = [st]
	if not _started:
		_bed_q.append(f)                 # (loaded; it becomes a web sample once the audio context runs)
		return
	# decoded ahead (a web sample) while you are still in the room next door: entering never decodes
	if OS.has_feature("web") and not AudioServer.is_stream_registered_as_sample(st):
		if not calm:
			_bed_q.push_front(f)          # (a decode is a short stall: only while you stand still)
			return
		AudioServer.register_stream_as_sample(st)
	_bed_reg[f] = true
	played["bed_prewarm"] = played.get("bed_prewarm", 0) + 1

## (tests / web probe) every bed player: [target dB, current dB, playing, stream length]
func bed_debug() -> Dictionary:
	var d := {}
	for f in layer_p:
		var p: AudioStreamPlayer = layer_p[f]
		d[f.get_file()] = [snappedf(_target(f), 0.1), snappedf(layer_db[f], 0.1), p.playing, snappedf(p.stream.get_length() if p.stream else -1.0, 0.1)]
	d["duck"] = duck
	d["jingle_duck"] = snappedf(jingle_duck, 0.1)
	return d

func set_music(on: bool) -> void:
	music_on = on
	AudioServer.set_bus_mute(music_bus, not on)

func set_area(key: String) -> void:
	area = key
	_bed_plan()
	if _started and rooms.has(key): _enter(key)

## exposed bridges and ledges: the gusts rise (0..1)
func set_wind(k: float) -> void:
	wind_target = k

func _process(dt: float) -> void:
	_pw_step()
	if not _started: return
	var step := dt * 60.0 / XFADE              # dB per second so a full fade takes ~XFADE s
	jingle_duck = _jingle_duck_now()
	# (v0.8.3) a bed that should be heard but is not playing (on the web a play() can be dropped while
	# the stream's sample is still being decoded) is started again, once a second at most
	_bed_check -= dt
	if _bed_check <= 0.0:
		_bed_check = 1.0
		_bed_plan()
		_rel_step()
		for f in layer_p:
			var bp: AudioStreamPlayer = layer_p[f]
			if not bp.playing and _target(f) > -40.0 and bp.stream:
				bp.play(_rng.randf_range(0.0, bp.stream.get_length() * 0.8))
				played["bed_restart"] = played.get("bed_restart", 0) + 1
	for f in layer_p:
		var p: AudioStreamPlayer = layer_p[f]
		var t := _target(f)
		layer_db[f] = move_toward(layer_db[f], t, step * (1.6 if t > layer_db[f] else (4.0 if jingle_duck < -0.5 else 1.0)))
		p.volume_db = layer_db[f]
	var gk := clampf((wind_target - 0.5) / 0.45, 0.0, 1.0)
	gust_player.volume_db = move_toward(gust_player.volume_db, linear_to_db(maxf(gk, 0.0001)) - 9.0, dt * 12.0)
	if far_voice and duck > -1.0:
		_voice_t -= dt
		if _voice_t <= 0.0:
			_voice_t = _rng.randf_range(70.0, 140.0)
			if ResourceLoader.exists(FAR_VOICE):
				_play_stream(_file_stream(FAR_VOICE), -15.0 + _rng.randf_range(-2.0, 1.0), _rng.randf_range(0.97, 1.02), true)
				played["far_voice"] = played.get("far_voice", 0) + 1
	_event_t -= dt
	if _event_t <= 0.0:
		var evs: Array = room_events.get(area, [])
		_event_t = 30.0
		if evs.size() > 0 and duck > -1.0:
			var e: Array = evs[_rng.randi_range(0, evs.size() - 1)]
			if e[0] == _last_event and evs.size() > 1: e = evs[(evs.find(e) + 1) % evs.size()]
			_last_event = e[0]
			_play_stream(_file_stream(e[0]), e[1] + _rng.randf_range(-2.0, 0.5), 1.0, true)
			played["event"] = played.get("event", 0) + 1
			_event_t = _rng.randf_range(e[2], maxf(e[2], e[3]))

# ------------------------------------------------------------------ effects
func _play_stream(arr: Array, vol_db: float, pitch: float, music := false) -> AudioStreamPlayer:
	var p: AudioStreamPlayer
	if music:
		p = cue_players[_next_cue]
		_next_cue = (_next_cue + 1) % cue_players.size()
	else:
		p = players[_next]
		_next = (_next + 1) % players.size()
	p.stream = arr[_rng.randi_range(0, arr.size() - 1)]
	p.volume_db = vol_db
	p.pitch_scale = pitch
	p.play()
	return p

## a sound by the game's name (aliased onto the score's SFX)
func play(name: String, vol_db := 0.0, pitch := 1.0) -> void:
	if not ready_ok: return
	var arr: Array = []
	var db := vol_db
	if ALIAS.has(name):
		var a: Array = ALIAS[name]
		var key: String = a[0]
		if key.begins_with("@"): arr = _file_stream("res://assets/audio/v5/events/%s.ogg" % key.substr(1))
		elif streams.has(key): arr = streams[key]
		db = a[1] + (vol_db - a[2]) * 0.6
	elif streams.has(name):
		arr = streams[name]
	if arr.is_empty(): return
	played[name] = played.get(name, 0) + 1
	_play_stream(arr, db, pitch)

## a named cue from the score (solve_<room>, shrine_awaken, cinematic_hand, glimpse, breath,
## touch_glass, statue_turn, ...). Returns false when there was nothing to play.
func cue(name: String, vol_db := 0.0) -> bool:
	if not ready_ok: return false
	played["cue:" + name] = played.get("cue:" + name, 0) + 1
	if not streams.has(name): return false
	var music := name in LONG or name.begins_with("solve_")
	var p := _play_stream(streams[name], vol_db, 1.0, music)
	if music: cue_now[name] = p
	return true

## fade a long cue out (a skipped cinematic)
func stop_cue(name: String, fade := 1.0) -> void:
	if not cue_now.has(name): return
	var p: AudioStreamPlayer = cue_now[name]
	cue_now.erase(name)
	if not p.playing: return
	var tw := create_tween()
	tw.tween_property(p, "volume_db", -60.0, fade)
	tw.tween_callback(p.stop)

## v0.6: Ione's leitmotif (manifest doc: A4-D5-E5-F5-E5, here an octave up on the composer's glass
## note, retuned): single notes for the singing walls, the whole motif for the stair glass's chime
const NOTE_GLASS := "res://assets/audio/v5/events/ev_glass_a5.ogg"
const NOTE_STONE := "res://assets/audio/v5/events/ev_echo_a4.ogg"
const NOTES := {"A": 1.0, "D": 1.33484, "E": 1.49831, "F": 1.58740}
const MOTIF := ["A", "D", "E", "F", "E"]
func note(n: String, vol_db := -9.0, stone := false) -> void:
	if not ready_ok: return
	var r: float = NOTES.get(n, 1.0)
	played["note"] = played.get("note", 0) + 1
	played["note_" + n] = played.get("note_" + n, 0) + 1
	_play_stream(_file_stream(NOTE_GLASS), vol_db, r)
	if stone: _play_stream(_file_stream(NOTE_STONE), vol_db - 6.0, r * 2.0)

## the five notes, unhurried; the last E held a little apart (unresolved)
func motif(vol_db := -11.0, gap := 0.48, stone := false) -> void:
	played["motif"] = played.get("motif", 0) + 1
	for i in MOTIF.size():
		var n: String = MOTIF[i]
		var at := i * gap + (0.18 if i == MOTIF.size() - 1 else 0.0)
		if at <= 0.0: note(n, vol_db, stone)
		else: get_tree().create_timer(at).timeout.connect(func() -> void: note(n, vol_db, stone))

## a wrong note: two glass tones a semitone apart, low and soft
func sour(vol_db := -15.0) -> void:
	if not ready_ok: return
	played["sour"] = played.get("sour", 0) + 1
	_play_stream(_file_stream(NOTE_GLASS), vol_db, 0.749)
	_play_stream(_file_stream(NOTE_GLASS), vol_db - 2.0, 0.794)

func play_later(name: String, delay: float, vol_db := 0.0, pitch := 1.0) -> void:
	get_tree().create_timer(delay).timeout.connect(func() -> void: play(name, vol_db, pitch))

## soft footsteps: the score's recorded variants, random pitch +-4 %, level +-2 dB
func footstep(surface: String, strength: float) -> void:
	var key := "step_stone"
	match surface:
		"hall": key = "step_hall"
		"wood": key = "step_wood"
		"water": key = "step_wet"
	var a: Array = ALIAS[key]
	if not streams.has(a[0]): return
	played[key] = played.get(key, 0) + 1
	played["step"] = played.get("step", 0) + 1
	var db: float = a[1] - 2.0 + strength * 2.0 + _rng.randf_range(-2.0, 1.0) - (1.5 if surface == "hall" else 0.0)
	_play_stream(streams[a[0]], db, _rng.randf_range(0.96, 1.04) * (0.94 if surface == "hall" else 1.0))

## the beam's hum (Court of Light)
func set_hum(level: float) -> void:
	if not streams.has("beam_hum"): return
	if level > 0.01 and not hum_player.playing:
		hum_player.stream = streams["beam_hum"][0]
		hum_player.play()
	hum_player.volume_db = linear_to_db(maxf(level, 0.0001)) - 6.0
	if level <= 0.01 and hum_player.playing: hum_player.stop()

## a smaller success (not a whole space): a glass answer
func resolve(_root := 0) -> void:
	played["resolve"] = played.get("resolve", 0) + 1
	solve_jingle()

## v0.8.1: the ONE "puzzle solved" jingle (cues/solve_jingle.ogg: the same motif every time). It replaces
## the per-room solve_<room> cues (two musical phrases at once would clash); the room beds step back
## 6 dB for ~2 s under it (a mix gain on the bed players: the bus layout stays static for the web).
## (v0.8.3: the duck is a pure function of the time since the jingle: it can never stick, whatever pauses)
var jingle_duck := 0.0
var _jingle_at := -100.0
func solve_jingle() -> void:
	if not ready_ok: return
	played["jingle"] = played.get("jingle", 0) + 1
	cue("solve_jingle", 0.0)
	_jingle_at = Time.get_ticks_msec() / 1000.0

func _jingle_duck_now() -> float:
	var e := Time.get_ticks_msec() / 1000.0 - _jingle_at
	if e < 0.0 or e > 2.9: return 0.0
	if e < 1.7: return -6.0
	return -6.0 * (0.5 + 0.5 * cos((e - 1.7) / 1.2 * PI))

## the shrine wakes: the shrine rooms' beds rise a little (the cinematic carries the music)
func swell() -> void:
	played["swell"] = played.get("swell", 0) + 1
	if _started:
		var tw := create_tween()
		tw.tween_property(self, "swell_boost", 6.0, 5.0).set_trans(Tween.TRANS_SINE)
		tw.tween_interval(10.0)
		tw.tween_property(self, "swell_boost", 0.0, 8.0).set_trans(Tween.TRANS_SINE)

## the beds step back for a cinematic (k 0..1)
func set_duck(k: float) -> void:
	duck = -16.0 * clampf(k, 0.0, 1.0)

func chord(_semis: Array, vol_db := -6.0, _spread := 0.09) -> void:
	play("bell", vol_db - 2.0, 0.8)
