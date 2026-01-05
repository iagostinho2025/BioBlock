// Definição das matrizes (Desenhos das peças)
const SHAPE_DEFINITIONS = [
    { name: 'dot', matrix: [[1]] },
    { name: 'mini-h', matrix: [[1, 1]] },
    { name: 'mini-v', matrix: [[1], [1]] },
    { name: 'square-2x2', matrix: [[1, 1], [1, 1]] },
    { name: 'square-3x3', matrix: [[1, 1, 1], [1, 1, 1], [1, 1, 1]] },
    { name: 'line-3h', matrix: [[1, 1, 1]] },
    { name: 'line-3v', matrix: [[1], [1], [1]] },
    { name: 'line-4h', matrix: [[1, 1, 1, 1]] },
    { name: 'line-4v', matrix: [[1], [1], [1], [1]] },
    { name: 'corner-tl', matrix: [[1, 0], [1, 1]] },
    { name: 'corner-tr', matrix: [[0, 1], [1, 1]] },
    { name: 'corner-bl', matrix: [[1, 1], [1, 0]] },
    { name: 'corner-br', matrix: [[1, 1], [0, 1]] },
    { name: 'l-0', matrix: [[1, 0], [1, 0], [1, 1]] }, 
    { name: 'l-90', matrix: [[1, 1, 1], [1, 0, 0]] }, 
    { name: 'l-180', matrix: [[1, 1], [0, 1], [0, 1]] }, 
    { name: 'l-270', matrix: [[0, 0, 1], [1, 1, 1]] }, 
    { name: 'j-0', matrix: [[0, 1], [0, 1], [1, 1]] }, 
    { name: 'j-90', matrix: [[1, 0, 0], [1, 1, 1]] }, 
    { name: 'j-180', matrix: [[1, 1], [1, 0], [1, 0]] }, 
    { name: 'j-270', matrix: [[1, 1, 1], [0, 0, 1]] }, 
    { name: 't-0', matrix: [[1, 1, 1], [0, 1, 0]] },
    { name: 't-90', matrix: [[0, 1], [1, 1], [0, 1]] },
    { name: 't-180', matrix: [[0, 1, 0], [1, 1, 1]] },
    { name: 't-270', matrix: [[1, 0], [1, 1], [1, 0]] },
    { name: 's-h', matrix: [[0, 1, 1], [1, 1, 0]] },
    { name: 's-v', matrix: [[1, 0], [1, 1], [0, 1]] },
    { name: 'z-h', matrix: [[1, 1, 0], [0, 1, 1]] },
    { name: 'z-v', matrix: [[0, 1], [1, 1], [1, 0]] },
];

// TABELA MESTRA DE STATS (Dano e Raridade)
export const ITEM_STATS = {
    // MUNDO FOGO
    'fire':      { damage: 1,  weight: 80 }, 
    'heart':     { damage: 3,  weight: 40 }, 
    'collision': { damage: 5,  weight: 10 }, 
    
    // ITENS BÔNUS
    'magnet':    { damage: 1,  weight: 15 },
    'rotate':    { damage: 1,  weight: 15 },
    'swap':      { damage: 1,  weight: 15 },

    // Futuros
    'drop':      { damage: 1,  weight: 80 },
    'fish':      { damage: 3,  weight: 40 },
    'leaf':      { damage: 1,  weight: 80 },
    
    // Fallback
    'default':   { damage: 1,  weight: 50 }
};

// Lista Padrão (Casual)
const DEFAULT_ITEMS = [
    { key: 'BEE', emoji: '🐝', weight: 4 },
    { key: 'GHOST', emoji: '👻', weight: 4 },
    { key: 'COP', emoji: '👮', weight: 4 },
    { key: 'NORMAL', emoji: null, weight: 15 }
];

export function getRandomPiece(customItems = null, useRPGStats = false) {
    let pool = SHAPE_DEFINITIONS;

    // --- FILTRO DE TESTE (SOMENTE MODO CLÁSSICO) ---
    // Se customItems é null, significa que estamos no Modo Casual/Clássico.
    // Se customItems tem conteúdo, estamos no Modo Aventura.
    if (!customItems) {
        const DEBUG_SHAPES = [
            'square-2x2', 'square-3x3',
            'line-3h', 'line-3v',
            'line-4h', 'line-4v'
        ];
        // Aplica o filtro APENAS no clássico
        pool = SHAPE_DEFINITIONS.filter(s => DEBUG_SHAPES.includes(s.name));
    }
    // -----------------------------------------------

    const shapeDef = pool[Math.floor(Math.random() * pool.length)];
    const matrix = shapeDef.matrix;

    const layout = matrix.map(row => {
        return row.map(cell => {
            if (cell === 0) return null;

            if (customItems && customItems.length > 0) {
                // MODO AVENTURA (Com pesos de RPG se necessário)
                const chanceOfItem = useRPGStats ? 0.4 : 0.35; 

                if (Math.random() < chanceOfItem) {
                    const phasePool = customItems.map(key => {
                        let weight = 50;
                        if (useRPGStats && ITEM_STATS[key]) {
                            weight = ITEM_STATS[key].weight;
                        }
                        
                        return { key: key, weight: weight };
                    });
                    
                    const selected = weightedRandomItem(phasePool);
                    return { type: 'ITEM', key: selected.key };
                } else {
                    return { type: 'NORMAL' };
                }
            } 
            else {
                // MODO CASUAL / CLÁSSICO (Padrão)
                const itemType = weightedRandomItem(DEFAULT_ITEMS);
                return {
                    type: itemType.key === 'NORMAL' ? 'NORMAL' : 'ITEM',
                    key: itemType.key,
                    emoji: itemType.emoji
                };
            }
        });
    });

    return {
        name: shapeDef.name,
        matrix: matrix,
        layout: layout
    };
}

function weightedRandomItem(items) {
    const totalWeight = items.reduce((sum, item) => sum + item.weight, 0);
    let random = Math.random() * totalWeight;
    
    for (const item of items) {
        if (random < item.weight) return item;
        random -= item.weight;
    }
    return items[0];
}