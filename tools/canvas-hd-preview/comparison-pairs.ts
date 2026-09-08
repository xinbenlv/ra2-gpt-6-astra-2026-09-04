import type {Sprite} from '@game/assets';
import type {GameEngine} from '@game/game/engine';
import type {Entity} from '@game/game/types';
import {CATALOG} from '@game/game/data';
import type {BattlefieldRenderer} from '@game/renderer';
import {spriteAnimation,spriteFacing} from '@game/sprite-animation';

/** Render-only mirrors keep movement, shots and HP comparable without adding combatants. */
export function createComparisonPairs(game:GameEngine,renderer:BattlefieldRenderer,original:Record<string,Sprite>,groundHeight:(x:number,y:number)=>number,high:()=>boolean){
 const previous=renderer.entityPresentation;
 const pairs=game.entities.filter(e=>e.kind==='unit'&&e.hp>0&&['apocalypse','tanya'].includes(e.type)).map(source=>{
  const sprite=original[CATALOG[source.type].sprite];if(!sprite)throw Error('缺少原版对照素材：'+source.type);
  return {source,sprite,copy:{...source,id:-source.id-1} as Entity};
 });
 renderer.comparisonEntities=pairs.map(pair=>pair.copy);
 renderer.entityPresentation=e=>{
  const pair=pairs.find(p=>p.copy.id===e.id);
  if(!pair){const view=previous?.(e);return pairs.some(p=>p.source.id===e.id)?{...view,label:high()?'高清':'主单位（原版）'}:view;}
  const {source,sprite}=pair,view=previous?.(source),phase=game.time%8;
  let action=view?.action,frame:number|undefined;
  if(action==='prone')action=phase<1?'down':'up';
  if(action==='pronefire')action='fireprone';
  if(action){
   const sequence=sprite.sequences?.[action];
   if(sequence){const direction=spriteFacing(sprite,source.angle);const age=action==='down'?phase:action==='up'?phase-6:game.time;
    const step=action==='up'||action==='down'?Math.min(sequence[1]-1,Math.floor(age*(view?.action==='prone'?sequence[1]:12))):Math.floor(age*12)%sequence[1];frame=sequence[0]+direction*sequence[2]+step;
    if(frame>=sprite.frames)throw Error('原版动作图集不完整：'+action);
   }
  }
  const animation=spriteAnimation(sprite,e,game.time);
  const height=view?.height!=null?groundHeight(e.x,e.y)-(renderer.map.elevations?.[Math.round(e.y)*game.map.width+Math.round(e.x)]||0)*15:undefined;
  return {sprite,frame:frame??animation.frame,action:action||animation.action,height,label:'原版',lean:view?.lean};
 };
 return {pairs,update(){
  for(const {source,copy}of pairs){const offset=source.type==='apocalypse'?1.25:.65,id=copy.id;Object.assign(copy,source,{id,x:source.x+offset,y:source.y-offset});}
 }};
}
