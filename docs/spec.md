# PacmanLike — Spécification de conception

> Petit jeu d'arcade 2D de type *Pac-Man* en HTML5 + JavaScript (Canvas), avec un rendu *pixel art*.
>
> Statut : **brouillon de conception**. Cible de mise en œuvre : navigateurs modernes (desktop), exécution 100 % côté client, sans dépendance externe ni serveur.

---

## 1. Objectif du jeu

Le joueur contrôle **Pakky**, un personnage qui se déplace dans un labyrinthe clos. Son but :

1. **Manger toutes les pastilles** (dots) du labyrinthe pour terminer le niveau.
2. **Éviter les fantômes** qui le traquent ; un contact coûte une vie.
3. **Manger les pastilles énergétiques** (power pellets) pour inverser temporairement le rapport de force : les fantômes deviennent vulnérables et peuvent être mangés pour des points bonus.
4. **Enchaîner les niveaux** : à chaque niveau, la vitesse des fantômes augmente légèrement et la durée d'effet des *power pellets* diminue.

Le score augmente avec :

| Action | Points |
|---|---|
| Pastille standard | 10 |
| Power pellet | 50 |
| Fantôme mangé (combo croissant 1→2→4→8) | 200 / 400 / 800 / 1600 |
| Bonus (fruit) | 100–500 selon le niveau |

### Condition de victoire et de défaite

- **Victoire de niveau** : toutes les pastilles (dots + power pellets) ont été consommées → passage au niveau suivant.
- **Défaite** : plus aucune vie restante (le joueur démarre avec **3 vies**).

---

## 2. Fonctionnement du jeu

### 2.1 Boucle de jeu (game loop)

Une boucle principale pilotée par `requestAnimationFrame`, à cible de **60 FPS**, avec un pas de temps fixe pour la logique afin de garantir un comportement déterministe et reproductible.

```
loop(t):
  accumuler le temps réel (deltaTime)
  tant que accumulateur >= STEP:
    update(STEP)   // logique: déplacement, IA, collisions
    accumulateur -= STEP
  render(interpolation)  // dessin sur canvas
```

Justification : un pas fixe découple la simulation du rendu et évite les divergences de comportement entre machines rapides et lentes. L'interpolation de rendu est optionnelle dans un premier temps.

### 2.2 Déplacement

- Déplacement **restreint à la grille** (mouvement uniquement horizontal/vertical, pas de diagonale).
- Le personnage se déplace en continu entre les cellules ; le joueur ne fait qu'**orienter** la direction souhaitée. Le changement de direction n'est appliqué que lorsqu'il est valide (cellule voisine non bloquée) — comportement fidèle à l'arcade d'origine.
- Vitesse exprimée en **cases par seconde**, traduite en pixels par pas de simulation.

### 2.3 Labyrinthe (maze)

- Grille de cellules carrées (ex. 28×31, hommage aux dimensions d'origine).
- Types de cellules : `vide`, `mur`, `dot`, `power pellet`, `porte de fantôme`, `tunnel`.
- **Tunnels** latéraux : sortie à gauche = entrée à droite (et inversement), sans délai, pour la continuité de mouvement.
- Le labyrinthe est défini dans un fichier de données textuel (un caractère par cellule) pour faciliter l'édition et l'ajout de niveaux.

### 2.4 Fantômes (IA)

Chaque fantôme possède une **personnalité** distincte, décrite par sa fonction de ciblage :

| Fantôme | Couleur | Comportement |
|---|---|---|
| **Blinky** | rouge | vise directement la position du joueur (poursuite directe). |
| **Pinky** | rose | vise quelques cases devant le joueur (embuscade). |
| **Inky** | cyan | cible calculée à partir de la position du joueur et de Blinky (comportement erratique). |
| **Clyde** | orange | poursuit le joueur à distance, mais fait demi-tour vers son coin s'il est trop proche (capricieux). |

Modes globaux alternés : **Scatter** (les fantômes regagnent leurs coins) et **Chase** (poursuite du joueur), basculant selon un minuteur commun. Pendant un *power pellet*, les fantômes passent en mode **Frightened** (bleus, ralentis, direction aléatoire aux intersections) et peuvent être mangés ; ils retournent alors à la **maison** (respawn) avant de reprendre.

Justification : ces comportements sont les patterns historiques éprouvés ; ils offrent une variété stratégique (poursuite, embuscade, imprévisibilité, caprice) sans nécessiter une IA complexe.

### 2.5 États du jeu (machine à états finie)

```
            ┌───────────┐
            │  BOOTING  │
            └─────┬─────┘
                  ▼
            ┌───────────┐  start  ┌───────────┐
            │   TITLE   │────────▶│  PLAYING  │
            └───────────┘         └─────┬─────┘
                  ▲                     │
                  │      pause          │ die / level complete
                  │      resume         ▼
            ┌───────────┐         ┌───────────┐
            │  PAUSED   │         │ GAME_OVER │
            └───────────┘         └───────────┘
```

États : `BOOTING` → `TITLE` → `PLAYING` ⇄ `PAUSED` ; `PLAYING` → `GAME_OVER` → `TITLE` (rejouer).

### 2.6 Contrôles

| Plateforme | Action | Entrée |
|---|---|---|
| Desktop | Déplacement | Flèches ou WASD (AZERTY: ZQSD) |
| Desktop | Pause | `P` ou `Échap` |
| Desktop | Démarrer / Rejouer | `Espace` / `Entrée` |
| Smartphone | Déplacement | D-pad tactile transparent (croix directionnelle) |
| Smartphone | Démarrer / Pause | Bouton tactile d'action (`⏯`) |

#### 2.6.1 Contrôles tactiles transparents (mobile)

Sur smartphone, une **croix directionnelle (D-pad)** et un **bouton d'action** sont superposés au jeu, en **transparence** (fond semi-transparent, ils ne masquent pas le terrain). Ils ne s'affichent **que** lorsque le média détecté correspond à un appareil tactile de type smartphone :

- **Paysage** : `pointer: coarse` + `orientation: landscape` + `max-width: 1024px`.
- **Portrait** : `pointer: coarse` + `orientation: portrait`.
- **Fallback petit écran tactile** : `pointer: coarse` + `max-width: 820px` (couvre tablettes compactes et cas limites).

Ces contrôles sont **masqués sur desktop** (`display: none` par défaut), afin de ne pas encombrer l'écran lorsque le clavier est disponible.

Justification :

- `pointer: coarse` distingue un périphérique tactile d'une souris (précision fine) ; l'orientation discrimine smartphone paysage vs desktop.
- La transparence préserve la lisibilité du jeu tout en restant utilisable.
- `touch-action: none` et `overscroll-behavior: none` empêchent les gestes parasites (scroll, zoom) pendant le jeu.
- Les boutons utilisent `touchstart`/`touchend` (avec fallback souris) pour une réactivité immédiate, sans délai de clic mobile.

---

## 3. Choix de design

### 3.1 Pixel art

- Résolution logique basse (ex. 224×248 px internes équivalents au cadre de jeu), affichée agrandie avec **`image-rendering: pixelated`** pour conserver des bords nets.
- Sprites à la résolution native (ex. 16×16 px par personnage), sans interpolation de lissage.
- Palette de couleurs limitée et cohérente (fonds noirs, murs bleus, pastilles jaunes) pour un rendu authentique « arcade ».

Justification : le pixel art est peu coûteux à produire, cohérent avec l'esthétique rétro demandée, et performant à l'affichage.

### 3.1.bis Rendu WebGL et post-traitement CRT

Le rendu passe par **WebGL1** : le jeu est dessiné sur un canvas 2D de basse résolution (source), puis échantillonné comme texture par un canvas WebGL d'affichage qui applique un **shader de fragment simulant un moniteur CRT**.

Effets du shader CRT (`shaders/crt.glsl.js`) :

- **Distorsion de barillet** (courbure d'écran) : les UV sont écartées vers le centre ; les bords hors-tube sont noirs.
- **Vignettage** des coins (assombrissement radial).
- **Lignes de balayage** (scanlines) : modulation sinusoïdale selon la résolution d'affichage.
- **Aberration chromatique** : séparation des canaux RGB sur les bords (effet de prisme du tube).
- **Scintillement** (flicker) basse fréquence (deux sinus incommensurables).
- **Glitches de balayage** : déclenchement sporadique d'une bande horizontale décalée latéralement (décalage `x` doux sur les bords de la bande), typique des perturbations de balayage CRT.

Justification :

- Un shader unique en une passe plein écran (quad) reste performant et sans dépendance (WebGL1 est supporté partout).
- La basse résolution de la source conserve l'esthétique pixel art ; le shader CRT ajoute l'illusion du tube sans alourdir la logique de jeu.
- Les glitches de balayage sont générés côté CPU (déclenchement aléatoire, durée courte) puis passés au shader via un uniform `vec3` (position de bande, amplitude de décalage, activation) : simple et déterministe par frame.
- Fallback : si WebGL est indisponible, le canvas 2D source reste visible (rendu sans effet CRT).

### 3.2 Sans dépendance externe

Aucune bibliothèque de jeu (Phaser, PixiJS…) ni framework. Le moteur est en **JavaScript vanilla** : rendu de jeu sur Canvas 2D, post-trichage d'affichage via **WebGL1** (shaders GLSL).

Justification :

- Portabilité maximale (un seul fichier HTML ouvrable depuis le disque ou un serveur statique).
- Pas de gestion de versions de dépendances, pas de build tooling.
- Surface d'apprentissage et de débogage réduite, adaptée à un projet rétro de petite envergure.
- Performances largement suffisantes pour un jeu de cette complexité sur Canvas 2D.

### 3.3 Ressources procédurales

Les sprites simples (dots, pastilles, personnages) peuvent être **générés par code** (dessin de formes sur canvas) plutôt que chargés depuis des images, afin de :

- supprimer toute dépendance à des assets binaires externes,
- garder le projet autonome et léger,
- faciliter la coloration dynamique (fantômes effrayés bleus, clignotement).

Un fichier d'assets graphiques (PNG) reste une option d'évolution si l'on souhaite un rendu plus détaillé.

### 3.4 Sons

Effets sonores simples (manger une pastille, manger un fantôme, perdre une vie) générés via l'**API Web Audio** (oscillateurs programmés), sans fichiers audio externes. Une bande-son optionnelle peut être ajoutée plus tard.

---

## 4. Architecture proposée

### 4.1 Vue d'ensemble

Une architecture en **modules séparés par responsabilité**, communiquant par des appels directs de méthodes (pas d'event bus global dans la V1 pour rester simple), avec une séparation nette entre **modèle** (état/logique), **vue** (rendu) et **contrôleur** (entrées + orchestration).

```
src/
├── main.js              // Point d'entrée: bootstrap, branche la game loop
├── core/
│   ├── Game.js          // Machine à états + orchestration de la boucle
│   ├── GameState.js     // Énumération des états (TITLE, PLAYING, ...)
│   ├── Timer.js         // accumulateur à pas fixe
│   └── input/
│       └── Input.js     // Capture clavier, expose l'état des touches
├── world/
│   ├── Maze.js          // Grille, parsing du niveau, requêtes (mur? dot? tunnel?)
│   ├── Cell.js          // Types de cellules
│   └── levels/          // Données de niveaux (format texte)
│       └── level-1.txt
├── entities/
│   ├── Entity.js        // Base: position, direction, vitesse, collisions grille
│   ├── Player.js        // Pakky: gestion direction voulue + input
│   └── Ghost.js         // Fantôme: IA (targeting) + modes (scatter/chase/frightened)
├── systems/
│   ├── CollisionSystem.js   // Entité/entité, entité/pastilles
│   ├── AISystem.js          // Décisions de direction des fantômes aux intersections
│   └── ScoreSystem.js       // Score, vies, multiplicateurs de combo
├── render/
│   ├── Renderer.js      // Boucle de rendu, interpolation
│   ├── SpriteFactory.js // Génération/cache de sprites procéduraux
│   └── HUD.js           // Score, vies, niveau affichés à l'écran
└── audio/
    └── AudioManager.js  // Oscillateurs Web Audio pour effets simples
```

### 4.2 Justifications d'architecture

**Modèle / Vue / Contrôleur (séparation des préoccupations)**
La logique de simulation (`world/`, `entities/`, `systems/`) ne dépend jamais du Canvas ni du DOM. Le rendu (`render/`) lit l'état du modèle et le dessine. Les entrées (`core/input/`) traduisent les événements en intentions de commande. Cela permet de tester la logique sans navigateur et de changer de cible de rendu (ex. export vidéo, headless) sans toucher au modèle.

**Pas fixe + accumulateur**
Garantit un comportement identique quelle que soit la fréquence d'affichage, évite les *tunnels* de collision liés à de grands pas de temps, et facilite la reproductibilité du débogage.

**Entités + systèmes (léger ECS)**
Séparer les données/comportements des entités des systèmes qui les traitent (collisions, IA, score) permet d'ajouter de nouvelles règles sans modifier chaque entité. On reste toutefois sur une approche pragmatique (pas d'ECS pur à tableaux de composants) pour ne pas surcharger un petit projet.

**Données de niveau découplées du code**
Les labyrinthes sont des fichiers texte éditables (`world/levels/*.txt`), parsés au chargement. On peut ajouter un niveau sans coder, et potentiellement les charger dynamiquement plus tard.

**State machine explicite pour le jeu**
Un état courant clair (`TITLE`, `PLAYING`, `PAUSED`, `GAME_OVER`) évite les flags booléens dispersés et rend les transitions auditable et testable.

**Sprites procéduraux + cache**
`SpriteFactory` dessine une fois chaque sprite dans un canvas hors-écran et le réutilise, évitant de redessiner des primitives à chaque frame tout en restant sans assets externes.

**Modules ES natifs (`import`/`export`)**
Utilisation des modules ECMAScript standard, servis via un simple serveur statique (`python -m http.server` ou équivalent) pour respecter les règles CORS des imports. Pas de bundler requis.

### 4.3 Flux d'exécution typique

1. `main.js` crée le `Game`, configure le `Canvas`, le `Input`, le `Maze` (parse `level-1.txt`), instancie `Player` et les 4 `Ghost`s.
2. `Game` entre en état `TITLE`.
3. Sur `Espace`, passage à `PLAYING` : la boucle commence à appeler `update(STEP)` puis `render()`.
4. `update` : `Input` fixe la direction voulue du joueur ; `Player` applique le mouvement ; `AISystem` décide les directions des fantômes ; `CollisionSystem` détecte les collisions (pastilles, fantômes) ; `ScoreSystem` met à jour le score.
5. `render` : `Renderer` dessine le labyrinthe, les entités et le `HUD`.
6. À la fin du niveau (plus de pastilles) → incrémentation du niveau, reparse avec paramètres de difficulté accrus.
7. À la perte de la dernière vie → `GAME_OVER` → `TITLE` (rejouer).

---

## 5. Données de niveau (format)

Un caractère par cellule :

| Caractère | Signification |
|---|---|
| `#` | Mur |
| `.` | Pastille (dot) |
| `o` | Power pellet |
| ` ` (espace) | Vide |
| `=` | Porte de la maison des fantômes |
| `P` | Position de départ du joueur |
| `B` `R` `I` `Y` | Positions de départ des fantômes (Blinky, Pinky, Inky, Clyde) |
| `T` | Cellule de tunnel (téléportation latérale) |

Exemple (extrait, non à l'échelle) :

```
############################
#............##............#
#o####.#####.##.#####.####o#
#..........................#
####.####.########.####.####
   #.####.########.####.#
   #.##..............##.#
   #.##.####====####.##.#
####.##.#B  R  I  Y#.##.####
      #.##########.#
      #............#
############################
```

---

## 6. Paramètres de difficulté (par niveau)

| Paramètre | Niveau 1 | Évolution |
|---|---|---|
| Vitesse joueur | 8 cases/s | constante |
| Vitesse fantôme | 6,5 cases/s | +0,3 / niveau (plafond) |
| Durée power pellet | 7 s | −1 s / niveau (min 2 s) |
| Durée frightened (fantôme) | liée au power pellet | identique |
| Vitesse fantôme frightened | 4 cases/s | constante |
| Cycle scatter/chase | 7 s / 20 s | converge vers chase |

---

## 7. Périmètre (V1) et évolutions futures

### V1 (première version jouable)
- Un niveau jouable de bout en bout.
- Joueur + 4 fantômes avec IA de ciblage.
- Dots, power pellets, collisions, score, vies.
- États `TITLE` / `PLAYING` / `PAUSED` / `GAME_OVER`.
- Rendu pixel art procédural + HUD.
- Sons générés (Web Audio).
- **Compatibilité mobile** : contrôles tactiles transparents (D-pad + action) affichés sur smartphone (paysage ou portrait), masqués sur desktop.

### Évolutions futures
- Niveaux multiples et progression de difficulté.
- Fruits bonus à apparition temporisée.
- Sauvegarde du meilleur score (`localStorage`).
- Chargement d'assets graphiques/sprites PNG optionnels.
- Musique de fond et variantes sonores.
- Mode multijoueur local (alterné ou simultané) — hors périmètre V1.

---

## 8. Critères d'acceptation (V1)

- [ ] Le jeu se lance dans un navigateur via un simple serveur statique.
- [ ] Le joueur se déplace aux quatre directions sans franchir les murs.
- [ ] Les 4 fantômes se déplacent avec des comportements distincts.
- [ ] Les pastilles et power pellets sont consommables et incrémentent le score.
- [ ] Le mode *frightened* rend les fantômes vulnérables et mangeables.
- [ ] La fin du niveau (toutes pastilles mangées) enchaîne vers le niveau suivant.
- [ ] La perte de toutes les vies mène à l'écran `GAME_OVER`.
- [ ] Le rendu est en pixel art net (pas de lissage).
- [ ] Sur smartphone (paysage ou portrait), un D-pad et un bouton d'action transparents s'affichent et sont utilisables.
- [ ] Sur desktop, les contrôles tactiles sont masqués et le clavier suffit à jouer.
- [ ] Aucune dépendance externe n'est requise.
