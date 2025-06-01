import { LANE_WIDTH } from './config.js';

// Cache for textures and geometries
let textureCache = new Map();
let geometryCache = new Map();
let materialCache = new Map();

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

// Optimized texture loading with caching
function getCachedTexture(url, isLowEndDevice) {
    if (!textureCache.has(url)) {
        const loader = new THREE.TextureLoader();
        const texture = loader.load(url);
        texture.generateMipmaps = !isLowEndDevice;
        texture.minFilter = isLowEndDevice ? THREE.LinearFilter : THREE.LinearMipmapLinearFilter;
        texture.magFilter = THREE.LinearFilter;
        textureCache.set(url, texture);
    }
    return textureCache.get(url);
}

// Create coin (now as a small chicken)
export function createCoin(lane, z, scene) {
    const chickenGroup = new THREE.Group();
    
    // Chicken body (ellipsoid shape)
    const bodyGeometry = new THREE.SphereGeometry(0.3, 12, 8);
    bodyGeometry.scale(1, 0.8, 1.2); // Make it slightly egg-shaped
    const bodyMaterial = new THREE.MeshLambertMaterial({ color: 0xffd700 }); // Golden yellow
    const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
    body.position.set(0, 0, 0);
    chickenGroup.add(body);
    
    // Chicken head
    const headGeometry = new THREE.SphereGeometry(0.15, 10, 8);
    const headMaterial = new THREE.MeshLambertMaterial({ color: 0xffd700 });
    const head = new THREE.Mesh(headGeometry, headMaterial);
    head.position.set(0, 0.25, 0.25);
    chickenGroup.add(head);
    
    // Beak
    const beakGeometry = new THREE.ConeGeometry(0.03, 0.08, 6);
    const beakMaterial = new THREE.MeshLambertMaterial({ color: 0xff8c00 }); // Orange
    const beak = new THREE.Mesh(beakGeometry, beakMaterial);
    beak.position.set(0, 0.25, 0.35);
    beak.rotation.x = Math.PI / 2;
    chickenGroup.add(beak);
    
    // Eyes
    const eyeGeometry = new THREE.SphereGeometry(0.02, 6, 6);
    const eyeMaterial = new THREE.MeshLambertMaterial({ color: 0x000000 });
    const leftEye = new THREE.Mesh(eyeGeometry, eyeMaterial);
    leftEye.position.set(-0.08, 0.3, 0.32);
    const rightEye = new THREE.Mesh(eyeGeometry, eyeMaterial);
    rightEye.position.set(0.08, 0.3, 0.32);
    chickenGroup.add(leftEye, rightEye);
    
    // Wings
    const wingGeometry = new THREE.SphereGeometry(0.15, 8, 6);
    wingGeometry.scale(0.6, 0.8, 1.2);
    const wingMaterial = new THREE.MeshLambertMaterial({ color: 0xffb347 }); // Slightly darker yellow
    const leftWing = new THREE.Mesh(wingGeometry, wingMaterial);
    leftWing.position.set(-0.25, 0, -0.05);
    leftWing.rotation.z = -0.3;
    const rightWing = new THREE.Mesh(wingGeometry, wingMaterial);
    rightWing.position.set(0.25, 0, -0.05);
    rightWing.rotation.z = 0.3;
    chickenGroup.add(leftWing, rightWing);
    
    // Tail feathers
    const tailGeometry = new THREE.SphereGeometry(0.1, 6, 6);
    tailGeometry.scale(0.5, 1, 0.3);
    const tailMaterial = new THREE.MeshLambertMaterial({ color: 0xffb347 });
    const tail = new THREE.Mesh(tailGeometry, tailMaterial);
    tail.position.set(0, 0.15, -0.35);
    chickenGroup.add(tail);
    
    // Legs
    const legGeometry = new THREE.CylinderGeometry(0.02, 0.02, 0.15, 6);
    const legMaterial = new THREE.MeshLambertMaterial({ color: 0xff8c00 });
    const leftLeg = new THREE.Mesh(legGeometry, legMaterial);
    leftLeg.position.set(-0.1, -0.35, 0.1);
    const rightLeg = new THREE.Mesh(legGeometry, legMaterial);
    rightLeg.position.set(0.1, -0.35, 0.1);
    chickenGroup.add(leftLeg, rightLeg);
    
    // Feet
    const footGeometry = new THREE.SphereGeometry(0.04, 6, 6);
    footGeometry.scale(1, 0.3, 1.5);
    const footMaterial = new THREE.MeshLambertMaterial({ color: 0xff8c00 });
    const leftFoot = new THREE.Mesh(footGeometry, footMaterial);
    leftFoot.position.set(-0.1, -0.42, 0.12);
    const rightFoot = new THREE.Mesh(footGeometry, footMaterial);
    rightFoot.position.set(0.1, -0.42, 0.12);
    chickenGroup.add(leftFoot, rightFoot);
    
    // Position the chicken
    chickenGroup.position.set(lane * LANE_WIDTH, 1.5, z);
    chickenGroup.castShadow = true;
    
    // Add a gentle bobbing animation
    chickenGroup.userData = {
        originalY: 1.5,
        bobSpeed: 0.05,
        bobAmount: 0.1
    };
    
    scene.add(chickenGroup);
    return chickenGroup;
}

// Create fly power-up
export function createPowerUp(lane, z, scene) {
    const powerUpGeometry = new THREE.SphereGeometry(0.5, 16, 16);
    const powerUpMaterial = new THREE.MeshLambertMaterial({ 
        color: 0x00ffff, 
        emissive: 0x00ffff, 
        emissiveIntensity: 0.7 
    });
    const powerUp = new THREE.Mesh(powerUpGeometry, powerUpMaterial);
    powerUp.position.set(lane * LANE_WIDTH, 3, z);
    powerUp.castShadow = true;
    powerUp.isPowerUp = true;
    scene.add(powerUp);
    return powerUp;
}

// Create particle effect
export function createParticleEffect(position, scene) {
    const particleGroup = new THREE.Group();
    const particles = [];
    
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
    
    return particles;
}

// Update particles
export function updateParticles(particles, scene) {
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

// Update chicken animation (call this in your game loop)
export function updateChicken(chicken) {
    if (chicken.userData && chicken.userData.originalY !== undefined) {
        const time = Date.now() * chicken.userData.bobSpeed;
        chicken.position.y = chicken.userData.originalY + Math.sin(time) * chicken.userData.bobAmount;
    }
}

// Dispose of 3D objects properly
export function disposeObject(obj) {
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