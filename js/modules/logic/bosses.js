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
    },

    // =========================================================================
    // BOSSES DA FLORESTA SOMBRIA
    // =========================================================================

    // ELITE NÍVEL 30: LOBO ALFA
    'wolf_alpha': {
        name: 'Lobo Alfa',
        emoji: '🐺',
        maxHp: 35,
        onTurnEnd: (game) => {
            // PASSIVA: A cada 4 jogadas, ataca transformando folhas em espinhos
            if (!game.bossState.turnCount) game.bossState.turnCount = 0;
            game.bossState.turnCount++;

            if (game.bossState.turnCount % 4 === 0) {
                let changed = false;
                game.grid.forEach((row, r) => {
                    row.forEach((cell, c) => {
                        if (cell && cell.key === 'leaf') {
                            game.grid[r][c] = { type: 'OBSTACLE', key: 'thorns', emoji: '🌿' };
                            changed = true;
                        }
                    });
                });
                if (changed) {
                    game.renderGrid();
                    game.triggerScreenFlash('#15803d'); // Flash verde escuro
                }
            }
        }
    },

    // ELITE NÍVEL 35: ENT ANCIÃO
    'ent_ancient': {
        name: 'Ent Ancião',
        emoji: '🌳',
        maxHp: 45,
        onTurnEnd: (game) => {
            // Inicializa variáveis de controle
            if (typeof game.bossState.rootCounter === 'undefined') {
                game.bossState.rootCounter = 0;
            }

            game.bossState.rootCounter++;

            // PASSIVA 1: A cada 3 turnos, cria raízes (espinhos) em posições vazias
            if (game.bossState.rootCounter % 3 === 0) {
                const validTargets = [];

                game.grid.forEach((row, r) => {
                    row.forEach((cell, c) => {
                        if (!cell) {
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
                    game.grid[target.r][target.c] = { type: 'OBSTACLE', key: 'thorns', emoji: '🌿' };
                    game.renderGrid();
                    game.triggerScreenFlash('#16a34a');
                }
            }

            // PASSIVA 2: A cada 5 turnos, regenera HP
            if (game.bossState.rootCounter % 5 === 0) {
                const healAmount = 3;
                game.bossState.currentHp = Math.min(game.bossState.maxHp, game.bossState.currentHp + healAmount);
                game.updateBossUI();
                game.triggerScreenFlash('#84cc16'); // Flash verde amarelado
            }
        }
    },

    // BOSS NÍVEL 40: ARACNA
    'aracna': {
        name: 'Aracna',
        emoji: '🕷️',
        maxHp: 60,
        onTurnEnd: (game) => {
            if (!game.bossState.turnCount) game.bossState.turnCount = 0;
            game.bossState.turnCount++;

            // 1. Poder do Lobo (Transforma folhas em espinhos)
            if (game.bossState.turnCount % 4 === 0) {
                let changed = false;
                game.grid.forEach((row, r) => {
                    row.forEach((cell, c) => {
                        if (cell && cell.key === 'leaf') {
                            game.grid[r][c] = { type: 'OBSTACLE', key: 'thorns', emoji: '🌿' };
                            changed = true;
                        }
                    });
                });
                if (changed) {
                    game.renderGrid();
                    game.triggerScreenFlash('#15803d');
                }
            }

            // 2. Poder do Ent (Cria espinhos)
            if (game.bossState.turnCount % 3 === 0) {
                const validTargets = [];

                game.grid.forEach((row, r) => {
                    row.forEach((cell, c) => {
                        if (!cell) {
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
                    game.grid[target.r][target.c] = { type: 'OBSTACLE', key: 'thorns', emoji: '🌿' };
                    game.renderGrid();
                    game.triggerScreenFlash('#16a34a');
                }
            }

            // 3. PODER ESPECIAL: Teia Venenosa (Transforma cogumelos em veneno petrificado)
            if (game.bossState.turnCount % 6 === 0) {
                let changed = false;
                game.grid.forEach((row, r) => {
                    row.forEach((cell, c) => {
                        if (cell && cell.key === 'mushroom') {
                            game.grid[r][c] = { type: 'OBSTACLE', key: 'web', emoji: '🕸️' };
                            changed = true;
                        }
                    });
                });
                if (changed) {
                    game.renderGrid();
                    game.triggerScreenFlash('#7c3aed'); // Flash roxo
                }
            }
        }
    },

    // =========================================================================
    // BOSSES DA MONTANHA DE FERRO
    // =========================================================================

    // ELITE NÍVEL 50: TROLL
    'troll': {
        name: 'Troll',
        emoji: '👹',
        maxHp: 50,
        onTurnEnd: (game) => {
            // PASSIVA: A cada 5 jogadas, cria rochas no grid
            if (!game.bossState.turnCount) game.bossState.turnCount = 0;
            game.bossState.turnCount++;

            if (game.bossState.turnCount % 5 === 0) {
                const validTargets = [];

                game.grid.forEach((row, r) => {
                    row.forEach((cell, c) => {
                        if (!cell) {
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
                    game.grid[target.r][target.c] = { type: 'OBSTACLE', key: 'rocks', emoji: '🪨' };
                    game.renderGrid();
                    game.triggerScreenFlash('#78716c'); // Flash cinza pedra
                }
            }
        }
    },

    // ELITE NÍVEL 55: GIGANTE
    'giant': {
        name: 'Gigante',
        emoji: '🗿',
        maxHp: 65,
        onTurnEnd: (game) => {
            if (typeof game.bossState.giantCounter === 'undefined') {
                game.bossState.giantCounter = 0;
            }

            game.bossState.giantCounter++;

            // PASSIVA 1: A cada 4 turnos, esmaga picaretas transformando em rochas
            if (game.bossState.giantCounter % 4 === 0) {
                let changed = false;
                game.grid.forEach((row, r) => {
                    row.forEach((cell, c) => {
                        if (cell && cell.key === 'pickaxe') {
                            game.grid[r][c] = { type: 'OBSTACLE', key: 'rocks', emoji: '🪨' };
                            changed = true;
                        }
                    });
                });
                if (changed) {
                    game.renderGrid();
                    game.triggerScreenFlash('#a8a29e'); // Flash bege
                }
            }

            // PASSIVA 2: A cada 6 turnos, ganha armadura (reduz dano temporariamente)
            if (game.bossState.giantCounter % 6 === 0) {
                // Implementação visual - flash dourado indicando armadura
                game.triggerScreenFlash('#eab308'); // Flash amarelo ouro
            }
        }
    },

    // BOSS NÍVEL 60: GOLEM REI
    'golem_king': {
        name: 'Golem Rei',
        emoji: '🤖',
        maxHp: 80,
        onTurnEnd: (game) => {
            if (!game.bossState.turnCount) game.bossState.turnCount = 0;
            game.bossState.turnCount++;

            // 1. Poder do Troll (Cria rochas)
            if (game.bossState.turnCount % 5 === 0) {
                const validTargets = [];

                game.grid.forEach((row, r) => {
                    row.forEach((cell, c) => {
                        if (!cell) {
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
                    game.grid[target.r][target.c] = { type: 'OBSTACLE', key: 'rocks', emoji: '🪨' };
                    game.renderGrid();
                    game.triggerScreenFlash('#78716c');
                }
            }

            // 2. Poder do Gigante (Esmaga picaretas)
            if (game.bossState.turnCount % 4 === 0) {
                let changed = false;
                game.grid.forEach((row, r) => {
                    row.forEach((cell, c) => {
                        if (cell && cell.key === 'pickaxe') {
                            game.grid[r][c] = { type: 'OBSTACLE', key: 'rocks', emoji: '🪨' };
                            changed = true;
                        }
                    });
                });
                if (changed) {
                    game.renderGrid();
                    game.triggerScreenFlash('#a8a29e');
                }
            }

            // 3. PODER ESPECIAL: Terremoto (Transforma ouro em escombros)
            if (game.bossState.turnCount % 7 === 0) {
                let changed = false;
                game.grid.forEach((row, r) => {
                    row.forEach((cell, c) => {
                        if (cell && cell.key === 'gold') {
                            game.grid[r][c] = { type: 'OBSTACLE', key: 'debris', emoji: '💥' };
                            changed = true;
                        }
                    });
                });
                if (changed) {
                    game.renderGrid();
                    game.triggerScreenFlash('#dc2626'); // Flash vermelho (terremoto)
                }
            }
        }
    },

    // =========================================================================
    // BOSSES DO DESERTO DA MORTE
    // =========================================================================

    // ELITE NÍVEL 70: MÚMIA
    'mummy': {
        name: 'Múmia',
        emoji: '🧟',
        maxHp: 70,
        onTurnEnd: (game) => {
            // PASSIVA: A cada 6 jogadas, transforma ossos em areia movediça
            if (!game.bossState.turnCount) game.bossState.turnCount = 0;
            game.bossState.turnCount++;

            if (game.bossState.turnCount % 6 === 0) {
                let changed = false;
                game.grid.forEach((row, r) => {
                    row.forEach((cell, c) => {
                        if (cell && cell.key === 'bone') {
                            game.grid[r][c] = { type: 'OBSTACLE', key: 'quicksand', emoji: '🏜️' };
                            changed = true;
                        }
                    });
                });
                if (changed) {
                    game.renderGrid();
                    game.triggerScreenFlash('#92400e'); // Flash marrom deserto
                }
            }
        }
    },

    // ELITE NÍVEL 75: ESCORPIÃO
    'scorpion': {
        name: 'Escorpião',
        emoji: '🦂',
        maxHp: 85,
        onTurnEnd: (game) => {
            if (typeof game.bossState.scorpionCounter === 'undefined') {
                game.bossState.scorpionCounter = 0;
            }

            game.bossState.scorpionCounter++;

            // PASSIVA 1: A cada 4 turnos, envenena areia transformando em veneno
            if (game.bossState.scorpionCounter % 4 === 0) {
                let changed = false;
                game.grid.forEach((row, r) => {
                    row.forEach((cell, c) => {
                        if (cell && cell.key === 'sand') {
                            game.grid[r][c] = { type: 'OBSTACLE', key: 'quicksand', emoji: '🏜️' };
                            changed = true;
                        }
                    });
                });
                if (changed) {
                    game.renderGrid();
                    game.triggerScreenFlash('#a16207'); // Flash laranja escuro
                }
            }

            // PASSIVA 2: A cada 5 turnos, cria areia movediça
            if (game.bossState.scorpionCounter % 5 === 0) {
                const validTargets = [];

                game.grid.forEach((row, r) => {
                    row.forEach((cell, c) => {
                        if (!cell) {
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
                    game.grid[target.r][target.c] = { type: 'OBSTACLE', key: 'quicksand', emoji: '🏜️' };
                    game.renderGrid();
                    game.triggerScreenFlash('#d97706'); // Flash âmbar
                }
            }
        }
    },

    // BOSS NÍVEL 80: WARLORD GROK
    'warlord_grok': {
        name: 'Warlord Grok',
        emoji: '👹',
        maxHp: 100,
        onTurnEnd: (game) => {
            if (!game.bossState.turnCount) game.bossState.turnCount = 0;
            game.bossState.turnCount++;

            // 1. Poder da Múmia (Transforma ossos em areia)
            if (game.bossState.turnCount % 6 === 0) {
                let changed = false;
                game.grid.forEach((row, r) => {
                    row.forEach((cell, c) => {
                        if (cell && cell.key === 'bone') {
                            game.grid[r][c] = { type: 'OBSTACLE', key: 'quicksand', emoji: '🏜️' };
                            changed = true;
                        }
                    });
                });
                if (changed) {
                    game.renderGrid();
                    game.triggerScreenFlash('#92400e');
                }
            }

            // 2. Poder do Escorpião (Transforma areia em areia movediça)
            if (game.bossState.turnCount % 4 === 0) {
                let changed = false;
                game.grid.forEach((row, r) => {
                    row.forEach((cell, c) => {
                        if (cell && cell.key === 'sand') {
                            game.grid[r][c] = { type: 'OBSTACLE', key: 'quicksand', emoji: '🏜️' };
                            changed = true;
                        }
                    });
                });
                if (changed) {
                    game.renderGrid();
                    game.triggerScreenFlash('#a16207');
                }
            }

            // 3. PODER ESPECIAL: Tempestade de Areia (Transforma caveiras em tempestade)
            if (game.bossState.turnCount % 8 === 0) {
                let changed = false;
                game.grid.forEach((row, r) => {
                    row.forEach((cell, c) => {
                        if (cell && cell.key === 'skull') {
                            game.grid[r][c] = { type: 'OBSTACLE', key: 'sandstorm', emoji: '🌪️' };
                            changed = true;
                        }
                    });
                });
                if (changed) {
                    game.renderGrid();
                    game.triggerScreenFlash('#f59e0b'); // Flash amarelo (tempestade)
                }
            }
        }
    },

    // =========================================================================
    // BOSSES DO CASTELO SOMBRIO
    // =========================================================================

    // ELITE NÍVEL 90: GÁRGULA
    'gargoyle': {
        name: 'Gárgula',
        emoji: '🦇',
        maxHp: 100,
        onTurnEnd: (game) => {
            // PASSIVA 1: A cada 5 jogadas, transforma magia em sombras
            if (!game.bossState.turnCount) game.bossState.turnCount = 0;
            game.bossState.turnCount++;

            if (game.bossState.turnCount % 5 === 0) {
                let changed = false;
                game.grid.forEach((row, r) => {
                    row.forEach((cell, c) => {
                        if (cell && cell.key === 'magic') {
                            game.grid[r][c] = { type: 'OBSTACLE', key: 'shadows', emoji: '🌑' };
                            changed = true;
                        }
                    });
                });
                if (changed) {
                    game.renderGrid();
                    game.triggerScreenFlash('#0f172a'); // Flash azul escuro
                }
            }

            // PASSIVA 2: A cada 7 jogadas, cria sombras em posições vazias
            if (game.bossState.turnCount % 7 === 0) {
                const validTargets = [];

                game.grid.forEach((row, r) => {
                    row.forEach((cell, c) => {
                        if (!cell) {
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
                    game.grid[target.r][target.c] = { type: 'OBSTACLE', key: 'shadows', emoji: '🌑' };
                    game.renderGrid();
                    game.triggerScreenFlash('#1e1b4b');
                }
            }
        }
    },

    // ELITE NÍVEL 95: CAVALEIRO SOMBRIO
    'knight': {
        name: 'Cavaleiro',
        emoji: '🛡️',
        maxHp: 120,
        onTurnEnd: (game) => {
            if (!game.bossState.turnCount) game.bossState.turnCount = 0;
            game.bossState.turnCount++;

            // 1. Poder da Gárgula (Transforma magia em sombras)
            if (game.bossState.turnCount % 5 === 0) {
                let changed = false;
                game.grid.forEach((row, r) => {
                    row.forEach((cell, c) => {
                        if (cell && cell.key === 'magic') {
                            game.grid[r][c] = { type: 'OBSTACLE', key: 'shadows', emoji: '🌑' };
                            changed = true;
                        }
                    });
                });
                if (changed) {
                    game.renderGrid();
                    game.triggerScreenFlash('#0f172a');
                }
            }

            // 2. PODER ESPECIAL: Escudo Sombrio (Transforma crânios em sombras)
            if (game.bossState.turnCount % 4 === 0) {
                let changed = false;
                game.grid.forEach((row, r) => {
                    row.forEach((cell, c) => {
                        if (cell && cell.key === 'skull') {
                            game.grid[r][c] = { type: 'OBSTACLE', key: 'shadows', emoji: '🌑' };
                            changed = true;
                        }
                    });
                });
                if (changed) {
                    game.renderGrid();
                    game.triggerScreenFlash('#312e81'); // Flash roxo escuro
                }
            }
        }
    },

    // BOSS FINAL NÍVEL 100: MAGO NEGRO
    'dark_wizard': {
        name: 'Mago Negro',
        emoji: '🧙‍♂️',
        maxHp: 150,
        onTurnEnd: (game) => {
            if (!game.bossState.turnCount) game.bossState.turnCount = 0;
            game.bossState.turnCount++;

            // 1. Poder da Gárgula (Transforma magia em sombras)
            if (game.bossState.turnCount % 5 === 0) {
                let changed = false;
                game.grid.forEach((row, r) => {
                    row.forEach((cell, c) => {
                        if (cell && cell.key === 'magic') {
                            game.grid[r][c] = { type: 'OBSTACLE', key: 'shadows', emoji: '🌑' };
                            changed = true;
                        }
                    });
                });
                if (changed) {
                    game.renderGrid();
                    game.triggerScreenFlash('#0f172a');
                }
            }

            // 2. Poder do Cavaleiro (Transforma crânios em sombras)
            if (game.bossState.turnCount % 4 === 0) {
                let changed = false;
                game.grid.forEach((row, r) => {
                    row.forEach((cell, c) => {
                        if (cell && cell.key === 'skull') {
                            game.grid[r][c] = { type: 'OBSTACLE', key: 'shadows', emoji: '🌑' };
                            changed = true;
                        }
                    });
                });
                if (changed) {
                    game.renderGrid();
                    game.triggerScreenFlash('#312e81');
                }
            }

            // 3. PODER SUPREMO: Eclipse Sombrio (Transforma cristais em vácuo)
            if (game.bossState.turnCount % 6 === 0) {
                let changed = false;
                game.grid.forEach((row, r) => {
                    row.forEach((cell, c) => {
                        if (cell && cell.key === 'crystal') {
                            game.grid[r][c] = { type: 'OBSTACLE', key: 'void', emoji: '⚫' };
                            changed = true;
                        }
                    });
                });
                if (changed) {
                    game.renderGrid();
                    game.triggerScreenFlash('#7f1d1d'); // Flash vermelho sangue
                }
            }

            // 4. PODER FINAL: Gerar Sombras Aleatórias (A cada 8 jogadas)
            if (game.bossState.turnCount % 8 === 0) {
                const validTargets = [];

                game.grid.forEach((row, r) => {
                    row.forEach((cell, c) => {
                        if (!cell) {
                            const rowCount = row.filter(x => x !== null).length;
                            const colCount = game.grid.reduce((acc, currRow) => acc + (currRow[c] !== null ? 1 : 0), 0);

                            if (rowCount < game.gridSize - 1 && colCount < game.gridSize - 1) {
                                validTargets.push({r, c});
                            }
                        }
                    });
                });

                if (validTargets.length > 0) {
                    // Gera 2 sombras de uma vez (Boss final é mais agressivo)
                    for (let i = 0; i < Math.min(2, validTargets.length); i++) {
                        const targetIndex = Math.floor(Math.random() * validTargets.length);
                        const target = validTargets.splice(targetIndex, 1)[0];
                        game.grid[target.r][target.c] = { type: 'OBSTACLE', key: 'shadows', emoji: '🌑' };
                    }
                    game.renderGrid();
                    game.triggerScreenFlash('#4c0519'); // Flash roxo muito escuro
                }
            }
        }
    }
};