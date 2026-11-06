class_name Life
extends Node3D
## v1.0 M3c (dev/V1_WORLD.md 5): the living world between the puzzles.
##  * Her presence: in a reflection, when you stand still near something hidden (a tablet, a memory shard),
##    she turns her head toward it (the reflections' gaze, aimed at secrets); on still water, if you wait by
##    it, she writes a single rune that fades.
##  * Ambient life (A's AmbientLife builders): moths at every lit flame, petals drifting in the Garden and
##    along the Balcony, drips in the crypt and on the Stair of Breath, a far bell now and then. (v2: the Balcony's
##    veils are A's balcony recipe now; the Atrium's turned head went with the old Atrium)

var game: Game
var chapter: Chapter
var _gaze_orig := {}                 # Reflector -> its own gaze target (INF for the free ones)
var _gaze_t := 0.0
# her rune on the water
const WATERS := [[Rect2(Map2.O.x - 12.75, Map2.O.z + 17.0, 8.75, 3.7), -0.41], [Rect2(Map2.O.x - 32.4, Map2.O.z - 14.6, 18.4, 13.1), -0.41],
	[Rect2(Map2.O.x - 0.5, Map2.O.z - 15.0, 6.0, 6.0), Map2.N1_WATER_Y + Map2.O.y + 0.01]]          # (v2: the Pool of Halves, the Colossus' inlet)
var rune_node: Node3D
var rune_mat: ShaderMaterial
var _rune_t := 0.0                   # >0: showing
var _rune_cool := 20.0
var runes := 0
# ambient
var moths := {}                      # Flame -> MultiMeshInstance3D
var _bell_t := 45.0
var drips: Array[Drips] = []
var veils: Array[Node3D] = []
var _gust_t := 0.0

func setup(g: Game, ch: Chapter) -> void:
	game = g
	chapter = ch
	for r in game.puzzles.reflectors: _gaze_orig[r] = r.gaze_target
	rune_node = Node3D.new()
	add_child(rune_node)
	rune_mat = game.puzzles.rune_quad(rune_node, Vector3.ZERO, Vector2(0.55, 0.55), Basis(Vector3.RIGHT, -PI * 0.5), 9.0, 0.0)
	rune_node.visible = false
	_build_ambient()
	# (QA P1-15: ambient life is for the camera only: the mirrors' cameras skip it)
	for c in find_children("*", "GeometryInstance3D", true, false):
		(c as GeometryInstance3D).layers = PlanarMirror.LAYER_MAIN_FX
	for f in moths: (moths[f] as GeometryInstance3D).layers = PlanarMirror.LAYER_MAIN_FX

func _build_ambient() -> void:
	for f in Flame.all:
		# (only this game's own flames: a reload builds the new game while the old one is still queued for
		# deletion, and its flames are still listed: moths on them were freed under us)
		if not is_instance_valid(f) or f.is_queued_for_deletion() or not game.is_ancestor_of(f): continue
		var mm := AmbientLife.moths(Vector3(0, f._ly + 0.25, 0), 4, 0.34)
		f.add_child(mm)
		mm.visible = false
		moths[f] = mm
	add_child(AmbientLife.petals(AABB(Map2.GN + Vector3(10.3, 1.0, -15.0), Vector3(6.7, 3.2, 10.0)), 50))
	add_child(AmbientLife.petals(AABB(Map2.O + Vector3(17.2, 2.0, -25.0), Vector3(3.6, 3.0, 22.0)), 70, Vector3(-0.3, 0.0, -1.2), 0.1))
	# drips on the Stair of Breath's landing, and in the crypt where she woke the lamp (v2: in the new world)
	var st := AmbientLife.drips([Map2.GW + Vector3(-12.1, 0.51, -5.6), Map2.GW + Vector3(-10.5, 0.51, -5.0)], 2.6, 2.2, 4.0)
	add_child(st)
	var cr := AmbientLife.drips([Map2.w(11.2, 0.6, 0.01), Map2.w(13.9, 5.6, 0.01)], 2.5, 2.4, 4.5)
	add_child(cr)
	drips = [st, cr]
	for d in drips: d.splash.connect(func(p: Vector3) -> void:
		if game.player.position.distance_to(p) < 9.0: game.sfx.play("step_wet", -30.0, 1.6))

# ------------------------------------------------------------------ her presence
func _secrets_near(p: Vector3) -> Vector3:
	var best := Vector3.INF
	var bd := 8.0
	var inv: Dictionary = chapter.state["inv"]
	for t in Items.TABLETS:
		if t[0] in (inv["tablets"] as Array): continue
		var d := p.distance_to(t[1])
		if d < bd: bd = d; best = t[1]
	for s in Items.SECRETS:
		if s[0] in (inv["mem"] as Array): continue
		var d2 := p.distance_to(s[1])
		if d2 < bd: bd = d2; best = s[1]
	return best

func _update_gaze(dt: float) -> void:
	_gaze_t -= dt
	if _gaze_t > 0.0: return
	_gaze_t = 0.5
	var t := _secrets_near(game.player.position)
	for r in _gaze_orig:
		if _gaze_orig[r] != Vector3.INF: continue          # (a puzzle's own gaze stays its own)
		(r as Reflector).gaze_target = t

func _update_rune(dt: float) -> void:
	if _rune_t > 0.0:
		_rune_t -= dt
		var k := clampf(minf((5.5 - _rune_t) / 1.4, _rune_t / 1.8), 0.0, 1.0)
		rune_mat.set_shader_parameter("lit", k)
		if _rune_t <= 0.0: rune_node.visible = false
		return
	if game.mode != "play": return           # (v2.0: her runes wait while a cinematic plays: the prologue is not a pause by still water)
	_rune_cool -= dt
	var pl := game.player
	if _rune_cool > 0.0 or game.mode != "play" or pl.still_time < 3.0: return
	var p := pl.position
	for w in WATERS:
		var r: Rect2 = w[0]
		var inner := r.grow(-0.6)
		var q := Vector2(clampf(p.x, inner.position.x, inner.end.x), clampf(p.z, inner.position.y, inner.end.y))
		if r.has_point(Vector2(p.x, p.z)):
			q = Vector2(p.x, p.z) + Vector2(0.75, 0.75)          # (standing in it, on a stone: beside you, toward the camera's right)
		if q.distance_to(Vector2(p.x, p.z)) > 2.6: continue
		if game.level.region_at(q) != null and not r.has_point(Vector2(p.x, p.z)): continue      # (only on open water)
		rune_node.position = Vector3(q.x, float(w[1]) + 0.012, q.y)
		rune_mat.set_shader_parameter("design", float(1 + runes % 8))
		rune_node.visible = true
		_rune_t = 5.5
		_rune_cool = 75.0
		runes += 1
		chapter.event.emit("her_rune", null)
		return

# ------------------------------------------------------------------ ambient
## (v1.1 A) embers rising off every lit brazier near you; low mist wisps in the Maze, over the lake by the
## Colonnade and in the Undercroft
var embers := {}                     # Flame -> FxBurst
var wisps: Array = []
const WISPS := [[Map2.GN + Vector3(13.0, 2.05, -34.0), 3.0], [Map2.O + Vector3(-2.5, 0.2, 11.5), 2.5], [Map2.O + Vector3(19.0, 0.3, 9.0), 2.0]]
func _update_embers() -> void:
	var p := game.player.position
	if wisps.is_empty():
		for w in WISPS:
			var m := FxBurst.mist(self, w[0], w[1])
			m.layers = PlanarMirror.LAYER_MAIN_FX
			wisps.append(m)
	for f in Flame.all:
		if not is_instance_valid(f) or not game.is_ancestor_of(f): continue
		if f._ly < 0.2: continue                      # (the hand lamp and the votive: no embers)
		var want: bool = f.level() > 0.3 and f.global_position.distance_to(p) < 12.0
		if want and not embers.has(f):
			var e := FxBurst.embers(self, f.global_position + Vector3(0, 0.3, 0))
			e.layers = PlanarMirror.LAYER_MAIN_FX
			embers[f] = e
		elif not want and embers.has(f):
			if is_instance_valid(embers[f]): (embers[f] as FxBurst).stop()
			embers.erase(f)

func _update_ambient(dt: float) -> void:
	if Engine.get_process_frames() % 20 == 0: _update_embers()
	if Engine.get_process_frames() % 15 == 0:
		var p := game.player.position
		for f in moths.keys():
			if not is_instance_valid(f) or not is_instance_valid(moths[f]):
				moths.erase(f)
				continue
			var fl: Flame = f
			(moths[f] as Node3D).visible = fl.level() > 0.3 and fl.global_position.distance_to(p) < 18.0
	_gust_t += dt
	var g := clampf(pow(maxf(sin(_gust_t * 0.37) * sin(_gust_t * 0.11 + 1.0), 0.0), 2.0) * 1.4, 0.0, 1.0)      # (slow, uneven gusts)
	for v in veils: AmbientLife.set_gust(v, g)
	_bell_t -= dt
	if _bell_t <= 0.0:
		_bell_t = randf_range(50.0, 110.0)
		if game.mode == "play": game.sfx.play("bell", -32.0, randf_range(0.55, 0.7))

func update(dt: float) -> void:
	_update_gaze(dt)
	_update_rune(dt)
	_update_ambient(dt)

func apply_state() -> void:
	rune_node.visible = false
	_rune_t = 0.0
