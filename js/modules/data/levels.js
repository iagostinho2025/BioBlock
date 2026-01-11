// js/modules/data/levels.js

// --- OBSTÁCULOS COMUNS ---
const LAVA = { type: 'LAVA', key: 'volcano', emoji: '🌋' };

// Helpers para posições do Grid (Gameplay)
const CORNERS = [{r:0,c:0}, {r:0,c:7}, {r:7,c:0}, {r:7,c:7}];
const CORNERS_OPPOSITE = [{r:0,c:0}, {r:7,c:7}]; 

export const WORLDS = [
    // =========================================================================
    // MUNDO 0: O PORTÃO (TUTORIAL)
    // =========================================================================
    {
        id: 'tutorial_world',
        name: 'O Portão',
        emoji: '⛩️',
        gradient: 'linear-gradient(135deg, #475569, #0f172a)', // Cinza Azulado
        totalLevels: 1,
        bossName: 'Guardião',
        bossAvatar: '🗿',
        bgImage: '', // Opcional
        
        // POSIÇÃO DA ILHA NO MAPA DE MUNDOS (0-100%)
        worldPos: { x: 29, y: 87 }, // Lá embaixo, na entrada
        worldSize: 140,
        
        levels: [
            { 
                id: 0, 
                type: 'boss', 
                boss: { id: 'guardian', name: 'Guardião', emoji: '🗿', maxHp: 15 },
                musicId: 'boss_theme', // Música genérica para o tutorial
                items: ['fire', 'heart'], 
                gridConfig: [], 
                mapPos: { x: 50, y: 50 } 
            }
        ]
    },

    // =========================================================================
    // MUNDO 1: TERRA DO FOGO (Fases 1-20)
    // =========================================================================
    {
        id: 'fire_world',
        name: 'Terra do Fogo',
        emoji: '🌋',
        gradient: 'linear-gradient(135deg, #b91c1c, #d97706)', // Vermelho/Laranja
        totalLevels: 20,
        bossName: 'Ignis',
        bossAvatar: '🐉',
        themeClass: 'theme-fire',
        bgImage: 'assets/img/map_volcano.jpg', 
        
        worldPos: { x: 72, y: 75 },
        worldSize: 184,

        levels: [
            // FASE 1
            { id: 1, type: 'normal', goals: { fire: 5 }, items: ['fire'], gridConfig: [], mapPos: { x: 36, y: 91 } },
            // FASE 2
            { id: 2, type: 'normal', goals: { fire: 8 }, items: ['fire'], gridConfig: [], mapPos: { x: 21, y: 87 } },
            // FASE 3
            { id: 3, type: 'normal', goals: { fire: 12 }, items: ['fire'], gridConfig: [], mapPos: { x: 28, y: 79 } },
            // FASE 4
            { id: 4, type: 'normal', goals: { heart: 8 }, items: ['heart'], gridConfig: [{r:0,c:0, ...LAVA}], mapPos: { x: 44, y: 77 } },
            // FASE 5
            { id: 5, type: 'normal', goals: { heart: 12 }, items: ['heart'], gridConfig: [{r:0,c:7, ...LAVA}], mapPos: { x: 62, y: 76 } },
            // FASE 6
            { id: 6, type: 'normal', goals: { fire: 8, heart: 5 }, items: ['fire', 'heart'], gridConfig: [...CORNERS_OPPOSITE.map(p => ({...p, ...LAVA}))], mapPos: { x: 54, y: 69 } },
            // FASE 7
            { id: 7, type: 'normal', goals: { fire: 15 }, items: ['fire'], gridConfig: [...CORNERS_OPPOSITE.map(p => ({...p, ...LAVA}))], mapPos: { x: 39, y: 68 } },
            // FASE 8
            { id: 8, type: 'normal', goals: { collision: 10 }, items: ['collision'], gridConfig: [...CORNERS_OPPOSITE.map(p => ({...p, ...LAVA}))], mapPos: { x: 25, y: 65 } },
            // FASE 9
            { id: 9, type: 'normal', goals: { fire: 5, heart: 5, collision: 5 }, items: ['fire', 'heart', 'collision'], gridConfig: [{r:0,c:0, ...LAVA}, {r:7,c:7, ...LAVA}, {r:3,c:3, ...LAVA}], mapPos: { x: 25, y: 57 } },
            
            // FASE 10: ELITE MAGMOR (Música Elite 1)
            { 
                id: 10, type: 'boss', 
                boss: { id: 'magmor', name: 'Magmor', emoji: '👺', maxHp: 25 },
                musicId: 'bgm_fire_10', // <--- MÚSICA TEMA 1
                items: ['fire', 'heart'], 
                gridConfig: [{r:0,c:0, ...LAVA}, {r:0,c:7, ...LAVA}, {r:3,c:3, ...LAVA}],
                mapPos: { x: 41, y: 55 }
            },

            // FASES 11-14
            { id: 11, type: 'normal', goals: { fire: 18 }, items: ['fire'], gridConfig: [...CORNERS.map(p => ({...p, ...LAVA}))], mapPos: { x: 58, y: 54 } },
            { id: 12, type: 'normal', goals: { heart: 10, collision: 10 }, items: ['heart', 'collision'], gridConfig: [...CORNERS.map(p => ({...p, ...LAVA}))], mapPos: { x: 72, y: 52 } },
            { id: 13, type: 'normal', goals: { fire: 12 }, items: ['fire'], gridConfig: [...CORNERS.map(p => ({...p, ...LAVA}))], mapPos: { x: 83, y: 48 } },
            { id: 14, type: 'normal', goals: { fire: 10, heart: 10 }, items: ['fire', 'heart'], gridConfig: [...CORNERS.map(p => ({...p, ...LAVA}))], mapPos: { x: 81, y: 41 } },
            
            // FASE 15: ELITE FÊNIX INFERNAL (Música Elite 2)
            { 
                id: 15, type: 'boss', 
                boss: { id: 'pyra', name: 'Fênix Infernal', emoji: '🦅', maxHp: 35 },
                musicId: 'bgm_fire_15', // <--- MÚSICA TEMA 2
                items: ['fire', 'heart', 'collision'],
                gridConfig: [...CORNERS.map(p => ({...p, ...LAVA}))],
                mapPos: { x: 67, y: 39 }
            },

            // FASES 16-19
            { id: 16, type: 'normal', goals: { fire: 8, heart: 8, collision: 5 }, items: ['fire', 'heart', 'collision'], gridConfig: [...CORNERS.map(p => ({...p, ...LAVA})), {r:3,c:3, ...LAVA}], mapPos: { x: 53, y: 38 } },
            { id: 17, type: 'normal', goals: { heart: 20 }, items: ['heart'], gridConfig: [...CORNERS.map(p => ({...p, ...LAVA})), {r:4,c:4, ...LAVA}], mapPos: { x: 40, y: 37 } },
            { id: 18, type: 'normal', goals: { fire: 12, collision: 12 }, items: ['fire', 'collision'], gridConfig: [{r:2,c:2, ...LAVA}, {r:2,c:3, ...LAVA}, {r:2,c:4, ...LAVA}, {r:5,c:2, ...LAVA}, {r:5,c:3, ...LAVA}, {r:5,c:4, ...LAVA}], mapPos: { x: 28, y: 34 } },
            { id: 19, type: 'normal', goals: { collision: 25 }, items: ['collision'], gridConfig: [{r:2,c:2, ...LAVA}, {r:2,c:3, ...LAVA}, {r:2,c:4, ...LAVA}, {r:5,c:2, ...LAVA}, {r:5,c:3, ...LAVA}, {r:5,c:4, ...LAVA}], mapPos: { x: 33, y: 27 } },

            // FASE 20: BOSS FINAL IGNIS (Música Boss)
            { 
                id: 20, type: 'boss', 
                boss: { id: 'ignis', name: 'Ignis', emoji: '🐉', maxHp: 50 },
                musicId: 'bgm_fire_20', // <--- MÚSICA BOSS FINAL
                items: ['fire', 'heart', 'collision'],
                gridConfig: [
                    {r:0,c:2},{r:0,c:3},{r:0,c:4},{r:0,c:5},
                    {r:7,c:2},{r:7,c:3},{r:7,c:4},{r:7,c:5},
                    {r:2,c:0},{r:5,c:0},{r:2,c:7},{r:5,c:7}
                ].map(p => ({...p, ...LAVA})),
                mapPos: { x: 53, y: 17 }
            }
        ]
    },

    // =========================================================================
    // MUNDO 2: FLORESTA NEGRA (Fases 21-40)
    // =========================================================================
    {
        id: 'forest_world',
        name: 'Floresta Negra',
        emoji: '🌲',
        gradient: 'linear-gradient(135deg, #14532d, #581c87)',
        totalLevels: 20,
        bossName: 'Aracna',
        bossAvatar: '🕷️',
        bgImage: 'assets/img/bg_forest.jpg',
        
        worldPos: { x: 31, y: 57 },
        worldSize: 200,

        levels: Array.from({length: 20}, (_, i) => {
            const id = 21 + i;
            const relativeId = i + 1; // 1 a 20
            
            let type = 'normal';
            let boss = null;
            let musicId = null;

            // Configuração dos 3 Bosses/Temas
            if (relativeId === 20) { // Nível 40
                type = 'boss';
                boss = { id: 'aracna', name: 'Aracna', emoji: '🕷️', maxHp: 60 };
                musicId = 'bgm_forest_20';
            } else if (relativeId === 15) { // Nível 35
                type = 'boss';
                boss = { id: 'forest_elite_2', name: 'Ent Ancião', emoji: '🌳', maxHp: 45 };
                musicId = 'bgm_forest_15';
            } else if (relativeId === 10) { // Nível 30
                type = 'boss';
                boss = { id: 'forest_elite_1', name: 'Lobo Alfa', emoji: '🐺', maxHp: 35 };
                musicId = 'bgm_forest_10';
            }

            return {
                id: id,
                type: type,
                boss: boss,
                musicId: musicId,
                goals: { leaf: 15 },
                items: ['leaf', 'poison'],
                gridConfig: [],
                mapPos: { x: 50, y: 50 } // Posição provisória
            };
        })
    },

    // =========================================================================
    // MUNDO 3: MONTANHA DE FERRO (Fases 41-60)
    // =========================================================================
    {
        id: 'mountain_world',
        name: 'Montanha de Ferro',
        emoji: '🏔️',
        gradient: 'linear-gradient(135deg, #57534e, #ca8a04)',
        totalLevels: 20,
        bossName: 'Golem Rei',
        bossAvatar: '🤖',
        bgImage: 'assets/img/bg_mountain.jpg',
        
        worldPos: { x: 72, y: 41 },
        worldSize: 180,

        levels: Array.from({length: 20}, (_, i) => {
            const id = 41 + i;
            const relativeId = i + 1;
            
            let type = 'normal';
            let boss = null;
            let musicId = null;

            if (relativeId === 20) {
                type = 'boss';
                boss = { id: 'golem', name: 'Golem Rei', emoji: '🤖', maxHp: 80 };
                musicId = 'bgm_mountain_20';
            } else if (relativeId === 15) {
                type = 'boss';
                boss = { id: 'mountain_elite_2', name: 'Gigante', emoji: '🗿', maxHp: 65 };
                musicId = 'bgm_mountain_15';
            } else if (relativeId === 10) {
                type = 'boss';
                boss = { id: 'mountain_elite_1', name: 'Troll', emoji: '👺', maxHp: 50 };
                musicId = 'bgm_mountain_10';
            }

            return {
                id: id,
                type: type,
                boss: boss,
                musicId: musicId,
                goals: { gold: 20 },
                items: ['gold', 'pickaxe'],
                gridConfig: [],
                mapPos: { x: 50, y: 50 }
            };
        })
    },

    // =========================================================================
    // MUNDO 4: DESERTO DA MORTE (Fases 61-80)
    // =========================================================================
    {
        id: 'desert_world',
        name: 'Deserto da Morte',
        emoji: '🏜️',
        gradient: 'linear-gradient(135deg, #78350f, #9a3412)',
        totalLevels: 20,
        bossName: 'Warlord Grok',
        bossAvatar: '👹',
        bgImage: 'assets/img/bg_desert.jpg',
        
        worldPos: { x: 30, y: 31 },
        worldSize: 185,

        levels: Array.from({length: 20}, (_, i) => {
            const id = 61 + i;
            const relativeId = i + 1;
            
            let type = 'normal';
            let boss = null;
            let musicId = null;

            if (relativeId === 20) {
                type = 'boss';
                boss = { id: 'grok', name: 'Grok', emoji: '👹', maxHp: 100 };
                musicId = 'bgm_desert_20';
            } else if (relativeId === 15) {
                type = 'boss';
                boss = { id: 'desert_elite_2', name: 'Escorpião', emoji: '🦂', maxHp: 85 };
                musicId = 'bgm_desert_15';
            } else if (relativeId === 10) {
                type = 'boss';
                boss = { id: 'desert_elite_1', name: 'Múmia', emoji: '🤕', maxHp: 70 };
                musicId = 'bgm_desert_10';
            }

            return {
                id: id,
                type: type,
                boss: boss,
                musicId: musicId,
                goals: { bone: 15 },
                items: ['bone', 'sand'],
                gridConfig: [],
                mapPos: { x: 50, y: 50 }
            };
        })
    },

    // =========================================================================
    // MUNDO 5: CASTELO SOMBRIO (Fases 81-100)
    // =========================================================================
    {
        id: 'castle_world',
        name: 'Castelo Sombrio',
        emoji: '🏰',
        gradient: 'linear-gradient(135deg, #020617, #7f1d1d)',
        totalLevels: 20,
        bossName: 'Mago Negro',
        bossAvatar: '🧙‍♂️',
        bgImage: 'assets/img/bg_castle.jpg',
        
        worldPos: { x: 77, y: 15 },
        worldSize: 138,

        levels: Array.from({length: 20}, (_, i) => {
            const id = 81 + i;
            const relativeId = i + 1;
            
            let type = 'normal';
            let boss = null;
            let musicId = null;

            if (relativeId === 20) {
                type = 'boss';
                boss = { id: 'dark_wizard', name: 'Mago Negro', emoji: '🧙‍♂️', maxHp: 150 };
                musicId = 'bgm_castle_20';
            } else if (relativeId === 15) {
                type = 'boss';
                boss = { id: 'castle_elite_2', name: 'Cavaleiro', emoji: '🛡️', maxHp: 120 };
                musicId = 'bgm_castle_15';
            } else if (relativeId === 10) {
                type = 'boss';
                boss = { id: 'castle_elite_1', name: 'Gárgula', emoji: '🦇', maxHp: 100 };
                musicId = 'bgm_castle_10';
            }

            return {
                id: id,
                type: type,
                boss: boss,
                musicId: musicId,
                goals: { magic: 20 },
                items: ['magic', 'skull'],
                gridConfig: [],
                mapPos: { x: 50, y: 50 }
            };
        })
    }
];

// --- CONFIGURAÇÃO DA FASE BÔNUS ---
export const BONUS_LEVEL_CONFIG = {
    id: 'bonus_daily', 
    type: 'bonus', 
    name: 'Sala do Tesouro',
    world: 'bonus',
    bgImage: 'assets/img/map_volcano.jpg', 
    
    // Posição do Botão Roxo dentro do Mapa de Fogo
    mapPos: { x: 14, y: 47 },

    goals: { 
        'magnet': 10, 
        'rotate': 10, 
        'swap': 10 
    },
    items: ['magnet', 'rotate', 'swap'],
    gridConfig: [] 
};