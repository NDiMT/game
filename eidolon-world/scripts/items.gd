class_name Items
extends Node3D
## v2.0 (dev/EIDOLON_SCRIPT.md §3): Chapter I's things. Only TWO tools: Ione's Oil Lamp (she pushes it, lit,
## up through the crypt's still basin) and the goddess's Shard (pushed through the crack in the Hall's great
## mirror); and one story item, her shell comb (it fell through the water at the abduction: it does nothing,
## it glows: find her). The chisel, the amphora and the tuning pin belong to later chapters (their models
## stay). The Mirror Walk's sealed panel answers the Singing Stones on the Ledge.
## Optional: eight wax tablets (Theron's version) and seven memories (Ione's version), found by the Shard.
## State: chapter.state["inv"] (items, story, tablets, mem) and chapter.state["hub"] (w_seen, e_open, secrets).

const NAME := {
	"lamp": "Her Oil Lamp", "shard": "The Shard", "comb": "A Shell Comb", "tablet": "Wax Tablets", "mem": "Memories",
	"beacon": "The Beacons"}
const LINE := {
	"lamp": "Hers. She sent it lit, through the still water. Its small fire parts the dark.",
	"shard": "A piece of the goddess's mirror. Held up, it shows the true world: doors, words, ways that are only there.",
	"comb": "Hers. It fell through the water when he took her. It glows. Find her.",
	"tablet": "Theron's notes, scratched in wax.",
	"mem": "Moments she kept. Each one warm in the hand.",
	"beacon": "One fire for each wing. The Gate counts them."}
const ICON := {"lamp": "oil_lamp", "shard": "shard", "comb": "comb", "tablet": "wax_tablet", "mem": "memory_shard", "beacon": "veil_seal"}
const ORDER := ["lamp", "shard", "comb", "tablet", "mem", "beacon"]

# the places
const PANEL_Z := Map2.GE.z - 24.6                                      # the sealed panel across the Mirror Walk
const PANEL_X := Vector2(Map2.GE.x + 30.4, Map2.GE.x + 32.4)          # (v2: at the Mirror Walk's foot, Map2.GE)

## Theron's notes: [id, where, text]
const TABLETS := [
	["t1", Map2.O + Vector3(12.2, 0.0, 5.4), "She is not gone. Only behind the veil."],
	["t2", Map2.O + Vector3(20.35, 2.0, -11.0), "She laughed when I asked her to stand still. 'Then carve me moving,' she said."],
	["t3", Map2.GG + Vector3(9.5, 1.0, -13.5), "I moved the lamps until her shadow fell where I wanted. Even her shadow argued."],
	["t4", Map2.O + Vector3(-20.4, 1.0, -8.6), "Marble first, then a thousand faces, then glass, I told the guild. They thought it a boast."],
	["t5", Map2.GN + Vector3(12.0, 1.0, -9.6), "The garden was hers. I let it die so it would keep her shape."],
	["t6", Map2.GN + Vector3(14.8, 2.0, -28.55), "In the maze she walked ahead of me in the water, and I followed the wrong one."],
	["t7", Map2.GE + Vector3(32.85, 2.0, -47.2), "Balance: what I took from her against what I gave. The pans never settle."],
	["t8", Map2.GE + Vector3(31.9, 4.0, -40.2), "If the glass holds her, the glass must be kept. I will keep it. I will keep it."]]

## memories (Ione's version): [id, where, need ("lens": seen through the Shard), text]
const SECRETS := [
	["m1", Map2.O + Vector3(-3.3, 0.0, 21.3), "lens", "Milos, the harbour. She bought him a chisel with her first wages and would not say why."],
	["m2", Map2.GN + Vector3(15.6, 1.0, -7.3), "lens", "The garden in flower. She tucked a petal behind the ear of every statue."],
	["m3", Map2.GG + Vector3(9.5, 1.0, -16.3), "lens", "From above, the chamber floor: her shadow and his, the same length at last."],
	["m4", Map2.GE + Vector3(33.4, 4.0, -32.0), "lens", "The spring sang back the note. She used to hum it while he worked."],
	["m5", Map2.O + Vector3(1.4, 0.0, 0.9), "lens", "Under the fountain's lip, in her hand: 'Look at me, not at the marble.'"],
	["m6", Map2.GE + Vector3(27.5, 2.0, -24.3), "lens", "On the Ledge she stood at the edge and leaned on the wind, laughing at his fear."],
	["m7", Map2.O + Vector3(20.2, 2.0, -20.0), "lens", "On the balcony the stone rang back one word of hers. It was his name."]]

var game: Game
var chapter: Chapter
var hub: Hub
var icons := {}                       # key -> Texture2D (A's 128 px icons)
var _glint_t := 0.0
var beacons: Array = []                # [the thing's node, its beacon]
var _bob_t := 0.0
var panel: Node3D
var tablet_nodes := {}
var secret_nodes := {}                # id -> [Node3D lock, Node3D shard]

static func fresh_inv() -> Dictionary:
	return {"items": [], "story": [], "tablets": [], "mem": []}

static func fresh_hub() -> Dictionary:
	return {"ec_open": false, "w_seen": false, "e_open": false, "secrets": [],
		"wk_crossed": false, "warden_seen": 0, "map": [], "points": []}        # (v1.0 M3c: the Warden's Walk, the map's seen regions)

func setup(g: Game, ch: Chapter, h: Hub) -> void:
	game = g
	chapter = ch
	hub = h
	for k in ICON:
		var p := "res://assets/textures/icons/%s.png" % ICON[k]
		if ResourceLoader.exists(p): icons[k] = load(p)
	_build_panel()
	_build_tablets()
	_build_secrets()
	# (v1.1: every thing to take reads from 8 m: a cloth under it, a soft pillar of light, a slow bob and turn)
	for e in [[hub.lamp_bench, Act1.LAMP_POS + Vector3(0, 0.44, 0), false]]:
		beacons.append([e[0], _beacon(e[1], e[2]), e[1], e[2]])

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

## a pickup's beacon (v1.1: A's PickupMarker): a soft light pillar, a pool of light, twinkles, and for
## things lying on the floor an old linen cloth under them
func _beacon(at: Vector3, cloth: bool) -> Node3D:
	var pm := PickupMarker.new()
	pm.bed = "cloth" if cloth else ""
	pm.bed_mat = game.level.marble_mat
	add_child(pm)
	pm.position = at
	return pm

func _toast(k: String, extra := "") -> void:
	if game.ui.has_method("show_item"): game.ui.show_item(k, extra)

# ------------------------------------------------------------------ East: the Mirror Walk's sealed panel (it answers the Singing Stones)
func _build_panel() -> void:
	var w := PANEL_X.y - PANEL_X.x
	panel = _anchor(Vector3((PANEL_X.x + PANEL_X.y) * 0.5, 4.0, PANEL_Z))
	var m := MB.new()
	m.box(Vector3(0, 0.95, 0), Vector3(w - 0.04, 1.9, 0.22), Color(0.5, 0.25, 0.0))
	m.cyl(Vector3(0, 1.05, 0.12), 0.26, 0.26, 0.04, Color(0.5, Props.BRONZE, 0.0), 20, Basis(Vector3.RIGHT, PI * 0.5))
	game.puzzles.marble_instance(m.commit(), panel)
	game.puzzles.rune_quad(panel, Vector3(0, 1.05, 0.145), Vector2(0.36, 0.36), Basis(), 3.0, 0.5)
	game.level.ob_rect(Level.R(PANEL_X.x - 0.1, PANEL_Z - 0.16, PANEL_X.y + 0.1, PANEL_Z + 0.16), "e_panel")
	game.level.add_interact("e_panel", Vector3((PANEL_X.x + PANEL_X.y) * 0.5, 4.0, PANEL_Z + 0.75), "ring", strike_panel, 1.1,
		func() -> bool: return not hs()["e_open"])

func strike_panel() -> void:
	game.ui.show_text("Sealed. The sign on it hums, a note you almost know.\nOn the Ledge below, four stones are cut with notes.", game.player.position, 3.5)

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

# ------------------------------------------------------------------ optional: tablets and memory shards
func _build_tablets() -> void:
	for t in TABLETS:
		var id: String = t[0]
		var at: Vector3 = t[1]
		var n := _anchor(at, float(absi(id.hash()) % 628) / 100.0)
		_model("wax_tablet", n, func(mb: MB) -> void: mb.box(Vector3(0, 0.015, 0), Vector3(0.22, 0.03, 0.16), Color(0.5, Props.WOOD, 0.0)))
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
		_lens_rune(lock, Transform3D(Basis(Vector3.RIGHT, -PI * 0.5), Vector3(0, 0.01, 0)), Vector2(0.45, 0.45), 6.0)
		var shard := _anchor(at + Vector3(0, 0.25, 0))
		_model("memory_shard", shard, func(mb: MB) -> void: mb.box(Vector3(0, 0.08, 0), Vector3(0.06, 0.16, 0.02), Color(0.5, 0.25, 0.0)))
		shard.visible = false
		secret_nodes[id] = [lock, shard]
		var text: String = s[3]
		game.level.add_interact("sec_" + id, at, _sec_icon(need), func() -> void: open_secret(id, need, text), 1.0,
			func() -> bool: return _sec_ready(id, need))

func _sec_icon(need: String) -> String:
	return "memory"

func _sec_ready(id: String, need: String) -> bool:
	if id in (inv()["mem"] as Array): return false
	if id in (hs()["secrets"] as Array): return true          # (opened: the shard waits to be taken)
	return chapter.lens_on

func open_secret(id: String, need: String, text: String) -> void:
	var nodes: Array = secret_nodes[id]
	if not (id in (hs()["secrets"] as Array)):
		(hs()["secrets"] as Array).append(id)
		chapter.event.emit("secret", need)
		var lock: Node3D = nodes[0]
		if game.juice: game.juice.glint(lock.position + Vector3(0, 0.5, 0))
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
	# (v2.0, W.6) the Hidden Way: after her shadows, the Shard raised near the south parapet shows her door
	if not hs()["w_seen"] and chapter.lens_on and chapter.state["gallery"]:
		var p := game.player.position
		if Vector2(p.x - Chapter.HIDDEN_WAY.x, p.z - Chapter.HIDDEN_WAY.z).length() < 3.6: chapter.open_hidden_way(false)
	var pp := game.player.position
	# (v1.1: an untaken thing bobs and turns slowly over its beacon, and sparkles now and then within 8 m)
	_bob_t += dt
	for e in beacons:
		var thing: Node3D = e[0]
		var bc = e[1]
		if is_instance_valid(bc) and not thing.visible and not (bc as PickupMarker)._taking:
			(bc as PickupMarker).take()                # (taken: the marker fades out and frees itself)
		elif thing.visible and (not is_instance_valid(bc) or (bc as PickupMarker)._taking):
			e[1] = _beacon(e[2], e[3])                 # (there again: a new game)
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
	# (v2.0, E.2) the sealed panel answers the Singing Stones on the Ledge
	if chapter.state.get("ledge_song", false) and not hs()["e_open"]: open_panel(false)
	for id in tablet_nodes:
		(tablet_nodes[id] as Node3D).visible = not (id in (inv()["tablets"] as Array)) and pp.distance_to((tablet_nodes[id] as Node3D).position) < 26.0

func apply_state() -> void:
	var st: Dictionary = chapter.state
	for k in fresh_inv():
		if not (st["inv"] as Dictionary).has(k): st["inv"][k] = fresh_inv()[k]
	for k in fresh_hub():
		if not (st["hub"] as Dictionary).has(k): st["hub"][k] = fresh_hub()[k]
	panel.visible = not hs()["e_open"]
	panel.position.y = 4.0
	game.level.set_enabled("e_panel", not hs()["e_open"])
	for id in tablet_nodes: (tablet_nodes[id] as Node3D).visible = not (id in (inv()["tablets"] as Array))
	for s in SECRETS:
		var id: String = s[0]
		var opened: bool = id in (hs()["secrets"] as Array)
		var nodes: Array = secret_nodes[id]
		(nodes[0] as Node3D).visible = true
		(nodes[1] as Node3D).visible = opened and not (id in (inv()["mem"] as Array))

## a v2 save (before the hub): the items its progress implies, the wings it finished counted as lit
func migrate_v2() -> void:
	var st: Dictionary = chapter.state
	var it: Array = st["inv"]["items"]
	var any: bool = st["stones"] or st["shard"] or st["gallery"] or st["maze"] or st["scales"]
	if any and not ("lamp" in it): it.append("lamp")
	if st["shard"] and not ("shard" in it): it.append("shard")
	if st["gallery"]: st["hub"]["w_seen"] = true
	if st["scales"] or st["echo_room"]:
		st["hub"]["e_open"] = true
		st["ledge_song"] = true

## (v2.0) a v3 save (v1.x): the chisel, the amphora and the pin leave the satchel (later chapters); the seals
## become lit Beacons (socketed seals: the Gate was answered); the old FIRST pool is now the chapter's last
## puzzle: it stays unsolved unless the Gate is already open
static func migrate_v3(st: Dictionary) -> void:
	var inv: Dictionary = st.get("inv", {})
	var items: Array = inv.get("items", [])
	for k in ["chisel", "amphora", "pin"]: items.erase(k)
	var b: Array = st.get("beacons", [])
	for k in inv.get("seals", []):
		if not (str(k) in b): b.append(str(k))
	st["beacons"] = b
	inv.erase("seals"); inv.erase("socketed"); inv.erase("amph_full")
	if not inv.has("story"): inv["story"] = []
	if items.size() > 0 and not ("comb" in (inv["story"] as Array)): (inv["story"] as Array).append("comb")
	var hub: Dictionary = st.get("hub", {})
	hub.erase("w_broken"); hub.erase("n_poured")
	if hub.get("e_open", false): st["ledge_song"] = true
	if not bool(st.get("four", false)): st["stones"] = false
	st["echo_room"] = true
