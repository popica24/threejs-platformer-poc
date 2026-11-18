import * as THREE from "three";
import { MAX_DELTA } from "./config.js";
import { createCore } from "./core.js";
import { createWorld } from "./world.js";
import { createLights } from "./lights.js";
import { createPlayer } from "./player.js";
import { createInput } from "./input.js";
import { createCourse } from "./course.js";
import { createPlatformSet } from "./platforms.js";
import { createFollowCamera } from "./camera.js";
import { createSave } from "./save.js";
import { createAudio } from "./audio.js";
import { createEffects } from "./effects.js";
import { createZones } from "./zones.js";
import { createPickups } from "./pickups.js";
import { createHazards } from "./hazards.js";
import { createGhost } from "./ghost.js";
import { createCustomize } from "./customize.js";
import { createBuilder } from "./builder.js";
import { createHud, formatTime } from "./hud.js";

//PUNCTUL DE INTRARE: aici legam toate bucatile intre ele.
//Fiecare modul isi tine starea pentru el si ne da doar ce avem nevoie
//(obiecte si functii update), asa ca aici se vede clar cine pe cine foloseste.

const core = createCore();
const { scene, camera } = core;
const save = createSave();
const audio = createAudio(save.data.sound);
const effects = createEffects(scene);
const world = createWorld(scene);
const lights = createLights(scene);
//NOU: jucatorul anunta ce i se intampla; aici decidem sunetul, efectul si regulile
const player = createPlayer(scene, onPlayerEvent);
const input = createInput();

//NOU: toate platformele (inclusiv insula din centru) stau intr-un singur set.
//platforms.colliders e lista pe care o primeste jucatorul in fiecare frame;
//oricine adauga platforme (traseul, modul de constructie) trece
//prin platforms.add(), ca lista sa fie mereu completa.
const platforms = createPlatformSet(scene);
const level = createCourse(platforms);

const zones = createZones(scene, level.zones, level.grapplePoints);
const pickups = createPickups(scene, level.coins, level.pickups);
const hazards = createHazards(scene, level.hazards, level.lavaStart);
const ghost = createGhost(scene);
const customize = createCustomize(save, player);
const builder = createBuilder(scene, camera, platforms, save);
const hud = createHud(platforms.list);

core.setBloom(save.data.effects);
world.setMirror(save.data.effects);

//Camera urmareste caracterul de la o distanta fixa (sus si in spate).
//NOU: acum sta in spatele lui si se roteste odata cu el (vezi camera.js)
const followCamera = createFollowCamera(camera, player.group);

//NOU: vederea e pastrata in salvare; camera, corpul si tinta de pe ecran se schimba impreuna
function applyView() {
  followCamera.setFirstPerson(save.data.firstPerson);
  player.setFirstPerson(save.data.firstPerson);
  hud.setCrosshair(save.data.firstPerson);
}

function toggleView() {
  save.data.firstPerson = !save.data.firstPerson;
  save.write();
  applyView();
}
applyView();

//Clock ne da timpul real scurs, ca animatia sa fie la fel de rapida
//indiferent de cati FPS are calculatorul (60hz, 144hz, etc...)
const clock = new THREE.Clock();

//NOU: timpul total il adunam noi din delta-urile limitate, in loc sa folosim
//clock.getElapsedTime(). Altfel, dupa ce stai pe alt tab, caracterul (care
//foloseste delta) nu s-ar misca, dar lunile si nodul (care folosesc elapsed)
//ar "sari" brusc in alta pozitie. Asa, totul se opreste si porneste impreuna.
let elapsed = 0;

//NOU: STAREA JOCULUI: "menu" (start), "playing", "paused"
let state = "menu";
let runTime = 0;
let runCoins = 0;
let finished = false;
let sandbox = false; //turele cu platforme proprii nu conteaza la record
let bestRoute = 0;

const CONTROLS =
  "WASD = miscare  |  Mouse = camera  |  Rotita = zoom  |  Spatiu = saritura (tine pentru mai sus)  |  Shift = alergare  |  V = persoana intai  |  B = constructie  |  Esc = pauza";

function onPlayerEvent(name, value) {
  const p = player.group.position;
  if (name !== "land" || value > 6) audio.play(name);
  if (name === "land" && value > 6) effects.burst(p.x, p.y + 0.1, p.z, 0xd8dde8, 10, 2.5, 0.4);
  if (name === "jump" || name === "doublejump" || name === "walljump") effects.burst(p.x, p.y + 0.1, p.z, 0xffffff, 8, 2, 0.35);
  if (name === "dash" || name === "boost") effects.burst(p.x, p.y + 1, p.z, 0x35e0ff, 18, 4, 0.4);
  if (name === "checkpoint") {
    effects.burst(p.x, p.y + 1, p.z, 0x2aff7a, 30, 5);
    hud.toast("Checkpoint");
  }
  if (name === "death") effects.burst(p.x, p.y + 1, p.z, 0xff5c3a, 36, 6);
  if (name === "respawn") hazards.resetLava(player.getRespawnY());
  if (name === "finish") finishRun();
}

function finishRun() {
  if (finished) return;
  finished = true;
  const record = !sandbox && (save.data.bestTime === null || runTime < save.data.bestTime);
  if (record) {
    save.data.bestTime = runTime;
    save.write();
    ghost.saveBest();
  }
  const p = player.group.position;
  for (let i = 0; i < 6; i++) {
    effects.burst(p.x + (Math.random() - 0.5) * 10, p.y + 4 + Math.random() * 5, p.z + (Math.random() - 0.5) * 10, [0xffc83d, 0xff5ca8, 0x5cd6ff][i % 3], 60, 8, 1.4);
  }
  hud.toast(`${record ? "Record nou! " : "Traseu terminat: "}${formatTime(runTime)}. Intra in portal.`);
}

function newRun() {
  player.resetRun();
  pickups.reset();
  hazards.reset();
  ghost.startRun();
  runTime = 0;
  runCoins = 0;
  finished = false;
  bestRoute = 0;
  sandbox = builder.hasCustom();
  hud.setCoins(0, pickups.total);
  hud.setAbilities(player.abilities);
  hud.setProgress(0);
}

function play() {
  audio.start();
  audio.play("ui");
  hud.hideMenu();
  state = "playing";
  input.setLookEnabled(true);
  input.requestLock();
}

function pause() {
  if (state !== "playing") return;
  state = "paused";
  input.setLookEnabled(false);
  if (input.isLocked()) input.releaseLock(); //NOU: pauza cu P: cursorul trebuie eliberat si atunci
  showMainMenu();
}

function shopSection() {
  return customize.items.reduce(
    (sections, item) => {
      const owned = save.data.owned.includes(item.id);
      const equipped = save.data[item.group] === item.id;
      sections[item.group === "color" ? 0 : 1].buttons.push({
        label: owned ? item.name : `${item.name} (${item.price})`,
        active: equipped,
        action: () => {
          audio.start();
          if (!customize.choose(item.id)) hud.toast("Nu ai destule monede");
          showMainMenu();
        },
      });
      return sections;
    },
    [
      { title: `Magazin: ${save.data.coins} monede`, buttons: [] },
      { buttons: [] },
    ],
  );
}

function showMainMenu() {
  const paused = state === "paused";
  const best = save.data.bestTime === null ? "niciun record inca" : `record: ${formatTime(save.data.bestTime)}`;
  hud.showMenu(paused ? "Pauza" : "Spirala", [
    { text: `${CONTROLS}. Abilitatile se deblocheaza pe traseu. ${best}.` },
    {
      buttons: [
        { label: paused ? "Continua" : "Joaca", action: play },
        ...(paused ? [{ label: "Tura noua", action: () => { newRun(); play(); } }] : []),
      ],
    },
    ...shopSection(),
    {
      title: "Setari",
      buttons: [
        { label: `Camera: ${save.data.firstPerson ? "persoana intai" : "persoana a treia"}`, action: () => { toggleView(); showMainMenu(); } },
        { label: `Sunet: ${save.data.sound ? "pornit" : "oprit"}`, action: toggleSound },
        { label: `Efecte grafice: ${save.data.effects ? "pornite" : "oprite"}`, action: toggleEffects },
      ],
    },
    {
      title: "Nivelul tau (B in joc)",
      text: "1-6 forma | T comportament | R/F inaltime | Z/X rotire | Click pune | G sterge",
      buttons: [
        { label: "Copiaza nivelul", action: copyLevel },
        { label: "Incarca nivel", action: pasteLevel },
      ],
    },
  ]);
}

function toggleSound() {
  save.data.sound = !save.data.sound;
  save.write();
  audio.setMuted(!save.data.sound);
  showMainMenu();
}

function toggleEffects() {
  save.data.effects = !save.data.effects;
  save.write();
  core.setBloom(save.data.effects);
  world.setMirror(save.data.effects);
  showMainMenu();
}

function copyLevel() {
  navigator.clipboard?.writeText(builder.exportText()).then(() => hud.toast("Nivel copiat"));
}

function pasteLevel() {
  const text = window.prompt("Lipeste aici textul nivelului:");
  if (!text) return;
  try {
    hud.toast(builder.load(JSON.parse(text)) ? "Nivel incarcat" : "Nivel invalid");
  } catch {
    hud.toast("Nivel invalid");
  }
}

//Click = culoare aleatoare + puls pe nod; NOU: in modul de constructie, click pune o platforma
input.onClick(() => {
  if (state !== "playing" || !input.isLocked()) return;
  if (builder.isActive()) builder.place();
  else world.pulseKnot();
});
//NOU: Esc scoate cursorul din joc, iar browserul nu ne trimite tasta: pauza vine de aici
input.onLockChange((locked) => {
  if (!locked) pause();
});

const hazardContext = {
  position: player.group.position,
  velocityY: 0,
  respawnY: 0,
  onHit: () => player.kill(),
  onStomp(x, y, z) {
    player.stomp();
    audio.play("stomp");
    effects.burst(x, y, z, 0x8a3fe0, 24, 5);
  },
};

const pickupHandlers = {
  coin(x, y, z) {
    runCoins++;
    save.data.coins++;
    save.write();
    audio.play("coin");
    effects.burst(x, y, z, 0xffc83d, 10, 3, 0.4);
    hud.setCoins(runCoins, pickups.total);
  },
  ability(kind) {
    player.abilities[kind] = true;
    audio.play("ability");
    hud.setAbilities(player.abilities);
    hud.toast(`Abilitate noua: ${{ doubleJump: "saritura dubla", dash: "dash (Q)", grapple: "agatare (E)" }[kind]}`);
  },
  portal: newRun,
};

function updateGame(delta) {
  platforms.update(delta, elapsed, player.getStandingOn());
  //NOU: jucatorul primeste si unghiul camerei: W inseamna "dinspre camera inainte"
  player.update(delta, elapsed, input, platforms.colliders, followCamera.getYaw(), zones);

  const position = player.group.position;
  zones.update(delta);
  hazardContext.velocityY = player.getVelocityY();
  hazardContext.respawnY = player.getRespawnY();
  hazards.update(delta, elapsed, hazardContext);
  pickups.update(delta, elapsed, position, pickupHandlers);

  //NOU: modul de constructie
  if (input.consumePress("KeyB")) {
    hud.setBuild(builder.toggle() ? builder.label() : "");
    if (builder.isActive()) sandbox = true;
  }
  builder.update(input, position, followCamera.getYaw());
  if (builder.isActive()) hud.setBuild(builder.label());

  if (input.consumePress("KeyP")) pause();
  if (input.consumePress("KeyV")) toggleView(); //NOU

  if (!finished) {
    runTime += delta;
    ghost.update(delta, position, player.group.rotation.y);
    hud.setTime(runTime);
  }

  const route = player.getStandingOn()?.platform.params.route ?? 0;
  if (route > bestRoute) {
    bestRoute = route;
    hud.setProgress(bestRoute / level.routeLength);
  }
  hud.drawMap(position);
}

function animate() {
  const delta = Math.min(clock.getDelta(), MAX_DELTA); //secunde de la frame-ul anterior

  //NOU: in pauza si in meniu lumea sta pe loc: delta devine 0 pentru tot ce e joc
  const playing = state === "playing";
  if (playing) elapsed += delta;
  const step = playing ? delta : 0;

  //hover-ul se verifica INAINTE de update-uri, pe ce e acum pe ecran
  const hovered = input.isHovering(world.knot, camera);

  world.update(step, elapsed, input.mouse, hovered);
  //NOU: spre varful spiralei se face apus
  const dayTime = THREE.MathUtils.clamp(player.group.position.y / 170, 0, 1);
  core.setDayTime(dayTime);
  lights.update(elapsed, player.group.position, dayTime);

  //NOU: platformele se misca INAINTE de jucator (vezi updateGame), ca el sa fie carat
  //in acelasi frame (altfel ar ramane mereu cu un frame in urma platformei)
  if (playing) updateGame(delta);
  effects.update(step);
  audio.update();

  //camera urmareste caracterul (acest pas vine DUPA miscare)
  //NOU: primeste si miscarea mouse-ului, rotita (zoom) si platformele (ca sa nu treaca prin ele)
  followCamera.update(step, player.getVelocity(), input.consumeLook(), input.consumeZoom(), platforms.list);

  core.render();
}

newRun();
showMainMenu();

//setAnimationLoop = varianta recomandata de Three.js pentru requestAnimationFrame:
//cheama animate() inainte de fiecare frame (si merge si in VR, unde rAF nu merge)
core.renderer.setAnimationLoop(animate);

//Nota: nu facem dispose() pe geometriile / materialele decorului si nu scoatem
//event listener-ele, pentru ca scena traieste cat traieste pagina.
//NOU: exceptie: platformele sterse in timpul jocului (platforms.remove) se
//elibereaza, pentru ca acolo chiar cream si stergem obiecte in mod repetat.
