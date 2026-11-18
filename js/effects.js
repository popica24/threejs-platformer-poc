import * as THREE from "three";

//NOU: PARTICULE (praf, scantei, artificii)
//Un singur obiect Points cu un numar fix de particule. Refolosim mereu aceleasi
//locuri in loc sa cream obiecte: fara alocari, deci fara sacadari.
const MAX = 700;
const GRAVITY = 9;

export function createEffects(scene) {
  const positions = new Float32Array(MAX * 3).fill(-9999);
  const colors = new Float32Array(MAX * 3);
  const velocities = new Float32Array(MAX * 3);
  const life = new Float32Array(MAX);
  let next = 0;
  const color = new THREE.Color();

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  const points = new THREE.Points(
    geometry,
    new THREE.PointsMaterial({ size: 0.22, vertexColors: true, transparent: true, depthWrite: false }),
  );
  points.frustumCulled = false; //particulele apar oriunde in lume
  scene.add(points);

  function burst(x, y, z, hex, count, speed, duration = 0.7) {
    color.setHex(hex);
    for (let n = 0; n < count; n++) {
      const i = next;
      next = (next + 1) % MAX; //daca s-au terminat locurile, le rescriem pe cele mai vechi
      positions[i * 3] = x;
      positions[i * 3 + 1] = y;
      positions[i * 3 + 2] = z;
      const angle = Math.random() * Math.PI * 2;
      const up = Math.random();
      velocities[i * 3] = Math.cos(angle) * speed * (0.4 + Math.random());
      velocities[i * 3 + 1] = up * speed * 1.2;
      velocities[i * 3 + 2] = Math.sin(angle) * speed * (0.4 + Math.random());
      colors[i * 3] = color.r;
      colors[i * 3 + 1] = color.g;
      colors[i * 3 + 2] = color.b;
      life[i] = duration * (0.6 + Math.random() * 0.4);
    }
  }

  function update(delta) {
    for (let i = 0; i < MAX; i++) {
      if (life[i] <= 0) continue;
      life[i] -= delta;
      if (life[i] <= 0) {
        positions[i * 3 + 1] = -9999; //o ascundem
        continue;
      }
      positions[i * 3] += velocities[i * 3] * delta;
      positions[i * 3 + 1] += velocities[i * 3 + 1] * delta - 0.5 * GRAVITY * delta * delta;
      positions[i * 3 + 2] += velocities[i * 3 + 2] * delta;
      velocities[i * 3 + 1] -= GRAVITY * delta;
    }
    geometry.attributes.position.needsUpdate = true;
    geometry.attributes.color.needsUpdate = true;
  }

  return { burst, update };
}
