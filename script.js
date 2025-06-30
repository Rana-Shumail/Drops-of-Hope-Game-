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
const difficultySelect = document.getElementById('difficulty');

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

let difficulty = 'normal';
let winScore = 25;
let timeLimit = 0; // seconds, 0 = no limit
let spawnInterval = 30;
let timer = 0;
let timerInterval = null;

const milestones = [
    { score: 5, message: "Great start! 5 drops collected!" },
    { score: 10, message: "10 drops! You're making a difference!" },
    { score: 15, message: "15 drops! Keep going for clean water!" },
    { score: 20, message: "20 drops! Almost there!" }
];
let shownMilestones = [];

// Load jerry can image
const jerryImg = new Image();
jerryImg.src = 'jc2.png';

function setDifficulty(diff) {
    difficulty = diff;
    if (diff === 'easy') {
        winScore = 15;
        timeLimit = 0;
        spawnInterval = 40;
    } else if (diff === 'normal') {
        winScore = 25;
        timeLimit = 60;
        spawnInterval = 30;
    } else if (diff === 'hard') {
        winScore = 35;
        timeLimit = 45;
        spawnInterval = 20;
    }
}

difficultySelect.addEventListener('change', (e) => {
    setDifficulty(e.target.value);
    resetGame();
});

// Timer display
let timerDiv = null;
function updateTimerDisplay() {
    if (!timerDiv) {
        timerDiv = document.createElement('div');
        timerDiv.id = 'timer';
        timerDiv.style.fontSize = '1.2em';
        timerDiv.style.color = '#d84315';
        timerDiv.style.fontWeight = 'bold';
        timerDiv.style.marginBottom = '8px';
        scoreDisplay.parentNode.insertBefore(timerDiv, scoreDisplay.nextSibling);
    }
    if (timeLimit > 0) {
        timerDiv.textContent = `Time Left: ${timer}s`;
        timerDiv.style.display = '';
    } else {
        timerDiv.style.display = 'none';
    }
}

function startTimer() {
    if (timeLimit === 0) return;
    timer = timeLimit;
    updateTimerDisplay();
    if (timerInterval) clearInterval(timerInterval);
    timerInterval = setInterval(() => {
        timer--;
        updateTimerDisplay();
        if (timer <= 0) {
            clearInterval(timerInterval);
            timer = 0;
            updateTimerDisplay();
            if (gameRunning) {
                gameOver("Time's up!");
            }
        }
    }, 1000);
}
function stopTimer() {
    if (timerInterval) clearInterval(timerInterval);
}

function drawJerryCan() {
    ctx.save();
    ctx.translate(jerryX + JERRY_WIDTH / 2, JERRY_Y + JERRY_HEIGHT / 2);
    ctx.rotate(jerryRotation * Math.PI / 180);
    ctx.translate(-JERRY_WIDTH / 2, -JERRY_HEIGHT / 2);
    if (jerryImg.complete) {
        ctx.drawImage(jerryImg, 0, 0, JERRY_WIDTH, JERRY_HEIGHT);
    } else {
        jerryImg.onload = () => {
            ctx.drawImage(jerryImg, 0, 0, JERRY_WIDTH, JERRY_HEIGHT);
        };
    }
    ctx.restore();
}

let jerryRotation = 0;
let rotating = false;
canvas.addEventListener('click', function(e) {
    // If click is on jerry can, rotate it
    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    if (
        mouseX >= jerryX && mouseX <= jerryX + JERRY_WIDTH &&
        mouseY >= JERRY_Y && mouseY <= JERRY_Y + JERRY_HEIGHT
    ) {
        if (!rotating) {
            rotating = true;
            let angle = 0;
            const rotateStep = () => {
                if (angle < 360) {
                    jerryRotation += 20;
                    angle += 20;
                    draw();
                    requestAnimationFrame(rotateStep);
                } else {
                    jerryRotation = 0;
                    rotating = false;
                }
            };
            rotateStep();
        }
        return;
    }
    // Check if click is on any object
    for (let i = objects.length - 1; i >= 0; i--) {
        const obj = objects[i];
        // Use distance for emoji "hitbox"
        const dx = mouseX - obj.x;
        const dy = mouseY - obj.y;
        if (Math.sqrt(dx*dx + dy*dy) < obj.size * 1.2) {
            // Remove object and apply effect
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
            scoreDisplay.textContent = `Score: ${score}`;
            checkMilestones();
            return;
        }
    }
});

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

let gameTicks = 0; // Add this to track game progression

function spawnObject() {
    // Increase water probability: 60% water, 20% bacteria, 20% waste
    const rand = Math.random();
    let type;
    if (rand < 0.6) type = 'water';
    else if (rand < 0.8) type = 'bacteria';
    else type = 'waste';
    let size, baseSpeed;
    // Base speeds are lower at the start
    if (type === 'water') {
        size = 15;
        baseSpeed = 1.5;
    } else if (type === 'bacteria') {
        size = 18;
        baseSpeed = 1.2;
    } else {
        size = 20;
        baseSpeed = 1.0;
    }
    // Gradually increase speed as game progresses
    // Every 300 ticks (~5 seconds at 60fps), speed increases a bit
    const speedIncrease = Math.min(gameTicks / 300, 2.5); // Cap the increase
    const speed = baseSpeed + speedIncrease + Math.random() * 1.5;
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
    gameTicks++; // Increment game progression counter
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
            checkMilestones();
        } else if (obj.y - obj.size > CAN_HEIGHT) {
            // Missed object
            if (obj.type === 'water') {
                // Missed water drop: penalty
                score -= 1;
                hasScored = true;
                waterSound.currentTime = 0;
                waterSound.play();
                flashRed();
                checkMilestones();
            }
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
    if (score >= winScore) {
        goodJob();
        return;
    }
    // Spawn new objects
    spawnTimer++;
    if (spawnTimer > spawnInterval) {
        spawnObject();
        spawnTimer = 0;
    }
}

function checkMilestones() {
    for (const m of milestones) {
        if (score >= m.score && !shownMilestones.includes(m.score)) {
            shownMilestones.push(m.score);
            showMilestoneSidebar(m.message);
            break;
        }
    }
}

// Show milestone message in sidebar (disappears after 5 seconds)
let milestoneSidebarTimeout = null;
function showMilestoneSidebar(message) {
    const sidebar = document.getElementById('milestone-sidebar');
    sidebar.textContent = message;
    sidebar.classList.add('active');
    if (milestoneSidebarTimeout) clearTimeout(milestoneSidebarTimeout);
    milestoneSidebarTimeout = setTimeout(() => {
        sidebar.classList.remove('active');
    }, 5000);
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

function gameOver(msg) {
    gameRunning = false;
    stopTimer();
    showPopup(msg ? msg : 'Game Over!');
}

function goodJob() {
    gameRunning = false;
    stopTimer();
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
    setDifficulty(difficultySelect.value);
    gameRunning = true;
    paused = false;
    objects = [];
    score = 0;
    hasScored = false;
    shownMilestones = [];
    jerryX = (CAN_WIDTH - JERRY_WIDTH) / 2;
    scoreDisplay.textContent = `Score: ${score}`;
    spawnTimer = 0;
    messageDiv.innerHTML = '';
    jerryRotation = 0;
    gameTicks = 0; // Reset progression counter
    updateTimerDisplay();
    if (timeLimit > 0) {
        startTimer();
    }
    gameLoop();
}

function pauseGame() {
    if (!gameRunning) return;
    paused = !paused;
    if (!paused) {
        gameLoop();
    }
    pauseBtn.textContent = paused ? 'Resume' : 'Pause';
    if (paused) stopTimer();
    else if (gameRunning && timeLimit > 0) startTimer();
}

function resetGame() {
    gameRunning = false;
    paused = false;
    objects = [];
    score = 0;
    hasScored = false;
    shownMilestones = [];
    jerryX = (CAN_WIDTH - JERRY_WIDTH) / 2;
    scoreDisplay.textContent = `Score: ${score}`;
    ctx.clearRect(0, 0, CAN_WIDTH, CAN_HEIGHT);
    messageDiv.innerHTML = '';
    pauseBtn.textContent = 'Pause';
    jerryRotation = 0;
    stopTimer();
    updateTimerDisplay();
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