import * as THREE from 'three/webgpu';
import { Entity } from './entities/Entity';
import { Obstacle, ObstacleType } from './entities/Obstacle';
import { Collectible } from './entities/Collectible';
import { EntityPool } from './entities/EntityPool';

export class EntityManager {
    private obstaclePool: EntityPool<Obstacle>;
    private collectiblePool: EntityPool<Collectible>;
    
    private readonly lanes = [-1.5, 0.0, 1.5];

    constructor(scene: THREE.Scene) {
        this.obstaclePool = new EntityPool<Obstacle>(scene, 30, () => new Obstacle());
        this.collectiblePool = new EntityPool<Collectible>(scene, 30, () => new Collectible());
    }

    public getActiveEntities(): Entity[] {
        const active: Entity[] = [];
        for (const obs of this.obstaclePool.getAll()) {
            if (obs.isActive) active.push(obs);
        }
        for (const coin of this.collectiblePool.getAll()) {
            if (coin.isActive) active.push(coin);
        }
        return active;
    }

    public spawnOnChunk(chunkZ: number): void {
        const numObstacles = Math.floor(Math.random() * 3); 
        const shuffledLanes = [...this.lanes].sort(() => Math.random() - 0.5);
        
        for (let i = 0; i < 3; i++) {
            const laneX = shuffledLanes[i];
            if (i < numObstacles) {
                const obs = this.obstaclePool.getInactive();
                if (obs) {
                    const rand = Math.random();
                    let obstacleType = ObstacleType.FullWall;
                    if (rand < 0.35) {
                        obstacleType = ObstacleType.LowHurdle;
                    } else if (rand < 0.70) {
                        obstacleType = ObstacleType.HighArch;
                    }
                    obs.spawn(laneX, 0, chunkZ, obstacleType);
                }
            } else {
                if (Math.random() > 0.5) {
                    const coin = this.collectiblePool.getInactive();
                    if (coin) coin.spawn(laneX, 0, chunkZ);
                }
            }
        }
    }

    public scroll(amount: number): void {
        for (const obs of this.obstaclePool.getAll()) {
            obs.scroll(amount);
            if (obs.isActive && obs.mesh.position.z > 10) obs.despawn();
        }
        for (const coin of this.collectiblePool.getAll()) {
            coin.scroll(amount);
            if (coin.isActive && coin.mesh.position.z > 10) coin.despawn();
        }
    }

    public fixedUpdate(_fixedDelta: number, gameSpeed: number): void {
        this.scroll(gameSpeed * _fixedDelta);
    }

    public update(deltaTime: number): void {
        for (const coin of this.collectiblePool.getAll()) coin.animate(deltaTime);
        for (const obs of this.obstaclePool.getAll()) obs.animate(deltaTime);
    }
    
    public reset(): void {
        for (const coin of this.collectiblePool.getAll()) coin.despawn();
        for (const obs of this.obstaclePool.getAll()) obs.despawn();
    }
}
