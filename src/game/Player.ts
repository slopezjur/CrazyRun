import { InputAction, type IInputReader } from '../core/InputManager';
import { Signal, type Unsubscribe } from '../core/Signal';
import type { IBoundingVolume } from './CollisionManager';
import type { IPlayerPresentation, PlayerAnimation, PlayerPose } from './PlayerPresentation';
import { Box3 } from 'three';

export interface IPlayer {
    fixedUpdate(delta: number, speed: number, acceptInput: boolean): void;
    update(delta: number): void;
    reset(): void;
    onAction(listener: (action: 'jump' | 'slide') => void): Unsubscribe;
}

export interface IPlayerState extends IBoundingVolume {
    readonly currentPose: Readonly<PlayerPose>;
    readonly isSliding: boolean;
}

export class Player implements IPlayer, IPlayerState {
    public readonly boundingBox = new Box3();
    private currentLane = 0;
    private yVelocity = 0;
    private grounded = true;
    private sliding = false;
    private slideTimer = 0;
    private readonly pose: PlayerPose = { x: 0, y: 1, z: 0, scaleY: 1, tiltX: 0 };
    private readonly actions = new Signal<'jump' | 'slide'>();
    private readonly laneWidth = 1.5;
    private readonly gravity = -30;
    private readonly jumpImpulse = 12;
    private readonly slideDuration = 1;

    constructor(
        private readonly input: IInputReader,
        private readonly presentation: IPlayerPresentation
    ) {
        this.reset();
    }

    public get z(): number {
        return this.pose.z;
    }

    public get currentPose(): Readonly<PlayerPose> { return this.pose; }
    public get isSliding(): boolean { return this.sliding; }

    private syncBounds(): void {
        // The gameplay collider is independent of character assets and rendered animation frames.
        this.boundingBox.min.set(this.pose.x - 0.4, this.pose.y - this.pose.scaleY, -0.4);
        this.boundingBox.max.set(this.pose.x + 0.4, this.pose.y + this.pose.scaleY, 0.4);
    }

    public onAction(listener: (action: 'jump' | 'slide') => void): Unsubscribe {
        return this.actions.subscribe(listener);
    }

    public reset(): void {
        this.currentLane = 0;
        this.yVelocity = 0;
        this.grounded = true;
        this.sliding = false;
        this.slideTimer = 0;
        Object.assign(this.pose, { x: 0, y: 1, z: 0, scaleY: 1, tiltX: 0 });
        this.presentation.setPose(this.pose);
        this.syncBounds();
        this.presentation.setAnimation('Run', 30);
    }

    public fixedUpdate(delta: number, speed: number, acceptInput: boolean): void {
        if (speed !== 0) {
            if (acceptInput) this.handleInput();
            this.pose.x += (this.currentLane * this.laneWidth - this.pose.x) * 10 * delta;
            this.pose.scaleY += ((this.sliding ? 0.5 : 1) - this.pose.scaleY) * 16 * delta;
            this.pose.tiltX += ((this.sliding ? -0.4 : 0) - this.pose.tiltX) * 16 * delta;
            this.yVelocity += this.gravity * delta;
            this.pose.y += this.yVelocity * delta;
            if (this.pose.y <= this.pose.scaleY) {
                this.pose.y = this.pose.scaleY;
                this.yVelocity = 0;
                this.grounded = true;
            } else {
                this.grounded = false;
            }
            if (this.sliding) {
                if (this.input.isActionActive(InputAction.Slide)) this.slideTimer = this.slideDuration;
                else this.slideTimer -= delta;
                if (this.slideTimer <= 0) this.sliding = false;
            }
        }
        this.presentation.setPose(this.pose);
        this.syncBounds();
        const animation: PlayerAnimation = speed === 0 ? 'Die'
            : this.sliding ? 'Slide' : !this.grounded ? 'Jump' : 'Run';
        this.presentation.setAnimation(animation, speed);
    }

    private handleInput(): void {
        if (this.input.isActionTriggered(InputAction.Left) && this.currentLane > -1) this.currentLane--;
        if (this.input.isActionTriggered(InputAction.Right) && this.currentLane < 1) this.currentLane++;
        if (this.input.isActionTriggered(InputAction.Jump) && this.grounded) {
            this.yVelocity = this.jumpImpulse;
            this.grounded = false;
            this.sliding = false;
            this.actions.emit('jump');
        }
        if (this.input.isActionTriggered(InputAction.Slide) && this.grounded) {
            if (!this.sliding) this.actions.emit('slide');
            this.sliding = true;
            this.slideTimer = this.slideDuration;
        }
    }

    public update(delta: number): void {
        this.presentation.update(delta);
    }

    public dispose(): void {
        this.actions.clear();
    }
}
