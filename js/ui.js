// UI-related functionality
let backgroundAudio;

// Initialize UI elements
export function initUI() {
    // Prevent duplicate overlays
    if (document.getElementById('loading-overlay')) return;

    // Create loading overlay
    const loadingOverlay = document.createElement('div');
    loadingOverlay.id = 'loading-overlay';
    loadingOverlay.innerHTML = `
        <div class="loading-content">
            <div class="spinner"></div>
            <p>جاري التحميل...</p>
        </div>
    `;
    document.body.appendChild(loadingOverlay);

    // Create game UI
    const gameUI = document.createElement('div');
    gameUI.id = 'gameUI';
    gameUI.innerHTML = `
        <div id="score">0</div>
        <div id="coins">0</div>
        <div id="smallHits">0</div>
        <div id="dogWarning" style="display: none;">
            <span>⚠️ الكلب يقترب!</span>
            <span id="dogDistance">50</span>
        </div>
    `;
    document.body.appendChild(gameUI);

    // Create game over screen
    const gameOver = document.createElement('div');
    gameOver.id = 'gameOver';
    gameOver.style.display = 'none';
    gameOver.innerHTML = `
        <h2 id="gameOverTitle">انتهت اللعبة!</h2>
        <p id="gameOverReason">اصطدمت بعقبة كبيرة</p>
        <p>النتيجة النهائية: <span id="finalScore">0</span></p>
        <p>العملات: <span id="finalCoins">0</span></p>
        <button onclick="restartGame()">العب مرة أخرى</button>
    `;
    document.body.appendChild(gameOver);

    // Create start menu overlay
    const startMenu = document.createElement('div');
    startMenu.id = 'startMenu';
    startMenu.style.display = 'none';
    startMenu.innerHTML = `
        <video id="startMenuVideo" src="start.mp4" autoplay loop muted playsinline style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; object-fit: cover; z-index: 0;"></video>
        <video id="transitionVideo" src="transition.mp4" style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; object-fit: cover; z-index: 2; display: none;"></video>
        <div id="startMenuContent" style="position: relative; z-index: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; width: 100%;">
            <h2 style="color: white; text-shadow: 2px 2px 8px #000;">Start Game</h2>
            <button id="startButton">Start</button>
        </div>
    `;
    document.body.appendChild(startMenu);

    // Start playing the start menu video
    const startMenuVideo = document.getElementById('startMenuVideo');
    startMenuVideo.play().catch(() => {
        // If autoplay fails, try to play on first user interaction
        document.addEventListener('click', () => {
            startMenuVideo.play();
        }, { once: true });
    });

    // Add CSS
    const style = document.createElement('style');
    style.textContent = `
        #loading-overlay {
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: url('load.jpeg') center center / cover no-repeat, rgba(0, 0, 0, 0.8);
            display: flex;
            justify-content: center;
            align-items: center;
            z-index: 1000;
        }
        .loading-content {
            text-align: center;
            color: white;
        }
        .spinner {
            width: 50px;
            height: 50px;
            border: 5px solid #f3f3f3;
            border-top: 5px solid #3498db;
            border-radius: 50%;
            animation: spin 1s linear infinite;
            margin: 0 auto 20px;
        }
        @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
        }
        #gameUI {
            position: fixed;
            top: 20px;
            left: 20px;
            color: white;
            font-size: 24px;
            z-index: 100;
        }
        #dogWarning {
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: rgba(255, 0, 0, 0.8);
            color: white;
            padding: 20px;
            border-radius: 10px;
            font-size: 24px;
            z-index: 100;
        }
        #gameOver {
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: rgba(0, 0, 0, 0.9);
            color: white;
            padding: 40px;
            border-radius: 20px;
            text-align: center;
            z-index: 1000;
        }
        #gameOver button {
            background: #3498db;
            color: white;
            border: none;
            padding: 15px 30px;
            font-size: 20px;
            border-radius: 10px;
            cursor: pointer;
            margin-top: 20px;
        }
        #gameOver button:hover {
            background: #2980b9;
        }
        #startMenu {
            position: fixed;
            top: 0;
            left: 0;
            width: 100vw;
            height: 100vh;
            background: rgba(0, 0, 0, 0.7);
            color: white;
            border-radius: 0;
            text-align: center;
            z-index: 1000;
            display: flex;
            align-items: center;
            justify-content: center;
            overflow: hidden;
        }
        #startMenu button {
            background: #3498db;
            color: white;
            border: none;
            padding: 15px 30px;
            font-size: 20px;
            border-radius: 10px;
            cursor: pointer;
            margin-top: 20px;
            z-index: 2;
        }
        #startMenu button:hover {
            background: #2980b9;
        }
        #startMenuVideo {
            position: absolute;
            top: 0;
            left: 0;
            width: 100vw;
            height: 100vh;
            object-fit: cover;
            z-index: 0;
        }
        #startMenuContent {
            position: relative;
            z-index: 1;
            width: 100vw;
            height: 100vh;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
        }
    `;
    document.head.appendChild(style);

    // Add event listener to start button
    document.getElementById('startButton').addEventListener('click', handleStartGame);
}

// Update score display
export function updateScoreDisplay(score, coins) {
    document.getElementById('score').textContent = Math.floor(score);
    document.getElementById('coins').textContent = coins;
}

// Update dog warning
export function updateDogWarning(distance, isVisible) {
    const warning = document.getElementById('dogWarning');
    warning.style.display = isVisible ? 'block' : 'none';
    if (isVisible) {
        document.getElementById('dogDistance').textContent = Math.floor(distance);
    }
}

// Update small hits counter
export function updateSmallHits(hits) {
    document.getElementById('smallHits').textContent = hits;
}

// Show game over screen
export function showGameOver(score, coins, reason, smallHits) {
    const gameOver = document.getElementById('gameOver');
    const gameOverTitle = document.getElementById('gameOverTitle');
    const gameOverReason = document.getElementById('gameOverReason');
    
    document.getElementById('finalScore').textContent = Math.floor(score);
    document.getElementById('finalCoins').textContent = coins;
    
    if (reason === 'dog') {
        gameOverTitle.textContent = 'أمسك بك الكلب!';
        gameOverReason.textContent = `تم القبض عليك بعد ${smallHits} اصطدامات صغيرة`;
    } else {
        gameOverTitle.textContent = 'انتهت اللعبة!';
        gameOverReason.textContent = 'اصطدمت بعقبة كبيرة';
    }
    
    gameOver.style.display = 'block';
    document.getElementById('dogWarning').style.display = 'none';
}

// Hide game over screen
export function hideGameOver() {
    document.getElementById('gameOver').style.display = 'none';
}

// Hide loading overlay
export function hideLoadingOverlay() {
    const overlay = document.getElementById('loading-overlay');
    if (overlay) overlay.style.display = 'none';
}

// Background music handling
export function initBackgroundMusic() {
    if (!backgroundAudio) {
        backgroundAudio = new Audio('sound/Allaoui.mp3');
        backgroundAudio.loop = true;
        backgroundAudio.volume = 0.5;
    }
}

export function playBackgroundMusic() {
    if (backgroundAudio && backgroundAudio.paused) {
        backgroundAudio.play().catch(() => {}); // Ignore autoplay errors
    }
}

export function stopBackgroundMusic() {
    if (backgroundAudio && !backgroundAudio.paused) {
        backgroundAudio.pause();
        backgroundAudio.currentTime = 0;
    }
}

// Create warning effect for small obstacle hits
export function createWarningEffect() {
    const flash = document.createElement('div');
    flash.style.position = 'fixed';
    flash.style.top = '0';
    flash.style.left = '0';
    flash.style.width = '100%';
    flash.style.height = '100%';
    flash.style.backgroundColor = 'rgba(255, 0, 0, 0.3)';
    flash.style.pointerEvents = 'none';
    flash.style.zIndex = '150';
    document.body.appendChild(flash);
    
    setTimeout(() => {
        document.body.removeChild(flash);
    }, 200);
}

// Show start menu
export function showStartMenu() {
    document.getElementById('startMenu').style.display = 'block';
}

// Hide start menu
export function hideStartMenu() {
    document.getElementById('startMenu').style.display = 'none';
}

// Change the function to be a regular function instead of export
function handleStartGame() {
    const startMenu = document.getElementById('startMenu');
    const startMenuContent = document.getElementById('startMenuContent');
    const startMenuVideo = document.getElementById('startMenuVideo');
    const transitionVideo = document.getElementById('transitionVideo');
    
    // Hide the start menu content
    startMenuContent.style.display = 'none';
    
    // Hide start menu video and show transition video
    startMenuVideo.style.display = 'none';
    transitionVideo.style.display = 'block';
    transitionVideo.currentTime = 0;
    transitionVideo.play();

    // Start the game when the transition video ends
    transitionVideo.onended = () => {
        startMenu.style.display = 'none';
        window.startGame();
    };
} 