#!/usr/bin/env python3
"""Build AXIOM's licensed anatomical composite and mesh-edge activity graph.
Development only: numpy, scipy, fast-simplification. Inputs stay under work/.
No source application code is copied. Anatomical vertex positions are transformed
by uniform scale/translation only; no ellipsoid, synthetic gyri, or warped anatomy.
"""
import argparse, array, gzip, hashlib, heapq, json, math, pathlib, struct
import numpy as np
from scipy.spatial import cKDTree
import fast_simplification
ROOT=pathlib.Path(__file__).resolve().parents[1]
OUT=ROOT/'public/models'; OUT.mkdir(parents=True,exist_ok=True)
SOURCES={
 'mri':{'path':'work/anatomy/mri-brain.glb','sha256':'ce761741d866e32d7a5b7638f4cacd5ec03e2b582e72c8218aba483ac28125e8'},
 'bodyparts':{'path':'work/anatomy/bodyparts-brain.glb','sha256':'1e8d62f8579c195a85cf81790cd74b7d1d158e182f418767668089e209f0c478'},
}
def read_glb(which):
 info=SOURCES[which];raw=(ROOT/info['path']).read_bytes()
 if hashlib.sha256(raw).hexdigest()!=info['sha256']:raise ValueError('Unverified source: '+which)
 length=struct.unpack_from('<I',raw,12)[0];doc=json.loads(raw[20:20+length]);binary=raw[28+length:]
 def accessor(i):
  a=doc['accessors'][i];v=doc['bufferViews'][a['bufferView']];dim={'SCALAR':1,'VEC3':3}[a['type']]
  dtype={5126:'<f4',5125:'<u4',5123:'<u2'}[a['componentType']]
  item=np.dtype(dtype).itemsize
  return np.ndarray(shape=(a['count'],dim),dtype=dtype,buffer=binary,offset=v.get('byteOffset',0)+a.get('byteOffset',0),strides=(v.get('byteStride',dim*item),item)).copy()
 meshes={}
 for m in doc['meshes']:
  p=m['primitives'][0];a=p['attributes'];meshes[m['name']]={'p':accessor(a['POSITION']),'n':accessor(a['NORMAL']),'f':accessor(p['indices']).reshape((-1,3)).astype(np.uint32),'c':accessor(a['_CURVATURE']) if '_CURVATURE'in a else None}
 return meshes

def normals(p,f):
 n=np.zeros_like(p);fn=np.cross(p[f[:,1]]-p[f[:,0]],p[f[:,2]]-p[f[:,0]])
 for j in range(3):np.add.at(n,f[:,j],fn)
 n/=np.maximum(np.linalg.norm(n,axis=1,keepdims=True),1e-10);return n

def pack_glb(meshes):
 data=bytearray();views=[];accessors=[];gmeshes=[]
 def put(a,kind,component):
  while len(data)%4:data.append(0)
  start=len(data);data.extend(a.tobytes());views.append({'buffer':0,'byteOffset':start,'byteLength':a.nbytes})
  ac={'bufferView':len(views)-1,'componentType':component,'count':len(a),'type':kind}
  if kind=='VEC3':ac.update(min=a.min(axis=0).tolist(),max=a.max(axis=0).tolist())
  accessors.append(ac);return len(accessors)-1
 for name,m in meshes.items():
  a={'POSITION':put(m['p'].astype('<f4'),'VEC3',5126),'NORMAL':put(m['n'].astype('<f4'),'VEC3',5126)}
  if m['c'] is not None:a['_CURVATURE']=put(m['c'].astype('<f4'),'SCALAR',5126)
  indices=put(m['f'].reshape(-1).astype('<u4'),'SCALAR',5125)
  gmeshes.append({'name':name,'primitives':[{'attributes':a,'indices':indices,'mode':4}]})
 doc={'asset':{'version':'2.0','generator':'AXIOM licensed anatomy conversion; see ATTRIBUTION.md'},'scene':0,'scenes':[{'nodes':list(range(len(meshes)))}],'nodes':[{'name':name,'mesh':i}for i,name in enumerate(meshes)],'meshes':gmeshes,'buffers':[{'byteLength':len(data)}],'bufferViews':views,'accessors':accessors}
 js=json.dumps(doc,separators=(',',':')).encode();js+=b' '*((-len(js))%4);data+=b'\0'*((-len(data))%4)
 return struct.pack('<III',0x46546c67,2,28+len(js)+len(data))+struct.pack('<II',len(js),0x4e4f534a)+js+struct.pack('<II',len(data),0x004e4942)+data

def simplify(m,target):
 p,f=fast_simplification.simplify(m['p'].astype(np.float64),m['f'].astype(np.int32),target_count=min(target,len(m['f'])-1))
 # Remove zero-area faces and orphan vertices after edge collapse. A collapsed
 # neighborhood may have a zero normal; use its nearest native surface normal.
 area=np.linalg.norm(np.cross(p[f[:,1]]-p[f[:,0]],p[f[:,2]]-p[f[:,0]]),axis=1)
 f=f[area>1e-10];used=np.unique(f);remap=np.full(len(p),-1,dtype=np.int32);remap[used]=np.arange(len(used));p=p[used];f=remap[f]
 nearest=cKDTree(m['p']).query(p)[1];n=normals(p,f);invalid=np.linalg.norm(n,axis=1)<.9;n[invalid]=m['n'][nearest[invalid]]
 n/=np.maximum(np.linalg.norm(n,axis=1,keepdims=True),1e-10)
 c=m['c'][nearest] if m['c'] is not None else None
 return {'p':p.astype(np.float32),'n':n.astype(np.float32),'f':f.astype(np.uint32),'c':c}

def make_network(cortex,count=640):
 p,n,f,c=cortex['p'],cortex['n'],cortex['f'],cortex['c'].reshape(-1)
 rng=np.random.default_rng(76321)
 # Actual outward cortical vertices, favoring gyri over deep sulci; no invented shell.
 eligible=np.flatnonzero((c<.13)&(np.einsum('ij,ij->i',p,n)>.12))
 sampled=rng.choice(eligible,size=count,replace=False)
 def cluster(i):return (0 if p[i,0]<0 else 3)+(0 if p[i,2]>.4 else 2 if p[i,2]<-.4 else 1)
 nodes=[{'position':(p[i]+n[i]*.007).round(6).tolist(),'vertex':int(i),'cluster':cluster(i),'phase':float(rng.random()*math.tau)}for i in sampled]
 edges=np.unique(np.sort(np.concatenate([f[:,[0,1]],f[:,[1,2]],f[:,[2,0]]]),axis=1),axis=0)
 graph=[[]for _ in p]
 for a,b in edges:
  distance=float(np.linalg.norm(p[a]-p[b]));graph[a].append((int(b),distance));graph[b].append((int(a),distance))
 paths=[]
 for seed in sampled[::17]:
  dist=np.linalg.norm(p[sampled]-p[seed],axis=1)
  candidates=sampled[(dist>.55)&(dist<1.05)&(p[sampled,0]*p[seed,0]>0)]
  if not len(candidates):continue
  target=int(candidates[int(rng.integers(len(candidates)))]);start=int(seed)
  # A* over original triangular mesh edges. Interpolation stays on those edges,
  # so packets cannot shortcut through sulci or fly across the hemispheres.
  queue=[(0.,start)];cost={start:0.};previous={}
  while queue:
   _,u=heapq.heappop(queue)
   if u==target:break
   for v,d in graph[u]:
    next_cost=cost[u]+d
    if next_cost<cost.get(v,math.inf):
     cost[v]=next_cost;previous[v]=u
     heapq.heappush(queue,(next_cost+float(np.linalg.norm(p[v]-p[target])),v))
  if target not in previous:continue
  ids=[target]
  while ids[-1]!=start:ids.append(previous[ids[-1]])
  ids.reverse();lifted=p[ids]+n[ids]*.007
  paths.append({'vertices':ids,'points':lifted.round(6).tolist(),'cluster':cluster(start),'phase':float(rng.random())})
 return {'schema':1,'coordinateSpace':'normalized anatomical composite','offset':.007,'nodes':nodes,'paths':paths,'note':'Illustrative application activity along real cortical mesh edges, not measured neural tracts or cognition.'}

def main():
 mri=read_glb('mri');bp=read_glb('bodyparts');center=np.array([.44,10.,-9.41],dtype=np.float32);scale=.02
 parts={'cortex':mri['unified-cortex']}
 for name in ['cerebellum','midbrain','pons','medulla']:
  m=bp[name];m['p'][:,0]*=-1;m['n'][:,0]*=-1;m['f']=m['f'][:,[0,2,1]]
  m['p']=m['p']*47.5+np.array([.44,7.,-9.41],dtype=np.float32);parts[name]=m
 for m in parts.values():m['p']=(m['p']-center)*scale
 targets={'cortex':65000,'cerebellum':16000,'midbrain':4000,'pons':5000,'medulla':3000}
 networks={}
 report={'sources':SOURCES,'registration':{'bodypartsToMriScale':47.5,'bodypartsToMriTranslation':[.44,7.,-9.41],'bodypartsXAxisReflected':True,'normalizationCenter':center.tolist(),'normalizationScale':scale,'limitation':'Multi-source anatomical composite; alignment is illustrative, not clinical or a single-subject reconstruction.'},'outputs':{}}
 for quality,models in [('full',parts),('eco',{name:simplify(m,targets[name])for name,m in parts.items()})]:
  raw=pack_glb(models);compressed=gzip.compress(raw,compresslevel=9,mtime=0);path=OUT/f'brain-{quality}.glb.gz';path.write_bytes(compressed)
  networks[quality]=make_network(models['cortex'],640 if quality=='full' else 320)
  (OUT/f'surface-network-{quality}.json').write_text(json.dumps(networks[quality],separators=(',',':'))+'\n')
  report['outputs'][quality]={'file':path.name,'bytes':len(compressed),'decodedBytes':len(raw),'sha256':hashlib.sha256(compressed).hexdigest(),'meshes':{name:{'triangles':len(m['f']),'vertices':len(m['p'])}for name,m in models.items()}}
 report['network']={quality:{'nodes':len(net['nodes']),'paths':len(net['paths']),'generatorSeed':76321,'routing':'A* on this LOD cortical triangle-edge graph; 0.007 normal offset'}for quality,net in networks.items()}
 (OUT/'provenance.json').write_text(json.dumps(report,indent=2)+'\n');print(json.dumps(report['outputs'],indent=2));print(report['network'])
if __name__=='__main__':main()
