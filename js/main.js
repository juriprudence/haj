import { LANE_WIDTH, JUMP_FORCE, GRAVITY, SLIDE_HEIGHT, DOG_CATCH_DISTANCE } from './config.js';
import { createPlayer, updatePlayer, activateFlyPowerUp, resetPlayerState, incrementLane, decrementLane, setCurrentLane, setPlayerY, setIsJumping, setIsSliding, setJumpVelocity, getCurrentLane, getPlayerY, getIsJumping, getIsSliding, getJumpVelocity, isFlying, player, playerY, isJumping, isSliding, jumpVelocity, currentLane, playerMixer, isModelLoaded } from './player.js';
        
        // Game variables
        let scene, camera, renderer, ground = [];
        let obstacles = [], coins = [], particles = [];
        let gameSpeed = 0.2, score = 0, coinsCollected = 0;
        let isGameRunning = true;
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
let textureCache = new Map();
let geometryCache = new Map();
let materialCache = new Map();
let powerUps = [];
let flyTimeout = null;

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

// Dispose of 3D objects properly
function disposeObject(obj) {
    if (obj.geometry && !geometryCache.has(obj.geometry.uuid)) {
        obj.geometry.dispose();
    }
    if (obj.material) {
        if (obj.material.map && !textureCache.has(obj.material.map.image?.src)) {
            obj.material.map.dispose();
        }
        if (!materialCache.has(obj.material.uuid)) {
            obj.material.dispose();
        }
    }
    if (obj.children) {
        obj.children.forEach(child => disposeObject(child));
    }
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
            
            createPlayer(scene);
            createDog();
            createGround();
            setupEventListeners();
            
            animate();
        }
        
        // Create dog character
        function createDog() {
            // Create a simple dog using basic geometries
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
        
        // Remove old createGround and replace with GLB floor tiling
        function createGround() {
            const loader = new THREE.GLTFLoader();
            const NUM_TILES = 6; // Number of floor tiles to repeat
            const TILE_LENGTH = 40; // Adjust based on your floor.glb size
            for (let i = 0; i < NUM_TILES; i++) {
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
                });
            }
        }
        
        // Utility to set custom UVs for a box so the texture appears once per face
        function setBoxUVs(geometry) {
            const uv = [
                0, 0,  1, 0,  1, 1,  0, 1, // face 1
                0, 0,  1, 0,  1, 1,  0, 1, // face 2
                0, 0,  1, 0,  1, 1,  0, 1, // face 3
                0, 0,  1, 0,  1, 1,  0, 1, // face 4
                0, 0,  1, 0,  1, 1,  0, 1, // face 5
                0, 0,  1, 0,  1, 1,  0, 1  // face 6
            ];
            geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
        }
        
        // Create obstacle
        function createObstacle(type, lane, z) {
            let obstacle;
            const x = lane * LANE_WIDTH;
            // Use cached texture instead of loading it every time
            const obstacleTexture = getCachedTexture('texture/gen.jpeg');
            obstacleTexture.wrapS = THREE.RepeatWrapping;
            obstacleTexture.wrapT = THREE.RepeatWrapping;
            obstacleTexture.repeat.set(1, 1); // Show image once per face
            switch (type) {
                case 'barrier':
                    const barrierGeometry = new THREE.BoxGeometry(2, 3, 1);
                    setBoxUVs(barrierGeometry);
                    const barrierMaterial = new THREE.MeshLambertMaterial({ map: obstacleTexture });
                    obstacle = new THREE.Mesh(barrierGeometry, barrierMaterial);
                    obstacle.position.set(x, 1.5, z);
                    obstacle.height = 3;
                    break;
                case 'low':
                    const lowGeometry = new THREE.BoxGeometry(3, 1, 1.5);
                    setBoxUVs(lowGeometry);
                    const lowMaterial = new THREE.MeshLambertMaterial({ map: obstacleTexture });
                    obstacle = new THREE.Mesh(lowGeometry, lowMaterial);
                    obstacle.position.set(x, 0.5, z);
                    obstacle.height = 1;
                    break;
                case 'train':
                    const trainGroup = new THREE.Group();
                    const trainBody = new THREE.BoxGeometry(3, 2.5, 4);
                    const trainMaterial = new THREE.MeshLambertMaterial({ map: obstacleTexture });
                    const trainMesh = new THREE.Mesh(trainBody, trainMaterial);
                    trainMesh.position.y = 1.25;
                    trainGroup.add(trainMesh);
                    // Train windows (use obstacle texture instead of blue)
                    const windowGeometry = new THREE.BoxGeometry(2.5, 1, 0.1);
                    const windowMaterial = new THREE.MeshLambertMaterial({ map: obstacleTexture });
                    const window1 = new THREE.Mesh(windowGeometry, windowMaterial);
                    window1.position.set(0, 1.5, 2.05);
                    trainGroup.add(window1);
                    trainGroup.position.set(x, 0, z);
                    obstacle = trainGroup;
                    obstacle.height = 2.5;
                    break;
                case 'slide_barrier':
                    // Posts
                    const postGeometry = new THREE.BoxGeometry(0.3, 4.5, 0.3);
                    const postMaterial = new THREE.MeshLambertMaterial({ map: obstacleTexture });
                    const leftPost = new THREE.Mesh(postGeometry, postMaterial);
                    leftPost.position.set(-1, 2.25, 0);
                    const rightPost = new THREE.Mesh(postGeometry, postMaterial);
                    rightPost.position.set(1, 2.25, 0);
                    // Bar
                    const barGeometry = new THREE.BoxGeometry(2.2, 0.4, 0.3);
                    const barMaterial = new THREE.MeshLambertMaterial({ map: obstacleTexture });
                    const bar = new THREE.Mesh(barGeometry, barMaterial);
                    bar.position.set(0, 3.2, 0);
                    // Group
                    const barrierGroup = new THREE.Group();
                    barrierGroup.add(leftPost, rightPost, bar);
                    barrierGroup.position.set(x, 0, z);
                    barrierGroup.obstacleType = 'slide_barrier';
                    barrierGroup.castShadow = true;
                    barrierGroup.height = 3;
                    obstacle = barrierGroup;
                    break;
            }
            obstacle.castShadow = true;
            obstacle.obstacleType = type;
            scene.add(obstacle);
            obstacles.push(obstacle);
        }
        
        // Create coin
        function createCoin(lane, z) {
            const coinGeometry = new THREE.CylinderGeometry(0.5, 0.5, 0.1, 16);
            const coinMaterial = new THREE.MeshLambertMaterial({ color: 0xffd700 });
            const coin = new THREE.Mesh(coinGeometry, coinMaterial);
            
            coin.position.set(lane * LANE_WIDTH, 2, z);
            coin.rotation.x = Math.PI / 2;
            coin.castShadow = true;
            
            scene.add(coin);
            coins.push(coin);
        }
        
        // Create fly power-up
        function createPowerUp(lane, z) {
            const powerUpGeometry = new THREE.SphereGeometry(0.5, 16, 16);
            const powerUpMaterial = new THREE.MeshLambertMaterial({ color: 0x00ffff, emissive: 0x00ffff, emissiveIntensity: 0.7 });
            const powerUp = new THREE.Mesh(powerUpGeometry, powerUpMaterial);
            powerUp.position.set(lane * LANE_WIDTH, 3, z);
            powerUp.castShadow = true;
            powerUp.isPowerUp = true;
            scene.add(powerUp);
            powerUps.push(powerUp);
        }
        
        // Handle input
        function setupEventListeners() {
            // Keyboard controls
            document.addEventListener('keydown', (event) => {
                keys[event.code] = true;
                
                if (!isGameRunning) return;
                
                switch (event.code) {
                    case 'ArrowLeft':
                        if (currentLane > -1) {
                            decrementLane();
                        }
                        break;
                    case 'ArrowRight':
                        if (currentLane < 1) {
                            incrementLane();
                        }
                        break;
                    case 'ArrowUp':
                        if (!isJumping) {
                            setIsJumping(true);
                            setJumpVelocity(JUMP_FORCE);
                        }
                        break;
                    case 'ArrowDown':
                        if (!isJumping) {
                            setIsSliding(true);
                            setTimeout(() => { setIsSliding(false); }, 1000);
                        }
                        break;
                }
            });
            
            document.addEventListener('keyup', (event) => {
                keys[event.code] = false;
            });
            
            // Mouse controls
            renderer.domElement.addEventListener('mousedown', handleDragStart);
            renderer.domElement.addEventListener('mousemove', handleDragMove);
            renderer.domElement.addEventListener('mouseup', handleDragEnd);
            renderer.domElement.addEventListener('mouseleave', handleDragEnd);
            
            // Touch controls
            renderer.domElement.addEventListener('touchstart', handleTouchStart, { passive: false });
            renderer.domElement.addEventListener('touchmove', handleTouchMove, { passive: false });
            renderer.domElement.addEventListener('touchend', handleTouchEnd);
            
            window.addEventListener('resize', onWindowResize);
        }
        
        // Mouse drag handlers
        function handleDragStart(event) {
            if (!isGameRunning) return;
            
            isDragging = true;
            dragStartX = event.clientX;
            dragStartY = event.clientY;
            lastDragX = event.clientX;
            lastDragY = event.clientY;
        }
        
        function handleDragMove(event) {
            if (!isDragging || !isGameRunning) return;
            const deltaX = event.clientX - lastDragX;
            const deltaY = lastDragY - event.clientY; // Inverted for intuitive up movement
            if (isFlying) {
                // While flying, drag up/down moves player up/down
                setPlayerY(Math.max(1, Math.min(10, getPlayerY() + deltaY * 0.03)));
                lastDragY = event.clientY;
                // Lane switching still works
                if (Math.abs(deltaX) > 20) {
                    if (deltaX > 0 && currentLane < 1) {
                        incrementLane();
                        lastDragX = event.clientX;
                    } else if (deltaX < 0 && currentLane > -1) {
                        decrementLane();
                        lastDragX = event.clientX;
                    }
                }
                return;
            }
            // Horizontal movement (lane switching)
            if (Math.abs(deltaX) > 20) {
                if (deltaX > 0 && currentLane < 1) {
                    incrementLane();
                    lastDragX = event.clientX;
                } else if (deltaX < 0 && currentLane > -1) {
                    decrementLane();
                    lastDragX = event.clientX;
                }
            }
            
            // Vertical movement (jumping)
            if (deltaY > 50 && !isJumping) {
                setIsJumping(true);
                setJumpVelocity(JUMP_FORCE);
                lastDragY = event.clientY;
            }
            
            // Down movement (sliding)
            if (deltaY < -50 && !isJumping) {
                setIsSliding(true);
                setTimeout(() => { setIsSliding(false); }, 1000);
                lastDragY = event.clientY;
            }
        }
        
        function handleDragEnd(event) {
            isDragging = false;
        }
        
        // Touch handlers
        function handleTouchStart(event) {
            event.preventDefault();
            if (!isGameRunning) return;
            
            const touch = event.touches[0];
            isDragging = true;
            dragStartX = touch.clientX;
            dragStartY = touch.clientY;
            lastDragX = touch.clientX;
            lastDragY = touch.clientY;
        }
        
        function handleTouchMove(event) {
            event.preventDefault();
            if (!isDragging || !isGameRunning) return;
            if (event.touches.length !== 1) return; // Only handle single finger
            const touch = event.touches[0];
            // Use total drag from drag start, not just last segment
            const totalDeltaX = touch.clientX - dragStartX;
            const totalDeltaY = dragStartY - touch.clientY; // Inverted for intuitive up movement
            // Lower threshold for easier lane switching
            const SWIPE_THRESHOLD = 15;
            // Accept more diagonal swipes
            const HORIZONTAL_RATIO = 0.5;
            if (isFlying) {
                setPlayerY(Math.max(1, Math.min(10, getPlayerY() + (lastDragY - touch.clientY) * 0.03)));
                lastDragY = touch.clientY;
                // Lane switching still works
                if (Math.abs(totalDeltaX) > SWIPE_THRESHOLD && Math.abs(totalDeltaX) > HORIZONTAL_RATIO * Math.abs(totalDeltaY)) {
                    if (totalDeltaX > 0 && currentLane < 1) {
                        incrementLane();
                        dragStartX = touch.clientX; // Reset drag start for next swipe
                    } else if (totalDeltaX < 0 && currentLane > -1) {
                        decrementLane();
                        dragStartX = touch.clientX;
                    }
                }
                lastDragX = touch.clientX;
                lastDragY = touch.clientY;
                return;
            }
            // Horizontal movement (lane switching)
            if (Math.abs(totalDeltaX) > SWIPE_THRESHOLD && Math.abs(totalDeltaX) > HORIZONTAL_RATIO * Math.abs(totalDeltaY)) {
                if (totalDeltaX > 0 && currentLane < 1) {
                    incrementLane();
                    dragStartX = touch.clientX;
                } else if (totalDeltaX < 0 && currentLane > -1) {
                    decrementLane();
                    dragStartX = touch.clientX;
                }
            }
            // Vertical movement (jumping)
            else if (totalDeltaY > 60 && Math.abs(totalDeltaY) > Math.abs(totalDeltaX) && !isJumping) {
                setIsJumping(true);
                setJumpVelocity(JUMP_FORCE);
                dragStartY = touch.clientY;
            }
            // Down movement (sliding)
            else if (totalDeltaY < -60 && Math.abs(totalDeltaY) > Math.abs(totalDeltaX) && !isJumping) {
                setIsSliding(true);
                setTimeout(() => { setIsSliding(false); }, 1000);
                dragStartY = touch.clientY;
            }
            lastDragX = touch.clientX;
            lastDragY = touch.clientY;
        }
        
        function handleTouchEnd(event) {
            event.preventDefault();
            isDragging = false;
        }
        
        // Window resize handler
        function onWindowResize() {
            camera.aspect = window.innerWidth / window.innerHeight;
            camera.updateProjectionMatrix();
            renderer.setSize(window.innerWidth, window.innerHeight);
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
                document.getElementById('dogDistance').textContent = Math.floor(dogPosition);
                
                // Make dog run animation (simple up-down movement)
                dog.position.y = Math.sin(Date.now() * 0.01) * 0.2;
                
                // Check if dog caught the player
                if (dogPosition <= DOG_CATCH_DISTANCE) {
                    gameOver('dog');
                }
            }
            
            // Update dog warning visibility
            if (isDogChasing) {
                document.getElementById('dogWarning').style.display = 'block';
            } else {
                document.getElementById('dogWarning').style.display = 'none';
            }
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
                createObstacle(type, lane, -100 - Math.random() * 50);
            }
            
            if (Math.random() < 0.03) {
                const lane = Math.floor(Math.random() * 3) - 1;
                createCoin(lane, -80 - Math.random() * 40);
            }
            
            // In updateWorld, spawn power-up occasionally
            if (Math.random() < 0.01) {
                const lane = Math.floor(Math.random() * 3) - 1;
                createPowerUp(lane, -90 - Math.random() * 40);
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
        
        // Handle small obstacle hit
        function handleSmallObstacleHit() {
            smallObstacleHits++;
            document.getElementById('smallHits').textContent = smallObstacleHits;
            
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
        
        // Create warning effect for small obstacle hits
        function createWarningEffect() {
            // Flash screen red briefly
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
                    document.getElementById('coins').textContent = coinsCollected; // Update UI immediately
                    score += 10;
                    // Coin collect effect
                    createParticleEffect(coin.position);
                }
            }
            
            // In checkCollisions, check for power-up collection
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
        
        // Create particle effect
        function createParticleEffect(position) {
            const particleGroup = new THREE.Group();
            
            for (let i = 0; i < 8; i++) {
                const particleGeometry = new THREE.SphereGeometry(0.1, 8, 8);
                const particleMaterial = new THREE.MeshLambertMaterial({ color: 0xffd700 });
                const particle = new THREE.Mesh(particleGeometry, particleMaterial);
                
                particle.position.copy(position);
                particle.velocity = new THREE.Vector3(
                    (Math.random() - 0.5) * 0.2,
                    Math.random() * 0.2,
                    (Math.random() - 0.5) * 0.2
                );
                
                particleGroup.add(particle);
                scene.add(particle);
                particles.push(particle);
            }
        }
        
        // Update particles
        function updateParticles() {
            for (let i = particles.length - 1; i >= 0; i--) {
                const particle = particles[i];
                
                particle.position.add(particle.velocity);
                particle.velocity.y -= 0.01;
                particle.material.opacity -= 0.02;
                
                if (particle.material.opacity <= 0) {
                    scene.remove(particle);
                    particles.splice(i, 1);
                }
            }
        }
        
        // Update score
        function updateScore() {
            score += 0.1;
            document.getElementById('score').textContent = Math.floor(score);
            document.getElementById('coins').textContent = coinsCollected;
            
            // Increase game speed gradually
            gameSpeed = Math.min(0.5, 0.2 + score * 0.0001);
        }
        
        // Game over
        function gameOver(reason = 'obstacle') {
            isGameRunning = false;
            document.getElementById('finalScore').textContent = Math.floor(score);
            document.getElementById('finalCoins').textContent = coinsCollected;
            
            // Set game over message based on reason
            const gameOverTitle = document.getElementById('gameOverTitle');
            const gameOverReason = document.getElementById('gameOverReason');
            
            if (reason === 'dog') {
                gameOverTitle.textContent = 'أمسك بك الكلب!';
                gameOverReason.textContent = `تم القبض عليك بعد ${smallObstacleHits} اصطدامات صغيرة`;
            } else {
                gameOverTitle.textContent = 'انتهت اللعبة!';
                gameOverReason.textContent = 'اصطدمت بعقبة كبيرة';
            }
            
            document.getElementById('gameOver').style.display = 'block';
            document.getElementById('dogWarning').style.display = 'none';
            
            // Stop background music when game is over
            if (backgroundAudio && !backgroundAudio.paused) {
                backgroundAudio.pause();
                backgroundAudio.currentTime = 0;
            }
        }
        
        // Restart game
        function restartGame() {
            // Reset game state
            isGameRunning = true;
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
            obstacles = [];
            coins.forEach(coin => scene.remove(coin));
            coins = [];
            particles.forEach(particle => scene.remove(particle));
            particles = [];
            
            // Update UI
            document.getElementById('smallHits').textContent = '0';
            document.getElementById('score').textContent = '0';
            document.getElementById('coins').textContent = '0';
            
            // Hide game over screen and dog warning
            document.getElementById('gameOver').style.display = 'none';
            document.getElementById('dogWarning').style.display = 'none';
            
            // Resume background music if user already interacted
            if (backgroundAudio && backgroundAudio.paused) {
                backgroundAudio.currentTime = 0;
                backgroundAudio.play().catch(() => {});
            }
            
            // Reset power-ups and fly state
            powerUps.forEach(p => scene.remove(p));
            powerUps = [];
            isFlying = false;
            if (flyTimeout) clearTimeout(flyTimeout);
            resetPlayerState();
        }
        
        // Add background music
        let backgroundAudio;
        function playBackgroundMusic() {
            if (!backgroundAudio) {
                backgroundAudio = new Audio('sound/Allaoui.mp3');
                backgroundAudio.loop = true;
                backgroundAudio.volume = 0.5;
            }
            // Only play if game is running
            if (isGameRunning) {
                backgroundAudio.play().catch(() => {}); // Ignore autoplay errors
            }
        }
        
        // Main animation loop
        function animate() {
            requestAnimationFrame(animate);
            if (isGameRunning && isModelLoaded) {
                updatePlayer(keys, camera, isFlying);
                updateDog();
                updateWorld();
                checkCollisions();
                updateParticles();
                updateScore();
            }
            // Update player animation (faster)
            if (playerMixer) playerMixer.update(1/45); // Double speed
            renderer.render(scene, camera);
        }
        
        // Expose restartGame to global window object
        window.restartGame = restartGame;
        
        // Start the game
        init();
        // Play music after user interaction
        document.addEventListener('click', playBackgroundMusic, { once: true });
        document.addEventListener('keydown', playBackgroundMusic, { once: true });

