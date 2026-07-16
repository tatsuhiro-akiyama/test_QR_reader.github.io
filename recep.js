
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

/** 画面ロード時の処理 */
window.onload = async function() {

    console.time('window.onload')

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
    /** エラー時のポップアップ通知 */
    toastError = document.getElementById('toast-error');







    
    /** 起動時インフォメーションのポップアップ通知 */
    toastAppInfo = document.getElementById('toast-appli-info');
    btnAppInfoClose = document.getElementById('btn-appInfo-close');
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
            break;
    }

    // 設定データ取得待ちの表示
    clearTimeout(toastTimeout);
    toastDataWait.classList.remove('translate-y-20', 'hidden', 'pointer-events-none');
    toastDataWait.classList.add('translate-y-0', 'opacity-100');

    try {
        // 設定データ＆社員情報一覧の取得
        console.groupCollapsed('設定データ＆社員情報一覧の取得');
        console.time('　getFetchData')
        let data = await getFetchData(GAS_URL, 'recep.html', args, sendParam_getEmployee);
        console.timeEnd('　getFetchData')

        // 取得結果を定数に格納
        console.time('　setConstants')
        setConstants(data, true);
        console.timeEnd('　setConstants')
        console.groupEnd('設定データ＆社員情報一覧の取得');

    } catch (fetchError) {
        showToastError(
            fetchError
            ,false
        );
        return false;
    }

    // アプリ情報の記述
    drawSettingData(SETTING_DATA);

    // データ取得完了後に、設定データ取得待ちを隠す
    toastDataWait.classList.remove('translate-y-0', 'opacity-100');
    toastDataWait.classList.add('hidden');

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


    console.timeEnd('window.onload')
    console.log('アプリ起動完了');
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
