import test from 'node:test';
import assert from 'node:assert/strict';
import { InputAction, InputManager } from '../src/core/InputManager.ts';
import { ButtonInput, KeyboardInput, SwipeInput } from '../src/core/BrowserInput.ts';

class Surface extends EventTarget {
    captures = new Set();
    classes = new Set();
    classList = { toggle: (name, enabled) => {
        if (enabled) this.classes.add(name);
        else this.classes.delete(name);
    } };
    constructor(bounds = { left: 0, top: 0, right: 64, bottom: 64 }, ownerDocument) {
        super();
        this.bounds = bounds;
        this.ownerDocument = ownerDocument;
    }
    setPointerCapture(id) { this.captures.add(id); }
    hasPointerCapture(id) { return this.captures.has(id); }
    releasePointerCapture(id) { this.captures.delete(id); }
    getBoundingClientRect() { return this.bounds; }
}

function send(target, type, data = {}) {
    const event = Object.assign(new Event(type, { cancelable: true }), data);
    target.dispatchEvent(event);
    return event;
}

test('multiple held sources retain an action until every source releases it', () => {
    const input = new InputManager();
    input.press('keyboard:KeyS', InputAction.Slide);
    input.press('touch:1', InputAction.Slide);
    input.resetTriggers();
    input.release('keyboard:KeyS');
    assert.equal(input.isActionActive(InputAction.Slide), true);
    assert.equal(input.isActionTriggered(InputAction.Slide), false);
    input.release('touch:1');
    assert.equal(input.isActionActive(InputAction.Slide), false);
    input.press('touch:1', InputAction.Slide);
    assert.equal(input.isActionTriggered(InputAction.Slide), true);
});

test('keyboard aliases, repeats, pause, blur and disposal share the correct lifecycle', () => {
    const target = new Surface();
    const input = new InputManager();
    let pauses = 0;
    const keyboard = new KeyboardInput(target, input, () => pauses++);
    send(target, 'keydown', { code: 'KeyS' });
    send(target, 'keydown', { code: 'ArrowDown' });
    input.resetTriggers();
    send(target, 'keyup', { code: 'KeyS' });
    assert.equal(input.isActionActive(InputAction.Slide), true);
    send(target, 'keydown', { code: 'ArrowDown', repeat: true });
    assert.equal(input.isActionTriggered(InputAction.Slide), false);
    send(target, 'keydown', { code: 'Escape', repeat: false });
    send(target, 'keydown', { code: 'Escape', repeat: true });
    assert.equal(pauses, 1);
    send(target, 'blur');
    assert.equal(input.isActionActive(InputAction.Slide), false);
    keyboard.dispose();
    send(target, 'keydown', { code: 'KeyS' });
    send(target, 'keydown', { code: 'Escape' });
    assert.equal(input.isActionActive(InputAction.Slide), false);
    assert.equal(pauses, 1);
});

test('repeated swipes create pulses rather than latched actions', () => {
    const surface = new Surface();
    const input = new InputManager();
    const swipes = new SwipeInput(surface, input);
    for (let i = 0; i < 3; i++) {
        send(surface, 'pointerdown', { pointerId: i, pointerType: 'touch', clientX: 0, clientY: 0 });
        send(surface, 'pointerup', { pointerId: i, clientX: 80, clientY: 0 });
        assert.equal(input.isActionTriggered(InputAction.Right), true);
        assert.equal(input.isActionActive(InputAction.Right), false);
        input.resetTriggers();
    }
    send(surface, 'pointerdown', { pointerId: 4, pointerType: 'touch', clientX: 0, clientY: 0 });
    send(surface, 'pointerup', { pointerId: 4, clientX: 0, clientY: 80 });
    assert.equal(input.isActionTriggered(InputAction.Slide), true);
    assert.equal(input.isActionActive(InputAction.Slide), false);
    swipes.dispose();
});

test('cancelled and short gestures cannot trigger actions', () => {
    const surface = new Surface();
    const input = new InputManager();
    const swipes = new SwipeInput(surface, input);
    send(surface, 'pointerdown', { pointerId: 1, pointerType: 'touch', clientX: 0, clientY: 0 });
    send(surface, 'pointercancel', { pointerId: 1 });
    send(surface, 'pointerup', { pointerId: 1, clientX: 0, clientY: -80 });
    send(surface, 'pointerdown', { pointerId: 2, pointerType: 'touch', clientX: 0, clientY: 0 });
    send(surface, 'pointerup', { pointerId: 2, clientX: 1, clientY: 1 });
    assert.equal(input.isActionTriggered(InputAction.Jump), false);
    swipes.dispose();
});

test('virtual buttons release on cancellation, lost capture and disposal', () => {
    const button = new Surface();
    const input = new InputManager();
    const buttons = new ButtonInput(new Map([[button, InputAction.Slide]]), input);
    send(button, 'pointerdown', { pointerId: 1 });
    assert.equal(input.isActionActive(InputAction.Slide), true);
    send(button, 'pointercancel', { pointerId: 1 });
    assert.equal(input.isActionActive(InputAction.Slide), false);
    send(button, 'pointerdown', { pointerId: 2 });
    send(button, 'lostpointercapture', { pointerId: 2 });
    assert.equal(input.isActionActive(InputAction.Slide), false);
    send(button, 'pointerdown', { pointerId: 3 });
    buttons.dispose();
    assert.equal(input.isActionActive(InputAction.Slide), false);
    input.resetTriggers();
    send(button, 'pointerdown', { pointerId: 4 });
    assert.equal(input.isActionTriggered(InputAction.Slide), false);
});

test('swipes fire at the movement threshold without waiting for release or firing twice', () => {
    const surface = new Surface();
    const input = new InputManager();
    const swipes = new SwipeInput(surface, input);
    send(surface, 'pointerdown', { pointerId: 1, pointerType: 'touch', clientX: 0, clientY: 0 });
    send(surface, 'pointermove', { pointerId: 1, clientX: 10, clientY: 0 });
    assert.equal(input.isActionTriggered(InputAction.Right), false);
    send(surface, 'pointermove', { pointerId: 1, clientX: 24, clientY: 0 });
    assert.equal(input.isActionTriggered(InputAction.Right), true);
    assert.equal(input.isActionActive(InputAction.Right), false);
    input.resetTriggers();
    send(surface, 'pointermove', { pointerId: 1, clientX: 80, clientY: 0 });
    send(surface, 'pointerup', { pointerId: 1, clientX: 100, clientY: 0 });
    assert.equal(input.isActionTriggered(InputAction.Right), false);
    swipes.dispose();
});

test('a thumb can roll between buttons, leave the targets, and return without sticking', () => {
    const left = new Surface();
    const right = new Surface({ left: 76, top: 0, right: 140, bottom: 64 });
    const input = new InputManager();
    const controls = new ButtonInput(new Map([[left, InputAction.Left], [right, InputAction.Right]]), input);
    send(left, 'pointerdown', { pointerId: 1, pointerType: 'touch', clientX: 20, clientY: 20 });
    assert.equal(input.isActionActive(InputAction.Left), true);
    assert.equal(left.classes.has('is-held'), true);
    input.resetTriggers();
    // Pointer capture keeps delivery on the original button while hit testing follows the thumb.
    send(left, 'pointermove', { pointerId: 1, clientX: 100, clientY: 20 });
    assert.equal(input.isActionActive(InputAction.Left), false);
    assert.equal(input.isActionTriggered(InputAction.Right), true);
    assert.equal(left.classes.has('is-held'), false);
    assert.equal(right.classes.has('is-held'), true);
    send(left, 'pointermove', { pointerId: 1, clientX: 70, clientY: 20 });
    assert.equal(input.isActionActive(InputAction.Right), false);
    assert.equal(right.classes.has('is-held'), false);
    input.resetTriggers();
    send(left, 'pointermove', { pointerId: 1, clientX: 100, clientY: 20 });
    assert.equal(input.isActionTriggered(InputAction.Right), true);
    send(left, 'pointerup', { pointerId: 1 });
    assert.equal(input.isActionActive(InputAction.Right), false);
    assert.equal(left.hasPointerCapture(1), false);
    controls.dispose();
});

test('multi-touch release and state resets preserve unrelated input sources', () => {
    const slide = new Surface();
    const jump = new Surface({ left: 76, top: 0, right: 140, bottom: 64 });
    const input = new InputManager();
    const controls = new ButtonInput(new Map([[slide, InputAction.Slide], [jump, InputAction.Jump]]), input);
    send(slide, 'pointerdown', { pointerId: 1 });
    send(slide, 'pointerdown', { pointerId: 2 });
    send(slide, 'pointerup', { pointerId: 1 });
    assert.equal(input.isActionActive(InputAction.Slide), true);
    assert.equal(slide.classes.has('is-held'), true);
    send(jump, 'pointerdown', { pointerId: 3 });
    assert.equal(input.isActionActive(InputAction.Jump), true);
    input.press('keyboard:KeyS', InputAction.Slide);
    controls.reset();
    assert.equal(input.isActionActive(InputAction.Jump), false);
    assert.equal(input.isActionActive(InputAction.Slide), true);
    assert.equal(slide.classes.has('is-held'), false);
    assert.equal(slide.hasPointerCapture(2), false);
    assert.equal(jump.hasPointerCapture(3), false);
    controls.dispose();
});

test('focus loss and page hiding clear pointer holds and unfinished gestures', () => {
    const document = Object.assign(new EventTarget(), { defaultView: new EventTarget(), hidden: false });
    const button = new Surface(undefined, document);
    const canvas = new Surface(undefined, document);
    const input = new InputManager();
    const controls = new ButtonInput(new Map([[button, InputAction.Slide]]), input);
    const swipes = new SwipeInput(canvas, input);
    send(button, 'pointerdown', { pointerId: 1 });
    send(canvas, 'pointerdown', { pointerId: 2, pointerType: 'touch', clientX: 0, clientY: 0 });
    send(document.defaultView, 'blur');
    assert.equal(input.isActionActive(InputAction.Slide), false);
    assert.equal(button.hasPointerCapture(1), false);
    assert.equal(canvas.hasPointerCapture(2), false);
    input.resetTriggers();
    send(canvas, 'pointerup', { pointerId: 2, clientX: 100, clientY: 0 });
    assert.equal(input.isActionTriggered(InputAction.Right), false);
    send(button, 'pointerdown', { pointerId: 3 });
    document.hidden = true;
    send(document, 'visibilitychange');
    assert.equal(input.isActionActive(InputAction.Slide), false);
    assert.equal(button.classes.has('is-held'), false);
    controls.dispose();
    swipes.dispose();
});

test('failed capture cannot leave a held action and secondary mouse buttons are ignored', () => {
    const button = new Surface();
    const input = new InputManager();
    const controls = new ButtonInput(new Map([[button, InputAction.Slide]]), input);
    send(button, 'pointerdown', { pointerId: 1, pointerType: 'mouse', button: 2 });
    assert.equal(input.isActionTriggered(InputAction.Slide), false);
    button.setPointerCapture = () => { throw new Error('The pointer is no longer active.'); };
    assert.doesNotThrow(() => send(button, 'pointerdown', { pointerId: 2, pointerType: 'touch' }));
    assert.equal(input.isActionActive(InputAction.Slide), false);
    assert.equal(button.classes.has('is-held'), false);
    controls.dispose();
});

test('keyboard and assistive clicks produce a pulse without duplicating pointer clicks', () => {
    const button = new Surface();
    const input = new InputManager();
    const controls = new ButtonInput(new Map([[button, InputAction.Jump]]), input);
    send(button, 'click', { detail: 0 });
    assert.equal(input.isActionTriggered(InputAction.Jump), true);
    assert.equal(input.isActionActive(InputAction.Jump), false);
    input.resetTriggers();
    send(button, 'click', { detail: 1, pointerType: 'touch' });
    assert.equal(input.isActionTriggered(InputAction.Jump), false);
    controls.dispose();
});

test('disposing a keyboard preserves holds owned by touch controls', () => {
    const viewport = new Surface();
    const button = new Surface();
    const input = new InputManager();
    const keyboard = new KeyboardInput(viewport, input, () => {});
    const touch = new ButtonInput(new Map([[button, InputAction.Slide]]), input);
    send(viewport, 'keydown', { code: 'KeyW' });
    send(button, 'pointerdown', { pointerId: 1 });
    keyboard.dispose();
    assert.equal(input.isActionActive(InputAction.Jump), false);
    assert.equal(input.isActionActive(InputAction.Slide), true);
    touch.dispose();
    assert.equal(input.isActionActive(InputAction.Slide), false);
});

test('independent keyboard sources can hold the same action without releasing each other', () => {
    const first = new Surface();
    const second = new Surface();
    const input = new InputManager();
    const keyboardA = new KeyboardInput(first, input, () => {});
    const keyboardB = new KeyboardInput(second, input, () => {});
    send(first, 'keydown', { code: 'KeyS' });
    send(second, 'keydown', { code: 'KeyS' });
    send(first, 'keyup', { code: 'KeyS' });
    assert.equal(input.isActionActive(InputAction.Slide), true);
    keyboardA.dispose();
    assert.equal(input.isActionActive(InputAction.Slide), true);
    keyboardB.dispose();
    assert.equal(input.isActionActive(InputAction.Slide), false);
});

test('independent button adapters cannot collide when pointer IDs match', () => {
    const first = new Surface();
    const second = new Surface();
    const input = new InputManager();
    const left = new ButtonInput(new Map([[first, InputAction.Left]]), input);
    const right = new ButtonInput(new Map([[second, InputAction.Right]]), input);
    send(first, 'pointerdown', { pointerId: 1 });
    send(second, 'pointerdown', { pointerId: 1 });
    assert.equal(input.isActionActive(InputAction.Left), true);
    assert.equal(input.isActionActive(InputAction.Right), true);
    left.dispose();
    assert.equal(input.isActionActive(InputAction.Right), true);
    right.dispose();
    assert.equal(input.isActionActive(InputAction.Right), false);
});
