class_name Ch1v3
extends Node3D
## v3: Chapter I's puzzles, one small script each (scripts/v3/pz/pz_<id>.gd, extends Puzzle). Builds them, runs them,
## saves them (one key each) and hands their events to the game. Add a puzzle: one line in REGISTRY.

const REGISTRY := {
	"I1": preload("res://scripts/v3/pz/pz_i1.gd"),
}

var game: Game
var pz := {}                     # id -> Puzzle
var reflectors: Array[Reflector] = []

func _init(g: Game) -> void:
	game = g
	name = "Ch1v3"

## before Level.commit: each puzzle builds its geometry, interacts and gates
func build() -> void:
	for id in REGISTRY:
		var p: Puzzle = (REGISTRY[id] as GDScript).new()
		p.id = id
		add_child(p)
		p.setup(game)
		pz[id] = p

## after Level.commit
func post() -> void:
	for id in pz: (pz[id] as Puzzle).post()

func update(dt: float) -> void:
	for id in pz: (pz[id] as Puzzle).update(dt)

func save_state() -> Dictionary:
	var d := {}
	for id in pz: d[id] = (pz[id] as Puzzle).save_state()
	return d

func load_state(d: Dictionary) -> void:
	for id in pz: (pz[id] as Puzzle).load_state(d.get(id, {}))

func add_refl(r: Reflector) -> void:
	reflectors.append(r)
