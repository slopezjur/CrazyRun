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
    
    private touchStartX: number = 0;
    private touchStartY: number = 0;
    private readonly minSwipeDistance: number = 30; // pixels

    constructor() {
        this.setDefaultBindings();
        window.addEventListener('keydown', this.onKeyDown.bind(this));
        window.addEventListener('keyup', this.onKeyUp.bind(this));
        this.initTouchControls();
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

    private triggerAction(action: InputAction): void {
        if (!this.activeActions.has(action)) {
            this.triggeredActions.add(action);
        }
        this.activeActions.add(action);
    }

    private releaseAction(action: InputAction): void {
        this.activeActions.delete(action);
    }

    private onKeyDown(e: KeyboardEvent): void {
        const action = this.keyBindings.get(e.code);
        if (action !== undefined) {
            e.preventDefault();
            this.triggerAction(action);
        }
    }

    private onKeyUp(e: KeyboardEvent): void {
        const action = this.keyBindings.get(e.code);
        if (action !== undefined) {
            this.releaseAction(action);
        }
    }

    private initTouchControls(): void {
        // Swipe Detection on window
        window.addEventListener('touchstart', (e: TouchEvent) => {
            if (e.touches.length > 0) {
                this.touchStartX = e.touches[0].clientX;
                this.touchStartY = e.touches[0].clientY;
            }
        }, { passive: true });

        window.addEventListener('touchend', (e: TouchEvent) => {
            if (e.changedTouches.length > 0) {
                const deltaX = e.changedTouches[0].clientX - this.touchStartX;
                const deltaY = e.changedTouches[0].clientY - this.touchStartY;
                const absX = Math.abs(deltaX);
                const absY = Math.abs(deltaY);

                if (Math.max(absX, absY) > this.minSwipeDistance) {
                    if (absX > absY) {
                        // Horizontal Swipe
                        if (deltaX > 0) {
                            this.triggerAction(InputAction.Right);
                        } else {
                            this.triggerAction(InputAction.Left);
                        }
                    } else {
                        // Vertical Swipe
                        if (deltaY < 0) {
                            this.triggerAction(InputAction.Jump);
                        } else {
                            this.triggerAction(InputAction.Slide);
                        }
                    }
                }
            }
        }, { passive: true });

        // Virtual Touch Buttons
        const bindTouchButton = (elementId: string, action: InputAction) => {
            const btn = document.getElementById(elementId);
            if (!btn) return;

            const handlePress = (e: Event) => {
                e.preventDefault();
                e.stopPropagation();
                this.triggerAction(action);
            };

            const handleRelease = (e: Event) => {
                e.preventDefault();
                e.stopPropagation();
                this.releaseAction(action);
            };

            btn.addEventListener('touchstart', handlePress, { passive: false });
            btn.addEventListener('touchend', handleRelease, { passive: false });
            btn.addEventListener('touchcancel', handleRelease, { passive: false });
            btn.addEventListener('mousedown', handlePress);
            btn.addEventListener('mouseup', handleRelease);
            btn.addEventListener('mouseleave', handleRelease);
        };

        bindTouchButton('btn-touch-left', InputAction.Left);
        bindTouchButton('btn-touch-right', InputAction.Right);
        bindTouchButton('btn-touch-jump', InputAction.Jump);
        bindTouchButton('btn-touch-slide', InputAction.Slide);
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
