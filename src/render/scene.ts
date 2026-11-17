// Cena: mesa de feltro com moldura de madeira, iluminação de estúdio
// (luz principal com sombra suave, preenchimento frio, contraluz quente)
// e reflexos de ambiente via PMREM.

import * as THREE from 'three';
import type { ThemeId } from '../theme';
import { buildBrasilStage } from './brasilStage';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';

export const TABLE_W = 30;
export const TABLE_D = 22;

export interface Stage {
  setTheme(theme: ThemeId): void;
  dispose(): void;
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  controls: OrbitControls;
  resize: () => void;
}

function feltTexture(): { map: THREE.CanvasTexture; rough: THREE.CanvasTexture } {
  const size = 512;
  const mk = () => {
    const c = document.createElement('canvas');
    c.width = c.height = size;
    return c;
  };
  const colorCanvas = mk();
  const g = colorCanvas.getContext('2d')!;
  g.fillStyle = '#1d5a43';
  g.fillRect(0, 0, size, size);
  // fibras: milhares de traços curtos levemente mais claros/escuros
  for (let i = 0; i < 26000; i++) {
    const light = Math.random() < 0.5;
    g.strokeStyle = light ? 'rgba(120,190,150,0.07)' : 'rgba(0,20,10,0.10)';
    g.lineWidth = Math.random() * 1.2 + 0.3;
    const x = Math.random() * size;
    const y = Math.random() * size;
    const a = Math.random() * Math.PI;
    const l = Math.random() * 4 + 1;
    g.beginPath();
    g.moveTo(x, y);
    g.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l);
    g.stroke();
  }
  const roughCanvas = mk();
  const r = roughCanvas.getContext('2d')!;
  r.fillStyle = '#e8e8e8';
  r.fillRect(0, 0, size, size);
  for (let i = 0; i < 9000; i++) {
    const v = 200 + Math.random() * 55;
    r.fillStyle = `rgb(${v},${v},${v})`;
    r.fillRect(Math.random() * size, Math.random() * size, 1.5, 1.5);
  }
  const map = new THREE.CanvasTexture(colorCanvas);
  map.colorSpace = THREE.SRGBColorSpace;
  const rough = new THREE.CanvasTexture(roughCanvas);
  for (const t of [map, rough]) {
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(5, 4);
    t.anisotropy = 8;
  }
  return { map, rough };
}

function woodTexture(): THREE.CanvasTexture {
  const w = 1024;
  const h = 128;
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const g = c.getContext('2d')!;
  const grad = g.createLinearGradient(0, 0, 0, h);
  grad.addColorStop(0, '#3b2416');
  grad.addColorStop(0.5, '#5a3820');
  grad.addColorStop(1, '#3b2416');
  g.fillStyle = grad;
  g.fillRect(0, 0, w, h);
  for (let i = 0; i < 140; i++) {
    const y = Math.random() * h;
    g.strokeStyle = `rgba(${20 + Math.random() * 30},${10 + Math.random() * 15},5,${0.15 + Math.random() * 0.25})`;
    g.lineWidth = Math.random() * 2 + 0.5;
    g.beginPath();
    g.moveTo(0, y);
    for (let x = 0; x <= w; x += 32) g.lineTo(x, y + Math.sin(x / 90 + i) * 3 + (Math.random() - 0.5) * 1.5);
    g.stroke();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

function buildTable(scene: THREE.Scene): void {
  const { map, rough } = feltTexture();
  const felt = new THREE.Mesh(
    new THREE.PlaneGeometry(TABLE_W, TABLE_D),
    new THREE.MeshStandardMaterial({ map, roughnessMap: rough, roughness: 1, metalness: 0, envMapIntensity: 0.25 }),
  );
  felt.rotation.x = -Math.PI / 2;
  felt.receiveShadow = true;
  scene.add(felt);

  // Moldura de madeira envernizada.
  const woodMat = new THREE.MeshPhysicalMaterial({
    map: woodTexture(),
    roughness: 0.45,
    clearcoat: 0.8,
    clearcoatRoughness: 0.2,
  });
  const rim = 1.2;
  const rimH = 0.7;
  const pieces: [number, number, number, number][] = [
    [0, -(TABLE_D + rim) / 2, TABLE_W + rim * 2, rim],
    [0, (TABLE_D + rim) / 2, TABLE_W + rim * 2, rim],
    [-(TABLE_W + rim) / 2, 0, rim, TABLE_D],
    [(TABLE_W + rim) / 2, 0, rim, TABLE_D],
  ];
  for (const [x, z, w, d] of pieces) {
    const geo = new THREE.BoxGeometry(w, rimH, d);
    const m = new THREE.Mesh(geo, woodMat);
    m.position.set(x, rimH / 2 - 0.15, z);
    m.castShadow = true;
    m.receiveShadow = true;
    scene.add(m);
  }

  // Chão escuro sob a mesa, só para receber a luz que escapa.
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(200, 200),
    new THREE.MeshStandardMaterial({ color: 0x0b0a09, roughness: 0.95 }),
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -0.2;
  scene.add(floor);
}

function buildLights(scene: THREE.Scene): void {
  // Luz principal: um spot quente sobre a mesa, sombra suave.
  const key = new THREE.SpotLight(0xfff1dc, 2600, 0, Math.PI / 6.2, 0.85, 2);
  key.position.set(-3, 24, 8);
  key.target.position.set(0, 0, 0.5);
  key.castShadow = true;
  key.shadow.mapSize.set(4096, 4096);
  key.shadow.bias = -0.00015;
  key.shadow.normalBias = 0.02;
  key.shadow.radius = 4;
  key.shadow.camera.near = 10;
  key.shadow.camera.far = 40;
  scene.add(key, key.target);

  // Preenchimento frio e fraco, do lado oposto.
  const fill = new THREE.DirectionalLight(0xbcd4ff, 0.18);
  fill.position.set(14, 10, 6);
  scene.add(fill);

  // Contraluz quente, de trás: desenha o contorno das peças.
  const rimLight = new THREE.DirectionalLight(0xffc98a, 0.6);
  rimLight.position.set(4, 6, -16);
  scene.add(rimLight);

  scene.add(new THREE.HemisphereLight(0x8a9bb0, 0x1a120c, 0.08));
}

export function createStage(container: HTMLElement): Stage {
  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  container.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x07080a);
  scene.fog = new THREE.Fog(0x07080a, 38, 70);

  const pmrem = new THREE.PMREMGenerator(renderer);
  const room = new RoomEnvironment();
  const environmentTarget = pmrem.fromScene(room, 0.04);
  scene.environment = environmentTarget.texture;
  room.dispose();
  pmrem.dispose();
  scene.environmentIntensity = 0.3;

  const defaultStage = new THREE.Scene();
  buildTable(defaultStage);
  buildLights(defaultStage);
  const defaultGroup = new THREE.Group();
  defaultGroup.add(...defaultStage.children.slice());
  scene.add(defaultGroup);
  let brasilGroup: THREE.Group | undefined;
  let currentTheme: ThemeId = 'default';
  const defaultBackground = scene.background;
  const defaultFog = scene.fog;
  const setTheme = (theme: ThemeId) => {
    currentTheme = theme;
    const brasil = theme === 'brasil';
    if (brasil && !brasilGroup) {
      brasilGroup = buildBrasilStage(TABLE_W, TABLE_D);
      scene.add(brasilGroup);
    }
    defaultGroup.visible = !brasil;
    if (brasilGroup) brasilGroup.visible = brasil;
    scene.background = brasil ? new THREE.Color(0xc9dbe8) : defaultBackground;
    scene.fog = brasil ? new THREE.Fog(0xc9dbe8, 65, 115) : defaultFog;
    scene.environmentIntensity = brasil ? 0.55 : 0.3;
    resize();
  };

  const camera = new THREE.PerspectiveCamera(38, 1, 0.5, 120);
  camera.position.set(0, 20, 18.5);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.target.set(0, 0, 0.8);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.minDistance = 14;
  controls.maxDistance = 40;
  controls.minPolarAngle = 0.15;
  controls.maxPolarAngle = 1.15;
  controls.enablePan = false;
  controls.update();

  const resize = () => {
    const w = container.clientWidth;
    const h = container.clientHeight;
    renderer.setSize(w, h);
    camera.aspect = w / h;
    // Em telas estreitas, afasta a câmera para caber a mesa.
    camera.fov = w / h < 1.2 ? 56 : currentTheme === 'brasil' ? 48 : 41;
    camera.updateProjectionMatrix();
  };
  resize();
  window.addEventListener('resize', resize);

  const dispose = () => {
    window.removeEventListener('resize', resize);
    controls.dispose();
    const geometries = new Set<THREE.BufferGeometry>();
    const materials = new Set<THREE.Material>();
    const textures = new Set<THREE.Texture>();
    for (const group of [defaultGroup, brasilGroup]) group?.traverse(object => {
      if (object instanceof THREE.InstancedMesh) object.dispose();
      if (object instanceof THREE.Mesh) {
        geometries.add(object.geometry);
        for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
          materials.add(material);
          for (const value of Object.values(material)) if (value instanceof THREE.Texture) textures.add(value);
        }
      }
      if (object instanceof THREE.Light && 'dispose' in object) object.dispose();
    });
    geometries.forEach(value => value.dispose());
    materials.forEach(value => value.dispose());
    textures.forEach(value => value.dispose());
    environmentTarget.dispose();
    renderer.dispose();
    renderer.domElement.remove();
  };
  return { renderer, scene, camera, controls, resize, setTheme, dispose };
}
