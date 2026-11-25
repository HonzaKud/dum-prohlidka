import * as THREE from 'three';

export function stick(gamepad) {
 const a=gamepad?.axes??[],i=a.length>=4?2:0;
 let x=Number.isFinite(a[i])?a[i]:0,y=Number.isFinite(a[i+1])?a[i+1]:0;
 const n=Math.hypot(x,y);
 if(n<=.2)return [0,0];
 const strength=Math.min(1,(n-.2)/.8);
 return [x/n*strength,y/n*strength];
}
export function readInput(sources=[]) {
 let move=[0,0],turn=0,home=false,boost=false;
 for(const source of sources) {
  const g=source.gamepad;if(!g)continue;
  if(source.handedness==='left')move=stick(g);
  if(source.handedness==='right')turn=stick(g)[0];
  home ||= Boolean(g.buttons?.[4]?.pressed);
  boost ||= Boolean(g.buttons?.[0]?.pressed);
 }
 return {move,turn,home,boost};
}
export function centerRig(rig,position,orientation) {
 const direction=new THREE.Vector3(0,0,-1).applyQuaternion(orientation);
 const yaw=Math.atan2(-direction.x,-direction.z);
 rig.rotation.set(0,Math.atan2(14,19)-yaw,0);
 const offset=position.clone().applyQuaternion(rig.quaternion);
 rig.position.set(14-offset.x,0,19-offset.z);
 rig.updateMatrixWorld(true);
}
export function snapRig(rig,headPosition,angle) {
 rig.updateMatrixWorld(true);
 const before=rig.localToWorld(headPosition.clone());
 rig.rotation.y+=angle;rig.updateMatrixWorld(true);
 const after=rig.localToWorld(headPosition.clone());
 rig.position.add(before.sub(after));rig.updateMatrixWorld(true);
}
export function moveRig(rig,orientation,move,seconds,boost=false) {
 const forward=new THREE.Vector3(0,0,-1).applyQuaternion(orientation).applyQuaternion(rig.quaternion);
 forward.y=0;if(forward.lengthSq()<.00001)return;
 forward.normalize();
 const right=new THREE.Vector3(-forward.z,0,forward.x);
 const delta=forward.multiplyScalar(-move[1]).addScaledVector(right,move[0]);
 if(delta.lengthSq()>1)delta.normalize();
 const dt=Number.isFinite(seconds)?THREE.MathUtils.clamp(seconds,0,.05):0;
 rig.position.addScaledVector(delta,dt*(boost?2.8:1.4));rig.updateMatrixWorld(true);
}
