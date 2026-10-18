import { InputAction, type IInputWriter } from './InputManager';

export const DEFAULT_KEY_BINDINGS: ReadonlyMap<string, InputAction> = new Map([
    ['KeyA', InputAction.Left], ['ArrowLeft', InputAction.Left],
    ['KeyD', InputAction.Right], ['ArrowRight', InputAction.Right],
    ['KeyW', InputAction.Jump], ['ArrowUp', InputAction.Jump], ['Space', InputAction.Jump],
    ['KeyS', InputAction.Slide], ['ArrowDown', InputAction.Slide]
]);

export class KeyboardInput {
    private readonly events = new AbortController();

    constructor(
        target: Window,
        private readonly input: Pick<IInputWriter, 'press' | 'release' | 'reset'>,
        onPause: () => void,
        bindings: ReadonlyMap<string, InputAction> = DEFAULT_KEY_BINDINGS
    ) {
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
                input.press('keyboard:' + event.code, action);
            }
        }, options);
        target.addEventListener('keyup', event => {
            input.release('keyboard:' + event.code);
        }, options);
        target.addEventListener('blur', () => input.reset(), options);
    }

    public dispose(): void {
        this.events.abort();
        this.input.reset();
    }
}

export class SwipeInput {
    private readonly events = new AbortController();
    private readonly starts = new Map<number, { x: number; y: number }>();

    constructor(
        element: HTMLElement,
        input: Pick<IInputWriter, 'pulse'>,
        minDistance = 30
    ) {
        const options = { signal: this.events.signal };
        element.addEventListener('pointerdown', event => {
            if (event.pointerType === 'mouse') return;
            this.starts.set(event.pointerId, { x: event.clientX, y: event.clientY });
            element.setPointerCapture(event.pointerId);
        }, options);
        element.addEventListener('pointerup', event => {
            const start = this.starts.get(event.pointerId);
            this.starts.delete(event.pointerId);
            if (!start) return;
            const x = event.clientX - start.x;
            const y = event.clientY - start.y;
            if (Math.max(Math.abs(x), Math.abs(y)) <= minDistance) return;
            input.pulse(Math.abs(x) > Math.abs(y)
                ? (x > 0 ? InputAction.Right : InputAction.Left)
                : (y < 0 ? InputAction.Jump : InputAction.Slide));
        }, options);
        element.addEventListener('pointercancel', event => {
            this.starts.delete(event.pointerId);
        }, options);
        element.addEventListener('lostpointercapture', event => {
            this.starts.delete(event.pointerId);
        }, options);
    }

    public dispose(): void {
        this.events.abort();
        this.starts.clear();
    }
}

export class ButtonInput {
    private readonly events = new AbortController();
    private readonly heldSources = new Set<string>();

    constructor(
        buttons: ReadonlyMap<HTMLElement, InputAction>,
        private readonly input: Pick<IInputWriter, 'press' | 'release'>
    ) {
        const options = { signal: this.events.signal };
        let index = 0;
        for (const [button, action] of buttons) {
            const prefix = 'button:' + index++ + ':';
            button.addEventListener('pointerdown', event => {
                event.preventDefault();
                const source = prefix + event.pointerId;
                this.heldSources.add(source);
                input.press(source, action);
                button.setPointerCapture(event.pointerId);
            }, options);
            const release = (event: PointerEvent): void => {
                event.preventDefault();
                const source = prefix + event.pointerId;
                this.heldSources.delete(source);
                input.release(source);
            };
            button.addEventListener('pointerup', release, options);
            button.addEventListener('pointercancel', release, options);
            button.addEventListener('lostpointercapture', release, options);
        }
    }

    public dispose(): void {
        this.events.abort();
        for (const source of this.heldSources) this.input.release(source);
        this.heldSources.clear();
    }
}
