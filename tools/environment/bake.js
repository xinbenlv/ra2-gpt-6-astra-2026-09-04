// Orthographic offline baking: 1 cell = 60x30 logical px, at fourfold sampling.
import * as T from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
const renderer=new T.WebGLRenderer({alpha:true,antialias:true,preserveDrawingBuffer:true});renderer.setClearColor(0,0);renderer.outputColorSpace=T.SRGBColorSpace;renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.2;document.body.append(renderer.domElement);
const loader=new GLTFLoader();
window.bake=async function(id){
 const scene=new T.Scene(),gltf=await loader.loadAsync('/environment/'+id+'.glb');scene.add(gltf.scene);scene.add(new T.HemisphereLight(0xe2ebff,0x737348,2.5));const light=new T.DirectionalLight(0xfff4d6,3);light.position.set(-4,9,5);scene.add(light);
 const w=id.startsWith('tree')?144:96,h=id.startsWith('tree')?160:96,ppu=30*Math.sqrt(2),camera=new T.OrthographicCamera(-w/2/ppu,w/2/ppu,h/2/ppu,-h/2/ppu,.01,100);
 camera.position.set(8,8*Math.sqrt(2/3),8);camera.lookAt(0,0,0);renderer.setSize(w*4,h*4);renderer.render(scene,camera);
 return {id,data:renderer.domElement.toDataURL('image/png'),frameWidth:w*4,frameHeight:h*4,anchorX:w*2,anchorY:h*2,pixelRatio:4,frames:1,columns:1,src:'/environment/sprites/'+id+'.png',foundation:[1,1]};
};window.ready=true;
