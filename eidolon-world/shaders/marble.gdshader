shader_type spatial;
// World marble for all merged static geometry. Vertex COLOR packs:
//   r = per-piece random (tint variance)
//   g = material: 0.00 cream floor (1 m tile grid + grout), 0.25 cream carved marble (walls, columns,
//       statues), 0.50 rough island stone (cliffs under the slabs), 0.75 black polished marble floor,
//       1.00 charcoal (dead wood, iron, bronze)
//   a = 1 on boxes: their BoxMesh face UVs give worn, bevelled edges (fake chamfer)
//   b = 1 if the piece may OCCLUDE the player (walls, columns, roofs, arches): v0.6, where they stand
//       between the camera and the player they open in a soft screen-space circle (`reveal`): a clean
//       radial cut, a hazy feathered band round it and a thin petrol rim on the cut edge (no dither).
render_mode cull_back, depth_draw_opaque;
#include "res://shaders/marble.gdshaderinc"
