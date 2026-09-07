import * as T from 'three';
import {createInfantryPose} from './procedural-poses.js';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {RoomEnvironment} from 'three/addons/environments/RoomEnvironment.js';
const renderer=new T.WebGLRenderer({alpha:true,antialias:true,preserveDrawingBuffer:true});renderer.setPixelRatio(1);renderer.setClearColor(0,0);renderer.toneMapping=T.NeutralToneMapping;renderer.toneMappingExposure=1;
const scene=new T.Scene();scene.add(new T.HemisphereLight('#d2d9e8','#454750',2));const sun=new T.DirectionalLight('#fff6e8',2.4);sun.position.set(30,55,25);scene.add(sun);
const room=new RoomEnvironment(),pmrem=new T.PMREMGenerator(renderer),env=pmrem.fromScene(room,0);scene.environment=env.texture;scene.environmentIntensity=.55;room.dispose();pmrem.dispose();
const cam=new T.OrthographicCamera(-1,1,1,-1,.01,10000);const loader=new GLTFLoader();let current;
const specs={mtnk:{fw:128,fh:128,ax:64,ay:64,frames:16,columns:8,targetWidth:100,targetHeight:80,turn:Math.PI},tany:{fw:48,fh:60,ax:24,ay:44,frames:8,columns:8,targetWidth:30,targetHeight:34.16,turn:Math.PI/2},gacnst:{fw:284,fh:226,ax:142,ay:166,frames:1,columns:1,targetWidth:235,targetHeight:202,turn:0},nanrct:{fw:276,fh:188,ax:138,ay:128,frames:1,columns:1,targetWidth:228,targetHeight:168,turn:0}};
window.bake=async id=>{if(current)scene.remove(current);const s=specs[id],gltf=await loader.loadAsync(import.meta.env.BASE_URL+'models/'+id);const model=gltf.scene;model.updateMatrixWorld(true);const box=new T.Box3().setFromObject(model),center=box.getCenter(new T.Vector3());model.position.set(-center.x,-box.min.y,-center.z);current=new T.Group();current.add(model);scene.add(current);let triangles=0;model.traverse(o=>{if(o.isMesh)triangles+=(o.geometry.index?.count??o.geometry.attributes.position.count)/3;});
// 30 degree elevation yields the main renderer's 60x30 diamond projection.
cam.position.set(100,100*Math.sqrt(2/3),100);cam.lookAt(0,0,0);cam.updateMatrixWorld();const view=cam.matrixWorldInverse;
let left=Infinity,right=-Infinity,top=-Infinity,bottom=Infinity;
for(let f=0;f<s.frames;f++){current.rotation.y=s.turn-f/s.frames*Math.PI*2;current.updateMatrixWorld(true);const b=new T.Box3().setFromObject(current);for(const x of [b.min.x,b.max.x])for(const y of [b.min.y,b.max.y])for(const z of [b.min.z,b.max.z]){const v=new T.Vector3(x,y,z).applyMatrix4(view);left=Math.min(left,v.x);right=Math.max(right,v.x);top=Math.max(top,v.y);bottom=Math.min(bottom,v.y);}}
const pixelsPerUnit=Math.min(s.targetWidth/(right-left),s.targetHeight/(top-bottom),(s.ay-5)/top,(s.fh-s.ay-3)/Math.max(-bottom,.0001));
const density=4,W=s.fw*density,H=s.fh*density;renderer.setSize(W,H);cam.left=-s.ax/pixelsPerUnit;cam.right=(s.fw-s.ax)/pixelsPerUnit;cam.top=s.ay/pixelsPerUnit;cam.bottom=-(s.fh-s.ay)/pixelsPerUnit;cam.updateProjectionMatrix();
const actions=id==='tany'?[['ready',1],['walk',8],['fireup',4],['hit',3]]:[['ready',1]];
const totalFrames=actions.reduce((n,[_,count])=>n+count*s.frames,0);
const poses=[];model.traverse(o=>{if(id==='tany'&&o.isMesh)poses.push(createInfantryPose(o));});
const sheet=document.createElement('canvas');sheet.width=W*s.columns;sheet.height=H*Math.ceil(totalFrames/s.columns);const ctx=sheet.getContext('2d');
const maskSheet=document.createElement('canvas');maskSheet.width=sheet.width;maskSheet.height=sheet.height;const maskCtx=maskSheet.getContext('2d');
const frameCanvas=document.createElement('canvas');frameCanvas.width=W;frameCanvas.height=H;const frameCtx=frameCanvas.getContext('2d',{willReadFrequently:true});
const maskMaterials=[];model.traverse(o=>{if(o.isMesh){const original=o.material;const mat=Array.isArray(original)?original[0]:original;
 const gate=new T.ShaderMaterial({uniforms:{map:{value:mat.map},minY:{value:box.min.y},height:{value:box.max.y-box.min.y}},vertexShader:'attribute float remapHeight; varying vec2 vUv; varying float vHeight; void main(){vUv=uv;vHeight=remapHeight;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',fragmentShader:'varying vec2 vUv; varying float vHeight; uniform sampler2D map; void main(){vec3 c=texture2D(map,vUv).rgb;if(vHeight<0.57||vHeight>0.80||max(c.r,max(c.g,c.b))>0.28)discard;gl_FragColor=vec4(1.);}',side:mat.side});maskMaterials.push({object:o,original,gate});}});
const sequences={};let index=0;
for(const [action,count] of actions){sequences[action]=[index,count,count];for(let direction=0;direction<s.frames;direction++)for(let frame=0;frame<count;frame++){
 poses.forEach(pose=>pose(action,count===1?0:frame/count));
 current.rotation.y=s.turn-direction/s.frames*Math.PI*2;renderer.render(scene,cam);
 const dx=index%s.columns*W,dy=Math.floor(index/s.columns)*H;
 ctx.drawImage(renderer.domElement,dx,dy);frameCtx.clearRect(0,0,W,H);frameCtx.drawImage(renderer.domElement,0,0);const colors=frameCtx.getImageData(0,0,W,H);
 let gatePixels;
 if(id==='tany'){maskMaterials.forEach(m=>m.object.material=m.gate);renderer.render(scene,cam);frameCtx.clearRect(0,0,W,H);frameCtx.drawImage(renderer.domElement,0,0);gatePixels=frameCtx.getImageData(0,0,W,H).data;maskMaterials.forEach(m=>m.object.material=m.original);}
 const mask=frameCtx.createImageData(W,H);
 for(let k=0;k<colors.data.length;k+=4){const d=colors.data;const px=(k/4)%W,py=Math.floor(k/4/W);if(id==='tany'&&d[k+3]>20&&(px<2||px>=W-2||py<2||py>=H-2))throw Error('Animation frame clips the model: '+action+' / '+direction+' / '+frame);const selected=id==='tany'?gatePixels[k+3]>0:d[k]>65&&d[k]>d[k+1]*1.6&&d[k]>d[k+2]*1.35&&d[k+1]<145;
 if(selected&&d[k+3]){const light=id==='tany'?Math.min(255,75+Math.max(d[k],d[k+1],d[k+2])*1.4):d[k];mask.data[k]=mask.data[k+1]=mask.data[k+2]=light;mask.data[k+3]=d[k+3];}}
 frameCtx.putImageData(mask,0,0);maskCtx.drawImage(frameCanvas,dx,dy);index++;await new Promise(requestAnimationFrame);
}}
maskMaterials.forEach(m=>m.gate.dispose());
const data=sheet.toDataURL('image/png'),remapData=maskSheet.toDataURL('image/png');
const metadata={src:'/sprites/'+id+'.png',remapMaskSrc:'/sprites/'+id+'-remap.png',width:sheet.width,height:sheet.height,frameWidth:W,frameHeight:H,frames:totalFrames,columns:s.columns,anchorX:s.ax*density,anchorY:s.ay*density,pixelRatio:density,facings:s.frames,hdMotion:id==='tany'?'infantry':id==='mtnk'?'vehicle':'building'};
if(id==='tany'){metadata.sequences=sequences;metadata.animationFps=8;metadata.animationSource='procedural vertex poses; unrigged preview';}if(id==='gacnst'||id==='nanrct')metadata.foundation=[4,4];
const textures=new Set(),materials=new Set(),geos=new Set();model.traverse(o=>{if(o.geometry)geos.add(o.geometry);for(const m of Array.isArray(o.material)?o.material:[o.material])if(m){materials.add(m);Object.values(m).forEach(v=>{if(v?.isTexture)textures.add(v);});}});scene.remove(current);geos.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());textures.forEach(t=>{t.dispose();t.source.data?.close?.();});current=null;return {data,remapData,metadata,triangles,pixelsPerUnit};};
