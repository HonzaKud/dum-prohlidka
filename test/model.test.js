import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const data = readFileSync(new URL('../public/assets/house.glb', import.meta.url));
test('GLB contains a complete bounded exterior with valid finite geometry', () => {
  assert.equal(data.readUInt32LE(0), 0x46546c67);
  assert.equal(data.readUInt32LE(4), 2);
  assert.equal(data.readUInt32LE(8), data.length);
  assert.equal(data.readUInt32LE(16), 0x4e4f534a);
  const jsonLength = data.readUInt32LE(12);
  const gltf = JSON.parse(data.subarray(20, 20 + jsonLength).toString());
  assert.equal(gltf.asset.version, '2.0');
  assert.ok(gltf.meshes.length > 30);
  assert.ok(!JSON.stringify(gltf).includes('C:\\'));
  const binOffset = 20 + jsonLength + 8;
  assert.equal(data.readUInt32LE(20 + jsonLength + 4), 0x004e4942);
  let triangles = 0;
  for (const mesh of gltf.meshes) for (const p of mesh.primitives) {
    const position = gltf.accessors[p.attributes.POSITION];
    const normal = gltf.accessors[p.attributes.NORMAL];
    assert.equal(position.count, normal.count);
    const indices = gltf.accessors[p.indices];
    assert.equal(indices.count % 3, 0);
    triangles += indices.count / 3;
    const indexView = gltf.bufferViews[indices.bufferView];
    for (let i = 0; i < indices.count; i++) assert.ok(data.readUInt32LE(binOffset + indexView.byteOffset + i * 4) < position.count);
    assert.ok(position.min[0] > -20 && position.max[0] < 20);
    assert.ok(position.min[1] >= 0 && position.max[1] < 10);
    assert.ok(position.min[2] > -20 && position.max[2] < 20);
    for (const a of [position, normal]) {
      const b = gltf.bufferViews[a.bufferView];
      const start = binOffset + b.byteOffset;
      assert.ok(start + b.byteLength <= data.length);
      for (let i = 0; i < b.byteLength; i += 4) assert.ok(Number.isFinite(data.readFloatLE(start + i)));
    }
    assert.ok(gltf.materials[p.material]);
  }
  assert.ok(triangles > 1000 && triangles < 150000);
  assert.ok(data.length < 8_000_000);
});
