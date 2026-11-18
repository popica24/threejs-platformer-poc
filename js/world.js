import * as THREE from "three";
import { Reflector } from "three/addons/objects/Reflector.js";
import {
  ACCENT_COLOR,
  SKIN_COLOR,
  GROUND_RADIUS,
  CENTER_Y,
  HOVER_SCALE,
  KNOT_SCALE_SMOOTHING,
  KNOT_COLOR_SMOOTHING,
  PARALLAX_SMOOTHING,
} from "./config.js";
import { dampFactor } from "./utils.js";

//NOU: shader-ul oglinzii de pe insula. E cel din Reflector, cu o singura diferenta:
//alpha < 1, ca oglinda sa fie doar un strat lucios peste podea (se vad si umbrele),
//iar spre margine se stinge, ca sa nu se termine brusc.
const FLOOR_MIRROR_SHADER = {
  name: "FloorMirror",
  uniforms: {
    color: { value: null },
    tDiffuse: { value: null },
    textureMatrix: { value: null },
  },
  vertexShader: /* glsl */ `
    uniform mat4 textureMatrix;
    varying vec4 vUv;
    varying vec2 vLocal;
    void main() {
      vUv = textureMatrix * vec4(position, 1.0);
      vLocal = position.xy;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }`,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    varying vec4 vUv;
    varying vec2 vLocal;
    void main() {
      vec4 base = texture2DProj(tDiffuse, vUv);
      float edge = 1.0 - smoothstep(${(GROUND_RADIUS * 0.8).toFixed(1)}, ${GROUND_RADIUS.toFixed(1)}, length(vLocal));
      gl_FragColor = vec4(base.rgb, 0.42 * edge);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
    }`,
};

//OBIECTELE LUMII (decorul): grid-ul, nodul din centru, inelul, lunile si stelele.
//NOU: niciunul nu e solid; platformele pe care stai sunt in platforms.js / course.js.
//createWorld() le adauga in scena si intoarce:
// - knot: nodul, ca main.js sa poata verifica hover-ul pe el
// - ring: inelul
// - pulseKnot(): culoare aleatoare + puls (o chemam la click)
// - update(): animatia lor, chemata in fiecare frame
//Starea (culoarea tinta, pulsul) ramane aici, nu e vizibila din alte fisiere.
export function createWorld(scene) {
  //NOU: podeaua (insula din centru) nu mai e aici: e o platforma creata in
  //course.js cu createPlatform(), ca toate celelalte. Aici ramane doar grid-ul,
  //care e decor.

  //Un grid (retea de linii) peste podea, ca sa vedem ca ne miscam.
  //NOU: grid rotund (PolarGridHelper), de raza insulei: unul patrat ar iesi in
  //gol pe la colturi. Parametri: raza, nr. de "felii", nr. de cercuri, finete.
  const grid = new THREE.PolarGridHelper(
    GROUND_RADIUS,
    16,
    GROUND_RADIUS,
    64,
    ACCENT_COLOR,
    0xa5b1cc, //NOU: linii deschise, pe podeaua deschisa
  );
  grid.position.y = 0.02; //putin deasupra podelei, ca sa nu se "bata" cu ea
  scene.add(grid);

  //NOU: OGLINDA de pe insula. Reflector deseneaza scena inca o data, de sub podea,
  //intr-o textura; asa se reflecta si lucrurile care se misca (caracterul, nodul).
  //Costa o randare in plus pe frame, de aceea o avem doar aici. Restul obiectelor
  //reflecta harta statica scene.environment (vezi core.js).
  const floorMirror = new Reflector(new THREE.CircleGeometry(GROUND_RADIUS, 64), {
    textureWidth: 1024,
    textureHeight: 1024,
    clipBias: 0.003,
    shader: FLOOR_MIRROR_SHADER,
  });
  floorMirror.material.transparent = true;
  floorMirror.rotation.x = -Math.PI / 2; //cercul e vertical; il culcam
  floorMirror.position.y = 0.01;
  scene.add(floorMirror);

  //NOU: FORME MARI IN FUNDAL, departe, dincolo de limita lumii (WORLD_RADIUS).
  //Sunt doar decor: nu au collider-e. Unghiul de aur (2.4 radiani) le imprastie
  //uniform in jurul insulei, fara sa se alinieze, si fara numere aleatoare.
  const backgroundGeometries = [
    new THREE.BoxGeometry(1, 1, 1),
    new THREE.SphereGeometry(0.6, 32, 24),
    new THREE.ConeGeometry(0.65, 1.3, 32),
    new THREE.TorusGeometry(0.5, 0.18, 16, 48),
    new THREE.IcosahedronGeometry(0.65),
    new THREE.CylinderGeometry(0.5, 0.5, 1.4, 32),
  ];
  const backgroundColors = [0xff9f80, 0x8f88ff, 0x71d0bf, 0xffd36e, 0xf29ac2, 0x79b8f2];
  const backgroundShapes = [];
  for (let i = 0; i < 44; i++) {
    const shape = new THREE.Mesh(
      backgroundGeometries[i % backgroundGeometries.length],
      new THREE.MeshStandardMaterial({
        color: backgroundColors[i % backgroundColors.length],
        roughness: 0.35,
        metalness: 0.15,
      }),
    );
    const angle = i * 2.4;
    const distance = 260 + (i % 9) * 40;
    shape.position.set(
      Math.cos(angle) * distance,
      -50 + (i % 7) * 45,
      Math.sin(angle) * distance,
    );
    shape.rotation.set(i * 0.7, i * 1.3, i * 0.4);
    shape.scale.setScalar(35 + (i % 5) * 16);
    backgroundShapes.push({ shape, baseY: shape.position.y, spin: 0.05 + (i % 4) * 0.03 });
    scene.add(shape);
  }

  //Obiectul principal : Geometry + Material = Mesh
  const geometry = new THREE.TorusKnotGeometry(1.2, 0.4, 200, 32, 3, 2);
  const material = new THREE.MeshStandardMaterial({
    color: ACCENT_COLOR,
    metalness: 0.6,
    roughness: 0.25,
  });
  const knot = new THREE.Mesh(geometry, material);
  //castShadow e o setare, nu o actiune: ajunge sa o punem o singura data
  knot.castShadow = true;
  scene.add(knot);

  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(2.4, 0.03, 16, 120),
    new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.5,
    }),
  );
  ring.rotation.x = Math.PI / 2.5; //inclinat
  ring.position.y = CENTER_Y;
  scene.add(ring);

  //O planeta mica ce orbiteaza in jurul nodului.
  //Are aceeasi culoare ca pielea caracterului, dar material separat:
  //daca am schimba culoarea lunii, nu vrem sa se schimbe si caracterul
  const moon = new THREE.Mesh(
    new THREE.SphereGeometry(0.35, 32, 32),
    new THREE.MeshStandardMaterial({
      color: SKIN_COLOR,
      roughness: 0.5,
    }),
  );
  moon.castShadow = true;
  scene.add(moon);

  //NOU: a doua luna, mai mica, pe o orbita mai larga, inclinata
  const moon2 = new THREE.Mesh(
    new THREE.SphereGeometry(0.2, 32, 32),
    new THREE.MeshStandardMaterial({
      color: 0x5cd6ff,
      roughness: 0.3,
      metalness: 0.4,
    }),
  );
  moon2.castShadow = true;
  scene.add(moon2);

  //Particule: mii de puncte (stele) intr-un singur obiect
  //NOU: pe cerul deschis, punctele albe nu s-ar vedea, asa ca le coloram ca pe un praf luminos
  const STAR_COUNT = 6000;
  const positions = new Float32Array(STAR_COUNT * 3);
  for (let i = 0; i < STAR_COUNT; i++) {
    positions[i * 3] = (Math.random() - 0.5) * 80; //intre -40 si 40
    positions[i * 3 + 1] = Math.random() * 35 + 2; //intre 2 si 37
    positions[i * 3 + 2] = (Math.random() - 0.5) * 80;
  }
  const starGeometry = new THREE.BufferGeometry();
  starGeometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));

  const stars = new THREE.Points(
    starGeometry,
    new THREE.PointsMaterial({ color: 0x8fa2d8, size: 0.08 }),
  );
  scene.add(stars);

  //Click = culoare aleatoare + puls
  const targetColor = new THREE.Color(ACCENT_COLOR);
  let pulse = 0; //NOU: 1 la click, apoi scade spre 0

  function pulseKnot() {
    targetColor.setHSL(Math.random(), 0.8, 0.6);
    pulse = 1;
  }

  //mouse = pozitia mouse-ului intre -1 si 1 (pentru parallax)
  //hovered = true daca mouse-ul e pe nod (calculat in input.js)
  function update(delta, elapsed, mouse, hovered) {
    //a) Rotatie continua (viteza * delta) = miscare independenta de fps
    knot.rotation.x += 0.4 * delta;
    knot.rotation.y += 0.6 * delta;

    //b) miscare periodica cu sin() - "plutire" de sus-jos
    knot.position.y = CENTER_Y + Math.sin(elapsed * 1.2) * 0.3;

    //c) orbita circulara cu sin si cos
    moon.position.x = Math.cos(elapsed * 1.5) * 3;
    moon.position.z = Math.sin(elapsed * 1.5) * 3;
    moon.position.y = CENTER_Y + Math.sin(elapsed * 3) * 0.8;

    //NOU: a doua luna merge in sens invers (minus) si pe o orbita inclinata
    const a2 = -elapsed * 0.8;
    moon2.position.x = Math.cos(a2) * 4.5;
    moon2.position.z = Math.sin(a2) * 4.5;
    moon2.position.y = CENTER_Y + Math.sin(a2) * 1.8; //y legat de sin => orbita "inclinata"

    //NOU: inelul se invarte incet, iar pulsul il mareste temporar
    ring.rotation.z += 0.3 * delta;
    ring.scale.setScalar(1 + pulse * 0.5);

    //NOU: formele din fundal se rotesc incet si plutesc (y pornind mereu de la baza)
    for (let i = 0; i < backgroundShapes.length; i++) {
      const item = backgroundShapes[i];
      item.shape.rotation.y += item.spin * delta;
      item.shape.position.y = item.baseY + Math.sin(elapsed * 0.3 + i) * 1.5;
    }

    //d) Stelele se rotesc incet
    stars.rotation.y = elapsed * 0.02;

    //NOU: stelele "palpaie" - marimea punctelor variaza cu sin
    stars.material.size = 0.05 + Math.sin(elapsed * 2) * 0.015;

    //e) Efect de parallax
    //damp = interpolare lina spre tinta, independenta de FPS
    //(PARALLAX_SMOOTHING = cat de repede ajunge)
    knot.rotation.z = THREE.MathUtils.damp(
      knot.rotation.z,
      mouse.x * 0.5,
      PARALLAX_SMOOTHING,
      delta,
    );

    //NOU: hover - daca raza loveste nodul, tinta de scalare devine HOVER_SCALE
    const targetScale = hovered ? HOVER_SCALE : 1;

    //pulsul scade exponential (la fel de repede indiferent de fps)
    pulse *= Math.exp(-4 * delta);

    //scala nodului = tinta (hover) + puls, cu tranzitie lina
    const wanted = targetScale + pulse * 0.3;
    knot.scale.setScalar(
      THREE.MathUtils.damp(knot.scale.x, wanted, KNOT_SCALE_SMOOTHING, delta),
    );

    //f) Tranzitie lina de culoare
    material.color.lerp(targetColor, dampFactor(KNOT_COLOR_SMOOTHING, delta));
  }

  return { knot, ring, pulseKnot, update, setMirror: (value) => (floorMirror.visible = value) };
}
