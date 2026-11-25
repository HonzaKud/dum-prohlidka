import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {stick,readInput,centerRig,snapRig,moveRig} from '../src/vr-motion.js';
import {HouseVR} from '../src/vr.js';
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-8,a+' != '+b);
test('Quest sticks use xr-standard axes and ignore drift',()=>{
 assert.deepEqual(stick({axes:[1,1,.05,-.1]}),[0,0]);
 assert.deepEqual(stick({axes:[0,0,0,-1]}),[0,-1]);
 const buttons=Array.from({length:6},()=>({pressed:false}));buttons[4].pressed=true;buttons[0].pressed=true;
 const input=readInput([{handedness:'left',gamepad:{axes:[0,0,0,-1],buttons}},{handedness:'right',gamepad:{axes:[0,0,1,0],buttons:[]}}]);
 assert.deepEqual(input,{move:[0,-1],turn:1,home:true,boost:true});
});
test('recenter preserves tracked eye height and accounts for room-scale offset',()=>{
 const rig=new THREE.Group(),head=new THREE.Vector3(2,1.64,-3),q=new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0),1.1);
 centerRig(rig,head,q);const world=rig.localToWorld(head.clone());
 near(world.x,14);near(world.y,1.64);near(world.z,19);
 const f=new THREE.Vector3(0,0,-1).applyQuaternion(q).applyQuaternion(rig.quaternion).normalize();
 near(f.x,-14/Math.hypot(14,19));near(f.z,-19/Math.hypot(14,19));
});
test('snap rotation pivots on head, not the room origin',()=>{
 const rig=new THREE.Group();rig.position.set(12,0,15);rig.rotation.y=.8;rig.updateMatrixWorld(true);
 const head=new THREE.Vector3(2,1.7,3),before=rig.localToWorld(head.clone());
 snapRig(rig,head,-Math.PI/6);
 assert.ok(rig.localToWorld(head.clone()).distanceTo(before)<1e-8);
});
test('walking is horizontal, head-relative and independent of refresh rate',()=>{
 const q=new THREE.Quaternion().setFromEuler(new THREE.Euler(.7,1.2,0,'YXZ'));
 const a=new THREE.Group(),b=new THREE.Group();
 for(let i=0;i<72;i++)moveRig(a,q,[0,-1],1/72);
 for(let i=0;i<90;i++)moveRig(b,q,[0,-1],1/90);
 assert.ok(a.position.distanceTo(b.position)<1e-8);near(a.position.length(),1.4);near(a.position.y,0);
 const diagonal=new THREE.Group();moveRig(diagonal,q,[1,-1],.05);near(diagonal.position.length(),1.4*.05);
 const stopped=new THREE.Group();moveRig(stopped,q,[0,0],100);near(stopped.position.length(),0);
});
function fixture(supported=true){
 const oldNavigator=Object.getOwnPropertyDescriptor(globalThis,'navigator'),oldSecure=globalThis.isSecureContext;
 const session=new THREE.EventDispatcher();session.visibilityState='visible';session.inputSources=[];
 class XR extends THREE.EventDispatcher {
  constructor(){super();this.isPresenting=false;this.session=null;}
  setReferenceSpaceType(){} setFramebufferScaleFactor(){} setFoveation(){}
  getControllerGrip(){return new THREE.Group();}
  getSession(){return this.session;} getReferenceSpace(){return {};}
  async setSession(s){this.session=s;this.isPresenting=true;this.dispatchEvent({type:'sessionstart'});}
 }
 const xr=new XR(),renderer={xr},scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(50,1.6,.05,220);
 camera.position.set(15,10,21);camera.lookAt(0,2,0);
 session.end=async()=>{xr.isPresenting=false;xr.session=null;xr.dispatchEvent({type:'sessionend'});};
 Object.defineProperty(globalThis,'navigator',{configurable:true,value:{xr:{isSessionSupported:async()=>supported,requestSession:async()=>session}}});
 globalThis.isSecureContext=true;
 const controls={setSuspended(value){this.suspended=value;}},changes=[],button={addEventListener(){},setAttribute(){}};
 const vr=new HouseVR(renderer,scene,camera,controls,{button,onChange:s=>changes.push(s)});
 const restore=()=>{if(oldNavigator)Object.defineProperty(globalThis,'navigator',oldNavigator);else delete globalThis.navigator;globalThis.isSecureContext=oldSecure;};
 return {vr,xr,camera,session,controls,changes,restore};
}
test('VR session restores the desktop camera including projection',async()=>{
 const f=fixture();try{
 await Promise.resolve();f.vr.setReady();const pos=f.camera.position.clone(),rot=f.camera.quaternion.clone();
 await f.vr.toggle();assert.equal(f.controls.suspended,true);
 const frame={getViewerPose:()=>({transform:{position:{x:1,y:1.7,z:2},orientation:{x:0,y:0,z:0,w:1}}})};
 f.vr.update(.01,frame);f.camera.fov=95;
 await f.session.end();
 assert.equal(f.controls.suspended,false);assert.ok(f.camera.position.distanceTo(pos)<1e-8);
 near(f.camera.quaternion.angleTo(rot),0);near(f.camera.fov,50);near(f.vr.rig.position.length(),0);
 }finally{f.restore();}
});
test('unsupported browser has a usable explanation instead of a broken VR action',async()=>{
 const f=fixture(false);try{
 await Promise.resolve();f.vr.setReady();await f.vr.toggle();
 assert.equal(f.xr.isPresenting,false);assert.ok(f.changes.at(-1).message.includes('Meta Questu'));
 }finally{f.restore();}
});
test('session denial restores browsing and preserves the error message',async()=>{
 const f=fixture();try{
 await Promise.resolve();f.vr.setReady();navigator.xr.requestSession=async()=>{throw new Error('denied');};
 await f.vr.toggle();assert.equal(f.controls.suspended,false);
 assert.ok(f.changes.at(-1).message.includes('nepodařilo'));
 assert.equal(f.vr.button.disabled,false);
 }finally{f.restore();}
});


test('held snap stick triggers once and movement pauses while session is obscured',async()=>{
 const f=fixture();try{
 await Promise.resolve();f.vr.setReady();await f.vr.toggle();
 const left={handedness:'left',gamepad:{axes:[0,0,0,0],buttons:[]}};
 const right={handedness:'right',gamepad:{axes:[0,0,0,0],buttons:[]}};
 f.session.inputSources=[left,right];
 const frame={getViewerPose:()=>({transform:{position:{x:1,y:1.7,z:2},orientation:{x:0,y:0,z:0,w:1}}})};
 f.vr.update(.01,frame);const yaw=f.vr.rig.rotation.y;
 right.gamepad.axes[2]=1;f.vr.update(.01,frame);near(f.vr.rig.rotation.y,yaw-Math.PI/6);
 f.vr.update(.01,frame);near(f.vr.rig.rotation.y,yaw-Math.PI/6);
 const before=f.vr.rig.position.clone();f.session.visibilityState='visible-blurred';left.gamepad.axes[3]=-1;
 f.vr.update(.05,frame);assert.ok(f.vr.rig.position.distanceTo(before)<1e-8);
 await f.session.end();
 }finally{f.restore();}
});
