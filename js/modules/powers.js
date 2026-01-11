export class PowersSystem {
    constructor(game) {
        this.game = game;
        this.magnetSource = null; // Armazena o bloco selecionado para mover
    }

    // Gerenciador central
    handleBoardInteraction(mode, r, c) {
        switch (mode) {
            case 'magnet':
                return this.handleMagnetInteraction(r, c);
            case 'hero_thalion':
                return this.useThalion(r, c);
            case 'hero_nyx':
                return this.useNyx(r, c);
            case 'hero_player':
                return this.usePlayer(r, c);
			case 'hero_mage': 
			    return this.useMage(r, c);
            default:
                return false;
        }
    }

    // --- 1. ÍMÃ (REPOSICIONAR) ---
    handleMagnetInteraction(r, c) {
        const cellContent = this.game.grid[r][c];
        const cellEl = this.game.boardEl.children[r * 8 + c];

        // CASO 1: Nenhum bloco selecionado ainda (Etapa de Seleção)
        if (!this.magnetSource) {
            if (cellContent) {
                this.magnetSource = { r, c };
                
                this.clearMagnetVisuals();
                if (cellEl) cellEl.classList.add('magnet-selected');
                
                if(this.game.audio) this.game.audio.playClick();
                this.game.effects.showFloatingTextCentered("ESCOLHA O DESTINO", "feedback-gold");
            } else {
                this.game.effects.showFloatingTextCentered("SELECIONE UM BLOCO", "text-good");
                this.playError();
            }
            return false; 
        }

        // CASO 2: Bloco já selecionado (Etapa de Movimento)
        else {
            // Se clicou no MESMO bloco, cancela
            if (this.magnetSource.r === r && this.magnetSource.c === c) {
                this.magnetSource = null;
                this.clearMagnetVisuals();
                return false;
            }

            // Se clicou em OUTRO bloco, troca a seleção
            if (cellContent) {
                this.magnetSource = { r, c };
                this.clearMagnetVisuals();
                if (cellEl) cellEl.classList.add('magnet-selected');
                if(this.game.audio) this.game.audio.playClick();
                return false;
            }

            // Se clicou em VAZIO -> MOVE!
            if (!cellContent) {
                const srcR = this.magnetSource.r;
                const srcC = this.magnetSource.c;
                const pieceToMove = this.game.grid[srcR][srcC];

                // 1. Move os dados no Grid
                this.game.grid[r][c] = pieceToMove;
                this.game.grid[srcR][srcC] = null;

                // 2. Efeitos
                this.triggerVisual(srcR, srcC, 'type-normal'); 
                if(this.game.audio) {
                    this.game.audio.playDrag(); 
                    this.game.audio.playDrop();
                }

                // 3. Consome e Finaliza
                this.game.powerUps.magnet--; 
                this.game.savePowerUps();
                
                this.magnetSource = null;
                this.clearMagnetVisuals();
                this.finalizeMove();
                return true;
            }
        }
        return false;
    }

    clearMagnetVisuals() {
        const selected = this.game.boardEl.querySelectorAll('.magnet-selected');
        selected.forEach(el => el.classList.remove('magnet-selected'));
    }

    // --- 2. THALION (Flecha Precisa: 1 Bloco) ---
    useThalion(r, c) {
        let hit = false;
        
        // Verifica apenas o bloco clicado (Tiro único)
        if (this.game.grid[r][c]) {
            this.triggerVisual(r, c, 'type-forest'); 
            this.game.collectItem(r, c, this.game.grid[r][c]);
            this.game.grid[r][c] = null;
            hit = true;
        }

        if (hit) {
            if(this.game.audio) this.game.audio.playArrow();
            this.consumeHeroPower('thalion');
            this.finalizeMove();
            return true;
        } else {
            this.playError();
            return false;
        }
    }

    // --- 3. NYX (Salto Vertical: 3 Blocos para Cima) ---
    useNyx(r, c) {
        let hit = false;
        
        // Alvo: O bloco clicado e os 2 acima dele (Total 3)
        for (let i = 0; i < 3; i++) {
            const targetR = r - i;
            
            // Verifica se está dentro do tabuleiro (não pode ser negativo)
            if (targetR >= 0) {
                if (this.game.grid[targetR][c]) {
                    this.triggerVisual(targetR, c, 'type-ice');
                    this.game.collectItem(targetR, c, this.game.grid[targetR][c]);
                    this.game.grid[targetR][c] = null;
                    hit = true;
                }
            }
        }

        if (hit) {
            if(this.game.audio) this.game.audio.playWolf();
            this.consumeHeroPower('nyx');
            this.finalizeMove();
            return true;
        } else {
            this.playError();
            return false;
        }
    }

    // --- 4. JOGADOR (Corte Duplo Vertical: 2x3) ---
    usePlayer(startR, startC) {
        let hitAny = false;
        const size = this.game.gridSize;

        // Define as duas colunas de ataque (Bloco clicado + Direita)
        // 3 blocos para baixo em cada coluna
        const slash1 = []; // Coluna atual
        const slash2 = []; // Coluna da direita

        for (let i = 0; i < 3; i++) {
            slash1.push({ r: startR + i, c: startC });
            slash2.push({ r: startR + i, c: startC + 1 });
        }

        const processHit = (list) => {
            let localHit = false;
            list.forEach(pos => {
                // Verifica limites do grid
                if (pos.r >= 0 && pos.r < size && pos.c >= 0 && pos.c < size) {
                    if (this.game.grid[pos.r][pos.c]) {
                        this.triggerVisual(pos.r, pos.c, 'type-mountain');
                        this.game.collectItem(pos.r, pos.c, this.game.grid[pos.r][pos.c]);
                        this.game.grid[pos.r][pos.c] = null;
                        localHit = true;
                        hitAny = true;
                    }
                }
            });
            return localHit;
        };

        // Executa o primeiro corte (Coluna clicada)
        const hit1 = processHit(slash1);
        
        // Verifica se o segundo corte teria alvos (para validar o uso do poder)
        const hasTargetsInSlash2 = slash2.some(pos => 
            pos.r >= 0 && pos.r < size && pos.c >= 0 && pos.c < size && this.game.grid[pos.r][pos.c]
        );

        if (hit1 || hasTargetsInSlash2) {
            if(this.game.audio) this.game.audio.playSword();
            this.consumeHeroPower('player');
            this.game.renderGrid();
            
            // Executa o segundo corte com um delay curto para dar impacto (Combo)
            setTimeout(() => {
                processHit(slash2);
                this.finalizeMove();
                
            }, 1000); 

            return true;
        } else {
            this.playError();
            return false;
        }
    }
	
	// --- 5. MAGA (Luz Divina: Área 2x3) ---
    useMage(r, c) {
        let hit = false;
        const size = this.game.gridSize;
        const targets = [];

        // Linha do Clique (Centro, Esquerda, Direita)
        targets.push({r: r, c: c});
        targets.push({r: r, c: c - 1});
        targets.push({r: r, c: c + 1});

        // Linha de Baixo (Centro, Esquerda, Direita)
        targets.push({r: r + 1, c: c});
        targets.push({r: r + 1, c: c - 1});
        targets.push({r: r + 1, c: c + 1});

        targets.forEach(pos => {
            // Verifica se está dentro do tabuleiro
            if (pos.r >= 0 && pos.r < size && pos.c >= 0 && pos.c < size) {
                if (this.game.grid[pos.r][pos.c]) {
                    // Efeito Amarelo (type-bee é amarelo/ouro)
                    this.triggerVisual(pos.r, pos.c, 'type-bee'); 
                    this.game.collectItem(pos.r, pos.c, this.game.grid[pos.r][pos.c]);
                    this.game.grid[pos.r][pos.c] = null;
                    hit = true;
                }
            }
        });

        if (hit) {
            if(this.game.audio) this.game.audio.playMage();
            this.consumeHeroPower('mage');
            this.finalizeMove();
            return true;
        } else {
            this.playError();
            return false;
        }
    }

    // --- 5. ROTAÇÃO ---
    useRotate(pieceIndex) {
        const piece = this.game.currentHand[pieceIndex];
        if (!piece) return;

        const oldLayout = piece.layout;
        const newLayout = oldLayout[0].map((val, index) =>
            oldLayout.map(row => row[index]).reverse()
        );

        if (JSON.stringify(oldLayout) === JSON.stringify(newLayout)) {
            this.playError();
            const slot = this.game.dockEl.children[pieceIndex];
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
        
        this.game.powerUps.rotate--;
        this.game.savePowerUps();
        this.game.renderDock();
        if(this.game.audio) this.game.audio.playClick();
        
        this.game.interactionMode = null;
        this.game.updateControlsVisuals();
    }

    // --- Helpers ---

    triggerVisual(r, c, typeClass) {
        const idx = r * 8 + c;
        const cell = this.game.boardEl.children[idx];
        if(cell) {
            const rect = cell.getBoundingClientRect();
            this.game.spawnExplosion(rect, typeClass);
        }
    }

    consumeHeroPower(heroId) {
        this.game.heroState[heroId].used = true;
        this.game.heroState[heroId].unlocked = false;
    }

    playError() {
        if(this.game.audio) this.game.audio.vibrate(50);
    }

    finalizeMove() {
        this.game.interactionMode = null;
        this.game.renderGrid();
        this.game.effects.shakeScreen();
        this.game.updateControlsVisuals();

        setTimeout(() => {
            if (this.game.bossState.active) {
                this.game.processBossTurn(true); 
                if (this.game.bossState.currentHp <= 0) this.game.gameWon({}, []);
            } else {
                this.game.checkVictoryConditions();
            }
        }, 100);
    }
}