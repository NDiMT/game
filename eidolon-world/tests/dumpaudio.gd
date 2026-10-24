extends SceneTree
## dev: render every synthesised v0.2 stream to WAV for analysis
func _init() -> void:
	var s := Sfx.new()
	root.add_child(s)
	s.build()
	var out := OS.get_cmdline_user_args()[0]
	for k in s.streams.keys():
		var w: AudioStreamWAV = s.streams[k]
		w.save_to_wav(out + "/" + k + ".wav")
	print("dumped ", s.streams.size())
	quit()
