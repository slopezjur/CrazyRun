import test from 'node:test';
import assert from 'node:assert/strict';
import { BrowserStorage, StoredValue, parseHighScore } from '../src/core/StorageService.ts';
import { I18nService } from '../src/core/I18nService.ts';
import { ScoreTracker } from '../src/game/ScoreTracker.ts';
import { LOCALES } from '../src/ui/translations.ts';

function memory(initial = []) {
    const values = new Map(initial);
    return {
        getItem(key) { return values.get(key) ?? null; },
        setItem(key, value) { values.set(key, value); }
    };
}

test('blocked browser storage keeps settings available for the session', () => {
    const storage = new BrowserStorage(() => { throw new Error('storage denied'); });
    assert.equal(storage.getItem('muted'), null);
    storage.setItem('muted', 'true');
    assert.equal(storage.getItem('muted'), 'true');
});

test('typed storage reads existing saves and preserves score keys across sessions', () => {
    const backing = memory([['crazyrun_highscore', '450']]);
    const storage = new BrowserStorage(() => backing);
    const score = new StoredValue(storage, 'crazyrun_highscore', parseHighScore, String);
    assert.equal(score.load(), 450);
    score.save(600);
    const next = new BrowserStorage(() => backing);
    assert.equal(next.getItem('crazyrun_highscore'), '600');
});

test('malformed high scores cannot poison scoring', () => {
    for (const value of [null, '', 'NaN', 'Infinity', '12oops', '-1', '1.5', '9007199254740992']) {
        assert.equal(parseHighScore(value), 0);
    }
    assert.equal(parseHighScore('123'), 123);
});

test('scoring persists only new integer records and supports unsubscribing', () => {
    const saves = [];
    const score = new ScoreTracker({ load: () => 100, save: value => saves.push(value) });
    const updates = [];
    const unsubscribe = score.onScoreUpdated(value => updates.push(value));
    score.update(30, 0.5);
    score.addBonus(100);
    score.finalizeScore();
    score.finalizeScore();
    assert.equal(score.score, 115);
    assert.equal(score.highestScore, 115);
    assert.deepEqual(saves, [115]);
    unsubscribe();
    score.reset();
    score.finalizeScore();
    assert.deepEqual(updates, [15, 115]);
    assert.deepEqual(saves, [115]);
});

test('adding a locale only requires a definition and language cycling uses its label', () => {
    const locales = [...LOCALES, { id: 'fr', label: 'Français', translations: LOCALES[0].translations }];
    const saved = [];
    const service = new I18nService({ load: () => null, save: value => saved.push(value) }, 'fr-FR', locales);
    assert.equal(service.locale.label, 'Français');
    const changes = [];
    const unsubscribe = service.onChange(locale => changes.push(locale.id));
    service.cycleLanguage();
    service.cycleLanguage();
    service.cycleLanguage();
    assert.deepEqual(changes, ['fr', 'en', 'es', 'fr']);
    assert.deepEqual(saved, ['en', 'es', 'fr']);
    unsubscribe();
    service.setLanguage('en');
    assert.equal(changes.length, 4);
    assert.throws(() => service.setLanguage('unknown'), RangeError);
});

test('valid saved locale wins, invalid saves fall back to browser locale', () => {
    const preference = value => ({ load: () => value, save() {} });
    assert.equal(new I18nService(preference('es'), 'en-US', LOCALES).locale.id, 'es');
    assert.equal(new I18nService(preference('bad'), 'es-ES', LOCALES).locale.id, 'es');
    assert.equal(new I18nService(preference(null), 'zz-ZZ', LOCALES).locale.id, 'en');
});

test('score updates publish only visible integer changes', () => {
    const score = new ScoreTracker({ load: () => 0, save() {} });
    const updates = [];
    score.onScoreUpdated(value => updates.push(value));
    for (let tick = 0; tick < 4; tick++) score.update(30, 1 / 60);
    score.addBonus(0.2);
    score.reset();
    assert.deepEqual(updates, [1, 2, 0]);
});
