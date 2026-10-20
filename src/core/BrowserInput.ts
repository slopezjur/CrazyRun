import { HeldInputScope, InputAction, type IInputWriter } from './InputManager';

export const DEFAULT_KEY_BINDINGS: ReadonlyMap<string, InputAction> = new Map([
    ['KeyA', InputAction.Left], ['ArrowLeft', InputAction.Left],
    ['KeyD', InputAction.Right], ['ArrowRight', InputAction.Right],
    ['KeyW', InputAction.Jump], ['ArrowUp', InputAction.Jump], ['Space', InputAction.Jump],
    ['KeyS', InputAction.Slide], ['ArrowDown', InputAction.Slide]
]);

function bindInterruptions(element: HTMLElement, reset: () => void, signal: AbortSignal): void {
    const document = element.ownerDocument;
    document?.defaultView?.addEventListener('blur', reset, { signal });
    document?.addEventListener('visibilitychange', () => { if (document.hidden) reset(); }, { signal });
}

function releaseCapture(element: HTMLElement, pointerId: number): void {
    if (element.hasPointerCapture(pointerId)) element.releasePointerCapture(pointerId);
}

export class KeyboardInput {
    private readonly holds: HeldInputScope;
    private readonly events = new AbortController();

    constructor(
        target: Window,
        input: Pick<IInputWriter, 'press' | 'release'>,
        onPause: () => void,
        bindings: ReadonlyMap<string, InputAction> = DEFAULT_KEY_BINDINGS
    ) {
        this.holds = new HeldInputScope(input);
        const options = { signal: this.events.signal };
        target.addEventListener('keydown', event => {
            if (event.code === 'Escape') {
                event.preventDefault();
                if (!event.repeat) onPause();
                return;
            }
            const element = event.target as HTMLElement | null;
            if (element?.closest?.('input, select, textarea, button, summary')) return;
            const action = bindings.get(event.code);
            if (action !== undefined) {
                event.preventDefault();
                this.holds.press('keyboard:' + event.code, action);
            }
        }, options);
        target.addEventListener('keyup', event => {
            this.holds.release('keyboard:' + event.code);
        }, options);
        target.addEventListener('blur', () => this.reset(), options);
    }

    public reset(): void { this.holds.releaseAll(); }

    public dispose(): void {
        this.events.abort();
        this.reset();
    }
}

export class SwipeInput {
    private readonly events = new AbortController();
    private readonly starts = new Map<number, { x: number; y: number; consumed: boolean }>();

    constructor(
        private readonly element: HTMLElement,
        input: Pick<IInputWriter, 'pulse'>,
        minDistance = 24
    ) {
        const options = { signal: this.events.signal };
        element.addEventListener('pointerdown', event => {
            if (event.pointerType === 'mouse') return;
            this.starts.set(event.pointerId, { x: event.clientX, y: event.clientY, consumed: false });
            try { element.setPointerCapture(event.pointerId); }
            catch { this.starts.delete(event.pointerId); }
        }, options);
        const recognize = (event: PointerEvent): void => {
            const start = this.starts.get(event.pointerId);
            if (!start || start.consumed) return;
            const x = event.clientX - start.x;
            const y = event.clientY - start.y;
            if (Math.max(Math.abs(x), Math.abs(y)) < minDistance) return;
            start.consumed = true;
            input.pulse(Math.abs(x) > Math.abs(y)
                ? (x > 0 ? InputAction.Right : InputAction.Left)
                : (y < 0 ? InputAction.Jump : InputAction.Slide));
        };
        element.addEventListener('pointermove', recognize, options);
        element.addEventListener('pointerup', event => {
            recognize(event);
            this.starts.delete(event.pointerId);
        }, options);
        element.addEventListener('pointercancel', event => {
            this.starts.delete(event.pointerId);
        }, options);
        element.addEventListener('lostpointercapture', event => {
            this.starts.delete(event.pointerId);
        }, options);
        element.addEventListener('contextmenu', event => event.preventDefault(), options);
        bindInterruptions(element, () => this.reset(), this.events.signal);
    }

    public reset(): void {
        const ids = [...this.starts.keys()];
        this.starts.clear();
        for (const id of ids) releaseCapture(this.element, id);
    }

    public dispose(): void {
        this.events.abort();
        this.reset();
    }
}

interface ButtonPointer {
    readonly id: number;
    readonly capture: HTMLElement;
    target: HTMLElement | null;
}

export class ButtonInput {
    private readonly holds: HeldInputScope;
    private readonly events = new AbortController();
    private readonly pointers = new Map<number, ButtonPointer>();

    constructor(
        private readonly buttons: ReadonlyMap<HTMLElement, InputAction>,
        input: Pick<IInputWriter, 'press' | 'release' | 'pulse'>
    ) {
        const options = { signal: this.events.signal };
        this.holds = new HeldInputScope(input);
        for (const [button, action] of buttons) {
            button.addEventListener('pointerdown', event => {
                if (event.pointerType === 'mouse' && event.button !== 0) return;
                event.preventDefault();
                this.finish(event.pointerId);
                const pointer: ButtonPointer = { id: event.pointerId, capture: button, target: null };
                this.pointers.set(pointer.id, pointer);
                try { button.setPointerCapture(pointer.id); }
                catch { this.finish(pointer.id); return; }
                this.retarget(pointer, button);
            }, options);
            button.addEventListener('pointermove', event => {
                const pointer = this.pointers.get(event.pointerId);
                if (!pointer || pointer.capture !== button) return;
                event.preventDefault();
                this.retarget(pointer, this.hitTest(event.clientX, event.clientY));
            }, options);
            const release = (event: PointerEvent): void => {
                if (this.pointers.get(event.pointerId)?.capture !== button) return;
                event.preventDefault();
                this.finish(event.pointerId);
            };
            button.addEventListener('pointerup', release, options);
            button.addEventListener('pointercancel', release, options);
            button.addEventListener('lostpointercapture', release, options);
            button.addEventListener('contextmenu', event => event.preventDefault(), options);
            button.addEventListener('click', event => {
                // Native keyboard and assistive activation have no preceding pointer hold.
                if (event.detail === 0 && !(event as PointerEvent).pointerType) input.pulse(action);
            }, options);
        }
        const firstButton = buttons.keys().next().value;
        if (firstButton) bindInterruptions(firstButton, () => this.reset(), this.events.signal);
    }

    private source(id: number): string { return 'button:' + id; }

    private hitTest(x: number, y: number): HTMLElement | null {
        for (const button of this.buttons.keys()) {
            const bounds = button.getBoundingClientRect();
            if (x >= bounds.left && x < bounds.right && y >= bounds.top && y < bounds.bottom) return button;
        }
        return null;
    }

    private retarget(pointer: ButtonPointer, target: HTMLElement | null): void {
        if (pointer.target === target) return;
        pointer.target = target;
        const action = target ? this.buttons.get(target) : undefined;
        if (action === undefined) this.holds.release(this.source(pointer.id));
        else this.holds.press(this.source(pointer.id), action);
        this.updateFeedback();
    }

    private updateFeedback(): void {
        for (const button of this.buttons.keys()) {
            let held = false;
            for (const pointer of this.pointers.values()) {
                if (pointer.target === button) { held = true; break; }
            }
            button.classList.toggle('is-held', held);
        }
    }

    private finish(id: number): void {
        const pointer = this.pointers.get(id);
        if (!pointer) return;
        this.pointers.delete(id);
        this.holds.release(this.source(id));
        this.updateFeedback();
        releaseCapture(pointer.capture, id);
    }

    public reset(): void {
        for (const id of [...this.pointers.keys()]) this.finish(id);
    }

    public dispose(): void {
        this.events.abort();
        this.reset();
    }
}
