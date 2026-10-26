import test from 'node:test';
import assert from 'node:assert/strict';
import { Box3 } from 'three';
import { GameState, GameStateManager } from '../src/core/GameStateManager.ts';
import { InputAction, InputManager } from '../src/core/InputManager.ts';
import { Signal } from '../src/core/Signal.ts';
import { GameController } from '../src/game/GameController.ts';
import { GameScene } from '../src/game/GameScene.ts';
import { Player } from '../src/game/Player.ts';
import { createRunSession } from './helpers/run-session.mjs';
import { endlessChallenge } from '../src/game/Challenge.ts';
import { SimulationLoop } from '../src/core/SimulationLoop.ts';

function presentation() {
    return {
        z: 0,
        boundingBox: new Box3(),
        pose: {},
        animation: '',
        frames: 0,
        setPose(pose) { this.pose = { ...pose }; },
        setAnimation(animation) { this.animation = animation; },
        update() { this.frames++; }
    };
}

function sceneFixture() {
    const state = new GameStateManager();
    const actions = new Signal();
    const recycled = new Signal();
    const calls = { fixed: [], frames: 0, scrolls: [], spawns: [], sounds: [], bonuses: [], finalized: 0, input: 0 };
    const run = createRunSession(endlessChallenge('fixture'));
    const player = {
        onAction: listener => actions.subscribe(listener),
        fixedUpdate: (...args) => calls.fixed.push(args),
        update() { calls.frames++; },
        reset() {}
    };
    const chunks = {
        onChunkRecycled: listener => recycled.subscribe(listener),
        forEachPosition(visitor) { for (let i = 0; i < 7; i++) visitor(-i * 11, i); },
        updatePooling() {},
        scroll(amount) { calls.scrolls.push(amount); },
        reset() {}
    };
    const game = new GameScene({
        state, player, chunks, run,
        entities: { spawnOnChunk: z => calls.spawns.push(z), scroll() {}, update() {}, reset() {}, forEachActive() {} },
        collisions: { checkCollisions() {} },
        camera: { update() {}, reset() {}, triggerShake() {} },
        score: {
            score: 0, highestScore: 0, reset() {}, update() {},
            addBonus: points => calls.bonuses.push(points),
            finalizeScore() { calls.finalized++; }
        },
        audio: { play: sound => calls.sounds.push(sound) },
        input: { resetTriggers() { calls.input++; } }
    });
    return { state, game, actions, recycled, calls, run };
}

test('player consumes abstract input, clamps lanes, and advances presentation each frame', () => {
    const input = new InputManager();
    const view = presentation();
    const player = new Player(input, view);
    for (let i = 0; i < 60; i++) {
        input.pulse(InputAction.Right);
        player.fixedUpdate(1 / 60, 30, true);
        input.resetTriggers();
    }
    assert.ok(view.pose.x > 1.4 && view.pose.x <= 1.5);
    player.update(0.1);
    assert.equal(view.frames, 1);
    player.reset();
    assert.equal(view.pose.x, 0);
    assert.equal(view.pose.y, 1);
});

test('jumping ignores additional airborne jumps and crash freezes the current pose', () => {
    const input = new InputManager();
    const view = presentation();
    const player = new Player(input, view);
    let jumps = 0;
    player.onAction(action => { if (action === 'jump') jumps++; });
    input.pulse(InputAction.Jump);
    player.fixedUpdate(1 / 60, 30, true);
    input.resetTriggers();
    assert.ok(view.pose.y > 1);
    input.pulse(InputAction.Jump);
    player.fixedUpdate(1 / 60, 30, true);
    input.resetTriggers();
    assert.equal(jumps, 1);
    const crashedPose = { ...view.pose };
    player.fixedUpdate(1, 0, true);
    assert.deepEqual(view.pose, crashedPose);
    assert.equal(view.animation, 'Die');
});

test('a swipe slide expires while a held slide remains active until release', () => {
    const input = new InputManager();
    const view = presentation();
    const player = new Player(input, view);
    const step = () => {
        player.fixedUpdate(1 / 60, 30, true);
        input.resetTriggers();
    };
    input.pulse(InputAction.Slide);
    for (let i = 0; i < 150; i++) step();
    assert.equal(view.animation, 'Run');
    player.reset();
    input.press('key', InputAction.Slide);
    for (let i = 0; i < 180; i++) step();
    assert.equal(view.animation, 'Slide');
    input.release('key');
    for (let i = 0; i < 150; i++) step();
    assert.equal(view.animation, 'Run');
});

test('menu preview does not consume gameplay commands', () => {
    const input = new InputManager();
    const view = presentation();
    const player = new Player(input, view);
    input.pulse(InputAction.Jump);
    player.fixedUpdate(1 / 60, 30, false);
    assert.equal(view.pose.y, 1);
    assert.equal(view.animation, 'Run');
});

test('game pause freezes world movement and player animations, then resumes normally', () => {
    const { game, state, calls } = sceneFixture();
    state.changeState(GameState.Playing);
    game.update(0.1);
    game.fixedUpdate(1 / 60);
    const scrollCount = calls.scrolls.length;
    const speed = game.globalSpeed;
    state.changeState(GameState.Paused);
    game.update(10);
    game.fixedUpdate(10);
    assert.equal(game.globalSpeed, speed);
    assert.equal(calls.frames, 1);
    assert.equal(calls.fixed.length, 1);
    assert.equal(calls.scrolls.length, scrollCount);
    state.changeState(GameState.Playing);
    game.update(0.1);
    assert.equal(calls.frames, 2);
});

test('reset uses actual chunk positions and subscriptions are released on disposal', () => {
    const { game, state, calls, actions, recycled } = sceneFixture();
    game.reset();
    assert.deepEqual(calls.spawns, [-55, -66]);
    state.changeState(GameState.Playing);
    actions.emit('jump');
    recycled.emit(-77);
    assert.deepEqual(calls.sounds, ['jump']);
    assert.deepEqual(calls.spawns, [-55, -66, -77]);
    game.dispose();
    actions.emit('slide');
    recycled.emit(-88);
    assert.equal(calls.sounds.length, 1);
    assert.equal(calls.spawns.length, 3);
});

test('crash finalizes once, prevents later rewards, and difficulty is capped', () => {
    const { game, state, calls } = sceneFixture();
    state.changeState(GameState.Playing);
    for (let tick = 0; tick < 60 * 55; tick++) game.fixedUpdate(1 / 60);
    assert.equal(game.globalSpeed, 80);
    game.collect(100);
    let crashes = 0;
    game.onGameOver(() => { crashes++; state.changeState(GameState.GameOver); });
    game.crash();
    game.crash();
    game.collect(100);
    assert.equal(crashes, 1);
    assert.equal(calls.finalized, 1);
    assert.deepEqual(calls.bonuses, [100]);
    assert.deepEqual(calls.sounds, ['coin', 'crash']);
});

test('course distance and difficulty depend on simulation ticks, not render frequency', () => {
    const simulate = fps => {
        const { game, state, run, calls } = sceneFixture();
        state.changeState(GameState.Playing);
        const loop = new SimulationLoop(() => false);
        loop.onFixedUpdate(delta => game.fixedUpdate(delta));
        loop.onFrameUpdate(delta => game.update(delta));
        for (let frame = 0; frame < fps * 10; frame++) loop.tick(1 / fps);
        return { distance: run.stats.distance, speed: game.globalSpeed,
            travel: calls.scrolls.reduce((sum, value) => sum + value, 0) };
    };
    assert.deepEqual(simulate(30), simulate(60));
});

test('pause commands cannot start an uninitialized menu run and resume does not reset the run', () => {
    const state = new GameStateManager();
    let resets = 0;
    let unlocked = 0;
    const controller = new GameController(state,
        { reset() { resets++; } }, { reset() {} }, () => unlocked++);
    controller.togglePause();
    assert.equal(state.currentState, GameState.MainMenu);
    controller.play();
    assert.equal(resets, 1);
    controller.togglePause();
    assert.equal(state.currentState, GameState.Paused);
    controller.togglePause();
    assert.equal(state.currentState, GameState.Playing);
    assert.equal(resets, 1);
    assert.equal(unlocked, 2);
    controller.restart();
    assert.equal(resets, 2);
});

test('jump and slide presses shortly before touchdown are buffered until landing', () => {
    const input = new InputManager();
    const view = presentation();
    const player = new Player(input, view);
    const actions = [];
    player.onAction(action => actions.push(action));
    const step = () => {
        player.fixedUpdate(1 / 60, 30, true);
        input.resetTriggers();
    };
    input.pulse(InputAction.Jump);
    step();
    // Far from touchdown: the press expires before landing.
    input.pulse(InputAction.Slide);
    step();
    while (view.pose.y < 2) step();
    while (view.pose.y > 1.25) step();
    input.pulse(InputAction.Slide);
    step();
    for (let i = 0; i < 10; i++) step();
    assert.deepEqual(actions, ['jump', 'slide']);
    assert.equal(view.animation, 'Slide');
});
