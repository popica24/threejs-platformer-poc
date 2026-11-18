import * as THREE from "three";
import {
  PLAYER_RADIUS,
  FOOT_RADIUS,
  CURVED_FOOT_RADIUS,
  HEAD_RADIUS,
  PLAYER_HEIGHT,
  STEP_HEIGHT,
  MAX_SLOPE_DEG,
} from "./config.js";

//NOU: COLIZIUNI FACUTE DE MANA (fara biblioteca de fizica)
//
//Ideea: caracterul e un cilindru vertical. Pentru fiecare forma solida (collider)
//stim sa raspundem la 3 intrebari:
// 1) "Care e cea mai inalta suprafata de sub talpa mea?"  -> pe ce stau (findGround)
// 2) "Care e cel mai jos punct de deasupra capului?"     -> in ce dau cu capul (findCeiling)
// 3) "Ma bag in peretele ei? Cu cat trebuie sa ma imping?" -> pereti (resolveWalls)
//
//Fiecare collider are o pozitie (centrul) si un unghi "yaw" (rotatie in jurul axei Y).
//Ca sa nu scriem matematica pentru cutii rotite, mutam caracterul in sistemul de
//coordonate al cutiei ("local"): acolo cutia e mereu nerotita si aliniata cu axele.
//Rotim doar in jurul lui Y, ca "sus" sa ramana mereu sus (altfel n-am mai sti
//simplu care e fata de deasupra).
//
//Tipuri:
// - box:      cutie; width (x) / height (y) / depth (z)
// - ramp:     cutie cu fata de sus inclinata; urca de-a lungul axei x locale,
//             de la baza (capatul -x) pana la height (capatul +x)
// - cylinder: cilindru vertical; radius, height
// - sphere:   sfera; radius
// - torus:    NOU: inel culcat (ca un colac); radius = raza inelului (de la centru
//             pana in mijlocul "tubului"), tube = raza tubului
//
//NOU: sfera si torul folosesc aceeasi matematica. O sectiune verticala printr-un
//tor arata ca doua cercuri; daca masuram distanta pana la cercul din mijlocul
//tubului (nu pana la un punct), torul se comporta exact ca o sfera de raza "tube".
//O sfera e deci un tor cu raza inelului 0.
//
//NOU: campuri pentru platformele care se misca (le scrie platforms.js):
// - enabled: false = collider-ul e ignorat (o platforma care s-a prabusit)
// - moved:   cat s-a deplasat / rotit in ultimul frame, ca sa-l putem cara pe jucator

const MAX_SLOPE_SIN = Math.sin(THREE.MathUtils.degToRad(MAX_SLOPE_DEG));

//Cat de jos poate sa fie "tavanul" fata de capul din frame-ul trecut ca sa-l luam
//in seama (o toleranta mica pentru erori de rotunjire)
const CEILING_TOLERANCE = 0.05;

//Obiecte refolosite in fiecare apel: coliziunile ruleaza de zeci de ori pe frame,
//asa ca nu vrem sa cream obiecte noi (le-ar aduna garbage collector-ul, cu sacadari).
const local = { x: 0, z: 0 };
const push = { x: 0, z: 0 };

//Creeaza un collider. params = { x, y, z, yaw, ...dimensiuni }. (x, y, z) = centrul.
export function createCollider(type, params) {
  const collider = {
    type,
    position: new THREE.Vector3(params.x ?? 0, params.y ?? 0, params.z ?? 0),
    yaw: params.yaw ?? 0,
    halfX: 0, //jumatate din latime (lucram cu jumatati: centrul +- jumatate = marginile)
    halfY: 0,
    halfZ: 0,
    radius: 0,
    ringRadius: 0, //NOU: doar pentru tor (la sfera e 0)
    enabled: true, //NOU
    moved: { x: 0, y: 0, z: 0, yaw: 0 }, //NOU
  };
  if (type === "box" || type === "ramp") {
    collider.halfX = params.width / 2;
    collider.halfY = params.height / 2;
    collider.halfZ = params.depth / 2;
  } else if (type === "cylinder") {
    collider.radius = params.radius;
    collider.halfY = params.height / 2;
  } else if (type === "sphere") {
    collider.radius = params.radius;
    collider.halfY = params.radius;
  } else if (type === "torus") {
    collider.ringRadius = params.radius;
    collider.radius = params.tube;
    collider.halfY = params.tube;
  } else {
    throw new Error(`Tip de collider necunoscut: ${type}`);
  }
  return collider;
}

//Muta punctul (x, z) din lume in sistemul local al collider-ului (rezultatul in "local").
//E inversul lui mesh.rotation.y: rotim cu -yaw in jurul centrului.
function toLocal(c, x, z) {
  const dx = x - c.position.x;
  const dz = z - c.position.z;
  const cos = Math.cos(c.yaw);
  const sin = Math.sin(c.yaw);
  local.x = dx * cos - dz * sin;
  local.z = dx * sin + dz * cos;
}

//Drumul invers: un vector din sistemul local inapoi in lume (rotim cu +yaw)
function pushToWorld(c, px, pz, out) {
  const cos = Math.cos(c.yaw);
  const sin = Math.sin(c.yaw);
  out.x = px * cos + pz * sin;
  out.z = -px * sin + pz * cos;
}

//Se atinge un cerc (raza r, centrul in "local") cu dreptunghiul [-hx, hx] x [-hz, hz]?
//Truc clasic: cel mai apropiat punct din dreptunghi = coordonatele "taiate" (clamp)
//la marginile lui. Daca acel punct e la mai putin de r de centru, se ating.
function circleTouchesRect(hx, hz, r) {
  const dx = local.x - THREE.MathUtils.clamp(local.x, -hx, hx);
  const dz = local.z - THREE.MathUtils.clamp(local.z, -hz, hz);
  return dx * dx + dz * dz < r * r;
}

//Inaltimea fetei de sus a rampei la coordonata locala x (o linie dreapta:
//de la baza la capatul -x, pana la varf la capatul +x)
function rampTopAt(c, lx) {
  const x = THREE.MathUtils.clamp(lx, -c.halfX, c.halfX);
  return c.position.y - c.halfY + (x + c.halfX) * (c.halfY / c.halfX);
}

//NOU: distanta orizontala de la (x, z) pana la "axa" formei rotunde: pentru sfera
//e centrul, pentru tor e cercul din mijlocul tubului (de raza ringRadius).
function ringDistance(c, x, z) {
  const d = Math.hypot(x - c.position.x, z - c.position.z);
  return Math.abs(d - c.ringRadius);
}

//1) Inaltimea suprafetei pe care am putea sta, sub o talpa de raza r in (x, z).
//-Infinity = nu e nimic de-al acestui collider sub talpa.
function surfaceTop(c, x, z, r) {
  switch (c.type) {
    case "box":
      toLocal(c, x, z);
      return circleTouchesRect(c.halfX, c.halfZ, r)
        ? c.position.y + c.halfY
        : -Infinity;
    case "ramp":
      toLocal(c, x, z);
      if (!circleTouchesRect(c.halfX, c.halfZ, r)) return -Infinity;
      //cel mai inalt punct de sub talpa e marginea talpii dinspre varful rampei
      //NOU: cu raza mica, altfel talpa lata ne-ar ridica deasupra pantei
      return rampTopAt(c, local.x + Math.min(r, CURVED_FOOT_RADIUS));
    case "cylinder": {
      const d = Math.hypot(x - c.position.x, z - c.position.z);
      return d < c.radius + r ? c.position.y + c.halfY : -Infinity;
    }
    case "sphere":
    case "torus": {
      //dEff = distanta orizontala de la centrul sferei (sau mijlocul tubului) la
      //cel mai apropiat punct al talpii. Pe o sfera, inaltimea la distanta d de
      //centru e sqrt(R^2 - d^2) (Pitagora: d^2 + h^2 = R^2).
      //NOU: tot cu raza mica, altfel am sta in aer pe langa sfera
      const dEff = Math.max(0, ringDistance(c, x, z) - Math.min(r, CURVED_FOOT_RADIUS));
      //Panta sferei in acel punct: sin(unghi) = dEff / R. Prea abrupt = nu stam,
      //iar peretele (mai jos) ne impinge in afara => alunecam de pe sfera.
      if (dEff >= c.radius * MAX_SLOPE_SIN) return -Infinity;
      return c.position.y + Math.sqrt(c.radius * c.radius - dEff * dEff);
    }
  }
  return -Infinity;
}

//2) Inaltimea partii de jos a collider-ului deasupra talpii (tavanul).
//+Infinity = nu e nimic deasupra.
function undersideBottom(c, x, z, r) {
  switch (c.type) {
    case "box":
    case "ramp":
      toLocal(c, x, z);
      return circleTouchesRect(c.halfX, c.halfZ, r)
        ? c.position.y - c.halfY
        : Infinity;
    case "cylinder": {
      const d = Math.hypot(x - c.position.x, z - c.position.z);
      return d < c.radius + r ? c.position.y - c.halfY : Infinity;
    }
    case "sphere":
    case "torus": {
      const dEff = Math.max(0, ringDistance(c, x, z) - r);
      if (dEff >= c.radius) return Infinity;
      return c.position.y - Math.sqrt(c.radius * c.radius - dEff * dEff);
    }
  }
  return Infinity;
}

//Impinge un cerc afara dintr-un dreptunghi (in sistemul local). Rezultatul, deja
//intors in coordonatele lumii, ajunge in "out". false = nu se ating.
function pushOutOfRect(c, hx, hz, r, out) {
  const cx = THREE.MathUtils.clamp(local.x, -hx, hx);
  const cz = THREE.MathUtils.clamp(local.z, -hz, hz);
  let px = local.x - cx;
  let pz = local.z - cz;
  const d2 = px * px + pz * pz;
  if (d2 >= r * r) return false;

  if (d2 > 1e-12) {
    //Centrul e in afara dreptunghiului: il impingem pe directia de la cel mai
    //apropiat punct spre centru, exact cat sa ajunga la distanta r
    const d = Math.sqrt(d2);
    px *= (r - d) / d;
    pz *= (r - d) / d;
  } else {
    //Centrul e chiar inauntru (am intrat adanc, de ex. am cazut pe langa margine):
    //iesim pe partea cea mai apropiata, ca sa fie cel mai mic salt posibil
    const penX = c.halfX - Math.abs(local.x) + r;
    const penZ = c.halfZ - Math.abs(local.z) + r;
    if (penX < penZ) {
      px = (local.x < 0 ? -1 : 1) * penX;
      pz = 0;
    } else {
      px = 0;
      pz = (local.z < 0 ? -1 : 1) * penZ;
    }
  }
  pushToWorld(c, px, pz, out);
  return true;
}

//Impinge un cerc afara dintr-un inel orizontal: toate punctele aflate la mai
//putin de "gap" fata de cercul de raza ringRadius. NOU: functia e generala:
// - cilindru: ringRadius = 0, gap = raza cilindrului + raza jucatorului
// - sfera:    ringRadius = 0, gap = raza "feliei" + raza jucatorului
// - tor:      ringRadius = raza inelului; putem fi impinsi in afara SAU spre
//             gaura din mijloc, in functie de partea pe care suntem
function pushOutOfRing(c, x, z, ringRadius, gap, out) {
  let dx = x - c.position.x;
  let dz = z - c.position.z;
  let d = Math.hypot(dx, dz);
  if (Math.abs(d - ringRadius) >= gap) return false;
  if (d < 1e-6) {
    //exact in centru: orice directie e la fel de buna, alegem +x
    dx = 1;
    dz = 0;
    d = 1;
  }
  //in afara cercului din mijloc (sau gaura e prea mica sa incapem) => spre exterior,
  //altfel => spre interior, in gaura
  const goOut = d >= ringRadius || ringRadius - gap <= 0;
  const targetDistance = goOut ? ringRadius + gap : ringRadius - gap;
  out.x = (dx / d) * (targetDistance - d);
  out.z = (dz / d) * (targetDistance - d);
  return true;
}

//3) Peretii: daca partea collider-ului dintre [spanBottom, spanTop] (inaltimile
//corpului care pot lovi un perete) se suprapune cu corpul, calculam impingerea.
function wallPush(c, x, z, spanBottom, spanTop, r, out) {
  switch (c.type) {
    case "box":
      //intai verificarea ieftina pe inaltime, apoi cea pe orizontala
      if (c.position.y + c.halfY <= spanBottom) return false;
      if (c.position.y - c.halfY >= spanTop) return false;
      toLocal(c, x, z);
      return pushOutOfRect(c, c.halfX, c.halfZ, r, out);
    case "ramp": {
      toLocal(c, x, z);
      if (!circleTouchesRect(c.halfX, c.halfZ, r)) return false;
      //Rampa e perete doar acolo unde e mai inalta decat o treapta fata de noi.
      //Venind de la capatul de jos, partea atinsa e joasa => o urcam, nu ne opreste.
      const top = rampTopAt(c, local.x + r);
      if (top <= spanBottom) return false;
      if (c.position.y - c.halfY >= spanTop) return false;
      return pushOutOfRect(c, c.halfX, c.halfZ, r, out);
    }
    case "cylinder":
      if (c.position.y + c.halfY <= spanBottom) return false;
      if (c.position.y - c.halfY >= spanTop) return false;
      return pushOutOfRing(c, x, z, 0, c.radius + r, out);
    case "sphere":
    case "torus": {
      //"Felia" orizontala cea mai lata a sferei (sau a tubului torului) care cade
      //in dreptul corpului: e la inaltimea din [spanBottom, spanTop] cea mai
      //apropiata de centru
      const y = THREE.MathUtils.clamp(c.position.y, spanBottom, spanTop);
      const dy = y - c.position.y;
      if (Math.abs(dy) >= c.radius) return false;
      const sliceRadius = Math.sqrt(c.radius * c.radius - dy * dy);
      return pushOutOfRing(c, x, z, c.ringRadius, sliceRadius + r, out);
    }
  }
  return false;
}

//Scoate din viteza partea care intra in perete. (nx, nz) = directia dinspre perete
//spre caracter, de lungime 1. Partea paralela cu peretele ramane, ca sa alunecam
//de-a lungul lui, iar picioarele nu mai "merg pe loc" cand ne izbim de el.
export function cancelVelocityInto(velocity, nx, nz) {
  const into = velocity.x * nx + velocity.z * nz; //produsul scalar
  if (into < 0) {
    velocity.x -= into * nx;
    velocity.z -= into * nz;
  }
}

//Cea mai inalta suprafata de sub talpa, dar nu mai sus de maxTop (nu vrem sa
//"urcam" pe un acoperis aflat deasupra capului). Rezultatul in out:
//out.height (-Infinity daca nu e nimic) si out.collider (pe ce stam; in faza 2
//il folosim ca platformele care se misca sa ne care cu ele).
export function findGround(colliders, x, z, maxTop, out) {
  out.height = -Infinity;
  out.collider = null;
  for (const c of colliders) {
    if (!c.enabled) continue; //NOU: platformele prabusite nu mai tin pe nimeni
    const h = surfaceTop(c, x, z, FOOT_RADIUS);
    if (h <= maxTop && h > out.height) {
      out.height = h;
      out.collider = c;
    }
  }
  return out;
}

//Cel mai jos "tavan" de deasupra, dar doar cele aflate mai sus de capul din
//frame-ul trecut (cele mai jos sunt pereti, nu tavane). +Infinity = cer liber.
export function findCeiling(colliders, x, z, previousHeadY) {
  const minBottom = previousHeadY - CEILING_TOLERANCE;
  let lowest = Infinity;
  for (const c of colliders) {
    if (!c.enabled) continue;
    const b = undersideBottom(c, x, z, HEAD_RADIUS); //NOU: raza capului, nu a talpii
    if (b >= minBottom && b < lowest) lowest = b;
  }
  return lowest;
}

//Impinge caracterul afara din toti peretii si ii taie viteza spre ei.
//Peretii sunt doar partile mai sus de o treapta (STEP_HEIGHT) fata de talpi:
//ce e mai jos il urcam (findGround se ocupa de asta).
//Doua treceri: la un colt, iesirea dintr-un perete ne poate baga in celalalt.
//NOU: stepHeight vine ca parametru: in aer iertam mai mult (AIR_STEP_HEIGHT, player.js)
//NOU: wall (optional) primeste ultimul perete atins: wall.hit, wall.nx, wall.nz (saritura de pe perete)
export function resolveWalls(colliders, position, velocity, stepHeight = STEP_HEIGHT, wall = null) {
  if (wall) wall.hit = false;
  const spanBottom = position.y + stepHeight;
  const spanTop = position.y + PLAYER_HEIGHT;
  for (let pass = 0; pass < 2; pass++) {
    for (const c of colliders) {
      if (!c.enabled) continue;
      if (!wallPush(c, position.x, position.z, spanBottom, spanTop, PLAYER_RADIUS, push)) {
        continue;
      }
      position.x += push.x;
      position.z += push.z;
      const length = Math.hypot(push.x, push.z);
      if (length > 0) {
        cancelVelocityInto(velocity, push.x / length, push.z / length);
        if (wall) {
          wall.hit = true;
          wall.nx = push.x / length;
          wall.nz = push.z / length;
        }
      }
    }
  }
}
