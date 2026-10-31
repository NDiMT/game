"""EIDOLON v1.0 QA P1-8 (Agent A): Tripo kit models -> placement-ready, web-slim prop GLBs (assets/models/props/kit_*).
Each model: transforms baked, turned to face +Z (Tripo's front is +X), base at y = 0, centred on XZ (pivot at the
base), scaled to its size in metres, base colour only (256 or 512 px; metallic/roughness folded into factors, no
normal/AO maps; welded and cleaned, Tripo's own low-poly kept (faces trimmed to <= 6 000 tris); textures dropped: props.gd draws props with the marble
shader, like the rest of the kit). usage: kit_prep.py <tripo_out_dir> <dest_dir>  (names and sizes in SPEC below)
"""
import sys, os, glob, json, math
import numpy as np, trimesh
from PIL import Image
SRC, DST = sys.argv[1], sys.argv[2]
os.makedirs(DST, exist_ok=True)
# name: (fit: 'h' height | 'w' widest horizontal, metres, texture px[, target tris])
SPEC = {
 "face1": ("h", 0.62, 256), "face2": ("h", 0.55, 256), "face3": ("h", 0.55, 256), "face4": ("h", 0.6, 256),
 "face5": ("h", 0.55, 256), "face6": ("h", 0.45, 256), "fountain": ("w", 3.2, 512), "scaffold": ("h", 3.0, 512),
 "ladder": ("h", 3.0, 256), "bridge_deck": ("w", 3.0, 512), "bridge_end": ("w", 2.4, 512), "urns": ("h", 0.9, 256),
 "awning_post": ("h", 2.6, 256),
}
out = {}
# (v2, review) NO brute decimation: Tripo's own smart-low-poly mesh is kept; it is welded, cleaned (degenerate and
# duplicate faces removed, small holes filled, winding made consistent and outward) and shaded with a 35 deg crease
# (hard edges stay crisp). Only the two heaviest faces are trimmed to 6 000 tris (quadric, on the welded surface).
MAXT = {"face": 6000}
import fast_simplification as fsimp
def clean(m, cap):
    w = trimesh.Trimesh(np.asarray(m.vertices), np.asarray(m.faces), process=False)
    w.merge_vertices(merge_tex=True, merge_norm=True)
    w.update_faces(w.nondegenerate_faces()); w.update_faces(w.unique_faces())
    w.remove_unreferenced_vertices()
    if cap and len(w.faces) > cap:
        P, F = fsimp.simplify(np.asarray(w.vertices, np.float64), np.asarray(w.faces, np.int64), target_reduction=1.0 - cap / len(w.faces))
        w = trimesh.Trimesh(P, F, process=False)
        w.update_faces(w.nondegenerate_faces()); w.update_faces(w.unique_faces()); w.remove_unreferenced_vertices()
    trimesh.repair.fill_holes(w)
    trimesh.repair.fix_winding(w)
    trimesh.repair.fix_inversion(w, multibody=True)
    return trimesh.graph.smooth_shade(w, angle=np.radians(35))
for name, (fit, size, px) in SPEC.items():
    f = glob.glob(os.path.join(SRC, name, "**", "*.glb"), recursive=True)
    if not f: print("missing", name); continue
    s = trimesh.load(f[0])
    ms = []
    for node in s.graph.nodes_geometry:
        T, g = s.graph[node]; m = s.geometry[g].copy(); m.apply_transform(T); ms.append(m)
    m = ms[0] if len(ms) == 1 else trimesh.util.concatenate(ms)
    m.apply_transform(trimesh.transformations.rotation_matrix(-math.pi / 2, [0, 1, 0]))
    b = m.bounds
    m.apply_translation([-(b[0][0] + b[1][0]) / 2, -b[0][1], -(b[0][2] + b[1][2]) / 2])
    e = m.extents
    k = size / (e[1] if fit == "h" else max(e[0], e[2]))
    m.apply_scale(k)
    m = clean(m, next((v for k_, v in MAXT.items() if name.startswith(k_)), 0))
    # (drawn by the game's marble shader through props.gd, like every other prop: no textures shipped; the
    # placeholder colour only shows in other viewers. Wood pieces are flagged WOOD in props.gd, see HANDOFF)
    wood = name in ("scaffold", "ladder", "awning_post")
    nm = trimesh.visual.material.PBRMaterial(name="wood_placeholder" if wood else "marble_placeholder",
        baseColorFactor=[0.45, 0.38, 0.30, 1.0] if wood else [0.886, 0.863, 0.816, 1.0], metallicFactor=0.0, roughnessFactor=0.8)
    m.visual = trimesh.visual.TextureVisuals(material=nm)
    sc = trimesh.Scene(); sc.add_geometry(m, node_name=name)
    data = trimesh.exchange.gltf.export_glb(sc, include_normals=True)
    open(os.path.join(DST, "kit_" + name + ".glb"), "wb").write(data)
    out[name] = {"file": "kit_" + name + ".glb", "size_m": [round(float(v), 2) for v in m.extents], "tris": int(len(m.faces)),
                 "tex_px": px, "kb": len(data) // 1024}
    print(name, out[name])
json.dump(out, open(os.path.join(DST, "prep_report.json"), "w"), indent=1)
