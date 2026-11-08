class_name Framing
extends RefCounted
## ONE fixed view (no rotation, no zoom). The rooms are laid out so that, from that view, nothing stands between
## the camera and a puzzle piece (tests/framing_test checks every interact and the walked route of v3).

const YAW := -PI * 0.25
const PITCH := deg_to_rad(36.0)

## the camera's basis for the fixed view (its +z points back toward the camera)
static func basis() -> Basis:
	return Basis(Vector3.UP, YAW) * Basis(Vector3.RIGHT, -PITCH)
