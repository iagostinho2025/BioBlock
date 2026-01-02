// Gerador de Níveis
function generateLevels(startId, count, worldTheme, itemEmoji) {
    const levels = [];
    for (let i = 0; i < count; i++) {
        const id = startId + i;
        const isBoss = (id % 20 === 0);
        
        let levelConfig = {
            id: id,
            world: worldTheme,
            type: isBoss ? 'boss' : 'normal',
            goals: {},
            items: [ 
                { key: 'NORMAL', weight: 80 }, 
                { key: worldTheme.toUpperCase(), emoji: itemEmoji, weight: 20 } 
            ]
        };

        if (!isBoss) {
            // Meta progressiva
            levelConfig.goals = { [worldTheme]: 10 + Math.floor(i / 2) };
        } else {
            // --- CONFIGURAÇÃO ESPECÍFICA DO BOSS ---
            if (worldTheme === 'fire') {
                levelConfig.boss = { id: 'dragon_ignis', name: 'Ignis', emoji: '🐉', maxHp: 50 };
                // Cantos com Vulcão (Lava)
                levelConfig.gridConfig = [
                    { r: 0, c: 0, type: 'LAVA' }, { r: 0, c: 7, type: 'LAVA' },
                    { r: 7, c: 0, type: 'LAVA' }, { r: 7, c: 7, type: 'LAVA' }
                ];
            }
            // Futuros bosses podem ser configurados aqui
        }

        levels.push(levelConfig);
    }
    return levels;
}

export const WORLDS = [
    {
        id: 'world_fire',
        name: 'Terra do Fogo',
        totalLevels: 20,
        bossName: 'Ignis',
        bossAvatar: '🐉', 
        emoji: '🔥',      
        themeClass: 'theme-fire',
        gradient: 'linear-gradient(135deg, #f59e0b, #ef4444)',
        
        // IMAGEM DE FUNDO DO MUNDO
        bgImage: 'assets/images/bg-fire.png', 
        
        levels: generateLevels(1, 20, 'fire', '🔥'),
        unlocked: true
    },
    {
        id: 'world_water',
        name: 'Ilha das Águas',
        totalLevels: 20,
        bossName: 'Leviatã',
        bossAvatar: '🐙',
        emoji: '💧',
        themeClass: 'theme-water',
        gradient: 'linear-gradient(135deg, #3b82f6, #0ea5e9)',
        
        bgImage: 'assets/images/bg-water.png', 
        
        levels: generateLevels(21, 20, 'water', '💧'),
        unlocked: false
    },
    {
        id: 'world_forest',
        name: 'Floresta Antiga',
        totalLevels: 20,
        bossName: 'Groot',
        bossAvatar: '🦍',
        emoji: '🌳',
        themeClass: 'theme-forest',
        gradient: 'linear-gradient(135deg, #22c55e, #15803d)',
        levels: generateLevels(41, 20, 'forest', '🌳'),
        unlocked: false
    },
    {
        id: 'world_mountain',
        name: 'Pico da Montanha',
        totalLevels: 20,
        bossName: 'Titan',
        bossAvatar: '🗿',
        emoji: '🏔️',
        themeClass: 'theme-mountain',
        gradient: 'linear-gradient(135deg, #a8a29e, #57534e)',
        levels: generateLevels(61, 20, 'mountain', '🏔️'),
        unlocked: false
    },
    {
        id: 'world_ice',
        name: 'Reino de Gelo',
        totalLevels: 20,
        bossName: 'Yeti',
        bossAvatar: '☃️',
        emoji: '❄️',
        themeClass: 'theme-ice',
        gradient: 'linear-gradient(135deg, #67e8f9, #06b6d4)',
        levels: generateLevels(81, 20, 'ice', '❄️'),
        unlocked: false
    },
    {
        id: 'world_zombie',
        name: 'Terra Morta',
        totalLevels: 20,
        bossName: 'Zumbi Rei',
        bossAvatar: '🧟',
        emoji: '💀',
        themeClass: 'theme-zombie',
        gradient: 'linear-gradient(135deg, #a3e635, #3f6212)',
        levels: generateLevels(101, 20, 'zombie', '💀'),
        unlocked: false
    }
];

// --- CONFIGURAÇÃO DA FASE BÔNUS (SALA DO TESOURO) ---
export const BONUS_LEVEL_CONFIG = {
    id: 'bonus_daily',
    type: 'bonus', // Tipo novo para identificarmos a lógica
    name: 'Sala do Tesouro',
    world: 'bonus',
    bgImage: 'assets/images/bg-fire.png', // Pode usar a mesma ou uma de ouro
    
    // As 3 metas concorrentes (Bomba, Rotação, Troca)
    goals: { 
        'bomb': 10, 
        'rotate': 1, 
        'swap': 10 
    },
    
    // Itens que cairão no tabuleiro
    items: [
        { key: 'NORMAL', weight: 60 }, // Blocos normais
        { key: 'BOMB', emoji: '💣', weight: 15 },
        { key: 'ROTATE', emoji: '🔄', weight: 15 },
        { key: 'SWAP', emoji: '🔀', weight: 10 }
    ]
};