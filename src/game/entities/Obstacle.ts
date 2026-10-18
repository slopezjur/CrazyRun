import { Entity, type EntityVisual } from './Entity';
import type { CollisionResponse } from '../CollisionManager';

export class Obstacle extends Entity {
    constructor(visual: EntityVisual, private readonly onCrash: () => void) {
        super(visual);
    }

    public onCollide(): CollisionResponse {
        this.onCrash();
        return 'stop';
    }
}
