/**
 * 藝境空間 | 活動報名系統專屬邏輯
 * 處理獨立活動詳情檢視、報名防呆與資料庫寫入
 */

// [緊急偵錯] 全域錯誤監控移到最頂層
window.onerror = function(msg, url, line, col, error) {
    console.error("全域錯誤捕捉:", msg, error);
    alert(`系統載入出錯 (全域)：\n${msg}\n(行號: ${line})\n如果您看到這個，請告訴我原因。`);
    // 試著強制移除載入動態
    try {
        const ld = document.getElementById('loadingIndicator');
        if (ld) ld.style.display = 'none';
        const ed = document.getElementById('errorIndicator');
        if (ed) ed.style.display = 'block';
    } catch(e) {}
};

document.addEventListener('DOMContentLoaded', () => {
    console.log("events.js 啟動...");
    
    const firebaseConfig = {
        apiKey: "AIzaSyDplIrzsJEHIpFTS7HdqeojHV38Le_vAgA",
        authDomain: "rental-b60e1.firebaseapp.com",
        projectId: "rental-b60e1",
        storageBucket: "rental-b60e1.firebasestorage.app",
        messagingSenderId: "721096991036",
        appId: "1:721096991036:web:cc868cb9d618ea77573e39"
    };

    let db = null;
    let currentEvent = null;
    let registrationsCount = 0;

    // EmailJS 初始化
    const EMAILJS_PUBLIC_KEY = '2NlEiWtXcW05Awbjt';
    if (typeof emailjs !== 'undefined') {
        emailjs.init(EMAILJS_PUBLIC_KEY);
    }

    try {
        if (typeof firebase !== 'undefined') {
            if (!firebase.apps.length) {
                firebase.initializeApp(firebaseConfig);
            }
            db = firebase.firestore();
            loadEventData();
        } else {
            throw new Error("Firebase 套件尚未載入");
        }
    } catch (e) {
        console.error("Firebase 初始化失敗:", e);
        const ld = document.getElementById('loadingIndicator');
        if (ld) ld.style.display = 'none';
        const ed = document.getElementById('errorIndicator');
        if (ed) ed.style.display = 'block';
    }

    // 主題變更 (偷用系統的全域設定)
    const themeToggle = document.getElementById('themeToggleTheme');
    function applyTheme(theme) {
        document.documentElement.setAttribute('data-theme', theme);
        if (themeToggle) themeToggle.innerText = theme === 'light' ? '☀️' : '🌙';
    }
    const savedTheme = localStorage.getItem('userTheme') || 'dark';
    applyTheme(savedTheme);
    if (themeToggle) {
        themeToggle.addEventListener('click', () => {
            const currentTheme = document.documentElement.getAttribute('data-theme') || 'dark';
            const newTheme = currentTheme === 'light' ? 'dark' : 'light';
            applyTheme(newTheme);
            localStorage.setItem('userTheme', newTheme);
        });
    }

    function loadEventData() {
        const urlParams = new URLSearchParams(window.location.search);
        const eventId = urlParams.get('id');

        if (!eventId) {
            document.getElementById('loadingIndicator').style.display = 'none';
            document.getElementById('errorIndicator').style.display = 'block';
            return;
        }

        const localTestEvent = {
            id: 'EV-TEST-01',
            name: '【大師開講】京劇武行身段解析與排演應用',
            date: '2026-05-20',
            time: '14:00-16:30',
            location: '梨園實驗劇場',
            capacity: 50,
            image: 'assets/event_lecture_test.png',
            description: '邀請資深京劇大師親自示範，帶領新生代演員從基礎的手眼身法步，進階至實際舞臺調度上的應用轉換。課程將包含實地體驗與 QA 問答環節，名額有限，歡迎熱愛傳統戲曲的朋友踴躍報名！',
            isActive: true
        };

        // 監聽此活動的資料
        try {
            db.collection('events').doc(eventId).onSnapshot((doc) => {
                if (doc.exists && doc.data().isActive) {
                    currentEvent = { id: doc.id, ...doc.data() };
                    renderEventDetails();
                    checkRegistrations();
                } else if (eventId === 'EV-TEST-01') {
                    // 若是測試活動且未在 Firebase 產生，則載入本地版本
                    currentEvent = localTestEvent;
                    renderEventDetails();
                    checkRegistrationsLocal();
                } else {
                    document.getElementById('loadingIndicator').style.display = 'none';
                    document.getElementById('errorIndicator').style.display = 'block';
                    document.getElementById('eventContent').style.display = 'none';
                }
            }, (error) => {
                if (eventId === 'EV-TEST-01') {
                    currentEvent = localTestEvent;
                    renderEventDetails();
                    checkRegistrationsLocal();
                } else {
                    document.getElementById('loadingIndicator').style.display = 'none';
                    document.getElementById('errorIndicator').style.display = 'block';
                    document.getElementById('eventContent').style.display = 'none';
                }
            });
        } catch (e) {
            if (eventId === 'EV-TEST-01') {
                currentEvent = localTestEvent;
                renderEventDetails();
                checkRegistrationsLocal();
            }
        }
    }

    // 當處於單純本地模式時，無法讀取資料庫註冊名單，先預設數量為0
    function checkRegistrationsLocal() {
        registrationsCount = 32;
        const capacity = parseInt(currentEvent.capacity, 10) || 50;
        document.getElementById('eventCapacityDisplay').textContent = `${registrationsCount} / ${capacity}`;
        document.getElementById('registrationClosedMsg').style.display = 'none';
        
        const submitBtn = document.getElementById('regSubmitBtn');
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.style.opacity = '1';
            submitBtn.style.cursor = 'pointer';
        }
    }

    function renderEventDetails() {
        if (!currentEvent) return;
        
        // 確保優先隱藏載入提示
        const loading = document.getElementById('loadingIndicator');
        const content = document.getElementById('eventContent');
        if (loading) loading.style.display = 'none';
        if (content) content.style.display = 'block';

        const titleEl = document.getElementById('eventTitle');
        const descEl = document.getElementById('eventDescription');
        const dateEl = document.getElementById('eventDateDisplay');
        const locEl = document.getElementById('eventLocationDisplay');
        const imgEl = document.getElementById('eventImage');

        if (titleEl) titleEl.textContent = currentEvent.name || '未命名活動';
        if (descEl) descEl.textContent = currentEvent.description || '暫無描述';
        if (dateEl) dateEl.textContent = `${currentEvent.date || '未定日期'} (${currentEvent.time || '未定時間'})`;
        if (locEl) locEl.textContent = currentEvent.location || '待定地點';
        if (imgEl) imgEl.src = currentEvent.image || 'assets/opera_hero_bg.png';

        // 動態生成自定義欄位
        const container = document.getElementById('dynamicFieldsContainer');
        if (container && currentEvent.customFields) {
            container.innerHTML = currentEvent.customFields.map((f, index) => `
                <div class="form-group">
                    <label>${f.name}</label>
                    <input type="${f.type}" class="custom-field-input" data-name="${f.name}" placeholder="請輸入${f.name}" ${f.required ? 'required' : ''}>
                </div>
            `).join('');
        }
        
        // title
        document.title = `${currentEvent.name} | 藝境空間`;
    }

    function checkRegistrations() {
        if (!currentEvent) return;

        db.collection('event_registrations')
            .where('eventId', '==', currentEvent.id)
            .onSnapshot((snapshot) => {
                registrationsCount = snapshot.size;
                const capacity = parseInt(currentEvent.capacity, 10) || 0;
                
                document.getElementById('eventCapacityDisplay').textContent = `${registrationsCount} / ${capacity}`;

                const formInfo = document.getElementById('eventRegistrationForm');
                const closedMsg = document.getElementById('registrationClosedMsg');
                const submitBtn = document.getElementById('regSubmitBtn');

                if (registrationsCount >= capacity) {
                    if (currentEvent.allowWaitlist) {
                        closedMsg.style.display = 'block';
                        closedMsg.style.background = 'rgba(99, 102, 241, 0.1)';
                        closedMsg.style.borderColor = '#6366f1';
                        closedMsg.style.color = '#a5b4fc';
                        closedMsg.textContent = '此活動目前名額已滿，您可加入候補名單，有名額釋出將會通知您。';
                        submitBtn.textContent = '加入候補';
                        submitBtn.disabled = false;
                        submitBtn.style.opacity = '1';
                        submitBtn.style.cursor = 'pointer';
                        submitBtn.style.background = '#6366f1';
                    } else {
                        closedMsg.style.display = 'block';
                        closedMsg.textContent = '此活動報名人數已額滿。';
                        submitBtn.disabled = true;
                        submitBtn.style.opacity = '0.5';
                        submitBtn.style.cursor = 'not-allowed';
                    }
                } else {
                    closedMsg.style.display = 'none';
                    submitBtn.textContent = '確認報名';
                    submitBtn.disabled = false;
                    submitBtn.style.opacity = '1';
                    submitBtn.style.cursor = 'pointer';
                    submitBtn.style.background = 'var(--accent)';
                }
            });
    }

    // 處理表單送出
    const form = document.getElementById('eventRegistrationForm');
    if (form) {
        form.addEventListener('submit', (e) => {
            e.preventDefault();

            if (!currentEvent || !db) return;
            const capacity = parseInt(currentEvent.capacity, 10) || 0;
            const isWaitlist = (registrationsCount >= capacity);

            if (isWaitlist && !currentEvent.allowWaitlist) {
                alert("已額滿，無法報名");
                return;
            }

            const btn = document.getElementById('regSubmitBtn');
            btn.disabled = true;
            btn.textContent = '報名處理中...';

            const name = document.getElementById('regName').value.trim();
            const phone = document.getElementById('regPhone').value.trim();
            const email = document.getElementById('regEmail').value.trim();

            // 收集自定義欄位
            const customData = {};
            document.querySelectorAll('.custom-field-input').forEach(input => {
                customData[input.dataset.name] = input.value;
            });

            const registrationData = {
                eventId: currentEvent.id,
                eventName: currentEvent.name,
                userName: name,
                userPhone: phone,
                userEmail: email,
                timestamp: new Date().toISOString(),
                status: isWaitlist ? 'waiting' : 'registered',
                customData: customData
            };

            db.collection('event_registrations').add(registrationData)
                .then((docRef) => {
                    document.getElementById('successModal').style.display = 'flex';
                    // 發送自動通知信
                    sendRegistrationEmail(registrationData);
                })
                .catch((error) => {
                    // 如果 Firestore 存取被拒 (通常是未登入卻去寫入等安全規則，或是 db 根本連不上)
                    if (currentEvent.id === 'EV-TEST-01') {
                         document.getElementById('successModal').style.display = 'flex';
                    } else {
                        console.error("報名失敗: ", error);
                        alert(`報名失敗：${error.message}`);
                        btn.disabled = false;
                        btn.textContent = '確認報名';
                    }
                });
    }

    function generateEventEmailHTML(data) {
        const isWaiting = (data.status === 'waiting');
        const statusText = isWaiting ? '候補成功' : '報名成功';
        
        // 郵件共用樣式變數
        const mainFont = 'system-ui, -apple-system, sans-serif';
        const primaryColor = '#1f2937'; // 頁首深藍色
        const successColor = '#10b981'; // 報名成功綠
        const waitingColor = '#6366f1'; // 候補成功靛藍
        const accentColor = isWaiting ? waitingColor : successColor;
        
        const statusMsg = isWaiting 
            ? '由於目前活動名額已滿，我們已將您列入**候補名單**。若有名額釋出，我們將主動與您聯繫。' 
            : '我們已確認您的報名資料，以下是您的詳細報名資訊：';

        return `
        <div style="background-color: #f3f4f6; padding: 40px 20px; font-family: ${mainFont};">
            <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 15px rgba(0,0,0,0.1);">
                <!-- Header -->
                <div style="background-color: ${primaryColor}; padding: 35px 20px; text-align: center; color: #ffffff;">
                    <h1 style="margin: 0; font-size: 28px; letter-spacing: 4px; font-weight: bold;">藝 境 空 間</h1>
                    <p style="margin: 10px 0 0 0; font-size: 14px; opacity: 0.8; letter-spacing: 1px;">活動報名通知</p>
                </div>

                <!-- Main Body -->
                <div style="padding: 40px; line-height: 1.6; color: #334155;">
                    <p style="margin-bottom: 20px;">親愛的 <strong>${data.userName}</strong> 您好，</p>
                    <p style="margin-bottom: 25px;">感謝您報名【藝境空間】活動：<strong style="color: ${primaryColor};"> ${data.eventName}</strong>！<br>${statusMsg}</p>

                    <!-- 活動明細卡片 -->
                    <div style="background-color: #f8fafc; padding: 25px; border-radius: 8px; border-left: 5px solid ${accentColor}; margin-bottom: 30px;">
                        <h3 style="margin: 0 0 15px 0; font-size: 18px; color: #1e293b;">📋 活動資訊</h3>
                        <div style="height: 1px; background-color: #e2e8f0; margin-bottom: 15px;"></div>
                        <table style="width: 100%; border-collapse: collapse; font-size: 15px;">
                            <tr><td style="padding: 8px 0; color: #64748b; width: 100px;">報名狀態</td><td style="padding: 8px 0; font-weight: bold; color: ${accentColor};">${statusText}</td></tr>
                            <tr><td style="padding: 8px 0; color: #64748b;">活動名稱</td><td style="padding: 8px 0; font-weight: bold; color: #1e293b;">${data.eventName}</td></tr>
                            <tr><td style="padding: 8px 0; color: #64748b;">活動日期</td><td style="padding: 8px 0; font-weight: bold; color: #1e293b;">${data.eventDate || (currentEvent && currentEvent.date) || '未定'}</td></tr>
                            <tr><td style="padding: 8px 0; color: #64748b;">活動時間</td><td style="padding: 8px 0; font-weight: bold; color: #1e293b;">${data.eventTime || (currentEvent && currentEvent.time) || '未定'}</td></tr>
                            <tr><td style="padding: 8px 0; color: #64748b;">舉辦地點</td><td style="padding: 8px 0; font-weight: bold; color: #1e293b;">${data.eventLocation || (currentEvent && currentEvent.location) || '未定'}</td></tr>
                        </table>
                    </div>

                    ${!isWaiting ? `
                    <div style="border: 1px solid #e2e8f0; border-radius: 8px; padding: 20px; background-color: #ffffff; margin-bottom: 30px;">
                        <h4 style="margin: 0 0 10px 0; font-size: 16px; color: #1e293b;">📍 報到須知</h4>
                        <p style="margin: 0; font-size: 14px; color: #475569; line-height: 1.6;">
                            活動當天請憑「報名姓名」或「聯絡電話末三碼」向現場櫃檯人員報到即可。建議您提早於活動開始前 <strong>10 分鐘</strong> 抵達現場。
                        </p>
                    </div>
                    ` : ''}

                    <div style="padding: 10px 0; border-top: 1px dashed #e2e8f0; margin-bottom: 20px;">
                        <p style="margin: 0; font-size: 14px; color: #64748b;">您的報名聯絡資訊：</p>
                        <p style="margin: 5px 0 0 0; font-size: 14px; color: #1e293b;">姓名：${data.userName} | 電話：${data.userPhone}</p>
                    </div>

                    <!-- Conclusion -->
                    <div style="text-align: center; border-top: 1px solid #f1f5f9; padding-top: 30px; margin-top: 20px;">
                        <p style="margin: 0; font-size: 15px; color: #475569;">如果您對活動有任何疑問，歡迎隨時與我們聯繫。</p>
                        <h4 style="margin: 15px 0 0 0; font-size: 18px; color: #1e293b;">期待在藝境空間見到您！</h4>
                        <p style="margin: 15px 0 0 0; font-size: 14px; color: #94a3b8;">藝境空間 管理團隊 敬上</p>
                    </div>
                </div>
            </div>
        </div>`;
    }

    function sendRegistrationEmail(data) {
        // 請填入您的 EmailJS Service ID 與 Template ID (需與萬用樣板 ID 一致)
        const SERVICE_ID = 'service_96agth6'; 
        const TEMPLATE_ID = 'template_uz1rccd';

        if (SERVICE_ID === 'YOUR_SERVICE_ID' || typeof emailjs === 'undefined') {
            console.warn("EmailJS SERVICE_ID 未設定或套件未載入，跳過發信");
            return;
        }

        const emailHtml = generateEventEmailHTML(data);
        const subjectLabel = data.status === 'waiting' ? '候補登錄通知' : '報名成功通知';
        const subject = `【${subjectLabel}】${data.eventName} - ${data.userName}`;

        const templateParams = {
            to_email: data.userEmail,
            subject: subject,
            message_html: emailHtml,
            user_name: data.userName,
            user_phone: data.userPhone,
            user_email: data.userEmail,
            event_name: data.eventName,
            // 修正為更安全的存取方式
            event_date: data.eventDate || (currentEvent ? currentEvent.date : '未定'),
            event_time: data.eventTime || (currentEvent ? currentEvent.time : '未定'),
            event_location: data.eventLocation || (currentEvent ? currentEvent.location : '未定')
        };

        emailjs.send(SERVICE_ID, TEMPLATE_ID, templateParams)
            .then(res => console.log('Email 發送成功:', res))
            .catch(err => {
                console.error('Email 發送失敗:', err);
                alert(`【活動報名發信失敗】\n原因：${err.text || '連線錯誤'}\n狀態碼：${err.status || '未知'}`);
            });
    }
});
