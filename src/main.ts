import './style.css';
import { Engine } from './core/Engine';
import { GameScene } from './game/GameScene';
import { GameState } from './core/GameStateManager';
import { UIManager } from './ui/UIManager';

async function bootstrap() {
    try {
        const engine = new Engine('game-canvas');
        const gameScene = new GameScene(engine.scene, engine.camera);
        
        const uiManager = new UIManager(engine.stateManager, {
            onPlay: () => {
                gameScene.reset();
                engine.stateManager.changeState(GameState.Playing);
            },
            onResume: () => {
                engine.stateManager.changeState(GameState.Playing);
            },
            onRestart: () => {
                gameScene.reset();
                engine.stateManager.changeState(GameState.Playing);
            }
        });
        
        engine.addUpdatable(gameScene);
        
        gameScene.scoreTracker.onScoreUpdated = (score: number) => {
            uiManager.updateLiveScore(score);
        };
        
        gameScene.onGameOver = () => {
            uiManager.updateFinalScores(gameScene.scoreTracker.score, gameScene.scoreTracker.highestScore);
            engine.stateManager.changeState(GameState.GameOver);
        };
        
        // Handle BGM Playback
        engine.stateManager.onStateChange((state) => {
            if (state === GameState.Playing) {
                gameScene.audioManager.playBGM();
            } else if (state === GameState.Paused) {
                gameScene.audioManager.pauseBGM();
            }
        });
        
        await engine.start();
        
        // HMR Lifecycle Management
        const meta = import.meta as any;
        if (meta.hot) {
            meta.hot.dispose(() => {
                engine.dispose();
                // Clean up any remaining global DOM elements added by this module
                const container = document.getElementById('game-canvas');
                if (container) {
                    // Not disposing the canvas itself, just the engine bindings
                }
            });
        }
        
    } catch (error) {
        console.error("Failed to bootstrap game:", error);
    }
}

bootstrap();
