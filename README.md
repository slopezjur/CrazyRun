# CrazyRun - WebGPU Endless Runner

CrazyRun is a high-performance 3D endless runner web game built with TypeScript, Three.js (WebGPU renderer), and Vite. It features decoupled game logic, zero runtime memory allocation during gameplay, full mobile touch and swipe gesture support, and dual-language localization.

---

## Core Architecture & Systems

### 1. Engine & Simulation Loop
- **`Engine.ts`**: Orchestrates Three.js rendering, WebGPU initialization, stats monitoring, and the central animation loop.
- **Fixed Timestep Accumulator**: Physics and logic run deterministically at 60 Hz (`fixedUpdate`), completely decoupled from high-refresh monitor rendering loops (`update`).
- **Anchored Player & Scrolling World**: The player and camera are anchored on the Z-axis ($Z = 0$). The `ChunkManager` and `EntityManager` translate the environment towards the player ($+Z$) and recycle passing chunks to the horizon ($-Z$), eliminating floating-point precision loss over infinite distances.

### 2. Gameplay & Entity Management
- **`Player.ts`**: Manages 3-lane lateral positioning with dampened interpolation, jump/gravity physics, smooth slide scaling (`scale.y` lerp), dynamic floor grounding, forward posture tilt, and crash posture freezing.
- **`EntityManager.ts` & `EntityPool.ts`**: Generic object pooling for obstacles and collectible coins with zero garbage-collection overhead during runs.
- **`Obstacle.ts`**: Multi-tier obstacles with component-accurate collision bounding volumes:
  - **High Arch Barrier**: Overhead beam with an open clearance gap underneath — requires sliding.
  - **Low Hurdle**: Short barrier on the floor — requires jumping.
  - **Full Wall**: Solid full-height barrier — requires a lane change.
- **`CollisionManager.ts`**: Two-phase collision detection using a broad Z-proximity gate followed by narrow AABB intersection testing against abstract `IBoundingVolume` targets.

### 3. State, Presentation & Audio
- **`GameStateManager.ts`**: State machine controlling game phases (`MainMenu`, `Playing`, `Paused`, `GameOver`).
- **`ScoreTracker.ts`**: Speed-based score accumulation and bonus tracking decoupled from DOM rendering via the `IScoreStorage` interface (`BrowserStorage`).
- **`UIManager.ts`**: Manages modal transitions, responsive HUD displays, button blur focus handling, and real-time translation/audio updates.
- **`AudioManager.ts`**: Zero-latency procedural audio engine utilizing the browser's **Web Audio API** (`AudioContext` oscillators & gain envelopes) with zero external asset dependencies:
  - **Coin Pickup**: Two-tone arcade chime ($987\text{Hz} \rightarrow 1318\text{Hz}$, B5 to E6).
  - **Jump**: Upward pitch sweep ($150\text{Hz} \rightarrow 450\text{Hz}$).
  - **Slide**: Friction frequency drop ($240\text{Hz} \rightarrow 90\text{Hz}$).
  - **Crash**: Low impact bass crunch ($160\text{Hz} \rightarrow 30\text{Hz}$).
  - **Master Gain & Mute**: Global volume control with persistent `localStorage` saving.
- **`ResourceManager.ts`**: Recursive disposal of geometries, materials, and textures on shutdown, plus asynchronous `GLTFLoader` integration for 3D animated character meshes.

---

## Controls

### Desktop
| Action | Key Bindings |
| :--- | :--- |
| **Move Left / Right** | <kbd>A</kbd> / <kbd>D</kbd> or <kbd>←</kbd> / <kbd>→</kbd> |
| **Jump** | <kbd>W</kbd> or <kbd>↑</kbd> or <kbd>Space</kbd> |
| **Slide / Crouch** | <kbd>S</kbd> or <kbd>↓</kbd> *(Hold to slide continuously, press to refresh)* |
| **Pause / Resume** | <kbd>Esc</kbd> |

*A semi-transparent keycap HUD is displayed in the bottom-left corner on desktop screens.*

### Mobile & Touch Devices
- **Swipe Gestures**:
  - Swipe Left / Right $\rightarrow$ Change Lane
  - Swipe Up $\rightarrow$ Jump
  - Swipe Down $\rightarrow$ Slide
- **Virtual Thumb Controls**:
  - **Bottom-Left Cluster**: Left (`◀`) & Right (`▶`) lane buttons.
  - **Bottom-Right Cluster**: Jump (`▲`) & Slide (`▼`) action buttons.

---

## Localization (i18n)

The game includes built-in localization managed by `I18nService.ts`:
- Supported Languages: **English** (`en`) and **Español** (`es`).
- Features a `🌐 English` / `🌐 Español` toggle button on the start screen that cycles languages and updates all UI elements in real time.
- Selected language is automatically persisted to `localStorage`.

---

## Tech Stack

- **Engine:** [Three.js](https://threejs.org/) (`three/webgpu` module)
- **Language:** TypeScript
- **Bundler:** Vite (with `vite-plugin-top-level-await`)
- **Deployment:** GitHub Pages via GitHub Actions

---

## Setup & Development

### Prerequisites
- Node.js (v18+)
- WebGPU-compatible modern browser (Chrome 113+, Edge 113+, Safari 18+)

### Installation
```bash
npm install
```

### Local Development
```bash
npm run dev
```
Open `http://localhost:5173/` in your browser.

### Production Build
```bash
npm run build
```
Type-checks the project with `tsc` and compiles minified, chunk-split assets to `dist/`.

---

## Deployment to GitHub Pages

The repository includes an automated GitHub Actions workflow (`.github/workflows/deploy.yml`):
1. Push changes to the `main` branch.
2. In GitHub repository **Settings** > **Pages** > **Build and deployment**, set **Source** to **GitHub Actions**.
3. The workflow compiles the build and publishes the site automatically.
