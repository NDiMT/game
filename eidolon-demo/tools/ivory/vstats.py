"""value classes of a picture: the share of cream, light, mid, shade and deep; and a picture of the classes"""
import sys, numpy as np
from PIL import Image
def classes(path, out=None):
    im=np.asarray(Image.open(path).convert('RGB').resize((768,1376))).astype(float)/255
    L=0.299*im[...,0]+0.587*im[...,1]+0.114*im[...,2]
    cls=np.digitize(L,[0.3,0.5,0.72,0.88])  # 0 deep .. 4 cream
    pal=np.array([[40,25,20],[110,75,55],[170,130,100],[230,200,160],[255,250,235]],np.uint8)
    if out: Image.fromarray(pal[cls]).save(out)
    return [100*(cls==k).mean() for k in (4,3,2,1,0)]
if __name__=='__main__':
    for p in sys.argv[1:]:
        print(p.split('/')[-2]+'/'+p.split('/')[-1], ' cream %.1f light %.1f mid %.1f shade %.1f deep %.1f'%tuple(classes(p)))
