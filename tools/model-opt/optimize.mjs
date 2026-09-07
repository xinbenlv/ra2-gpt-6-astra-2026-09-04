import {NodeIO} from '@gltf-transform/core';
import {ALL_EXTENSIONS} from '@gltf-transform/extensions';
import {simplify, weld, unweld, prune, tangents, textureCompress} from '@gltf-transform/functions';
import {MeshoptSimplifier} from 'meshoptimizer';
import {generateTangents} from 'mikktspace';
import sharp from 'sharp';
import {readFile, writeFile, mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import path from 'node:path';

// Usage: node optimize.mjs INPUT.glb OUTPUT.glb [triangle-budget]
// Plain geometry + EXT_texture_webp: decodes in both viewer and sprite baker.
const [input, output, budgetArg='30000'] = process.argv.slice(2);
if (!input || !output || path.resolve(input) === path.resolve(output)) throw Error('Provide distinct input and output paths.');
const budget = Number(budgetArg);
if (!Number.isInteger(budget) || budget < 100) throw Error('Invalid triangle budget.');
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
const doc = await io.read(input);
function metrics(d) {
 let triangles=0; const root=d.getRoot();
 const scene=root.getDefaultScene() || root.listScenes()[0];
 scene.traverse(n=>{for(const p of n.getMesh()?.listPrimitives() || []) {
   if(p.getMode()!==4) throw Error('Only triangle primitives are supported by this recipe.');
   triangles+=(p.getIndices() || p.getAttribute('POSITION')).getCount()/3;
 }});
 return {triangles,materials:root.listMaterials().length,textures:root.listTextures().map(t=>({bytes:t.getImage().byteLength,size:t.getSize(),mime:t.getMimeType()})),animations:root.listAnimations().length,skins:root.listSkins().length};
}
const before=metrics(doc), ratio=Math.min(1,budget/before.triangles);
if(before.animations || before.skins) throw Error('This static-sample recipe needs a separate animation/skin review.');
await doc.transform(weld(), ...(ratio<1?[simplify({simplifier:MeshoptSimplifier,ratio,error:0.01})]:[]), unweld(), tangents({generateTangents,overwrite:true}), weld(), prune());
await mkdir(path.dirname(output),{recursive:true});
// Keep a local geometry-only candidate for independent texture assessment.
await io.write(output.replace(/\.glb$/,'.geometry.glb'),doc);
await doc.transform(
 textureCompress({encoder:sharp,targetFormat:'webp',resize:[1024,1024],slots:/^(baseColorTexture|emissiveTexture)$/,quality:85,effort:80}),
 textureCompress({encoder:sharp,targetFormat:'webp',resize:[1024,1024],slots:/^(normalTexture|metallicRoughnessTexture|occlusionTexture)$/,lossless:true,effort:80}),
 prune()
);
await io.write(output,doc);
const after=metrics(await io.read(output));
const sha=b=>createHash('sha256').update(b).digest('hex');
const src=await readFile(input),dst=await readFile(output);
const report={inputName:path.basename(input),inputBytes:src.length,inputSha256:sha(src),outputName:path.basename(output),outputBytes:dst.length,outputSha256:sha(dst),before,after,recipe:{budget,ratio,error:0.01,textureMaxSize:1024,colorWebpQuality:85,dataTextures:'lossless WebP',tangents:'MikkTSpace regenerated',geometryCompression:'none'}};
await writeFile(output.replace(/\.glb$/,'.json'),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report));
