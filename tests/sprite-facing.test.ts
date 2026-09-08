import assert from 'node:assert/strict';
import {test} from 'node:test';
import {spriteFacing,spriteAnimation} from '../src/sprite-animation';
import {projectTile} from '../src/terrain-painter';
import type {Sprite} from '../src/assets';
import type {Entity} from '../src/game/types';
const base:Sprite={src:'atlas.png',width:1040,height:1000,frameWidth:130,frameHeight:110,frames:619,columns:8,anchorX:65,anchorY:55,facings:8,sequences:{ready:[0,1,1],walk:[8,6,6],fireup:[164,6,6]}};
const screenHeadings=[[0,-1],[-2,-1],[-1,0],[-2,1],[0,1],[2,1],[1,0],[2,-1]];
test('original SHP headings agree with all eight projected movement directions',()=>{
 for(const originalFile of ['tany.shp','gi.shp','cons.shp','engineer.shp','dog.shp','shk.shp','seal.shp']){
  const sprite={...base,originalFile};
  for(let i=0;i<8;i++){
   const angle=i*Math.PI/4,frame=spriteFacing(sprite,angle),[x,y]=screenHeadings[frame],motion=projectTile(Math.cos(angle),Math.sin(angle));
   assert.equal(frame,[5,4,3,2,1,0,7,6][i]);assert(Math.abs(motion.x*y-motion.y*x)<1e-8);assert(motion.x*x+motion.y*y>0);
   const e={angle,path:[{x:1,y:1}],lastShot:-10} as Entity;
   assert.equal(Math.floor((spriteAnimation(sprite,e,0).frame-8)/6),frame,'walk uses the same facing conversion');
   e.lastShot=0;assert.equal(Math.floor((spriteAnimation(sprite,e,0).frame-164)/6),frame,'fire uses the same facing conversion');
  }
 }
});
test('VXL/HD atlas coordinates are preserved and angles wrap and quantize symmetrically',()=>{
 const voxel={...base,frames:32,facings:32,sequences:undefined,originalFile:'mtnk.vxl,mtnktur.vxl'};
 const hd={...base,originalFile:undefined,animationFps:8};
 for(let i=0;i<8;i++){assert.equal(spriteFacing(voxel,i*Math.PI/4),i*4);assert.equal(spriteFacing(hd,i*Math.PI/4),i);}
 for(const sprite of [voxel,hd,{...base,originalFile:'tany.shp'}]){
  assert.equal(spriteFacing(sprite,0),spriteFacing(sprite,Math.PI*2));assert.equal(spriteFacing(sprite,0),spriteFacing(sprite,-Math.PI*2));
  assert.equal(spriteFacing(sprite,.01),spriteFacing(sprite,-.01));
 }
 // Explicit metadata wins over a legacy filename.
 assert.equal(spriteFacing({...base,originalFile:'tany.shp',facingConvention:'world-xy'},0),0);
});
