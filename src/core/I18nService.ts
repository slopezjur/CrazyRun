export type Language = 'en' | 'es';

export interface Translations {
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

export const DICTIONARY: Record<Language, Translations> = {
    en: {
        subtitle: 'An Endless WebGPU Experience',
        btnPlay: 'PLAY NOW',
        score: 'SCORE',
        paused: 'PAUSED',
        btnResume: 'RESUME',
        crashed: 'CRASHED!',
        finalScore: 'FINAL SCORE',
        highScore: 'HIGH SCORE',
        btnRestart: 'TRY AGAIN',
        lane: 'Lane',
        jump: 'Jump',
        slide: 'Slide'
    },
    es: {
        subtitle: 'Una experiencia WebGPU infinita',
        btnPlay: 'JUGAR AHORA',
        score: 'PUNTOS',
        paused: 'PAUSADO',
        btnResume: 'CONTINUAR',
        crashed: '¡CHOCASTE!',
        finalScore: 'PUNTUACIÓN FINAL',
        highScore: 'RÉCORD',
        btnRestart: 'REINTENTAR',
        lane: 'Carril',
        jump: 'Saltar',
        slide: 'Deslizar'
    }
};

export class I18nService {
    private currentLang: Language = 'en';
    private listeners: ((lang: Language, t: Translations) => void)[] = [];
    private readonly STORAGE_KEY = 'crazyrun_lang';

    constructor() {
        const saved = localStorage.getItem(this.STORAGE_KEY) as Language | null;
        if (saved && (saved === 'en' || saved === 'es')) {
            this.currentLang = saved;
        } else {
            const browserLang = navigator.language.slice(0, 2).toLowerCase();
            this.currentLang = browserLang === 'es' ? 'es' : 'en';
        }
    }

    public get language(): Language {
        return this.currentLang;
    }

    public get t(): Translations {
        return DICTIONARY[this.currentLang];
    }

    public cycleLanguage(): Language {
        const languages: Language[] = ['en', 'es'];
        const nextIndex = (languages.indexOf(this.currentLang) + 1) % languages.length;
        this.setLanguage(languages[nextIndex]);
        return this.currentLang;
    }

    public setLanguage(lang: Language): void {
        this.currentLang = lang;
        localStorage.setItem(this.STORAGE_KEY, lang);
        this.notifyListeners();
    }

    public onChange(callback: (lang: Language, t: Translations) => void): void {
        this.listeners.push(callback);
        callback(this.currentLang, this.t);
    }

    private notifyListeners(): void {
        for (const cb of this.listeners) {
            cb(this.currentLang, this.t);
        }
    }
}
