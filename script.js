const board = document.getElementById("board");
 
// Khởi tạo các đối tượng âm thanh
const showSound = new Audio("reveal.mp3");
const revealSound = new Audio("ClearTossUp.mp3");
const clearPuzzleSound = new Audio("ClearPuzzle.mp3"); 
const tossupSound = new Audio("tossup.mp3"); 
tossupSound.loop = true;
const dingSound = new Audio("ding.wav");
const wrongSound = new Audio("wrong.mp3"); // Âm thanh khi đoán sai chữ cái

let currentQuizIndex = 0; 
let allCells = [];
let absoluteCells = [];
let tossupTimeout = null; 
let isTossupRunning = false; 
let controlWindow = null; 

function initAudioPermission() {
    dingSound.load(); showSound.load(); revealSound.load(); clearPuzzleSound.load(); wrongSound.load();
}

function playDing(){
    let soundClone = dingSound.cloneNode();
    soundClone.play().catch(e => console.log(e));
}

function playWrong() {
    let soundClone = wrongSound.cloneNode();
    soundClone.play().catch(e => console.log(e));
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

// Hàm so sánh chuẩn chữ cái có dấu/không dấu hoặc ký tự đặc biệt gốc ô chữ (Ví dụ: "H_" -> "H")
// Hàm so sánh chuẩn chữ cái có dấu/không dấu (Ví dụ: "Á" -> "A", "Ắ" -> "Ă")
function cleanLetter(letter) {
    if (!letter) return "";
    // Loại bỏ ký tự đặc biệt gốc ô chữ nếu có
    let cleaned = letter.replace("_", "");
    // Bỏ thanh dấu tiếng Việt (giữ nguyên chữ gốc như Â, Ă, Ê, Ô, Ơ, Ư) và viết hoa
    return removeVietnameseTones(cleaned).toUpperCase();
}

function removeVietnameseTones(str){
    const map = {
        "á":"a","à":"a","ả":"a","ã":"a","ạ":"a","Á":"A","À":"A","Ả":"A","Ã":"A","Ạ":"A",
        "ấ":"â","ầ":"â","ẩ":"â","ẫ":"â","ậ":"â","Ấ":"Â","Ầ":"Â","Ẩ":"Â","Ẫ":"Â","Ậ":"Â",
        "ắ":"ă","ằ":"ă","ẳ":"ă","ẵ":"ă","ặ":"ă","Ắ":"Ă","Ằ":"Ă","Ẳ":"Ă","Ẵ":"Ă","Ặ":"Ă",
        "é":"e","è":"e","ẻ":"e","ẽ":"e","ẹ":"e","É":"E","È":"E","Ẻ":"E","Ẽ":"E","Ẹ":"E",
        "ế":"ê","ề":"ê","ể":"ê","ễ":"ê","ệ":"ê","Ế":"Ê","Ề":"Ê","Ể":"Ê","Ễ":"Ê","Ệ":"Ê",
        "í":"i","ì":"i","ỉ":"i","ĩ":"i","ị":"i","Í":"I","Ì":"I","Ỉ":"I","Ĩ":"I","Ị":"I",
        "ó":"o","ò":"o","ỏ":"o","õ":"o","ọ":"o","Ó":"O","Ò":"O","Ỏ":"O","Õ":"O","Ọ":"O",
        "ố":"ô","ồ":"ô","ổ":"ô","ỗ":"ô","ộ":"ô","Ố":"Ô","Ồ":"Ô","Ổ":"Ô","Ỗ":"Ô","Ộ":"Ô",
        "ớ":"ơ","ờ":"ơ","ở":"ơ","ỡ":"ơ","ợ":"ơ","Ớ":"Ơ","Ờ":"Ơ","Ở":"Ơ","Ỡ":"Ơ","Ợ":"Ơ",
        "ú":"u","ù":"u","ủ":"u","ũ":"u","ụ":"u","Ú":"U","Ù":"U","Ủ":"U","Ũ":"U","Ụ":"U",
        "ứ":"ư","ừ":"ư","ử":"ư","ữ":"ư","ự":"ư","Ứ":"Ư","Ừ":"Ư","Ử":"Ư","Ữ":"Ư","Ự":"Ư",
        "ý":"y","ỳ":"y","ỷ":"y","ỹ":"y","ỵ":"y","Ý":"Y","Ỳ":"Y","Ỷ":"Y","Ỹ":"Y","Ỵ":"Y"
    };
    return str.split("").map(c => map[c] || c).join("");
}

const cells = [
    {x:246,y:140},{x:366,y:140},{x:486,y:140},{x:606,y:140},{x:726,y:140},{x:846,y:140},{x:966,y:140},{x:1086,y:140},{x:1206,y:140},{x:1326,y:140},{x:1446,y:140},{x:1566,y:140},
    {x:126,y:290},{x:246,y:290},{x:366,y:290},{x:486,y:290},{x:606,y:290},{x:726,y:290},{x:846,y:290},{x:966,y:290},{x:1086,y:290},{x:1206,y:290},{x:1326,y:290},{x:1446,y:290},{x:1566,y:290},{x:1686,y:290},
    {x:126,y:440},{x:246,y:440},{x:366,y:440},{x:486,y:440},{x:606,y:440},{x:726,y:440},{x:846,y:440},{x:966,y:440},{x:1086,y:440},{x:1206,y:440},{x:1326,y:440},{x:1446,y:440},{x:1566,y:440},{x:1688,y:440},
    {x:246,y:590},{x:366,y:590},{x:486,y:590},{x:606,y:590},{x:726,y:590},{x:846,y:590},{x:966,y:590},{x:1086,y:590},{x:1206,y:590},{x:1326,y:590},{x:1446,y:590},{x:1566,y:590}
];

function syncControlUI(type, data) {
    if (controlWindow && !controlWindow.closed) {
        controlWindow.postMessage({ type: type, data: data }, "*");
    }
}

function loadQuiz(index) {
    currentQuizIndex = index; 
    tossupSound.load(); 
    initAudioPermission(); 
    
    clearTimeout(tossupTimeout);
    isTossupRunning = false;
    tossupSound.pause();
    tossupSound.currentTime = 0;
    syncControlUI("UPDATE_CTRL_ACTIVE", null);

    board.innerHTML = "";
    allCells = [];
    absoluteCells = new Array(52).fill(null); // Khởi tạo 52 vị trí trống

    const data = quizData[index];
    if (!data) return;
    
    const letters = [...data.line1, ...data.line2, ...data.line3, ...data.line4];

    cells.forEach((p, i) => {
        const letter = letters[i];
        const cell = document.createElement("div");
        cell.className = "cell";
        cell.style.left = p.x + "px";
        cell.style.top  = p.y + "px";

        if (letter === "" || letter === " " || !letter) {
            cell.style.background = 'url("defaultbox.png") center center no-repeat';
            cell.style.backgroundSize = "100% 100%";
            cell.style.pointerEvents = "none";
            board.appendChild(cell);
            return;
        }

        // Tạo đối tượng ô chữ có lưu thêm absoluteIndex
        let cellObj = { element: cell, letter: letter, revealed: false, state: 0, absoluteIndex: i + 1 };
        allCells.push(cellObj);
        absoluteCells[i] = cellObj;

        cell.addEventListener("click", () => {
            initAudioPermission();
            if (cellObj.state === 0) {
                cell.style.background = 'url("choosebox.png") center center no-repeat';
                cell.style.backgroundSize = "100% 100%";
                playDing(); 
                cellObj.state = 1;
            } else if (cellObj.state === 1) {
                // Vẫn dùng obox.png để không vỡ graphic
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

function revealRandomCell() {
    if (!isTossupRunning) return;
    const hiddenCells = allCells.filter(item => !item.revealed);
    if (hiddenCells.length === 0) {
        isTossupRunning = false;
        tossupSound.pause();
        syncControlUI("UPDATE_CTRL_ACTIVE", null);
        return;
    }
    const randomIndex = Math.floor(Math.random() * hiddenCells.length);
    const targetItem = hiddenCells[randomIndex];

    targetItem.element.style.background = 'url("obox.png") center center no-repeat';
    targetItem.element.style.backgroundSize = "100% 100%";
    targetItem.element.textContent = removeVietnameseTones(targetItem.letter);
    targetItem.revealed = true;
    targetItem.state = 2;

    const randomDelay = Math.random() * (1500 - 1000) + 1000;
    tossupTimeout = setTimeout(revealRandomCell, randomDelay);
}

// LẮNG NGHE LỆNH TỪ KHU VỰC ĐIỀU KHIỂN
window.addEventListener("message", (event) => {
    const { type, data } = event.data;

    if (type === "LOAD_QUIZ") {
        loadQuiz(data);
    }
    // LOGIC ĐOÁN CHỮ CÁI CÓ TRÌ HOÃN 3 GIÂY
    else if (type === "GUESS_LETTER") {
        initAudioPermission();
        const guessedChar = data.toUpperCase();
        let matchPositions = [];
        
        // Trích xuất các vị trí chính xác trên toàn bộ bảng 52 ô
        absoluteCells.forEach(item => {
            if (item && cleanLetter(item.letter) === guessedChar && item.state === 0) {
                matchPositions.push(item.absoluteIndex);
            }
        });

        if (matchPositions.length === 0) {
            playWrong(); // Sai thì báo âm thanh luôn, không cần delay
        }
        
        // Trả các vị trí (Ví dụ: [12, 43]) về cho Control Window
        syncControlUI("FILL_POSITIONS", matchPositions);
    }

    // LOGIC ĐOÁN NHIỀU CHỮ CÁI CÙNG LÚC TỪ MỤC "CHỮ CÁI ĐOÁN THÊM"
    else if (type === "GUESS_MULTI_LETTERS") {
        initAudioPermission();
        // Chuẩn hóa loại bỏ luôn thanh dấu của các chữ cái nhập vào từ textbox điều khiển
        const guessedChars = data.map(c => removeVietnameseTones(c).toUpperCase());
        let matchPositions = [];
        
        // Trích xuất tất cả các vị trí khớp với bất kỳ chữ cái nào trong mảng
        absoluteCells.forEach(item => {
            if (item && item.state === 0 && guessedChars.includes(cleanLetter(item.letter))) {
                matchPositions.push(item.absoluteIndex);
            }
        });

        if (matchPositions.length === 0) {
            playWrong(); // Không trúng chữ nào thì kêu tiếng báo sai
        }
        
        // Gửi trả hàng loạt vị trí về bảng điều khiển (cơ chế sinh textbox tự động)
        syncControlUI("FILL_POSITIONS", matchPositions);
    }

    // THÊM LOGIC RESET TOÀN BỘ BẢNG
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
    // THÊM LOGIC MỞ LẦN 1 (ĐÁNH DẤU CÁCH NHAU 1 GIÂY)
    else if (type === "MARK_SEQ") {
        initAudioPermission();
        let delay = 0;
        data.forEach(pos => {
            setTimeout(() => {
                let item = absoluteCells[pos - 1]; // Array index bắt đầu từ 0
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
    // THÊM LOGIC MỞ LẦN 2 (MỞ CHỮ CÁCH NHAU 1 GIÂY)
    else if (type === "REVEAL_SEQ") {
        initAudioPermission();
        let delay = 0;
        data.forEach(pos => {
            setTimeout(() => {
                let item = absoluteCells[pos - 1];
                if (item && (item.state === 1 || item.state === 0)) {
                    item.element.style.background = 'url("occhu.png") center center no-repeat'; 
                    item.element.style.backgroundSize = "100% 100%";
                    
                    // SỬA TẠI ĐÂY: Loại bỏ ký tự đặc biệt (_) và xóa sạch thanh dấu, chuyển thành chữ in hoa sạch
                    item.element.textContent = removeVietnameseTones(item.letter).replace("_", "").toUpperCase();
                    
                    item.revealed = true;
                    item.state = 2;
                }
            }, delay);
            delay += 1000;
        });
    }
    
    else if (type === "START_TOSSUP") {
        initAudioPermission(); 
        clearTimeout(tossupTimeout);
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
        isTossupRunning = true;
        revealRandomCell();
    }
    else if (type === "PAUSE_TOSSUP") {
        syncControlUI("UPDATE_CTRL_ACTIVE", "pauseBtn");
        isTossupRunning = false;
        clearTimeout(tossupTimeout); 
        playDing(); 
    }
    else if (type === "PLAY_TOSSUP") {
        initAudioPermission();
        if (isTossupRunning) return; 
        syncControlUI("UPDATE_CTRL_ACTIVE", "playBtn");
        isTossupRunning = true;
        revealRandomCell(); 
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
        clearTimeout(tossupTimeout);
        isTossupRunning = false;
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
});

function openController() {
    controlWindow = window.open("control.html", "QuizControl", "width=600,height=600");
}

window.onload = function() {
    loadQuiz(0);
    controlWindow = window.open("control.html", "QuizControl", "width=600,height=600");
};