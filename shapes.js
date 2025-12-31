export const SHAPES = [
    { type: 'L', matrix: [[1,0], [1,0], [1,1]] },
    { type: 'J', matrix: [[0,1], [0,1], [1,1]] },
    { type: 'O', matrix: [[1,1], [1,1]] },
    { type: 'I', matrix: [[1], [1], [1], [1]] },
    { type: 'I_HOR', matrix: [[1, 1, 1, 1]] },
    { type: 'T', matrix: [[1,1,1], [0,1,0]] },
    { type: 'S', matrix: [[0,1,1], [1,1,0]] },
    { type: 'Z', matrix: [[1,1,0], [0,1,1]] },
    { type: 'DOT', matrix: [[1]] },
    { type: 'DOT2', matrix: [[1, 1]] },
    { type: 'DOT3', matrix: [[1, 1, 1]] }
];

export const ITEMS = {
    BEE: '🐝',
    GHOST: '👻',
    COP: '👮'
};

export function getRandomPiece() {
    // 1. Escolhe a forma
    const shape = SHAPES[Math.floor(Math.random() * SHAPES.length)];
    
    // 2. Gera o layout de conteúdo (Sorteio dos Emojis)
    const layout = shape.matrix.map(row => row.map(val => {
        if (val === 0) return null; // Espaço vazio da matriz
        
        // --- CONFIGURAÇÃO DE DIFICULDADE ---
        // Antes estava 0.20 (20%). Aumentei para 0.50 (50%).
        // Para deixar mais difícil no futuro, diminua este valor.
        const ITEM_CHANCE = 0.50; 
        
        // Rola os dados
        if (Math.random() < ITEM_CHANCE) { 
            // Sorteia qual item (Abelha, Fantasma ou Polícia)
            const keys = ['BEE', 'GHOST', 'COP'];
            const randomKey = keys[Math.floor(Math.random() * keys.length)];
            return { type: 'ITEM', key: randomKey, emoji: ITEMS[randomKey] };
        } else {
            // Bloco cinza normal
            return { type: 'NORMAL' };
        }
    }));
    
    return { 
        ...shape, 
        layout: layout, 
        id: Date.now() + Math.random() 
    };
}