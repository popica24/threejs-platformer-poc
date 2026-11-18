import { GROUND_RADIUS } from "./config.js";

//NOU: TRASEUL DEMO
//Un tur complet in jurul insulei din centru, care foloseste fiecare forma si fiecare
//comportament din platforms.js. E scris ca DATE (o lista), nu ca cod: ca sa adaugi
//o platforma, adaugi un rand. (Modul de constructie va face la fel, din joc.)
//
//Traseul (in sens invers acelor de ceasornic, vazut de sus, pornind spre dreapta = +x):
// insula -> pietre statice -> con in trepte -> platforma mobila -> CHECKPOINT 1 ->
// trambulina -> pervaz inalt -> pod de gheata -> pietre care se prabusesc -> inel ->
// CHECKPOINT 2 -> bara rotitoare -> disc rotitor -> sfera -> lift -> rampa inapoi pe insula
//
//Distante de referinta: saltul urca ~1.8, iar in timpul lui mergi ~3.5 (alergand ~6.5).
//Cele mai multe goluri sunt de 1-2 unitati, ca traseul sa fie de invatat, nu de chinuit.
const COURSE = [
  //Insula din centru: si ea e doar o platforma (un cilindru cu fata de sus la y = 0)
  { type: "cylinder", x: 0, y: -0.5, z: 0, radius: GROUND_RADIUS, height: 1, color: 0xb9c4d6, roughness: 0.9 },
  //Punctul de start (checkpoint): un disc subtire, mai jos de o treapta, deci il calci mergand
  { type: "cylinder", x: 0, y: 0.05, z: 8, radius: 1.2, height: 0.1, color: 0x3a3f7a, checkpoint: true },

  //--- A: spre est, statice ---
  { type: "box", x: 14.5, y: -0.3, z: 0, width: 3, height: 0.6, depth: 3, color: 0x7d84c9 },
  { type: "cylinder", x: 18.5, y: 0, z: 0, radius: 1.3, height: 1, color: 0x5cb8a8 },
  //trepte de 0.28 (< STEP_HEIGHT): le urci mergand, ca pe o scara
  { type: "cone", x: 23, y: 0.2, z: 0, radius: 2.4, height: 1.4, steps: 5, color: 0xc9a05c },

  //--- B: spre nord, comportamente ---
  //se misca inainte-inapoi pe z: stai pe ea si te duce cu ea
  { type: "box", x: 22, y: 0.6, z: -5.5, width: 2.5, height: 0.4, depth: 2.5, color: 0x5c8ac9, move: { axis: "z", distance: 1.5, period: 4 } },
  { type: "cylinder", x: 21, y: 0.5, z: -11, radius: 1.5, height: 0.6, color: 0x3a7a55, checkpoint: true },
  //trambulina: singurul mod de a ajunge pe pervazul inalt de langa ea
  { type: "box", x: 17.5, y: 0.3, z: -13, width: 2, height: 0.4, depth: 2, color: 0xff5ca8, bounce: 16 },
  { type: "box", x: 14, y: 3.75, z: -15, width: 3, height: 0.5, depth: 3, color: 0x7d84c9 },

  //--- C: spre vest, sus ---
  { type: "box", x: 7, y: 3.8, z: -16.5, width: 8, height: 0.4, depth: 2.5, slippery: true },
  //se prabusesc la 0.6 secunde dupa ce calci pe ele si reapar dupa 3 secunde
  { type: "box", x: 0.5, y: 3.8, z: -16.5, width: 2, height: 0.4, depth: 2, color: 0xa86c4a, crumble: { delay: 0.6, respawn: 3 } },
  { type: "box", x: -3, y: 3.8, z: -16.5, width: 2, height: 0.4, depth: 2, color: 0xa86c4a, crumble: { delay: 0.6, respawn: 3 } },
  { type: "box", x: -6.5, y: 3.8, z: -16.5, width: 2, height: 0.4, depth: 2, color: 0xa86c4a, crumble: { delay: 0.6, respawn: 3 } },
  //inel culcat: mergi pe "colac" pana in partea cealalta
  { type: "torus", x: -11.5, y: 3.2, z: -15, radius: 3, tube: 0.7, color: 0xe0a85c },
  { type: "cylinder", x: -17.5, y: 3.5, z: -12, radius: 1.5, height: 0.6, color: 0x3a7a55, checkpoint: true },

  //--- D: spre sud, rotiri, inapoi acasa ---
  //bara care se invarte: astepti sa vina spre tine, sari pe ea si te poarta cu ea
  { type: "box", x: -20, y: 3.4, z: -5, width: 7, height: 0.4, depth: 1.6, color: 0x8a5cb8, spin: { speed: 0.5 } },
  { type: "cylinder", x: -20, y: 3, z: 2.5, radius: 2.5, height: 0.6, color: 0x5cb8a8, spin: { speed: 0.8 } },
  { type: "sphere", x: -17.5, y: 2, z: 7.5, radius: 1.5, color: 0xe0a85c },
  //lift: urca si coboara (top intre 0.3 si 3.3)
  { type: "box", x: -14, y: 1.6, z: 10.5, width: 2.5, height: 0.4, depth: 2.5, color: 0x5c8ac9, move: { axis: "y", distance: 1.5, period: 5 } },
  //rampa care coboara pe insula. yaw = PI o intoarce, ca sa urce spre -x (spre lift)
  { type: "ramp", x: -9.5, y: 0.6, z: 9, yaw: Math.PI, width: 5, height: 1.2, depth: 2.5, color: 0x9ac95c },
];

//NOU: MAREA SPIRALA
//Pleaca din marginea de sud a insulei (in spatele punctului de start), se departeaza
//in linie dreapta, apoi se invarte in jurul lumii, tot mai larg si tot mai sus.
//
//Sute de platforme scrise de mana ar fi greu de reglat: daca muti una, trebuie sa le
//muti pe toate de dupa ea. Asa ca avem un "creion" (angle, radius, top) care inainteaza
//pe spirala, iar fiecare functie de mai jos deseneaza o piesa si muta creionul.
//Traseul e tot o lista de date; doar ca o generam, in loc sa o scriem rand cu rand.
//
//Coordonate polare: x = radius * sin(angle), z = radius * cos(angle).
//yaw = angle face ca axa +x locala a platformei sa arate inainte, de-a lungul spiralei.
const COIL_SPACING = 26; //distanta dintre doua ture ale spiralei
const TIERS = 4; //de cate ori repetam succesiunea de zone (fiecare e mai grea)
const COLORS = [
  [0x7fd1ae, 0xf2a65a, 0x5c8ac9, 0xa86c4a, 0x8a5cb8, 0xe06c9f],
  [0x5cb8d6, 0xf2d15a, 0x6c63ff, 0xc4744a, 0x4fae7b, 0xff7a6b],
  [0xc78bf2, 0x5cd6b0, 0xf28a5c, 0x8f6b52, 0x4a9fe0, 0xf2c14a],
  [0xf26b6b, 0x62c2f2, 0xb5e05c, 0x75586f, 0xf2a2d0, 0x6f7bf2],
];

function createSpiral() {
  const list = [];
  const coins = []; //NOU
  const hazards = []; //NOU
  const zones = []; //NOU
  const grapplePoints = []; //NOU
  const pickups = []; //NOU
  let angle = 0;
  let radius = 12; //pornim de la marginea insulei
  let top = 0; //inaltimea suprafetei pe care mergem
  let lastHalf = 0; //jumatate din lungimea piesei anterioare
  let straight = true; //la inceput mergem drept spre exterior
  let lavaStart = Infinity; //NOU

  //Muta creionul: distanta dintre centre = jumatatea veche + golul + jumatatea noua.
  //Asa "gap" inseamna chiar golul pe care il sare jucatorul.
  function advance(gap, half, rise) {
    const distance = lastHalf + gap + half;
    if (straight) {
      radius += distance;
    } else {
      angle += distance / radius; //arc = raza * unghi
      radius += ((COIL_SPACING / (2 * Math.PI)) * distance) / radius;
    }
    top += rise;
    lastHalf = half;
  }

  function add(type, y, params) {
    const piece = {
      type,
      x: radius * Math.sin(angle),
      y,
      z: radius * Math.cos(angle),
      yaw: angle,
      route: list.length + 1, //NOU: pozitia pe traseu, pentru bara de progres
      ...params,
    };
    list.push(piece);
    //NOU: o moneda la fiecare a doua piesa (nu deasupra celor care se misca)
    if (list.length % 2 === 0 && !params.move && !params.spin && !params.bounce) {
      coins.push({ x: piece.x, y: top + 1.4, z: piece.z });
    }
  }

  //NOU: un punct langa creion: forward de-a lungul spiralei, out spre exterior
  function at(forward, out) {
    const a = angle + forward / radius;
    const r = radius + out;
    return { x: r * Math.sin(a), z: r * Math.cos(a) };
  }
  //NOU: pericolele si zonele sunt tot date; le creeaza hazards.js si zones.js
  function hazard(kind, forward, out, extra) {
    hazards.push({ kind, ...at(forward, out), y: top, yaw: angle, ...extra });
  }

  //Piesele. "extra" = culoare si comportamente (vezi platforms.js)
  function slab(gap, rise, width, depth, extra) {
    advance(gap, width / 2, rise);
    add("box", top - 0.2, { width, height: 0.4, depth, ...extra });
  }
  function pad(gap, rise, r, extra) {
    advance(gap, r, rise);
    add("cylinder", top - 0.3, { radius: r, height: 0.6, ...extra });
  }
  function ball(gap, rise, r, extra) {
    advance(gap, r * 0.7, rise); //marginea sferei e prea abrupta ca sa stai pe ea
    add("sphere", top - r, { radius: r, ...extra });
  }
  function ring(gap, rise, r, tube, extra) {
    advance(gap, r + tube, rise);
    add("torus", top - tube, { radius: r, tube, ...extra });
  }
  function ramp(gap, width, height, depth, extra) {
    advance(gap, width / 2, 0);
    add("ramp", top + height / 2, { width, height, depth, ...extra });
    top += height;
  }
  function cone(gap, rise, r, height, extra) {
    advance(gap, r, rise);
    add("cone", top + height / 2, { radius: r, height, steps: 5, ...extra });
  }
  function checkpoint(gap, rise) {
    pad(gap, rise, 2.4, { color: 0x3a7a55, checkpoint: true });
  }

  //Podul care iese de pe insula
  for (let i = 0; i < 5; i++) slab(1.3, 0, 3, 3, { color: 0x7d84c9 });
  checkpoint(1.3, 0);
  straight = false;

  for (let tier = 0; tier < TIERS; tier++) {
    const c = COLORS[tier];
    //Golurile cresc cu fiecare nivel. Alergand sari ~6 unitati, deci raman posibile.
    const g = (base) => base + tier * 0.3;
    //Pe directia de mers, ca platforma sa se apropie si sa se departeze de tine
    const alongPath = () => (Math.abs(Math.cos(angle)) > Math.abs(Math.sin(angle)) ? "x" : "z");

    //--- 1: pietre, tot mai sus ---
    for (let i = 0; i < 6; i++) {
      if (i % 2) pad(g(1.5), 0.6, 1.3, { color: c[0] });
      else slab(g(1.5), 0.6, 2.4, 2.4, { color: c[0] });
    }
    checkpoint(g(1.5), 0.5);

    //--- 2: rampe si conuri in trepte ---
    ramp(0.4, 7, 1.8, 3, { color: c[1] });
    slab(0, 0, 3, 3, { color: c[1] });
    ramp(0, 7, 1.8, 3, { color: c[1] });
    for (let i = 0; i < 3; i++) cone(g(1.6), 0, 2.4, 1.4, { color: c[1] });
    checkpoint(g(1.6), 0.4);

    //--- 3: poduri de gheata ---
    for (let i = 0; i < 3; i++) slab(1.2, 0.3, 8, 2.6, { slippery: true });

    //--- 4: pietre care se prabusesc: nu sta pe ele ---
    const crumble = { delay: 0.7 - tier * 0.08, respawn: 3 };
    for (let i = 0; i < 6; i++) slab(g(1.2), 0, 2.2, 2.2, { color: c[3], crumble });
    checkpoint(g(1.3), 0.3);

    //--- 5: platforme care se misca ---
    for (let i = 0; i < 5; i++) {
      slab(g(1.8), 0.25, 2.6, 2.6, {
        color: c[2],
        move: { axis: alongPath(), distance: 1.2, period: 3.5 + (i % 2) },
      });
    }
    checkpoint(g(2.2), 0.2);

    //--- 6: lifturi: urci cu el si sari sus, cand ajunge la capat ---
    for (let i = 0; i < 3; i++) {
      slab(1.6, 2.4, 2.6, 2.6, { color: c[2], move: { axis: "y", distance: 2.4, period: 5 } });
      slab(1.6, 2.0, 2.6, 2.6, { color: c[4] });
    }
    checkpoint(1.6, 0.3);

    //--- 7: trambuline ---
    for (let i = 0; i < 3; i++) {
      slab(g(1.4), 0, 2.2, 2.2, { color: 0xff5ca8, bounce: 16 });
      slab(1.4, 3.6, 3, 3, { color: c[4] });
    }
    checkpoint(g(1.6), 0.3);

    //--- 8: discuri si bare care se rotesc ---
    pad(g(1.4), 0.2, 2.6, { color: c[5], spin: { speed: 0.8 + tier * 0.2 } });
    slab(g(0.8), 0.2, 7, 1.8, { color: c[5], spin: { speed: 0.5 + tier * 0.12 } });
    pad(g(0.8), 0.2, 2.6, { color: c[5], spin: { speed: -0.9 - tier * 0.2 } });
    slab(g(0.8), 0.2, 7, 1.8, { color: c[5], spin: { speed: -0.6 - tier * 0.12 } });
    checkpoint(g(0.8), 0.2);

    //--- 9: sfere si inele ---
    for (let i = 0; i < 5; i++) ball(g(1.6), 0.3, 1.6, { color: c[1] });
    ring(g(1.4), 0.3, 3, 0.75, { color: c[0] });
    ring(g(1.4), 0.3, 3, 0.75, { color: c[0] });
    checkpoint(g(1.4), 0.3);

    //NOU: --- 10: pericole; fiecare lasa loc de trecere ---
    slab(g(1.5), 0.2, 12, 6, { color: c[0] });
    hazard("spikes", -3, 1.5);
    hazard("spikes", 0, -1.5);
    hazard("spikes", 3, 1.5);
    slab(g(1.2), 0.2, 8, 5, { color: c[1] });
    hazard("laser", 0, 0, { length: 5, on: 1.3, off: 1.4 + tier * -0.1 });
    slab(g(1.2), 0.2, 8, 5, { color: c[2] });
    hazard("hammer", 0, 0, { speed: 1.5 + tier * 0.2 });
    slab(g(1.2), 0.2, 14, 4, { color: c[3] });
    hazard("ball", 0, 0, { distance: 5, speed: 1.4 + tier * 0.25 });
    slab(g(1.2), 0.2, 12, 5, { color: c[4] });
    for (let i = 0; i <= tier; i++) hazard("enemy", i * 1.5, i % 2 ? 1.2 : -1.2, { distance: 4, speed: 1.2 + i * 0.3 });
    checkpoint(g(1.4), 0.2);

    //NOU: --- 11: vant, trambulina orizontala, gravitatie mica, platforme care clipesc ---
    slab(g(1.5), 0.2, 12, 7, { color: c[5] });
    zones.push({ kind: "wind", ...at(0, 0), y: top, radius: 8, height: 9, dirX: Math.sin(angle), dirZ: Math.cos(angle), strength: 2.5 + tier * 0.4 });
    //NOU: placa e scurta si golul mic: te arunca ~8 unitati, chiar daca o atingi la capatul din spate
    slab(g(1.4), 0.2, 4, 3, { color: 0x35e0ff, boost: true });
    slab(2.5, 0, 18, 4, { color: c[0] });
    advance(0, 0, 0);
    const lowGravity = { kind: "lowgrav", ...at(16, 0), y: top - 3, radius: 24, height: 22 };
    zones.push(lowGravity);
    for (let i = 0; i < 4; i++) pad(3.4, 1, 1.6, { color: c[4] });
    for (let i = 0; i < 4; i++) slab(g(1.2), 0.2, 3, 3, { color: c[5], blink: { on: 2.3, off: 1.1, phase: i * 0.8 } });
    //NOU: Cos optional cu doi pereti fata in fata: sari din perete in perete dupa monede
    slab(g(1.4), 0.2, 8, 12, { color: c[1] });
    for (const out of [1.8, 5.0]) {
      const p = at(0, out);
      list.push({ type: "box", ...p, y: top + 5, yaw: angle, width: 4, height: 10, depth: 1, color: c[3], optional: true });
    }
    for (let i = 0; i < 5; i++) coins.push({ ...at(-1 + i * 0.5, 3.4), y: top + 3 + i * 2 });
    coins.push({ ...at(0, 1.8), y: top + 11.2 }, { ...at(0, 5), y: top + 11.2 });

    //NOU: Abilitatea de la sfarsitul nivelului se foloseste de la nivelul urmator
    if (tier === 1 || tier === 2) {
      for (let i = 0; i < 3; i++) slab(8 + tier * 0.5, 0, 3.5, 3.5, { color: c[2], needs: "double" });
    }
    if (tier === 3) {
      for (let i = 0; i < 3; i++) {
        const start = list.length;
        pad(g(1), 0, 2.4, { color: c[1] });
        pad(13, 0, 2.4, { color: c[5], needs: "grapple" });
        const a = list[start];
        const b = list[start + 1];
        grapplePoints.push({ x: (a.x + b.x) / 2, y: top + 9, z: (a.z + b.z) / 2 });
      }
    }
    checkpoint(g(1.4), 0.3);
    if (tier < 3) {
      pickups.push({ kind: ["doubleJump", "dash", "grapple"][tier], ...at(0, 0), y: top + 1.3 });
    }
    if (tier === 2) lavaStart = top; //lava porneste la ultimul nivel
  }

  //Finalul: o insula aurie, sus de tot
  ramp(0.5, 8, 2.2, 4, { color: 0xf2c14a });
  pad(0, 0, 7, { color: 0xf2c14a, roughness: 0.2, checkpoint: true, finish: true });
  pickups.push({ kind: "portal", ...at(0, 4), y: top + 1.4 });
  return { list, coins, hazards, zones, grapplePoints, pickups, lavaStart, routeLength: list.length };
}

//Adauga traseul in setul de platforme
//NOU: intoarce si datele nivelului pentru monede, pericole, zone (le leaga main.js)
export function createCourse(platforms) {
  const { list, ...level } = createSpiral();
  for (const { type, ...params } of [...COURSE, ...list]) {
    platforms.add(type, params);
  }
  return level;
}
