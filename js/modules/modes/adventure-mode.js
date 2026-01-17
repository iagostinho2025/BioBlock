// js/modules/modes/adventure-mode.js

import { WORLDS, BONUS_LEVEL_CONFIG } from '../data/levels.js';
import { BOSS_LOGIC } from '../logic/bosses.js';

/**
 * MODO AVENTURA - Sistema de Progressão por Mundos
 *
 * - 5 mundos com 20 fases cada
 * - Sistema de objetivos (goals)
 * - Bosses com mecânicas únicas
 * - Progressão linear
 */

export class AdventureMode {
    constructor(game) {
        this.game = game;

        // Estado do Modo Aventura
        this.currentWorldIndex = 0;
        this.currentLevelIndex = 0;
        this.currentWorld = null;
        this.currentLevel = null;

        // Boss state
        this.bossState = {
            maxHp: 0,
            currentHp: 0,
            turnCount: 0
        };
    }

    /**
     * Inicializa o modo aventura
     */
    init() {
        console.log('⚔️ Modo Aventura Inicializado');

        // Carrega o primeiro mundo/fase
        this.loadWorld(0);
        this.loadLevel(0);
    }

    /**
     * Carrega um mundo específico
     */
    loadWorld(worldIndex) {
        if (worldIndex < 0 || worldIndex >= WORLDS.length) {
            console.error('Mundo inválido:', worldIndex);
            return;
        }

        this.currentWorldIndex = worldIndex;
        this.currentWorld = WORLDS[worldIndex];
        console.log(`🌍 Mundo carregado: ${this.currentWorld.name}`);
    }

    /**
     * Carrega uma fase específica
     */
    loadLevel(levelIndex) {
        if (!this.currentWorld) {
            console.error('Nenhum mundo carregado');
            return;
        }

        if (levelIndex < 0 || levelIndex >= this.currentWorld.levels.length) {
            console.error('Fase inválida:', levelIndex);
            return;
        }

        this.currentLevelIndex = levelIndex;
        this.currentLevel = this.currentWorld.levels[levelIndex];

        // Setup grid config (obstáculos)
        this.setupGridObstacles();

        // Setup boss se for fase de boss
        if (this.currentLevel.type === 'boss' && this.currentLevel.boss) {
            this.setupBoss(this.currentLevel.boss);
        }

        console.log(`📍 Fase ${this.currentLevel.id} carregada`);
    }

    /**
     * Configura obstáculos iniciais no grid
     */
    setupGridObstacles() {
        if (!this.currentLevel.gridConfig) return;

        this.currentLevel.gridConfig.forEach(obstacle => {
            const { r, c, type, key, emoji } = obstacle;
            this.game.grid[r][c] = { type, key, emoji };
        });

        this.game.renderGrid();
    }

    /**
     * Configura um boss
     */
    setupBoss(bossData) {
        this.bossState = {
            id: bossData.id,
            name: bossData.name,
            emoji: bossData.emoji,
            maxHp: bossData.maxHp,
            currentHp: bossData.maxHp,
            turnCount: 0
        };

        this.updateBossUI();
        console.log(`👹 Boss: ${bossData.name} (${bossData.maxHp} HP)`);
    }

    /**
     * Verifica se os objetivos foram completados
     */
    checkGoalsCompleted() {
        if (!this.currentLevel.goals) return false;

        const goals = this.currentLevel.goals;
        const collected = this.game.collectedItems || {};

        // Verifica cada objetivo
        for (const [itemKey, targetAmount] of Object.entries(goals)) {
            const currentAmount = collected[itemKey] || 0;
            if (currentAmount < targetAmount) {
                return false; // Falta completar este objetivo
            }
        }

        return true; // Todos objetivos completos
    }

    /**
     * Dano ao boss
     */
    damageBoss(amount) {
        if (!this.bossState || this.bossState.maxHp === 0) return;

        this.bossState.currentHp = Math.max(0, this.bossState.currentHp - amount);
        this.updateBossUI();

        if (this.bossState.currentHp === 0) {
            this.onBossDefeated();
        }
    }

    /**
     * Turno do boss (executar mecânicas)
     */
    onBossTurnEnd() {
        if (!this.bossState || this.bossState.maxHp === 0) return;
        if (!BOSS_LOGIC[this.bossState.id]) return;

        const bossLogic = BOSS_LOGIC[this.bossState.id];
        if (bossLogic.onTurnEnd) {
            bossLogic.onTurnEnd(this.game);
        }
    }

    /**
     * Boss derrotado
     */
    onBossDefeated() {
        console.log(`✅ ${this.bossState.name} derrotado!`);

        // Efeito visual
        this.game.triggerScreenFlash('#10b981');

        // TODO: Mostrar tela de vitória
        this.onLevelComplete();
    }

    /**
     * Fase completada
     */
    onLevelComplete() {
        console.log('🎉 Fase completada!');

        // Avança para próxima fase
        this.nextLevel();
    }

    /**
     * Próxima fase
     */
    nextLevel() {
        const nextIndex = this.currentLevelIndex + 1;

        // Verifica se ainda há fases neste mundo
        if (nextIndex < this.currentWorld.levels.length) {
            this.loadLevel(nextIndex);
        } else {
            // Próximo mundo
            this.nextWorld();
        }
    }

    /**
     * Próximo mundo
     */
    nextWorld() {
        const nextWorldIndex = this.currentWorldIndex + 1;

        if (nextWorldIndex < WORLDS.length) {
            this.loadWorld(nextWorldIndex);
            this.loadLevel(0);
        } else {
            console.log('🏆 JOGO COMPLETO!');
            // TODO: Tela de conclusão do jogo
        }
    }

    /**
     * Atualiza UI do boss
     */
    updateBossUI() {
        const bossHpEl = document.getElementById('boss-hp');
        const bossNameEl = document.getElementById('boss-name');

        if (bossHpEl && this.bossState) {
            const hpPercent = (this.bossState.currentHp / this.bossState.maxHp) * 100;
            bossHpEl.style.width = `${hpPercent}%`;
        }

        if (bossNameEl && this.bossState) {
            bossNameEl.textContent = `${this.bossState.emoji} ${this.bossState.name}`;
        }
    }

    /**
     * Chamado após colocar uma peça
     */
    onPiecePlaced(damage) {
        // Verifica objetivos
        if (this.checkGoalsCompleted()) {
            // Se for fase de boss, não completa até derrotar
            if (this.currentLevel.type !== 'boss') {
                this.onLevelComplete();
                return;
            }
        }

        // Se houver boss, aplica dano
        if (this.currentLevel.type === 'boss') {
            this.damageBoss(damage);
            this.onBossTurnEnd();
        }
    }

    /**
     * Reseta o modo (volta ao início)
     */
    reset() {
        this.loadWorld(0);
        this.loadLevel(0);
        this.bossState = {
            maxHp: 0,
            currentHp: 0,
            turnCount: 0
        };
    }

    /**
     * Cleanup ao sair do modo
     */
    cleanup() {
        // Limpa qualquer estado temporário
    }
}
