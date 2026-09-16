// Local training targets and shot visualization; existing GameEngine owns damage/timing.
import * as T from 'three';
export function makeCombat(game,world,models){
 const targets=[],shots=[];
 for(const [type,x,z]of[['rhino',19,27],['submarine',28,27]]){
  const entity=game.spawnEntity(type,-1,x,z);entity.holdFire=true;
  const mesh=new T.Mesh(new T.CylinderGeometry(.28,.38,.6,12),new T.MeshStandardMaterial({color:0xe8b758,roughness:.75}));mesh.position.set(x,type==='submarine'?-.1:.3,z);world.scene.add(mesh);targets.push({entity,mesh,type});
 }
 function command(m,target=targets[m.kind==='naval'?1:0]){if(!m||m.environment||m.kind==='building')return;m.mode='auto';m.heading=0;game.commandAttack([m.entity.id],target.entity.id);}
 function update(){
  for(const t of targets){t.entity.hp=Math.max(t.entity.hp,t.entity.maxHp*.05);t.mesh.position.x=t.entity.x;t.mesh.position.z=t.entity.y;}
  for(const m of models){if(!['htnk','cons','dest'].includes(m.id))continue;
   const target=game.getEntity(m.entity.targetId),moving=m.moving||!!m.entity.path?.length;
   if(moving||m.driveAngle===undefined)m.driveAngle=m.entity.angle;
   if(m.id==='htnk'&&target&&!moving){m.group.rotation.y=Math.atan2(m.forwardAxis[2],m.forwardAxis[0])-m.driveAngle;const turret=m.gltf.scene.getObjectByName('Turret');if(turret)turret.rotation.y=m.driveAngle-Math.atan2(target.y-m.entity.y,target.x-m.entity.x);}
   if(m.entity.lastShot!==undefined&&m.entity.lastShot!==m.seenShot){m.seenShot=m.entity.lastShot;if(!target)continue;
    m.group.updateMatrixWorld(true);const local=m.muzzleLocal?new T.Vector3(...m.muzzleLocal):m.id==='htnk'?new T.Vector3(-.58,0,0):m.id==='dest'?new T.Vector3(-.18,0,0):new T.Vector3(.513,-.029,.599);
    const node=m.gltf.scene.getObjectByName(m.id==='cons'?'Weapon':'Barrel');const from=node?node.localToWorld(local):m.group.position.clone().add(new T.Vector3(0,.5,0));
    const to=new T.Vector3(target.x,.35,target.y),geo=new T.BufferGeometry().setFromPoints([from,to]),line=new T.Line(geo,new T.LineBasicMaterial({color:m.id==='cons'?0xffee99:0xffa33a}));world.scene.add(line);shots.push({line,until:game.time+.18,source:m.id,from:from.toArray(),to:to.toArray()});
   }
  }
  for(let i=shots.length-1;i>=0;i--)if(game.time>shots[i].until){shots[i].line.removeFromParent();shots[i].line.geometry.dispose();shots[i].line.material.dispose();shots.splice(i,1);}
 }
 return{targets,shots,command,update};
}
