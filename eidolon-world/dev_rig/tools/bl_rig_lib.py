"""EIDOLON a7 (Agent A): shared Blender (bpy 5.x) rigging + retargeting helpers for the heroine and the Warden.
Used by heroine_bl_rig.py / warden_bl_rig.py (python3.11 with `pip install bpy scipy`).

Conventions: Blender space (Z up, the character faces -Y, her left = +X), metres. Bones are named after Godot's
SkeletonProfileHumanoid (Hips, Spine, Chest, UpperChest, Neck, Head, LeftShoulder, LeftUpperArm, ...), plus extra
non-profile bones (LeftForeTwist, skirt chains Skirt<k>_<i>), all baked into every action, so Godot only plays tracks.

Retargeting (Quaternius UAL, T-pose rest -> her A-pose rest): world-space rotation deltas. For every frame
    D_i = A_src_i(t) * P_src_i^-1,   target_world_i = D_i * R_tgt_i
where P_src_i is the source rest rotation turned (minimal arc, world) onto the target's rest bone direction,
so both rests are "the same pose" and twists carry over. The hips' translation is scaled by the leg length ratio.
"""
import bpy, math
import numpy as np
from mathutils import Vector, Matrix, Quaternion

UAL_MAP = {
    'pelvis': 'Hips', 'spine_01': 'Spine', 'spine_02': 'Chest', 'spine_03': 'UpperChest', 'neck_01': 'Neck', 'Head': 'Head',
    'clavicle_l': 'LeftShoulder', 'upperarm_l': 'LeftUpperArm', 'lowerarm_l': 'LeftLowerArm', 'hand_l': 'LeftHand',
    'clavicle_r': 'RightShoulder', 'upperarm_r': 'RightUpperArm', 'lowerarm_r': 'RightLowerArm', 'hand_r': 'RightHand',
    'thigh_l': 'LeftUpperLeg', 'calf_l': 'LeftLowerLeg', 'foot_l': 'LeftFoot', 'ball_l': 'LeftToes',
    'thigh_r': 'RightUpperLeg', 'calf_r': 'RightLowerLeg', 'foot_r': 'RightFoot', 'ball_r': 'RightToes',
}
# finger groups: the target's two-bone "Fingers" chain takes the mean of the four fingers' segments; the thumb its own
FINGER_SRC = {'1': ['index_01', 'middle_01', 'ring_01', 'pinky_01'], '2': ['index_02', 'middle_02', 'ring_02', 'pinky_02']}


def reset():
    bpy.ops.wm.read_factory_settings(use_empty=True)


def import_glb(path):
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=path)
    return [o for o in bpy.data.objects if o not in before]


def ss(e0, e1, x):
    t = np.clip((np.asarray(x, float) - e0) / (e1 - e0), 0.0, 1.0)
    return t * t * (3 - 2 * t)


# ------------------------------------------------------------------ armature
def build_armature(name, bones, deform_skip=()):
    """bones: list of (name, parent, head, tail, roll_z_hint Vector or None, connect). Returns the armature object."""
    arm_d = bpy.data.armatures.new(name)
    arm = bpy.data.objects.new(name, arm_d)
    bpy.context.scene.collection.objects.link(arm)
    bpy.context.view_layer.objects.active = arm
    arm.select_set(True)
    bpy.ops.object.mode_set(mode='EDIT')
    eb = arm_d.edit_bones
    for nm, par, h, t, zhint, conn in bones:
        b = eb.new(nm)
        b.head = Vector(h)
        b.tail = Vector(t)
        if zhint is not None:
            b.align_roll(Vector(zhint))
        if par:
            b.parent = eb[par]
            b.use_connect = bool(conn) and (eb[par].tail - b.head).length < 1e-5
        b.use_deform = nm not in deform_skip
    bpy.ops.object.mode_set(mode='OBJECT')
    return arm


def rest_mats(arm):
    """armature-space rest matrices (4x4) by bone name"""
    return {b.name: b.matrix_local.copy() for b in arm.data.bones}


# ------------------------------------------------------------------ weights
def mesh_arrays(obj):
    me = obj.data
    n = len(me.vertices)
    co = np.empty(n * 3, np.float64)
    me.vertices.foreach_get('co', co)
    co = co.reshape(-1, 3)
    tri = []
    me.calc_loop_triangles()
    t = np.empty(len(me.loop_triangles) * 3, np.int64)
    me.loop_triangles.foreach_get('vertices', t)
    return co, t.reshape(-1, 3)


def get_weights(obj, names):
    """vertex-group weights -> (N, len(names)) array"""
    n = len(obj.data.vertices)
    W = np.zeros((n, len(names)))
    gi = {g.index: names.index(g.name) for g in obj.vertex_groups if g.name in names}
    for v in obj.data.vertices:
        for g in v.groups:
            k = gi.get(g.group)
            if k is not None:
                W[v.index, k] = g.weight
    return W


def set_weights(obj, names, W, eps=1e-4):
    obj.vertex_groups.clear()
    for j, nm in enumerate(names):
        g = obj.vertex_groups.new(name=nm)
        idx = np.where(W[:, j] > eps)[0]
        for i in idx:
            g.add([int(i)], float(W[i, j]), 'REPLACE')


def adjacency(n, tri):
    import scipy.sparse as sp
    e = np.r_[tri[:, [0, 1]], tri[:, [1, 2]], tri[:, [2, 0]]]
    e = np.r_[e, e[:, ::-1]]
    A = sp.coo_matrix((np.ones(len(e)), (e[:, 0], e[:, 1])), shape=(n, n)).tocsr()
    A.data[:] = 1.0
    return A


def smooth_weights(W, A, iters, k=0.5, mask=None):
    """Laplacian smoothing of weight columns on the mesh graph (mask: per-vertex 0..1 how much may change)"""
    deg = np.asarray(A.sum(1)).ravel()
    deg[deg == 0] = 1
    for _ in range(iters):
        avg = (A @ W) / deg[:, None]
        d = (avg - W) * k
        if mask is not None:
            d *= mask[:, None]
        W = W + d
    return W


def limit_normalize(W, n=4, floor=0.01):
    W = W.copy()
    if W.shape[1] > n:
        idx = np.argsort(-W, axis=1)[:, n:]
        np.put_along_axis(W, idx, 0.0, axis=1)
    W[W < floor] = 0.0
    s = W.sum(1, keepdims=True)
    s[s == 0] = 1
    return W / s


# ------------------------------------------------------------------ retarget
def _swing(a, b):
    a = a.normalized(); b = b.normalized()
    return a.rotation_difference(b)


class Retarget:
    """Source (UAL) armature -> target armature, per-frame world-delta retarget (see the module docstring)."""

    def __init__(self, src, tgt, mapping, hip_scale, fingers=None, src_rest_pose=None):
        self.src, self.tgt, self.map = src, tgt, mapping
        self.hip_scale = hip_scale
        self.fingers = fingers or {}
        self.Rs = {b.name: b.matrix_local.copy() for b in src.data.bones}
        self.Rt = {b.name: b.matrix_local.copy() for b in tgt.data.bones}
        # P_src: the source rest turned onto the target rest's bone directions (world)
        self.Pinv = {}
        for s, t in mapping.items():
            if s not in self.Rs or t not in self.Rt:
                continue
            ds = self.Rs[s].to_3x3() @ Vector((0, 1, 0))
            dt = self.Rt[t].to_3x3() @ Vector((0, 1, 0))
            q = _swing(ds, dt)
            P = q.to_matrix() @ self.Rs[s].to_3x3()
            self.Pinv[s] = P.inverted()
        for t, (srcs, _) in self.fingers.items():
            ds = Vector((0, 0, 0))
            for s in srcs:
                ds += self.Rs[s].to_3x3() @ Vector((0, 1, 0))
            dt = self.Rt[t].to_3x3() @ Vector((0, 1, 0))
            q = _swing(ds, dt)
            # the mean source frame: the first finger's rest (they share the rest roll closely)
            P = q.to_matrix() @ self.Rs[srcs[0]].to_3x3()
            self.fingers[t] = (srcs, P.inverted())
        self.src_hip0 = self.Rs['pelvis'].translation.copy()
        self.order = [b.name for b in tgt.data.bones]          # parents before children
        self.parent = {b.name: (b.parent.name if b.parent else None) for b in tgt.data.bones}

    def sample_src(self, frame):
        bpy.context.scene.frame_set(int(math.floor(frame)), subframe=frame - math.floor(frame))
        return {pb.name: pb.matrix.copy() for pb in self.src.pose.bones}

    def target_pose(self, S, extra=None):
        """S: source pose matrices (armature space). Returns target armature-space pose matrices by bone name."""
        T = {}
        rot = {}
        for s, t in self.map.items():
            if s in self.Pinv:
                D = S[s].to_3x3() @ self.Pinv[s]
                rot[t] = (D @ self.Rt[t].to_3x3()).normalized()
        for t, (srcs, Pinv) in self.fingers.items():
            qs = [S[s].to_quaternion() for s in srcs]
            q = qs[0]
            for k, qq in enumerate(qs[1:], 2):           # running mean (all close)
                if q.dot(qq) < 0:
                    qq = -qq
                q = q.slerp(qq, 1.0 / k)
            D = q.to_matrix() @ Pinv
            rot[t] = (D @ self.Rt[t].to_3x3()).normalized()
        for nm in self.order:
            par = self.parent[nm]
            if nm == 'Hips':
                hp = self.Rt[nm].translation + (S['pelvis'].translation - self.src_hip0) * self.hip_scale
            elif par is None:
                hp = self.Rt[nm].translation.copy()
            else:
                hp = T[par] @ (self.Rt[par].inverted() @ self.Rt[nm].translation)
            if nm in rot:
                R = rot[nm]
            elif par is not None:                       # not mapped: rigid with the parent
                R = (T[par].to_3x3() @ (self.Rt[par].to_3x3().inverted() @ self.Rt[nm].to_3x3())).normalized()
            else:
                R = self.Rt[nm].to_3x3()
            M = R.to_4x4()
            M.translation = hp
            T[nm] = M
            if extra and nm in extra:
                extra[nm](T)
        return T


def to_basis(arm, T):
    """armature-space pose matrices -> pose-bone matrix_basis (local), by bone name"""
    out = {}
    for b in arm.data.bones:
        nm = b.name
        if nm not in T:
            continue
        if b.parent:
            pr = b.parent.matrix_local
            pp = T[b.parent.name]
            out[nm] = (pr.inverted() @ b.matrix_local).inverted() @ pp.inverted() @ T[nm]
        else:
            out[nm] = b.matrix_local.inverted() @ T[nm]
    return out


def write_action(arm, name, frames_basis, fps=30, loc_bones=('Hips',), scale_prefix=('Skirt',)):
    """frames_basis: list of {bone: matrix_basis}. Writes quaternion (+ location for loc_bones) keys at 0,1,2,... (fps)."""
    act = bpy.data.actions.new(name)
    act.use_fake_user = True
    if arm.animation_data is None:
        arm.animation_data_create()
    arm.animation_data.action = act
    slot = arm.animation_data.action_slot
    nfr = len(frames_basis)
    xs = np.arange(nfr, dtype=np.float64)
    for b in arm.data.bones:
        nm = b.name
        pb = arm.pose.bones[nm]
        pb.rotation_mode = 'QUATERNION'
        qs = []
        prev = None
        for fb in frames_basis:
            q = fb[nm].to_quaternion() if nm in fb else Quaternion()
            if prev is not None and prev.dot(q) < 0:
                q = -q
            qs.append(q); prev = q
        qa = np.array([[q.w, q.x, q.y, q.z] for q in qs])
        if nm.startswith(scale_prefix):
            sa = np.array([[*(fb[nm].to_scale() if nm in fb else Vector((1, 1, 1)))] for fb in frames_basis])
            path = 'pose.bones["%s"].scale' % nm
            for c in range(3):
                fc = act.fcurve_ensure_for_datablock(arm, path, index=c, group_name=nm)
                fc.keyframe_points.add(nfr)
                fc.keyframe_points.foreach_set('co', np.c_[xs, sa[:, c]].ravel())
                for kp in fc.keyframe_points:
                    kp.interpolation = 'LINEAR'
        path = 'pose.bones["%s"].rotation_quaternion' % nm
        for c in range(4):
            fc = act.fcurve_ensure_for_datablock(arm, path, index=c, group_name=nm)
            fc.keyframe_points.add(nfr)
            fc.keyframe_points.foreach_set('co', np.c_[xs, qa[:, c]].ravel())
            for kp in fc.keyframe_points:
                kp.interpolation = 'LINEAR'
        if nm in loc_bones:
            la = np.array([[*(fb[nm].to_translation() if nm in fb else Vector())] for fb in frames_basis])
            path = 'pose.bones["%s"].location' % nm
            for c in range(3):
                fc = act.fcurve_ensure_for_datablock(arm, path, index=c, group_name=nm)
                fc.keyframe_points.add(nfr)
                fc.keyframe_points.foreach_set('co', np.c_[xs, la[:, c]].ravel())
                for kp in fc.keyframe_points:
                    kp.interpolation = 'LINEAR'
    act.frame_range = (0, max(nfr - 1, 1))
    return act


# ------------------------------------------------------------------ bone heat (Baran & Popovic 2007), our own solve
def cotan_laplacian(P, T):
    """cotangent stiffness (N x N, positive semi-definite form: L = D - W) and lumped vertex areas"""
    import scipy.sparse as sp
    n = len(P)
    I, J, Wv = [], [], []
    area = np.zeros(n)
    for a, b, c in ((0, 1, 2), (1, 2, 0), (2, 0, 1)):
        u = P[T[:, a]] - P[T[:, c]]
        v = P[T[:, b]] - P[T[:, c]]
        cr = np.linalg.norm(np.cross(u, v), axis=1)
        cot = (u * v).sum(1) / np.maximum(cr, 1e-12)
        cot = np.clip(cot, 0.0, 5.0)                     # (obtuse / degenerate triangles: no negative weights)
        I.append(T[:, a]); J.append(T[:, b]); Wv.append(0.5 * cot)
    tri_a = 0.5 * np.linalg.norm(np.cross(P[T[:, 1]] - P[T[:, 0]], P[T[:, 2]] - P[T[:, 0]]), axis=1)
    for k in range(3):
        np.add.at(area, T[:, k], tri_a / 3.0)
    I = np.concatenate(I); J = np.concatenate(J); Wv = np.concatenate(Wv)
    Wm = sp.coo_matrix((np.r_[Wv, Wv], (np.r_[I, J], np.r_[J, I])), shape=(n, n)).tocsr()
    # a small uniform term keeps sliver-only regions connected
    Au = adjacency(n, T) * 1e-3
    Wm = Wm + Au
    Lc = sp.diags(np.asarray(Wm.sum(1)).ravel()) - Wm
    return Lc, np.maximum(area, 1e-10)


def seg_dist(P, a, b):
    d = b - a
    t = np.clip(((P - a) @ d) / max(d @ d, 1e-12), 0, 1)
    return np.linalg.norm(P - (a + t[:, None] * d), axis=1)


def bone_heat(P, T, segs, allowed=None, c=1.0, tie=1.05):
    """P (N,3), T (M,3) tris, segs: list of (head, tail) numpy for the deforming bones.
    allowed: optional (N, B) bool, which bones each vertex may be bound to (our stand-in for the visibility test).
    Returns W (N, B) normalised."""
    import scipy.sparse as sp, scipy.sparse.linalg as sla
    n, B = len(P), len(segs)
    D = np.stack([seg_dist(P, np.asarray(a), np.asarray(b)) for a, b in segs], 1)
    if allowed is not None:
        D = np.where(allowed, D, np.inf)
    dmin = D.min(1)
    near = D <= dmin[:, None] * tie + 1e-9
    near = near / near.sum(1, keepdims=True)
    H = c / np.maximum(dmin, 1e-3) ** 2
    Lc, area = cotan_laplacian(P, T)
    Msys = (Lc + sp.diags(area * H)).tocsc()
    lu = sla.splu(Msys)
    rhs = (area * H)[:, None] * near
    W = np.stack([lu.solve(rhs[:, j]) for j in range(B)], 1)
    W = np.clip(W, 0, None)
    W[W < 1e-3] = 0
    return W / np.maximum(W.sum(1, keepdims=True), 1e-12)
