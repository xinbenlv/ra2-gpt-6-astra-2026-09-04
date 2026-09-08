import assert from 'node:assert/strict';
import {test} from 'node:test';
import {Assets,spriteFrame,type Sprite} from '../src/assets';
import {spriteAnimation} from '../src/sprite-animation';
import type {Entity} from '../src/game/types';

test('packed frames keep the original foot anchor after density scaling, including off-centre falling poses',()=>{
 const sprite:Sprite={src:'packed.png',width:512,height:256,frameWidth:520,frameHeight:440,frames:2,columns:1,anchorX:260,anchorY:220,pixelRatio:4,frameRects:[[0,0,80,140,40,136],[84,0,180,64,244,88]]};
 const assets=new Assets();assets.manifest.sprites.tany=sprite;assets.images.set(sprite.src,{} as HTMLImageElement);
 const draws:unknown[][]=[];const ctx={drawImage(...args:unknown[]){draws.push(args);}} as unknown as CanvasRenderingContext2D;
 assets.draw(ctx,'tany',100,200,1);
 assert.deepEqual(draws[0].slice(1),[84,0,180,64,39,178,45,16]);
 assert.deepEqual(spriteFrame(sprite,-1),spriteFrame(sprite,1));
});
test('remastered action frames share the original clock and facing at walking and firing times',()=>{
 const original:Sprite={src:'original',width:10,height:10,frameWidth:10,frameHeight:10,frames:619,columns:16,anchorX:5,anchorY:5,facings:8,facingConvention:'ra2-shp',sequences:{ready:[0,1,1],walk:[8,6,6],fireup:[164,6,6]}};
 const remaster:Sprite={...original,src:'remaster',animationFps:12,animationClock:'source'};
 for(let direction=0;direction<8;direction++)for(const time of [0,.08,.17,.26,.42,.5,1.7,9.9]){
  const actor={id:123,angle:direction*Math.PI/4,path:[{x:1,y:1}],lastShot:-10} as Entity;
  assert.deepEqual(spriteAnimation(remaster,actor,time),spriteAnimation(original,actor,time));
  actor.lastShot=time-.1;assert.deepEqual(spriteAnimation(remaster,actor,time),spriteAnimation(original,actor,time));
 }
});
