import type {Sprite} from '@game/assets';
import type {GameEngine} from '@game/game/engine';
import type {BattlefieldRenderer} from '@game/renderer';

export function createMapDemos(game:GameEngine,renderer:BattlefieldRenderer,sprites:Record<string,Sprite>){
 const prone=game.spawnEntity('tanya',0,12,21),target=game.spawnEntity('tanya',1,15,21),swim=game.spawnEntity('tanya',0,17,11.5),slope=game.spawnEntity('tanya',0,25,29);
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
  slope.x=25+5*t;slope.y=29;slope.angle=forward?0:Math.PI;height=t*45;
  slope.path=[{x:forward?30:25,y:29}];slope.lastMovedAt=time;
  // Position is prescribed by the ramp demonstration; don't send it through pathfinding.
  slope.order={kind:'idle'};
 }};
}
export function drawDemoTerrain(ctx:CanvasRenderingContext2D,renderer:BattlefieldRenderer,time:number){
 const point=(x:number,y:number,h=0)=>{const p=renderer.project(x,y);return {x:p.x,y:p.y-h};};
 const polygon=(points:Array<{x:number;y:number}>,color:string)=>{ctx.fillStyle=color;ctx.beginPath();points.forEach((p,i)=>i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));ctx.closePath();ctx.fill();};
 const a=point(25,28),b=point(30,28,45),c=point(30,30,45),d=point(25,30);
 polygon([d,c,point(30,30)],'#4a513c');polygon([b,c,point(30,30),point(30,28)],'#55563e');polygon([a,b,c,d],'#7d8055');
 ctx.strokeStyle='#b3ab75';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.lineTo(c.x,c.y);ctx.lineTo(d.x,d.y);ctx.closePath();ctx.stroke();
 for(let i=0;i<22;i++){const x=25.1+(i%7)*.82,y=28.15+(i%3)*.7,p=point(x,y,(x-25)/5*45);ctx.fillStyle=i%2?'#92916a':'#616347';ctx.fillRect(p.x,p.y,5,2);}
 // Water animation and labels are in world coordinates, so they pan and zoom with the map.
 ctx.strokeStyle='#bcdee666';for(let i=0;i<12;i++){const p=point(16.2+i%6,10.3+Math.floor(i/6)*2);ctx.beginPath();ctx.ellipse(p.x+Math.sin(time+i)*3,p.y,8,2,0,0,Math.PI);ctx.stroke();}
 ctx.font='10px sans-serif';ctx.textAlign='center';ctx.fillStyle='#e7e8bd';
 for(const [x,y,label] of [[12,20,'卧倒 → 射击 → 起身'],[18,9.4,'游泳往返'],[28,31,'上坡 / 下坡']] as const){const p=point(x,y);ctx.fillText(label,p.x,p.y-10);}
 ctx.textAlign='start';
}
