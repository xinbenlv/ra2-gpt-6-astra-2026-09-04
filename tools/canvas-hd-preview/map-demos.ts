import type {Sprite} from '@game/assets';
import type {GameEngine} from '@game/game/engine';
import type {BattlefieldRenderer} from '@game/renderer';

export function createMapDemos(game:GameEngine,renderer:BattlefieldRenderer,sprites:Record<string,Sprite>,groundHeight:(x:number,y:number)=>number){
 const prone=game.spawnEntity('tanya',0,12,21),target=game.spawnEntity('tanya',1,15,21),swim=game.spawnEntity('tanya',0,17,11.5),slope=game.spawnEntity('tanya',0,24,33);
 const entities={prone,target,swim,slope};for(const e of Object.values(entities))e.holdFire=true;
 let attacking=false,phase=0,height=0;
 renderer.entityPresentation=e=>{
  if(e===slope)return {height,lean:e.angle===0?-.08:.08};
  if(e!==prone&&e!==swim)return;
  if(e===prone&&phase>=7)return;
  const action=e===swim?'swim':phase<1||phase>=6?'prone':'pronefire',sprite=sprites['tany-actions'];if(!sprite)return;
  const sequence=sprite.sequences?.[action];if(!sequence)return;
  const frame=e===swim?Math.floor(game.time*8)%8:phase<1?Math.min(3,Math.floor(phase*4)):phase>=6?3-Math.min(3,Math.floor((phase-6)*4)):Math.floor(game.time*8)%4;
  const facing=e.angle===0?0:4;
  return {sprite,action,frame:sequence[0]+facing*sequence[2]+frame,swimming:e===swim};
 };
 return {entities,update(time:number){
  phase=time%8;const shouldAttack=phase>=1&&phase<6;
  if(shouldAttack!==attacking){attacking=shouldAttack;if(attacking)game.commandAttack([prone.id],target.id);else game.commandStop([prone.id]);}
  // These two routes are authored inspection paths, not new locomotion rules.
  const u=(time%12)/6,forward=u<1,t=forward?u:2-u;
  swim.x=16.5+4*t;swim.y=11.5;swim.angle=forward?0:Math.PI;
  slope.x=24+5*t;slope.y=33;slope.angle=forward?0:Math.PI;height=groundHeight(slope.x,slope.y)-(renderer.map.elevations?.[Math.round(slope.y)*game.map.width+Math.round(slope.x)]||0)*15;
  slope.path=[{x:forward?29:24,y:33}];slope.lastMovedAt=time;
  // Position is prescribed by the ramp demonstration; don't send it through pathfinding.
  slope.order={kind:'idle'};
 }};
}
export function drawDemoTerrain(ctx:CanvasRenderingContext2D,renderer:BattlefieldRenderer,time:number){
 const point=(x:number,y:number,h=0)=>{const p=renderer.project(x,y);return {x:p.x,y:p.y-h};};
 ctx.font='10px sans-serif';ctx.textAlign='center';ctx.fillStyle='#e7e8bd';
 for(const [x,y,label] of [[12,20,'卧倒 → 射击 → 起身'],[18,9.4,'游泳往返'],[28,35,'原版坡地 · 上坡 / 下坡']] as const){const p=point(x,y);ctx.fillText(label,p.x,p.y-10);}
 ctx.textAlign='start';
}
