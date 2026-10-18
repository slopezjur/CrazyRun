import test from 'node:test';
import assert from 'node:assert/strict';
import { Box3, BoxGeometry, Mesh, MeshStandardMaterial, Vector3 } from 'three';
import { Signal } from '../src/core/Signal.ts';
import { GameState, GameStateManager } from '../src/core/GameStateManager.ts';
import { InputManager } from '../src/core/InputManager.ts';
import { Progression } from '../src/game/Progression.ts';
import { emptyProfile, PROGRESSION_RULES } from '../src/game/ProgressionRules.ts';
import { ProfileStorage } from '../src/game/storage/ProfileStorage.ts';
import { RunSession } from '../src/game/RunSession.ts';
import { RunInteractions } from '../src/game/RunInteractions.ts';
import { RunOutcomes } from '../src/game/RunOutcomes.ts';
import { Player } from '../src/game/Player.ts';
import { GameController } from '../src/game/GameController.ts';
import { GameScene } from '../src/game/GameScene.ts';
import { Hazard } from '../src/game/entities/Hazard.ts';
import { PatternSpawnPolicy, createPattern, BIOME_COURSES } from '../src/game/PatternSpawnPolicy.ts';
import { GhostReplay, GhostPlayback } from '../src/game/GhostReplay.ts';
import { dailyChallenge, endlessChallenge } from '../src/game/Challenge.ts';
import { RunCoordinator } from '../src/app/RunCoordinator.ts';
import { RunFeedback } from '../src/app/RunFeedback.ts';
import { BrowserGameEvents } from '../src/app/BrowserGameEvents.ts';
import { ChallengeSharing } from '../src/app/ChallengeSharing.ts';
import { RunNotices } from '../src/ui/RunNotices.ts';

const pose = { x: 0, y: 1, z: 0, scaleY: 1, tiltX: 0 };
const stats = coins => ({ coins, distance: 0, clears: 0, arches: 0, nearMisses: 0, chains: 0, longestCombo: 0, crazyModes: 0 });
function memory() {
    const values = new Map();
    return { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) };
}

test('custom mission rules drive the HUD preview and committed rewards through the same port', () => {
    const rules = {
        ...PROGRESSION_RULES,
        missions: [{ id: 'doubleCoins', goal: 20, reward: 7, progress: (previous, run) => previous + run.coins * 2 }]
    };
    let saved;
    const profile = new Progression({ load: () => emptyProfile(rules), save: value => { saved = value; } }, rules);
    profile.finish(stats(3), 10, 'v1:free:seed');
    assert.equal(profile.missionProgress('doubleCoins'), 6);
    assert.equal(profile.missionProgress('doubleCoins', stats(7)), 20);
    assert.equal(profile.missionProgress('doubleCoins'), 6);
    assert.deepEqual(profile.finish(stats(7), 20, 'v1:free:seed'), { earned: 14, missions: ['doubleCoins'] });
    assert.equal(saved.progress.doubleCoins, 20);
    assert.equal(profile.finish(stats(1), 21, 'v1:free:seed').earned, 1);
});

test('profile codecs and economy accept the same extended cosmetic catalog', () => {
    const rules = { ...PROGRESSION_RULES, cosmetics: [...PROGRESSION_RULES.cosmetics, { id: 'visitor', slot: 'character', cost: 5 }] };
    const storage = memory();
    const profile = new Progression(new ProfileStorage(storage, true, rules), rules);
    assert.equal(profile.motion, 0);
    assert.equal(profile.canEquip('visitor'), false);
    profile.finish(stats(10), 1, 'v1:free:seed');
    assert.equal(profile.canEquip('visitor'), true);
    assert.equal(profile.equip('visitor'), true);
    assert.equal(profile.canEquip('visitor'), true);
    const restored = new Progression(new ProfileStorage(storage, false, rules), rules);
    assert.equal(restored.wallet, 5);
    assert.equal(restored.appearance.character, 'visitor');
    assert.equal(restored.motion, 0);
});

test('player physics needs only presentation commands, never renderer bounds or position', () => {
    const player = new Player(new InputManager(), { setPose() {}, setAnimation() {}, update() {} });
    player.fixedUpdate(1 / 60, 30, true);
    assert.equal(player.z, 0);
    assert.equal(player.boundingBox.min.y, 0);
    assert.equal(player.boundingBox.max.y, 2);
});

test('game simulation can substitute run rules without challenge or session internals', () => {
    const state = new GameStateManager();
    state.changeState(GameState.Playing);
    const scored = [];
    const distances = [];
    const game = new GameScene({
        state,
        player: { onAction: () => () => {}, reset() {}, fixedUpdate() {}, update() {} },
        chunks: { onChunkRecycled: () => () => {}, forEachPosition() {}, updatePooling() {}, scroll() {}, reset() {} },
        entities: { spawnOnChunk() {}, scroll() {}, update() {}, reset() {} },
        collisions: { checkCollisions() {} },
        camera: { update() {}, reset() {}, triggerShake() {} },
        score: { reset() {}, addBonus() {}, update: (...args) => scored.push(args), finalizeScore() {} },
        audio: { play() {} }, input: { resetTriggers() {} },
        run: { speed: 47, timeScale: 1, multiplier: 2, combo: 0, advance: (_delta, distance) => distances.push(distance), reset() {} }
    });
    game.fixedUpdate(1 / 60);
    assert.equal(game.globalSpeed, 47);
    assert.deepEqual(scored, [[94, 1 / 60]]);
    assert.ok(Math.abs(distances[0] - 47 / 60) < 1e-12);
    game.dispose();
});

test('run interactions use hazard and attraction capabilities without touching meshes', () => {
    const calls = [];
    const box = new Box3();
    const hazard = { isActive: true, z: 0, simulate: time => calls.push(['simulate', time]), observe: (...args) => calls.push(['observe', ...args]) };
    const coin = { isActive: true, z: -10, attractTo: (...args) => calls.push(['attract', ...args]) };
    const far = { ...coin, z: -15, attractTo() { throw new Error('out of range'); } };
    const interactions = new RunInteractions({ elapsed: 5, magnetRemaining: 1, crazyRemaining: 0 },
        { currentPose: { ...pose, x: 1.5 }, boundingBox: box, isSliding: true }, [hazard], [coin, far]);
    interactions.prepare(0.1);
    interactions.observe();
    assert.deepEqual(calls, [['simulate', 5], ['attract', 1.5, 1, 1], ['observe', box, 1.5, true]]);
});

test('hazards accept new motion strategies and slide-clear rules without type branches', () => {
    const mesh = new Mesh(new BoxGeometry(1, 1, 1), new MeshStandardMaterial());
    const resets = [];
    const clears = [];
    const hazard = new Hazard({ mesh }, {
        slideClear: true,
        motion: {
            reset: (lane, phase) => resets.push([lane, phase]),
            update() { mesh.position.x = 0; }
        }
    }, () => 'stop', (...args) => clears.push(args));
    hazard.spawn(1.5, 1, 0, { phase: 0.3 });
    assert.deepEqual(resets, [[1.5, 0.3]]);
    assert.equal(hazard.boundingBox.min.x, -0.5);
    const player = new Box3(new Vector3(-0.4, 0, -0.4), new Vector3(0.4, 1, 0.4));
    hazard.observe(player, 0, true);
    hazard.scroll(2);
    hazard.observe(player, 0, true);
    hazard.observe(player, 0, true);
    assert.deepEqual(clears, [[true, false]]);
});

test('course biome and coin-path definitions can register new obstacle families', () => {
    const challenge = endlessChallenge('custom');
    const replacements = { hurdle: 'customJump', arch: 'customDuck', wall: 'customWall' };
    const biomes = { ...BIOME_COURSES, city: { actions: replacements, blocker: 'customBlocker', spectacleBlocker: 'customBoss' } };
    const paths = { customJump: () => 2, customDuck: () => 2, customWall: () => 2 };
    const entries = [];
    new PatternSpawnPolicy(() => ({ challenge, distance: 0 }), biomes, paths)
        .spawn(-80, (id, x, y, z, data) => entries.push({ id, x, y, z, data }));
    assert.equal(entries[0].id, replacements[createPattern('custom', 0)[1].action]);
    assert.equal(entries[1].id, 'customBlocker');
    const actionCoins = entries.filter(entry => entry.id === 'coin' && entry.data.chainId === 3);
    assert.equal(actionCoins.length, 5);
    assert.ok(actionCoins.every(entry => entry.y === 2));
});

test('collision rewards are independent of graphics and inactive runs cannot grant points', () => {
    const run = new RunSession(endlessChallenge('seed'));
    let playing = true;
    let crashes = 0;
    let despawns = 0;
    const coins = [];
    const bonuses = [];
    const outcomes = new RunOutcomes(run, {
        get isPlaying() { return playing; },
        crash() { crashes++; playing = false; },
        collect: points => coins.push(points)
    }, { addBonus: points => bonuses.push(points) });
    const hazard = { position: { x: 0, y: 1, z: 0 }, despawn() { despawns++; } };
    outcomes.power('shield');
    assert.equal(outcomes.hit(hazard), 'continue');
    assert.equal(despawns, 1);
    outcomes.coin({ position: { x: 0, y: 1, z: 0 }, spawnData: {} });
    assert.deepEqual(coins, [100]);
    run.advance(2, 60);
    assert.equal(outcomes.hit(hazard), 'stop');
    assert.equal(crashes, 1);
    outcomes.clear(false, true);
    outcomes.coin({ position: hazard.position, spawnData: {} });
    assert.deepEqual(bonuses, []);
    assert.equal(coins.length, 1);
});

test('ghost playback supports seeking backward and typed replay storage preserves the best score', () => {
    const record = { key: 'v1:free:seed', score: 300, frames: [
        [0, 0, 0, 1, 1, 0], [1, 30, 1, 1, 1, 0], [2, 60, 0, 1, 1, 0]
    ] };
    const playback = new GhostPlayback(record);
    const result = [0, 0, 0, 0, 0, 0];
    playback.sample(1.5, result);
    assert.equal(result[2], 0.5);
    playback.sample(0.25, result);
    assert.equal(result[2], 0.25);
    const writes = [];
    const replay = new GhostReplay({ load: () => [], save: records => writes.push(structuredClone(records)) });
    replay.start(record.key, pose);
    replay.finish(300, 2, 60, pose);
    replay.finish(100, 3, 90, pose);
    replay.start(record.key, pose);
    assert.equal(replay.best.score, 300);
    assert.equal(replay.best.frames.at(-1)[0], 2);
    assert.equal(writes.length, 1);
});

test('notification priorities and expiry are independent of DOM rendering', () => {
    const run = { elapsed: 0, biome: 'city', spectacle: 'none' };
    const notices = new RunNotices(run);
    assert.equal(notices.accept({ type: 'crazy' }), true);
    assert.equal(notices.accept({ type: 'chain' }), false);
    assert.equal(notices.accept({ type: 'shieldSaved' }), true);
    assert.equal(notices.accept({ type: 'chain' }), true);
    run.spectacle = 'warning';
    assert.equal(notices.accept({ type: 'shieldSaved' }), false);
    assert.equal(notices.accept({ type: 'warning' }), true);
    assert.equal(notices.current.key, 'warning_city');
    run.elapsed = 5;
    assert.equal(notices.current, null);
    notices.reset();
    assert.equal(notices.current, null);
});

test('event feedback supports registered sound and shake definitions', () => {
    const calls = [];
    const feedback = new RunFeedback(
        { event: (_event, motion) => calls.push(['effects', motion]) }, () => 0.5,
        { play: (...args) => calls.push(['audio', ...args]) },
        { triggerShake: strength => calls.push(['shake', strength]) },
        { combo: { sound: 'custom', pitch: 2, shake: 0.25 } }
    );
    feedback.handle({ type: 'combo' });
    assert.deepEqual(calls, [['effects', 0.5], ['audio', 'custom', 2], ['shake', 0.25]]);
});

test('run coordination preserves daily retries, settles once, and never banks abandonment', () => {
    const state = new GameStateManager();
    const ended = new Signal();
    const run = new RunSession(endlessChallenge('initial'));
    const log = [];
    const game = {
        get isPlaying() { return state.currentState === GameState.Playing; },
        globalSpeed: 30,
        reset() { run.reset(); },
        fixedUpdate(delta) { run.advance(delta, delta * 30); },
        update() {},
        onGameOver: listener => ended.subscribe(listener)
    };
    const input = { reset() {} };
    const commands = new GameController(state, { reset: () => coordinator.reset() }, input, () => {});
    const daily = dailyChallenge('2026-10-18');
    const coordinator = new RunCoordinator({
        game, commands, state, input, run, player: { currentPose: pose },
        profile: { appearance: { character: 'runner', outfit: 'lime', trail: 'none' }, motion: 0.5, ghostEnabled: true,
            finish() { log.push('bank'); return { earned: 1, missions: [] }; } },
        replay: { start: key => log.push(key), record() {}, finish() { log.push('record'); }, sample() { return false; } },
        score: { score: 300, highestScore: 500 },
        scoreUI: { updateFinalScores: (...args) => log.push(args) },
        runUI: { start() {}, showResults() { log.push('results'); }, update() {} },
        music: { reset() {}, update() {} }, world: { update() {} },
        effects: { ghostDistance: null, reset() {}, update() {} },
        freeChallenge: () => endlessChallenge('fresh'), dailyChallenge: () => daily
    });
    coordinator.playDaily();
    coordinator.fixedUpdate(0.1);
    assert.equal(run.challenge.key, daily.key);
    commands.restart();
    assert.equal(run.challenge.key, daily.key);
    ended.emit();
    ended.emit();
    assert.equal(log.filter(value => value === 'bank').length, 1);
    assert.equal(state.currentState, GameState.GameOver);
    assert.deepEqual(log.at(-1), [300, 500]);
    coordinator.playFree();
    assert.equal(run.challenge.seed, 'fresh');
    coordinator.menu();
    assert.equal(log.filter(value => value === 'bank').length, 1);
    coordinator.dispose();
    state.changeState(GameState.Playing);
    ended.emit();
    assert.equal(log.filter(value => value === 'bank').length, 1);
});

test('sharing exposes a usable challenge link when clipboard access fails', async () => {
    const sharing = new ChallengeSharing(() => 'https://example.com/CrazyRun/?debug', async () => { throw new Error('denied'); });
    const link = await sharing.share(dailyChallenge('2026-10-18'));
    assert.equal(new URL(link).searchParams.get('challenge'), '2026-10-18');
    assert.equal(await sharing.share(endlessChallenge('free')), '');
});

test('browser focus bindings pause only active runs and unsubscribe on disposal', () => {
    const state = new GameStateManager();
    const viewport = new EventTarget();
    const document = Object.assign(new EventTarget(), { hidden: false });
    let pauses = 0;
    const events = new BrowserGameEvents(document, viewport, state, () => pauses++);
    viewport.dispatchEvent(new Event('blur'));
    assert.equal(pauses, 0);
    state.changeState(GameState.Playing);
    document.hidden = true;
    document.dispatchEvent(new Event('visibilitychange'));
    assert.equal(pauses, 1);
    events.dispose();
    viewport.dispatchEvent(new Event('blur'));
    assert.equal(pauses, 1);
});
