import { getRandomPiece } from './modules/shapes.js';
import { EffectsSystem } from './modules/effects.js';
import { AudioSystem } from './modules/audio.js';
import { WORLDS } from './modules/data/levels.js';
import { BOSS_LOGIC } from './modules/logic/bosses.js';

const EMOJI_MAP = {
    'bee': '🐝', 'ghost': '👻', 'cop': '👮',
    'fire': '🔥', 'heart': '❤️‍🔥', 'ice_shard': '💎'
};

export class Game {
    constructor() {
        this.gridSize = 8;
        this.grid = Array(this.gridSize).fill().map(() => Array(this.gridSize).fill(null));
        
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

        this.currentMode = 'casual'; 
        this.currentLevelConfig = null;
        this.currentHand = []; 
        this.bossState = { active: false, maxHp: 0, currentHp: 0, attackRate: 3, movesWithoutDamage: 0 };
        
        this.currentGoals = {}; 
        this.collected = {};
        this.score = 0;
        
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

    setupMenuEvents() {
        const unlockAudioOnce = () => {
            if (this.audio && this.audio.unlock) {
                this.audio.unlock();
            }
            document.removeEventListener('click', unlockAudioOnce);
            document.removeEventListener('touchstart', unlockAudioOnce);
        };
        document.addEventListener('click', unlockAudioOnce);
        document.addEventListener('touchstart', unlockAudioOnce);
        
        const bindClick = (id, action, soundType = 'click') => {
            const el = document.getElementById(id);
            if(el) {
                el.addEventListener('click', () => {
                    if (this.audio) {
                        if (soundType === 'back') this.audio.playBack();
                        else if (soundType === 'click') this.audio.playClick();
                    }
                    action();
                });
            }
        };

        bindClick('btn-mode-casual', () => this.startCasualMode());
        bindClick('btn-mode-adventure', () => this.showLevelSelect());
        bindClick('btn-mode-blitz', () => alert('Modo Blitz: Em breve! ⚡'));
        bindClick('btn-back-menu', () => this.showScreen(this.screenMenu), 'back');
        bindClick('btn-quit-game', () => this.showScreen(this.screenMenu), 'back');
        bindClick('btn-restart-over', () => this.retryGame());
        
        const btnRestWin = document.getElementById('btn-restart-win');
        if(btnRestWin) btnRestWin.addEventListener('click', () => {
            if(this.audio) this.audio.playClick();
            if(this.currentMode === 'adventure') {
                this.modalWin.classList.add('hidden');
                this.showLevelSelect();
            } else {
                this.retryGame();
            }
        });

        const sidebar = document.getElementById('app-sidebar');
        const overlay = document.getElementById('menu-overlay');
        const btnOpen = document.getElementById('btn-open-sidebar');
        const btnClose = document.getElementById('btn-close-sidebar');

        const toggleSidebar = (show) => {
            if(show) {
                sidebar.classList.add('open');
                overlay.classList.remove('hidden');
                setTimeout(() => overlay.classList.add('visible'), 10);
            } else {
                sidebar.classList.remove('open');
                overlay.classList.remove('visible');
                setTimeout(() => overlay.classList.add('hidden'), 300);
            }
        };

        if(btnOpen) btnOpen.addEventListener('click', () => {
            if(this.audio) this.audio.playClick();
            toggleSidebar(true);
        });

        if(btnClose) btnClose.addEventListener('click', () => {
            if(this.audio) this.audio.playBack();
            toggleSidebar(false);
        });
        
        if(overlay) overlay.addEventListener('click', () => {
            if(this.audio) this.audio.playBack();
            toggleSidebar(false);
        });
        
        const footerLink = document.querySelector('.footer-link');
        if(footerLink) footerLink.addEventListener('click', () => { if(this.audio) this.audio.playClick(); });
    }

    showScreen(screenEl) {
        if (this.screenGame.classList.contains('active-screen')) {
            if(this.audio) this.audio.stopMusic();
        }
        [this.screenMenu, this.screenLevels, this.screenGame].forEach(s => s?.classList.add('hidden'));
        screenEl?.classList.remove('hidden');
        screenEl?.classList.add('active-screen');
    }

    setupGoalsUI(goalsConfig) {
        if(!this.goalsArea) return;
        this.currentGoals = { ...goalsConfig }; 
        this.collected = {};
        
        Object.keys(this.currentGoals).forEach(key => this.collected[key] = 0);

        let html = '<div class="goals-container">';
        Object.keys(this.currentGoals).forEach(key => {
            const emoji = EMOJI_MAP[key] || '❓';
            const target = this.currentGoals[key];
            const glowClass = `type-${key}-glow`; 
            
            html += `
                <div class="goal-item" id="goal-item-${key}">
                    <div class="goal-circle ${glowClass}">
                        <span class="goal-emoji">${emoji}</span>
                    </div>
                    <div class="goal-info">
                        <span class="goal-counter" id="goal-val-${key}">0/${target}</span>
                    </div>
                </div>
            `;
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
            if (current >= target && parent) {
                parent.classList.add('completed');
            }
        });
    }

    checkVictoryConditions() {
        const allMet = Object.keys(this.currentGoals).every(key => {
            return (this.collected[key] || 0) >= this.currentGoals[key];
        });

        if (allMet) {
            setTimeout(() => this.gameWon(), 300);
        }
    }

    startCasualMode() {
        this.currentMode = 'casual';
        this.currentLevelConfig = null;
        this.clearTheme();
        this.showScreen(this.screenGame);
        this.setupGoalsUI({ bee: 10, ghost: 10, cop: 10 });
        this.resetGame();
    }

    showLevelSelect() {
        this.showScreen(this.screenLevels);
        const container = document.getElementById('levels-container');
        if(!container) return;
        container.innerHTML = '';

        const world = (WORLDS && WORLDS[0]) ? WORLDS[0] : { levels: [], bgClass: 'theme-fire' };
        
        world.levels.forEach(level => {
            const btn = document.createElement('div');
            btn.classList.add('btn-level');
            if (level.type === 'boss') {
                btn.classList.add('boss-level');
                btn.innerText = `🐉 FASE ${level.id}`;
            } else {
                btn.innerText = level.id;
            }
            btn.addEventListener('click', () => this.startAdventureLevel(level));
            container.appendChild(btn);
        });
    }

    startAdventureLevel(levelConfig) {
        this.currentMode = 'adventure';
        this.currentLevelConfig = levelConfig;
        
        this.clearTheme();
        document.body.classList.add('theme-fire'); 

        this.showScreen(this.screenGame);
        
        if (levelConfig.type === 'boss') {
            const bossData = levelConfig.boss || { id: 'dragon', name: 'Dragão', emoji: '🐉', maxHp: 50 };
            this.setupBossUI(bossData);
            this.bossState = { active: true, maxHp: bossData.maxHp, currentHp: bossData.maxHp, attackRate: 3, movesWithoutDamage: 0 };
            this.currentGoals = {}; 
            
            if(this.audio) this.audio.playBossMusic();

        } else {
            this.bossState.active = false;
            this.setupGoalsUI(levelConfig.goals || {});
            if(this.audio) this.audio.stopMusic();
        }

        this.resetGame();
    }

    setupBossUI(bossData) {
        if(!this.goalsArea) return;
        this.goalsArea.innerHTML = `
            <div class="boss-ui-container">
                <div class="boss-avatar">${bossData.emoji}</div>
                <div class="boss-stats">
                    <div class="boss-name">${bossData.name}</div>
                    <div class="hp-bar-bg"><div class="hp-bar-fill" id="boss-hp-bar" style="width: 100%"></div></div>
                </div>
            </div>
        `;
    }

    clearTheme() { document.body.classList.remove('theme-fire', 'theme-ice'); }

    retryGame() {
        this.modalOver.classList.add('hidden');
        this.modalWin.classList.add('hidden');
        this.resetGame();
    }

    resetGame() {
        this.grid = Array(this.gridSize).fill().map(() => Array(this.gridSize).fill(null));
        this.score = 0;
        
        if(this.currentMode !== 'adventure' || !this.bossState.active) {
            this.setupGoalsUI(this.currentGoals); 
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

    renderGrid() {
        this.boardEl.innerHTML = '';
        this.grid.forEach((row, rIndex) => {
            row.forEach((cellData, cIndex) => {
                const div = document.createElement('div');
                div.classList.add('cell');
                div.dataset.r = rIndex; div.dataset.c = cIndex;
                
                if (cellData) {
                    if (cellData.type === 'LAVA') {
                        div.classList.add('lava'); div.innerText = '🌋';
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
        
        this.currentHand = [getRandomPiece(customItems), getRandomPiece(customItems), getRandomPiece(customItems)];
        
        this.currentHand.forEach((piece, index) => {
            const slot = document.createElement('div');
            slot.classList.add('dock-slot');
            this.createDraggablePiece(piece, index, slot);
            this.dockEl.appendChild(slot);
        });

        setTimeout(() => { if (!this.checkMovesAvailable()) this.gameOver(); }, 100);
    }

    createDraggablePiece(piece, index, parentContainer) {
        const container = document.createElement('div');
        container.classList.add('draggable-piece');
        container.dataset.index = index;
        container.style.gridTemplateColumns = `repeat(${piece.matrix[0].length}, 1fr)`;
        container.style.gridTemplateRows = `repeat(${piece.matrix.length}, 1fr)`;
        
        piece.layout.forEach(row => {
            row.forEach(cellData => {
                const block = document.createElement('div');
                if (cellData) {
                    block.classList.add('block-unit');
                    this.applyColorClass(block, cellData);
                    if (cellData.type === 'ITEM') block.innerText = cellData.emoji;
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
            clone.style.width = (piece.matrix[0].length * cellPixelSize) + 'px';
            clone.style.height = (piece.matrix.length * cellPixelSize) + 'px';
            clone.style.gridTemplateColumns = `repeat(${piece.matrix[0].length}, 1fr)`;
            clone.style.gridTemplateRows = `repeat(${piece.matrix.length}, 1fr)`; 
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
                
                const damageDealt = this.checkLines(dropX, dropY); 
                
                if (this.currentMode === 'adventure') {
                    if (this.bossState.active) {
                        this.processBossTurn(damageDealt);
                    } else {
                        this.checkVictoryConditions();
                    }
                } else {
                    this.checkVictoryConditions();
                }

                const remainingPieces = this.dockEl.querySelectorAll('.draggable-piece');
                if (remainingPieces.length === 0) {
                    this.spawnNewHand();
                } else {
                    if (!this.checkMovesAvailable()) this.gameOver();
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
        
        const GAP = 4;      
        const PADDING = 8;  
        
        const relativeX = (cloneRect.left + cloneRect.width / 2) - (boardRect.left + PADDING);
        const relativeY = (cloneRect.top + cloneRect.height / 2) - (boardRect.top + PADDING);
        
        const pieceCols = piece.matrix[0].length;
        const pieceRows = piece.matrix.length;
        const effectiveSize = cellSize + GAP;
        
        const exactCol = (relativeX / effectiveSize) - (pieceCols / 2);
        const exactRow = (relativeY / effectiveSize) - (pieceRows / 2);
        
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
        for (let i = 0; i < piece.matrix.length; i++) {
            for (let j = 0; j < piece.matrix[i].length; j++) {
                if (piece.matrix[i][j] === 1) {
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
        for (let i = 0; i < piece.matrix.length; i++) {
            for (let j = 0; j < piece.matrix[i].length; j++) {
                if (piece.matrix[i][j] === 1) { 
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

        rowsToClear.forEach(r => { if(this.clearRow(r)) damageDealt = true; linesCleared++; });
        colsToClear.forEach(c => { if(this.clearCol(c)) damageDealt = true; linesCleared++; });

        if (linesCleared > 0) {
            this.renderGrid(); 
            this.effects.showFeedback(linesCleared);
            
            // --- SOM DE CLEAR (BOSS vs NORMAL) ---
            if(this.audio) {
                if (this.bossState.active) {
                    this.audio.playBossClear(linesCleared); // Som específico de ataque
                } else {
                    this.audio.playClear(linesCleared); // Som normal
                }
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
                if(this.collectItem(this.grid[r][c])) foundDamage = true; 
                this.grid[r][c] = null;
            }
        }
        return foundDamage;
    }

    clearCol(c) {
        let foundDamage = false;
        for(let r=0; r<this.gridSize; r++) {
            if (this.grid[r][c]) { 
                if(this.collectItem(this.grid[r][c])) foundDamage = true;
                this.grid[r][c] = null;
            }
        }
        return foundDamage;
    }

    collectItem(cellData) {
        if (!cellData) return false;
        
        if (cellData.type === 'ITEM') {
            const key = cellData.key.toLowerCase(); 
            if (this.currentGoals[key] !== undefined) {
                this.collected[key] = (this.collected[key] || 0) + 1;
                this.updateGoalsUI();
            }
        }

        if (this.currentMode === 'adventure' && this.bossState.active) {
            const damage = cellData.damage || 0;
            if (damage > 0) {
                this.damageBoss(damage);
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
        const behavior = BOSS_LOGIC ? BOSS_LOGIC[bossId] : null;
        if (behavior?.onAttack) behavior.onAttack(this);
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
        if (this.bossState.currentHp <= 0) this.gameWon();
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

    gameWon() {
        if(this.audio) this.audio.stopMusic();

        if(this.audio) {
            this.audio.playClear(3); 
            this.audio.vibrate([100, 50, 100, 50, 200]);
        }
        if(this.scoreWinEl) this.scoreWinEl.innerText = this.score;
        if(this.modalWin) this.modalWin.classList.remove('hidden');

        if (this.currentMode === 'adventure' && this.currentLevelConfig) {
            const nextLevel = this.currentLevelConfig.id + 1;
            this.saveProgress(nextLevel);
        }
    }

    gameOver() {
        if(this.audio) this.audio.stopMusic();

        if(this.scoreOverEl) this.scoreOverEl.innerText = this.score;
        if(this.modalOver) this.modalOver.classList.remove('hidden');
    }
}