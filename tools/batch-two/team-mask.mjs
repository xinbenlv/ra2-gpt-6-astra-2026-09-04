// Freeze an explicit team-color texture mask inside GLB material extras; preserve original PBR and geometry.
import fs from 'node:fs/promises';
import {createRequire} from 'node:module';
import {createHash} from 'node:crypto';
import {readGLB} from '../four-assets/glb.mjs';
const require=createRequire(new URL('../model-opt/package.json',import.meta.url));
const sharp=require('sharp');
const input='assets/hd/batch-two/htnk-v4.glb',output='assets/hd/batch-two/htnk-v4-team.glb';
const {g,bin}=await readGLB(input),material=g.materials[0];
const texture=g.textures[material.pbrMetallicRoughness.baseColorTexture.index];
const source=g.images[texture.extensions?.EXT_texture_webp?.source??texture.source];
const view=g.bufferViews[source.bufferView];
const {data,info}=await sharp(bin.subarray(view.byteOffset||0,(view.byteOffset||0)+view.byteLength)).removeAlpha().raw().toBuffer({resolveWithObject:true});
const mask=Buffer.alloc(info.width*info.height);let selected=0;
for(let i=0;i<mask.length;i++){
 const r=data[i*info.channels]/255,gc=data[i*info.channels+1]/255,b=data[i*info.channels+2]/255;
 const dominance=(r-Math.max(gc,b))/Math.max(r,.001);
 const t=Math.max(0,Math.min(1,(dominance-.30)/.25));
 mask[i]=Math.round(255*t*t*(3-2*t));if(mask[i])selected++;
}
const png=await sharp(mask,{raw:{width:info.width,height:info.height,channels:1}}).png().toBuffer();
const pad=Buffer.alloc((4-bin.length%4)%4),offset=bin.length+pad.length;
const imageView=g.bufferViews.push({buffer:0,byteOffset:offset,byteLength:png.length})-1;
const imageIndex=g.images.push({name:'Rhino player-color mask',mimeType:'image/png',bufferView:imageView})-1;
material.extras={...material.extras,ra2TeamColor:{version:1,maskImage:imageIndex,texCoord:0,channel:'r',colorSpace:'linear',sourceColor:[1,0,0],method:'red-chroma replacement preserving neutral wear and original PBR'}};
const binary=Buffer.concat([bin,pad,png,Buffer.alloc((4-png.length%4)%4)]);g.buffers[0].byteLength=binary.length;
const json=Buffer.from(JSON.stringify(g)),jp=Buffer.concat([json,Buffer.alloc((4-json.length%4)%4,32)]),head=Buffer.alloc(20),bh=Buffer.alloc(8);
head.write('glTF');head.writeUInt32LE(2,4);head.writeUInt32LE(28+jp.length+binary.length,8);head.writeUInt32LE(jp.length,12);head.write('JSON',16);bh.writeUInt32LE(binary.length);bh.write('BIN\0',4);
const bytes=Buffer.concat([head,jp,bh,binary]);await fs.writeFile(output,bytes);
await fs.mkdir('.cache/batch-two/team-color',{recursive:true});await fs.writeFile('.cache/batch-two/team-color/mask.png',png);
await fs.writeFile('assets/hd/batch-two/htnk-v4-team.json',JSON.stringify({input,output,bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex'),mask:{width:info.width,height:info.height,selectedTexels:selected,totalTexels:mask.length,embeddedImage:imageIndex},semantics:material.extras.ra2TeamColor,note:'Custom RA2 metadata; generic GLB viewers display original red. Geometry, UVs and PBR maps are unchanged.'},null,2)+'\n');
console.log({output,bytes:bytes.length,selectedTexels:selected});
