import * as THREE from "three";

//NOU: FANTOMA: inregistram cea mai buna tura si o redam langa tine.
//Pastram 15 pozitii pe secunda; intre ele calculam prin interpolare.
const KEY = "platformer-ghost";
const STEP = 1 / 15;

export function createGhost(scene) {
  const material = new THREE.MeshBasicMaterial({ color: 0x8fd8ff, transparent: true, opacity: 0.4, depthWrite: false });
  const mesh = new THREE.Group();
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.38, 0.9, 6, 12), material);
  body.position.y = 1.1;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.32, 16, 12), material);
  head.position.y = 2.2;
  mesh.add(body, head);
  mesh.visible = false;
  scene.add(mesh);

  let best = [];
  try {
    best = JSON.parse(localStorage.getItem(KEY)) ?? [];
  } catch {
    best = [];
  }
  let recording = [];
  let accumulator = 0;
  let time = 0;

  function startRun() {
    recording = [];
    accumulator = STEP; //prima pozitie imediat
    time = 0;
  }

  function update(delta, position, rotationY) {
    time += delta;
    accumulator += delta;
    while (accumulator >= STEP) {
      accumulator -= STEP;
      //2 zecimale: destul de precis si incape mult mai usor in localStorage
      recording.push(+position.x.toFixed(2), +position.y.toFixed(2), +position.z.toFixed(2), +rotationY.toFixed(2));
    }

    const frames = best.length / 4;
    const index = Math.floor(time / STEP);
    mesh.visible = frames > 1 && index < frames - 1;
    if (!mesh.visible) return;
    const t = time / STEP - index;
    const i = index * 4;
    mesh.position.set(
      THREE.MathUtils.lerp(best[i], best[i + 4], t),
      THREE.MathUtils.lerp(best[i + 1], best[i + 5], t),
      THREE.MathUtils.lerp(best[i + 2], best[i + 6], t),
    );
    mesh.rotation.y = best[i + 3];
  }

  //Chemata cand tura curenta e un record
  function saveBest() {
    best = recording;
    try {
      localStorage.setItem(KEY, JSON.stringify(best));
    } catch {
      //tura e prea lunga pentru localStorage; fantoma ramane doar in sesiunea asta
    }
  }

  return { startRun, update, saveBest };
}
