/* script.js */

var SUPABASE_URL = window.SUPABASE_URL || "https://tukabyhjmcyptuwmwedp.supabase.co";
var SUPABASE_ANON_KEY = window.SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR1a2FieWhqbWN5cHR1d213ZWRwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA0NDk3NDksImV4cCI6MjA5NjAyNTc0OX0.gNWdvZ_hRdon_w_KL3C3eXFFiV_EoA4eLgikcYb6dpQ";

if (SUPABASE_URL && !SUPABASE_URL.startsWith("http://") && !SUPABASE_URL.startsWith("https://")) {
    SUPABASE_URL = "https://" + SUPABASE_URL;
}

// Chống bôi đen văn bản trên toàn bộ trang
document.body.style.webkitUserSelect = "none";
document.body.style.mozUserSelect = "none";
document.body.style.msUserSelect = "none";
document.body.style.userSelect = "none";

var supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const channel = supabaseClient.channel('crossword_broadcast_room', {
    config: { broadcast: { ack: false, self: true } }
});

window.crosswordCallbacks = window.crosswordCallbacks || [];

let syncInterval = null;
let hasReceivedSync = false;

const board = document.getElementById("board");

const showSound = new Audio("reveal.mp3");
const revealSound = new Audio("ClearTossUp.mp3");
const clearPuzzleSound = new Audio("ClearPuzzle.mp3");
const tossupSound = new Audio("tossup.mp3");
tossupSound.loop = true;
let currentSoundboardAudio = null;
let currentQuizIndex = 0;
let allCells = [];
let absoluteCells = new Array(52).fill(null);

let buzzerLocked = true;
let currentBuzzedPlayer = null;

// Biến lưu trữ trạng thái toàn cục của game để đồng bộ cho các máy khác
let gameState = {
    players: {
        p1: { name: "PLAYER 1", score: 0, statusClass: "" },
        p2: { name: "PLAYER 2", score: 0, statusClass: "" },
        p3: { name: "PLAYER 3", score: 0, statusClass: "" }
    },
    currentQuiz: null,         // Đề thi đang chạy { index, letters, isManual, manualData }
    revealedPositions: [],    // Các vị trí ô chữ đã mở (1-based index)
    solvedRows: [],           // Các hàng đã giải
    buzzerState: "LOCKED",    // Trạng thái chuông hiện tại (LOCKED / OPEN_NORMAL / SPECIAL_PLAYER_OPEN)
    specialSelectedPlayer: null,
    specialTimerValue: 45,
    guessedLetters: [],
    currentBuzzedPlayer: null,
    buzzerLocked: true
};

function initAudioPermission() {
    showSound.load(); revealSound.load(); clearPuzzleSound.load(); tossupSound.load();
}

function formatNumberWithDots(num) {
    if (num === undefined || num === null) return "0";
    return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

function playDing() {
    const audio = new Audio("ding.wav");
    audio.play().then(() => {
        audio.onended = () => { audio.remove(); };
    }).catch(e => console.log(e));
}

function playBuzzer() {
    const audio = new Audio("buzzer.mp3");
    audio.play().then(() => {
        audio.onended = () => { audio.remove(); };
    }).catch(e => console.log(e));
}

function playSecondDing() {
    const audio = new Audio("2nd_ding.wav");
    audio.play().then(() => {
        audio.onended = () => { audio.remove(); };
    }).catch(e => console.log(e));
}

function playWrong() {
    const audio = new Audio("wrong.mp3");
    audio.play().then(() => {
        audio.onended = () => { audio.remove(); };
    }).catch(e => console.log(e));
}

function playTimerSound(seconds) {
    let sec = seconds;
    let isSpecial = false;

    if (typeof seconds === 'object' && seconds !== null) {
        sec = seconds.seconds;
        isSpecial = seconds.isSpecial;
    }

    let filename = "";
    if (isSpecial) {
        filename = sec === 30 ? "30s_vđb_2005.mp3" : "think.mp3";
    } else {
        filename = sec === 30 ? "30s.mp3" : "10s.mp3";
    }

    const audio = new Audio(filename);
    audio.play().catch(e => console.log(e));
}

function playTossupMusic() {
    let playPromise = tossupSound.play();
    if (playPromise !== undefined) {
        playPromise.catch(() => {
            document.body.addEventListener('click', function memoPlay() {
                tossupSound.play();
                document.body.removeEventListener('click', memoPlay);
            }, { once: true });
        });
    }
}

function cleanLetter(letter) {
    if (!letter) return "";
    let cleaned = letter.replace("_", "");
    return removeVietnameseTones(cleaned).toUpperCase();
}

function removeVietnameseTones(str) {
    const map = {
        "á": "a", "à": "a", "ả": "a", "ã": "a", "ạ": "a", "Á": "A", "À": "A", "Ả": "A", "Ã": "A", "Ạ": "A",
        "ấ": "â", "ầ": "â", "ẩ": "â", "ẫ": "â", "ậ": "â", "Ấ": "Â", "Ầ": "Â", "Ẩ": "Â", "Ẫ": "Â", "Ậ": "Â",
        "ắ": "ă", "ằ": "ă", "ẳ": "ă", "ẵ": "ă", "ặ": "ă", "Ắ": "Ă", "Ằ": "Ă", "Ẳ": "Ă", "Ẵ": "Ă", "Ặ": "Ă",
        "é": "e", "è": "e", "ẻ": "e", "ẽ": "e", "ẹ": "e", "É": "E", "È": "E", "Ẻ": "E", "Ẽ": "E", "Ẹ": "E",
        "ế": "ê", "ề": "ê", "ể": "ê", "ễ": "ê", "ệ": "ê", "Ế": "Ê", "Ề": "Ê", "Ể": "Ê", "Ễ": "Ê", "Ệ": "Ê",
        "í": "i", "ì": "i", "ỉ": "i", "ĩ": "i", "ị": "i", "Í": "I", "Ì": "I", "Ỉ": "I", "Ĩ": "I", "Ị": "I",
        "ó": "o", "ò": "o", "ỏ": "o", "õ": "o", "ọ": "o", "Ó": "O", "Ò": "O", "Ỏ": "O", "Õ": "O", "Ọ": "O",
        "ố": "ô", "ồ": "ô", "ổ": "ô", "ỗ": "ô", "ộ": "ô", "Ố": "Ô", "Ồ": "Ô", "Ổ": "Ô", "Ỗ": "Ô", "Ộ": "Ô",
        "ớ": "ơ", "ờ": "ơ", "ở": "ơ", "ỡ": "ơ", "ợ": "ơ", "Ớ": "Ơ", "Ờ": "Ơ", "Ở": "Ơ", "Ỡ": "Ơ", "Ợ": "Ơ",
        "ú": "u", "ù": "u", "ủ": "u", "ũ": "u", "ụ": "u", "Ú": "U", "Ù": "U", "Ủ": "U", "Ũ": "U", "Ụ": "U",
        "ứ": "ư", "ừ": "ư", "ử": "ư", "ữ": "ư", "ự": "ư", "Ứ": "Ư", "Ừ": "Ư", "Ử": "Ư", "Ữ": "Ư", "Ự": "Ư",
        "ý": "y", "ỳ": "y", "ỷ": "y", "ỹ": "y", "ỵ": "y", "Ý": "Y", "Ỳ": "Y", "Ỷ": "Y", "Ỹ": "Y", "Ỵ": "Y"
    };
    return str.split("").map(c => map[c] || c).join("");
}

const cells = [
    { x: 246, y: 140 }, { x: 366, y: 140 }, { x: 486, y: 140 }, { x: 606, y: 140 }, { x: 726, y: 140 }, { x: 846, y: 140 }, { x: 966, y: 140 }, { x: 1086, y: 140 }, { x: 1206, y: 140 }, { x: 1326, y: 140 }, { x: 1446, y: 140 }, { x: 1566, y: 140 },
    { x: 126, y: 290 }, { x: 246, y: 290 }, { x: 366, y: 290 }, { x: 486, y: 290 }, { x: 606, y: 290 }, { x: 726, y: 290 }, { x: 846, y: 290 }, { x: 966, y: 290 }, { x: 1086, y: 290 }, { x: 1206, y: 290 }, { x: 1326, y: 290 }, { x: 1446, y: 290 }, { x: 1566, y: 290 }, { x: 1686, y: 290 },
    { x: 126, y: 440 }, { x: 246, y: 440 }, { x: 366, y: 440 }, { x: 486, y: 440 }, { x: 606, y: 440 }, { x: 726, y: 440 }, { x: 846, y: 440 }, { x: 966, y: 440 }, { x: 1086, y: 440 }, { x: 1206, y: 440 }, { x: 1326, y: 440 }, { x: 1446, y: 440 }, { x: 1566, y: 440 }, { x: 1688, y: 440 },
    { x: 246, y: 590 }, { x: 366, y: 590 }, { x: 486, y: 590 }, { x: 606, y: 590 }, { x: 726, y: 590 }, { x: 846, y: 590 }, { x: 966, y: 590 }, { x: 1086, y: 590 }, { x: 1206, y: 590 }, { x: 1326, y: 590 }, { x: 1446, y: 590 }, { x: 1566, y: 590 }
];

function getRowFromIndex(i) {
    if (i < 12) return 0;
    if (i < 26) return 1;
    if (i < 40) return 2;
    return 3;
}

function syncControlUI(type, data) {
    channel.send({
        type: 'broadcast',
        event: 'display-to-control',
        payload: { type: type, data: data }
    });
}

function pressBuzzer() {
    // Nếu trong Vòng đặc biệt và Player này bấm chuông
    if (gameState.buzzerState === "SPECIAL_PLAYER_OPEN") {
        if (typeof MY_PLAYER_ID !== 'undefined' && MY_PLAYER_ID === gameState.specialSelectedPlayer && currentBuzzedPlayer === null) {
            channel.send({
                type: 'broadcast',
                event: 'control-to-display',
                payload: { type: 'PLAYER_BUZZ_REQUEST', data: MY_PLAYER_ID }
            });
            syncControlUI("PLAYER_BUZZ_REQUEST", MY_PLAYER_ID);
        }
        return;
    }

    if (typeof MY_PLAYER_ID === 'undefined' || buzzerLocked || currentBuzzedPlayer !== null) return;

    channel.send({
        type: 'broadcast',
        event: 'control-to-display',
        payload: { type: 'PLAYER_BUZZ_REQUEST', data: MY_PLAYER_ID }
    });
    syncControlUI("PLAYER_BUZZ_REQUEST", MY_PLAYER_ID);
}

function updateBuzzerUI() {
    const btn = document.getElementById("buzzerBtn");
    const s1 = document.getElementById("statusBox1");
    const s2 = document.getElementById("statusBox2");
    const s3 = document.getElementById("statusBox3");

    if (s1 && s2 && s3) {
        s1.className = "status-box";
        s2.className = "status-box";
        s3.className = "status-box";
    }

    if (currentBuzzedPlayer !== null) {
        if (btn) {
            btn.disabled = true;
            if (currentBuzzedPlayer === MY_PLAYER_ID) {
                btn.className = `buzzer-p${MY_PLAYER_ID}-active`;
            } else {
                btn.className = "buzzer-locked";
            }
        }
        const targetBox = document.getElementById(`statusBox${currentBuzzedPlayer}`);
        if (targetBox) {
            targetBox.classList.add(`status-p${currentBuzzedPlayer}-active`);
        }
    } else {
        if (gameState.buzzerState === "SPECIAL_PLAYER_OPEN") {
            if (btn) {
                if (typeof MY_PLAYER_ID !== 'undefined' && MY_PLAYER_ID === gameState.specialSelectedPlayer) {
                    btn.disabled = false;
                    btn.className = "buzzer-unlocked";
                } else {
                    btn.disabled = true;
                    btn.className = "buzzer-locked";
                }
            }
        } else {
            if (btn) {
                btn.disabled = buzzerLocked;
                btn.className = buzzerLocked ? "buzzer-locked" : "buzzer-unlocked";
            }
        }
    }
}

function loadQuiz(quizPayload) {
    if (!quizPayload) return;
    const index = quizPayload.index;
    const letters = quizPayload.letters;

    currentQuizIndex = index;
    tossupSound.load();
    initAudioPermission();

    tossupSound.pause();
    tossupSound.currentTime = 0;
    syncControlUI("UPDATE_CTRL_ACTIVE", null);

    if (board) {
        board.innerHTML = "";
    }
    allCells = [];
    absoluteCells = new Array(52).fill(null);

    cells.forEach((p, i) => {
        const letter = letters[i];
        const cell = document.createElement("div");
        cell.className = "cell";
        cell.style.left = p.x + "px";
        cell.style.top = p.y + "px";
        cell.setAttribute('data-pos', i + 1);
        cell.setAttribute('data-row', getRowFromIndex(i));

        cell.style.webkitUserSelect = "none";
        cell.style.mozUserSelect = "none";
        cell.style.msUserSelect = "none";
        cell.style.userSelect = "none";

        if (letter === "" || letter === " " || !letter) {
            cell.style.background = 'url("defaultbox.png") center center no-repeat';
            cell.style.backgroundSize = "100% 100%";
            cell.style.pointerEvents = "none";
            if (board) board.appendChild(cell);
            return;
        }

        let cellObj = { element: cell, letter: letter, revealed: false, state: 0, absoluteIndex: i + 1 };
        allCells.push(cellObj);
        absoluteCells[i] = cellObj;

        cell.addEventListener("click", () => {
            if (typeof MY_PLAYER_ID !== 'undefined' || window.location.pathname.includes('index.html') || window.location.pathname.toLowerCase().includes('host.html')) {
                return;
            }

            initAudioPermission();
            if (cellObj.state === 0) {
                cell.style.background = 'url("choosebox.png") center center no-repeat';
                cell.style.backgroundSize = "100% 100%";
                playDing();
                cellObj.state = 1;
            } else if (cellObj.state === 1) {
                cell.style.background = 'url("obox.png") center center no-repeat';
                cell.style.backgroundSize = "100% 100%";
                cell.textContent = removeVietnameseTones(cellObj.letter);
                cellObj.state = 2;
                cellObj.revealed = true;
            }
        });

        if (board) board.appendChild(cell);
    });

    syncControlUI("UPDATE_QUIZ_ACTIVE", index);
}

window.loadQuiz = loadQuiz;
window.renderBoard = loadQuiz;

function rebuildManualBoard(manualData) {
    clearOldBoardElements();
    allCells = [];
    absoluteCells = new Array(52).fill(null);

    const lines = manualData.split('\n').map(line => line.trim().toUpperCase()).filter(line => line !== "");
    const rowConfigs = [
        { startIdx: 0, totalCells: 12 },
        { startIdx: 12, totalCells: 14 },
        { startIdx: 26, totalCells: 14 },
        { startIdx: 40, totalCells: 12 }
    ];

    let manualTextGrid = new Array(52).fill(null);
    let targetRowIndex = 1;

    lines.forEach((lineText, index) => {
        let currentRow = targetRowIndex + index;
        if (currentRow > 3) currentRow = 3;

        let config = rowConfigs[currentRow];
        let offset = Math.floor((config.totalCells - lineText.length) / 2);
        if (offset < 0) offset = 0;

        let activeStartIdx = config.startIdx + offset;
        for (let charPos = 0; charPos < lineText.length; charPos++) {
            let gridIndex = activeStartIdx + charPos;
            if (gridIndex < config.startIdx + config.totalCells) {
                manualTextGrid[gridIndex] = lineText[charPos];
            }
        }
    });

    cells.forEach((p, i) => {
        const cell = document.createElement("div");
        cell.className = "cell cell-manual";
        cell.style.left = p.x + "px";
        cell.style.top = p.y + "px";
        cell.setAttribute('data-pos', i + 1);
        cell.setAttribute('data-row', getRowFromIndex(i));
        cell.style.webkitUserSelect = "none";
        cell.style.mozUserSelect = "none";
        cell.style.msUserSelect = "none";
        cell.style.userSelect = "none";

        const charAtPos = manualTextGrid[i];
        if (charAtPos !== null) {
            if (charAtPos === " ") {
                cell.style.background = 'url("defaultbox.png") center center no-repeat';
                cell.style.backgroundSize = "100% 100%";
                cell.style.pointerEvents = "none";
            } else {
                cell.style.background = 'url("occhu.png") center center no-repeat';
                cell.style.backgroundSize = "100% 100%";
                cell.textContent = charAtPos;

                let cellObj = { element: cell, letter: charAtPos, revealed: true, state: 2, absoluteIndex: i + 1 };
                allCells.push(cellObj);
                absoluteCells[i] = cellObj;
            }
        } else {
            cell.style.background = 'url("defaultbox.png") center center no-repeat';
            cell.style.backgroundSize = "100% 100%";
            cell.style.pointerEvents = "none";
        }
        if (board) board.appendChild(cell);
    });
}

function clearOldBoardElements() {
    const thumbnailImg = document.getElementById("programThumbnail");
    if (board) {
        board.innerHTML = "";
        if (thumbnailImg) {
            board.appendChild(thumbnailImg);
        }
    }
}

channel.on('broadcast', { event: 'control-to-display' }, ({ payload }) => {
    const { type, data } = payload;

    if (type === "SYNC_SCORES" && data) {
        const { scoresData, scoreVisible } = data;

        const container = document.getElementById('scoreContainer');
        if (container) {
            if (scoreVisible === false) {
                container.classList.add('score-hidden');
            } else {
                container.classList.remove('score-hidden');
            }
        }

        if (!scoresData) return;

        // Store globally in gameState for robust syncing on refresh/late entry
        gameState.scoresData = scoresData;
        gameState.isScoreVisible = scoreVisible;

        gameState.players.p1.name = scoresData.p1.name || "PLAYER 1";
        gameState.players.p1.score = (scoresData.p1.mode === 'ROUND') ? scoresData.p1.round : scoresData.p1.total;
        gameState.players.p1.statusClass = document.getElementById("statusBox1")?.className || "";

        gameState.players.p2.name = scoresData.p2.name || "PLAYER 2";
        gameState.players.p2.score = (scoresData.p2.mode === 'ROUND') ? scoresData.p2.round : scoresData.p2.total;
        gameState.players.p2.statusClass = document.getElementById("statusBox2")?.className || "";

        gameState.players.p3.name = scoresData.p3.name || "PLAYER 3";
        gameState.players.p3.score = (scoresData.p3.mode === 'ROUND') ? scoresData.p3.round : scoresData.p3.total;
        gameState.players.p3.statusClass = document.getElementById("statusBox3")?.className || "";

        const playerMapping = [
            { boxId: 'scoreBox1', player: scoresData.p1, defaultColor: 'score-red', nameId: 'p1NameLabel', scoreId: 'p1ScoreVal', statusBoxId: 'statusBox1' },
            { boxId: 'scoreBox2', player: scoresData.p2, defaultColor: 'score-yellow', nameId: 'p2NameLabel', scoreId: 'p2ScoreVal', statusBoxId: 'statusBox2' },
            { boxId: 'scoreBox3', player: scoresData.p3, defaultColor: 'score-blue', nameId: 'p3NameLabel', scoreId: 'p3ScoreVal', statusBoxId: 'statusBox3' }
        ];

        playerMapping.forEach((item) => {
            const box = document.getElementById(item.boxId);
            const player = item.player;
            if (!player) return;

            const nameLabel = document.getElementById(item.nameId);
            if (nameLabel) {
                nameLabel.textContent = player.name || "PLAYER";
            }

            let scoreVal = (player.mode === 'ROUND') ? player.round : player.total;
            const scoreLabel = document.getElementById(item.scoreId);
            if (scoreLabel) {
                scoreLabel.textContent = formatNumberWithDots(scoreVal);
            }

            const statusBox = document.getElementById(item.statusBoxId);
            if (statusBox) {
                statusBox.textContent = player.name || `PLAYER ${item.boxId.charAt(item.boxId.length - 1)}`;
            }

            if (box) {
                if (player.light === 'BLACK') {
                    box.className = 'score-box score-black';
                } else {
                    box.className = `score-box ${item.defaultColor}`;
                }
            }
        });
    }
    else if (type === "CHANGE_BORDER_COLOR") {
        const boardEl = document.getElementById("board");
        if (boardEl) {
            boardEl.style.background = `url("${data}") center center no-repeat`;
            boardEl.style.backgroundSize = "100% 100%";
        }
    }
    else if (type === "PLAY_SOUNDBOARD") {
        initAudioPermission();
        if (currentSoundboardAudio) {
            currentSoundboardAudio.pause();
            currentSoundboardAudio.currentTime = 0;
        }
        currentSoundboardAudio = new Audio(data);
        currentSoundboardAudio.play().catch(e => console.error("Lỗi phát nhạc soundboard:", e));
    }
    else if (type === "STOP_SOUNDBOARD") {
        if (currentSoundboardAudio) {
            currentSoundboardAudio.pause();
            currentSoundboardAudio.currentTime = 0;
            currentSoundboardAudio = null;
        }
    }
    else if (type === "LOAD_QUIZ") {
        loadQuiz(data);
        gameState.currentQuiz = data;
        gameState.revealedPositions = [];
        gameState.solvedRows = [];
        gameState.guessedLetters = [];
    }
    else if (type === "SHOW_MANUAL_TEXT") {
        initAudioPermission();
        tossupSound.pause();
        tossupSound.currentTime = 0;
        syncControlUI("UPDATE_CTRL_ACTIVE", null);

        clearOldBoardElements();
        allCells = [];
        absoluteCells = new Array(52).fill(null);

        const lines = data.split('\n').map(line => line.trim().toUpperCase()).filter(line => line !== "");
        const rowConfigs = [
            { startIdx: 0, totalCells: 12 },
            { startIdx: 12, totalCells: 14 },
            { startIdx: 26, totalCells: 14 },
            { startIdx: 40, totalCells: 12 }
        ];

        let manualTextGrid = new Array(52).fill(null);
        let targetRowIndex = 1;

        lines.forEach((lineText, index) => {
            let currentRow = targetRowIndex + index;
            if (currentRow > 3) currentRow = 3;

            let config = rowConfigs[currentRow];
            let offset = Math.floor((config.totalCells - lineText.length) / 2);
            if (offset < 0) offset = 0;

            let activeStartIdx = config.startIdx + offset;
            for (let charPos = 0; charPos < lineText.length; charPos++) {
                let gridIndex = activeStartIdx + charPos;
                if (gridIndex < config.startIdx + config.totalCells) {
                    manualTextGrid[gridIndex] = lineText[charPos];
                }
            }
        });

        cells.forEach((p, i) => {
            const cell = document.createElement("div");
            cell.className = "cell cell-manual";
            cell.style.left = p.x + "px";
            cell.style.top = p.y + "px";
            cell.setAttribute('data-pos', i + 1);
            cell.setAttribute('data-row', getRowFromIndex(i));

            const charAtPos = manualTextGrid[i];
            if (charAtPos !== null) {
                if (charAtPos === " ") {
                    cell.style.background = 'url("defaultbox.png") center center no-repeat';
                    cell.style.backgroundSize = "100% 100%";
                    cell.style.pointerEvents = "none";
                } else {
                    cell.style.background = 'url("occhu.png") center center no-repeat';
                    cell.style.backgroundSize = "100% 100%";
                    cell.textContent = charAtPos;

                    let cellObj = { element: cell, letter: charAtPos, revealed: true, state: 2, absoluteIndex: i + 1 };
                    allCells.push(cellObj);
                    absoluteCells[i] = cellObj;
                }
            } else {
                cell.style.background = 'url("defaultbox.png") center center no-repeat';
                cell.style.backgroundSize = "100% 100%";
                cell.style.pointerEvents = "none";
            }
            if (board) board.appendChild(cell);
        });

        showSound.currentTime = 0;
        showSound.play().catch(e => console.log(e));

        syncControlUI("UPDATE_QUIZ_ACTIVE", -1);

        gameState.currentQuiz = { index: -1, letters: manualTextGrid, isManual: true, manualData: data };
        gameState.revealedPositions = [];
        gameState.solvedRows = [];
        gameState.guessedLetters = [];
    }
    else if (type === "GUESS_LETTER") {
        initAudioPermission();
        const guessedChar = data.toUpperCase();
        let matchPositions = [];

        if (!gameState.guessedLetters) {
            gameState.guessedLetters = [];
        }
        if (!gameState.guessedLetters.includes(guessedChar)) {
            gameState.guessedLetters.push(guessedChar);
        }

        absoluteCells.forEach(item => {
            if (item && cleanLetter(item.letter) === guessedChar && item.state === 0) {
                matchPositions.push(item.absoluteIndex);
            }
        });

        if (matchPositions.length === 0) {
            playWrong();
        }
        syncControlUI("FILL_POSITIONS", matchPositions);
    }
    else if (type === "GUESS_MULTI_LETTERS") {
        initAudioPermission();
        const guessedChars = data.map(c => removeVietnameseTones(c).toUpperCase());
        let matchPositions = [];

        if (!gameState.guessedLetters) {
            gameState.guessedLetters = [];
        }
        guessedChars.forEach(guessedChar => {
            if (!gameState.guessedLetters.includes(guessedChar)) {
                gameState.guessedLetters.push(guessedChar);
            }
        });

        absoluteCells.forEach(item => {
            if (item && item.state === 0 && guessedChars.includes(cleanLetter(item.letter))) {
                matchPositions.push(item.absoluteIndex);
            }
        });

        if (matchPositions.length === 0) {
            playWrong();
        }
        syncControlUI("FILL_POSITIONS", matchPositions);
    }
    else if (type === "RESET_BOARD") {
        const allDomCells = document.querySelectorAll('.cell');
        allDomCells.forEach(cell => {
            cell.style.background = 'url("defaultbox.png") center center no-repeat';
            cell.style.backgroundSize = "100% 100%";
            cell.textContent = "";
        });
        allCells.forEach(item => {
            item.revealed = false;
            item.state = 0;
        });
        gameState.revealedPositions = [];
        gameState.guessedLetters = [];
    }
    else if (type === "MARK_SEQ") {
        initAudioPermission();
        let delay = 0;
        data.forEach(pos => {
            setTimeout(() => {
                let item = absoluteCells[pos - 1];
                if (item && item.state === 0) {
                    item.element.style.background = 'url("choosebox.png") center center no-repeat';
                    item.element.style.backgroundSize = "100% 100%";
                    item.state = 1;
                    playDing();
                }
            }, delay);
            delay += 1000;
        });
    }
    else if (type === "REVEAL_SEQ") {
        initAudioPermission();
        let delay = 0;
        data.forEach(pos => {
            setTimeout(() => {
                let item = absoluteCells[pos - 1];
                if (item && (item.state === 1 || item.state === 0)) {
                    item.element.style.background = 'url("occhu.png") center center no-repeat';
                    item.element.style.backgroundSize = "100% 100%";
                    item.element.textContent = removeVietnameseTones(item.letter).replace("_", "").toUpperCase();
                    item.revealed = true;
                    item.state = 2;
                    playSecondDing();

                    if (!gameState.revealedPositions.includes(pos)) {
                        gameState.revealedPositions.push(pos);
                    }
                }
            }, delay);
            delay += 1000;
        });
    }
    else if (type === "START_TOSSUP") {
        initAudioPermission();
        syncControlUI("UPDATE_CTRL_ACTIVE", "startBtn");

        allCells.forEach(item => {
            item.element.style.background = 'url("obox.png") center center no-repeat';
            item.element.style.backgroundSize = "100% 100%";
            item.element.textContent = "";
            item.revealed = false;
            item.state = 0;
        });
        tossupSound.currentTime = 0;
        playTossupMusic();
        gameState.revealedPositions = [];
        gameState.guessedLetters = [];
    }
    else if (type === "TOSSUP_REVEAL_CELL") {
        const idx = data.absoluteIndex;
        const targetItem = absoluteCells[idx - 1];
        if (targetItem && !targetItem.revealed) {
            targetItem.element.style.background = 'url("obox.png") center center no-repeat';
            targetItem.element.style.backgroundSize = "100% 100%";
            targetItem.element.textContent = removeVietnameseTones(targetItem.letter);
            targetItem.revealed = true;
            targetItem.state = 2;

            if (!gameState.revealedPositions.includes(idx)) {
                gameState.revealedPositions.push(idx);
            }
        }
    }
    else if (type === "PAUSE_TOSSUP") {
        syncControlUI("UPDATE_CTRL_ACTIVE", "pauseBtn");
        tossupSound.pause();
        playBuzzer();
    }
    else if (type === "PLAY_TOSSUP") {
        initAudioPermission();
        syncControlUI("UPDATE_CTRL_ACTIVE", "playBtn");
        playTossupMusic();
    }
    else if (type === "STOP_TOSSUP_MUSIC") {
        tossupSound.pause();
        syncControlUI("UPDATE_CTRL_ACTIVE", null);
    }
    else if (type === "SHOW_BOARD") {
        initAudioPermission();
        showSound.currentTime = 0;
        showSound.play();
        allCells.forEach((item, index) => {
            setTimeout(() => {
                item.element.style.background = 'url("obox.png") center center no-repeat';
                item.element.style.backgroundSize = "100% 100%";
                item.element.textContent = "";
                item.revealed = false;
                item.state = 0;
            }, index * 10);
        });
        gameState.revealedPositions = [];
    }
    else if (type === "REVEAL_ALL") {
        tossupSound.pause();
        syncControlUI("UPDATE_CTRL_ACTIVE", null);

        if ([2, 3, 4, 8].includes(currentQuizIndex)) {
            clearPuzzleSound.currentTime = 0;
            clearPuzzleSound.play().catch(e => console.log(e));
        } else {
            revealSound.currentTime = 0;
            revealSound.play().catch(e => console.log(e));
        }

        allCells.forEach(item => {
            item.element.style.background = 'url("obox.png") center center no-repeat';
            item.element.style.backgroundSize = "100% 100%";
            item.element.textContent = item.letter;
            item.revealed = true;
            item.state = 2;
        });

        absoluteCells.forEach((item, idx) => {
            if (item && !gameState.revealedPositions.includes(idx + 1)) {
                gameState.revealedPositions.push(idx + 1);
            }
        });
    }
    else if (type === "PLAY_TIMER") {
        initAudioPermission();
        playTimerSound(data);
    }
    else if (type === "CONTROL_BUZZER") {
        if (data === "OPEN") {
            buzzerLocked = false;
            gameState.buzzerState = "OPEN_NORMAL";
            gameState.buzzerLocked = false;
        } else if (data === "LOCK") {
            buzzerLocked = true;
            gameState.buzzerState = "LOCKED";
            gameState.buzzerLocked = true;
        } else if (data === "RESET_OPEN" || data === "RESET_LOCK") {
            buzzerLocked = (data === "RESET_LOCK");
            currentBuzzedPlayer = null;
            gameState.buzzerState = buzzerLocked ? "LOCKED" : "OPEN_NORMAL";
            gameState.currentBuzzedPlayer = null;
            gameState.buzzerLocked = buzzerLocked;

            const boardEl = document.getElementById("board");
            if (boardEl) {
                boardEl.style.background = `url("khungbang.png") center center no-repeat`;
                boardEl.style.backgroundSize = "100% 100%";
            }
        }
        updateBuzzerUI();
    }
    else if (type === "PLAYER_BUZZ_REQUEST") {
        if (currentBuzzedPlayer === null) {
            currentBuzzedPlayer = data;
            buzzerLocked = true;
            gameState.buzzerState = "LOCKED";
            gameState.currentBuzzedPlayer = data;
            gameState.buzzerLocked = true;

            const boardEl = document.getElementById("board");
            let borderFile = "khungbang.png";
            if (currentBuzzedPlayer === 1) borderFile = "khungdo.png";
            if (currentBuzzedPlayer === 2) borderFile = "khungvang.png";
            if (currentBuzzedPlayer === 3) borderFile = "khungxanh.png";

            if (boardEl) {
                boardEl.style.background = `url("${borderFile}") center center no-repeat`;
                boardEl.style.backgroundSize = "100% 100%";
            }

            playBuzzer();

            if (typeof isTossupRunning !== 'undefined') { isTossupRunning = false; }
            if (typeof tossupTimeout !== 'undefined') { clearTimeout(tossupTimeout); }
            tossupSound.pause();

            updateBuzzerUI();
            syncControlUI("UPDATE_CTRL_ACTIVE", "pauseBtn");
        }
    }
    else if (type === "TOGGLE_THUMBNAIL") {
        const boardEl = document.getElementById("board");
        if (boardEl) {
            let thumbOverlay = document.getElementById("thumbnailOverlay");
            if (!thumbOverlay) {
                thumbOverlay = document.createElement("div");
                thumbOverlay.id = "thumbnailOverlay";
                thumbOverlay.style.cssText = "position: absolute; top: 0; left: 0; width: 100%; height: 100%; z-index: 9999; display: none; pointer-events: none;";

                const img = document.createElement("img");
                img.src = "thumbnail.png";
                img.style.cssText = "width: 100%; height: 100%; object-fit: fill;";

                thumbOverlay.appendChild(img);
                boardEl.appendChild(thumbOverlay);
            }
            thumbOverlay.style.display = data ? "block" : "none";
        }
    }
    // --- VÒNG ĐẶC BIỆT EVENTS ---
    else if (type === "SPECIAL_TIMER_UPDATE") {
        const timerDisplay = document.getElementById("specialTimerDisplay");
        if (timerDisplay) {
            timerDisplay.textContent = data.seconds;
        }
        gameState.specialTimerValue = data.seconds;
    }
    else if (type === "CONTROL_BUZZER_PLAYER") {
        const { playerId, state } = data;
        if (state === "OPEN") {
            gameState.buzzerState = "SPECIAL_PLAYER_OPEN";
            gameState.specialSelectedPlayer = playerId;

            // RESET BUZZER STATE AND FRAME COLOR FOR SPECIAL ROUND START / RESUME
            currentBuzzedPlayer = null;
            buzzerLocked = false;
            gameState.currentBuzzedPlayer = null;
            gameState.buzzerLocked = false;

            const boardEl = document.getElementById("board");
            if (boardEl) {
                boardEl.style.background = `url("khungbang.png") center center no-repeat`;
                boardEl.style.backgroundSize = "100% 100%";
            }
        } else {
            gameState.buzzerState = "LOCKED";
            gameState.specialSelectedPlayer = null;
            buzzerLocked = true;
            gameState.currentBuzzedPlayer = null;
            gameState.buzzerLocked = true;
        }
        updateBuzzerUI();
    }
    else if (type === "SPECIAL_REVEAL_MULTIPLE") {
        initAudioPermission();
        data.positions.forEach(pos => {
            let item = absoluteCells[pos - 1];
            if (item && item.state !== 2) {
                item.element.style.background = 'url("occhu.png") center center no-repeat';
                item.element.style.backgroundSize = "100% 100%";
                item.element.textContent = removeVietnameseTones(item.letter).replace("_", "").toUpperCase();
                item.revealed = true;
                item.state = 2;
                if (!gameState.revealedPositions.includes(pos)) {
                    gameState.revealedPositions.push(pos);
                }
            }
        });
        playDing();
    }
    else if (type === "SPECIAL_REVEAL_CELL") {
        initAudioPermission();
        const idx = data.absoluteIndex;
        const targetItem = absoluteCells[idx - 1];
        if (targetItem && !targetItem.revealed) {
            targetItem.element.style.background = 'url("occhu.png") center center no-repeat';
            targetItem.element.style.backgroundSize = "100% 100%";
            targetItem.element.textContent = removeVietnameseTones(targetItem.letter).replace("_", "").toUpperCase();
            targetItem.revealed = true;
            targetItem.state = 2;

            if (!gameState.revealedPositions.includes(idx)) {
                gameState.revealedPositions.push(idx);
            }
            playDing();
        }
    }
});

updateBuzzerUI();

// Gửi tín hiệu yêu cầu đồng bộ trạng thái khi tải trang/F5
function requestSyncState() {
    console.log("Đang gửi tín hiệu yêu cầu đồng bộ từ thiết bị...");
    channel.send({
        type: 'broadcast',
        event: 'crossword_event',
        payload: {
            type: 'REQUEST_SYNC_STATE'
        }
    });
}

// Lắng nghe tín hiệu đồng bộ toàn bộ trạng thái giữa các trang
channel.on('broadcast', { event: 'crossword_event' }, ({ payload }) => {
    if (!payload) return;

    if (payload.type === 'REQUEST_SYNC_STATE') {
        const hasValidState = gameState && gameState.currentQuiz && gameState.currentQuiz.letters;
        if (hasValidState) {
            console.log("Thiết bị phản hồi REQUEST_SYNC_STATE với gameState hiện tại...");
            channel.send({
                type: 'broadcast',
                event: 'crossword_event',
                payload: { type: 'FULL_STATE_UPDATE', data: gameState }
            });
        }
    }

    else if (payload.type === 'FULL_STATE_UPDATE') {
        const state = payload.data;
        if (!state) return;
        console.log("Nhận được dữ liệu trạng thái đồng bộ P2P:", state);

        hasReceivedSync = true;
        if (syncInterval) {
            clearInterval(syncInterval);
            syncInterval = null;
        }

        gameState = state;

        currentBuzzedPlayer = state.currentBuzzedPlayer !== undefined ? state.currentBuzzedPlayer : null;
        buzzerLocked = state.buzzerLocked !== undefined ? state.buzzerLocked : true;

        const boardEl = document.getElementById("board");
        if (boardEl) {
            let borderFile = "khungbang.png";
            if (currentBuzzedPlayer === 1) borderFile = "khungdo.png";
            else if (currentBuzzedPlayer === 2) borderFile = "khungvang.png";
            else if (currentBuzzedPlayer === 3) borderFile = "khungxanh.png";
            boardEl.style.background = `url("${borderFile}") center center no-repeat`;
            boardEl.style.backgroundSize = "100% 100%";
        }

        // 1. Cập nhật Điểm số & Tên người chơi & Đèn hiển thị
        const scoreContainer = document.getElementById('scoreContainer');
        if (scoreContainer) {
            if (state.isScoreVisible === false) {
                scoreContainer.classList.add('score-hidden');
            } else {
                scoreContainer.classList.remove('score-hidden');
            }
        }

        const scoreMapping = [
            { boxId: 'scoreBox1', defaultColor: 'score-red' },
            { boxId: 'scoreBox2', defaultColor: 'score-yellow' },
            { boxId: 'scoreBox3', defaultColor: 'score-blue' }
        ];

        for (let i = 1; i <= 3; i++) {
            const nameLabel = document.getElementById(`p${i}NameLabel`);
            const scoreVal = document.getElementById(`p${i}ScoreVal`);
            const statusBox = document.getElementById(`statusBox${i}`);

            if (nameLabel && state.players[`p${i}`]) {
                nameLabel.textContent = state.players[`p${i}`].name;
            }
            if (scoreVal && state.players[`p${i}`]) {
                let sVal = state.players[`p${i}`].score;
                scoreVal.textContent = formatNumberWithDots(sVal);
            }
            if (statusBox && state.players[`p${i}`]) {
                statusBox.textContent = state.players[`p${i}`].name;
                statusBox.className = "status-box " + state.players[`p${i}`].statusClass;
            }

            // Sync score box background
            const box = document.getElementById(`scoreBox${i}`);
            if (box && state.scoresData && state.scoresData[`p${i}`]) {
                const playerState = state.scoresData[`p${i}`];
                const defaultColor = scoreMapping[i - 1].defaultColor;
                if (playerState.light === 'BLACK') {
                    box.className = 'score-box score-black';
                } else {
                    box.className = `score-box ${defaultColor}`;
                }
            }
        }

        // 2. Cập nhật bảng ô chữ
        if (state.currentQuiz) {
            if (state.currentQuiz.isManual && state.currentQuiz.manualData) {
                rebuildManualBoard(state.currentQuiz.manualData);
            } else {
                loadQuiz(state.currentQuiz);
            }

            // Lật tất cả các ô chữ đã được lật trước đó
            if (state.revealedPositions && Array.isArray(state.revealedPositions)) {
                state.revealedPositions.forEach(pos => {
                    const item = absoluteCells[pos - 1];
                    if (item) {
                        item.element.style.background = 'url("occhu.png") center center no-repeat';
                        item.element.style.backgroundSize = "100% 100%";
                        item.element.textContent = removeVietnameseTones(item.letter).replace("_", "").toUpperCase();
                        item.revealed = true;
                        item.state = 2;
                    }
                });
            }

            // Đồng bộ các hàng đã giải
            if (state.solvedRows && Array.isArray(state.solvedRows)) {
                state.solvedRows.forEach(rowIdx => {
                    const rowCells = document.querySelectorAll(`.cell[data-row="${rowIdx}"]`);
                    rowCells.forEach(cell => {
                        cell.classList.add('row-solved');
                    });
                });
            }
        }

        // 3. Đồng bộ timer
        const timerDisplay = document.getElementById("specialTimerDisplay");
        if (timerDisplay && state.specialTimerValue !== undefined) {
            timerDisplay.textContent = state.specialTimerValue;
        }

        // 4. Đồng bộ chuông
        updateBuzzerUI();

        // 5. Chạy các callback bổ sung (đối với host.html, display.html, player.html...)
        if (window.crosswordCallbacks && Array.isArray(window.crosswordCallbacks)) {
            window.crosswordCallbacks.forEach(cb => {
                try {
                    cb(state);
                } catch (e) {
                    console.error("Lỗi chạy crosswordCallback:", e);
                }
            });
        }
    }
});

channel.subscribe((status) => {
    if (status === 'SUBSCRIBED') {
        console.log("Supabase Channel Subscribed! Starting sync polling...");
        requestSyncState();
        if (syncInterval) clearInterval(syncInterval);
        syncInterval = setInterval(() => {
            if (!hasReceivedSync && (!gameState || !gameState.currentQuiz || !gameState.currentQuiz.letters)) {
                requestSyncState();
            } else {
                clearInterval(syncInterval);
                syncInterval = null;
            }
        }, 2000);
    }
});

// Vô hiệu hóa chuột phải
document.addEventListener('contextmenu', (event) => {
    event.preventDefault();
});

// Vô hiệu hóa phím F12 (mở DevTools) và các phím tắt phổ biến
document.addEventListener('keydown', (event) => {
    if (
        event.key === 'F12' || // Phím F12
        (event.ctrlKey && event.shiftKey && event.key === 'I') || // Ctrl + Shift + I
        (event.ctrlKey && event.shiftKey && event.key === 'J') || // Ctrl + Shift + J
        (event.ctrlKey && event.key === 'u') // Ctrl + U
    ) {
        event.preventDefault();
    }
});

// Phát hiện nếu DevTools được mở
let devtoolsOpen = false;
const element = new Image();
Object.defineProperty(element, 'id', {
    get: function () {
        devtoolsOpen = true;
    },
});
setInterval(() => {
    devtoolsOpen = false;
    console.log(element);
    if (devtoolsOpen) {
    }
}, 1000);