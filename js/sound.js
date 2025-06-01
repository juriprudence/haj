// sound.js
// Handles all sound effects and background music for the endless runner game

let backgroundAudio = null;
let jumpAudio = null;
let dogBarkAudio = null;
let chickenAudio = null;

export function initSounds() {
    // Background music
    if (!backgroundAudio) {
        backgroundAudio = new Audio('sound/Allaoui.mp3');
        backgroundAudio.loop = true;
        backgroundAudio.volume = 0;
    }
    // Jump sound
    if (!jumpAudio) {
        jumpAudio = new Audio('sound/jump.mp3');
        jumpAudio.volume = 0.7;
    }
    // Dog bark sound
    if (!dogBarkAudio) {
        dogBarkAudio = new Audio('sound/dog.mp3');
        dogBarkAudio.volume = 0.8;
    }
    // Chicken sound
    if (!chickenAudio) {
        chickenAudio = new Audio('sound/chiken.mp3');
        chickenAudio.volume = 0.7;
    }
}

export function playBackgroundMusic() {
    if (backgroundAudio && backgroundAudio.paused) {
        backgroundAudio.play().catch(() => {});
    }
}

export function stopBackgroundMusic() {
    if (backgroundAudio && !backgroundAudio.paused) {
        backgroundAudio.pause();
        backgroundAudio.currentTime = 0;
    }
}

export function playJumpSound() {
    if (jumpAudio) {
        jumpAudio.currentTime = 0;
        jumpAudio.play().catch(() => {});
    }
}

export function playDogBark() {
    if (dogBarkAudio) {
        dogBarkAudio.currentTime = 0;
        dogBarkAudio.play().catch((e) => {
            console.warn('Dog bark sound play failed:', e);
        });
    } else {
        console.warn('Dog bark audio not initialized');
    }
}

export function playChickenSound() {
    if (chickenAudio) {
        chickenAudio.currentTime = 0;
        chickenAudio.play().catch(() => {});
        setTimeout(() => {
            if (!chickenAudio.paused) chickenAudio.pause();
        }, 1000); // Stop after 1 second
    }
}

export function setBackgroundMusicVolume(vol) {
    if (backgroundAudio) backgroundAudio.volume = vol;
}

export function setJumpSoundVolume(vol) {
    if (jumpAudio) jumpAudio.volume = vol;
}
