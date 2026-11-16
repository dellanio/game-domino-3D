// Animações simples de posição + rotação, com arco (a peça "levanta" ao viajar).

import * as THREE from 'three';

export interface Target {
  position: THREE.Vector3;
  quaternion: THREE.Quaternion;
}

interface Tween {
  obj: THREE.Object3D;
  fromPos: THREE.Vector3;
  fromQuat: THREE.Quaternion;
  to: Target;
  start: number;
  duration: number;
  arc: number;
  resolve: () => void;
}

const easeInOutCubic = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

export class Tweener {
  private tweens: Tween[] = [];

  /** Anima `obj` até `to`. Uma nova animação no mesmo objeto substitui a anterior. */
  to(obj: THREE.Object3D, to: Target, opts: { duration?: number; arc?: number; delay?: number } = {}): Promise<void> {
    this.tweens = this.tweens.filter((tw) => {
      if (tw.obj !== obj) return true;
      tw.resolve();
      return false;
    });
    return new Promise((resolve) => {
      this.tweens.push({
        obj,
        fromPos: obj.position.clone(),
        fromQuat: obj.quaternion.clone(),
        to,
        start: performance.now() + (opts.delay ?? 0),
        duration: opts.duration ?? 450,
        arc: opts.arc ?? 0,
        resolve,
      });
    });
  }

  update(now: number): void {
    const done: Tween[] = [];
    for (const tw of this.tweens) {
      if (now < tw.start) continue;
      const raw = Math.min(1, (now - tw.start) / tw.duration);
      const t = easeInOutCubic(raw);
      tw.obj.position.lerpVectors(tw.fromPos, tw.to.position, t);
      tw.obj.position.y += Math.sin(Math.PI * raw) * tw.arc;
      tw.obj.quaternion.slerpQuaternions(tw.fromQuat, tw.to.quaternion, t);
      if (raw >= 1) done.push(tw);
    }
    if (done.length) {
      this.tweens = this.tweens.filter((tw) => !done.includes(tw));
      for (const tw of done) tw.resolve();
    }
  }

  get busy(): boolean {
    return this.tweens.length > 0;
  }
}

const euler = new THREE.Euler(0, 0, 0, 'YXZ');

/** Alvo a partir de posição, giro na mesa (yaw) e virada (flip = face para baixo). */
export function target(x: number, y: number, z: number, yaw: number, flip = false, tilt = 0): Target {
  euler.set(flip ? Math.PI : 0, yaw, tilt, 'YXZ');
  return {
    position: new THREE.Vector3(x, y, z),
    quaternion: new THREE.Quaternion().setFromEuler(euler),
  };
}

export const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
