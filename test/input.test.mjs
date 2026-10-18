import test from 'node:test';
import assert from 'node:assert/strict';
import { InputAction, InputManager } from '../src/core/InputManager.ts';
import { ButtonInput, KeyboardInput, SwipeInput } from '../src/core/BrowserInput.ts';

class Surface extends EventTarget {
    setPointerCapture() {}
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
