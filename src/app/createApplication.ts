import * as THREE from 'three/webgpu';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import { KTX2Loader } from 'three/examples/jsm/loaders/KTX2Loader.js';
import { AssetManager } from '../core/AssetManager';
import { ButtonInput, KeyboardInput, SwipeInput } from '../core/BrowserInput';
import { Engine } from '../core/Engine';
import { GameState, GameStateManager } from '../core/GameStateManager';
import { I18nService } from '../core/I18nService';
import { InputAction, InputManager } from '../core/InputManager';
import { Lifetime } from '../core/Lifetime';
import { ResourceManager } from '../core/ResourceManager';
import { SimulationLoop } from '../core/SimulationLoop';
import { BrowserStorage, StoredValue, parseHighScore } from '../core/StorageService';
import { ViewportBinding } from '../core/ViewportBinding';
import { WebGPURenderDriver } from '../core/WebGPURenderDriver';
import { AudioManager } from '../game/AudioManager';
import { SOUNDS } from '../game/audio/sounds';
import { CameraManager } from '../game/CameraManager';
import { ChunkManager } from '../game/ChunkManager';
import { CollisionManager } from '../game/CollisionManager';
import { EntityManager } from '../game/EntityManager';
import { Collectible } from '../game/entities/Collectible';
import type { IManagedEntity } from '../game/entities/Entity';
import { EntityPool, type IEntityPool } from '../game/entities/EntityPool';
import { Hazard } from '../game/entities/Hazard';
import { GameController } from '../game/GameController';
import { GameScene } from '../game/GameScene';
import { configureEnvironment, createTrackChunks } from '../game/graphics/Environment';
import { createCoinVisual, createPowerVisual, HAZARD_DEFINITIONS } from '../game/graphics/EntityVisuals';
import { PlayerView } from '../game/graphics/PlayerView';
import { Player } from '../game/Player';
import { ScoreTracker } from '../game/ScoreTracker';
import { PatternSpawnPolicy } from '../game/PatternSpawnPolicy';
import { challengeFromUrl, dailyChallenge, endlessChallenge, ROW_SPACING } from '../game/Challenge';
import { PowerUpEffects, POWER_UP_DEFINITIONS } from '../game/PowerUps';
import { RunSession } from '../game/RunSession';
import { Progression } from '../game/Progression';
import { GhostReplay } from '../game/GhostReplay';
import { RunInteractions } from '../game/RunInteractions';
import { WorldEnvironment } from '../game/graphics/WorldEnvironment';
import { RunEffects } from '../game/graphics/RunEffects';
import { AdaptiveMusic } from '../game/audio/AdaptiveMusic';
import { RunUI } from '../ui/RunUI';
import { Diagnostics } from '../ui/Diagnostics';
import { LOCALES } from '../ui/translations';
import { UIManager } from '../ui/UIManager';
import { ProfileStorage } from '../game/storage/ProfileStorage';
import { GhostStorage } from '../game/storage/GhostStorage';
import { RunOutcomes } from '../game/RunOutcomes';
import { RunNotices } from '../ui/RunNotices';
import { RunCoordinator } from './RunCoordinator';
import { RunFeedback } from './RunFeedback';
import { BrowserGameEvents } from './BrowserGameEvents';
import { ChallengeSharing } from './ChallengeSharing';

export interface Application {
    start(): Promise<void>;
    dispose(): void;
}

export function createApplication(document: Document, viewport: Window): Application {
    const lifetime = new Lifetime();
    try {
        const canvas = document.getElementById('game-canvas') as HTMLCanvasElement | null;
        if (!canvas || canvas.tagName !== 'CANVAS') throw new Error('Game canvas not found.');
        const scene = new THREE.Scene();
        const camera = new THREE.PerspectiveCamera(75, 1, 0.1, 1000);
        scene.add(camera);
        const resources = new ResourceManager();
        lifetime.defer(() => {
            resources.dispose(scene);
            scene.clear();
        });
        const state = lifetime.use(new GameStateManager());
        const loop = lifetime.use(new SimulationLoop(() => state.currentState === GameState.Paused));
        const renderer = new THREE.WebGPURenderer({ canvas, antialias: true });
        renderer.shadowMap.enabled = true;
        renderer.shadowMap.type = THREE.PCFShadowMap;
        const url = new URL(viewport.location.href);
        const debug = url.searchParams.has('debug');
        const diagnostics = lifetime.use(new Diagnostics(document, state, loop, debug));
        const driver = new WebGPURenderDriver(renderer, scene, camera);
        const engine = lifetime.use(new Engine(driver, delta => loop.tick(delta), debug ? diagnostics : undefined));
        lifetime.use(new ViewportBinding(renderer, camera, viewport, canvas.parentElement ?? undefined));

        const storage = new BrowserStorage(() => viewport.localStorage);
        const newSeed = (): string => Array.from(viewport.crypto.getRandomValues(new Uint32Array(2)))
            .map(value => value.toString(36)).join('-');
        const linkedChallenge = challengeFromUrl(url);
        const run = lifetime.use(new RunSession(endlessChallenge(newSeed()), new PowerUpEffects(POWER_UP_DEFINITIONS)));
        const profile = lifetime.use(new Progression(new ProfileStorage(storage, viewport.matchMedia('(prefers-reduced-motion: reduce)').matches)));
        const replay = new GhostReplay(new GhostStorage(storage));
        const score = lifetime.use(new ScoreTracker(new StoredValue(storage, 'crazyrun_highscore', parseHighScore, String)));
        const localization = lifetime.use(new I18nService(
            new StoredValue(storage, 'crazyrun_lang', value => value, value => value ?? ''),
            viewport.navigator.language,
            LOCALES
        ));
        const context = new AudioContext();
        lifetime.defer(() => { void context.close().catch(() => {}); });
        const audio = lifetime.use(new AudioManager(
            context, new StoredValue(storage, 'crazyrun_muted', value => value === 'true', String), SOUNDS
        ));
        const music = new AdaptiveMusic(audio);
        const input = new InputManager();
        lifetime.defer(() => input.reset());
        configureEnvironment(scene);
        const track = createTrackChunks(scene, ROW_SPACING, 16);
        const chunks = lifetime.use(new ChunkManager(track));
        const world = new WorldEnvironment(scene, track[0].mesh.material as THREE.MeshStandardNodeMaterial);
        const effects = lifetime.use(new RunEffects(scene, resources));
        const view = lifetime.use(new PlayerView(resources));
        scene.add(view.mesh);
        const player = lifetime.use(new Player(input, view));
        const cameraManager = new CameraManager(camera, view.mesh);
        const applyAppearance = (): void => {
            view.setAppearance(profile.appearance);
            cameraManager.motionIntensity = profile.motion;
        };
        applyAppearance();
        lifetime.defer(profile.onChange(applyAppearance));
        const pools = new Map<string, IEntityPool<IManagedEntity>>();
        const hazards: Hazard[] = [];
        for (const definition of HAZARD_DEFINITIONS) {
            pools.set(definition.id, new EntityPool(32, () => {
                const { visual, behavior } = definition.create();
                const entity = new Hazard(visual, behavior,
                    hazard => outcomes.hit(hazard), (arch, near) => outcomes.clear(arch, near));
                hazards.push(entity);
                scene.add(entity.mesh);
                return entity;
            }));
        }
        const coins = new EntityPool(160, () => {
            const entity = new Collectible(createCoinVisual(), coin => outcomes.coin(coin), coin => outcomes.miss(coin));
            scene.add(entity.mesh);
            return entity;
        });
        pools.set('coin', coins);
        const animated = [...coins.getAll()];
        for (const power of POWER_UP_DEFINITIONS) {
            const pool = new EntityPool(8, () => {
                const entity = new Collectible(createPowerVisual(power.id), () => {
                    outcomes.power(power.id);
                });
                scene.add(entity.mesh);
                return entity;
            });
            pools.set(power.id, pool);
            animated.push(...pool.getAll());
        }
        const spawning = new PatternSpawnPolicy(() => ({ challenge: run.challenge, distance: run.stats.distance }));
        const entities = new EntityManager(pools, spawning, animated);
        const collisions = new CollisionManager(player, entities);
        const game = lifetime.use(new GameScene({
            state, player, chunks, entities, collisions, camera: cameraManager, score, audio, input, run,
            interactions: new RunInteractions(run, player, hazards, coins.getAll()), initialEmptyChunks: 1
        }));
        const outcomes: RunOutcomes = new RunOutcomes(run, game, score);
        const commands: GameController = new GameController(state, { reset: () => coordinator.reset() }, input, () => audio.unlock());
        const ui = lifetime.use(new UIManager(document, state, localization, audio, {
            play: () => coordinator.playFree(), restart: () => commands.restart(), resume: () => commands.resume()
        }));
        const getDailyChallenge = (): ReturnType<typeof dailyChallenge> => linkedChallenge ?? dailyChallenge();
        const sharing = new ChallengeSharing(() => viewport.location.href, async link => {
            await viewport.navigator.clipboard?.writeText(link);
        });
        const runUI = lifetime.use(new RunUI(document, state, localization, profile, run, {
            daily: () => coordinator.playDaily(), dailyChallenge: getDailyChallenge,
            menu: () => coordinator.menu(), pause: () => commands.togglePause(),
            share: challenge => sharing.share(challenge)
        }, new RunNotices(run)));
        const coordinator: RunCoordinator = lifetime.use(new RunCoordinator({
            game, commands, state, input, run, player, profile, replay, score, scoreUI: ui, runUI, music, world, effects,
            freeChallenge: () => endlessChallenge(newSeed()), dailyChallenge: getDailyChallenge
        }));
        const feedback = new RunFeedback(effects, () => profile.motion, audio, cameraManager);
        lifetime.defer(score.onScoreUpdated(value => ui.updateLiveScore(value)));
        lifetime.defer(run.onEvent(feedback.handle));
        lifetime.defer(loop.onFixedUpdate(coordinator.fixedUpdate));
        lifetime.defer(loop.onFrameUpdate(coordinator.update));
        lifetime.use(new BrowserGameEvents(document, viewport, state, () => commands.togglePause()));
        const keyboard = lifetime.use(new KeyboardInput(viewport, input, () => commands.togglePause()));
        const swipes = lifetime.use(new SwipeInput(canvas, input));
        const buttons = new Map<HTMLElement, InputAction>();
        for (const [id, action] of [
            ['btn-touch-left', InputAction.Left], ['btn-touch-right', InputAction.Right],
            ['btn-touch-jump', InputAction.Jump], ['btn-touch-slide', InputAction.Slide]
        ] as const) {
            const element = document.getElementById(id);
            if (element) buttons.set(element, action);
        }
        const touchButtons = lifetime.use(new ButtonInput(buttons, input));
        lifetime.defer(state.onStateChange(() => {
            keyboard.reset();
            swipes.reset();
            touchButtons.reset();
        }));

        // Draco and KTX2 decoders default to the copies bundled with Three.js, so they always match its version.
        const draco = lifetime.use(new DRACOLoader());
        const ktx = lifetime.use(new KTX2Loader());
        const loader = new GLTFLoader().setDRACOLoader(draco).setKTX2Loader(ktx);
        const assets = new AssetManager(loader, (url, error) => {
            console.warn('Failed to load model from ' + url + '; using the capsule.', error);
        });
        let started = false;
        return {
            async start(): Promise<void> {
                if (lifetime.isDisposed || started) return;
                started = true;
                await driver.initialize();
                if (lifetime.isDisposed) return;
                ktx.detectSupport(renderer);
                await engine.start();
                if (!lifetime.isDisposed) {
                    void view.loadCharacter(assets, import.meta.env.BASE_URL + 'models/character.glb')
                        .catch(error => console.warn('Failed to prepare character model:', error));
                }
            },
            dispose(): void { lifetime.dispose(); }
        };
    } catch (error) {
        lifetime.dispose();
        throw error;
    }
}
