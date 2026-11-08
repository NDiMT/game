class_name RigIK
extends RefCounted
## v3 (Agent A) small analytic IK helpers shared by HeroineRig and WardenRig (no allocations beyond an Array).
##   RigIK.solve2(a, l1, l2, target, pole) -> [mid joint, end]   two-bone (hip-knee-ankle, shoulder-elbow-wrist)
##   RigIK.frame_rot(a0, b0, a1, b1) -> Quaternion               the rotation taking direction a0 (with side b0)
##                                                               onto a1 (with side b1): aims a bone, keeps its twist

static func solve2(a: Vector3, l1: float, l2: float, t: Vector3, pole: Vector3) -> Array:
	var d := t - a
	var L := d.length()
	var dn := d / L if L > 1e-6 else Vector3.DOWN
	var dist := clampf(L, absf(l1 - l2) + 1e-4, (l1 + l2) * 0.9995)
	var ca := clampf((l1 * l1 + dist * dist - l2 * l2) / (2.0 * l1 * dist), -1.0, 1.0)
	var pn := pole - dn * pole.dot(dn)
	if pn.length_squared() < 1e-8:
		pn = dn.cross(Vector3.RIGHT if absf(dn.x) < 0.9 else Vector3.BACK)
	pn = pn.normalized()
	var mid := a + dn * (l1 * ca) + pn * (l1 * sqrt(maxf(0.0, 1.0 - ca * ca)))
	return [mid, a + dn * dist]

static func frame(a: Vector3, b: Vector3) -> Basis:
	var y := a.normalized()
	var z := b - y * b.dot(y)
	if z.length_squared() < 1e-8: z = y.cross(Vector3.RIGHT if absf(y.x) < 0.9 else Vector3.BACK)
	z = z.normalized()
	return Basis(y.cross(z), y, z)

static func frame_rot(a0: Vector3, b0: Vector3, a1: Vector3, b1: Vector3) -> Quaternion:
	return Quaternion((frame(a1, b1) * frame(a0, b0).transposed()).orthonormalized())

## shortest-arc rotation taking a onto b
static func arc(a: Vector3, b: Vector3) -> Quaternion:
	var ax := a.cross(b)
	if ax.length() < 1e-6: return Quaternion()
	return Quaternion(ax.normalized(), a.angle_to(b))
