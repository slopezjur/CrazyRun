import * as THREE from 'three/webgpu';
import { InputManager, InputAction } from '../core/InputManager';
import { IBoundingVolume } from './CollisionManager';
import { MaterialFactory } from './graphics/MaterialFactory';
import { AnimationController } from './graphics/AnimationController';
import { ResourceManager } from '../core/ResourceManager';

export class Player implements IBoundingVolume {
    public mesh: THREE.Group;
    // Lane Configuration
    private currentLane: number = 0; // -1 (Left), 0 (Center), 1 (Right)
    private readonly laneWidth: number = 1.5;
    private readonly laneLerpSpeed: number = 10.0;
    
    // Physics Configuration
    private yVelocity: number = 0;
    private readonly gravity: number = -30.0;
    private readonly jumpImpulse: number = 12.0;
    private isGrounded: boolean = true;
    
    // Slide mechanics
    private isSliding: boolean = false;
    private slideTimer: number = 0;
    private readonly slideDuration: number = 1.0; // seconds
    private readonly normalScaleY: number = 1.0;
    private readonly slideScaleY: number = 0.5;

    // Anchor
    private readonly startZ: number = 0.0;
    
    // Animation
    private animController: AnimationController = new AnimationController();
    private currentAnimState: string = 'Run';
    
    public boundingBox: THREE.Box3 = new THREE.Box3();
    public onJump?: () => void;
    public onSlide?: () => void;

    public get z(): number {
        return this.mesh.position.z;
    }

    constructor(private scene: THREE.Scene, private inputManager: InputManager) {
        this.mesh = new THREE.Group();
        this.mesh.position.set(0, 1, this.startZ);
        this.scene.add(this.mesh);

        // Fallback Player Representation
        const fallbackGeometry = new THREE.CapsuleGeometry(0.5, 1, 4, 16);
        const fallbackMat = MaterialFactory.createCurvedMaterial(0x00ff00);
        const fallbackMesh = new THREE.Mesh(fallbackGeometry, fallbackMat);
        fallbackMesh.castShadow = true;
        fallbackMesh.receiveShadow = true;
        this.mesh.add(fallbackMesh);
        
        this.syncBounds();

        // Asynchronous Character Loading
        ResourceManager.loadModel('/models/character.glb').then(gltf => {
            if (gltf) {
                    this.mesh.remove(fallbackMesh);
                    const characterModel = gltf.scene;
                    
                    // Configure shadows and materials
                    characterModel.traverse((child: any) => {
                        if (child.isMesh) {
                            child.castShadow = true;
                            child.receiveShadow = true;
                            if (child.material) {
                                child.material = MaterialFactory.upgradeToCurvedMaterial(child.material);
                            }
                        }
                    });
                    
                    // Scale down Mixamo models (often export at 100x scale)
                    characterModel.scale.set(0.01, 0.01, 0.01); 
                    characterModel.position.y = -1; // Align origin to bottom
                    
                    this.mesh.add(characterModel);
                    
                    this.animController.initialize(characterModel);
                    
                    // Map animations by name (assuming Mixamo standard naming if merged)
                    gltf.animations.forEach(clip => {
                        // Use the clip name, but normalize it for our state machine
                        let normalizedName = clip.name;
                        if (normalizedName.toLowerCase().includes('run')) normalizedName = 'Run';
                        if (normalizedName.toLowerCase().includes('jump')) normalizedName = 'Jump';
                        if (normalizedName.toLowerCase().includes('slide')) normalizedName = 'Slide';
                        if (normalizedName.toLowerCase().includes('die') || normalizedName.toLowerCase().includes('fall')) normalizedName = 'Die';
                        
                        this.animController.registerAction(normalizedName, clip);
                    });
                    
                    this.animController.fadeToAction('Run', 0.0);
                }
            });
    }

    public fixedUpdate(fixedDelta: number, globalSpeed: number): void {
        if (globalSpeed === 0) {
            // Player is crashed: freeze physics and cooldowns to maintain crash pose
            this.syncBounds();
            this.updateAnimationState(globalSpeed);
            return;
        }

        this.handleInput();
        this.applyLaneMovement(fixedDelta);
        this.applySlideInterpolation(fixedDelta);
        this.applyPhysics(fixedDelta);
        this.handleSlideCooldown(fixedDelta);
        this.syncBounds();
        this.updateAnimationState(globalSpeed);
    }

    private updateAnimationState(globalSpeed: number): void {
        let newState = 'Run';
        
        if (globalSpeed === 0) {
            newState = 'Die';
        } else if (this.isSliding) {
            newState = 'Slide';
        } else if (!this.isGrounded) {
            newState = 'Jump';
        }
        
        if (newState !== this.currentAnimState) {
            this.animController.fadeToAction(newState, 0.2);
            this.currentAnimState = newState;
        } else if (newState === 'Run') {
            const runAction = this.animController.getAction('Run');
            if (runAction) {
                // Assuming base speed 30 units/sec matches animation timescale 1.0
                runAction.setEffectiveTimeScale(Math.max(1.0, globalSpeed / 30.0));
            }
        }
    }

    public update(deltaTime: number): void {
        this.animController.update(deltaTime);
    }

    private syncBounds(): void {
        this.boundingBox.setFromObject(this.mesh);
    }

    private handleInput(): void {
        if (this.inputManager.isActionTriggered(InputAction.Left) && this.currentLane > -1) {
            this.currentLane--;
        }
        
        if (this.inputManager.isActionTriggered(InputAction.Right) && this.currentLane < 1) {
            this.currentLane++;
        }

        if (this.inputManager.isActionTriggered(InputAction.Jump) && this.isGrounded) {
            this.yVelocity = this.jumpImpulse;
            this.isGrounded = false;
            // Interrupt slide if jumping
            this.endSlide();
            if (this.onJump) this.onJump();
        }

        if (this.inputManager.isActionTriggered(InputAction.Slide) && this.isGrounded) {
            const wasSliding = this.isSliding;
            this.startSlide();
            if (!wasSliding && this.onSlide) this.onSlide();
        }
    }

    private applyLaneMovement(fixedDelta: number): void {
        const targetX = this.currentLane * this.laneWidth;
        // Smooth Interpolation (Lerp)
        this.mesh.position.x += (targetX - this.mesh.position.x) * this.laneLerpSpeed * fixedDelta;
    }

    private applySlideInterpolation(fixedDelta: number): void {
        const targetScaleY = this.isSliding ? this.slideScaleY : this.normalScaleY;
        const targetRotationX = this.isSliding ? -0.4 : 0.0;
        const slideTransitionSpeed = 16.0;

        this.mesh.scale.y += (targetScaleY - this.mesh.scale.y) * slideTransitionSpeed * fixedDelta;
        this.mesh.rotation.x += (targetRotationX - this.mesh.rotation.x) * slideTransitionSpeed * fixedDelta;
    }

    private applyPhysics(fixedDelta: number): void {
        // Apply Gravity
        this.yVelocity += this.gravity * fixedDelta;
        this.mesh.position.y += this.yVelocity * fixedDelta;

        // Dynamic Ground Detection based on continuous scale
        const floorY = this.mesh.scale.y; // Center Y equals scale.y to keep bottom at Y=0

        if (this.mesh.position.y <= floorY) {
            this.mesh.position.y = floorY;
            this.yVelocity = 0;
            this.isGrounded = true;
        } else {
            this.isGrounded = false;
        }
    }

    private startSlide(): void {
        this.isSliding = true;
        this.slideTimer = this.slideDuration;
    }

    private endSlide(): void {
        if (!this.isSliding) return;
        this.isSliding = false;
    }

    private handleSlideCooldown(fixedDelta: number): void {
        if (this.isSliding) {
            if (this.inputManager.isActionActive(InputAction.Slide)) {
                // Keep slide active indefinitely while key/touch is held down
                this.slideTimer = this.slideDuration;
            } else {
                this.slideTimer -= fixedDelta;
                if (this.slideTimer <= 0) {
                    this.endSlide();
                }
            }
        }
    }
}
