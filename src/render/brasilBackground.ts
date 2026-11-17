import * as THREE from 'three';

/** Painted plaster: faded patches, exposed render and damp staining near the foot. */
function plasterTexture(): THREE.DataTexture {
  const width = 512, height = 128;
  const pixels = new Uint8Array(width * height * 4);
  let seed = 731;
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    const grain = (seed / 0xffffffff - 0.5) * 17;
    const patch = Math.sin(x * 0.081 + Math.sin(y * 0.11) * 2) * Math.cos(y * 0.067);
    const chipped = patch > 0.56;
    const damp = Math.max(0, 1 - y / 30) * (21 + 12 * Math.sin(x * 0.12));
    const value = (chipped ? 151 : 202) + patch * 12 + grain - damp;
    pixels.set([value + 9, value + 2, value - 14, 255], (y * width + x) * 4);
  }
  const texture = new THREE.DataTexture(pixels, width, height);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.magFilter = THREE.LinearFilter;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.generateMipmaps = true;
  texture.needsUpdate = true;
  return texture;
}

/** Standalone backdrop; all resources belong to this returned group. */
export function buildBrasilBackground(width: number, depth: number): THREE.Group {
  if (!Number.isFinite(width) || !Number.isFinite(depth) || width <= 0 || depth <= 0) {
    throw new RangeError('Background dimensions must be finite and positive');
  }
  const group = new THREE.Group();
  group.name = 'brasil-background';
  const floor = -3.45;
  const plaster = plasterTexture();
  const wallMaterial = new THREE.MeshStandardMaterial({ map: plaster, bumpMap: plaster,
    bumpScale: 0.055, roughness: 1 });
  const bark = new THREE.MeshStandardMaterial({ color: 0x81705b, roughness: 1 });
  const cap = new THREE.MeshStandardMaterial({ color: 0x969084, roughness: 0.95 });
  const add = (name: string, geometry: THREE.BufferGeometry, material: THREE.Material,
    x: number, y: number, z: number) => {
    const mesh = new THREE.Mesh(geometry, material);
    mesh.name = name;
    mesh.position.set(x, y, z);
    mesh.castShadow = mesh.receiveShadow = true;
    group.add(mesh);
    return mesh;
  };
  // A single rear boundary, leaving both sides and the foreground open to orbit.
  const rear = -Math.max(25, depth / 2 + 14);
  const wallWidth = Math.max(52, width + 22);
  add('urban-plaster-wall', new THREE.BoxGeometry(wallWidth, 7.2, 0.65), wallMaterial,
    0, floor + 3.6, rear);
  add('wall-coping', new THREE.BoxGeometry(wallWidth + 0.3, 0.22, 0.95), cap,
    0, floor + 7.31, rear);

  const treeX = -Math.max(24, width / 2 + 9);
  const treeZ = -Math.max(15, depth / 2 + 4);
  const branch = (name: string, from: THREE.Vector3, to: THREE.Vector3, bottom: number, top: number) => {
    const direction = to.clone().sub(from);
    const mesh = add(name, new THREE.CylinderGeometry(top, bottom, direction.length(), 8), bark,
      (from.x + to.x) / 2, (from.y + to.y) / 2, (from.z + to.z) / 2);
    mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.normalize());
  };
  const base = new THREE.Vector3(treeX, floor, treeZ);
  const crown = new THREE.Vector3(treeX + 0.4, floor + 9.5, treeZ);
  branch('almond-trunk', base, crown, 0.62, 0.22);
  // Terminalia's characteristic horizontal tiers, each supported by radial limbs.
  const leaves = new THREE.MeshStandardMaterial({ color: 0x8b9b60, roughness: 0.96,
    side: THREE.DoubleSide });
  const leafGeometry = new THREE.SphereGeometry(1, 8, 5);
  const foliage = new THREE.InstancedMesh(leafGeometry, leaves, 18);
  foliage.name = 'almond-foliage';
  foliage.castShadow = foliage.receiveShadow = true;
  const transform = new THREE.Object3D();
  let index = 0;
  for (let tier = 0; tier < 3; tier++) {
    const radius = 3.7 - tier * 0.85;
    const y = floor + 5.5 + tier * 2;
    for (let arm = 0; arm < 6; arm++) {
      const angle = arm * Math.PI / 3 + tier * 0.45;
      const end = new THREE.Vector3(treeX + 0.3 + Math.cos(angle) * radius,
        y + 0.45, treeZ + Math.sin(angle) * radius);
      branch('almond-branch', new THREE.Vector3(treeX + 0.3, y - 0.55, treeZ), end, 0.17, 0.055);
      transform.position.copy(end);
      transform.rotation.set(0.06 * Math.sin(angle), angle, 0.08 * Math.cos(angle));
      transform.scale.set(2.4 - tier * 0.35, 0.65, 1.65 - tier * 0.2);
      transform.updateMatrix();
      foliage.setMatrixAt(index, transform.matrix);
      foliage.setColorAt(index++, new THREE.Color().setHSL(0.22 + arm * 0.004, 0.22, 0.38 + (arm % 3) * 0.035));
    }
  }
  foliage.instanceMatrix.needsUpdate = true;
  foliage.computeBoundingBox();
  foliage.computeBoundingSphere();
  group.add(foliage);
  return group;
}
