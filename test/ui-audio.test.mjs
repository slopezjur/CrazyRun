import test from 'node:test';
import assert from 'node:assert/strict';
import { GameState, GameStateManager } from '../src/core/GameStateManager.ts';
import { I18nService } from '../src/core/I18nService.ts';
import { AudioManager } from '../src/game/AudioManager.ts';
import { LOCALES } from '../src/ui/translations.ts';
import { UIManager } from '../src/ui/UIManager.ts';

class Element extends EventTarget {
    textContent = '';
    dataset = {};
    classes = new Set();
    classList = {
        toggle: (name, enabled) => {
            if (enabled) this.classes.add(name);
            else this.classes.delete(name);
        }
    };
    blur() {}
}

test('UI uses injected services, locale labels and removable event subscriptions', () => {
    const ids = ['panel-main-menu', 'panel-hud', 'panel-paused', 'panel-game-over',
        'score-display', 'final-score-display', 'high-score-display', 'btn-play',
        'btn-resume', 'btn-restart', 'btn-lang', 'btn-audio'];
    const elements = new Map(ids.map(id => [id, new Element()]));
    const label = new Element();
    label.dataset.i18n = 'btnPlay';
    const document = {
        documentElement: { lang: '' },
        activeElement: null,
        getElementById: id => elements.get(id) ?? null,
        querySelectorAll: () => [label]
    };
    const state = new GameStateManager();
    const localization = new I18nService({ load: () => 'en', save() {} }, 'en', LOCALES);
    const commands = [];
    const audio = { isMuted: false, toggleMute() { this.isMuted = !this.isMuted; return this.isMuted; } };
    const ui = new UIManager(document, state, localization, audio, {
        play: () => commands.push('play'), resume: () => commands.push('resume'), restart: () => commands.push('restart')
    });
    const click = id => elements.get(id).dispatchEvent(new Event('click'));
    click('btn-play');
    click('btn-resume');
    click('btn-restart');
    assert.deepEqual(commands, ['play', 'resume', 'restart']);
    click('btn-lang');
    assert.equal(document.documentElement.lang, 'es');
    assert.equal(elements.get('btn-lang').textContent, '🌐 Español');
    assert.equal(label.textContent, 'JUGAR AHORA');
    click('btn-audio');
    assert.equal(elements.get('btn-audio').textContent, '🔇');
    state.changeState(GameState.Playing);
    assert.equal(elements.get('panel-hud').classes.has('hidden'), false);
    assert.equal(elements.get('panel-main-menu').classes.has('hidden'), true);
    ui.updateLiveScore(123);
    ui.updateFinalScores(123, 456);
    assert.equal(elements.get('score-display').textContent, '123');
    assert.equal(elements.get('high-score-display').textContent, '456');
    ui.dispose();
    click('btn-play');
    localization.setLanguage('en');
    state.changeState(GameState.Paused);
    assert.equal(commands.length, 3);
    assert.equal(document.documentElement.lang, 'es');
    assert.equal(elements.get('panel-hud').classes.has('hidden'), false);
});

function audioContext() {
    const gains = [];
    const oscillators = [];
    const parameter = () => ({
        events: [],
        setValueAtTime(...args) { this.events.push(['set', ...args]); },
        exponentialRampToValueAtTime(...args) { this.events.push(['ramp', ...args]); }
    });
    return {
        gains, oscillators, state: 'running', currentTime: 10, destination: {},
        createGain() {
            const gain = { gain: parameter(), connect() {}, disconnected: false, disconnect() { this.disconnected = true; } };
            gains.push(gain);
            return gain;
        },
        createOscillator() {
            const oscillator = {
                frequency: parameter(), type: '', onended: null, stops: [], disconnected: false,
                connect() {}, start() {}, stop(time) { this.stops.push(time); },
                disconnect() { this.disconnected = true; }
            };
            oscillators.push(oscillator);
            return oscillator;
        },
        async resume() {}
    };
}

const customSound = {
    waveform: 'triangle', startFrequency: 100, endFrequency: 200,
    frequencyEnd: 0.1, frequencyMode: 'exponential', volume: 0.3,
    fadeStart: 0, fadeEnd: 0.2, duration: 0.3
};

test('audio accepts new sound definitions, persists mute through its port, and releases voices', () => {
    const context = audioContext();
    const saves = [];
    const audio = new AudioManager(context, { load: () => false, save: value => saves.push(value) },
        new Map([['custom', customSound]]));
    audio.play('custom');
    const oscillator = context.oscillators[0];
    assert.equal(oscillator.type, 'triangle');
    assert.deepEqual(oscillator.frequency.events, [['set', 100, 10], ['ramp', 200, 10.1]]);
    oscillator.onended();
    assert.equal(oscillator.disconnected, true);
    assert.equal(context.gains[1].disconnected, true);
    audio.toggleMute();
    audio.play('custom');
    assert.equal(context.oscillators.length, 1);
    audio.toggleMute();
    audio.play('custom');
    audio.dispose();
    audio.dispose();
    assert.equal(context.oscillators[1].disconnected, true);
    assert.equal(context.gains[0].disconnected, true);
    assert.deepEqual(saves, [true, false]);
});
