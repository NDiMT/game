"""EIDOLON a7 (Agent A): pose editing on armature-space pose dicts T {bone: Matrix 4x4} (Blender space), used to key
gestures on top of mocap base poses (heroine_bl_clips.py). All edits keep the hierarchy rigid below the edited bone."""
import math
import numpy as np
from mathutils import Vector, Matrix, Quaternion


class Sk:
    def __init__(self, arm):
        self.rest = {b.name: b.matrix_local.copy() for b in arm.data.bones}
        self.parent = {b.name: (b.parent.name if b.parent else None) for b in arm.data.bones}
        self.order = [b.name for b in arm.data.bones]
        self.kids = {n: [] for n in self.order}
        for n, p in self.parent.items():
            if p:
                self.kids[p].append(n)
        self.len = {b.name: b.length for b in arm.data.bones}

    def desc(self, n):
        out, st = [], [n]
        while st:
            x = st.pop()
            out.append(x)
            st.extend(self.kids[x])
        return out

    # --- local <-> absolute
    def local(self, T):
        B = {}
        for n in self.order:
            p = self.parent[n]
            if p:
                B[n] = (self.rest[p].inverted() @ self.rest[n]).inverted() @ T[p].inverted() @ T[n]
            else:
                B[n] = self.rest[n].inverted() @ T[n]
        return B

    def absolute(self, B):
        T = {}
        for n in self.order:
            p = self.parent[n]
            if p:
                T[n] = T[p] @ (self.rest[p].inverted() @ self.rest[n]) @ B[n]
            else:
                T[n] = self.rest[n] @ B[n]
        return T


def copyT(T):
    return {k: v.copy() for k, v in T.items()}


def lerpB(Ba, Bb, w):
    """blend two local pose dicts (rotation slerp, location lerp; scale lerp)"""
    if w <= 0.0:
        return {k: v.copy() for k, v in Ba.items()}
    if w >= 1.0:
        return {k: v.copy() for k, v in Bb.items()}
    out = {}
    for k in Ba:
        la, ra, sa = Ba[k].decompose()
        lb, rb, sb = Bb[k].decompose()
        if ra.dot(rb) < 0:
            rb = -rb
        out[k] = Matrix.LocRotScale(la.lerp(lb, w), ra.slerp(rb, w), sa.lerp(sb, w))
    return out


def blendT(sk, Ta, Tb, w, bones=None):
    """blend in local space; bones: only these bones take Tb (others keep Ta)"""
    Ba, Bb = sk.local(Ta), sk.local(Tb)
    if bones is None:
        return sk.absolute(lerpB(Ba, Bb, w))
    Bo = {k: v.copy() for k, v in Ba.items()}
    sub = lerpB({k: Ba[k] for k in bones}, {k: Bb[k] for k in bones}, w)
    Bo.update(sub)
    return sk.absolute(Bo)


def rot(sk, T, n, q, w=1.0, pivot=None):
    """rotate bone n (and everything below it) by the world rotation q about its head (or pivot)"""
    if w <= 0:
        return T
    q = Quaternion().slerp(q, w) if w < 1 else q
    R = q.to_matrix().to_4x4()
    p = T[n].translation.copy() if pivot is None else Vector(pivot)
    M = Matrix.Translation(p) @ R @ Matrix.Translation(-p)
    for d in sk.desc(n):
        T[d] = M @ T[d]
    return T


def rot_local(sk, T, n, axis, ang, w=1.0):
    """rotate bone n about one of ITS OWN axes ('x','y','z'), radians"""
    ax = {'x': 0, 'y': 1, 'z': 2}[axis]
    a = T[n].to_3x3().col[ax].normalized()
    return rot(sk, T, n, Quaternion(a, ang * w))


def move(sk, T, n, dv, w=1.0):
    M = Matrix.Translation(Vector(dv) * w)
    for d in sk.desc(n):
        T[d] = M @ T[d]
    return T


def _frame(y, x_hint):
    y = y.normalized()
    x = (x_hint - y * x_hint.dot(y))
    if x.length < 1e-6:
        x = y.orthogonal()
    x.normalize()
    z = x.cross(y)
    return Matrix((x, y, z)).transposed()


def ik_arm(sk, T, side, target, pole, w=1.0, hand_rot=None, max_flex=math.radians(140), stretch=1.0):
    """two-bone IK: the wrist (side Hand head) to target, the elbow toward `pole` (a world point or direction hint).
    hand_rot: an optional world 3x3 for the hand (else it keeps its pose relative to the forearm).
    The upper arm / forearm frames are hinge frames: X = the bend axis (flexion a positive turn), as the rest rolls."""
    if w <= 0:
        return T
    U, F, H = side + 'UpperArm', side + 'LowerArm', side + 'Hand'
    S = T[U].translation.copy()
    l1 = (sk.rest[F].translation - sk.rest[U].translation).length
    l2 = (sk.rest[H].translation - sk.rest[F].translation).length
    tgt = Vector(target)
    d = tgt - S
    dist = d.length
    dist = min(dist, (l1 + l2) * 0.999 * stretch)
    dist = max(dist, abs(l1 - l2) + 1e-3)
    # the elbow's flex keeps under max_flex (reach shorter than that: the wrist stops)
    cmin = math.cos(math.pi - max_flex)
    dmin = math.sqrt(max(l1 * l1 + l2 * l2 - 2 * l1 * l2 * cmin, 1e-6))
    dist = max(dist, dmin)
    dn = d.normalized()
    W = S + dn * dist
    ca = (l1 * l1 + dist * dist - l2 * l2) / (2 * l1 * dist)
    a = math.acos(max(-1.0, min(1.0, ca)))
    pv = Vector(pole)
    pdir = pv - dn * pv.dot(dn)
    if pdir.length < 1e-5:
        pdir = dn.orthogonal()
    pdir.normalize()
    E = S + (dn * math.cos(a) + pdir * math.sin(a)) * l1
    # the hinge: flexion turns the forearm from the upper arm's line toward its front (bone Z): X = Y x Z
    yu = (E - S).normalized()
    yf = (W - E).normalized()
    hinge = yu.cross(yf)
    if hinge.length < 1e-5:
        hinge = T[U].to_3x3().col[0]
    # orientation: flex is a positive turn about X: rotating yu about X by +angle gives yf; X = Z x Y... ensure sign
    hinge.normalize()
    # Blender bone frame: rotating Y about +X moves it toward +Z. y_f = rot(X, +flex) y_u  => X = y_u x y_f / |..| works
    Mu = _frame(yu, hinge)
    Mf = _frame(yf, hinge)
    old = {k: T[k].copy() for k in sk.desc(U)}
    Hrel = old[F].inverted() @ old[H]                   # the hand under the forearm (keeps the wrist pose)
    newU = Mu.to_4x4(); newU.translation = S
    newF = Mf.to_4x4(); newF.translation = E
    Tn = copyT(T)
    Tn[U] = newU
    Tn[F] = newF
    # the forearm's children (twist bone, hand + fingers) follow the forearm rigidly, then the hand may be set
    for k in sk.desc(F):
        if k == F:
            continue
        Tn[k] = newF @ (old[F].inverted() @ old[k])
    if hand_rot is not None:
        Hn = hand_rot.to_4x4(); Hn.translation = Tn[H].translation
        Hold = Tn[H].copy()
        for k in sk.desc(H):
            Tn[k] = Hn @ (Hold.inverted() @ Tn[k])
    if w >= 1.0:
        T.update(Tn)
        return T
    Tb = blendT(sk, T, Tn, w, bones=sk.desc(U))
    T.update(Tb)
    return T


def look_rot(sk, T, side_hand, palm_n, fingers_dir):
    """a world 3x3 for a hand whose palm faces palm_n and fingers point along fingers_dir.
    Hand bone frame: Y along the fingers; palm normal = -Z for the left hand, ... measured from the rest (see palm_axis)."""
    return None


def hand_frame(sk, side, fingers, palm, palm_local):
    """world 3x3 for side's hand: bone Y along `fingers`, its local palm axis `palm_local` (unit, in the bone frame,
    found from the rest) facing the world direction `palm`."""
    y = Vector(fingers).normalized()
    p = Vector(palm)
    p = (p - y * p.dot(y)).normalized()
    # local frame: y_l = (0,1,0), palm_l (perp to y); build both orthonormal frames and map
    pl = Vector(palm_local); pl = (pl - Vector((0, 1, 0)) * pl.y).normalized()
    Lm = Matrix((pl, Vector((0, 1, 0)), pl.cross(Vector((0, 1, 0))))).transposed()
    Wm = Matrix((p, y, p.cross(y))).transposed()
    return Wm @ Lm.inverted()


def smooth_t(t, a, b):
    if b == a:
        return 1.0 if t >= b else 0.0
    x = max(0.0, min(1.0, (t - a) / (b - a)))
    return x * x * (3 - 2 * x)


def env(t, pts):
    """smooth envelope through (t, v) points (smoothstep between keys)"""
    if t <= pts[0][0]:
        return pts[0][1]
    for (t0, v0), (t1, v1) in zip(pts, pts[1:]):
        if t <= t1:
            k = smooth_t(t, t0, t1)
            if isinstance(v0, (int, float)):
                return v0 + (v1 - v0) * k
            return Vector(v0).lerp(Vector(v1), k)
    return pts[-1][1]


def _twist_y(q):
    """twist angle of q about local Y"""
    t = Quaternion((q.w, 0.0, q.y, 0.0))
    if t.magnitude < 1e-9:
        return 0.0
    t.normalize()
    a = 2.0 * math.atan2(t.y, t.w)
    return (a + math.pi) % (2 * math.pi) - math.pi


def anatomy(sk, T, prev=None):
    """keep every limb a hinge and every wrist inside its range, positions kept:
    - the elbow / knee: the upper bone turns about its own axis so its X (the bend axis, as the rest rolls) is the
      bend's axis; the lower bone takes the hinge frame (it only flexes); the hand / foot keep their world rotation
      (the forearm's roll goes to the hand, then onto the twist bone)
    - the hand: its roll on the forearm within +-80 deg, its bend within 70 deg; the foot within 50 / 60 deg
    prev: the previous frame's T (continuity of a near-straight limb's twist)"""
    for side in ('Left', 'Right'):
        for up, lo, end, tw_lim, sw_lim in (('UpperArm', 'LowerArm', 'Hand', math.radians(80), math.radians(70)),
                                            ('UpperLeg', 'LowerLeg', 'Foot', math.radians(50), math.radians(60))):
            U, Lw, E = side + up, side + lo, side + end
            S = T[U].translation; K = T[Lw].translation; W = T[E].translation
            yu = (K - S).normalized(); yl = (W - K).normalized()
            bend = yu.angle(yl, 0.0)
            hx_old = T[U].to_3x3().col[0].normalized()
            h = yu.cross(yl)
            k = smooth_t(bend, math.radians(4), math.radians(15))
            if h.length < 1e-6 or k <= 0.0:
                h = hx_old
            else:
                h.normalize()
                if h.dot(hx_old) < 0.0:          # (the knee bends about -X: keep the bone's own X sense)
                    h = -h
                h = (hx_old * (1 - k) + h * k)
                h = (h - yu * h.dot(yu)).normalized()
            Ru = _frame(yu, h)
            Rl = _frame(yl, h)
            oldE = {d: T[d].copy() for d in sk.desc(E)}
            Mu = Ru.to_4x4(); Mu.translation = S
            Ml = Rl.to_4x4(); Ml.translation = K
            oldL = T[Lw].copy()
            # the lower bone's other children (the twist bone) ride the new lower frame
            for d in sk.desc(Lw):
                if d == Lw or d in oldE:
                    continue
                T[d] = Ml @ (oldL.inverted() @ T[d])
            T[U] = Mu
            T[Lw] = Ml
            # the end keeps its world rotation, inside its range on the new lower bone
            Rrest = (sk.rest[Lw].inverted() @ sk.rest[E]).to_3x3()
            rel = (Rl @ Rrest).inverted() @ oldE[E].to_3x3()
            q = rel.to_quaternion()
            tw = _twist_y(q)
            twq = Quaternion((0, 1, 0), tw)
            swq = twq.inverted() @ q
            if prev is not None:                    # unwrap across +-180 (a clamp there would flip the hand over)
                key = E
                if key in prev:
                    while tw - prev[key] > math.pi:
                        tw -= 2 * math.pi
                    while tw - prev[key] < -math.pi:
                        tw += 2 * math.pi
                prev[key] = tw
            tw = max(-tw_lim, min(tw_lim, tw))
            if swq.angle > sw_lim:
                swq = Quaternion(swq.axis, sw_lim)
            Rh = Rl @ Rrest @ (Quaternion((0, 1, 0), tw) @ swq).to_matrix()
            Mh = Rh.to_4x4(); Mh.translation = Ml @ (sk.rest[Lw].inverted() @ sk.rest[E].translation)
            for d in sk.desc(E):
                T[d] = Mh @ (oldE[E].inverted() @ oldE[d])
    return T
