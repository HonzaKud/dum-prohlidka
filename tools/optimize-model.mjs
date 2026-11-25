import { readFileSync, writeFileSync } from 'node:fs';
const file = new URL('../public/assets/house.glb', import.meta.url);
const data = readFileSync(file);
const gltf = JSON.parse(data.subarray(20,20+data.readUInt32LE(12)).toString());
if (gltf.meshes.every(m=>m.primitives.every(p=>p.indices!==undefined))) {
 console.log('Model already indexed.');
 process.exit(0);
}
const binStart=28+data.readUInt32LE(12);
let chunks=[],length=0,views=[],accessors=[];
function append(raw,target) {
 const pad=(4-length%4)%4;
 if(pad){chunks.push(Buffer.alloc(pad));length+=pad;}
 const view=views.length;
 views.push({buffer:0,byteOffset:length,byteLength:raw.length,target});
 chunks.push(raw);length+=raw.length;return view;
}
function attribute(values,type,componentType,min,max) {
 const raw=componentType===5126?Buffer.from(new Float32Array(values).buffer):Buffer.from(new Uint32Array(values).buffer);
 const a={bufferView:append(raw,type==='SCALAR'?34963:34962),componentType,count:values.length/(type==='VEC3'?3:1),type};
 if(min){a.min=min;a.max=max;}
 accessors.push(a);return accessors.length-1;
}
for(const mesh of gltf.meshes)for(const p of mesh.primitives) {
 const pa=gltf.accessors[p.attributes.POSITION],na=gltf.accessors[p.attributes.NORMAL];
 const pv=gltf.bufferViews[pa.bufferView],nv=gltf.bufferViews[na.bufferView];
 let positions=[],normals=[],indices=[],map=new Map();
 for(let i=0;i<pa.count;i++){
  const pos=[0,1,2].map(j=>data.readFloatLE(binStart+pv.byteOffset+i*12+j*4));
  const normal=[0,1,2].map(j=>data.readFloatLE(binStart+nv.byteOffset+i*12+j*4));
  const key=pos.concat(normal).join(',');
  let index=map.get(key);
  if(index===undefined){index=map.size;map.set(key,index);positions.push(...pos);normals.push(...normal);}
  indices.push(index);
 }
 p.attributes={POSITION:attribute(positions,'VEC3',5126,pa.min,pa.max),NORMAL:attribute(normals,'VEC3',5126)};
 p.indices=attribute(indices,'SCALAR',5125);
}
gltf.accessors=accessors;gltf.bufferViews=views;gltf.buffers=[{byteLength:length}];
let json=Buffer.from(JSON.stringify(gltf));json=Buffer.concat([json,Buffer.alloc((4-json.length%4)%4,32)]);
let binary=Buffer.concat(chunks);binary=Buffer.concat([binary,Buffer.alloc((4-binary.length%4)%4)]);
const header=Buffer.alloc(12),jh=Buffer.alloc(8),bh=Buffer.alloc(8);
header.writeUInt32LE(0x46546c67);header.writeUInt32LE(2,4);header.writeUInt32LE(28+json.length+binary.length,8);
jh.writeUInt32LE(json.length);jh.writeUInt32LE(0x4e4f534a,4);bh.writeUInt32LE(binary.length);bh.writeUInt32LE(0x004e4942,4);
const output=Buffer.concat([header,jh,json,bh,binary]);writeFileSync(file,output);
console.log('Model optimized without geometry loss: '+data.length+' → '+output.length+' bytes');
