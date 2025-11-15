const minutesElement = document.getElementById('minutes');
const secondsElement = document.getElementById('seconds');
const millisecondsElement = document.getElementById('milliseconds');
const toggleTimerBtn = document.getElementById('toggle-timer-btn');
console.log('toggleTimerBtn:', toggleTimerBtn); // 追加
const resetBtn = document.getElementById('reset-btn');
const testSoundBtn = document.getElementById('test-sound-btn');
const messageContainer = document.getElementById('message-container');
const timeDisplay = document.querySelector('.time-display');
const settingsPanel = document.getElementById('settings-panel');
const saveSettingsBtn = document.getElementById('save-settings-btn');
const colonElement = document.createElement('span');
colonElement.classList.add('colon');
colonElement.textContent = ':';
minutesElement.after(colonElement);

const bell1HoursInput = document.getElementById('bell1-hours');
const bell1MinutesInput = document.getElementById('bell1-minutes');
const bell1SecondsInput = document.getElementById('bell1-seconds');
const bell2HoursInput = document.getElementById('bell2-hours');
const bell2MinutesInput = document.getElementById('bell2-minutes');
const bell2SecondsInput = document.getElementById('bell2-seconds');
const bell3HoursInput = document.getElementById('bell3-hours');
const bell3MinutesInput = document.getElementById('bell3-minutes');
const bell3SecondsInput = document.getElementById('bell3-seconds');
const soundSelect = document.getElementById('sound-select');
const bellSoundElement = document.getElementById('bell-sound');

let totalSeconds = 0;
let isRunning = false;
let bellTimes = [];
let isOvertime = false;
let initialTotalSecondsForBellCheck = 0;

// NoSleep.jsのインスタンス
const noSleep = new NoSleep();
const enableNoSleepBtn = document.getElementById('enable-nosleep');

// AudioContextの初期化
// let audioContext;
// let audioBuffer;

// Web Workerの代わりにメインスレッドでタイマーを管理する変数
let timerInterval; // setIntervalのIDを保持
let initialTotalSecondsForTimer = 0; // タイマー開始時の秒数 (Web WorkerのinitialTotalSecondsに相当)
let startTime = 0; // タイマー開始時刻 (Web WorkerのstartTimeに相当)

// Web Workerのonmessageロジックを直接実行する関数
function runTimerLogic() {
    const now = Date.now();
    const elapsedSinceStart = (now - startTime) / 1000;

    if (!isOvertime) {
        totalSeconds = initialTotalSecondsForTimer - elapsedSinceStart;
        if (totalSeconds <= 0) {
            totalSeconds = 0;
            isOvertime = true;
            initialTotalSecondsForTimer = 0; // オーバータイム開始時の基準をリセット
            startTime = Date.now(); // オーバータイム開始時刻を更新
        }
    } else {
        totalSeconds = -elapsedSinceStart;
    }
    
    updateDisplay();
    checkBellTimes();
}


function requestNotificationPermission() {
    if (!("Notification" in window)) {
        console.warn("このブラウザは通知をサポートしていません。");
        return;
    }
    if (Notification.permission === "default") {
        Notification.requestPermission().then(permission => {
            if (permission === "granted") {
                console.log("通知の許可が与えられました。");
            } else {
                console.warn("通知の許可が拒否されました。");
            }
        });
    }
}

function showNotification(title, body) {
    if (Notification.permission === "granted") {
        try {
            const options = {
                body: body
            };
            new Notification(title, options);
        } catch (err) {
            console.error("通知の表示に失敗しました:", err);
        }
    }
}

function updateDisplay() {
    let displayTotalSeconds = isOvertime ? Math.abs(totalSeconds) : Math.max(0, totalSeconds);
    let sign = isOvertime ? '+' : '';

    const minutes = Math.floor(displayTotalSeconds / 60);
    const seconds = Math.floor(displayTotalSeconds % 60);
    const milliseconds = Math.floor((displayTotalSeconds * 1000) % 1000 / 10);

    minutesElement.textContent = sign + String(minutes).padStart(2, '0');
    secondsElement.textContent = String(seconds).padStart(2, '0');
    millisecondsElement.textContent = String(milliseconds).padStart(2, '0');

    timeDisplay.classList.toggle('overtime-red', isOvertime);
    let currentRungBells = bellTimes.filter(bell => bell.rung).length;
    timeDisplay.classList.toggle('warning-yellow', !isOvertime && currentRungBells === 1);
    timeDisplay.classList.toggle('warning-purple', !isOvertime && currentRungBells === 2);
}

function startTimer() {
    if (isRunning) return;
    isRunning = true;
    initialTotalSecondsForBellCheck = totalSeconds; // ベルチェック用の初期秒数を設定

    // Web Workerの'start'コマンドのロジックを直接実行
    initialTotalSecondsForTimer = totalSeconds;
    startTime = Date.now();
    isOvertime = false;

    if (timerInterval) clearInterval(timerInterval);

    timerInterval = setInterval(runTimerLogic, 10); // 10ミリ秒ごとに更新

    noSleep.enable(); // タイマー開始時にスリープ防止を有効化
    toggleTimerBtn.textContent = 'ストップ'; // ボタンテキストを更新
}

function stopTimer() {
    if (!isRunning) return;
    isRunning = false;
    // Web Workerの'stop'コマンドのロジックを直接実行
    clearInterval(timerInterval);
    timerInterval = null;

    noSleep.disable(); // タイマー停止時にスリープ防止を無効化
    toggleTimerBtn.textContent = 'スタート'; // ボタンテキストを更新
}

function resetTimer() {
    stopTimer(); // releaseWakeLockもここで呼ばれる
    saveBellSettings(); // 設定を保存し、totalSecondsを更新

    // Web Workerの'reset'コマンドのロジックを直接実行
    clearInterval(timerInterval);
    timerInterval = null;
    // totalSecondsはsaveBellSettingsで設定される
    isOvertime = false;
    
    messageContainer.textContent = '';
    bellTimes.forEach(bell => bell.rung = false);
    timeDisplay.className = 'time-display';
    updateDisplay();
    toggleTimerBtn.textContent = 'スタート'; // ボタンテキストを更新
}

async function playSoundAndNotify(count, message) {
    showNotification("プレゼンタイマー", message);
    await playSoundElement(count); // awaitを追加
}

async function checkBellTimes() { // async関数に変更
    const currentElapsedTime = initialTotalSecondsForBellCheck - totalSeconds;
    let needsColorUpdate = false;
    console.log(`checkBellTimes: currentElapsedTime = ${currentElapsedTime}, totalSeconds = ${totalSeconds}`);

    for (const bellSetting of bellTimes) { // forEachをfor...ofに変更してawaitを可能にする
        console.log(`  Checking bell: count=${bellSetting.count}, time=${bellSetting.time}, rung=${bellSetting.rung}`);
        if (!isOvertime && !bellSetting.rung && (currentElapsedTime >= bellSetting.time - 0.01)) { // 0.01秒の許容誤差
            bellSetting.rung = true; // ここに移動
            let message = `${Math.floor(bellSetting.time / 60)}分${bellSetting.time % 60}秒経過しました。`;
            if (bellSetting.count === 3) {
                message = '時間です！';
            }
            await playSoundAndNotify(bellSetting.count, message);
            needsColorUpdate = true;
            console.log(`    Bell ${bellSetting.count} rung!`);
        }
    }

    if (needsColorUpdate) {
        updateDisplay();
    }
}

async function playSoundElement(count) {
    const soundSrc = bellSoundElement.src; // 現在設定されている音源のパスを取得
    if (!soundSrc) {
        console.warn("Bell sound source not found.");
        return;
    }
    
    console.log(`playSoundElement called with count: ${count}`); // ここにログを追加
    for (let i = 0; i < count; i++) {
        const tempAudio = new Audio(soundSrc); // 新しいAudioオブジェクトを作成
        tempAudio.currentTime = 0; // 再生位置をリセット
        try {
            await tempAudio.play();
            console.log(`  Playing sound ${i + 1} of ${count} for bell.`);
        } catch (e) {
            console.error('Audio play failed:', e);
        }
        if (i < count - 1) {
            await new Promise(resolve => setTimeout(resolve, 500));
        }
    }
    console.log(`playSoundElement finished playing ${count} sounds.`);
}

function saveBellSettings() {
    bellTimes = [];
    const getSeconds = (h, m, s) => (parseInt(h.value) || 0) * 3600 + (parseInt(m.value) || 0) * 60 + (parseInt(s.value) || 0);
    
    const bell1Time = getSeconds(bell1HoursInput, bell1MinutesInput, bell1SecondsInput);
    if (bell1Time > 0) bellTimes.push({ time: bell1Time, count: 1, rung: false });

    const bell2Time = getSeconds(bell2HoursInput, bell2MinutesInput, bell2SecondsInput);
    if (bell2Time > 0) bellTimes.push({ time: bell2Time, count: 2, rung: false });

    const bell3Time = getSeconds(bell3HoursInput, bell3MinutesInput, bell3SecondsInput);
    if (bell3Time > 0) bellTimes.push({ time: bell3Time, count: 3, rung: false });
    
    bellTimes.sort((a, b) => a.time - b.time);

    // totalSecondsをすべてのベル設定の中で最も大きい時間に設定する
    // ベルが一つも設定されていない場合は0秒とする
    totalSeconds = bellTimes.length > 0 ? Math.max(...bellTimes.map(bell => bell.time)) : 0;
    console.log("saveBellSettings: bellTimes =", bellTimes, "totalSeconds =", totalSeconds); // 追加
    bellTimes.sort((a, b) => a.time - b.time);
    updateDisplay();
}

function handleSoundSelectChange() {
    const selectedSound = soundSelect.value;
    bellSoundElement.src = selectedSound;
    bellSoundElement.load();
    // loadSound(selectedSound); // AudioContext用にサウンドを読み込み直す
}

function setSoundBasedOnDate() {
    const today = new Date();
    const month = today.getMonth() + 1;
    const day = today.getDate();
    let defaultSound = 'sei_ge_bell01.mp3';

    if (month === 12) defaultSound = 'Christmas.mp3';
    if (month === 11 && day === 10) defaultSound = 'shamisen.mp3';
    if (month === 1 && day === 1) defaultSound = 'kodaiko.mp3';
    if (month === 1 && day === 2) defaultSound = 'oodaiko.mp3';
    if (month === 1 && day === 3) defaultSound = 'rifle.mp3';
    if (month === 1 && day === 4) defaultSound = 'taihou.mp3';
    if (month === 1 && day === 5) defaultSound = 'hato.mp3';
    if (month === 1 && day === 6) defaultSound = 'niwatori.mp3';
    if (month === 7) defaultSound = 'higurashi.mp3';
    if (month === 8) defaultSound = 'minminzemi.mp3';

    soundSelect.value = defaultSound;
    bellSoundElement.src = defaultSound;
    bellSoundElement.load();
}

[bell1HoursInput, bell1MinutesInput, bell1SecondsInput,
 bell2HoursInput, bell2MinutesInput, bell2SecondsInput,
 bell3HoursInput, bell3MinutesInput, bell3SecondsInput].forEach(input => {
    input.addEventListener('input', saveBellSettings);
});

soundSelect.addEventListener('change', handleSoundSelectChange);

// AudioContextをユーザー操作で有効化するための関数
// function initAudioContext() {
//     if (!audioContext) {
//         try {
//             audioContext = new (window.AudioContext || window.webkitAudioContext)();
//             loadSound(soundSelect.value); // 初期サウンドを読み込む
//         } catch (e) {
//             console.error("Web Audio API is not supported in this browser", e);
//         }
//     }
// }

// 音声ファイルをAudioBufferにデコードして読み込む関数
// function loadSound(url) {
//     if (!audioContext) return;
//     fetch(url)
//         .then(response => response.arrayBuffer())
//         .then(data => audioContext.decodeAudioData(data))
//         .then(buffer => {
//             audioBuffer = buffer;
//             console.log("Sound loaded and decoded:", url);
//         })
//         .catch(e => console.error("Error loading sound:", e));
// }

toggleTimerBtn.addEventListener('click', () => {
    // initAudioContext(); // 最初のクリックでAudioContextを初期化
    if (isRunning) {
        stopTimer();
    } else {
        startTimer();
    }
});

resetBtn.addEventListener('click', () => {
    resetTimer();
});

enableNoSleepBtn.addEventListener('click', () => {
    noSleep.enable();
    alert("スリープ防止を有効にしました。");
});

testSoundBtn.addEventListener('click', () => {
    // initAudioContext(); // AudioContextが初期化されていなければ初期化
    playSoundElement(1);
});

updateDisplay();
saveBellSettings();
requestNotificationPermission();
setSoundBasedOnDate();
