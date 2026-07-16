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
const sendParam_getEmployee = 'getEmployeeData';
const sendParam_meeting = 'entryMeeting';
const sendParam_gathering = 'entryGathering';

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

/** GETパラメータの取得 */
function getArguments() {
    // GETパラメータの取得
    console.groupCollapsed('GETパラメータの取得');
    const params = new URLSearchParams(window.location.search);

    // 取得結果
    console.table({
        pass: params.get('pass') === '' ? null: params.get('pass')
        ,mode: params.get('mode') === '' ? null: params.get('mode')
        ,date: params.get('date') === '' ? null: params.get('date')
    });
    console.groupEnd('GETパラメータの取得');

    return {
        pass: params.get('pass') === '' ? null: params.get('pass')
        ,mode: params.get('mode') === '' ? null: params.get('mode')
        ,date: params.get('date') === '' ? null: params.get('date')
    };
}

/** URLFetchを実行しデータを取得する */
async function getFetchData(_url, _file, _args, _action, _data = null) {
    try {
        // 💡リロード対策：既存の未完了リクエストがあれば切断
        if (fetchController) { fetchController.abort(); }
        fetchController = new AbortController();

        let _body = {
            mode: _args.mode
            ,pass: _args.pass
            ,date: _args.date
            ,file: _file
            ,action: _action
            ,data: _data
        };

        console.log('getFetchData:', _url);
        console.table(_body);
        const response = await fetch(
                                    _url
                                    ,{
                                        method: "POST"
                                        ,signal: fetchController.signal
                                        ,headers: { "Content-Type": "text/plain" }
                                        ,body: JSON.stringify(_body)
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

/** URLFetch結果を定数に格納 */
function setConstants(_data, _key_userno) {
    // 設定情報
    SETTING_DATA.title = _data.settingData[0];
    SETTING_DATA.version = _data.settingData[1];
    SETTING_DATA.app_mode = _data.settingData[2];
    SETTING_DATA.mode = _data.settingData[3];
    SETTING_DATA.mode_jp = _data.settingData[4];
    SETTING_DATA.info_message = _data.settingData[5];
    SETTING_DATA.pass = _data.settingData[6];
    SETTING_DATA.date = _data.settingData[7];
    SETTING_DATA.date_jp = _data.settingData[8];
    SETTING_DATA.meeting_time = _data.settingData[9];
    SETTING_DATA.venue_meeting = _data.settingData[10];
    SETTING_DATA.seating_chart_meeting = _data.settingData[11];
    SETTING_DATA.gathering_time = _data.settingData[12];
    SETTING_DATA.venue_gathering = _data.settingData[13];
    SETTING_DATA.seating_chart_gathering = _data.settingData[14];
    SETTING_DATA.mail_from = _data.settingData[15];
    SETTING_DATA.no_send_mail_dept = _data.settingData[16];
    console.table(SETTING_DATA);

    // 社員一覧（ハッシュテーブルに変換）
    if (Array.isArray(_data.employeeInfo)) {
        EMPLOYEE_INFO = new Map(_data.employeeInfo.map(emp => [
            _key_userno ? String(emp[2]): String(emp[4])    // フラグがtrueの場合user_noをキーにする、falseの場合kanaをキーにする
            ,{
                row_no: emp[0]
                ,company: emp[1]
                ,user_no: emp[2]
                ,name: emp[3]
                ,kana: emp[4]
                ,dept: emp[5]
                ,mail: emp[6]
                ,meeting: emp[7]
                ,social_gathering: emp[8]
                ,seat_meeting: emp[9]
                ,seat_gathering: emp[10]
            }
        ]));
    }
    console.table(EMPLOYEE_INFO);
}

/** 設定情報画面描画 */
function drawSettingData() {
    const mode = document.getElementById('mode-name');
    const datetime = document.getElementById('appli-datetime');
    const venue = document.getElementById('appli-venue');

    mode.innerText = SETTING_DATA.mode_jp;
    datetime.innerText = SETTING_DATA.date;
    switch(SETTING_DATA.mode_jp) {
        case '会議受付':
            datetime.innerText += ' ' + SETTING_DATA.meeting_time;
            venue.innerText = SETTING_DATA.venue_meeting;
            break;
        case '懇親会受付':
            datetime.innerText += ' ' + SETTING_DATA.gathering_time;
            venue.innerText = SETTING_DATA.venue_gathering;
            break;
    }
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
