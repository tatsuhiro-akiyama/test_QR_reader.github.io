/** GETパラメータの値 */
var args = null;

/** GASから取得した設定情報
 * @property {string}  title                     - 会議名称
 * @property {string}  version                   - アプリバージョン
 * @property {string}  app_mode                  - アプリ動作モード（動作確認 or 本番）
 * @property {string}  mode                      - アプリ起動モード（会議受付 or 懇親会受付）
 * @property {object}  info_message              - アプリ更新履歴
 * @property {string}  pass                      - アプリ起動用パスワード
 * @property {string}  date                      - 会議日程（yyyy/mm/dd）
 * @property {string}  date_jp                   - 会議日程（yyyy年mm月dd日）
 * @property {string}  venue_meeting             - 会議の会場名称
 * @property {string}  meeting_time              - 会議開始時刻（hh:mm）
 * @property {string}  seating_chart_meeting     - 会議会場の座席画像URL
 * @property {string}  venue_gathering           - 懇親会の会場名称
 * @property {string}  gathering_time            - 懇親会開始時刻（hh:mm）
 * @property {string}  seating_chart_gathering   - 懇親会会場の座席画像URL
 * @property {string}  mail_from                 - メール宛先
 * @property {object}  no_send_mail_dept         - 非メール送信対象の所属
 */
var SETTING_DATA = {};

/** GASから取得した社員情報一覧
 * @property {string}  row_no     - スプレッドシート登録行番号
 * @property {string}  company    - 会社名
 * @property {string}  user_no    - 社員番号
 * @property {string}  name       - 氏名漢字
 * @property {string}  kana       - 氏名カナ
 * @property {string}  dept       - 所属
 * @property {string}  mail       - メールアドレス
 * @property {string}  meeting    - 事前出欠有無（会議）
 * @property {string}  social_gathering   - 事前出欠有無（懇親会）
 * @property {string}  seat_meeting       - 座席番号（会議）
 * @property {string}  seat_gathering     - 座席番号（懇親会）
 */
var EMPLOYEE_INFO = new Map();

/** リロード時のGET化対策：通信キャンセル用コントローラー */
var fetchController = null;

/** GASのURL送信時に送るパラメータ */
const sendParamSetting = { action: 'getSettingData' };
var sendParamMeeting = { action: 'updateMeeting' };
var sendParamgathering = { action: 'updategathering' };

const USE_PHONE = (window.matchMedia('(max-device-width: 768px)').matches);
const CANVAS_WIDTH = 640;
const CANVAS_HEIGHT = 360;

var ctx;
var flgCaramaRun = false;
var scanTimerId = null;

// DOM要素の取得
var containor = HTMLElement;
var video = HTMLElement;
var canvas = HTMLElement;

var placeholder = HTMLElement;
var cameraStatusText = HTMLElement;

var modeQr = HTMLElement;
var modeManual = HTMLElement;

var btnModeQr = HTMLElement;
var btnModeManual = HTMLElement;

var iconQr = HTMLElement;
var iconManual = HTMLElement;

var scanTarget = HTMLElement;
var manualInput = HTMLElement;
var submitBtn = HTMLElement;
var clearBtn = HTMLElement;
var toast = HTMLElement;

/** 設定データ取得待ちのポップアップ通知 */
var toastDataWait = HTMLElement;
/** 起動時インフォメーションのポップアップ通知 */
var toastAppInfo = HTMLElement;
var btnAppInfoClose = HTMLElement;
/** エラー時のポップアップ通知 */
var toastError = HTMLElement;
/** 不正QRコードの場合のメッセージ */
var qrErrMessage = HTMLElement;

/* 音声用のWebAudio API */
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
function playBeep(success = true) {
    if (audioCtx.state === 'suspended') {
        audioCtx.resume();
    }
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.connect(gain);
    gain.connect(audioCtx.destination);

    if (success) {
        // 成功時のピピッという音
        osc.type = 'sine';
        osc.frequency.setValueAtTime(880, audioCtx.currentTime); // A5
        gain.gain.setValueAtTime(0.1, audioCtx.currentTime);
        osc.start();
        
        setTimeout(() => {
            osc.frequency.setValueAtTime(1320, audioCtx.currentTime); // E6
        }, 80);
        
        setTimeout(() => {
            gain.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + 0.1);
            osc.stop(audioCtx.currentTime + 0.15);
        }, 160);

    } else {
        // エラー時のブブーという音
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(220, audioCtx.currentTime); // A3
        gain.gain.setValueAtTime(0.1, audioCtx.currentTime);
        osc.start();
        gain.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + 0.3);
        osc.stop(audioCtx.currentTime + 0.35);
    }
}

/** 画面ロード時の処理 */
window.onload = async function() {
    // 💡ページを離れる/リロードする直前にリクエストを強制切断（GET化の残骸防止）
    window.onbeforeunload = () => {
        if (fetchController) fetchController.abort();
    };

    // DOM要素の取得
    containor = document.getElementById('containor');
    video = document.getElementById('camera-stream');
    canvas = document.getElementById('camera-canvas');

    placeholder = document.getElementById('camera-placeholder');
    cameraStatusText = document.getElementById('camera-status-text');

    modeQr = document.getElementById('mode-qr');
    modeManual = document.getElementById('mode-manual');

    btnModeQr = document.getElementById('btn-mode-qr');
    btnModeManual = document.getElementById('btn-mode-manual');

    iconQr = document.getElementById('icon-container-qr');
    iconManual = document.getElementById('icon-container-manual');

    scanTarget = document.getElementById('scan-target');
    manualInput = document.getElementById('manual-input');
    submitBtn = document.getElementById('submit-btn');
    clearBtn = document.getElementById('clear-btn');
    toast = document.getElementById('toast');

    /** 設定データ取得待ちのポップアップ通知 */
    toastDataWait = document.getElementById('toast-getData-wait');
    /** 起動時インフォメーションのポップアップ通知 */
    toastAppInfo = document.getElementById('toast-appli-info');
    btnAppInfoClose = document.getElementById('btn-appInfo-close');
    /** エラー時のポップアップ通知 */
    toastError = document.getElementById('toast-error');
    /** 不正QRコードの場合のメッセージ */
    qrErrMessage = document.getElementById('qr-error-message');

    // GETパラメータの取得
    args = getArguments();

    // titleタグの書き換え
    const title = document.getElementById('appli-title');
    switch(args.mode) {
        case 'recep':
            title.innerText = '会議受付[QR]';
            break;
        case 'gathering':
            title.innerText = '懇親会[QR]';
            break;
        default:
            title.innerText = 'QR受付アプリ';
            break;
    }

    // GETパラメータの判定①
    if (!checkArguments(args)) {
        showToastError(
            'このアドレスは無効、またはアクセス権限がありません。'
            ,false
        );
        return false;
    }

    // 設定データ取得待ちの表示
    clearTimeout(toastTimeout);
    toastDataWait.classList.remove('translate-y-20', 'hidden', 'pointer-events-none');
    toastDataWait.classList.add('translate-y-0', 'opacity-100');

    try {
        // 設定データ＆社員情報一覧の取得
        console.groupCollapsed('設定データ＆社員情報一覧の取得');
        let data = await getFetchData(GAS_URL, sendParamSetting);

        // 取得結果
        SETTING_DATA = data.settingData;
        SETTING_DATA.mode = args.mode_jp;
        console.table(SETTING_DATA);

        // 初期化時に社員配列をハッシュテーブルに変換する
        if (Array.isArray(data.employeeInfo)) {
            EMPLOYEE_INFO = new Map(data.employeeInfo.map(emp => [String(emp.user_no), emp]));
        }
        console.table(EMPLOYEE_INFO);
        console.groupEnd('設定データ＆社員情報一覧の取得');

    } catch (fetchError) {
        showToastError(
            '設定データの取得に失敗しました。<br>' + fetchError
            ,false
        );
        return false;
    }

    // データ取得完了後に、設定データ取得待ちを隠す
    toastDataWait.classList.remove('translate-y-0', 'opacity-100');
    toastDataWait.classList.add('hidden');

    // GETパラメータの判定②
    if (!checkParameter(args)) {
        showToastError(
            'このアドレスは無効、またはアクセス権限がありません。'
            ,false
        );
        return false;
    }

    // アプリ情報の記述
    drawSettingData(SETTING_DATA);

    // 起動時インフォメーションの表示
    showAppliInfo(
        SETTING_DATA.version
        ,SETTING_DATA.app_mode
        ,SETTING_DATA.info_message
    );

    // カメラの起動
    console.log('カメラ起動');
    startCamera();
    // カメラ映像部などのメイン部分を表示
    containor.classList.remove('hidden');
    containor.classList.add('opacity-100');



    btnModeQr.addEventListener('click', switchToQr);
    btnModeManual.addEventListener('click', switchToManual);
    // 手動入力フォーム制御
    submitBtn.addEventListener('click', btnSubmit);
    clearBtn.addEventListener('click', btnClear);


    // QRスキャン成功デモ
    scanTarget.addEventListener('click', scanTargetDemo);


    console.log('アプリ起動完了');
}
/** GETパラメータの取得 */
function getArguments() {
    // GETパラメータの取得
    console.groupCollapsed('GETパラメータの取得');
    const params = new URLSearchParams(window.location.search);

    // 取得結果
    console.table({
        pass: params.get('pass')
        ,mode: params.get('mode')
        ,mode_jp: params.get('mode')
        ,date: params.get('date')
    });
    console.groupEnd('GETパラメータの取得');

    return {
        pass: params.get('pass')
        ,mode: params.get('mode')
        ,mode_jp: params.get('mode')
        ,date: params.get('date')
    };
}
/** GETパラメータの判定① */
function checkArguments(_params) {
    // modeの値がnullまたは空白
    if (_params.mode === null || _params.mode === '') {
        console.error('GETパラメータ不正：modeの値がnullまたは空白');
        return false;
    }

    // modeの値が規定値以外
    switch (_params.mode) {
        case 'recep':
            _params.mode_jp = '会議受付';
            break;
        case 'gathering':
            _params.mode_jp = '懇親会受付';
            break;
        // case 'report':
        //     _params.mode_jp = '遅刻欠席連絡';
        //     break;
        default:
            _params.mode_jp = 'ｘｘｘ';
            console.error('GETパラメータ不正：modeの値が規定値以外');
            return false;
            break;
    }

    // modeの値が「recep」「gathering」でpassの値がnull
    if ((_params.mode === 'recep' || _params.mode === 'gathering') && _params.pass === null) {
        console.error('GETパラメータ不正：modeの値が「recep」「gathering」でpassの値がnull');
        return false;
    }

    // // modeの値が「report」でdateの値がnull
    // if (_params.mode === 'report' && _params.date === null) {
    //     console.error('GETパラメータ不正：modeの値が「report」でdateの値がnull');
    //     return false;
    // }

    // 戻り値
    return true;
}
/** URLFetchを実行しデータを取得する */
async function getFetchData(_url, _param) {
    try {
        // 💡リロード対策：既存の未完了リクエストがあれば切断
        if (fetchController) { fetchController.abort(); }
        fetchController = new AbortController();

        console.log('getFetchData:', _url);
        const response = await fetch(
                                    _url
                                    ,{
                                        method: "POST"
                                        ,signal: fetchController.signal
                                        ,headers: {"Content-Type": "text/plain"}
                                        ,body: JSON.stringify(_param)
                                    }
                                );
        const data = await response.json();
        if (data.status === "success") {
            // GAS処理成功
            console.log('URLFetch正常終了');
            return data;
        } else {
            // GAS処理失敗
            console.error('URLFetch呼び出し先でエラー発生：', data);
            throw new Error(data.message);
        }
    } catch (error) {
        // GAS処理呼び出しに失敗
        console.error('URLFetch呼び出しに失敗：', error);
        throw new Error(error.message);
    }
}
/** GETパラメータの判定② */
function checkParameter(_params) {
    // passの値がnull以外、かつ設定情報のpassの値と相違
    if (_params.pass !== null && _params.pass !== SETTING_DATA.pass) {
        console.error('GETパラメータ不正：passの値が相違');
        return false;
    }

    // // dateの値がnull以外、かつ設定情報のpassの値と相違
    // if (_params.date !== null && _params.date !== SETTING_DATA.date.replace('/', '')) {
    //     console.error('GETパラメータ不正：dateの値が相違');
    //     return false;
    // }

    // 戻り値
    return true;
}
/** 設定情報画面描画 */
function drawSettingData(_data) {
    const mode = document.getElementById('mode-name');
    const datetime = document.getElementById('appli-datetime');
    const venue = document.getElementById('appli-venue');

    mode.innerText = _data.mode;
    datetime.innerText = _data.date;
    switch(_data.mode) {
        case '会議受付':
            datetime.innerText += ' ' + _data.meeting_time;
            venue.innerText = _data.venue_meeting;
            break;
        case '懇親会受付':
            title.innerText = _data.mode.replace('受付','') + '[QR]';
            datetime.innerText += ' ' + _data.gathering_time;
            venue.innerText = _data.venue_gathering;
            break;
    }
}

/** カメラストリーム起動 */
async function startCamera() {
    try {
        cameraStatusText.innerText = "Accessing Camera...";
        const stream = await navigator.mediaDevices.getUserMedia({
            video: {
                facingMode: (USE_PHONE ? 'environment': 'user')
                ,aspectRatio: { ideal: 0.5625 }     // スマホの縦持ちに最適なアスペクト比と解像度を指定（9:16 → 9÷16=0.5625）
                ,width: (USE_PHONE ? CANVAS_HEIGHT*1.5: CANVAS_WIDTH*1.5)    // スマホはカメラ映像が縦長のためwidthとheightを入れ替える
                ,height: (USE_PHONE ? CANVAS_WIDTH*1.5: CANVAS_HEIGHT*1.5)   // スマホはカメラ映像が縦長のためwidthとheightを入れ替える
            }
            ,audio: false
        });
        
        video.srcObject = stream;
        video.onloadedmetadata = () => {
            video.play();
            video.classList.remove('opacity-0');
            video.classList.add('opacity-100');
            placeholder.classList.add('opacity-0');
            setTimeout(() => {
                placeholder.style.display = 'none';
            }, 700);

            ctx = canvas.getContext('2d', { willReadFrequently: true });
            canvas.width = CANVAS_WIDTH;
            canvas.height = CANVAS_HEIGHT;
            console.table({
                videoWidth: canvas.width
                ,videoHeight: canvas.height
            });

            flgCaramaRun = true;
            startScanLoop();
        };

    } catch (err) {
        console.error("Camera access error:", err);
        cameraStatusText.innerText = "SIMULATED CAMERA ACTIVE";
        cameraStatusText.classList.add('text-emerald-500');
    }
}
/** 💡ループ安定化：スキャンタイマーの開始管理 */
function startScanLoop() {
    if (scanTimerId) { clearTimeout(scanTimerId); }
    scanTimerId = setTimeout(checkImage, 800);
}
/** カメラ映像を一旦停止 */
function cameraStop() {
    flgCaramaRun = false;
    if (scanTimerId) { clearTimeout(scanTimerId); scanTimerId = null; } // 💡完全にタイマーを止める
    // カメラ停止
    video.pause();
    console.log('カメラ停止');
}
/** カメラ映像を再開 */
function cameraReStart() {
    // 再起呼び出し
    flgCaramaRun = true;
    // カメラ再開
    video.play();
    console.log('カメラ再開');
    // ループを再起動
    startScanLoop();
}
/** QRコードの検出 */
async function checkImage() {
    // settimeoutで常に再起呼び出しされるため、カメラ停止中は処理をせずに抜ける
    if (!flgCaramaRun) { return; }

    try {
        // 💡描画エラー防止：ビデオのフレームが描画可能（readyState >= 2）かチェック
        if (video.readyState >= video.HAVE_CURRENT_DATA) {
            // imageDataを作ってjsQRに渡す
            ctx.drawImage(video, 0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
            const imageData = ctx.getImageData(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
            const code = jsQR(imageData.data, imageData.width, imageData.height);
            
            // QRコードが検出できた場合
            if (code) {
                // カメラ映像を一旦停止する
                cameraStop();

                // 正しいQRコードかどうかのフラグ（初期値：false）
                let _isCorrect = false;

                // QRコード内容の入力チェック
                let _qr_data = code.data.split(',').map((_val) => _val.trim());
                console.table(_qr_data);
                if (_qr_data.length != 2) { console.warn('不正なQRコード検出：データ件数', _qr_data); }
                else if (typeof _qr_data[0] != 'string') { console.warn('不正なQRコード検出：1つ目のデータ型', _qr_data); }
                else if (typeof _qr_data[1] != 'string') { console.warn('不正なQRコード検出：2つ目のデータ型', _qr_data); }
                else {
                    // _qr_data[0]の値がスプレッドシート取得データの日付と一致するかチェック
                    if (_qr_data[0] != SETTING_DATA.date.trim()) { console.warn('不正なQRコード検出：設定情報の日付と相違', _qr_data); }
                    // _qr_data[1]の値で社員番号を検索し、該当者がいるかチェック
                    else if (EMPLOYEE_INFO.has(_qr_data[1])) {
                        _isCorrect = true;
                    }
                }

                // 不正なQRコードだった場合、「不正なQR」の文字を表示し処理を抜ける
                if (!_isCorrect) {
                    qrErrMessage.classList.remove('hidden');
                    scanTarget.classList.remove('bg-slate-900/10');
                    scanTarget.classList.add('bg-slate-900/50');
                    // エラー音
                    playBeep(false);

                    setTimeout(() => {
                        // 不正QRエラーメッセージを隠す
                        qrErrMessage.classList.add('hidden');
                        scanTarget.classList.remove('bg-slate-900/50');
                        scanTarget.classList.add('bg-slate-900/10');
                        // カメラ映像を再開する
                        cameraReStart();
                    }, 2000);
                    return;
                }

                // QRコード内容を画面に描画
                console.group('QRコード検出：正しいQRコード');
                console.table(_qr_data);


                let _employee = EMPLOYEE_INFO.get(_qr_data[1]);
                console.table(_employee);
                showToastSuccess(
                    _employee.dept + '<br/>' + _employee.name
                    ,_employee.seat_meeting
                );

                // GAS更新処理を呼び出し
                let data = await getFetchData(GAS_URL, sendParamMeeting);




                setTimeout(() => {
                    // カメラ映像を再開する
                    cameraReStart();
                }, 3000);
                console.groupEnd();
                return;
            }
        }

    }  catch (e) {
        // エラーが発生した場合、何も処理しない
        console.error(e);
        showToastError(
            e.message
            ,false
        );
    }
    
    // 💡ループ安定化：正常時・未検出時のみ、安全に次のループを呼び出し
    if (flgCaramaRun) {
        scanTimerId = setTimeout(checkImage, 800);
    }
}

let toastTimeout;
/** 起動時インフォメーションの表示 */ 
function showAppliInfo(_version, _app_mode, _ary_message) {
    clearTimeout(toastTimeout);

    // バージョン情報
    const appliVersion = document.getElementById('appli-version');
    appliVersion.innerText = _version;

    // 動作モード（動作確認モードの場合のみ表示）
    const appliMode = document.getElementById('appli-mode');
    if (_app_mode === "動作確認モード") {
        appliMode.classList.remove('hidden');
    }

    // インフォメーション
    const oldnew = document.getElementById('old-new-info');
    _ary_message.forEach((item) => {
        let div = document.createElement('div');
        div.innerText = item;
        oldnew.append(div);
    });

    // 閉じるボタン押下イベント
    btnAppInfoClose.addEventListener('click', closeToastAppInfo);

    // トースト表示アニメーション
    toastAppInfo.classList.remove('translate-y-20', 'hidden', 'pointer-events-none');
    toastAppInfo.classList.add('translate-y-0', 'opacity-100');

    // 何もしなくても60秒後に隠す
    toastTimeout = setTimeout(() => {
        closeToastAppInfo();
    }, 60000);
}
/** 起動時インフォメーションを隠す */
function closeToastAppInfo() {
    // 起動時インフォメーションを隠す
    toastAppInfo.classList.remove('translate-y-0', 'opacity-100');
    toastAppInfo.classList.add('hidden');
}
/** 受付完了時ポップアップ通知の表示 */
function showToastSuccess(_message, _seat) {
    clearTimeout(toastTimeout);
    
    let timer = 3000;
    const toastMessage = document.getElementById('toast-message');
    const toastSeat = document.getElementById('toast-seat');
    toastMessage.innerHTML = _message;
    if (!_seat || _seat === '') {
        // 座席が未指定の場合
        _seat = '運営に確認<br/>※事前欠席→参加';
        timer = 6000;
    }
    toastSeat.innerHTML = '座席： ' + _seat;

    // 表示
    toast.classList.remove('translate-y-20', 'hidden', 'pointer-events-none');
    toast.classList.add('translate-y-0', 'opacity-100');
    playBeep(true);

    // 3秒後に隠す
    toastTimeout = setTimeout(() => {
        toast.classList.remove('translate-y-0', 'opacity-100');
        toast.classList.add('translate-y-20', 'hidden', 'pointer-events-none');
    }, timer);
}
/** エラー時ポップアップ通知の表示 */
function showToastError(_message, _autoClose = true) {
    clearTimeout(toastTimeout);

    // エラーメッセージ
    const toastErrorMessage = document.getElementById('toast-error-message');
    toastErrorMessage.innerHTML = _message;

    // トースト表示アニメーション
    toastError.classList.remove('translate-y-20', 'hidden', 'pointer-events-none');
    toastError.classList.add('translate-y-0', 'opacity-100');

    // _autoCloseがtrueの場合、何もしなくても30秒後に隠す
    if (_autoClose) {
        toastTimeout = setTimeout(() => {
            // エラー時のポップアップ通知を隠す
            toastError.classList.remove('translate-y-0', 'opacity-100');
            toastError.classList.add('hidden');
        }, 30000);
    }
}


// 2. モード切替ロジック
function switchToQr() {
    // カメラ映像を再開する
    cameraReStart();
    
    // UIの切り替え
    modeQr.classList.remove('hidden');
    setTimeout(() => {
        modeQr.classList.add('scale-100', 'opacity-100');
        modeQr.classList.remove('scale-95', 'opacity-0');
    }, 5);
    
    modeManual.classList.add('scale-95', 'opacity-0');
    setTimeout(() => {
        modeManual.classList.add('hidden');
    }, 5);

    // フッターアイコンのアクティブ表現
    btnModeQr.classList.remove('opacity-50');
    btnModeManual.classList.add('opacity-50');

    iconQr.classList.add('bg-emerald-500/10', 'border', 'border-emerald-500/20', 'text-emerald-400');
    iconQr.classList.remove('text-slate-400');
    iconManual.classList.remove('bg-amber-500/10', 'border', 'border-amber-500/20', 'text-amber-400');
    iconManual.classList.add('text-slate-400');
}
function switchToManual() {
    
    // カメラ映像を一旦停止する
    cameraStop();

    // UIの切り替え
    modeManual.classList.remove('hidden');
    setTimeout(() => {
        modeManual.classList.add('scale-100', 'opacity-100');
        modeManual.classList.remove('scale-95', 'opacity-0');
    }, 5);

    modeQr.classList.add('scale-95', 'opacity-0');
    setTimeout(() => {
        modeQr.classList.add('hidden');
    }, 5);

    // フッターアイコンのアクティブ表現
    btnModeManual.classList.remove('opacity-50');
    btnModeQr.classList.add('opacity-50');

    iconManual.classList.add('bg-amber-500/10', 'border', 'border-amber-500/20', 'text-amber-400');
    iconManual.classList.remove('text-slate-400');
    iconQr.classList.remove('bg-emerald-500/10', 'border', 'border-emerald-500/20', 'text-emerald-400');
    iconQr.classList.add('text-slate-400');
}


/** QRスキャン成功デモ */
async function scanTargetDemo() {
    // ランダムにデータ取得して受付成功時ポップアップを表示
    //const randomId = Math.floor(Math.random() * EMPLOYEE_INFO.size);




    const _employee = Array.from(EMPLOYEE_INFO)[95][1];
    console.table(_employee);
    showToastSuccess(
        _employee.dept + '<br/>' + _employee.name
        ,_employee.seat_meeting
    );

    // GAS更新処理を呼び出し
    const sendData = {
        // GAS実行処理
        "action": (SETTING_DATA.mode === '会議受付' ? 'entryMeeting': 'entryGathering')
        // データ登録用情報
        ,"data": {
            "row_no": _employee.row_no
            ,"user_no": _employee.user_no
            ,"user_dept": _employee.dept
            ,"user_name": _employee.name
            // データ登録＆メール送信用情報
            ,"title": SETTING_DATA.title
            ,"date": SETTING_DATA.date_jp
            ,"venue": (SETTING_DATA.mode === '会議受付' ? SETTING_DATA.venue_meeting: SETTING_DATA.venue_gathering)
            ,"app_mode": SETTING_DATA.app_mode
            ,"mode": SETTING_DATA.mode.replace('受付', '')
            ,"mail_from": SETTING_DATA.mail_from
            ,"mail_to": _employee.mail
            ,"mail_attach": (SETTING_DATA.mode === '会議受付' ? SETTING_DATA.seating_chart_meeting: SETTING_DATA.seating_chart_gathering)
            ,"no_send_mail_dept": SETTING_DATA.no_send_mail_dept.concat()
            ,"attendance": {
                "meeting": "参加"
                ,"gathering": SETTING_DATA.social_gathering
            }
            
            // 座席位置
            ,"seat": (SETTING_DATA.mode === '会議受付' ? _employee.seat_meeting: _employee.seat-gathering)
            ,"comment": ''  //reason

            ,"lost_qr_cord": false   //$('#checkLostQrCode').prop('checked')
            ,"lost_staff_card": false   //$('#checkLostStaffCard').prop('checked')

            // 「かな」欄が有効状態かどうかで、手動受付かどうかを判断する
            ,"manual": false   // !$('#user_kana').prop('disabled')
        }
    }
    console.table(sendData.action);
    console.table(sendData.data);
    
    let _ret = await getFetchData(GAS_URL, sendData);
};

// 手動入力フォーム制御
function btnSubmit() {
    const val = manualInput.value.trim();
    if (val === "") {
        showToastSuccess("エラー: 番号を入力してください", "入力フィールドが空です", false);
        return;
    }
    // 受付シミュレーション
    showToastSuccess(`番号: ${val} の受付が完了しました`, "確認用パスコード認証成功");
    manualInput.value = "";
};
function btnClear() {
    manualInput.value = "";
    manualInput.focus();
};
