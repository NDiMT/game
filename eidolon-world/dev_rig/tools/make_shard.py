# Procedural mirror shard: a jagged triangular fragment of silvered glass (front mirror, chipped silver back, green glass edges)
import numpy as np, trimesh, math
from PIL import Image, ImageDraw, ImageFilter
rng=np.random.default_rng(7)
# outline: an irregular triangle, each edge broken into jagged steps
tri=np.array([[0.012,0.115],[-0.088,-0.07],[0.095,-0.042]])
c0=tri.mean(0)
def ray(th):  # distance from c0 to the triangle boundary along angle th
    d=np.array([math.cos(th),math.sin(th)]); best=9
    for i in range(3):
        a,b=tri[i],tri[(i+1)%3]; M=np.array([d,a-b]).T
        try: t,u=np.linalg.solve(M,a-c0)
        except np.linalg.LinAlgError: continue
        if t>0 and 0<=u<=1: best=min(best,t)
    return best
pts=[]; N=26
corner=[math.atan2(*(p-c0)[::-1]) for p in tri]
for k in range(N):
    th=-math.pi+2*math.pi*k/N+rng.uniform(-0.08,0.08); r=ray(th)
    near=min(abs((th-cc+math.pi)%(2*math.pi)-math.pi) for cc in corner)
    j=rng.uniform(0.9,1.0) if near>0.3 else 1.0          # bite chips out of the edges, keep the three points sharp
    pts.append(c0+r*j*np.array([math.cos(th),math.sin(th)]))


pts+= [p for p in tri]; pts=sorted(pts,key=lambda p: math.atan2(p[1]-c0[1],p[0]-c0[0])); pts=np.array(pts); c=c0; th=0.006
def tex_front():
    # what a mirror shows: a reflected horizon (pale sky over a darker floor), two sharp glints, a bright bevel round the break
    W=512; im=Image.new('RGB',(W,W)); px=im.load()
    for y in range(W):
        for x in range(W):
            u,v=x/W,y/W; h=v-0.52-0.18*(u-0.5)
            sky=0.86-0.25*v; flo=0.30+0.08*u; t=1/(1+math.exp(-h*40))
            g=sky*(1-t)+flo*t
            s=math.exp(-((u*0.8-v*0.6-0.05)/0.035)**2)+0.6*math.exp(-((u*0.8-v*0.6+0.06)/0.015)**2)
            g=min(1,g+0.55*s); px[x,y]=tuple(int(min(1,g*k)*255) for k in (0.9,0.95,1.0))
    d=ImageDraw.Draw(im)
    for _ in range(12):
        x,y=rng.uniform(0,W,2); a=rng.uniform(0,6.28); L=rng.uniform(15,70)
        d.line((x,y,x+L*math.cos(a),y+L*math.sin(a)),fill=(225,232,238),width=1)
    uvp=[((p[0]+0.09)/0.22*W,(1-(p[1]+0.1)/0.22)*W) for p in pts]
    d.line(uvp+[uvp[0]],fill=(214,236,226),width=7,joint='curve')
    return im
def tex_back():
    W=256; im=Image.new('RGB',(W,W),(150,150,146)); d=ImageDraw.Draw(im)
    for _ in range(26):   # chips where the silvering flaked off: dark glass shows through
        x,y=rng.uniform(0,W,2); r=rng.uniform(4,22)
        poly=[(x+r*rng.uniform(0.5,1.2)*math.cos(t),y+r*rng.uniform(0.5,1.2)*math.sin(t)) for t in np.linspace(0,6.28,9)[:-1]]
        d.polygon(poly,fill=(52,62,58))
    return im.filter(ImageFilter.GaussianBlur(0.8))
def face(z,flip,mat):
    V=np.vstack([[c[0],c[1],z]]+[[p[0],p[1],z] for p in pts]); n=len(pts)
    F=np.array([[0,1+i,1+(i+1)%n] for i in range(n)]); F=F[:,::-1] if flip else F
    uv=(V[:,:2]-[-0.09,-0.1])/0.22
    return trimesh.Trimesh(V,F,visual=trimesh.visual.TextureVisuals(uv=uv,material=mat),process=False)
glass=trimesh.visual.material.PBRMaterial(baseColorFactor=[150,190,170,255],metallicFactor=0.0,roughnessFactor=0.1,name='edge_glass')
front=face(th/2,False,trimesh.visual.material.PBRMaterial(baseColorTexture=tex_front(),metallicFactor=0.15,roughnessFactor=0.08,name='mirror'))
back=face(-th/2,True,trimesh.visual.material.PBRMaterial(baseColorTexture=tex_back(),metallicFactor=0.2,roughnessFactor=0.5,name='silver_back'))
n=len(pts); V=[];F=[]
for i in range(n):
    p,q=pts[i],pts[(i+1)%n]; b=len(V); V+= [[p[0],p[1],th/2],[q[0],q[1],th/2],[q[0],q[1],-th/2],[p[0],p[1],-th/2]]; F+=[[b,b+2,b+1],[b,b+3,b+2]]
side=trimesh.Trimesh(np.array(V),np.array(F),process=False); side.visual=trimesh.visual.TextureVisuals(material=glass)
# check winding: side normals should point outward
if np.mean([np.dot(side.face_normals[k][:2], side.triangles_center[k][:2]-c) for k in range(len(F))])<0: side.invert()
sc=trimesh.Scene()
R=trimesh.transformations.rotation_matrix(math.radians(24),[0,1,0]) @ trimesh.transformations.translation_matrix([0,0.1,0])   # stands on its point edge, front toward +Z, turned a little
for nm,m in [('mirror',front),('back',back),('edge',side)]: m.apply_transform(R); sc.add_geometry(m,node_name=nm)
open('/home/user/game/eidolon-world/assets/models/items/item_shard.glb','wb').write(trimesh.exchange.gltf.export_glb(sc,include_normals=True))
print('tris', sum(len(g.faces) for g in sc.geometry.values()), 'extent', sc.extents)
