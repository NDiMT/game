class_name Items
extends Node3D
## v1.0 M3b (dev/V1_WORLD.md 4): the satchel's things and where they matter. Each wing asks for ONE item on
## its critical path, found earlier in that same wing, so no wing order can lock you out:
##   West   the Shard's lens shows the sign on the reliquary in the west court; Theron's Chisel (left by her
##          statue when the Shadow Chamber is solved) breaks it: the Glass Wing's seal is inside.
##   North  the Amphora (by the Garden's east rail), filled at her pool beside the Mist Maze, poured on
##          the dry ring at the maze's end: the puddle mirrors a sign carved overhead; the Veil Seal rises.
##   East   the Bronze Tuning Pin (on the stele at the Balcony's end, by the Ledge) rings the sealed panel
##          across the Mirror Walk open, before the lift down to the Scales.
## Optional: eight wax tablets (Theron's notes) and seven memory shards in places only an item opens.
## State: chapter.state["inv"] (items, tablets, mem, amph_full) and chapter.state["hub"] (w_seen, w_broken,
## n_poured, e_open, secrets).

const NAME := {
	"lamp": "The Oil Lamp", "shard": "The Shard", "chisel": "Theron's Chisel", "amphora": "The Amphora",
	"pin": "Bronze Tuning Pin", "tablet": "Wax Tablets", "mem": "Memory Shards", "seal": "Veil Seals"}
const LINE := {
	"lamp": "A clay lamp from his bench. Its small fire parts the dark.",
	"shard": "A piece of her mirror. Held up, it shows what the stone keeps hidden.",
	"chisel": "His. Its edge still knows where marble wants to break.",
	"amphora": "Empty. Water carried in it lies still enough to mirror.",
	"amphora_full": "Full of still water. Pour it where the floor is dry and marked.",
	"pin": "Struck, it sings one note. Sealed things that know the note answer.",
	"tablet": "Theron's notes, scratched in wax.",
	"mem": "Moments she kept. Each one warm in the hand.",
	"seal": "One for each wing. The Gate has three empty hands."}
const ICON := {"lamp": "oil_lamp", "shard": "shard", "chisel": "chisel", "amphora": "amphora", "pin": "tuning_pin",
	"tablet": "wax_tablet", "mem": "memory_shard", "seal": "veil_seal"}
const ORDER := ["lamp", "shard", "chisel", "amphora", "pin", "tablet", "mem", "seal"]

# the places
const CHISEL_POS := Vector3(8.9, 1.0, -12.7)              # by her statue, in the Shadow Chamber
const RELIC_POS := Vector3(9.55, 1.0, -8.95)                # the reliquary, west court (the W seal inside)
const AMPH_POS := Vector3(16.35, 1.0, -9.6)                 # the Garden's east rail, by the door
const FILL_POS := Vector3(9.35, 2.0, -36.0)                 # her pool's edge, beside the Mist Maze
const POUR_POS := Vector3(9.6, 2.0, -39.62)                 # the dry ring at the maze's end
const PUDDLE_REGION := Rect2(6.6, -42.6, 6.0, 6.0)
const STELE_POS := Vector3(29.12, 2.0, -16.0)               # the stele at the Balcony's end (the pin)
const PANEL_Z := -24.6                                      # the sealed panel across the Mirror Walk
const PANEL_X := Vector2(30.4, 32.4)

## Theron's notes: [id, where, text]
const TABLETS := [
	["t1", Vector3(-3.2, 0.5, 20.9), "A thousand faces, and none of them hers. The stone does not lie; my hands do."],
	["t2", Vector3(13.6, 3.1, 16.85), "She laughed when I asked her to stand still. 'Then carve me moving,' she said."],
	["t3", Vector3(9.5, 1.0, -13.5), "I moved the lamps until her shadow fell where I wanted. Even her shadow argued."],
	["t4", Vector3(7.6, 1.0, -8.0), "Marble first, then a thousand faces, then glass, I told the guild. They thought it a boast."],
	["t5", Vector3(12.0, 1.0, -9.6), "The garden was hers. I let it die so it would keep her shape."],
	["t6", Vector3(14.8, 2.0, -28.55), "In the maze she walked ahead of me in the water, and I followed the wrong one."],
	["t7", Vector3(32.85, 2.0, -47.2), "Balance: what I took from her against what I gave. The pans never settle."],
	["t8", Vector3(31.9, 4.0, -40.2), "If the glass holds her, the glass must be kept. I will keep it. I will keep it."]]

## memory shards: [id, where, need ("chisel" / "amphora" / "pin" / "lens"), text]
const SECRETS := [
	["m1", Vector3(-2.4, 0.5, 11.2), "chisel", "Milos, the harbour. She bought him a chisel with her first wages and would not say why."],
	["m2", Vector3(15.6, 1.0, -7.3), "chisel", "The garden in flower. She tucked a petal behind the ear of every statue."],
	["m3", Vector3(9.4, 1.0, -12.4), "amphora", "From above, the chamber floor: her shadow and his, the same length at last."],
	["m4", Vector3(33.4, 4.0, -32.0), "pin", "The spring sang back the note. She used to hum it while he worked."],
	["m5", Vector3(2.0, 0.5, 15.5), "lens", "Under the fountain's lip, in her hand: 'Look at me, not at the marble.'"],
	["m6", Vector3(27.5, 2.0, -24.5), "lens", "On the Ledge she stood at the edge and leaned on the wind, laughing at his fear."],
	["m7", Vector3(27.15, 2.0, 2.0), "pin", "On the balcony the stone rang back one word of hers. It was his name."]]

var game: Game
var chapter: Chapter
var hub: Hub
var icons := {}                       # key -> Texture2D (A's 128 px icons)
var chisel_node: Node3D
var relic_top: Node3D
var relic_rune: ShaderMaterial
var amph_node: Node3D
var pin_node: Node3D
var pour_ring: MeshInstance3D
var pour_disc: MeshInstance3D
var _glint_t := 0.0
var beacons: Array = []                # [the thing's node, its beacon]
var _bob_t := 0.0
var puddle: MeshInstance3D
var puddle_rune: ShaderMaterial
var puddle_glass: ShaderMaterial
var puddle_planar: PlanarMirror
var puddle_refl: Reflector
var panel: Node3D
var tablet_nodes := {}
var secret_nodes := {}                # id -> [Node3D lock, Node3D shard]
var _relic_hint_t := 0.0

static func fresh_inv() -> Dictionary:
	return {"items": [], "seals": [], "socketed": [], "tablets": [], "mem": [], "amph_full": false}

static func fresh_hub() -> Dictionary:
	return {"ec_open": false, "w_seen": false, "w_broken": false, "n_poured": false, "e_open": false, "secrets": [],
		"wk_crossed": false, "warden_seen": 0, "map": [], "points": []}        # (v1.0 M3c: the Warden's Walk, the map's seen regions)

func setup(g: Game, ch: Chapter, h: Hub) -> void:
	game = g
	chapter = ch
	hub = h
	for k in ICON:
		var p := "res://assets/textures/icons/%s.png" % ICON[k]
		if ResourceLoader.exists(p): icons[k] = load(p)
	_build_chisel()
	_build_relic()
	_build_amphora()
	_build_pour()
	_build_pin()
	_build_panel()
	_build_tablets()
	_build_secrets()
	_build_pin_uses()
	# (v1.1: every thing to take reads from 8 m: a cloth under it, a soft pillar of light, a slow bob and turn)
	beacons = [[chisel_node, _beacon(CHISEL_POS, true)], [amph_node, _beacon(AMPH_POS, true)],
		[pin_node, _beacon(STELE_POS + Vector3(-0.22, 0.87, 0), false)], [hub.lamp_bench, _beacon(WorldGeo.LAMP_POS + Vector3(0, 0.44, 0), false)]]

func inv() -> Dictionary: return chapter.state["inv"]
func hs() -> Dictionary: return chapter.state["hub"]
func has(k: String) -> bool: return hub.has_item(k)

## a carried thing's model (A's glb), or a plain marble stand-in
func _model(file: String, parent: Node3D, fallback: Callable) -> Node3D:
	var p := "res://assets/models/items/item_%s.glb" % file
	if ResourceLoader.exists(p):
		var n: Node3D = (load(p) as PackedScene).instantiate()
		parent.add_child(n)
		for c in n.find_children("*", "GeometryInstance3D", true, false):
			(c as GeometryInstance3D).cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
		return n
	var n2 := Node3D.new()
	parent.add_child(n2)
	var m := MB.new()
	fallback.call(m)
	game.puzzles.marble_instance(m.commit(), n2)
	return n2

func _anchor(at: Vector3, yaw := 0.0) -> Node3D:
	var n := Node3D.new()
	n.position = at
	n.rotation.y = yaw
	add_child(n)
	return n

func _lens_rune(parent: Node3D, xf: Transform3D, size: Vector2, design: float) -> ShaderMaterial:
	var m := ShaderMaterial.new()
	m.shader = preload("res://shaders/lens_only.gdshader")
	m.set_shader_parameter("noise_tex", game.level.noise_tex)
	m.set_shader_parameter("kind", 0.0)
	m.set_shader_parameter("design", design)
	var q := QuadMesh.new()
	q.size = size
	var mi := MeshInstance3D.new()
	mi.mesh = q
	mi.material_override = m
	mi.transform = xf
	mi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	parent.add_child(mi)
	return m

## a pickup's beacon: a crimson cloth on the floor (for things lying there), a soft warm pillar of light
## and a glow round it
func _beacon(at: Vector3, cloth: bool) -> Node3D:
	var n := Node3D.new()
	n.position = at
	add_child(n)
	if cloth:
		var cm := StandardMaterial3D.new()
		cm.albedo_color = Color(0.42, 0.07, 0.08)
		cm.roughness = 0.95
		var cy := CylinderMesh.new()
		cy.top_radius = 0.34; cy.bottom_radius = 0.36; cy.height = 0.02; cy.radial_segments = 20
		var ci := MeshInstance3D.new()
		ci.mesh = cy
		ci.material_override = cm
		ci.position.y = 0.012
		ci.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
		n.add_child(ci)
	var g := Gradient.new()
	g.set_color(0, Color(1, 1, 1, 0.0))
	g.set_color(1, Color(1, 1, 1, 0.42))
	var gt := GradientTexture2D.new()
	gt.gradient = g
	gt.fill_from = Vector2(0, 0); gt.fill_to = Vector2(0, 1)
	gt.width = 4; gt.height = 64
	var bm := StandardMaterial3D.new()
	bm.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	bm.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	bm.blend_mode = BaseMaterial3D.BLEND_MODE_ADD
	bm.cull_mode = BaseMaterial3D.CULL_DISABLED
	bm.no_depth_test = false
	bm.albedo_texture = gt
	bm.albedo_color = Color(1.0, 0.86, 0.66)
	var beam := CylinderMesh.new()
	beam.top_radius = 0.16; beam.bottom_radius = 0.26; beam.height = 2.4; beam.radial_segments = 14
	beam.cap_top = false; beam.cap_bottom = false
	var bi := MeshInstance3D.new()
	bi.mesh = beam
	bi.material_override = bm
	bi.position.y = 1.2
	bi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	bi.layers = PlanarMirror.LAYER_MAIN_FX
	n.add_child(bi)
	game.puzzles.glow_quad(n, Vector3(0, 0.35, 0), 0.8, Color(1.0, 0.85, 0.6), 0.55)
	return n

func _toast(k: String, extra := "") -> void:
	if game.ui.has_method("show_item"): game.ui.show_item(k, extra)

# ------------------------------------------------------------------ West: the chisel and the reliquary
func _build_chisel() -> void:
	chisel_node = _anchor(CHISEL_POS + Vector3(0, 0.03, 0), 0.6)
	var m := _model("chisel", chisel_node, func(mb: MB) -> void: mb.box(Vector3(0, 0.13, 0), Vector3(0.04, 0.26, 0.04), Color(0.5, WorldGeo.BRONZE, 0.0)))
	m.rotation.x = PI * 0.5                    # (lying on the floor)
	m.position = Vector3(0, 0.0, 0.13)
	chisel_node.visible = false
	game.level.add_interact("chisel_take", CHISEL_POS, "take", func() -> void:
		hub.give("chisel")
		chisel_node.visible = false
		_toast("chisel")
		if game.juice: game.juice.glint(CHISEL_POS + Vector3(0, 0.3, 0)), 1.0,
		func() -> bool: return chapter.state["gallery"] and not has("chisel"))

func _build_relic() -> void:
	var base := _anchor(RELIC_POS)
	var m := MB.new()
	m.box(Vector3(0, 0.12, 0), Vector3(0.78, 0.24, 0.62), Color(0.5, 0.25, 0.0))          # (its plinth stays)
	game.puzzles.marble_instance(m.commit(), base)
	relic_top = _anchor(RELIC_POS)
	var t := MB.new()
	t.box(Vector3(0, 0.24 + 0.5, 0), Vector3(0.7, 1.0, 0.56), Color(0.5, 0.25, 0.0))
	t.box(Vector3(0, 0.24 + 1.04, 0), Vector3(0.8, 0.08, 0.6), Color(0.5, 0.25, 0.0))
	game.puzzles.marble_instance(t.commit(), relic_top)
	# the sign only the shard shows: on its face toward you (south)
	relic_rune = _lens_rune(relic_top, Transform3D(Basis(), Vector3(0, 0.78, 0.285)), Vector2(0.5, 0.5), 5.0)
	game.level.ob_rect(Level.R(RELIC_POS.x - 0.42, RELIC_POS.z - 0.34, RELIC_POS.x + 0.42, RELIC_POS.z + 0.34), "relic_w")
	game.level.add_interact("relic_w", RELIC_POS + Vector3(0, 0, 0.75), "push", strike_relic, 1.0,
		func() -> bool: return chapter.state["gallery"] and not hs()["w_broken"])

func strike_relic() -> void:
	if not hs()["w_seen"]:
		game.ui.show_text("Close-set stone. Something inside it answers your step.\nThe shard might show where it gives.", game.player.position, 3.5)
		return
	if not has("chisel"):
		game.ui.show_text("A sign, cut as a hairline crack.\nIt needs an edge.", game.player.position, 3.0)
		return
	break_relic(false)

func break_relic(instant: bool) -> void:
	hs()["w_broken"] = true
	if instant:
		relic_top.visible = false
		return
	chapter.event.emit("relic_break", null)
	var tw := relic_top.create_tween()
	tw.tween_property(relic_top, "position:y", RELIC_POS.y - 0.06, 0.12)
	tw.tween_property(relic_top, "scale", Vector3(1.0, 0.02, 1.0), 0.35).set_trans(Tween.TRANS_QUAD).set_ease(Tween.EASE_IN)
	tw.tween_callback(func() -> void: relic_top.visible = false; relic_top.scale = Vector3.ONE)
	if game.juice:
		game.juice.dust_fall(RELIC_POS + Vector3(0, 1.1, 0.25), Vector3(0.35, 0, 0), 30)
		game.juice.dust_floor(RELIC_POS, 0.7, 16)
		game.juice.grit(RELIC_POS + Vector3(0, 0.6, 0.3), 0.5)
		game.juice.shake(0.18)

# ------------------------------------------------------------------ North: the amphora, her pool, the dry ring
func _build_amphora() -> void:
	amph_node = _anchor(AMPH_POS, -0.5)
	amph_node.scale = Vector3.ONE * 1.6                     # (QA P1-6: it reads from the fixed view)
	_model("amphora", amph_node, func(mb: MB) -> void:
		mb.cyl(Vector3(0, 0.18, 0), 0.12, 0.07, 0.36, Color(0.5, 0.25, 0.0), 10))
	game.level.ob_circle(Vector2(AMPH_POS.x, AMPH_POS.z), 0.26, "amph")
	game.level.add_interact("amph_take", AMPH_POS + Vector3(-0.45, 0, 0.35), "take", func() -> void:
		hub.give("amphora")
		amph_node.visible = false
		game.level.set_enabled("amph", false)
		_toast("amphora"), 1.0,
		func() -> bool: return not has("amphora"))
	game.level.add_interact("amph_fill", FILL_POS, "touch", fill_amphora, 1.0,
		func() -> bool: return has("amphora") and not inv()["amph_full"])

func fill_amphora() -> void:
	inv()["amph_full"] = true
	chapter.event.emit("amph_fill", null)
	_toast("amphora", "full")
	if game.juice: game.juice.ring(Vector3(FILL_POS.x - 0.6, 1.96, FILL_POS.z), 0.8)

func _build_pour() -> void:
	# a dry, stained ring worn into the floor
	# (QA P1-6: an inset darker stone disc with a pale salt rim: it reads as a place where water stood)
	var dm := StandardMaterial3D.new()
	dm.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	dm.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	dm.albedo_color = Color(0.26, 0.24, 0.22, 0.5)
	var dd := CylinderMesh.new()
	dd.top_radius = 0.42; dd.bottom_radius = 0.42; dd.height = 0.004; dd.radial_segments = 28
	pour_disc = MeshInstance3D.new()
	pour_disc.mesh = dd
	pour_disc.material_override = dm
	pour_disc.position = POUR_POS + Vector3(0, 0.004, 0)
	pour_disc.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	add_child(pour_disc)
	var rm := StandardMaterial3D.new()
	rm.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	rm.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	rm.albedo_color = Color(0.9, 0.87, 0.8, 0.7)
	var ring := TorusMesh.new()
	ring.inner_radius = 0.34
	ring.outer_radius = 0.42
	ring.rings = 24
	ring.ring_segments = 4
	pour_ring = MeshInstance3D.new()
	pour_ring.mesh = ring
	pour_ring.material_override = rm
	pour_ring.scale = Vector3(1.0, 0.02, 1.0)
	pour_ring.position = POUR_POS + Vector3(0, 0.006, 0)
	pour_ring.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	add_child(pour_ring)
	# the puddle, once poured: still water mirroring a sign carved overhead
	var pm := StandardMaterial3D.new()
	pm.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	pm.albedo_color = Color(0.32, 0.36, 0.4, 0.85)
	pm.metallic = 0.6
	pm.roughness = 0.05
	var disc := CylinderMesh.new()
	disc.top_radius = 0.4
	disc.bottom_radius = 0.4
	disc.height = 0.01
	disc.radial_segments = 28
	puddle = MeshInstance3D.new()
	puddle.mesh = disc
	puddle.material_override = pm
	puddle.position = POUR_POS + Vector3(0, 0.008, 0)
	puddle.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	puddle.visible = false
	add_child(puddle)
	# (QA P1-13: the puddle is a REAL mirror: a small planar reflection in it, and the sign it shows is carved
	# overhead, where the camera never looks: on LAYER_DOUBLE, seen only in the water)
	var pc := POUR_POS + Vector3(0, 0.012, 0)
	puddle_glass = game.puzzles._mirror_quad(pc, Basis(Vector3.RIGHT, -PI * 0.5), Vector2(0.56, 0.56), false, 0.0)
	puddle_glass.set_shader_parameter("ncols", 0)
	puddle_glass.set_shader_parameter("floor_y", POUR_POS.y)
	puddle_planar = PlanarMirror.new()
	add_child(puddle_planar)
	puddle_planar.setup(Vector3.UP, pc.y, puddle_glass, game.world.env)
	puddle_planar.cam.far = 20.0
	puddle_planar.res_k = 0.5
	var r := Reflector.new()
	r.kind = "pool"; r.plane_n = Vector3.UP; r.plane_d = pc.y + 0.001
	r.clip_c = pc; r.clip_u = Vector3.RIGHT; r.clip_v = Vector3.BACK; r.clip_h = Vector2(0.28, 0.28)
	r.region = Rect2()                       # (no water yet: set when poured)
	r.planar = puddle_planar
	game.puzzles._add_refl(r)
	puddle_refl = r
	# the sign overhead: placed so its reflection lands in the puddle from the one view
	var cb := game.world.cam.global_transform.basis.z if game.world.cam else Vector3(-0.572, 0.588, 0.572)
	var h := 2.0
	var sxz := Vector2(pc.x, pc.z) - Vector2(cb.x, cb.z) * (h / maxf(cb.y, 0.1))
	var sign_n := Node3D.new()
	sign_n.position = Vector3(sxz.x, pc.y + h, sxz.y)
	add_child(sign_n)
	puddle_rune = game.puzzles.rune_quad(sign_n, Vector3.ZERO, Vector2(0.5, 0.5), Basis(Vector3.RIGHT, PI * 0.5), 7.0, 0.0)
	for c in sign_n.find_children("*", "GeometryInstance3D", true, false): (c as GeometryInstance3D).layers = PlanarMirror.LAYER_DOUBLE
	game.level.add_interact("pour", POUR_POS, "touch", pour, 0.9,
		func() -> bool: return not hs()["n_poured"])

func pour() -> void:
	if not has("amphora"):
		game.ui.show_text("A dry ring, worn into the floor,\nas if water once stood here a long time.", game.player.position, 3.0)
		return
	if not inv()["amph_full"]:
		game.ui.show_text("The amphora is empty.\nHer pool lies by the maze.", game.player.position, 3.0)
		return
	inv()["amph_full"] = false
	hs()["n_poured"] = true
	if game.satchel and game.satchel._toast_tw: game.satchel._toast_tw.kill(); game.satchel.toast.modulate.a = 0.0
	chapter.event.emit("pour", null)
	puddle.visible = true
	puddle_refl.region = PUDDLE_REGION
	puddle.scale = Vector3(0.1, 1.0, 0.1)
	var tw := puddle.create_tween()
	tw.tween_property(puddle, "scale", Vector3.ONE, 0.9).set_trans(Tween.TRANS_QUAD).set_ease(Tween.EASE_OUT)
	tw.tween_method(func(v: float) -> void: puddle_rune.set_shader_parameter("lit", v), 0.0, 1.0, 1.6)
	pour_ring.visible = false
	pour_disc.visible = false
	if game.juice:
		game.juice.ring(POUR_POS + Vector3(0, 0.02, 0), 0.6)

# ------------------------------------------------------------------ East: the pin and the sealed panel
func _build_pin() -> void:
	var st := _anchor(STELE_POS, -PI * 0.5)                  # (its face west, toward the walk)
	var m := MB.new()
	m.box(Vector3(0, 0.6, 0), Vector3(0.6, 1.2, 0.34), Color(0.5, 0.25, 0.0))
	m.box(Vector3(0, 1.24, 0), Vector3(0.7, 0.08, 0.42), Color(0.5, 0.25, 0.0))
	m.box(Vector3(0, 0.84, 0.2), Vector3(0.5, 0.05, 0.08), Color(0.5, 0.25, 0.0))       # (the ledge the pin lies on)
	game.puzzles.marble_instance(m.commit(), st)
	game.puzzles.rune_quad(st, Vector3(0, 0.55, 0.175), Vector2(0.3, 0.3), Basis(), 3.0, 0.35)
	game.level.ob_rect(Level.R(STELE_POS.x - 0.22, STELE_POS.z - 0.36, STELE_POS.x + 0.22, STELE_POS.z + 0.36))
	pin_node = _anchor(STELE_POS + Vector3(-0.22, 0.87, 0), 0.0)
	pin_node.scale = Vector3.ONE * 1.6
	var pm := _model("tuning_pin", pin_node, func(mb: MB) -> void: mb.box(Vector3(0, 0.08, 0), Vector3(0.03, 0.16, 0.03), Color(0.5, WorldGeo.BRONZE, 0.0)))
	pm.rotation.z = PI * 0.5
	game.level.add_interact("pin_take", STELE_POS + Vector3(-0.75, 0, 0), "take", func() -> void:
		hub.give("pin")
		pin_node.visible = false
		_toast("pin")
		if game.juice: game.juice.glint(STELE_POS + Vector3(-0.2, 1.0, 0)), 1.0,
		func() -> bool: return not has("pin"))

func _build_panel() -> void:
	var w := PANEL_X.y - PANEL_X.x
	panel = _anchor(Vector3((PANEL_X.x + PANEL_X.y) * 0.5, 4.0, PANEL_Z))
	var m := MB.new()
	m.box(Vector3(0, 0.95, 0), Vector3(w - 0.04, 1.9, 0.22), Color(0.5, 0.25, 0.0))
	m.cyl(Vector3(0, 1.05, 0.12), 0.26, 0.26, 0.04, Color(0.5, WorldGeo.BRONZE, 0.0), 20, Basis(Vector3.RIGHT, PI * 0.5))
	game.puzzles.marble_instance(m.commit(), panel)
	game.puzzles.rune_quad(panel, Vector3(0, 1.05, 0.145), Vector2(0.36, 0.36), Basis(), 3.0, 0.5)
	game.level.ob_rect(Level.R(PANEL_X.x - 0.1, PANEL_Z - 0.16, PANEL_X.y + 0.1, PANEL_Z + 0.16), "e_panel")
	game.level.add_interact("e_panel", Vector3(31.4, 4.0, PANEL_Z + 0.75), "ring", strike_panel, 1.1,
		func() -> bool: return not hs()["e_open"])

func strike_panel() -> void:
	if not has("pin"):
		game.ui.show_text("Sealed. The sign on it hums, a note you almost know.", game.player.position, 3.0)
		return
	open_panel(false)

func open_panel(instant: bool) -> void:
	hs()["e_open"] = true
	game.level.set_enabled("e_panel", false)
	if instant:
		panel.visible = false
		return
	chapter.event.emit("pin_ring", null)
	var tw := panel.create_tween()
	tw.tween_interval(0.6)
	tw.tween_property(panel, "position:y", 4.0 - 2.05, 1.8).set_trans(Tween.TRANS_QUAD).set_ease(Tween.EASE_IN_OUT)
	tw.tween_callback(func() -> void: panel.visible = false)
	if game.juice:
		game.juice.dust_floor(panel.position, 1.0, 14)
		game.juice.shake(0.1)

# ------------------------------------------------------------------ the pin's other uses (QA P1-13)
## struck in the Echo Corridor it replays her song, the stones lighting in order (the song taught in any wing
## order); struck on the Upward Spring's balcony, the falling water answers with the same notes
const PIN_SONG := Vector3(13.0, 2.0, -45.0)
const PIN_SPRING := Vector3(33.0, 4.0, -31.2)
var pin_rings := 0
func _build_pin_uses() -> void:
	game.level.add_interact("pin_song", PIN_SONG, "ring", ring_song, 0.9,
		func() -> bool: return has("pin") and not chapter.state["echo_room"])
	game.level.add_interact("pin_spring", PIN_SPRING, "ring", ring_spring, 0.9,
		func() -> bool: return has("pin"))

func ring_song() -> void:
	pin_rings += 1
	chapter.event.emit("pin_ring_song", null)
	game.sfx.motif(-11.0, 0.62, true)
	var motif: Array = Sfx.MOTIF
	for k in motif.size():
		var idx: int = Chapter.SONG_NOTES.find(motif[k])
		if idx < 0: continue
		get_tree().create_timer(k * 0.62 + 0.05).timeout.connect(func() -> void: chapter.song_flash[idx] = 1.0)

func ring_spring() -> void:
	pin_rings += 1
	chapter.event.emit("pin_ring_spring", null)
	game.sfx.note(Sfx.MOTIF[0], -12.0, true)
	get_tree().create_timer(1.1).timeout.connect(func() -> void: game.sfx.motif(-17.0, 0.7))       # (the water, answering)
	if game.juice: game.juice.ring(Ch1Geo.SP_BASIN + Vector3(0, 0.3, 0), 2.2, 2.4)

# ------------------------------------------------------------------ optional: tablets and memory shards
func _build_tablets() -> void:
	for t in TABLETS:
		var id: String = t[0]
		var at: Vector3 = t[1]
		var n := _anchor(at, float(absi(id.hash()) % 628) / 100.0)
		_model("wax_tablet", n, func(mb: MB) -> void: mb.box(Vector3(0, 0.015, 0), Vector3(0.22, 0.03, 0.16), Color(0.5, WorldGeo.WOOD, 0.0)))
		tablet_nodes[id] = n
		var text: String = t[2]
		game.level.add_interact("tab_" + id, at, "read", func() -> void: take_tablet(id, text), 0.9,
			func() -> bool: return not (id in (inv()["tablets"] as Array)))

func take_tablet(id: String, text: String) -> void:
	if not (id in (inv()["tablets"] as Array)): (inv()["tablets"] as Array).append(id)
	(tablet_nodes[id] as Node3D).visible = false
	chapter.event.emit("item", "tablet")
	game.ui.show_text(text, game.player.position, 5.0)

func _build_secrets() -> void:
	for s in SECRETS:
		var id: String = s[0]
		var at: Vector3 = s[1]
		var need: String = s[2]
		var lock := _anchor(at)
		match need:
			"chisel":
				var m := MB.new()
				m.box(Vector3(0, 0.25, 0), Vector3(0.5, 0.5, 0.5), Color(0.5, 0.25, 0.0), Basis(Vector3.UP, 0.4))
				game.puzzles.marble_instance(m.commit(), lock)
				game.puzzles.rune_quad(lock, Vector3(0, 0.3, 0.26), Vector2(0.18, 0.18), Basis(), 5.0, 0.12)
				game.level.ob_circle(Vector2(at.x, at.z), 0.36, "sec_" + id)
			"amphora":
				var rm := StandardMaterial3D.new()
				rm.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
				rm.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
				rm.albedo_color = Color(0.22, 0.2, 0.18, 0.3)
				var ring := TorusMesh.new()
				ring.inner_radius = 0.3; ring.outer_radius = 0.37; ring.rings = 20; ring.ring_segments = 4
				var mi := MeshInstance3D.new()
				mi.mesh = ring; mi.material_override = rm; mi.scale = Vector3(1, 0.02, 1); mi.position.y = 0.006
				lock.add_child(mi)
			"pin":
				var m2 := MB.new()
				m2.cyl(Vector3(0, 0.3, 0), 0.2, 0.26, 0.6, Color(0.5, 0.25, 0.0), 10)
				game.puzzles.marble_instance(m2.commit(), lock)
				game.puzzles.rune_quad(lock, Vector3(0, 0.62, 0), Vector2(0.24, 0.24), Basis(Vector3.RIGHT, -PI * 0.5), 3.0, 0.2)
				game.level.ob_circle(Vector2(at.x, at.z), 0.3, "sec_" + id)
			"lens":
				_lens_rune(lock, Transform3D(Basis(Vector3.RIGHT, -PI * 0.5), Vector3(0, 0.01, 0)), Vector2(0.45, 0.45), 6.0)
		var shard := _anchor(at + Vector3(0, 0.35 if need != "lens" and need != "amphora" else 0.25, 0))
		_model("memory_shard", shard, func(mb: MB) -> void: mb.box(Vector3(0, 0.08, 0), Vector3(0.06, 0.16, 0.02), Color(0.5, 0.25, 0.0)))
		shard.visible = false
		secret_nodes[id] = [lock, shard]
		var text: String = s[3]
		game.level.add_interact("sec_" + id, at, _sec_icon(need), func() -> void: open_secret(id, need, text), 1.0,
			func() -> bool: return _sec_ready(id, need))

func _sec_icon(need: String) -> String:
	return {"chisel": "push", "amphora": "touch", "pin": "ring", "lens": "memory"}[need]

func _sec_ready(id: String, need: String) -> bool:
	if id in (inv()["mem"] as Array): return false
	if id in (hs()["secrets"] as Array): return true          # (opened: the shard waits to be taken)
	match need:
		"chisel": return has("chisel")
		"amphora": return has("amphora") and inv()["amph_full"]
		"pin": return has("pin")
		"lens": return chapter.lens_on
	return false

func open_secret(id: String, need: String, text: String) -> void:
	var nodes: Array = secret_nodes[id]
	if not (id in (hs()["secrets"] as Array)):
		(hs()["secrets"] as Array).append(id)
		if need == "amphora": inv()["amph_full"] = false
		if need == "chisel" or need == "pin": game.level.set_enabled("sec_" + id, false)
		chapter.event.emit("secret", need)
		var lock: Node3D = nodes[0]
		if need == "chisel":
			if game.juice:
				game.juice.grit(lock.position + Vector3(0, 0.3, 0), 0.3)
				game.juice.dust_floor(lock.position, 0.4, 12)
			lock.visible = false
		elif need == "amphora" and game.juice: game.juice.ring(lock.position + Vector3(0, 0.02, 0), 0.5)
		elif game.juice: game.juice.glint(lock.position + Vector3(0, 0.5, 0))
		(nodes[1] as Node3D).visible = true
		return
	(inv()["mem"] as Array).append(id)
	(nodes[1] as Node3D).visible = false
	chapter.event.emit("mem_shard", id)
	game.ui.show_memory(text, 5.0)
	if (inv()["mem"] as Array).size() == SECRETS.size():         # (QA P2-6: all seven: the Face remembers)
		get_tree().create_timer(5.5).timeout.connect(func() -> void: game.ui.show_text("Seven moments of her, kept.\nThe Face remembers.", game.player.position, 4.0))

# ------------------------------------------------------------------ frame, state
func update(dt: float) -> void:
	# the Shard is the chapter's own (taken in the Hall of Glass): the satchel shows it
	if chapter.state["shard"] and not has("shard"): (inv()["items"] as Array).append("shard")
	# the reliquary's sign, seen through the raised shard
	if not hs()["w_seen"] and chapter.lens_on and chapter.state["gallery"]:
		var p := game.player.position
		if Vector2(p.x - RELIC_POS.x, p.z - RELIC_POS.z).length() < 3.2:
			hs()["w_seen"] = true
			chapter.event.emit("relic_seen", null)
			game.ui.show_text("A sign in the stone, cut as a hairline crack.", game.player.position, 2.5)
	chisel_node.visible = chapter.state["gallery"] and not has("chisel")
	var pp := game.player.position
	# (v1.1: an untaken thing bobs and turns slowly over its beacon, and sparkles now and then within 8 m)
	_bob_t += dt
	for e in beacons:
		var thing: Node3D = e[0]
		var bc: Node3D = e[1]
		bc.visible = thing.visible
		if thing.visible and thing.get_child_count() > 0 and thing != hub.lamp_bench:
			var mdl := thing.get_child(0) as Node3D
			mdl.position.y = 0.05 + sin(_bob_t * 1.8) * 0.04
			thing.rotation.y += dt * 0.5
	_glint_t -= dt
	if _glint_t <= 0.0 and game.juice:
		_glint_t = 3.0
		for e in beacons:
			var n: Node3D = e[0]
			if n.visible and n.global_position.distance_to(pp) < 8.0:
				game.juice.glint(n.global_position + Vector3(0, 0.3, 0))
	if pour_ring.visible:
		var full: bool = inv()["amph_full"]
		(pour_ring.material_override as StandardMaterial3D).albedo_color.a = (0.55 + 0.35 * sin(Time.get_ticks_msec() * 0.004)) if full else 0.7
	for id in tablet_nodes:
		(tablet_nodes[id] as Node3D).visible = not (id in (inv()["tablets"] as Array)) and pp.distance_to((tablet_nodes[id] as Node3D).position) < 26.0

func apply_state() -> void:
	var st: Dictionary = chapter.state
	for k in fresh_inv():
		if not (st["inv"] as Dictionary).has(k): st["inv"][k] = fresh_inv()[k]
	for k in fresh_hub():
		if not (st["hub"] as Dictionary).has(k): st["hub"][k] = fresh_hub()[k]
	chisel_node.visible = chapter.state["gallery"] and not has("chisel")
	relic_top.visible = not hs()["w_broken"]
	relic_top.position = RELIC_POS
	relic_top.scale = Vector3.ONE
	amph_node.visible = not has("amphora")
	game.level.set_enabled("amph", not has("amphora"))
	pour_ring.visible = not hs()["n_poured"]
	pour_disc.visible = not hs()["n_poured"]
	puddle.visible = hs()["n_poured"]
	puddle_refl.region = PUDDLE_REGION if hs()["n_poured"] else Rect2()
	puddle.scale = Vector3.ONE
	puddle_rune.set_shader_parameter("lit", 1.0 if hs()["n_poured"] else 0.0)
	pin_node.visible = not has("pin")
	panel.visible = not hs()["e_open"]
	panel.position.y = 4.0
	game.level.set_enabled("e_panel", not hs()["e_open"])
	for id in tablet_nodes: (tablet_nodes[id] as Node3D).visible = not (id in (inv()["tablets"] as Array))
	for s in SECRETS:
		var id: String = s[0]
		var opened: bool = id in (hs()["secrets"] as Array)
		var nodes: Array = secret_nodes[id]
		(nodes[0] as Node3D).visible = not (opened and s[2] == "chisel")
		(nodes[1] as Node3D).visible = opened and not (id in (inv()["mem"] as Array))
		if s[2] == "chisel" or s[2] == "pin": game.level.set_enabled("sec_" + id, not opened)

## a v2 save (before the hub): the items its progress implies, the wings it finished opened
func migrate_v2() -> void:
	var st: Dictionary = chapter.state
	var it: Array = st["inv"]["items"]
	var any: bool = st["stones"] or st["shard"] or st["gallery"] or st["maze"] or st["scales"]
	if any and not ("lamp" in it): it.append("lamp")
	if st["shard"] and not ("shard" in it): it.append("shard")
	if st["gallery"]:
		if not ("chisel" in it): it.append("chisel")
		st["hub"]["w_seen"] = true
		st["hub"]["w_broken"] = true
	if st["maze"]:
		if not ("amphora" in it): it.append("amphora")
		st["hub"]["n_poured"] = true
	if st["scales"] or st["echo_room"]:
		if not ("pin" in it): it.append("pin")
		st["hub"]["e_open"] = true
	for k in Hub.SEAL_DONE:
		if hub.seal_ready(k) and not (k in (st["inv"]["seals"] as Array)): (st["inv"]["seals"] as Array).append(k)
