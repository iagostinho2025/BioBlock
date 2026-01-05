import { getRandomPiece, ITEM_STATS } from './modules/shapes.js';
import { EffectsSystem } from './modules/effects.js';
import { AudioSystem } from './modules/audio.js';
import { PowersSystem } from './modules/powers.js';
import { WORLDS, BONUS_LEVEL_CONFIG } from './modules/data/levels.js';
import { BOSS_LOGIC } from './modules/logic/bosses.js';

const EMOJI_MAP = {
    // Itens Clássicos
    'bee': '🐝', 'ghost': '👻', 'cop': '👮', 'ice_shard': '💎',
    
    // Power-Ups
    'magnet': '🧲', 'rotate': '🔄', 'swap': '🔀',
    
    // Mundo Fogo
    'fire': '🔥', 'heart': '❤️‍🔥', 'collision': '💥', 'volcano': '🌋',
    
    // Adicione estes para os poderes dos Bosses funcionarem visualmente
    'stone': '🪨', 
    'coal': '⚫',
    
    // Mundo Água
    'drop': '💧', 'fish': '🐟', 'algae': '🌿',
    
    // Mundo Floresta
    'leaf': '🍃'
};

export class Game {
    constructor() {
        this.gridSize = 8;
        this.grid = Array(this.gridSize).fill().map(() => Array(this.gridSize).fill(null));
        
        // Elementos DOM
        this.screenMenu = document.getElementById('screen-menu');
        this.screenLevels = document.getElementById('screen-levels');
        this.screenStory = document.getElementById('screen-story'); // NOVO
        this.screenGame = document.getElementById('screen-game');
        this.boardEl = document.getElementById('game-board');
        this.dockEl = document.getElementById('dock');
        this.goalsArea = document.getElementById('goals-area');
        this.modalOver = document.getElementById('modal-gameover');
        this.modalWin = document.getElementById('modal-victory');
        this.scoreOverEl = document.getElementById('score-final');
        this.scoreWinEl = document.getElementById('score-victory');
        this.comboState = { count: 0, lastClearTime: 0 };

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
		this.powers = new PowersSystem(this);
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
        this.powerUps.magnet = parseInt(localStorage.getItem('powerup_magnet') || '0'); // Novo
        this.powerUps.rotate = parseInt(localStorage.getItem('powerup_rotate') || '0');
        this.powerUps.swap = parseInt(localStorage.getItem('powerup_swap') || '0');
        this.updateControlsVisuals();
    }

    savePowerUps() {
        localStorage.setItem('powerup_magnet', this.powerUps.magnet); // Novo
        localStorage.setItem('powerup_rotate', this.powerUps.rotate);
        localStorage.setItem('powerup_swap', this.powerUps.swap);
        this.updateControlsVisuals();
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
        
        // --- ALTERADO: Agora chama a verificação de história ---
        bindClick('btn-mode-adventure', () => this.checkAdventureIntro()); 
        
        bindClick('btn-mode-blitz', () => alert('Modo Blitz: Em breve! ⚡'));
        
        // --- NOVO: Botão dentro da tela de história ---
        bindClick('btn-start-adventure', () => {
            // Marca que já viu a história
            localStorage.setItem('blocklands_intro_seen', 'true');
            // Vai para o mapa de mundos
            this.showWorldSelect();
        });

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

    // --- NOVO: Verifica se o jogador já viu a intro ---
    checkAdventureIntro() {
        const hasSeen = localStorage.getItem('blocklands_intro_seen');
        
        if (hasSeen === 'true') {
            // Se já viu, vai direto para o mapa
            this.showWorldSelect();
        } else {
            // Se é a primeira vez, mostra a história
            this.playStory();
        }
    }

    // --- NOVO: Exibe a tela de história ---
    playStory() {
        this.showScreen(this.screenStory);
        this.toggleGlobalHeader(false); // Esconde o header de moedas/nível para imersão
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
            this.updateControlsVisuals();
            return;
        }
        // Swap é imediato
        if (type === 'swap') {
            if(this.audio) this.audio.playClick(); 
            this.powerUps.swap--;
            this.savePowerUps();
            this.spawnNewHand(); 
            this.effects.shakeScreen();
            this.renderControlsUI();
            return;
        }
        // Ativa modo
        this.interactionMode = type;
        if(this.audio) this.audio.playClick();
        this.updateControlsVisuals();
    }
	
	renderControlsUI() {
        const oldPwr = document.getElementById('powerups-area');
        if (oldPwr) oldPwr.style.display = 'none';
        const oldHeroes = document.getElementById('hero-powers-area');
        if (oldHeroes) oldHeroes.remove();
        
        let controlsContainer = document.getElementById('controls-bar');
        
        if (!controlsContainer) {
            controlsContainer = document.createElement('div');
            controlsContainer.id = 'controls-bar';
            controlsContainer.className = 'controls-bar';
            if (this.dockEl && this.dockEl.parentNode) {
                this.dockEl.parentNode.insertBefore(controlsContainer, this.dockEl.nextSibling);
            }
        }
        controlsContainer.innerHTML = '';

        // GRUPO ESQUERDA: Itens (AGORA COM ÍMÃ)
        const leftGroup = document.createElement('div');
        leftGroup.className = 'controls-group';
        
        [{ id: 'magnet', icon: '🧲' }, { id: 'rotate', icon: '🔄' }, { id: 'swap', icon: '🔀' }].forEach(p => {
            const btn = document.createElement('button');
            btn.className = `ctrl-btn pwr-${p.id}`;
            btn.id = `btn-pwr-${p.id}`;
            const count = this.powerUps[p.id] || 0;
            // Mostra apenas "1" se tiver, ou "0" (Quantidade unitária conforme pedido)
            // Mas mantendo a lógica numérica caso você dê recompensas
            btn.innerHTML = `${p.icon}<span class="ctrl-count">${count}</span>`;
            
            if (count <= 0) btn.classList.add('disabled');
            btn.onclick = () => this.activatePowerUp(p.id);
            leftGroup.appendChild(btn);
        });

        // GRUPO DIREITA: Heróis
        const rightGroup = document.createElement('div');
        rightGroup.className = 'controls-group';

        if (this.currentMode === 'adventure') {
            const heroes = [
                { id: 'thalion', icon: '🧝‍♂️' }, 
                { id: 'nyx',     icon: '🐺' },
                { id: 'player',  icon: '⚔️' } 
            ];

            heroes.forEach(h => {
                const btn = document.createElement('div');
                btn.className = 'ctrl-btn hero locked';
                btn.id = `btn-hero-${h.id}`;
                btn.innerHTML = `${h.icon}`;
                btn.onclick = () => this.activateHeroPower(h.id);
                rightGroup.appendChild(btn);
            });
        }

        controlsContainer.appendChild(leftGroup);
        controlsContainer.appendChild(rightGroup);
        this.updateControlsVisuals();
    }

    updateControlsVisuals() {
        // PowerUps (AGORA COM MAGNET)
        ['magnet', 'rotate', 'swap'].forEach(id => {
            const btn = document.getElementById(`btn-pwr-${id}`);
            if(!btn) return;
            btn.classList.remove('active-mode');
            const count = this.powerUps[id];
            btn.querySelector('.ctrl-count').innerText = count;
            if(count <= 0) btn.classList.add('disabled');
            else btn.classList.remove('disabled');
            if(this.interactionMode === id) btn.classList.add('active-mode');
        });

        // Heróis
        if (this.currentMode === 'adventure' && this.heroState) {
            ['thalion', 'nyx', 'player'].forEach(id => {
                const btn = document.getElementById(`btn-hero-${id}`);
                if(!btn) return;
                btn.className = 'ctrl-btn hero'; 
                const state = this.heroState[id];
                
                if (state.used) btn.classList.add('used');
                else if (state.unlocked) btn.classList.add('ready');
                else btn.classList.add('locked');
                
                if (this.interactionMode === `hero_${id}`) btn.classList.add('active-mode');
            });
        }
    }
	


    handleBoardClick(r, c) {
        // Se houver um modo de interação ativo (Bomba, Heróis), delega para o sistema de poderes
        if (this.interactionMode) {
            this.powers.handleBoardInteraction(this.interactionMode, r, c);
            return;
        }

        // Se não tiver interação, aqui ficaria lógica de clique normal (se houver no futuro)
    }

    handlePieceClick(index) {
        if (this.interactionMode === 'rotate') {
            this.powers.useRotate(index);
        }
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
        
        [this.screenMenu, this.screenLevels, this.screenStory, this.screenGame].forEach(s => {
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
        
        // --- LIMPEZA DE TELA (NOVO) ---
        if (container) {
            // Remove qualquer imagem de fundo ou cor inline deixada pelas fases
            container.style.backgroundImage = '';
            container.style.background = '';
            container.style.display = ''; // Garante que esteja visível
            
            // Remove classes de efeitos (como as partículas de fogo)
            container.classList.remove('bg-particles-fire');
            
            // Define a classe base do layout
            container.className = 'world-select-layout';
        }

        this.showScreen(this.screenLevels); 
        this.toggleGlobalHeader(false); 

        if(!container) return;

        // Renderiza o cabeçalho com o botão de história
        container.innerHTML = `
            <div class="premium-world-header" style="margin-bottom: 50px;">
                <div style="display: flex; align-items: center; gap: 10px;">
                    <button id="btn-world-back-internal" class="btn-premium-back">⬅</button>
                    <button id="btn-replay-story" class="btn-story-replay" title="Rever História">📜</button>
                </div>
                <h2 class="premium-title">Modo Aventura</h2>
            </div>
            <div class="worlds-grid" id="worlds-grid"></div>
        `;

        // Botão Voltar (Vai para o Menu Principal)
        const backBtn = document.getElementById('btn-world-back-internal');
        if (backBtn) {
            // Clona para remover listeners antigos e evitar bugs
            const newBackBtn = backBtn.cloneNode(true);
            backBtn.parentNode.replaceChild(newBackBtn, backBtn);
            
            newBackBtn.addEventListener('click', (e) => {
                e.preventDefault();
                if(this.audio) this.audio.playBack();
                
                // Limpa tudo e volta pro menu
                container.className = '';
                container.innerHTML = '';
                this.showScreen(this.screenMenu);
            });
        }

        // Botão Rever História
        const replayBtn = document.getElementById('btn-replay-story');
        if (replayBtn) {
            replayBtn.addEventListener('click', () => {
                if(this.audio) this.audio.playClick();
                this.playStory(); 
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

        // Limpa estilos antigos para garantir tela cheia
        container.className = ''; 
        container.style = ''; // Remove styles inline anteriores
        container.style.display = 'block'; // Garante visibilidade

        // --- NOVO HTML LIMPO (Sem título, apenas mapa e botão) ---
        container.innerHTML = `
            <button id="btn-map-back" class="floating-back-btn">⬅</button>
            
            <div id="world-map-bg" class="world-map-container full-screen-mode">
                </div>
        `;

        // Configura a imagem de fundo
        const mapBg = document.getElementById('world-map-bg');
        if (worldConfig.bgImage) {
            mapBg.style.backgroundImage = `url('${worldConfig.bgImage}')`;
        } else {
            mapBg.style.backgroundColor = '#1a0b0b'; // Cor escura caso falhe a imagem
        }

        // Configura o botão de voltar
        const mapBackBtn = document.getElementById('btn-map-back');
        if(mapBackBtn) {
            mapBackBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                if(this.audio) this.audio.playBack();
                
                // Limpa o HTML ao sair para não deixar o mapa fixo na tela
                container.innerHTML = ''; 
                this.showWorldSelect(); 
            });
        }

        const currentSave = this.loadProgress();

        // --- FUNÇÃO PARA CRIAR BOTÕES (Mantida igual, apenas gera o SVG) ---
        const createSvgButton = (levelData, isBonus = false) => {
            const pos = levelData.mapPos || { x: 50, y: 50 }; 
            const levelNum = isBonus ? '🎁' : levelData.id;
            
            let statusClass = '';
            let isLocked = false;

            if (isBonus) {
                statusClass = 'bonus';
                if (currentSave <= 5) { isLocked = true; statusClass += ' locked'; }
            } else {
                if (levelData.id < currentSave) statusClass = 'completed';
                else if (levelData.id === currentSave) statusClass = 'current';
                else { statusClass = 'locked'; isLocked = true; }
                
                if (levelData.type === 'boss') statusClass += ' boss';
            }

            const svgNS = "http://www.w3.org/2000/svg";
            const svgBtn = document.createElementNS(svgNS, "svg");
            svgBtn.setAttribute("class", `map-node-svg ${statusClass}`);
            svgBtn.setAttribute("viewBox", "0 0 100 100");
            
            // Posicionamento absoluto
            svgBtn.style.left = `${pos.x}%`;
            svgBtn.style.top = `${pos.y}%`;

            // Triângulo Invertido
            const path = document.createElementNS(svgNS, "path");
            path.setAttribute("d", "M 10 10 L 90 10 L 50 90 Z"); 
            path.setAttribute("class", "node-shape");
            svgBtn.appendChild(path);

            // Texto
            const text = document.createElementNS(svgNS, "text");
            text.setAttribute("x", "50");
            text.setAttribute("y", "45");
            text.setAttribute("class", "node-text");
            text.textContent = levelNum;
            svgBtn.appendChild(text);

            svgBtn.addEventListener('click', () => {
                if (!isLocked) {
                    if(this.audio) this.audio.playClick();
                    this.toggleGlobalHeader(true);
                    
                    // Esconde o mapa e limpa classes
                    container.style.display = 'none';
                    document.body.className = '';
                    
                    const configToStart = isBonus ? BONUS_LEVEL_CONFIG : levelData;
                    this.startAdventureLevel(configToStart);
                } else {
                    if(this.audio) this.audio.vibrate(50);
                }
            });

            return svgBtn;
        };

        // --- GERA OS BOTÕES ---
        worldConfig.levels.forEach(level => {
            mapBg.appendChild(createSvgButton(level));
        });

        if (BONUS_LEVEL_CONFIG && BONUS_LEVEL_CONFIG.mapPos) {
             mapBg.appendChild(createSvgButton(BONUS_LEVEL_CONFIG, true));
        }
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

        // LÓGICA ESPECIAL PARA FASE BÔNUS (SALA DO TESOURO)
        if (this.currentLevelConfig && this.currentLevelConfig.type === 'bonus') {
            const winners = [];
            
            // 1. Carrega inventário atualizado (AGORA COM MAGNET)
            const inventory = {
                magnet: parseInt(localStorage.getItem('powerup_magnet') || '0'), 
                rotate: parseInt(localStorage.getItem('powerup_rotate') || '0'),
                swap: parseInt(localStorage.getItem('powerup_swap') || '0')
            };

            // Verifica se o inventário está cheio (Max 3 de cada)
            const isFullInventory = (inventory.magnet >= 3 && inventory.rotate >= 3 && inventory.swap >= 3);

            // 2. Verifica metas
            Object.keys(this.currentGoals).forEach(key => {
                const currentAmount = this.collected[key] || 0;
                const targetAmount = this.currentGoals[key];

                if (currentAmount >= targetAmount) {
                    // Só ganha o item se tiver menos de 3, ou se estiver tudo cheio (pra não travar o jogo)
                    // Como 'key' agora é 'magnet', 'inventory[key]' vai funcionar corretamente
                    if (inventory[key] < 3 || isFullInventory) {
                        winners.push(key);
                    }
                }
            });

            // Se ganhou algo, encerra a fase
            if (winners.length > 0) {
                const rewardsList = [];

                winners.forEach(powerUp => {
                    const currentAmount = parseInt(localStorage.getItem(`powerup_${powerUp}`) || '0');
                    const newAmount = Math.min(currentAmount + 1, 3);
                    localStorage.setItem(`powerup_${powerUp}`, newAmount);
                    
                    rewardsList.push({ type: powerUp, count: 1 });
                });
                
                this.loadPowerUps(); // Atualiza visualmente os botões

                setTimeout(() => {
                    this.gameWon(this.collected, rewardsList);
                }, 300);
                
                return true; 
            }
            return false;
        }

        // LÓGICA PADRÃO (Fases Normais e Boss)
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
        
        // Adicionamos o <span id="boss-hp-text"> dentro da barra
        this.goalsArea.innerHTML = `
            <div class="boss-ui-container">
                <div id="boss-target" class="boss-avatar">${bossData.emoji}</div>
                <div class="boss-stats">
                    <div class="boss-name">${bossData.name}</div>
                    <div class="hp-bar-bg">
                        <div class="hp-bar-fill" id="boss-hp-bar" style="width: 100%"></div>
                        <span id="boss-hp-text" class="hp-text">${bossData.maxHp}/${bossData.maxHp}</span>
                    </div>
                </div>
            </div>`;
    }
	
	// --- LÓGICA DE UI DOS HERÓIS ---

    renderHeroUI() {
        // Remove container antigo se existir
        const oldContainer = document.getElementById('hero-powers-area');
        if (oldContainer) oldContainer.remove();

        // Só mostra no Modo Aventura
        if (this.currentMode !== 'adventure') return;

        // Cria o container
        const container = document.createElement('div');
        container.id = 'hero-powers-area';
        container.className = 'hero-powers-container';
        
        // THALION (Elfo) - Requer Combo x2
        const thalionBtn = document.createElement('div');
        thalionBtn.id = 'btn-hero-thalion';
        thalionBtn.innerHTML = `🧝‍♂️<div class="hero-badge">Combo x2</div>`;
        thalionBtn.onclick = () => this.activateHeroPower('thalion');

        // NYX (Lobo) - Requer Combo x3
        const nyxBtn = document.createElement('div');
        nyxBtn.id = 'btn-hero-nyx';
        nyxBtn.innerHTML = `🐺<div class="hero-badge">Combo x3</div>`;
        nyxBtn.onclick = () => this.activateHeroPower('nyx');

        container.appendChild(thalionBtn);
        container.appendChild(nyxBtn);

        // Insere ANTES da área de dock (peças)
        // Se preferir ao lado dos powerups, troque o insertBefore
        const dock = document.getElementById('dock');
        if (dock && dock.parentNode) {
            dock.parentNode.insertBefore(container, dock);
        }
        
        // Atualiza o estado visual inicial
        this.updateHeroButtonsUI();
    }

    activateHeroPower(hero) {
        const state = this.heroState[hero];
        if (state.used || !state.unlocked) {
            if(this.audio) this.audio.vibrate(50);
            return;
        }
        if (this.interactionMode === `hero_${hero}`) {
            this.interactionMode = null;
            this.updateControlsVisuals();
            return;
        }
        
        this.interactionMode = `hero_${hero}`;
        if(this.audio) this.audio.playClick();
        this.updateControlsVisuals();
        
        // --- ATUALIZADO: Textos corretos dos poderes ---
        let msg = "MIRAR: ALVO ÚNICO";
        if (hero === 'thalion') msg = "MIRAR: 3 BLOCOS";
        if (hero === 'nyx') msg = "MIRAR: COLUNA INTEIRA";
        if (hero === 'player') msg = "MIRAR: CORTE EM X";
        
        this.effects.showFloatingTextCentered(msg, "feedback-gold");
    }

    updateHeroButtonsUI() {
        ['thalion', 'nyx'].forEach(hero => {
            const btn = document.getElementById(`btn-hero-${hero}`);
            if (!btn) return;
            
            // Reseta classes
            btn.className = 'hero-btn';
            
            const state = this.heroState[hero];
            
            if (state.used) {
                btn.classList.add('used');
            } else if (state.unlocked) {
                btn.classList.add('ready');
            } else {
                btn.classList.add('locked');
            }
            
            // Estado de mira ativa
            if (this.interactionMode === `hero_${hero}`) {
                btn.classList.add('active-aim');
            }
        });
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
        this.comboState = { count: 0, lastClearTime: 0 }; 
        
        this.heroState = {
            thalion: { unlocked: false, used: false },
            nyx: { unlocked: false, used: false },
            player:  { unlocked: false, used: false, lineCounter: 0 } 
        };

        this.bossState.active = (this.currentLevelConfig?.type === 'boss');
        this.loadPowerUps(); // Carrega o magnet aqui
        
        this.renderControlsUI(); 

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
                        
                        // CORREÇÃO FINAL: Aceita ITEM e OBSTACLE (Pedra/Carvão)
                        if (cellData.type === 'ITEM' || cellData.type === 'OBSTACLE') {
                            const emoji = cellData.emoji || EMOJI_MAP[cellData.key] || '?';
                            div.innerText = emoji;
                        }
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
        
        // Verifica configurações da fase atual
        const config = this.currentLevelConfig;
        const customItems = (this.currentMode === 'adventure' && config) ? config.items : null;
        
        // Ativa pesos de RPG apenas se for BOSS ou BÔNUS
        // Fases normais (coleta) terão chances equilibradas
        const isBoss = config && config.type === 'boss';
        const isBonus = config && config.type === 'bonus';
        const useRPGStats = isBoss || isBonus;

        let forceEasy = false;
        if (isBonus) {
            let emptySlots = 0;
            this.grid.forEach(r => r.forEach(c => { if(!c) emptySlots++ }));
            if (emptySlots > 30) forceEasy = true; 
        }

        this.currentHand = [];
        for(let i=0; i<3; i++) {
            // Passamos o useRPGStats para a função
            const piece = getRandomPiece(customItems, useRPGStats);
            
            if (forceEasy && piece.matrix.flat().filter(x=>x).length > 4) {
                 this.currentHand.push(getRandomPiece(customItems, useRPGStats)); 
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
                    
                    // CORREÇÃO: Garante o emoji certo na peça do deck
                    if (typeof cellData === 'object' && cellData.type === 'ITEM') {
                        const emoji = cellData.emoji || EMOJI_MAP[cellData.key] || '?';
                        block.innerText = emoji;
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
            this.clearPredictionHighlights();
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

                // --- 🔴 NOVA LÓGICA DO BOSS AQUI ---
                // Verifica se o Boss deve usar uma habilidade especial (Magmor, Pyra, Ignis)
                // Executa APÓS verificar linhas e dano, mas ANTES de verificar Game Over
                if (this.bossState.active && !hasWon) {
                    const bossId = this.currentLevelConfig.boss?.id;
                    
                    // Importante: BOSS_LOGIC deve estar importado no topo do arquivo
                    if (BOSS_LOGIC && BOSS_LOGIC[bossId] && BOSS_LOGIC[bossId].onTurnEnd) {
                        BOSS_LOGIC[bossId].onTurnEnd(this);
                    }
                }
                // -----------------------------------

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
        // Limpa brilhos antigos se não houver snap válido ainda
        this.clearPredictionHighlights(); 

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

            // --- NOVO CÓDIGO AQUI ---
            // Se o encaixe é válido, verifique se vai completar linha!
            if (bestMatch.valid) {
                const prediction = this.predictClears(bestMatch.r, bestMatch.c, piece);
                if (prediction.rows.length > 0 || prediction.cols.length > 0) {
                    this.drawPredictionHighlights(prediction);
                }
            }
            // ------------------------

        } else {
            this.activeSnap = null;
        }
    }
    
    // --- PREVISÃO DE LINHAS (EFEITO DOURADO) ---

    // 1. Simula a jogada e retorna quais linhas/colunas seriam limpas
    predictClears(r, c, piece) {
        // Cria uma cópia leve do grid para simulação (apenas true/false importa)
        // Precisamos copiar linha por linha para não alterar o original
        let tempGrid = this.grid.map(row => [...row]);

        // Simula a colocação da peça
        for (let i = 0; i < piece.layout.length; i++) {
            for (let j = 0; j < piece.layout[i].length; j++) {
                if (piece.layout[i][j]) {
                    const targetR = r + i;
                    const targetC = c + j;
                    // Se estiver dentro do grid, marca como preenchido na simulação
                    if (targetR >= 0 && targetR < this.gridSize && targetC >= 0 && targetC < this.gridSize) {
                        tempGrid[targetR][targetC] = { type: 'SIMULATION' };
                    }
                }
            }
        }

        const rowsToClear = [];
        const colsToClear = [];

        // Verifica Linhas
        for (let row = 0; row < this.gridSize; row++) {
            if (tempGrid[row].every(cell => cell !== null)) {
                rowsToClear.push(row);
            }
        }

        // Verifica Colunas
        for (let col = 0; col < this.gridSize; col++) {
            let full = true;
            for (let row = 0; row < this.gridSize; row++) {
                if (tempGrid[row][col] === null) {
                    full = false;
                    break;
                }
            }
            if (full) colsToClear.push(col);
        }

        return { rows: rowsToClear, cols: colsToClear };
    }


    // 2. Cria barras contínuas sobre as linhas/colunas detectadas
    drawPredictionHighlights({ rows, cols }) {
        this.clearPredictionHighlights(); // Limpa anteriores

        // --- DESENHA LINHAS (Horizontais) ---
        rows.forEach(rowIndex => {
            const line = document.createElement('div');
            line.classList.add('prediction-line');
            
            // Lógica CSS Grid: 
            // grid-row: linha inicial / span 1 (ocupa 1 altura)
            // grid-column: 1 / -1 (vai do começo ao fim da largura)
            line.style.gridRowStart = rowIndex + 1; // Grid começa em 1, array em 0
            line.style.gridRowEnd = `span 1`;
            line.style.gridColumnStart = 1;
            line.style.gridColumnEnd = -1; // -1 significa "até o final"
            
            this.boardEl.appendChild(line);
        });

        // --- DESENHA COLUNAS (Verticais) ---
        cols.forEach(colIndex => {
            const line = document.createElement('div');
            line.classList.add('prediction-line');
            
            // Lógica CSS Grid:
            // grid-column: coluna inicial / span 1
            // grid-row: 1 / -1 (vai do topo até embaixo)
            line.style.gridColumnStart = colIndex + 1;
            line.style.gridColumnEnd = `span 1`;
            line.style.gridRowStart = 1;
            line.style.gridRowEnd = -1;
            
            this.boardEl.appendChild(line);
        });
    }

    // 3. Remove as barras criadas
    clearPredictionHighlights() {
        const lines = this.boardEl.querySelectorAll('.prediction-line');
        lines.forEach(el => el.remove());
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
                    
                    // Atualiza a lógica do Grid
                    this.grid[targetR][targetC] = cellData;
                    
                    // Atualiza o Visual Imediatamente
                    const cellEl = this.boardEl.children[targetR * 8 + targetC];
                    cellEl.classList.add('filled');
                    this.applyColorClass(cellEl, cellData);
                    
                    // 🔴 CORREÇÃO AQUI:
                    // Antes estava apenas: cellEl.innerText = cellData.emoji;
                    // Agora usamos o Mapa de Emojis como garantia:
                    if (cellData.type === 'ITEM') {
                        const emoji = cellData.emoji || EMOJI_MAP[cellData.key] || '?';
                        cellEl.innerText = emoji;
                    }
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

        // 1. Detecta
        for (let r = 0; r < this.gridSize; r++) { if (this.grid[r].every(val => val !== null)) rowsToClear.push(r); }
        for (let c = 0; c < this.gridSize; c++) {
            let full = true;
            for (let r = 0; r < this.gridSize; r++) { if (this.grid[r][c] === null) { full = false; break; } }
            if (full) colsToClear.push(c);
        }

        // 2. Visual
        const cellsToExplode = [];
        rowsToClear.forEach(r => { for(let c=0; c<this.gridSize; c++) cellsToExplode.push({r, c}); });
        colsToClear.forEach(c => { for(let r=0; r<this.gridSize; r++) cellsToExplode.push({r, c}); });

        cellsToExplode.forEach(pos => {
            const idx = pos.r * 8 + pos.c;
            const cell = this.boardEl.children[idx];
            if (cell && (cell.classList.contains('filled') || cell.classList.contains('lava'))) {
                const colorClass = Array.from(cell.classList).find(cls => cls.startsWith('type-') || cls === 'lava') || 'type-normal';
                const rect = cell.getBoundingClientRect();
                this.spawnExplosion(rect, colorClass);
            }
        });

        // 3. Limpa
        rowsToClear.forEach(r => { if(this.clearRow(r)) damageDealt = true; linesCleared++; });
        colsToClear.forEach(c => { if(this.clearCol(c)) damageDealt = true; linesCleared++; });

        // 4. Combo e Poderes
        if (linesCleared > 0) {
            this.renderGrid(); 
            const now = Date.now();
            if (now - (this.comboState.lastClearTime || 0) <= 5000) this.comboState.count++;
            else this.comboState.count = 1;
            this.comboState.lastClearTime = now;
            
            const comboCount = this.comboState.count;

            // --- ATUALIZADO: DESBLOQUEIO E RENOVAÇÃO DE HERÓIS ---
            if (this.currentMode === 'adventure' && this.heroState) {
                let unlockedSomething = false;

                // Thalion: Combo x2 (Renova se bloqueado ou já usado)
                if (comboCount >= 2) {
                    if (!this.heroState.thalion.unlocked || this.heroState.thalion.used) {
                        this.heroState.thalion.unlocked = true;
                        this.heroState.thalion.used = false; 
                        this.effects.showFloatingTextCentered("THALION PRONTO!", "feedback-gold");
                        unlockedSomething = true;
                    }
                }
                
                // Nyx: Combo x3 (Renova se bloqueado ou já usado)
                if (comboCount >= 3) {
                    if (!this.heroState.nyx.unlocked || this.heroState.nyx.used) {
                        this.heroState.nyx.unlocked = true;
                        this.heroState.nyx.used = false; 
                        this.effects.showFloatingTextCentered("NYX PRONTO!", "feedback-epic");
                        unlockedSomething = true;
                    }
                }
                
                // PLAYER: Combo x4 OU 15 Linhas acumuladas
                this.heroState.player.lineCounter = (this.heroState.player.lineCounter || 0) + linesCleared;
                
                const linesCondition = this.heroState.player.lineCounter >= 5;
                const comboCondition = comboCount >= 4;

                if (linesCondition || comboCondition) {
                     // Zera o contador apenas se foi ativado por linhas, para reiniciar o ciclo
                     if (linesCondition) {
                         this.heroState.player.lineCounter = 0; 
                     }

                     if (!this.heroState.player.unlocked || this.heroState.player.used) {
                        this.heroState.player.unlocked = true;
                        this.heroState.player.used = false; // RENOVA A CARGA!
                        this.effects.showFloatingTextCentered("ESPADA PRONTA!", "feedback-epic");
                        unlockedSomething = true;
                    }
                }

                if (unlockedSomething) {
                    this.updateControlsVisuals();
                    if(this.audio) this.audio.playTone(600, 'sine', 0.2); 
                }
            }

            // Feedback de Boss e Arcade
            if (this.bossState.active) {
                this.effects.showComboFeedback(linesCleared, comboCount, 'normal'); 
                if(this.audio) this.audio.playBossClear(linesCleared);
            } else {
                let soundToPlay = null; let textType = 'normal';
                if (comboCount === 1) {
                    textType = 'normal';
                    if (linesCleared === 1) soundToPlay = 'clear1';
                    else if (linesCleared === 2) soundToPlay = 'clear2';
                    else if (linesCleared === 3) soundToPlay = 'clear3';
                    else soundToPlay = 'clear4';
                } else if (comboCount === 2) { textType = 'wow'; soundToPlay = 'wow'; }
                else if (comboCount === 3) { textType = 'holycow'; soundToPlay = 'holycow'; }
                else { textType = 'unreal'; soundToPlay = 'unreal'; }

                this.effects.showComboFeedback(linesCleared, comboCount, textType);
                if(this.audio) {
                    this.audio.playSound(soundToPlay);
                    const vibIntensity = Math.min(comboCount * 30, 200);
                    this.audio.vibrate([vibIntensity, 50, vibIntensity]);
                }
            }
            this.score += (linesCleared * 10 * linesCleared) * comboCount; 
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
            const emoji = cellData.emoji || EMOJI_MAP[key] || '?';
            
            this.runFlyAnimation(r, c, key, emoji);

            if (this.currentGoals[key] !== undefined) {
                this.collected[key] = (this.collected[key] || 0) + 1;
                this.updateGoalsUI();
            }
            
            // DANO NO BOSS (RPG)
            if (this.currentMode === 'adventure' && this.bossState.active) {
                // Busca o dano na tabela, ou usa 1 se não achar
                const stats = ITEM_STATS[key] || ITEM_STATS['default'];
                const damage = stats ? stats.damage : 1;
                
                // Aplica o dano
                this.damageBoss(damage);
                
                // REMOVIDO: A linha que causava o travamento (showFloatingText)
                // Se quiser esse efeito no futuro, precisaremos criar a função no effects.js primeiro.
                
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
        const text = document.getElementById('boss-hp-text'); // Novo elemento
        
        // Atualiza a Barra Visual
        if(bar) {
            const pct = (this.bossState.currentHp / this.bossState.maxHp) * 100;
            bar.style.width = pct + '%';
        }

        // Atualiza o Texto Numérico
        if(text) {
            // Arredonda para não mostrar decimais quebrados
            const current = Math.ceil(this.bossState.currentHp);
            text.innerText = `${current}/${this.bossState.maxHp}`;
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
        // 1. Áudio e Vibração
        if(this.audio) { 
            this.audio.stopMusic();
            this.audio.playClear(3); 
            if(this.audio.playSound && this.audio.playVictory) this.audio.playVictory(); 
            this.audio.vibrate([100, 50, 100, 50, 200]); 
        }
        
        // 2. Captura elementos
        const modal = document.getElementById('modal-victory');
        const goalsGrid = document.getElementById('victory-goals-grid');
        const rewardsGrid = document.getElementById('victory-rewards-grid');
        const rewardsSection = document.getElementById('victory-rewards-section');
        const scoreEl = document.getElementById('score-victory');

        // 3. Renderização Visual
        goalsGrid.innerHTML = '';
        if(rewardsGrid) rewardsGrid.innerHTML = '';

        // Boss ou Fase Normal
        if (Object.keys(collectedGoals).length === 0 && this.bossState.active) {
             const bossData = this.currentLevelConfig.boss || { emoji: '💀' };
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

        // Recompensas
        if (earnedRewards && earnedRewards.length > 0 && rewardsSection) {
            rewardsSection.classList.remove('hidden');
            earnedRewards.forEach(item => {
                const emoji = EMOJI_MAP[item.type] || '🎁';
                rewardsGrid.innerHTML += `
                    <div class="result-slot reward">
                        <div class="slot-icon">${emoji}</div>
                        <div class="slot-count">+${item.count}</div>
                    </div>`;
            });
        } else if (rewardsSection) {
            rewardsSection.classList.add('hidden');
        }

        if(scoreEl) scoreEl.innerText = this.score;

        // 4. Salvar Progresso
        let nextLevelId = 0;
        if (this.currentMode === 'adventure' && this.currentLevelConfig) {
            nextLevelId = this.currentLevelConfig.id + 1;
            this.saveProgress(nextLevelId);
        }

        // 5. LÓGICA DE NAVEGAÇÃO
        const currentWorld = WORLDS.find(w => w.levels.some(l => l.id === this.currentLevelConfig.id));
        let nextLevelConfig = null;
        if (currentWorld) {
            nextLevelConfig = currentWorld.levels.find(l => l.id === nextLevelId);
        }

        // --- Botão Continuar ---
        const btnContinue = document.getElementById('btn-next-level');
        if (btnContinue) {
            const newBtn = btnContinue.cloneNode(true);
            btnContinue.parentNode.replaceChild(newBtn, btnContinue);

            newBtn.addEventListener('click', () => {
                if(this.audio) this.audio.playClick();
                modal.classList.add('hidden'); 

                if (nextLevelConfig) {
                    document.body.className = ''; 
                    this.startAdventureLevel(nextLevelConfig);
                } else {
                    // Se acabou o mundo, volta pro mapa forçando a troca de tela
                    this.showScreen(this.screenLevels); // <--- GARANTE A TROCA
                    if (currentWorld) this.openWorldMap(currentWorld);
                    else this.showWorldSelect();
                }
            });
        }

        // --- Botão Voltar (CORRIGIDO) ---
        const btnBack = document.getElementById('btn-victory-back');
        if (btnBack) {
            const newBack = btnBack.cloneNode(true);
            btnBack.parentNode.replaceChild(newBack, btnBack);

            newBack.addEventListener('click', () => {
                if(this.audio) this.audio.playClick();
                modal.classList.add('hidden'); 
                
                // AQUI ESTAVA O PROBLEMA: Precisamos trocar a tela explicitamente
                this.showScreen(this.screenLevels); // <--- LINHA ADICIONADA
                
                if (currentWorld) {
                    this.openWorldMap(currentWorld);
                } else {
                    this.showWorldSelect();
                }
            });
        }

        // 6. Exibe Modal
        modal.classList.remove('hidden');
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