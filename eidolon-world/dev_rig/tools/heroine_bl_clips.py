"""EIDOLON a7 (Agent A): the heroine's clip library, keyed on retargeted CC0 mocap (Quaternius UAL 1/2).

Every clip is a function of time returning a full body pose (armature-space matrices, Blender space); mocap segments
are re-timed so each clip keeps the length / hold point / events W's code already waits on (HeroineClips), and
gestures the library lacks are keyed on top of a mocap base pose with a small analytic IK (bl_pose.ik_arm).
The runtime only corrects the hand from the authored default target ("@" = AT_DEFAULT) onto the real one.

Coordinates: M(x, y, z) takes HER MODEL SPACE as the old clips wrote it (+z forward, +x her left, y up, metres of the
1.7 m rig) into Blender space (x, -z, y).
"""
import math
from mathutils import Vector, Matrix, Quaternion
import bl_pose as P
from bl_pose import env, smooth_t

def M(x, y, z):
    return Vector((x, -z, y))

S_MIR = Matrix.Diagonal((-1.0, 1.0, 1.0, 1.0))

def mir_name(n):
    if n.startswith('Left'):
        return 'Right' + n[4:]
    if n.startswith('Right'):
        return 'Left' + n[5:]
    return n

def mirror(T):
    return {mir_name(n): S_MIR @ m @ S_MIR for n, m in T.items()}

# her default targets (model space, as the old HeroineRig.AT_DEFAULT) and surface normals (toward her)
AT = {
    'reach': M(-0.12, 1.12, 0.44), 'pickup': M(-0.10, 0.10, 0.34), 'kneel_touch': M(-0.08, 0.10, 0.56),
    'touch_glass': M(-0.10, 1.20, 0.40), 'kneel_reach': M(-0.10, 0.12, 0.78), 'push': M(0.0, 0.92, 0.46),
    'light_with_lamp': M(-0.15, 0.95, 0.62), 'untie_cleat': M(-0.08, 1.05, 0.42), 'reach_high': M(-0.10, 2.05, 0.30),
    'reach_fail_shake': M(-0.10, 2.20, 0.32), 'knock_glass_twice': M(-0.10, 1.30, 0.42), 'climb_block': M(0.0, 0.60, 0.40),
    'ring_bell': M(-0.12, 1.75, 0.30), 'reach_low': M(-0.12, 0.45, 0.50), 'palm_to_palm': M(-0.10, 0.12, 0.78),
    'hang_weight': M(0.0, 2.0, 0.30), 'turn_half': M(0.0, 0.10, 0.62), 'shard_eye': M(-0.05, 1.50, 0.16),
}
NRM = {'touch_glass': M(0, 0, -1), 'kneel_touch': M(0, 1, 0), 'kneel_reach': M(0, 1, 0), 'push': M(0, 0, -1),
       'knock_glass_twice': M(0, 0, -1), 'reach_low': M(0, 1, 0), 'palm_to_palm': M(0, 1, 0), 'turn_half': M(0, 1, 0)}


class Lib:
    def __init__(self, ctx):
        self.c = ctx
        self.sk = ctx['sk']
        self._cache = {}
        self.clips = {}

    # ------------------------------------------------------------ bases
    def mo(self, key, act, t, mirror_lr=False):
        """the retargeted mocap pose of `act` at source time t (s), feminised; mirror_lr swaps her sides"""
        k = (key, act, int(round(t * 240)), mirror_lr)
        if k not in self._cache:
            T = self.c['sample'](key, act, t)
            if mirror_lr:
                T = mirror(T)
            self.fem(T)
            self._cache[k] = T
        return P.copyT(self._cache[k])

    def dur(self, key, act):
        return self.c['dur'](key, act)

    def idle(self, t):
        return self.mo('ual1', 'Idle_Loop', t % self.dur('ual1', 'Idle_Loop'))

    def fem(self, T, k=1.0):
        """her bearing: the arms in closer to the body and the stance narrower than the (male) mannequin's"""
        sk = self.sk
        for sd, sg in (('Left', 1), ('Right', -1)):
            S = T[sd + 'UpperArm'].translation; E = T[sd + 'LowerArm'].translation
            d = (E - S).normalized()
            hang = smooth_t(-d.z, 0.35, 0.8)
            if hang > 0:
                dt = Vector((d.x * 0.72, d.y, d.z)).normalized()
                P.rot(sk, T, sd + 'UpperArm', d.rotation_difference(dt), hang * k)
            Hh = T[sd + 'UpperLeg'].translation; K = T[sd + 'LowerLeg'].translation
            dl = (K - Hh).normalized()
            if dl.z < -0.5:
                dt = Vector((dl.x * 0.55 - sg * 0.025, dl.y, dl.z)).normalized()
                P.rot(sk, T, sd + 'UpperLeg', dl.rotation_difference(dt), k)
        return T

    # ------------------------------------------------------------ edits
    def look(self, T, pt, w=1.0, lim=1.2):
        """turn the neck and head so her face looks at the point"""
        if w <= 0:
            return T
        for bn, share in (('Neck', 0.4), ('Head', 1.0)):
            f = T['Head'].to_3x3().col[2].normalized()
            h = T['Head'].translation + T['Head'].to_3x3().col[1] * 0.06
            d = (Vector(pt) - h).normalized()
            q = f.rotation_difference(d)
            ang = min(q.angle, lim)
            q = Quaternion(q.axis, ang) if q.angle > 1e-6 else Quaternion()
            P.rot(self.sk, T, bn, q, w * share)
        return T

    def spine(self, T, fwd=0.0, side=0.0, twist=0.0, w=1.0):
        """bend the spine (radians over Spine/Chest/UpperChest): fwd = bow forward, side = toward her left, twist = to her left"""
        if w <= 0:
            return T
        for bn, k in (('Spine', 0.3), ('Chest', 0.35), ('UpperChest', 0.35)):
            R = T[bn].to_3x3()
            q = Quaternion(R.col[0].normalized(), fwd * k * w) @ Quaternion(R.col[2].normalized(), -side * k * w) @ Quaternion(R.col[1].normalized(), twist * k * w)
            P.rot(self.sk, T, bn, q)
        return T

    def hips(self, T, dz=0.0, dfwd=0.0, dside=0.0, w=1.0):
        return P.move(self.sk, T, 'Hips', Vector((dside, -dfwd, dz)) * w)

    def arm(self, T, side, tgt, pole, w=1.0, palm=None, fingers=None, maxflex=math.radians(140)):
        hr = None
        if palm is not None:
            fd = fingers if fingers is not None else (Vector(tgt) - T[side + 'UpperArm'].translation)
            pl = Vector((1, 0, 0)) if side == 'Left' else Vector((-1, 0, 0))
            hr = P.hand_frame(self.sk, side, fd, palm, pl)
        return P.ik_arm(self.sk, T, side, tgt, pole, w, hand_rot=hr, max_flex=maxflex)

    def curl(self, T, side, a, w=1.0):
        """curl the fingers (radians per joint about their bend axis)"""
        for bn in (side + 'Fingers1', side + 'Fingers2'):
            P.rot_local(self.sk, T, bn, 'x', a, w)
        return T

    def wrist(self, T, side, flex=0.0, dev=0.0, w=1.0):
        P.rot_local(self.sk, T, side + 'Hand', 'x', flex, w)
        P.rot_local(self.sk, T, side + 'Hand', 'z', dev, w)
        return T

    def blend(self, Ta, Tb, w, bones=None):
        return P.blendT(self.sk, Ta, Tb, max(0.0, min(1.0, w)), bones)

    def warp(self, t, pts):
        """piecewise-linear time map (out t -> source t)"""
        if t <= pts[0][0]:
            return pts[0][1]
        for (a, sa), (b, sb) in zip(pts, pts[1:]):
            if t <= b:
                return sa + (sb - sa) * (t - a) / (b - a)
        return pts[-1][1]

    def swarp(self, t, pts):
        """eased time map: each segment eased in-out (no velocity jump at the keys)"""
        if t <= pts[0][0]:
            return pts[0][1]
        for (a, sa), (b, sb) in zip(pts, pts[1:]):
            if t <= b:
                return sa + (sb - sa) * smooth_t(t, a, b)
        return pts[-1][1]

    def add(self, name, length, fn, **meta):
        meta.update(len=length)
        self.clips[name] = (fn, meta)

    # ------------------------------------------------------------ the arm arcs used by many clips
    POLE_R = Vector((-0.7, 0.45, -0.55))     # her right elbow: out, back, down
    POLE_L = Vector((0.7, 0.45, -0.55))

    def build(self):
        c = self
        I1, I2 = 'ual1', 'ual2'
        ID = c.dur(I1, 'Idle_Loop')
        sk = self.sk

        # ---------------------------------------------------------------- locomotion
        c.add('idle', ID, lambda t: c.idle(t), loop=True)
        WD = c.dur(I1, 'Walk_Loop')
        ARMS = [b for b in sk.order if any(k in b for k in ('Shoulder', 'Arm', 'Hand', 'Fingers', 'ForeTwist'))]

        def walk(t):
            T = c.mo(I1, 'Walk_Loop', t % WD)
            # a longer, gliding stride (her speed is high for her size): the legs' swing x1.3, the knees x1.12,
            # the hips a little lower to keep the feet on the floor
            B = sk.local(T)
            for sd in ('Left', 'Right'):
                for bn, f in (('UpperLeg', 1.3), ('LowerLeg', 1.12)):
                    l_, q_, s_ = B[sd + bn].decompose()
                    e = q_.to_euler('XYZ'); e.x *= f
                    B[sd + bn] = Matrix.LocRotScale(l_, e.to_quaternion(), s_)
            T = sk.absolute(B)
            c.hips(T, dz=-0.012)
            # a calmer arm swing than the mannequin's: the arms part-way to her idle hang
            T = c.blend(T, c.idle(1.0), 0.4, bones=ARMS)
            return T
        c.add('walk', WD, walk, loop=True)

        # ---------------------------------------------------------------- idle variants (head tilt; the fingers)
        def idle_tilt(t):
            T = c.idle(t)
            k = env(t, [(0, 0), (2.6, 1), (4.2, 1.08), (4.5, 0.15), (6.0, 0)])
            hd = T['Head'].to_3x3()
            P.rot(sk, T, 'Neck', Quaternion(hd.col[1].normalized(), 0.10 * k) @ Quaternion(hd.col[2].normalized(), -0.18 * k), 1.0)
            P.rot(sk, T, 'Head', Quaternion(T['Head'].to_3x3().col[2].normalized(), -0.22 * k) @ Quaternion(T['Head'].to_3x3().col[0].normalized(), 0.08 * k))
            return T
        c.add('idle_tilt', 6.0, idle_tilt, idle=True, blend=[0.8, 0.6])

        def idle_fingers(t):
            T = c.idle(t)
            k = env(t, [(0, 0), (1.2, 1), (3.3, 1), (5.0, 0)])
            h0 = T['RightHand'].translation
            tgt = M(-0.20, 0.92, 0.22)
            c.arm(T, 'Right', h0.lerp(tgt, 1.0), c.POLE_R, k)
            tw = env(t, [(1.2, 0), (1.55, 0.6), (1.75, 0.1), (2.35, 0.7), (2.5, 0.35), (2.62, 0.8), (3.3, 0.15), (5.0, 0)])
            c.curl(T, 'Right', 0.55 * tw)
            c.wrist(T, 'Right', 0.25 * tw)
            c.look(T, T['RightHand'].translation, 0.75 * k)
            return T
        c.add('idle_fingers', 5.0, idle_fingers, idle=True, blend=[0.6, 0.6])

        # ---------------------------------------------------------------- reach (Interact, mirrored: her right hand)
        IA = 'Interact'
        def reach(t):
            st = c.swarp(t, [(0.0, 0.25), (0.42, 0.95), (0.62, 1.15), (1.25, 2.0)])
            T = c.mo(I1, IA, st, True)
            k = env(t, [(0.05, 0), (0.42, 1), (0.62, 1), (1.1, 0)])
            c.arm(T, 'Right', AT['reach'], c.POLE_R, k, palm=M(0, 0, 1), fingers=M(0, 0.15, 1))
            c.look(T, AT['reach'], 0.6 * k)
            return T
        c.add('reach', 1.25, reach, blend=[0.15, 0.25], ev={'contact': 0.42},
              ik=[dict(side='R', t=[0.05, 0.42, 0.62, 1.1])])

        # ---------------------------------------------------------------- pickup (Farm_PlantSeed: down, the right hand to the floor)
        def pickup(t):
            st = c.swarp(t, [(0.0, 0.0), (0.75, 1.75), (1.05, 2.05), (2.1, 3.2)])
            T = c.mo(I2, 'Farm_PlantSeed', st)
            k = env(t, [(0.25, 0), (0.75, 1), (1.0, 1), (1.45, 0)])
            c.arm(T, 'Right', AT['pickup'] + M(0, 0.02, 0), c.POLE_R, k, palm=M(0, -1, 0.2), fingers=M(0, -0.3, 1))
            c.curl(T, 'Right', env(t, [(0.6, 0.1), (0.8, 0.9), (1.4, 0.7), (2.1, 0.1)]))
            c.look(T, AT['pickup'], 0.7 * env(t, [(0.2, 0), (0.6, 1), (1.2, 1), (1.7, 0)]))
            return T
        c.add('pickup', 2.1, pickup, blend=[0.2, 0.3], ev={'grab': 0.75}, ik=[dict(side='R', t=[0.25, 0.75, 1.0, 1.45])])

        # ---------------------------------------------------------------- kneel (Fixing_Kneeling) and the kneeling clips
        KN = 'Fixing_Kneeling'
        KD = c.dur(I1, KN)
        def kneel_base(t, down, up_from, end):
            """kneel down over [0, down] (the mocap's own), kneel still, rise over [up_from, end] (cross-faded)"""
            def held(tt):
                if tt < down:
                    return c.swarp(tt, [(0.0, 0.0), (down, 0.95)])
                return 0.95 + 0.12 * (tt - down) / max(up_from - down, 1e-3)
            if t < up_from:
                return c.mo(I1, KN, held(t))
            Tr = c.mo(I1, KN, c.swarp(t, [(up_from, 5.25), (end, min(KD, 6.15))]))
            Th = c.mo(I1, KN, held(up_from))
            return c.blend(Th, Tr, smooth_t(t, up_from, up_from + 0.4))

        def kneel_touch(t):
            T = kneel_base(t, 1.0, 2.2, 3.2)
            k = env(t, [(0.6, 0), (1.35, 1), (2.1, 1), (2.6, 0)])
            c.spine(T, fwd=0.25 * k)
            c.arm(T, 'Right', AT['kneel_touch'] + M(0, 0.03, 0), c.POLE_R, k, palm=M(0, -1, 0), fingers=M(0, -0.2, 1))
            c.look(T, AT['kneel_touch'], 0.8 * k)
            return T
        c.add('kneel_touch', 3.2, kneel_touch, hold_t=1.7, blend=[0.2, 0.3], ev={'touch': 1.35}, ik=[dict(side='R', t=[0.6, 1.35, 2.1, 2.6])])

        def kneel_reach(t):
            T = kneel_base(t, 1.2, 3.0, 4.0)
            k = env(t, [(0.8, 0), (1.9, 1), (2.8, 1), (3.3, 0)])
            c.hips(T, dfwd=0.10 * k, dz=-0.02 * k)
            c.spine(T, fwd=0.55 * k)
            c.arm(T, 'Right', AT['kneel_reach'] + M(0, 0.03, 0), c.POLE_R, k, palm=M(0, -1, 0), fingers=M(0, -0.1, 1))
            c.arm(T, 'Left', M(0.22, 0.10, 0.42), c.POLE_L, 0.8 * k, palm=M(0, -1, 0), fingers=M(0.1, -0.1, 1))
            c.look(T, AT['kneel_reach'], 0.8 * k)
            return T
        c.add('kneel_reach', 4.0, kneel_reach, hold_t=2.4, blend=[0.25, 0.3], ev={'reach': 1.9}, ik=[dict(side='R', t=[0.8, 1.9, 2.8, 3.3])])

        def palm_to_palm(t):
            T = kneel_base(t, 1.2, 3.0, 4.0)
            k = env(t, [(0.8, 0), (1.9, 1), (2.8, 1), (3.3, 0)])
            c.hips(T, dfwd=0.14 * k, dz=-0.01 * k)
            c.spine(T, fwd=0.70 * k)
            c.arm(T, 'Right', AT['palm_to_palm'] + M(0, 0.02, 0), c.POLE_R, k, palm=M(0, -1, 0), fingers=M(0, -0.05, 1))
            c.arm(T, 'Left', M(0.22, 0.10, 0.42), c.POLE_L, 0.85 * k, palm=M(0, -1, 0), fingers=M(0.1, -0.1, 1))
            c.look(T, AT['palm_to_palm'], 0.9 * k)
            return T
        c.add('palm_to_palm', 4.0, palm_to_palm, hold_t=2.4, blend=[0.25, 0.3], ev={'palm': 1.9}, ik=[dict(side='R', t=[0.8, 1.9, 2.8, 3.3])])

        def turn_half(t):
            T = kneel_base(t, 0.95, 2.85, 3.6)
            on = env(t, [(0.4, 0), (0.95, 1), (2.45, 1), (2.85, 0)])
            a = env(t, [(1.25, 0.0), (2.25, 1.0)])
            at = AT['turn_half']
            ang = math.radians(-55) * a
            def around(off):
                return at + Quaternion(Vector((0, 0, 1)), ang) @ off
            c.spine(T, fwd=0.55 * on, twist=-0.35 * a * on)
            c.arm(T, 'Right', around(Vector((-0.22, 0.06, 0.03))), c.POLE_R, on, palm=M(0, -1, 0), fingers=M(0.2, -0.1, 1))
            c.arm(T, 'Left', around(Vector((0.22, 0.06, 0.03))), c.POLE_L, on, palm=M(0, -1, 0), fingers=M(-0.2, -0.1, 1))
            c.look(T, at, 0.8 * on)
            return T
        c.add('turn_half', 3.6, turn_half, blend=[0.25, 0.35], ev={'turn': 1.25, 'set': 2.25},
              ik=[dict(side='R', t=[0.4, 0.95, 2.45, 2.85], off=[-0.22, 0.03, -0.06]), dict(side='L', t=[0.4, 0.95, 2.45, 2.85], off=[0.22, 0.03, -0.06])])

        # ---------------------------------------------------------------- standing hand-on-a-surface gestures
        def stand_reach(name, length, tgt, kpts, palm, fingers, lean=0.0, look=0.7, extra=None, side='Right', toes=0.0):
            def f(t):
                T = c.idle(t + 0.4)
                k = env(t, kpts)
                if toes:
                    c.hips(T, dz=toes * k)
                    for sd in ('Left', 'Right'):
                        P.rot_local(sk, T, sd + 'Foot', 'x', -toes * 4.5 * k)
                c.spine(T, fwd=lean * k)
                tt = tgt(t) if callable(tgt) else tgt
                c.arm(T, side, tt, c.POLE_R if side == 'Right' else c.POLE_L, k, palm=palm, fingers=fingers)
                c.curl(T, side, -0.12 * k)
                if extra:
                    extra(T, t, k)
                c.look(T, tt, look * k)
                return T
            return f

        c.add('touch_glass', 2.4, stand_reach('touch_glass', 2.4, AT['touch_glass'] + M(0, 0, -0.01),
              [(0.1, 0), (0.95, 1), (1.6, 1), (2.25, 0)], M(0, 0, 1), M(0.05, 0.5, 0.2), lean=0.08),
              hold_t=1.2, blend=[0.2, 0.3], ev={'touch': 0.95}, ik=[dict(side='R', t=[0.1, 0.95, 1.6, 2.25])])

        def knock_t(t):
            b = env(t, [(0.45, 0), (0.6, 1), (0.75, 0), (0.85, 1), (0.95, 0)])
            return AT['knock_glass_twice'] + M(0, 0, -0.06 + 0.06 * (1 - b))
        def knock_x(T, t, k):
            b = env(t, [(0.45, 0), (0.55, 1), (0.6, 0), (0.8, 1), (0.95, 0)])
            c.curl(T, 'Right', 0.9 * k)
            c.wrist(T, 'Right', -0.25 * b * k)
        c.add('knock_glass_twice', 1.9, stand_reach('knock', 1.9, knock_t, [(0.05, 0), (0.45, 1), (1.1, 1), (1.75, 0)],
              M(0.6, 0, 1), M(0.2, 0.6, 0.6), lean=0.06, extra=knock_x),
              blend=[0.2, 0.3], ev={'knock1': 0.6, 'knock2': 0.95}, ik=[dict(side='R', t=[0.05, 0.45, 1.1, 1.75])])

        def high_x(T, t, k):
            c.spine(T, fwd=-0.12 * k)
        c.add('reach_high', 2.0, stand_reach('reach_high', 2.0, AT['reach_high'], [(0.05, 0), (0.8, 1), (1.3, 1), (1.85, 0)],
              M(0, 1, 0.6), M(0, 1, 0.1), toes=0.045, look=0.8, extra=high_x),
              hold_t=1.0, blend=[0.2, 0.3], ev={'contact': 0.8}, ik=[dict(side='R', t=[0.05, 0.8, 1.3, 1.85])])

        def fail_t(t):
            short = env(t, [(0.8, 0.0), (1.5, 0.35)])
            return AT['reach_fail_shake'] + M(0, -0.30 - short, 0)
        def fail_x(T, t, k):
            c.spine(T, fwd=-0.12 * k)
            s = env(t, [(1.6, 0), (1.9, 1), (2.9, 1), (3.1, 0)])
            ph = math.sin((t - 1.6) * 2 * math.pi * 1.6) if t > 1.6 else 0.0
            P.rot(sk, T, 'Neck', Quaternion(T['Neck'].to_3x3().col[1].normalized(), 0.28 * ph * s))
            P.rot(sk, T, 'Head', Quaternion(T['Head'].to_3x3().col[0].normalized(), 0.18 * s))
        c.add('reach_fail_shake', 3.2, stand_reach('fail', 3.2, fail_t, [(0.05, 0), (0.8, 1), (1.2, 1), (1.8, 0)],
              M(0, 1, 0.6), M(0, 1, 0.1), toes=0.05, look=0.8, extra=fail_x),
              blend=[0.2, 0.35], ev={'short': 0.8, 'drop': 1.5}, ik=[dict(side='R', t=[0.05, 0.8, 1.2, 1.8], off_free=True)])

        def bell_t(t):
            p = env(t, [(0.8, 0), (0.95, 1), (1.2, 0), (1.4, 0), (1.55, 1), (1.8, 0)])
            return AT['ring_bell'] + M(0, -0.10 * p, 0)
        def bell_x(T, t, k):
            c.curl(T, 'Right', 1.1 * k)
        c.add('ring_bell', 2.6, stand_reach('bell', 2.6, bell_t, [(0.05, 0), (0.7, 1), (1.9, 1), (2.45, 0)],
              M(0.8, 0, 0.3), M(0, 1, 0.2), toes=0.02, look=0.8, extra=bell_x),
              blend=[0.2, 0.3], ev={'ring': 0.95, 'ring2': 1.55}, ik=[dict(side='R', t=[0.05, 0.7, 1.9, 2.45])])

        # reach_low: PickUp_Table (mirrored), deeper: the knees give, the right hand to "@"
        def reach_low(t):
            st = c.swarp(t, [(0.0, 0.0), (0.8, 0.4), (1.3, 0.5), (2.0, 1.0)])
            T = c.mo(I1, 'PickUp_Table', st, True)
            k = env(t, [(0.1, 0), (0.8, 1), (1.3, 1), (1.85, 0)])
            c.hips(T, dz=-0.10 * k, dfwd=-0.03 * k)
            for sd in ('Left', 'Right'):
                P.rot_local(sk, T, sd + 'UpperLeg', 'x', 0.35 * k)
                P.rot_local(sk, T, sd + 'LowerLeg', 'x', -0.62 * k)
                P.rot_local(sk, T, sd + 'Foot', 'x', 0.27 * k)
            c.spine(T, fwd=0.35 * k)
            c.arm(T, 'Right', AT['reach_low'] + M(0, 0.03, 0), c.POLE_R, k, palm=M(0, -1, 0), fingers=M(0, -0.3, 1))
            c.look(T, AT['reach_low'], 0.8 * k)
            return T
        c.add('reach_low', 2.0, reach_low, hold_t=1.0, blend=[0.2, 0.3], ev={'contact': 0.8}, ik=[dict(side='R', t=[0.1, 0.8, 1.3, 1.85])])

        # ---------------------------------------------------------------- push (Push_Loop: in, a shove, out)
        def push(t):
            Ti = c.idle(t)
            st = c.swarp(t, [(0.0, 0.0), (0.45, 0.2), (0.6, 0.5), (1.5, 1.6)])
            Tp = c.mo(I1, 'Push_Loop', st)
            k = env(t, [(0.0, 0), (0.45, 1), (1.5, 1), (2.0, 0)])
            T = c.blend(Ti, Tp, k)
            ka = env(t, [(0.1, 0), (0.45, 1), (1.5, 1), (1.9, 0)])
            for sd, x in (('Right', -0.17), ('Left', 0.17)):
                c.arm(T, sd, AT['push'] + Vector((x, 0.06, 0.12)), c.POLE_R if sd == 'Right' else c.POLE_L, ka,
                      palm=M(0, 0, 1), fingers=M(0, 1, 0.2))
            return T
        c.add('push', 2.0, push, blend=[0.2, 0.35], ev={'contact': 0.45, 'shove': 0.6, 'done': 1.5},
              ik=[dict(side='R', t=[0.1, 0.45, 1.5, 1.9], off=[-0.17, 0.12, -0.06]), dict(side='L', t=[0.1, 0.45, 1.5, 1.9], off=[0.17, 0.12, -0.06])])

        # ---------------------------------------------------------------- holds (upper-body layers) and their actions
        LD = c.dur(I2, 'Idle_Lantern_Loop')
        def lamp_pose(t):
            T = c.mo(I2, 'Idle_Lantern_Loop', t % LD)
            # the lamp carried a little lower and nearer than the mannequin's lantern, the elbow soft
            c.arm(T, 'Right', T['RightHand'].translation.lerp(M(-0.22, 1.08, 0.30), 0.6), c.POLE_R, 1.0)
            c.curl(T, 'Right', 0.7)
            return T
        c.add('hold_lamp', 4.0, lambda t: lamp_pose(t * LD / 4.0), loop=True, blend=[0.45, 0.45], layer='arm_r')

        TD = c.dur(I1, 'Idle_Torch_Loop')
        def raise_pose(t):
            T = c.mo(I1, 'Idle_Torch_Loop', t % TD, True)
            c.curl(T, 'Right', 0.8)
            return T
        c.add('hold_raise_shard', 4.0, lambda t: raise_pose(t * TD / 4.0), loop=True, blend=[0.45, 0.4], layer='arm_r')

        def shard_pose(t):
            T = c.idle(t)
            h = M(-0.14, 0.98, 0.26) + M(0, 0.01 * math.sin(t * 1.6), 0)
            c.arm(T, 'Right', h, c.POLE_R, 1.0, palm=M(0.8, 0.7, 0.1), fingers=M(0.25, 0.0, 1))
            c.curl(T, 'Right', 0.55)
            return T
        c.add('hold_shard', 4.0, shard_pose, loop=True, blend=[0.4, 0.4], layer='arm_r')

        def light(t):
            Tl = lamp_pose(t)
            k = env(t, [(0.1, 0), (1.05, 1), (1.6, 1), (2.45, 0)])
            c.spine(Tl, fwd=0.12 * k)
            c.arm(Tl, 'Right', AT['light_with_lamp'], c.POLE_R, k)
            c.look(Tl, AT['light_with_lamp'], 0.8 * k)
            return Tl
        c.add('light_with_lamp', 2.6, light, hold_t=1.3, blend=[0.25, 0.35], ev={'light': 1.05}, ik=[dict(side='R', t=[0.1, 1.05, 1.6, 2.45])])

        CD = c.dur(I2, 'Consume')
        def shard_eye(t):
            st = c.swarp(t, [(0.0, 0.0), (0.9, 0.6), (1.7, 1.15), (2.6, CD)])
            T = c.mo(I2, 'Consume', st, True)
            k = env(t, [(0.2, 0), (0.9, 1), (1.7, 1), (2.4, 0)])
            c.arm(T, 'Right', AT['shard_eye'], Vector((-0.6, 0.2, -1)), k, palm=M(0.2, 0, -1), fingers=M(0.4, 1, 0))
            c.curl(T, 'Right', 0.6 * k)
            return T
        c.add('shard_eye', 2.6, shard_eye, hold_t=1.3, blend=[0.2, 0.3], ev={'at_eye': 0.9}, ik=[dict(side='R', t=[0.2, 0.9, 1.7, 2.4])])

        # ---------------------------------------------------------------- untie (both hands at the cleat, three wraps)
        def untie(t):
            st = c.swarp(t, [(0.0, 0.25), (0.45, 0.9), (2.25, 1.1), (3.0, 2.0)])
            T = c.mo(I1, 'Interact', st, True)
            k = env(t, [(0.05, 0), (0.45, 1), (2.25, 1), (2.85, 0)])
            ph = (t - 0.45) / 0.5 * 2 * math.pi
            wr = env(t, [(0.45, 0), (0.6, 1), (2.1, 1), (2.25, 0)])
            o = Vector((0.03 * math.cos(ph), 0.0, 0.035 * math.sin(ph))) * wr
            c.spine(T, fwd=0.18 * k)
            c.arm(T, 'Right', AT['untie_cleat'] + Vector((-0.04, 0, 0)) + o, c.POLE_R, k, palm=M(0.8, 0, 0.5), fingers=M(0, 0, 1))
            c.arm(T, 'Left', AT['untie_cleat'] + Vector((0.07, 0.01, 0.02)) - o * 0.5, c.POLE_L, k, palm=M(-0.8, 0, 0.5), fingers=M(0, 0, 1))
            c.curl(T, 'Right', 0.8 * k); c.curl(T, 'Left', 0.8 * k)
            c.look(T, AT['untie_cleat'], 0.8 * k)
            return T
        c.add('untie_cleat', 3.0, untie, blend=[0.2, 0.3], ev={'grip': 0.45, 'wrap1': 0.8, 'wrap2': 1.3, 'wrap3': 1.8, 'free': 2.25},
              ik=[dict(side='R', t=[0.05, 0.45, 2.25, 2.85], off=[-0.04, 0, 0]), dict(side='L', t=[0.05, 0.45, 2.25, 2.85], off=[0.07, 0.02, -0.01])])

        # ---------------------------------------------------------------- hang a weight (both hands up to "@")
        def hang(t):
            T = c.idle(t)
            k = env(t, [(0.0, 0.2), (1.0, 1), (1.6, 1), (2.6, 0)])
            up = env(t, [(0.0, 0), (1.0, 1), (1.3, 1.0), (1.6, 0.55), (2.6, 0)])
            c.hips(T, dz=0.04 * up)
            for sd in ('Left', 'Right'):
                P.rot_local(sk, T, sd + 'Foot', 'x', -0.2 * up)
            c.spine(T, fwd=-0.10 * up)
            for sd, x in (('Right', -0.07), ('Left', 0.07)):
                tgt = AT['hang_weight'] + Vector((x, 0, -0.06))
                low = M(x * 1.4, 1.0, 0.30)
                c.arm(T, sd, low.lerp(tgt, up), c.POLE_R if sd == 'Right' else c.POLE_L, k,
                      palm=Vector((-x, 0, 0)) * 10, fingers=M(0, 1, 0.2))
                c.curl(T, sd, 0.7 * k)
            c.look(T, AT['hang_weight'], 0.7 * up)
            return T
        c.add('hang_weight', 2.8, hang, blend=[0.2, 0.3], ev={'hung': 1.3},
              ik=[dict(side='R', t=[0.3, 1.0, 1.3, 1.9], off=[-0.07, -0.06, 0]), dict(side='L', t=[0.3, 1.0, 1.3, 1.9], off=[0.07, -0.06, 0])])

        # ---------------------------------------------------------------- sit on a bench (Sitting_Enter / Idle / Exit)
        SE, SX = c.dur(I1, 'Sitting_Enter'), c.dur(I1, 'Sitting_Exit')
        SI = c.dur(I1, 'Sitting_Idle_Loop')
        def sit(t):
            if t < 1.4:
                return c.mo(I1, 'Sitting_Enter', c.swarp(t, [(0.0, 0.0), (1.4, SE)]))
            if t < 3.4:
                return c.mo(I1, 'Sitting_Idle_Loop', (t - 1.4) % SI)
            return c.mo(I1, 'Sitting_Exit', c.swarp(t, [(3.4, 0.0), (4.4, SX)]))
        c.add('sit_bench', 4.4, sit, hold_t=2.4, blend=[0.3, 0.4], ev={'seated': 1.4})

        # ---------------------------------------------------------------- hide at a column (back to it, palms flat behind)
        def hide(t):
            T = c.idle(t)
            k = env(t, [(0.0, 0), (0.7, 1), (2.6, 1), (4.0, 0)])
            c.hips(T, dfwd=-0.04 * k)
            c.spine(T, fwd=-0.10 * k)
            for sd, x in (('Right', -0.17), ('Left', 0.17)):
                c.arm(T, sd, M(x, 0.86, -0.13), Vector((x * 4, 0.8, -0.3)), k, palm=M(0, 0, 1), fingers=M(0, -1, -0.2))
            look = env(t, [(0.6, 0), (1.6, 1), (2.6, 0.92), (3.6, 0)])
            c.look(T, M(1.5, 1.45, 0.4), 0.85 * look)
            return T
        c.add('hide_column', 4.0, hide, hold_t=2.6, blend=[0.25, 0.4], ev={'pressed': 0.7})

        # ---------------------------------------------------------------- flinch (Hit_Head, both hands come up) / recoil
        HH = c.dur(I1, 'Hit_Head')
        def flinch(t):
            st = c.swarp(t, [(0.0, 0.0), (0.22, HH * 0.45), (0.8, HH * 0.6), (2.2, HH)])
            T = c.mo(I1, 'Hit_Head', st)
            k = env(t, [(0.0, 0), (0.22, 1), (0.8, 1), (2.0, 0)])
            c.spine(T, twist=-0.25 * k, fwd=0.12 * k)
            c.arm(T, 'Right', M(-0.10, 1.36, 0.26), c.POLE_R, k, palm=M(0, 0, 1), fingers=M(0, 1, 0.2))
            c.arm(T, 'Left', M(0.08, 1.42, 0.24), c.POLE_L, k, palm=M(0, 0, 1), fingers=M(0, 1, 0.2))
            P.rot(sk, T, 'Head', Quaternion(Vector((0, 0, 1)), -0.45 * k))
            return T
        c.add('flinch_seen', 2.2, flinch, blend=[0.08, 0.4], ev={'flinch': 0.1})

        HC = c.dur(I1, 'Hit_Chest')
        def recoil(t):
            st = c.swarp(t, [(0.0, 0.0), (0.3, HC * 0.5), (1.4, HC * 0.62), (3.2, HC)])
            T = c.mo(I1, 'Hit_Chest', st)
            k = env(t, [(0.0, 0), (0.3, 1), (1.4, 1), (3.0, 0)])
            c.hips(T, dfwd=-0.05 * k)
            c.spine(T, fwd=-0.12 * k, twist=0.15 * k)
            c.arm(T, 'Right', M(-0.12, 1.22, 0.24), c.POLE_R, 0.85 * k, palm=M(0, 0, 1), fingers=M(0, 1, 0.2))
            c.arm(T, 'Left', M(0.10, 1.10, 0.22), c.POLE_L, 0.6 * k, palm=M(0, 0, 1), fingers=M(0, 1, 0.2))
            P.rot(sk, T, 'Head', Quaternion(Vector((0, 0, 1)), 0.3 * k))
            return T
        c.add('recoil', 3.2, recoil, hold_t=1.4, blend=[0.08, 0.4], ev={'flinch': 0.12})

        # ---------------------------------------------------------------- statue-still (hands clasped at the chest, head bowed)
        def still(t):
            T = c.idle(t * 0.5)
            k = env(t, [(0.0, 0), (1.2, 1), (2.2, 1), (3.6, 0)])
            c.spine(T, fwd=0.06 * k)
            c.arm(T, 'Right', M(-0.03, 1.20, 0.21), c.POLE_R, k, palm=M(1, 0, 0.3), fingers=M(0.3, 1, 0.3))
            c.arm(T, 'Left', M(0.03, 1.22, 0.20), c.POLE_L, k, palm=M(-1, 0, 0.3), fingers=M(-0.3, 1, 0.3))
            c.curl(T, 'Right', 0.5 * k); c.curl(T, 'Left', 0.5 * k)
            P.rot(sk, T, 'Head', Quaternion(T['Head'].to_3x3().col[0].normalized(), 0.32 * k))
            return T
        c.add('statue_still', 3.6, still, hold_t=2.2, blend=[0.4, 0.5], ev={'still': 1.2})

        # ---------------------------------------------------------------- climb a block (ClimbUp_1m, scaled to the block)
        CU = c.dur(I2, 'ClimbUp_1m')
        def climb(t):
            st = c.swarp(t, [(0.0, 0.0), (2.4, CU)])
            T = c.mo(I2, 'ClimbUp_1m', st)
            return T
        c.add('climb_block', 2.6, climb, hold_t=2.4, blend=[0.2, 0.1], ev={'top': 2.4})

        return self.clips
