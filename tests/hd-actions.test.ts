import assert from 'node:assert/strict';
import {test} from 'node:test';
import {GameEngine} from '../src/game/engine';
import {spriteAnimation} from '../src/sprite-animation';
import type {Sprite} from '../src/assets';
import type {Entity} from '../src/game/types';

const sprite:Sprite={src:'test.png',width:1536,height:3840,frameWidth:192,frameHeight:240,columns:8,anchorX:96,anchorY:176,frames:128,facings:8,animationFps:8,sequences:{ready:[0,1,1],walk:[8,8,8],fireup:[72,4,4],hit:[104,3,3]}};
test('HD clips select directional walk frames and restart fire/hit at the real event time',()=>{
 const e={id:1,angle:Math.PI/2,path:[{x:1,y:2}],lastShot:-10} as Entity;
 const walk=spriteAnimation(sprite,e,1);assert.equal(walk.action,'walk');assert(walk.frame>=24&&walk.frame<32);
 e.lastShot=1.234;assert.deepEqual(spriteAnimation(sprite,e,1.234),{action:'fireup',frame:80});
 e.lastHit=1.3;assert.deepEqual(spriteAnimation(sprite,e,1.3),{action:'hit',frame:110});
 assert.equal(spriteAnimation(sprite,e,2).action,'walk');e.lastMovedAt=1;assert.equal(spriteAnimation(sprite,e,2).action,'ready','a stale chase path must not keep walking while firing from a standstill');e.path=[];assert.equal(spriteAnimation(sprite,e,2).action,'ready');
});
test('hold-fire preview actors still obey explicit attacks and publish real damage timing',()=>{
 const game=new GameEngine({map:{width:40,height:40,cells:Array(1600).fill('land'),spawns:[{x:2,y:2},{x:36,y:36}]},players:[{id:0,name:'A',country:'america',team:1},{id:1,name:'B',country:'russia',team:2}],startingUnits:0,fogOfWar:false});
 const a=game.spawnEntity('tanya',0,15,15),b=game.spawnEntity('apocalypse',1,17,15);a.holdFire=b.holdFire=true;
 for(let i=0;i<10;i++)game.step(.1);
 assert.equal(a.lastShot,-10);assert.equal(b.hp,b.maxHp);
 game.commandAttack([a.id],b.id);game.step(.05);
 assert.equal(a.lastShot,game.time);assert.equal(b.lastHit,game.time);assert(b.hp<b.maxHp);
 assert(game.effects.some(e=>e.kind==='hit'&&e.targetId===b.id&&e.sourceId===a.id));
 assert(game.effects.some(e=>e.kind==='shot'&&e.sourceId===a.id));
 game.commandStop([a.id]);const last=a.lastShot;for(let i=0;i<12;i++)game.step(.1);assert.equal(a.lastShot,last);
});
