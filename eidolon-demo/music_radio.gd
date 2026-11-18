extends Node
## The music, kept outside the levels (the owner, 18/11: "the music continuous through the levels, and the track
## changing when it ends"). A child of the tree's root, it goes on while one level gives way to the next (the scene is
## reloaded under it). A piece of the levels' list is not looped: when it ends, after a breath, the next piece of the
## list begins. Any other piece (the theme of the film and the start screen, the other levels' own) loops as before.
## In a browser a piece is decoded whole the first time it plays, the picture stopping meanwhile: the game makes the
## pieces ready at a quiet moment, and they are kept here, so a level that follows another decodes no music.

const LIST := ["res://music/lament.ogg", "res://music/lastlight.ogg"]      # (the waking's levels' pieces, in their order)
const BREATH := 1.2      # (the silence between one piece's end and the next one's start)

var cur: AudioStreamPlayer
var listed := false      # (a piece of the list is playing, or the next is about to begin)
var at := 0
var vol := -5.0
var streams := {}

func stream(file: String) -> AudioStream:
	if not streams.has(file):
		var st: AudioStream = load(file) if ResourceLoader.exists(file) else null
		if st is AudioStreamOggVorbis: (st as AudioStreamOggVorbis).loop = not LIST.has(file)      # (set before it is made ready: a browser keeps it as it was then)
		streams[file] = st
	return streams[file]

func play(file: String, fade: float, db: float) -> void:
	var st := stream(file)
	if st == null: return
	if not is_inside_tree(): await tree_entered
	listed = LIST.has(file)
	if listed: at = LIST.find(file); vol = db
	var old := cur
	var from := 0.0
	if OS.get_environment("IV_MUSIC_END") != "": from = maxf(0.0, st.get_length() - float(OS.get_environment("IV_MUSIC_END")))      # (a trial: each piece from that many seconds before its end)
	var p := AudioStreamPlayer.new(); add_child(p); p.stream = st; p.volume_db = -40.0; p.play(from)
	create_tween().tween_property(p, "volume_db", db, fade).set_trans(Tween.TRANS_SINE).set_ease(Tween.EASE_OUT)
	if old != null:
		var t := create_tween(); t.tween_property(old, "volume_db", -50.0, fade).set_trans(Tween.TRANS_SINE); t.tween_callback(old.queue_free)
	cur = p
	p.finished.connect(_ended.bind(p))
	if OS.get_environment("IV_SFX_LOG") != "": print("MUSIC ", file.get_file(), " from ", snappedf(from, 0.1), " listed ", listed)

func _ended(p: AudioStreamPlayer) -> void:      # (a piece of the list has ended: after a breath the next one)
	if p != cur or not listed: return
	p.queue_free(); cur = null
	await get_tree().create_timer(BREATH).timeout
	if not listed or cur != null: return
	for k in LIST.size():
		var nx := String(LIST[(at + 1 + k) % LIST.size()])
		if ResourceLoader.exists(nx):
			print("MUSIC next piece ", nx.get_file())
			play(nx, 2.0, vol); return

func out(fade: float) -> void:      # (the end of the game: the music goes)
	listed = false
	if cur == null: return
	var old := cur; cur = null
	var t := create_tween(); t.tween_property(old, "volume_db", -50.0, fade).set_trans(Tween.TRANS_SINE); t.tween_callback(old.queue_free)

func drop(file: String) -> void:      # (a piece not to be heard again for a long while let go: once nothing holds it, a browser frees its decoded sound)
	if not streams.has(file) or (cur != null and cur.stream == streams[file]): return
	streams.erase(file)
