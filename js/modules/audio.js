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
            // GAMEPLAY COMUM
            drag: 'assets/sounds/drag.mp3',
            drop: 'assets/sounds/drop.mp3',
            click: 'assets/sounds/click.mp3',
            back: 'assets/sounds/back.mp3',
            clear1: 'assets/sounds/clear_1.mp3',
            clear2: 'assets/sounds/clear_2.mp3',
            clear3: 'assets/sounds/clear_3.mp3',
            clear4: 'assets/sounds/clear_4.mp3',
            
            // BOSS (Música e Ataques)
            boss_theme: 'assets/sounds/boss_theme.mp3',
            boss_hit_1: 'assets/sounds/boss_hit_1.mp3', // Soco
            boss_hit_2: 'assets/sounds/boss_hit_2.mp3', // Espada
            boss_hit_3: 'assets/sounds/boss_hit_3.mp3', // Magia
            boss_hit_4: 'assets/sounds/boss_hit_4.mp3'  // Explosão
        };

        for (const [key, path] of Object.entries(files)) {
            fetch(path)
                .then(response => response.arrayBuffer())
                .then(buffer => this.ctx.decodeAudioData(buffer))
                .then(audioBuffer => { this.buffers[key] = audioBuffer; })
                .catch(() => {}); 
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

    // --- INTERAÇÕES ---
    playClick() { this.playSound('click', () => this.playTone(800, 'sine', 0.05)); }
    playBack() { this.playSound('back', () => this.playTone(200, 'triangle', 0.1)); }
    playDrag() { this.playSound('drag', () => this.playTone(600, 'sine', 0.03)); }
    playDrop() { this.playSound('drop', () => this.playTone(150, 'triangle', 0.1)); }

    // --- MÚSICA BOSS ---
    playBossMusic() {
        this.playMusic('boss_theme', () => {
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

    // --- CLEARS NORMAL (Escalonado Harmônico) ---
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
            if (lines >= 4) { // Explosão (Ruído Branco decaindo)
                this.playNoise(0.5);
            } else if (lines === 3) { // Magia (Vibrato rápido)
                this.playTone(880, 'sawtooth', 0.3);
            } else if (lines === 2) { // Espada (Swipe rápido agudo)
                this.playTone(600, 'triangle', 0.1);
            } else { // Soco (Batida grave)
                this.playTone(100, 'square', 0.1);
            }
        });
    }

    // Gerador de Tom Simples
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

    // Gerador de Ruído (Explosão)
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

    vibrate(pattern) { return; }
}