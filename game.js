import { getRandomPiece } from './shapes.js';

export class Game {
    constructor() {
        this.gridSize = 8;
        this.grid = Array(this.gridSize).fill().map(() => Array(this.gridSize).fill(null));
        
        // Elementos DOM
        this.boardEl = document.getElementById('game-board');
        this.dockEl = document.getElementById('dock');
        this.scoreEl = document.getElementById('final-score');
        this.modalEl = document.getElementById('modal-gameover');
        
        // Estado
        this.currentHand = []; 
        this.goals = { bee: 10, ghost: 10, cop: 10 }; 
        this.collected = { bee: 0, ghost: 0, cop: 0 };
        this.score = 0;
        
        // Estado de Drag & Drop
        this.activeSnap = null; // { r, c, valid }
        
        this.init();
    }

    init() {
        this.renderGrid();
        this.spawnNewHand();
        this.updateGoalsUI();
        
        const btnRestart = document.getElementById('btn-restart');
        if(btnRestart) {
            btnRestart.addEventListener('click', () => this.resetGame());
        }
    }

    resetGame() {
        this.grid = Array(this.gridSize).fill().map(() => Array(this.gridSize).fill(null));
        this.collected = { bee: 0, ghost: 0, cop: 0 };
        this.score = 0;
        this.modalEl.classList.add('hidden');
        this.renderGrid();
        this.spawnNewHand();
        this.updateGoalsUI();
    }

    renderGrid() {
        this.boardEl.innerHTML = '';
        this.grid.forEach((row, rIndex) => {
            row.forEach((cellData, cIndex) => {
                const div = document.createElement('div');
                div.classList.add('cell');
                div.dataset.r = rIndex;
                div.dataset.c = cIndex;
                
                if (cellData) {
                    div.classList.add('filled');
                    if (cellData.type === 'ITEM') {
                        div.innerText = cellData.emoji;
                    }
                }
                this.boardEl.appendChild(div);
            });
        });
    }

    // --- SISTEMA DE DRAG & DROP PREMIUM ---

    spawnNewHand() {
        this.dockEl.innerHTML = '';
        this.currentHand = [getRandomPiece(), getRandomPiece(), getRandomPiece()];
        
        this.currentHand.forEach((piece, index) => {
            const slot = document.createElement('div');
            slot.classList.add('dock-slot');
            this.createDraggablePiece(piece, index, slot);
            this.dockEl.appendChild(slot);
        });

        setTimeout(() => {
             if (!this.checkMovesAvailable()) {
                this.gameOver();
             }
        }, 100);
    }

    createDraggablePiece(piece, index, parentContainer) {
        const container = document.createElement('div');
        container.classList.add('draggable-piece');
        container.dataset.index = index;
        
        // Configura grid interno da peça
        container.style.gridTemplateColumns = `repeat(${piece.matrix[0].length}, 1fr)`;
        
        piece.layout.forEach(row => {
            row.forEach(cellData => {
                const block = document.createElement('div');
                if (cellData) {
                    block.classList.add('block-unit');
                    if (cellData.type === 'ITEM') {
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
        let touchOffsetX = 0;
        let touchOffsetY = 0;

        // Dimensões do grid para cálculos
        let cellPixelSize = 0;
        let boardRect = null;

        const onStart = (e) => {
            if (isDragging) return;
            isDragging = true;
            this.activeSnap = null;
            
            // Prepara métricas do tabuleiro
            boardRect = this.boardEl.getBoundingClientRect();
            // Calcula tamanho da célula baseado na largura atual do tabuleiro
            cellPixelSize = boardRect.width / this.gridSize;
            
            const touch = e.touches ? e.touches[0] : e;
            const rect = el.getBoundingClientRect();
            
            // Calcula onde o dedo tocou relativo ao centro da peça
            touchOffsetX = touch.clientX - (rect.left + rect.width / 2);
            touchOffsetY = touch.clientY - (rect.top + rect.height / 2);

            // Cria o clone visual (Ghost Piece que segue o dedo)
            clone = el.cloneNode(true);
            clone.classList.add('dragging-active');
            
            // Configura o clone para ter o tamanho exato que terá no grid
            clone.style.display = 'grid';
            clone.style.width = (piece.matrix[0].length * cellPixelSize) + 'px';
            clone.style.height = (piece.matrix.length * cellPixelSize) + 'px';
            clone.style.gridTemplateColumns = `repeat(${piece.matrix[0].length}, 1fr)`;
            clone.style.gap = '4px'; // Match CSS gap do board
            
            // Ajusta filhos do clone
            Array.from(clone.children).forEach(child => {
                 child.style.width = '100%';
                 child.style.height = '100%';
                 if(child.innerText) child.style.fontSize = '24px';
            });

            // Posiciona inicialmente
            this.moveClone(clone, touch.clientX, touch.clientY, touchOffsetX, touchOffsetY);
            
            document.body.appendChild(clone);
            el.style.opacity = '0'; // Esconde original
        };

        const onMove = (e) => {
            if (!isDragging || !clone) return;
            e.preventDefault(); // Evita scroll

            const touch = e.touches ? e.touches[0] : e;
            
            // Move o clone
            this.moveClone(clone, touch.clientX, touch.clientY, touchOffsetX, touchOffsetY);

            // Lógica de Snapping e Preview
            this.updateGhostPreview(clone, boardRect, cellPixelSize, piece);
        };

        const onEnd = (e) => {
            if (!isDragging) return;
            isDragging = false;

            // Tenta colocar na posição do snap ativo
            let placed = false;
            
            if (this.activeSnap && this.activeSnap.valid) {
                placed = this.placePiece(this.activeSnap.r, this.activeSnap.c, piece);
            }

            if (placed) {
                el.remove(); // Remove do dock
                this.checkLines(); 
                
                // Verifica estado do jogo
                const remainingPieces = this.dockEl.querySelectorAll('.draggable-piece');
                if (remainingPieces.length === 0) {
                    this.spawnNewHand();
                } else {
                    if (!this.checkMovesAvailable()) {
                        this.gameOver();
                    }
                }
            } else {
                // Animação de retorno (opcional) ou apenas reaparece
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

    moveClone(clone, clientX, clientY, offsetX, offsetY) {
        // Offset Y de -80px para que o dedo não cubra a peça
        const VISUAL_OFFSET_Y = 80;
        
        const x = clientX - (clone.offsetWidth / 2); // Centraliza horizontalmente no dedo
        const y = clientY - (clone.offsetHeight / 2) - VISUAL_OFFSET_Y; 

        clone.style.left = x + 'px';
        clone.style.top = y + 'px';
    }

    // --- CORE DO SISTEMA DE SNAPPING ---
    
    updateGhostPreview(clone, boardRect, cellSize, piece) {
        this.clearGhostPreview();

        // 1. Obtém a posição central do clone visual
        const cloneRect = clone.getBoundingClientRect();
        const cloneCenterX = cloneRect.left + cloneRect.width / 2;
        const cloneCenterY = cloneRect.top + cloneRect.height / 2;

        // 2. Projeta essa posição no sistema de coordenadas do grid
        // Subtraímos metade do tamanho da peça (em células) para achar o topo-esquerda
        const relativeX = cloneCenterX - boardRect.left;
        const relativeY = cloneCenterY - boardRect.top;

        const pieceCols = piece.matrix[0].length;
        const pieceRows = piece.matrix.length;

        // Coordenada flutuante (ex: 3.4) do topo-esquerda da peça no grid
        const exactCol = (relativeX / cellSize) - (pieceCols / 2);
        const exactRow = (relativeY / cellSize) - (pieceRows / 2);

        // 3. Arredonda para o inteiro mais próximo (Snap Básico)
        const baseR = Math.round(exactRow);
        const baseC = Math.round(exactCol);

        // 4. Algoritmo "Best Fit": Procura vizinhos se a posição base for inválida
        // Isso ajuda quando o usuário solta "entre" dois blocos
        const candidates = [
            { r: baseR, c: baseC },
            { r: baseR + 1, c: baseC },
            { r: baseR - 1, c: baseC },
            { r: baseR, c: baseC + 1 },
            { r: baseR, c: baseC - 1 }
        ];

        let bestMatch = null;
        let minDistance = Infinity;

        // Filtra candidatos válidos e escolhe o mais próximo
        for (const cand of candidates) {
            const isValid = this.canPlace(cand.r, cand.c, piece);
            
            // Distância Euclidiana entre o ponto exato do mouse e o centro deste candidato
            const dist = Math.sqrt(Math.pow(cand.r - exactRow, 2) + Math.pow(cand.c - exactCol, 2));

            // Prioriza posições válidas
            if (isValid) {
                // Se achamos um válido, ignoramos inválidos anteriores
                if (!bestMatch || !bestMatch.valid || dist < minDistance) {
                    bestMatch = { r: cand.r, c: cand.c, valid: true };
                    minDistance = dist;
                }
            } else if (!bestMatch && dist < 1.0) { 
                // Se ainda não temos nada, guardamos esse inválido se estiver perto o suficiente
                // para mostrar feedback vermelho
                bestMatch = { r: cand.r, c: cand.c, valid: false };
            }
        }

        // Se encontrou algo razoável (dentro do tabuleiro ou perto dele)
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
                    
                    // Verifica limites antes de desenhar
                    if (targetR >= 0 && targetR < this.gridSize && targetC >= 0 && targetC < this.gridSize) {
                        const cellIndex = targetR * 8 + targetC;
                        const cell = this.boardEl.children[cellIndex];
                        if (cell) {
                            cell.classList.add('ghost', className);
                        }
                    }
                }
            }
        }
    }

    clearGhostPreview() {
        const ghosts = this.boardEl.querySelectorAll('.ghost');
        ghosts.forEach(el => el.classList.remove('ghost', 'ghost-valid', 'ghost-invalid'));
    }

    // --- LÓGICA DO JOGO ---

    canPlace(r, c, piece) {
        for (let i = 0; i < piece.matrix.length; i++) {
            for (let j = 0; j < piece.matrix[i].length; j++) {
                if (piece.matrix[i][j] === 1) { 
                    const targetR = r + i;
                    const targetC = c + j;
                    // Fora do grid
                    if (targetR < 0 || targetR >= this.gridSize || targetC < 0 || targetC >= this.gridSize) return false;
                    // Já ocupado
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
                    // Aplica classe de cor baseada no tipo de item se quiser, ou genérico
                    // cellEl.classList.add('placed-animation'); // Ideia para futuro
                    
                    if (cellData.type === 'ITEM') {
                        cellEl.innerText = cellData.emoji;
                    }
                }
            }
        }
        return true;
    }

    checkLines() {
        let linesCleared = 0;
        
        // Verifica Linhas
        for (let r = 0; r < this.gridSize; r++) {
            if (this.grid[r].every(val => val !== null)) {
                this.clearRow(r);
                linesCleared++;
            }
        }
        
        // Verifica Colunas
        for (let c = 0; c < this.gridSize; c++) {
            let full = true;
            for (let r = 0; r < this.gridSize; r++) {
                if (this.grid[r][c] === null) full = false;
            }
            if (full) {
                this.clearCol(c);
                linesCleared++;
            }
        }

        if (linesCleared > 0) {
            // Pequeno delay para animação se quiser implementar depois
            this.renderGrid(); 
        }
    }

    clearRow(r) {
        for(let c=0; c<this.gridSize; c++) {
            if(this.grid[r][c]) this.collectItem(this.grid[r][c]);
            this.grid[r][c] = null;
        }
    }

    clearCol(c) {
        for(let r=0; r<this.gridSize; r++) {
            if (this.grid[r][c]) { 
                this.collectItem(this.grid[r][c]);
                this.grid[r][c] = null;
            }
        }
    }

    collectItem(cellData) {
        if (cellData && cellData.type === 'ITEM') {
            const key = cellData.key.toLowerCase(); 
            if (this.collected[key] !== undefined) {
                this.collected[key]++;
                this.updateGoalsUI();
            }
        }
    }

    updateGoalsUI() {
        const types = ['bee', 'ghost', 'cop'];
        types.forEach(t => {
            const el = document.getElementById(`goal-${t}`);
            if(!el) return;

            const target = this.goals[t];
            const current = this.collected[t];
            el.innerText = `${current}/${target}`;
            
            const parent = el.closest('.goal-item');
            if (current >= target) {
                parent.classList.add('completed');
                el.innerText = "✓";
            }
        });
    }

    checkMovesAvailable() {
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

    gameOver() {
        this.scoreEl.innerText = Object.values(this.collected).reduce((a,b)=>a+b, 0);
        this.modalEl.classList.remove('hidden');
    }
}