extends Node
## Physics probe: player drives straight on the start straight (gas 4 s, then nitro), prints speed.
var game: Game
var t := 0.0
func _ready() -> void:
	process_physics_priority = 100
	Game.autotest = true
	game = load("res://scenes/main.tscn").instantiate()
	add_child(game)
	game.ais.erase(game.player)
	game.autopilot = false
func _physics_process(dt: float) -> void:
	t += dt
	var p := game.player
	p.in_steer = 0.0
	p.in_throttle = 1.0
	p.in_nitro = game.state == "race" and game.state_t > 6.0
	if game.state == "race" and int(t * 60) % 30 == 0:
		print("t=%.1f v=%.1f km/h nitro_on=%s nitro=%.2f grounded=%d road=%s y=%.2f " % [game.state_t, p.speed * 3.6, p.nitro_on, p.nitro, p.grounded, p.on_road, p.global_position.y])
	if game.state == "race" and game.state_t > 11.0: get_tree().quit()
