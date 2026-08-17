import * as THREE from 'three/webgpu';
import { GameState, GameStateManager } from './GameStateManager';
import Stats from 'three/examples/jsm/libs/stats.module.js';
import { ResourceManager } from './ResourceManager';

export interface IUpdatable {
    fixedUpdate(fixedDelta: number): void;
    update(deltaTime: number): void; // For rendering interpolation if needed
    dispose?(): void;
}

export class Engine {
    public scene: THREE.Scene;
    public camera: THREE.PerspectiveCamera;
    public renderer: THREE.WebGPURenderer;
    public stateManager: GameStateManager;
    
    private clock: THREE.Clock;
    private updatables: IUpdatable[] = [];
    private stats: Stats;

    // Fixed timestep settings
    private readonly fixedTimeStep = 1 / 60; // 60 ticks per second
    private accumulator = 0;

    // UPS tracking
    private logicUpdatesCount = 0;
    private upsTimer = 0;

    constructor(canvasId: string) {
        const canvas = document.getElementById(canvasId) as HTMLCanvasElement;
        if (!canvas) throw new Error(`Canvas with id ${canvasId} not found`);

        this.renderer = new THREE.WebGPURenderer({ canvas, antialias: true });
        this.renderer.setPixelRatio(window.devicePixelRatio);
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

        this.scene = new THREE.Scene();
        this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
        this.clock = new THREE.Clock();
        
        this.stateManager = new GameStateManager();
        
        this.stats = new Stats();
        document.body.appendChild(this.stats.dom);

        window.addEventListener('resize', this.onResize.bind(this));
        
        // Input interception for global state like Pause
        window.addEventListener('keydown', (e) => {
            if (e.code === 'Escape') {
                if (this.stateManager.currentState === GameState.Playing) {
                    this.stateManager.changeState(GameState.Paused);
                } else if (this.stateManager.currentState === GameState.Paused) {
                    // Reset clock delta to prevent massive catch-up spike when unpausing
                    this.clock.getDelta();
                    this.stateManager.changeState(GameState.Playing);
                } else if (this.stateManager.currentState === GameState.MainMenu) {
                    this.clock.getDelta();
                    this.stateManager.changeState(GameState.Playing);
                }
            }
        });
    }

    private onResize(): void {
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(window.innerWidth, window.innerHeight);
    }

    public addUpdatable(entity: IUpdatable): void {
        this.updatables.push(entity);
    }

    public async start(): Promise<void> {
        await this.renderer.init();
        this.clock.start();
        
        this.renderer.setAnimationLoop(() => {
            this.masterUpdate();
        });
    }

    private masterUpdate(): void {
        this.stats.begin();
        const deltaTime = this.clock.getDelta();
        
        // Prevent spiral of death on extreme lag
        const cappedDelta = Math.min(deltaTime, 0.1);

        if (this.stateManager.currentState !== GameState.Paused) {
            this.accumulator += cappedDelta;
            
            // Fixed logic step
            while (this.accumulator >= this.fixedTimeStep) {
                this.routeFixedUpdate(this.fixedTimeStep);
                this.accumulator -= this.fixedTimeStep;
                this.logicUpdatesCount++;
            }
        }

        // Standard variable update (for interpolation/rendering things)
        for (const entity of this.updatables) {
            if (entity.update) {
                entity.update(cappedDelta);
            }
        }

        // UPS Debug calculation
        this.upsTimer += cappedDelta;
        if (this.upsTimer >= 1.0) {
            this.stateManager.logicalUpdatesPerSecond = this.logicUpdatesCount;
            this.stateManager.updateDebugUI();
            this.logicUpdatesCount = 0;
            this.upsTimer -= 1.0;
        }

        // Render Call explicitly at the very end
        this.renderer.render(this.scene, this.camera);
        this.stats.end();
    }

    private routeFixedUpdate(fixedDelta: number): void {
        switch (this.stateManager.currentState) {
            case GameState.MainMenu:
            case GameState.Playing:
            case GameState.GameOver:
                for (const entity of this.updatables) {
                    entity.fixedUpdate(fixedDelta);
                }
                break;
            case GameState.Paused:
                break;
        }
    }
    
    public dispose(): void {
        this.renderer.setAnimationLoop(null);
        
        for (const entity of this.updatables) {
            if (entity.dispose) {
                entity.dispose();
            }
        }
        
        ResourceManager.dispose(this.scene);
        this.renderer.dispose();
        
        if (this.stats && this.stats.dom.parentNode) {
            this.stats.dom.parentNode.removeChild(this.stats.dom);
        }
    }
}
