# CrazyRun - WebGPU Endless Runner

CrazyRun is a high-performance, 3D endless runner web game built entirely using standard web technologies and the experimental WebGPU renderer via Three.js. It features a robust architecture based on SOLID principles, completely decoupling game logic from the rendering loop.

## Architecture & Design

The project is structured with scalability and performance in mind:

### 1. SOLID Principles
- **Single Responsibility Principle (SRP):** Classes are focused on singular tasks. 
  - `Engine.ts` handles exclusively the Three.js WebGPU bootstrapping, animation loop, and fixed timestep timing.
  - `GameStateManager.ts` acts solely as a state machine tracking current flow.
  - `CameraManager.ts` cleanly isolates camera dampening, positioning, and FOV interpolation.
- **Dependency Inversion Principle (DIP) & Open/Closed Principle (OCP):** Higher-level systems rely on abstractions. 
  - `CameraManager` receives a generic `THREE.Object3D` target.
  - `EntityManager` utilizes a generic `EntityPool<T>` injected with a factory function (e.g. `() => new Obstacle()`), allowing infinite types of entities to be pooled without touching the core logic.
  - `CollisionManager` relies exclusively on `IBoundingVolume` and `ICollisionTarget` interfaces rather than concrete classes.
  - `MaterialFactory` exclusively handles the initialization and TSL injection of Node Materials.
  - `AnimationController` encapsulates all `THREE.AnimationMixer` logic and state, removing this burden from the `Player`.
  - **Presentation Layer Decoupling**: 
    - `ScoreTracker` purely manages scoring logic without touching the DOM, using a generic `IScoreStorage` interface for persistence.
    - `UIManager` handles all DOM manipulation and CSS transitions, completely separate from game state logic.
    - `AudioManager` exposes primitive control methods (e.g., `playBGM()`) and is orchestrated by `main.ts`, decoupling it entirely from the `GameStateManager`.

### 2. Performance & Memory Management
- **Explicit Memory Disposal:** `ResourceManager.ts` recursively traverses object hierarchies to proactively invoke `.dispose()` on WebGL primitives (geometries, materials, textures), preventing memory leaks during Vite HMR reloads or runtime state resets.
- **Asset Optimization:** `AssetManager.ts` initializes `DRACOLoader` for compressed 3D `.glb` meshes and `KTX2Loader` for highly-optimized GPU basis textures, paired with a `createLODWrapper` method for dynamic High/Low poly swapping at a distance.
- **Vite Chunking:** `vite.config.ts` forces Rollup's `manualChunks` to split the massive `three` library into a cached `vendor` chunk, ensuring ultra-fast loading for returning players.

The engine utilizes a **Fixed Time Step Accumulator** pattern combined with a **Scrolling World Paradigm**:
- **Physics/Logic (`fixedUpdate`)**: Runs precisely at 60 Updates Per Second (UPS), regardless of monitor refresh rates. 
- **Anchored Entities**: The Camera and Player are completely anchored on the Z-axis (Z=0). They never move forward in 3D space.
- **World Scrolling**: The `ChunkManager` constantly translates the world chunks towards the player (`+Z`). As chunks pass the camera, they are perfectly snapped back to the endless horizon (`-Z`). This completely eliminates WebGL floating-point precision loss over infinite runs, rendering the previous "World Shift" logic mathematically unreachable but structurally sound.
- **Rendering (`update`)**: The `WebGPURenderer.render()` call occurs completely isolated at the end of the frame, rendering the interpolated result of the logic.

### 3. State Machine & Input Management
- **State Machine**: Execution routing is governed by the `GameStateManager`. The `Engine.ts` inspects the active `GameState` and routes `fixedUpdate` logic exclusively to the functions relevant to that state.
- **Semantic Action Binding**: The `InputManager` complies with the Open/Closed Principle by mapping raw hardware inputs (e.g., `KeyW`, `Space`) to semantic `InputAction` enums (e.g., `Jump`). This abstracts hardware dependencies away from gameplay logic.

## Tech Stack
- **Engine:** [Three.js](https://threejs.org/) (specifically `three/webgpu` module).
- **Language:** TypeScript.
- **Bundler:** Vite (using `vite-plugin-top-level-await` for WebGPU adapter initialization).

## Controls
- **Escape:** Toggle Pause / Resume.
- *(Future Implementations)*: Movement (A/D/Left/Right), Jump (W/Up/Space), Slide (S/Down).

## Setup & Development

### Prerequisites
- Node.js installed.
- A WebGPU-compatible modern browser (Chrome 113+, Edge 113+).

### Installation
1. Clone the repository.
2. Install dependencies (bypassing strict SSL if necessary on local proxy environments):
   ```bash
   npm install --strict-ssl=false
   ```

### Running Locally
Start the Vite development server:
```bash
npm run dev
```
Navigate to the local address provided (typically `http://localhost:5173/`).

### Building for Production
```bash
npm run build
```
This leverages `tsc` for type-checking and `esbuild` for minified chunking.
