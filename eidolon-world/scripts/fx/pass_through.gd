class_name PassThrough
## v2.0 (Agent A) the world law "only still water and cracked glass let things pass between the worlds"
## (EIDOLON_SCRIPT §1): a thing pushed up through still water, or out through a mirror crack, from HER side.
## One call each; the item node is yours (already in the scene, where it should end up); this animates it in from
## the other side and dresses the crossing. Returns the root effect node (it frees itself; the crack can stay).
##
##   PassThrough.water(parent, surface_pos, item, water_fx, rise := 0.45, seconds := 1.8)
##       the lamp in the crypt basin, the comb in the prologue (comb: rise 0.0 = it pops up and drops back to rest
##       on the rim: pass `land` to set where it lands): the surface bulges, caustic light under it, the item breaks
##       through (meniscus pop, a ring, droplets), drips run off it, a glint
##   PassThrough.mirror(parent, glass_pos, glass_normal, item, seconds := 1.6, keep_crack := true)
##       the Shard through the crack of the great mirror: a crack star spreads, a glint runs round it, the item slides
##       out of the glass with a few silver sparkles; the crack stays (keep_crack) as the mirror's own scar
## Low tier: fewer droplets / sparkles (FxBurst), the same timing.

static func water(parent: Node, pos: Vector3, item: Node3D, water_fx: Object = null, rise := 0.45, seconds := 1.8, land := Vector3.INF) -> Node3D:
	var root := Node3D.new()
	root.name = "PassThroughWater"
	parent.add_child(root)
	root.global_position = pos
	# caustic light under the surface, swelling as it comes
	var cau := OmenFx.decal(root, pos + Vector3(0, 0.005, 0), OmenFx.CAUSTIC, Vector2(1.4, 1.4))
	var cm := cau.material_override as ShaderMaterial
	cm.set_shader_parameter("k", 0.0)
	# the item starts under the surface
	var end := pos + Vector3(0, rise, 0)
	if item:
		item.global_position = pos - Vector3(0, 0.3, 0)
		item.visible = true
	var t_break := seconds * 0.45
	var tw := root.create_tween()
	tw.set_parallel(true)
	tw.tween_method(func(v: float) -> void: cm.set_shader_parameter("k", v), 0.0, 1.0, t_break)
	if water_fx and water_fx.has_method("splash"):
		tw.tween_callback(func() -> void: water_fx.call("splash", pos, 0.35, 2.0))       # the bulge (a slow swell)
	if item:
		tw.tween_property(item, "global_position", pos - Vector3(0, 0.02, 0), t_break).set_trans(Tween.TRANS_SINE).set_ease(Tween.EASE_IN_OUT)
	tw.set_parallel(false)
	tw.tween_interval(t_break)
	# the break: meniscus pop, ring, droplets
	tw.tween_callback(func() -> void:
		var ring := OmenFx.decal(root, pos + Vector3(0, 0.007, 0), OmenFx.RING, Vector2(1.0, 1.0))
		var rm := ring.material_override as ShaderMaterial
		var t2 := ring.create_tween()
		t2.tween_method(func(v: float) -> void: rm.set_shader_parameter("grow", v), 0.1, 1.0, 0.8).set_ease(Tween.EASE_OUT)
		t2.tween_callback(ring.queue_free)
		FxBurst.footstep(root, pos + Vector3(0, 0.01, 0), water_fx)
		FxBurst.splash(root, pos + Vector3(0, 0.01, 0), 0.45))
	if item:
		var up := item.create_tween()
		up.tween_interval(t_break)
		up.tween_property(item, "global_position", end, seconds - t_break).set_trans(Tween.TRANS_QUAD).set_ease(Tween.EASE_OUT)
		if land != Vector3.INF:
			up.tween_property(item, "global_position", land, 0.5).set_trans(Tween.TRANS_QUAD).set_ease(Tween.EASE_IN)
			up.tween_callback(func() -> void: FxBurst.footstep(root, land + Vector3(0, 0.01, 0), null))
		# drips running off it once it is out
		for i in 3:
			up.tween_callback(func() -> void: if is_instance_valid(item): FxBurst.drip_off(root, item.global_position))
			up.tween_interval(0.35)
		up.tween_callback(func() -> void:
			if is_instance_valid(item):
				var g := FxBurst.glints(root, Vector3.ZERO)
				g.global_position = item.global_position + Vector3(0, 0.05, 0)
				g.get_tree().create_timer(1.6).timeout.connect(g.stop))
	tw.tween_method(func(v: float) -> void: cm.set_shader_parameter("k", v), 1.0, 0.0, 1.4)
	tw.tween_interval(2.5)
	tw.tween_callback(root.queue_free)
	return root

static func mirror(parent: Node, pos: Vector3, normal: Vector3, item: Node3D, seconds := 1.6, keep_crack := true, crack_size := 1.2) -> Node3D:
	var n := normal.normalized()
	var root := Node3D.new()
	root.name = "PassThroughMirror"
	parent.add_child(root)
	root.global_position = pos
	var crack := OmenFx.decal(parent if keep_crack else root, pos + n * 0.05, OmenFx.CRACK, Vector2(crack_size, crack_size), n)
	var km := crack.material_override as ShaderMaterial
	km.set_shader_parameter("grow", 0.0)
	var tw := root.create_tween()
	tw.tween_method(func(v: float) -> void: km.set_shader_parameter("grow", v), 0.0, 1.0, seconds * 0.35).set_trans(Tween.TRANS_EXPO).set_ease(Tween.EASE_OUT)
	if item:
		var end := item.global_position if item.is_inside_tree() else pos + n * 0.45
		item.global_position = pos - n * 0.15
		item.visible = true
		var it := item.create_tween()
		it.tween_interval(seconds * 0.3)
		it.tween_property(item, "global_position", end, seconds * 0.7).set_trans(Tween.TRANS_SINE).set_ease(Tween.EASE_OUT)
	tw.tween_callback(func() -> void:
		var s := FxBurst.shards(root, pos + n * 0.08, n))
	tw.tween_interval(seconds)
	if keep_crack:
		# the crack settles: the glint keeps running, a little dimmer
		tw.tween_method(func(v: float) -> void: km.set_shader_parameter("k", v), 1.0, 0.55, 1.0)
	else:
		tw.tween_method(func(v: float) -> void: km.set_shader_parameter("k", v), 1.0, 0.0, 1.0)
	tw.tween_interval(1.5)
	tw.tween_callback(root.queue_free)
	return root
