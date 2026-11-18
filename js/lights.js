import * as THREE from "three";
import { SHADOW_EXTENT } from "./config.js";

//LUMINI
//createLights() le adauga in scena si intoarce update(), pentru ca lumina
//colorata se misca in fiecare frame.
export function createLights(scene) {
  scene.add(new THREE.AmbientLight(0xffffff, 0.15));

  const pointLight = new THREE.PointLight(0xffffff, 30);
  pointLight.position.set(4, 4, 6);
  scene.add(pointLight);

  const colorLight = new THREE.PointLight(0xff3c9e, 30);
  colorLight.position.set(-5, -3, 3);
  scene.add(colorLight);

  //NOU: lumina directionala = ca soarele (razele paralele, de departe)
  //o folosim pentru umbre, pentru ca e mai ieftina decat PointLight cu umbre
  const dirLight = new THREE.DirectionalLight(0xfff4e0, 2.5) //NOU: soare cald si puternic; cerul lumineaza restul;
  dirLight.position.set(10, 20, 10);
  dirLight.castShadow = true;
  dirLight.shadow.mapSize.set(2048, 2048);
  //Umbrele se calculeaza doar in "cutia" camerei de umbre. O facem cat lumea:
  //mai mica = umbre taiate la margine, mai mare = umbre mai pixelate
  //NOU: era cat podeaua; acum podeaua e mai mica, dar traseul ajunge pana la margine
  dirLight.shadow.camera.left = -SHADOW_EXTENT;
  dirLight.shadow.camera.right = SHADOW_EXTENT;
  dirLight.shadow.camera.top = SHADOW_EXTENT;
  dirLight.shadow.camera.bottom = -SHADOW_EXTENT;
  dirLight.shadow.camera.far = 120; //NOU: soarele sta acum mai departe de tinta
  scene.add(dirLight);
  scene.add(dirLight.target); //NOU: tinta trebuie sa fie in scena ca s-o putem muta

  //NOU: mutam soarele odata cu jucatorul, pastrand aceeasi directie a razelor.
  //Rotunjim pozitia, ca umbrele sa nu "tremure" la fiecare pas mic.
  function followPlayer(position) {
    const x = Math.round(position.x);
    const y = Math.round(position.y);
    const z = Math.round(position.z);
    dirLight.target.position.set(x, y, z);
    dirLight.position.set(x + 20, y + 40, z + 20);
  }

  const daySun = new THREE.Color(0xfff4e0);
  const sunsetSun = new THREE.Color(0xff9a5c);

  //NOU: dayTime = 0 zi, 1 apus (vezi main.js)
  function update(elapsed, playerPosition, dayTime) {
    dirLight.color.lerpColors(daySun, sunsetSun, dayTime);
    dirLight.intensity = 2.5 - dayTime * 0.9;
    followPlayer(playerPosition); //NOU
    //NOU: lumina colorata se plimba stanga-dreapta, reflexiile se misca pe nod
    colorLight.position.x = Math.sin(elapsed * 0.8) * 6;
  }

  return { update };
}
