// Validate actual GLB attributes, embedded textures, and connecting mesh heights.
import {createRequire} from 'node:module';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';
const req=createRequire(new URL('../model-opt/package.json',import.meta.url));const {NodeIO}=await import(req.resolve('@gltf-transform/core'));const {ALL_EXTENSIONS}=await import(req.resolve('@gltf-transform/extensions'));const io=new NodeIO().registerExtensions(ALL_EXTENSIONS),edges={};
for(const id of ['grass','ocean','plateau','ramp','tree22','tree10']){
 const doc=await io.read('assets/hd/environment/'+id+'.glb');let triangles=0;
 for(const mesh of doc.getRoot().listMeshes())for(const p of mesh.listPrimitives()){
  for(const sem of ['POSITION','NORMAL','TEXCOORD_0','TANGENT']){const attr=p.getAttribute(sem);assert.ok(attr,id+' missing '+sem);assert.ok(attr.getArray().every(Number.isFinite),id+' nonfinite '+sem);}
  const pos=p.getAttribute('POSITION'),normal=p.getAttribute('NORMAL'),indices=p.getIndices();triangles+=indices.getCount()/3;for(const index of indices.getArray()){assert.ok(index<pos.getCount());const n=normal.getElement(index,[]);assert.ok(Math.hypot(...n)>.9,id+' zero normal');}
 }
 assert.ok(triangles>0);for(const tex of doc.getRoot().listTextures())assert.ok(tex.getImage()?.length>0);
 if(id==='ramp'||id==='plateau'){const p=doc.getRoot().listMeshes()[0].listPrimitives()[0].getAttribute('POSITION'),points=[];for(let i=0;i<p.getCount();i++)points.push(p.getElement(i,[]));edges[id]={north:points.filter(p=>p[2]===-.5).map(p=>p[1]),south:points.filter(p=>p[2]===.5).map(p=>p[1])};}
}
assert.deepEqual(edges.ramp.south,edges.plateau.north);assert.ok(edges.ramp.north.every(y=>y===0));console.log('Actual mesh edge positions, unit normals, finite tangents/UVs and embedded textures passed');
