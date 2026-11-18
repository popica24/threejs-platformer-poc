import * as THREE from "three";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import { FOG_COLOR, CAMERA_FOV } from "./config.js";

//NOU: CERUL = o sfera uriasa vazuta din interior (BackSide), cu cate o culoare in
//fiecare varf: albastru sus, deschis la orizont. Geometria e aceeasi pentru cerul
//vizibil si pentru "harta de reflexii" de mai jos.
function createSkyGeometry(radius) {
  const geometry = new THREE.SphereGeometry(radius, 32, 24);
  const zenith = new THREE.Color(0x6fb1ea);
  const horizon = new THREE.Color(FOG_COLOR); //la orizont, obiectele se topesc in cer
  const nadir = new THREE.Color(0xc4d8ea);
  const color = new THREE.Color();
  const positions = geometry.attributes.position;
  const colors = new Float32Array(positions.count * 3);
  for (let i = 0; i < positions.count; i++) {
    const height = positions.getY(i) / radius; //intre -1 (jos) si 1 (sus)
    //pow < 1 face ca albastrul sa inceapa repede deasupra orizontului
    color.lerpColors(horizon, height > 0 ? zenith : nadir, Math.pow(Math.abs(height), 0.6));
    color.toArray(colors, i * 3);
  }
  geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  return geometry;
}

//NOU: REFLEXIILE. Materialele Standard pot "oglindi" o imagine a lumii de jur
//imprejur (environment map). O construim o singura data: o scena mica cu cerul, un
//soare foarte luminos si cateva forme colorate. PMREMGenerator o transforma intr-o
//textura unde suprafetele aspre vad imaginea neclara, iar cele lucioase, clara.
function createEnvironment(renderer) {
  const envScene = new THREE.Scene();
  //Raza sub 100 = in interiorul camerei folosite de PMREMGenerator (far = 100).
  //Griul din color "stinge" cerul, ca lumina lui sa nu arda culorile.
  envScene.add(
    new THREE.Mesh(
      createSkyGeometry(60),
      new THREE.MeshBasicMaterial({
        vertexColors: true,
        side: THREE.BackSide,
        color: 0x9a9a9a,
      }),
    ),
  );

  //Soarele: valori peste 1 sunt permise aici si dau pete de lumina pe obiecte lucioase
  const sun = new THREE.Mesh(
    new THREE.SphereGeometry(4, 16, 12),
    new THREE.MeshBasicMaterial({ color: new THREE.Color().setScalar(12) }),
  );
  sun.position.set(20, 40, 20);
  envScene.add(sun);

  //Forme colorate la orizont: fara ele, o suprafata lucioasa ar reflecta doar cer gol
  const palette = [0xff8a5c, 0x6c63ff, 0x5cb8a8, 0xffc857];
  for (let i = 0; i < 12; i++) {
    const angle = (i / 12) * Math.PI * 2;
    const height = 12 + (i % 3) * 8;
    const block = new THREE.Mesh(
      new THREE.BoxGeometry(9, height, 9),
      new THREE.MeshBasicMaterial({ color: palette[i % palette.length] }),
    );
    block.position.set(Math.cos(angle) * 45, height / 2 - 8, Math.sin(angle) * 45);
    envScene.add(block);
  }

  const pmrem = new THREE.PMREMGenerator(renderer);
  const texture = pmrem.fromScene(envScene, 0.02).texture;
  pmrem.dispose(); //generatorul nu mai trebuie; textura ramane
  return texture;
}

//CELE 3 INGREDIENTE DE BAZA: scene, camera, renderer.
//Le cream impreuna pentru ca depind unele de altele (camera si renderer-ul
//folosesc marimea ferestrei, iar la resize trebuie actualizate amandoua).
export function createCore() {
  //Scena = lumea in care punem obiecte, lumini, camera
  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(FOG_COLOR, 0.003); //ceata pentru adancime (NOU: mai rara, ca sa se vada formele din departare)
  //NOU: fundalul are aceeasi culoare ca ceata. Ceata "estompeaza" obiectele
  //departate spre culoarea ei; daca fundalul ar fi alta culoare (renderer-ul
  //sterge implicit cu negru), s-ar vedea o dunga la orizont, unde podeaua se
  //termina in ceata dar cerul e negru.
  scene.background = new THREE.Color(FOG_COLOR);

  //Camera = ochiul nostru. Parametrii : FOV (grade), aspect ratio, near, far
  const camera = new THREE.PerspectiveCamera(
    CAMERA_FOV,
    window.innerWidth / window.innerHeight,
    0.1,
    1200, //NOU: era 100; cerul si formele din fundal sunt mult mai departe
  );

  //Renderer = cel care deseneaza efectiv scena pe un <canvas>
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  //Limitam pixel ratio la 2: la densitate 3 am desena de 9 ori mai multi pixeli
  //decat la 1 (fata de 4 ori la densitate 2), cu o diferenta greu de observat
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

  //Activam umbrele. Au nevoie de 3 lucruri:
  //1) renderer-ul sa le calculeze (aici)
  //2) o lumina care le arunca (dirLight in lights.js)
  //3) obiectele sa fie marcate cu castShadow / receiveShadow
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  document.body.appendChild(renderer.domElement);

  //NOU: cerul vizibil. fog: false, altfel ceata l-ar acoperi complet.
  const skyMaterial = new THREE.MeshBasicMaterial({
    vertexColors: true,
    side: THREE.BackSide,
    fog: false,
  });
  scene.add(new THREE.Mesh(createSkyGeometry(1000), skyMaterial));

  //NOU: dayTime 0 = zi, 1 = apus. Culoarea materialului se inmulteste cu cea a varfurilor,
  //deci o nuanta portocalie schimba tot cerul fara sa recalculam degradeul.
  const dayFog = new THREE.Color(FOG_COLOR);
  const sunsetFog = new THREE.Color(0xf4b48c);
  const white = new THREE.Color(0xffffff);
  const sunsetSky = new THREE.Color(0xffb184);
  function setDayTime(dayTime) {
    skyMaterial.color.lerpColors(white, sunsetSky, dayTime);
    scene.fog.color.lerpColors(dayFog, sunsetFog, dayTime);
    scene.background.copy(scene.fog.color);
  }

  //NOU: BLOOM = lumina puternica "curge" peste marginea obiectelor. Desenam intr-o
  //textura cu valori peste 1 (HalfFloat), iar pragul 1.05 lasa sa straluceasca doar
  //ce e mai luminos decat albul: monede, portaluri, lasere. samples = antialias.
  const target = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: 4 });
  const composer = new EffectComposer(renderer, target);
  composer.addPass(new RenderPass(scene, camera));
  composer.addPass(new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 0.5, 0.5, 1.05));
  composer.addPass(new OutputPass()); //conversia finala de culoare pentru ecran
  function resizeComposer() {
    composer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    composer.setSize(window.innerWidth, window.innerHeight);
  }
  resizeComposer();
  let bloom = true;
  function render() {
    if (bloom) composer.render();
    else renderer.render(scene, camera);
  }
  //NOU: scene.environment se aplica automat tuturor materialelor Standard din scena
  scene.environment = createEnvironment(renderer);

  window.addEventListener("resize", () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix(); //obligatoriu dupa schimbarea aspectului
    renderer.setSize(window.innerWidth, window.innerHeight);
    //NOU: fereastra poate fi mutata pe un ecran cu alta densitate de pixeli
    //(ex: de pe un ecran Retina pe un monitor extern), asa ca o recitim
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    resizeComposer(); //NOU
  });

  return { scene, camera, renderer, render, setDayTime, setBloom: (value) => (bloom = value) };
}
