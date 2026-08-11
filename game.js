const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

function resize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
}
window.addEventListener('resize', resize);
resize();

let gameState = "MENU";
let survivalTime = 0;
let gameInterval;

const player = {
    x: canvas.width / 2,
    y: canvas.height / 2,
    width: 32,
    height: 60,
    angle: 0,
    speed: 0,
    maxSpeed: 12,
    acceleration: 0.15,
    friction: 0.98,
    turnSpeed: 0.045,
    driftFactor: 0.92,
    hp: 100
};

// Police Cruiser Array
let cops = [];
// Debris parts that fly off on impact
let debris = [];

const keys = {};
window.addEventListener('keydown', e => keys[e.code] = true);
window.addEventListener('keyup', e => keys[e.code] = false);

document.getElementById('start-btn').addEventListener('click', () => {
    document.getElementById('start-screen').style.display = 'none';
    gameState = "PLAYING";
    
    // Spawn initial cops
    cops.push(createCop(), createCop());

    // Timer tracker
    gameInterval = setInterval(() => {
        if (gameState === "PLAYING") {
            survivalTime++;
            document.getElementById('time-display').innerText = survivalTime;
            // Spawn more cops over time
            if (survivalTime % 10 === 0) cops.push(createCop());
        }
    }, 1000);
});

function createCop() {
    return {
        x: Math.random() * canvas.width,
        y: Math.random() < 0.5 ? -50 : canvas.height + 50,
        width: 32,
        height: 60,
        angle: 0,
        speed: 4 + Math.random() * 3,
        maxSpeed: 8.5,
        turnSpeed: 0.038
    };
}

function spawnDebris(x, y) {
    for (let i = 0; i < 3; i++) {
        debris.push({
            x: x,
            y: y,
            vx: (Math.random() - 0.5) * 8,
            vy: (Math.random() - 0.5) * 8,
            size: 4 + Math.random() * 6,
            life: 60 // frames to live
        });
    }
}

function update() {
    if (gameState !== "PLAYING") return;

    // Player Movement
    if (keys['KeyW'] || keys['ArrowUp']) player.speed += player.acceleration;
    if (keys['KeyS'] || keys['ArrowDown']) player.speed -= player.acceleration * 1.5;

    player.speed *= player.friction;
    player.speed = Math.max(-player.maxSpeed / 3, Math.min(player.maxSpeed, player.speed));

    let currentTurn = player.turnSpeed * (player.speed / player.maxSpeed);
    if (keys['KeyA'] || keys['ArrowLeft']) player.angle -= currentTurn;
    if (keys['KeyD'] || keys['ArrowRight']) player.angle += currentTurn;

    let frictionMultiplier = keys['Space'] ? player.driftFactor : 0.96;
    
    player.x += Math.sin(player.angle) * player.speed * frictionMultiplier;
    player.y -= Math.cos(player.angle) * player.speed * frictionMultiplier;

    // Screen wrapping for infinite world feel
    if (player.x < 0) player.x = canvas.width;
    if (player.x > canvas.width) player.x = 0;
    if (player.y < 0) player.y = canvas.height;
    if (player.y > canvas.height) player.y = 0;

    // Update Cop AI (Chase Player)
    cops.forEach(cop => {
        let dx = player.x - cop.x;
        let dy = player.y - cop.y;
        let targetAngle = Math.atan2(dx, -dy);

        // Smooth steering towards player
        let angleDiff = targetAngle - cop.angle;
        while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
        while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
        cop.angle += angleDiff * 0.05;

        cop.x += Math.sin(cop.angle) * cop.speed;
        cop.y -= Math.cos(cop.angle) * cop.speed;

        // Collision Check (Player vs Cop)
        let dist = Math.hypot(player.x - cop.x, player.y - cop.y);
        if (dist < 45) {
            player.hp -= 10;
            document.getElementById('hp-display').innerText = Math.max(0, player.hp);
            
            // Spawn falling parts!
            spawnDebris(player.x, player.y);

            // Knockback effect
            player.speed *= -0.5;
            cop.x -= Math.sin(cop.angle) * 30;
            cop.y += Math.cos(cop.angle) * 30;

            if (player.hp <= 0) {
                gameState = "OVER";
                document.getElementById('game-over-screen').style.display = 'flex';
            }
        }
    });

    // Update Debris
    debris.forEach(d => {
        d.x += d.vx;
        d.y += d.vy;
        d.life--;
    });
    debris = debris.filter(d => d.life > 0);

    // Update HUD
    document.getElementById('speed-display').innerText = Math.abs(Math.round(player.speed * 10));
}

function draw() {
    ctx.fillStyle = '#0f0f1c';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Scrolling Grid Background
    ctx.strokeStyle = '#18182c';
    ctx.lineWidth = 1;
    let gridSize = 80;
    let offsetX = -(player.x * 0.5) % gridSize;
    let offsetY = -(player.y * 0.5) % gridSize;

    ctx.beginPath();
    for (let x = offsetX; x < canvas.width; x += gridSize) {
        ctx.moveTo(x, 0);
        ctx.lineTo(x, canvas.height);
    }
    for (let y = offsetY; y < canvas.height; y += gridSize) {
        ctx.moveTo(0, y);
        ctx.lineTo(canvas.width, y);
    }
    ctx.stroke();

    if (gameState !== "PLAYING") return;

    // Draw Debris (Falling Parts)
    debris.forEach(d => {
        ctx.fillStyle = '#ff5500';
        ctx.fillRect(d.x, d.y, d.size, d.size);
    });

    // Draw Cops (Police Cruisers with flashing lights)
    cops.forEach(cop => {
        ctx.save();
        ctx.translate(cop.x, cop.y);
        ctx.rotate(cop.angle);

        // Cop Body (Black & White)
        ctx.fillStyle = '#111118';
        ctx.fillRect(-cop.width / 2, -cop.height / 2, cop.width, cop.height);
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(-cop.width / 4, -cop.height / 4, cop.width / 2, cop.height / 2);

        // Flashing Siren (Red / Blue)
        let sirenColor = Math.floor(Date.now() / 150) % 2 === 0 ? '#ff0000' : '#0000ff';
        ctx.fillStyle = sirenColor;
        ctx.shadowColor = sirenColor;
        ctx.shadowBlur = 10;
        ctx.fillRect(-4, -4, 8, 8);

        ctx.restore();
    });

    // Draw Player Car
    ctx.save();
    ctx.translate(player.x, player.y);
    ctx.rotate(player.angle);

    // Drift smoke/sparks
    if (keys['Space'] && Math.abs(player.speed) > 3) {
        ctx.fillStyle = 'rgba(0, 243, 255, 0.3)';
        ctx.fillRect(-player.width / 2 - 4, player.height / 2 - 5, 6, 10);
        ctx.fillRect(player.width / 2 - 2, player.height / 2 - 5, 6, 10);
    }

    // Car Body
    ctx.fillStyle = player.hp < 40 ? '#aa0033' : '#ff0055';
    ctx.shadowColor = '#ff0055';
    ctx.shadowBlur = 12;
    ctx.fillRect(-player.width / 2, -player.height / 2, player.width, player.height);

    // Windshield
    ctx.fillStyle = '#00f3ff';
    ctx.fillRect(-player.width / 2 + 4, -player.height / 2 + 10, player.width - 8, 14);

    ctx.restore();
}

function loop() {
    update();
    draw();
    requestAnimationFrame(loop);
}

loop();
