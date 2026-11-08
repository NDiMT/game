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
var jingle := true              # (between beats and story spaces: no solve jingle)
var test_s := 30.0              # (tests/pz_test) how long its autosolve may take

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
	if jingle and game.sfx and game.sfx.has_method("solve_jingle"): game.sfx.solve_jingle()
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
## (phase 4: from Game3.space, found once a frame, not one region search per beat per frame)
func here() -> bool:
	var sp: Variant = game.get("space")
	if sp is String: return (sp as String).get_slice("~", 0) == space
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
	if game.level.region_at(c) != null: y = game.level.height_at(c)          # (on a stair's head: the doorway's own floor)
	# a carved marble leaf (a panel framed by a raised border), sunk into the floor when it opens
	var mb := MB.new()
	var along_x := absf(al.x) > 0.5
	var th := Vector3(w - 0.16 if along_x else 0.3, 2.2, 0.3 if along_x else w - 0.16)        # (a hair inside the wall ends)
	mb.box(Vector3.ZERO, th, Color(0.5, 0.25, 0.0))
	var face := th + (Vector3(-0.03, 0, 0.06) if along_x else Vector3(0.06, 0, -0.03))          # (its ends inside the leaf's: no shared face)
	face.y = 0.12
	for yy in [-1.0, 1.0]: mb.box(Vector3(0, yy * 1.0, 0), face, Color(0.5, 0.5, 0.0))
	g.mi = Kit3.marble(game, mb.commit(), self)
	g.mi.position = Vector3(c.x, y + 1.1, c.y)
	g.mi.set_meta("base_y", y + 1.1)
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
