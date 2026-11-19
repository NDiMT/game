"""List the files inside an exported Godot pack (.pck): size and path, one a line.
Use it to check a build has every file the game reads raw (the levels' .glb, their .json):
    python3 tools/pck_list.py build/web/eidolon-<v>.pck | grep -E "go[a-z]+/level"
"""
import struct, sys
f = open(sys.argv[1], 'rb')
assert f.read(4) == b'GDPC'
ver, ma, mi, pa = struct.unpack('<4I', f.read(16))
flags = struct.unpack('<I', f.read(4))[0]
base = struct.unpack('<Q', f.read(8))[0]
if ver >= 3:
    diro = struct.unpack('<Q', f.read(8))[0]
    f.seek(diro)
else:
    f.read(16 * 4)
n = struct.unpack('<I', f.read(4))[0]
for i in range(n):
    ln = struct.unpack('<I', f.read(4))[0]
    p = f.read(ln).rstrip(b'\0').decode('utf-8', 'replace')
    off, size = struct.unpack('<QQ', f.read(16)); f.read(16); fl = struct.unpack('<I', f.read(4))[0]
    print(size, p)
