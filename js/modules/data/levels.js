// Configuração dos Níveis e Mundos

// --- OBSTÁCULOS COMUNS ---
const LAVA = { type: 'LAVA', key: 'volcano', emoji: '🌋' };
const WATER_OBS = { type: 'OBSTACLE', key: 'algae', emoji: '🌿' }; 

// Helpers para posições
const CORNERS = [{r:0,c:0}, {r:0,c:7}, {r:7,c:0}, {r:7,c:7}];
const CORNERS_OPPOSITE = [{r:0,c:0}, {r:7,c:7}]; 

export const WORLDS = [
    // =========================================================================
    // MUNDO 1: TERRA DO FOGO
    // =========================================================================
    {
        id: 'fire_world',
        name: 'Terra do Fogo',
        emoji: '🌋',
        gradient: 'linear-gradient(135deg, #b91c1c, #d97706)',
        totalLevels: 20,
        bossName: 'Ignis',
        bossAvatar: '🐉',
        themeClass: 'theme-fire',
        // Atualizei para o nome da imagem que você enviou
        bgImage: 'assets/img/map_volcano.png', 
        
        levels: [
            // --- PARTE INFERIOR (Subindo) ---
            // FASE 1 (Base direita embaixo)
            { id: 1, type: 'normal', goals: { fire: 5 }, items: ['fire'], gridConfig: [], mapPos: { x: 78, y: 83 } },
            // FASE 2 (Centro embaixo)
            { id: 2, type: 'normal', goals: { fire: 8 }, items: ['fire'], gridConfig: [], mapPos: { x: 44, y: 81 } },
            // FASE 3 (Esquerda embaixo)
            { id: 3, type: 'normal', goals: { fire: 12 }, items: ['fire'], gridConfig: [], mapPos: { x: 20, y: 82 } },
            // FASE 4 (Curva esquerda subindo)
            { id: 4, type: 'normal', goals: { heart: 8 }, items: ['heart'], gridConfig: [{r:0,c:0, ...LAVA}], mapPos: { x: 12, y: 72 } },
            
            // --- MEIO INFERIOR ---
            // FASE 5 (Voltando pro centro)
            { id: 5, type: 'normal', goals: { heart: 12 }, items: ['heart'], gridConfig: [{r:0,c:7, ...LAVA}], mapPos: { x: 30, y: 68 } },
            // FASE 6 (Centro)
            { id: 6, type: 'normal', goals: { fire: 8, heart: 5 }, items: ['fire', 'heart'], gridConfig: [...CORNERS_OPPOSITE.map(p => ({...p, ...LAVA}))], mapPos: { x: 50, y: 64 } },
            // FASE 7 (Indo pra direita)
            { id: 7, type: 'normal', goals: { fire: 15 }, items: ['fire'], gridConfig: [...CORNERS_OPPOSITE.map(p => ({...p, ...LAVA}))], mapPos: { x: 72, y: 60 } },
            // FASE 8 (Direita subindo)
            { id: 8, type: 'normal', goals: { collision: 10 }, items: ['collision'], gridConfig: [...CORNERS_OPPOSITE.map(p => ({...p, ...LAVA}))], mapPos: { x: 82, y: 50 } },
            
            // --- MEIO SUPERIOR ---
            // FASE 9 (Voltando pro centro)
            { id: 9, type: 'normal', goals: { fire: 5, heart: 5, collision: 5 }, items: ['fire', 'heart', 'collision'], gridConfig: [{r:0,c:0, ...LAVA}, {r:7,c:7, ...LAVA}, {r:3,c:3, ...LAVA}], mapPos: { x: 62, y: 46 } },
            // FASE 10: MAGMOR (Centro)
            { 
                id: 10, type: 'boss', 
                boss: { id: 'magmor', name: 'Magmor', emoji: '👺', maxHp: 25 },
                items: ['fire', 'heart'], 
                gridConfig: [{r:0,c:0, ...LAVA}, {r:0,c:7, ...LAVA}, {r:3,c:3, ...LAVA}],
                mapPos: { x: 40, y: 44 }
            },
            
            // --- ZIGUEZAGUE SUPERIOR ---
            // FASE 11 (Esquerda)
            { id: 11, type: 'normal', goals: { fire: 18 }, items: ['fire'], gridConfig: [...CORNERS.map(p => ({...p, ...LAVA}))], mapPos: { x: 20, y: 42 } },
            // FASE 12 (Canto esquerdo subindo)
            { id: 12, type: 'normal', goals: { heart: 10, collision: 10 }, items: ['heart', 'collision'], gridConfig: [...CORNERS.map(p => ({...p, ...LAVA}))], mapPos: { x: 12, y: 32 } },
            // FASE 13 (Voltando pro centro)
            { id: 13, type: 'normal', goals: { fire: 12 }, items: ['fire'], gridConfig: [...CORNERS.map(p => ({...p, ...LAVA}))], mapPos: { x: 30, y: 28 } },
            // FASE 14 (Indo pra direita)
            { id: 14, type: 'normal', goals: { fire: 10, heart: 10 }, items: ['fire', 'heart'], gridConfig: [...CORNERS.map(p => ({...p, ...LAVA}))], mapPos: { x: 50, y: 24 } },
            // FASE 15: FÊNIX (Direita)
            { 
                id: 15, type: 'boss', 
                boss: { id: 'pyra', name: 'Fênix Infernal', emoji: '🦅', maxHp: 35 },
                items: ['fire', 'heart', 'collision'],
                gridConfig: [...CORNERS.map(p => ({...p, ...LAVA}))],
                mapPos: { x: 70, y: 20 }
            },

            // --- RETA FINAL (Castelo) ---
            // FASE 16 (Voltando pro centro)
            { id: 16, type: 'normal', goals: { fire: 8, heart: 8, collision: 5 }, items: ['fire', 'heart', 'collision'], gridConfig: [...CORNERS.map(p => ({...p, ...LAVA})), {r:3,c:3, ...LAVA}], mapPos: { x: 55, y: 15 } },
            // FASE 17 (Esquerda castelo)
            { id: 17, type: 'normal', goals: { heart: 20 }, items: ['heart'], gridConfig: [...CORNERS.map(p => ({...p, ...LAVA})), {r:4,c:4, ...LAVA}], mapPos: { x: 38, y: 12 } },
            // FASE 18 (Direita castelo)
            { id: 18, type: 'normal', goals: { fire: 12, collision: 12 }, items: ['fire', 'collision'], gridConfig: [{r:2,c:2, ...LAVA}, {r:2,c:3, ...LAVA}, {r:2,c:4, ...LAVA}, {r:5,c:2, ...LAVA}, {r:5,c:3, ...LAVA}, {r:5,c:4, ...LAVA}], mapPos: { x: 62, y: 12 } },
            // FASE 19 (Porta do castelo)
            { id: 19, type: 'normal', goals: { collision: 25 }, items: ['collision'], gridConfig: [{r:2,c:2, ...LAVA}, {r:2,c:3, ...LAVA}, {r:2,c:4, ...LAVA}, {r:5,c:2, ...LAVA}, {r:5,c:3, ...LAVA}, {r:5,c:4, ...LAVA}], mapPos: { x: 50, y: 8 } },

            // FASE 20: BOSS FINAL (Dentro do portão/Fogo superior)
            { 
                id: 20, type: 'boss', 
                boss: { id: 'ignis', name: 'Ignis', emoji: '🐉', maxHp: 50 },
                items: ['fire', 'heart', 'collision'],
                gridConfig: [
                    {r:0,c:2},{r:0,c:3},{r:0,c:4},{r:0,c:5},
                    {r:7,c:2},{r:7,c:3},{r:7,c:4},{r:7,c:5},
                    {r:2,c:0},{r:5,c:0},{r:2,c:7},{r:5,c:7}
                ].map(p => ({...p, ...LAVA})),
                mapPos: { x: 50, y: 2 } // Bem no topo
            }
        ]
    },

    // MUNDO 2: ÁGUA (Placeholder)
    {
        id: 'water_world',
        name: 'Ilha das Águas',
        emoji: '🌊',
        gradient: 'linear-gradient(135deg, #06b6d4, #3b82f6)',
        totalLevels: 20,
        bossName: 'Kraken',
        bossAvatar: '🐙',
        themeClass: 'theme-water',
        bgImage: 'assets/img/bg_water.png', 
        levels: Array.from({length: 20}, (_, i) => ({
             id: 21 + i, 
             type: 'normal', 
             goals: { drop: 15 }, 
             items: ['drop'], 
             gridConfig: [],
             mapPos: { x: 50, y: 50 } // Placeholder
        }))
    },

    // MUNDO 3: FLORESTA (Placeholder)
    {
        id: 'forest_world',
        name: 'Floresta Antiga',
        emoji: '🌲',
        gradient: 'linear-gradient(135deg, #22c55e, #14532d)',
        totalLevels: 20,
        bossName: 'Treant',
        bossAvatar: '🌳',
        themeClass: 'theme-forest',
        bgImage: 'assets/img/bg_forest.png', 
        levels: Array.from({length: 20}, (_, i) => ({
             id: 41 + i, 
             type: 'normal', 
             goals: { leaf: 10 }, 
             items: ['leaf'], 
             gridConfig: [],
             mapPos: { x: 50, y: 50 } // Placeholder
        }))
    }
];

// --- CONFIGURAÇÃO DA FASE BÔNUS (SALA DO TESOURO) ---
export const BONUS_LEVEL_CONFIG = {
    id: 'bonus_daily', 
    type: 'bonus', 
    name: 'Sala do Tesouro',
    world: 'bonus',
    bgImage: 'assets/img/bg_fire.png', 
    
    // Configurado no cristal azul à esquerda da imagem
    mapPos: { x: 10, y: 38 },

    goals: { 
        'magnet': 10, 
        'rotate': 10, 
        'swap': 10 
    },
    items: ['magnet', 'rotate', 'swap'],
    gridConfig: [] 
};