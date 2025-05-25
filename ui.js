// ui.js - Handles UI updates for the endless runner game

export function updateScoreUI(score) {
    document.getElementById('score').textContent = Math.floor(score);
}

export function updateCoinsUI(coins) {
    document.getElementById('coins').textContent = coins;
}

export function updateSmallHitsUI(hits) {
    document.getElementById('smallHits').textContent = hits;
}

export function showDogWarning(distance) {
    document.getElementById('dogWarning').style.display = 'block';
    document.getElementById('dogDistance').textContent = Math.floor(distance);
}

export function hideDogWarning() {
    document.getElementById('dogWarning').style.display = 'none';
}

export function showGameOver(finalScore, finalCoins, reason) {
    document.getElementById('finalScore').textContent = Math.floor(finalScore);
    document.getElementById('finalCoins').textContent = finalCoins;
    document.getElementById('gameOver').style.display = 'block';
    document.getElementById('dogWarning').style.display = 'none';
    const gameOverTitle = document.getElementById('gameOverTitle');
    const gameOverReason = document.getElementById('gameOverReason');
    if (reason === 'dog') {
        gameOverTitle.textContent = 'أمسك بك الكلب!';
        gameOverReason.textContent = `تم القبض عليك بعد ${document.getElementById('smallHits').textContent} اصطدامات صغيرة`;
    } else {
        gameOverTitle.textContent = 'انتهت اللعبة!';
        gameOverReason.textContent = 'اصطدمت بعقبة كبيرة';
    }
}

export function hideGameOver() {
    document.getElementById('gameOver').style.display = 'none';
}

export function resetUI() {
    updateScoreUI(0);
    updateCoinsUI(0);
    updateSmallHitsUI(0);
    hideGameOver();
    hideDogWarning();
}
