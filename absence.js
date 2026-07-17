// DOM要素の取得
var containor = HTMLElement;

// var toast = HTMLElement;

/** 設定データ取得待ちのポップアップ通知 */
var toastDataWait = HTMLElement;
/** エラー時のポップアップ通知 */
var toastError = HTMLElement;

var kanaInput = HTMLElement;
var suggestionList = HTMLElement;   // 入力候補
var nameSelect = HTMLElement;
var deptSelect = HTMLElement;
var meetingStatus = HTMLElement;
var reasonInput = HTMLElement;
var timeInput = HTMLElement;
var timeSuffix = HTMLElement;
var timeLabel = HTMLElement;
var contactForm = HTMLElement;
var checkAttention = HTMLElement;





/** 画面ロード時の処理 */
window.onload = async function() {

    console.time()


    // 💡ページを離れる/リロードする直前にリクエストを強制切断（GET化の残骸防止）
    window.onbeforeunload = () => {
        if (fetchController) fetchController.abort();
    };

    // DOM要素の取得
    containor = document.getElementById('containor');
    /** 設定データ取得待ちのポップアップ通知 */
    toastDataWait = document.getElementById('toast-getData-wait');
    /** エラー時のポップアップ通知 */
    toastError = document.getElementById('toast-error');
    
    // toast = document.getElementById('toast');

    // GETパラメータの取得
    args = getArguments();

    // 設定データ取得待ちの表示
    clearTimeout(toastTimeout);
    toastDataWait.classList.remove('translate-y-20', 'hidden', 'pointer-events-none');
    toastDataWait.classList.add('translate-y-0', 'opacity-100');

    try {
        // 設定データ＆社員情報一覧の取得
        console.groupCollapsed('設定データ＆社員情報一覧の取得');
        let data = await getFetchData(GAS_URL, 'absence.html', args, sendParam_getEmployee);

        // 取得結果を定数に格納
        setConstants(data, true);

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

    // メイン部分を表示
    containor.classList.remove('hidden');
    containor.classList.add('opacity-100');

    // 各入力域のDOM要素取得
    kanaInput = document.getElementById('kana-input');
    suggestionList = document.getElementById('suggestion-list');
    nameSelect = document.getElementById('name-select');
    deptSelect = document.getElementById('dept-select');
    meetingStatus = document.getElementById('meeting-status');
    reasonInput = document.getElementById('reason-input');
    timeInput = document.getElementById('time-input');
    timeSuffix = document.getElementById('time-suffix');
    timeLabel = document.getElementById('time-label');
    contactForm = document.getElementById('contact-form');
    checkAttention = document.getElementById('check-attention');

    // フォーカスがあたった瞬間にリストを表示（全件、または入力中の文字で絞り込み）
    //kanaInput.addEventListener('focus', updateSuggestions);

    // 文字入力時にもリストをリアルタイムに更新
    //kanaInput.addEventListener('input', updateSuggestions);

    // エンターキーによる誤送信を防止
    kanaInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.isComposing) {
            e.preventDefault(); // フォームのsubmit等のデフォルト挙動を阻止
        }
    });

    // 入力欄にdata属性をセット
    // idの完全一致でフィルタリング
    const filtered = args.id 
        ? Array.from(EMPLOYEE_INFO.entries()).filter(([key]) => key.includes(args.id))
        : Array.from(EMPLOYEE_INFO.entries());

    if (filtered.length = 1) {
        const selectedMember = EMPLOYEE_INFO.get(args.id);
        console.table(selectedMember);

        // 入力欄にdata属性をセット
        kanaInput.innerHTML = '<option value="" >タップしてリストから選択、または入力</option>';
        kanaInput.innerHTML += `<option value="${selectedMember.kana}" selected>${selectedMember.kana}</option>`;
        kanaInput.dataset.kana = selectedMember.kana;
        kanaInput.dataset.rowNo = selectedMember.row_no;
        kanaInput.dataset.userNo = selectedMember.user_no;
        kanaInput.dataset.mail = selectedMember.mail;
        kanaInput.dataset.dept = selectedMember.dept;
        kanaInput.dataset.name = selectedMember.name;
        kanaInput.dataset.seat = selectedMember.seat_gathering;

        // 氏名と所属に反映
        nameSelect.innerHTML = '<option value="" >かなを入力／選択すると自動反映されます</option>';
        nameSelect.innerHTML += `<option value="${selectedMember.name}" selected>${selectedMember.name}</option>`;
        deptSelect.innerHTML = '<option value="" >かなを入力／選択すると自動反映されます</option>';
        deptSelect.innerHTML += `<option value="${selectedMember.dept}" selected>${selectedMember.dept}</option>`;
    }

    // チェックボックスのチェック状態変更時の処理
    checkAttention.addEventListener('change', (e) => {
        

        let btnSubmit = document.getElementById('btn-submit');
        if (e.target.checked) {
            btnSubmit.style.opacity = '1';
            btnSubmit.classList.remove('cursor-not-allowed');
            btnSubmit.classList.remove('text-slate-600');
            btnSubmit.classList.add('text-slate-950');
            btnSubmit.disabled = false;
            
        } else {
            btnSubmit.style.opacity = '0.3';
            btnSubmit.classList.add('cursor-not-allowed');
            btnSubmit.classList.remove('text-slate-950');
            btnSubmit.classList.add('text-slate-600');
            btnSubmit.disabled = true;
        }
    });

    // 「送信」ボタン押下時の処理
    contactForm.addEventListener('submit', async (e) => {
        event.preventDefault();

        let btnSubmit = document.getElementById('btn-submit');
        btnSubmit.disabled = true;
        await sendData();
        btnSubmit.disabled = false;
    });

    // 会議欄の切り替え制御
    //handleMeetingStatusChange();

    console.timeEnd()
    console.log('アプリ起動完了');
}

/** リスト描画の共通処理（空文字なら全件表示、文字があれば絞り込み）*/
function updateSuggestions() {
    // 入力がない場合は全件、ある場合は部分一致でフィルタリング
    const query = kanaInput.value.trim().toLowerCase();
    const filtered = query 
        ? Array.from(EMPLOYEE_INFO.entries()).filter(([key]) => key.includes(query))
        : Array.from(EMPLOYEE_INFO.entries());

    if (filtered.length > 0) {
        suggestionList.innerHTML = filtered.map(member => `
            <li class="px-4 py-2.5 hover:bg-slate-800 text-sm text-slate-200 cursor-pointer transition-colors border-b border-slate-900/50 last:border-0" 
            data-row-no="` + member[1].row_no + `" 
            data-user-no="` + member[1].user_no + `" 
            data-user-dept="` + member[1].dept + `" 
            data-kana="` + member[1].kana + `" 
            data-user-name="` + member[1].name + `" 
            data-mail-to="` + member[1].mail + `" 
            data-jizen-meeting="` + member[1].meeting + `" 
            data-jizen-gathering="` + member[1].social_gathering + `" 
            data-seat-meeting="` + member[1].seat_meeting + `" 
            data-seat-gathering="` + member[1].seat_gathering + `" 
            >
                <div class="font-medium">` + member[1].kana + `</div>
                <div class="text-xs text-slate-500">` + member[1].name + ` ［` + member[1].dept + `］</div>
            </li>
        `).join('');
        suggestionList.classList.remove('hidden');
    } else {
        suggestionList.innerHTML = `<li class="px-4 py-3 text-sm text-slate-600 text-center">該当する候補がいません</li>`;
        suggestionList.classList.remove('hidden');
    }
}

let toastTimeout;
/** 登録完了時ポップアップ通知の表示 */
function showToastSuccess() {
    clearTimeout(toastTimeout);
    
    // 表示
    toast.classList.remove('translate-y-20', 'hidden', 'pointer-events-none');
    toast.classList.add('translate-y-0', 'opacity-100');
    playBeep(true);
}

async function sendData() {


    let sendData = {
        title: SETTING_DATA.title
        ,date: SETTING_DATA.date_jp
        ,venue: SETTING_DATA.venue_meeting
        ,app_mode: SETTING_DATA.app_mode
        ,mode: '懇親会'
        ,mail_from: SETTING_DATA.mail_from
        // メール添付
        ,mail_attach: (SETTING_DATA.mode_jp === '会議受付' ? SETTING_DATA.seating_chart_meeting: SETTING_DATA.seating_chart_gathering)
        // メール送信対象外の所属部署一覧
        ,no_send_mail_dept: SETTING_DATA.no_send_mail_dept.concat()
        ,row_no: kanaInput.dataset.rowNo
        ,user_no: kanaInput.dataset.userNo
        ,mail_to: kanaInput.dataset.mail
        ,user_dept: kanaInput.dataset.dept
        ,user_name: kanaInput.dataset.name
        // 参加可否種別
        ,attendance: {
            meeting: null
            ,gathering: meetingStatus.value
        }
        // 座席位置
        ,seat: kanaInput.dataset.seat
        // 遅刻の場合は、理由に「予定時刻」も追記
        ,comment: reasonInput.value + (meetingStatus.value === '遅刻' ? '(' + timeInput.value + '予定)': '')

        ,lost_qr_cord: false
        ,manual: true
    };
    console.log('登録データ');
    console.table(sendData);


    try {
        // しばらくお待ちくださいの表示
        clearTimeout(toastTimeout);
        let waitMessage = document.getElementById('wait-message');
        waitMessage.innerText = 'しばらくお待ちください...';
        toastDataWait.classList.remove('translate-y-20', 'hidden', 'pointer-events-none');
        toastDataWait.classList.add('translate-y-0', 'opacity-100');

        // 遅刻/欠席連絡の登録
        console.groupCollapsed('遅刻/欠席連絡の登録');
        let _action = (SETTING_DATA.mode_jp === '会議受付' ? sendParam_meeting: sendParam_gathering);
        let data = await getFetchData(GAS_URL, 'absence.html', args, _action, sendData);
        
        // しばらくお待ちくださいを非表示
        toastDataWait.classList.remove('translate-y-0', 'opacity-100');
        toastDataWait.classList.add('hidden');

        // メイン部分を非表示
        containor.classList.remove('opacity-100');
        containor.classList.add('hidden');

        // 完了メッセージを表示
        showToastSuccess();
        console.groupEnd('遅刻/欠席連絡の登録');

    } catch (fetchError) {
        // しばらくお待ちくださいを非表示
        toastDataWait.classList.remove('translate-y-0', 'opacity-100');
        toastDataWait.classList.add('hidden');

        showToastError(
            fetchError
            ,false
        );
        return false;
    }
}