import * as THREE from 'three/webgpu';

export class CameraManager {
    // Positioning
    private readonly zOffset: number = 8.0;
    private readonly yOffset: number = 3.0;
    
    // Dampening / Lerping
    private readonly positionLerpSpeed: number = 5.0; // Higher = tighter tracking
    
    // Focal Point
    private focalPoint: THREE.Vector3 = new THREE.Vector3(0, 0, -20);
    
    // FOV Dynamics
    private readonly baseFov: number = 60.0;
    private readonly maxFov: number = 80.0;
    private readonly fovLerpSpeed: number = 2.0;
    private currentFov: number = 60.0;

    constructor(
        private camera: THREE.PerspectiveCamera,
        private target: THREE.Object3D
    ) {
        this.camera.position.set(0, this.yOffset, this.zOffset);
        this.camera.fov = this.baseFov;
        this.camera.updateProjectionMatrix();
    }

    public update(deltaTime: number, globalSpeed: number): void {
        this.updatePosition(deltaTime);
        this.updateRotation();
        this.updateFOV(deltaTime, globalSpeed);
    }

    // Camera Shake
    private shakeIntensity: number = 0;
    private readonly shakeDecay: number = 5.0;
    private basePosition: THREE.Vector3 = new THREE.Vector3(0, 3.0, 8.0);

    private updatePosition(deltaTime: number): void {
        // Target coordinates (X follows player exactly, Y follows player with offset, Z is strictly static)
        const targetX = this.target.position.x;
        const targetY = this.target.position.y + this.yOffset;
        
        // Dampened Lerp for X and Y to prevent motion sickness
        this.basePosition.x += (targetX - this.basePosition.x) * this.positionLerpSpeed * deltaTime;
        this.basePosition.y += (targetY - this.basePosition.y) * this.positionLerpSpeed * deltaTime;
        this.basePosition.z = this.zOffset;
        
        this.camera.position.copy(this.basePosition);
        
        // Apply Shake
        if (this.shakeIntensity > 0) {
            const offsetX = (Math.random() - 0.5) * this.shakeIntensity;
            const offsetY = (Math.random() - 0.5) * this.shakeIntensity;
            this.camera.position.x += offsetX;
            this.camera.position.y += offsetY;
            
            this.shakeIntensity -= this.shakeDecay * deltaTime;
            if (this.shakeIntensity < 0) this.shakeIntensity = 0;
        }
    }

    public triggerShake(intensity: number = 1.5): void {
        this.shakeIntensity = intensity;
    }

    public reset(): void {
        this.shakeIntensity = 0;
        this.basePosition.set(0, this.yOffset, this.zOffset);
        this.camera.position.set(0, this.yOffset, this.zOffset);
        this.currentFov = this.baseFov;
        this.camera.fov = this.baseFov;
        this.camera.updateProjectionMatrix();
    }

    private updateRotation(): void {
        // The focal point is deep in the horizon but matches the camera's X to look straight down the track
        this.focalPoint.x = this.camera.position.x * 0.5; // Slight look-ahead tracking
        this.focalPoint.y = this.target.position.y; // Look slightly down towards player height
        
        this.camera.lookAt(this.focalPoint);
    }

    private updateFOV(deltaTime: number, globalSpeed: number): void {
        // Assuming a standard max speed around 100 for normalization
        const normalizedSpeed = Math.max(0, Math.min(globalSpeed / 100, 1.0));
        
        const targetFov = this.baseFov + (this.maxFov - this.baseFov) * normalizedSpeed;
        
        // Lerp FOV smoothly
        const previousFov = this.currentFov;
        this.currentFov += (targetFov - this.currentFov) * this.fovLerpSpeed * deltaTime;
        
        // Only update projection matrix if the FOV has significantly changed
        if (Math.abs(this.currentFov - previousFov) > 0.01) {
            this.camera.fov = this.currentFov;
            this.camera.updateProjectionMatrix();
        }
    }
}
