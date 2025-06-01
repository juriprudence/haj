// Player-related variables and logic
import { LANE_WIDTH, JUMP_FORCE, GRAVITY, SLIDE_HEIGHT } from './config.js';
import { playJumpSound } from './sound.js';

// Player state variables
export let player, playerY = 1, isJumping = false, isSliding = false, jumpVelocity = 0, currentLane = 0;
export let hasJumpBoost = false;
let jumpBoostTimeout = null;
export let playerMixer, isModelLoaded = false;

// Animation variables
let idleAction, jumpAction, hitAction;
let currentAction = null;
let jumpAnimationFinishedListener = null; // Track the listener

// Input state
let isDragging = false, dragStartX = 0, dragStartY = 0;
let lastDragX = 0, lastDragY = 0;
let keys = {};
let isGameRunning = false;

// Particle system variables
let scene = null;
let jumpParticles = [];
let landingParticles = [];

// Function to create jump particles (dust clouds)
function createJumpParticles(position) {
    if (!scene) return [];
    
    const particles = [];
    const particleCount = 6;
    
    for (let i = 0; i < particleCount; i++) {
        const particleGeometry = new THREE.SphereGeometry(0.05, 6, 6);
        const particleMaterial = new THREE.MeshLambertMaterial({ 
            color: 0x8B4513, // Brown dust color
            transparent: true,
            opacity: 0.8
        });
        const particle = new THREE.Mesh(particleGeometry, particleMaterial);
        
        // Position particles around the jump point
        particle.position.set(
            position.x + (Math.random() - 0.5) * 1.5,
            position.y + 0.1,
            position.z + (Math.random() - 0.5) * 1.5
        );
        
        // Set velocity for particles
        particle.velocity = new THREE.Vector3(
            (Math.random() - 0.5) * 0.1,
            Math.random() * 0.05 + 0.02,
            (Math.random() - 0.5) * 0.1
        );
        
        particle.life = 1.0;
        particle.decay = 0.02;
        
        scene.add(particle);
        particles.push(particle);
    }
    
    return particles;
}

// Function to create landing particles (impact sparks)
function createLandingParticles(position) {
    if (!scene) return [];
    
    const particles = [];
    const particleCount = 8;
    
    for (let i = 0; i < particleCount; i++) {
        const particleGeometry = new THREE.SphereGeometry(0.03, 4, 4);
        const particleMaterial = new THREE.MeshLambertMaterial({ 
            color: 0xFFD700, // Golden sparks
            transparent: true,
            opacity: 1.0,
            emissive: 0xFFD700,
            emissiveIntensity: 0.3
        });
        const particle = new THREE.Mesh(particleGeometry, particleMaterial);
        
        // Position particles at landing point
        particle.position.set(
            position.x + (Math.random() - 0.5) * 0.8,
            position.y + 0.05,
            position.z + (Math.random() - 0.5) * 0.8
        );
        
        // Set velocity for sparks (more horizontal spread)
        particle.velocity = new THREE.Vector3(
            (Math.random() - 0.5) * 0.15,
            Math.random() * 0.08 + 0.03,
            (Math.random() - 0.5) * 0.15
        );
        
        particle.life = 1.0;
        particle.decay = 0.04; // Faster decay for sparks
        
        scene.add(particle);
        particles.push(particle);
    }
    
    return particles;
}

// Function to update particle systems
function updatePlayerParticles() {
    // Update jump particles
    for (let i = jumpParticles.length - 1; i >= 0; i--) {
        const particle = jumpParticles[i];
        
        // Update position
        particle.position.add(particle.velocity);
        particle.velocity.y -= 0.008; // Gravity effect
        particle.velocity.multiplyScalar(0.98); // Air resistance
        
        // Update life and opacity
        particle.life -= particle.decay;
        particle.material.opacity = particle.life;
        
        // Remove dead particles
        if (particle.life <= 0) {
            scene.remove(particle);
            particle.geometry.dispose();
            particle.material.dispose();
            jumpParticles.splice(i, 1);
        }
    }
    
    // Update landing particles
    for (let i = landingParticles.length - 1; i >= 0; i--) {
        const particle = landingParticles[i];
        
        // Update position
        particle.position.add(particle.velocity);
        particle.velocity.y -= 0.012; // Stronger gravity for sparks
        particle.velocity.multiplyScalar(0.96); // More air resistance
        
        // Update life and opacity
        particle.life -= particle.decay;
        particle.material.opacity = particle.life;
        particle.material.emissiveIntensity = particle.life * 0.3;
        
        // Remove dead particles
        if (particle.life <= 0) {
            scene.remove(particle);
            particle.geometry.dispose();
            particle.material.dispose();
            landingParticles.splice(i, 1);
        }
    }
}

// Function to clean up all particles
function cleanupPlayerParticles() {
    // Clean up jump particles
    jumpParticles.forEach(particle => {
        scene.remove(particle);
        particle.geometry.dispose();
        particle.material.dispose();
    });
    jumpParticles.length = 0;
    
    // Clean up landing particles
    landingParticles.forEach(particle => {
        scene.remove(particle);
        particle.geometry.dispose();
        particle.material.dispose();
    });
    landingParticles.length = 0;
}

// Player creation (GLB loader)
export function createPlayer(gameScene, onLoaded) {
    // Store scene reference for particles
    scene = gameScene;
    
    const loader = new THREE.GLTFLoader();
    loader.load('tow.glb', function(gltf) {
        player = gltf.scene;
        player.position.set(0, playerY, 0);
        player.scale.set(2.5, 2.5, 2.5);
        player.rotation.y = Math.PI; // Rotate 180 degrees to face the root
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
            // Set up idle animation (first animation)
            if (gltf.animations[0]) {
                idleAction = playerMixer.clipAction(gltf.animations[0]);
                idleAction.play();
                currentAction = idleAction;
            }
            // Set up jump animation (second animation)
            if (gltf.animations[1]) {
                jumpAction = playerMixer.clipAction(gltf.animations[1]);
                jumpAction.setLoop(THREE.LoopOnce);
                jumpAction.clampWhenFinished = true;
            }
            // Set up hit animation (third animation)
            if (gltf.animations[2]) {
                hitAction = playerMixer.clipAction(gltf.animations[2]);
                hitAction.setLoop(THREE.LoopOnce);
                hitAction.clampWhenFinished = true;
            }
        }
        
        isModelLoaded = true;
        if (onLoaded) onLoaded();
    }, undefined, function(error) {
        console.error('Error loading GLB:', error);
    });
}

// Function to switch to jump animation
function playJumpAnimation() {
    if (!playerMixer || !jumpAction || !idleAction) return;
    
    // Remove any existing event listener first
    if (jumpAnimationFinishedListener) {
        playerMixer.removeEventListener('finished', jumpAnimationFinishedListener);
        jumpAnimationFinishedListener = null;
    }
    
    // Fade out current animation and fade in jump animation
    if (currentAction && currentAction !== jumpAction) {
        currentAction.fadeOut(0.1);
    }
    
    jumpAction.reset();
    jumpAction.fadeIn(0.1);
    jumpAction.play();
    currentAction = jumpAction;
    
    // Create new event listener
    jumpAnimationFinishedListener = (event) => {
        if (event.action === jumpAction) {
            playerMixer.removeEventListener('finished', jumpAnimationFinishedListener);
            jumpAnimationFinishedListener = null;
            // Force return to idle animation regardless of jump state
            forceIdleAnimation();
        }
    };
    
    // Listen for when jump animation finishes
    playerMixer.addEventListener('finished', jumpAnimationFinishedListener);
    
    // Backup timer in case the event doesn't fire
    setTimeout(() => {
        if (jumpAnimationFinishedListener) {
            playerMixer.removeEventListener('finished', jumpAnimationFinishedListener);
            jumpAnimationFinishedListener = null;
            forceIdleAnimation();
        }
    }, 1000); // 1 second backup timer
}

// Function to switch back to idle animation
function playIdleAnimation() {
    if (!playerMixer || !idleAction || !jumpAction) return;
    
    // Only switch back if we're not currently playing jump animation
    if (currentAction !== jumpAction) {
        forceIdleAnimation();
    }
}

// Force idle animation (used as backup)
function forceIdleAnimation() {
    if (!playerMixer || !idleAction) return;
    
    if (currentAction && currentAction !== idleAction) {
        currentAction.fadeOut(0.2);
    }
    
    idleAction.reset();
    idleAction.fadeIn(0.2);
    idleAction.play();
    currentAction = idleAction;
}

// Play hit animation
export function playHitAnimation(isJumpingState) {
    if (!playerMixer || !hitAction) return;
    // Remove any existing event listener first
    playerMixer.stopAllAction();
    if (isJumpingState) {
        // Play from the start
        hitAction.reset();
        hitAction.time = 0;
        hitAction.fadeIn(0.05);
        hitAction.play();
    } else {
        // Play from halfway (second half)
        const duration = hitAction.getClip().duration;
        hitAction.reset();
        hitAction.time = duration / 2;
        hitAction.fadeIn(0.05);
        hitAction.play();
    }
    currentAction = hitAction;
    // Return to idle after hit animation
    playerMixer.addEventListener('finished', function onHitFinished(event) {
        if (event.action === hitAction) {
            playerMixer.removeEventListener('finished', onHitFinished);
            forceIdleAnimation();
        }
    });
}

// Play hit animation and freeze on last frame (for big obstacle)
export function playHitAnimationAndFreeze(isJumpingState) {
    if (!playerMixer || !hitAction) return;
    playerMixer.stopAllAction();
    if (isJumpingState) {
        hitAction.reset();
        hitAction.time = 0;
        hitAction.fadeIn(0.05);
        hitAction.play();
    } else {
        const duration = hitAction.getClip().duration;
        hitAction.reset();
        hitAction.time = duration / 2;
        hitAction.fadeIn(0.05);
        hitAction.play();
    }
    currentAction = hitAction;
    // Remove any previous finished listeners so animation does not revert to idle
    playerMixer._listeners = playerMixer._listeners || {};
    if (playerMixer._listeners['finished']) {
        playerMixer._listeners['finished'] = playerMixer._listeners['finished'].filter(fn => false);
    }
    // When finished, freeze on last frame
    hitAction.clampWhenFinished = true;
    hitAction.setLoop(THREE.LoopOnce);
}

// Player update logic
export function updatePlayer(keys, camera, isFlyingFlag) {
    if (!player) return;
    
    // Update animation mixer with delta time
    if (playerMixer) {
        // Use dynamic delta time instead of fixed
        const delta = Math.min(0.05, 0.016); // Cap at 50ms to prevent large jumps
        playerMixer.update(delta);
    }
    
    // Update particle systems
    updatePlayerParticles();
    
    // Lane switching
    const targetX = currentLane * LANE_WIDTH;
    player.position.x += (targetX - player.position.x) * 0.15;
    
    // Track previous jump state for landing detection
    const wasJumping = isJumping && playerY > 1.1;
    
    // Jumping with better state management
    if (isJumping) {
        playerY += jumpVelocity;
        jumpVelocity -= GRAVITY;
        
        // Landing logic with safety checks
        if (playerY <= 1) {
            playerY = 1;
            isJumping = false;
            jumpVelocity = 0;
            
            // Create landing particles if we were actually jumping
            if (wasJumping && player) {
                const newLandingParticles = createLandingParticles(player.position);
                landingParticles.push(...newLandingParticles);
            }
            
            // Ensure we return to idle animation
            setTimeout(() => {
                if (!isJumping) { // Double check we're still not jumping
                    forceIdleAnimation();
                }
            }, 100);
        }
    }
    
    // Sliding
    if (isSliding) {
        playerY = SLIDE_HEIGHT;
        player.scale.y = 0.5;
    } else if (!isJumping) {
        if (playerY < 1) playerY = 1; // Safety check
        player.scale.y = 1;
    }
    
    player.position.y = playerY;
    
    // Camera follow
    camera.position.x = player.position.x;
    camera.position.z = player.position.z + 8;
    camera.lookAt(player.position.x, player.position.y + 2, player.position.z - 5);
}

// Modified jump function with better state management and particles
function triggerJump() {
    // Prevent jumping while flying or sliding
    if (!isJumping && !isSliding) {
        setIsJumping(true);
        // If jump boost is active, increase jump velocity
        if (hasJumpBoost) {
            setJumpVelocity(JUMP_FORCE * 1.7); // 70% higher jump
        } else {
            setJumpVelocity(JUMP_FORCE);
        }
        
        // Create jump particles
        if (player) {
            const newJumpParticles = createJumpParticles(player.position);
            jumpParticles.push(...newJumpParticles);
        }
        
        playJumpAnimation();
        playJumpSound();
        // Debug log
        console.log('Jump triggered - isJumping:', isJumping, 'jumpVelocity:', jumpVelocity, 'hasJumpBoost:', hasJumpBoost);
    }
}

// Input handling
export function setupInputHandlers(renderer, gameRunning) {
    isGameRunning = gameRunning;
    
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
                triggerJump();
                break;
            case 'ArrowDown':
                if (!isJumping) {
                    setIsSliding(true);
                    setTimeout(() => { setIsSliding(false); }, 1000);
                }
                break;
            case 'KeyR': // Add R key to force reset player state (debug)
                console.log('Force reset player state');
                resetPlayerState();
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

// Mouse/touch handlers (keeping existing logic but adding debug)
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
    const deltaY = lastDragY - event.clientY;
    
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
        triggerJump();
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
    if (event.touches.length !== 1) return;
    
    const touch = event.touches[0];
    const totalDeltaX = touch.clientX - dragStartX;
    const totalDeltaY = dragStartY - touch.clientY;
    const SWIPE_THRESHOLD = 15;
    const HORIZONTAL_RATIO = 0.5;
    
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
        triggerJump();
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

// Utility to reset player state (enhanced with better cleanup)
export function resetPlayerState() {
    console.log('Resetting player state');
    
    // Clear animation listeners
    if (jumpAnimationFinishedListener && playerMixer) {
        playerMixer.removeEventListener('finished', jumpAnimationFinishedListener);
        jumpAnimationFinishedListener = null;
    }
    
    // Clean up particles
    cleanupPlayerParticles();
    
    // Reset all state variables
    isJumping = false;
    isSliding = false;
    currentLane = 0;
    jumpVelocity = 0;
    playerY = 1;
    hasJumpBoost = false;
    
    if (jumpBoostTimeout) {
        clearTimeout(jumpBoostTimeout);
        jumpBoostTimeout = null;
    }
    
    if (player) {
        player.position.set(0, 1, 0);
        player.scale.set(2.5, 2.5, 2.5);
    }
    
    // Force idle animation
    if (playerMixer && idleAction) {
        forceIdleAnimation();
    }
    
    console.log('Player state reset complete');
}

// Lane setters and modifiers
export function setCurrentLane(lane) { currentLane = lane; }
export function getCurrentLane() { return currentLane; }
export function incrementLane() { if (currentLane < 1) currentLane++; }
export function decrementLane() { if (currentLane > -1) currentLane--; }

// Jumping/sliding setters with debug logging
export function setIsJumping(val) { 
    console.log('Setting isJumping to:', val);
    isJumping = val; 
}
export function setIsSliding(val) { isSliding = val; }
export function setJumpVelocity(val) { jumpVelocity = val; }
export function setPlayerY(val) { playerY = val; }
export function getIsJumping() { return isJumping; }
export function getIsSliding() { return isSliding; }
export function getJumpVelocity() { return jumpVelocity; } 
export function getPlayerY() { return playerY; }
export function getIsFlying() { return isFlying; }

// Jump boost power-up
export function activateJumpBoostPowerUp() {
    hasJumpBoost = true;
    if (jumpBoostTimeout) clearTimeout(jumpBoostTimeout);
    jumpBoostTimeout = setTimeout(() => {
        hasJumpBoost = false;
    }, 5000);
}

// Add function to update game running state
export function setGameRunning(running) {
    isGameRunning = running;
}

// Debug function to check player state
export function debugPlayerState() {
    console.log('Player Debug State:', {
        isJumping,
        isSliding,
        jumpVelocity,
        playerY,
        currentLane,
        hasJumpBoost,
        currentAction: currentAction ? currentAction._clip.name : 'none',
        hasJumpListener: !!jumpAnimationFinishedListener,
        jumpParticles: jumpParticles.length,
        landingParticles: landingParticles.length
    });
}