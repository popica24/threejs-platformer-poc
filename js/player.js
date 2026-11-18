import * as THREE from "three";
import {
  SKIN_COLOR,
  BODY_Y,
  WALK_SPEED,
  RUN_SPEED,
  JUMP_FORCE,
  GRAVITY,
  WORLD_RADIUS,
  VELOCITY_SMOOTHING,
  TURN_SMOOTHING,
  WALK_BLEND_SMOOTHING,
  PLAYER_HEIGHT,
  STEP_HEIGHT,
  AIR_STEP_HEIGHT,
  SLIPPERY_SMOOTHING,
  KILL_Y,
  KILL_DROP,
  COYOTE_TIME,
  JUMP_BUFFER,
  JUMP_CUT_GRAVITY,
  DOUBLE_JUMP_FORCE,
  DASH_SPEED,
  DASH_TIME,
  WALL_SLIDE_SPEED,
  WALL_JUMP_UP,
  WALL_JUMP_PUSH,
  CONTROL_LOCK_SMOOTHING,
  GRAPPLE_RANGE,
  BOOST_SPEED,
} from "./config.js";
import { dampFactor } from "./utils.js";
import {
  findGround,
  findCeiling,
  resolveWalls,
  cancelVelocityInto,
} from "./collision.js";

//Mutam geometria in jos cu jumatate din inaltime, ca originea mesh-ului sa
//fie in capatul de sus. Asa, cand rotim membrul, se roteste in jurul
//articulatiei (ca un picior real), nu in jurul mijlocului.
//Primeste "parent" (grupul caracterului) ca parametru, ca sa nu depinda de o
//variabila globala.
function createLimb(parent, width, height, material, x, y) {
  const limbGeometry = new THREE.BoxGeometry(width, height, width);
  limbGeometry.translate(0, -height / 2, 0);
  const limb = new THREE.Mesh(limbGeometry, material);
  limb.position.set(x, y, 0); //pozitia articulatiei (sold / umar)
  limb.castShadow = true;
  parent.add(limb);
  return limb; //returnam membrul, ca sa il putem anima mai tarziu
}

//NOU: CARACTERUL
//il construim din forme simple (cutii, sfere, capsule)
//le grupam intr-un Group = un "container": daca mutam sau rotim grupul,
//se misca toate piesele o data, ca un singur obiect
//
//createPlayer() intoarce:
// - group: caracterul (camera il urmareste prin group.position)
// - update(delta, elapsed, input, colliders, cameraYaw): miscarea, saltul si animatia mersului.
//   NOU: input = obiectul din input.js (folosim input.keys si input.consumePress)
//   NOU: cameraYaw = unghiul camerei; tastele misca RELATIV la camera (vezi pasul 1)
//   NOU: colliders = lista formelor solide; o primim la fiecare apel (nu o tinem
//   aici), ca lista sa poata creste mai tarziu (modul de constructie) fara ca
//   player.js sa stie de unde vine.
// - getVelocity(): NOU: viteza cu care mergem (x, z), fara cea primita de la o
//   platforma care ne cara. O foloseste camera ca sa stie spre unde mergem.
// - getStandingOn(): NOU: collider-ul pe care stam (sau null). Il folosesc
//   platformele (cele care se prabusesc cand calci pe ele, checkpoint-urile).
//Viteza, saltul si "ceasul" mersului sunt variabile locale: doar update() le vede.
//NOU: emit(nume, valoare) anunta evenimentele jocului (salt, aterizare...); main.js decide ce sunet sau efect urmeaza
export function createPlayer(scene, emit = () => {}) {
  const group = new THREE.Group();

  const skinMat = new THREE.MeshStandardMaterial({
    color: SKIN_COLOR,
    roughness: 0.5,
  });
  const darkMat = new THREE.MeshStandardMaterial({
    color: 0x2a2a4a,
    roughness: 0.6,
  });
  const eyeMat = new THREE.MeshStandardMaterial({ color: 0x111122 });

  //Corpul: o capsula (cilindru cu capete rotunde)
  const body = new THREE.Mesh(
    new THREE.CapsuleGeometry(0.38, 0.6, 8, 16),
    skinMat,
  );
  body.position.y = BODY_Y;
  body.castShadow = true;
  group.add(body);

  //Capul: o sfera
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.32, 24, 24), skinMat);
  head.position.y = 2.2;
  head.castShadow = true;
  group.add(head);

  //Ochii: doua sfere mici, una in stanga (x negativ) si una in dreapta
  for (const x of [-0.12, 0.12]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.06, 12, 12), eyeMat);
    eye.position.set(x, 2.25, 0.29);
    group.add(eye);
  }

  const legL = createLimb(group, 0.24, 0.7, darkMat, -0.18, 0.7);
  const legR = createLimb(group, 0.24, 0.7, darkMat, 0.18, 0.7);
  const armL = createLimb(group, 0.16, 0.65, skinMat, -0.55, 1.75);
  const armR = createLimb(group, 0.16, 0.65, skinMat, 0.55, 1.75);

  group.position.set(0, 0, 8); //pozitia de start
  //NOU: pornim cu spatele la camera (cu fata spre -z, "in" scena). Modelul se
  //uita spre +z cand rotation.y = 0 (ochii sunt la z pozitiv), deci il intoarcem
  //cu 180 de grade. Camera porneste in spatele lui, exact unde era si inainte.
  group.rotation.y = Math.PI;
  //NOU: unde reaparem cand cadem in gol. La inceput e pozitia de start; fiecare
  //checkpoint pe care calcam o muta acolo.
  const respawnPoint = group.position.clone();
  scene.add(group);

  const velocity = new THREE.Vector3(); //viteza pe orizontala (x si z); y nu e folosit, saltul are velocityY
  let velocityY = 0; //viteza pe verticala (sus / jos) pentru salt
  let onGround = true; //stam pe ceva (podea sau platforma)?
  let walkTime = 0; //"ceas" folosit doar pt balansul bratelor si picioarelor
  let moveAmount = 0; //0 = stam pe loc, 1 = mergem
  //NOU: saltul doar la apasare: vezi input.consumePress("Space") la pasul 7
  let standingOn = null; //NOU: collider-ul pe care stam (null in aer)

  //NOU: starea miscarilor de platformer
  const startPoint = group.position.clone();
  const abilities = { doubleJump: false, dash: false, grapple: false };
  let coyote = 0; //timp ramas in care mai poti sari dupa ce ai parasit sol
  let buffer = 0; //timp ramas in care o apasare de Spatiu asteapta aterizarea
  let jumping = false; //true doar la saltul normal, nu la trambuline
  let airJumps = 0;
  let dashTimer = 0;
  let dashReady = true;
  let dashX = 0;
  let dashZ = 0;
  let controlLock = 0; //secunde in care inputul nu anuleaza un impuls primit
  let wallTimer = 0;
  let grapple = null; //{ x, y, z, length } cat timp esti agatat
  let squash = 0; //pozitiv = alungit, negativ = turtit
  let airBlend = 0;
  let invulnerable = 0;
  let lastCheckpoint = null;
  const wall = { hit: false, nx: 0, nz: 0 };
  const noEnvironment = { windX: 0, windZ: 0, gravity: 1 };
  //Franghia: o linie intre mana si punctul de care esti agatat
  const ropeGeometry = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]);
  const rope = new THREE.Line(ropeGeometry, new THREE.LineBasicMaterial({ color: 0x222244 }));
  rope.frustumCulled = false; //capetele se schimba mereu, deci sfera de culling ar fi gresita
  rope.visible = false;
  scene.add(rope);

  //NOU: Palaria si culoarea alese in magazin
  const hats = {
    cone: new THREE.ConeGeometry(0.28, 0.55, 20),
    halo: new THREE.TorusGeometry(0.32, 0.05, 10, 32),
    crown: new THREE.CylinderGeometry(0.3, 0.26, 0.28, 7, 1, true),
  };
  const hatMesh = new THREE.Mesh(hats.cone, new THREE.MeshStandardMaterial({ color: 0xf2c14a, metalness: 0.5, roughness: 0.3, side: THREE.DoubleSide }));
  hatMesh.visible = false;
  group.add(hatMesh);

  function setLook(color, hat) {
    skinMat.color.setHex(color);
    hatMesh.visible = !!hats[hat];
    if (hats[hat]) {
      hatMesh.geometry = hats[hat];
      hatMesh.position.y = hat === "halo" ? 2.85 : 2.62;
      hatMesh.rotation.x = hat === "halo" ? Math.PI / 2 : 0;
    }
  }

  //NOU: In persoana intai nu vrem sa vedem corpul din interior, dar umbra lui te ajuta
  //sa aterizezi. colorWrite: false = nu desena nimic pe ecran; umbra se calculeaza
  //separat, deci ramane.
  let firstPerson = false;
  function setFirstPerson(value) {
    firstPerson = value;
    for (const material of [skinMat, darkMat, eyeMat, hatMesh.material]) {
      material.colorWrite = !value;
      material.depthWrite = !value;
    }
  }

  function releaseGrapple() {
    grapple = null;
    rope.visible = false;
    controlLock = 0.6; //pastram viteza balansului
  }

  function respawn() {
    group.position.copy(respawnPoint);
    velocity.set(0, 0, 0);
    velocityY = 0;
    onGround = false; //in frame-ul urmator findGround ne aseaza pe suprafata
    standingOn = null;
    jumping = false;
    dashTimer = 0;
    grapple = null;
    rope.visible = false;
    invulnerable = 1; //o secunda de protectie, ca sa nu mori iar imediat
    emit("respawn");
  }

  //NOU: un pericol te-a lovit
  function kill() {
    if (invulnerable > 0) return;
    emit("death");
    respawn();
  }

  //NOU: inapoi la inceput, pentru o tura noua
  function resetRun() {
    respawnPoint.copy(startPoint);
    lastCheckpoint = null;
    abilities.doubleJump = abilities.dash = abilities.grapple = false;
    respawn();
    group.rotation.y = Math.PI;
  }

  //NOU: saritura pe un inamic
  function stomp() {
    velocityY = JUMP_FORCE;
    jumping = false;
    dashReady = true;
    squash = 0.3;
  }

  //Vectori refolositi in fiecare frame (nu cream obiecte noi de 60 de ori pe secunda)
  const direction = new THREE.Vector3();
  const targetVelocity = new THREE.Vector3();
  //NOU: rezultatul lui findGround (refolosit, ca sa nu cream un obiect nou pe frame)
  const ground = { height: 0, collider: null };

  function update(delta, elapsed, input, colliders, cameraYaw, world = null) {
    //NOU: vantul si gravitatia locului in care suntem (vezi zones.js)
    const env = world ? world.sample(group.position) : noEnvironment;
    invulnerable -= delta;
    controlLock -= delta;
    const keys = input.keys;
    //NOU: MISCAREA CARACTERULUI

    //NOU: 0) Daca platforma pe care stam s-a miscat sau rotit de la frame-ul trecut,
    //ne mutam si noi exact la fel, ca si cum am fi lipiti de ea. Altfel platforma
    //ar "fugi" de sub noi. Rotatia o facem in jurul centrului platformei: luam
    //pozitia noastra fata de centrul VECHI, o rotim, si o punem langa centrul NOU.
    if (standingOn && standingOn.enabled) {
      const moved = standingOn.moved;
      const center = standingOn.position; //deja pozitia noua
      const relX = group.position.x - (center.x - moved.x);
      const relZ = group.position.z - (center.z - moved.z);
      //aceeasi rotatie ca rotation.y din Three.js (vezi pushToWorld in collision.js)
      const cos = Math.cos(moved.yaw);
      const sin = Math.sin(moved.yaw);
      group.position.x = center.x + relX * cos + relZ * sin;
      group.position.z = center.z - relX * sin + relZ * cos;
      group.position.y += moved.y;
      group.rotation.y += moved.yaw; //ne rotim si cu fata, ca pe un carusel
    }

    //1) Citim tastele si calculam directia dorita.
    //"||" inseamna SAU: merge fie WASD, fie sagetile.
    //NOU: tastele sunt RELATIVE LA CAMERA: W = "inainte, dinspre camera",
    //D = "spre dreapta ecranului". Inainte erau fixe in lume (W = mereu -z), dar
    //acum camera se roteste, deci "-z" nu mai e mereu "in fata" pe ecran.
    let forwardInput = 0; //+1 = W, -1 = S
    let rightInput = 0; //+1 = D, -1 = A
    if (keys.KeyW || keys.ArrowUp) forwardInput += 1;
    if (keys.KeyS || keys.ArrowDown) forwardInput -= 1;
    if (keys.KeyA || keys.ArrowLeft) rightInput -= 1;
    if (keys.KeyD || keys.ArrowRight) rightInput += 1;
    //Directiile camerei pe orizontala (vezi camera.js):
    // inainte = (sin(yaw), cos(yaw)), dreapta = (-cos(yaw), sin(yaw))
    //(dreapta = inainte rotit cu 90 de grade). La start yaw = PI, deci inainte = -z
    //si dreapta = +x: exact ca vechile taste.
    const sinYaw = Math.sin(cameraYaw);
    const cosYaw = Math.cos(cameraYaw);
    direction.set(
      sinYaw * forwardInput - cosYaw * rightInput,
      0,
      cosYaw * forwardInput + sinYaw * rightInput,
    );

    const isMoving = direction.lengthSq() > 0; //lengthSq() = lungimea la patrat (mai ieftin de calculat)
    const isRunning = keys.ShiftLeft || keys.ShiftRight;
    const speed = isRunning ? RUN_SPEED : WALK_SPEED;

    //2) Daca apasam doua taste (ex: W si D), directia ar fi mai lunga decat 1
    //si am merge mai repede pe diagonala. normalize() o aduce la lungimea 1.
    if (isMoving) direction.normalize();

    //3) Viteza dorita = directie * viteza. Nu o aplicam direct, ci o apropiem lin
    //de cea curenta (lerp), ca sa avem accelerare si franare naturala.
    targetVelocity.copy(direction).multiplyScalar(speed);
    //NOU: pe gheata viteza se apropie mult mai incet de cea dorita: pornesti greu,
    //franezi greu si aluneci. E aceeasi formula, doar cu alt "smoothing".
    const smoothing =
      onGround && standingOn && standingOn.slippery
        ? SLIPPERY_SMOOTHING
        : VELOCITY_SMOOTHING;
    //NOU: dupa un impuls (saritura de pe perete, balans) inputul trage mai slab
    const appliedSmoothing = controlLock > 0 ? CONTROL_LOCK_SMOOTHING : smoothing;

    //NOU: DASH (Q): o tasnire scurta, o data pe saritura, fara gravitatie
    if (input.consumePress("KeyQ") && abilities.dash && dashReady) {
      dashReady = false;
      dashTimer = DASH_TIME;
      //Fara taste, tasnesti in directia in care te uiti
      dashX = isMoving ? direction.x : Math.sin(group.rotation.y);
      dashZ = isMoving ? direction.z : Math.cos(group.rotation.y);
      if (grapple) releaseGrapple();
      velocityY = 0;
      jumping = false;
      emit("dash");
    }

    //NOU: AGATARE (E): alegem cel mai apropiat punct aflat in raza si in fata camerei
    if (input.consumePress("KeyE") && abilities.grapple && world) {
      if (grapple) {
        releaseGrapple();
      } else {
        let best = null;
        let bestDistance = GRAPPLE_RANGE;
        for (const point of world.grapplePoints) {
          const dx = point.x - group.position.x;
          const dy = point.y - (group.position.y + 1.25);
          const dz = point.z - group.position.z;
          const d = Math.hypot(dx, dy, dz);
          //produsul scalar cu directia camerei > 0 = punctul e in fata
          if (d < bestDistance && dx * sinYaw + dz * cosYaw > 0) {
            best = point;
            bestDistance = d;
          }
        }
        if (best) {
          grapple = { x: best.x, y: best.y, z: best.z, length: bestDistance };
          rope.visible = true;
          jumping = false;
          emit("grapple");
        }
      }
    }

    if (dashTimer > 0) {
      dashTimer -= delta;
      velocity.set(dashX * DASH_SPEED, 0, dashZ * DASH_SPEED);
      if (dashTimer <= 0) controlLock = 0.15;
    } else if (grapple) {
      //Agatat: inputul doar impinge putin; balansul il face gravitatia
      velocity.addScaledVector(direction, 8 * delta);
    } else {
      velocity.lerp(targetVelocity, dampFactor(appliedSmoothing, delta));
    }

    //4) Mutam caracterul: pozitie += viteza * timp
    //NOU: vantul muta caracterul, dar nu intra in viteza lui (ca si la platformele care te cara)
    group.position.x += (velocity.x + env.windX) * delta;
    group.position.z += (velocity.z + env.windZ) * delta;

    //NOU: 4b) Peretii: daca am intrat intr-o platforma din lateral, ne impinge afara.
    //Se face INAINTE de miscarea pe verticala, ca sa stim exact pe ce coloana (x, z)
    //cautam apoi podeaua. (Miscarea "o axa pe rand" e cea mai simpla metoda stabila.)
    //NOU: in aer, o margine putin mai sus de talpi nu e perete: urcam pe ea (pasul 9)
    const stepHeight = onGround ? STEP_HEIGHT : AIR_STEP_HEIGHT;
    resolveWalls(colliders, group.position, velocity, stepHeight, wall);

    //5) Limita lumii: daca distanta fata de centru depaseste raza, il tragem inapoi
    //(inmultim x si z cu acelasi numar, ca sa ramana pe aceeasi directie fata de centru)
    //NOU: a fost mutata inainte de salt (era dupa), ca podeaua sa fie cautata in
    //pozitia finala pe orizontala. Pe disc rezultatul e acelasi.
    const distance = Math.hypot(group.position.x, group.position.z);
    if (distance > WORLD_RADIUS) {
      const pullBack = WORLD_RADIUS / distance;
      group.position.x *= pullBack;
      group.position.z *= pullBack;

      //NOU: scoatem si partea din viteza care impinge spre exterior.
      //Fara asta, cand mergi drept in perete, pozitia e oprita dar viteza nu,
      //asa ca picioarele ar continua sa mearga pe loc. Partea paralela cu
      //marginea ramane, ca sa poti "aluneca" de-a lungul ei.
      //Marginea lumii e un perete ca oricare altul: directia dinspre perete spre
      //caracter e spre centru, adica minus (pozitie / raza).
      cancelVelocityInto(
        velocity,
        -group.position.x / WORLD_RADIUS,
        -group.position.z / WORLD_RADIUS,
      );
    }

    //6) Il rotim cu fata spre directia de mers.
    //NOU: in persoana intai corpul priveste mereu unde privesti tu (conteaza pentru umbra si dash)
    if (isMoving || firstPerson) {
      //atan2(x, z) transforma o directie (x, z) intr-un unghi
      const targetAngle = firstPerson ? cameraYaw : Math.atan2(direction.x, direction.z);
      //Calea cea mai scurta spre unghiul dorit. Fara asta, la trecerea de la
      //179 la -179 de grade s-ar invarti aproape un cerc intreg, in loc de 2 grade.
      let diff = targetAngle - group.rotation.y;
      diff = Math.atan2(Math.sin(diff), Math.cos(diff));
      group.rotation.y += diff * dampFactor(TURN_SMOOTHING, delta);
    }

    //7) SALTUL
    //NOU: sarim doar cand Spatiul TOCMAI a fost apasat (un eveniment de apasare),
    //nu cat timp e tinut. Altfel, tinand Spatiul apasat, caracterul ar sari din
    //nou la fiecare aterizare, ca o minge. Folosim evenimentul din input.js (nu
    //"era sus frame-ul trecut, acum e jos"), ca sa nu pierdem apasarile foarte
    //scurte, care incep si se termina intre doua frame-uri.
    //Atentie: o apasare in aer e "consumata" si pierduta (fara salt dublu).
    const spacePressed = input.consumePress("Space");
    const wasOnGround = onGround;
    //NOU: COYOTE TIME si JUMP BUFFER: doua cronometre mici care iarta greselile de
    //cateva sutimi de secunda. Sunt cea mai ieftina imbunatatire a controlului.
    if (onGround) {
      coyote = COYOTE_TIME;
      airJumps = abilities.doubleJump ? 1 : 0;
      dashReady = true;
    } else {
      coyote -= delta;
    }
    buffer = spacePressed ? JUMP_BUFFER : buffer - delta;
    if (wall.hit && !onGround) wallTimer = 0.14;
    else wallTimer -= delta;

    if (grapple && spacePressed) {
      //Spatiu in timpul balansului: dai drumul si mai primesti un mic impuls
      releaseGrapple();
      velocityY = Math.max(velocityY, 0) + 5;
      buffer = 0;
    } else if (buffer > 0 && coyote > 0) {
      velocityY = JUMP_FORCE; //impuls in sus
      onGround = false;
      jumping = true;
      coyote = 0;
      buffer = 0;
      squash = 0.22;
      emit("jump");
    } else if (spacePressed && wallTimer > 0 && !onGround) {
      //NOU: saritura de pe perete: in sus si departe de el
      velocityY = WALL_JUMP_UP;
      velocity.x = wall.nx * WALL_JUMP_PUSH;
      velocity.z = wall.nz * WALL_JUMP_PUSH;
      controlLock = 0.28;
      wallTimer = 0;
      buffer = 0;
      jumping = false;
      dashReady = true;
      emit("walljump");
    } else if (spacePressed && airJumps > 0 && !onGround) {
      velocityY = DOUBLE_JUMP_FORCE;
      airJumps--;
      buffer = 0;
      jumping = false;
      squash = 0.18;
      emit("doublejump");
    }
    //NOU: tinem minte unde erau talpile INAINTE de miscare, ca sa stim ce am
    //traversat in acest frame (vezi mai jos)
    const previousFeetY = group.position.y;
    //gravitatia trage mereu in jos.
    //NOU: formula exacta pentru acceleratie constanta: y += v*t - g*t^2/2.
    //Inainte faceam "v -= g*t; y += v*t", care pierde putin din saltul de la fiecare
    //frame: la 30 FPS saltul urca 1.62, la 60 FPS 1.70, la 144 FPS 1.75. Cu formula
    //exacta urca 1.79 (= JUMP_FORCE^2 / (2 * GRAVITY)) la orice FPS.
    //NOU: gravitatia variaza: zona locala, plus salt scurt daca ai dat drumul la Spatiu
    if (velocityY <= 0) jumping = false;
    const gravity =
      dashTimer > 0
        ? 0
        : GRAVITY * env.gravity * (jumping && !input.keys.Space ? JUMP_CUT_GRAVITY : 1);
    group.position.y += velocityY * delta - 0.5 * gravity * delta * delta;
    velocityY -= gravity * delta;

    //NOU: alunecare pe perete: cazi incet cat timp te impingi in el
    if (wall.hit && !onGround && velocityY < -WALL_SLIDE_SPEED) {
      velocityY = -WALL_SLIDE_SPEED;
    }

    //NOU: franghia: nu te lasa mai departe decat lungimea ei. Scoatem doar partea
    //din viteza care te-ar duce mai departe; restul devine balans.
    if (grapple) {
      const nx0 = group.position.x - grapple.x;
      const ny0 = group.position.y + 1.25 - grapple.y;
      const nz0 = group.position.z - grapple.z;
      const d = Math.hypot(nx0, ny0, nz0);
      if (d > grapple.length) {
        const nx = nx0 / d;
        const ny = ny0 / d;
        const nz = nz0 / d;
        group.position.x = grapple.x + nx * grapple.length;
        group.position.y = grapple.y + ny * grapple.length - 1.25;
        group.position.z = grapple.z + nz * grapple.length;
        const outward = velocity.x * nx + velocityY * ny + velocity.z * nz;
        if (outward > 0) {
          velocity.x -= outward * nx;
          velocityY -= outward * ny;
          velocity.z -= outward * nz;
        }
      }
      const line = ropeGeometry.attributes.position;
      line.setXYZ(0, group.position.x, group.position.y + 1.4, group.position.z);
      line.setXYZ(1, grapple.x, grapple.y, grapple.z);
      line.needsUpdate = true;
    }

    //NOU: 8) Tavanul: daca urcam si capul a trecut de partea de jos a unei
    //platforme, il oprim acolo si incepem sa cadem (viteza in sus devine 0)
    if (velocityY > 0) {
      const ceilingY = findCeiling(
        colliders,
        group.position.x,
        group.position.z,
        previousFeetY + PLAYER_HEIGHT,
      );
      if (group.position.y + PLAYER_HEIGHT > ceilingY) {
        group.position.y = ceilingY - PLAYER_HEIGHT;
        velocityY = 0;
      }
    }

    //NOU: 9) Podeaua. Inainte era "daca y <= 0, stai la 0". Acum cautam cea mai
    //inalta suprafata de sub talpi, dintre toate platformele (si discul e una).
    //Luam in seama doar suprafetele care erau sub talpi (plus o treapta) la
    //inceputul frame-ului; asa nu "sarim" pe acoperisul unei platforme pe sub
    //care trecem, si nici nu trecem prin platforme subtiri cand cadem repede.
    findGround(
      colliders,
      group.position.x,
      group.position.z,
      previousFeetY + stepHeight, //NOU: stepHeight, ca la pereti
      ground,
    );
    //a) am cazut pana la (sau prin) suprafata in acest frame => aterizam
    const landed = group.position.y <= ground.height;
    //b) eram pe sol si suprafata e putin mai jos (coboram o rampa sau o treapta)
    //=> ramanem lipiti de ea, in loc sa "zburam" cateva frame-uri si sa nu putem sari
    const snapDown =
      wasOnGround && group.position.y - ground.height <= STEP_HEIGHT;
    if (velocityY <= 0 && (landed || snapDown)) {
      group.position.y = ground.height;
      if (grapple) releaseGrapple();
      if (ground.collider.bounce > 0) {
        //NOU: trambulina: in loc sa ne oprim, primim un impuls in sus
        velocityY = ground.collider.bounce;
        onGround = false;
        standingOn = null;
        coyote = 0;
        squash = 0.3;
        emit("bounce");
      } else {
        //NOU: turtire la aterizare, cu atat mai mare cu cat ai cazut mai tare
        if (!wasOnGround) {
          squash = -Math.min(0.32, -velocityY * 0.018);
          emit("land", -velocityY);
        }
        velocityY = 0;
        //NOU: placa de viteza: te arunca inainte, pe directia ei (+x local)
        if (ground.collider.boost && controlLock < 0.2) {
          velocity.x = Math.cos(ground.collider.yaw) * BOOST_SPEED;
          velocity.z = -Math.sin(ground.collider.yaw) * BOOST_SPEED;
          velocityY = 7;
          controlLock = 0.55;
          emit("boost");
        }
        onGround = true;
        standingOn = ground.collider;
        //NOU: checkpoint: de acum reaparem aici (in centrul lui, la inaltimea suprafetei)
        if (standingOn.checkpoint) {
          respawnPoint.set(standingOn.position.x, ground.height, standingOn.position.z);
          if (standingOn !== lastCheckpoint) {
            lastCheckpoint = standingOn;
            emit("checkpoint");
          }
        }
        if (standingOn.finish) emit("finish");
        //NOU: o placa de viteza ne-a dat deja impuls in sus: nu mai stam pe ea
        if (velocityY > 0) {
          onGround = false;
          standingOn = null;
        }
      }
    } else {
      onGround = false;
      standingOn = null;
    }

    //NOU: 10) Am cazut in gol: inapoi la ultimul checkpoint, oprit complet
    //NOU: limita urca odata cu checkpoint-ul, ca sa nu cazi zeci de secunde de sus
    if (group.position.y < Math.max(KILL_Y, respawnPoint.y - KILL_DROP)) {
      emit("death");
      respawn();
    }

    //NOU: ANIMATIA MERSULUI

    //moveAmount creste spre 1 cand mergem si scade spre 0 cand stam (tranzitie lina)
    const horizontalSpeed = Math.hypot(velocity.x, velocity.z);
    const targetMove = Math.min(1, horizontalSpeed / WALK_SPEED);
    moveAmount = THREE.MathUtils.damp(
      moveAmount,
      targetMove,
      WALK_BLEND_SMOOTHING,
      delta,
    );

    //Cu cat mergem mai repede, cu atat "ceasul" mersului avanseaza mai repede
    walkTime += delta * horizontalSpeed * 1.6;

    //Math.sin da un balans dus-intors. Picioarele si bratele opuse merg in opozitie,
    //ca la un om real: piciorul stang inainte = bratul stang inapoi.
    const swing = Math.sin(walkTime) * 0.9 * moveAmount;
    legL.rotation.x = swing;
    legR.rotation.x = -swing;
    armL.rotation.x = -swing;
    armR.rotation.x = swing;

    //Mica "respiratie" cand stam pe loc: corpul se misca putin sus-jos
    body.position.y = BODY_Y + Math.sin(elapsed * 2) * 0.02 * (1 - moveAmount);

    //NOU: Pozele din aer: amestecam mersul cu poza, ca sa nu sara brusc
    airBlend = THREE.MathUtils.damp(airBlend, onGround ? 0 : 1, 14, delta);
    const rising = velocityY > 0;
    const armPose = dashTimer > 0 ? 1.4 : grapple ? -3 : rising ? -2.5 : -1.1;
    armL.rotation.x += (armPose - armL.rotation.x) * airBlend;
    armR.rotation.x += (armPose - armR.rotation.x) * airBlend;
    legL.rotation.x += ((rising ? -0.7 : 0.35) - legL.rotation.x) * airBlend;
    legR.rotation.x += ((rising ? 0.25 : -0.35) - legR.rotation.x) * airBlend;
    const spread = (rising ? 0.15 : 0.75) * airBlend;
    armL.rotation.z = -spread;
    armR.rotation.z = spread;

    //NOU: Squash and stretch: scala se duce spre normal; volumul ramane aproape la fel
    squash *= Math.exp(-11 * delta);
    group.scale.set(1 - squash * 0.5, 1 + squash, 1 - squash * 0.5);
    //Clipim cat timp suntem protejati dupa reaparitie
    group.visible = invulnerable <= 0 || Math.floor(elapsed * 14) % 2 === 0;
  }

  return {
    group,
    update,
    getStandingOn: () => standingOn,
    getVelocity: () => velocity, //NOU (de citit, nu de modificat din afara)
    getVelocityY: () => velocityY, //NOU
    abilities, //NOU: le deblocheaza pickups.js prin main.js
    kill, //NOU
    stomp, //NOU
    resetRun, //NOU
    setLook, //NOU
    setFirstPerson, //NOU
    getRespawnY: () => respawnPoint.y, //NOU
  };
}
