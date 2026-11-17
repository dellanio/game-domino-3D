import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';

/** Standalone decoration; all owned resources are reachable by Stage.dispose. */
export function buildBrasilProps(width: number, depth: number): THREE.Group {
  if (!Number.isFinite(width) || !Number.isFinite(depth) || width <= 0 || depth <= 0) {
    throw new RangeError('Table dimensions must be finite and positive');
  }
  const root = new THREE.Group();
  root.name = 'brasil-props';
  const plastic = new THREE.MeshStandardMaterial({ color: 0xe5e2d6, roughness: 0.92 });
  const worn = new THREE.MeshStandardMaterial({ color: 0xcac6b8, roughness: 1 });
  const metal = new THREE.MeshStandardMaterial({ color: 0xaeb4b7, metalness: 0.78, roughness: 0.36 });
  const red = new THREE.MeshStandardMaterial({ color: 0x9e2924, roughness: 0.86 });
  const glass = new THREE.MeshStandardMaterial({ color: 0xe4f2ed, transparent: true, opacity: 0.24, roughness: 0.18, depthWrite: false, side: THREE.DoubleSide });
  const beer = new THREE.MeshStandardMaterial({ color: 0xc47c16, roughness: 0.3 });
  const foam = new THREE.MeshStandardMaterial({ color: 0xf3e7cd, roughness: 0.95 });
  const salami = new THREE.MeshStandardMaterial({ color: 0x9f493e, roughness: 0.85 });
  const wood = new THREE.MeshStandardMaterial({ color: 0xcda873, roughness: 1 });
  const add = (parent: THREE.Group, name: string, geometry: THREE.BufferGeometry, material: THREE.Material,
    x: number, y: number, z: number) => {
    const mesh = new THREE.Mesh(geometry, material);
    mesh.name = name;
    mesh.position.set(x, y, z);
    mesh.castShadow = mesh.receiveShadow = true;
    parent.add(mesh);
    return mesh;
  };

  // Shallow molded saddle: lowered center and gently rolled front edge.
  const seat = new THREE.PlaneGeometry(3.3, 3.15, 12, 12);
  seat.rotateX(-Math.PI / 2);
  const positions = seat.attributes.position;
  for (let i = 0; i < positions.count; i++) {
    const x = positions.getX(i), z = positions.getZ(i);
    positions.setY(i, 0.12 * (x / 1.65) ** 2 + 0.07 * (z / 1.575) ** 2);
  }
  seat.computeVertexNormals();
  plastic.side = THREE.DoubleSide;
  const rim = new RoundedBoxGeometry(3.5, 0.18, 3.35, 3, 0.08);
  const leg = new THREE.CylinderGeometry(0.13, 0.19, 1, 6);
  const outline = new THREE.Shape();
  outline.moveTo(-1.62, 0); outline.lineTo(1.62, 0);
  outline.lineTo(1.48, 1.95); outline.quadraticCurveTo(0, 2.5, -1.48, 1.95);
  outline.closePath();
  for (const x of [-0.85, 0, 0.85]) {
    const hole = new THREE.Path();
    hole.moveTo(x - 0.23, 0.45); hole.lineTo(x - 0.23, 1.75);
    hole.quadraticCurveTo(x, 2.02, x + 0.23, 1.75);
    hole.lineTo(x + 0.23, 0.45); hole.closePath();
    outline.holes.push(hole);
  }
  const back = new THREE.ExtrudeGeometry(outline, { depth: 0.14, bevelEnabled: true, bevelSegments: 2, steps: 1, bevelSize: 0.055, bevelThickness: 0.04, curveSegments: 6 });
  const scuff = new THREE.BoxGeometry(0.62, 0.012, 0.045);
  // No foreground chair: the default camera looks toward the table from +z.
  for (const [index, x, z, angle] of [
    [0, -width / 2 - 4.5, -2, Math.PI / 2 + 0.15],
    [1, width / 2 + 4.5, 0, -Math.PI / 2],
    [2, 1.5, -depth / 2 - 4.5, Math.PI],
  ]) {
    const chair = new THREE.Group();
    chair.name = `chair-${index}`;
    chair.position.set(x!, -3.45, z!); chair.rotation.y = angle!;
    root.add(chair);
    add(chair, 'seat-rim', rim, plastic, 0, 1.85, 0);
    add(chair, 'curved-seat', seat, plastic, 0, 1.95, 0);
    const rear = add(chair, 'slotted-back', back, plastic, 0, 1.95, -1.48);
    rear.rotation.x = -0.1;
    for (const [i, lx, lz] of [[0, -1.3, -1.2], [1, 1.3, -1.2], [2, -1.3, 1.2], [3, 1.3, 1.2]]) {
      // Exact endpoint construction keeps all four flared feet on the floor.
      const start = new THREE.Vector3(lx! * 1.14, 0, lz! * 1.14);
      const end = new THREE.Vector3(lx!, 1.85, lz!);
      const direction = end.clone().sub(start);
      const foot = add(chair, `leg-${i}`, leg, plastic, 0, 0, 0);
      foot.position.copy(start.add(end).multiplyScalar(0.5));
      foot.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.clone().normalize());
      // Cylinder's angled end radius would otherwise dip below the floor.
      foot.scale.y = direction.length() - 0.08;
      foot.updateMatrix();
      leg.computeBoundingBox();
      foot.position.y -= leg.boundingBox!.clone().applyMatrix4(foot.matrix).min.y;
    }
    add(chair, 'seat-wear', scuff, worn, -0.7, 1.94, 1.63);
  }

  const bar = new THREE.Group();
  bar.name = 'boteco-rim';
  bar.position.set(-width / 2 - 0.64, 0.405, -depth / 2 + 2.1);
  root.add(bar);
  const cylinder = (top: number, bottom: number, height: number, segments = 12, open = false) =>
    new THREE.CylinderGeometry(top, bottom, height, segments, 1, open);
  add(bar, 'red-coaster', cylinder(0.48, 0.48, 0.035), red, 0, 0.0175, 0);
  // American tumbler: twelve tapered facets, thicker base and a visible rolled lip.
  add(bar, 'glass-base', cylinder(0.29, 0.29, 0.07), glass, 0, 0.07, 0);
  add(bar, 'faceted-glass', cylinder(0.4, 0.29, 1.05, 12, true), glass, 0, 0.595, 0);
  const lip = add(bar, 'glass-lip', new THREE.TorusGeometry(0.4, 0.022, 4, 12), glass, 0, 1.12, 0);
  lip.rotation.x = Math.PI / 2;
  add(bar, 'amber-beer', cylinder(0.366, 0.273, 0.8), beer, 0, 0.5, 0);
  add(bar, 'foam', cylinder(0.368, 0.366, 0.1), foam, 0, 0.95, 0);
  const droplet = new THREE.SphereGeometry(0.026, 5, 4);
  for (let i = 0; i < 7; i++) {
    const angle = i * 2.4, y = 0.24 + (i % 4) * 0.18;
    const radius = 0.29 + (y - 0.07) / 1.05 * 0.11 + 0.014;
    const drop = add(bar, 'condensation', droplet, glass, Math.cos(angle) * radius, y, Math.sin(angle) * radius);
    drop.scale.y = 1.6;
  }
  // Narrow snack saucer fits the 1.25-unit outer concrete rim.
  add(bar, 'metal-plate', new THREE.LatheGeometry([
    new THREE.Vector2(0, 0), new THREE.Vector2(0.32, 0),
    new THREE.Vector2(0.46, 0.045), new THREE.Vector2(0.51, 0.11),
    new THREE.Vector2(0.48, 0.12), new THREE.Vector2(0.3, 0.035), new THREE.Vector2(0, 0.035),
  ], 16), metal, 0, 0.005, 1.55);
  const slice = cylinder(0.17, 0.17, 0.045);
  const fleck = new THREE.SphereGeometry(0.025, 4, 3);
  for (let i = 0; i < 4; i++) {
    const x = (i % 2 - 0.5) * 0.25, z = 1.55 + (Math.floor(i / 2) - 0.5) * 0.24;
    add(bar, 'salami', slice, salami, x, 0.085 + i * 0.009, z);
    add(bar, 'salami-fat', fleck, foam, x + 0.05, 0.112 + i * 0.009, z);
  }
  const pick = add(bar, 'toothpick', cylinder(0.012, 0.012, 0.62, 5), wood, 0, 0.16, 1.57);
  pick.rotation.z = 1.35;
  const cap = cylinder(0.115, 0.125, 0.05, 12);
  for (let i = 0; i < 2; i++) add(bar, 'bottle-cap', cap, i ? metal : red, 0.05, 0.03, 2.4 + i * 0.32);
  return root;
}
