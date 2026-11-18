import * as THREE from "three";
import { createPlatform } from "./platforms.js";

//NOU: MODUL DE CONSTRUCTIE (tasta B)
//Platformele noi trec prin platforms.add / remove, ca toate celelalte.
//Tinem separat parametrii lor, ca sa-i putem salva si incarca.
const SHAPES = [
  ["box", { width: 4, height: 0.5, depth: 4 }],
  ["ramp", { width: 6, height: 2, depth: 3 }],
  ["cylinder", { radius: 2.5, height: 0.6 }],
  ["sphere", { radius: 1.6 }],
  ["cone", { radius: 2.5, height: 1.4, steps: 5 }],
  ["torus", { radius: 3, tube: 0.7 }],
];
const BEHAVIORS = [
  ["normala", {}],
  ["trambulina", { bounce: 16, color: 0xff5ca8 }],
  ["gheata", { slippery: true }],
  ["se prabuseste", { crumble: { delay: 0.7, respawn: 3 }, color: 0xa86c4a }],
  ["se misca", { move: { axis: "y", distance: 2, period: 4 }, color: 0x5c8ac9 }],
  ["se roteste", { spin: { speed: 0.8 }, color: 0x8a5cb8 }],
  ["checkpoint", { checkpoint: true, color: 0x3a7a55 }],
];
const SHAPE_NAMES = SHAPES.map(([name]) => name);
const MAX_CUSTOM = 400;

export function createBuilder(scene, camera, platforms, save) {
  let active = false;
  let shape = 0;
  let behavior = 0;
  let height = 0;
  let yaw = 0;
  let preview = null;
  const placed = []; //{ platform, data }
  const raycaster = new THREE.Raycaster();
  const center = new THREE.Vector2(0, 0);
  const spot = new THREE.Vector3();

  function currentParams() {
    return { ...SHAPES[shape][1], ...BEHAVIORS[behavior][1], color: BEHAVIORS[behavior][1].color ?? 0xf2a65a };
  }

  function clearPreview() {
    if (!preview) return;
    scene.remove(preview.object);
    preview.object.traverse((child) => {
      if (child.isMesh) {
        child.geometry.dispose();
        child.material.dispose();
      }
    });
    preview = null;
  }

  function rebuildPreview() {
    clearPreview();
    preview = createPlatform(SHAPES[shape][0], currentParams());
    preview.object.traverse((child) => {
      if (child.isMesh) {
        child.material.transparent = true;
        child.material.opacity = 0.5;
        child.castShadow = false;
      }
    });
    scene.add(preview.object);
  }

  function addPlaced(data) {
    const { type, ...params } = data;
    placed.push({ platform: platforms.add(type, { ...params, custom: true }), data });
  }

  function persist() {
    save.data.custom = placed.map((entry) => entry.data);
    save.write();
  }

  function place() {
    if (!active || placed.length >= MAX_CUSTOM) return;
    addPlaced({ type: SHAPES[shape][0], x: spot.x, y: spot.y, z: spot.z, yaw, ...currentParams() });
    persist();
  }

  function removeAimed() {
    raycaster.setFromCamera(center, camera);
    const objects = placed.map((entry) => entry.platform.object);
    const hit = raycaster.intersectObjects(objects, true)[0];
    if (!hit) return;
    const index = placed.findIndex((entry) => {
      let found = false;
      entry.platform.object.traverse((child) => (found ||= child === hit.object));
      return found;
    });
    platforms.remove(placed[index].platform);
    placed.splice(index, 1);
    persist();
  }

  function clearAll() {
    for (const entry of placed) platforms.remove(entry.platform);
    placed.length = 0;
  }

  //Datele pot veni dintr-un text lipit de utilizator: verificam tot inainte sa le folosim
  function isValid(data) {
    if (!data || !SHAPE_NAMES.includes(data.type)) return false;
    return ["x", "y", "z"].every((k) => Number.isFinite(data[k]) && Math.abs(data[k]) < 2000);
  }

  function load(list) {
    if (!Array.isArray(list) || list.length > MAX_CUSTOM || !list.every(isValid)) return false;
    clearAll();
    for (const data of list) addPlaced({ ...SHAPES[SHAPE_NAMES.indexOf(data.type)][1], ...data });
    persist();
    return true;
  }

  function label() {
    return `Constructie: ${SHAPE_NAMES[shape]} / ${BEHAVIORS[behavior][0]}`;
  }

  function toggle() {
    active = !active;
    if (active) rebuildPreview();
    else clearPreview();
    return active;
  }

  function update(input, playerPosition, cameraYaw) {
    if (!active) return;
    let changed = false;
    for (let i = 0; i < SHAPES.length; i++) {
      if (input.consumePress(`Digit${i + 1}`)) {
        shape = i;
        changed = true;
      }
    }
    if (input.consumePress("KeyT")) {
      behavior = (behavior + 1) % BEHAVIORS.length;
      changed = true;
    }
    if (changed) rebuildPreview();
    if (input.consumePress("KeyR")) height += 0.5;
    if (input.consumePress("KeyF")) height -= 0.5;
    if (input.consumePress("KeyZ")) yaw -= Math.PI / 8;
    if (input.consumePress("KeyX")) yaw += Math.PI / 8;
    if (input.consumePress("KeyG")) removeAimed();

    //Pe un caroiaj de 0.5, ca platformele sa se alinieze usor
    const snap = (value) => Math.round(value * 2) / 2;
    spot.set(
      snap(playerPosition.x + Math.sin(cameraYaw) * 8),
      snap(playerPosition.y + height),
      snap(playerPosition.z + Math.cos(cameraYaw) * 8),
    );
    preview.object.position.copy(spot);
    preview.object.rotation.y = yaw;
  }

  load(save.data.custom);

  return {
    toggle,
    update,
    place,
    load,
    label,
    isActive: () => active,
    hasCustom: () => placed.length > 0,
    exportText: () => JSON.stringify(placed.map((entry) => entry.data)),
  };
}
