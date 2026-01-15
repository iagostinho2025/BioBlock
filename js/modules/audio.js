export class AudioSystem {
    constructor() {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        this.ctx = new AudioContext();
        
        // Canal de Efeitos (SFX)
        this.masterGain = this.ctx.createGain();
        this.masterGain.gain.value = 0.5; 
        this.masterGain.connect(this.ctx.destination);

        // Canal de Música (BGM)
        this.bgmGain = this.ctx.createGain();
        this.bgmGain.gain.value = 0.3; 
        this.bgmGain.connect(this.ctx.destination);

        this.bgmNode = null;
        this.buffers = {};
        this.unlocked = false; 

        this.loadSounds();
    }

    async loadSounds() {
        const files = {
            // --- EFEITOS DE INTERFACE E GAMEPLAY ---
            drag: 'assets/sounds/drag.mp3',
            drop: 'assets/sounds/drop.mp3',
            click: 'assets/sounds/click.mp3',
            back: 'assets/sounds/back.mp3',
            clear1: 'assets/sounds/clear_1.mp3',
            clear2: 'assets/sounds/clear_2.mp3',
            clear3: 'assets/sounds/clear_3.mp3',
            clear4: 'assets/sounds/clear_4.mp3',
            
            // --- VOZES DE COMBO ---
            wow: 'assets/sounds/voice_wow.mp3',
            holycow: 'assets/sounds/voice_holycow.mp3',
            unreal: 'assets/sounds/voice_unreal.mp3',
            
            // --- EFEITOS DE ATAQUE DOS BOSSES ---
            boss_hit_1: 'assets/sounds/boss_hit_1.mp3',
            boss_hit_2: 'assets/sounds/boss_hit_2.mp3',
            boss_hit_3: 'assets/sounds/boss_hit_3.mp3',
            boss_hit_4: 'assets/sounds/boss_hit_4.mp3',

            // --- PODERES DOS HERÓIS ---
            arrow: 'assets/sounds/sound_arrow.mp3',
            wolf: 'assets/sounds/sound_wolf.mp3',
            sword: 'assets/sounds/sound_sword.mp3',
			mage: 'assets/sounds/sound_mage.mp3',

            // =================================================================
            // 🎵 MÚSICAS TEMA (BGM) - AGORA NA PASTA SOUNDS
            // =================================================================
            
            // MUNDO 1: TERRA DO FOGO
            bgm_fire_10: 'assets/sounds/fire_elite_1.mp3', // Elite (Nível 10)
            bgm_fire_15: 'assets/sounds/fire_elite_2.mp3', // Elite (Nível 15)
            bgm_fire_20: 'assets/sounds/fire_boss.mp3',    // Boss Final (Ignis)

            // MUNDO 2: FLORESTA NEGRA
            bgm_forest_10: 'assets/sounds/forest_elite_1.mp3', 
            bgm_forest_15: 'assets/sounds/forest_elite_2.mp3', 
            bgm_forest_20: 'assets/sounds/forest_boss.mp3',    

            // MUNDO 3: MONTANHA
            bgm_mountain_10: 'assets/sounds/mountain_elite_1.mp3',
            bgm_mountain_15: 'assets/sounds/mountain_elite_2.mp3',
            bgm_mountain_20: 'assets/sounds/mountain_boss.mp3',

            // MUNDO 4: DESERTO
            bgm_desert_10: 'assets/sounds/desert_elite_1.mp3',
            bgm_desert_15: 'assets/sounds/desert_elite_2.mp3',
            bgm_desert_20: 'assets/sounds/desert_boss.mp3',

            // MUNDO 5: CASTELO
            bgm_castle_10: 'assets/sounds/castle_elite_1.mp3',
            bgm_castle_15: 'assets/sounds/castle_elite_2.mp3',
            bgm_castle_20: 'assets/sounds/castle_boss.mp3',
            
            // Genérico (Fallback)
            boss_theme: 'assets/sounds/boss_theme.mp3' 
        };

        for (const [key, path] of Object.entries(files)) {
            fetch(path)
                .then(response => {
                    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
                    return response.arrayBuffer();
                })
                .then(buffer => this.ctx.decodeAudioData(buffer))
                .then(audioBuffer => { this.buffers[key] = audioBuffer; })
                .catch(e => console.warn(`Áudio não encontrado: ${path}`)); 
        }
    }

    unlock() {
        if (this.unlocked) return;
        if (this.ctx.state === 'suspended') {
            this.ctx.resume().then(() => {
                this.unlocked = true;
                this.playTone(0, 'sine', 0.01); 
            });
        } else {
            this.unlocked = true;
        }
    }

    playSound(key, fallbackFn) {
        if (this.buffers[key]) {
            const source = this.ctx.createBufferSource();
            source.buffer = this.buffers[key];
            source.connect(this.masterGain);
            source.start(0);
        } else if (fallbackFn) {
            setTimeout(() => fallbackFn(), 0);
        }
    }

    playMusic(key, fallbackFn) {
        this.stopMusic(); 
        if (this.buffers[key]) {
            const source = this.ctx.createBufferSource();
            source.buffer = this.buffers[key];
            source.loop = true; 
            source.connect(this.bgmGain);
            source.start(0);
            this.bgmNode = source;
        } else if (fallbackFn) {
            this.bgmNode = fallbackFn();
        }
    }

    stopMusic() {
        if (this.bgmNode) {
            try { this.bgmNode.stop(); } catch(e) {}
            this.bgmNode = null;
        }
    }

    // --- INTERAÇÕES BÁSICAS ---
    playClick() { this.playSound('click', () => this.playTone(800, 'sine', 0.05)); }
    playBack() { this.playSound('back', () => this.playTone(200, 'triangle', 0.1)); }
    playDrag() { this.playSound('drag', () => this.playTone(600, 'sine', 0.03)); }
    playDrop() { this.playSound('drop', () => this.playTone(150, 'triangle', 0.1)); }

    // --- MÚSICA BOSS ---
    playBossMusic() {
        this.playMusic('boss_theme', () => {
            // Fallback: Drone sombrio
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            osc.type = 'sawtooth';
            osc.frequency.value = 50; 
            osc.connect(gain);
            gain.connect(this.bgmGain);
            gain.gain.value = 0.1;
            osc.start();
            return osc;
        });
    }

    // --- CLEARS NORMAL ---
    playClear(lines) {
        let key = 'clear1';
        if (lines >= 4) key = 'clear4';
        else if (lines === 3) key = 'clear3';
        else if (lines === 2) key = 'clear2';
        this.playSound(key, () => this.playTone(440, 'sine', 0.1));
    }

    // --- CLEARS BOSS (Sistema de Ataques RPG) ---
    playBossClear(lines) {
        let key = 'boss_hit_1'; // Padrão: Soco
        
        if (lines >= 4) key = 'boss_hit_4';      // Explosão
        else if (lines === 3) key = 'boss_hit_3'; // Magia
        else if (lines === 2) key = 'boss_hit_2'; // Espada

        this.playSound(key, () => {
            // Fallbacks Sintéticos (Gerados se faltar arquivo)
            if (lines >= 4) { 
                this.playNoise(0.5); // Explosão
            } else if (lines === 3) { 
                this.playTone(880, 'sawtooth', 0.3); // Magia
            } else if (lines === 2) { 
                this.playTone(600, 'triangle', 0.1); // Espada
            } else { 
                this.playTone(100, 'square', 0.1); // Soco
            }
        });
    }

    // --- VITÓRIA ---
    playVictory() {
        // Usa o clear mais forte como base se não tiver um arquivo específico
        this.playClear(4);
    }

    // --- NOVOS PODERES DE HERÓI ---
    playArrow() { this.playSound('arrow', () => this.playTone(600, 'sawtooth', 0.1)); }
    playWolf() { this.playSound('wolf', () => this.playTone(150, 'square', 0.3)); }
	playSword() { this.playSound('sword', () => this.playTone(400, 'square', 0.1)); }
	playMage() { this.playSound('mage', () => this.playTone(800, 'sine', 0.4)); } // <--- NOVO

    // --- GERADORES DE SOM (SINTETIZADOR) ---
    playTone(freq, type, duration) {
        if (!this.unlocked && this.ctx.state === 'suspended') return;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = type;
        osc.frequency.value = freq;
        osc.connect(gain);
        gain.connect(this.masterGain);
        const now = this.ctx.currentTime;
        gain.gain.setValueAtTime(0.2, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + duration);
        osc.start(now);
        osc.stop(now + duration);
    }

    playNoise(duration) {
        if (!this.unlocked && this.ctx.state === 'suspended') return;
        const bufferSize = this.ctx.sampleRate * duration;
        const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            data[i] = Math.random() * 2 - 1;
        }
        const noise = this.ctx.createBufferSource();
        noise.buffer = buffer;
        const gain = this.ctx.createGain();
        gain.connect(this.masterGain);
        noise.connect(gain);
        gain.gain.setValueAtTime(0.3, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + duration);
        noise.start();
    }

    vibrate(pattern) {
    if (!navigator.vibrate) return;

    const now = performance.now();
    if (!this._lastVibrateTime) this._lastVibrateTime = 0;

    const COOLDOWN = 120;
    if (now - this._lastVibrateTime < COOLDOWN) return;
    this._lastVibrateTime = now;

    // Limita duração máxima
    if (Array.isArray(pattern)) {
        pattern = pattern.map(v => Math.min(v, 200));
    } else {
        pattern = Math.min(pattern, 200);
    }

    navigator.vibrate(pattern);
}

}