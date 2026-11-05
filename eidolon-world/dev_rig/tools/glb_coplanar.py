"""EIDOLON v2.0 (Agent A): remove internal z-fighting from Tripo GLBs.
Finds triangle pairs that lie in the same plane (normals within ~1.8 deg, planes within 2 mm), face the same way and
overlap (the same test as tests/zfight.gd) anywhere in the model (all primitives, in model space), and drops the smaller
triangle of each pair (these are Tripo's internal slivers / doubled shells: the larger one already covers the spot).
The file is rewritten in place (only the index buffers change); a backup goes to <backup_dir>.
usage: glb_coplanar.py <backup_dir> <file.glb> [...]
"""
import sys, os, shutil, struct
import numpy as np
from pygltflib import GLTF2, BufferView, Accessor

EPS = 0.004            # (looser than tests/zfight.gd: the importer quantises vertices a little)
COS = 0.999

def node_mats(g):
    import math
    mats = {}
    def local(n):
        if n.matrix: return np.array(n.matrix, dtype=np.float64).reshape(4, 4).T
        t = np.eye(4)
        if n.scale: t = np.diag([n.scale[0], n.scale[1], n.scale[2], 1.0]) @ t
        if n.rotation:
            x, y, z, w = n.rotation
            r = np.array([[1-2*(y*y+z*z), 2*(x*y-z*w), 2*(x*z+y*w), 0], [2*(x*y+z*w), 1-2*(x*x+z*z), 2*(y*z-x*w), 0],
                          [2*(x*z-y*w), 2*(y*z+x*w), 1-2*(x*x+y*y), 0], [0, 0, 0, 1]])
            t = r @ t
        if n.translation:
            tr = np.eye(4); tr[:3, 3] = n.translation; t = tr @ t
        return t
    def walk(i, parent):
        m = parent @ local(g.nodes[i]); mats[i] = m
        for c in (g.nodes[i].children or []): walk(c, m)
    roots = g.scenes[g.scene or 0].nodes
    for r in roots: walk(r, np.eye(4))
    return mats

def read_acc(g, blob, ai):
    a = g.accessors[ai]; bv = g.bufferViews[a.bufferView]
    comp = {5126: ('f', 4), 5125: ('I', 4), 5123: ('H', 2), 5121: ('B', 1)}[a.componentType]
    ncomp = {'SCALAR': 1, 'VEC2': 2, 'VEC3': 3, 'VEC4': 4}[a.type]
    off = (bv.byteOffset or 0) + (a.byteOffset or 0)
    stride = bv.byteStride or comp[1] * ncomp
    out = np.zeros((a.count, ncomp), dtype=np.float64 if comp[0] == 'f' else np.int64)
    for i in range(a.count):
        out[i] = struct.unpack_from('<' + comp[0] * ncomp, blob, off + i * stride)
    return out if ncomp > 1 else out[:, 0]

def overlap2d(A, B):
    # SAT on two triangles (3x2), each shrunk 0.5 mm toward its centroid (shared edges are not overlaps; tests/zfight.gd
    # shrinks 1 mm, so this catches everything it does)
    def shrink(T):
        c = T.mean(0); d = T - c; L = np.linalg.norm(d, axis=1, keepdims=True)
        return c + d * np.maximum(0.0, L - 0.0005) / np.maximum(L, 1e-9)
    A = shrink(A); B = shrink(B)
    for T in (A, B):
        for i in range(3):
            e = T[(i + 1) % 3] - T[i]; n = np.array([-e[1], e[0]])
            pa = A @ n; pb = B @ n
            if pa.max() <= pb.min() + 1e-7 or pb.max() <= pa.min() + 1e-7: return False
    return True

def fix(path, backup):
    g = GLTF2().load(path)
    blob = g.binary_blob()
    mats = node_mats(g)
    tris = []   # (prim_key, tri_index, a, b, c)
    prims = {}
    for ni, m in mats.items():
        n = g.nodes[ni]
        if n.mesh is None: continue
        for pi, p in enumerate(g.meshes[n.mesh].primitives):
            if (p.mode or 4) != 4 or p.indices is None: continue
            key = (n.mesh, pi)
            if key in prims: continue
            P = read_acc(g, blob, p.attributes.POSITION)
            P = (np.c_[P, np.ones(len(P))] @ m.T)[:, :3]
            I = read_acc(g, blob, p.indices).reshape(-1, 3)
            prims[key] = [p, I]
            for ti, (a, b, c) in enumerate(I): tris.append((key, ti, P[a], P[b], P[c]))
    # plane buckets
    rec = []
    for k, ti, a, b, c in tris:
        nrm = np.cross(b - a, c - a); ar = np.linalg.norm(nrm)
        if ar < 1e-12: continue
        nrm /= ar
        rec.append((k, ti, a, b, c, nrm, float(nrm @ a), ar * 0.5))
    buckets = {}
    for r in rec:
        n = r[5]; d = r[6]
        s = -1 if (n[0] < -1e-4 or (abs(n[0]) <= 1e-4 and (n[1] < -1e-4 or (abs(n[1]) <= 1e-4 and n[2] < 0)))) else 1
        key = (round(n[0] * s * 40), round(n[1] * s * 40), round(n[2] * s * 40), round(d * s / 0.01))
        buckets.setdefault(key, []).append(r)
    drop = set()
    keys = list(buckets)
    for key in keys:
        cand = []
        for dx in (-1, 0, 1):
            for dy in (-1, 0, 1):
                for dz in (-1, 0, 1):
                    for dw in (-1, 0, 1):
                        cand += buckets.get((key[0] + dx, key[1] + dy, key[2] + dz, key[3] + dw), [])
        own = buckets[key]
        for r1 in own:
            for r2 in cand:
                if r1 is r2: continue
                if (r1[0], r1[1]) in drop or (r2[0], r2[1]) in drop: continue
                if r1[5] @ r2[5] < COS or abs(r1[6] - r2[6]) > EPS: continue
                n = r1[5]; u = np.cross(n, [0, 1, 0] if abs(n[1]) < 0.9 else [1, 0, 0]); u /= np.linalg.norm(u); v = np.cross(n, u)
                A = np.array([[p @ u, p @ v] for p in r1[2:5]]); B = np.array([[p @ u, p @ v] for p in r2[2:5]])
                if not overlap2d(A, B): continue
                small = r1 if r1[7] <= r2[7] else r2
                drop.add((small[0], small[1]))
    if not drop:
        print(os.path.basename(path), "clean"); return
    os.makedirs(backup, exist_ok=True)
    shutil.copy(path, os.path.join(backup, os.path.basename(path)))
    extra = bytearray()
    base = len(blob); base += (-base) % 4
    blob = bytearray(blob) + b'\0' * ((-len(blob)) % 4)
    for key, (p, I) in prims.items():
        keep = [i for i in range(len(I)) if (key, i) not in drop]
        if len(keep) == len(I): continue
        newI = I[keep].astype(np.uint32).ravel()
        data = newI.tobytes()
        bvi = len(g.bufferViews)
        g.bufferViews.append(BufferView(buffer=0, byteOffset=len(blob) + len(extra), byteLength=len(data), target=34963))
        extra += data + b'\0' * ((-len(data)) % 4)
        g.accessors.append(Accessor(bufferView=bvi, byteOffset=0, componentType=5125, count=int(len(newI)), type='SCALAR',
                                    max=[int(newI.max())], min=[int(newI.min())]))
        p.indices = len(g.accessors) - 1
    blob = bytes(blob) + bytes(extra)
    g.buffers[0].byteLength = len(blob)
    g.set_binary_blob(blob)
    g.save_binary(path)
    print(os.path.basename(path), "dropped", len(drop), "coplanar sliver triangles of", len(tris))

if __name__ == "__main__":
    for f in sys.argv[2:]: fix(f, sys.argv[1])
