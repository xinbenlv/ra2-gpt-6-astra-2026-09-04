// Summarize welded connected components to guide explicit mechanical segmentation.
import {readGLB,editor}from'../four-assets/glb.mjs';
for(const id of process.argv.slice(2)){const d=await readGLB('.cache/batch-two/'+id+'/30k.glb'),e=editor(d),p=d.g.meshes[0].primitives[0],v=e.values(p.attributes.POSITION),ix=e.values(p.indices),parent=Array.from({length:v.length/3},(_,i)=>i),map=new Map();
function root(a){while(parent[a]!==a){parent[a]=parent[parent[a]];a=parent[a];}return a;}function join(a,b){parent[root(a)]=root(b);}
for(let i=0;i<v.length;i+=3){const key=v.slice(i,i+3).map(n=>n.toFixed(5)).join(',');if(map.has(key))join(i/3,map.get(key));else map.set(key,i/3);}
for(let i=0;i<ix.length;i+=3){join(ix[i],ix[i+1]);join(ix[i],ix[i+2]);}
const groups=new Map();for(let i=0;i<ix.length;i+=3){const key=root(ix[i]);if(!groups.has(key))groups.set(key,{triangles:0,min:[Infinity,Infinity,Infinity],max:[-Infinity,-Infinity,-Infinity]});const g=groups.get(key);g.triangles++;for(let j=0;j<3;j++)for(let c=0;c<3;c++){g.min[c]=Math.min(g.min[c],v[ix[i+j]*3+c]);g.max[c]=Math.max(g.max[c],v[ix[i+j]*3+c]);}}
console.log(id,JSON.stringify([...groups].sort((a,b)=>b[1].triangles-a[1].triangles).slice(0,15)));}
