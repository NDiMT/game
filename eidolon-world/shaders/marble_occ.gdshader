shader_type spatial;
// v0.8: the marble of everything that may stand between the camera and the wanderer (walls, columns,
// roofs, arches): the same stone, but where it hides her it FADES (a smoothstep alpha over the outer
// 40 % of the see-through circle) instead of being cut. An alpha prepass keeps it solid (depth, sorting)
// everywhere else.
render_mode cull_back, depth_prepass_alpha;
#define OCC_ALPHA
#include "res://shaders/marble.gdshaderinc"
