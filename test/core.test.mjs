import test from 'node:test';
import assert from 'node:assert/strict';
import { Engine } from '../src/core/Engine.ts';
import { GameState, GameStateManager } from '../src/core/GameStateManager.ts';
import { Lifetime } from '../src/core/Lifetime.ts';
import { SimulationLoop } from '../src/core/SimulationLoop.ts';
import { AssetManager } from '../src/core/AssetManager.ts';

test('state changes are observable without a DOM and subscriptions can be removed', () => {
    const state = new GameStateManager();
    const seen = [];
    const unsubscribe = state.onStateChange(value => seen.push(value));
    state.changeState(GameState.Playing);
    state.changeState(GameState.Playing);
    unsubscribe();
    state.changeState(GameState.Paused);
    assert.deepEqual(seen, [GameState.Playing]);
    assert.equal(state.currentState, GameState.Paused);
});

test('pause freezes fixed and frame updates and discards catch-up time', () => {
    let paused = false;
    let fixed = 0;
    const frames = [];
    const loop = new SimulationLoop(() => paused, 1 / 64);
    loop.onFixedUpdate(() => fixed++);
    loop.onFrameUpdate(delta => frames.push(delta));
    loop.tick(1 / 32);
    assert.equal(fixed, 2);
    paused = true;
    loop.tick(10);
    assert.equal(fixed, 2);
    assert.equal(frames.length, 1);
    paused = false;
    loop.tick(1 / 64);
    assert.equal(fixed, 3);
    assert.equal(frames.length, 2);
});

test('slow frames are capped and removed systems are no longer called', () => {
    let fixed = 0;
    let elapsed;
    const loop = new SimulationLoop(() => false, 1 / 64);
    const removeFixed = loop.onFixedUpdate(() => fixed++);
    const removeFrame = loop.onFrameUpdate(delta => { elapsed = delta; });
    loop.tick(10);
    assert.equal(fixed, 6);
    assert.equal(elapsed, 0.1);
    removeFixed();
    removeFrame();
    loop.tick(1 / 64);
    assert.equal(fixed, 6);
    loop.dispose();
    assert.throws(() => new SimulationLoop(() => false, 0), RangeError);
});

test('engine updates before rendering and disposes its render driver once', async () => {
    const order = [];
    const deltas = [];
    let frame;
    let disposals = 0;
    const engine = new Engine({
        async initialize() {},
        async setAnimationLoop(callback) { frame = callback; },
        render() { order.push('render'); },
        dispose() { disposals++; }
    }, delta => {
        order.push('update');
        deltas.push(delta);
    }, {
        begin() { order.push('begin'); },
        end() { order.push('end'); }
    });
    await engine.start();
    frame(1000);
    frame(1016);
    assert.deepEqual(order, ['begin', 'update', 'render', 'end', 'begin', 'update', 'render', 'end']);
    assert.deepEqual(deltas, [0, 0.016]);
    engine.dispose();
    engine.dispose();
    frame(1032);
    assert.equal(order.length, 8);
    assert.equal(disposals, 1);
});

test('disposing during renderer initialization prevents a late animation loop', async () => {
    let finish;
    let loops = 0;
    const engine = new Engine({
        initialize() { return new Promise(resolve => { finish = resolve; }); },
        async setAnimationLoop() { loops++; },
        render() {},
        dispose() {}
    }, () => {});
    const start = engine.start();
    engine.dispose();
    finish();
    await start;
    assert.equal(loops, 0);
});

test('cleanup runs in reverse order, survives failures, and is idempotent', () => {
    const lifetime = new Lifetime();
    const order = [];
    lifetime.defer(() => order.push('first'));
    lifetime.defer(() => { order.push('second'); throw new Error('cleanup'); });
    lifetime.defer(() => order.push('third'));
    assert.throws(() => lifetime.dispose(), AggregateError);
    lifetime.dispose();
    lifetime.defer(() => order.push('late'));
    assert.deepEqual(order, ['third', 'second', 'first', 'late']);
});

test('asset loading preserves the complete model result and reports fallback failures', async () => {
    const result = { scene: {}, animations: [{}] };
    const loader = new AssetManager({ async loadAsync() { return result; } }, () => {});
    assert.equal(await loader.loadModel('character.glb'), result);
    const errors = [];
    const failure = new Error('missing asset');
    const missing = new AssetManager({
        async loadAsync() { throw failure; }
    }, (url, error) => errors.push([url, error]));
    assert.equal(await missing.loadModel('missing.glb'), null);
    assert.deepEqual(errors, [['missing.glb', failure]]);
});
