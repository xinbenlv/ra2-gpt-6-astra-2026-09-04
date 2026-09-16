// Shared cell-scale environment and camera for the authored 3D battlefield.
import * as T from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
export const size=32, shore=22, heightStep=1/Math.sqrt(6);
export const loader=new GLTFLoader();
export function createWorld(stage){
 const renderer=new T.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});
 renderer.setPixelRatio(Math.min(devicePixelRatio,2));renderer.outputColorSpace=T.SRGBColorSpace;
 renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.15;
 renderer.shadowMap.enabled=true;renderer.shadowMap.type=T.PCFSoftShadowMap;
 stage.append(renderer.domElement);
 const scene=new T.Scene();scene.background=new T.Color('#34433d');
 const camera=new T.PerspectiveCamera(38,1,.05,160);
 const controls=new OrbitControls(camera,renderer.domElement);
 controls.enableDamping=true;controls.minDistance=1.5;controls.maxDistance=85;
 controls.maxPolarAngle=Math.PI*.48;controls.mouseButtons.RIGHT=null;
 scene.add(new T.HemisphereLight(0xdeeeff,0x627140,2.4));
 const sun=new T.DirectionalLight(0xfff0d8,3);sun.position.set(-10,35,20);sun.target.position.set(16,0,16);
 sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);sun.shadow.camera.left=-30;sun.shadow.camera.right=30;
 sun.shadow.camera.top=30;sun.shadow.camera.bottom=-30;sun.shadow.camera.far=90;sun.shadow.bias=-.0003;
 scene.add(sun,sun.target);
 let angle=45,high=false;
 function view(a=angle){angle=a;const distance=Math.max(2,camera.position.distanceTo(controls.target)||48),pitch=high?1.35:.67;
  camera.position.copy(controls.target).add(new T.Vector3(Math.sin(a*Math.PI/180)*Math.cos(pitch),Math.sin(pitch),Math.cos(a*Math.PI/180)*Math.cos(pitch)).multiplyScalar(distance));controls.update();}
 function focus(point,distance){controls.target.copy(point);camera.position.copy(point).add(new T.Vector3(0,0,distance));view();}
 function home(){focus(new T.Vector3(15,0,15),52);}
 function resize(){const {width,height}=stage.getBoundingClientRect();renderer.setSize(width,height);camera.aspect=width/height;camera.updateProjectionMatrix();}
 new ResizeObserver(resize).observe(stage);resize();home();
 return {scene,camera,controls,renderer,view,focus,home,pitch(){high=!high;view();}};
}
export async function addEnvironment(scene){
 const ids=['grass','ocean','plateau','ramp','tree22','tree10'];
 const loaded=await Promise.all(ids.map(async id=>[id,(await loader.loadAsync('/environment/'+id+'.glb')).scene]));
 const models=Object.fromEntries(loaded),waters=[];
 function add(id,x,z,y=0){const model=models[id].clone(true);model.position.set(x,y,z);
  model.traverse(o=>{if(o.isMesh){o.receiveShadow=true;o.castShadow=id.startsWith('tree');}});scene.add(model);return model;}
 // Reuse each GLB mesh in one draw call for all land/water cells.
 for(const id of ['grass','ocean']){
  const positions=[];for(let z=0;z<size;z++)for(let x=0;x<size;x++)if((x>=shore)===(id==='ocean'))positions.push([x,z]);
  models[id].updateMatrixWorld(true);models[id].traverse(o=>{if(!o.isMesh)return;
   const instanced=new T.InstancedMesh(o.geometry,o.material,positions.length),matrix=new T.Matrix4();
   positions.forEach(([x,z],i)=>{matrix.makeTranslation(x,id==='ocean'?-.035:0,z).multiply(o.matrixWorld);instanced.setMatrixAt(i,matrix);});
   instanced.receiveShadow=true;instanced.computeBoundingSphere();scene.add(instanced);
   if(id==='ocean')waters.push(o.material);
  });
 }
 for(let x=3;x<=6;x++){add('ramp',x,3);for(let z=4;z<=6;z++)add('plateau',x,z);}
 for(const [id,x,z,y]of [['tree22',4,5,heightStep],['tree10',6,6,heightStep],['tree22',3,12,0],['tree10',5,17,0],['tree22',18,4,0],['tree10',20,9,0],['tree22',4,24,0],['tree10',18,24,0]])add(id,x,z,y);
 // The water stays open; land texture carries cell scale without a grid over the sea.
 return {models,update(time){for(const m of waters)if(m.normalMap)m.normalMap.offset.set(time*.012,time*.008);}};
}
export function makeLabel(text){
 const canvas=document.createElement('canvas');canvas.width=512;canvas.height=80;
 const ctx=canvas.getContext('2d');ctx.fillStyle='#14221adb';ctx.fillRect(0,0,512,80);
 ctx.font='48px system-ui';ctx.fillStyle='#e9efda';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(text,256,40);
 const texture=new T.CanvasTexture(canvas);texture.colorSpace=T.SRGBColorSpace;
 const sprite=new T.Sprite(new T.SpriteMaterial({map:texture,depthTest:false,sizeAttenuation:false}));sprite.scale.set(.09,.0140625,1);sprite.renderOrder=5;return sprite;
}
