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
        bgImage: 'assets/img/bg_fire.png', 
        levels: [
            // FASE 1
            { id: 1, type: 'normal', goals: { fire: 5 }, items: ['fire'], gridConfig: [] },
            // FASE 2
            { id: 2, type: 'normal', goals: { fire: 8 }, items: ['fire'], gridConfig: [] },
            // FASE 3
            { id: 3, type: 'normal', goals: { fire: 12 }, items: ['fire'], gridConfig: [] },
            // FASE 4
            { id: 4, type: 'normal', goals: { heart: 8 }, items: ['heart'], gridConfig: [{r:0,c:0, ...LAVA}] },
            // FASE 5
            { id: 5, type: 'normal', goals: { heart: 12 }, items: ['heart'], gridConfig: [{r:0,c:7, ...LAVA}] },
            // FASE 6
            { id: 6, type: 'normal', goals: { fire: 8, heart: 5 }, items: ['fire', 'heart'], gridConfig: [...CORNERS_OPPOSITE.map(p => ({...p, ...LAVA}))] },
            // FASE 7
            { id: 7, type: 'normal', goals: { fire: 15 }, items: ['fire'], gridConfig: [...CORNERS_OPPOSITE.map(p => ({...p, ...LAVA}))] },
            // FASE 8
            { id: 8, type: 'normal', goals: { collision: 10 }, items: ['collision'], gridConfig: [...CORNERS_OPPOSITE.map(p => ({...p, ...LAVA}))] },
            // FASE 9
            { id: 9, type: 'normal', goals: { fire: 5, heart: 5, collision: 5 }, items: ['fire', 'heart', 'collision'], gridConfig: [{r:0,c:0, ...LAVA}, {r:7,c:7, ...LAVA}, {r:3,c:3, ...LAVA}] },
            
            // FASE 10: ELITE MAGMOR
            { 
                id: 10, type: 'boss', 
                boss: { id: 'magmor', name: 'Magmor', emoji: '👺', maxHp: 25 },
                items: ['fire', 'heart'], 
                gridConfig: [{r:0,c:0, ...LAVA}, {r:0,c:7, ...LAVA}, {r:3,c:3, ...LAVA}] 
            },

            // FASES 11-19
            { id: 11, type: 'normal', goals: { fire: 18 }, items: ['fire'], gridConfig: [...CORNERS.map(p => ({...p, ...LAVA}))] },
            { id: 12, type: 'normal', goals: { heart: 10, collision: 10 }, items: ['heart', 'collision'], gridConfig: [...CORNERS.map(p => ({...p, ...LAVA}))] },
            { id: 13, type: 'normal', goals: { fire: 12 }, items: ['fire'], gridConfig: [...CORNERS.map(p => ({...p, ...LAVA}))] },
            { id: 14, type: 'normal', goals: { fire: 10, heart: 10 }, items: ['fire', 'heart'], gridConfig: [...CORNERS.map(p => ({...p, ...LAVA}))] },
            
            // --- FASE 15: ELITE FÊNIX INFERNAL (ATUALIZADO) ---
            { 
                id: 15, type: 'boss', 
                boss: { id: 'pyra', name: 'Fênix Infernal', emoji: '🦅', maxHp: 35 },
                items: ['fire', 'heart', 'collision'],
                gridConfig: [...CORNERS.map(p => ({...p, ...LAVA}))] 
            },

            { id: 16, type: 'normal', goals: { fire: 8, heart: 8, collision: 5 }, items: ['fire', 'heart', 'collision'], gridConfig: [...CORNERS.map(p => ({...p, ...LAVA})), {r:3,c:3, ...LAVA}] },
            { id: 17, type: 'normal', goals: { heart: 20 }, items: ['heart'], gridConfig: [...CORNERS.map(p => ({...p, ...LAVA})), {r:4,c:4, ...LAVA}] },
            { id: 18, type: 'normal', goals: { fire: 12, collision: 12 }, items: ['fire', 'collision'], gridConfig: [{r:2,c:2, ...LAVA}, {r:2,c:3, ...LAVA}, {r:2,c:4, ...LAVA}, {r:5,c:2, ...LAVA}, {r:5,c:3, ...LAVA}, {r:5,c:4, ...LAVA}] },
            { id: 19, type: 'normal', goals: { collision: 25 }, items: ['collision'], gridConfig: [{r:2,c:2, ...LAVA}, {r:2,c:3, ...LAVA}, {r:2,c:4, ...LAVA}, {r:5,c:2, ...LAVA}, {r:5,c:3, ...LAVA}, {r:5,c:4, ...LAVA}] },

            // FASE 20: BOSS IGNIS
            { 
                id: 20, type: 'boss', 
                boss: { id: 'ignis', name: 'Ignis', emoji: '🐉', maxHp: 50 },
                items: ['fire', 'heart', 'collision'],
                gridConfig: [
                    {r:0,c:2},{r:0,c:3},{r:0,c:4},{r:0,c:5},
                    {r:7,c:2},{r:7,c:3},{r:7,c:4},{r:7,c:5},
                    {r:2,c:0},{r:5,c:0},{r:2,c:7},{r:5,c:7}
                ].map(p => ({...p, ...LAVA}))
            }
        ]
    },

    // MUNDO 2: ÁGUA
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
             id: 21 + i, type: 'normal', goals: { drop: 15 }, items: ['drop'], gridConfig: [] 
        }))
    },

    // MUNDO 3: FLORESTA
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
             id: 41 + i, type: 'normal', goals: { leaf: 10 }, items: ['leaf'], gridConfig: [] 
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
    
    // Metas da "Corrida" (Agora com Ímã)
    goals: { 
        'magnet': 10, // Substituiu 'bomb'
        'rotate': 10, 
        'swap': 10 
    },
    
    // Lista de itens que vão cair
    items: ['magnet', 'rotate', 'swap'],
    
    gridConfig: [] 
};