import * as THREE from "three";
import {
  CAMERA_DISTANCE,
  CAMERA_MIN_DISTANCE,
  CAMERA_MAX_DISTANCE,
  CAMERA_ZOOM_SMOOTHING,
  ZOOM_SENSITIVITY,
  CAMERA_HEIGHT,
  CAMERA_SHOULDER,
  CAMERA_SMOOTHING,
  CAMERA_VERTICAL_SMOOTHING,
  CAMERA_SWING_SMOOTHING,
  CAMERA_DEFAULT_PITCH,
  CAMERA_MIN_PITCH,
  CAMERA_MAX_PITCH,
  CAMERA_RECENTER_DELAY,
  CAMERA_FOV,
  CAMERA_RUN_FOV,
  CAMERA_FOV_SMOOTHING,
  MOUSE_SENSITIVITY,
  CAMERA_EYE_HEIGHT,
  CAMERA_FIRST_PERSON_FOV,
  CAMERA_FIRST_PERSON_PITCH,
  CAMERA_VIEW_SMOOTHING,
  WALK_SPEED,
} from "./config.js";
import { dampFactor } from "./utils.js";

//NOU: CAMERA "PERSOANA A TREIA"
//NOU: acum e o camera in stilul jocurilor open-world: o rotesti liber cu mouse-ul, in
//jurul caracterului, iar daca lasi mouse-ul in pace revine singura in spatele lui.
//
//Ideea: camera are propriul unghi, "yaw" (rotatia in jurul axei Y, ca rotation.y).
//Din yaw stim directia "inainte" a camerei pe orizontala:
//   inainte = (sin(yaw), 0, cos(yaw))
//(e aceeasi formula ca atan2(x, z) din player.js, doar invers).
//NOU: "pitch" e al doilea unghi: cat de sus sta camera fata de caracter.
//
//NOU: Imagineaza-ti un brat (ca un bat de selfie) prins de umarul caracterului ("pivot").
//Mouse-ul roteste bratul, iar camera sta in capatul lui. Daca intre pivot si camera
//apare o platforma, bratul se scurteaza, ca sa nu vedem prin ea.
//
//createFollowCamera(camera, target) intoarce:
// - update(delta, velocity, look, zoom, platforms): roteste si muta camera (se cheama DUPA ce
//   s-a miscat caracterul). velocity = viteza cu care MERGE caracterul (din
//   player.getVelocity()): camera revine spre directia in care mergi, nu spre directia
//   in care se uita. NOU: look = miscarea mouse-ului in pixeli; zoom = cat s-a invartit
//   rotita; platforms = lista
//   platformelor, primita la fiecare apel (ca lista sa poata creste).
// - getYaw(): unghiul camerei, de care player.js are nevoie ca sa stie ce inseamna
//   "inainte" cand apesi W (inainte = dinspre camera spre caracter)
export function createFollowCamera(camera, target) {
  //Pornim exact in spatele caracterului
  let yaw = target.rotation.y;
  let pitch = CAMERA_DEFAULT_PITCH; //NOU
  let sinceLook = CAMERA_RECENTER_DELAY; //NOU: secunde de la ultima miscare de mouse
  let wantedDistance = CAMERA_DISTANCE; //NOU: lungimea aleasa cu rotita
  let distance = CAMERA_DISTANCE; //NOU: se apropie lin de wantedDistance
  let armLength = CAMERA_DISTANCE; //NOU: lungimea curenta a bratului
  let firstPerson = false; //NOU: vederea aleasa cu V
  let viewBlend = 0; //NOU: 0 = persoana a treia, 1 = persoana intai; intre ele = tranzitie
  const thirdPersonPosition = new THREE.Vector3(); //NOU
  const eye = new THREE.Vector3(); //NOU
  const eyeTarget = new THREE.Vector3(); //NOU: un punct in fata ochilor
  const lookPoint = new THREE.Vector3(); //NOU

  //Vectori refolositi in fiecare frame
  const pivot = new THREE.Vector3(); //NOU: urmareste caracterul cu o mica intarziere
  const aim = new THREE.Vector3(); //NOU: pivotul mutat peste umar; aici ne uitam
  const back = new THREE.Vector3(); //NOU: directia de la pivot spre camera
  //NOU: raza cu care vedem daca bratul camerei intra intr-o platforma
  const raycaster = new THREE.Raycaster();
  const hits = [];

  function setPivotTarget(out) {
    out.set(target.position.x, target.position.y + CAMERA_HEIGHT, target.position.z);
  }

  //NOU: cat de lung poate fi bratul in frame-ul asta, fara sa treaca printr-o platforma
  function freeArmLength(platforms) {
    raycaster.set(aim, back);
    raycaster.far = distance;
    hits.length = 0;
    for (const platform of platforms) {
      //o platforma prabusita nu mai e un obstacol
      if (!platform.colliders[0].enabled) continue;
      raycaster.intersectObject(platform.object, true, hits);
    }
    if (hits.length === 0) return distance; //nimic in cale
    let nearest = distance;
    for (const hit of hits) nearest = Math.min(nearest, hit.distance);
    //0.3 = distanta fata de suprafata, ca planul "near" al camerei sa nu intre in ea
    return Math.max(0.8, nearest - 0.3);
  }

  //NOU: asaza camera in capatul bratului, privind in lungul lui
  function placeCamera(platforms) {
    //dreapta = (-cos(yaw), sin(yaw)), ca in player.js
    aim.set(
      pivot.x - Math.cos(yaw) * CAMERA_SHOULDER,
      pivot.y,
      pivot.z + Math.sin(yaw) * CAMERA_SHOULDER,
    );
    back.set(
      -Math.sin(yaw) * Math.cos(pitch),
      Math.sin(pitch),
      -Math.cos(yaw) * Math.cos(pitch),
    );
    return platforms ? freeArmLength(platforms) : distance;
  }

  setPivotTarget(pivot);
  placeCamera(null);
  camera.position.copy(aim).addScaledVector(back, armLength);
  camera.lookAt(aim);

  const pivotGoal = new THREE.Vector3();

  function update(delta, velocity, look, zoom, platforms) {
    //NOU: 1) Mouse-ul: rotatia e directa, fara netezire si fara delta: pixelii miscati
    //inseamna deja "cat", indiferent de cate frame-uri au trecut.
    //Mouse spre dreapta = yaw scade (vezi formula pentru "dreapta" de mai sus).
    if (look.x !== 0 || look.y !== 0) sinceLook = 0;
    else sinceLook += delta;
    yaw -= look.x * MOUSE_SENSITIVITY;
    pitch = THREE.MathUtils.clamp(
      pitch + look.y * MOUSE_SENSITIVITY,
      //NOU: din ochi poti privi aproape drept in sus si in jos: nu mai e un brat care sa loveasca podeaua
      firstPerson ? -CAMERA_FIRST_PERSON_PITCH : CAMERA_MIN_PITCH,
      firstPerson ? CAMERA_FIRST_PERSON_PITCH : CAMERA_MAX_PITCH,
    );

    //NOU: Zoom. Inmultim in loc sa adunam, ca o miscare de rotita sa se simta la fel
    //si de aproape si de departe (acelasi procent, nu acelasi numar de unitati).
    wantedDistance = THREE.MathUtils.clamp(
      wantedDistance * Math.exp(zoom * ZOOM_SENSITIVITY),
      CAMERA_MIN_DISTANCE,
      CAMERA_MAX_DISTANCE,
    );
    distance = THREE.MathUtils.damp(distance, wantedDistance, CAMERA_ZOOM_SMOOTHING, delta);

    //2) Rotim camera spre directia in care merge caracterul (cand merge inainte,
    //asta inseamna in spatele lui), pe drumul cel mai scurt (acelasi truc cu
    //atan2(sin, cos) ca la rotirea caracterului).
    //De ce directia de MERS si nu cea in care se uita? Cand apesi D, caracterul se
    //intoarce treptat spre dreapta si ar trece prin unghiuri "aproape inainte", iar
    //camera s-ar roti putin la fiecare apasare. Viteza, in schimb, arata spre
    //dreapta aproape imediat.
    //NOU: doar daca n-ai miscat mouse-ul de un timp; altfel ti-ar lua camera din mana.
    const speed = Math.hypot(velocity.x, velocity.z);
    //NOU: in persoana intai camera e capul tau: se misca doar cu mouse-ul
    if (!firstPerson && sinceLook >= CAMERA_RECENTER_DELAY) {
      let diff = Math.atan2(velocity.x, velocity.z) - yaw;
      diff = Math.atan2(Math.sin(diff), Math.cos(diff));
      //Cat de tare ne rotim depinde de cat de mult merge caracterul "in fata"
      //(dinspre camera): cos(diff) e 1 cand merge drept inainte, 0 cand merge intr-o
      //parte (A / D) si negativ cand vine spre noi (S).
      // - in fata (W): camera il urmareste complet
      // - lateral (A / D): camera NU se roteste. Altfel, cum tastele sunt relative
      //   la camera, "dreapta" s-ar roti odata cu camera si caracterul ar alerga in
      //   cerc strans, ametitor.
      // - spre noi (S): nici atat; il vezi pur si simplu venind spre tine
      // - pe diagonala (W + A / W + D): camera se roteste partial => "virezi" lin
      // - pe loc: camera ramane cum e (de aceea inmultim si cu viteza, intre 0 si 1)
      const swing = Math.max(0, Math.cos(diff)) * Math.min(1, speed / WALK_SPEED);
      yaw += diff * swing * dampFactor(CAMERA_SWING_SMOOTHING, delta);
      //NOU: si inaltimea revine la cea de start, cu aceeasi tarie
      pitch += (CAMERA_DEFAULT_PITCH - pitch) * swing * dampFactor(CAMERA_SWING_SMOOTHING, delta);
    }

    //3) Pivotul se apropie lin de caracter. NOU: netezim pivotul, nu camera: daca am
    //netezi camera, rotirea cu mouse-ul ar parea "cu elastic". Pe verticala e mai
    //lent, ca imaginea sa nu sara odata cu fiecare salt.
    setPivotTarget(pivotGoal);
    const k = dampFactor(CAMERA_SMOOTHING, delta);
    pivot.x += (pivotGoal.x - pivot.x) * k;
    pivot.z += (pivotGoal.z - pivot.z) * k;
    pivot.y = THREE.MathUtils.damp(pivot.y, pivotGoal.y, CAMERA_VERTICAL_SMOOTHING, delta);

    //NOU: 4) Bratul se scurteaza imediat cand e obstacol (altfel am vedea prin el)
    //si se lungeste inapoi lin
    const free = placeCamera(platforms);
    armLength = Math.min(free, THREE.MathUtils.damp(armLength, free, 5, delta));
    thirdPersonPosition.copy(aim).addScaledVector(back, armLength);

    //NOU: Ochii urmaresc caracterul direct, fara intarzierea pivotului: altfel ai simti
    //ca iti ramane capul in urma corpului. Privim opusul directiei "back".
    eye.set(target.position.x, target.position.y + CAMERA_EYE_HEIGHT, target.position.z);
    eyeTarget.copy(eye).addScaledVector(back, -CAMERA_DISTANCE);

    //NOU: Amestecam cele doua vederi, ca schimbarea sa fie o miscare, nu o saritura.
    //Cu delta 0 (schimbata din meniu, jocul sta pe loc) trecem direct.
    const wantedBlend = firstPerson ? 1 : 0;
    viewBlend = delta === 0 ? wantedBlend : THREE.MathUtils.damp(viewBlend, wantedBlend, CAMERA_VIEW_SMOOTHING, delta);
    if (Math.abs(viewBlend - wantedBlend) < 0.002) viewBlend = wantedBlend;
    camera.position.lerpVectors(thirdPersonPosition, eye, viewBlend);
    lookPoint.lerpVectors(aim, eyeTarget, viewBlend);
    camera.lookAt(lookPoint);

    //NOU: 5) Cand alergi, campul vizual se largeste putin: senzatie de viteza
    const baseFov = firstPerson ? CAMERA_FIRST_PERSON_FOV : CAMERA_FOV; //NOU
    const wantedFov = baseFov + (speed > WALK_SPEED * 1.15 ? CAMERA_RUN_FOV - CAMERA_FOV : 0);
    if (Math.abs(camera.fov - wantedFov) > 0.01) {
      camera.fov = THREE.MathUtils.damp(camera.fov, wantedFov, CAMERA_FOV_SMOOTHING, delta);
      camera.updateProjectionMatrix(); //obligatoriu dupa schimbarea fov-ului
    }
  }

  return { update, getYaw: () => yaw, setFirstPerson: (value) => (firstPerson = value) };
}
