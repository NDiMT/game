import json, struct, numpy as np
class W:
    def __init__(s): s.js={'asset':{'version':'2.0','generator':'eidolon rig tool'},'buffers':[{'byteLength':0}],'bufferViews':[],'accessors':[]}; s.bin=bytearray()
    def view(s,data,target=None):
        while len(s.bin)%4: s.bin.append(0)
        bv={'buffer':0,'byteOffset':len(s.bin),'byteLength':len(data)}
        if target: bv['target']=target
        s.bin+=data; s.js['bufferViews'].append(bv); return len(s.js['bufferViews'])-1
    def acc(s,arr,ctype,typ,target=None,minmax=False,normalized=False):
        arr=np.ascontiguousarray(arr)
        v=s.view(arr.tobytes(),target)
        a={'bufferView':v,'componentType':ctype,'count':int(arr.shape[0]),'type':typ}
        if normalized: a['normalized']=True
        if minmax: a['min']=[float(x) for x in arr.reshape(arr.shape[0],-1).min(0)]; a['max']=[float(x) for x in arr.reshape(arr.shape[0],-1).max(0)]
        s.js['accessors'].append(a); return len(s.js['accessors'])-1
    def save(s,path):
        while len(s.bin)%4: s.bin.append(0)
        s.js['buffers'][0]['byteLength']=len(s.bin)
        j=json.dumps(s.js,separators=(',',':')).encode()
        while len(j)%4: j+=b' '
        out=struct.pack('<III',0x46546C67,2,12+8+len(j)+8+len(s.bin))+struct.pack('<II',len(j),0x4E4F534A)+j+struct.pack('<II',len(s.bin),0x004E4942)+bytes(s.bin)
        open(path,'wb').write(out)
def debug_mesh(path,P,I,C,N=None):
    w=W()
    attrs={'POSITION':w.acc(P.astype(np.float32),5126,'VEC3',34962,True),'COLOR_0':w.acc(np.c_[C[:,:3],np.ones(len(C))].astype(np.float32),5126,'VEC4',34962)}
    if N is not None: attrs['NORMAL']=w.acc(N.astype(np.float32),5126,'VEC3',34962)
    ind=w.acc(I.reshape(-1).astype(np.uint32),5125,'SCALAR',34963)
    w.js.update({'scene':0,'scenes':[{'nodes':[0]}],'nodes':[{'mesh':0,'name':'dbg'}],'meshes':[{'primitives':[{'attributes':attrs,'indices':ind,'material':0}]}],'materials':[{'doubleSided':True,'pbrMetallicRoughness':{'baseColorFactor':[1,1,1,1]}}]})
    w.save(path)
