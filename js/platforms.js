import * as THREE from "three";
import { MAX_SLOPE_DEG, GRAVITY } from "./config.js";
import { createCollider } from "./collision.js";

//NOU: FABRICA DE PLATFORME
//createPlatform(type, params) intoarce o platforma: obiectul desenat (object) si
//collider-ele ei, construite din ACELEASI numere. Daca am scrie separat dimensiunile
//pentru desen si pentru coliziune, mai devreme sau mai tarziu le-am schimba doar pe
//unele si am sta "in aer" sau am intra prin platforme.
//
//FORME. params: { x, y, z, yaw, color, roughness, ...dimensiuni }, (x, y, z) = centrul.
// - box:      width, height, depth
// - ramp:     width (lungimea pe care urca, spre +x local), height (cat urca), depth
// - cylinder: radius, height
// - sphere:   radius
// - cone:     con in trepte (ca un tort): radius (al treptei de jos), height, steps
// - torus:    inel culcat pe care mergi de jur imprejur: radius (al inelului), tube
//
//COMPORTAMENTE = date, nu cod separat pentru fiecare platforma. Sunt campuri
//optionale in params si se pot combina (ex: o platforma care se misca SI e de gheata).
//Una fara niciun comportament e statica.
// - move:       { axis: "x" | "y" | "z", distance, period }  du-te-vino pe o axa
//               (distance = cat se departeaza de pozitia de baza, period = secunde pe tura)
// - spin:       { speed }  se roteste in jurul axei Y (radiani pe secunda)
// - bounce:     viteza in sus cu care te arunca (ca o trambulina)
// - crumble:    { delay, respawn }  dupa ce calci pe ea tremura "delay" secunde, cade,
//               si reapare dupa "respawn" secunde
// - slippery:   true = gheata (aluneci)
// - checkpoint: true = daca stai pe ea, de aici reapari cand cazi
// - blink:      NOU: { on, off, phase }  apare si dispare ritmic (secunde)
// - boost:      NOU: true = te arunca inainte (spre +x local)
// - finish:     NOU: true = sfarsitul traseului
//Comportamentele care il privesc pe jucator (bounce, slippery, checkpoint) sunt copiate
//pe fiecare collider, ca player.js sa le poata citi de pe collider-ul pe care sta.

const MAX_RAMP_SLOPE = Math.tan(THREE.MathUtils.degToRad(MAX_SLOPE_DEG));
const CHECKPOINT_GLOW = 0x2aff7a; //culoarea "aprinsa" a checkpoint-ului activ

//Geometria rampei: un triunghi dreptunghic (vazut din lateral) "extrudat" in adancime.
//Extrude = iei o forma 2D si o tragi in a treia dimensiune, ca pe un aluat prin matrita.
function createRampGeometry(width, height, depth) {
  const hx = width / 2;
  const hy = height / 2;
  const shape = new THREE.Shape();
  shape.moveTo(-hx, -hy); //capatul de jos
  shape.lineTo(hx, -hy);
  shape.lineTo(hx, hy); //varful, la capatul +x (la fel ca rampTopAt din collision.js)
  shape.closePath();
  const geometry = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false });
  //Extrude incepe de la z = 0 spre +z; o centram ca sa fie la fel ca BoxGeometry
  geometry.translate(0, 0, -depth / 2);
  return geometry;
}

//Fiecare forma e descrisa ca o lista de "piese": o geometrie + collider-ul ei +
//unde sta piesa fata de centrul platformei (offsetY). Majoritatea formelor au o
//singura piesa; conul in trepte are cate una pe treapta. Din aceeasi lista facem
//si desenul si coliziunea, deci nu pot iesi diferite.
function createPieces(type, p) {
  switch (type) {
    case "box":
      return [{ geometry: new THREE.BoxGeometry(p.width, p.height, p.depth), collider: { type, ...p } }];
    case "ramp":
      return [{ geometry: createRampGeometry(p.width, p.height, p.depth), collider: { type, ...p } }];
    case "cylinder":
      return [{ geometry: new THREE.CylinderGeometry(p.radius, p.radius, p.height, 40), collider: { type, ...p } }];
    case "sphere":
      return [{ geometry: new THREE.SphereGeometry(p.radius, 32, 24), collider: { type, ...p } }];
    case "torus": {
      //TorusGeometry e "in picioare" (in planul XY); il culcam o singura data,
      //in geometrie, ca rotation.y a obiectului sa ramana libera pentru yaw / spin
      const geometry = new THREE.TorusGeometry(p.radius, p.tube, 20, 72);
      geometry.rotateX(Math.PI / 2);
      return [{ geometry, collider: { type, ...p } }];
    }
    case "cone": {
      //Con in trepte: cilindri din ce in ce mai ingusti, pusi unul peste altul.
      //Treapta i are raza radius * (1 - i / steps): ultima ramane cat o "felie".
      const steps = p.steps ?? 4;
      const stepHeight = p.height / steps;
      const pieces = [];
      for (let i = 0; i < steps; i++) {
        const radius = p.radius * (1 - i / steps);
        //centrul treptei i fata de centrul conului (conul e centrat pe inaltime)
        const offsetY = -p.height / 2 + stepHeight * (i + 0.5);
        pieces.push({
          geometry: new THREE.CylinderGeometry(radius, radius, stepHeight, 40),
          offsetY,
          collider: { type: "cylinder", radius, height: stepHeight },
        });
      }
      return pieces;
    }
  }
  throw new Error(`Tip de platforma necunoscut: ${type}`);
}

export function createPlatform(type, params) {
  const p = { ...params }; //copie, ca sa nu modificam obiectul primit

  //O rampa mai abrupta decat MAX_SLOPE_DEG n-ar mai fi o rampa, ci un perete
  //ciudat pe care nu poti sta. O limitam aici, inainte sa construim si desenul si
  //collider-ul, ca sa ramana identice.
  if (type === "ramp" && p.height > p.width * MAX_RAMP_SLOPE) {
    console.warn(`Rampa prea abrupta, o limitam la ${MAX_SLOPE_DEG} de grade`);
    p.height = p.width * MAX_RAMP_SLOPE;
  }

  //Gheata arata altfel daca nu i-am dat noi o culoare: albastruie si lucioasa
  const material = new THREE.MeshStandardMaterial({
    color: p.color ?? (p.slippery ? 0xbfe8ff : 0x8a8fb8),
    roughness: p.roughness ?? (p.slippery ? 0.05 : 0.7),
    metalness: p.slippery ? 0.3 : 0,
    transparent: !!p.blink, //NOU: doar cele care clipesc au nevoie de transparenta
  });

  //object = un Group: pozitia si rotatia platformei se pun pe el, iar piesele
  //(mesh-urile) stau in el la offset-ul lor. Asa mutam toate piesele dintr-odata.
  const object = new THREE.Group();
  const colliders = [];
  const offsets = []; //offsetY al fiecarui collider fata de centru (paralel cu colliders)

  for (const piece of createPieces(type, p)) {
    const mesh = new THREE.Mesh(piece.geometry, material);
    mesh.position.y = piece.offsetY ?? 0;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    object.add(mesh);

    //collider-ul piesei porneste din centrul platformei (il pozitionam corect in sync())
    const { type: colliderType, ...dimensions } = piece.collider;
    const collider = createCollider(colliderType, { ...dimensions, x: 0, y: 0, z: 0, yaw: 0 });
    collider.bounce = p.bounce ?? 0;
    collider.slippery = !!p.slippery;
    collider.checkpoint = !!p.checkpoint;
    collider.boost = !!p.boost; //NOU
    collider.finish = !!p.finish; //NOU
    colliders.push(collider);
    offsets.push(piece.offsetY ?? 0);
  }

  //Pozitia de baza (din params). Comportamentele calculeaza in fiecare frame o
  //pozitie noua PORNIND de la ea, nu adunand la cea veche: asa nu se aduna erori
  //si platforma nu "o ia razna" in timp.
  const base = new THREE.Vector3(p.x ?? 0, p.y ?? 0, p.z ?? 0);
  const baseYaw = p.yaw ?? 0;
  const center = new THREE.Vector3().copy(base);
  let yaw = baseYaw;

  //Starea prabusirii: "solid" -> "shaking" (tremura) -> "falling" (cade) -> "solid"
  let crumbleState = "solid";
  let crumbleTimer = 0;
  let fallOffset = 0; //cat a coborat desenul in timp ce cade
  let fallSpeed = 0;

  const platform = { type, params: p, object, colliders, update, setActive };
  for (const collider of colliders) collider.platform = platform; //drumul inapoi: collider -> platforma

  //Pune obiectul desenat si collider-ele in pozitia (center, yaw) si noteaza cat
  //s-a miscat fiecare collider, ca player.js sa-l poata cara pe jucator.
  function sync() {
    object.position.copy(center);
    object.position.y += fallOffset;
    object.rotation.y = yaw;
    for (let i = 0; i < colliders.length; i++) {
      const c = colliders[i];
      //offset-urile sunt doar pe verticala, deci rotatia nu le schimba
      const x = center.x;
      const y = center.y + offsets[i];
      const z = center.z;
      c.moved.x = x - c.position.x;
      c.moved.y = y - c.position.y;
      c.moved.z = z - c.position.z;
      c.moved.yaw = yaw - c.yaw;
      c.position.set(x, y, z);
      c.yaw = yaw;
    }
  }
  //Prima asezare: inca nu s-a miscat nimic
  sync();
  for (const c of colliders) c.moved.x = c.moved.y = c.moved.z = c.moved.yaw = 0;

  //standingOn = collider-ul pe care sta jucatorul (sau null)
  function update(delta, elapsed, standingOn) {
    //1) Pozitia calculata din comportamente (pornind mereu de la baza)
    center.copy(base);
    yaw = baseYaw;
    if (p.move) {
      //sin merge lin intre -1 si 1: platforma incetineste la capete si accelereaza
      //la mijloc, ca un pendul. 2 * PI / period = cat de repede trece printr-o tura.
      center[p.move.axis] += Math.sin((elapsed * 2 * Math.PI) / p.move.period) * p.move.distance;
    }
    if (p.spin) yaw += elapsed * p.spin.speed;

    //2) Prabusirea
    if (p.crumble) updateCrumble(delta, standingOn);

    sync();

    //Tremuratul e doar pe desen (dupa sync): collider-ul ramane pe loc, altfel
    //jucatorul ar fi "carat" in toate partile de tremurat
    if (crumbleState === "shaking") {
      object.position.x += (Math.random() - 0.5) * 0.1;
      object.position.z += (Math.random() - 0.5) * 0.1;
    }

    //NOU: Clipitul: calculat din elapsed, deci ramane in ritm la orice FPS.
    //In ultimele 0.4 secunde devine mai transparent, ca avertisment.
    if (p.blink) {
      const cycle = p.blink.on + p.blink.off;
      const time = (((elapsed + (p.blink.phase ?? 0)) % cycle) + cycle) % cycle;
      const solid = time < p.blink.on;
      for (const c of colliders) c.enabled = solid;
      material.opacity = !solid ? 0.12 : time > p.blink.on - 0.4 ? 0.45 : 1;
    }
  }

  function updateCrumble(delta, standingOn) {
    if (crumbleState === "solid") {
      if (standingOn && standingOn.platform === platform) {
        crumbleState = "shaking";
        crumbleTimer = p.crumble.delay;
      }
    } else if (crumbleState === "shaking") {
      crumbleTimer -= delta;
      if (crumbleTimer <= 0) {
        //cade: collider-ele nu mai tin pe nimeni, jucatorul cade si el
        crumbleState = "falling";
        crumbleTimer = p.crumble.respawn;
        fallSpeed = 0;
        for (const c of colliders) c.enabled = false;
      }
    } else if (crumbleState === "falling") {
      //desenul cade cu aceeasi gravitatie ca jucatorul, ca sa para "real"
      fallSpeed += GRAVITY * delta;
      fallOffset -= fallSpeed * delta;
      object.visible = fallOffset > -30; //destul de jos: il ascundem
      crumbleTimer -= delta;
      if (crumbleTimer <= 0) {
        crumbleState = "solid";
        fallOffset = 0;
        object.visible = true;
        for (const c of colliders) c.enabled = true;
      }
    }
  }

  //Checkpoint-ul activ "se aprinde", ca sa stii de unde vei reaparea
  function setActive(active) {
    material.emissive.setHex(active ? CHECKPOINT_GLOW : 0x000000);
    material.emissiveIntensity = active ? 0.6 : 1;
  }

  return platform;
}

//NOU: SETUL DE PLATFORME din lume
//Tine impreuna lista de platforme si lista PLATA de collider-e (pe care o primeste
//player.js). Cine adauga sau sterge platforme (traseul, modul de constructie) trece
//prin add() / remove(), ca cele doua liste sa ramana mereu sincronizate.
export function createPlatformSet(scene) {
  const list = [];
  const colliders = [];
  let activeCheckpoint = null;

  function add(type, params) {
    const platform = createPlatform(type, params);
    list.push(platform);
    colliders.push(...platform.colliders);
    scene.add(platform.object);
    return platform;
  }

  function remove(platform) {
    const index = list.indexOf(platform);
    if (index === -1) return;
    list.splice(index, 1);
    for (const c of platform.colliders) colliders.splice(colliders.indexOf(c), 1);
    scene.remove(platform.object);
    //Cand stergem o platforma in timpul jocului, eliberam si memoria de pe placa
    //video (geometria si materialul). Altfel s-ar aduna la fiecare stergere.
    platform.object.traverse((child) => {
      if (child.isMesh) {
        child.geometry.dispose();
        child.material.dispose();
      }
    });
    if (activeCheckpoint === platform) activeCheckpoint = null;
  }

  function update(delta, elapsed, standingOn) {
    for (const platform of list) platform.update(delta, elapsed, standingOn);

    //Checkpoint: cand calci pe unul nou, el se aprinde si cel vechi se stinge
    if (standingOn && standingOn.checkpoint && standingOn.platform !== activeCheckpoint) {
      if (activeCheckpoint) activeCheckpoint.setActive(false);
      activeCheckpoint = standingOn.platform;
      activeCheckpoint.setActive(true);
    }
  }

  return { list, colliders, add, remove, update };
}
