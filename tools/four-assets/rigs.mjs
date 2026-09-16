// Asset-specific rest joints and source-key rotations. Coordinates retain each Meshy input's Y-up/+Z front axes.
import {Quaternion,Euler,Vector3} from 'three';
const q=(x=0,y=0,z=0)=>new Quaternion().setFromEuler(new Euler(x,y,z)).toArray();
const clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,v));
const lerp=(a,b,t)=>a+(b-a)*t;
function sample(a,p,loop=true){const v=clamp(p)*(loop?a.length:a.length-1),i=Math.min(a.length-1,Math.floor(v)),j=loop?(i+1)%a.length:Math.min(i+1,a.length-1);return lerp(a[i],a[j],v-i);}
export function makeRig(id){const joints=[];function bone(name,p,parent=-1){const i=joints.length;joints.push({name,p,parent});return i;}
 if(id==='rock'){
 bone('Root',[0,-.04,0]);bone('Spine',[0,.18,0],0);bone('Chest',[0,.47,0],1);bone('Head',[0,.72,.02],2);
 for(const [side,s]of[['L',1],['R',-1]]){const a=bone(side+'Shoulder',[s*.22,.51,.02],2),e=bone(side+'Elbow',[s*.31,.24,.16],a);bone(side+'Hand',[s*.31,.17,.44],e);const h=bone(side+'Hip',[s*.14,-.06,0],0),k=bone(side+'Knee',[s*.16,-.43,side==='L'?-.06:.08],h);bone(side+'Foot',[s*.16,-.79,side==='L'?-.18:.13],k);}
 }else{bone('Mantle',[0,.12,-.30]);for(let a=0;a<8;a++){const theta=a/8*Math.PI*2;let parent=0;for(let k=0;k<5;k++){const z=-.10+k*.235,r=.075+k*.023;parent=bone('Arm'+a+'_'+k,[Math.cos(theta)*r,.09+Math.sin(theta)*r-(k/4)*.17,z],parent);}}}
 return joints;}
export function weights(id,p,joints){const [x,y,z]=p;
 if(id==='rock'){
  const s=x>0?'L':'R',lookup=n=>joints.findIndex(j=>j.name===n);let chain;
  if(y<-.09)chain=[lookup(s+'Hip'),lookup(s+'Knee'),lookup(s+'Foot')];
  else if(y>.65)chain=[2,3];
  else if(z>-.05&&(Math.abs(x)>.225||(z>.25&&y<.42)))chain=[lookup(s+'Shoulder'),lookup(s+'Elbow'),lookup(s+'Hand')];
  else chain=[0,1,2];
  return nearestSegments(p,chain,joints);
 }
 if(z<-.14)return [[0,1]];
 const theta=Math.atan2(y-.09+clamp((z+.1)/.94)*.17,x),a=((Math.round(theta/(Math.PI/4))%8)+8)%8;
 return nearestSegments(p,[0,...Array.from({length:5},(_,k)=>1+a*5+k)],joints);
}
function nearestSegments(p,chain,joints){const point=new Vector3(...p);let best;for(let i=0;i<chain.length-1;i++){const a=new Vector3(...joints[chain[i]].p),b=new Vector3(...joints[chain[i+1]].p),v=b.clone().sub(a),t=clamp(point.clone().sub(a).dot(v)/v.lengthSq()),dist=point.distanceToSquared(a.addScaledVector(v,t));if(!best||dist<best.dist)best={dist,a:chain[i],b:chain[i+1],t};}return[[best.a,1-best.t],[best.b,best.t]];}
export function pose(id,action,phase,joints){const out=joints.map(j=>({rotation:q(),translation:j.parent<0?[...j.p]:j.p.map((v,k)=>v-joints[j.parent].p[k])})),set=(n,x=0,y=0,z=0)=>out[joints.findIndex(j=>j.name===n)].rotation=q(x,y,z);
 if(id==='rock'){
 // Original flight has subtle alternating hanging legs, not a walking gait. Rest mesh's arms are bent forward: lower them for hover.
 const sway=sample([0,.03,.06,.02,-.04,-.025],phase),shoot=action==='firefly',kick=shoot?sample([.08,.15,0,.05,.14,0],phase):0;
 set('LShoulder',shoot?-.12:.48,0,-.035);set('RShoulder',shoot?-.12:.48,0,.035);
 set('LElbow',shoot?-.15+kick:.45);set('RElbow',shoot?-.15+kick:.45);
 set('LHip',.12+sway);set('RHip',-.06-sway);set('LKnee',-.12-sway);set('RKnee',.08+sway);
 set('Chest',shoot?-.035-kick*.2:0);set('Head',shoot?.03:0);
 let deathFrame=null;if(action==='tumble')deathFrame=phase*14;if(action==='airdeathstart')deathFrame=phase*7;if(action==='airdeathfalling')deathFrame=8;if(action==='airdeathfinish')deathFrame=9+phase*5;
 if(deathFrame!==null){const t=deathFrame/14;set('Root',sample([0,-.3,-1.25,-2.5,-3.1,-3.4,-4.5,-4.7],t,false),0,.18*Math.sin(t*Math.PI));set('LShoulder',-.2,0,-.65);set('RShoulder',-.5,0,.7);set('LHip',.5);set('RHip',-.35);out[0].translation[1]-=t*.35;}
 if(action==='paradrop'){set('LShoulder',0,0,-2);set('RShoulder',0,0,2);}
 if(action==='cheer'){set('LShoulder',-.2,0,-sample([.4,1,2.2,2.5,2,2.5,1,.4],phase,false));}
 }else{
 // Source swim keys: straight 0–2, spread/curl 3–8, sweep closed at 9, trailing 10–19.
 const curl=action==='swim'?sample([0,.02,.1,.55,.8,1,.75,.9,.7,.1,0,0,0,0,0,0,0,0,0,0],phase):action==='attack'?sample([0,.15,.1,.3,.55,.8,1,1,1,1,.9,.65,.4,.15,0,0],phase,false):0;
 const lift=action==='attack'?sample([0,.05,.02,.1,.4,.8,1,1,1,1,1,.65,.35,0,0,0],phase,false):0;
 set('Mantle',lift*1.1);for(const j of joints){if(j.arm===undefined)continue;const k=Number(j.name.split('_')[1]),sign=Math.sign(j.p[0]),feeler=j.longFeeler;
 const gain=k===0?0:k===1?.2:k===7?.35:1;
 const sx=feeler?(action==='attack'?-.48:-.32):-.80;
 set(j.name,curl*sx*gain,sign*curl*(feeler?.38:.13)*gain,0);
 }
 }
 return out;}
