import type { SoundDefinition } from '../AudioManager';

export const SOUNDS: ReadonlyMap<string, SoundDefinition> = new Map([
    ['bass', {
        waveform: 'sine', startFrequency: 82.41, endFrequency: 65.41,
        frequencyEnd: 0.15, frequencyMode: 'exponential', volume: 0.055,
        fadeStart: 0.04, fadeEnd: 0.23, duration: 0.24
    }],
    ['melody', {
        waveform: 'triangle', startFrequency: 329.63, endFrequency: 329.63,
        frequencyEnd: 0.1, frequencyMode: 'step', volume: 0.035,
        fadeStart: 0.03, fadeEnd: 0.18, duration: 0.19
    }],
    ['reward', {
        waveform: 'sine', startFrequency: 523.25, endFrequency: 1046.5,
        frequencyEnd: 0.15, frequencyMode: 'exponential', volume: 0.14,
        fadeStart: 0.1, fadeEnd: 0.4, duration: 0.41
    }],
    ['warning', {
        waveform: 'triangle', startFrequency: 220, endFrequency: 440,
        frequencyEnd: 0.2, frequencyMode: 'step', volume: 0.13,
        fadeStart: 0.2, fadeEnd: 0.5, duration: 0.51
    }],
    ['coin', {
        waveform: 'sine', startFrequency: 987.77, endFrequency: 1318.51,
        frequencyEnd: 0.08, frequencyMode: 'step', volume: 0.35,
        fadeStart: 0.08, fadeEnd: 0.35, duration: 0.36
    }],
    ['jump', {
        waveform: 'triangle', startFrequency: 150, endFrequency: 450,
        frequencyEnd: 0.15, frequencyMode: 'exponential', volume: 0.25,
        fadeStart: 0, fadeEnd: 0.18, duration: 0.19
    }],
    ['slide', {
        waveform: 'sawtooth', startFrequency: 240, endFrequency: 90,
        frequencyEnd: 0.22, frequencyMode: 'exponential', volume: 0.18,
        fadeStart: 0, fadeEnd: 0.24, duration: 0.25
    }],
    ['crash', {
        waveform: 'square', startFrequency: 160, endFrequency: 30,
        frequencyEnd: 0.4, frequencyMode: 'exponential', volume: 0.4,
        fadeStart: 0, fadeEnd: 0.42, duration: 0.43
    }]
]);
