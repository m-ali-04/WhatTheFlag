const ENGINE_URL = '/api';

// ── Global state ─────────────────────────────────────────────────────────────
let currentMode    = '';          // 'number' | 'time' | 'race'
let currentQuestion = null;
let sessionId      = null;        // unique id per game session for no-repeat logic

let score          = 0;
let streak         = 0;
let maxStreak      = 0;
let questionCount  = 0;
let maxQuestions   = 10;
let correctCount   = 0;
let totalQuestionsAsked = 0;
let totalTimeMs    = 0;           // accumulated time player took (quiz number mode)
let questionStartTime = 0;        // timestamp when question was shown

let timer          = null;
let timeLeft       = 60;
let totalTimeLimit = 60;          // used for progress display

let isRacing       = false;
let playerProgress = 0;
let botProgress    = 0;
let botLevel       = 'medium';

// Score multiplier config
const STREAK_BONUS = [1, 1, 1.2, 1.5, 2.0]; // index = streak (capped at 4)
const BASE_SCORE   = 100;

// ── DOM shortcuts ────────────────────────────────────────────────────────────
const screens = {
    main:        document.getElementById('main-menu'),
    quiz:        document.getElementById('quiz-screen'),
    race:        document.getElementById('race-screen'),
    result:      document.getElementById('result-screen'),
    leaderboard: document.getElementById('leaderboard-screen')
};

function showScreen(name) {
    Object.values(screens).forEach(s => s.classList.remove('active'));
    screens[name].classList.add('active');
}

// ── Utility: unique session ID ───────────────────────────────────────────────
function newSessionId() {
    return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

// ── Seed ─────────────────────────────────────────────────────────────────────
async function seedDatabase() {
    const btn = document.getElementById('seed-btn');
    const msg = document.getElementById('seed-msg');
    btn.disabled = true;
    btn.textContent = 'Seeding…';
    try {
        const res  = await fetch(`${ENGINE_URL}/seed`, { method: 'POST' });
        const data = await res.json();
        msg.textContent   = res.ok ? data.message : data.error;
        msg.style.color   = res.ok ? 'var(--success)' : 'var(--error)';
    } catch {
        msg.textContent = 'Error connecting to engine.';
        msg.style.color = 'var(--error)';
    } finally {
        btn.disabled    = false;
        btn.textContent = 'Seed Database (First Time)';
    }
}

// ── Main menu ────────────────────────────────────────────────────────────────
function showMainMenu() {
    clearInterval(timer);
    isRacing = false;
    showScreen('main');
}

// ── Quiz (number mode) ───────────────────────────────────────────────────────
async function startQuizNumber() {
    maxQuestions  = parseInt(document.getElementById('quiz-count-select').value, 10);
    currentMode   = 'number';
    _resetCounters();
    _updateQuizStats();

    // Elapsed timer chip
    document.getElementById('time-display').textContent = '0.0s';
    _startElapsedTimer();

    showScreen('quiz');
    await loadQuestion('quiz');
}

// ── Quiz (time mode) ─────────────────────────────────────────────────────────
async function startQuizTime() {
    timeLeft      = parseInt(document.getElementById('quiz-time-select').value, 10);
    totalTimeLimit = timeLeft;
    currentMode   = 'time';
    _resetCounters();
    _updateQuizStats();

    document.getElementById('time-display').textContent = `${timeLeft}s`;
    _startCountdownTimer();

    showScreen('quiz');
    await loadQuestion('quiz');
}

// ── Race ─────────────────────────────────────────────────────────────────────
async function startRace() {
    botLevel      = document.getElementById('bot-level-select').value;
    timeLeft      = 60;
    currentMode   = 'race';
    isRacing      = true;
    _resetCounters();
    playerProgress = 0;
    botProgress    = 0;

    document.getElementById('bot-label').textContent =
        `Bot (${botLevel.charAt(0).toUpperCase() + botLevel.slice(1)})`;
    _updateRaceBars();
    document.getElementById('race-timer').textContent = '60s';
    _startCountdownTimer();

    showScreen('race');
    await loadQuestion('race');
}

// ── Counter helpers ──────────────────────────────────────────────────────────
function _resetCounters() {
    score         = 0;
    streak        = 0;
    maxStreak     = 0;
    questionCount = 0;
    correctCount  = 0;
    totalQuestionsAsked = 0;
    totalTimeMs   = 0;
    sessionId     = newSessionId(); // fresh session = no flag repeats
    
    // Reset save score UI
    document.getElementById('save-score-section').style.display = 'block';
    document.getElementById('username-input').value = '';
    document.getElementById('save-msg').textContent = '';
}

function _updateQuizStats() {
    document.getElementById('score-val').textContent   = score;
    document.getElementById('streak-val').textContent  = streak;
    if (currentMode === 'number') {
        document.getElementById('progress-display').textContent =
            `Q ${questionCount + 1}/${maxQuestions}`;
    } else {
        document.getElementById('progress-display').textContent =
            `${score} correct`;
    }
}

// ── Timers ───────────────────────────────────────────────────────────────────
let elapsedInterval = null;
let elapsedMs = 0;

function _startElapsedTimer() {
    clearInterval(elapsedInterval);
    elapsedMs = 0;
    elapsedInterval = setInterval(() => {
        elapsedMs += 100;
        document.getElementById('time-display').textContent =
            (elapsedMs / 1000).toFixed(1) + 's';
    }, 100);
}

function _stopElapsedTimer() {
    clearInterval(elapsedInterval);
}

function _startCountdownTimer() {
    clearInterval(timer);
    timer = setInterval(() => {
        timeLeft--;
        if (currentMode === 'time') {
            document.getElementById('time-display').textContent = `${timeLeft}s`;
            document.getElementById('progress-display').textContent = `${score} correct`;
        } else if (currentMode === 'race') {
            document.getElementById('race-timer').textContent = `${timeLeft}s`;
        }
        if (timeLeft <= 0) endGame();
    }, 1000);
}

// ── Load question ────────────────────────────────────────────────────────────
async function loadQuestion(screenType) {
    try {
        const res = await fetch(`${ENGINE_URL}/question?session_id=${sessionId}`);
        if (!res.ok) {
            alert('Ensure you have seeded the database first!');
            showMainMenu();
            return;
        }
        currentQuestion    = await res.json();
        questionStartTime  = Date.now();
        totalQuestionsAsked++;

        const imgId       = screenType === 'race' ? 'race-flag-img'          : 'flag-img';
        const containerId = screenType === 'race' ? 'race-options-container' : 'options-container';

        // Animate flag in
        const imgEl = document.getElementById(imgId);
        imgEl.src   = currentQuestion.flag_url;
        const card  = imgEl.closest('.flag-container') || imgEl.parentElement.parentElement;
        card.classList.remove('slide-in');
        void card.offsetWidth;
        card.classList.add('slide-in');

        // Build option buttons
        const container = document.getElementById(containerId);
        container.innerHTML = '';
        currentQuestion.options.forEach(opt => {
            const btn       = document.createElement('button');
            btn.className   = 'option-btn';
            btn.textContent = opt;
            btn.onclick     = () => handleAnswer(opt, btn, screenType);
            container.appendChild(btn);
        });

        // Start elapsed timer per-question for number mode
        if (currentMode === 'number') _startElapsedTimer();

        // Trigger bot immediately on race
        if (screenType === 'race' && isRacing) triggerBotRace();

    } catch (e) {
        console.error('Failed to load question', e);
    }
}

// ── Handle player answer ─────────────────────────────────────────────────────
async function handleAnswer(selectedOption, btnEl, screenType) {
    const isCorrect       = selectedOption === currentQuestion.correct_answer;
    const timeTakenMs     = Date.now() - questionStartTime;

    const containerId = screenType === 'race' ? 'race-options-container' : 'options-container';
    const buttons     = document.getElementById(containerId).querySelectorAll('.option-btn');
    buttons.forEach(b => (b.disabled = true));

    // ── Correct ──
    if (isCorrect) {
        btnEl.classList.add('correct');
        streak++;
        maxStreak   = Math.max(maxStreak, streak);
        correctCount++;
        totalTimeMs += timeTakenMs;

        // Calculate score with streak bonus + speed bonus
        const streakIdx   = Math.min(streak - 1, STREAK_BONUS.length - 1);
        const multiplier  = STREAK_BONUS[streakIdx];
        // Speed bonus: full BASE_SCORE if answered in <2s, decays down to 0.3x at 10s+
        const speedFactor = Math.max(0.3, 1 - (timeTakenMs - 2000) / 16000);
        const points      = Math.round(BASE_SCORE * multiplier * speedFactor);
        score += points;

        if (screenType !== 'race') {
            _showFloatingPoints(`+${points}${streak >= 3 ? ' 🔥' : ''}`, true);
        }

        if (screenType === 'race') {
            playerProgress += 10;
            _updateRaceBars();
            document.getElementById('race-score-val').textContent = score;
            if (playerProgress >= 100) { endGame(true); return; }
        }

    // ── Incorrect ──
    } else {
        btnEl.classList.add('incorrect');
        streak = 0;
        const card = btnEl.closest('.flag-container') || document.getElementById(
            screenType === 'race' ? 'race-screen' : 'quiz-screen'
        );
        document.getElementById(containerId).classList.add('shake');
        setTimeout(() => document.getElementById(containerId).classList.remove('shake'), 500);

        // Show correct answer
        buttons.forEach(b => {
            if (b.textContent === currentQuestion.correct_answer) b.classList.add('correct');
        });

        if (screenType !== 'race') _showFloatingPoints('✗', false);
    }

    // Update HUD
    if (screenType !== 'race') {
        document.getElementById('score-val').textContent  = score;
        document.getElementById('streak-val').textContent = streak;
    }

    // Record answer in engine
    fetch(`${ENGINE_URL}/answer`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ country_code: currentQuestion.country_code, correct: isCorrect })
    });

    // Number mode: check if we've finished
    if (currentMode === 'number') {
        _stopElapsedTimer();
        questionCount++;
        if (questionCount >= maxQuestions) {
            setTimeout(() => endGame(), 1200);
            return;
        }
        document.getElementById('progress-display').textContent =
            `Q ${questionCount + 1}/${maxQuestions}`;
    }

    // Load next question
    setTimeout(() => {
        if (currentMode === 'race' && !isRacing) return;
        if (timeLeft > 0 || currentMode === 'number') loadQuestion(screenType);
    }, 1200);
}

// ── Floating +points feedback ─────────────────────────────────────────────────
function _showFloatingPoints(text, positive) {
    const el = document.createElement('div');
    el.className   = 'float-points ' + (positive ? 'float-pos' : 'float-neg');
    el.textContent = text;
    document.querySelector('.container').appendChild(el);
    setTimeout(() => el.remove(), 900);
}

// ── Bot race logic ────────────────────────────────────────────────────────────
async function triggerBotRace() {
    if (!isRacing) return;
    const code = currentQuestion.country_code;

    try {
        const res  = await fetch(`${ENGINE_URL}/bot_race`, {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify({ country_code: code, bot_level: botLevel })
        });
        const data = await res.json();

        setTimeout(() => {
            if (!isRacing) return;

            if (data.correct) {
                botProgress += 10;
                _updateRaceBars();
                if (botProgress >= 100) { endGame(false); return; }
            } else {
                // Bot got it wrong — flash the bar red
                _animateBotWrong();
            }
        }, data.time_taken * 1000);

    } catch (e) {
        console.error('Bot failed', e);
    }
}

function _animateBotWrong() {
    const bar = document.getElementById('bot-bar');
    bar.classList.add('bot-wrong');
    setTimeout(() => bar.classList.remove('bot-wrong'), 700);
}

function _updateRaceBars() {
    const pp = Math.min(playerProgress, 100);
    const bp = Math.min(botProgress, 100);
    document.getElementById('player-fill').style.width = `${pp}%`;
    document.getElementById('bot-fill').style.width    = `${bp}%`;
    document.getElementById('player-pct').textContent  = `${pp}%`;
    document.getElementById('bot-pct').textContent     = `${bp}%`;
}

// ── Leaderboard logic ────────────────────────────────────────────────────────
async function loadLeaderboard() {
    try {
        const res = await fetch(`${ENGINE_URL}/leaderboard`);
        const data = await res.json();
        
        const tbody = document.getElementById('leaderboard-body');
        tbody.innerHTML = '';
        
        data.forEach((entry, idx) => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${idx + 1}</td>
                <td>${entry.username}</td>
                <td>${entry.score}</td>
                <td>${entry.mode}</td>
            `;
            tbody.appendChild(row);
        });
        
        showScreen('leaderboard');
    } catch (e) {
        alert("Could not load leaderboard.");
    }
}

async function saveScore() {
    const username = document.getElementById('username-input').value.trim();
    if (!username) {
        alert("Please enter a username!");
        return;
    }
    
    const saveBtn = document.querySelector('#save-score-section .btn');
    saveBtn.disabled = true;
    
    try {
        const res = await fetch(`${ENGINE_URL}/leaderboard`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                username: username,
                score: score,
                mode: currentMode === 'number' ? `Quiz (${maxQuestions})` : (currentMode === 'time' ? `Time (${totalTimeLimit}s)` : 'Race')
            })
        });
        
        if (res.ok) {
            document.getElementById('save-msg').textContent = "Score saved! 🏆";
            document.getElementById('save-msg').style.color = "var(--success)";
            setTimeout(() => {
                document.getElementById('save-score-section').style.display = 'none';
            }, 1000);
        } else {
            document.getElementById('save-msg').textContent = "Failed to save.";
            saveBtn.disabled = false;
        }
    } catch (e) {
        alert("Error connecting to server.");
        saveBtn.disabled = false;
    }
}

// ── End game ─────────────────────────────────────────────────────────────────
function endGame(playerWonRace = null) {
    clearInterval(timer);
    _stopElapsedTimer();
    isRacing = false;

    const resultTitle = document.getElementById('result-title');
    const finalScore  = document.getElementById('final-score');
    const finalPct    = document.getElementById('final-percentage');
    const statsDiv    = document.getElementById('result-stats');
    finalScore.style.color = 'var(--success)';

    let titleText = 'Game Over';
    let scoreText = '';
    let pctText   = '';
    let statsHTML = '';

    // Show save score if they scored something
    if (score > 0) {
        document.getElementById('save-score-section').style.display = 'block';
    } else {
        document.getElementById('save-score-section').style.display = 'none';
    }

    if (currentMode === 'number') {
        const pct     = ((correctCount / maxQuestions) * 100).toFixed(0);
        const avgTime = correctCount > 0 ? (totalTimeMs / correctCount / 1000).toFixed(1) : '—';
        const grade   = pct >= 90 ? '🥇' : pct >= 70 ? '🥈' : pct >= 50 ? '🥉' : '💀';
        titleText = 'Quiz Complete!';
        scoreText = `${score} pts`;
        pctText   = `${grade} ${pct}% Accuracy`;
        statsHTML = `
            <p>Correct: <strong>${correctCount} / ${maxQuestions}</strong></p>
            <p>Avg Time: <strong>${avgTime}s</strong></p>
            <p>Best Streak: <strong>${maxStreak} 🔥</strong></p>`;

    } else if (currentMode === 'time') {
        const accuracy = totalQuestionsAsked > 0 ? ((correctCount / totalQuestionsAsked) * 100).toFixed(0) : 0;
        titleText = 'Time\'s Up!';
        scoreText = `${score} pts`;
        pctText   = `${accuracy}% Accuracy`;
        statsHTML = `
            <p>Correct Flags: <strong>${correctCount}</strong></p>
            <p>Best Streak: <strong>${maxStreak} 🔥</strong></p>
            <p>Time Limit: <strong>${totalTimeLimit}s</strong></p>`;

    } else if (currentMode === 'race') {
        const accuracy = totalQuestionsAsked > 0 ? ((correctCount / totalQuestionsAsked) * 100).toFixed(0) : 0;
        if (playerWonRace === true) {
            titleText = '🎉 You Win!';
            scoreText = `${score} pts`;
        } else if (playerWonRace === false) {
            titleText = '🤖 Bot Wins!';
            scoreText = `${score} pts`;
            finalScore.style.color = 'var(--error)';
        } else {
            titleText = "Time's Up!";
            scoreText = `${score} pts`;
            finalScore.style.color = playerProgress > botProgress ? 'var(--success)' : 'var(--error)';
        }
        pctText = `${accuracy}% Accuracy`;
        statsHTML = `
            <p>Your Progress: <strong>${playerProgress}%</strong></p>
            <p>Bot Progress: <strong>${botProgress}%</strong></p>
            <p>Best Streak: <strong>${maxStreak} 🔥</strong></p>`;
    }

    resultTitle.textContent  = titleText;
    finalScore.textContent   = scoreText;
    finalPct.textContent     = pctText;
    statsDiv.innerHTML       = statsHTML;

    showScreen('result');
}
