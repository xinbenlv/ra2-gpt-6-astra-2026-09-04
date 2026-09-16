"""Preserve original VXL/HVA positions and palette as local-only colored voxel surface GLBs."""
import os,sys,pathlib,json,struct,math,collections,hashlib
ROOT=pathlib.Path(__file__).resolve().parents[2]
os.environ['RA2_ASSET_CACHE']='/Users/zzn/ws/xinbenlv/ra2-gpt-6-astra-2026-09-04/.cache/ra2-assets-rebuild-test';os.environ['RA2_PUBLIC_DIR']=str(ROOT/'.cache/batch-two/extract');sys.path.insert(0,str(ROOT/'scripts/assets'))
from export_voxels import decode
from export_assets import palette
pal=palette('unittem')
for name,parts in [('htnk',['htnk','htnktur','htnkbarl']),('dest',['dest'])]:
 binary=bytearray();views=[];access=[];meshes=[];nodes=[]
 def append(values,size):
  while len(binary)%4:binary.append(0)
  offset=len(binary);binary.extend(struct.pack('<'+'f'*len(values),*values));views.append({'buffer':0,'byteOffset':offset,'byteLength':len(values)*4});a={'bufferView':len(views)-1,'componentType':5126,'count':len(values)//size,'type':{3:'VEC3',4:'VEC4'}[size]}
  if size==3:a.update(min=[min(values[c::3]) for c in range(3)],max=[max(values[c::3]) for c in range(3)])
  access.append(a);return len(access)-1
 for part in parts:
  points=decode(part);axes=[sorted(set(round(p[c],5) for p in points)) for c in range(3)];steps=[min(b-a for a,b in zip(axis,axis[1:]) if b-a>.0001) for axis in axes];positions=[];normals=[];colors=[]
  lookup={tuple(round(p[c],4) for c in range(3)) for p in points}
  for p in points:
   for axis in range(3):
    for sign in [-1,1]:
     neighbor=list(p[:3]);neighbor[axis]+=sign*steps[axis]
     if tuple(round(v,4) for v in neighbor) in lookup:continue
     other=[c for c in range(3) if c!=axis];corners=[]
     for a,b in [(-1,-1),(1,-1),(1,1),(-1,1)]:
      q=list(p[:3]);q[axis]+=sign*steps[axis]/2;q[other[0]]+=a*steps[other[0]]/2;q[other[1]]+=b*steps[other[1]]/2;corners.append([-q[0]/32,q[2]/32,q[1]/32])
     n=[0,0,0];n[{0:0,1:2,2:1}[axis]]=sign*(-1 if axis==0 else 1)
     # Material double-sided; explicit normal remains outward under the axis conversion.
     for i in [0,1,2,0,2,3]:
      positions.extend(corners[i]);normals.extend(n);colors.extend([(pal[p[3]*3+c]/255)**2.2 for c in range(3)]+[1])
  meshes.append({'name':part,'primitives':[{'attributes':{'POSITION':append(positions,3),'NORMAL':append(normals,3),'COLOR_0':append(colors,4)},'material':0}]});nodes.append({'name':part,'mesh':len(meshes)-1})
 g={'asset':{'version':'2.0','extras':{'source':'original VXL/HVA, palette unittem','front':'-X','up':'+Y','recipe':'tools/batch-two/original-glb.py'}},'scenes':[{'nodes':list(range(len(nodes)))}],'scene':0,'nodes':nodes,'meshes':meshes,'materials':[{'doubleSided':True,'pbrMetallicRoughness':{'metallicFactor':0,'roughnessFactor':1}}],'buffers':[{'byteLength':len(binary)}],'bufferViews':views,'accessors':access}
 j=json.dumps(g,separators=(',',':')).encode();j+=b' '*((-len(j))%4);data=struct.pack('<4sII',b'glTF',2,28+len(j)+len(binary))+struct.pack('<I4s',len(j),b'JSON')+j+struct.pack('<I4s',len(binary),b'BIN\0')+binary
 out=ROOT/'.cache/batch-two/source'/('original-'+name+'.glb');out.write_bytes(data);print(name,len(data),hashlib.sha256(data).hexdigest())
