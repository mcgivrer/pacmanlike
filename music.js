/* ===========================================================================
 * PacmanLike — musique chiptune générée procéduralement
 *
 * Génère une boucle musicale aléatoire respectant des règles d'harmonie
 * simples, le tout via l'API Web Audio (oscillateurs carrés/triangle/sinusoïde)
 * sans aucun fichier audio externe.
 *
 * Règles musicales appliquées:
 *   - Gamme de La mineur naturel (aucune altération, sonorité "arcade"):
 *       A B C D E F G  (indices 0..6 de la gamme).
 *   - Progression d'accords en boucle sur 4 mesures (I - IV - V - I), chaque
 *     mesure = un accord. Accords (degrés de la gamme, triades):
 *       I  = Am  (A C E)
 *       IV = F   (F A C)
 *       V  = G   (G B D)   -> dominante; ramène au I.
 *     Cette progression est consonnante et circulaire (le V résout sur le I).
 *   - Basse: fondamentale de l'accord en notes longues (octave grave).
 *   - Mélodie: tirée parmi les notes de l'accord courant (notes "concordantes"),
 *     avec insertion occasionnelle d'une note de passage (ton voisin dans la
 *     gamme) pour du mouvement. Le rythme est un motif arcade 16 pas/temps
 *     avec des silences.
 *   - Tempo ~140 BPM, signature 4/4, boucle de 4 mesures (~6,86 s).
 *
 * Le générateur choisit un grain aléatoire (seed) pour produire une boucle
 * différente à chaque partie, tout en restant musicalement cohérent.
 * ========================================================================== */

// --- Théorie musicale (gamme de La mineur naturel) -------------------------
// Fréquences en Hz pour 3 octaves. On indexe par demi-ton absolu depuis A2.
const NOTE_A2 = 110; // La 2 = 110 Hz (référence grave)
const SEMITONE = 2 ** (1 / 12); // rapport d'un demi-ton

// Degrés de la gamme de La mineur naturel en demi-tons depuis la tonique (A).
const SCALE_DEGREES = [0, 2, 3, 5, 7, 8, 10]; // A B C D E F G

// Triades (en degrés de la gamme, 0-indexés) pour chaque accord de la progression.
const CHORDS = {
  I:  [0, 2, 4],   // A C E  (Am)
  IV: [3, 5, 0],   // F A C  (F)  -> degré 3=F, 5=A, 0=C (octave sup.)
  V:  [6, 1, 3],   // G B D  (G)  -> degré 6=G, 1=B, 3=D
};
const PROGRESSION = ['I', 'IV', 'V', 'I'];

// Fréquence d'un degré de la gamme dans une octave donnée (A=degré 0).
function degreeFreq(degreeInScale, octave) {
  const semis = SCALE_DEGREES[((degreeInScale % 7) + 7) % 7];
  const totalSemis = semis + 12 * octave;
  return NOTE_A2 * Math.pow(SEMITONE, totalSemis);
}

// --- Générateur pseudo-aléatoire à graine (LCG) ----------------------------
// Pour une boucle reproductible par grain mais différente par partie.
function makeRng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

const randInt = (rng, min, max) => min + Math.floor(rng() * (max - min + 1));

/** Génère la structure d'une boucle de 4 mesures (mélodie + basse). */
function generateLoop(seed) {
  const rng = makeRng(seed);
  const STEPS = 16;                // pas par mesure (16èmes)
  const melody = [];              // {step, measure, freq, dur}
  const bass = [];                 // {measure, freq}

  for (let m = 0; m < PROGRESSION.length; m++) {
    const chord = CHORDS[PROGRESSION[m]];
    // Basse: fondamentale (1er degré de l'accord), octave 0 (grave).
    bass.push({ measure: m, freq: degreeFreq(chord[0], 0) });

    // Mélodie: motif 16 pas, densité ~50%, notes d'accord + passages.
    let lastDeg = chord[0];
    for (let s = 0; s < STEPS; s++) {
      // Avant-premier temps + autres temps: plus de chance de jouer.
      const onBeat = (s % 4 === 0);
      const playProb = onBeat ? 0.85 : 0.45;
      if (rng() > playProb) continue;

      // 80% une note d'accord (concordance), 20% une note de passage voisine.
      let deg;
      if (rng() < 0.8) {
        // note d'accord, éventuellement à l'octave supérieure (mélodie aiguë)
        const idx = chord[randInt(rng, 0, chord.length - 1)];
        const oct = rng() < 0.6 ? 2 : 3;
        deg = { s: idx, o: oct };
      } else {
        // note de passage: ton voisin dans la gamme (mouvement conjoint)
        const dir = rng() < 0.5 ? -1 : 1;
        const neighbor = (((lastDeg + dir) % 7) + 7) % 7;
        deg = { s: neighbor, o: 2 };
      }
      lastDeg = deg.s;
      const freq = degreeFreq(deg.s, deg.o);
      // Durée: 1 pas le plus souvent, parfois 2 (note tenue sur couplet).
      const dur = (rng() < 0.2) ? 2 : 1;
      melody.push({ step: s, measure: m, freq, dur });
    }
  }
  return { melody, bass, stepsPerMeasure: STEPS };
}

// --- Lecteur Web Audio ------------------------------------------------------
/** Crée un lecteur de musique chiptune piloté par Web Audio. */
export function createMusic() {
  let ctx = null;
  let master = null;
  let loop = null;
  let timerId = null;
  let playing = false;
  let muted = false;
  let volume = 0.18;

  function ensureContext() {
    if (!ctx) {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      master = ctx.createGain();
      master.gain.value = muted ? 0 : volume;
      master.connect(ctx.destination);
    }
    if (ctx.state === 'suspended') ctx.resume();
  }

  // Oscillateur chiptune avec enveloppe ADSR courte (type d'onde carré).
  function blip(freq, start, dur, type = 'square', gainPeak = 0.5) {
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    const a = start;            // attack
    const d = start + 0.02;     // decay
    const rel = start + dur;   // release
    g.gain.setValueAtTime(0, a);
    g.gain.linearRampToValueAtTime(gainPeak, a + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, d);
    g.gain.setValueAtTime(0.0001, d);
    g.gain.linearRampToValueAtTime(gainPeak * 0.7, rel - 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, rel);
    osc.connect(g);
    g.connect(master);
    osc.start(a);
    osc.stop(rel + 0.05);
  }

  function scheduleLoop(startTime) {
    const BPM = 140;
    const stepDur = 60 / BPM / 4;   // durée d'un 16ème
    const measureDur = stepDur * loop.stepsPerMeasure;

    // Basse: une note longue par mesure (triangle, plus doux).
    for (const b of loop.bass) {
      const t = startTime + b.measure * measureDur;
      blip(b.freq, t, measureDur * 0.95, 'triangle', 0.6);
    }

    // Mélodie: notes courtes (carré, perçant, typique chiptune).
    for (const n of loop.melody) {
      const t = startTime + n.measure * measureDur + n.step * stepDur;
      blip(n.freq, t, n.dur * stepDur * 0.9, 'square', 0.4);
    }

    // Battement (hi-hat) léger sur chaque temps avec un court bruit — on
    // simule avec un osc aigu très court atténué pour rester simple.
    for (let m = 0; m < PROGRESSION.length; m++) {
      for (let beat = 0; beat < 4; beat++) {
        const t = startTime + m * measureDur + beat * (stepDur * 4);
        blip(1200, t, 0.02, 'square', 0.05);
      }
    }

    return startTime + PROGRESSION.length * measureDur;
  }

  function tick() {
    if (!playing) return;
    const now = ctx.currentTime;
    // Anticipe la prochaine boucle 0.1 s avant la fin de la courante.
    const loopEnd = scheduleLoop(loopStart);
    loopStart = loopEnd;
    timerId = setTimeout(tick, Math.max(0, (loopEnd - now - 0.1) * 1000));
  }

  let loopStart = 0;

  function start(seed) {
    ensureContext();
    if (playing) return;
    loop = generateLoop(seed ?? (Math.random() * 1e9) | 0);
    playing = true;
    loopStart = ctx.currentTime + 0.1;
    tick();
  }

  function stop() {
    playing = false;
    if (timerId) { clearTimeout(timerId); timerId = null; }
  }

  function setMuted(m) {
    muted = m;
    if (master) master.gain.value = m ? 0 : volume;
  }
  function isMuted() { return muted; }
  function setVolume(v) {
    volume = Math.max(0, Math.min(1, v));
    if (master) master.gain.value = muted ? 0 : volume;
  }
  function getVolume() { return volume; }

  return { start, stop, setMuted, isMuted, setVolume, getVolume, get playing() { return playing; } };
}
