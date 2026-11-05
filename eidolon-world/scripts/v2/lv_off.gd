class_name LvOff
extends RefCounted
## (v2 rebuild, phase 3) the Level kit seen through a translation: a v1 room's geometry builder, written in its v1
## coordinates, calls these instead of the Level's own, and every position lands at v1 + `o` (its module's world
## offset, Map2.GW / GG / GN / GE ...). Sizes, yaws and directions pass through unchanged.

var lv: Level
var o := Vector3.ZERO
var o2 := Vector2.ZERO

func _init(level: Level, off: Vector3) -> void:
	lv = level
	o = off
	o2 = Vector2(off.x, off.z)

## a v1 point / rect in the world
func p(v: Vector3) -> Vector3: return v + o
func q(v: Vector2) -> Vector2: return v + o2
func r(rr: Rect2) -> Rect2: return Rect2(rr.position + o2, rr.size)
func y(v: float) -> float: return v + o.y

func walk(rr: Rect2, y0: float, y1 := NAN, axis := -1, name := "", enabled := true) -> Level.Region:
	return lv.walk(r(rr), y0 + o.y, (y1 + o.y) if not is_nan(y1) else NAN, axis, name, enabled)
func ob_circle(c: Vector2, rad: float, name := "") -> Level.Obstacle: return lv.ob_circle(c + o2, rad, name)
func ob_rect(rr: Rect2, name := "", enabled := true) -> Level.Obstacle: return lv.ob_rect(r(rr), name, enabled)
func slab(zone: String, rr: Rect2, top: float, thick := 0.7, mat := 0.0, under := true) -> void: lv.slab(zone, r(rr), top + o.y, thick, mat, under)
func underside(zone: String, rr: Rect2, yy: float) -> void: lv.underside(zone, r(rr), yy + o.y)
func box(zone: String, center: Vector3, size: Vector3, mat := 0.25, occ := false, basis := Basis()) -> void: lv.box(zone, center + o, size, mat, occ, basis)
func wall(zone: String, rr: Rect2, y0: float, y1: float, occ := true) -> void: lv.wall(zone, r(rr), y0 + o.y, y1 + o.y, occ)
func blob(at: Vector3, size: float) -> void: lv.blob(at + o, size)
func column(base: Vector3, h := 3.8, ob := true) -> void: lv.column(base + o, h, ob)
func stump(base: Vector3, h := 1.0, ob := true, tilt := 0.0) -> void: lv.stump(base + o, h, ob, tilt)
func rubble(c: Vector3, spread: float, count: int) -> void: lv.rubble(c + o, spread, count)
func statue(zone: String, base: Vector3, yaw: float, sc := 1.0, plinth := 0.6, ob := true) -> void: lv.statue(zone, base + o, yaw, sc, plinth, ob)
func tree(zone: String, base: Vector3, seed: int) -> void: lv.tree(zone, base + o, seed)
func balustrade(zone: String, a: Vector2, b: Vector2, yy: float) -> void: lv.balustrade(zone, a + o2, b + o2, yy + o.y)
func steps(zone: String, rr: Rect2, axis: int, y_lo: float, y_hi: float, hi_at_max: bool) -> void: lv.steps(zone, r(rr), axis, y_lo + o.y, y_hi + o.y, hi_at_max)
func add_interact(id: String, pos: Vector3, icon: String, action: Callable, radius := 1.25, cond := Callable()) -> Level.Interact:
	return lv.add_interact(id, pos + o, icon, action, radius, cond)
func inscription(id: String, pos: Vector3, text: String, radius := 1.3, marker := Transform3D(), size := Vector2(0.62, 0.8)) -> Level.Interact:
	return lv.inscription(id, pos + o, text, radius, marker.translated(o) if marker != Transform3D() else marker, size)
func occluder(bb: AABB) -> void: lv.occluders.append(AABB(bb.position + o, bb.size))
func mb(zone: String) -> MB: return lv.mb(zone)
func C(mat: float, occ := false) -> Color: return lv.C(mat, occ)
