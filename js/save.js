//NOU: SALVAREA in localStorage (ramane in browser dupa ce inchizi pagina).
//try/catch pentru ca stocarea poate fi blocata (fereastra privata) sau plina;
//jocul trebuie sa mearga si fara ea.
const KEY = "platformer-save";

export function createSave() {
  const data = {
    coins: 0, //monedele adunate in total, cheltuite in magazin
    bestTime: null,
    owned: ["color-orange", "hat-none"],
    color: "color-orange",
    hat: "hat-none",
    sound: true,
    effects: true,
    firstPerson: false,
    custom: [], //platformele puse in modul de constructie
  };
  try {
    Object.assign(data, JSON.parse(localStorage.getItem(KEY)) ?? {});
  } catch {
    //salvare lipsa sau stricata: pornim cu valorile de mai sus
  }

  function write() {
    try {
      localStorage.setItem(KEY, JSON.stringify(data));
    } catch {
      //fara salvare; jocul continua
    }
  }

  return { data, write };
}
