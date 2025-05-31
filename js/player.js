// Player-related variables and logic
import { LANE_WIDTH, JUMP_FORCE, GRAVITY, SLIDE_HEIGHT } from './config.js';

// Player state variables
export let player, playerY = 1, isJumping = false, isSliding = false, jumpVelocity = 0, currentLane = 0;
export let isFlying = false, flyTimeout = null;
export let playerMixer, isModelLoaded = false;

// Input state
let isDragging = false, dragStartX = 0, dragStartY = 0;
let lastDragX = 0, lastDragY = 0;
let keys = {};
let isGameRunning = false; // Add local game running state

// Player creation (GLB loader)
export function createPlayer(scene, onLoaded) {
    const loader = new THREE.GLTFLoader();
    loader.load('old.glb', function(gltf) {
        player = gltf.scene;
        player.position.set(0, playerY, 0);
        player.scale.set(2.5, 2.5, 2.5);
        player.traverse(function(child) {
            if (child.isMesh) {
                child.castShadow = true;
                child.receiveShadow = true;
            }
        });
        scene.add(player);
        // Animation setup
        if (gltf.animations && gltf.animations.length > 0) {
            playerMixer = new THREE.AnimationMixer(player);
            const action = playerMixer.clipAction(gltf.animations[0]);
            action.play();
        }
        isModelLoaded = true;
        if (onLoaded) onLoaded();
    }, undefined, function(error) {
        console.error('Error loading GLB:', error);
    });
}

// Player update logic
export function updatePlayer(keys, camera, isFlyingFlag) {
    if (!player) return;
    if (isFlyingFlag) {
        // Lane switching
        const targetX = currentLane * LANE_WIDTH;
        player.position.x += (targetX - player.position.x) * 0.15;
        // Player can move up/down with up/down keys or touch
        if (keys['ArrowUp']) {
            playerY += 0.4;
        }
        if (keys['ArrowDown']) {
            playerY -= 0.4;
        }
        playerY = Math.max(1, Math.min(10, playerY));
        player.scale.y = 1;
        isJumping = false;
        isSliding = false;
        player.position.y = playerY;
        // Camera follow
        camera.position.x = player.position.x;
        camera.position.z = player.position.z + 8;
        camera.lookAt(player.position.x, player.position.y + 2, player.position.z - 5);
        return;
    }
    // Lane switching
    const targetX = currentLane * LANE_WIDTH;
    player.position.x += (targetX - player.position.x) * 0.15;
    // Jumping
    if (isJumping) {
        playerY += jumpVelocity;
        jumpVelocity -= GRAVITY;
        if (playerY <= 1) {
            playerY = 1;
            isJumping = false;
            jumpVelocity = 0;
        }
    }
    // Sliding
    if (isSliding) {
        playerY = SLIDE_HEIGHT;
        player.scale.y = 0.5;
    } else if (!isJumping) {
        playerY = 1;
        player.scale.y = 1;
    }
    player.position.y = playerY;
    // Camera follow
    camera.position.x = player.position.x;
    camera.position.z = player.position.z + 8;
    camera.lookAt(player.position.x, player.position.y + 2, player.position.z - 5);
}

// Input handling
export function setupInputHandlers(renderer, gameRunning) {
    isGameRunning = gameRunning; // Set initial state
    
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
    renderer.domElement.addEventListener('touchend', handleTouchEnd, { passive: false });
}

// Mouse/touch handlers
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

// Utility to reset player state (for restart)
export function resetPlayerState() {
    isJumping = false;
    isSliding = false;
    currentLane = 0;
    jumpVelocity = 0;
    playerY = 1;
    isFlying = false;
    if (flyTimeout) clearTimeout(flyTimeout);
    if (player) {
        player.position.set(0, 1, 0);
        player.scale.set(2.5, 2.5, 2.5);
    }
}

// Lane setters and modifiers
export function setCurrentLane(lane) { currentLane = lane; }
export function getCurrentLane() { return currentLane; }
export function incrementLane() { if (currentLane < 1) currentLane++; }
export function decrementLane() { if (currentLane > -1) currentLane--; }

// Jumping/sliding setters
export function setIsJumping(val) { isJumping = val; }
export function setIsSliding(val) { isSliding = val; }
export function setJumpVelocity(val) { jumpVelocity = val; }
export function setPlayerY(val) { playerY = val; }
export function getIsJumping() { return isJumping; }
export function getIsSliding() { return isSliding; }
export function getJumpVelocity() { return jumpVelocity; } 
export function getPlayerY() { return playerY; }

// Fly power-up
export function activateFlyPowerUp() {
    isFlying = true;
    if (flyTimeout) clearTimeout(flyTimeout);
    flyTimeout = setTimeout(() => {
        isFlying = false;
    }, 5000); // 5 seconds of flying
}

// Add function to update game running state
export function setGameRunning(running) {
    isGameRunning = running;
} 