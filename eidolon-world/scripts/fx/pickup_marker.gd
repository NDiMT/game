class_name PickupMarker
extends Node3D
## v1.1 (Agent A) makes a floor pickup easy to see: a soft pillar of light, a soft pool under it, a few twinkles,
## and (optionally) the object's bed: an old linen cloth or a small marble offering pedestal (assets/models/props/
## kit_pickup_cloth.glb / kit_pickup_plinth.glb, drawn with the marble shader like the other props).
##   var pm := PickupMarker.new(); pm.bed = "cloth"; add_child(pm); pm.global_position = item_pos
##   pm.take()                      fades it out and frees it (call when the item is picked up)
## Low tier (PickupMarker.high = false): no twinkles; pillar and pool stay (2 cheap additive quads).
static var high := true

@export var bed := ""               # "", "cloth" or "plinth"
@export var height := 1.6
var bed_mat: Material = null        # e.g. level.marble_mat (else a plain matte)
var _mats: Array[ShaderMaterial] = []
var _glints: FxBurst
var _k := 0.0
var _taking := false

func _ready() -> void:
	for part in [0.0, 1.0]:
		var m := ShaderMaterial.new()
		m.shader = preload("res://shaders/pickup_glow.gdshader")
		m.set_shader_parameter("part", part)
		m.set_shader_parameter("height", height)
		m.set_shader_parameter("k", 0.0)
		var mi := MeshInstance3D.new()
		if part < 0.5:
			var q := QuadMesh.new(); q.size = Vector2.ONE; mi.mesh = q
			mi.custom_aabb = AABB(Vector3(-0.5, 0, -0.5), Vector3(1, height, 1))
		else:
			var pm := PlaneMesh.new(); pm.size = Vector2(1.1, 1.1); mi.mesh = pm
			mi.position.y = 0.012
		mi.material_override = m
		mi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
		add_child(mi)
		_mats.append(m)
	if bed != "":
		var res := Props._mesh("kit_pickup_" + bed)
		if not res.is_empty():
			var b := MeshInstance3D.new()
			b.mesh = res[0]
			if bed_mat: b.material_override = bed_mat
			add_child(b)
	if high:
		_glints = FxBurst.glints(self, Vector3.ZERO)
		_glints.position = Vector3(0, 0.35 if bed != "plinth" else 0.75, 0)

func take() -> void:
	_taking = true
	if _glints: _glints.stop()

func _process(dt: float) -> void:
	_k = move_toward(_k, 0.0 if _taking else 1.0, dt * (1.5 if _taking else 0.8))
	for m in _mats: m.set_shader_parameter("k", _k)
	if _taking and _k <= 0.0: queue_free()
