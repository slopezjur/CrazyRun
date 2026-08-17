import * as THREE from 'three/webgpu';
import { IUpdatable } from '../core/Engine';
import { ChunkManager } from './ChunkManager';
import { Player } from './Player';
import { InputManager } from '../core/InputManager';
import { CameraManager } from './CameraManager';
import { EntityManager } from './EntityManager';
import { CollisionManager } from './CollisionManager';
import { ScoreTracker } from './ScoreTracker';
import { AudioManager } from './AudioManager';
import { BrowserStorage } from '../core/StorageService';

export class GameScene implements IUpdatable {
    private chunkManager: ChunkManager;
    private player: Player;
    private inputManager: InputManager;
    private cameraManager: CameraManager;
    private entityManager: EntityManager;
    private collisionManager: CollisionManager;
    public scoreTracker: ScoreTracker;
    public audioManager: AudioManager;
    
    // Global Game Speed
    public globalSpeed: number = 30; // units per second
    private readonly baseSpeed: number = 30;
    private readonly maxSpeed: number = 80;
    
    public isPlaying: boolean = false;
    
    public onGameOver?: () => void;

    constructor(
        private scene: THREE.Scene, 
        private camera: THREE.PerspectiveCamera
    ) {
        this.inputManager = new InputManager();
        this.setupEnvironment();
        this.setupLighting();
        
        this.chunkManager = new ChunkManager(this.scene);
        this.player = new Player(this.scene, this.inputManager);
        this.cameraManager = new CameraManager(this.camera, this.player.mesh);
        
        const storage = new BrowserStorage();
        this.scoreTracker = new ScoreTracker(storage);
        this.audioManager = new AudioManager(this.camera);
        
        this.entityManager = new EntityManager(this.scene);
        
        this.collisionManager = new CollisionManager(
            this.player,
            () => this.entityManager.getActiveEntities(),
            () => {
                if (this.globalSpeed === 0) return; // Prevent multiple triggers
                this.isPlaying = false;
                this.globalSpeed = 0;
                this.cameraManager.triggerShake(2.0); // Trigger shake on crash!
                this.scoreTracker.finalizeScore();
                if (this.onGameOver) this.onGameOver();
            },
            (coin) => {
                this.scoreTracker.addBonus(100);
                this.audioManager.playCoinSound(coin.mesh.position);
            }
        );
        
        // Link Procedural Spawning to Chunk Recycling
        this.chunkManager.onChunkRecycled = (chunkZ: number) => {
            if (this.isPlaying) {
                this.entityManager.spawnOnChunk(chunkZ);
            }
        };
        
        // Initial chunks are NOT pre-populated here. They are populated in reset() when "Play" is clicked.
    }

    private setupEnvironment(): void {
        const skyColor = 0x202020;
        this.scene.background = new THREE.Color(skyColor);
        this.scene.fog = new THREE.Fog(skyColor, 100, 300);
        // Initial setup only, CameraManager takes over
    }

    private setupLighting(): void {
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
        this.scene.add(ambientLight);

        const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
        directionalLight.position.set(5, 10, 5);
        directionalLight.castShadow = true;
        directionalLight.shadow.mapSize.width = 4096;
        directionalLight.shadow.mapSize.height = 4096;
        directionalLight.shadow.camera.near = 0.5;
        directionalLight.shadow.camera.far = 600;
        
        // Define shadow frustum large enough to cover the visible gameplay area
        directionalLight.shadow.camera.left = -90;
        directionalLight.shadow.camera.right = 90;
        directionalLight.shadow.camera.top = 450;
        directionalLight.shadow.camera.bottom = -150;
        
        this.scene.add(directionalLight);
    }

    public fixedUpdate(fixedDelta: number): void {
        this.player.fixedUpdate(fixedDelta, this.globalSpeed);
        
        if (this.isPlaying) {
            this.scoreTracker.update(this.globalSpeed, fixedDelta);
            this.collisionManager.checkCollisions();
        }
        
        this.chunkManager.updatePooling(0.0);
        this.inputManager.resetTriggers();
    }

    public update(deltaTime: number): void {
        // Difficulty Curve (Moved to update for smooth speed scaling)
        if (this.isPlaying && this.globalSpeed > 0 && this.globalSpeed < this.maxSpeed) {
            this.globalSpeed += 1.0 * deltaTime; 
        }

        // Render-specific smooth scrolling
        const scrollAmount = this.globalSpeed * deltaTime;
        this.chunkManager.scroll(scrollAmount);
        this.entityManager.scroll(scrollAmount);

        // Render-specific tracking and animations
        this.cameraManager.update(deltaTime, this.globalSpeed);
        this.entityManager.update(deltaTime);
    }
    
    public reset(): void {
        this.isPlaying = true;
        this.globalSpeed = this.baseSpeed;
        this.scoreTracker.reset();
        this.chunkManager.reset();
        this.entityManager.reset();
        
        // Repopulate initial chunks
        for (let i = 10; i < 40; i++) {
            this.entityManager.spawnOnChunk(-i * 30);
        }
        
        // Reset player
        this.player.mesh.position.set(0, 1, 0);
    }
}
