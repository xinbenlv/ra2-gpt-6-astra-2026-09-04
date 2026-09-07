import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import {createInfantryPose} from './procedural-poses.js';
test('procedural poses preserve rest geometry with interleaved glTF attributes',()=>{
 const buffer=new T.InterleavedBuffer(new Float32Array([-.1,0,0,0,1,0,.1,0,0,0,1,0,-.1,1,0,0,1,0,.1,1,0,0,1,0]),6);
 const g=new T.BufferGeometry();g.setAttribute('position',new T.InterleavedBufferAttribute(buffer,3,0));g.setAttribute('normal',new T.InterleavedBufferAttribute(buffer,3,3));
 const mesh=new T.Mesh(g),pose=createInfantryPose(mesh),initial=buffer.array.slice();pose('ready',0);assert.deepEqual(buffer.array,initial);
 pose('walk',.25);assert.notDeepEqual(buffer.array,initial);pose('ready',0);assert.deepEqual(buffer.array,initial);
});
