import { LANE_WIDTH, JUMP_FORCE, GRAVITY, SLIDE_HEIGHT, DOG_CATCH_DISTANCE } from './config.js';
import { 
    createPlayer, updatePlayer, activateJumpBoostPowerUp, resetPlayerState,
    incrementLane, decrementLane, setCurrentLane, setPlayerY,
    setIsJumping, setIsSliding, setJumpVelocity, getCurrentLane,
    getPlayerY, getIsJumping, getIsSliding, getJumpVelocity,
    player, playerY, isJumping, isSliding, jumpVelocity,
    currentLane, playerMixer, isModelLoaded, setupInputHandlers,
    setGameRunning, playHitAnimation, playHitAnimationAndFreeze
} from './player.js';
import {
    initUI, updateScoreDisplay, updateDogWarning, updateSmallHits,
    showGameOver, hideGameOver, hideLoadingOverlay, initBackgroundMusic,
    playBackgroundMusic, stopBackgroundMusic, createWarningEffect,
    showStartMenu, hideStartMenu, updateLevelDisplay
} from './ui.js';
import { createObstacle, updateMovingObstacles, checkObstacleCollisions } from './obstacle.js';
import { createCoin, createPowerUp, createParticleEffect,
    updateParticles, disposeObject, updateChicken
} from './interactables.js';
import { createGround, updateGround, disposeGround } from './ground.js';
import { 
    initSounds, playBackgroundMusic as playBGMusic, stopBackgroundMusic as stopBGMusic, playJumpSound, playDogBark, playChickenSound
} from './sound.js';
        
// Game variables
let scene, camera, renderer, ground = [];
let obstacles = [], coins = [], particles = [];
let gameSpeed = 0.2, score = 0, coinsCollected = 0;
let isGameRunning = false;
let keys = {};

// Dog chase variables
let dog, dogPosition = 50; // Dog starts 50 units behind
let smallObstacleHits = 0;
let dogSpeed = 0.1;
let isDogChasing = false;
let dogMixer; // Animation mixer for dog
let frameCount = 0;

// Mouse/touch controls
let isDragging = false, dragStartX = 0, dragStartY = 0;
let lastDragX = 0, lastDragY = 0;
let isLowEndDevice = false;
let maxObstacles = 10;
let maxCoins = 8;
let maxParticles = 16;
let powerUps = [];

// Caches for performance optimization
const geometryCache = new Map();
const materialCache = new Map();
const textureCache = new Map();

// Asset loading tracker
let assetsLoaded = 0;
const NUM_FLOOR_TILES = 6; // Number of floor tiles to repeat
const TOTAL_ASSETS = 1 + NUM_FLOOR_TILES; // 1 player + floor tiles

function assetLoaded() {
    assetsLoaded++;
    console.log('Asset loaded:', assetsLoaded, '/', TOTAL_ASSETS);
    if (assetsLoaded === TOTAL_ASSETS) {
        console.log('All assets loaded, hiding overlay');
        hideLoadingOverlay();
        showStartMenu(); // Show start menu after loading
    }
}

// Performance monitoring
function detectDeviceCapabilities() {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
    
    // Check available memory (rough estimation)
    const memoryInfo = gl && gl.getExtension('WEBGL_debug_renderer_info');
    const renderer = memoryInfo && gl.getParameter(memoryInfo.UNMASKED_RENDERER_WEBGL);
    
    // Check device indicators
    const userAgent = navigator.userAgent.toLowerCase();
    const isMobile = /mobile|android|iphone|ipad/.test(userAgent);
    const isLowRAM = navigator.deviceMemory && navigator.deviceMemory <= 2;
    const isSlowConnection = navigator.connection && navigator.connection.effectiveType === 'slow-2g';
    
    // Determine if low-end device
    isLowEndDevice = isMobile || isLowRAM || isSlowConnection || 
                     (renderer && /adreno 3|mali-4|powervr sgx/i.test(renderer));
    
    if (isLowEndDevice) {
        maxObstacles = 3;
        maxCoins = 2;
        maxParticles = 4;
        console.log('Low-end device detected - reducing quality settings (aggressive)');
    }
    
    canvas.remove();
}

// Optimized geometry creation with caching
function getCachedGeometry(key, createGeometry) {
    if (!geometryCache.has(key)) {
        geometryCache.set(key, createGeometry());
    }
    return geometryCache.get(key);
}

// Optimized material creation with caching
function getCachedMaterial(key, createMaterial) {
    if (!materialCache.has(key)) {
        materialCache.set(key, createMaterial());
    }
    return materialCache.get(key);
}

// Optimized texture loading with caching
function getCachedTexture(url) {
    if (!textureCache.has(url)) {
        const loader = new THREE.TextureLoader();
        const texture = loader.load(url);
        // Optimize texture settings for mobile
        texture.generateMipmaps = !isLowEndDevice;
        texture.minFilter = isLowEndDevice ? THREE.LinearFilter : THREE.LinearMipmapLinearFilter;
        texture.magFilter = THREE.LinearFilter;
        textureCache.set(url, texture);
    }
    return textureCache.get(url);
}

// Monitor performance
function monitorPerformance() {
    frameCount++;
    const now = performance.now();
    
    if (now - lastFPSCheck >= 1000) {
        currentFPS = Math.round((frameCount * 1000) / (now - lastFPSCheck));
        frameCount = 0;
        lastFPSCheck = now;
        
        // Adjust quality based on performance
        if (currentFPS < 30 && !isLowEndDevice) {
            isLowEndDevice = true;
            maxObstacles = 6;
            maxCoins = 4;
            maxParticles = 8;
            console.log('Performance degraded - switching to low quality mode');
        }
    }
}
let lastFPSCheck = 0;
let currentFPS = 60;
        
// --- LEVEL SYSTEM (Enhanced Difficulty) ---
let currentLevel = 1;
let levelStartTime = 0;
let gameStartTime = 0;
let levelDuration = 30000; // 30 seconds per level
let difficultyMultiplier = 1;

const LEVEL_CONFIG = {
    1: {
        name: "Beginner Valley",
        obstacles: ['low', 'barrier'],
        spawnRate: 0.015,
        maxObstacles: 2,
        speedMultiplier: 1.0,
        description: "Welcome! Just basic obstacles to get started."
    },
    2: {
        name: "Easy Plains",
        obstacles: ['low', 'barrier', 'train'],
        spawnRate: 0.018,
        maxObstacles: 3,
        speedMultiplier: 1.1,
        description: "Trains appear! Watch out for longer obstacles."
    },
    3: {
        name: "Moderate Hills",
        obstacles: ['low', 'barrier', 'train', 'slide_barrier'],
        spawnRate: 0.020,
        maxObstacles: 4,
        speedMultiplier: 1.2,
        description: "Slide barriers introduced! Use sliding to get under them."
    },
    4: {
        name: "Challenging Forest",
        obstacles: ['low', 'barrier', 'train', 'slide_barrier', 'swinging_log'],
        spawnRate: 0.022,
        maxObstacles: 5,
        speedMultiplier: 1.3,
        description: "Swinging logs! Time your movements carefully."
    },
    5: {
        name: "Advanced Canyon",
        obstacles: ['low', 'barrier', 'train', 'slide_barrier', 'swinging_log', 'sliding_barrier'],
        spawnRate: 0.025,
        maxObstacles: 6,
        speedMultiplier: 1.4,
        description: "Moving barriers! They slide back and forth."
    },
    6: {
        name: "Expert Mountains",
        obstacles: ['barrier', 'train', 'slide_barrier', 'swinging_log', 'sliding_barrier', 'rotating_hammer'],
        spawnRate: 0.028,
        maxObstacles: 7,
        speedMultiplier: 1.5,
        description: "Rotating hammers! The ultimate challenge begins."
    },
    7: {
        name: "Master Peak",
        obstacles: ['train', 'slide_barrier', 'swinging_log', 'sliding_barrier', 'rotating_hammer'],
        spawnRate: 0.030,
        maxObstacles: 8,
        speedMultiplier: 1.6,
        description: "Only the hardest obstacles remain!"
    },
    8: {
        name: "Legendary Summit",
        obstacles: ['slide_barrier', 'swinging_log', 'sliding_barrier', 'rotating_hammer'],
        spawnRate: 0.035,
        maxObstacles: 10,
        speedMultiplier: 1.7,
        description: "Maximum difficulty! Good luck!"
    }
};

function getCurrentLevelConfig() {
    return LEVEL_CONFIG[currentLevel] || LEVEL_CONFIG[8];
}

function updateLevel() {
    const currentTime = Date.now();
    const totalPlayTime = currentTime - gameStartTime;
    const newLevel = Math.floor(totalPlayTime / levelDuration) + 1;
    if (newLevel !== currentLevel && newLevel <= Object.keys(LEVEL_CONFIG).length) {
        currentLevel = newLevel;
        levelStartTime = currentTime;
        showLevelUpNotification(currentLevel);
        difficultyMultiplier = getCurrentLevelConfig().speedMultiplier;
        updateLevelDisplay(currentLevel);
        console.log(`Level Up! Now at level ${currentLevel}: ${getCurrentLevelConfig().name}`);
        console.log(`Description: ${getCurrentLevelConfig().description}`);
    }
}

function spawnObstacleBasedOnLevel() {
    const levelConfig = getCurrentLevelConfig();
    if (Math.random() < levelConfig.spawnRate) {
        if (obstacles.length >= levelConfig.maxObstacles) return;
        const lane = Math.floor(Math.random() * 3) - 1;
        const availableObstacles = levelConfig.obstacles;
        const obstacleType = availableObstacles[Math.floor(Math.random() * availableObstacles.length)];
        const spawnDistance = -80 - (currentLevel * 10) - Math.random() * 30;
        const obstacle = createObstacle(obstacleType, lane, spawnDistance, scene, isLowEndDevice);
        obstacles.push(obstacle);
        console.log(`Spawned ${obstacleType} at level ${currentLevel} in lane ${lane}`);
    }
}

function updateGameSpeedForLevel() {
    const baseSpeed = 0.2;
    const levelConfig = getCurrentLevelConfig();
    const timeInLevel = (Date.now() - levelStartTime) / levelDuration;
    const levelSpeedBonus = timeInLevel * 0.1;
    gameSpeed = Math.min(0.8, baseSpeed * levelConfig.speedMultiplier + levelSpeedBonus);
}

function initLevelSystem() {
    gameStartTime = Date.now();
    levelStartTime = gameStartTime;
    currentLevel = 1;
    difficultyMultiplier = 1;
    updateLevelDisplay(1);
    console.log(`Starting Level 1: ${getCurrentLevelConfig().name}`);
    console.log(`Description: ${getCurrentLevelConfig().description}`);
}

function resetLevelSystem() {
    initLevelSystem();
    updateLevelDisplay(1);
}

function showLevelUpNotification(level) {
    const levelConfig = getCurrentLevelConfig();
    const notification = document.createElement('div');
    notification.className = 'level-notification';
    notification.innerHTML = `
        <div class="level-up-content">
            <h2>LEVEL ${level}</h2>
            <h3>${levelConfig.name}</h3>
            <p>${levelConfig.description}</p>
        </div>
    `;
    notification.style.cssText = `
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        color: white;
        padding: 20px;
        border-radius: 15px;
        text-align: center;
        z-index: 1000;
        box-shadow: 0 10px 30px rgba(0,0,0,0.3);
        animation: levelUpPulse 3s ease-in-out;
        font-family: Arial, sans-serif;
    `;
    if (!document.querySelector('#levelUpStyles')) {
        const style = document.createElement('style');
        style.id = 'levelUpStyles';
        style.textContent = `
            @keyframes levelUpPulse {
                0% { opacity: 0; transform: translate(-50%, -50%) scale(0.5); }
                20% { opacity: 1; transform: translate(-50%, -50%) scale(1.1); }
                80% { opacity: 1; transform: translate(-50%, -50%) scale(1); }
                100% { opacity: 0; transform: translate(-50%, -50%) scale(0.9); }
            }
            .level-up-content h2 {
                margin: 0 0 10px 0;
                font-size: 2em;
                text-shadow: 2px 2px 4px rgba(0,0,0,0.5);
            }
            .level-up-content h3 {
                margin: 0 0 15px 0;
                font-size: 1.3em;
                color: #ffd700;
            }
            .level-up-content p {
                margin: 0;
                font-size: 1em;
                opacity: 0.9;
            }
        `;
        document.head.appendChild(style);
    }
    document.body.appendChild(notification);
    setTimeout(() => {
        if (notification.parentNode) {
            notification.parentNode.removeChild(notification);
        }
    }, 3000);
}

// Remove the duplicate updateLevelDisplay function definition here.
// Only use the imported updateLevelDisplay from './ui.js'.

function getLevelProgress() {
    const timeSinceStart = Date.now() - levelStartTime;
    return Math.min(1, timeSinceStart / levelDuration);
}
// --- END LEVEL SYSTEM ---

// Initialize the game
function init() {
    // Detect device capabilities first
    detectDeviceCapabilities();
    // Initialize UI
    initUI();
    initSounds();
    initLevelSystem();
    
    // Create scene
    scene = new THREE.Scene();
    if (!isLowEndDevice) {
        scene.fog = new THREE.Fog(0x87ceeb, 50, 200);
    }
    
    // Create camera
    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.set(0, 8, 8);
    
    // Create renderer
    renderer = new THREE.WebGLRenderer({ antialias: !isLowEndDevice });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setClearColor(0x87ceeb);
    renderer.outputEncoding = THREE.sRGBEncoding;
    if (!isLowEndDevice) {
        renderer.shadowMap.enabled = true;
        renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    } else {
        renderer.shadowMap.enabled = false;
    }
    document.getElementById('gameContainer').appendChild(renderer.domElement);
    
    // Create lighting
    const ambientLight = new THREE.AmbientLight(0x404040, 0.6);
    scene.add(ambientLight);
    
    const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
    directionalLight.position.set(0, 20, 10);
    directionalLight.castShadow = true;
    directionalLight.shadow.mapSize.width = 2048;
    directionalLight.shadow.mapSize.height = 2048;
    directionalLight.shadow.camera.near = 0.5;
    directionalLight.shadow.camera.far = 500;
    directionalLight.shadow.camera.left = -50;
    directionalLight.shadow.camera.right = 50;
    directionalLight.shadow.camera.top = 50;
    directionalLight.shadow.camera.bottom = -50;
    scene.add(directionalLight);
    
    createPlayer(scene, assetLoaded);
    createDog();
    createGround(scene, ground, NUM_FLOOR_TILES, assetLoaded);
    setupInputHandlers(renderer, isGameRunning);
    
    animate();
}
        
// Create dog character
function createDog() {
    const loader = new THREE.GLTFLoader();
    loader.load('dog.glb', function(gltf) {
        dog = gltf.scene;
        dog.position.set(0, 0, dogPosition);
        dog.scale.set(1.5, 1.5, 1.5);
        dog.traverse(function(child) {
            if (child.isMesh) {
                child.castShadow = true;
                child.receiveShadow = true;
            }
        });
        scene.add(dog);
        
        // Animation setup (uncomment if you want to use dog animations)
        // if (gltf.animations && gltf.animations.length > 0) {
        //     dogMixer = new THREE.AnimationMixer(dog);
        //     const action = dogMixer.clipAction(gltf.animations[0]);
        //     action.play();
        // }
    });
}
        
// Update world
function updateWorldWithLevels() {
    updateLevel();
    updateGameSpeedForLevel();
    updateGround(ground, gameSpeed);
    for (let i = obstacles.length - 1; i >= 0; i--) {
        const obstacle = obstacles[i];
        obstacle.position.z += gameSpeed;
        if (obstacle.position.z > 10) {
            scene.remove(obstacle);
            obstacles.splice(i, 1);
        }
    }
    updateMovingObstacles(obstacles);
    for (let i = coins.length - 1; i >= 0; i--) {
        const coin = coins[i];
        coin.position.z += gameSpeed;
        coin.rotation.y += 0.1;
        updateChicken(coin);
        if (coin.position.z > 10) {
            scene.remove(coin);
            coins.splice(i, 1);
        }
    }
    if (dog && !isDogChasing) {
        dog.position.z += gameSpeed;
    }
    spawnObstacleBasedOnLevel();
    const coinSpawnRate = 0.03 + (currentLevel * 0.005);
    if (Math.random() < coinSpawnRate) {
        const lane = Math.floor(Math.random() * 3) - 1;
        const coin = createCoin(lane, -80 - Math.random() * 40, scene);
        coins.push(coin);
    }
    const powerUpSpawnRate = Math.max(0.005, 0.015 - (currentLevel * 0.001));
    if (Math.random() < powerUpSpawnRate) {
        const lane = Math.floor(Math.random() * 3) - 1;
        const powerUp = createPowerUp(lane, -90 - Math.random() * 40, scene);
        powerUps.push(powerUp);
    }
    for (let i = powerUps.length - 1; i >= 0; i--) {
        const powerUp = powerUps[i];
        powerUp.position.z += gameSpeed;
        if (powerUp.position.z > 10) {
            scene.remove(powerUp);
            powerUps.splice(i, 1);
        }
    }
    if (frameCount % 300 === 0) {
        cleanupMemory();
    }
    monitorPerformance();
}

// Memory cleanup function
function cleanupMemory() {
    // Remove distant obstacles
    for (let i = obstacles.length - 1; i >= 0; i--) {
        const obstacle = obstacles[i];
        if (obstacle.position.z > 15 || obstacles.length > maxObstacles) {
            disposeObject(obstacle);
            scene.remove(obstacle);
            obstacles.splice(i, 1);
        }
    }
    
    // Remove distant coins
    for (let i = coins.length - 1; i >= 0; i--) {
        const coin = coins[i];
        if (coin.position.z > 15 || coins.length > maxCoins) {
            disposeObject(coin);
            scene.remove(coin);
            coins.splice(i, 1);
        }
    }
    
    // Limit particles
    while (particles.length > maxParticles) {
        const particle = particles.shift();
        disposeObject(particle);
        scene.remove(particle);
    }
    
    // Force garbage collection hint (if available)
    if (window.gc) {
        window.gc();
    }
}
        
// Update score
function updateScore() {
    score += 0.1;
    updateScoreDisplay(score, coinsCollected);
    
    // Increase game speed gradually
    gameSpeed = Math.min(0.5, 0.2 + score * 0.0001);
}
        
// Game over
function gameOver(reason = 'obstacle') {
    isGameRunning = false;
    setGameRunning(false);
    showGameOver(score, coinsCollected, reason, smallObstacleHits);
    if (reason === 'dog') {
        playDogBark();
    }
    stopBGMusic();
}
        
// Restart game
function restartGame() {
    // Reset game state
    isGameRunning = true;
    setGameRunning(true);
    setIsJumping(false);
    setIsSliding(false);
    setCurrentLane(0);
    setJumpVelocity(0);
    setPlayerY(1);
    score = 0;
    coinsCollected = 0;
    gameSpeed = 0.2;
    
    // Reset dog chase variables
    smallObstacleHits = 0;
    isDogChasing = false;
    dogPosition = 50;
    dogSpeed = 0.1;
    
    // Reset drag state
    isDragging = false;
    dragStartX = 0;
    dragStartY = 0;
    lastDragX = 0;
    lastDragY = 0;
    
    // Reset player position
    if (player) {
        player.position.set(0, 1, 0);
        player.scale.set(2.5, 2.5, 2.5);
    }
    
    // Reset dog position
    if (dog) {
        dog.position.set(0, 0, dogPosition);
    }
    
    // Clear obstacles and coins
    obstacles.forEach(obstacle => scene.remove(obstacle));
    obstacles.length = 0;
    coins.forEach(coin => scene.remove(coin));
    coins.length = 0;
    particles.forEach(particle => scene.remove(particle));
    particles.length = 0;
    
    // Update UI
    updateSmallHits(0);
    updateScoreDisplay(0, 0);
    hideGameOver();
    updateDogWarning(0, false);
    
    // Resume background music if user already interacted
    playBGMusic();
    
    // Reset power-ups and fly state
    powerUps.forEach(p => scene.remove(p));
    powerUps.length = 0;
    resetPlayerState();
    resetLevelSystem();
}
        
// Handle small obstacle hit
function handleSmallObstacleHit() {
    smallObstacleHits++;
    updateSmallHits(smallObstacleHits);
    
    // Start dog chase after 3 hits
    if (smallObstacleHits >= 3 && !isDogChasing) {
        isDogChasing = true;
        dogSpeed = 0.15; // Dog starts moving
    }
    
    // Increase dog speed with more hits
    if (isDogChasing) {
        dogSpeed += 0.02;
    }
    
    // Create warning effect
    createWarningEffect();
}
        
// Enhanced collision detection for new obstacle types
function checkCollisions() {
    if (!player) return;
    let playerBox = null;
    player.traverse(function(child) {
        if (child.isMesh) {
            const meshBox = new THREE.Box3().setFromObject(child);
            if (!playerBox) {
                playerBox = meshBox;
            } else {
                playerBox.union(meshBox);
            }
        }
    });
    if (!playerBox) return;
    playerBox.expandByScalar(0.5);
    // Check obstacle collisions with full context
    checkObstacleCollisions(
        player,
        obstacles,
        handleSmallObstacleHit,
        scene,
        isJumping,
        isSliding,
        playerY,
        playHitAnimation,
        playHitAnimationAndFreeze, // Use the imported function directly, not require()
        dog,
        playDogBark,
        setGameRunning,
        gameOver
    );
    // Check coin collisions
    for (let i = coins.length - 1; i >= 0; i--) {
        const coin = coins[i];
        const coinBox = new THREE.Box3().setFromObject(coin);
        if (playerBox.intersectsBox(coinBox)) {
            scene.remove(coin);
            coins.splice(i, 1);
            coinsCollected++;
            score += 10;
            updateScoreDisplay(score, coinsCollected);
            const newParticles = createParticleEffect(coin.position, scene);
            particles.push(...newParticles);
            playChickenSound();
        }
    }
    // Check power-up collisions
    for (let i = powerUps.length - 1; i >= 0; i--) {
        const powerUp = powerUps[i];
        const powerUpBox = new THREE.Box3().setFromObject(powerUp);
        if (playerBox.intersectsBox(powerUpBox)) {
            scene.remove(powerUp);
            powerUps.splice(i, 1);
            activateJumpBoostPowerUp();
        }
    }
}

// Handle large obstacle collision
// function handleLargeObstacleHit(obstacle) {
//     const obstacleBox = new THREE.Box3().setFromObject(obstacle);
//     const playerBox = new THREE.Box3().setFromObject(player);
//     player.position.z = obstacleBox.max.z + (playerBox.max.z - playerBox.min.z) / 2 + 0.1;
//     playHitAnimationAndFreeze(isJumping);
    
//     if (dog && player) {
//         dog.position.set(player.position.x, player.position.y, player.position.z + 1.5);
//         playDogBark();
//         if (dog.lookAt) dog.lookAt(player.position);
//     }
    
//     isGameRunning = false;
//     setGameRunning(false);
//     setTimeout(() => {
//         gameOver('obstacle');
//     }, 700);
// }
        
// Main animation loop
function animate() {
    requestAnimationFrame(animate);
    if (isModelLoaded) {
        updatePlayer(keys, camera, false);
        if (isGameRunning) {
            updateWorldWithLevels();
            checkCollisions();
            updateParticles(particles, scene);
            updateScore();
            // Update level progress bar
            const progress = getLevelProgress() * 100;
            const progressBar = document.getElementById('levelProgressBar');
            if (progressBar) {
                progressBar.style.width = `${progress}%`;
            }
        }
    }
    if (playerMixer) playerMixer.update(1/45);
    if (dogMixer) dogMixer.update(1/45);
    renderer.render(scene, camera);
}
        
// Expose restartGame to global window object
window.restartGame = restartGame;
        
// Expose startGame to global window object
window.startGame = function() {
    hideStartMenu();
    isGameRunning = true;
    setGameRunning(true);
};
        
// Ensure these are available globally for obstacle.js collision/game over logic
window.isJumping = isJumping;
window.isGameRunning = isGameRunning;
window.setGameRunning = setGameRunning;
window.playHitAnimationAndFreeze = playHitAnimationAndFreeze;
window.dog = dog;
window.player = player;
window.playDogBark = playDogBark;
window.gameOver = gameOver;
        
// Start the game
init();
        
// Handle window resize
window.addEventListener('resize', () => {
    // Update camera aspect ratio
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    
    // Update renderer size and pixel ratio
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
});
        
// Play music after user interaction
document.addEventListener('click', playBGMusic, { once: true });
document.addEventListener('keydown', playBGMusic, { once: true });