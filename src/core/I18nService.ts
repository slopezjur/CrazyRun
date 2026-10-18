import type { IValueStorage } from './StorageService';
import { Signal, type Unsubscribe } from './Signal';

export interface Translations {
    readonly [key: string]: string;
    subtitle: string;
    btnPlay: string;
    score: string;
    paused: string;
    btnResume: string;
    crashed: string;
    finalScore: string;
    highScore: string;
    btnRestart: string;
    lane: string;
    jump: string;
    slide: string;
}

export interface Locale {
    readonly id: string;
    readonly label: string;
    readonly translations: Readonly<Translations>;
}

export interface ILocalizationSource {
    readonly locale: Locale;
    onChange(listener: (locale: Locale) => void): Unsubscribe;
}

export interface ILocalization extends ILocalizationSource { cycleLanguage(): void; }

export class I18nService implements ILocalization {
    private current: Locale;
    private readonly changed = new Signal<Locale>();

    constructor(
        private readonly storage: IValueStorage<string | null>,
        browserLanguage: string,
        private readonly locales: readonly Locale[]
    ) {
        if (locales.length === 0 || new Set(locales.map(locale => locale.id)).size !== locales.length) {
            throw new Error('Locales must have unique IDs and include at least one entry.');
        }
        const saved = storage.load();
        const language = browserLanguage.toLowerCase();
        this.current = locales.find(locale => locale.id === saved)
            ?? locales.find(locale => locale.id.toLowerCase() === language)
            ?? locales.find(locale => locale.id.toLowerCase() === language.split('-')[0])
            ?? locales[0];
    }

    public get locale(): Locale {
        return this.current;
    }

    public cycleLanguage(): void {
        const index = this.locales.indexOf(this.current);
        this.setLanguage(this.locales[(index + 1) % this.locales.length].id);
    }

    public setLanguage(id: string): void {
        const locale = this.locales.find(entry => entry.id === id);
        if (!locale) throw new RangeError('Unknown locale: ' + id);
        if (locale === this.current) return;
        this.current = locale;
        this.storage.save(id);
        this.changed.emit(locale);
    }

    public onChange(listener: (locale: Locale) => void): Unsubscribe {
        const unsubscribe = this.changed.subscribe(listener);
        listener(this.current);
        return unsubscribe;
    }

    public dispose(): void {
        this.changed.clear();
    }
}
