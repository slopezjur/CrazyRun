import test from 'node:test';
import assert from 'node:assert/strict';
import { AnimationClip, BoxGeometry, Group, Mesh, MeshStandardMaterial, NumberKeyframeTrack, ShaderMaterial, Texture } from 'three';
import { ResourceManager } from '../src/core/ResourceManager.ts';
import { PlayerView } from '../src/game/graphics/PlayerView.ts';
import { WebGPURenderDriver } from '../src/core/WebGPURenderDriver.ts';
import { ViewportBinding } from '../src/core/ViewportBinding.ts';

test('loaded character materials preserve textures and support material arrays', async () => {
    const resources = new ResourceManager();
    const view = new PlayerView(resources);
    const texture = new Texture();
    const material = new MeshStandardMaterial({ map: texture, roughness: 0.75, metalness: 0.2, transparent: true });
    const model = new Group();
    const first = new Mesh(new BoxGeometry(), material);
    const second = new Mesh(first.geometry, [material, material]);
    model.add(first, second);
    await view.loadCharacter({ async loadModel() { return { scene: model, animations: [] }; } }, 'character.glb');
    assert.equal(first.material.isNodeMaterial, true);
    assert.equal(first.material.map, texture);
    assert.equal(first.material.roughness, 0.75);
    assert.equal(first.material.transparent, true);
    assert.equal(second.material[0], first.material);
    assert.equal(second.material[1], first.material);
    view.dispose();
});

test('missing models retain the fallback and late models are disposed after shutdown', async () => {
    const resources = new ResourceManager();
    const view = new PlayerView(resources);
    const fallback = view.mesh.children[0];
    await view.loadCharacter({ async loadModel() { return null; } }, 'missing.glb');
    assert.equal(view.mesh.children[0], fallback);
    let finish;
    const pending = view.loadCharacter({
        loadModel() { return new Promise(resolve => { finish = resolve; }); }
    }, 'late.glb');
    view.dispose();
    const geometry = new BoxGeometry();
    let disposed = 0;
    geometry.addEventListener('dispose', () => disposed++);
    const model = new Mesh(geometry, new MeshStandardMaterial());
    finish({ scene: model, animations: [] });
    await pending;
    assert.equal(disposed, 1);
    assert.equal(model.parent, null);
});

test('render driver handles disposal during initialization without a browser viewport', async () => {
    let finish;
    let disposed = 0;
    const renderer = {
        init() { return new Promise(resolve => { finish = resolve; }); },
        async setAnimationLoop() {},
        render() {},
        dispose() { disposed++; }
    };
    const driver = new WebGPURenderDriver(renderer, {}, {});
    const starting = driver.initialize();
    driver.dispose();
    finish();
    await starting;
    assert.equal(disposed, 1);
    driver.dispose();
    assert.equal(disposed, 1);
});

test('rendering follows the dynamic game container without overriding its CSS size', t => {
    const previous = globalThis.ResizeObserver;
    let observed;
    let notify;
    let disconnected = false;
    globalThis.ResizeObserver = class {
        constructor(callback) { notify = callback; }
        observe(element) { observed = element; }
        disconnect() { disconnected = true; }
    };
    t.after(() => {
        if (previous === undefined) delete globalThis.ResizeObserver;
        else globalThis.ResizeObserver = previous;
    });
    const container = { clientWidth: 412, clientHeight: 700 };
    const viewport = Object.assign(new EventTarget(), { innerWidth: 412, innerHeight: 900, devicePixelRatio: 3 });
    const sizes = [];
    const ratios = [];
    const renderer = { setSize: (...args) => sizes.push(args), setPixelRatio: ratio => ratios.push(ratio) };
    const camera = { aspect: 0, updateProjectionMatrix() {} };
    const binding = new ViewportBinding(renderer, camera, viewport, container);
    t.after(() => binding.dispose());
    assert.equal(observed, container);
    assert.deepEqual(ratios, [2]);
    assert.deepEqual(sizes.at(-1), [412, 700, false]);
    assert.equal(camera.aspect, 412 / 700);
    container.clientHeight = 620;
    notify();
    assert.deepEqual(sizes.at(-1), [412, 620, false]);
    assert.equal(camera.aspect, 412 / 620);
    binding.dispose();
    assert.equal(disconnected, true);
    const count = sizes.length;
    container.clientHeight = 500;
    notify();
    viewport.dispatchEvent(new Event('resize'));
    assert.equal(sizes.length, count);
});

test('character animation clips advance through the presentation frame update', async () => {
    const view = new PlayerView(new ResourceManager());
    const model = new Group();
    model.add(new Mesh(new BoxGeometry(), new MeshStandardMaterial()));
    const clip = new AnimationClip('mixamo_run', 1, [
        new NumberKeyframeTrack('.rotation[y]', [0, 1], [0, 1])
    ]);
    await view.loadCharacter({ async loadModel() { return { scene: model, animations: [clip] }; } }, 'animated.glb');
    view.update(0.5);
    assert.ok(model.rotation.y > 0);
    view.dispose();
});

test('failed material preparation retains the fallback and disposes the rejected model', async () => {
    const view = new PlayerView(new ResourceManager());
    const fallback = view.mesh.children[0];
    const model = new Group();
    const geometry = new BoxGeometry();
    model.add(new Mesh(geometry, new MeshStandardMaterial()), new Mesh(geometry, new ShaderMaterial()));
    let released = 0;
    geometry.addEventListener('dispose', () => released++);
    await assert.rejects(view.loadCharacter({
        async loadModel() { return { scene: model, animations: [] }; }
    }, 'unsupported.glb'), /Material "ShaderMaterial" is not compatible/);
    assert.equal(view.mesh.children[0], fallback);
    assert.equal(released, 1);
    view.dispose();
});

test('registered character and outfit variants render without PlayerView type branches', async () => {
    const { CHARACTER_VISUALS } = await import('../src/game/graphics/CosmeticVisuals.ts');
    const custom = new Mesh(new BoxGeometry(), new MeshStandardMaterial());
    const view = new PlayerView(new ResourceManager(),
        [...CHARACTER_VISUALS, { id: 'visitor', create: () => custom }],
        new Map([['ocean', 0x123456]]));
    view.setAppearance({ character: 'visitor', outfit: 'ocean', trail: 'none' });
    assert.equal(custom.visible, true);
    assert.equal(custom.material.color.getHex(), 0x123456);
    assert.equal(view.mesh.children.filter(child => child.visible).length, 1);
    view.dispose();
});

test('registered hazards preserve course collider dimensions and deterministic motion', async () => {
    const { HAZARD_DEFINITIONS } = await import('../src/game/graphics/EntityVisuals.ts');
    const { Hazard } = await import('../src/game/entities/Hazard.ts');
    const resources = new ResourceManager();
    const byId = new Map();
    for (const definition of HAZARD_DEFINITIONS) {
        const { visual, behavior } = definition.create();
        const hazard = new Hazard(visual, behavior, () => 'stop', () => {});
        hazard.spawn(1.5, 0, -80, { phase: Math.PI / 2 });
        byId.set(definition.id, hazard);
    }
    const close = (actual, expected) => assert.ok(Math.abs(actual - expected) < 0.00001);
    close(byId.get('hurdle').boundingBox.max.y, 0.5);
    close(byId.get('arch').boundingBox.min.y, 1.35);
    close(byId.get('wall').boundingBox.max.y, 2);
    close(byId.get('barrier').position.x, 1.72);
    close(byId.get('gate').boundingBox.min.y, 2.65);
    close(byId.get('gap').boundingBox.max.x - byId.get('gap').boundingBox.min.x, 1.3);
    close(byId.get('convoy').boundingBox.min.z, -82);
    for (const hazard of byId.values()) resources.dispose(hazard.mesh);
});

test('power-up visuals accept additional definitions without changing their factory', async () => {
    const { createPowerVisual } = await import('../src/game/graphics/EntityVisuals.ts');
    const visual = createPowerVisual('vacuum', { vacuum: { color: 0x123456, geometry: () => new BoxGeometry() } });
    assert.equal(visual.mesh.material.color.getHex(), 0x123456);
    assert.equal(visual.yOffset, 1.25);
    new ResourceManager().dispose(visual.mesh);
});
