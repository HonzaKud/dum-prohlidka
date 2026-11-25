import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
const KEYS = new Set(['KeyW','KeyA','KeyS','KeyD','ArrowUp','ArrowDown','ArrowLeft','ArrowRight','ShiftLeft','ShiftRight','Space','KeyE','KeyQ','ControlLeft','ControlRight']);
const MODES = new Set(['orbit','walk','fly']);
export class HouseControls {
 constructor(camera, domElement, options={}) {
  this.camera=camera;this.domElement=domElement;this.onStateChange=options.onStateChange??(()=>{});
  this.mode='orbit';this.error=null;this.disposed=false;
  this.touch=Boolean(window.matchMedia?.('(pointer: coarse)').matches||navigator.maxTouchPoints>0||window.innerWidth<=760);
  this.keys=new Set();this.stick={id:null,x:0,y:0};this.lookPointer=null;this.mouseDrag=null;this.verticalPointers=new Map();this.cleanups=[];
  this.euler=new THREE.Euler(0,0,0,'YXZ');this.delta=new THREE.Vector3();
  this.orbit=new OrbitControls(camera,domElement);
  Object.assign(this.orbit,{enableDamping:true,dampingFactor:.08,minDistance:3,maxDistance:110,maxPolarAngle:Math.PI/2-.02});
  this.orbit.target.set(0,2,0);
  if(domElement.tabIndex<0)domElement.tabIndex=0;
  this.listen(document,'pointerlockchange',()=>{this.clear();this.emit();});
  this.listen(document,'pointerlockerror',()=>{this.error='Myš nelze zachytit. Klikni na model a použij WASD; rozhlížej se tažením s pravým tlačítkem.';this.emit();});
  this.listen(window,'blur',()=>this.clear());
  this.listen(document,'visibilitychange',()=>{if(document.hidden)this.clear();});
  this.listen(document,'keydown',event=>{
   if(event.code==='Escape'){this.clear();if(this.locked)document.exitPointerLock();}
   else if(this.acceptsKeys()&&KEYS.has(event.code)){event.preventDefault();this.keys.add(event.code);}
  });
  this.listen(document,'keyup',event=>{this.keys.delete(event.code);if(this.acceptsKeys()&&KEYS.has(event.code))event.preventDefault();});
  this.listen(document,'mousemove',event=>{if(!this.suspended&&this.mode!=='orbit'&&this.locked)this.look(event.movementX*.0022,event.movementY*.0022);});
  this.listen(domElement,'contextmenu',event=>event.preventDefault());
  this.listen(domElement,'pointerdown',event=>{
   if(this.suspended||this.mode==='orbit'||this.locked||event.button!==2)return;
   domElement.focus({preventScroll:true});domElement.setPointerCapture(event.pointerId);
   this.mouseDrag={id:event.pointerId,x:event.clientX,y:event.clientY};event.preventDefault();
  });
  this.listen(domElement,'pointermove',event=>{
   const p=this.mouseDrag;if(!p||p.id!==event.pointerId||this.locked)return;
   this.look((event.clientX-p.x)*.004,(event.clientY-p.y)*.004);p.x=event.clientX;p.y=event.clientY;
  });
  for(const name of ['pointerup','pointercancel','lostpointercapture'])
   this.listen(domElement,name,event=>{if(this.mouseDrag?.id===event.pointerId)this.mouseDrag=null;});
  this.setupTouch();this.reset();
 }
 setSuspended(value){this.suspended=value;this.clear();this.orbit.enabled=!value&&this.mode==='orbit';if(value&&this.locked)document.exitPointerLock();}
 get locked(){return document.pointerLockElement===this.domElement;}
 get state(){return {mode:this.mode,locked:this.locked,touch:this.touch,error:this.error};}
 emit(){this.onStateChange(this.state);}
 listen(target,name,callback,options){if(!target)return;target.addEventListener(name,callback,options);this.cleanups.push(()=>target.removeEventListener(name,callback,options));}
 acceptsKeys(){
  if(this.mode==='orbit'||this.disposed||this.suspended)return false;
  if(document.activeElement?.matches?.('input, textarea, select, [contenteditable="true"]'))return false;
  return this.locked||document.activeElement===this.domElement;
 }
 clear(){
  this.keys.clear();this.stick.id=null;this.stick.x=this.stick.y=0;this.lookPointer=null;this.mouseDrag=null;this.verticalPointers.clear();
  if(this.knob)this.knob.style.transform='translate(-50%, -50%)';
 }
 async enter(){
  if(this.mode==='orbit'||this.disposed||this.suspended)return;
  this.error=null;this.domElement.focus({preventScroll:true});
  if(!this.touch)try{
   if(!this.domElement.requestPointerLock)throw new Error('Pointer lock unavailable');
   await this.domElement.requestPointerLock();
  }catch{this.error='Myš nelze zachytit. Klikni na model a použij WASD; rozhlížej se tažením s pravým tlačítkem.';}
  this.emit();
 }
 setMode(mode){
  if(!MODES.has(mode))throw new Error('Unknown navigation mode: '+mode);
  this.clear();if(this.locked)document.exitPointerLock();
  this.mode=mode;this.orbit.enabled=mode==='orbit';this.reset();
 }
 reset(){
  this.clear();this.error=null;this.camera.up.set(0,1,0);
  if(this.mode==='orbit'){
   const bounds=this.domElement.getBoundingClientRect(),aspect=Math.max(.25,bounds.width/Math.max(1,bounds.height)),scale=Math.max(1,.9/aspect);
   this.camera.position.set(15*scale,10*scale,21*scale);this.orbit.target.set(0,2,0);
   const damping=this.orbit.enableDamping;this.orbit.enableDamping=false;this.orbit.update();this.orbit.enableDamping=damping;
  }else{
   this.camera.position.set(...(this.mode==='walk'?[14,1.7,19]:[18,10,24]));
   this.camera.lookAt(0,this.mode==='walk'?1.7:2,0);
   this.euler.setFromQuaternion(this.camera.quaternion,'YXZ');this.yaw=this.euler.y;this.pitch=this.euler.x;this.applyLook();
  }
  this.emit();
 }
 applyLook(){this.euler.set(this.pitch,this.yaw,0,'YXZ');this.camera.quaternion.setFromEuler(this.euler);}
 look(dx,dy){this.yaw-=dx;this.pitch=THREE.MathUtils.clamp(this.pitch-dy,-Math.PI/2+.03,Math.PI/2-.03);this.applyLook();}
 setupTouch(){
  this.joystick=document.getElementById('joystick-base');this.knob=document.getElementById('joystick-knob');
  const lookArea=document.getElementById('touch-look'),usable=()=>this.mode!=='orbit'&&!this.disposed&&!this.suspended;
  const updateStick=event=>{
   if(event.pointerId!==this.stick.id)return;
   const b=this.joystick.getBoundingClientRect(),radius=Math.max(1,Math.min(b.width,b.height)*.38);
   let x=(event.clientX-b.left-b.width/2)/radius,y=(event.clientY-b.top-b.height/2)/radius;
   const len=Math.hypot(x,y);if(len>1){x/=len;y/=len;}
   this.stick.x=x;this.stick.y=y;
   if(this.knob)this.knob.style.transform='translate(calc(-50% + '+x*radius+'px), calc(-50% + '+y*radius+'px))';
  };
  this.listen(this.joystick,'pointerdown',event=>{
   if(!usable()||this.stick.id!==null)return;event.preventDefault();this.stick.id=event.pointerId;
   this.joystick.setPointerCapture(event.pointerId);updateStick(event);
  });
  this.listen(this.joystick,'pointermove',event=>{if(event.pointerId===this.stick.id){event.preventDefault();updateStick(event);}});
  const releaseStick=event=>{
   if(event.pointerId!==this.stick.id)return;
   this.stick.id=null;this.stick.x=this.stick.y=0;if(this.knob)this.knob.style.transform='translate(-50%, -50%)';
  };
  for(const name of ['pointerup','pointercancel','lostpointercapture'])this.listen(this.joystick,name,releaseStick);
  this.listen(lookArea,'pointerdown',event=>{
   if(!usable()||this.lookPointer)return;event.preventDefault();
   this.lookPointer={id:event.pointerId,x:event.clientX,y:event.clientY};lookArea.setPointerCapture(event.pointerId);
  });
  this.listen(lookArea,'pointermove',event=>{
   const p=this.lookPointer;if(!p||p.id!==event.pointerId)return;event.preventDefault();
   this.look((event.clientX-p.x)*.004,(event.clientY-p.y)*.004);p.x=event.clientX;p.y=event.clientY;
  });
  const releaseLook=event=>{if(this.lookPointer?.id===event.pointerId)this.lookPointer=null;};
  for(const name of ['pointerup','pointercancel','lostpointercapture'])this.listen(lookArea,name,releaseLook);
  for(const [id,direction]of[['fly-up',1],['fly-down',-1]]){
   const button=document.getElementById(id);
   this.listen(button,'pointerdown',event=>{
    if(!usable()||this.mode!=='fly')return;event.preventDefault();
    this.verticalPointers.set(event.pointerId,direction);button.setPointerCapture(event.pointerId);
   });
   const release=event=>this.verticalPointers.delete(event.pointerId);
   for(const name of ['pointerup','pointercancel','lostpointercapture'])this.listen(button,name,release);
  }
 }
 update(seconds){
  if(this.disposed||this.suspended)return;
  if(this.mode==='orbit'){this.orbit.update();return;}
  const dt=THREE.MathUtils.clamp(Number.isFinite(seconds)?seconds:0,0,.1),has=(...codes)=>codes.some(code=>this.keys.has(code));
  let f=Number(has('KeyW','ArrowUp'))-Number(has('KeyS','ArrowDown'))-this.stick.y;
  let r=Number(has('KeyD','ArrowRight'))-Number(has('KeyA','ArrowLeft'))+this.stick.x,up=0;
  if(this.mode==='fly'){
   up=Number(has('Space','KeyE'))-Number(has('ControlLeft','ControlRight','KeyQ'));
   for(const value of this.verticalPointers.values())up+=value;
  }
  const norm=Math.hypot(f,r,up);if(norm>1){f/=norm;r/=norm;up/=norm;}
  const pitch=this.mode==='fly'?this.pitch:0,sin=Math.sin(this.yaw),cos=Math.cos(this.yaw);
  this.delta.set(-sin*Math.cos(pitch)*f+cos*r,Math.sin(pitch)*f+up,-cos*Math.cos(pitch)*f-sin*r);
  if(this.delta.lengthSq()>1)this.delta.normalize();
  const speed=(this.mode==='fly'?5:2.5)*(has('ShiftLeft','ShiftRight')?2.4:1);
  this.camera.position.addScaledVector(this.delta,speed*dt);
  if(this.mode==='walk')this.camera.position.y=1.7;
 }
 dispose(){
  if(this.disposed)return;this.disposed=true;this.clear();if(this.locked)document.exitPointerLock();
  for(const cleanup of this.cleanups)cleanup();this.cleanups.length=0;this.orbit.dispose();
 }
}
