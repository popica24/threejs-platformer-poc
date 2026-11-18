//NOU: SUNETE GENERATE DIN COD (Web Audio), fara fisiere audio.
//Un oscilator = un ton simplu; schimbandu-i frecventa si volumul in timp obtinem efecte.
//Browserele pornesc sunetul doar dupa un gest al utilizatorului, de aceea exista start().

// [frecventa de start, frecventa de final, durata, forma undei, volum]
const SOUNDS = {
  jump: [320, 620, 0.13, "square", 0.08],
  doublejump: [520, 940, 0.15, "square", 0.08],
  walljump: [420, 760, 0.12, "sawtooth", 0.06],
  land: [180, 80, 0.09, "triangle", 0.16],
  bounce: [220, 980, 0.24, "sine", 0.16],
  boost: [300, 1400, 0.3, "sawtooth", 0.07],
  dash: [900, 200, 0.16, "sawtooth", 0.08],
  grapple: [1200, 500, 0.12, "triangle", 0.12],
  coin: [980, 1560, 0.1, "square", 0.06],
  checkpoint: [523, 1046, 0.32, "triangle", 0.16],
  death: [420, 70, 0.4, "sawtooth", 0.1],
  stomp: [260, 90, 0.14, "square", 0.12],
  ability: [392, 1568, 0.6, "triangle", 0.18],
  finish: [523, 2093, 0.9, "triangle", 0.2],
  ui: [660, 760, 0.06, "sine", 0.1],
};
const SCALE = [261.6, 293.7, 329.6, 392, 440, 523.3]; //scara pentatonica: orice note suna bine impreuna
const PATTERN = [0, 2, 4, 2, 5, 4, 2, 3, 0, 3, 4, 5, 4, 2, 1, 2];

export function createAudio(enabled) {
  let context = null;
  let master = null;
  let muted = !enabled;
  let step = 0;
  let nextNote = 0;

  function tone(from, to, duration, type, volume, when) {
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(from, when);
    oscillator.frequency.exponentialRampToValueAtTime(to, when + duration);
    gain.gain.setValueAtTime(volume, when);
    gain.gain.exponentialRampToValueAtTime(0.001, when + duration);
    oscillator.connect(gain).connect(master);
    oscillator.start(when);
    oscillator.stop(when + duration);
  }

  function start() {
    if (!context) {
      context = new AudioContext();
      master = context.createGain();
      master.gain.value = muted ? 0 : 1;
      master.connect(context.destination);
      nextNote = context.currentTime;
    }
    context.resume();
  }

  function play(name) {
    if (!context || muted || !SOUNDS[name]) return;
    const [from, to, duration, type, volume] = SOUNDS[name];
    tone(from, to, duration, type, volume, context.currentTime);
  }

  //Muzica: planificam notele putin inainte, ca sa nu depinda de sacadarile din frame-uri
  function update() {
    if (!context || muted || context.state !== "running") return;
    if (nextNote < context.currentTime) nextNote = context.currentTime;
    while (nextNote < context.currentTime + 0.25) {
      const note = SCALE[PATTERN[step % PATTERN.length]];
      tone(note, note, 0.2, "triangle", 0.035, nextNote);
      if (step % 4 === 0) tone(note / 2, note / 2, 0.5, "sine", 0.05, nextNote);
      step++;
      nextNote += 0.2;
    }
  }

  function setMuted(value) {
    muted = value;
    if (master) master.gain.value = muted ? 0 : 1;
  }

  return { start, play, update, setMuted };
}
