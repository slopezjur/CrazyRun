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

export interface IInputWriter {
    press(source: string, action: InputAction): void;
    release(source: string): void;
    pulse(action: InputAction): void;
    reset(): void;
}

export class InputManager implements IInputReader, IInputWriter {
    private readonly sources = new Map<string, InputAction>();
    private readonly activeCounts = new Map<InputAction, number>();
    private readonly triggeredActions = new Set<InputAction>();

    public press(source: string, action: InputAction): void {
        if (this.sources.get(source) === action) return;
        this.release(source);
        const count = this.activeCounts.get(action) ?? 0;
        if (count === 0) this.triggeredActions.add(action);
        this.activeCounts.set(action, count + 1);
        this.sources.set(source, action);
    }

    public release(source: string): void {
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
