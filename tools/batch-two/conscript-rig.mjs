// Fit source-guided leg chains and two-hand weapon IK to this Conscript mesh only.
import {Vector3 as V,Quaternion as Q,Euler,Matrix4}from'three';
const vec=p=>new V(...p),quat=(x=0,y=0,z=0)=>new Q().setFromEuler(new Euler(x,y,z));
export const joints=[];const add=(name,p,parent=-1)=>{joints.push({name,p,parent});return joints.length-1;};
add('Root',[-.07,-.10,-.32]);add('Spine',[-.07,.12,-.34],0);add('Chest',[-.075,.42,-.31],1);add('Head',[-.055,.65,-.255],2);
for(const [side,s]of[['L',1],['R',-1]]){const sh=add(side+'Shoulder',s>0?[.16,.47,-.29]:[-.31,.47,-.31],2),el=add(side+'Elbow',s>0?[.21,.22,-.10]:[-.43,.29,-.22],sh);add(side+'Hand',s>0?[.14,.29,.16]:[-.13,.33,-.01],el);const hip=add(side+'Hip',s>0?[.10,-.11,-.24]:[-.23,-.11,-.40],0),k=add(side+'Knee',s>0?[.12,-.49,-.10]:[-.28,-.49,-.45],hip);add(side+'Foot',s>0?[.18,-.86,.045]:[-.31,-.86,-.50],k);}
add('Weapon',[-.05,.33,.025],0);
const index=n=>joints.findIndex(j=>j.name===n),clamp=(x,a=0,b=1)=>Math.max(a,Math.min(b,x));
function segments(p,chain){let best;const point=vec(p);for(let i=0;i<chain.length-1;i++){const a=vec(joints[chain[i]].p),b=vec(joints[chain[i+1]].p),v=b.clone().sub(a),t=clamp(point.clone().sub(a).dot(v)/v.lengthSq()),distance=point.distanceToSquared(a.addScaledVector(v,t));if(!best||distance<best.distance)best={distance,a:chain[i],b:chain[i+1],t};}return[[best.a,1-best.t],[best.b,best.t]];}
export function weights(p){const[x,y,z]=p,side=x>-.07?'L':'R';
 // Rifle ahead of the hands and stock corridor are rigid; skin/cloth outside remain articulated.
 const lineZ=.025+(x+.05)*1.16;
 if(y>.245&&y<.38&&z>-.17&&Math.abs(z-lineZ)<.075&&(z>.24||x<-.22))return[[16,1]];
 if(y<-.12)return segments(p,[index(side+'Hip'),index(side+'Knee'),index(side+'Foot')]);
 if(y>.62)return[[3,1]];
 if(y>.18&&y<.52&&(z>-.15||x<-.30||x>.14))return segments(p,[index(side+'Shoulder'),index(side+'Elbow'),index(side+'Hand')]);
 return segments(p,[0,1,2,3]);
}
function elbow(shoulder,hand,a,b,side){const d=hand.clone().sub(shoulder),length=Math.max(.001,d.length()),axis=d.clone().normalize(),reach=clamp(length,.001,a+b-.001),along=(a*a-b*b+reach*reach)/(2*reach),height=Math.sqrt(Math.max(0,a*a-along*along)),down=new V(side*.7,-1,0);down.addScaledVector(axis,-down.dot(axis)).normalize();return shoulder.clone().addScaledVector(axis,along).addScaledVector(down,height);}
export function pose(action,t){const phase=t*Math.PI*2,prone=['crawl','prone','fireprone'].includes(action)?1:action==='down'?t:action==='up'?1-t:0,death=action.startsWith('die')?t:0;
 const root=vec(joints[0].p),body=quat(prone*Math.PI/2+death*(action==='die1'?-1.6:1.6),0,death*.18);
 root.y-=prone*.66+death*.65;
 const gait=action==='walk'||action==='panic',crawling=action==='crawl',shoot=action==='fireup'||action==='fireprone',recoil=shoot?Math.max(0,Math.sin(t*Math.PI*6))*.018:0;
 if(gait)root.y+=Math.abs(Math.sin(phase))*.024;
 const pos=joints.map(j=>vec(j.p).sub(vec(joints[0].p)).applyQuaternion(body).add(root)),rot=joints.map(()=>body.clone());
 for(const [side,sign]of[['L',1],['R',-1]]){
  const hi=index(side+'Hip'),ki=index(side+'Knee'),fi=index(side+'Foot'),swing=(gait?.48:crawling?.20:0)*Math.sin(phase+(sign>0?0:Math.PI)),bend=(gait?.6:crawling?.40:0)*Math.max(0,-Math.sin(phase+(sign>0?0:Math.PI)));
  const hipQ=body.clone().multiply(quat(swing)),kneeQ=hipQ.clone().multiply(quat(-bend));
  pos[ki]=vec(joints[ki].p).sub(vec(joints[hi].p)).applyQuaternion(hipQ).add(pos[hi]);pos[fi]=vec(joints[fi].p).sub(vec(joints[ki].p)).applyQuaternion(kneeQ).add(pos[ki]);rot[hi]=hipQ;rot[ki]=kneeQ;rot[fi]=body.clone();
 }
 // Keep the gun horizontal in prone poses. Both grips follow the same rigid transform.
 const yaw=(shoot||prone)?-.70:0,gunQ=quat(0,yaw),gun=vec(joints[16].p);
 if(prone)gun.copy(root).add(new V(0,.16,.68));
 if(shoot)gun.z-=recoil;
 if(action==='idle1')gun.y+=Math.sin(phase)*.035;if(action==='idle2')gunQ.multiply(quat(0,Math.sin(phase)*.12));
 if(death){gun.copy(pos[16]);gunQ.copy(body);}
 pos[16]=gun;rot[16]=gunQ;
 for(const [side,s]of[['L',1],['R',-1]]){const sh=index(side+'Shoulder'),el=index(side+'Elbow'),ha=index(side+'Hand');
  pos[ha]=vec(joints[ha].p).sub(vec(joints[16].p)).applyQuaternion(gunQ).add(gun);
  if(action==='paradrop'||(action==='cheer'&&side==='R'))pos[ha]=pos[sh].clone().add(new V(s*.1,.48,.05));
  const a=vec(joints[sh].p).distanceTo(vec(joints[el].p)),b=vec(joints[el].p).distanceTo(vec(joints[ha].p));pos[el]=elbow(pos[sh],pos[ha],a,b,s);
  rot[sh]=new Q().setFromUnitVectors(vec(joints[el].p).sub(vec(joints[sh].p)).normalize(),pos[el].clone().sub(pos[sh]).normalize());rot[el]=new Q().setFromUnitVectors(vec(joints[ha].p).sub(vec(joints[el].p)).normalize(),pos[ha].clone().sub(pos[el]).normalize());rot[ha]=gunQ.clone();
 }
 rot[3]=death?body.clone():quat(0,shoot?-.05:0);
 return joints.map((j,i)=>{if(j.parent<0)return{translation:pos[i].toArray(),rotation:rot[i].toArray()};const inv=rot[j.parent].clone().invert();return{translation:pos[i].clone().sub(pos[j.parent]).applyQuaternion(inv).toArray(),rotation:inv.multiply(rot[i]).toArray()};});
}
