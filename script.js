const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const scoreDisplay = document.getElementById('score');
const startBtn = document.getElementById('startBtn');
const resetBtn = document.getElementById('resetBtn');
const pauseBtn = document.getElementById('pauseBtn');
const messageDiv = document.getElementById('message');
const popup = document.getElementById('popup');
const popupContent = document.getElementById('popupContent');
const closePopup = document.getElementById('closePopup');
const confettiCanvas = document.getElementById('confettiCanvas');

const CAN_WIDTH = canvas.width;
const CAN_HEIGHT = canvas.height;

const JERRY_WIDTH = 75; // Increased size
const JERRY_HEIGHT = 50; // Increased size
const JERRY_Y = CAN_HEIGHT - JERRY_HEIGHT - 10;
let jerryX = (CAN_WIDTH - JERRY_WIDTH) / 2;
let jerrySpeed = 7;
let leftPressed = false;
let rightPressed = false;

let objects = [];
let score = 0;
let gameRunning = false;
let paused = false;
let spawnTimer = 0;
let flashTimeout = null;
let hasScored = false;
let confettiActive = false;

// Load jerry can image
const jerryImg = new Image();
jerryImg.src = 'jc2.png';

function drawJerryCan() {
    if (jerryImg.complete) {
        ctx.drawImage(jerryImg, jerryX, JERRY_Y, JERRY_WIDTH, JERRY_HEIGHT);
    } else {
        jerryImg.onload = () => {
            ctx.drawImage(jerryImg, jerryX, JERRY_Y, JERRY_WIDTH, JERRY_HEIGHT);
        };
    }
}

function drawObject(obj) {
    ctx.save();
    ctx.font = `${obj.size * 2}px serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    let emoji = '';
    if (obj.type === 'water') emoji = '💧';
    else if (obj.type === 'bacteria') emoji = '🦠';
    else if (obj.type === 'waste') emoji = '☣️';
    ctx.fillText(emoji, obj.x, obj.y);
    ctx.restore();
}

function spawnObject() {
    // Increase water probability: 60% water, 20% bacteria, 20% waste
    const rand = Math.random();
    let type;
    if (rand < 0.6) type = 'water';
    else if (rand < 0.8) type = 'bacteria';
    else type = 'waste';
    let size, speed;
    if (type === 'water') {
        size = 15;
        speed = 3 + Math.random() * 2;
    } else if (type === 'bacteria') {
        size = 18;
        speed = 2.5 + Math.random() * 2;
    } else {
        size = 20;
        speed = 2 + Math.random() * 2;
    }
    const x = size + Math.random() * (CAN_WIDTH - size * 2);
    objects.push({ type, x, y: -size, size, speed });
}

function draw() {
    ctx.clearRect(0, 0, CAN_WIDTH, CAN_HEIGHT);
    drawJerryCan();
    for (const obj of objects) {
        drawObject(obj);
    }
}

function update() {
    if (!gameRunning || paused) return;
    // Move jerry can
    if (leftPressed) jerryX = Math.max(0, jerryX - jerrySpeed);
    if (rightPressed) jerryX = Math.min(CAN_WIDTH - JERRY_WIDTH, jerryX + jerrySpeed);
    // Move objects
    for (const obj of objects) {
        obj.y += obj.speed;
    }
    // Collision detection
    for (let i = objects.length - 1; i >= 0; i--) {
        const obj = objects[i];
        if (
            obj.y + obj.size > JERRY_Y &&
            obj.x > jerryX && obj.x < jerryX + JERRY_WIDTH
        ) {
            if (obj.type === 'water') {
                score += 1;
                hasScored = true;
                waterSound.currentTime = 0;
                waterSound.play();
            } else if (obj.type === 'bacteria') {
                score -= 1;
                bacteriaSound.currentTime = 0;
                bacteriaSound.play();
                flashRed();
            } else if (obj.type === 'waste') {
                score -= 2;
                wasteSound.currentTime = 0;
                wasteSound.play();
                flashRed();
            }
            objects.splice(i, 1);
        } else if (obj.y - obj.size > CAN_HEIGHT) {
            objects.splice(i, 1);
        }
    }
    scoreDisplay.textContent = `Score: ${score}`;
    // Check for game over or win
    if (hasScored && score <= 0) {
        score = 0;
        gameOver();
        return;
    }
    if (score >= 25) {
        goodJob();
        return;
    }
    // Spawn new objects
    spawnTimer++;
    if (spawnTimer > 30) {
        spawnObject();
        spawnTimer = 0;
    }
}

function showPopup(content, withConfetti = false) {
    // Add a Close button to the popup content
    popupContent.innerHTML = content + '<br><button id="popupCloseBtn" class="popup-close-btn">Close</button>';
    popup.classList.add('active');
    if (withConfetti) {
        confettiCanvas.style.display = 'block';
        startConfetti();
    } else {
        confettiCanvas.style.display = 'none';
        stopConfetti();
    }
    // Add event listener for the Close button
    setTimeout(() => {
        const btn = document.getElementById('popupCloseBtn');
        if (btn) btn.onclick = hidePopup;
    }, 0);
}

function hidePopup() {
    popup.classList.remove('active');
    confettiCanvas.style.display = 'none';
    stopConfetti();
}

closePopup.onclick = hidePopup;

function gameOver() {
    gameRunning = false;
    showPopup('Game Over!');
}

function goodJob() {
    gameRunning = false;
    showPopup('Good Job!<br><span class="fact">Did you know? charity: water has funded over 111,000 water projects, bringing clean water to more than 15 million people in 29 countries!</span>', true);
}

// Confetti animation
let confettiParticles = [];
function startConfetti() {
    confettiActive = true;
    confettiParticles = [];
    for (let i = 0; i < 120; i++) {
        confettiParticles.push({
            x: Math.random() * confettiCanvas.width,
            y: Math.random() * -confettiCanvas.height,
            r: 6 + Math.random() * 6,
            d: 2 + Math.random() * 2,
            color: `hsl(${Math.random()*360},90%,60%)`,
            tilt: Math.random() * 10 - 10,
            tiltAngle: 0,
            tiltAngleIncremental: (Math.random() * 0.07) + 0.05
        });
    }
    requestAnimationFrame(drawConfetti);
}
function stopConfetti() {
    confettiActive = false;
    confettiParticles = [];
    const ctx2 = confettiCanvas.getContext('2d');
    ctx2.clearRect(0, 0, confettiCanvas.width, confettiCanvas.height);
}
function drawConfetti() {
    if (!confettiActive) return;
    const ctx2 = confettiCanvas.getContext('2d');
    ctx2.clearRect(0, 0, confettiCanvas.width, confettiCanvas.height);
    for (let i = 0; i < confettiParticles.length; i++) {
        let p = confettiParticles[i];
        ctx2.beginPath();
        ctx2.ellipse(p.x, p.y, p.r, p.r/2, p.tilt, 0, 2 * Math.PI);
        ctx2.fillStyle = p.color;
        ctx2.fill();
        p.y += p.d;
        p.tiltAngle += p.tiltAngleIncremental;
        p.tilt = Math.sin(p.tiltAngle) * 10;
        if (p.y > confettiCanvas.height) {
            p.x = Math.random() * confettiCanvas.width;
            p.y = Math.random() * -20;
        }
    }
    requestAnimationFrame(drawConfetti);
}

function gameLoop() {
    update();
    draw();
    if (gameRunning && !paused) {
        requestAnimationFrame(gameLoop);
    }
}

function startGame() {
    if (gameRunning) return;
    gameRunning = true;
    paused = false;
    objects = [];
    score = 0;
    hasScored = false;
    jerryX = (CAN_WIDTH - JERRY_WIDTH) / 2;
    scoreDisplay.textContent = `Score: ${score}`;
    spawnTimer = 0;
    messageDiv.innerHTML = '';
    gameLoop();
}

function pauseGame() {
    if (!gameRunning) return;
    paused = !paused;
    if (!paused) {
        gameLoop();
    }
    pauseBtn.textContent = paused ? 'Resume' : 'Pause';
}

function resetGame() {
    gameRunning = false;
    paused = false;
    objects = [];
    score = 0;
    hasScored = false;
    jerryX = (CAN_WIDTH - JERRY_WIDTH) / 2;
    scoreDisplay.textContent = `Score: ${score}`;
    ctx.clearRect(0, 0, CAN_WIDTH, CAN_HEIGHT);
    messageDiv.innerHTML = '';
    pauseBtn.textContent = 'Pause';
}

function flashRed() {
    canvas.classList.add('red-flash');
    if (flashTimeout) clearTimeout(flashTimeout);
    flashTimeout = setTimeout(() => {
        canvas.classList.remove('red-flash');
    }, 200);
}

document.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowLeft') leftPressed = true;
    if (e.key === 'ArrowRight') rightPressed = true;
    if (e.key === 'r' || e.key === 'R') resetGame();
});
document.addEventListener('keyup', (e) => {
    if (e.key === 'ArrowLeft') leftPressed = false;
    if (e.key === 'ArrowRight') rightPressed = false;
});

startBtn.addEventListener('click', startGame);
resetBtn.addEventListener('click', resetGame);
pauseBtn.addEventListener('click', pauseGame);