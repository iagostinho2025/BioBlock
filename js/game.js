import { getRandomPiece } from './modules/shapes.js';
import { EffectsSystem } from './modules/effects.js';
import { AudioSystem } from './modules/audio.js';
import { WORLDS } from './modules/data/levels.js';
import { BOSS_LOGIC } from './modules/logic/bosses.js';

const EMOJI_MAP = {
    'bee': '🐝', 'ghost': '👻', 'cop': '👮',
    'fire': '🔥', 'heart': '❤️‍🔥', 'ice_shard': '💎',
    'bomb': '💣', 'rotate': '🔄', 'swap': '🔀'
};

export class Game {
    constructor() {
        this.gridSize = 8;
        this.grid = Array(this.gridSize).fill().map(() => Array(this.gridSize).fill(null));
        
        // Elementos DOM
        this.screenMenu = document.getElementById('screen-menu');
        this.screenLevels = document.getElementById('screen-levels');
        this.screenGame = document.getElementById('screen-game');
        this.boardEl = document.getElementById('game-board');
        this.dockEl = document.getElementById('dock');
        this.goalsArea = document.getElementById('goals-area');
        this.modalOver = document.getElementById('modal-gameover');
        this.modalWin = document.getElementById('modal-victory');
        this.scoreOverEl = document.getElementById('score-final');
        this.scoreWinEl = document.getElementById('score-victory');

        // Estado do Jogo
        this.currentMode = 'casual'; 
        this.currentLevelConfig = null;
        this.currentHand = []; 
        this.bossState = { active: false, maxHp: 0, currentHp: 0, attackRate: 3, movesWithoutDamage: 0 };
        
        this.currentGoals = {}; 
        this.collected = {};
        this.score = 0;
        this.activeSnap = null; 
        
        // Power-Ups
        this.powerUps = { bomb: 0, rotate: 0, swap: 0 };
        this.interactionMode = null; // 'bomb', 'rotate', ou null
        
        // Sistemas
        this.effects = new EffectsSystem();
        this.audio = new AudioSystem();
        this.maxUnlockedLevel = 99; 

        this.setupMenuEvents();
    }

    loadProgress() {
        const saved = localStorage.getItem('blocklands_progress_main');
        return saved ? parseInt(saved) : 1; 
    }

    saveProgress(levelId) {
        const currentSaved = this.loadProgress();
        if (levelId > currentSaved) {
            localStorage.setItem('blocklands_progress_main', levelId);
        }
    }
    
    // --- Carregar PowerUps ---
    loadPowerUps() {
        this.powerUps.bomb = parseInt(localStorage.getItem('powerup_bomb') || '0');
        this.powerUps.rotate = parseInt(localStorage.getItem('powerup_rotate') || '0');
        this.powerUps.swap = parseInt(localStorage.getItem('powerup_swap') || '0');
        this.updatePowerUpsUI();
    }

    savePowerUps() {
        localStorage.setItem('powerup_bomb', this.powerUps.bomb);
        localStorage.setItem('powerup_rotate', this.powerUps.rotate);
        localStorage.setItem('powerup_swap', this.powerUps.swap);
        this.updatePowerUpsUI();
    }

    setupMenuEvents() {
        // Unlock de Áudio
        const unlockAudioOnce = () => {
            if (this.audio && this.audio.unlock) {
                this.audio.unlock();
            }
            document.removeEventListener('click', unlockAudioOnce);
            document.removeEventListener('touchstart', unlockAudioOnce);
        };
        document.addEventListener('click', unlockAudioOnce);
        document.addEventListener('touchstart', unlockAudioOnce);
        
        const bindClick = (id, action) => {
            const el = document.getElementById(id);
            if(el) {
                el.addEventListener('click', (e) => {
                    if (this.audio) this.audio.playClick();
                    action(e);
                });
            }
        };

        // Navegação
        bindClick('btn-mode-casual', () => this.startCasualMode());
        bindClick('btn-mode-adventure', () => this.showWorldSelect()); 
        bindClick('btn-mode-blitz', () => alert('Modo Blitz: Em breve! ⚡'));
        
        bindClick('btn-back-menu', () => this.showScreen(this.screenMenu));
        bindClick('btn-quit-game', () => this.showScreen(this.screenMenu));
        
        // Botão Reiniciar na derrota
        bindClick('btn-restart-over', () => this.retryGame());
        
        // --- CORREÇÃO AQUI: Botão Voltar da tela de derrota ---
        bindClick('btn-quit-over', () => {
            this.modalOver.classList.add('hidden');
            
            if (this.currentMode === 'adventure') {
                // Modo Aventura: Volta para o MAPA DA FASE
                this.showScreen(this.screenLevels);
                const currentWorld = WORLDS.find(w => w.levels.some(l => l.id === this.currentLevelConfig?.id));
                if (currentWorld) {
                    this.openWorldMap(currentWorld);
                } else {
                    this.showWorldSelect();
                }
            } else {
                // Modo Casual: Volta para o MENU
                this.showScreen(this.screenMenu);
            }
        });
        
        // Eventos dos Power-Ups
        bindClick('pwr-bomb', () => this.activatePowerUp('bomb'));
        bindClick('pwr-rotate', () => this.activatePowerUp('rotate'));
        bindClick('pwr-swap', () => this.activatePowerUp('swap'));
        
// --- NOVOS BOTÕES DE VITÓRIA (Padrão 2 Botões) ---
        
        // 1. Botão "Continuar" (Amarelo)
        const btnNextLevel = document.getElementById('btn-next-level');
        if (btnNextLevel) {
            btnNextLevel.addEventListener('click', () => {
                if(this.audio) this.audio.playClick();
                this.modalWin.classList.add('hidden');
                
                if(this.currentMode === 'adventure') {
                    // Tenta ir para o próximo nível
                    const currentWorld = WORLDS.find(w => w.levels.some(l => l.id === this.currentLevelConfig?.id));
                    const nextLevelId = this.currentLevelConfig.id + 1;
                    
                    // Verifica se existe próximo nível no mesmo mundo ou global
                    // Lógica simplificada: Reabre o mapa para o jogador clicar no próximo (padrão Candy Crush)
                    // Ou inicia direto:
                    // this.startAdventureLevel(ProximoNivelConfig); 
                    
                    // Vamos manter o fluxo de voltar ao mapa para ver o progresso
                    if (currentWorld) {
                        this.showScreen(this.screenLevels);
                        this.openWorldMap(currentWorld);
                    } else {
                        this.showWorldSelect();
                    }
                } else {
                    // Se for Casual/Bonus, "Continuar" reinicia ou volta pro menu
                    this.retryGame(); // Ou volta pro menu, depende da preferência
                }
            });
        }

        // 2. Botão "Voltar" (Azul)
        const btnVictoryBack = document.getElementById('btn-victory-back');
        if (btnVictoryBack) {
            btnVictoryBack.addEventListener('click', () => {
                if(this.audio) this.audio.playBack();
                this.modalWin.classList.add('hidden');
                
                if (this.currentMode === 'adventure') {
                    // Volta para o Mapa
                    this.showScreen(this.screenLevels);
                    const currentWorld = WORLDS.find(w => w.levels.some(l => l.id === this.currentLevelConfig?.id));
                    if (currentWorld) this.openWorldMap(currentWorld);
                    else this.showWorldSelect();
                } else {
                    // Volta para o Menu Principal
                    this.showScreen(this.screenMenu);
                }
            });
        }

        // Sidebar
        const btnOpen = document.getElementById('btn-open-sidebar');
        const sidebar = document.getElementById('app-sidebar');
        const overlay = document.getElementById('menu-overlay');
        const btnClose = document.getElementById('btn-close-sidebar');
        const toggleSidebar = (show) => {
            if(show) { sidebar.classList.add('open'); overlay.classList.remove('hidden'); setTimeout(()=>overlay.classList.add('visible'),10); }
            else { sidebar.classList.remove('open'); overlay.classList.remove('visible'); setTimeout(()=>overlay.classList.add('hidden'),300); }
        };
        if(btnOpen) btnOpen.addEventListener('click', () => { if(this.audio) this.audio.playClick(); toggleSidebar(true); });
        if(btnClose) btnClose.addEventListener('click', () => { if(this.audio) this.audio.playBack(); toggleSidebar(false); });
        if(overlay) overlay.addEventListener('click', () => { if(this.audio) this.audio.playBack(); toggleSidebar(false); });
    }

    // --- POWER-UP LOGIC ---

    updatePowerUpsUI() {
        ['bomb', 'rotate', 'swap'].forEach(type => {
            const btn = document.getElementById(`pwr-${type}`);
            if(!btn) return;
            
            const count = this.powerUps[type];
            btn.querySelector('.pwr-count').innerText = `${count}/3`;
            
            btn.classList.remove('active-mode');

            if (count <= 0) {
                btn.classList.add('disabled');
            } else {
                btn.classList.remove('disabled');
            }
            
            if (this.interactionMode === type) {
                btn.classList.add('active-mode');
            }
        });
    }

    activatePowerUp(type) {
        if (this.powerUps[type] <= 0) {
            if(this.audio) this.audio.vibrate(50); 
            return;
        }

        if (this.interactionMode === type) {
            this.interactionMode = null;
            this.updatePowerUpsUI();
            return;
        }

        if (type === 'swap') {
            if(this.audio) this.audio.playClick(); 
            this.powerUps.swap--;
            this.savePowerUps();
            this.spawnNewHand(); 
            this.effects.shakeScreen(); 
            return;
        }

        this.interactionMode = type;
        this.updatePowerUpsUI();
        if(this.audio) this.audio.playClick();
    }

    handleBoardClick(r, c) {
        if (this.interactionMode === 'bomb') {
            this.useBomb(r, c);
            this.interactionMode = null;
            this.updatePowerUpsUI();
        }
    }

    handlePieceClick(index) {
        if (this.interactionMode === 'rotate') {
            this.useRotate(index);
            this.interactionMode = null;
            this.updatePowerUpsUI();
        }
    }

    useBomb(centerR, centerC) {
        let exploded = false;
        
        for (let r = centerR - 1; r <= centerR + 1; r++) {
            for (let c = centerC - 1; c <= centerC + 1; c++) {
                if (r >= 0 && r < this.gridSize && c >= 0 && c < this.gridSize) {
                    if (this.grid[r][c]) {
                        
                        const idx = r * 8 + c;
                        const cell = this.boardEl.children[idx];
                        if (cell) {
                            const rect = cell.getBoundingClientRect();
                            this.spawnExplosion(rect, 'type-fire'); 
                        }

                        this.collectItem(r, c, this.grid[r][c]);
                        
                        this.grid[r][c] = null;
                        exploded = true;
                    }
                }
            }
        }

        if (exploded) {
            this.powerUps.bomb--;
            this.savePowerUps();
            if(this.audio) this.audio.playClear(2); 
            this.effects.shakeScreen();
            this.renderGrid(); 

            // Verifica vitória após explosão
            setTimeout(() => {
                if (!this.bossState.active) {
                    this.checkVictoryConditions();
                }
            }, 100);
        }
    }

    useRotate(pieceIndex) {
        const piece = this.currentHand[pieceIndex];
        if (!piece) return;

        const oldLayout = piece.layout;
        if (!oldLayout || oldLayout.length === 0) return;

        // Rotação segura que preserva itens
        const newLayout = oldLayout[0].map((val, index) =>
            oldLayout.map(row => row[index]).reverse()
        );

        // Verificação inteligente
        if (JSON.stringify(oldLayout) === JSON.stringify(newLayout)) {
            if(this.audio) this.audio.vibrate(50); 
            const slot = this.dockEl.children[pieceIndex];
            if (slot) {
                slot.style.transition = '0.1s';
                slot.style.transform = 'translateX(5px)';
                setTimeout(() => slot.style.transform = 'translateX(-5px)', 50);
                setTimeout(() => slot.style.transform = 'none', 100);
            }
            return; 
        }

        piece.layout = newLayout;
        piece.matrix = newLayout; 
        
        this.powerUps.rotate--;
        this.savePowerUps();
        
        this.renderDock();
        if(this.audio) this.audio.playClick(); 
    }

    renderDock() {
        this.dockEl.innerHTML = '';
        this.currentHand.forEach((piece, index) => {
            const slot = document.createElement('div');
            slot.classList.add('dock-slot');
            if (piece) this.createDraggablePiece(piece, index, slot);
            this.dockEl.appendChild(slot);
        });
    }

    // --- GERENCIAMENTO DE TELAS ---
    showScreen(screenEl) {
        if (this.screenGame.classList.contains('active-screen')) {
            if(this.audio) this.audio.stopMusic();
        }
        
        [this.screenMenu, this.screenLevels, this.screenGame].forEach(s => {
            if(s) {
                s.classList.remove('active-screen');
                s.classList.add('hidden');
            }
        });
        
        if (screenEl === this.screenMenu) {
            this.toggleGlobalHeader(false); 
        } else {
            this.toggleGlobalHeader(true);
        }

        if(screenEl) {
            screenEl.classList.remove('hidden');
            screenEl.classList.add('active-screen');
        }
    }

    toggleGlobalHeader(show) {
        const levelHeader = document.querySelector('.level-header');
        if (levelHeader) {
            if (show) levelHeader.classList.remove('hidden-header');
            else levelHeader.classList.add('hidden-header');
        }
    }

    // --- MUNDOS E NÍVEIS ---

    showWorldSelect() {
        const container = document.getElementById('levels-container');
        if (container) {
            container.style.backgroundImage = 'none';
            container.style.backgroundColor = '';
        }

        this.showScreen(this.screenLevels); 
        this.toggleGlobalHeader(false); 

        if(!container) return;
        
        container.className = 'world-select-layout'; 
        
        container.innerHTML = `
            <div class="premium-world-header" style="margin-bottom: 50px;">
                <button id="btn-world-back-internal" class="btn-premium-back">⬅</button>
                <h2 class="premium-title">Modo Aventura</h2>
            </div>
            <div class="worlds-grid" id="worlds-grid"></div>
        `;

        const backBtn = document.getElementById('btn-world-back-internal');
        if (backBtn) {
            const newBackBtn = backBtn.cloneNode(true);
            backBtn.parentNode.replaceChild(newBackBtn, backBtn);
            
            newBackBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                e.preventDefault();
                if(this.audio) this.audio.playBack();
                container.className = '';
                container.innerHTML = '';
                this.showScreen(this.screenMenu);
            });
        }

        const grid = document.getElementById('worlds-grid');
        const currentSave = this.loadProgress(); 

        WORLDS.forEach((world, index) => {
            const btn = document.createElement('div');
            btn.classList.add('world-card');
            
            const requiredLevel = (index * 20) + 1;
            const isLocked = currentSave < requiredLevel && index > 0;

            if (isLocked) {
                btn.classList.add('world-locked');
                btn.innerHTML += `<div class="lock-icon">🔒</div>`;
            }

            btn.innerHTML += `
                <div class="world-boss-circle" style="background: ${world.gradient}">
                    ${world.bossAvatar}
                </div>
                <div class="world-card-title"><span>${world.emoji}</span> ${world.name}</div>
                <div class="world-card-info">${world.totalLevels} Fases<span class="boss-highlight">Boss ${world.bossName}</span></div>
            `;

            btn.addEventListener('click', () => {
                if (!isLocked) {
                    if(this.audio) this.audio.playClick();
                    this.openWorldMap(world); 
                } else {
                    if(this.audio) this.audio.vibrate(50);
                }
            });
            grid.appendChild(btn);
        });
    }

    openWorldMap(worldConfig) {
        const container = document.getElementById('levels-container');
        if(!container) return;

        this.toggleGlobalHeader(false);

        if (worldConfig.bgImage) {
            container.style.backgroundImage = `url('${worldConfig.bgImage}')`;
        } else {
            container.style.background = '#0f172a'; 
        }

        container.innerHTML = `
            <div class="premium-world-header" style="margin-bottom: 30px;">
                <button id="btn-map-back" class="btn-premium-back">⬅</button>
                <h2 class="premium-title">${worldConfig.name}</h2>
            </div>
            <div id="level-grid-area" class="level-grid-layout"></div>
        `;

        const mapBackBtn = document.getElementById('btn-map-back');
        if(mapBackBtn) {
            mapBackBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                if(this.audio) this.audio.playBack();
                this.showWorldSelect(); 
            });
        }

        const gridArea = document.getElementById('level-grid-area');
        const currentSave = this.loadProgress();

        worldConfig.levels.forEach((level, index) => {
            const levelNum = index + 1; 
            const btn = document.createElement('button');
            btn.classList.add('level-btn');
            
            let isLocked = false;
            if (level.id < currentSave) {
                btn.classList.add('status-completed');
            } else if (level.id === currentSave) {
                btn.classList.add('status-current');
            } else {
                btn.classList.add('status-locked');
                isLocked = true;
            }

            if (levelNum === 20) { 
                btn.classList.add('type-boss');
                btn.innerText = worldConfig.bossAvatar || '🐉';
            } 
            else if (levelNum === 10 || levelNum === 15) { 
                btn.classList.add('type-elite');
                btn.innerHTML = `${levelNum} <div class="elite-skull">💀</div>`;
            } 
            else { 
                btn.innerText = levelNum;
            }

            btn.addEventListener('click', () => {
                if (!isLocked) {
                    if(this.audio) this.audio.playClick();
                    this.toggleGlobalHeader(true); 
                    container.style.backgroundImage = 'none';
                    document.body.className = ''; 
                    if(worldConfig.themeClass) document.body.classList.add(worldConfig.themeClass);
                    this.startAdventureLevel(level);
                } else {
                    if(this.audio) this.audio.vibrate(50);
                }
            });
            gridArea.appendChild(btn);

            if (levelNum === 19) {
                const bonusBtn = document.createElement('button');
                bonusBtn.classList.add('level-btn', 'type-bonus'); 
                bonusBtn.innerHTML = '🎁'; 
                
                const isBonusAvailable = true; 

                if (isBonusAvailable) {
                    bonusBtn.addEventListener('click', () => {
                        if(this.audio) this.audio.playClick();
                        import('./modules/data/levels.js').then(module => {
                            this.toggleGlobalHeader(true);
                            container.style.backgroundImage = 'none';
                            this.startAdventureLevel(module.BONUS_LEVEL_CONFIG);
                        });
                    });
                } else {
                    bonusBtn.classList.add('status-locked');
                }
                gridArea.appendChild(bonusBtn);
            }
        });
    }

    // --- GAMEPLAY CORE ---

    setupGoalsUI(goalsConfig) {
        if(!this.goalsArea) return;
        this.currentGoals = { ...goalsConfig }; 
        this.collected = {};
        Object.keys(this.currentGoals).forEach(key => this.collected[key] = 0);

        let html = '<div class="goals-container">';
        Object.keys(this.currentGoals).forEach(key => {
            const emoji = EMOJI_MAP[key] || '❓';
            html += `
                <div class="goal-item" id="goal-item-${key}">
                    <div class="goal-circle type-${key}-glow"><span class="goal-emoji">${emoji}</span></div>
                    <div class="goal-info"><span class="goal-counter" id="goal-val-${key}">0/${this.currentGoals[key]}</span></div>
                </div>`;
        });
        html += '</div>';
        this.goalsArea.innerHTML = html;
    }

    updateGoalsUI() {
        Object.keys(this.currentGoals).forEach(key => {
            const el = document.getElementById(`goal-val-${key}`);
            if(!el) return;
            const target = this.currentGoals[key];
            const current = this.collected[key] || 0;
            el.innerText = `${current}/${target}`;
            const parent = document.getElementById(`goal-item-${key}`);
            if (current >= target && parent) parent.classList.add('completed');
        });
    }

    checkVictoryConditions() {
        if (!this.currentGoals || Object.keys(this.currentGoals).length === 0) return false;

        if (this.currentLevelConfig && this.currentLevelConfig.type === 'bonus') {
            const winners = [];
            
            // 1. Carrega inventário
            const inventory = {
                bomb: parseInt(localStorage.getItem('powerup_bomb') || '0'),
                rotate: parseInt(localStorage.getItem('powerup_rotate') || '0'),
                swap: parseInt(localStorage.getItem('powerup_swap') || '0')
            };

            const isFullInventory = (inventory.bomb >= 3 && inventory.rotate >= 3 && inventory.swap >= 3);

            // 2. Verifica metas
            Object.keys(this.currentGoals).forEach(key => {
                const currentAmount = this.collected[key] || 0;
                const targetAmount = this.currentGoals[key];

                if (currentAmount >= targetAmount) {
                    // Só ganha se precisar do item
                    if (inventory[key] < 3 || isFullInventory) {
                        winners.push(key);
                    }
                }
            });

            if (winners.length > 0) {
                const rewardsList = [];

                winners.forEach(powerUp => {
                    const currentAmount = parseInt(localStorage.getItem(`powerup_${powerUp}`) || '0');
                    const newAmount = Math.min(currentAmount + 1, 3);
                    localStorage.setItem(`powerup_${powerUp}`, newAmount);
                    
                    rewardsList.push({ type: powerUp, count: 1 });
                });
                
                this.loadPowerUps();

                setTimeout(() => {
                    this.gameWon(this.collected, rewardsList);
                }, 300);
                
                return true; 
            }
            return false;
        }

        const allMet = Object.keys(this.currentGoals).every(key => {
            return (this.collected[key] || 0) >= this.currentGoals[key];
        });

        if (allMet) {
            setTimeout(() => {
                this.gameWon(this.collected, []); 
            }, 300);
            return true;
        }
        return false;
    }

    startCasualMode() {
        this.currentMode = 'casual';
        this.currentLevelConfig = null;
        this.clearTheme();
        this.showScreen(this.screenGame);
        this.setupGoalsUI({ bee: 10, ghost: 10, cop: 10 });
        this.resetGame();
    }

    startAdventureLevel(levelConfig) {
        this.currentMode = 'adventure';
        this.currentLevelConfig = levelConfig;
        this.showScreen(this.screenGame);
        
        if (levelConfig.type === 'boss') {
            const bossData = levelConfig.boss || { id: 'dragon', name: 'Dragão', emoji: '🐉', maxHp: 50 };
            this.setupBossUI(bossData);
            this.bossState = { active: true, maxHp: bossData.maxHp, currentHp: bossData.maxHp, attackRate: 3, movesWithoutDamage: 0 };
            this.currentGoals = {}; 
            if(this.audio) this.audio.playBossMusic();
        } else {
            this.bossState.active = false;
            const goals = (levelConfig.goals && Object.keys(levelConfig.goals).length > 0) 
                ? levelConfig.goals 
                : { bee: 10 }; 
            
            this.setupGoalsUI(goals);
            if(this.audio) this.audio.stopMusic();
        }
        this.resetGame();
    }

    setupBossUI(bossData) {
        if(!this.goalsArea) return;
        this.goalsArea.innerHTML = `
            <div class="boss-ui-container">
                <div id="boss-target" class="boss-avatar">${bossData.emoji}</div>
                <div class="boss-stats"><div class="boss-name">${bossData.name}</div>
                <div class="hp-bar-bg"><div class="hp-bar-fill" id="boss-hp-bar" style="width: 100%"></div></div></div>
            </div>`;
    }

    clearTheme() { document.body.className = ''; }

    retryGame() {
        this.modalOver.classList.add('hidden');
        this.modalWin.classList.add('hidden');
        if (this.currentMode === 'adventure' && this.bossState.active) {
            if(this.audio) this.audio.playBossMusic();
        }
        this.resetGame();
    }

    resetGame() {
        this.grid = Array(this.gridSize).fill().map(() => Array(this.gridSize).fill(null));
        this.score = 0;
        
        this.interactionMode = null;
        this.bossState.active = (this.currentLevelConfig?.type === 'boss');
        this.loadPowerUps(); 
        
        if(!this.bossState.active) {
            const goals = (this.currentMode === 'casual') ? { bee: 10, ghost: 10, cop: 10 } : this.currentGoals;
            this.setupGoalsUI(goals); 
        } else {
            this.bossState.currentHp = this.bossState.maxHp;
            this.updateBossUI();
        }

        if (this.currentMode === 'adventure' && this.currentLevelConfig?.gridConfig) {
            this.currentLevelConfig.gridConfig.forEach(cfg => {
                if(this.grid[cfg.r]) {
                    this.grid[cfg.r][cfg.c] = { 
                        type: cfg.type, 
                        key: cfg.key, 
                        emoji: cfg.emoji 
                    }; 
                }
            });
        }
        this.renderGrid();
        this.spawnNewHand();
    }

    // --- EFEITO VISUAL: Partículas ---
    spawnExplosion(rect, colorClass) {
        const colors = {
            'type-fire': '#ef4444',
            'type-water': '#3b82f6',
            'type-forest': '#22c55e',
            'type-mountain': '#78716c',
            'type-ice': '#06b6d4',
            'type-zombie': '#84cc16',
            'type-bee': '#eab308',
            'type-ghost': '#a855f7',
            'type-cop': '#1e40af',
            'type-normal': '#3b82f6',
            'lava': '#b91c1c'
        };
        
        const bg = colors[colorClass] || '#3b82f6';

        for (let i = 0; i < 8; i++) {
            const debris = document.createElement('div');
            debris.classList.add('debris-particle');
            
            debris.style.position = 'fixed';
            debris.style.zIndex = '9999';
            debris.style.pointerEvents = 'none';
            debris.style.width = `${Math.random() * 12 + 12}px`;
            debris.style.height = debris.style.width;
            
            debris.style.backgroundColor = bg;
            
            const startX = rect.left + (rect.width / 2) + (Math.random() * 30 - 15);
            const startY = rect.top + (rect.height / 2) + (Math.random() * 30 - 15);
            
            debris.style.left = `${startX}px`;
            debris.style.top = `${startY}px`;

            const tx = (Math.random() * 240 - 120) + 'px';
            const ty = (Math.random() * 240 - 120) + 'px';
            const rot = (Math.random() * 720) + 'deg';

            debris.style.setProperty('--tx', tx);
            debris.style.setProperty('--ty', ty);
            debris.style.setProperty('--rot', rot);

            debris.style.animation = `crumble-fly 0.7s ease-out forwards`;

            document.body.appendChild(debris);

            setTimeout(() => debris.remove(), 700);
        }
    }

    // --- EFEITO VISUAL: Voo ---
    runFlyAnimation(r, c, key, emoji) {
        const idx = r * 8 + c;
        const cell = this.boardEl.children[idx];
        if (!cell) return;
        const startRect = cell.getBoundingClientRect();

        let targetEl = null;

        if (this.bossState.active) {
            targetEl = document.getElementById('boss-target');
        } else {
            targetEl = document.getElementById(`goal-item-${key}`);
        }

        if (!targetEl) return;

        const targetRect = targetEl.getBoundingClientRect();

        const flyer = document.createElement('div');
        flyer.classList.add('flying-item');
        
        flyer.style.position = 'fixed';
        flyer.style.zIndex = '9999';
        flyer.style.pointerEvents = 'none';
        flyer.style.transition = 'all 0.7s cubic-bezier(0.19, 1, 0.22, 1)';
        flyer.style.transformOrigin = 'center';
        
        flyer.innerText = emoji;
        
        flyer.style.left = `${startRect.left + startRect.width/4}px`; 
        flyer.style.top = `${startRect.top + startRect.height/4}px`;
        
        document.body.appendChild(flyer);

        requestAnimationFrame(() => {
            const destX = targetRect.left + targetRect.width/2 - 20; 
            const destY = targetRect.top + targetRect.height/2 - 20;

            flyer.style.left = `${destX}px`;
            flyer.style.top = `${destY}px`;
            flyer.style.transform = 'scale(0.5)'; 
        });

        setTimeout(() => {
            flyer.remove();
            targetEl.classList.remove('target-pop'); 
            void targetEl.offsetWidth; 
            targetEl.classList.add('target-pop'); 
        }, 700); 
    }

    renderGrid() {
        this.boardEl.innerHTML = '';
        this.grid.forEach((row, rIndex) => {
            row.forEach((cellData, cIndex) => {
                const div = document.createElement('div');
                div.classList.add('cell');
                div.dataset.r = rIndex; div.dataset.c = cIndex;
                
                div.addEventListener('click', () => this.handleBoardClick(rIndex, cIndex));
                
                if (cellData) {
                    if (cellData.type === 'LAVA') { 
                        div.classList.add('lava'); 
                        div.innerText = '🌋';
                    } else {
                        div.classList.add('filled');
                        if (cellData.key) div.classList.add('type-' + cellData.key.toLowerCase());
                        else this.applyColorClass(div, cellData);
                        if (cellData.type === 'ITEM') div.innerText = cellData.emoji;
                    }
                }
                this.boardEl.appendChild(div);
            });
        });
    }

    applyColorClass(element, cellData) {
        element.className = element.className.replace(/type-[\w-]+/g, '').trim();
        element.classList.add('filled'); 
        if (cellData?.type === 'ITEM' && cellData.key) element.classList.add('type-' + cellData.key.toLowerCase());
        else element.classList.add('type-normal');
    }

    spawnNewHand() {
        if(!this.dockEl) return;
        this.dockEl.innerHTML = '';
        
        const customItems = (this.currentMode === 'adventure' && this.currentLevelConfig) 
            ? this.currentLevelConfig.items : null;
        
        let forceEasy = false;
        if (this.currentLevelConfig && this.currentLevelConfig.type === 'bonus') {
            let emptySlots = 0;
            this.grid.forEach(r => r.forEach(c => { if(!c) emptySlots++ }));
            if (emptySlots > 30) forceEasy = true; 
        }

        this.currentHand = [];
        for(let i=0; i<3; i++) {
            const piece = getRandomPiece(customItems);
            if (forceEasy && piece.matrix.flat().filter(x=>x).length > 4) {
                 this.currentHand.push(getRandomPiece(customItems)); 
            } else {
                 this.currentHand.push(piece);
            }
        }
        
        this.renderDock(); 

        setTimeout(() => { if (!this.checkMovesAvailable()) this.gameOver(); }, 100);
    }

    createDraggablePiece(piece, index, parentContainer) {
        const container = document.createElement('div');
        container.classList.add('draggable-piece');
        container.dataset.index = index;
        container.style.gridTemplateColumns = `repeat(${piece.matrix[0].length}, 1fr)`;
        container.style.gridTemplateRows = `repeat(${piece.matrix.length}, 1fr)`;
        
        container.addEventListener('click', (e) => {
            this.handlePieceClick(index);
        });
        
        piece.layout.forEach(row => {
            row.forEach(cellData => {
                const block = document.createElement('div');
                if (cellData) {
                    block.classList.add('block-unit');
                    this.applyColorClass(block, cellData);
                    if (typeof cellData === 'object' && cellData.type === 'ITEM') {
                        block.innerText = cellData.emoji;
                    }
                } else {
                    block.style.visibility = 'hidden';
                }
                container.appendChild(block);
            });
        });
        
        this.attachDragEvents(container, piece);
        parentContainer.appendChild(container);
    }

    attachDragEvents(el, piece) {
        let isDragging = false;
        let clone = null;
        let cellPixelSize = 0; 
        let boardRect = null;

        const onStart = (e) => {
            if (this.interactionMode === 'rotate') return;

            if (isDragging) return;
            if(this.audio) this.audio.playDrag();
            isDragging = true; 
            this.activeSnap = null;
            
            boardRect = this.boardEl.getBoundingClientRect();
            const firstCell = this.boardEl.querySelector('.cell');
            if (firstCell) {
                cellPixelSize = firstCell.getBoundingClientRect().width;
            } else {
                cellPixelSize = (boardRect.width - 16) / 8;
            }
            
            clone = el.cloneNode(true);
            clone.classList.add('dragging-active');
            clone.style.display = 'grid';
            
            const cols = piece.matrix[0].length;
            const rows = piece.matrix.length;
            clone.style.width = (cols * cellPixelSize) + 'px';
            clone.style.height = (rows * cellPixelSize) + 'px';
            clone.style.gridTemplateColumns = `repeat(${cols}, 1fr)`;
            clone.style.gridTemplateRows = `repeat(${rows}, 1fr)`; 
            clone.style.gap = '4px'; 
            
            const touch = e.touches ? e.touches[0] : e;
            this.moveClone(clone, touch.clientX, touch.clientY);
            document.body.appendChild(clone);
            el.style.opacity = '0'; 
        };

        const onMove = (e) => {
            if (!isDragging || !clone) return;
            e.preventDefault(); 
            const touch = e.touches ? e.touches[0] : e;
            this.moveClone(clone, touch.clientX, touch.clientY);
            this.updateGhostPreview(clone, boardRect, cellPixelSize, piece);
        };

        const onEnd = (e) => {
            if (!isDragging) return;
            isDragging = false;
            const touch = e.changedTouches ? e.changedTouches[0] : e;
            const dropX = touch.clientX; const dropY = touch.clientY;
            
            let placed = false;
            if (this.activeSnap && this.activeSnap.valid) {
                placed = this.placePiece(this.activeSnap.r, this.activeSnap.c, piece);
            }

            if (placed) {
                if(this.audio) {
                    this.audio.playDrop(); 
                    this.audio.vibrate(20);
                }
                
                el.remove(); 
                
                // Remove da memória
                const index = parseInt(el.dataset.index);
                if (!isNaN(index)) {
                    this.currentHand[index] = null; 
                }

                let hasWon = false; 

                try {
                    const damageDealt = this.checkLines(dropX, dropY); 
                    
                    if (this.currentMode === 'adventure') {
                        if (this.bossState.active) {
                            this.processBossTurn(damageDealt);
                            if (this.bossState.currentHp <= 0) hasWon = true; 
                        } else {
                            hasWon = this.checkVictoryConditions();
                        }
                    } else {
                        hasWon = this.checkVictoryConditions();
                    }
                } catch(e) { console.error(e); }

                if (!hasWon) {
                    const remainingPieces = this.dockEl.querySelectorAll('.draggable-piece');
                    if (remainingPieces.length === 0) {
                        this.spawnNewHand();
                    } else {
                        if (!this.checkMovesAvailable()) this.gameOver();
                    }
                }
            } else {
                el.style.opacity = '1';
            }
            
            if (clone) clone.remove();
            this.clearGhostPreview();
            this.activeSnap = null;
        };
        
        el.addEventListener('mousedown', onStart);
        el.addEventListener('touchstart', onStart, {passive: false});
        window.addEventListener('mousemove', onMove);
        window.addEventListener('touchmove', onMove, {passive: false});
        window.addEventListener('mouseup', onEnd);
        window.addEventListener('touchend', onEnd);
    }
    
    moveClone(clone, clientX, clientY) {
        const VISUAL_OFFSET_Y = 80;
        const x = clientX - (clone.offsetWidth / 2);
        const y = clientY - (clone.offsetHeight / 2) - VISUAL_OFFSET_Y; 
        clone.style.left = x + 'px';
        clone.style.top = y + 'px';
    }

    updateGhostPreview(clone, boardRect, cellSize, piece) {
        this.clearGhostPreview();
        const cloneRect = clone.getBoundingClientRect();
        const GAP = 4; const PADDING = 8;  
        
        const relativeX = (cloneRect.left + cloneRect.width / 2) - (boardRect.left + PADDING);
        const relativeY = (cloneRect.top + cloneRect.height / 2) - (boardRect.top + PADDING);
        
        const effectiveSize = cellSize + GAP;
        
        const exactCol = (relativeX / effectiveSize) - (piece.matrix[0].length / 2);
        const exactRow = (relativeY / effectiveSize) - (piece.matrix.length / 2);
        
        const baseR = Math.round(exactRow);
        const baseC = Math.round(exactCol);

        const candidates = [{ r: baseR, c: baseC }, { r: baseR + 1, c: baseC }, { r: baseR - 1, c: baseC }, { r: baseR, c: baseC + 1 }, { r: baseR, c: baseC - 1 }];
        let bestMatch = null; let minDistance = Infinity;

        for (const cand of candidates) {
            const isValid = this.canPlace(cand.r, cand.c, piece);
            const dist = Math.sqrt(Math.pow(cand.r - exactRow, 2) + Math.pow(cand.c - exactCol, 2));
            if (isValid) {
                if (!bestMatch || !bestMatch.valid || dist < minDistance) {
                    bestMatch = { r: cand.r, c: cand.c, valid: true };
                    minDistance = dist;
                }
            } else if (!bestMatch && dist < 0.6) { 
                bestMatch = { r: cand.r, c: cand.c, valid: false };
            }
        }

        if (bestMatch) {
            this.activeSnap = bestMatch;
            this.drawGhost(bestMatch.r, bestMatch.c, piece, bestMatch.valid);
        } else {
            this.activeSnap = null;
        }
    }

    drawGhost(r, c, piece, isValid) {
        const className = isValid ? 'ghost-valid' : 'ghost-invalid';
        for (let i = 0; i < piece.layout.length; i++) {
            for (let j = 0; j < piece.layout[i].length; j++) {
                if (piece.layout[i][j]) {
                    const targetR = r + i;
                    const targetC = c + j;
                    if (targetR >= 0 && targetR < this.gridSize && targetC >= 0 && targetC < this.gridSize) {
                        const idx = targetR * 8 + targetC;
                        const cell = this.boardEl.children[idx];
                        if (cell) cell.classList.add('ghost', className);
                    }
                }
            }
        }
    }
    clearGhostPreview() { this.boardEl.querySelectorAll('.ghost').forEach(el => el.classList.remove('ghost', 'ghost-valid', 'ghost-invalid')); }

    canPlace(r, c, piece) {
        for (let i = 0; i < piece.layout.length; i++) {
            for (let j = 0; j < piece.layout[i].length; j++) {
                if (piece.layout[i][j]) { 
                    const targetR = r + i;
                    const targetC = c + j;
                    if (targetR < 0 || targetR >= this.gridSize || targetC < 0 || targetC >= this.gridSize) return false;
                    if (this.grid[targetR][targetC] !== null) return false;
                }
            }
        }
        return true;
    }

    placePiece(r, c, piece) {
        if (!this.canPlace(r, c, piece)) return false;
        for (let i = 0; i < piece.layout.length; i++) {
            for (let j = 0; j < piece.layout[i].length; j++) {
                const cellData = piece.layout[i][j];
                if (cellData) { 
                    const targetR = r + i;
                    const targetC = c + j;
                    this.grid[targetR][targetC] = cellData;
                    const cellEl = this.boardEl.children[targetR * 8 + targetC];
                    cellEl.classList.add('filled');
                    this.applyColorClass(cellEl, cellData);
                    if (cellData.type === 'ITEM') cellEl.innerText = cellData.emoji;
                }
            }
        }
        return true;
    }

    checkLines(dropX, dropY) {
        let linesCleared = 0;
        let damageDealt = false;
        const rowsToClear = [];
        const colsToClear = [];

        for (let r = 0; r < this.gridSize; r++) {
            if (this.grid[r].every(val => val !== null)) rowsToClear.push(r);
        }
        for (let c = 0; c < this.gridSize; c++) {
            let full = true;
            for (let r = 0; r < this.gridSize; r++) {
                if (this.grid[r][c] === null) { full = false; break; }
            }
            if (full) colsToClear.push(c);
        }

        const cellsToExplode = [];
        
        rowsToClear.forEach(r => {
            for(let c=0; c<this.gridSize; c++) cellsToExplode.push({r, c});
        });
        colsToClear.forEach(c => {
            for(let r=0; r<this.gridSize; r++) cellsToExplode.push({r, c});
        });

        cellsToExplode.forEach(pos => {
            const idx = pos.r * 8 + pos.c;
            const cell = this.boardEl.children[idx];
            if (cell && (cell.classList.contains('filled') || cell.classList.contains('lava'))) {
                const colorClass = Array.from(cell.classList).find(cls => cls.startsWith('type-') || cls === 'lava') || 'type-normal';
                
                const rect = cell.getBoundingClientRect();
                this.spawnExplosion(rect, colorClass);
            }
        });

        rowsToClear.forEach(r => { if(this.clearRow(r)) damageDealt = true; linesCleared++; });
        colsToClear.forEach(c => { if(this.clearCol(c)) damageDealt = true; linesCleared++; });

        if (linesCleared > 0) {
            this.renderGrid(); 
            this.effects.showFeedback(linesCleared);
            if(this.audio) {
                if (this.bossState.active) this.audio.playBossClear(linesCleared); 
                else this.audio.playClear(linesCleared); 
                this.audio.vibrate([30, 50, 30]);
            }
            this.score += linesCleared * 10 * linesCleared; 
        }
        return damageDealt;
    }

    clearRow(r) {
        let foundDamage = false;
        for(let c=0; c<this.gridSize; c++) {
            if(this.grid[r][c]) {
                if(this.collectItem(r, c, this.grid[r][c])) foundDamage = true; 
                this.grid[r][c] = null;
            }
        }
        return foundDamage;
    }

    clearCol(c) {
        let foundDamage = false;
        for(let r=0; r<this.gridSize; r++) {
            if (this.grid[r][c]) { 
                if(this.collectItem(r, c, this.grid[r][c])) foundDamage = true;
                this.grid[r][c] = null;
            }
        }
        return foundDamage;
    }

    collectItem(r, c, cellData) {
        if (!cellData) return false;
        
        if (cellData.type === 'ITEM') {
            const key = cellData.key.toLowerCase(); 
            
            this.runFlyAnimation(r, c, key, cellData.emoji);

            if (this.currentGoals[key] !== undefined) {
                this.collected[key] = (this.collected[key] || 0) + 1;
                this.updateGoalsUI();
            }
            
            if (this.currentMode === 'adventure' && this.bossState.active) {
                this.damageBoss(5);
                return true; 
            }
        }
        return false;
    }

    processBossTurn(damageDealt) {
        if (damageDealt) {
            this.bossState.movesWithoutDamage = 0;
        } else {
            this.bossState.movesWithoutDamage++;
            if (this.bossState.movesWithoutDamage >= this.bossState.attackRate) {
                this.triggerBossAttack();
                this.bossState.movesWithoutDamage = 0;
            }
        }
    }

    triggerBossAttack() {
        this.effects.shakeScreen();
        const bossId = (this.currentLevelConfig.boss?.id) || 'dragon_ignis';
        
        try {
            const behavior = BOSS_LOGIC ? BOSS_LOGIC[bossId] : null;
            if (behavior?.onAttack) behavior.onAttack(this);
        } catch(e) { console.warn("Boss logic error", e); }
    }

    triggerScreenFlash(color) {
        document.body.style.transition = 'background-color 0.1s';
        const oldBg = document.body.style.backgroundColor;
        document.body.style.backgroundColor = color; 
        setTimeout(() => { document.body.style.backgroundColor = oldBg; }, 200);
    }

    transformCell(r, c, newData) {
        this.grid[r][c] = newData;
        const idx = r * 8 + c;
        const el = this.boardEl.children[idx];
        if (el) {
            el.style.transform = 'scale(0)';
            setTimeout(() => {
                this.renderGrid(); 
                const newEl = this.boardEl.children[idx];
                if(newEl) {
                    newEl.style.transform = 'scale(1.2)';
                    setTimeout(() => newEl.style.transform = 'scale(1)', 150);
                }
            }, 100);
        }
    }

    damageBoss(amount) {
        this.bossState.currentHp = Math.max(0, this.bossState.currentHp - amount);
        this.updateBossUI();
        
        if (this.bossState.currentHp <= 0) {
            setTimeout(() => {
                this.gameWon({}, []); 
            }, 500);
        }
    }

    updateBossUI() {
        const bar = document.getElementById('boss-hp-bar');
        if(bar) {
            const pct = (this.bossState.currentHp / this.bossState.maxHp) * 100;
            bar.style.width = pct + '%';
        }
    }

    checkMovesAvailable() {
        if(!this.dockEl) return true;
        const remainingPiecesEls = this.dockEl.querySelectorAll('.draggable-piece');
        if (remainingPiecesEls.length === 0) return true;

        for (const el of remainingPiecesEls) {
            const index = el.dataset.index;
            const piece = this.currentHand[index];
            if (!piece) continue;
            for (let r = 0; r < this.gridSize; r++) {
                for (let c = 0; c < this.gridSize; c++) {
                    if (this.canPlace(r, c, piece)) return true;
                }
            }
        }
        return false; 
    }

    gameWon(collectedGoals = {}, earnedRewards = []) {
        if(this.audio) this.audio.stopMusic();
        if(this.audio) { this.audio.playClear(3); this.audio.vibrate([100, 50, 100, 50, 200]); }
        
        const modal = this.modalWin;
        const goalsGrid = document.getElementById('victory-goals-grid');
        const rewardsGrid = document.getElementById('victory-rewards-grid');
        const rewardsSection = document.getElementById('victory-rewards-section');
        const scoreEl = document.getElementById('score-victory');

        goalsGrid.innerHTML = '';
        rewardsGrid.innerHTML = '';

        if (Object.keys(collectedGoals).length === 0 && this.bossState.active) {
             const bossData = this.currentLevelConfig.boss;
             goalsGrid.innerHTML = `
                <div class="victory-slot reward-highlight">
                    <div class="slot-icon">${bossData.emoji}</div>
                    <div class="slot-count">DERROTADO</div>
                </div>`;
        } else {
            Object.keys(collectedGoals).forEach(key => {
                const count = collectedGoals[key];
                const emoji = EMOJI_MAP[key] || '📦';
                
                goalsGrid.innerHTML += `
        <div class="result-slot">
            <div class="slot-icon">${emoji}</div>
            <div class="slot-count">${count}</div>
        </div>`;
            });
        }

        if (earnedRewards && earnedRewards.length > 0) {
            rewardsSection.classList.remove('hidden');
            earnedRewards.forEach(item => {
                const emoji = EMOJI_MAP[item.type] || '🎁';
                rewardsGrid.innerHTML += `
        <div class="result-slot reward">
            <div class="slot-icon">${emoji}</div>
            <div class="slot-count">+${item.count}</div>
        </div>`;
            });
        } else {
            rewardsSection.classList.add('hidden');
        }

        scoreEl.innerText = this.score;
        modal.classList.remove('hidden');

        if (this.currentMode === 'adventure' && this.currentLevelConfig) {
            const nextLevel = this.currentLevelConfig.id + 1;
            this.saveProgress(nextLevel);
        }
    }

gameOver() {
        if(this.audio) this.audio.stopMusic();
        
        // 1. Elementos da Tela de Derrota
        const scoreEl = document.getElementById('score-final');
        const goalsGrid = document.getElementById('fail-goals-grid');
        const rewardsSection = document.getElementById('fail-rewards-section');
        
        // 2. Preenche Pontuação
        if(scoreEl) scoreEl.innerText = this.score;

        // 3. Preenche Objetivos (Progresso até morrer)
        if(goalsGrid) {
            goalsGrid.innerHTML = '';
            
            // Se for Boss
            if (this.bossState.active) {
                const bossData = this.currentLevelConfig.boss;
                // Calcula % de vida restante para mostrar quão perto foi
                const hpPercent = Math.round((this.bossState.currentHp / this.bossState.maxHp) * 100);
                
                goalsGrid.innerHTML = `
                    <div class="result-slot">
                        <div class="slot-icon">${bossData.emoji}</div>
                        <div class="slot-count">${hpPercent}% HP</div>
                    </div>`;
            } 
            // Se for Coleta (Aventura/Casual)
            else if (this.currentGoals) {
                Object.keys(this.currentGoals).forEach(key => {
                    const current = this.collected[key] || 0;
                    const target = this.currentGoals[key];
                    const emoji = EMOJI_MAP[key] || '📦';
                    
                    goalsGrid.innerHTML += `
                        <div class="result-slot">
                            <div class="slot-icon">${emoji}</div>
                            <div class="slot-count">${current}/${target}</div>
                        </div>`;
                });
            }
        }

        // 4. Preenche Recompensas (XP Parcial - Futuro)
        // Por enquanto, escondemos ou mostramos vazio
        if(rewardsSection) {
            // Exemplo: Ganhar 10 XP mesmo perdendo
            // rewardsSection.classList.remove('hidden'); 
            rewardsSection.classList.add('hidden'); // Oculto por enquanto
        }
        
        // 5. Mostra Modal
        if(this.modalOver) this.modalOver.classList.remove('hidden');
    }
}