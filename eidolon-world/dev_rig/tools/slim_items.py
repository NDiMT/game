# Slim the inventory item glbs for the web: base colour only, 256 px; metallic/roughness folded into constant factors
# (from the mean of the old MR texture), normal/occlusion/emissive maps dropped. Originals: scratchpad/size/items_orig.
import trimesh, numpy as np, sys, glob, os
from PIL import Image
D='/home/user/game/eidolon-world/assets/models/items/'
for f in sorted(glob.glob(D+'item_*.glb')):
    sc=trimesh.load(f, force='scene')
    for name,g in sc.geometry.items():
        m=getattr(g.visual,'material',None)
        if m is None: continue
        if not isinstance(m, trimesh.visual.material.PBRMaterial): m=m.to_pbr()
        mr=m.metallicRoughnessTexture
        mf=1.0 if m.metallicFactor is None else float(m.metallicFactor); rf=1.0 if m.roughnessFactor is None else float(m.roughnessFactor)
        if mr is not None:
            a=np.asarray(mr.convert('RGB'),dtype=np.float32)/255.0
            rf*=float(a[...,1].mean()); mf*=float(a[...,2].mean())
        bc=m.baseColorTexture
        if bc is not None and max(bc.size)>256:
            bc=bc.convert('RGBA' if bc.mode in ('RGBA','LA') else 'RGB').resize((256,256),Image.LANCZOS)
        nm=trimesh.visual.material.PBRMaterial(name=m.name, baseColorTexture=bc, baseColorFactor=m.baseColorFactor,
            metallicFactor=round(min(mf,1.0),3), roughnessFactor=round(min(max(rf,0.05),1.0),3), doubleSided=m.doubleSided)
        g.visual=trimesh.visual.TextureVisuals(uv=g.visual.uv, material=nm)
    data=trimesh.exchange.gltf.export_glb(sc, include_normals=True)
    old=os.path.getsize(f); open(f,'wb').write(data)
    print(f"{os.path.basename(f):24s} {old/1024:7.0f} KB -> {len(data)/1024:6.0f} KB  metallic {mf:.2f} rough {rf:.2f}")
