// Cell-exact road topology; numerical edge conditioning is runtime texture preparation.
import {createRequire}from'node:module';import fs from'node:fs/promises';import crypto from'node:crypto';
const req=createRequire(new URL('../model-opt/package.json',import.meta.url));
const {Document,NodeIO}=await import(req.resolve('@gltf-transform/core'));const sharp=(await import(req.resolve('sharp'))).default;
const N=1024,root='assets/hd/batch-two/',cache='.cache/batch-two/dirt-road';await fs.mkdir(cache,{recursive:true});
const raw=await sharp(root+'references/dirt-road.png').resize(N,N).removeAlpha().raw().toBuffer();
const grass=await sharp('assets/hd/environment/references/grass-albedo.png').resize(N,N).removeAlpha().raw().toBuffer();
// Match opposite road ends exactly; blend in a 32-texel strip so repeated cells have no abrupt join.
for(let x=0;x<N;x++)for(let c=0;c<3;c++){const avg=(raw[x*3+c]+raw[((N-1)*N+x)*3+c])/2;for(let k=0;k<32;k++){const a=(1-k/32)**2;for(const y of[k,N-1-k]){const i=(y*N+x)*3+c;raw[i]=Math.round(raw[i]*(1-a)+avg*a);}}}
// Side boundaries sample the neighbor grass's opposite edge, preserving the same grid UV convention.
for(let y=0;y<N;y++)for(let x=0;x<N;x++){const edge=Math.min(x,N-1-x),a=Math.max(0,1-edge/100)**2;if(!a)continue;const gx=x<N/2?N-1-x:N-1-x;for(let c=0;c<3;c++){const i=(y*N+x)*3+c;raw[i]=Math.round(raw[i]*(1-a)+grass[(y*N+gx)*3+c]*a);}}
// Shared endpoints must agree after shoulder conditioning.
for(let x=0;x<N;x++)for(let c=0;c<3;c++){const a=x*3+c,b=((N-1)*N+x)*3+c,v=Math.round((raw[a]+raw[b])/2);raw[a]=raw[b]=v;}
const png=await sharp(raw,{raw:{width:N,height:N,channels:3}}).png().toBuffer();await fs.writeFile(cache+'/conditioned-albedo.png',png);
const doc=new Document(),buffer=doc.createBuffer(),scene=doc.createScene('road');doc.getRoot().setDefaultScene(scene);
const ac=(name,type,arr)=>doc.createAccessor(name).setType(type).setArray(arr).setBuffer(buffer);
const mat=doc.createMaterial('dirt and grass').setBaseColorTexture(doc.createTexture('conditioned albedo').setImage(png).setMimeType('image/png')).setRoughnessFactor(.96).setMetallicFactor(0).setBaseColorFactor([.65,.70,.50,1]);
const p=doc.createPrimitive().setAttribute('POSITION',ac('positions','VEC3',new Float32Array([-.5,0,-.5,.5,0,-.5,-.5,0,.5,.5,0,.5]))).setAttribute('NORMAL',ac('normals','VEC3',new Float32Array([0,1,0,0,1,0,0,1,0,0,1,0]))).setAttribute('TEXCOORD_0',ac('uv','VEC2',new Float32Array([0,0,1,0,0,1,1,1]))).setIndices(ac('indices','SCALAR',new Uint16Array([0,2,1,1,2,3]))).setMaterial(mat);
scene.addChild(doc.createNode('dirt-road').setMesh(doc.createMesh('dirt-road').addPrimitive(p)));
const bytes=await new NodeIO().writeBinary(doc);await fs.writeFile(root+'dirt-road.glb',bytes);await fs.writeFile(cache+'/master.glb',bytes);
let maxEndDifference=0;for(let x=0;x<N*3;x++)maxEndDifference=Math.max(maxEndDifference,Math.abs(raw[x]-raw[(N-1)*N*3+x]));
const record={file:'dirt-road.glb',triangles:2,bytes:bytes.length,sha256:crypto.createHash('sha256').update(bytes).digest('hex'),up:'+Y',forward:'+Z',pivot:[0,0,0],footprintCells:[1,1],edges:{north:[0,0],south:[0,0],east:[0,0],west:[0,0]},textureSize:[N,N],texture:'embedded PNG',maxEndDifference,source:'temperate:211 droads01.tem',master:cache+'/master.glb',limitations:['Straight road only; rotate by quarter turns','No junction or curved module','Road edge conditioning does not reconstruct original TMP geometry']};await fs.writeFile(root+'dirt-road.json',JSON.stringify(record,null,2)+'\n');console.log(record);
