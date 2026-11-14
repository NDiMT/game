#!/usr/bin/env python3
# the narrator's pages laid end to end at the seconds their pages begin in the film -> voice/narration.wav
# (v/vo_marks.json is written by `vase.py len`; every page is brought to the same loudness first)
import json, subprocess, wave, numpy as np
S = '/tmp/claude-0/-home-user-game/9db9e6f7-f322-58a8-a673-ecffb8a05976/scratchpad/gem/'
marks = json.load(open(S + 'v/vo_marks.json')); FRAMES = int(subprocess.run(['python3', S + 'vase.py', 'len'], capture_output=True, text=True).stdout.split()[-1])
L = FRAMES / 24.0; sr = 48000; out = np.zeros(int(L * sr) + sr, np.float32)
for t, c, p in marks:
    r = subprocess.run(['ffmpeg', '-v', 'error', '-i', S + 'voice/c%dp%d.wav' % (c, p), '-ac', '1', '-ar', str(sr), '-f', 'f32le', '-'], capture_output=True).stdout
    x = np.frombuffer(r, np.float32).copy(); nz = np.where(np.abs(x) > 0.01)[0]
    x *= (10 ** (-25 / 20.0)) / np.sqrt((x[nz[0]:nz[-1]] ** 2).mean())
    f = int(0.01 * sr); x[:f] *= np.linspace(0, 1, f); x[-f:] *= np.linspace(1, 0, f)
    i0 = int((t + 0.05) * sr); out[i0:i0 + len(x)] += x
out = out[:int(L * sr)]
w = wave.open(S + 'voice/narration.wav', 'wb'); w.setnchannels(1); w.setsampwidth(2); w.setframerate(sr); w.writeframes((np.clip(out, -1, 1) * 32767).astype(np.int16).tobytes()); w.close()
print('narration: %d pages, %.1f s' % (len(marks), L))
