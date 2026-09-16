// Candidate renderer: simulation is the existing GameEngine, geometry is authored GLB.
import * as T from 'three';
import {makeCombat} from './combat.js';
import {applyTeamColor} from '../team-color.js';
import {GameEngine} from '@game/game/engine';
import {actors,labels,once,waterActions} from './catalog.js';
import {createWorld,addEnvironment,loader,makeLabel,size,shore} from './world.js';
const $=(id:string)=>document.getElementById(id)!;
const select=$('actor') as HTMLSelectElement,actionSelect=$('action') as HTMLSelectElement;
const seek=$('seek') as HTMLInputElement;
const world=createWorld($('stage'));
const cells=Array.from({length:size*size},(_,i)=>i%size>=shore?'water':'land');
const game=new GameEngine({map:{id:'canvas3d',name:'高清训练场',width:size,height:size,cells,spawns:[{x:2,y:2},{x:29,y:29}],theater:'temperate'} as any,
 players:[{id:0,name:'观察',country:'russia',team:1,color:'#ff0000',ai:false}],startingUnits:0,startingCredits:50000,fogOfWar:false,shortGame:false,superweapons:false});
for(const e of game.entities)e.hp=0;
const models:any[]=[],missing:string[]=[];
let playerColor='#ff0000';
function setPlayerColor(color:string){playerColor=color;const player=game.getPlayer(0);if(player)player.color=color;for(const m of models)if(m.entity.owner===0)m.team?.setColor(color);}
let combat:any;
let selected:any,paused=false,speed=1,elapsed=0,demo=true,tour=false,tourAt=0,nextDemo=0,leg=false;
const ring=new T.Mesh(new T.RingGeometry(.52,.57,64),new T.MeshBasicMaterial({color:0xd7f790,side:T.DoubleSide,depthWrite:false}));
ring.rotation.x=-Math.PI/2;world.scene.add(ring);
function options(model:any){return ['auto',...model.clips.map((c:any)=>c.name),...(model.clips.length||model.environment?[]:model.kind==='building'?['hit','repair']:['move','attack','hit'])];}
async function loadActor(config:any){
 try{
  const gltf=await loader.loadAsync('/hd/models/'+config.file),body=new T.Group(),group=new T.Group();
  const bounds=new T.Box3().setFromObject(gltf.scene),dimensions=bounds.getSize(new T.Vector3()),center=bounds.getCenter(new T.Vector3());
  const scale=config.height?config.height/dimensions.y:config.width/Math.max(dimensions.x,dimensions.z);
  body.scale.setScalar(scale);body.position.set(-center.x*scale,-bounds.min.y*scale,-center.z*scale);body.add(gltf.scene);group.add(body);
  gltf.scene.traverse((o:any)=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true;o.frustumCulled=false;}});
  const entity=config.environment?{id:-models.length-1,x:config.x,y:config.z,angle:0,path:[],hp:1}:game.spawnEntity(config.type,0,config.x,config.z);entity.holdFire=true;
  const team=config.teamColor?await applyTeamColor(gltf,playerColor):null;
  const mixer=new T.AnimationMixer(gltf.scene),clips=gltf.animations.filter((c:any)=>!['guard','panic','die3','die4','die5'].includes(c.name));
  const skeleton=new T.SkeletonHelper(gltf.scene);skeleton.visible=false;world.scene.add(skeleton);
  const label=makeLabel(config.name);world.scene.add(label);
  const model={...config,entity,body,group,gltf,mixer,clips,skeleton,label,scale,team,modelHeight:dimensions.y*scale,mode:'auto',playing:'',action:null,time:0,heading:0};
  group.userData.actor=model;world.scene.add(group);models.push(model);
 }catch(error){missing.push(config.name);console.warn('Missing authored model:',config.id,String(error));}
}
function play(model:any,name:string){
 if(model.playing===name)return;
 model.mixer.stopAllAction();model.playing=name;model.time=0;
 const clip=model.clips.find((c:any)=>c.name===name);model.action=clip?model.mixer.clipAction(clip):null;
 if(model.action){const oneShot=once.has(name)||clip.userData?.loop===false||(model.id==='squid'&&name==='attack');model.action.reset();model.action.setLoop(oneShot?T.LoopOnce:T.LoopRepeat,oneShot?1:Infinity);model.action.clampWhenFinished=true;model.action.play();model.mixer.update(0);}
}
function autoClip(m:any){const moving=m.moving||!!m.entity.path?.length;if(['cons','htnk','dest'].includes(m.id)&&m.entity.targetId&&!moving)return m.id==='cons'?'fireup':'attack';
 if(m.id==='rocketeer')return moving?'fly':'hover';if(m.id==='squid')return moving?'swim':'ready';
 if(m.id==='tanya'||m.id==='cons')return moving?'walk':'ready';if(m.id==='gapile')return 'work';if(m.id==='htnk'||m.id==='dest')return 'ready';return moving?'move':'ready';}
function setMode(name:string){
 if(!selected)return;selected.mode=name;selected.playing='';game.commandStop([selected.entity.id]);
 // Previewing water poses uses real water coordinates; leaving restores the land slot.
 if(selected.id==='tanya'){const wet=waterActions.has(name);selected.entity.x=wet?24:selected.x;selected.entity.y=selected.z;}
 if(name==='move')game.commandMove([selected.entity.id],selected.x+4,selected.z);
 actionSelect.value=name;play(selected,name==='auto'?autoClip(selected):name);updateScene();
}
function updateNote(){
 const clip=selected?.clips.find((c:any)=>c.name===selected.playing);
 $('motion-note').textContent=clip?`${selected.motionKind==='mechanical'?'机械分件':'骨骼动画'} · ${selected.clips.length} 个可选动作 · ${selected.playing}`:
 selected?.environment?'环境模块；可旋转检查比例与拼接。':selected?.kind==='building'?'静态建筑；受击／维修为场景反馈，尚无建造或机械动画。':'静态车体；移动／开火为场景反馈，尚无独立炮塔或履带动画。';
}
function choose(id:string){
 selected=models.find(m=>m.id===id);if(!selected)return;select.value=id;
 actionSelect.replaceChildren(...options(selected).map(key=>new Option(labels[key]||key,key)));
 actionSelect.value=selected.mode;for(const m of models)m.skeleton.visible=m===selected&&($('bones') as HTMLInputElement).checked;
 updateNote();updateScene();
}
function focus(){if(selected)world.focus(selected.group.position.clone().add(new T.Vector3(0,selected.modelHeight*.45,0)),Math.max(3,selected.modelHeight*4,(selected.width||0)*2.3));}
function stopTour(){tour=false;$('tour').textContent='轮播动作';}
function pause(value:boolean){paused=value;$('pause').textContent=paused?'继续':'暂停';$('pause').setAttribute('aria-pressed',String(paused));}
function tick(dt:number){
 elapsed+=dt;
 if(demo&&elapsed>=nextDemo){nextDemo=elapsed+7;leg=!leg;for(const m of models)if(m.kind!=='building'&&!m.environment&&m.mode==='auto')game.commandMove([m.entity.id],m.x+(leg?3:0),m.z);}
 for(const m of models)m.previousPosition=[m.entity.x,m.entity.y];
 game.step(dt);
 for(const m of models)m.moving=Math.hypot(m.entity.x-m.previousPosition[0],m.entity.y-m.previousPosition[1])>1e-6;
 if(tour&&elapsed>=tourAt){const available=options(selected).filter(k=>k!=='auto');setMode(available[(available.indexOf(selected.mode)+1)%available.length]);focus();tourAt=elapsed+Math.max(2.4,selected.action?.getClip().duration||2.4);}
 for(const m of models){if(m.mode==='auto')play(m,autoClip(m));m.time+=dt;m.mixer.update(dt);}
 updateScene();
}
function updateScene(){
 for(const m of models){
  const wet=m.id==='tanya'&&waterActions.has(m.playing),air=m.kind==='air'&&!['tumble','airdeathfinish'].includes(m.playing);
  const y=m.kind==='naval'?(m.waterline??-.4):wet?(m.playing.startsWith('swim')?-.08:-.90*m.scale):air?1.3:0;
  // Engine angle is atan2(delta Z, delta X); Three Y rotation subtracts that angle.
  if(m.moving||m.entity.path?.length)m.heading=0;
  m.group.position.set(m.entity.x,y,m.entity.y);m.group.rotation.y=m.environment?0:Math.atan2(m.forwardAxis[2],m.forwardAxis[0])-m.entity.angle+m.heading;
  // Rigid-body feedback, separate from skeleton clips and simulation damage.
  if(m.playing==='attack'&&!m.action){const forward=new T.Vector3(...m.forwardAxis).applyQuaternion(m.group.quaternion);m.group.position.addScaledVector(forward,-Math.max(0,Math.cos(m.time*7))*.07);}
  if(m.playing==='hit')m.group.position.x+=Math.sin(m.time*30)*.025;
  m.label.position.set(m.entity.x,y+m.modelHeight+.45,m.entity.y);
 }
 combat?.update();
 if(selected){updateNote();ring.position.set(selected.entity.x,.025,selected.entity.y);ring.scale.setScalar(Math.max(.8,(selected.width||1)*.55));
  ring.material.color.set(selected.playing==='repair'?0x71ff96:0xd7f790);ring.material.opacity=selected.playing==='repair'?.6+.4*Math.sin(selected.time*5):1;
  ring.material.transparent=true;
  const duration=selected.action?.getClip().duration||2,time=selected.action?.time??selected.time%2;
  seek.value=String(Math.round(time/duration*1000));$('frame').textContent=`${labels[selected.playing]||selected.playing} · ${time.toFixed(2)} / ${duration.toFixed(2)} s`;
 }
}
async function init(){
 const environment=await addEnvironment(world.scene);await Promise.all(actors.map(loadActor));models.sort((a,b)=>actors.findIndex(c=>c.id===a.id)-actors.findIndex(c=>c.id===b.id));
 select.replaceChildren(...actors.map(a=>{const o=new Option(a.name+(missing.includes(a.name)?'（文件缺失）':''),a.id);o.disabled=missing.includes(a.name);return o;}));
 combat=makeCombat(game,world,models);
 if(!models.length)throw Error('没有可读取的兵种模型');const requested=new URLSearchParams(location.search).get('actor');choose(models.find(m=>m.id===requested)?.id||models[0].id);tick(0);if(requested)focus();
 select.onchange=()=>{stopTour();choose(select.value);focus();};actionSelect.onchange=()=>{stopTour();setMode(actionSelect.value);focus();};
 $('pause').onclick=()=>pause(!paused);$('step').onclick=()=>{pause(true);tick(1/30);};
 $('speed').onchange=()=>speed=Number(($('speed') as HTMLSelectElement).value);
 seek.oninput=()=>{pause(true);if(selected.action){selected.action.paused=false;selected.action.time=Number(seek.value)/1000*selected.action.getClip().duration;selected.mixer.update(0);}else selected.time=Number(seek.value)/500;updateScene();};
 $('tour').onclick=()=>{tour=!tour;tourAt=elapsed;pause(false);$('tour').textContent=tour?'停止轮播':'轮播动作';};
 $('demo').onclick=()=>{demo=!demo;$('demo').textContent=demo?'停止移动演示':'开始移动演示';if(!demo)for(const m of models)game.commandStop([m.entity.id]);nextDemo=elapsed;};
 $('attack-target').onclick=()=>{demo=false;combat.command(selected);actionSelect.value='auto';pause(false);};
 $('focus').onclick=focus;$('home').onclick=world.home;$('pitch').onclick=world.pitch;$('turn').onclick=()=>{game.commandStop([selected.entity.id]);selected.heading+=Math.PI/4;updateScene();};
 document.querySelectorAll<HTMLButtonElement>('[data-view]').forEach(b=>b.onclick=()=>world.view(Number(b.dataset.view)));
 $('bones').onchange=()=>choose(selected.id);
 ($('team-color') as HTMLInputElement).oninput=e=>setPlayerColor((e.target as HTMLInputElement).value);
 const ray=new T.Raycaster(),pointer=new T.Vector2(),plane=new T.Plane(new T.Vector3(0,1,0),0),point=new T.Vector3();let down={x:0,y:0};
 function cast(event:PointerEvent|MouseEvent){const r=world.renderer.domElement.getBoundingClientRect();pointer.set((event.clientX-r.left)/r.width*2-1,-(event.clientY-r.top)/r.height*2+1);ray.setFromCamera(pointer,world.camera);}
 world.renderer.domElement.addEventListener('pointerdown',e=>{down={x:e.clientX,y:e.clientY};});
 world.renderer.domElement.addEventListener('pointerup',e=>{if(e.button!==0||Math.hypot(e.clientX-down.x,e.clientY-down.y)>5)return;cast(e);const hit=ray.intersectObjects(models.map(m=>m.group),true)[0];if(hit){let o:any=hit.object;while(o&&!o.userData.actor)o=o.parent;if(o)choose(o.userData.actor.id);}});
 world.renderer.domElement.addEventListener('contextmenu',e=>{e.preventDefault();cast(e);if(selected.kind==='building'||selected.environment)return;if(ray.ray.intersectPlane(plane,point)&&point.x>=0&&point.x<size&&point.z>=0&&point.z<size){demo=false;$('demo').textContent='开始移动演示';selected.mode='auto';actionSelect.value='auto';game.commandMove([selected.entity.id],point.x,point.z);}});
 $('status').textContent=`${models.length} 类可选资产 · 原有环境已加载`+(missing.length?' · 尚缺：'+missing.join('、'):' · 拖动旋转，选择模型检查动作');
 (window as any).canvas3d= {T,combat,ready:true,models,missing,game,world,choose,setMode,tick,pause,setPlayerColor,get selected(){return selected;},get paused(){return paused;}};
 let previous=performance.now();function frame(now:number){requestAnimationFrame(frame);const dt=Math.min(.05,(now-previous)/1000);previous=now;if(!paused)tick(dt*speed);environment.update(elapsed);world.controls.update();world.renderer.render(world.scene,world.camera);}requestAnimationFrame(frame);
}
init().catch(error=>{$('status').textContent='加载失败：'+String(error.message||error);console.error(error);});
