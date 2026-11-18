import * as THREE from "three";
import { LAVA_SPEED, LAVA_START_DROP } from "./config.js";

//NOU: PERICOLE: tepi, lasere, ciocane, bile si inamici, plus lava din ultimul nivel.
//Sunt separate de platforme: nu sunt solide, doar testam daca jucatorul le atinge.
//Testele sunt putin mai mici decat desenul: e mai placut sa scapi la limita.
const BODY = 2.1; //inaltimea corpului

export function createHazards(scene, data, lavaStart) {
  const hazardMaterial = new THREE.MeshStandardMaterial({ color: 0x37384f, metalness: 0.7, roughness: 0.3 });
  const items = data.map((d) => build(scene, d, hazardMaterial));

  //Lava: un disc urias care sta mereu sub jucator
  const lava = new THREE.Mesh(
    new THREE.CircleGeometry(400, 48),
    new THREE.MeshStandardMaterial({ color: 0xff4a1c, emissive: 0xff3a00, emissiveIntensity: 1.8, transparent: true, opacity: 0.9 }),
  );
  lava.rotation.x = -Math.PI / 2;
  lava.visible = false;
  scene.add(lava);
  let lavaActive = false;
  let lavaY = -1000;

  function resetLava(respawnY) {
    lavaY = respawnY - LAVA_START_DROP;
  }

  function reset() {
    lavaActive = false;
    lava.visible = false;
    for (const item of items) {
      item.deadTimer = 0;
      item.root.visible = true;
    }
  }

  //ctx = { position, velocityY, respawnY, onHit(), onStomp(x, y, z) }
  function update(delta, elapsed, ctx) {
    const p = ctx.position;
    if (!lavaActive && p.y > lavaStart) {
      lavaActive = true;
      lava.visible = true;
      resetLava(ctx.respawnY);
    }
    if (lavaActive) {
      lavaY += LAVA_SPEED * delta;
      lava.position.set(p.x, lavaY, p.z);
      if (p.y < lavaY) ctx.onHit();
    }
    for (const item of items) updateItem(item, delta, elapsed, ctx);
  }

  return { update, reset, resetLava };
}

function build(scene, d, material) {
  const root = new THREE.Group();
  root.position.set(d.x, d.y, d.z);
  root.rotation.order = "YXZ";
  root.rotation.y = d.yaw;
  scene.add(root);
  const item = { d, root, deadTimer: 0, phase: Math.random() * 6 };

  if (d.kind === "spikes") {
    for (let i = 0; i < 5; i++) {
      const spike = new THREE.Mesh(new THREE.ConeGeometry(0.3, 1.2, 10), material);
      const a = (i / 5) * Math.PI * 2;
      spike.position.set(Math.cos(a) * 0.55, 0.6, Math.sin(a) * 0.55);
      spike.castShadow = true;
      root.add(spike);
    }
  } else if (d.kind === "laser") {
    item.beam = new THREE.Mesh(
      new THREE.CylinderGeometry(0.07, 0.07, d.length, 8),
      new THREE.MeshStandardMaterial({ color: 0xff2a4d, emissive: 0xff2a4d, emissiveIntensity: 3, transparent: true }),
    );
    item.beam.rotation.x = Math.PI / 2; //culcat de-a curmezisul drumului (axa z locala)
    item.beam.position.y = 0.9;
    root.add(item.beam);
  } else if (d.kind === "hammer") {
    root.position.y += 6.2;
    const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 5, 8), material);
    arm.position.y = -2.5;
    const head = new THREE.Mesh(new THREE.BoxGeometry(1.8, 1.6, 1.6), new THREE.MeshStandardMaterial({ color: 0xc23b4a, roughness: 0.4 }));
    head.position.y = -5;
    head.castShadow = true;
    root.add(arm, head);
  } else if (d.kind === "ball") {
    item.mesh = new THREE.Mesh(new THREE.SphereGeometry(1.1, 24, 16), new THREE.MeshStandardMaterial({ color: 0xe05c3a, roughness: 0.3 }));
    item.mesh.position.y = 1.1;
    item.mesh.castShadow = true;
    root.add(item.mesh);
  } else if (d.kind === "enemy") {
    item.mesh = new THREE.Group();
    const blob = new THREE.Mesh(new THREE.SphereGeometry(0.75, 20, 14), new THREE.MeshStandardMaterial({ color: 0x8a3fe0, roughness: 0.4 }));
    blob.position.y = 0.7;
    blob.scale.y = 0.85;
    blob.castShadow = true;
    item.mesh.add(blob);
    for (const x of [-0.25, 0.25]) {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.13, 10, 8), new THREE.MeshBasicMaterial({ color: 0xffffff }));
      eye.position.set(x, 0.92, 0.62);
      item.mesh.add(eye);
    }
    root.add(item.mesh);
  }
  return item;
}

function updateItem(item, delta, elapsed, ctx) {
  const { d, root } = item;
  const p = ctx.position;
  const feet = p.y;
  //Pozitia jucatorului in sistemul local: along = de-a lungul drumului, across = de-a curmezis
  const dx = p.x - d.x;
  const dz = p.z - d.z;
  const along = dx * Math.cos(d.yaw) - dz * Math.sin(d.yaw);
  const across = dx * Math.sin(d.yaw) + dz * Math.cos(d.yaw);

  if (d.kind === "spikes") {
    if (Math.hypot(dx, dz) < 1.05 && feet < d.y + 1) ctx.onHit();
  } else if (d.kind === "laser") {
    const cycle = d.on + d.off;
    const time = (elapsed + item.phase) % cycle;
    const active = time < d.on;
    //Inainte sa porneasca, licareste: jucatorul trebuie sa aiba timp sa reactioneze
    item.beam.material.opacity = active ? 1 : time > cycle - 0.4 ? 0.4 : 0.06;
    if (active && Math.abs(along) < 0.3 && Math.abs(across) < d.length / 2 && feet < d.y + 0.9 && feet + BODY > d.y + 0.9) {
      ctx.onHit();
    }
  } else if (d.kind === "hammer") {
    const angle = Math.sin(elapsed * d.speed + item.phase) * 1.15;
    root.rotation.x = -angle;
    const headAcross = Math.sin(angle) * 5;
    const headY = d.y + 6.2 - Math.cos(angle) * 5;
    const nearestY = THREE.MathUtils.clamp(headY, feet, feet + BODY);
    if (Math.hypot(along, across - headAcross, nearestY - headY) < 1.15) ctx.onHit();
  } else if (d.kind === "ball") {
    const offset = Math.sin(elapsed * d.speed + item.phase) * d.distance;
    item.mesh.position.x = offset;
    //Rostogolire: unghiul e distanta impartita la raza, deci nu aluneca
    item.mesh.rotation.z = -offset / 1.1;
    const nearestY = THREE.MathUtils.clamp(d.y + 1.1, feet, feet + BODY);
    if (Math.hypot(along - offset, across, nearestY - (d.y + 1.1)) < 1.25) ctx.onHit();
  } else if (d.kind === "enemy") {
    if (item.deadTimer > 0) {
      item.deadTimer -= delta;
      root.visible = item.deadTimer <= 0;
      return;
    }
    const offset = Math.sin(elapsed * d.speed + item.phase) * d.distance;
    item.mesh.position.x = offset;
    //cos = viteza pe directia de mers; se intoarce cu fata spre ea
    item.mesh.rotation.y = Math.cos(elapsed * d.speed + item.phase) > 0 ? Math.PI / 2 : -Math.PI / 2;
    const distance = Math.hypot(along - offset, across);
    if (distance < 1.15 && ctx.velocityY < 0 && feet > d.y + 0.55 && feet < d.y + 2) {
      item.deadTimer = 8; //reapare, ca traseul sa ramana provocator
      root.visible = false;
      ctx.onStomp(d.x, d.y + 0.8, d.z);
    } else if (distance < 0.95 && feet < d.y + 1.2) {
      ctx.onHit();
    }
  }
}
