import * as THREE from 'three';
import {readInput,centerRig,snapRig,moveRig} from './vr-motion.js';

export class HouseVR {
 constructor(renderer,scene,camera,controls,{button,onChange=()=>{}}) {
  this.renderer=renderer;this.camera=camera;this.controls=controls;this.button=button;this.onChange=onChange;
  this.ready=false;this.supported=false;this.checked=false;this.busy=false;this.saved=null;
  this.rig=new THREE.Group();this.rig.name='VR player';scene.add(this.rig);this.rig.add(camera);
  renderer.xr.enabled=true;renderer.xr.setReferenceSpaceType('local-floor');
  renderer.xr.setFramebufferScaleFactor(.8);renderer.xr.setFoveation(1);
  for(let i=0;i<2;i++){
   const grip=renderer.xr.getControllerGrip(i);
   const mesh=new THREE.Mesh(new THREE.CylinderGeometry(.018,.024,.11,8),new THREE.MeshStandardMaterial({color:'#304d43',roughness:.65}));
   mesh.rotation.x=Math.PI/2;grip.add(mesh);this.rig.add(grip);
  }
  this.start=()=>this.sessionStart();this.end=()=>this.sessionEnd();
  renderer.xr.addEventListener('sessionstart',this.start);renderer.xr.addEventListener('sessionend',this.end);
  button.addEventListener('click',()=>this.toggle());
  this.detect();
 }
 get active(){return this.renderer.xr.isPresenting;}
 emit(message='') {
  this.button.disabled=!this.ready||!this.checked||this.busy;
  this.button.textContent=this.active?'Zavřít VR':'VR';
  this.button.setAttribute('aria-label',this.active?'Ukončit VR':'Vstoupit do VR');
  this.button.title=this.supported?'Vstoupit do virtuální reality':'Otevři web v prohlížeči Meta Questu';
  this.onChange({active:this.active,message,supported:this.supported});
 }
 async detect(){
  try{this.supported=Boolean(globalThis.isSecureContext&&navigator.xr&&await navigator.xr.isSessionSupported('immersive-vr'));}
  catch{this.supported=false;}
  this.checked=true;this.emit();
 }
 setReady(){this.ready=true;this.emit();}
 async toggle(){
  if(!this.ready||this.busy)return;
  if(this.active){await this.renderer.xr.getSession().end();return;}
  if(!this.supported){this.emit('Pro VR otevři tento odkaz v prohlížeči Meta Questu a znovu stiskni VR. Běžné prohlížení můžeš používat tady.');return;}
  this.saved={position:this.camera.position.clone(),quaternion:this.camera.quaternion.clone(),fov:this.camera.fov,aspect:this.camera.aspect,near:this.camera.near,far:this.camera.far,zoom:this.camera.zoom};
  this.busy=true;this.emit();
  let session;
  try {
   session=await navigator.xr.requestSession('immersive-vr',{requiredFeatures:['local-floor'],optionalFeatures:['bounded-floor']});
   await this.renderer.xr.setSession(session);
  } catch(error) {
   if(session){try{await session.end();}catch{}}
   this.sessionEnd();
   this.lastMessage='VR se nepodařilo spustit. Povol vstup do VR v prohlížeči headsetu a zkus to znovu.';
  } finally {this.busy=false;this.emit(this.lastMessage??'');this.lastMessage='';}
 }
 sessionStart(){
  this.controls.setSuspended(true);
  this.camera.position.set(0,0,0);this.camera.quaternion.identity();
  this.rig.position.set(14,0,19);this.rig.rotation.set(0,Math.atan2(14,19),0);
  this.firstPose=true;this.snapArmed=false;this.homeHeld=true;
  this.emit();
 }
 sessionEnd(){
  this.firstPose=true;this.snapArmed=false;this.homeHeld=true;
  this.rig.position.set(0,0,0);this.rig.rotation.set(0,0,0);
  if(this.saved){this.camera.position.copy(this.saved.position);this.camera.quaternion.copy(this.saved.quaternion);for(const key of ['fov','aspect','near','far','zoom'])this.camera[key]=this.saved[key];this.camera.updateProjectionMatrix();this.saved=null;}
  this.camera.updateMatrixWorld(true);this.controls.setSuspended(false);
  this.emit();
 }
 update(dt,frame){
  const session=this.renderer.xr.getSession();
  if(!session||!frame)return;
  if(session.visibilityState!=='visible'){this.snapArmed=false;this.homeHeld=true;return;}
  const ref=this.renderer.xr.getReferenceSpace();if(!ref)return;
  const pose=frame.getViewerPose(ref);if(!pose)return;
  const t=pose.transform;
  const p=new THREE.Vector3(t.position.x,t.position.y,t.position.z);
  const q=new THREE.Quaternion(t.orientation.x,t.orientation.y,t.orientation.z,t.orientation.w);
  const input=readInput(session.inputSources);
  if(this.firstPose||(input.home&&!this.homeHeld)){centerRig(this.rig,p,q);this.firstPose=false;}
  this.homeHeld=input.home;
  if(Math.abs(input.turn)<.25)this.snapArmed=true;
  if(this.snapArmed&&Math.abs(input.turn)>.65){
   snapRig(this.rig,p,-Math.sign(input.turn)*Math.PI/6);this.snapArmed=false;
  }
  moveRig(this.rig,q,input.move,dt,input.boost);
 }
}
