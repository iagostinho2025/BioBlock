export class EffectsSystem {
    constructor() {
        this.layer = document.getElementById('effects-layer');
        
        // Segurança: Cria a camada se ela não existir
        if (!this.layer) {
            this.layer = document.createElement('div');
            this.layer.id = 'effects-layer';
            // Garante que o layer não bloqueie cliques
            this.layer.style.pointerEvents = 'none';
            this.layer.style.position = 'fixed';
            this.layer.style.top = '0';
            this.layer.style.left = '0';
            this.layer.style.width = '100%';
            this.layer.style.height = '100%';
            this.layer.style.zIndex = '9000'; // Abaixo dos modais, acima do jogo
            
            const app = document.getElementById('app') || document.body;
            app.appendChild(this.layer);
        }

        // --- OBJECT POOLING (SISTEMA DE PARTÍCULAS) ---
        this.poolSize = 60; // 60 partículas reciclaveis (suficiente para combos grandes)
        this.particlePool = [];
        this.poolIndex = 0;
        this.initPool();
    }

    initPool() {
        for (let i = 0; i < this.poolSize; i++) {
            const p = document.createElement('div');
            p.classList.add('debris-particle'); // Classe base (se houver CSS)
            
            // Estilos Base inline para garantir performance
            p.style.position = 'absolute'; // Absolute dentro do layer fixed é mais leve
            p.style.width = '12px';
            p.style.height = '12px';
            p.style.borderRadius = '2px';
            p.style.pointerEvents = 'none';
            p.style.opacity = '0'; // Começa invisível
            p.style.willChange = 'transform, opacity'; // Dica para o navegador otimizar
            
            this.layer.appendChild(p);
            this.particlePool.push(p);
        }
    }

    getParticle() {
        // Pega a próxima partícula do pool (Cíclico)
        const p = this.particlePool[this.poolIndex];
        this.poolIndex = (this.poolIndex + 1) % this.poolSize;
        return p;
    }

    // --- EFEITOS VISUAIS ---

    /**
     * Cria uma explosão usando partículas recicladas.
     * @param {DOMRect} rect - O retângulo do bloco que explodiu
     * @param {String} colorClass - Classe de cor (ex: type-fire) ou hex code
     */
    spawnExplosion(rect, colorClass) {
        // Mapa de cores para garantir beleza caso venha apenas a classe
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
            'boss-damage': '#ffffff' // Flash branco para dano no boss
        };
        
        let bg = colors[colorClass] || colorClass;
        if (!bg.startsWith('#') && !bg.startsWith('rgb')) bg = '#60a5fa'; // Fallback

        // Quantidade de partículas baseada no tamanho da explosão (8 a 12)
        const particleCount = 8 + Math.floor(Math.random() * 4);

        for (let i = 0; i < particleCount; i++) {
            const p = this.getParticle();
            
            // 1. Posicionamento Inicial (Centro do bloco + variação leve)
            const size = Math.random() * 8 + 8; // 8px a 16px
            const startX = rect.left + (rect.width / 2);
            const startY = rect.top + (rect.height / 2);
            
            p.style.width = `${size}px`;
            p.style.height = `${size}px`;
            p.style.backgroundColor = bg;
            p.style.left = `${startX}px`;
            p.style.top = `${startY}px`;
            
            // Efeito visual extra: Sombra colorida para "brilho"
            p.style.boxShadow = `0 0 4px ${bg}`;

            // 2. Física da Explosão
            // Distância aleatória
            const angle = Math.random() * Math.PI * 2;
            const velocity = Math.random() * 60 + 40; // Força da explosão
            
            const tx = Math.cos(angle) * velocity;
            const ty = Math.sin(angle) * velocity;
            const rot = (Math.random() * 360) - 180; // Rotação
            
            // 3. Animação de Alta Performance (Web Animations API)
            // Substitui CSS animations para evitar reflows e permitir reuso imediato
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
                duration: 600 + Math.random() * 200, // 600ms a 800ms
                easing: 'cubic-bezier(0.25, 1, 0.5, 1)', // "Ease-out" suave
                fill: 'forwards' // Mantém o estado final (invisível)
            });
        }
    }

    showComboFeedback(lines, comboCount, type) {
        let text = "";
        let styleClass = "";

        // Lógica de textos de incentivo
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
            text = "DIVINE!"; // Holy Cow traduzido/adaptado
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
        
        // Estilização rápida via JS caso o CSS falhe
        hud.style.position = 'absolute';
        hud.style.left = '50%';
        hud.style.top = '30%';
        hud.style.transform = 'translate(-50%, -50%)';
        hud.style.pointerEvents = 'none';
        
        this.layer.appendChild(hud);

        // Animação de entrada/saída
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
        // Centraliza
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
            // Remove a classe se já existir para reiniciar
            board.classList.remove('shake-screen');
            void board.offsetWidth; // Força reflow (truque para reiniciar animação CSS)
            board.classList.add('shake-screen');
            
            // O CSS cuida da animação, mas removemos depois por limpeza
            setTimeout(() => board.classList.remove('shake-screen'), 500);
        }
    }
}