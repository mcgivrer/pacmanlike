/* ===========================================================================
 * PacmanLike — gestion des entrées (clavier, tactile, gamepad)
 *
 * Détecte le device d'entrée actif et expose une API unifiée:
 *   - setDirection(name) : orienter le joueur (up/down/left/right)
 *   - pressAction()       : démarrer / pause / rejouer
 *
 * Le "device actif" est déterminé par la dernière source d'entrée utilisée,
 * avec priorité: gamepad connecté > tactile (pointeur coarse) > clavier.
 * Le tutoriel de démarrage s'adapte à ce device (cf. updateTutorial).
 * ========================================================================== */

export const InputDevice = { KEYBOARD: 'keyboard', TOUCH: 'touch', GAMEPAD: 'gamepad' };

export function createInput({ onDirection, onAction, onDeviceChange }) {
  // Device actif par défaut: tactile si pointeur coarse, sinon clavier.
  let activeDevice = (window.matchMedia && window.matchMedia('(pointer: coarse)').matches)
    ? InputDevice.TOUCH
    : InputDevice.KEYBOARD;

  let gamepadIndex = null;       // index du gamepad actuellement utilisé
  let prevButtons = [];          // état précédent des boutons (détection front montant)

  function setDevice(d) {
    if (d === activeDevice) return;
    activeDevice = d;
    if (onDeviceChange) onDeviceChange(d);
  }

  // --- API publique ---------------------------------------------------------
  function setDirection(name) { if (onDirection) onDirection(name); }
  function pressAction() { if (onAction) onAction(); }

  // --- Clavier (desktop) ----------------------------------------------------
  window.addEventListener('keydown', (e) => {
    switch (e.key) {
      case 'ArrowUp': case 'w': case 'W': case 'z': case 'Z':
        setDirection('up'); setDevice(InputDevice.KEYBOARD); e.preventDefault(); break;
      case 'ArrowDown': case 's': case 'S':
        setDirection('down'); setDevice(InputDevice.KEYBOARD); e.preventDefault(); break;
      case 'ArrowLeft': case 'a': case 'A': case 'q': case 'Q':
        setDirection('left'); setDevice(InputDevice.KEYBOARD); e.preventDefault(); break;
      case 'ArrowRight': case 'd': case 'D':
        setDirection('right'); setDevice(InputDevice.KEYBOARD); e.preventDefault(); break;
      case ' ': case 'Enter':
        pressAction(); setDevice(InputDevice.KEYBOARD); e.preventDefault(); break;
      case 'p': case 'P': case 'Escape':
        // Pause dédiée (n'entre pas dans la rotation action/pause).
        setDevice(InputDevice.KEYBOARD); e.preventDefault(); break;
      default: break;
    }
  });

  // --- Tactile (boutons du DOM, branchés par main.js) -----------------------
  // main.js appelle bindTouchButton() -> on expose des handlers.
  // Le tactile est marqué actif via setDevice(InputDevice.TOUCH).

  // --- Gamepad (Gamepad API) ------------------------------------------------
  // Détection de connexion/déconnexion.
  window.addEventListener('gamepadconnected', (e) => {
    if (gamepadIndex === null) {
      gamepadIndex = e.gamepad.index;
      setDevice(InputDevice.GAMEPAD);
    }
  });
  window.addEventListener('gamepaddisconnected', (e) => {
    if (e.gamepad.index === gamepadIndex) {
      gamepadIndex = null;
      // Retour au device par défaut (tactile ou clavier).
      setDevice((window.matchMedia && window.matchMedia('(pointer: coarse)').matches)
        ? InputDevice.TOUCH : InputDevice.KEYBOARD);
    }
  });

  /** À appeler chaque frame pour interroger le gamepad. */
  function pollGamepad() {
    if (gamepadIndex === null) {
      // Tentative de récupération (certains navigateurs ne lancent pas
      // l'événement gamepadconnected si déjà pressé au chargement).
      const pads = navigator.getGamepads ? navigator.getGamepads() : [];
      for (const p of pads) {
        if (p) { gamepadIndex = p.index; setDevice(InputDevice.GAMEPAD); break; }
      }
    }
    if (gamepadIndex === null) return;

    const pad = navigator.getGamepads ? navigator.getGamepads()[gamepadIndex] : null;
    if (!pad) return;

    // Mapping standard (Standard Gamepad layout):
    //   axes[0] / axes[1] : stick gauche X / Y
    //   boutons 12/13/14/15 : croix directionnelle (haut/bas/gauche/droite)
    //   bouton 0 (A) / 9 (Start) : action
    const DEAD = 0.4;

    // Stick analogique gauche
    const ax = pad.axes[0] || 0;
    const ay = pad.axes[1] || 0;
    if (Math.abs(ax) > Math.abs(ay)) {
      if (ax > DEAD) { setDirection('right'); setDevice(InputDevice.GAMEPAD); }
      else if (ax < -DEAD) { setDirection('left'); setDevice(InputDevice.GAMEPAD); }
    } else {
      if (ay > DEAD) { setDirection('down'); setDevice(InputDevice.GAMEPAD); }
      else if (ay < -DEAD) { setDirection('up'); setDevice(InputDevice.GAMEPAD); }
    }

    // Croix directionnelle (boutons 12..15)
    const btns = pad.buttons;
    if (btns[12] && btns[12].pressed) { setDirection('up'); setDevice(InputDevice.GAMEPAD); }
    if (btns[13] && btns[13].pressed) { setDirection('down'); setDevice(InputDevice.GAMEPAD); }
    if (btns[14] && btns[14].pressed) { setDirection('left'); setDevice(InputDevice.GAMEPAD); }
    if (btns[15] && btns[15].pressed) { setDirection('right'); setDevice(InputDevice.GAMEPAD); }

    // Action (A / Start) — front montant pour éviter la répétition.
    const curA = btns[0] && btns[0].pressed;
    const curStart = btns[9] && btns[9].pressed;
    const prevA = prevButtons[0] || false;
    const prevStart = prevButtons[9] || false;
    if ((curA && !prevA) || (curStart && !prevStart)) {
      pressAction();
      setDevice(InputDevice.GAMEPAD);
    }
    prevButtons[0] = !!curA;
    prevButtons[9] = !!curStart;
  }

  // --- Liaison des boutons tactiles du DOM ----------------------------------
  function bindTouchButton(selector, handler) {
    document.querySelectorAll(selector).forEach((btn) => {
      const start = (e) => { e.preventDefault(); handler(btn); setDevice(InputDevice.TOUCH); btn.classList.add('pressed'); };
      const end = (e) => { e.preventDefault(); btn.classList.remove('pressed'); };
      btn.addEventListener('touchstart', start, { passive: false });
      btn.addEventListener('touchend', end, { passive: false });
      btn.addEventListener('touchcancel', end, { passive: false });
      btn.addEventListener('mousedown', start);
      btn.addEventListener('mouseup', end);
      btn.addEventListener('mouseleave', end);
    });
  }

  return {
    get device() { return activeDevice; },
    pollGamepad,
    bindTouchButton,
    setDevice,
    setDirection,
    pressAction,
  };
}
