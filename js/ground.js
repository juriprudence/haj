// ground.js
// Handles ground (floor tile) creation and management with proper disposal

export function createGround(scene, ground, NUM_FLOOR_TILES, onTileLoaded) {
    const loader = new THREE.GLTFLoader();
    const TILE_LENGTH = 20; // Adjusted based on your floor.glb size and grid estimate
    let loadedTiles = 0;
    
    // Load the floor model once and clone it for better performance
    loader.load('floor.glb', function(gltf) {
        const originalFloorTile = gltf.scene;
        
        // Create tiles by cloning the original
        for (let i = 0; i < NUM_FLOOR_TILES; i++) {
            const floorTile = originalFloorTile.clone();
            floorTile.position.set(0, 22, -i * TILE_LENGTH);
            floorTile.scale.set(40, 80, 80); // Taller floor (Y=40)
            floorTile.rotation.y = Math.PI / 2; // Rotate 90 degrees
            
            // Store original position for repositioning logic
            floorTile.userData.originalZ = -i * TILE_LENGTH;
            floorTile.userData.tileIndex = i;
            
            floorTile.traverse(function(child) {
                if (child.isMesh) {
                    child.castShadow = true;
                    child.receiveShadow = true;
                    // Make the floor whiter
                    if (child.material) {
                        // Clone material to avoid shared references
                        child.material = child.material.clone();
                        child.material.color.set(0xffffff); // Pure white
                        child.material.needsUpdate = true;
                    }
                }
            });
            
            scene.add(floorTile);
            ground.push(floorTile);
            
            loadedTiles++;
            if (onTileLoaded) onTileLoaded();
        }
    }, 
    // Progress callback
    function(progress) {
        console.log('Floor loading progress:', (progress.loaded / progress.total * 100) + '%');
    },
    // Error callback
    function(error) {
        console.error('Error loading floor.glb:', error);
    });
}

// Function to update ground tiles movement and repositioning
export function updateGround(ground, gameSpeed) {
    const TILE_LENGTH = 20;
    const RESET_DISTANCE = 200; // Distance to reset tile position
    const FORWARD_THRESHOLD = 20; // When tile is considered "passed"
    
    ground.forEach(tile => {
        // Move tile forward
        tile.position.z += gameSpeed;
        
        // If tile has moved far enough forward, reset it to the back
        if (tile.position.z > FORWARD_THRESHOLD) {
            // Find the furthest back tile position
            let furthestBack = Math.min(...ground.map(t => t.position.z));
            tile.position.z = furthestBack - TILE_LENGTH;
        }
    });
}

// Function to dispose of ground tiles properly
export function disposeGround(ground, scene) {
    ground.forEach(tile => {
        // Remove from scene
        scene.remove(tile);
        
        // Dispose of geometries and materials
        tile.traverse(function(child) {
            if (child.isMesh) {
                if (child.geometry) {
                    child.geometry.dispose();
                }
                if (child.material) {
                    // Handle both single materials and arrays
                    if (Array.isArray(child.material)) {
                        child.material.forEach(material => {
                            if (material.map) material.map.dispose();
                            if (material.normalMap) material.normalMap.dispose();
                            if (material.roughnessMap) material.roughnessMap.dispose();
                            if (material.metalnessMap) material.metalnessMap.dispose();
                            material.dispose();
                        });
                    } else {
                        if (child.material.map) child.material.map.dispose();
                        if (child.material.normalMap) child.material.normalMap.dispose();
                        if (child.material.roughnessMap) child.material.roughnessMap.dispose();
                        if (child.material.metalnessMap) child.material.metalnessMap.dispose();
                        child.material.dispose();
                    }
                }
            }
        });
    });
    
    // Clear the ground array
    ground.length = 0;
}
