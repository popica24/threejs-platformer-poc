//CONSTANTE: numerele folosite in mai multe locuri primesc un nume,
//ca sa le schimbam dintr-un singur loc si sa stim ce inseamna.
//Fisierul asta nu importa nimic din Three.js: sunt doar numere, pe care
//celelalte module le importa cu "import { ... } from './config.js'".

//NOU: lume luminoasa: ceata are culoarea cerului de la orizont (si a fundalului din CSS)
export const FOG_COLOR = 0xe6eff7;
export const ACCENT_COLOR = 0x6c63ff; //mov-ul nodului si al liniilor din grid
export const SKIN_COLOR = 0xff8a5c;

//NOU: podeaua e acum o "insula" in mijlocul golului (inainte avea raza 30 si
//acoperea toata lumea, deci nu aveai unde sa cazi). Traseul pluteste in jurul ei.
export const GROUND_RADIUS = 12; //raza insulei din centru; din ea derivam si grid-ul
//Limita lumii a ramas aceeasi (28): acum e un "perete invizibil" in aer, care te
//tine langa traseu. NOU: nu mai e legata de GROUND_RADIUS, pentru ca insula e mai mica.
//NOU: marita (era 28), ca sa incapa marea spirala din course.js
export const WORLD_RADIUS = 150;
//NOU: "cutia" umbrelor nu mai acopera toata lumea (umbrele ar fi prea pixelate):
//sta in jurul jucatorului si se muta odata cu el (vezi lights.js)
export const SHADOW_EXTENT = 45;
//NOU: sub inaltimea asta consideram ca ai cazut in gol si te readucem la ultimul checkpoint
export const KILL_Y = -10;
//NOU: daca ai urcat mult, nu mai astepti sa cazi pana jos: reapari cand esti cu atat sub checkpoint
export const KILL_DROP = 15;

//obiectele din centru trebuie sa fie o idee ridicate de la sol, la y = 3.5
export const CENTER_Y = 3.5;

export const HOVER_SCALE = 1.25; //cat de mare se face nodul cand e mouse-ul pe el
export const BODY_Y = 1.25; //inaltimea corpului caracterului (folosita si la "respiratie")

//NOU: FORMA CARACTERULUI PENTRU COLIZIUNI
//Pentru coliziuni caracterul e un cilindru vertical (mult mai simplu de calculat
//decat forma reala din capsule si cutii).
export const PLAYER_RADIUS = 0.32; //cat de gros e "corpul" cand loveste un perete (NOU: era 0.4; te agati mai greu de colturi)
//Talpa e mai ingusta decat corpul: daca stai pe marginea unei platforme si centrul
//iese cu mai mult de FOOT_RADIUS peste margine, cazi. Cu raza mare am "pluti" in aer.
//NOU: marita (era 0.25), ca platformele sa fie mai usor de nimerit: ramai pe ele
//chiar daca aterizezi putin pe langa margine.
export const FOOT_RADIUS = 0.45;
//NOU: pe suprafete curbate (sfera, tor, rampa) o talpa lata ne-ar face sa plutim
//deasupra formei, asa ca acolo folosim o raza mica
export const CURVED_FOOT_RADIUS = 0.3;
//NOU: capul e ingust, ca sa nu te lovesti de marginea unei platforme cand sari pe langa ea
export const HEAD_RADIUS = 0.2;
export const PLAYER_HEIGHT = 2.5; //de la talpi pana in crestetul capului
//Treptele mai mici de atat le urcam mergand (nu sunt considerate pereti).
//Tot asa urcam si rampele: la fiecare frame suprafata urca doar putin.
export const STEP_HEIGHT = 0.3;
//NOU: in aer iertam mai mult: daca talpile ajung putin sub marginea unei platforme,
//te urca pe ea in loc sa te loveasca de perete si sa cazi
export const AIR_STEP_HEIGHT = 0.6;
//Pe suprafete mai inclinate de atat nu putem sta (alunecam de pe sfera)
export const MAX_SLOPE_DEG = 45;

//NOU: SENZATIA DE PLATFORMER
export const COYOTE_TIME = 0.12; //inca poti sari putin dupa ce ai iesit de pe margine
export const JUMP_BUFFER = 0.13; //o apasare chiar inainte de aterizare tot conteaza
export const JUMP_CUT_GRAVITY = 2.4; //daca dai drumul la Spatiu la urcare, gravitatia creste => salt scurt
export const DOUBLE_JUMP_FORCE = 9.5;
export const DASH_SPEED = 22;
export const DASH_TIME = 0.16;
export const WALL_SLIDE_SPEED = 3;
export const WALL_JUMP_UP = 10;
export const WALL_JUMP_PUSH = 9;
export const CONTROL_LOCK_SMOOTHING = 1.5; //controlul e slab imediat dupa un impuls, ca sa nu-l anuleze
export const GRAPPLE_RANGE = 20;
export const BOOST_SPEED = 16;
export const LAVA_SPEED = 0.25; //cat de repede urca lava (unitati pe secunda)
export const LAVA_START_DROP = 14; //la ce distanta sub checkpoint reporneste

export const WALK_SPEED = 5;
export const RUN_SPEED = 9;
export const JUMP_FORCE = 10;
export const GRAVITY = 28;

//Cat de "repede" ajunge o valoare la tinta (mai mare = mai repede).
//Valorile de la knot sunt alese ca la 60 FPS sa arate exact ca inainte
//(cand foloseam 0.1 si 0.05 pe frame).
export const KNOT_SCALE_SMOOTHING = 6.3;
export const KNOT_COLOR_SMOOTHING = 3.1;
export const PARALLAX_SMOOTHING = 3.1;
export const VELOCITY_SMOOTHING = 10;
export const TURN_SMOOTHING = 13.4;
export const WALK_BLEND_SMOOTHING = 10.9;
export const CAMERA_SMOOTHING = 12; //NOU: cat de strans urmareste caracterul pe orizontala
export const CAMERA_VERTICAL_SMOOTHING = 7; //NOU: mai lent pe verticala, ca saltul sa nu zguduie imaginea
//NOU: camera persoana a treia (vezi camera.js)
export const CAMERA_DISTANCE = 6; //cat de departe in spatele caracterului
export const CAMERA_MIN_DISTANCE = 2.5; //NOU: cel mai aproape cu zoom (rotita mouse-ului)
export const CAMERA_MAX_DISTANCE = 16; //NOU: cel mai departe cu zoom
export const ZOOM_SENSITIVITY = 0.001; //NOU: cat de tare schimba zoom-ul un pixel de rotita
export const CAMERA_ZOOM_SMOOTHING = 10; //NOU: cat de repede ajunge la distanta dorita
export const CAMERA_HEIGHT = 1.7; //NOU: inaltimea punctului in jurul caruia se roteste camera (umerii)
export const CAMERA_SHOULDER = 0.45; //NOU: camera sta putin in dreapta, peste umar
export const CAMERA_DEFAULT_PITCH = 0.22; //NOU: unghiul de start, in radiani (putin de sus)
export const CAMERA_MIN_PITCH = -0.45; //NOU: cat de mult poti privi de jos in sus
export const CAMERA_MAX_PITCH = 1.25; //NOU: cat de mult poti privi de sus in jos
export const MOUSE_SENSITIVITY = 0.0025; //NOU: radiani pe pixel de miscare a mouse-ului
//NOU: dupa atatea secunde fara mouse, camera revine singura in spatele caracterului
export const CAMERA_RECENTER_DELAY = 1.5;
export const CAMERA_FOV = 60; //NOU: campul vizual normal
export const CAMERA_RUN_FOV = 68; //NOU: mai larg cand alergi, da senzatia de viteza
export const CAMERA_FOV_SMOOTHING = 5; //NOU
//NOU: PERSOANA INTAI (tasta V)
export const CAMERA_EYE_HEIGHT = 2.25; //inaltimea ochilor fata de talpi
export const CAMERA_FIRST_PERSON_FOV = 75; //din ochii caracterului, un camp mai larg arata mai natural
export const CAMERA_FIRST_PERSON_PITCH = 1.5; //aproape vertical, in sus si in jos
export const CAMERA_VIEW_SMOOTHING = 12; //cat de repede trece intre cele doua vederi
export const CAMERA_SWING_SMOOTHING = 2.5; //cat de repede ajunge in spatele lui
//NOU: pe gheata viteza se schimba MULT mai incet (aluneci si franezi greu)
export const SLIPPERY_SMOOTHING = 0.8;

//NOU: Math.min(..., 0.05) = daca ai stat pe alt tab si te intorci, delta ar fi
//foarte mare si caracterul ar "teleporta". Il limitam la 0.05 secunde.
export const MAX_DELTA = 0.05;
