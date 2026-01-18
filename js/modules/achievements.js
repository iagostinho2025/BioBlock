/**
 * Sistema de Conquistas Otimizado
 * Inspirado em: Tetris Effect, Hades, Celeste
 *
 * Performance:
 * - Batching de atualizações (evita writes excessivos)
 * - Cache em memória
 * - Lazy loading de dados
 * - Event pooling
 */

export class AchievementSystem {
    constructor(game) {
        this.game = game;
        this.achievements = new Map();
        this.unlockedIds = new Set();
        this.progress = new Map();

        // Performance: Batching
        this._pendingUpdates = new Map();
        this._saveTimer = null;
        this._SAVE_DELAY = 2000; // 2s debounce

        // Notificações em fila
        this._notificationQueue = [];
        this._isShowingNotification = false;

        this.initializeAchievements();
        this.loadProgress();
    }

    initializeAchievements() {
        const definitions = [
            // ===== PRIMEIROS PASSOS =====
            {
                id: 'first_steps',
                category: 'adventure',
                mode: 'adventure',
                tier: 'bronze',
                title_key: 'achievements.first_steps.title',
                desc_key: 'achievements.first_steps.desc',
                icon: '🎯',
                requirement: { type: 'level_complete', target: 1 },
                reward: { type: 'xp', value: 10 }
            },
            {
                id: 'guardian_slayer',
                category: 'adventure',
                mode: 'adventure',
                tier: 'silver',
                title_key: 'achievements.guardian_slayer.title',
                desc_key: 'achievements.guardian_slayer.desc',
                icon: '🛡️',
                requirement: { type: 'boss_defeat', boss: 'guardian' },
                reward: { type: 'xp', value: 50 }
            },

            // ===== MODO CLÁSSICO - SCORE =====
            {
                id: 'classic_beginner',
                category: 'classic',
                mode: 'classic',
                tier: 'bronze',
                title_key: 'achievements.classic_beginner.title',
                desc_key: 'achievements.classic_beginner.desc',
                icon: '🎮',
                requirement: { type: 'classic_score', target: 1000 },
                reward: { type: 'xp', value: 25 }
            },
            {
                id: 'classic_skilled',
                category: 'classic',
                mode: 'classic',
                tier: 'silver',
                title_key: 'achievements.classic_skilled.title',
                desc_key: 'achievements.classic_skilled.desc',
                icon: '🏅',
                requirement: { type: 'classic_score', target: 5000 },
                reward: { type: 'xp', value: 50 }
            },
            {
                id: 'classic_master',
                category: 'classic',
                mode: 'classic',
                tier: 'gold',
                title_key: 'achievements.classic_master.title',
                desc_key: 'achievements.classic_master.desc',
                icon: '👑',
                requirement: { type: 'classic_score', target: 10000 },
                reward: { type: 'xp', value: 100 }
            },

            // ===== COMBOS =====
            {
                id: 'combo_rookie',
                category: 'combo',
                mode: 'classic',
                tier: 'bronze',
                title_key: 'achievements.combo_rookie.title',
                desc_key: 'achievements.combo_rookie.desc',
                icon: '⚡',
                requirement: { type: 'combo_streak', target: 5 },
                reward: { type: 'xp', value: 20 }
            },
            {
                id: 'combo_pro',
                category: 'combo',
                mode: 'classic',
                tier: 'silver',
                title_key: 'achievements.combo_pro.title',
                desc_key: 'achievements.combo_pro.desc',
                icon: '💫',
                requirement: { type: 'combo_streak', target: 10 },
                reward: { type: 'xp', value: 50 }
            },
            {
                id: 'combo_legend',
                category: 'combo',
                mode: 'classic',
                tier: 'gold',
                title_key: 'achievements.combo_legend.title',
                desc_key: 'achievements.combo_legend.desc',
                icon: '🌟',
                requirement: { type: 'combo_streak', target: 15 },
                reward: { type: 'xp', value: 100 }
            },

            // ===== CLEAR DE LINHAS =====
            {
                id: 'line_clearer',
                category: 'lines',
                mode: 'classic',
                tier: 'bronze',
                title_key: 'achievements.line_clearer.title',
                desc_key: 'achievements.line_clearer.desc',
                icon: '📏',
                requirement: { type: 'total_lines', target: 100 },
                reward: { type: 'xp', value: 30 }
            },
            {
                id: 'line_veteran',
                category: 'lines',
                mode: 'classic',
                tier: 'silver',
                title_key: 'achievements.line_veteran.title',
                desc_key: 'achievements.line_veteran.desc',
                icon: '📐',
                requirement: { type: 'total_lines', target: 500 },
                reward: { type: 'xp', value: 75 }
            },
            {
                id: 'perfect_clear',
                category: 'lines',
                mode: 'classic',
                tier: 'gold',
                title_key: 'achievements.perfect_clear.title',
                desc_key: 'achievements.perfect_clear.desc',
                icon: '✨',
                requirement: { type: 'quad_clear', target: 1 },
                reward: { type: 'xp', value: 50 },
                hidden: true
            },

            // ===== MISSÕES =====
            {
                id: 'mission_starter',
                category: 'missions',
                mode: 'classic',
                tier: 'bronze',
                title_key: 'achievements.mission_starter.title',
                desc_key: 'achievements.mission_starter.desc',
                icon: '🎯',
                requirement: { type: 'missions_completed', target: 10 },
                reward: { type: 'xp', value: 30 }
            },
            {
                id: 'mission_hunter',
                category: 'missions',
                mode: 'classic',
                tier: 'silver',
                title_key: 'achievements.mission_hunter.title',
                desc_key: 'achievements.mission_hunter.desc',
                icon: '🏹',
                requirement: { type: 'missions_completed', target: 50 },
                reward: { type: 'xp', value: 75 }
            },
            {
                id: 'perfect_run',
                category: 'missions',
                mode: 'classic',
                tier: 'gold',
                title_key: 'achievements.perfect_run.title',
                desc_key: 'achievements.perfect_run.desc',
                icon: '💎',
                requirement: { type: 'missions_perfect_streak', target: 3 },
                reward: { type: 'xp', value: 100 }
            },

            // ===== BOSSES =====
            {
                id: 'fire_conqueror',
                category: 'bosses',
                mode: 'adventure',
                tier: 'silver',
                title_key: 'achievements.fire_conqueror.title',
                desc_key: 'achievements.fire_conqueror.desc',
                icon: '🔥',
                requirement: { type: 'world_complete', world: 'fire' },
                reward: { type: 'xp', value: 100 }
            },
            {
                id: 'forest_survivor',
                category: 'bosses',
                mode: 'adventure',
                tier: 'silver',
                title_key: 'achievements.forest_survivor.title',
                desc_key: 'achievements.forest_survivor.desc',
                icon: '🌲',
                requirement: { type: 'world_complete', world: 'forest' },
                reward: { type: 'xp', value: 100 }
            },
            {
                id: 'final_victory',
                category: 'bosses',
                mode: 'adventure',
                tier: 'platinum',
                title_key: 'achievements.final_victory.title',
                desc_key: 'achievements.final_victory.desc',
                icon: '🏆',
                requirement: { type: 'boss_defeat', boss: 'dark_wizard' },
                reward: { type: 'xp', value: 500 }
            },

            // ===== ESPECIAIS / SECRETAS =====
            {
                id: 'speedrunner',
                category: 'special',
                mode: 'adventure',
                tier: 'gold',
                title_key: 'achievements.speedrunner.title',
                desc_key: 'achievements.speedrunner.desc',
                icon: '⏱️',
                requirement: { type: 'level_time', level: 1, target: 60 }, // < 60s
                reward: { type: 'xp', value: 150 },
                hidden: true
            },
            {
                id: 'no_powers',
                category: 'special',
                mode: 'adventure',
                tier: 'platinum',
                title_key: 'achievements.no_powers.title',
                desc_key: 'achievements.no_powers.desc',
                icon: '🚫',
                requirement: { type: 'boss_no_powers', boss: 'dark_wizard' },
                reward: { type: 'xp', value: 250 },
                hidden: true
            }
        ];

        // Converte para Map para acesso O(1)
        definitions.forEach(def => {
            this.achievements.set(def.id, def);
        });
    }

    loadProgress() {
        try {
            const saved = localStorage.getItem('blocklands_achievements');
            if (saved) {
                const data = JSON.parse(saved);
                this.unlockedIds = new Set(data.unlocked || []);
                this.progress = new Map(Object.entries(data.progress || {}));
            }
        } catch (e) {
            console.error('[ACHIEVEMENTS] Erro ao carregar:', e);
        }
    }

    // Performance: Batched save com debounce
    scheduleSave() {
        if (this._saveTimer) clearTimeout(this._saveTimer);

        this._saveTimer = setTimeout(() => {
            this.saveProgress();
        }, this._SAVE_DELAY);
    }

    saveProgress() {
        try {
            const data = {
                unlocked: Array.from(this.unlockedIds),
                progress: Object.fromEntries(this.progress)
            };
            localStorage.setItem('blocklands_achievements', JSON.stringify(data));
        } catch (e) {
            console.error('[ACHIEVEMENTS] Erro ao salvar:', e);
        }
    }

    // API: Rastrear evento
    trackEvent(eventType, eventData = {}) {
        this.achievements.forEach((achievement, id) => {
            // Skip se já desbloqueado
            if (this.unlockedIds.has(id)) return;

            const req = achievement.requirement;

            // Verifica se o evento é relevante
            if (!this.matchesRequirement(req, eventType, eventData)) return;

            // Atualiza progresso
            this.updateProgress(id, eventData);
        });

        // Batch save
        this.scheduleSave();
    }

    matchesRequirement(req, eventType, eventData) {
        switch (req.type) {
            case 'level_complete':
                return eventType === 'level_complete' && eventData.level === req.target;
            case 'boss_defeat':
                return eventType === 'boss_defeat' && eventData.boss === req.boss;
            case 'classic_score':
                return eventType === 'classic_score';
            case 'combo_streak':
                return eventType === 'combo_streak';
            case 'total_lines':
                return eventType === 'line_clear';
            case 'quad_clear':
                return eventType === 'line_clear' && eventData.count === 4;
            case 'missions_completed':
                return eventType === 'mission_complete';
            case 'missions_perfect_streak':
                return eventType === 'mission_perfect_run';
            case 'world_complete':
                return eventType === 'world_complete' && eventData.world === req.world;
            case 'level_time':
                return eventType === 'level_complete' && eventData.level === req.level;
            case 'boss_no_powers':
                return eventType === 'boss_defeat' && eventData.boss === req.boss && eventData.noPowers === true;
            default:
                return false;
        }
    }

    updateProgress(id, eventData) {
        const achievement = this.achievements.get(id);
        const req = achievement.requirement;

        let currentProgress = this.progress.get(id) || 0;
        let newProgress = currentProgress;

        switch (req.type) {
            case 'classic_score':
                newProgress = Math.max(currentProgress, eventData.score || 0);
                break;
            case 'combo_streak':
                newProgress = Math.max(currentProgress, eventData.streak || 0);
                break;
            case 'total_lines':
                newProgress = currentProgress + (eventData.count || 1);
                break;
            case 'missions_completed':
                newProgress = currentProgress + 1;
                break;
            case 'level_time':
                if (eventData.time < req.target) {
                    newProgress = 1;
                }
                break;
            default:
                newProgress = 1; // Conquistas binárias (feito/não feito)
        }

        // Atualiza progresso
        this.progress.set(id, newProgress);

        // Verifica se desbloqueou
        if (newProgress >= req.target && !this.unlockedIds.has(id)) {
            this.unlock(id);
        }
    }

    unlock(id) {
        if (this.unlockedIds.has(id)) return;

        this.unlockedIds.add(id);
        const achievement = this.achievements.get(id);

        console.log(`[ACHIEVEMENTS] Desbloqueado: ${id}`);

        // Aplicar recompensa
        if (achievement.reward) {
            this.applyReward(achievement.reward);
        }

        // Mostrar notificação
        this.queueNotification(achievement);

        // Save imediato para conquistas
        this.saveProgress();
    }

    applyReward(reward) {
        if (reward.type === 'xp') {
            // TODO: Integrar com sistema de XP quando existir
            console.log(`[ACHIEVEMENTS] +${reward.value} XP`);
        }
    }

    queueNotification(achievement) {
        this._notificationQueue.push(achievement);
        if (!this._isShowingNotification) {
            this.showNextNotification();
        }
    }

    showNextNotification() {
        if (this._notificationQueue.length === 0) {
            this._isShowingNotification = false;
            return;
        }

        this._isShowingNotification = true;
        const achievement = this._notificationQueue.shift();

        // Criar notificação visual
        this.displayNotification(achievement);

        // Próxima após 3s
        setTimeout(() => {
            this.showNextNotification();
        }, 3000);
    }

    displayNotification(achievement) {
        const container = document.getElementById('achievement-notification');
        if (!container) return;

        const i18n = this.game.i18n;
        const title = i18n.t(achievement.title_key);
        const desc = i18n.t(achievement.desc_key);

        container.innerHTML = `
            <div class="achievement-card ${achievement.tier}">
                <div class="achievement-icon">${achievement.icon}</div>
                <div class="achievement-text">
                    <div class="achievement-title">${title}</div>
                    <div class="achievement-desc">${desc}</div>
                </div>
            </div>
        `;

        container.classList.add('show');

        // Som
        if (this.game.audio) {
            this.game.audio.playMissionComplete();
        }

        // Esconde após 2.5s
        setTimeout(() => {
            container.classList.remove('show');
        }, 2500);
    }

    // API: Obter estatísticas
    getStats() {
        const total = this.achievements.size;
        const unlocked = this.unlockedIds.size;
        const percentage = Math.floor((unlocked / total) * 100);

        return {
            total,
            unlocked,
            percentage,
            remaining: total - unlocked
        };
    }

    // API: Obter conquistas por categoria
    getByCategory(category) {
        const result = [];
        this.achievements.forEach((ach, id) => {
            if (ach.category === category) {
                result.push({
                    ...ach,
                    id,
                    unlocked: this.unlockedIds.has(id),
                    progress: this.progress.get(id) || 0
                });
            }
        });
        return result;
    }

    // API: Obter todas conquistas (para UI)
    getAll() {
        const result = [];
        this.achievements.forEach((ach, id) => {
            // Esconde conquistas secretas não desbloqueadas
            if (ach.hidden && !this.unlockedIds.has(id)) return;

            result.push({
                ...ach,
                id,
                unlocked: this.unlockedIds.has(id),
                progress: this.progress.get(id) || 0
            });
        });
        return result;
    }
}
