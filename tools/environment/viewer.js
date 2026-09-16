// Six assets share cell scale; this inspector is not the Canvas 2D game engine.
import * as T from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
const renderer=new T.WebGLRenderer({antialias:true,preserveDrawingBuffer:true,alpha:true});renderer.setPixelRatio(Math.min(devicePixelRatio,2));renderer.setSize(innerWidth,innerHeight);renderer.setClearColor('#26313a');renderer.outputColorSpace=T.SRGBColorSpace;renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.2;document.body.append(renderer.domElement);renderer.domElement.dataset.testid='environment-scene';
const scene=new T.Scene(),camera=new T.PerspectiveCamera(40,innerWidth/innerHeight,.05,100);
const controls=new OrbitControls(camera,renderer.domElement);controls.target.set(0,.6,0);controls.enableDamping=true;controls.maxPolarAngle=Math.PI*.48;
scene.add(new T.HemisphereLight(0xe2ebff,0x737348,2.5));const sun=new T.DirectionalLight(0xfff4d6,3);sun.position.set(-4,9,5);scene.add(sun);
const loader=new GLTFLoader(),models={},metrics={},waters=[];const ids=['grass','ocean','plateau','ramp','tree22','tree10'];
const masters=new URLSearchParams(location.search).has('masters'),treeRecords=await(await fetch('/environment/trees.json')).json();
for(const id of ids){const gltf=await loader.loadAsync(masters?'/masters/'+id+'/master.glb':'/environment/'+id+'.glb');if(masters&&id.startsWith('tree')){const n=treeRecords.assets.find(a=>a.id===id).normalization,b=n.inputBounds,root=new T.Group();root.scale.set(n.scale*n.spread,n.scale,n.scale*n.spread);root.position.set(-(b.min[0]+b.max[0])/2*n.scale*n.spread,-b.min[1]*n.scale,-(b.min[2]+b.max[2])/2*n.scale*n.spread);root.add(gltf.scene);const outer=new T.Group();outer.add(root);gltf.scene=outer;}models[id]=gltf.scene;let tris=0;gltf.scene.traverse(o=>{if(o.isMesh){tris+=(o.geometry.index?.count||o.geometry.attributes.position.count)/3;if(id==='ocean')waters.push(o.material);}});metrics[id]={triangles:tris,bounds:new T.Box3().setFromObject(gltf.scene).getSize(new T.Vector3()).toArray()};}
function add(id,x,z,y=0){const m=models[id].clone(true);m.position.set(x,y,z);scene.add(m);return m;}
for(let z=-3;z<=3;z++)for(let x=-5;x<=0;x++)add('grass',x,z);
for(let z=-3;z<=3;z++)for(let x=2;x<=5;x++)add('ocean',x,z,-.025);
for(let x=-4;x<=-2;x++){add('ramp',x,0);for(let z=1;z<=2;z++)add('plateau',x,z);}
add('tree22',-4,-2);add('tree10',-1,-1.5);add('tree22',-3,1.5,1/Math.sqrt(6));add('tree10',-.5,2);
let angle=45,high=false,auto=false;function view(a=angle){angle=a;const p=high?1.2:.65,r=15;camera.position.set(Math.sin(a*Math.PI/180)*r*Math.cos(p),r*Math.sin(p),Math.cos(a*Math.PI/180)*r*Math.cos(p));camera.lookAt(controls.target);controls.update();}view();
document.querySelectorAll('[data-angle]').forEach(b=>b.onclick=()=>{auto=false;view(Number(b.dataset.angle));});document.querySelector('#pitch').onclick=()=>{high=!high;view();};document.querySelector('#rotate').onclick=()=>auto=!auto;document.querySelector('#wire').onclick=()=>scene.traverse(o=>{if(o.isMesh)o.material.wireframe=!o.material.wireframe;});
document.querySelector('#status').textContent='已加载六类 · 拖动旋转，滚轮缩放 · 左：草地／两树／高台与坡道；右：开放海面 · 中间留空展示模块边界。';
if(masters)document.querySelector('#status').textContent='母版对照模式 · 原始高面数，仅供本地检查';
window.environment={ready:true,metrics,view,scene,camera,renderer,models};
let previous=0;function frame(t){requestAnimationFrame(frame);if(auto)view(angle+(t-previous)*.01);for(const m of waters)if(m.normalMap)m.normalMap.offset.set(t*.000012,t*.000008);previous=t;controls.update();renderer.render(scene,camera);}requestAnimationFrame(frame);
window.onresize=()=>{camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight);};
