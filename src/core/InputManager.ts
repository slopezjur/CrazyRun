export enum InputAction {
    Left,
    Right,
    Jump,
    Slide
}

export class InputManager {
    private keyBindings: Map<string, InputAction> = new Map();
    private activeActions: Set<InputAction> = new Set();
    private triggeredActions: Set<InputAction> = new Set();
    
    constructor() {
        this.setDefaultBindings();
        window.addEventListener('keydown', this.onKeyDown.bind(this));
        window.addEventListener('keyup', this.onKeyUp.bind(this));
    }

    private setDefaultBindings(): void {
        this.bindKey('KeyA', InputAction.Left);
        this.bindKey('ArrowLeft', InputAction.Left);
        
        this.bindKey('KeyD', InputAction.Right);
        this.bindKey('ArrowRight', InputAction.Right);
        
        this.bindKey('KeyW', InputAction.Jump);
        this.bindKey('ArrowUp', InputAction.Jump);
        this.bindKey('Space', InputAction.Jump);
        
        this.bindKey('KeyS', InputAction.Slide);
        this.bindKey('ArrowDown', InputAction.Slide);
    }

    public bindKey(code: string, action: InputAction): void {
        this.keyBindings.set(code, action);
    }

    private onKeyDown(e: KeyboardEvent): void {
        const action = this.keyBindings.get(e.code);
        if (action !== undefined) {
            e.preventDefault();
            if (!this.activeActions.has(action)) {
                this.triggeredActions.add(action);
            }
            this.activeActions.add(action);
        }
    }

    private onKeyUp(e: KeyboardEvent): void {
        const action = this.keyBindings.get(e.code);
        if (action !== undefined) {
            this.activeActions.delete(action);
        }
    }

    public isActionActive(action: InputAction): boolean {
        return this.activeActions.has(action);
    }

    public isActionTriggered(action: InputAction): boolean {
        return this.triggeredActions.has(action);
    }

    public resetTriggers(): void {
        this.triggeredActions.clear();
    }
}
