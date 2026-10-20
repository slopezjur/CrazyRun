export enum InputAction {
    Left,
    Right,
    Jump,
    Slide
}

export interface IInputReader {
    isActionActive(action: InputAction): boolean;
    isActionTriggered(action: InputAction): boolean;
}

export type InputSourceId = string | symbol;

export interface IInputWriter {
    press(source: InputSourceId, action: InputAction): void;
    release(source: InputSourceId): void;
    pulse(action: InputAction): void;
    reset(): void;
}

export class InputManager implements IInputReader, IInputWriter {
    private readonly sources = new Map<InputSourceId, InputAction>();
    private readonly activeCounts = new Map<InputAction, number>();
    private readonly triggeredActions = new Set<InputAction>();

    public press(source: InputSourceId, action: InputAction): void {
        if (this.sources.get(source) === action) return;
        this.release(source);
        const count = this.activeCounts.get(action) ?? 0;
        if (count === 0) this.triggeredActions.add(action);
        this.activeCounts.set(action, count + 1);
        this.sources.set(source, action);
    }

    public release(source: InputSourceId): void {
        const action = this.sources.get(source);
        if (action === undefined) return;
        this.sources.delete(source);
        const count = (this.activeCounts.get(action) ?? 1) - 1;
        if (count === 0) this.activeCounts.delete(action);
        else this.activeCounts.set(action, count);
    }

    public pulse(action: InputAction): void {
        this.triggeredActions.add(action);
    }

    public isActionActive(action: InputAction): boolean {
        return this.activeCounts.has(action);
    }

    public isActionTriggered(action: InputAction): boolean {
        return this.triggeredActions.has(action);
    }

    public resetTriggers(): void {
        this.triggeredActions.clear();
    }

    public reset(): void {
        this.sources.clear();
        this.activeCounts.clear();
        this.resetTriggers();
    }
}

/** Owns held input IDs so independent adapters cannot release each other's actions. */
export class HeldInputScope {
    private readonly sources = new Map<string, symbol>();

    constructor(private readonly input: Pick<IInputWriter, 'press' | 'release'>) {}

    public press(key: string, action: InputAction): void {
        let source = this.sources.get(key);
        if (source === undefined) {
            source = Symbol(key);
            this.sources.set(key, source);
        }
        this.input.press(source, action);
    }

    public release(key: string): void {
        const source = this.sources.get(key);
        if (source === undefined) return;
        this.sources.delete(key);
        this.input.release(source);
    }

    public releaseAll(): void {
        for (const source of this.sources.values()) this.input.release(source);
        this.sources.clear();
    }
}
