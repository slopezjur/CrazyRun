import * as THREE from 'three/webgpu';
import type { IResourceDisposer } from '../../core/ResourceManager';
import type { GhostFrame, IGhostPlayback } from '../GhostData';
import type { PlayerPose } from '../PlayerPresentation';
import type { IAppearanceSource } from '../Progression';
import type { RunEvent, IRunState } from '../RunSession';

import { TRAIL_COLORS } from './CosmeticVisuals';

interface Particle { mesh: THREE.Mesh; velocity: THREE.Vector3; life: number; }

export class RunEffects {
    private readonly root = new THREE.Group();
    private readonly particles: Particle[] = [];
    private readonly ghost: THREE.Mesh;
    private readonly shield: THREE.Mesh;
    private readonly frame: GhostFrame = [0, 0, 0, 0, 1, 0];
    private cursor = 0;
    private trailTimer = 0;
    public ghostDistance: number | null = null;

    constructor(scene: THREE.Scene, private readonly resources: IResourceDisposer) {
        const geometry = new THREE.IcosahedronGeometry(0.09);
        const material = new THREE.MeshStandardNodeMaterial({
            color: 0xffd66b, emissive: 0xffbd42, emissiveIntensity: 1
        });
        for (let index = 0; index < 96; index++) {
            const mesh = new THREE.Mesh(geometry, material);
            mesh.visible = false;
            this.root.add(mesh);
            this.particles.push({ mesh, velocity: new THREE.Vector3(), life: 0 });
        }
        this.ghost = new THREE.Mesh(new THREE.CapsuleGeometry(0.45, 1, 4, 12),
            new THREE.MeshStandardNodeMaterial({
                color: 0xc5e7ff, emissive: 0x5b96ba, transparent: true, opacity: 0.28, depthWrite: false
            }));
        this.shield = new THREE.Mesh(new THREE.TorusGeometry(0.85, 0.04, 8, 32),
            new THREE.MeshStandardNodeMaterial({ color: 0x88ffce, emissive: 0x55ffb0, emissiveIntensity: 0.7 }));
        this.ghost.visible = this.shield.visible = false;
        this.root.add(this.ghost, this.shield);
        scene.add(this.root);
    }

    public event(event: RunEvent, motion: number): void {
        if (motion <= 0 || !event.position) return;
        for (let i = 0; i < Math.ceil((event.type === 'coin' ? 5 : 14) * motion); i++) {
            const particle = this.particles[this.cursor++ % this.particles.length];
            particle.mesh.position.set(...event.position);
            particle.mesh.scale.setScalar(1);
            particle.mesh.visible = true;
            particle.life = 0.5;
            particle.velocity.set((Math.random() - 0.5) * 5, 2 + Math.random() * 3, (Math.random() - 0.5) * 3);
        }
    }

    public reset(): void {
        for (const particle of this.particles) { particle.life = 0; particle.mesh.visible = false; }
        this.ghost.visible = this.shield.visible = false;
        this.trailTimer = 0;
        this.ghostDistance = null;
    }

    public update(delta: number, speed: number, pose: Readonly<PlayerPose>, run: Pick<IRunState, 'crazyRemaining' | 'shield' | 'graceRemaining' | 'elapsed' | 'stats'>,
        profile: IAppearanceSource, replay: IGhostPlayback, playing: boolean): void {
        for (const particle of this.particles) {
            if (particle.life <= 0) continue;
            particle.life -= delta;
            particle.mesh.visible = particle.life > 0 && profile.motion > 0;
            particle.mesh.position.addScaledVector(particle.velocity, delta);
            particle.mesh.position.z += speed * delta;
            particle.mesh.scale.setScalar(Math.max(0, particle.life * 2));
        }
        this.trailTimer += delta;
        if (playing && profile.motion > 0 && (profile.appearance.trail !== 'none' || run.crazyRemaining > 0)
            && this.trailTimer >= 0.06 / profile.motion) {
            this.trailTimer = 0;
            const particle = this.particles[this.cursor++ % this.particles.length];
            particle.mesh.position.set(pose.x, pose.y - 0.4, 0.5);
            particle.mesh.visible = true;
            particle.life = 0.45;
            particle.velocity.set(0, 0.3, 0);
        }
        const material = this.particles[0].mesh.material as THREE.MeshStandardNodeMaterial;
        const color = run.crazyRemaining > 0 ? 0xff75ce : (TRAIL_COLORS.get(profile.appearance.trail) ?? 0xffd66b);
        material.color.setHex(color);
        material.emissive.setHex(color);
        this.shield.visible = playing && (run.shield || run.graceRemaining > 0 || run.crazyRemaining > 0);
        this.shield.position.set(pose.x, pose.y, 0);
        this.shield.rotation.y = run.elapsed * profile.motion;
        this.ghost.visible = playing && profile.ghostEnabled && replay.sample(run.elapsed, this.frame);
        this.ghostDistance = this.ghost.visible ? this.frame[1] - run.stats.distance : null;
        if (this.ghost.visible) {
            this.ghost.position.set(this.frame[2], this.frame[3], run.stats.distance - this.frame[1]);
            this.ghost.scale.y = this.frame[4];
            this.ghost.rotation.x = this.frame[5];
        }
    }

    public dispose(): void { this.resources.dispose(this.root); this.root.removeFromParent(); }
}
