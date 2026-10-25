import json, struct, numpy as np
CT={5120:np.int8,5121:np.uint8,5122:np.int16,5123:np.uint16,5125:np.uint32,5126:np.float32}
NC={'SCALAR':1,'VEC2':2,'VEC3':3,'VEC4':4,'MAT4':16}
def load(p):
    b=open(p,'rb').read()
    assert b[:4]==b'glTF'
    off=12; js=None; bin_=None
    while off<len(b):
        ln,tp=struct.unpack_from('<II',b,off); off+=8
        if tp==0x4E4F534A: js=json.loads(b[off:off+ln])
        else: bin_=b[off:off+ln]
        off+=ln
    return js,bin_
def acc(js,bin_,i):
    a=js['accessors'][i]; bv=js['bufferViews'][a['bufferView']]
    dt=CT[a['componentType']]; n=NC[a['type']]
    o=bv.get('byteOffset',0)+a.get('byteOffset',0)
    st=bv.get('byteStride',0); isz=np.dtype(dt).itemsize*n
    if st and st!=isz:
        raw=np.frombuffer(bin_,np.uint8,count=st*(a['count']-1)+isz,offset=o)
        arr=np.lib.stride_tricks.as_strided(raw,(a['count'],isz),(st,1)).copy().view(dt).reshape(a['count'],n)
    else:
        arr=np.frombuffer(bin_,dt,count=a['count']*n,offset=o).reshape(a['count'],n).copy()
    if a.get('normalized') and dt!=np.float32: arr=arr.astype(np.float32)/np.iinfo(dt).max
    return arr
def qmat(q):
    x,y,z,w=q
    return np.array([[1-2*(y*y+z*z),2*(x*y-z*w),2*(x*z+y*w)],[2*(x*y+z*w),1-2*(x*x+z*z),2*(y*z-x*w)],[2*(x*z-y*w),2*(y*z+x*w),1-2*(x*x+y*y)]])
def nodemat(n):
    M=np.eye(4)
    if 'matrix' in n: return np.array(n['matrix']).reshape(4,4).T
    R=qmat(n.get('rotation',[0,0,0,1])); S=np.diag(n.get('scale',[1,1,1]))
    M[:3,:3]=R@S; M[:3,3]=n.get('translation',[0,0,0]); return M
def globals_(js):
    N=len(js['nodes']); par=[-1]*N
    for i,n in enumerate(js['nodes']):
        for c in n.get('children',[]): par[c]=i
    G=[None]*N
    def g(i):
        if G[i] is None: G[i]=nodemat(js['nodes'][i]) if par[i]<0 else g(par[i])@nodemat(js['nodes'][i])
        return G[i]
    for i in range(N): g(i)
    return np.array(G),par
