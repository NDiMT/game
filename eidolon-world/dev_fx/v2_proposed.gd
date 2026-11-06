class_name V2Proposed
## (Agent A, dev) the recipes proposed for the v2 spaces W has not switched on yet (see HANDOFF): built the way
## Map2.dress builds the others, for the in-place shots and for W's overlap / occlusion tests run with them.
const PROPOSE := [["I5", "crypt"], ["W1", "stair_breath"], ["IBW", "hidden_way"], ["WB", "colossus"], ["N1", "colonnade"],
	["N6", "tree_shards"], ["E3", "mirror_walk"], ["E4", "spring"], ["P", "pool_halves"]]  # (P: proposed again, refit to the rims)
static func build(lv: Level) -> Array:
	var keep := Map2.route_keep()
	for k in Map2.KEEP_EXTRA: keep.append(Map2.wr(k[0], k[1], k[2], k[3]))
	var out := []
	for pr in PROPOSE:
		var sp: Array = Map2.space(pr[0])
		if sp.is_empty() or str(sp[6]) != "": continue
		var d := Dress.build(lv, lv, pr[1], Map2.space_rect(pr[0]), float(sp[5]) + Map2.O.y, keep)
		var placed := 0
		for slot in d._parts: placed += (d._parts[slot] as Array).size()
		out.append("PROPOSED %s (%s): %d pieces placed, skipped %s" % [pr[0], pr[1], placed, str(d.skipped)])
	return out
