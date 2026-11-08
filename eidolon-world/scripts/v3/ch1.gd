class_name Ch1v3
extends Node3D
## v3: Chapter I's beats, one small script each (scripts/v3/pz/pz_<id>.gd, extends Puzzle; the between beats and the
## story spaces too: they use the same state, save and hint). Builds them, runs them, saves them (one key each) and
## hands their events to the game. Add a beat: one line in REGISTRY.

const REGISTRY := {
	"WS": preload("res://scripts/v3/pz/pz_ws.gd"),
	"I1": preload("res://scripts/v3/pz/pz_i1.gd"),
	"I2": preload("res://scripts/v3/pz/pz_i2.gd"),
	"I3": preload("res://scripts/v3/pz/pz_i3.gd"),
	"IB1": preload("res://scripts/v3/pz/pz_ib1.gd"),
	"I4": preload("res://scripts/v3/pz/pz_i4.gd"),
	"I5": preload("res://scripts/v3/pz/pz_i5.gd"),
	"A": preload("res://scripts/v3/pz/pz_a.gd"),
	"WR": preload("res://scripts/v3/pz/pz_wr.gd"),
	"W1": preload("res://scripts/v3/pz/pz_w1.gd"),
	"W2": preload("res://scripts/v3/pz/pz_w2.gd"),
	"W3": preload("res://scripts/v3/pz/pz_w3.gd"),
	"W4": preload("res://scripts/v3/pz/pz_w4.gd"),
	"W5": preload("res://scripts/v3/pz/pz_w5.gd"),
	"IBW": preload("res://scripts/v3/pz/pz_ibw.gd"),
	"W6": preload("res://scripts/v3/pz/pz_w6.gd"),
	"WB": preload("res://scripts/v3/pz/pz_wb.gd"),
	"W7": preload("res://scripts/v3/pz/pz_w7.gd"),
	"N1": preload("res://scripts/v3/pz/pz_n1.gd"),
	"NG": preload("res://scripts/v3/pz/pz_ng.gd"),
	"N2": preload("res://scripts/v3/pz/pz_n2.gd"),
	"N3": preload("res://scripts/v3/pz/pz_n3.gd"),
	"N4": preload("res://scripts/v3/pz/pz_n4.gd"),
	"IBN": preload("res://scripts/v3/pz/pz_ibn.gd"),
	"N5": preload("res://scripts/v3/pz/pz_n5.gd"),
	"N6": preload("res://scripts/v3/pz/pz_n6.gd"),
	"N7": preload("res://scripts/v3/pz/pz_n7.gd"),
	"NB": preload("res://scripts/v3/pz/pz_nb.gd"),
}

var game: Game
var pz := {}                     # id -> Puzzle
var reflectors: Array[Reflector] = []
var visited := {}                # space ids she has stood in (area titles once)

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

## the glass close-up (GlassTalk) was answered: the beat that opened it takes it
func glass_solved(id: String) -> void:
	for k in pz:
		if pz[k].has_method("on_glass"): pz[k].call("on_glass", id)
