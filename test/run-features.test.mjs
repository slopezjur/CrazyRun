import test from 'node:test';
import assert from 'node:assert/strict';
import { Box3, BoxGeometry, Mesh, MeshStandardMaterial, Vector3 } from 'three';
import { COURSE_VERSION, dailyChallenge, challengeFromUrl, challengeUrl, endlessChallenge, biomeAt, spectacleAt } from '../src/game/Challenge.ts';
import { BIOME_COURSES, createPattern, validatePattern, PatternSpawnPolicy } from '../src/game/PatternSpawnPolicy.ts';
import { InputAction, InputManager } from '../src/core/InputManager.ts';
import { Player } from '../src/game/Player.ts';
import { Hazard } from '../src/game/entities/Hazard.ts';
import { HAZARD_DEFINITIONS } from '../src/game/graphics/EntityVisuals.ts';
import { createRunSession } from './helpers/run-session.mjs';
import { ProfileStorage } from '../src/game/storage/ProfileStorage.ts';
import { GhostStorage } from '../src/game/storage/GhostStorage.ts';
import { Progression } from '../src/game/Progression.ts';
import { GhostReplay } from '../src/game/GhostReplay.ts';
import { Collectible } from '../src/game/entities/Collectible.ts';
import { CollisionManager } from '../src/game/CollisionManager.ts';

function storage() {
    const values = new Map();
    return { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) };
}
function stats(overrides = {}) {
    return { distance: 0, coins: 0, clears: 0, arches: 0, nearMisses: 0, chains: 0, longestCombo: 0, crazyModes: 0, ...overrides };
}
const pose = { x: 0, y: 1, z: 0, scaleY: 1, tiltX: 0 };

test('daily links preserve the exact date and rules, and reject invalid versions and dates', () => {
    const daily = dailyChallenge('2026-10-18');
    const link = challengeUrl('https://example.com/CrazyRun/?debug=1#menu', daily);
    assert.deepEqual(challengeFromUrl(new URL(link)), daily);
    assert.equal(new URL(link).pathname, '/CrazyRun/');
    assert.equal(new URL(link).searchParams.has('debug'), false);
    assert.equal(challengeFromUrl(new URL('https://example.com/?challenge=2026-10-18&v=0')), null);
    assert.equal(challengeFromUrl(new URL(`https://example.com/?challenge=2026-10-18&v=${COURSE_VERSION - 1}`)), null);
    assert.throws(() => dailyChallenge('2026-02-30'), RangeError);
    assert.equal(challengeUrl('https://example.com/', endlessChallenge('seed')), null);
});

test('authored patterns preserve an open lane and a full jump recovery interval at maximum speed', () => {
    for (let seed = 0; seed < 20; seed++) {
        for (let block = 0; block < 50; block++) {
            assert.equal(validatePattern(createPattern(String(seed), block)), true);
        }
    }
    assert.equal(validatePattern([{ safeLane: 0, actionLane: 0, action: 'wall' }]), false);
    assert.equal(validatePattern(createPattern('seed', 0), 30, 80), false);
});

test('recycled course rows are identical to initial rows in world coordinates', () => {
    const generate = distance => {
        const entries = [];
        new PatternSpawnPolicy(() => ({ challenge: dailyChallenge('2026-10-18'), distance }))
            .spawn(distance - 800, (id, x, y, z, data) => entries.push({ id, x, y, distance: distance - z, data }));
        return entries;
    };
    assert.deepEqual(generate(0), generate(345));
    const entries = generate(0);
    assert.equal(new Set(entries.filter(entry => !['coin', 'magnet', 'shield', 'slow'].includes(entry.id)).map(entry => entry.x)).size, 2);
    assert.ok(entries.some(entry => entry.id === 'convoy'));
});

test('biomes and event warnings occur at reproducible distance boundaries', () => {
    assert.equal(biomeAt(959), 'city');
    assert.equal(biomeAt(960), 'tunnel');
    assert.equal(biomeAt(1920), 'rooftops');
    assert.equal(biomeAt(2880), 'city');
    assert.equal(spectacleAt(559), 'none');
    assert.equal(spectacleAt(560), 'warning');
    assert.equal(spectacleAt(640), 'active');
    assert.equal(spectacleAt(880), 'none');
});

test('complete coin chains reward skill; missed chains do not award completion', () => {
    const run = createRunSession(endlessChallenge('seed'));
    let points = 0;
    for (let coin = 0; coin < 3; coin++) points += run.collectCoin(1, 3, [0, 1, 0]);
    assert.equal(points, 550);
    assert.equal(run.stats.chains, 1);
    assert.equal(run.combo, 1);
    run.collectCoin(2, 3, [0, 1, 0]);
    run.missChain(2);
    run.collectCoin(2, 3, [0, 1, 0]);
    assert.equal(run.stats.chains, 1);
    run.advance(8, 200);
    assert.equal(run.combo, 0);
});

test('Crazy Mode absorbs collisions, expires, and shields consume only one charge', () => {
    const run = createRunSession(endlessChallenge('seed'));
    for (let i = 0; i < 9; i++) run.clearObstacle(false, true);
    assert.equal(run.stats.crazyModes, 1);
    assert.ok(run.multiplier >= 3);
    assert.equal(run.absorbHit([0, 1, 0]), true);
    run.advance(8, 100);
    assert.equal(run.absorbHit([0, 1, 0]), false);
    run.pickUp('shield');
    assert.equal(run.absorbHit([0, 1, 0]), true);
    assert.equal(run.shield, false);
    assert.equal(run.absorbHit([0, 1, 0]), true);
    run.advance(2, 80);
    assert.equal(run.absorbHit([0, 1, 0]), false);
    run.pickUp('slow');
    assert.equal(run.timeScale, 0.55);
    run.advance(5, 100);
    assert.equal(run.timeScale, 1);
    run.reset();
    assert.equal(run.stats.coins, 0);
    assert.equal(run.charge, 0);
});

test('mission rewards are one-time, cosmetic purchases persist, and combo goals use a maximum', () => {
    const save = storage();
    const profile = new Progression(new ProfileStorage(save));
    assert.equal(profile.equip('robot'), false);
    assert.deepEqual(profile.finish(stats({ coins: 50, longestCombo: 10 }), 1000, 'v1:free:seed'), { earned: 125, missions: ['collector'] });
    assert.equal(profile.finish(stats({ coins: 50, longestCombo: 8 }), 900, 'v1:free:seed').earned, 50);
    assert.equal(profile.missionProgress('comboMaster'), 10);
    assert.equal(profile.best('v1:free:seed'), 1000);
    assert.equal(profile.equip('robot'), true);
    assert.equal(profile.wallet, 25);
    assert.equal(profile.equip('robot'), true);
    assert.equal(profile.wallet, 25);
    const restored = new Progression(new ProfileStorage(save));
    assert.equal(restored.appearance.character, 'robot');
    assert.equal(restored.wallet, 25);
    assert.equal(restored.finish(stats({ longestCombo: 15 }), 1200, 'v1:free:seed').earned, 150);
});

test('malformed profiles cannot grant unknown cosmetics or negative balances', () => {
    const save = storage();
    save.setItem('crazyrun_profile_v1', JSON.stringify({ version: 1, wallet: -1, owned: ['unknown'], appearance: { character: 'unknown' }, motion: 3 }));
    const profile = new Progression(new ProfileStorage(save));
    assert.equal(profile.wallet, 0);
    assert.equal(profile.appearance.character, 'runner');
    assert.equal(profile.motion, 1);
    assert.equal(profile.owns('unknown'), false);
});

test('ghosts interpolate a matching course, preserve a better run, and ignore corrupt recordings', () => {
    const save = storage();
    const replay = new GhostReplay(new GhostStorage(save));
    replay.start('v1:free:seed', pose);
    replay.record(1, 30, { ...pose, x: 1.5 });
    replay.finish(300, 2, 60, pose);
    const restored = new GhostReplay(new GhostStorage(save));
    restored.start('v1:free:seed', pose);
    const frame = [0, 0, 0, 0, 0, 0];
    assert.equal(restored.sample(0.5, frame), true);
    assert.equal(frame[1], 15);
    assert.equal(frame[2], 0.75);
    assert.equal(restored.sample(3, frame), false);
    restored.finish(100, 1, 30, pose);
    restored.start('v1:free:seed', pose);
    assert.equal(restored.best.score, 300);
    restored.start('v1:free:other', pose);
    assert.equal(restored.sample(0, frame), false);
    save.setItem('crazyrun_ghosts_v1', '[{"key":"broken","score":1,"frames":[null,null]}]');
    assert.doesNotThrow(() => new GhostReplay(new GhostStorage(save)));
});

test('pooled pickups reset rotation so restarting a course preserves collider geometry', () => {
    const coin = new Collectible({ mesh: new Mesh(new BoxGeometry(), new MeshStandardMaterial()) }, () => {});
    coin.spawn(0, 0, -10);
    coin.animate(1);
    coin.despawn();
    coin.spawn(0, 0, -10);
    assert.equal(coin.mesh.rotation.y, 0);
});

test('long hazards collide at their leading edge outside the centre proximity gate', () => {
    const subject = { z: 0, boundingBox: new Box3(new Vector3(-0.4, 0, -0.4), new Vector3(0.4, 2, 0.4)) };
    let collided = false;
    const target = { z: -3, isActive: true,
        boundingBox: new Box3(new Vector3(-0.5, 0, -6), new Vector3(0.5, 2, 0)),
        onCollide() { collided = true; return 'stop'; } };
    new CollisionManager(subject, { forEachActive(visitor) { visitor(target); } }).checkCollisions();
    assert.equal(collided, true);
});

test('course bests keep recently improved records when the oldest entries are trimmed', () => {
    const profile = new Progression(new ProfileStorage(storage()));
    const daily = 'v1:daily:2026-10-20:coinRush';
    profile.finish(stats(), 500, daily);
    for (let run = 0; run < 31; run++) profile.finish(stats(), 100, `v1:free:seed${run}`);
    profile.finish(stats(), 900, daily);
    profile.finish(stats(), 100, 'v1:free:latest');
    assert.equal(profile.best(daily), 900);
    assert.equal(profile.best('v1:free:seed0'), 0);
    assert.equal(profile.best('v1:free:latest'), 100);
});

test('lane blockers stand taller than the highest jump while hurdles and gaps stay jumpable', () => {
    // A fine step approaches the continuous jump peak, which slow motion's smaller steps get closest to.
    const input = new InputManager();
    const player = new Player(input, { setPose() {}, setAnimation() {}, update() {} });
    input.pulse(InputAction.Jump);
    let peak = 0;
    for (let step = 0; step < 6000; step++) {
        player.fixedUpdate(1 / 6000, 30, true);
        input.resetTriggers();
        peak = Math.max(peak, player.boundingBox.min.y);
    }
    const top = id => {
        const { visual, behavior } = HAZARD_DEFINITIONS.find(definition => definition.id === id).create();
        const hazard = new Hazard(visual, behavior, () => 'stop', () => {});
        hazard.spawn(0, 0, 0);
        return hazard.boundingBox.max.y;
    };
    const blockers = new Set(['wall', 'convoy', ...Object.values(BIOME_COURSES).map(course => course.blocker)]);
    for (const id of blockers) assert.ok(top(id) > peak + 0.1, `${id} (top ${top(id)}) can be jumped; feet peak at ${peak.toFixed(3)}`);
    for (const id of ['hurdle', 'gap']) assert.ok(top(id) < peak, `${id} can no longer be jumped`);
});
