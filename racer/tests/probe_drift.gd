extends Node
## Handling probe: accelerate on the start straight, then full right steer at speed. Checks drift + no roll-over.
var game: Game
var t := 0.0
func _ready() -> void:
	process_physics_priority = 100
	Game.autotest = true
	game = load("res://scenes/main.tscn").instantiate()
	add_child(game)
	game.ais.erase(game.player)
	# move the player to pole so nobody is in the way
	game.player.global_transform = game.track.grid_transform(0).translated(Vector3(0, 0, 0))
	for c in game.cars:
		if c != game.player: c.global_position += Vector3(0, 0, 60)
func _physics_process(dt: float) -> void:
	var p := game.player
	if game.state != "race": return
	t = game.state_t
	p.in_throttle = 1.0
	p.in_steer = 1.0 if t > 4.5 and t < 6.5 else 0.0
	p.in_nitro = false
	if int(t * 60) % 15 == 0 and t > 4.0:
		var lat := p.linear_velocity.dot(p.global_basis.x)
		print("t=%.2f v=%.0f km/h steer=%.1f lat=%.1f m/s yaw=%.2f up.y=%.2f drifting=%s grounded=%d" % [t, p.speed * 3.6, p.in_steer, lat, p.angular_velocity.y, p.global_basis.y.y, p.drifting, p.grounded])
	if t > 7.5: get_tree().quit()
