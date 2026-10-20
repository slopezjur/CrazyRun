# CrazyRun - WebGPU Endless Runner

CrazyRun is a 3D endless runner built with TypeScript, Three.js, and Vite. It includes three lanes, jumping and sliding, pooled obstacles and coins, keyboard and touch controls, procedural audio, and English/Spanish localization.

## Gameplay

- **Authored course patterns:** jump/slide sequences and slaloms, with a short safe coin chain and a richer action route. Rows are 80 units apart. Pattern validation reserves an unobstructed lane and at least one second between rows at the 80-unit speed cap. Moving barriers stay inside their reserved lane envelope.
- **Combos and Crazy Mode:** clean obstacle clears, near misses, and complete coin chains increase the combo. Every five skill actions raise the multiplier, up to ×5. Charge reaches 100 to trigger seven seconds of Crazy Mode: collision protection, coin attraction, a capped speed boost, and a further ×3 multiplier. Seven seconds without a skill action expires the combo; collecting coins maintains a short grace period.
- **Power-ups:** magnets attract coins for ten seconds, shields absorb one collision with 1.5 seconds of recovery protection, and slow motion scales world movement and player physics to 55% for five seconds. Power-up timers use active simulation time and freeze while paused.
- **Biomes:** neon streets, industrial tunnels, and skyline rooftops rotate every 960 units. Moving barriers, lifting gates, and collapsing gap tiles give each biome a different obstacle family.
- **Spectacle sections:** an advance warning precedes a convoy, tunnel lockdown, or rooftop collapse section. These retain a clear lane. The hovering machine, hazard animations, and warning banner make the section visible before arrival.
- **Progression:** completed runs bank collected coins and one-time mission rewards. The locker offers three procedural character silhouettes, three outfit colors, and three trail options. Cosmetics do not change physics. Abandoning a run discards its unbanked rewards.
- **Daily challenges:** every UTC date selects a shared seed and one modifier: double coin points, faster Crazy charge, or a faster starting speed. Challenge links preserve the date and course version. The menu's Play action creates a fresh free-run seed; Try Again repeats the previous course.
- **Personal ghosts:** race the best recorded score for the same course. Pose recordings are local, non-colliding visual playback. The three most recently saved course ghosts are retained, with at most 6,000 samples per recording; long runs progressively reduce sampling density. Course scores retain up to 32 entries.
- **Feedback:** particles, cosmetic trails, escalating coin tones, adaptive procedural music, distance milestones, power-up indicators, and a results breakdown of coins, distance, best combo, near misses, chains, and Crazy activations.

The settings panel controls motion/effect intensity and ghost visibility. A new profile respects the system's reduced-motion preference. Zero intensity disables optional particles, trails, camera shake, and speed-dependent FOV changes while retaining gameplay indicators. Losing window focus or hiding the page pauses a run. The HUD includes a pause button for touch devices.

Daily challenges and ghosts require no account or server. Sharing copies a URL when clipboard access is available and always exposes a selectable link. Shared challenges from an older date remain playable. Unsupported course versions are ignored. Increase `COURSE_VERSION` in `Challenge.ts` whenever a gameplay change invalidates course or replay compatibility.

## Architecture

### Application composition

[`createApplication.ts`](src/app/createApplication.ts) constructs and connects the game, browser adapters, and rendering services. Gameplay, UI, music, and effects consume narrow interfaces and read-only run views. The composition root constructs services; it does not implement rewards, collision outcomes, or frame orchestration. Vite resolves Three.js core imports to the WebGPU bundle so loaders and game objects share one runtime. [`main.ts`](src/main.ts) starts the application and registers Vite hot-reload cleanup.

[`Lifetime.ts`](src/core/Lifetime.ts) releases owned resources in reverse construction order, continues cleanup after individual failures, and prevents repeated disposal.

### State and simulation

- **`GameStateManager`** owns the current phase and publishes removable subscriptions. It has no DOM or diagnostics dependencies.
- **`GameController`** handles play, restart, pause, and resume. Escape only toggles an existing run.
- **`Engine`** coordinates frame timing, updates, and rendering through an injected render driver.
- **`SimulationLoop`** runs gameplay at 60 Hz and caps frame deltas at 100 ms. Pause freezes both fixed and frame updates while rendering continues.
- **`WebGPURenderDriver`** owns renderer initialization, frame submission, and renderer disposal through a narrow backend port. It has no DOM or viewport dependency.
- **`ViewportBinding`** owns container/window measurements, resize observation, pixel ratio, and camera aspect updates. Its resize targets and observation factory can be substituted independently.
- **`Diagnostics`** owns the stats panel and state/UPS overlay.

The player remains at Z = 0. The camera remains behind the player at a fixed Z offset. Track chunks and entities scroll toward positive Z and recycle toward the horizon. Track movement, difficulty, physics, hazard motion, scoring, and pickup animation use fixed updates. World movement is subdivided into steps of at most 0.45 units for collision traversal, preventing thin targets from being skipped at maximum speed. Camera easing, model animation, and decorative effects use frame updates.

**`RunSession`** owns active-run statistics, combos, charge, biome boundaries, and gameplay notifications. It receives an **`IRunPowerUps`** port for temporary effects and protection. Its public state is read-only; challenges change through an explicit command. Modifier definitions determine pace and rewards, and the simulation consumes the `IRunSimulation` port. **`Progression`** owns wallet, purchase, mission, preference, and course-record policies through a typed repository. **`GhostReplay`** coordinates separate recording and playback objects through typed storage. Course randomness is derived separately for each pattern and row; cosmetic randomness never advances the course generator.

**`RunCoordinator`** coordinates run start/retry/abandonment, reward settlement, replay capture, and frame updates through injected ports. **`RunOutcomes`** handles hazard hits, clear rewards, coins, and power-ups. **`RunFeedback`** maps run events to registered audio and camera feedback. Browser focus and challenge sharing use dedicated adapters.

**`PowerUpEffects`** owns activation, duration refresh, expiry, time scaling, and consumable protection. `POWER_UP_DEFINITIONS` supplies effect capabilities, durations, and display order; its ID order is also the default seeded pickup order. Spawning, pickup pools, notifications, and the HUD consume these definitions or active-effect metadata. Additional attraction, protection, or time-scale variants require a definition, visual registration, and translations rather than branches in `RunSession`, the spawner, or the HUD. Power-up events carry their registered ID explicitly.

### Player and presentation

**`Player`** owns lane movement, gravity, jump and slide rules, an asset-independent gameplay collider, and action notifications. It reads abstract input and sends poses and animation states through **`IPlayerPresentation`**. Character models and their animation bounds do not affect gameplay or daily challenge fairness.

**`PlayerView`** owns the Three.js representation, fallback capsule, character model preparation, material conversion and animation playback. **`AnimationController`** owns animation mixing and transitions. **`Environment`** constructs lighting and shared track visuals; **`CameraManager`** handles tracking, FOV, and crash shake.

**`WorldEnvironment`** presents the biome palette, pooled skyline, tunnel frames, and spectacle machine. **`RunEffects`** owns the bounded particle pool, shield indicator, cosmetic trail, and ghost mesh. Procedural robot and comet avatars remain available without external assets. Character factories, outfit colors, and trail colors are registered in `CosmeticVisuals.ts`; adding a variant does not require type branches in `PlayerView`.

Character models are optional. Place a model at `public/models/character.glb`; the loader uses Vite's configured base URL. Missing models retain the capsule. Animation names containing run, jump, slide, die, or fall map to gameplay states. The character view applies a 0.01 scale for models exported in centimeters.

### Entities and collision

- **`EntityPool`** preallocates entities and reuses inactive instances. It has no scene or rendering dependency.
- **`EntityManager`** manages registered pools, scrolling, active-target traversal, and reset.
- **`PatternSpawnPolicy`** is the application's course generator. It selects seeded authored sequences, looks up biome hazard and coin-path definitions, assigns coin-chain identities, and places power-ups after action rows. **`LaneSpawnPolicy`** remains available as a generic weighted spawn policy.
- **`OBSTACLE_DEFINITIONS`** supplies hurdle, arch, and wall visuals and collider components. The arch collides through its overhead beam, leaving clearance for sliding.
- **`CollisionManager`** performs Z-proximity and AABB checks and delegates the outcome to each target. A target returns whether traversal should continue; a crash stops the pass.
- **`Hazard`** owns lifecycle, collision delegation, and one-time clear/near-miss detection. `HAZARD_DEFINITIONS` supplies visuals, slide-clear rules, and optional sway, gate, or collapse motion strategies. Static hazards need no motion implementation. **`RunInteractions`** consumes simulation, observation, and attraction capabilities; each collectible owns its own position/bounds updates.
- **`Collectible`** explicitly despawns and invokes its configured reward callback. Non-solid objects are not implicitly treated as coins.
- Animation is a separate capability. Static obstacles require no empty animation method.

Adding an entity type requires a factory/pool registration and spawn configuration. Generic lifecycle and collision traversal do not require type branches. Additional animated entities are registered with the manager's animation collection.

Pooling reduces allocation pressure. Active collision traversal and lane shuffling reuse existing storage. The application does not guarantee zero allocation: browser events, audio voices, rendering internals, and asset loading can allocate.

### Input, localization, and storage

**`InputManager`** stores action state without browser dependencies. It tracks held inputs by opaque source ID so releasing one key or pointer does not cancel another source holding the same action. `HeldInputScope` gives each adapter ownership of its IDs, including when independent adapters use the same key or pointer number. Swipe gestures produce single-tick pulses.

**`KeyboardInput`**, **`SwipeInput`**, and **`ButtonInput`** translate browser events into actions and remove their listeners on disposal. Virtual buttons use pointer capture and release actions on cancellation or lost capture. Adapter reset, focus loss, and disposal release that adapter's holds. Full-run input resets remain an application responsibility.

**`I18nService`** receives locale definitions, browser language, and a typed storage port. Locale labels and translations live in [`translations.ts`](src/ui/translations.ts). **`UIManager`** receives state, localization, audio controls, and game commands; it does not construct them.

**`BrowserStorage`** isolates localStorage access and retains session settings when persistent storage is unavailable. **`StoredValue`** maps strings to typed values. Existing keys are preserved:

- `crazyrun_highscore`: highest integer score.
- `crazyrun_lang`: selected locale.
- `crazyrun_muted`: audio mute preference.
- `crazyrun_profile_v1`: wallet, owned/equipped cosmetics, mission progress, motion/ghost preferences, and course bests.
- `crazyrun_ghosts_v1`: up to three validated personal-best pose recordings.

**`ProfileStorage`** and **`GhostStorage`** own JSON encoding, save validation, and version-specific keys. `Progression` and `GhostReplay` receive typed storage ports and contain no serialization code. Existing v1 saves and challenge rules remain compatible. Saved ghost frames are snapshots, so further recording cannot mutate a saved personal best.

**`ScoreTracker`** accumulates distance and bonus points, publishes removable score subscriptions, and persists new records through a storage port.

**`RunUI`** presents missions, purchases, challenge selection and sharing, live run status, and results through profile/run interfaces. Power-up labels and remaining times come from active metadata and localization. `RunNotices` supplies notification priorities and expiry without DOM dependencies. Mission definitions in `ProgressionRules.ts` calculate both HUD previews and committed progress, including cumulative and maximum-value goals. Purchase eligibility and the Crazy Mode progress fraction also come from domain queries. Static and dynamic labels are localized in English and Spanish. Menus scroll on short displays and support keyboard focus; gameplay key bindings leave focused form controls alone. Diagnostics are hidden unless `?debug` is present in the URL.

### Audio and resources

**`AudioManager`** receives an AudioContext, mute preference, and sound definitions. It owns its gain nodes and active voices. Coin, jump, slide, and crash sounds are configured in [`sounds.ts`](src/game/audio/sounds.ts); adding a sound does not require editing the playback engine. The application owns and closes the AudioContext.

**`AdaptiveMusic`** schedules short procedural bass/melody voices from simulation ticks. Combo level, Crazy Mode, and spectacle sections control the arrangement and tempo. The existing mute control applies to both music and effects.

**`AssetManager`** loads GLTF models through an injected loader and reports failures. Draco and KTX2 decoders are configured at the application boundary.

**`ResourceManager`** disposes shared geometries, materials, direct material textures, skeletons, and lights once per application lifetime. Player presentation also disposes replaced fallback resources and models that arrive after shutdown.

## Controls

### Desktop

- Move left/right: **A/D** or **Left/Right arrows**.
- Jump: **W**, **Up arrow**, or **Space**.
- Slide: **S** or **Down arrow**. Hold to continue sliding.
- Pause/resume: **Escape** during an existing run.

### Mobile

Swipe left/right to change lanes, up to jump, or down to slide. The bottom-left buttons change lanes; the bottom-right buttons jump and slide. Hold the slide button to continue sliding.

Both thumb zones use labeled 56–72 CSS-pixel targets with 12-pixel gaps, inset from display cutouts and the system gesture area in portrait and landscape. Empty space between buttons passes gestures through to the canvas. A swipe triggers once when movement reaches 24 CSS pixels, without waiting for finger release. A finger that starts on a button can slide onto another button to change actions; moving outside the targets releases its hold. Pointer cancellation, loss of capture/focus, page hiding, and game phase changes clear touch tracking and held feedback. Multiple fingers retain independent holds, and native keyboard/assistive button activation produces a single action pulse.

The game uses the dynamic viewport height so mobile browser toolbars do not cover the controls. `ViewportBinding` follows the game container with a resize observer and leaves canvas CSS sizing intact. Menus allow pinch zoom; browser gestures are suppressed on gameplay surfaces only.

The main menu provides language and mute controls. Scores, locale, and mute settings persist when browser storage is available.

## Development

Use Node.js **22.20+** and npm. The deployment workflow uses Node.js 22. A modern browser with WebGPU support is recommended.

```bash
npm ci
npm run dev
```

Open the development URL printed by Vite, normally `http://localhost:5173/`.

### Tests and build

```bash
npm test
npm run typecheck
npm run build
npm run preview
```

Tests use Node's test runner with `tsx` to import TypeScript source. They cover state and loop boundaries, pause behavior, input pulses and held sources, collision outcomes, pool extensibility, scoring, storage, localization, UI subscriptions, audio disposal, model preparation, and resource ownership. Graphics tests use scene objects and renderer doubles without creating a GPU renderer.

`test/run-features.test.mjs` adds coverage for challenge links, course invariants, recycled row determinism, biome/event boundaries, chain rewards, power-up expiry, mission accounting, cosmetic persistence, ghost interpolation, pickup reuse, and long-hazard collision edges. Gameplay coverage also compares world progression across render rates. These checks are source tests; they do not replace a browser playthrough of WebGPU rendering and touch layout.

`test/solid-boundaries.test.mjs` covers substitutable service ports, custom mission/catalog rules, extensible hazard motion and course definitions, notification priorities, reward settlement, replay ownership, and browser lifecycle cleanup.

`test/power-ups.test.mjs` covers existing effect timing, refresh/reset behavior, custom definitions across service boundaries, substitutable effect ports, and localized HUD timers. Input tests cover independent adapter ownership; graphics tests verify viewport teardown separately from GPU initialization and disposal.

`npm run typecheck` checks application TypeScript without emitting files. `npm run build` type-checks and produces the Vite bundle in `dist/`.

## Deployment

The GitHub Actions workflow runs tests, builds, and publishes to GitHub Pages on pushes to `main` or manual dispatch. In repository **Settings > Pages**, select **GitHub Actions** as the deployment source. Vite's deployment base is `/CrazyRun/`.
