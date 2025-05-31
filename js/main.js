import { LANE_WIDTH, JUMP_FORCE, GRAVITY, SLIDE_HEIGHT, DOG_CATCH_DISTANCE } from './config.js';
import { 
    createPlayer, updatePlayer, activateFlyPowerUp, resetPlayerState,
    incrementLane, decrementLane, setCurrentLane, setPlayerY,
    setIsJumping, setIsSliding, setJumpVelocity, getCurrentLane,
    getPlayerY, getIsJumping, getIsSliding, getJumpVelocity,
    isFlying, player, playerY, isJumping, isSliding, jumpVelocity,
    currentLane, playerMixer, isModelLoaded, setupInputHandlers,
    setGameRunning
} from './player.js';
import {
    initUI, updateScoreDisplay, updateDogWarning, updateSmallHits,
    showGameOver, hideGameOver, hideLoadingOverlay, initBackgroundMusic,
    playBackgroundMusic, stopBackgroundMusic, createWarningEffect,
    showStartMenu, hideStartMenu
} from './ui.js';
import {
    createObstacle, createCoin, createPowerUp, createParticleEffect,
    updateParticles, disposeObject
} from './interactables.js';
        
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
let flyTimeout = null;

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
        // Initialize the game
        function init() {
            // Initialize UI
            initUI();
            initBackgroundMusic();
            
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
            createGround(assetLoaded);
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
                
                // Animation setup
                if (gltf.animations && gltf.animations.length > 0) {
                    dogMixer = new THREE.AnimationMixer(dog);
                    const action = dogMixer.clipAction(gltf.animations[0]);
                    action.play();
                }
            }, undefined, function(error) {
                console.log('Dog model not found, using simple geometry');
                // Create a simple dog using basic geometries as fallback
            const dogGroup = new THREE.Group();
            
            // Dog body
            const bodyGeometry = new THREE.BoxGeometry(2, 1, 3);
            const dogMaterial = new THREE.MeshLambertMaterial({ color: 0x8B4513 });
            const body = new THREE.Mesh(bodyGeometry, dogMaterial);
            body.position.y = 0.5;
            body.castShadow = true;
            dogGroup.add(body);
            
            // Dog head
            const headGeometry = new THREE.SphereGeometry(0.8, 16, 16);
            const head = new THREE.Mesh(headGeometry, dogMaterial);
            head.position.set(0, 1.2, 1.2);
            head.castShadow = true;
            dogGroup.add(head);
            
            // Dog ears
            const earGeometry = new THREE.ConeGeometry(0.3, 0.8, 8);
            const leftEar = new THREE.Mesh(earGeometry, dogMaterial);
            leftEar.position.set(-0.4, 1.8, 1.2);
            leftEar.rotation.z = 0.3;
            dogGroup.add(leftEar);
            
            const rightEar = new THREE.Mesh(earGeometry, dogMaterial);
            rightEar.position.set(0.4, 1.8, 1.2);
            rightEar.rotation.z = -0.3;
            dogGroup.add(rightEar);
            
            // Dog legs
            const legGeometry = new THREE.CylinderGeometry(0.2, 0.2, 1);
            const legPositions = [
                [-0.7, -0.5, 1], [0.7, -0.5, 1],
                [-0.7, -0.5, -1], [0.7, -0.5, -1]
            ];
            
            legPositions.forEach(pos => {
                const leg = new THREE.Mesh(legGeometry, dogMaterial);
                leg.position.set(pos[0], pos[1], pos[2]);
                leg.castShadow = true;
                dogGroup.add(leg);
            });
            
            // Dog tail
            const tailGeometry = new THREE.CylinderGeometry(0.1, 0.2, 1.5);
            const tail = new THREE.Mesh(tailGeometry, dogMaterial);
            tail.position.set(0, 1, -2);
            tail.rotation.x = -0.5;
            dogGroup.add(tail);
            
            // Dog eyes
            const eyeGeometry = new THREE.SphereGeometry(0.1, 8, 8);
            const eyeMaterial = new THREE.MeshLambertMaterial({ color: 0xff0000 });
            const leftEye = new THREE.Mesh(eyeGeometry, eyeMaterial);
            leftEye.position.set(-0.3, 1.3, 1.8);
            dogGroup.add(leftEye);
            
            const rightEye = new THREE.Mesh(eyeGeometry, eyeMaterial);
            rightEye.position.set(0.3, 1.3, 1.8);
            dogGroup.add(rightEye);
            
            dog = dogGroup;
            dog.position.set(0, 0, dogPosition);
            dog.scale.set(1.5, 1.5, 1.5);
            scene.add(dog);
            });
        }
        
        // Update world
        function updateWorld() {
            // Move ground
            ground.forEach(segment => {
                segment.position.z += gameSpeed;
                if (segment.position.z > 20) {
                    segment.position.z -= 200;
                }
            });
            
            // Move and remove obstacles
            for (let i = obstacles.length - 1; i >= 0; i--) {
                const obstacle = obstacles[i];
                obstacle.position.z += gameSpeed;
                
                if (obstacle.position.z > 10) {
                    scene.remove(obstacle);
                    obstacles.splice(i, 1);
                }
            }
            
            // Move and remove coins
            for (let i = coins.length - 1; i >= 0; i--) {
                const coin = coins[i];
                coin.position.z += gameSpeed;
                coin.rotation.y += 0.1;
                
                if (coin.position.z > 10) {
                    scene.remove(coin);
                    coins.splice(i, 1);
                }
            }
            
            // Move dog with world
            if (dog && !isDogChasing) {
                dog.position.z += gameSpeed;
            }
            
            // Spawn new obstacles and coins
            if (Math.random() < 0.02) {
                const lane = Math.floor(Math.random() * 3) - 1;
                const types = ['barrier', 'low', 'train', 'slide_barrier'];
                const type = types[Math.floor(Math.random() * types.length)];
                const obstacle = createObstacle(type, lane, -100 - Math.random() * 50, scene, isLowEndDevice);
                obstacles.push(obstacle);
            }
            
            if (Math.random() < 0.03) {
                const lane = Math.floor(Math.random() * 3) - 1;
                const coin = createCoin(lane, -80 - Math.random() * 40, scene);
                coins.push(coin);
            }
            
            // Spawn power-up occasionally
            if (Math.random() < 0.01) {
                const lane = Math.floor(Math.random() * 3) - 1;
                const powerUp = createPowerUp(lane, -90 - Math.random() * 40, scene);
                powerUps.push(powerUp);
            }
            
            // Move and remove power-ups
            for (let i = powerUps.length - 1; i >= 0; i--) {
                const powerUp = powerUps[i];
                powerUp.position.z += gameSpeed;
                if (powerUp.position.z > 10) {
                    scene.remove(powerUp);
                    powerUps.splice(i, 1);
                }
            }
            
            // Regular memory cleanup
            if (frameCount % 300 === 0) { // Every 5 seconds at 60fps
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
            stopBackgroundMusic();
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
            playBackgroundMusic();
            
            // Reset power-ups and fly state
            powerUps.forEach(p => scene.remove(p));
            powerUps.length = 0;
            isFlying = false;
            if (flyTimeout) clearTimeout(flyTimeout);
            resetPlayerState();
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
        
        // Collision detection
        function checkCollisions() {
            if (!player) return;
            // Use a bounding box only around the visible mesh of the player model
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
            playerBox.expandByScalar(0.5); // Slightly expand for GLB model
            
            // Check obstacle collisions
            obstacles.forEach(obstacle => {
                const obstacleBox = new THREE.Box3().setFromObject(obstacle);
                // Fix: Only trigger game over for slide_barrier if player is NOT sliding, otherwise ignore collision
                if (playerBox.intersectsBox(obstacleBox)) {
                    if (obstacle.obstacleType === 'low' && isJumping && playerY > 2) {
                        return; // Jumped over low obstacle
                    }
                    if (obstacle.obstacleType === 'barrier' && isSliding) {
                        return; // Slid under barrier
                    }
                    if (obstacle.obstacleType === 'slide_barrier') {
                        if (isSliding) {
                            // Player is sliding, ignore collision
                            return;
                        } else {
                            // Not sliding, game over
                            gameOver('obstacle');
                            return;
                        }
                    }
                    // Handle different collision types
                    if (obstacle.obstacleType === 'low') {
                        // Small obstacle hit - don't end game, but trigger dog chase
                        handleSmallObstacleHit();
                        // Remove the obstacle so it doesn't hit again
                        scene.remove(obstacle);
                        const index = obstacles.indexOf(obstacle);
                        if (index > -1) {
                            obstacles.splice(index, 1);
                        }
                    } else {
                        // Large obstacle hit - end game immediately
                        gameOver('obstacle');
                    }
                }
            });
            
            // Check coin collisions
            for (let i = coins.length - 1; i >= 0; i--) {
                const coin = coins[i];
                const coinBox = new THREE.Box3().setFromObject(coin);
                if (playerBox.intersectsBox(coinBox)) {
                    scene.remove(coin);
                    coins.splice(i, 1);
                    coinsCollected++;
                    score += 10;
                    // Update UI using the proper function
                    updateScoreDisplay(score, coinsCollected);
                    // Coin collect effect with scene parameter
                    const newParticles = createParticleEffect(coin.position, scene);
                    particles.push(...newParticles);
                }
            }
            
            // Check power-up collisions
            for (let i = powerUps.length - 1; i >= 0; i--) {
                const powerUp = powerUps[i];
                const powerUpBox = new THREE.Box3().setFromObject(powerUp);
                if (playerBox.intersectsBox(powerUpBox)) {
                    scene.remove(powerUp);
                    powerUps.splice(i, 1);
                    activateFlyPowerUp();
                }
            }
        }
        
        // Main animation loop
        function animate() {
            requestAnimationFrame(animate);
            if (isModelLoaded) {
                updatePlayer(keys, camera, isFlying);
                updateDog();
                if (isGameRunning) {
                    updateWorld();
                    checkCollisions();
                    updateParticles(particles, scene);
                    updateScore();
                }
            }
            // Update player animation (faster)
            if (playerMixer) playerMixer.update(1/45); // Double speed
            // Update dog animation
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
    document.addEventListener('click', playBackgroundMusic, { once: true });
    document.addEventListener('keydown', playBackgroundMusic, { once: true });

// Create ground
function createGround(onTileLoaded) {
    const loader = new THREE.GLTFLoader();
    const TILE_LENGTH = 40; // Adjust based on your floor.glb size
    for (let i = 0; i < NUM_FLOOR_TILES; i++) {
        loader.load('floor.glb', function(gltf) {
            const floorTile = gltf.scene;
            floorTile.position.set(0, 22, -i * TILE_LENGTH);
            floorTile.scale.set(40, 80, 80); // Taller floor (Y=40)
            floorTile.rotation.y = Math.PI / 2; // Rotate 90 degrees
            floorTile.traverse(function(child) {
                if (child.isMesh) {
                    child.castShadow = true;
                    child.receiveShadow = true;
                    // Make the floor whiter
                    if (child.material) {
                        child.material.color.set(0xffffff); // Pure white
                        child.material.needsUpdate = true;
                    }
                }
            });
            scene.add(floorTile);
            ground.push(floorTile);
            if (onTileLoaded) onTileLoaded();
        });
    }
}

// Update dog position and behavior
function updateDog() {
    if (!dog) return;
    
    // Dog follows player's lane slowly
    const targetX = currentLane * LANE_WIDTH;
    dog.position.x += (targetX - dog.position.x) * 0.05;
    
    // If dog is chasing, move it closer to player
    if (isDogChasing && dogPosition > DOG_CATCH_DISTANCE) {
        dogPosition -= dogSpeed;
        dog.position.z = dogPosition;
        
        // Update dog warning UI
        updateDogWarning(dogPosition, true);
        
        // Make dog run animation (simple up-down movement)
        dog.position.y = Math.sin(Date.now() * 0.01) * 0.2;
        
        // Check if dog caught the player
        if (dogPosition <= DOG_CATCH_DISTANCE) {
            gameOver('dog');
        }
    } else {
        updateDogWarning(0, false);
    }
}

