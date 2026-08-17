import * as THREE from 'three/webgpu';

export class AudioManager {
    private listener: THREE.AudioListener;
    private ctx: AudioContext;
    private masterGain: GainNode;
    private _isMuted: boolean = false;
    private readonly STORAGE_KEY = 'crazyrun_muted';

    constructor(private camera: THREE.Camera) {
        this.listener = new THREE.AudioListener();
        this.camera.add(this.listener);
        this.ctx = this.listener.context;

        this.masterGain = this.ctx.createGain();
        this.masterGain.connect(this.ctx.destination);

        const savedMute = localStorage.getItem(this.STORAGE_KEY);
        if (savedMute === 'true') {
            this.setMuted(true);
        }
    }

    public get isMuted(): boolean {
        return this._isMuted;
    }

    public setMuted(muted: boolean): void {
        this._isMuted = muted;
        localStorage.setItem(this.STORAGE_KEY, muted.toString());
        this.masterGain.gain.setValueAtTime(muted ? 0 : 1, this.ctx.currentTime);
    }

    public toggleMute(): boolean {
        this.setMuted(!this._isMuted);
        return this._isMuted;
    }

    private resumeContext(): void {
        if (this.ctx && this.ctx.state === 'suspended') {
            this.ctx.resume().catch(() => {});
        }
    }

    /**
     * Classic 2-tone arcade coin pickup chime (B5 -> E6)
     */
    public playCoinSound(): void {
        if (this._isMuted) return;
        this.resumeContext();
        const now = this.ctx.currentTime;

        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(987.77, now);
        osc.frequency.setValueAtTime(1318.51, now + 0.08);

        gain.gain.setValueAtTime(0.35, now);
        gain.gain.setValueAtTime(0.35, now + 0.08);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);

        osc.connect(gain);
        gain.connect(this.masterGain);

        osc.start(now);
        osc.stop(now + 0.36);
    }

    /**
     * Upward pitch sweep for jumping
     */
    public playJumpSound(): void {
        if (this._isMuted) return;
        this.resumeContext();
        const now = this.ctx.currentTime;

        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = 'triangle';
        osc.frequency.setValueAtTime(150, now);
        osc.frequency.exponentialRampToValueAtTime(450, now + 0.15);

        gain.gain.setValueAtTime(0.25, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);

        osc.connect(gain);
        gain.connect(this.masterGain);

        osc.start(now);
        osc.stop(now + 0.19);
    }

    /**
     * Friction whoosh sound for sliding
     */
    public playSlideSound(): void {
        if (this._isMuted) return;
        this.resumeContext();
        const now = this.ctx.currentTime;

        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(240, now);
        osc.frequency.exponentialRampToValueAtTime(90, now + 0.22);

        gain.gain.setValueAtTime(0.18, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.24);

        osc.connect(gain);
        gain.connect(this.masterGain);

        osc.start(now);
        osc.stop(now + 0.25);
    }

    /**
     * Heavy bass crunch thud on crash
     */
    public playCrashSound(): void {
        if (this._isMuted) return;
        this.resumeContext();
        const now = this.ctx.currentTime;

        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = 'square';
        osc.frequency.setValueAtTime(160, now);
        osc.frequency.exponentialRampToValueAtTime(30, now + 0.4);

        gain.gain.setValueAtTime(0.4, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.42);

        osc.connect(gain);
        gain.connect(this.masterGain);

        osc.start(now);
        osc.stop(now + 0.43);
    }

    public playBGM(): void {
        this.resumeContext();
    }

    public pauseBGM(): void {
        // Reserved for background music tracks
    }
}
