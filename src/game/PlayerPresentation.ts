export interface PlayerPose {
    x: number;
    y: number;
    z: number;
    scaleY: number;
    tiltX: number;
}

export type PlayerAnimation = 'Run' | 'Jump' | 'Slide' | 'Die';

export interface IPlayerPresentation {
    setPose(pose: Readonly<PlayerPose>): void;
    setAnimation(animation: PlayerAnimation, speed: number): void;
    update(delta: number): void;
}
