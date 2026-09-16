// Reproducible cell-scale terrain geometry and periodic PBR textures; no Meshy claim.
import {createRequire} from 'node:module';
import {mkdir,writeFile,readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import * as THREE from 'three';
const req=createRequire(new URL('../model-opt/package.json',import.meta.url));
const {Document,NodeIO}=await import(req.resolve('@gltf-transform/core'));
const {textureCompress}=await import(req.resolve('@gltf-transform/functions'));
const {ALL_EXTENSIONS}=await import(req.resolve('@gltf-transform/extensions'));
const sharp=(await import(req.resolve('sharp'))).default;
const out=new URL('../../assets/hd/environment/',import.meta.url),cache=new URL('../../.cache/environment/',import.meta.url);
await mkdir(out,{recursive:true});
const N=512,TAU=Math.PI*2, HEIGHT=1/Math.sqrt(6); // 15 screen px / (30 sqrt(2) cos(30deg)).
async function texture(kind,normal=false){
 const data=Buffer.alloc(N*N*3);
 for(let y=0;y<N;y++)for(let x=0;x<N;x++){
  const u=x/(N-1),v=y/(N-1),i=(y*N+x)*3;
  const f=Math.sin(TAU*(u*7+v*3))*Math.cos(TAU*(u*11-v*9))*.5+Math.sin(TAU*(u*83+v*47))*.19+Math.cos(TAU*(u*137-v*101))*.12;
  let w=0;for(let j=1;j<=9;j++)w+=Math.sin(TAU*(u*(j*2+1)+v*(j%3+1))+j*2.399)/Math.sqrt(j)*.18;
  if(normal){data[i]=128+Math.round((kind==='ocean'?w:0)*22);data[i+1]=128+Math.round((kind==='ocean'?w*.25:0)*12);data[i+2]=253;}
  else {const base=kind==='rock'?[142,112,65]:kind==='ocean'?[65,68,89]:[162,168,80];for(let c=0;c<3;c++)data[i+c]=Math.max(0,Math.min(255,base[c]+Math.round(f*(kind==='ocean'?0:22))));}
 }
 return sharp(data,{raw:{width:N,height:N,channels:3}}).png().toBuffer();
}
const tex={};for(const kind of ['grass','rock','ocean'])tex[kind]=[kind==='ocean'?await texture(kind):await sharp(await readFile(new URL('references/'+kind+'-albedo.png',out))).resize(1024,1024).png().toBuffer(),await texture(kind,true)];
const records=[];
for(const id of ['grass','ocean','plateau','ramp']){
 const doc=new Document(),buffer=doc.createBuffer(),scene=doc.createScene();doc.getRoot().setDefaultScene(scene);
 const mat=(kind)=>{const color=doc.createTexture(kind+' albedo').setImage(tex[kind][0]).setMimeType('image/png');const normal=doc.createTexture(kind+' normal').setImage(tex[kind][1]).setMimeType('image/png');return doc.createMaterial(kind).setBaseColorTexture(color).setNormalTexture(normal).setRoughnessFactor(kind==='ocean'?.27:.94).setMetallicFactor(0).setDoubleSided(true);};
 const material=mat(id==='ocean'?'ocean':'grass');if(id!=='ocean')material.setBaseColorFactor([.65,.70,.50,1]);if(id==='ocean')material.setAlphaMode('BLEND').setBaseColorFactor([1,1,1,.86]);
 const n=id==='grass'||id==='ocean'?1:32,pos=[],uv=[],idx=[];
 const h=(x,z)=>id==='plateau'?HEIGHT:id==='ramp'?HEIGHT*(z+.5):0;
 for(let z=0;z<=n;z++)for(let x=0;x<=n;x++){const X=x/n-.5,Z=z/n-.5;pos.push(X,h(X,Z),Z);uv.push(x/n,z/n);}
 for(let z=0;z<n;z++)for(let x=0;x<n;x++){const a=z*(n+1)+x,b=a+1,c=a+n+1,d=c+1;idx.push(a,c,b,b,c,d);}
 const mesh=doc.createMesh(id);
 function primitive(p,u,i,m){const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(p,3));geo.setAttribute('uv',new THREE.Float32BufferAttribute(u,2));geo.setIndex(i);geo.computeVertexNormals();geo.computeTangents();const ac=(name,type,array)=>doc.createAccessor(name).setType(type).setArray(array).setBuffer(buffer);mesh.addPrimitive(doc.createPrimitive().setAttribute('POSITION',ac('position','VEC3',new Float32Array(p))).setAttribute('NORMAL',ac('normal','VEC3',geo.attributes.normal.array)).setAttribute('TEXCOORD_0',ac('uv','VEC2',new Float32Array(u))).setAttribute('TANGENT',ac('tangent','VEC4',geo.attributes.tangent.array)).setIndices(ac('indices','SCALAR',new Uint32Array(i))).setMaterial(m));}
 primitive(pos,uv,idx,material);
 if(id==='plateau'||id==='ramp'){
  const rock=mat('rock');
  for(const [a,b] of [[[-.5,-.5],[.5,-.5]],[[.5,-.5],[.5,.5]],[[.5,.5],[-.5,.5]],[[-.5,.5],[-.5,-.5]]]){
   const ha=h(...a),hb=h(...b);if(!ha&&!hb)continue;
   if(!ha)primitive([a[0],0,a[1],b[0],0,b[1],b[0],hb,b[1]],[0,0,1,0,1,hb],[0,1,2],rock);
   else if(!hb)primitive([a[0],0,a[1],b[0],0,b[1],a[0],ha,a[1]],[0,0,1,0,0,ha],[0,1,2],rock);
   else primitive([a[0],0,a[1],b[0],0,b[1],a[0],ha,a[1],b[0],hb,b[1]],[0,0,1,0,0,ha,1,hb],[0,1,2,2,1,3],rock);
  }
 }
 scene.addChild(doc.createNode(id).setMesh(mesh));
 const io=new NodeIO().registerExtensions(ALL_EXTENSIONS),master=await io.writeBinary(doc);await mkdir(new URL(id+'/',cache),{recursive:true});await writeFile(new URL(id+'/master.glb',cache),master);await doc.transform(textureCompress({encoder:sharp,targetFormat:'webp',slots:/baseColorTexture/,quality:85}));const bytes=await io.writeBinary(doc);await writeFile(new URL(id+'.glb',out),bytes);
 const edges={north:[h(-.5,-.5),h(.5,-.5)],east:[h(.5,-.5),h(.5,.5)],south:[h(-.5,.5),h(.5,.5)],west:[h(-.5,-.5),h(-.5,.5)]};
 records.push({id,type:id==='ocean'?'water':id==='grass'?'surface':'height-module',file:id+'.glb',pipeline:id==='ocean'?'parametric-grid + periodic analytic water PBR; no Meshy':'parametric-grid + ImageGen source-guided albedo; no Meshy',unit:'cell',cellSize:1,pivot:[0,0,0],up:'+Y',forward:'+Z',footprintCells:[1,1],baseHeightCells:0,maxHeightCells:h(0,.5),edges,uvTexelsPerCell:id==='ocean'?512:1024,triangles:mesh.listPrimitives().reduce((a,p)=>a+p.getIndices().getCount()/3,0),bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex'),masterBytes:master.length,masterSha256:createHash('sha256').update(master).digest('hex'),textureFormat:'embedded WebP albedo quality 85 + PNG normal',textureCompression:'Color-only; original PNG master retained',textureDimensions:{albedo:id==='ocean'?[512,512]:[1024,1024],normal:[512,512]},master:'.cache/environment/'+id+'/master.glb',lod:'Shared mesh instances; 2 triangles for flat surfaces; height modules can be reduced without changing linear profile',...(id==='ocean'?{water:{opacity:.86,roughness:.27,flowUvPerSecond:[.012,.008],depthColorSrgb:[65,68,89],shoreline:'Open water only; no arbitrary coast solver',geometryDisplacement:false}}:{})});
}
await writeFile(new URL('modules.json',out),JSON.stringify({description:'Y-up cell-space modules; flat projected diamond 60 by 30 px. Height step = 15 px.',heightStepCells:HEIGHT,assets:records},null,2)+'\n');console.log(records.map(x=>({id:x.id,triangles:x.triangles,bytes:x.bytes})));
