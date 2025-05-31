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

// Create obstacle
export function createObstacle(type, lane, z, scene, isLowEndDevice) {
    let obstacle;
    const x = lane * LANE_WIDTH;
    // Use cached texture instead of loading it every time
    const obstacleTexture = getCachedTexture('texture/gen.jpeg', isLowEndDevice);
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
            // Train windows
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
    return obstacle;
}

// Create coin
export function createCoin(lane, z, scene) {
    const coinGeometry = new THREE.CylinderGeometry(0.5, 0.5, 0.1, 16);
    const coinMaterial = new THREE.MeshLambertMaterial({ color: 0xffd700 });
    const coin = new THREE.Mesh(coinGeometry, coinMaterial);
    
    coin.position.set(lane * LANE_WIDTH, 2, z);
    coin.rotation.x = Math.PI / 2;
    coin.castShadow = true;
    
    scene.add(coin);
    return coin;
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