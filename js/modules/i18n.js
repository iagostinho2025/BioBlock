export class I18nSystem {
    constructor() {
        this.currentLang = 'en';
        this.translations = {};
        this.fallbackTranslations = {};
        
        this.supportedLangs = [
            { code: 'en', label: 'English' },
            { code: 'pt-BR', label: 'Português (Brasil)' }
        ];
    }

    async init() {
        // Detecta idioma (Cache > Navegador > Padrão EN)
        const savedLang = localStorage.getItem('blocklands_lang');
        const browserLang = navigator.language;

        if (savedLang) {
            this.currentLang = savedLang;
        } else if (browserLang.startsWith('pt')) {
            this.currentLang = 'pt-BR';
        } else {
            this.currentLang = 'en';
        }

        console.log(`[I18N] Detectado: ${this.currentLang}`);

        // Carrega EN (Fallback) + Idioma Atual
        await this.loadFallback('en');
        
        if (this.currentLang !== 'en') {
            await this.loadLanguage(this.currentLang);
        } else {
            this.translations = { ...this.fallbackTranslations };
        }

        this.updateDOM();
    }

    async loadFallback(langCode) {
        try {
            const res = await fetch(`assets/lang/${langCode}.json`);
            this.fallbackTranslations = await res.json();
        } catch (e) {
            console.error('[I18N] Falha no fallback:', e);
        }
    }

    async loadLanguage(langCode) {
        try {
            const res = await fetch(`assets/lang/${langCode}.json`);
            const data = await res.json();
            // Merge profundo simples: Fallback + Atual
            this.translations = this.mergeDeep(this.fallbackTranslations, data);
        } catch (e) {
            console.error(`[I18N] Falha em ${langCode}:`, e);
            this.translations = { ...this.fallbackTranslations };
        }
    }

    // Função auxiliar para juntar objetos (garante que chaves faltantes no PT venham do EN)
    mergeDeep(target, source) {
        let output = Object.assign({}, target);
        if (isObject(target) && isObject(source)) {
            Object.keys(source).forEach(key => {
                if (isObject(source[key])) {
                    if (!(key in target)) Object.assign(output, { [key]: source[key] });
                    else output[key] = this.mergeDeep(target[key], source[key]);
                } else {
                    Object.assign(output, { [key]: source[key] });
                }
            });
        }
        return output;
    }

    t(key) {
        const keys = key.split('.');
        let value = this.translations;
        for (const k of keys) {
            if (value && value[k]) value = value[k];
            else return key; // Retorna a chave se falhar
        }
        return value;
    }

    async changeLanguage(langCode) {
        if (!this.supportedLangs.find(l => l.code === langCode)) return;
        this.currentLang = langCode;
        localStorage.setItem('blocklands_lang', langCode);
        await this.loadLanguage(langCode);
        this.updateDOM();
    }

    updateDOM() {
        document.querySelectorAll('[data-i18n]').forEach(el => {
            const key = el.getAttribute('data-i18n');
            if (key) {
                const text = this.t(key);
                if (el.tagName === 'INPUT' && el.placeholder) el.placeholder = text;
                else el.innerHTML = text; // innerHTML permite usar <span> no JSON
            }
        });
    }
}

function isObject(item) {
    return (item && typeof item === 'object' && !Array.isArray(item));
}