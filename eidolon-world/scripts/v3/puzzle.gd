class_name Puzzle
extends Node3D
## v3 (dev/CH1_V3.md §0 "puzzle contract"): the base of every Chapter I puzzle, one small file each (scripts/v3/pz/).
##   * id = its beat key (Map3 space id, e.g. "I1"); its state is one dictionary, saved under that key
##   * no fail state (or a soft return); progress LATCHES; a hint after `hint_after` s in its space without progress
##   * solve() plays the one jingle, saves at once and calls on_solved(); apply() sets the world from the state
##     (load, jumps, tests); autosolve() solves it the way a player would where that is cheap (tests/pz_test)
## Lifecycle (Ch1v3): setup(game) -> build() (geometry, interacts, gates: before Level.commit) -> post() (after it) ->
## load_state(saved) -> update(dt) every frame.

signal solved(id: String)
signal progressed(id: String)
signal hinted(id: String)

var id := ""
var space := ""
var game: Game
var done := false
var state := {}
var hint_after := 45.0
var idle_t := 0.0
var hint_given := false
var gates: Array = []           # [Gate]: closed doorways this puzzle opens

## a doorway shut by a block (walk-blocking obstacle + a stone leaf that sinks when it opens)
class Gate:
	var ob: Level.Obstacle
	var mi: MeshInstance3D
	var open := false
	var k := 0.0

func setup(g: Game) -> void:
	game = g
	if space == "": space = id
	name = "Pz_" + id
	build()

# ---------------------------------------------------------------- the virtuals
func build() -> void: pass
func post() -> void: pass
func tick(_dt: float) -> void: pass
func on_solved() -> void: pass
func hint() -> void: pass
func apply() -> void:
	for g in gates: _set_gate(g, done, true)
func autosolve() -> void: solve()

# ---------------------------------------------------------------- the contract
func update(dt: float) -> void:
	for g in gates: _gate_anim(g, dt)
	if not done and here():
		idle_t += dt
		if idle_t > hint_after and not hint_given:
			hint_given = true
			hint()
			hinted.emit(id)
	tick(dt)

func progress() -> void:
	idle_t = 0.0
	progressed.emit(id)

func solve() -> void:
	if done: return
	done = true
	state["done"] = true
	idle_t = 0.0
	for g in gates: _set_gate(g, true, false)
	if game.sfx and game.sfx.has_method("solve_jingle"): game.sfx.solve_jingle()
	on_solved()
	solved.emit(id)

func save_state() -> Dictionary:
	var d := state.duplicate(true)
	d["done"] = done
	return d

func load_state(d: Dictionary) -> void:
	state = d.duplicate(true)
	done = bool(state.get("done", false))
	apply()

func reset() -> void:
	load_state({})

## the player stands in this puzzle's space
func here() -> bool:
	var p := game.player.position
	var g := game.level.region_at(Vector2(p.x, p.z))
	return g != null and Map3.key_of_region(g.name).get_slice("~", 0) == space

# ---------------------------------------------------------------- helpers
## shut the doorway between two linked spaces until this puzzle is solved
func gate(a: String, b: String) -> Gate:
	var d := Map3.door(a, b)
	assert(not d.is_empty(), "no door %s-%s" % [a, b])
	var c: Vector2 = d["c"]
	var n: Vector2 = d["n"]
	var al: Vector2 = d["along"]
	var w: float = d["w"]
	var g := Gate.new()
	var sz := (n * 0.5 + al * w).abs()
	g.ob = game.level.ob_rect(Rect2(c - sz * 0.5, sz), "gate_%s_%s" % [a, b])
	var y := maxf(Map3.height(a, c - n * 0.8), Map3.height(b, c + n * 0.8))
	var bm := BoxMesh.new()
	bm.size = Vector3(maxf(sz.x, 0.3), 2.2, maxf(sz.y, 0.3))
	var m := StandardMaterial3D.new()
	m.albedo_color = Color(0.32, 0.27, 0.22)
	m.roughness = 0.6
	m.metallic = 0.4
	g.mi = MeshInstance3D.new()
	g.mi.mesh = bm
	g.mi.material_override = m
	g.mi.position = Vector3(c.x, y + 1.1, c.y)
	g.mi.set_meta("base_y", y + 1.1)
	add_child(g.mi)
	gates.append(g)
	return g

func _set_gate(g: Gate, open: bool, snap: bool) -> void:
	g.open = open
	g.ob.enabled = not open
	if snap:
		g.k = 1.0 if open else 0.0
		_gate_anim(g, 0.0)

func _gate_anim(g: Gate, dt: float) -> void:
	var want := 1.0 if g.open else 0.0
	if g.k == want and dt > 0.0: return
	g.k = move_toward(g.k, want, dt / 1.6)
	var k := Cinematic.ease_k(g.k, 1)
	g.mi.position.y = float(g.mi.get_meta("base_y")) - k * 2.25
	g.mi.visible = g.k < 0.999

## the player is within `r` m of a point (on the ground plane)
func near(p: Vector3, r: float) -> bool:
	var q := game.player.position
	return Vector2(q.x - p.x, q.z - p.z).length() < r
