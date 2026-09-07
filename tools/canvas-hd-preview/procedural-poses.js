import {BufferAttribute} from 'three';
// Preview-only spatial deformation of the static Tanya mesh, not a skeletal rig.
// Keep the original mesh unchanged; every frame starts from the same source arrays.
export function createInfantryPose(mesh) {
  const geometry=mesh.geometry;geometry.computeBoundingBox();const box=geometry.boundingBox;
  const height=box.max.y-box.min.y,cx=(box.max.x+box.min.x)/2;
  const position=geometry.attributes.position,normal=geometry.attributes.normal;
  // GLTFLoader often returns interleaved attributes; .array is not packed XYZ.
  const source=new Float32Array(position.count*3),normals=new Float32Array(normal.count*3);
  for(let i=0;i<position.count;i++){source.set([position.getX(i),position.getY(i),position.getZ(i)],i*3);normals.set([normal.getX(i),normal.getY(i),normal.getZ(i)],i*3);}
  geometry.setAttribute('remapHeight',new BufferAttribute(Float32Array.from({length:position.count},(_,i)=>(source[i*3+1]-box.min.y)/height),1));
  const smooth=(a,b,x)=>{const t=Math.max(0,Math.min(1,(x-a)/(b-a)));return t*t*(3-2*t);};
  return (action,phase)=>{
    for(let i=0;i<position.count;i++){
      let x=source[i*3],y=source[i*3+1],z=source[i*3+2],ny=normals[i*3+1],nz=normals[i*3+2];
      const h=(y-box.min.y)/height,side=x<cx?-1:1;
      const leg=1-smooth(.43,.51,h);
      const arm=smooth(.10,.17,Math.abs(x-cx)/height)*(1-smooth(.76,.83,h))*smooth(.32,.43,h);
      let angle=0,pivot=box.min.y+height*.49;
      if(action==='walk')angle=Math.sin(phase*Math.PI*2)*side*.48*leg;
      if(arm>.001){pivot=box.min.y+height*.77;angle=action==='fireup'?(-1.3+Math.sin(phase*Math.PI)*.12)*arm:action==='walk'?-Math.sin(phase*Math.PI*2)*side*.35*arm:0;}
      const cy=y-pivot,c=Math.cos(angle),s=Math.sin(angle);
      y=pivot+cy*c-z*s;z=cy*s+z*c;
      const ony=ny;ny=ny*c-nz*s;nz=ony*s+nz*c;
      if(action==='walk')y+=(1-Math.cos(phase*Math.PI*4))*height*.009;
      if(action==='hit'){const weight=smooth(.43,.9,h);z-=Math.sin(phase*Math.PI)*height*.07*weight;}
      position.setXYZ(i,x,y,z);normal.setXYZ(i,normals[i*3],ny,nz);
    }
    position.needsUpdate=true;normal.needsUpdate=true;
  };
}
