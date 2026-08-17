import * as THREE from 'three/webgpu';

export class AudioManager {
    private listener: THREE.AudioListener;
    private loader: THREE.AudioLoader = new THREE.AudioLoader();
    private bgm?: THREE.Audio;
    private coinBuffer?: AudioBuffer;

    constructor(private camera: THREE.Camera) {
        this.listener = new THREE.AudioListener();
        this.camera.add(this.listener);

        this.initBGM();
        this.initSFX();
    }

    private async initBGM(): Promise<void> {
        this.bgm = new THREE.Audio(this.listener);
        try {
            const buffer = await this.loader.loadAsync('/assets/bgm.mp3');
            this.bgm.setBuffer(buffer);
            this.bgm.setLoop(true);
            this.bgm.setVolume(0.5);
        } catch (e) {
            console.warn('[AudioManager] BGM file not found. Skipping background music.');
        }
    }

    private async initSFX(): Promise<void> {
        try {
            this.coinBuffer = await this.loader.loadAsync('/assets/coin.wav');
        } catch (e) {
            console.warn('[AudioManager] Coin SFX file not found. Skipping coin sound.');
        }
    }

    public playBGM(): void {
        if (this.bgm && this.bgm.buffer && !this.bgm.isPlaying) {
            this.bgm.play();
        }
    }

    public pauseBGM(): void {
        if (this.bgm && this.bgm.isPlaying) {
            this.bgm.pause();
        }
    }

    public playCoinSound(position: THREE.Vector3): void {
        if (!this.coinBuffer) return;

        const sound = new THREE.PositionalAudio(this.listener);
        sound.setBuffer(this.coinBuffer);
        sound.setRefDistance(5);
        sound.position.copy(position);
        
        // Connect to scene for spatiality
        sound.play();
    }
}
