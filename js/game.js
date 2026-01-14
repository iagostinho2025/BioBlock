import { getRandomPiece, ITEM_STATS } from './modules/shapes.js';
import { EffectsSystem } from './modules/effects.js';
import { AudioSystem } from './modules/audio.js';
import { PowersSystem } from './modules/powers.js';
import { WORLDS, BONUS_LEVEL_CONFIG } from './modules/data/levels.js';
import { BOSS_LOGIC } from './modules/logic/bosses.js';
import { I18nSystem } from './modules/i18n.js'; // ADICIONADO: Importação do sistema de idiomas

const EMOJI_MAP = {
    // Itens Clássicos
    'bee': '🐝', 'ghost': '👻', 'cop': '👮', 'ice_shard': '💎',
    
    // Power-Ups
    'magnet': '🧲', 'rotate': '🔄', 'swap': '🔀',
    
    // Mundo Fogo
    'fire': '🔥', 'heart': '❤️‍🔥', 'collision': '💥', 'volcano': '🌋',
    
    // Adicione estes para os poderes dos Bosses funcionarem visualmente
    'stone': '🪨', 
    'coal': '⚫',
    
    // Mundo Água
    'drop': '💧', 'fish': '🐟', 'algae': '🌿',
    
    // Mundo Floresta
    'leaf': '🍃'
};

export class Game {
    constructor() {
        this.gridSize = 8;
        this.grid = Array(this.gridSize).fill().map(() => Array(this.gridSize).fill(null));
        
        // Elementos DOM
        this.screenMenu = document.getElementById('screen-menu');
        this.screenLevels = document.getElementById('screen-levels');
        this.screenStory = document.getElementById('screen-story'); 
        this.screenHeroSelect = document.getElementById('screen-hero-select'); // NOVO
		this.screenCampfire = document.getElementById('screen-campfire'); // <--- ADICIONE ISSO
        this.screenGame = document.getElementById('screen-game');
        this.screenSettings = document.getElementById('screen-settings'); 
        
        // Configurações Padrão
        this.settings = {
            music: true,
            sfx: true,
            haptics: true
        };
        this.loadSettings(); 
        
        // --- NOVO: Carrega a classe do jogador (se já escolheu) ---
        this.playerClass = localStorage.getItem('blocklands_player_class') || null; 

        this.boardEl = document.getElementById('game-board');
        this.dockEl = document.getElementById('dock');
        this.goalsArea = document.getElementById('goals-area');
        this.modalOver = document.getElementById('modal-gameover');
        this.modalWin = document.getElementById('modal-victory');
        this.scoreOverEl = document.getElementById('score-final');
        this.scoreWinEl = document.getElementById('score-victory');
        this.comboState = { count: 0, lastClearTime: 0 };
        this.assetsLoaded = false; 

        // Estado do Jogo
        this.currentMode = 'casual'; 
        this.currentLevelConfig = null;
        this.currentHand = []; 
        this.bossState = { active: false, maxHp: 0, currentHp: 0, attackRate: 3, movesWithoutDamage: 0 };
        
        this.currentGoals = {}; 
        this.collected = {};
        this.score = 0;
        this.activeSnap = null; 
        this.i18n = new I18nSystem(); 
        this.preloadAssets();
        
        // Power-Ups
        this.powerUps = { bomb: 0, rotate: 0, swap: 0 };
        this.interactionMode = null; 
        
        // Sistemas
        this.effects = new EffectsSystem();
        this.audio = new AudioSystem();
        this.powers = new PowersSystem(this);
        this.maxUnlockedLevel = 99; 
        
        // Controle da História
        this.storyStep = 0; // Para controlar os slides

        this.setupMenuEvents();
        this.startLoadingSequence();
    }
	
	// --- PERSISTÊNCIA DE ESTADO (SAVE GAME) ---

    saveGameState() {
        // Só salvamos no modo aventura para evitar conflitos
        if (this.currentMode !== 'adventure' || !this.currentLevelConfig) return;

        // Monta o objeto de estado
        const state = {
            levelId: this.currentLevelConfig.id,
            grid: this.grid,
            score: this.score,
            hand: this.currentHand,
            bossState: this.bossState,
            heroState: this.heroState,
            currentGoals: this.currentGoals,
            collected: this.collected,
            comboState: this.comboState,
            powerUps: this.powerUps // Salva qtd de powerups atual
        };

        try {
            localStorage.setItem('blocklands_savestate', JSON.stringify(state));
        } catch (e) {
            console.warn('Falha ao salvar jogo:', e);
        }
    }
	
	// --- NOVO SISTEMA DE HISTÓRIA E SELEÇÃO ---

    checkAdventureIntro() {
        // Verifica se já existe uma classe salva (Guerreiro ou Maga)
        const savedClass = localStorage.getItem('blocklands_player_class');
        
        if (savedClass) {
            // Se já tem personagem, PULA TUDO e vai direto para o Mapa
            this.showWorldSelect();
        } else {
            // Se não tem (primeira vez ou resetou), começa a jornada
            this.playStory();
        }
    }
	showCampfireScene() {
        const screen = document.getElementById('screen-campfire');
        const textEl = document.getElementById('campfire-text');
        const btnTextEl = document.getElementById('campfire-btn-text');
        
        if (!screen) return;

        const bgImage = (this.playerClass === 'warrior') 
            ? 'assets/img/bg_campfire_warrior.webp' 
            : 'assets/img/bg_campfire_mage.webp';
        
        screen.style.backgroundImage = `url('${bgImage}')`;

        if (textEl) textEl.innerHTML = this.i18n.t('campfire.text').replace(/\*\*(.*?)\*\*/g, '<strong style="color:#fbbf24">$1</strong>');
        if (btnTextEl) btnTextEl.innerText = this.i18n.t('campfire.btn_start');

        this.showScreen(screen);
        this.toggleGlobalHeader(false);

        const btnStart = document.getElementById('btn-start-boss');
        if (btnStart) {
            const newBtn = btnStart.cloneNode(true);
            btnStart.parentNode.replaceChild(newBtn, btnStart);
            
            newBtn.addEventListener('click', () => {
                if(this.audio) {
                    this.audio.playClick();
                    this.audio.playTone(100, 'sawtooth', 0.5); 
                }

                // MUDANÇA AQUI: Vai para o MAPA, onde a mãozinha vai guiar
                this.showWorldSelect(); 
            });
        }
    }

    playStory() {
        this.showScreen(this.screenStory);
        this.toggleGlobalHeader(false);
        this.storyStep = 0;
        this.renderStorySlide();

        // Configura botões da tela de história (caso não tenham sido configurados no setupMenuEvents)
        // Dica: Idealmente mova esses listeners para setupMenuEvents, mas aqui garante que funcione agora
        const btnNext = document.getElementById('btn-next-slide');
        const btnSkip = document.getElementById('btn-skip-story');
        
        // Remove listeners antigos para evitar duplicação (cloneNode trick)
        if(btnNext) {
            const newNext = btnNext.cloneNode(true);
            btnNext.parentNode.replaceChild(newNext, btnNext);
            newNext.onclick = () => {
                if(this.audio) this.audio.playClick();
                this.storyStep++;
                this.renderStorySlide();
            };
        }

        if(btnSkip) {
            const newSkip = btnSkip.cloneNode(true);
            btnSkip.parentNode.replaceChild(newSkip, btnSkip);
            newSkip.onclick = () => {
                if(this.audio) this.audio.playClick();
                this.showHeroSelection();
            };
        }
    }

    renderStorySlide() {
        const textEl = document.getElementById('story-text');
        const imgEl = document.getElementById('story-reaction-img');
        
        if (!textEl || !imgEl) return;

        // Roteiro de Textos
        const slidesTxt = [
            this.i18n.t('story_slides.1'),
            this.i18n.t('story_slides.2'),
            this.i18n.t('story_slides.3'),
            this.i18n.t('story_slides.4'),
            this.i18n.t('story_slides.5'),
            this.i18n.t('story_slides.6')
        ];

        // Mapeamento de Imagens
        const slidesImg = [
            'assets/img/thalion_story_1.png',
            'assets/img/thalion_story_2.png',
            'assets/img/thalion_story_3.png',
            'assets/img/thalion_story_4.png',
            'assets/img/thalion_story_5.png',
            'assets/img/thalion_story_6.png'
        ];

        if (this.storyStep < slidesTxt.length) {
            // Lógica de exibição (mantida igual)
            textEl.style.opacity = 0;
            imgEl.style.opacity = 0;

            setTimeout(() => {
                textEl.innerText = slidesTxt[this.storyStep];
                if (slidesImg[this.storyStep]) {
                    imgEl.src = slidesImg[this.storyStep];
                }
                requestAnimationFrame(() => {
                    textEl.style.opacity = 1;
                    imgEl.style.opacity = 1;
                });
            }, 200);

        } else {
            // --- MUDANÇA AQUI: O que fazer ao fim da história? ---
            const savedClass = localStorage.getItem('blocklands_player_class');
            
            if (savedClass) {
                // Se já tem classe (está apenas revendo a história), volta pro Mapa
                this.showWorldSelect();
            } else {
                // Se NÃO tem classe (primeira vez), vai para a Seleção
                this.showHeroSelection();
            }
        }
    }

    showHeroSelection() {
        this.showScreen(this.screenHeroSelect);
        this.toggleGlobalHeader(false);
    }

    selectHero(heroId) {
        if(this.audio) {
            this.audio.playClick();
            if (heroId === 'warrior') this.audio.playSword(); 
            if (heroId === 'mage') this.audio.playMage();
        }

        // Salva a escolha
        this.playerClass = heroId;
        localStorage.setItem('blocklands_player_class', heroId);

        // Feedback visual no card
        const card = document.getElementById(`card-${heroId}`);
        if(card) {
            card.style.transform = 'scale(1.05)';
            card.style.borderColor = '#fbbf24';
            card.style.boxShadow = '0 0 30px rgba(251, 191, 36, 0.4)';
        }

        // Aguarda 800ms (tempo de ver o card brilhar) e inicia a transição fake
        setTimeout(() => {
            this.runHeroTransition(heroId);
        }, 800);
    }
	
	runHeroTransition(heroId) {
        const screen = document.getElementById('loading-screen');
        const bar = document.getElementById('loading-bar-fill');
        const text = document.getElementById('loading-text');

        if (!screen || !bar) return;

        // 1. Prepara a tela (Reseta o estado anterior)
        screen.classList.remove('fade-out');
        screen.style.display = 'flex';
        screen.style.opacity = '1';
        bar.style.width = '0%';

        // 2. Define os textos baseados na classe
        const msg1 = (heroId === 'warrior') ? this.i18n.t('hero_loading.warrior_1') : this.i18n.t('hero_loading.mage_1');
        const msg2 = (heroId === 'warrior') ? this.i18n.t('hero_loading.warrior_2') : this.i18n.t('hero_loading.mage_2');
        const msgFinal = this.i18n.t('hero_loading.common');

        if(text) text.innerText = msg1;

        // 3. Animação Fake (Barra enchendo)
        let progress = 0;
        const duration = 2500; // 2.5 segundos de "loading"
        const intervalTime = 30;
        const steps = duration / intervalTime;
        const increment = 100 / steps;

        const interval = setInterval(() => {
            progress += increment;
            
            // Variação orgânica na velocidade (dá uma travadinha nos 70% pra parecer real)
            if (progress > 70 && progress < 80) progress -= (increment * 0.5); 

            // Atualiza visual
            bar.style.width = Math.min(progress, 100) + '%';

            // Troca de texto em 40% e 80%
            if (progress > 40 && progress < 80 && text) text.innerText = msg2;
            if (progress >= 80 && text) text.innerText = msgFinal;

            // FIM DO LOADING
            if (progress >= 100) {
                clearInterval(interval);
                bar.style.width = '100%';
                
                // Pequeno delay final antes de sumir
                setTimeout(() => {
                    // Inicia o nível de verdade (por trás da cortina)
                    const tutorialWorld = WORLDS.find(w => w.id === 'tutorial_world');
                    if (tutorialWorld) {
                        const tutorialLevel = tutorialWorld.levels[0];
                        this.showCampfireScene();
                    }

                    // Fade out da tela de loading
                    screen.classList.add('fade-out');
                    setTimeout(() => {
                        screen.style.display = 'none';
                    }, 800);

                }, 500);
            }
        }, intervalTime);
    }

    restoreGameState(targetLevelId) {
        const raw = localStorage.getItem('blocklands_savestate');
        if (!raw) return false;

        try {
            const state = JSON.parse(raw);
            
            // Segurança: Só carrega se o save for do mesmo nível que estamos tentando abrir
            if (state.levelId !== targetLevelId) return false;

            // Restaura os dados
            this.grid = state.grid;
            this.score = state.score;
            this.currentHand = state.hand;
            this.bossState = state.bossState;
            this.heroState = state.heroState;
            this.currentGoals = state.currentGoals;
            this.collected = state.collected;
            this.comboState = state.comboState || { count: 0, lastClearTime: 0 };
            
            // Recarrega Powerups (caso tenha gasto e não atualizado)
            if (state.powerUps) {
                this.powerUps = state.powerUps;
                this.savePowerUps(); // Sincroniza com o storage de powerups global
            }

            // Atualiza a UI Visualmente
            this.renderGrid();
            this.renderDock();
            this.renderControlsUI(); // Atualiza botões de herói/powerup

            if (this.bossState.active) {
                this.setupBossUI(this.currentLevelConfig.boss); // Recria a estrutura HTML
                this.updateBossUI(); // Atualiza a vida
            } else {
                this.setupGoalsUI(this.currentGoals); // Recria estrutura
                this.updateGoalsUI(); // Atualiza números
            }

            // Se for fase normal, temos que garantir que a UI de gols reflete o coletado
            if (!this.bossState.active) {
                this.updateGoalsUI();
            }

            return true; // Sucesso
        } catch (e) {
            console.error('Erro ao carregar save:', e);
            return false;
        }
    }

    clearSavedGame() {
        localStorage.removeItem('blocklands_savestate');
    }

    loadSettings() {
        const saved = localStorage.getItem('blocklands_settings');
        if (saved) {
            this.settings = JSON.parse(saved);
        }
        this.applySettings();
    }

    saveSettings() {
        localStorage.setItem('blocklands_settings', JSON.stringify(this.settings));
        this.applySettings();
    }

    applySettings() {
        // Aplica Áudio (Se o AudioSystem estiver pronto)
        if (this.audio) {
            // Se música off -> volume 0. Se on -> volume 0.3 (padrão do audio.js)
            if (this.audio.bgmGain) {
                this.audio.bgmGain.gain.value = this.settings.music ? 0.3 : 0;
            }
            if (this.audio.masterGain) {
                this.audio.masterGain.gain.value = this.settings.sfx ? 0.5 : 0;
            }
        }
        // A vibração é checada na hora de usar (this.audio.vibrate)
    }

    loadProgress() {
        const saved = localStorage.getItem('blocklands_progress_main');
        return saved ? parseInt(saved) : 0; 
    }

    saveProgress(levelId) {
        const currentSaved = this.loadProgress();
        if (levelId > currentSaved) {
            localStorage.setItem('blocklands_progress_main', levelId);
        }
    }
	
	// Adicione logo após o constructor ou antes do start()
    // --- CARREGAMENTO REAL (FUNCIONAL) ---
    async preloadAssets() {
        // ADICIONADO: Carrega idiomas antes de tudo
        await this.i18n.init();
        
        // Lista de imagens CRÍTICAS para a primeira impressão
        const imagesToLoad = [
            'assets/img/bg_world_select.webp',    // A imagem que estava faltando!
            'assets/img/map_volcano.jpg',        // Mapa do jogo
            'assets/img/icon_world_tutorial.jpg',
            'assets/img/icon_world_fire.jpg',
			'assets/img/icon_world_forest.jpg',
			'assets/img/icon_world_desert.jpg',
			'assets/img/icon_world_castle.jpg',
			'assets/img/icon_world_mountain.jpg',
            // Adicione outras pesadas aqui se precisar
        ];

        const promises = imagesToLoad.map(src => {
            return new Promise((resolve, reject) => {
                const img = new Image();
                img.src = src;
                // Se carregar ou der erro, libera (para não travar o jogo eternamente)
                img.onload = () => resolve(src);
                img.onerror = () => {
                    console.warn(`Falha ao carregar: ${src}`);
                    resolve(src); // Resolve mesmo com erro para continuar
                };
            });
        });

        // Espera todas as promessas resolverem
        await Promise.all(promises);
        
        // Marca como concluído
        this.assetsLoaded = true;
        console.log("Assets carregados!");
    }
    
    // --- Carregar PowerUps ---
    loadPowerUps() {
        this.powerUps.magnet = parseInt(localStorage.getItem('powerup_magnet') || '0'); // Novo
        this.powerUps.rotate = parseInt(localStorage.getItem('powerup_rotate') || '0');
        this.powerUps.swap = parseInt(localStorage.getItem('powerup_swap') || '0');
        this.updateControlsVisuals();
    }

    savePowerUps() {
        localStorage.setItem('powerup_magnet', this.powerUps.magnet); // Novo
        localStorage.setItem('powerup_rotate', this.powerUps.rotate);
        localStorage.setItem('powerup_swap', this.powerUps.swap);
        this.updateControlsVisuals();
    }
	
	// --- SEQUÊNCIA VISUAL INTELIGENTE ---
    startLoadingSequence() {
        const bar = document.getElementById('loading-bar-fill');
        const text = document.getElementById('loading-text');
        const screen = document.getElementById('loading-screen');
        
        if (!bar || !screen) return;

        // Fases visuais para entreter o jogador
        // ATUALIZADO: Usando this.i18n.t() para traduzir as mensagens
        const messages = [
            this.i18n.t('loading.connecting'),
            this.i18n.t('loading.polishing'),
            this.i18n.t('loading.mapping'),
            this.i18n.t('loading.summoning'),
            this.i18n.t('loading.finalizing')
        ];

        let visualPct = 0; // Porcentagem visual atual

        const updateLoop = () => {
            // Se já carregou tudo (Real) e a barra já passou de 80%, acelera para o fim
            if (this.assetsLoaded && visualPct >= 80) {
                visualPct += 5; // Vai rápido até 100
            } 
            // Se ainda não carregou, avança devagar até travar em 85%
            else if (!this.assetsLoaded && visualPct < 85) {
                visualPct += (Math.random() * 2); // Avanço lento e orgânico
            }
            // Se já carregou mas a barra ainda está no começo, avança normal
            else if (this.assetsLoaded && visualPct < 80) {
                visualPct += 3; // Avanço médio
            }

            // Trava visual (Cap) em 100%
            if (visualPct > 100) visualPct = 100;

            // Atualiza a Barra
            bar.style.width = visualPct + '%';
            
            // Atualiza Texto baseado no progresso
            const msgIndex = Math.min(Math.floor((visualPct / 100) * messages.length), messages.length - 1);
            if(text) text.innerText = messages[msgIndex];

            // VERIFICAÇÃO DE FIM
            if (visualPct >= 100) {
                // Só termina se o visual chegou em 100 E os assets reais terminaram
                if (this.assetsLoaded) {
                    setTimeout(() => {
                        screen.classList.add('fade-out');
                        setTimeout(() => {
                            screen.style.display = 'none';
                        }, 800);
                    }, 200);
                } else {
                    // Se visual chegou em 100 mas assets não (raro, mas possível), espera
                    requestAnimationFrame(updateLoop);
                }
            } else {
                // Continua o loop
                requestAnimationFrame(updateLoop);
            }
        };

        // Inicia o loop
        requestAnimationFrame(updateLoop);
    }

    setupMenuEvents() {
        // Unlock de Áudio
        const unlockAudioOnce = () => {
            if (this.audio && this.audio.unlock) {
                this.audio.unlock();
            }
            document.removeEventListener('click', unlockAudioOnce);
            document.removeEventListener('touchstart', unlockAudioOnce);
        };
        document.addEventListener('click', unlockAudioOnce);
        document.addEventListener('touchstart', unlockAudioOnce);
        
        const bindClick = (id, action) => {
            const el = document.getElementById(id);
            if(el) {
                // Remove listeners antigos para evitar duplicação se o setup rodar 2x
                const newEl = el.cloneNode(true); 
                el.parentNode.replaceChild(newEl, el);
                
                newEl.addEventListener('click', (e) => {
                    if (this.audio) this.audio.playClick();
                    action(e);
                });
            }
        };

        // Navegação Principal
        bindClick('btn-mode-casual', () => this.startCasualMode());
        bindClick('btn-mode-adventure', () => this.checkAdventureIntro()); 
        bindClick('btn-mode-blitz', () => alert(this.i18n.t('menu.blitz_coming_soon')));
        bindClick('btn-back-menu', () => this.showScreen(this.screenMenu));
        bindClick('btn-quit-game', () => this.showScreen(this.screenMenu));
        
        // --- NOVOS BOTÕES DA HISTÓRIA (Agora configurados aqui para sempre funcionarem) ---
        bindClick('btn-next-slide', () => {
            this.storyStep++;
            this.renderStorySlide();
        });

        bindClick('btn-skip-story', () => {
            const savedClass = localStorage.getItem('blocklands_player_class');
            if (savedClass) {
                this.showWorldSelect(); // Já tem herói? Mapa.
            } else {
                this.showHeroSelection(); // Não tem? Seleção.
            }
        });

        bindClick('btn-start-adventure', () => {
            localStorage.setItem('blocklands_intro_seen', 'true');
            this.showWorldSelect();
        });
        // -------------------------------------------------------------------------------

        // Botões de Game Over / Vitória
        bindClick('btn-restart-over', () => this.retryGame());
        
        bindClick('btn-quit-game', () => {
            // Para a música ao sair
            if(this.audio) this.audio.stopMusic();

            if (this.currentMode === 'adventure') {
                // Identifica em qual mundo estamos baseado na fase atual
                const currentWorld = WORLDS.find(w => w.levels.some(l => l.id === this.currentLevelConfig?.id));
                
                // Se achou o mundo E NÃO É O TUTORIAL (que não tem mapa interno)
                if (currentWorld && currentWorld.id !== 'tutorial_world') {
                    this.showScreen(this.screenLevels); // Garante que o container apareça
                    this.openWorldMap(currentWorld);    // Abre o mapa do mundo (Fogo, Floresta, etc)
                } else {
                    // Se for Tutorial (Guardião) ou erro, volta para a Seleção de Mundos
                    this.showWorldSelect();
                }
            } else {
                // Modo Casual: Volta para o Menu Principal
                this.showScreen(this.screenMenu);
            }
        });
        
        // Power-Ups
        bindClick('pwr-bomb', () => this.activatePowerUp('bomb'));
        bindClick('pwr-rotate', () => this.activatePowerUp('rotate'));
        bindClick('pwr-swap', () => this.activatePowerUp('swap'));
        
        // Lógica de Vitória (Continuar/Voltar)
        const btnNextLevel = document.getElementById('btn-next-level');
        if (btnNextLevel) {
            const newBtn = btnNextLevel.cloneNode(true);
            btnNextLevel.parentNode.replaceChild(newBtn, btnNextLevel);
            newBtn.addEventListener('click', () => {
                if(this.audio) this.audio.playClick();
                this.modalWin.classList.add('hidden');
                
                if(this.currentMode === 'adventure') {
                    const currentWorld = WORLDS.find(w => w.levels.some(l => l.id === this.currentLevelConfig?.id));
                    if (currentWorld) {
                        this.showScreen(this.screenLevels);
                        this.openWorldMap(currentWorld);
                    } else {
                        this.showWorldSelect();
                    }
                } else {
                    this.retryGame(); 
                }
            });
        }

        const btnVictoryBack = document.getElementById('btn-victory-back');
        if (btnVictoryBack) {
            const newBtn = btnVictoryBack.cloneNode(true);
            btnVictoryBack.parentNode.replaceChild(newBtn, btnVictoryBack);
            newBtn.addEventListener('click', () => {
                if(this.audio) this.audio.playBack();
                this.modalWin.classList.add('hidden');
                if (this.currentMode === 'adventure') {
                    this.showScreen(this.screenLevels);
                    const currentWorld = WORLDS.find(w => w.levels.some(l => l.id === this.currentLevelConfig?.id));
                    if (currentWorld) this.openWorldMap(currentWorld);
                    else this.showWorldSelect();
                } else {
                    this.showScreen(this.screenMenu);
                }
            });
        }

        // Idioma e Sidebar
        const btnEn = document.getElementById('btn-lang-en');
        const btnPt = document.getElementById('btn-lang-pt');
        const updateLangUI = () => {
            if(btnEn && btnPt) {
                btnEn.style.background = (this.i18n.currentLang === 'en') ? '#fbbf24' : 'rgba(255,255,255,0.1)';
                btnEn.style.color = (this.i18n.currentLang === 'en') ? '#000' : '#fff';
                btnPt.style.background = (this.i18n.currentLang === 'pt-BR') ? '#fbbf24' : 'rgba(255,255,255,0.1)';
                btnPt.style.color = (this.i18n.currentLang === 'pt-BR') ? '#000' : '#fff';
            }
        };
        updateLangUI(); 

        if(btnEn) btnEn.addEventListener('click', async () => {
            if(this.audio) this.audio.playClick();
            await this.i18n.changeLanguage('en');
            updateLangUI();
            if (this.screenLevels.classList.contains('active-screen')) this.showWorldSelect();
        });

        if(btnPt) btnPt.addEventListener('click', async () => {
            if(this.audio) this.audio.playClick();
            await this.i18n.changeLanguage('pt-BR');
            updateLangUI();
            if (this.screenLevels.classList.contains('active-screen')) this.showWorldSelect();
        });

        // Sidebar Toggles
        const btnOpen = document.getElementById('btn-open-sidebar');
        const sidebar = document.getElementById('app-sidebar');
        const overlay = document.getElementById('menu-overlay');
        const btnClose = document.getElementById('btn-close-sidebar');
        const toggleSidebar = (show) => {
            if(show) { sidebar.classList.add('open'); overlay.classList.remove('hidden'); setTimeout(()=>overlay.classList.add('visible'),10); }
            else { sidebar.classList.remove('open'); overlay.classList.remove('visible'); setTimeout(()=>overlay.classList.add('hidden'),300); }
        };
        if(btnOpen) btnOpen.addEventListener('click', () => { if(this.audio) this.audio.playClick(); toggleSidebar(true); });
        if(btnClose) btnClose.addEventListener('click', () => { if(this.audio) this.audio.playBack(); toggleSidebar(false); });
        if(overlay) overlay.addEventListener('click', () => { if(this.audio) this.audio.playBack(); toggleSidebar(false); });
        
        this.setupSettingsLogic();

        const btnSettings = document.querySelector('.sidebar-item span[data-i18n="sidebar.settings"]')?.parentNode;
        if (btnSettings) {
            btnSettings.addEventListener('click', () => {
                if(this.audio) this.audio.playClick();
                toggleSidebar(false);
                this.showScreen(this.screenSettings);
            });
        }
    }

    // --- NOVO: Lógica da tela de configurações ---
    setupSettingsLogic() {
        // Elementos da UI
        const toggleMusic = document.getElementById('toggle-music');
        const toggleSfx = document.getElementById('toggle-sfx');
        const toggleHaptics = document.getElementById('toggle-haptics');
        const btnReset = document.getElementById('btn-reset-progress');
        const btnBack = document.getElementById('btn-settings-back');
        const btnLangEn = document.getElementById('btn-lang-en');
        const btnLangPt = document.getElementById('btn-lang-pt');

        // 1. Sincroniza UI com Estado Atual
        if(toggleMusic) toggleMusic.checked = this.settings.music;
        if(toggleSfx) toggleSfx.checked = this.settings.sfx;
        if(toggleHaptics) toggleHaptics.checked = this.settings.haptics;

        // 2. Eventos dos Toggles
        if(toggleMusic) toggleMusic.addEventListener('change', (e) => {
            this.settings.music = e.target.checked;
            this.saveSettings();
        });
        if(toggleSfx) toggleSfx.addEventListener('change', (e) => {
            this.settings.sfx = e.target.checked;
            this.saveSettings();
        });
        if(toggleHaptics) toggleHaptics.addEventListener('change', (e) => {
            this.settings.haptics = e.target.checked;
            this.saveSettings();
            if (this.settings.haptics && this.audio) this.audio.vibrate(50);
        });

        // 3. Resetar Progresso
        if(btnReset) btnReset.addEventListener('click', () => {
            if (confirm(this.i18n.t('settings.reset_confirm'))) {
                localStorage.clear(); // Limpa tudo
                location.reload();    // Recarrega o jogo do zero
            }
        });

        // 4. Navegação (Voltar)
        if(btnBack) btnBack.addEventListener('click', () => {
            if(this.audio) this.audio.playBack();
            this.showScreen(this.screenMenu);
        });

        // 5. Botões de Idioma (Lógica migrada)
        const updateLangVisuals = () => {
            if (this.i18n.currentLang === 'en') {
                btnLangEn?.classList.add('active');
                btnLangPt?.classList.remove('active');
            } else {
                btnLangPt?.classList.add('active');
                btnLangEn?.classList.remove('active');
            }
        };
        updateLangVisuals(); // Roda ao abrir

        if(btnLangEn) btnLangEn.addEventListener('click', async () => {
            if(this.audio) this.audio.playClick();
            await this.i18n.changeLanguage('en');
            updateLangVisuals();
        });

        if(btnLangPt) btnLangPt.addEventListener('click', async () => {
            if(this.audio) this.audio.playClick();
            await this.i18n.changeLanguage('pt-BR');
            updateLangVisuals();
        });
    }

    // --- NOVO: Verifica se o jogador já viu a intro ---
    checkAdventureIntro() {
        const hasSeen = localStorage.getItem('blocklands_intro_seen');
        
        if (hasSeen === 'true') {
            // Se já viu, vai direto para o mapa
            this.showWorldSelect();
        } else {
            // Se é a primeira vez, mostra a história
            this.playStory();
        }
    }

    // --- NOVO: Exibe a tela de história ---
    playStory() {
        this.showScreen(this.screenStory);
        this.toggleGlobalHeader(false); // Esconde o header de moedas/nível para imersão
        this.storyStep = 0;
        this.renderStorySlide();
        
        // NOTA: Os eventos dos botões btn-next-slide e btn-skip-story
        // agora são gerenciados no setupMenuEvents, evitando bugs de recriação.
    }

    // --- POWER-UP LOGIC ---

    updatePowerUpsUI() {
        ['bomb', 'rotate', 'swap'].forEach(type => {
            const btn = document.getElementById(`pwr-${type}`);
            if(!btn) return;
            
            const count = this.powerUps[type];
            btn.querySelector('.pwr-count').innerText = `${count}/3`;
            
            btn.classList.remove('active-mode');

            if (count <= 0) {
                btn.classList.add('disabled');
            } else {
                btn.classList.remove('disabled');
            }
            
            if (this.interactionMode === type) {
                btn.classList.add('active-mode');
            }
        });
    }

    activatePowerUp(type) {
        if (this.powerUps[type] <= 0) {
            if(this.audio) this.audio.vibrate(50); 
            return;
        }
        if (this.interactionMode === type) {
            this.interactionMode = null;
            this.updateControlsVisuals();
            return;
        }
        // Swap é imediato
        if (type === 'swap') {
            if(this.audio) this.audio.playClick(); 
            this.powerUps.swap--;
            this.savePowerUps();
            this.spawnNewHand(); 
            this.effects.shakeScreen();
            this.renderControlsUI();
            return;
        }
        // Ativa modo
        this.interactionMode = type;
        if(this.audio) this.audio.playClick();
        this.updateControlsVisuals();
    }
	
	renderControlsUI() {
        const oldPwr = document.getElementById('powerups-area');
        if (oldPwr) oldPwr.style.display = 'none';
        const oldHeroes = document.getElementById('hero-powers-area');
        if (oldHeroes) oldHeroes.remove();
        
        let controlsContainer = document.getElementById('controls-bar');
        
        if (!controlsContainer) {
            controlsContainer = document.createElement('div');
            controlsContainer.id = 'controls-bar';
            controlsContainer.className = 'controls-bar';
            if (this.dockEl && this.dockEl.parentNode) {
                this.dockEl.parentNode.insertBefore(controlsContainer, this.dockEl.nextSibling);
            }
        }
        controlsContainer.innerHTML = '';

        // GRUPO ESQUERDA: Itens
        const leftGroup = document.createElement('div');
        leftGroup.className = 'controls-group';
        
        [{ id: 'magnet', icon: '🧲' }, { id: 'rotate', icon: '🔄' }, { id: 'swap', icon: '🔀' }].forEach(p => {
            const btn = document.createElement('button');
            btn.className = `ctrl-btn pwr-${p.id}`;
            btn.id = `btn-pwr-${p.id}`;
            const count = this.powerUps[p.id] || 0;
            btn.innerHTML = `${p.icon}<span class="ctrl-count">${count}</span>`;
            
            if (count <= 0) btn.classList.add('disabled');
            btn.onclick = () => this.activatePowerUp(p.id);
            leftGroup.appendChild(btn);
        });

        // GRUPO DIREITA: Heróis
        const rightGroup = document.createElement('div');
        rightGroup.className = 'controls-group';

        if (this.currentMode === 'adventure') {
            // Lista base de companheiros
            const heroes = [
                { id: 'thalion', icon: '🧝‍♂️' }, 
                { id: 'nyx',     icon: '🐺' }
            ];

            // Adiciona APENAS o herói escolhido pelo jogador
            if (this.playerClass === 'mage') {
                heroes.push({ id: 'mage', icon: '🧙‍♀️' });
            } else {
                // Padrão é guerreiro se não tiver classe (ou se for warrior)
                heroes.push({ id: 'player', icon: '⚔️' });
            }

            heroes.forEach(h => {
                const btn = document.createElement('div');
                btn.className = 'ctrl-btn hero locked';
                btn.id = `btn-hero-${h.id}`;
                btn.innerHTML = `${h.icon}`;
                btn.onclick = () => this.activateHeroPower(h.id);
                rightGroup.appendChild(btn);
            });
        }

        controlsContainer.appendChild(leftGroup);
        controlsContainer.appendChild(rightGroup);
        this.updateControlsVisuals();
    }

    updateControlsVisuals() {
        // PowerUps (AGORA COM MAGNET)
        ['magnet', 'rotate', 'swap'].forEach(id => {
            const btn = document.getElementById(`btn-pwr-${id}`);
            if(!btn) return;
            btn.classList.remove('active-mode');
            const count = this.powerUps[id];
            btn.querySelector('.ctrl-count').innerText = count;
            if(count <= 0) btn.classList.add('disabled');
            else btn.classList.remove('disabled');
            if(this.interactionMode === id) btn.classList.add('active-mode');
        });

        // Heróis
        if (this.currentMode === 'adventure' && this.heroState) {
            ['thalion', 'nyx', 'player','mage'].forEach(id => {
                const btn = document.getElementById(`btn-hero-${id}`);
                if(!btn) return;
                btn.className = 'ctrl-btn hero'; 
                const state = this.heroState[id];
                
                if (state.used) btn.classList.add('used');
                else if (state.unlocked) btn.classList.add('ready');
                else btn.classList.add('locked');
                
                if (this.interactionMode === `hero_${id}`) btn.classList.add('active-mode');
            });
        }
    }
	

    handleBoardClick(r, c) {
        // Se houver um modo de interação ativo (Bomba, Heróis), delega para o sistema de poderes
        if (this.interactionMode) {
            this.powers.handleBoardInteraction(this.interactionMode, r, c);
            return;
        }

        // Se não tiver interação, aqui ficaria lógica de clique normal (se houver no futuro)
    }

    handlePieceClick(index) {
        if (this.interactionMode === 'rotate') {
            this.powers.useRotate(index);
        }
    }

    
    renderDock() {
        this.dockEl.innerHTML = '';
        this.currentHand.forEach((piece, index) => {
            const slot = document.createElement('div');
            slot.classList.add('dock-slot');
            if (piece) this.createDraggablePiece(piece, index, slot);
            this.dockEl.appendChild(slot);
        });
    }

    // --- GERENCIAMENTO DE TELAS ---
    showScreen(screenEl) {
        if (this.screenGame.classList.contains('active-screen')) {
            if(this.audio) this.audio.stopMusic();
        }
        
        // Adicione this.screenHeroSelect à lista de telas para esconder
        [this.screenMenu, this.screenLevels, this.screenStory, this.screenGame, this.screenSettings, this.screenHeroSelect, this.screenCampfire].forEach(s => {
            if(s) {
                s.classList.remove('active-screen');
                s.classList.add('hidden');
            }
        });
        
        if (screenEl === this.screenMenu) {
            this.toggleGlobalHeader(false); 
        } else {
            // A tela de seleção e história também escondem o header
            if (screenEl === this.screenStory || screenEl === this.screenHeroSelect || screenEl === this.screenCampfire) {
                this.toggleGlobalHeader(false);
            } else {
                this.toggleGlobalHeader(true);
            }
        }

        if(screenEl) {
            screenEl.classList.remove('hidden');
            screenEl.classList.add('active-screen');
        }
    }

    toggleGlobalHeader(show) {
        const levelHeader = document.querySelector('.level-header');
        if (levelHeader) {
            if (show) levelHeader.classList.remove('hidden-header');
            else levelHeader.classList.add('hidden-header');
        }
    }

    // --- MUNDOS E NÍVEIS ---

    showWorldSelect() {
        const container = document.getElementById('levels-container');
        
        if (container) {
            container.style = ''; 
            container.style.backgroundImage = "url('assets/img/bg_world_select.webp')";
            container.className = 'world-select-layout';
        }

        this.showScreen(this.screenLevels); 
        this.toggleGlobalHeader(false); 

        if(!container) return;

        // 1. INSERE OS BOTÕES PADRONIZADOS (AAA)
        container.innerHTML = `
            <div class="buttons-sticky-header">
                <button id="btn-world-back-internal" class="btn-aaa-back pos-absolute-top-left">
                    <svg viewBox="0 0 24 24"><path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z"/></svg>
                </button>
                
                <button id="btn-replay-story" class="btn-aaa-back" style="position: absolute; top: 20px; right: 20px;">
                    <svg viewBox="0 0 24 24"><path d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z"/></svg>
                </button>
            </div>
            <div class="worlds-grid" id="worlds-grid"></div>
        `;

        // 2. CONFIGURA EVENTOS (Simplificado para evitar bugs)
        const backBtn = document.getElementById('btn-world-back-internal');
        if (backBtn) {
            backBtn.onclick = (e) => {
                e.preventDefault(); // Previne comportamentos estranhos
                if(this.audio) this.audio.playBack();
                container.className = '';
                container.style.backgroundImage = ''; 
                this.showScreen(this.screenMenu);
            };
        }
        
        const replayBtn = document.getElementById('btn-replay-story');
        if (replayBtn) {
            replayBtn.onclick = () => {
                if(this.audio) this.audio.playClick();
                this.playStory(); 
            };
        }

        // 3. RENDERIZA OS MUNDOS (Código original mantido)
        const grid = document.getElementById('worlds-grid');
        const currentSave = this.loadProgress(); 

        const worldImages = {
            'tutorial_world': 'assets/img/icon_world_tutorial.jpg',
            'fire_world':     'assets/img/icon_world_fire.jpg',
            'forest_world':   'assets/img/icon_world_forest.jpg',
            'mountain_world': 'assets/img/icon_world_mountain.jpg',
            'desert_world':   'assets/img/icon_world_desert.jpg',
            'castle_world':   'assets/img/icon_world_castle.jpg'
        };

        WORLDS.forEach((world) => {
            const worldItem = document.createElement('div');
            worldItem.style.position = 'absolute';
            const pos = world.worldPos || { x: 50, y: 50 };
            worldItem.style.left = pos.x + '%';
            worldItem.style.top = pos.y + '%';
            worldItem.style.transform = 'translate(-50%, -50%)';
            worldItem.style.display = 'flex';
            worldItem.style.flexDirection = 'column';
            worldItem.style.alignItems = 'center';
            worldItem.style.zIndex = '10';

            let firstLevelId = world.levels[0].id;
            const isLocked = currentSave < firstLevelId;

            if (world.id === 'tutorial_world' && currentSave === 0) {
                const hand = document.createElement('div');
                hand.className = 'tutorial-hand';
                hand.innerHTML = '👆'; 
                worldItem.appendChild(hand);
            }

            const img = document.createElement('img');
            img.src = worldImages[world.id] || 'assets/img/icon_world_fire.jpg';
            img.alt = world.name;
            img.className = 'world-card-image';
            if (world.worldSize) img.style.width = world.worldSize + 'px';
            if (isLocked) img.classList.add('locked');

            img.addEventListener('click', () => {
                if (!isLocked) {
                    if(this.audio) this.audio.playClick();
                    if (world.id === 'tutorial_world') {
                        this.toggleGlobalHeader(true);
                        const container = document.getElementById('levels-container');
                        container.style.display = 'none';
                        document.body.className = '';
                        this.startAdventureLevel(world.levels[0]);
                    } else {
                        this.openWorldMap(world); 
                    }
                } else {
                    if(this.audio) this.audio.vibrate(50);
                    this.effects.showFloatingTextCentered(this.i18n.t('worlds.locked_msg'), "feedback-bad");
                }
            });

            worldItem.appendChild(img);
            if (isLocked) {
                const lock = document.createElement('div');
                lock.className = 'lock-overlay';
                lock.innerHTML = '🔒';
                worldItem.appendChild(lock);
            }
            grid.appendChild(worldItem);
        });
    }

    openWorldMap(worldConfig) {
        const container = document.getElementById('levels-container');
        if(!container) return;
        
        this.toggleGlobalHeader(false);

        // Limpa estilos antigos para garantir tela cheia
        container.className = ''; 
        container.style = ''; 
        container.style.display = 'block';

        // --- ATUALIZADO: Botão AAA com Z-Index alto ---
        container.innerHTML = `
            <button id="btn-map-back" class="btn-aaa-back pos-absolute-top-left" style="z-index: 2000;">
                <svg viewBox="0 0 24 24"><path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z"/></svg>
            </button>
            
            <div id="world-map-bg" class="world-map-container full-screen-mode">
            </div>
        `;

        // Configura a imagem de fundo
        const mapBg = document.getElementById('world-map-bg');
        if (worldConfig.bgImage) {
            mapBg.style.backgroundImage = `url('${worldConfig.bgImage}')`;
        } else {
            mapBg.style.backgroundColor = '#1a0b0b'; 
        }

        // Configura o botão de voltar
        const mapBackBtn = document.getElementById('btn-map-back');
        if(mapBackBtn) {
            mapBackBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                if(this.audio) this.audio.playBack();
                
                // Limpa o HTML ao sair
                container.innerHTML = ''; 
                this.showWorldSelect(); 
            });
        }

        const currentSave = this.loadProgress();

        // --- FUNÇÃO AUXILIAR: BOTÕES SVG (RACHADOS) ---
        // (O resto da função openWorldMap continua exatamente igual daqui para baixo...)
        // ... (Mantenha o código do createSvgButton e o loop forEach igual ao que você já tem)
        
        // --- CÓDIGO REPETIDO PARA CONTEXTO (NÃO PRECISA COPIAR SE JÁ TIVER) ---
        const createSvgButton = (levelData, isBonus = false) => {
            const pos = levelData.mapPos || { x: 50, y: 50 }; 
            const levelNum = isBonus ? '🎁' : levelData.id;
            
            let state = 'locked';
            if (isBonus) {
                state = 'unlocked'; 
            } else {
                if (levelData.id < currentSave) state = 'completed';
                else if (levelData.id === currentSave) state = 'current';
                else state = 'locked';
            }

            let type = 'normal';
            let emojiIcon = null; 

            if (isBonus) {
                type = 'bonus';
                emojiIcon = '🎁';
            } else if (levelData.type === 'boss') {
                if (levelData.id === 20) {
                    type = 'final-boss';
                    emojiIcon = '👑'; 
                } else {
                    type = 'elite';
                    emojiIcon = '💀'; 
                }
            }
            
            if (state === 'current' && emojiIcon === null) {
                emojiIcon = '⚔️'; 
            }

            const palettes = {
                'normal':     { top: '#2563eb', bot: '#172554', stroke: '#60a5fa' },
                'elite':      { top: '#dc2626', bot: '#7f1d1d', stroke: '#fca5a5' },
                'final-boss': { top: '#f59e0b', bot: '#92400e', stroke: '#fcd34d' },
                'bonus':      { top: '#c026d3', bot: '#701a75', stroke: '#e879f9' },
                'completed':  { top: '#475569', bot: '#0f172a', stroke: '#1e293b' }
            };

            const p = (state === 'completed') ? palettes['completed'] : palettes[type];

            let finalStroke = p.stroke;
            let finalStrokeWidth = "2";
            
            if (state === 'current') {
                finalStroke = "#fbbf24"; 
                finalStrokeWidth = "4";  
            }

            const svgNS = "http://www.w3.org/2000/svg";
            const svgBtn = document.createElementNS(svgNS, "svg");
            const uniqueId = `btn-${isBonus ? 'bonus' : levelData.id}`;
            
            let cssClasses = `map-node-svg style-shield floating-node ${state} ${type}`;
            
            if (state === 'current') cssClasses += ' current';
            
            svgBtn.setAttribute("class", cssClasses);
            svgBtn.setAttribute("viewBox", "0 0 100 100");
            svgBtn.style.left = `${pos.x}%`;
            svgBtn.style.top = `${pos.y}%`;
            
            svgBtn.style.setProperty('--i', Math.random() * 5);

            const defs = document.createElementNS(svgNS, "defs");
            defs.innerHTML = `
                <linearGradient id="gradMain-${uniqueId}" x1="0%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" stop-color="${p.top}" stop-opacity="1" />
                    <stop offset="100%" stop-color="${p.bot}" stop-opacity="1" />
                </linearGradient>
                <linearGradient id="gradShine-${uniqueId}" x1="0%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" stop-color="white" stop-opacity="0.3" />
                    <stop offset="60%" stop-color="white" stop-opacity="0" />
                </linearGradient>
                <radialGradient id="gradShadow-${uniqueId}" cx="50%" cy="50%" r="50%" fx="50%" fy="50%">
                    <stop offset="0%" stop-color="black" stop-opacity="0.6" />
                    <stop offset="100%" stop-color="black" stop-opacity="0" />
                </radialGradient>
            `;
            svgBtn.appendChild(defs);

            const shadow = document.createElementNS(svgNS, "ellipse");
            shadow.setAttribute("cx", "50"); shadow.setAttribute("cy", "95");
            shadow.setAttribute("rx", "25"); shadow.setAttribute("ry", "6");
            shadow.setAttribute("fill", state === 'completed' ? "rgba(0,0,0,0.8)" : `url(#gradShadow-${uniqueId})`);
            svgBtn.appendChild(shadow);

            const shieldPath = "M 50 5 L 90 20 v 25 c 0 30 -25 50 -40 55 c -15 -5 -40 -25 -40 -55 v -25 Z";
            const pathBase = document.createElementNS(svgNS, "path");
            pathBase.setAttribute("d", shieldPath);
            pathBase.setAttribute("fill", `url(#gradMain-${uniqueId})`);
            pathBase.setAttribute("stroke", finalStroke);
            pathBase.setAttribute("stroke-width", finalStrokeWidth);
            svgBtn.appendChild(pathBase);

            if (state === 'completed') {
                const crackD = "M 35 30 L 50 50 L 40 65 M 60 40 L 50 50 L 55 70";
                
                const crackShadow = document.createElementNS(svgNS, "path");
                crackShadow.setAttribute("d", crackD);
                crackShadow.setAttribute("fill", "none");
                crackShadow.setAttribute("stroke", "black");
                crackShadow.setAttribute("stroke-width", "4");
                crackShadow.setAttribute("opacity", "0.8");
                svgBtn.appendChild(crackShadow);

                const crackHighlight = document.createElementNS(svgNS, "path");
                crackHighlight.setAttribute("d", crackD);
                crackHighlight.setAttribute("fill", "none");
                crackHighlight.setAttribute("stroke", "rgba(255,255,255,0.3)");
                crackHighlight.setAttribute("stroke-width", "1");
                crackHighlight.setAttribute("transform", "translate(1, 1)");
                svgBtn.appendChild(crackHighlight);
            }

            const shinePath = "M 50 10 L 80 22 v 20 c 0 20 -15 35 -30 40 c -15 -5 -30 -20 -30 -40 v -20 Z";
            const pathShine = document.createElementNS(svgNS, "path");
            pathShine.setAttribute("d", shinePath);
            pathShine.setAttribute("fill", `url(#gradShine-${uniqueId})`);
            pathShine.style.pointerEvents = "none";
            svgBtn.appendChild(pathShine);

            const text = document.createElementNS(svgNS, "text");
            text.setAttribute("x", "50");
            text.setAttribute("y", "62");
            text.setAttribute("text-anchor", "middle");
            text.setAttribute("class", "glossy-text");
            text.style.pointerEvents = "none";
            
            text.style.fill = (state === 'completed') ? '#94a3b8' : '#ffffff';
            text.style.fontSize = emojiIcon ? "34px" : "28px";
            text.style.textShadow = "0 2px 4px rgba(0,0,0,0.8)";
            
            text.textContent = emojiIcon || levelNum;
            svgBtn.appendChild(text);

            svgBtn.addEventListener('click', () => {
                if (state === 'locked') {
                    if(this.audio) this.audio.vibrate(50);
                    return; 
                }
                if(this.audio) this.audio.playClick();
                this.toggleGlobalHeader(true);
                const container = document.getElementById('levels-container');
                container.style.display = 'none';
                document.body.className = '';
                const configToStart = isBonus ? BONUS_LEVEL_CONFIG : levelData;
                this.startAdventureLevel(configToStart);
            });

            return svgBtn;
        };

        worldConfig.levels.forEach(level => {
            mapBg.appendChild(createSvgButton(level));
        });

        if (BONUS_LEVEL_CONFIG && BONUS_LEVEL_CONFIG.mapPos) {
             mapBg.appendChild(createSvgButton(BONUS_LEVEL_CONFIG, true));
        }
    }

    // --- GAMEPLAY CORE ---

    setupGoalsUI(goalsConfig) {
        if(!this.goalsArea) return;
        this.currentGoals = { ...goalsConfig }; 
        this.collected = {};
        Object.keys(this.currentGoals).forEach(key => this.collected[key] = 0);

        let html = '<div class="goals-container">';
        Object.keys(this.currentGoals).forEach(key => {
            const emoji = EMOJI_MAP[key] || '❓';
            html += `
                <div class="goal-item" id="goal-item-${key}">
                    <div class="goal-circle type-${key}-glow"><span class="goal-emoji">${emoji}</span></div>
                    <div class="goal-info"><span class="goal-counter" id="goal-val-${key}">0/${this.currentGoals[key]}</span></div>
                </div>`;
        });
        html += '</div>';
        this.goalsArea.innerHTML = html;
    }

    updateGoalsUI() {
        Object.keys(this.currentGoals).forEach(key => {
            const el = document.getElementById(`goal-val-${key}`);
            if(!el) return;
            const target = this.currentGoals[key];
            const current = this.collected[key] || 0;
            el.innerText = `${current}/${target}`;
            const parent = document.getElementById(`goal-item-${key}`);
            if (current >= target && parent) parent.classList.add('completed');
        });
    }

    checkVictoryConditions() {
        if (!this.currentGoals || Object.keys(this.currentGoals).length === 0) return false;

        // LÓGICA ESPECIAL PARA FASE BÔNUS (SALA DO TESOURO)
        if (this.currentLevelConfig && this.currentLevelConfig.type === 'bonus') {
            const winners = [];
            
            // 1. Carrega inventário atualizado (AGORA COM MAGNET)
            const inventory = {
                magnet: parseInt(localStorage.getItem('powerup_magnet') || '0'), 
                rotate: parseInt(localStorage.getItem('powerup_rotate') || '0'),
                swap: parseInt(localStorage.getItem('powerup_swap') || '0')
            };

            // Verifica se o inventário está cheio (Max 3 de cada)
            const isFullInventory = (inventory.magnet >= 3 && inventory.rotate >= 3 && inventory.swap >= 3);

            // 2. Verifica metas
            Object.keys(this.currentGoals).forEach(key => {
                const currentAmount = this.collected[key] || 0;
                const targetAmount = this.currentGoals[key];

                if (currentAmount >= targetAmount) {
                    // Só ganha o item se tiver menos de 3, ou se estiver tudo cheio (pra não travar o jogo)
                    // Como 'key' agora é 'magnet', 'inventory[key]' vai funcionar corretamente
                    if (inventory[key] < 3 || isFullInventory) {
                        winners.push(key);
                    }
                }
            });

            // Se ganhou algo, encerra a fase
            if (winners.length > 0) {
                const rewardsList = [];

                winners.forEach(powerUp => {
                    const currentAmount = parseInt(localStorage.getItem(`powerup_${powerUp}`) || '0');
                    const newAmount = Math.min(currentAmount + 1, 3);
                    localStorage.setItem(`powerup_${powerUp}`, newAmount);
                    
                    rewardsList.push({ type: powerUp, count: 1 });
                });
                
                this.loadPowerUps(); // Atualiza visualmente os botões

                setTimeout(() => {
                    this.gameWon(this.collected, rewardsList);
                }, 300);
                
                return true; 
            }
            return false;
        }

        // LÓGICA PADRÃO (Fases Normais e Boss)
        const allMet = Object.keys(this.currentGoals).every(key => {
            return (this.collected[key] || 0) >= this.currentGoals[key];
        });

        if (allMet) {
            setTimeout(() => {
                this.gameWon(this.collected, []); 
            }, 300);
            return true;
        }
        return false;
    }

    startCasualMode() {
        this.currentMode = 'casual';
        this.currentLevelConfig = null;
        this.clearTheme();
        this.showScreen(this.screenGame);
        this.setupGoalsUI({ bee: 10, ghost: 10, cop: 10 });
        this.resetGame();
    }

    startAdventureLevel(levelConfig) {
        this.currentMode = 'adventure';
        this.currentLevelConfig = levelConfig;
        this.showScreen(this.screenGame);
        
        if (this.audio) {
            if (levelConfig.musicId) {
                this.audio.playMusic(levelConfig.musicId);
            } 
            else if (levelConfig.type === 'boss') {
                this.audio.playBossMusic();
            } 
            else {
                this.audio.stopMusic();
            }
        }

        // TENTATIVA DE RESTAURAR JOGO SALVO
        if (this.restoreGameState(levelConfig.id)) {
            // REMOVIDO: A mensagem visual "JOGO RESGATADO" não aparece mais.
            // O jogo apenas continua silenciosamente.
            return;
        }

        // Se não tinha save, inicia do zero normalmente
        if (levelConfig.type === 'boss') {
            const bossData = levelConfig.boss || { id: 'dragon', name: 'Dragão', emoji: '🐉', maxHp: 50 };
            this.setupBossUI(bossData);
            this.bossState = { active: true, maxHp: bossData.maxHp, currentHp: bossData.maxHp, attackRate: 3, movesWithoutDamage: 0 };
            this.currentGoals = {}; 
        } else {
            this.bossState.active = false;
            const goals = (levelConfig.goals && Object.keys(levelConfig.goals).length > 0) 
                ? levelConfig.goals 
                : { bee: 10 }; 
            
            this.setupGoalsUI(goals);
        }
        this.resetGame();
    }

    setupBossUI(bossData) {
        if(!this.goalsArea) return;
        
        // Adicionamos o <span id="boss-hp-text"> dentro da barra
        this.goalsArea.innerHTML = `
            <div class="boss-ui-container">
                <div id="boss-target" class="boss-avatar">${bossData.emoji}</div>
                <div class="boss-stats">
                    <div class="boss-name">${bossData.name}</div>
                    <div class="hp-bar-bg">
                        <div class="hp-bar-fill" id="boss-hp-bar" style="width: 100%"></div>
                        <span id="boss-hp-text" class="hp-text">${bossData.maxHp}/${bossData.maxHp}</span>
                    </div>
                </div>
            </div>`;
    }
	
	// --- LÓGICA DE UI DOS HERÓIS ---

    renderHeroUI() {
        // Remove container antigo se existir
        const oldContainer = document.getElementById('hero-powers-area');
        if (oldContainer) oldContainer.remove();

        // Só mostra no Modo Aventura
        if (this.currentMode !== 'adventure') return;

        // Cria o container
        const container = document.createElement('div');
        container.id = 'hero-powers-area';
        container.className = 'hero-powers-container';
        
        // THALION (Elfo) - Requer Combo x2
        const thalionBtn = document.createElement('div');
        thalionBtn.id = 'btn-hero-thalion';
        thalionBtn.innerHTML = `🧝‍♂️<div class="hero-badge">Combo x2</div>`;
        thalionBtn.onclick = () => this.activateHeroPower('thalion');

        // NYX (Lobo) - Requer Combo x3
        const nyxBtn = document.createElement('div');
        nyxBtn.id = 'btn-hero-nyx';
        nyxBtn.innerHTML = `🐺<div class="hero-badge">Combo x3</div>`;
        nyxBtn.onclick = () => this.activateHeroPower('nyx');

        container.appendChild(thalionBtn);
        container.appendChild(nyxBtn);

        // Insere ANTES da área de dock (peças)
        // Se preferir ao lado dos powerups, troque o insertBefore
        const dock = document.getElementById('dock');
        if (dock && dock.parentNode) {
            dock.parentNode.insertBefore(container, dock);
        }
        
        // Atualiza o estado visual inicial
        this.updateHeroButtonsUI();
    }

    activateHeroPower(hero) {
        const state = this.heroState[hero];
        if (state.used || !state.unlocked) {
            if(this.audio) this.audio.vibrate(50);
            return;
        }
        if (this.interactionMode === `hero_${hero}`) {
            this.interactionMode = null;
            this.updateControlsVisuals();
            return;
        }
        
        this.interactionMode = `hero_${hero}`;
        if(this.audio) this.audio.playClick();
        this.updateControlsVisuals();
        
        // --- ATUALIZADO: Textos corretos dos poderes (com tradução) ---
        let msg = this.i18n.t('game.aim_single'); // "MIRAR: ALVO ÚNICO"
        if (hero === 'thalion') msg = this.i18n.t('game.aim_thalion'); // "MIRAR: 3 BLOCOS"
        if (hero === 'nyx') msg = this.i18n.t('game.aim_nyx'); // "MIRAR: COLUNA INTEIRA"
        if (hero === 'player') msg = this.i18n.t('game.aim_player'); // "MIRAR: CORTE EM X"
		if (hero === 'mage') msg = this.i18n.t('game.aim_mage'); // <--- NOVO
        
        this.effects.showFloatingTextCentered(msg, "feedback-gold");
    }

    updateHeroButtonsUI() {
        ['thalion', 'nyx'].forEach(hero => {
            const btn = document.getElementById(`btn-hero-${hero}`);
            if (!btn) return;
            
            // Reseta classes
            btn.className = 'hero-btn';
            
            const state = this.heroState[hero];
            
            if (state.used) {
                btn.classList.add('used');
            } else if (state.unlocked) {
                btn.classList.add('ready');
            } else {
                btn.classList.add('locked');
            }
            
            // Estado de mira ativa
            if (this.interactionMode === `hero_${hero}`) {
                btn.classList.add('active-aim');
            }
        });
    }

    clearTheme() { document.body.className = ''; }

    retryGame() {
        this.modalOver.classList.add('hidden');
        this.modalWin.classList.add('hidden');
        
        // SOLUÇÃO DEFINITIVA DE ÁUDIO:
        // Paramos o som atual manualmente para garantir silêncio imediato
        if (this.audio) this.audio.stopMusic();

        if (this.currentMode === 'adventure' && this.currentLevelConfig) {
            // TRUQUE: Em vez de apenas resetar o grid (resetGame), 
            // nós chamamos a função que inicia a fase do zero.
            // Isso força o sistema de áudio a carregar a música da forma correta,
            // exatamente como acontece quando você entra na fase pela primeira vez.
            
            // Um micro-delay de 10ms apenas para o navegador processar o 'stopMusic' acima
            setTimeout(() => {
                this.startAdventureLevel(this.currentLevelConfig);
            }, 10);
            
        } else {
            // Modo Casual (sem música específica de boss, reset simples funciona)
            this.resetGame();
        }
    }

    resetGame() {
        this.grid = Array(this.gridSize).fill().map(() => Array(this.gridSize).fill(null));
        this.score = 0;
        this.interactionMode = null;
        this.comboState = { count: 0, lastClearTime: 0 }; 
        
        this.heroState = {
            thalion: { unlocked: false, used: false },
            nyx: { unlocked: false, used: false },
            player:  { unlocked: false, used: false, lineCounter: 0 },
			mage: { unlocked: false, used: false, lineCounter: 0 }
			
        };

        this.bossState.active = (this.currentLevelConfig?.type === 'boss');
        this.loadPowerUps(); // Carrega o magnet aqui
        
        this.renderControlsUI(); 

        if(!this.bossState.active) {
            const goals = (this.currentMode === 'casual') ? { bee: 10, ghost: 10, cop: 10 } : this.currentGoals;
            this.setupGoalsUI(goals); 
        } else {
            this.bossState.currentHp = this.bossState.maxHp;
            this.updateBossUI();
        }

        if (this.currentMode === 'adventure' && this.currentLevelConfig?.gridConfig) {
            this.currentLevelConfig.gridConfig.forEach(cfg => {
                if(this.grid[cfg.r]) {
                    this.grid[cfg.r][cfg.c] = { 
                        type: cfg.type, 
                        key: cfg.key, 
                        emoji: cfg.emoji 
                    }; 
                }
            });
        }
        this.renderGrid();
        this.spawnNewHand();
    }

    // --- EFEITO VISUAL: Partículas ---
    spawnExplosion(rect, colorClass) {
        // Delega a explosão para o sistema de efeitos (que usa Object Pooling)
        if (this.effects) {
            this.effects.spawnExplosion(rect, colorClass);
        }
    }

    // --- EFEITO VISUAL: Voo ---
    runFlyAnimation(r, c, key, emoji) {
        const idx = r * 8 + c;
        const cell = this.boardEl.children[idx];
        if (!cell) return;
        const startRect = cell.getBoundingClientRect();

        let targetEl = null;

        if (this.bossState.active) {
            targetEl = document.getElementById('boss-target');
        } else {
            targetEl = document.getElementById(`goal-item-${key}`);
        }

        if (!targetEl) return;

        const targetRect = targetEl.getBoundingClientRect();

        const flyer = document.createElement('div');
        flyer.classList.add('flying-item');
        
        flyer.style.position = 'fixed';
        flyer.style.zIndex = '9999';
        flyer.style.pointerEvents = 'none';
        // MUDANÇA AQUI: Mais lento (1.2s) e curva mais "pesada" (começa lento, acelera)
        flyer.style.transition = 'all 1.2s cubic-bezier(0.25, 0.1, 0.25, 1.0)';
        flyer.style.transformOrigin = 'center';
        
        flyer.innerText = emoji;
        
        // MUDANÇA AQUI: Começa bem maior
        flyer.style.transform = 'scale(1.5)';
        
        flyer.style.left = `${startRect.left + startRect.width/4}px`; 
        flyer.style.top = `${startRect.top + startRect.height/4}px`;
        
        document.body.appendChild(flyer);

        // Força o reflow para garantir que a posição inicial seja renderizada
        flyer.getBoundingClientRect();

        requestAnimationFrame(() => {
            const destX = targetRect.left + targetRect.width/2 - 20; 
            const destY = targetRect.top + targetRect.height/2 - 20;

            flyer.style.left = `${destX}px`;
            flyer.style.top = `${destY}px`;
            // MUDANÇA AQUI: Termina um pouco maior que antes (0.8 em vez de 0.5)
            flyer.style.transform = 'scale(0.8)'; 
        });

        // Tempo sincronizado com a nova duração da transição (1200ms)
        setTimeout(() => {
            flyer.remove();
            targetEl.classList.remove('target-pop'); 
            void targetEl.offsetWidth; 
            targetEl.classList.add('target-pop'); 
        }, 1200); 
    }
	
	ensureBoardClickDelegation() {
  if (this._boardClickDelegationInstalled) return;
  this._boardClickDelegationInstalled = true;

  this.boardEl.addEventListener('click', (e) => {
    const cell = e.target.closest('.cell');
    if (!cell || !this.boardEl.contains(cell)) return;

    const r = Number(cell.dataset.r);
    const c = Number(cell.dataset.c);
    if (Number.isNaN(r) || Number.isNaN(c)) return;

    this.handleBoardClick(r, c);
  });
}

ensureBoardCells() {
  if (this._boardCells && this._boardCells.length === this.gridSize * this.gridSize) return;

  this.ensureBoardClickDelegation();

  this.boardEl.innerHTML = '';
  this._boardCells = new Array(this.gridSize * this.gridSize);

  const frag = document.createDocumentFragment();
  for (let r = 0; r < this.gridSize; r++) {
    for (let c = 0; c < this.gridSize; c++) {
      const div = document.createElement('div');
      div.className = 'cell';
      div.dataset.r = r;
      div.dataset.c = c;
      this._boardCells[r * this.gridSize + c] = div;
      frag.appendChild(div);
    }
  }
  this.boardEl.appendChild(frag);
}

renderCell(div, cellData) {
  // limpa estado visual anterior
  div.className = 'cell';
  div.innerText = '';

  if (!cellData) return;

  if (cellData.type === 'LAVA') {
    div.classList.add('lava');
    div.innerText = '🌋';
    return;
  }

  div.classList.add('filled');

  if (cellData.key) div.classList.add('type-' + cellData.key.toLowerCase());
  else this.applyColorClass(div, cellData);

  if (cellData.type === 'ITEM' || cellData.type === 'OBSTACLE') {
    const emoji = cellData.emoji || EMOJI_MAP[cellData.key] || '?';
    div.innerText = emoji;
  }
}


    renderGrid() {
  this.ensureBoardCells();

  for (let r = 0; r < this.gridSize; r++) {
    for (let c = 0; c < this.gridSize; c++) {
      const div = this._boardCells[r * this.gridSize + c];
      this.renderCell(div, this.grid[r][c]);
    }
  }
}



    applyColorClass(element, cellData) {
        element.className = element.className.replace(/type-[\w-]+/g, '').trim();
        element.classList.add('filled'); 
        if (cellData?.type === 'ITEM' && cellData.key) element.classList.add('type-' + cellData.key.toLowerCase());
        else element.classList.add('type-normal');
    }

    spawnNewHand() {
        if(!this.dockEl) return;
        this.dockEl.innerHTML = '';
        
        const config = this.currentLevelConfig;
        const customItems = (this.currentMode === 'adventure' && config) ? config.items : null;
        
        const isBoss = config && config.type === 'boss';
        const isBonus = config && config.type === 'bonus';
        const useRPGStats = isBoss || isBonus;

        let forceEasy = false;
        
        // 1. CONTAGEM DE ESPAÇOS VAZIOS (Smart RNG)
        let emptyCount = 0;
        this.grid.forEach(r => r.forEach(c => { if(!c) emptyCount++; }));
        
        // Se tiver menos de 15 blocos livres (aprox 20%), ativa modo de emergência
        const isEmergency = emptyCount < 15;

        if (isBonus && emptyCount > 30) forceEasy = true; 

        this.currentHand = [];
        for(let i=0; i<3; i++) {
            // Garante peça pequena se for emergência E for a primeira peça da mão
            const forceSimple = (isEmergency && i === 0) || (forceEasy && i === 0);

            const piece = getRandomPiece(customItems, useRPGStats, forceSimple);
            this.currentHand.push(piece);
        }
        
        this.renderDock(); 

        // SALVA O ESTADO ASSIM QUE AS NOVAS PEÇAS NASCEM
        this.saveGameState();

        setTimeout(() => { if (!this.checkMovesAvailable()) this.gameOver(); }, 100);
    }

    createDraggablePiece(piece, index, parentContainer) {
        const container = document.createElement('div');
        container.classList.add('draggable-piece');
        container.dataset.index = index;
        container.style.gridTemplateColumns = `repeat(${piece.matrix[0].length}, 1fr)`;
        container.style.gridTemplateRows = `repeat(${piece.matrix.length}, 1fr)`;
        
        container.addEventListener('click', (e) => {
            this.handlePieceClick(index);
        });
        
        piece.layout.forEach(row => {
            row.forEach(cellData => {
                const block = document.createElement('div');
                if (cellData) {
                    block.classList.add('block-unit');
                    this.applyColorClass(block, cellData);
                    
                    // CORREÇÃO: Garante o emoji certo na peça do deck
                    if (typeof cellData === 'object' && cellData.type === 'ITEM') {
                        const emoji = cellData.emoji || EMOJI_MAP[cellData.key] || '?';
                        block.innerText = emoji;
                    }
                } else {
                    block.style.visibility = 'hidden';
                }
                container.appendChild(block);
            });
        });
        
        this.attachDragEvents(container, piece);
        parentContainer.appendChild(container);
    }

    attachDragEvents(el, piece) {
    let isDragging = false;
    let clone = null;
    let cellPixelSize = 0;
    let boardRect = null;

    // Cache para evitar leituras repetidas de layout
    let halfW = 0;
    let halfH = 0;

    // rAF throttle para reduzir custo do onMove
    let rafId = 0;
    let lastClientX = 0;
    let lastClientY = 0;

    const onStart = (e) => {
        if (this.interactionMode === 'rotate') return;
        if (isDragging) return;

        if (this.audio) this.audio.playDrag();
        isDragging = true;
        this.activeSnap = null;

        boardRect = this.boardEl.getBoundingClientRect();

        const firstCell = this.boardEl.querySelector('.cell');
        if (firstCell) {
            cellPixelSize = firstCell.getBoundingClientRect().width;
        } else {
            cellPixelSize = (boardRect.width - 16) / 8;
        }

        clone = el.cloneNode(true);
        clone.classList.add('dragging-active');
        clone.style.display = 'grid';

        const cols = piece.matrix[0].length;
        const rows = piece.matrix.length;
        clone.style.width = (cols * cellPixelSize) + 'px';
        clone.style.height = (rows * cellPixelSize) + 'px';
        clone.style.gridTemplateColumns = `repeat(${cols}, 1fr)`;
        clone.style.gridTemplateRows = `repeat(${rows}, 1fr)`;
        clone.style.gap = '4px';

        // IMPORTANTE: append antes de medir, pra offsetWidth/Height serem confiáveis
        document.body.appendChild(clone);

        // Cache das metades (evita offsetWidth/Height no move)
        halfW = clone.offsetWidth / 2;
        halfH = clone.offsetHeight / 2;

        const touch = e.touches ? e.touches[0] : e;
        lastClientX = touch.clientX;
        lastClientY = touch.clientY;

        // Move inicial (mantém seu moveClone, mas sem custo repetido)
        // Aqui replicamos a lógica do moveClone com halfW/halfH cacheados.
        // Não usamos transform para não conflitar com o CSS scale.
        const VISUAL_OFFSET_Y = 80;
        clone.style.left = (lastClientX - halfW) + 'px';
        clone.style.top = (lastClientY - halfH - VISUAL_OFFSET_Y) + 'px';

        // Ghost inicial
        this.updateGhostPreview(clone, boardRect, cellPixelSize, piece);

        el.style.opacity = '0';
    };

    const onMove = (e) => {
        if (!isDragging || !clone) return;

        // Evita scroll no mobile
        if (e.cancelable) e.preventDefault();

        const touch = e.touches ? e.touches[0] : e;
        lastClientX = touch.clientX;
        lastClientY = touch.clientY;

        // Throttle via rAF
        if (rafId) return;
        rafId = requestAnimationFrame(() => {
            rafId = 0;

            // Move (mesma lógica do moveClone, sem reler offsetWidth/Height)
            const VISUAL_OFFSET_Y = 80;
            clone.style.left = (lastClientX - halfW) + 'px';
            clone.style.top = (lastClientY - halfH - VISUAL_OFFSET_Y) + 'px';

            this.updateGhostPreview(clone, boardRect, cellPixelSize, piece);
        });
    };

    const onEnd = (e) => {
        if (!isDragging) return;

        // Para qualquer frame pendente
        if (rafId) {
            cancelAnimationFrame(rafId);
            rafId = 0;
        }

        this.clearPredictionHighlights();
        isDragging = false;

        const touch = e.changedTouches ? e.changedTouches[0] : e;
        const dropX = touch.clientX;
        const dropY = touch.clientY;

        let placed = false;
        if (this.activeSnap && this.activeSnap.valid) {
            placed = this.placePiece(this.activeSnap.r, this.activeSnap.c, piece);
        }

        if (placed) {
            if (this.audio) {
                this.audio.playDrop();
                this.audio.vibrate(20);
            }

            el.remove();

            // Remove da memória
            const index = parseInt(el.dataset.index);
            if (!isNaN(index)) {
                this.currentHand[index] = null;
            }

            let hasWon = false;

            try {
                const damageDealt = this.checkLines(dropX, dropY);

                if (this.currentMode === 'adventure') {
                    if (this.bossState.active) {
                        this.processBossTurn(damageDealt);
                        if (this.bossState.currentHp <= 0) hasWon = true;
                    } else {
                        hasWon = this.checkVictoryConditions();
                    }
                } else {
                    hasWon = this.checkVictoryConditions();
                }
            } catch (e) { console.error(e); }

            if (this.bossState.active && !hasWon) {
                const bossId = this.currentLevelConfig.boss?.id;
                if (BOSS_LOGIC && BOSS_LOGIC[bossId] && BOSS_LOGIC[bossId].onTurnEnd) {
                    BOSS_LOGIC[bossId].onTurnEnd(this);
                }
            }

            if (!hasWon) {
                const remainingPieces = this.dockEl.querySelectorAll('.draggable-piece');

                if (remainingPieces.length === 0) {
                    this.spawnNewHand();
                } else {
                    this.saveGameState();
                    if (!this.checkMovesAvailable()) this.gameOver();
                }
            }
        } else {
            el.style.opacity = '1';
        }

        if (clone) clone.remove();
        this.clearGhostPreview();
        this.activeSnap = null;
    };

    el.addEventListener('mousedown', onStart);
    el.addEventListener('touchstart', onStart, { passive: false });

    window.addEventListener('mousemove', onMove);
    window.addEventListener('touchmove', onMove, { passive: false });

    window.addEventListener('mouseup', onEnd);
    window.addEventListener('touchend', onEnd);
}

    
    moveClone(clone, clientX, clientY) {
        const VISUAL_OFFSET_Y = 80;
        const x = clientX - (clone.offsetWidth / 2);
        const y = clientY - (clone.offsetHeight / 2) - VISUAL_OFFSET_Y; 
        clone.style.left = x + 'px';
        clone.style.top = y + 'px';
    }

    updateGhostPreview(clone, boardRect, cellSize, piece) {
        this.clearGhostPreview();
        // Limpa brilhos antigos se não houver snap válido ainda
        this.clearPredictionHighlights(); 

        const cloneRect = clone.getBoundingClientRect();
        const GAP = 4; const PADDING = 8;  
        
        const relativeX = (cloneRect.left + cloneRect.width / 2) - (boardRect.left + PADDING);
        const relativeY = (cloneRect.top + cloneRect.height / 2) - (boardRect.top + PADDING);
        
        const effectiveSize = cellSize + GAP;
        
        const exactCol = (relativeX / effectiveSize) - (piece.matrix[0].length / 2);
        const exactRow = (relativeY / effectiveSize) - (piece.matrix.length / 2);
        
        const baseR = Math.round(exactRow);
        const baseC = Math.round(exactCol);

        const candidates = [{ r: baseR, c: baseC }, { r: baseR + 1, c: baseC }, { r: baseR - 1, c: baseC }, { r: baseR, c: baseC + 1 }, { r: baseR, c: baseC - 1 }];
        let bestMatch = null; let minDistance = Infinity;

        for (const cand of candidates) {
            const isValid = this.canPlace(cand.r, cand.c, piece);
            const dist = Math.sqrt(Math.pow(cand.r - exactRow, 2) + Math.pow(cand.c - exactCol, 2));
            if (isValid) {
                if (!bestMatch || !bestMatch.valid || dist < minDistance) {
                    bestMatch = { r: cand.r, c: cand.c, valid: true };
                    minDistance = dist;
                }
            } else if (!bestMatch && dist < 0.6) { 
                bestMatch = { r: cand.r, c: cand.c, valid: false };
            }
        }

        if (bestMatch) {
            this.activeSnap = bestMatch;
            this.drawGhost(bestMatch.r, bestMatch.c, piece, bestMatch.valid);

            // --- NOVO CÓDIGO AQUI ---
            // Se o encaixe é válido, verifique se vai completar linha!
            if (bestMatch.valid) {
                const prediction = this.predictClears(bestMatch.r, bestMatch.c, piece);
                if (prediction.rows.length > 0 || prediction.cols.length > 0) {
                    this.drawPredictionHighlights(prediction);
                }
            }
            // ------------------------

        } else {
            this.activeSnap = null;
        }
    }
    
    // --- PREVISÃO DE LINHAS (EFEITO DOURADO) ---

    // 1. Simula a jogada e retorna quais linhas/colunas seriam limpas
    predictClears(r, c, piece) {
        // Cria uma cópia leve do grid para simulação (apenas true/false importa)
        // Precisamos copiar linha por linha para não alterar o original
        let tempGrid = this.grid.map(row => [...row]);

        // Simula a colocação da peça
        for (let i = 0; i < piece.layout.length; i++) {
            for (let j = 0; j < piece.layout[i].length; j++) {
                if (piece.layout[i][j]) {
                    const targetR = r + i;
                    const targetC = c + j;
                    // Se estiver dentro do grid, marca como preenchido na simulação
                    if (targetR >= 0 && targetR < this.gridSize && targetC >= 0 && targetC < this.gridSize) {
                        tempGrid[targetR][targetC] = { type: 'SIMULATION' };
                    }
                }
            }
        }

        const rowsToClear = [];
        const colsToClear = [];

        // Verifica Linhas
        for (let row = 0; row < this.gridSize; row++) {
            if (tempGrid[row].every(cell => cell !== null)) {
                rowsToClear.push(row);
            }
        }

        // Verifica Colunas
        for (let col = 0; col < this.gridSize; col++) {
            let full = true;
            for (let row = 0; row < this.gridSize; row++) {
                if (tempGrid[row][col] === null) {
                    full = false;
                    break;
                }
            }
            if (full) colsToClear.push(col);
        }

        return { rows: rowsToClear, cols: colsToClear };
    }


    // 2. Cria barras contínuas sobre as linhas/colunas detectadas
    drawPredictionHighlights({ rows, cols }) {
        this.clearPredictionHighlights(); // Limpa anteriores

        // --- DESENHA LINHAS (Horizontais) ---
        rows.forEach(rowIndex => {
            const line = document.createElement('div');
            line.classList.add('prediction-line');
            
            // Lógica CSS Grid: 
            // grid-row: linha inicial / span 1 (ocupa 1 altura)
            // grid-column: 1 / -1 (vai do começo ao fim da largura)
            line.style.gridRowStart = rowIndex + 1; // Grid começa em 1, array em 0
            line.style.gridRowEnd = `span 1`;
            line.style.gridColumnStart = 1;
            line.style.gridColumnEnd = -1; // -1 significa "até o final"
            
            this.boardEl.appendChild(line);
        });

        // --- DESENHA COLUNAS (Verticais) ---
        cols.forEach(colIndex => {
            const line = document.createElement('div');
            line.classList.add('prediction-line');
            
            // Lógica CSS Grid:
            // grid-column: coluna inicial / span 1
            // grid-row: 1 / -1 (vai do topo até embaixo)
            line.style.gridColumnStart = colIndex + 1;
            line.style.gridColumnEnd = `span 1`;
            line.style.gridRowStart = 1;
            line.style.gridRowEnd = -1;
            
            this.boardEl.appendChild(line);
        });
    }

    // 3. Remove as barras criadas
    clearPredictionHighlights() {
        const lines = this.boardEl.querySelectorAll('.prediction-line');
        lines.forEach(el => el.remove());
    }

    drawGhost(r, c, piece, isValid) {
        const className = isValid ? 'ghost-valid' : 'ghost-invalid';
        for (let i = 0; i < piece.layout.length; i++) {
            for (let j = 0; j < piece.layout[i].length; j++) {
                if (piece.layout[i][j]) {
                    const targetR = r + i;
                    const targetC = c + j;
                    if (targetR >= 0 && targetR < this.gridSize && targetC >= 0 && targetC < this.gridSize) {
                        const idx = targetR * 8 + targetC;
                        const cell = this.boardEl.children[idx];
                        if (cell) cell.classList.add('ghost', className);
                    }
                }
            }
        }
    }
    clearGhostPreview() { this.boardEl.querySelectorAll('.ghost').forEach(el => el.classList.remove('ghost', 'ghost-valid', 'ghost-invalid')); }

    canPlace(r, c, piece) {
        for (let i = 0; i < piece.layout.length; i++) {
            for (let j = 0; j < piece.layout[i].length; j++) {
                if (piece.layout[i][j]) { 
                    const targetR = r + i;
                    const targetC = c + j;
                    if (targetR < 0 || targetR >= this.gridSize || targetC < 0 || targetC >= this.gridSize) return false;
                    if (this.grid[targetR][targetC] !== null) return false;
                }
            }
        }
        return true;
    }

    placePiece(r, c, piece) {
        if (!this.canPlace(r, c, piece)) return false;
        
        for (let i = 0; i < piece.layout.length; i++) {
            for (let j = 0; j < piece.layout[i].length; j++) {
                const cellData = piece.layout[i][j];
                
                if (cellData) { 
                    const targetR = r + i;
                    const targetC = c + j;
                    
                    this.grid[targetR][targetC] = cellData;
                    
                    const cellEl = this.boardEl.children[targetR * 8 + targetC];
                    cellEl.classList.add('filled');
                    this.applyColorClass(cellEl, cellData);
                    
                    if (cellData.type === 'ITEM') {
                        const emoji = cellData.emoji || EMOJI_MAP[cellData.key] || '?';
                        cellEl.innerText = emoji;
                    }
                }
            }
        }
        return true;
    }

    checkLines(dropX, dropY) {
    let linesCleared = 0;
    let damageDealt = false;
    const rowsToClear = [];
    const colsToClear = [];

    // 1. Identifica o que precisa ser limpo
    for (let r = 0; r < this.gridSize; r++) {
        if (this.grid[r].every(val => val !== null)) rowsToClear.push(r);
    }
    for (let c = 0; c < this.gridSize; c++) {
        let full = true;
        for (let r = 0; r < this.gridSize; r++) {
            if (this.grid[r][c] === null) { full = false; break; }
        }
        if (full) colsToClear.push(c);
    }

    // 2. CAPTURA VISUAL (O "Pulo do Gato" AAA)
    // Antes de apagar os dados, criamos clones visuais dos elementos que vão sumir.
    const visualExplosions = [];
    const uniquePos = new Set(); // Evita duplicatas em cruzamentos de linha/coluna

    const addVisual = (r, c) => {
        const key = `${r},${c}`;
        if (uniquePos.has(key)) return;
        uniquePos.add(key);

        const idx = r * 8 + c;
        const cell = this.boardEl.children[idx];

        // Só clona se tiver algo visível lá
        if (cell && (cell.classList.contains('filled') || cell.classList.contains('lava'))) {
            const rect = cell.getBoundingClientRect();
            const clone = cell.cloneNode(true);

            // Configura o clone para ser "fixed" (solto na tela)
            clone.classList.add('cell-explosion'); // Classe CSS que vamos criar
            clone.style.position = 'fixed';
            clone.style.left = `${rect.left}px`;
            clone.style.top = `${rect.top}px`;
            clone.style.width = `${rect.width}px`;
            clone.style.height = `${rect.height}px`;
            clone.style.margin = '0';
            clone.style.zIndex = '9999';
            clone.style.pointerEvents = 'none'; // Não interfere no clique
            clone.style.transition = 'none';    // Reseta transições antigas
            clone.style.transform = 'none';

            // Guarda a cor para as partículas
            const colorClass = Array.from(cell.classList).find(cls => cls.startsWith('type-') || cls === 'lava') || 'type-normal';

            visualExplosions.push({ clone, rect, colorClass });
        }
    };

    rowsToClear.forEach(r => { for (let c = 0; c < this.gridSize; c++) addVisual(r, c); });
    colsToClear.forEach(c => { for (let r = 0; r < this.gridSize; r++) addVisual(r, c); });

    // 3. LIMPEZA LÓGICA (Acontece instantaneamente)
    rowsToClear.forEach(r => { if (this.clearRow(r)) damageDealt = true; linesCleared++; });
    colsToClear.forEach(c => { if (this.clearCol(c)) damageDealt = true; linesCleared++; });

    if (linesCleared > 0) {
        // Atualiza o grid real para vazio (os clones estarão por cima tapando o buraco)
        this.renderGrid();

        // 4. EXECUÇÃO DA ANIMAÇÃO (Wave otimizado)
        // Em vez de N setTimeout(i*20), usamos um scheduler via requestAnimationFrame.
        // Mantém o mesmo efeito, mas reduz timers e micro-engasgos no mobile.
        const WAVE_STEP_MS = 20;     // mesmo "i * 20" de antes
        const REMOVE_AFTER_MS = 400; // mesmo 400ms de antes

        let startTime = performance.now();
        let nextIndex = 0;

        const tick = (t) => {
            // Quantos itens já "deveriam" ter disparado até agora?
            const shouldHave = Math.min(
                visualExplosions.length,
                Math.floor((t - startTime) / WAVE_STEP_MS) + 1
            );

            while (nextIndex < shouldHave) {
                const item = visualExplosions[nextIndex++];

                document.body.appendChild(item.clone);

                // Força o navegador a reconhecer o elemento antes de animar
                requestAnimationFrame(() => {
                    item.clone.classList.add('explode');
                    // Solta as partículas sincronizadas com o estouro do clone
                    this.spawnExplosion(item.rect, item.colorClass);
                });

                // Remove o clone do DOM depois que a animação acaba
                setTimeout(() => item.clone.remove(), REMOVE_AFTER_MS);
            }

            if (nextIndex < visualExplosions.length) {
                requestAnimationFrame(tick);
            }
        };

        requestAnimationFrame(tick);

        // Lógica de Score e Combos (Mantida igual)
        const now = Date.now();
        if (now - (this.comboState.lastClearTime || 0) <= 5000) this.comboState.count++;
        else this.comboState.count = 1;
        this.comboState.lastClearTime = now;

        const comboCount = this.comboState.count;

        if (this.currentMode === 'adventure' && this.heroState) {
            let unlockedSomething = false;

            // (Lógica de desbloqueio de heróis mantida...)
            if (comboCount >= 2 && (!this.heroState.thalion.unlocked || this.heroState.thalion.used)) {
                this.heroState.thalion.unlocked = true; this.heroState.thalion.used = false;
                this.effects.showFloatingTextCentered(this.i18n.t('game.hero_thalion_ready'), "feedback-gold");
                unlockedSomething = true;
            }
            if (comboCount >= 3 && (!this.heroState.nyx.unlocked || this.heroState.nyx.used)) {
                this.heroState.nyx.unlocked = true; this.heroState.nyx.used = false;
                this.effects.showFloatingTextCentered(this.i18n.t('game.hero_nyx_ready'), "feedback-epic");
                unlockedSomething = true;
            }

            // Player e Mage logic...
            this.heroState.player.lineCounter = (this.heroState.player.lineCounter || 0) + linesCleared;
            if ((this.heroState.player.lineCounter >= 5 || comboCount >= 4) && (!this.heroState.player.unlocked || this.heroState.player.used)) {
                if (this.heroState.player.lineCounter >= 5) this.heroState.player.lineCounter = 0;
                this.heroState.player.unlocked = true; this.heroState.player.used = false;
                this.effects.showFloatingTextCentered(this.i18n.t('game.hero_player_ready'), "feedback-epic");
                unlockedSomething = true;
            }

            this.heroState.mage.lineCounter = (this.heroState.mage.lineCounter || 0) + linesCleared;
            if ((this.heroState.mage.lineCounter >= 5 || comboCount >= 4) && (!this.heroState.mage.unlocked || this.heroState.mage.used)) {
                if (this.heroState.mage.lineCounter >= 5) this.heroState.mage.lineCounter = 0;
                this.heroState.mage.unlocked = true; this.heroState.mage.used = false;
                if (!unlockedSomething) this.effects.showFloatingTextCentered(this.i18n.t('game.hero_mage_ready'), "feedback-gold");
                unlockedSomething = true;
            }

            if (unlockedSomething) {
                this.updateControlsVisuals();
                if (this.audio) this.audio.playTone(600, 'sine', 0.2);
            }
        }

        // Sons e Feedbacks
        if (this.bossState.active) {
            this.effects.showComboFeedback(linesCleared, comboCount, 'normal');
            if (this.audio) this.audio.playBossClear(linesCleared);
        } else {
            let soundToPlay = null; let textType = 'normal';
            if (comboCount === 1) {
                textType = 'normal';
                soundToPlay = linesCleared === 1 ? 'clear1' : linesCleared === 2 ? 'clear2' : linesCleared === 3 ? 'clear3' : 'clear4';
            } else if (comboCount === 2) { textType = 'wow'; soundToPlay = 'wow'; }
            else if (comboCount === 3) { textType = 'holycow'; soundToPlay = 'holycow'; }
            else { textType = 'unreal'; soundToPlay = 'unreal'; }

            this.effects.showComboFeedback(linesCleared, comboCount, textType);
            if (this.audio) {
                this.audio.playSound(soundToPlay);
                const vibIntensity = Math.min(comboCount * 30, 200);
                this.audio.vibrate([vibIntensity, 50, vibIntensity]);
            }
        }

        this.score += (linesCleared * 10 * linesCleared) * comboCount;
    }

    return damageDealt;
}

	
	


    clearRow(r) {
        let foundDamage = false;
        for(let c=0; c<this.gridSize; c++) {
            if(this.grid[r][c]) {
                if(this.collectItem(r, c, this.grid[r][c])) foundDamage = true; 
                this.grid[r][c] = null;
            }
        }
        return foundDamage;
    }

    clearCol(c) {
        let foundDamage = false;
        for(let r=0; r<this.gridSize; r++) {
            if (this.grid[r][c]) { 
                if(this.collectItem(r, c, this.grid[r][c])) foundDamage = true;
                this.grid[r][c] = null;
            }
        }
        return foundDamage;
    }

    collectItem(r, c, cellData) {
        if (!cellData) return false;
        
        if (cellData.type === 'ITEM') {
            const key = cellData.key.toLowerCase(); 
            const emoji = cellData.emoji || EMOJI_MAP[key] || '?';
            
            this.runFlyAnimation(r, c, key, emoji);

            if (this.currentGoals[key] !== undefined) {
                this.collected[key] = (this.collected[key] || 0) + 1;
                this.updateGoalsUI();
            }
            
            // DANO NO BOSS (RPG)
            if (this.currentMode === 'adventure' && this.bossState.active) {
                // Busca o dano na tabela, ou usa 1 se não achar
                const stats = ITEM_STATS[key] || ITEM_STATS['default'];
                const damage = stats ? stats.damage : 1;
                
                // Aplica o dano
                this.damageBoss(damage);
                
                // REMOVIDO: A linha que causava o travamento (showFloatingText)
                // Se quiser esse efeito no futuro, precisaremos criar a função no effects.js primeiro.
                
                return true; 
            }
        }
        return false;
    }

    processBossTurn(damageDealt) {
        if (damageDealt) {
            this.bossState.movesWithoutDamage = 0;
        } else {
            this.bossState.movesWithoutDamage++;
            if (this.bossState.movesWithoutDamage >= this.bossState.attackRate) {
                this.triggerBossAttack();
                this.bossState.movesWithoutDamage = 0;
            }
        }
    }

    triggerBossAttack() {
        this.effects.shakeScreen();
        const bossId = (this.currentLevelConfig.boss?.id) || 'dragon_ignis';
        
        try {
            const behavior = BOSS_LOGIC ? BOSS_LOGIC[bossId] : null;
            if (behavior?.onAttack) behavior.onAttack(this);
        } catch(e) { console.warn("Boss logic error", e); }
    }

    triggerScreenFlash(color) {
        document.body.style.transition = 'background-color 0.1s';
        const oldBg = document.body.style.backgroundColor;
        document.body.style.backgroundColor = color; 
        setTimeout(() => { document.body.style.backgroundColor = oldBg; }, 200);
    }

    transformCell(r, c, newData) {
        this.grid[r][c] = newData;
        const idx = r * 8 + c;
        const el = this.boardEl.children[idx];
        if (el) {
            el.style.transform = 'scale(0)';
            setTimeout(() => {
                this.renderGrid(); 
                const newEl = this.boardEl.children[idx];
                if(newEl) {
                    newEl.style.transform = 'scale(1.2)';
                    setTimeout(() => newEl.style.transform = 'scale(1)', 150);
                }
            }, 100);
        }
    }

    damageBoss(amount) {
        this.bossState.currentHp = Math.max(0, this.bossState.currentHp - amount);
        this.updateBossUI();
        
        if (this.bossState.currentHp <= 0) {
            setTimeout(() => {
                this.gameWon({}, []); 
            }, 500);
        }
    }

    updateBossUI() {
        const bar = document.getElementById('boss-hp-bar');
        const text = document.getElementById('boss-hp-text'); // Novo elemento
        
        // Atualiza a Barra Visual
        if(bar) {
            const pct = (this.bossState.currentHp / this.bossState.maxHp) * 100;
            bar.style.width = pct + '%';
        }

        // Atualiza o Texto Numérico
        if(text) {
            // Arredonda para não mostrar decimais quebrados
            const current = Math.ceil(this.bossState.currentHp);
            text.innerText = `${current}/${this.bossState.maxHp}`;
        }
    }

    checkMovesAvailable() {
        if(!this.dockEl) return true;
        const remainingPiecesEls = this.dockEl.querySelectorAll('.draggable-piece');
        if (remainingPiecesEls.length === 0) return true;

        for (const el of remainingPiecesEls) {
            const index = el.dataset.index;
            const piece = this.currentHand[index];
            if (!piece) continue;
            for (let r = 0; r < this.gridSize; r++) {
                for (let c = 0; c < this.gridSize; c++) {
                    if (this.canPlace(r, c, piece)) return true;
                }
            }
        }
        return false; 
    }

    gameWon(collectedGoals = {}, earnedRewards = []) {
        this.clearSavedGame();

        if(this.audio) { 
            this.audio.stopMusic();
            this.audio.playClear(3); 
            if(this.audio.playSound && this.audio.playVictory) this.audio.playVictory(); 
            this.audio.vibrate([100, 50, 100, 50, 200]); 
        }
        
        const modal = document.getElementById('modal-victory');
        const goalsGrid = document.getElementById('victory-goals-grid');
        const rewardsGrid = document.getElementById('victory-rewards-grid');
        const rewardsSection = document.getElementById('victory-rewards-section');
        const scoreEl = document.getElementById('score-victory');

        goalsGrid.innerHTML = '';
        if(rewardsGrid) rewardsGrid.innerHTML = '';

        if (Object.keys(collectedGoals).length === 0 && this.bossState.active) {
             const bossData = this.currentLevelConfig.boss || { emoji: '💀' };
             goalsGrid.innerHTML = `
                <div class="victory-slot reward-highlight">
                    <div class="slot-icon">${bossData.emoji}</div>
                    <div class="slot-count">DERROTADO</div>
                </div>`;
        } else {
            Object.keys(collectedGoals).forEach(key => {
                const count = collectedGoals[key];
                const emoji = EMOJI_MAP[key] || '📦';
                goalsGrid.innerHTML += `
                    <div class="result-slot">
                        <div class="slot-icon">${emoji}</div>
                        <div class="slot-count">${count}</div>
                    </div>`;
            });
        }

        if (earnedRewards && earnedRewards.length > 0 && rewardsSection) {
            rewardsSection.classList.remove('hidden');
            earnedRewards.forEach(item => {
                const emoji = EMOJI_MAP[item.type] || '🎁';
                rewardsGrid.innerHTML += `
                    <div class="result-slot reward">
                        <div class="slot-icon">${emoji}</div>
                        <div class="slot-count">+${item.count}</div>
                    </div>`;
            });
        } else if (rewardsSection) {
            rewardsSection.classList.add('hidden');
        }

        if(scoreEl) scoreEl.innerText = this.score;

        let nextLevelId = 0;
        if (this.currentMode === 'adventure' && this.currentLevelConfig) {
            nextLevelId = this.currentLevelConfig.id + 1;
            this.saveProgress(nextLevelId);
        }

        const currentWorld = WORLDS.find(w => w.levels.some(l => l.id === this.currentLevelConfig.id));
        let nextLevelConfig = null;
        
        // CORREÇÃO: Ignora busca de próxima fase se for o Guardião (ID 0)
        // Isso garante que ele vá para a seleção de mundo ver o desbloqueio
        if (currentWorld && this.currentLevelConfig.id !== 0) {
            nextLevelConfig = currentWorld.levels.find(l => l.id === nextLevelId);
        }

        const btnContinue = document.getElementById('btn-next-level');
        if (btnContinue) {
            const newBtn = btnContinue.cloneNode(true);
            btnContinue.parentNode.replaceChild(newBtn, btnContinue);

            newBtn.addEventListener('click', () => {
                if(this.audio) this.audio.playClick();
                modal.classList.add('hidden'); 

                if (nextLevelConfig) {
                    document.body.className = ''; 
                    this.startAdventureLevel(nextLevelConfig);
                } else {
                    this.showScreen(this.screenLevels); 
                    this.showWorldSelect(); // Vai para a seleção de mundos
                }
            });
        }

        const btnBack = document.getElementById('btn-victory-back');
        if (btnBack) {
            const newBack = btnBack.cloneNode(true);
            btnBack.parentNode.replaceChild(newBack, btnBack);

            newBack.addEventListener('click', () => {
                if(this.audio) this.audio.playClick();
                modal.classList.add('hidden'); 
                
                // --- CORREÇÃO DO BOTÃO VOLTAR ---
                // Se for o Guardião (Nível 0), volta para o MENU PRINCIPAL
                if (this.currentLevelConfig && this.currentLevelConfig.id === 0) {
                    this.showScreen(this.screenMenu);
                } 
                else {
                    // Se for qualquer outro nível, volta para o Mapa
                    this.showScreen(this.screenLevels); 
                    if (currentWorld) {
                        this.openWorldMap(currentWorld);
                    } else {
                        this.showWorldSelect();
                    }
                }
            });
        }

        modal.classList.remove('hidden');
    }
	
    gameOver() {
        // Limpa o save game na derrota para obrigar reinício
        this.clearSavedGame();

        if(this.audio) this.audio.stopMusic();
        
        const scoreEl = document.getElementById('score-final');
        const goalsGrid = document.getElementById('fail-goals-grid');
        const rewardsSection = document.getElementById('fail-rewards-section');
        
        if(scoreEl) scoreEl.innerText = this.score;

        if(goalsGrid) {
            goalsGrid.innerHTML = '';
            
            if (this.bossState.active) {
                const bossData = this.currentLevelConfig.boss;
                const hpPercent = Math.round((this.bossState.currentHp / this.bossState.maxHp) * 100);
                
                goalsGrid.innerHTML = `
                    <div class="result-slot">
                        <div class="slot-icon">${bossData.emoji}</div>
                        <div class="slot-count">${hpPercent}% HP</div>
                    </div>`;
            } 
            else if (this.currentGoals) {
                Object.keys(this.currentGoals).forEach(key => {
                    const current = this.collected[key] || 0;
                    const target = this.currentGoals[key];
                    const emoji = EMOJI_MAP[key] || '📦';
                    
                    goalsGrid.innerHTML += `
                        <div class="result-slot">
                            <div class="slot-icon">${emoji}</div>
                            <div class="slot-count">${current}/${target}</div>
                        </div>`;
                });
            }
        }

        if(rewardsSection) {
            rewardsSection.classList.add('hidden'); 
        }
        
        if(this.modalOver) this.modalOver.classList.remove('hidden');
    }
}