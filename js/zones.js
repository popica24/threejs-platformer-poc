import * as THREE from "three";

//NOU: ZONE: vant, gravitatie mica si punctele de agatare.
//sample(pozitie) spune ce forte sunt in acel loc; player.js nu stie de unde vin.
export function createZones(scene, zones, grapplePoints) {
  const env = { windX: 0, windZ: 0, gravity: 1 };
  const ropeGeometry = new THREE.OctahedronGeometry(0.6);
  const anchors = [];

  for (const zone of zones) {
    const wind = zone.kind === "wind";
    const mesh = new THREE.Mesh(
      new THREE.CylinderGeometry(zone.radius, zone.radius, zone.height, 32, 1, true),
      new THREE.MeshBasicMaterial({
        color: wind ? 0xbff3ff : 0xc8a2ff,
        transparent: true,
        opacity: 0.13,
        side: THREE.DoubleSide,
        depthWrite: false, //altfel ar ascunde obiectele transparente din interior
      }),
    );
    mesh.position.set(zone.x, zone.y + zone.height / 2 - 2, zone.z);
    scene.add(mesh);
  }

  for (const point of grapplePoints) {
    const mesh = new THREE.Mesh(
      ropeGeometry,
      new THREE.MeshStandardMaterial({ color: 0x35e0ff, emissive: 0x35e0ff, emissiveIntensity: 2 }),
    );
    mesh.position.set(point.x, point.y, point.z);
    scene.add(mesh);
    anchors.push(mesh);
  }

  function sample(position) {
    env.windX = 0;
    env.windZ = 0;
    env.gravity = 1;
    for (const zone of zones) {
      if (position.y < zone.y - 2 || position.y > zone.y + zone.height - 2) continue;
      if (Math.hypot(position.x - zone.x, position.z - zone.z) > zone.radius) continue;
      if (zone.kind === "wind") {
        env.windX += zone.dirX * zone.strength;
        env.windZ += zone.dirZ * zone.strength;
      } else {
        env.gravity = 0.45;
      }
    }
    return env;
  }

  function update(delta) {
    for (const anchor of anchors) anchor.rotation.y += 1.5 * delta;
  }

  return { sample, grapplePoints, update };
}
