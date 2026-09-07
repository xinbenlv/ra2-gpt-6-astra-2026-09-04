import assert from 'node:assert/strict';
import {test} from 'node:test';
import {Assets, type Sprite} from '../src/assets';
import {BattlefieldRenderer} from '../src/renderer';

function sprite(density?:number):Sprite {
  const d=density&&Number.isFinite(density)&&density>0?density:1;
  return {src:'test.png',width:256*d,height:128*d,frameWidth:128*d,frameHeight:128*d,frames:2,columns:2,anchorX:64*d,anchorY:64*d,...(density===undefined?{}:{pixelRatio:density})};
}
test('HD assets sample all source pixels while placement keeps legacy size and anchor',()=>{
  const image={} as HTMLImageElement;
  function draw(density?:number){
    const assets=new Assets();assets.manifest.sprites.test=sprite(density);assets.images.set('test.png',image);
    let args:unknown[]=[];const ctx={drawImage(...values:unknown[]){args=values;}} as unknown as CanvasRenderingContext2D;
    assert(assets.draw(ctx,'test',100,150,1,2));return args.slice(1) as number[];
  }
  const legacy=draw(),hd=draw(4);
  assert.deepEqual(hd.slice(0,4),legacy.slice(0,4).map(n=>n*4));
  assert.deepEqual(hd.slice(4),legacy.slice(4));
  for(const invalid of [0,-2,NaN,Infinity])assert.deepEqual(draw(invalid),legacy);
});
test('HD battlefield actors retain logical hit bounds and restore terrain smoothing',()=>{
  function render(density?:number){
    const r=Object.create(BattlefieldRenderer.prototype) as any;
    const s=sprite(density),image={},calls:number[][]=[];
    const ctx={imageSmoothingEnabled:false,drawImage(_image:unknown,...args:number[]){calls.push(args);},beginPath(){},ellipse(){},fill(){}} as any;
    Object.assign(r,{assets:{sprite(){return s;}},map:{width:50,theater:'temperate'},game:{players:[{id:0,color:'#ef494c'}],time:0},selection:new Set(),tileLookup:new Map(),displayedSprites:new Map(),camera:{x:0,y:0},width:1000,height:800,zoom:1.5,time:0,coloredSprite(){return image;}});
    const e={id:1,type:'apocalypse',kind:'unit',owner:0,x:10,y:10,hp:950,maxHp:950,path:[],angle:Math.PI,lastShot:-10};
    r.drawEntity(ctx,e);assert.equal(ctx.imageSmoothingEnabled,false);
    return {draw:calls[0],hit:r.displayedSprites.get(1)};
  }
  const legacy=render(),hd=render(4);
  assert.deepEqual(hd.draw.slice(0,4),legacy.draw.slice(0,4).map(n=>n*4));
  assert.deepEqual(hd.draw.slice(4),legacy.draw.slice(4));assert.deepEqual(hd.hit,legacy.hit);
});
