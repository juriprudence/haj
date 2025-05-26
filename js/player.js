// Player-related variables and logic extracted from main.js
import { LANE_WIDTH, JUMP_FORCE, GRAVITY, SLIDE_HEIGHT } from './config.js';

export let player, playerY = 1, isJumping = false, isSliding = false, jumpVelocity = 0, currentLane = 0;
export let isFlying = false, flyTimeout = null;
export let playerMixer, isModelLoaded = false;

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

// Fly power-up logic
export function activateFlyPowerUp() {
    isFlying = true;
    if (flyTimeout) clearTimeout(flyTimeout);
    // Visual feedback: make player glow
    player.traverse(child => {
        if (child.isMesh) {
            child.material.emissive = new THREE.Color(0x00ffff);
            child.material.emissiveIntensity = 0.7;
        }
    });
    flyTimeout = setTimeout(() => {
        isFlying = false;
        // Remove glow
        player.traverse(child => {
            if (child.isMesh) {
                child.material.emissive = new THREE.Color(0x000000);
                child.material.emissiveIntensity = 0;
            }
        });
    }, 5000); // 5 seconds
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
export function incrementLane() { if (currentLane < 1) currentLane++; }
export function decrementLane() { if (currentLane > -1) currentLane--; }
export function getCurrentLane() { return currentLane; }

// PlayerY setter
export function setPlayerY(y) { playerY = Math.max(1, Math.min(10, y)); }
export function getPlayerY() { return playerY; }

// Jumping/sliding setters
export function setIsJumping(val) { isJumping = val; }
export function setIsSliding(val) { isSliding = val; }
export function setJumpVelocity(val) { jumpVelocity = val; }
export function getIsJumping() { return isJumping; }
export function getIsSliding() { return isSliding; }
export function getJumpVelocity() { return jumpVelocity; } 