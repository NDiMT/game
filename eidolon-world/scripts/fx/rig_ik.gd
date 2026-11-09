class_name RigIK
extends RefCounted
## v3 (Agent A) small analytic IK helpers shared by HeroineRig and WardenRig (no allocations beyond an Array).
##   RigIK.solve2(a, l1, l2, target, pole, max_flex) -> [mid joint, end, hinge]   two-bone (hip-knee-ankle, shoulder-elbow-wrist)
##       the mid joint bends toward `pole`; `hinge` is the bend axis (the flexion is a POSITIVE turn about it, never past
##       max_flex), so a limb posed with hinge_rot never bends backward and never flips its twist
##   RigIK.hinge_rot(a0, h0, a1, h1) -> Quaternion   the rotation taking a bone's rest direction a0 / rest hinge h0 onto
##       a1 / h1 (both bones of a limb take the SAME hinge: the joint stays a hinge)
##   RigIK.pole(dn, hint, fallback) -> Vector3        a stable pole for the limb direction dn: the hint's part across dn,
##       eased onto a second wish where the hint runs along the limb (no degenerate flip)
##   RigIK.cone(d, lim)                               keep a direction out of the forbidden half-spaces
##   RigIK.twist(q, axis) -> float, RigIK.frame_rot(a0, b0, a1, b1), RigIK.arc(a, b)
## (a6: the old frame_rot(dir, FORWARD/BACK side) arm/leg frames flipped the forearm / calf 180 deg once the bend
## passed ~90 deg and the arm twisted wherever the pole ran along the limb: the "arms snap backward" bug)

static func solve2(a: Vector3, l1: float, l2: float, t: Vector3, pole: Vector3, max_flex := 2.53) -> Array:
	var d := t - a
	var L := d.length()
	var dn := d / L if L > 1e-6 else Vector3.DOWN
	# the closest the end may come: the elbow / knee folds no further than max_flex (rad, from straight)
	var dmin := sqrt(maxf(0.0, l1 * l1 + l2 * l2 + 2.0 * l1 * l2 * cos(max_flex)))
	var dist := clampf(L, maxf(absf(l1 - l2) + 1e-4, dmin), (l1 + l2) * 0.9995)
	var ca := clampf((l1 * l1 + dist * dist - l2 * l2) / (2.0 * l1 * dist), -1.0, 1.0)
	var pn := pole - dn * pole.dot(dn)
	if pn.length_squared() < 1e-8:
		pn = dn.cross(Vector3.RIGHT if absf(dn.x) < 0.9 else Vector3.BACK)
	pn = pn.normalized()
	var mid := a + dn * (l1 * ca) + pn * (l1 * sqrt(maxf(0.0, 1.0 - ca * ca)))
	return [mid, a + dn * dist, pn.cross(dn).normalized()]

static func frame(a: Vector3, b: Vector3) -> Basis:
	var y := a.normalized()
	var z := b - y * b.dot(y)
	if z.length_squared() < 1e-8: z = y.cross(Vector3.RIGHT if absf(y.x) < 0.9 else Vector3.BACK)
	z = z.normalized()
	return Basis(y.cross(z), y, z)

static func frame_rot(a0: Vector3, b0: Vector3, a1: Vector3, b1: Vector3) -> Quaternion:
	return Quaternion((frame(a1, b1) * frame(a0, b0).transposed()).orthonormalized())

static func hinge_rot(a0: Vector3, h0: Vector3, a1: Vector3, h1: Vector3) -> Quaternion:
	return frame_rot(a0, h0, a1, h1)

## the pole for a limb along dn: the hint's part across the limb, plus a little of `fallback`'s (continuous: where the
## hint runs along the limb the fallback takes over instead of the pole spinning round)
static func pole(dn: Vector3, hint: Vector3, fallback: Vector3) -> Vector3:
	var p := hint - dn * hint.dot(dn)
	var q := fallback - dn * fallback.dot(dn)
	return p + q * 0.35

## the twist (rad) of q about the unit axis (swing-twist decomposition; the twist is the same for q = S*T and q = T*S)
static func twist(q: Quaternion, axis: Vector3) -> float:
	var v := Vector3(q.x, q.y, q.z)
	var p := axis * v.dot(axis)
	var tq := Quaternion(p.x, p.y, p.z, q.w)
	if tq.length_squared() < 1e-12: return 0.0
	tq = tq.normalized()
	if tq.w < 0.0: tq = -tq
	var s := Vector3(tq.x, tq.y, tq.z).dot(axis)
	return 2.0 * atan2(s, tq.w)

## a joint limit for a parent-relative rotation `rel` about its bone axis: the twist clamped to +-max_tw and the swing to
## max_sw (rad). Returns [swing, twist angle] with rel ~= Quaternion(axis, twist) * swing
static func limit(rel: Quaternion, axis: Vector3, max_tw: float, max_sw: float) -> Array:
	var tw := twist(rel, axis)
	var sw := Quaternion(axis, -tw) * rel
	if sw.w < 0.0: sw = -sw
	var ang := 2.0 * acos(clampf(sw.w, -1.0, 1.0))
	if ang > max_sw and ang > 1e-5:
		sw = Quaternion().slerp(sw, max_sw / ang)
	return [sw, clampf(tw, -max_tw, max_tw)]

## a direction kept out of the half-spaces {d . n < m}: lim = [[n, m], ...] (one projection pass each, renormalised)
static func cone(d: Vector3, lim: Array) -> Vector3:
	var L := d.length()
	if L < 1e-6: return d
	var u := d / L
	for c in lim:
		var n: Vector3 = c[0]
		var m: float = c[1]
		var k := u.dot(n)
		if k < m:
			var r := u - n * k
			var rl := r.length()
			u = n * m + (r / rl) * sqrt(maxf(0.0, 1.0 - m * m)) if rl > 1e-5 else n
	return u * L

## shortest-arc rotation taking a onto b
static func arc(a: Vector3, b: Vector3) -> Quaternion:
	var ax := a.cross(b)
	if ax.length() < 1e-6: return Quaternion()
	return Quaternion(ax.normalized(), a.angle_to(b))
