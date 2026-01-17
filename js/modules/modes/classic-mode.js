// js/modules/modes/classic-mode.js

/**
 * MODO CLÁSSICO - Sistema Zen Endless
 *
 * Inspirado em Tetris Effect e Bejeweled Zen
 * - Progressão infinita com níveis
 * - Sistema de scoring com combos
 * - Limpeza automática de linhas/colunas
 * - Sem game over (sempre pode continuar)
 */

export class ClassicMode {
    constructor(game) {
        this.game = game;

        // Estado do Modo Clássico
        this.score = 0;
        this.level = 1;
        this.linesCleared = 0;
        this.comboStreak = 0;
        this.bestScore = parseInt(localStorage.getItem('classic_best_score') || '0');

        // Constantes
        this.LINES_PER_LEVEL = 10;
        this.COMBO_TIMEOUT = 3000; // 3 segundos para manter combo
        this.comboTimer = null;
    }

    /**
     * Inicializa o modo clássico
     */
    init() {
        console.log('🎮 Modo Clássico Inicializado');
        this.updateUI();
    }

    /**
     * Detecta e limpa linhas/colunas completas
     * @returns {number} Número de linhas limpas
     */
    checkAndClearLines() {
        const clearedPositions = new Set();
        let totalCleared = 0;

        // 1. Verificar LINHAS HORIZONTAIS completas
        for (let r = 0; r < this.game.gridSize; r++) {
            const row = this.game.grid[r];
            const isFull = row.every(cell => cell !== null);

            if (isFull) {
                // Marcar todas as células da linha para remoção
                for (let c = 0; c < this.game.gridSize; c++) {
                    clearedPositions.add(`${r},${c}`);
                }
                totalCleared++;
            }
        }

        // 2. Verificar COLUNAS VERTICAIS completas
        for (let c = 0; c < this.game.gridSize; c++) {
            const columnCells = [];
            for (let r = 0; r < this.game.gridSize; r++) {
                columnCells.push(this.game.grid[r][c]);
            }

            const isFull = columnCells.every(cell => cell !== null);

            if (isFull) {
                // Marcar todas as células da coluna para remoção
                for (let r = 0; r < this.game.gridSize; r++) {
                    clearedPositions.add(`${r},${c}`);
                }
                totalCleared++;
            }
        }

        // 3. LIMPAR as células marcadas
        if (clearedPositions.size > 0) {
            this.clearMarkedCells(clearedPositions);
            this.processLineClears(totalCleared);
            return totalCleared;
        }

        return 0;
    }

    /**
     * Remove as células marcadas com animação
     */
    clearMarkedCells(positions) {
        positions.forEach(pos => {
            const [r, c] = pos.split(',').map(Number);
            this.game.grid[r][c] = null;
        });

        // Efeito visual de limpeza
        this.game.renderGrid();
        this.game.triggerScreenFlash('#10b981'); // Flash verde (sucesso)

        // SFX satisfatório
        if (this.game.audio) {
            this.game.audio.playSFX('line_clear');
        }
    }

    /**
     * Processa a pontuação e progressão após limpar linhas
     */
    processLineClears(linesCleared) {
        if (linesCleared === 0) {
            // Quebra o combo se não limpou nada
            this.resetCombo();
            return;
        }

        // Incrementa combo streak
        this.comboStreak++;
        this.resetComboTimer();

        // Calcula pontos baseado em linhas + combo
        const baseScore = this.calculateScore(linesCleared);
        const comboMultiplier = Math.min(this.comboStreak, 5); // Max x5
        const totalScore = baseScore * comboMultiplier;

        // Atualiza score
        this.score += totalScore;
        this.linesCleared += linesCleared;

        // Verifica Perfect Clear (grid vazio)
        if (this.isPerfectClear()) {
            this.score += 2000;
            this.game.triggerScreenFlash('#fbbf24'); // Flash dourado
            this.showFeedback('PERFECT CLEAR! +2000');
        }

        // Verifica se subiu de nível
        const newLevel = Math.floor(this.linesCleared / this.LINES_PER_LEVEL) + 1;
        if (newLevel > this.level) {
            this.levelUp(newLevel);
        }

        // Atualiza best score
        if (this.score > this.bestScore) {
            this.bestScore = this.score;
            localStorage.setItem('classic_best_score', this.bestScore);
        }

        // Mostra feedback de combo
        this.showFeedback(this.getComboFeedback());

        // Atualiza UI
        this.updateUI();
    }

    /**
     * Calcula pontuação base por número de linhas
     */
    calculateScore(linesCleared) {
        switch(linesCleared) {
            case 1: return 100;
            case 2: return 300;
            case 3: return 600;
            case 4: return 1000;
            default: return 1000 + (linesCleared - 4) * 400;
        }
    }

    /**
     * Verifica se o grid está completamente vazio
     */
    isPerfectClear() {
        return this.game.grid.every(row => row.every(cell => cell === null));
    }

    /**
     * Sobe de nível
     */
    levelUp(newLevel) {
        this.level = newLevel;

        // Efeito visual
        this.game.triggerScreenFlash('#a855f7'); // Flash roxo
        this.showFeedback(`LEVEL ${this.level}!`);

        // SFX de level up
        if (this.game.audio) {
            this.game.audio.playSFX('level_up');
        }

        // TODO: Pode acelerar música ou mudar cores gradualmente
    }

    /**
     * Reseta o timer de combo
     */
    resetComboTimer() {
        if (this.comboTimer) {
            clearTimeout(this.comboTimer);
        }

        this.comboTimer = setTimeout(() => {
            this.resetCombo();
        }, this.COMBO_TIMEOUT);
    }

    /**
     * Reseta o combo streak
     */
    resetCombo() {
        this.comboStreak = 0;
        if (this.comboTimer) {
            clearTimeout(this.comboTimer);
            this.comboTimer = null;
        }
    }

    /**
     * Retorna texto de feedback baseado no combo
     */
    getComboFeedback() {
        const streak = this.comboStreak;

        if (streak === 1) return 'GOOD!';
        if (streak === 2) return 'GREAT!';
        if (streak === 3) return 'EXCELLENT!';
        if (streak === 4) return 'PERFECT!';
        if (streak === 5) return 'WOW!';
        if (streak === 6) return 'HOLY COW!!';
        if (streak >= 7) return 'UNREAL!!!';

        return '';
    }

    /**
     * Mostra feedback visual na tela
     */
    showFeedback(text) {
        // TODO: Implementar animação de feedback
        console.log(`✨ ${text}`);
    }

    /**
     * Atualiza a UI do modo clássico
     */
    updateUI() {
        // Atualiza elementos de UI se existirem
        const scoreEl = document.getElementById('classic-score');
        const levelEl = document.getElementById('classic-level');
        const bestEl = document.getElementById('classic-best');
        const comboEl = document.getElementById('classic-combo');

        if (scoreEl) scoreEl.textContent = this.score.toLocaleString();
        if (levelEl) levelEl.textContent = this.level;
        if (bestEl) bestEl.textContent = this.bestScore.toLocaleString();
        if (comboEl) {
            comboEl.textContent = this.comboStreak > 1 ? `x${this.comboStreak} COMBO` : '';
            comboEl.style.display = this.comboStreak > 1 ? 'block' : 'none';
        }
    }

    /**
     * Chamado após colocar uma peça no grid
     */
    onPiecePlaced() {
        // Verifica e limpa linhas
        const cleared = this.checkAndClearLines();

        // Se limpou algo, pode ter criado novas oportunidades
        if (cleared > 0) {
            // Aguarda animação e verifica novamente (cascata)
            setTimeout(() => {
                this.checkAndClearLines();
            }, 300);
        }
    }

    /**
     * Reseta o jogo
     */
    reset() {
        this.score = 0;
        this.level = 1;
        this.linesCleared = 0;
        this.comboStreak = 0;
        this.resetCombo();
        this.updateUI();
    }

    /**
     * Cleanup ao sair do modo
     */
    cleanup() {
        this.resetCombo();
    }
}
