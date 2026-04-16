/**
 * 藝境空間 | 活動報名系統專屬邏輯
 * 處理獨立活動詳情檢視、報名防呆與資料庫寫入
 */

document.addEventListener('DOMContentLoaded', () => {

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

    // EmailJS (視需要啟用寄信，這裡先初始化)
    const EMAILJS_PUBLIC_KEY = '2NlEiWtXcW05Awbjt';
    if (typeof emailjs !== 'undefined') {
        emailjs.init(EMAILJS_PUBLIC_KEY);
    }

    try {
        if (typeof firebase !== 'undefined') {
            firebase.initializeApp(firebaseConfig);
            db = firebase.firestore();
            loadEventData();
        } else {
            throw new Error("Firebase 尚未載入");
        }
    } catch (e) {
        console.error("Firebase 初始化失敗:", e);
        document.getElementById('loadingIndicator').style.display = 'none';
        document.getElementById('errorIndicator').style.display = 'block';
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
        document.getElementById('loadingIndicator').style.display = 'none';
        document.getElementById('eventContent').style.display = 'block';

        document.getElementById('eventTitle').textContent = currentEvent.name;
        document.getElementById('eventDescription').textContent = currentEvent.description;
        document.getElementById('eventDateDisplay').textContent = `${currentEvent.date} (${currentEvent.time})`;
        document.getElementById('eventLocationDisplay').textContent = currentEvent.location;
        document.getElementById('eventImage').src = currentEvent.image || 'assets/opera_hero_bg.png';

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

    /**
     * 發送報名成功或候補通知電子郵件 (透過 EmailJS)
     */
    function sendRegistrationEmail(data) {
        // 請填入您的 EmailJS Service ID 與 Template ID
        const SERVICE_ID = 'YOUR_SERVICE_ID'; 
        const TEMPLATE_ID = 'YOUR_TEMPLATE_ID';

        if (SERVICE_ID === 'YOUR_SERVICE_ID' || typeof emailjs === 'undefined') {
            console.warn("EmailJS SERVICE_ID 未設定或套件未載入，跳過發信");
            return;
        }

        const templateParams = {
            user_name: data.userName,
            user_phone: data.userPhone,
            user_email: data.userEmail,
            event_name: data.eventName,
            event_date: currentEvent.date,
            event_time: currentEvent.time,
            event_location: currentEvent.location,
            status_text: data.status === 'waiting' ? '候補中' : '報名成功'
        };

        emailjs.send(SERVICE_ID, TEMPLATE_ID, templateParams)
            .then(res => console.log('Email 發送成功:', res))
            .catch(err => console.error('Email 發送失敗:', err));
    }
});
