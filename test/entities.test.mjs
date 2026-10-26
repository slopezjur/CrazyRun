import test from 'node:test';
import assert from 'node:assert/strict';
import { Box3, BoxGeometry, Group, Mesh, MeshStandardMaterial, Texture, Vector3 } from 'three';
import { ResourceManager } from '../src/core/ResourceManager.ts';
import { CollisionManager } from '../src/game/CollisionManager.ts';
import { ChunkManager } from '../src/game/ChunkManager.ts';
import { EntityManager } from '../src/game/EntityManager.ts';
import { Collectible } from '../src/game/entities/Collectible.ts';
import { Entity } from '../src/game/entities/Entity.ts';
import { EntityPool } from '../src/game/entities/EntityPool.ts';
import { Obstacle } from '../src/game/entities/Obstacle.ts';
import { LaneSpawnPolicy } from '../src/game/SpawnPolicy.ts';

function visual() {
    return { mesh: new Mesh(new BoxGeometry(1, 1, 1), new MeshStandardMaterial()) };
}

function bounds(z = 0) {
    return new Box3(new Vector3(-0.5, 0, z - 0.5), new Vector3(0.5, 2, z + 0.5));
}

test('collision detection delegates custom outcomes and stops after a crash', () => {
    const seen = [];
    const subject = { z: 0, boundingBox: bounds() };
    const target = (name, z, response, active = true) => ({
        z, isActive: active, boundingBox: bounds(z),
        onCollide() { seen.push(name); return response; }
    });
    const targets = [
        target('far', 20, 'continue'), target('inactive', 0, 'continue', false),
        target('portal', 0, 'continue'), target('crash', 0, 'stop'), target('late coin', 0, 'continue')
    ];
    new CollisionManager(subject, {
        forEachActive(visitor) {
            for (const item of targets) if (!visitor(item)) break;
        }
    }).checkCollisions();
    assert.deepEqual(seen, ['portal', 'crash']);
});

test('child collider bounds include freshly spawned and scrolled parent transforms', () => {
    const mesh = new Group();
    const beam = new Mesh(new BoxGeometry(1.4, 0.5, 0.3), new MeshStandardMaterial());
    beam.position.y = 1.6;
    mesh.add(beam);
    const obstacle = new Obstacle({ mesh, collider: beam }, () => {});
    obstacle.spawn(1.5, 0, -10);
    assert.ok(Math.abs(obstacle.boundingBox.min.z + 10.15) < 0.00001);
    assert.ok(Math.abs(obstacle.boundingBox.min.x - 0.8) < 0.00001);
    obstacle.scroll(10);
    assert.ok(Math.abs(obstacle.boundingBox.min.z + 0.15) < 0.00001);
    const slidingPlayer = new Box3(new Vector3(1, 0, -0.5), new Vector3(2, 1, 0.5));
    assert.equal(slidingPlayer.intersectsBox(obstacle.boundingBox), false);
});

test('collectibles dispatch their configured reward exactly once', () => {
    let collected = 0;
    const coin = new Collectible({ ...visual(), yOffset: 1 }, () => collected++);
    coin.spawn(0, 0, 0);
    assert.equal(coin.mesh.position.y, 1);
    coin.onCollide();
    coin.onCollide();
    assert.equal(collected, 1);
    assert.equal(coin.isActive, false);
});

test('pool exhaustion and reset reuse existing entities', () => {
    let created = 0;
    const pool = new EntityPool(1, () => {
        created++;
        return new Obstacle(visual(), () => {});
    });
    const first = pool.getInactive();
    first.spawn(0, 0, 0);
    assert.equal(pool.getInactive(), null);
    first.despawn();
    assert.equal(pool.getInactive(), first);
    assert.equal(created, 1);
});

test('a new static entity type participates without manager branches or an animation method', () => {
    class Portal extends Entity {
        onCollide() { return 'continue'; }
    }
    const pool = new EntityPool(1, () => new Portal(visual()));
    const manager = new EntityManager(new Map([['portal', pool]]), {
        spawn(z, spawn) { spawn('portal', 1.5, 0, z); }
    });
    manager.spawnOnChunk(-4);
    const portal = pool.getAll()[0];
    assert.equal(portal.z, -4);
    assert.equal(portal.mesh.position.x, 1.5);
    let active = 0;
    manager.forEachActive(() => { active++; return true; });
    assert.equal(active, 1);
    manager.update(0.1);
    manager.scroll(15);
    assert.equal(portal.isActive, false);
    manager.spawnOnChunk(-2);
    manager.reset();
    assert.equal(portal.isActive, false);
});

test('spawn policy reserves a lane without obstacles and accepts registered choices', () => {
    const values = [0.99, 0, 0, 0, 0.99, 0.9, 0];
    const policy = new LaneSpawnPolicy([-1.5, 0, 1.5],
        [{ id: 'new hurdle', weight: 0.5 }, { id: 'new wall', weight: 0.5 }],
        [{ id: 'reward', weight: 1 }], () => values.shift() ?? 0);
    const spawned = [];
    policy.spawn(-30, (...entry) => spawned.push(entry));
    assert.deepEqual(spawned.map(entry => entry[0]), ['new hurdle', 'new wall', 'reward']);
    assert.equal(new Set(spawned.map(entry => entry[1])).size, 3);
    assert.ok(spawned.every(entry => entry[3] === -30));
});

test('shared graphics resources and all direct material textures dispose only once', () => {
    const root = new Group();
    const geometry = new BoxGeometry();
    const texture = new Texture();
    const emissive = new Texture();
    const material = new MeshStandardMaterial({ map: texture, aoMap: texture, emissiveMap: emissive });
    root.add(new Mesh(geometry, material), new Mesh(geometry, [material, material]));
    const counts = new Map();
    for (const resource of [geometry, texture, emissive, material]) {
        counts.set(resource, 0);
        resource.addEventListener('dispose', () => counts.set(resource, counts.get(resource) + 1));
    }
    const resources = new ResourceManager();
    resources.dispose(root);
    resources.dispose(root);
    assert.deepEqual([...counts.values()], [1, 1, 1, 1]);
});

test('chunk recycling handles large scrolls without gaps and reset uses configured lengths', () => {
    const chunks = Array.from({ length: 3 }, () => ({
        length: 11, zPosition: 0,
        setZPosition(z) { this.zPosition = z; },
        shiftZ(amount) { this.zPosition += amount; }
    }));
    const manager = new ChunkManager(chunks);
    const recycled = [];
    manager.onChunkRecycled(z => recycled.push(z));
    manager.scroll(80);
    manager.updatePooling(0);
    const positions = [];
    manager.forEachPosition(z => positions.push(z));
    assert.ok(positions[0] <= 11);
    assert.equal(positions[0] - positions[1], 11);
    assert.equal(positions[1] - positions[2], 11);
    assert.ok(recycled.length > 1);
    manager.reset();
    const reset = [];
    manager.forEachPosition(z => reset.push(z));
    assert.deepEqual(reset, [-0, -11, -22]);
});

test('scrolling translates measured bounds exactly like a fresh collider measurement', () => {
    const coin = new Collectible({ mesh: new Mesh(new BoxGeometry(0.6, 0.6, 0.1), new MeshStandardMaterial()), yOffset: 1 }, () => {});
    coin.spawn(1.5, 0, -40);
    coin.animate(0.35);
    coin.scroll(12.5);
    coin.scroll(0.45);
    coin.mesh.updateWorldMatrix(true, true);
    const measured = new Box3().setFromObject(coin.mesh);
    for (const corner of ['min', 'max']) {
        for (const axis of ['x', 'y', 'z']) {
            assert.ok(Math.abs(coin.boundingBox[corner][axis] - measured[corner][axis]) < 1e-9);
        }
    }
});
