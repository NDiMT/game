"""EIDOLON v1.0 QA P1-8 (Agent A): Tripo kit models -> placement-ready, web-slim prop GLBs (assets/models/props/kit_*).
Each model: transforms baked, turned to face +Z (Tripo's front is +X), base at y = 0, centred on XZ (pivot at the
base), scaled to its size in metres, base colour only (256 or 512 px; metallic/roughness folded into factors, no
normal/AO maps; welded and decimated to 1 800 - 3 200 tris; textures dropped: props.gd draws props with the marble
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
TRIS = {"face": 1800, "urns": 2200, "awning_post": 1800, "ladder": 2500}
import fast_simplification as fsimp
def decimate(m, target):
    # Tripo meshes are split at every UV seam: weld by position first (else the islands shrink apart into holes),
    # decimate the welded surface, then give each kept vertex the UV of an original vertex merged into it
    if len(m.faces) <= target: return m
    uv = np.asarray(m.visual.uv)
    key = np.round(np.asarray(m.vertices) / 1e-5).astype(np.int64)
    _, first, inv = np.unique(key, axis=0, return_index=True, return_inverse=True)
    inv = inv.ravel()
    Pw = np.asarray(m.vertices)[first]; Fw = inv[np.asarray(m.faces)]
    Fw = Fw[(Fw[:, 0] != Fw[:, 1]) & (Fw[:, 1] != Fw[:, 2]) & (Fw[:, 0] != Fw[:, 2])]
    P, F, coll = fsimp.simplify(Pw.astype(np.float64), Fw.astype(np.int64), target_reduction=1.0 - target / len(Fw), return_collapses=True)
    P2, F2, mp = fsimp.replay_simplification(Pw.astype(np.float64), Fw.astype(np.int64), coll)
    uvw = uv[first]
    uv2 = np.zeros((len(P2), 2)); seen = np.zeros(len(P2), bool)
    for i, j in enumerate(mp):
        if 0 <= j < len(P2) and not seen[j]: uv2[j] = uvw[i]; seen[j] = True
    return trimesh.Trimesh(P2, F2, visual=trimesh.visual.TextureVisuals(uv=uv2, material=m.visual.material), process=False)
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
    tgt = next((v for k_, v in TRIS.items() if name.startswith(k_)), 3200)
    m = decimate(m, tgt)
    mat = m.visual.material
    if not isinstance(mat, trimesh.visual.material.PBRMaterial): mat = mat.to_pbr()
    mf = 1.0 if mat.metallicFactor is None else float(mat.metallicFactor)
    rf = 1.0 if mat.roughnessFactor is None else float(mat.roughnessFactor)
    if mat.metallicRoughnessTexture is not None:
        a = np.asarray(mat.metallicRoughnessTexture.convert("RGB"), np.float32) / 255
        rf *= float(a[..., 1].mean()); mf *= float(a[..., 2].mean())
    # (drawn by the game's marble shader through props.gd, like every other prop: no textures shipped; the
    # placeholder colour only shows in other viewers. Wood pieces are flagged WOOD in props.gd, see HANDOFF)
    wood = name in ("scaffold", "ladder", "awning_post")
    nm = trimesh.visual.material.PBRMaterial(name="wood_placeholder" if wood else "marble_placeholder",
        baseColorFactor=[0.45, 0.38, 0.30, 1.0] if wood else [0.886, 0.863, 0.816, 1.0], metallicFactor=0.0, roughnessFactor=0.8)
    m.visual = trimesh.visual.TextureVisuals(uv=m.visual.uv, material=nm)
    sc = trimesh.Scene(); sc.add_geometry(m, node_name=name)
    data = trimesh.exchange.gltf.export_glb(sc, include_normals=True)
    open(os.path.join(DST, "kit_" + name + ".glb"), "wb").write(data)
    out[name] = {"file": "kit_" + name + ".glb", "size_m": [round(float(v), 2) for v in m.extents], "tris": int(len(m.faces)),
                 "tex_px": px, "kb": len(data) // 1024}
    print(name, out[name])
json.dump(out, open(os.path.join(DST, "prep_report.json"), "w"), indent=1)
