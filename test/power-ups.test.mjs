import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PowerUpEffects, POWER_UP_DEFINITIONS, POWER_UP_IDS } from '../src/game/PowerUps.ts';
import { RunSession } from '../src/game/RunSession.ts';
import { endlessChallenge, dailyChallenge } from '../src/game/Challenge.ts';
import { PatternSpawnPolicy } from '../src/game/PatternSpawnPolicy.ts';
import { RunOutcomes } from '../src/game/RunOutcomes.ts';
import { RunFeedback } from '../src/app/RunFeedback.ts';
import { RunNotices } from '../src/ui/RunNotices.ts';
import { RunUI } from '../src/ui/RunUI.ts';
import { GameState, GameStateManager } from '../src/core/GameStateManager.ts';
import { Progression } from '../src/game/Progression.ts';
import { emptyProfile, PROGRESSION_RULES } from '../src/game/ProgressionRules.ts';

test('default powers preserve v1 course order, durations, shield consumption, and HUD order', () => {
    assert.deepEqual(POWER_UP_IDS, ['magnet', 'shield', 'slow']);
    const powers = new PowerUpEffects(POWER_UP_DEFINITIONS);
    for (const id of POWER_UP_IDS) powers.activate(id);
    assert.deepEqual(powers.active, [
        { id: 'shield', remaining: null }, { id: 'magnet', remaining: 10 }, { id: 'slow', remaining: 5 }
    ]);
    assert.equal(powers.timeScale, 0.55);
    assert.equal(powers.attractsCoins, true);
    powers.advance(5);
    assert.equal(powers.timeScale, 1);
    assert.deepEqual(powers.active, [{ id: 'shield', remaining: null }, { id: 'magnet', remaining: 5 }]);
    assert.equal(powers.consumeProtection(), true);
    assert.equal(powers.consumeProtection(), false);
    assert.equal(powers.hasProtection, false);
    powers.advance(5);
    assert.equal(powers.attractsCoins, false);
    assert.deepEqual(powers.active, []);
});

test('reapplying a timed power refreshes its duration and run reset clears every effect', () => {
    const powers = new PowerUpEffects(POWER_UP_DEFINITIONS);
    powers.activate('magnet');
    powers.advance(6);
    powers.activate('magnet');
    assert.deepEqual(powers.active, [{ id: 'magnet', remaining: 10 }]);
    powers.activate('shield');
    powers.activate('slow');
    powers.reset();
    assert.equal(powers.timeScale, 1);
    assert.equal(powers.hasProtection, false);
    assert.equal(powers.attractsCoins, false);
    assert.deepEqual(powers.active, []);
});

test('unregistered pickups cannot activate an unrelated effect', () => {
    const run = new RunSession(endlessChallenge('invalid'), new PowerUpEffects(POWER_UP_DEFINITIONS));
    const events = [];
    run.onEvent(event => events.push(event));
    assert.throws(() => run.pickUp('unknown'), RangeError);
    assert.equal(run.timeScale, 1);
    assert.deepEqual(run.activePowers, []);
    assert.deepEqual(events, []);
});

test('new power definitions flow through outcomes, spawning, notices, and audio without ID branches', () => {
    const challenge = endlessChallenge('extension');
    const run = new RunSession(challenge, new PowerUpEffects([{ id: 'vacuum', duration: 2, attractsCoins: true }]));
    const events = [];
    run.onEvent(event => events.push(event));
    const outcomes = new RunOutcomes(run, { isPlaying: true, crash() {}, collect() {} }, { addBonus() {} });
    outcomes.power('vacuum');
    assert.equal(run.attractsCoins, true);
    assert.deepEqual(events, [{ type: 'powerUp', powerUp: 'vacuum' }]);
    const notices = new RunNotices(run);
    assert.equal(notices.accept(events[0]), true);
    assert.equal(notices.current.key, 'vacuum');
    const audio = [];
    new RunFeedback({ event() {} }, () => 1, { play: (...args) => audio.push(args) }, { triggerShake() {} }).handle(events[0]);
    assert.deepEqual(audio, [['reward', 1]]);
    const spawned = [];
    new PatternSpawnPolicy(() => ({ challenge, distance: 0 }), undefined, undefined, ['vacuum'])
        .spawn(-160, id => spawned.push(id));
    assert.equal(spawned.filter(id => id === 'vacuum').length, 1);
    run.advance(2, 60);
    assert.equal(run.attractsCoins, false);
});

test('run sessions consume a substitutable power-effects port', () => {
    const calls = [];
    const effects = {
        active: [{ id: 'custom', remaining: null }], attractsCoins: true, hasProtection: true, timeScale: 0.75,
        activate(id) { calls.push(['activate', id]); },
        consumeProtection() {
            this.hasProtection = false;
            this.active = [];
            return true;
        },
        advance(delta) { calls.push(['advance', delta]); },
        reset() {
            this.active = [];
            this.attractsCoins = this.hasProtection = false;
            this.timeScale = 1;
            calls.push(['reset']);
        }
    };
    const run = new RunSession(endlessChallenge('port'), effects);
    assert.equal(run.timeScale, 0.75);
    assert.equal(run.shield, true);
    run.pickUp('custom');
    run.advance(0.25, 5);
    assert.equal(run.absorbHit([0, 1, 0]), true);
    assert.equal(run.shield, false);
    run.reset();
    assert.equal(run.timeScale, 1);
    assert.deepEqual(calls, [['activate', 'custom'], ['advance', 0.25], ['reset']]);
});

class Element extends EventTarget {
    children = [];
    dataset = {};
    textContent = '';
    hidden = false;
    classes = new Set();
    classList = {
        toggle: (name, enabled) => { if (enabled) this.classes.add(name); else this.classes.delete(name); },
        remove: name => this.classes.delete(name)
    };
    style = { setProperty() {} };
    constructor(id = '') { super(); this.id = id; }
    append(...children) { this.children.push(...children); }
    replaceChildren(...children) { this.children = children; }
    setAttribute() {}
    blur() {}
}

test('HUD power labels and timers come from active definitions and localization', t => {
    const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
    const elements = new Map([...html.matchAll(/\bid="([^"]+)"/g)].map(([, id]) => [id, new Element(id)]));
    const document = {
        documentElement: new Element(), body: new Element(),
        querySelectorAll: () => elements.values(), createElement: () => new Element()
    };
    const locale = { id: 'en', label: 'English', translations: { vacuum: 'Vacuum' } };
    const localization = { locale, onChange(listener) { listener(locale); return () => {}; } };
    const profile = new Progression({ load: () => emptyProfile(PROGRESSION_RULES), save() {} });
    const state = new GameStateManager();
    state.changeState(GameState.Playing);
    const run = new RunSession(endlessChallenge('hud'), new PowerUpEffects([{ id: 'vacuum', duration: 2, attractsCoins: true }]));
    const ui = new RunUI(document, state, localization, profile, run, {
        daily() {}, menu() {}, pause() {}, async share() { return ''; },
        dailyChallenge: () => dailyChallenge('2026-10-20')
    }, new RunNotices(run));
    t.after(() => { ui.dispose(); run.dispose(); profile.dispose(); });
    run.pickUp('vacuum');
    ui.update(0.1, null);
    assert.equal(elements.get('run-powers').textContent, 'Vacuum 2s');
    assert.equal(elements.get('run-notice').textContent, 'Vacuum');
    run.advance(1, 30);
    ui.update(0.1, null);
    assert.equal(elements.get('run-powers').textContent, 'Vacuum 1s');
    run.advance(1, 30);
    ui.update(0.1, null);
    assert.equal(elements.get('run-powers').textContent, '');
});

test('Crazy Mode supplies coin attraction independently of registered pickups', () => {
    const run = new RunSession(endlessChallenge('crazy'), new PowerUpEffects(POWER_UP_DEFINITIONS));
    for (let clear = 0; clear < 9; clear++) run.clearObstacle(false, true);
    assert.deepEqual(run.activePowers, []);
    assert.equal(run.attractsCoins, true);
    run.advance(8, 240);
    assert.equal(run.attractsCoins, false);
});

test('slow motion scales world time so hazard motion slows with the world', () => {
    const run = new RunSession(endlessChallenge('slow'), new PowerUpEffects(POWER_UP_DEFINITIONS));
    run.advance(1, 30);
    run.pickUp('slow');
    run.advance(2, 33);
    assert.equal(run.elapsed, 3);
    assert.ok(Math.abs(run.worldTime - 2.1) < 1e-9);
    run.reset();
    assert.equal(run.worldTime, 0);
});
