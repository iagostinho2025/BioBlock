// Lógica dos Chefes e Elites
export const BOSS_LOGIC = {
    // ELITE NÍVEL 10: MAGMOR
    'magmor': {
        name: 'Magmor',
        emoji: '👺',
        maxHp: 25,
        onTurnEnd: (game) => {
            // PASSIVA: A cada 5 jogadas, cria um carvão
            if (!game.bossState.turnCount) game.bossState.turnCount = 0;
            game.bossState.turnCount++;

            if (game.bossState.turnCount % 5 === 0) {
                const validTargets = [];
                
                // Varre o grid procurando espaços vazios SEGUROS
                game.grid.forEach((row, r) => {
                    row.forEach((cell, c) => {
                        if (!cell) {
                            // VERIFICAÇÃO DE SEGURANÇA (CORREÇÃO DO BUG)
                            // Conta quantos itens já existem na linha e na coluna
                            const rowCount = row.filter(x => x !== null).length;
                            const colCount = game.grid.reduce((acc, currRow) => acc + (currRow[c] !== null ? 1 : 0), 0);

                            // O Boss só pode colocar se NÃO for completar a linha (Max 7 de 8)
                            // Se tiver 7, colocar o 8º causaria o bug visual
                            if (rowCount < game.gridSize - 1 && colCount < game.gridSize - 1) {
                                validTargets.push({r, c});
                            }
                        }
                    });
                });

                if (validTargets.length > 0) {
                    const target = validTargets[Math.floor(Math.random() * validTargets.length)];
                    game.grid[target.r][target.c] = { type: 'OBSTACLE', key: 'coal', emoji: '⚫' };
                    game.renderGrid();
                    game.triggerScreenFlash('#57534e'); 
                }
            }
        }
    },

    // ELITE NÍVEL 15: FÊNIX INFERNAL
    'pyra': {
        name: 'Fênix Infernal',
        emoji: '🦅',
        maxHp: 35,
        onTurnEnd: (game) => {
            // Inicializa variáveis de controle
            if (typeof game.bossState.regenCounter === 'undefined') {
                game.bossState.regenCounter = 0;
                game.bossState.lastHpCheck = game.bossState.maxHp;
            }

            // Verifica se tomou dano
            if (game.bossState.currentHp < game.bossState.lastHpCheck) {
                game.bossState.regenCounter = 0;
            } else {
                game.bossState.regenCounter++;
            }

            // PASSIVA: Regenera se ficar 3 turnos sem dano
            if (game.bossState.regenCounter >= 3) {
                const healAmount = 2;
                game.bossState.currentHp = Math.min(game.bossState.maxHp, game.bossState.currentHp + healAmount);
                game.updateBossUI();
                game.triggerScreenFlash('#22c55e'); // Flash verde
                
                game.bossState.regenCounter = 0;
            }

            game.bossState.lastHpCheck = game.bossState.currentHp;
        }
    },

    // BOSS NÍVEL 20: IGNIS
    'ignis': {
        name: 'Ignis',
        emoji: '🐉',
        maxHp: 50,
        onTurnEnd: (game) => {
            if (!game.bossState.turnCount) game.bossState.turnCount = 0;
            game.bossState.turnCount++;

            // 1. Poder do Magmor (Carvão) - COM A CORREÇÃO DE SEGURANÇA
            if (game.bossState.turnCount % 5 === 0) {
                 const validTargets = [];
                 
                 game.grid.forEach((row, r) => {
                    row.forEach((cell, c) => {
                        if (!cell) {
                            // Mesma verificação de segurança do Magmor
                            const rowCount = row.filter(x => x !== null).length;
                            const colCount = game.grid.reduce((acc, currRow) => acc + (currRow[c] !== null ? 1 : 0), 0);

                            if (rowCount < game.gridSize - 1 && colCount < game.gridSize - 1) {
                                validTargets.push({r, c});
                            }
                        }
                    });
                });

                 if (validTargets.length > 0) {
                     const target = validTargets[Math.floor(Math.random() * validTargets.length)];
                     game.grid[target.r][target.c] = { type: 'OBSTACLE', key: 'coal', emoji: '⚫' };
                     game.renderGrid();
                     game.triggerScreenFlash('#57534e');
                 }
            }

            // 2. Poder da Fênix (Regen)
             if (typeof game.bossState.regenCounter === 'undefined') {
                game.bossState.regenCounter = 0;
                game.bossState.lastHpCheck = game.bossState.maxHp;
            }

            if (game.bossState.currentHp < game.bossState.lastHpCheck) {
                game.bossState.regenCounter = 0;
            } else {
                game.bossState.regenCounter++;
            }

            if (game.bossState.regenCounter >= 3) {
                const healAmount = 2;
                game.bossState.currentHp = Math.min(game.bossState.maxHp, game.bossState.currentHp + healAmount);
                game.updateBossUI();
                game.triggerScreenFlash('#22c55e');
                game.bossState.regenCounter = 0;
            }
            game.bossState.lastHpCheck = game.bossState.currentHp;

            // 3. PODER ESPECIAL: Petrificar Fogo
            // (Não precisa de verificação de linha pois apenas troca um item existente por outro)
            if (game.bossState.turnCount % 7 === 0) {
                let changed = false;
                game.grid.forEach((row, r) => {
                    row.forEach((cell, c) => {
                        if (cell && cell.key === 'fire') {
                            game.grid[r][c] = { type: 'OBSTACLE', key: 'stone', emoji: '🪨' };
                            changed = true;
                        }
                    });
                });
                if (changed) {
                    game.renderGrid();
                    game.triggerScreenFlash('#ef4444');
                }
            }
        }
    }
};