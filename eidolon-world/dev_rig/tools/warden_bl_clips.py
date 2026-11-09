"""EIDOLON a7 (Agent A): the Glass Warden's clips (retargeted CC0 Quaternius UAL mocap; see heroine_bl_clips.py):
a slow, heavy idle with the head bowed, the slow heavy walk, and the two fixed head turns."""
import math
from mathutils import Vector, Quaternion
import bl_pose as P
from bl_pose import env
import heroine_bl_clips as H

AT = {}
NRM = {}
IDLE_K = 0.75             # his idle at 3/4 speed
WALK_K = 0.62             # his walk at 0.62x: long, slow, heavy


class Lib(H.Lib):
    def fem(self, T, k=1.0):
        return T              # (his own bearing: the mannequin's, bowed below)

    def bow(self, T, k=1.0):
        self.spine(T, fwd=0.16 * k)
        P.rot(self.sk, T, 'Neck', Quaternion(T['Neck'].to_3x3().col[0].normalized(), 0.18 * k))
        P.rot(self.sk, T, 'Head', Quaternion(T['Head'].to_3x3().col[0].normalized(), 0.22 * k))
        return T

    def build(self):
        c = self
        I1 = 'ual1'
        ID = c.dur(I1, 'Idle_Loop')
        def idle(t):
            return c.bow(c.mo(I1, 'Idle_Loop', (t * IDLE_K) % ID))
        c.add('idle', ID / IDLE_K, idle, loop=True)
        WD = c.dur(I1, 'Walk_Loop')
        def walk(t):
            T = c.mo(I1, 'Walk_Loop', (t * WALK_K) % WD)
            return c.bow(T, 0.8)
        c.add('walk', WD / WALK_K, walk, loop=True)
        for nm, sg in (('turn_head_left', 1.0), ('turn_head_right', -1.0)):
            def turn(t, sg=sg):
                T = idle(t)
                k = env(t, [(0.0, 0.0), (1.4, 1.0)])
                for bn, sh in (('Neck', 0.35), ('Head', 0.65)):
                    P.rot(c.sk, T, bn, Quaternion(Vector((0, 0, 1)), sg * 1.05 * sh * k))
                return T
            c.add(nm, 3.0, turn, hold_t=3.0, blend=[0.3, 0.4])
        return self.clips
