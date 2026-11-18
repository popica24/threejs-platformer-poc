import * as THREE from "three";

//INPUT: tastatura si mouse.
//createInput() intoarce:
// - keys: ce taste sunt apasate acum (ex: keys.KeyW === true)
// - consumePress(code): NOU: a fost apasata tasta de la ultima intrebare? (o singura data)
// - mouse: pozitia mouse-ului normalizata intre -1 si 1
// - isHovering(object, camera): e mouse-ul deasupra obiectului?
// - onClick(callback): ce se intampla la click
// - consumeLook(): NOU: cat s-a miscat mouse-ul de la ultima intrebare (pentru camera)
// - consumeZoom(): NOU: cat s-a invartit rotita de la ultima intrebare (pentru camera)
// - setLookEnabled, requestLock, isLocked, onLockChange: NOU: controlul asupra cursorului
//Restul (raycaster-ul, "e mouse-ul in fereastra?") ramane ascuns aici.
export function createInput() {
  const keys = {};
  //NOU: apasarile ca EVENIMENTE. "keys" spune doar ce e tinut apasat in momentul
  //in care ne uitam (o data pe frame). O apasare scurta, care incepe si se termina
  //intre doua frame-uri (de ex. 40 ms cand un frame dureaza 50 ms), n-ar aparea
  //niciodata in "keys". Aici o tinem minte pana cand cineva o "consuma".
  const pressed = new Set();

  //NOU: resetam toate tastele cand nu mai putem fi siguri ca primim "keyup"
  function resetKeys() {
    for (const code in keys) {
      keys[code] = false;
    }
    pressed.clear(); //NOU
  }

  window.addEventListener("keydown", (e) => {
    //Pe macOS, cat timp tii Cmd apasat, browserul NU trimite "keyup" pentru
    //celelalte taste. Daca am inregistra tastele aici, ar ramane blocate.
    if (e.metaKey) return;

    //e.code = tasta FIZICA (aceeasi pozitie indiferent de layout-ul tastaturii)
    keys[e.code] = true;
    //NOU: e.repeat = repetarea automata cand tii tasta apasata; nu e o apasare noua
    if (!e.repeat) pressed.add(e.code);

    //sagetile si spatiul ar derula pagina; le oprim comportamentul implicit
    if (e.code.startsWith("Arrow") || e.code === "Space") {
      e.preventDefault();
    }
  });

  window.addEventListener("keyup", (e) => {
    keys[e.code] = false;

    //NOU: cand se elibereaza Cmd, e posibil sa fi pierdut "keyup"-uri in timp
    //ce era tinut apasat (vezi mai sus), asa ca resetam totul
    if (e.code === "MetaLeft" || e.code === "MetaRight") resetKeys();
  });

  //NOU: daca fereastra pierde focusul (Alt+Tab), nu mai primim "keyup".
  //Fara asta, caracterul ar continua sa alerge singur. Resetam toate tastele.
  window.addEventListener("blur", resetKeys);
  //NOU: la fel cand se deschide meniul de click dreapta sau tab-ul e ascuns
  window.addEventListener("contextmenu", resetKeys);
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) resetKeys();
  });

  //Pozitia mouse-ului normalizata intre -1 si 1
  const mouse = new THREE.Vector2(0, 0);
  //NOU: tinem minte daca mouse-ul e in fereastra. La inceput nu stim unde e
  //(0, 0 ar fi centrul ecranului), iar cand iese ar ramane "agatat" pe nod.
  let pointerInside = false;

  //NOU: POINTER LOCK = browserul ascunde cursorul si ne da doar miscarea lui, fara
  //sa se opreasca la marginea ecranului, ca sa poti roti camera oricat. Se activeaza
  //la click si se opreste cu Esc.
  let locked = false;
  const look = { x: 0, y: 0 }; //miscarea adunata intre doua frame-uri
  const lookResult = { x: 0, y: 0 }; //refolosit, ca sa nu cream un obiect pe frame

  //NOU: in meniuri cursorul trebuie sa ramana liber, ca sa poti apasa butoanele
  let lookEnabled = false;
  let lockListener = () => {};

  //NOU: true cat timp asteptam raspunsul browserului. O a doua cerere in acelasi timp
  //(butonul si click-ul global vin din acelasi click) ar strica prima.
  let lockPending = false;

  function requestLock() {
    if (locked || !lookEnabled || lockPending) return;
    lockPending = true;
    //Dupa Esc, browserul refuza cateva momente; nu e o eroare de care sa ne pese.
    //?. pentru ca unele browsere nu intorc un Promise.
    document.body.requestPointerLock()?.catch?.(() => {
      lockPending = false;
    });
  }

  window.addEventListener("click", requestLock);

  document.addEventListener("pointerlockerror", () => {
    lockPending = false;
  });

  document.addEventListener("pointerlockchange", () => {
    lockPending = false;
    locked = document.pointerLockElement !== null;
    look.x = look.y = 0;
    //Cursorul e ascuns: hover-ul si parallax-ul folosesc centrul ecranului
    if (locked) mouse.set(0, 0);
    lockListener(locked);
  });

  window.addEventListener("mousemove", (e) => {
    if (locked) {
      //Unele browsere trimit rar un salt urias; il limitam ca sa nu se invarta camera
      look.x += THREE.MathUtils.clamp(e.movementX, -200, 200);
      look.y += THREE.MathUtils.clamp(e.movementY, -200, 200);
      return;
    }
    mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;
    pointerInside = true;
  });
  document.documentElement.addEventListener("mouseleave", () => {
    pointerInside = false;
  });

  //NOU: Raycaster = "o raza" trasa din camera prin pozitia mouse-ului.
  //Ne spune ce obiecte din scena sunt lovite de raza (hover)
  const raycaster = new THREE.Raycaster();
  //refolosim acelasi array in fiecare frame, in loc sa cream unul nou de 60 de ori pe secunda
  const hits = [];

  //Raza foloseste camera si obiectul asa cum au fost desenate in frame-ul trecut,
  //adica exact ce vede utilizatorul pe ecran cand misca mouse-ul.
  function isHovering(object, camera) {
    if (!pointerInside && !locked) return false; //NOU: cu pointer lock tintim centrul
    hits.length = 0;
    raycaster.setFromCamera(mouse, camera);
    return raycaster.intersectObject(object, false, hits).length > 0;
  }

  //NOU: true o singura data pentru fiecare apasare (apoi o stergem)
  function consumePress(code) {
    const wasPressed = pressed.has(code);
    pressed.delete(code);
    return wasPressed;
  }

  //NOU: ZOOM cu rotita. Adunam tot ce vine intre doua frame-uri, ca la mouse.
  //passive: false ne lasa sa folosim preventDefault (altfel browserul ar putea face
  //el zoom pe pagina, de exemplu la gestul cu doua degete de pe trackpad).
  let zoom = 0;
  window.addEventListener(
    "wheel",
    (e) => {
      e.preventDefault();
      //deltaMode 1 = valoarea e in "linii" (unele mouse-uri), nu in pixeli
      zoom += e.deltaMode === 1 ? e.deltaY * 16 : e.deltaY;
    },
    { passive: false },
  );

  //NOU: intoarce cat s-a invartit rotita si sterge valoarea
  function consumeZoom() {
    const value = zoom;
    zoom = 0;
    return value;
  }

  //NOU: intoarce miscarea adunata si o sterge, ca sa nu fie folosita de doua ori
  function consumeLook() {
    lookResult.x = look.x;
    lookResult.y = look.y;
    look.x = look.y = 0;
    return lookResult;
  }

  function onClick(callback) {
    window.addEventListener("click", callback);
  }

  return {
    keys, mouse, isHovering, onClick, consumePress, consumeLook, consumeZoom,
    requestLock,
    releaseLock: () => document.exitPointerLock(),
    setLookEnabled: (value) => (lookEnabled = value),
    isLocked: () => locked,
    onLockChange: (callback) => (lockListener = callback),
  };
}
