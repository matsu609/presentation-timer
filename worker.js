let totalSeconds = 0;
let isOvertime = false;
let initialTotalSecondsForTimer = 0;
let startTime = 0;
let timerInterval;

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
    
    self.postMessage({
        type: 'tick',
        totalSeconds: totalSeconds,
        isOvertime: isOvertime
    });
}

self.onmessage = function(e) {
    const data = e.data;
    switch (data.command) {
        case 'start':
            if (timerInterval) clearInterval(timerInterval);
            initialTotalSecondsForTimer = data.initialTotalSeconds;
            startTime = Date.now();
            isOvertime = false;
            totalSeconds = initialTotalSecondsForTimer; // 初期値を設定
            timerInterval = setInterval(runTimerLogic, 10);
            break;
        case 'stop':
            clearInterval(timerInterval);
            timerInterval = null;
            break;
        case 'reset':
            clearInterval(timerInterval);
            timerInterval = null;
            totalSeconds = data.initialTotalSeconds;
            isOvertime = false;
            self.postMessage({
                type: 'tick',
                totalSeconds: totalSeconds,
                isOvertime: isOvertime
            });
            break;
        case 'setTotalSeconds':
            totalSeconds = data.totalSeconds;
            isOvertime = data.isOvertime;
            break;
    }
};
