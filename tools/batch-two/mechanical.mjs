// Source-guided rigid partitions with independent pivots; keep generated surfaces and PBR.
import fs from'node:fs/promises';import{createRequire}from'node:module';import{BufferGeometry,Float32BufferAttribute,Quaternion,Euler}from'three';
import{readGLB,editor}from'../four-assets/glb.mjs';
const req=createRequire(new URL('../model-opt/package.json',import.meta.url));const{NodeIO}=await import(req.resolve('@gltf-transform/core'));const{ALL_EXTENSIONS}=await import(req.resolve('@gltf-transform/extensions'));const{prune}=await import(req.resolve('@gltf-transform/functions'));
const id=process.argv[2],revised=id==='htnk-v4',input=await readGLB(revised?'assets/hd/batch-two/htnk-v4-team.glb':'.cache/batch-two/'+id+'/30k.glb'),{g}=input,e=editor(input),source=g.meshes[0].primitives[0],positions=e.values(source.attributes.POSITION),indices=e.values(source.indices);
const q=(x=0,y=0,z=0)=>new Quaternion().setFromEuler(new Euler(x,y,z)).toArray();
let parts,choose;
if(revised){
 parts=[{name:'Hull',pivot:[0,0,0]},{name:'Turret',pivot:[.18,.06,0],parent:0},{name:'Barrel',pivot:[-.29,.151,0],parent:1}];
 choose=([x,y,z])=>x<-.29&&y>.105&&Math.abs(z)<.075?2:y>.063&&x>-.30&&x<.67&&Math.abs(z)<.285?1:0;
}else if(id==='htnk'){
 parts=[{name:'Hull',pivot:[0,0,0]},{name:'Turret',pivot:[.22,.067,0],parent:0},{name:'Barrel',pivot:[-.11,.151,-.016],parent:1}];
 choose=([x,y,z])=>x<-.11&&y>.084&&Math.abs(z)<.095?2:y>.078&&x>-.115&&x<.53&&Math.abs(z)<.275?1:0;
}else if(id==='dest'){
 parts=[{name:'Hull',pivot:[0,0,0]},{name:'Barrel',pivot:[-.65,-.08,0],parent:0},{name:'Helicopter',pivot:[.72,-.13,0],parent:0},{name:'Rotor',pivot:[.73,-.018,0],parent:2}];
 choose=([x,y,z])=>x>.59&&x<.88&&y>-.155&&Math.abs(z)<.14?(y>-.067&&y<-.040?3:2):x<-.67&&y>-.09&&Math.abs(z)<.025?1:0;
}else if(id==='gapile'){
 parts=[{name:'Foundation',pivot:[0,0,0]},{name:'Walls',pivot:[0,-.5,0],parent:0},{name:'RoofLeft',pivot:[-.38,-.29,-.47],parent:1},{name:'RoofRight',pivot:[.37,-.29,-.47],parent:1},{name:'Tower',pivot:[-.65,-.45,-.35],parent:1},{name:'Flag',pivot:[-.645,.46,-.355],parent:4}];
 choose=([x,y,z])=>y>.39&&x>-.625?5:((x+.65)**2+(z+.35)**2<.19**2&&y>-.45)?4:y>-.28?(x<-.025?2:3):y>-.525?1:0;
}else throw Error('Unknown mechanical asset');
const groups=parts.map(()=>[]);for(let i=0;i<indices.length;i+=3){const tri=indices.slice(i,i+3),center=[0,1,2].map(c=>tri.reduce((s,v)=>s+positions[v*3+c],0)/3);groups[choose(center)].push(...tri);}
g.meshes=[];g.nodes=[];g.animations=[];g.scenes=[{nodes:[0]}];g.scene=0;
for(let k=0;k<parts.length;k++){
 const part=parts[k],map=new Map(),used=[],ix=[];for(const index of groups[k]){if(!map.has(index)){map.set(index,used.length);used.push(index);}ix.push(map.get(index));}
 const attrs={};let shifted;
 for(const [name,acc]of Object.entries(source.attributes)){if(!['POSITION','NORMAL','TEXCOORD_0','TANGENT'].includes(name))continue;const vals=e.values(acc),size=g.accessors[acc].type==='VEC4'?4:g.accessors[acc].type==='VEC2'?2:3,arr=[];
 for(const vi of used){const v=vals.slice(vi*size,vi*size+size);if(name==='POSITION'){
  if(id==='htnk'&&k===2){const t=Math.max(0,Math.min(1,(-v[0]-.11)/.16));v[0]=-.11+(v[0]+.11)*.68;v[1]=.151+(v[1]-.151)*(1-.42*t);v[2]=-.016+(v[2]+.016)*(1-.42*t);const radius=Math.hypot(v[1]-.151,v[2]+.016),cap=.029+.035*(1-t);if(radius>cap){v[1]=.151+(v[1]-.151)*cap/radius;v[2]=-.016+(v[2]+.016)*cap/radius;}}
  for(let c=0;c<3;c++)v[c]-=part.pivot[c];
 }arr.push(...v);}attrs[name]=e.add(arr,size);if(name==='POSITION')shifted=arr;
 }
 // Barrel surface normals are recomputed after the source-proportion correction.
 if(id==='htnk'&&k===2){const geo=new BufferGeometry();geo.setAttribute('position',new Float32BufferAttribute(shifted,3));geo.setIndex(ix);geo.computeVertexNormals();attrs.NORMAL=e.add([...geo.attributes.normal.array],3);delete attrs.TANGENT;}
 g.meshes.push({name:part.name,primitives:[{...source,attributes:attrs,indices:e.add(ix,1,5125)}]});
 const parent=part.parent===undefined?null:parts[part.parent];g.nodes.push({name:part.name,mesh:k,translation:part.pivot.map((v,c)=>v-(parent?.pivot[c]||0)),children:[]});if(parent)g.nodes[part.parent].children.push(k);
 part.triangles=ix.length/3;
}
function clip(name,duration,channels){const anim={name,channels:[],samplers:[],extras:{loop:!['attack','launch','land'].includes(name),kind:'mechanical'}};for(const[node,prop,frames]of channels){const times=frames.map(f=>f[0]*duration),values=frames.flatMap(f=>f[1]);anim.channels.push({sampler:anim.samplers.push({input:e.add(times,1),output:e.add(values,prop==='rotation'?4:3),interpolation:'LINEAR'})-1,target:{node,path:prop}});}g.animations.push(anim);}
clip('ready',2,[[0,'rotation',[[0,q()],[1,q()]]]]);
if(id==='htnk'||revised){
 const home=g.nodes[2].translation;clip('attack',.55,[[2,'translation',[[0,home],[.1,[home[0]+.075,home[1],home[2]]],[.45,home],[1,home]]]]);
 clip('aim_left',2,[[1,'rotation',[[0,q()],[.5,q(0,Math.PI/2)],[1,q()]]]]);clip('aim_right',2,[[1,'rotation',[[0,q()],[.5,q(0,-Math.PI/2)],[1,q()]]]]);
}else if(id==='dest'){
 const home=g.nodes[1].translation;clip('attack',.7,[[1,'translation',[[0,home],[.1,[home[0]+.025,home[1],home[2]]],[.45,home],[1,home]]]]);
 const rotor=Array.from({length:33},(_,i)=>[i/32,q(0,i/32*Math.PI*8)]),homeH=g.nodes[2].translation;
 clip('rotor',1,[[3,'rotation',rotor]]);clip('launch',3,[[2,'translation',[[0,homeH],[.3,[homeH[0],homeH[1]+.2,homeH[2]]],[1,[homeH[0]-.6,homeH[1]+.5,homeH[2]]]]],[3,'rotation',rotor]]);
 clip('land',3,[[2,'translation',[[0,[homeH[0]-.6,homeH[1]+.5,homeH[2]]],[.7,[homeH[0],homeH[1]+.2,homeH[2]]],[1,homeH]]],[3,'rotation',rotor]]);
}
if(id==='gapile'){
 const wave=Array.from({length:17},(_,i)=>[i/16,q(.07*Math.sin(i/16*Math.PI*2),.20*Math.sin(i/16*Math.PI*2),.04*Math.sin(i/16*Math.PI*4))]);
 clip('work',16/12,[[5,'rotation',wave]]);
 clip('damaged',2,[[2,'rotation',[[0,q()],[.6,q(.18,0,.11)],[1,q(.18,0,.11)]]],[3,'rotation',[[0,q()],[.6,q(-.15,0,-.13)],[1,q(-.15,0,-.13)]]],[4,'rotation',[[0,q()],[.6,q(0,0,-.2)],[1,q(0,0,-.2)]]]]);
 const wall=g.nodes[1].translation,tower=g.nodes[4].translation;
 clip('construction',25/12,[[1,'translation',[[0,[wall[0],wall[1]-.6,wall[2]]],[.2,wall],[1,wall]]],[2,'rotation',[[0,q(-Math.PI/2)],[.28,q(-Math.PI/2)],[.65,q()],[1,q()]]],[3,'rotation',[[0,q(-Math.PI/2)],[.4,q(-Math.PI/2)],[.78,q()],[1,q()]]],[4,'translation',[[0,[tower[0],tower[1]-.8,tower[2]]],[.4,[tower[0],tower[1]-.8,tower[2]]],[.85,tower],[1,tower]]]]);
}
g.asset.extras={recipe:'tools/batch-two/mechanical.mjs',parts,forwardAxis:[-1,0,0],barrelAxis:[-1,0,0],source:'assets/hd/batch-two/source-parts.json',...(id==='htnk'?{correction:'Original htnkbarl extent 17.83 vs hull 44.03; diameter 1.98 vs hull width 32.61. Shorten barrel by .68 and narrow .58, reduce unsupported muzzle bulge.'}:{})};
if(revised){
 g.asset.extras={...g.asset.extras,source:'assets/hd/batch-two/htnk-v4-team.glb',muzzleLocal:[-.662,.0,0],note:'Rigid surface partitions fitted to approved v4; original shape and embedded player-color mask retained.'};
 await fs.writeFile('assets/hd/batch-two/htnk-v4-actions.glb',e.finish());
}else{
 const io=new NodeIO().registerExtensions(ALL_EXTENSIONS),doc=await io.readBinary(e.finish());await doc.transform(prune());await io.write('assets/hd/batch-two/'+id+'.glb',doc);
}
await fs.writeFile('assets/hd/batch-two/'+id+'-parts.json',JSON.stringify(g.asset.extras,null,2)+'\n');console.log(id,parts);
