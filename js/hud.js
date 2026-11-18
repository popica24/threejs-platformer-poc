import { WORLD_RADIUS } from "./config.js";

//NOU: INTERFATA: elemente HTML peste canvas (cronometru, monede, harta, meniuri).
//Pentru text e mult mai simplu decat sa-l desenam in 3D.
function element(tag, className, parent, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  if (parent) parent.appendChild(node);
  return node;
}

export function formatTime(seconds) {
  const minutes = Math.floor(seconds / 60);
  return `${minutes}:${(seconds - minutes * 60).toFixed(2).padStart(5, "0")}`;
}

const MAP_SIZE = 150;
const ABILITY_NAMES = { doubleJump: "Saritura dubla", dash: "Dash (Q)", grapple: "Agatare (E)" };

export function createHud(platformList) {
  const root = element("div", "hud", document.body);
  const stats = element("div", "stats", root);
  const timer = element("div", "timer", stats, "0:00.00");
  const coins = element("div", "coins", stats, "0");
  const bar = element("div", "progress", root);
  const fill = element("div", "fill", bar);
  const abilities = element("div", "abilities", root);
  const build = element("div", "build", root);
  const toastBox = element("div", "toast", root);
  const crosshair = element("div", "crosshair", root); //NOU: doar in persoana intai
  const map = element("canvas", "map", root);
  map.width = map.height = MAP_SIZE;
  const context = map.getContext("2d");
  const menu = element("div", "menu", document.body);
  const panel = element("div", "panel", menu);

  const toWorld = (value) => MAP_SIZE / 2 + (value / WORLD_RADIUS) * (MAP_SIZE / 2 - 4);
  //Fundalul hartii il desenam o data; la fiecare frame copiem doar imaginea gata facuta
  const base = document.createElement("canvas");
  base.width = base.height = MAP_SIZE;
  const baseContext = base.getContext("2d");
  baseContext.fillStyle = "#34405a";
  for (const platform of platformList) {
    baseContext.fillRect(toWorld(platform.params.x ?? 0) - 1, toWorld(platform.params.z ?? 0) - 1, 2.5, 2.5);
  }

  let toastTimer = 0;
  function toast(text) {
    toastBox.textContent = text;
    toastBox.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastBox.classList.remove("show"), 2400);
  }

  function drawMap(position) {
    context.clearRect(0, 0, MAP_SIZE, MAP_SIZE);
    context.drawImage(base, 0, 0);
    context.fillStyle = "#ff5c3a";
    context.beginPath();
    context.arc(toWorld(position.x), toWorld(position.z), 3.5, 0, Math.PI * 2);
    context.fill();
  }

  function setAbilities(state) {
    abilities.textContent = Object.keys(ABILITY_NAMES).filter((k) => state[k]).map((k) => ABILITY_NAMES[k]).join("  |  ");
  }

  //sections = lista de { title?, text?, buttons?: [{ label, action, active }] }
  function showMenu(title, sections) {
    panel.replaceChildren();
    element("h1", "", panel, title);
    for (const section of sections) {
      if (section.title) element("h2", "", panel, section.title);
      if (section.text) element("p", "", panel, section.text);
      if (section.buttons) {
        const row = element("div", "buttons", panel);
        for (const button of section.buttons) {
          const node = element("button", button.active ? "active" : "", row, button.label);
          node.addEventListener("click", button.action);
        }
      }
    }
    menu.classList.add("show");
    root.classList.add("dim");
  }

  function hideMenu() {
    menu.classList.remove("show");
    root.classList.remove("dim");
  }

  return {
    setTime: (value) => (timer.textContent = formatTime(value)),
    setCoins: (value, total) => (coins.textContent = `${value} / ${total}`),
    setProgress: (value) => (fill.style.width = `${Math.round(value * 100)}%`),
    setBuild: (text) => (build.textContent = text),
    setCrosshair: (value) => crosshair.classList.toggle("show", value),
    setAbilities,
    toast,
    drawMap,
    showMenu,
    hideMenu,
  };
}
