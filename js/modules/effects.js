export class EffectsSystem {
    constructor() {
        this.layer = document.getElementById('effects-layer');

        // Segurança: Cria a camada se ela não existir
        if (!this.layer) {
            this.layer = document.createElement('div');
            this.layer.id = 'effects-layer';
            this.layer.style.pointerEvents = 'none';
            this.layer.style.position = 'fixed';
            this.layer.style.top = '0';
            this.layer.style.left = '0';
            this.layer.style.width = '100%';
            this.layer.style.height = '100%';
            this.layer.style.zIndex = '9000';

            const app = document.getElementById('app') || document.body;
            app.appendChild(this.layer);
        }

        // --- OBJECT POOLING (SISTEMA DE PARTÍCULAS) ---
        this.poolSize = 60;
        this.particlePool = [];
        this.poolIndex = 0;
        this.initPool();

        // --- FILA + CAP POR FRAME (MOBILE FRIENDLY) ---
        this._explosionQueue = [];
        this._fxScheduled = false;

        // Orçamento de partículas por frame (ajuste fino)
        this._maxParticlesPerFrame = 22; // bom equilíbrio
        this._maxExplosionsPerFrame = 6; // evita rajadas
        this._quality = 1; // 1 = normal, 0 = reduzido

        // Cache de boxShadow por cor (evita concatenar string repetida em rajada)
        this._shadowCache = new Map();
    }

    initPool() {
        for (let i = 0; i < this.poolSize; i++) {
            const p = document.createElement('div');
            p.classList.add('debris-particle');

            p.style.position = 'absolute';
            p.style.width = '12px';
            p.style.height = '12px';
            p.style.borderRadius = '2px';
            p.style.pointerEvents = 'none';
            p.style.opacity = '0';
            p.style.willChange = 'transform, opacity';

            this.layer.appendChild(p);
            this.particlePool.push(p);
        }
    }

    getParticle() {
        const p = this.particlePool[this.poolIndex];
        this.poolIndex = (this.poolIndex + 1) % this.poolSize;
        return p;
    }

    // --- EFEITOS VISUAIS ---

    /**
     * API pública (mantida igual): agora enfileira e processa com budget por frame.
     * @param {DOMRect} rect
     * @param {String} colorClass
     */
    spawnExplosion(rect, colorClass) {
        if (!rect) return;

        // Enfileira
        this._explosionQueue.push({ rect, colorClass });

        // Agenda processamento (1 loop rAF por rajada)
        if (!this._fxScheduled) {
            this._fxScheduled = true;
            requestAnimationFrame(this._processExplosionQueue.bind(this));
        }
    }

    _processExplosionQueue(t) {
        // Budget por frame (evita stutter)
        let particlesBudget = this._maxParticlesPerFrame;
        let explosionsBudget = this._maxExplosionsPerFrame;

        // Se a fila está grande, reduz qualidade temporariamente (menos partículas por explosão)
        // Isso mantém FPS sem “sumir” com o efeito.
        this._quality = this._explosionQueue.length > 18 ? 0 : 1;

        while (this._explosionQueue.length > 0 && explosionsBudget > 0 && particlesBudget > 0) {
            const job = this._explosionQueue.shift();
            explosionsBudget--;

            // Calcula quantas partículas cabem neste frame
            const used = this._spawnExplosionNow(job.rect, job.colorClass, particlesBudget);
            particlesBudget -= used;
        }

        if (this._explosionQueue.length > 0) {
            requestAnimationFrame(this._processExplosionQueue.bind(this));
        } else {
            this._fxScheduled = false;
            this._quality = 1;
        }
    }

    /**
     * Executa a explosão imediatamente, respeitando um teto de partículas.
     * Retorna quantas partículas foram usadas (para debitar do budget do frame).
     */
    _spawnExplosionNow(rect, colorClass, maxParticlesAllowed) {
        // Mapa de cores (igual ao seu)
        const colors = {
            'type-fire': '#ef4444',
            'type-water': '#3b82f6',
            'type-forest': '#22c55e',
            'type-mountain': '#78716c',
            'type-desert': '#eab308',
            'type-ice': '#06b6d4',
            'type-zombie': '#84cc16',
            'type-bee': '#fbbf24',
            'type-ghost': '#a855f7',
            'type-cop': '#1e40af',
            'type-normal': '#60a5fa',
            'lava': '#b91c1c',
            'boss-damage': '#ffffff'
        };

        let bg = colors[colorClass] || colorClass;
        if (!bg.startsWith('#') && !bg.startsWith('rgb')) bg = '#60a5fa';

        // Partículas (mantém estética; reduz se fila estiver grande)
        let particleCount = 8 + Math.floor(Math.random() * 4); // 8..11
        if (this._quality === 0) particleCount = Math.max(5, Math.floor(particleCount * 0.65));

        // Respeita budget do frame
        particleCount = Math.min(particleCount, maxParticlesAllowed);
        if (particleCount <= 0) return 0;

        const startX = rect.left + (rect.width / 2);
        const startY = rect.top + (rect.height / 2);

        // Cache do boxShadow pra reduzir churn de string
        let shadow = this._shadowCache.get(bg);
        if (!shadow) {
            shadow = `0 0 4px ${bg}`;
            this._shadowCache.set(bg, shadow);
        }

        for (let i = 0; i < particleCount; i++) {
            const p = this.getParticle();

            const size = Math.random() * 8 + 8; // 8..16
            p.style.width = `${size}px`;
            p.style.height = `${size}px`;
            p.style.backgroundColor = bg;
            p.style.left = `${startX}px`;
            p.style.top = `${startY}px`;

            // Brilho (mantém beleza), mas é um custo — aqui fica leve e reutiliza string
            p.style.boxShadow = shadow;

            const angle = Math.random() * Math.PI * 2;
            const velocity = Math.random() * 60 + 40;

            const tx = Math.cos(angle) * velocity;
            const ty = Math.sin(angle) * velocity;
            const rot = (Math.random() * 360) - 180;

            // WAAPI (alto desempenho)
            p.animate([
                {
                    transform: `translate(-50%, -50%) translate(0px, 0px) rotate(0deg) scale(1)`,
                    opacity: 1
                },
                {
                    transform: `translate(-50%, -50%) translate(${tx}px, ${ty}px) rotate(${rot}deg) scale(0)`,
                    opacity: 0
                }
            ], {
                duration: 600 + Math.random() * 200,
                easing: 'cubic-bezier(0.25, 1, 0.5, 1)',
                fill: 'forwards'
            });
        }

        return particleCount;
    }

    showComboFeedback(lines, comboCount, type) {
        let text = "";
        let styleClass = "";

        if (type === 'normal') {
            if (lines === 1) { text = "GOOD!"; styleClass = "text-good"; }
            else if (lines === 2) { text = "GREAT!"; styleClass = "text-great"; }
            else if (lines === 3) { text = "EXCELLENT!"; styleClass = "text-excellent"; }
            else { text = "PERFECT!"; styleClass = "text-perfect"; }
        }
        else if (type === 'wow') {
            text = "WOW!";
            styleClass = "feedback-gold";
        }
        else if (type === 'holycow') {
            text = "DIVINE!";
            styleClass = "feedback-epic";
        }
        else if (type === 'unreal') {
            text = "UNREAL!";
            styleClass = "feedback-legendary";
        }

        if (!this.layer) return;

        const hud = document.createElement('div');
        hud.className = 'combo-hud-container';

        hud.innerHTML = `
            <span class="combo-hud-label">COMBO</span>
            <span class="combo-hud-value">x${comboCount}</span>
            <div class="combo-hud-text ${styleClass}">${text}</div>
        `;

        hud.style.position = 'absolute';
        hud.style.left = '50%';
        hud.style.top = '30%';
        hud.style.transform = 'translate(-50%, -50%)';
        hud.style.pointerEvents = 'none';

        this.layer.appendChild(hud);

        hud.animate([
            { opacity: 0, transform: 'translate(-50%, -50%) scale(0.5)' },
            { opacity: 1, transform: 'translate(-50%, -50%) scale(1.2)', offset: 0.2 },
            { opacity: 1, transform: 'translate(-50%, -50%) scale(1)', offset: 0.4 },
            { opacity: 1, transform: 'translate(-50%, -50%) scale(1)', offset: 0.8 },
            { opacity: 0, transform: 'translate(-50%, -60%) scale(1)' }
        ], {
            duration: 1200,
            easing: 'ease-out',
            fill: 'forwards'
        }).onfinish = () => hud.remove();
    }

    showFloatingTextCentered(message, styleClass) {
        if (!this.layer || !message) return;

        const el = document.createElement('div');
        el.classList.add('floating-text');
        if (styleClass) el.classList.add(styleClass);

        el.innerText = message;
        el.style.position = 'absolute';
        el.style.left = '50%';
        el.style.top = '50%';
        el.style.transform = 'translate(-50%, -50%)';

        this.layer.appendChild(el);

        el.animate([
            { opacity: 0, transform: 'translate(-50%, -30%) scale(0.8)' },
            { opacity: 1, transform: 'translate(-50%, -50%) scale(1.1)', offset: 0.2 },
            { opacity: 1, transform: 'translate(-50%, -50%) scale(1)', offset: 0.8 },
            { opacity: 0, transform: 'translate(-50%, -80%)' }
        ], {
            duration: 1500,
            easing: 'ease-out'
        }).onfinish = () => el.remove();
    }

    shakeScreen() {
        const board = document.getElementById('game-board');
        if (board) {
            board.classList.remove('shake-screen');
            void board.offsetWidth; // mantém seu comportamento atual
            board.classList.add('shake-screen');
            setTimeout(() => board.classList.remove('shake-screen'), 500);
        }
    }
}
