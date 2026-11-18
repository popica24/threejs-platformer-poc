import * as THREE from "three";

//NOU: MONEDE, ABILITATI SI PORTALUL
//Toate monedele sunt un singur InstancedMesh: aceeasi geometrie, desenata de sute
//de ori dintr-un singur apel catre placa video.
const COIN_RADIUS = 1.1;
const ABILITY_COLORS = { doubleJump: 0x5cd6ff, dash: 0xff7a6b, grapple: 0x35e0ff };

export function createPickups(scene, coins, items) {
  const mesh = new THREE.InstancedMesh(
    new THREE.CylinderGeometry(0.42, 0.42, 0.1, 20),
    new THREE.MeshStandardMaterial({ color: 0xffc83d, emissive: 0xffa000, emissiveIntensity: 1.3, metalness: 0.7, roughness: 0.25 }),
    coins.length,
  );
  mesh.frustumCulled = false; //monedele sunt peste tot; sfera comuna ar fi inutila
  scene.add(mesh);
  const taken = new Array(coins.length).fill(false);
  const dummy = new THREE.Object3D(); //calculeaza matricea fiecarei copii

  const itemMeshes = items.map((item) => {
    const portal = item.kind === "portal";
    const object = new THREE.Mesh(
      portal ? new THREE.TorusGeometry(1.5, 0.2, 16, 48) : new THREE.IcosahedronGeometry(0.65),
      new THREE.MeshStandardMaterial({
        color: portal ? 0xa45cff : ABILITY_COLORS[item.kind],
        emissive: portal ? 0xa45cff : ABILITY_COLORS[item.kind],
        emissiveIntensity: 2.2,
      }),
    );
    object.position.set(item.x, item.y, item.z);
    scene.add(object);
    return { item, object, taken: false };
  });

  function reset() {
    taken.fill(false);
    for (const entry of itemMeshes) {
      entry.taken = false;
      entry.object.visible = true;
    }
  }

  //handlers = { coin(x, y, z), ability(kind), portal() }
  function update(delta, elapsed, position, handlers) {
    for (let i = 0; i < coins.length; i++) {
      const coin = coins[i];
      if (!taken[i]) {
        const dy = coin.y - (position.y + 1.1);
        if (Math.hypot(coin.x - position.x, dy, coin.z - position.z) < COIN_RADIUS + 0.6) {
          taken[i] = true;
          handlers.coin(coin.x, coin.y, coin.z);
        }
      }
      dummy.position.set(coin.x, coin.y + Math.sin(elapsed * 2 + i) * 0.1, coin.z);
      dummy.rotation.set(Math.PI / 2, 0, elapsed * 3 + i);
      //Monedele luate au scala 0: mai simplu decat sa le scoatem din lista
      dummy.scale.setScalar(taken[i] ? 0 : 1);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;

    for (const entry of itemMeshes) {
      if (entry.taken) continue;
      entry.object.rotation.y += 1.5 * delta;
      const { item } = entry;
      if (Math.hypot(item.x - position.x, item.y - (position.y + 1.2), item.z - position.z) > 3.2) continue;
      if (item.kind === "portal") {
        handlers.portal();
      } else {
        entry.taken = true;
        entry.object.visible = false;
        handlers.ability(item.kind);
      }
    }
  }

  return { reset, update, total: coins.length };
}
