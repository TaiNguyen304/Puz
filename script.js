var SUPABASE_URL = window.SUPABASE_URL || "https://tukabyhjmcyptuwmwedp.supabase.co";
var SUPABASE_ANON_KEY = window.SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR1a2FieWhqbWN5cHR1d213ZWRwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA0NDk3NDksImV4cCI6MjA5NjAyNTc0OX0.gNWdvZ_hRdon_w_KL3C3eXFFiV_EoA4eLgikcYb6dpQ";

if (SUPABASE_URL && !SUPABASE_URL.startsWith("http://") && !SUPABASE_URL.startsWith("https://")) {
    SUPABASE_URL = "https://" + SUPABASE_URL;
}

// Chống bôi đen văn bản trên toàn bộ trang bằng CSS injection
document.body.style.webkitUserSelect = "none";
document.body.style.mozUserSelect = "none";
document.body.style.msUserSelect = "none";
document.body.style.userSelect = "none";

// FIX: Thay đổi self: true để người gửi cũng nhận được sự kiện broadcast của chính mình
var supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const channel = supabaseClient.channel('crossword_broadcast_room', {
    config: { broadcast: { ack: false, self: true } }
});
channel.subscribe();

const board = document.getElementById("board");

const showSound = new Audio("reveal.mp3");
const revealSound = new Audio("ClearTossUp.mp3");
const clearPuzzleSound = new Audio("ClearPuzzle.mp3");
const tossupSound = new Audio("tossup.mp3");
tossupSound.loop = true;

let currentQuizIndex = 0;
let allCells = [];
let absoluteCells = [];

let buzzerLocked = true;
let currentBuzzedPlayer = null;

function initAudioPermission() {
    showSound.load(); revealSound.load(); clearPuzzleSound.load(); tossupSound.load();
}

function formatNumberWithDots(num) {
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
    const filename = seconds === 30 ? "30s.mp3" : "10s.mp3";
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

function syncControlUI(type, data) {
    channel.send({
        type: 'broadcast',
        event: 'display-to-control',
        payload: { type: type, data: data }
    });
}

function pressBuzzer() {
    if (typeof MY_PLAYER_ID === 'undefined' || buzzerLocked || currentBuzzedPlayer !== null) return;

    channel.send({
        type: 'broadcast',
        event: 'control-to-display',
        payload: { type: 'PLAYER_BUZZ_REQUEST', data: MY_PLAYER_ID }
    });
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
        if (btn) {
            btn.disabled = buzzerLocked;
            btn.className = buzzerLocked ? "buzzer-locked" : "buzzer-unlocked";
        }
    }
}

function loadQuiz(quizPayload) {
    const index = quizPayload.index;
    const letters = quizPayload.letters;

    currentQuizIndex = index;
    tossupSound.load();
    initAudioPermission();

    tossupSound.pause();
    tossupSound.currentTime = 0;
    syncControlUI("UPDATE_CTRL_ACTIVE", null);

    board.innerHTML = "";
    allCells = [];
    absoluteCells = new Array(52).fill(null);

    cells.forEach((p, i) => {
        const letter = letters[i];
        const cell = document.createElement("div");
        cell.className = "cell";
        cell.style.left = p.x + "px";
        cell.style.top = p.y + "px";

        // Chống bôi đen text trên từng ô chữ
        cell.style.webkitUserSelect = "none";
        cell.style.mozUserSelect = "none";
        cell.style.msUserSelect = "none";
        cell.style.userSelect = "none";

        if (letter === "" || letter === " " || !letter) {
            cell.style.background = 'url("defaultbox.png") center center no-repeat';
            cell.style.backgroundSize = "100% 100%";
            cell.style.pointerEvents = "none";
            board.appendChild(cell);
            return;
        }

        let cellObj = { element: cell, letter: letter, revealed: false, state: 0, absoluteIndex: i + 1 };
        allCells.push(cellObj);
        absoluteCells[i] = cellObj;

        cell.addEventListener("click", () => {
            // KHÔNG cho phép người chơi hoặc khán giả tự ý click mở ô chữ
            if (typeof MY_PLAYER_ID !== 'undefined' || window.location.pathname.includes('index.html')) {
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

        board.appendChild(cell);
    });

    syncControlUI("UPDATE_QUIZ_ACTIVE", index);
}

if (typeof window.absoluteManualCells === 'undefined') {
    window.absoluteManualCells = new Array(52).fill("");
}

channel.on('broadcast', { event: 'control-to-display' }, ({ payload }) => {
    if (!payload) return;
    const type = payload.type;
    const data = payload.data;

    if (type === "SYNC_SCORES") {
        for (let i = 1; i <= 3; i++) {
            let key = 'p' + i;
            let player = data[key];
            let boxEl = document.getElementById(`scoreBox${i}`);
            if (!boxEl) continue;

            let currentVal = (player.mode === 'ROUND') ? player.round : player.total;
            boxEl.textContent = formatNumberWithDots(currentVal);

            boxEl.className = "score-box";
            if (player.light === 'BLACK') {
                boxEl.classList.add("score-black");
            } else {
                if (i === 1) boxEl.classList.add("score-red");
                if (i === 2) boxEl.classList.add("score-yellow");
                if (i === 3) boxEl.classList.add("score-blue");
            }
        }
    }
    else if (type === "CHANGE_BORDER_COLOR") {
        const boardEl = document.getElementById("board");
        if (boardEl) {
            boardEl.style.background = `url("${data}") center center no-repeat`;
            boardEl.style.backgroundSize = "100% 100%";
        }
    }
    else if (type === "LOAD_QUIZ") {
        loadQuiz(data);
    }
    else if (type === "GUESS_LETTER") {
        initAudioPermission();
        const guessedChar = data.toUpperCase();
        let matchPositions = [];

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
    }
    else if (type === "PLAY_TIMER") {
        initAudioPermission();
        playTimerSound(data);
    }

    else if (type === "CONTROL_BUZZER") {
        if (data === "OPEN") {
            buzzerLocked = false;
        } else if (data === "LOCK") {
            buzzerLocked = true;
        } else if (data === "RESET_OPEN" || data === "RESET_LOCK") {
            buzzerLocked = (data === "RESET_LOCK");
            currentBuzzedPlayer = null;

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
    if (cmd === 'SET_52_LETTERS' && Array.isArray(data)) {
        const boardEl = document.getElementById("board");
        if (boardEl) {
            boardEl.innerHTML = ""; // Xóa sạch các ô cũ để dựng bảng thủ công
            window.absoluteManualCells = data; // Lưu mảng ký tự vào bộ nhớ tạm

            cells.forEach((pos, i) => {
                const letter = data[i] ? data[i].trim().toUpperCase() : "";
                const cellDiv = document.createElement("div");
                cellDiv.className = "cell";
                cellDiv.id = `cell-${i}`;
                cellDiv.style.position = "absolute";
                cellDiv.style.left = pos.x + "px";
                cellDiv.style.top = pos.y + "px"; // SỬA LỖI: Dùng pos.y thay vì p.y (p.y làm crash script)

                // Chống bôi đen text theo tiêu chuẩn hệ thống của bạn
                cellDiv.style.webkitUserSelect = "none";
                cellDiv.style.mozUserSelect = "none";
                cellDiv.style.msUserSelect = "none";
                cellDiv.style.userSelect = "none";

                if (letter === "") {
                    // Ô trống hoàn toàn không chứa chữ
                    cellDiv.style.backgroundImage = "url('defaultbox.png')";
                    cellDiv.style.backgroundSize = "100% 100%";
                    cellDiv.textContent = "";
                } else {
                    // Ô có chữ: Hiện khung ô chữ màu xanh (obox.png) nhưng ẩn chữ bên trong
                    cellDiv.style.backgroundImage = "url('obox.png')";
                    cellDiv.style.backgroundSize = "100% 100%";
                    cellDiv.style.color = "transparent"; // Giấu kín chữ
                    cellDiv.textContent = letter;
                }
                boardEl.appendChild(cellDiv);
            });
        }
        return;
    }

    // CHỨC NĂNG 2: XỬ LÝ LỆNH MỞ Ô CHỮ THEO 2 GIAI ĐOẠN TỪ CONTROL
    if (cmd === 'CELL_STAGE_CONTROL' && data) {
        const cellIdx = data.index;
        const currentStage = data.stage;
        const cellTarget = document.getElementById(`cell-${cellIdx}`);
        
        if (cellTarget) {
            if (currentStage === 1) {
                // GIAI ĐOẠN 1: Đổi hình nền ô sang nền màu vàng (yellowbox.png) để báo hiệu
                cellTarget.style.backgroundImage = "url('highlight.png')";
                cellTarget.style.backgroundSize = "100% 100__";
                cellTarget.style.color = "transparent"; // Vẫn giấu chữ ẩn bên trong
                
                if (typeof playDing === "function") playDing();
            } 
            else if (currentStage === 2) {
                // GIAI ĐOẠN 2: Chính thức lật mở chữ -> Đổi sang nền ô trắng (whitebox.png)
                cellTarget.style.backgroundImage = "url('occhu.png')";
                cellTarget.style.backgroundSize = "100% 100%";
                
                // Trích xuất ký tự ẩn đã lưu từ Giai đoạn Set ban đầu
                let charToShow = "";
                if (window.absoluteManualCells && window.absoluteManualCells[cellIdx]) {
                    charToShow = window.absoluteManualCells[cellIdx];
                } else if (cellTarget.textContent) {
                    charToShow = cellTarget.textContent;
                }
                
                // Hiển thị rõ chữ màu đen sắc nét lên bảng của các file hiển thị
                cellTarget.textContent = charToShow.trim().toUpperCase();
                cellTarget.style.color = "#000000";
                
                if (typeof playSecondDing === "function") playSecondDing();
            }
        }
        return;
    }

    // CHỨC NĂNG 3: XỬ LÝ RESET BẢNG TRỐNG ĐỒNG BỘ
    if (cmd === 'RESET_BOARD') {
        const boardEl = document.getElementById("board");
        if (boardEl) boardEl.innerHTML = "";
        window.absoluteManualCells = new Array(52).fill("");
        return;
    }
});

updateBuzzerUI();

// --- CHỨC NĂNG DISABLE DEVTOOLS TOÀN DIỆN (CHẠY ĐƯỢC CẢ DẠNG FILE) ---
function disableDevTools() {
    // 1. Chặn chuột phải
    document.addEventListener('contextmenu', e => e.preventDefault());

    // 2. Chặn các phím tắt mở DevTools
    document.addEventListener('keydown', function (e) {
        if (e.key === 'F12') { e.preventDefault(); return false; }
        if (e.ctrlKey && e.shiftKey && (e.key === 'I' || e.key === 'J' || e.key === 'C' || e.key === 'i' || e.key === 'j' || e.key === 'c')) { e.preventDefault(); return false; }
        if (e.ctrlKey && (e.key === 'U' || e.key === 'u' || e.key === 'S' || e.key === 's')) { e.preventDefault(); return false; }
    });

    // 3. Bẫy DevTools bằng kiểm tra định dạng Console (Hoạt động cả trên file:///)
    const devtools = { isOpen: false };
    const element = new Image();
    Object.defineProperty(element, 'id', {
        get: function () {
            devtools.isOpen = true;
            // Hành động khi phát hiện mở DevTools: Tự động tải lại trang hoặc xóa sạch nội dung
            window.location.reload(); 
        }
    });

    setInterval(function() {
        devtools.isOpen = false;
        console.log(element); // Kích hoạt getter nếu DevTools đang mở để đọc log
        console.clear();      // Xóa log ngay lập tức để tránh rác console
        
        // Cách 2 bổ trợ: Kiểm tra chênh lệch kích thước cửa sổ hiển thị
        const threshold = 160;
        const widthThreshold = window.outerWidth - window.innerWidth > threshold;
        const heightThreshold = window.outerHeight - window.innerHeight > threshold;
        if (widthThreshold || heightThreshold) {
            // Nếu DevTools đang mở làm thay đổi kích thước màn hình
            document.body.innerHTML = "<h1>Không được phép mở DevTools! Vui lòng tắt DevTools và F5 lại trang.</h1>";
        }
    }, 500);
}

// Kích hoạt bảo mật
disableDevTools();

