/**
 * 藝境空間 | 應用程式邏輯
 * 處理場地生成、表單提交與狀態追蹤
 */

document.addEventListener('DOMContentLoaded', () => {
    // ==========================================
    // EmailJS 真實寄信設定區 (請依照教學填入金鑰)
    // ==========================================
    const EMAILJS_PUBLIC_KEY = '2NlEiWtXcW05Awbjt'; // 替換為您的 Public Key
    const EMAILJS_SERVICE_ID = 'service_96agth6'; // 替換為您的 Service ID
    const EMAILJS_TEMPLATE_ID = 'template_rle8t5f'; // 替換為您的 Template ID

    // 初始化 EmailJS SDK
    if (typeof emailjs !== 'undefined' && EMAILJS_PUBLIC_KEY && EMAILJS_PUBLIC_KEY.length > 5) {
        emailjs.init(EMAILJS_PUBLIC_KEY);
    }

    // 1. 資料定義 (戲曲特化版)
    const venues = [
        {
            id: 'dance',
            name: '雲水排練場',
            type: '武戲與身段排練室',
            capacity: '20-30人',
            price: '$800/hr',
            tags: ['挑高空間', '專業彈性木地板', '全牆大鏡面'],
            image: 'assets/dance_studio.png'
        },
        {
            id: 'music',
            name: '絲竹雅音室',
            type: '文場與唱腔排練室',
            capacity: '5-10人',
            price: '$600/hr',
            tags: ['文場器樂隔音', '戲曲排練專用桌椅', '錄製設備'],
            image: 'assets/music_room.png'
        },
        {
            id: 'theater',
            name: '梨園實驗劇場',
            type: '總彩排黑盒劇場',
            capacity: '50-80人',
            price: '$1500/hr',
            tags: ['專業舞台燈光', '多角度側幕', '階梯式觀眾席'],
            image: 'assets/black_box.png'
        }
    ];

    // 1.5 Firebase 資料庫初始化 (取代原本的 localStorage)
    const firebaseConfig = {
        apiKey: "AIzaSyDplIrzsJEHIpFTS7HdqeojHV38Le_vAgA",
        authDomain: "rental-b60e1.firebaseapp.com",
        projectId: "rental-b60e1",
        storageBucket: "rental-b60e1.firebasestorage.app",
        messagingSenderId: "721096991036",
        appId: "1:721096991036:web:cc868cb9d618ea77573e39"
    };

    let db = null;
    let bookings = [];

    // 若使用者填妥了 Firebase 金鑰，則執行連線與即時監聽
    if (typeof firebase !== 'undefined' && firebaseConfig.apiKey !== "YOUR_API_KEY") {
        firebase.initializeApp(firebaseConfig);
        db = firebase.firestore();

        // 【核心亮點】設定 onSnapshot 即時監聽 (Realtime Listener)
        db.collection("bookings").orderBy("timestamp", "desc").onSnapshot((snapshot) => {
            bookings = [];
            snapshot.forEach((doc) => {
                bookings.push({ id: doc.id, ...doc.data() });
            });
            
            // 當雲端資料有變更時，自動更新雙邊畫面 (跨裝置同步)
            if (window.renderSchedule) window.renderSchedule();
            const adminPanel = document.getElementById('adminPanel');
            if (adminPanel && adminPanel.style.display === 'block') {
                if (window.renderAdminList) window.renderAdminList();
            }
        }, (error) => {
            console.error("Firebase 監聽錯誤:", error);
            alert("無法連線雲端資料庫，請確認金鑰或網路連線");
        });
    } else {
        // 備用方案：尚未填寫 Firebase 金鑰前，繼續使用 LocalStorage 確保體驗不中斷
        const STORAGE_KEY = 'rehearsal_bookings';
        const todayStr = new Date().toISOString().split('T')[0];
        const defaultBookings = [{
            id: 'REQ-DEMO123',
            venue: 'dance',
            startDate: todayStr,
            endDate: todayStr,
            slots: ['午'],
            groupName: '範例傳統劇團',
            applicant: '陳掌櫃',
            email: 'demo@example.com',
            purpose: '京劇折子戲《打金磚》排練',
            status: '預約成功',
            timestamp: new Date().toLocaleString('zh-TW'),
            totalRent: 'NT$ 3,200'
        }];
        const storedData = localStorage.getItem(STORAGE_KEY);
        bookings = storedData ? JSON.parse(storedData) : defaultBookings;

        window.saveBookingsLocal = function() {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(bookings));
        };
    }

    // 封裝通用庫存寫入函式 (供送出表單呼叫)
    function addBookingToDB(formData) {
        if (db) {
            db.collection("bookings").doc(formData.id).set(formData).catch(err => {
                console.error("寫入 Firebase 失敗:", err);
                alert("寫入雲端資料庫失敗！");
            });
            // Firebase onSnapshot 會自動捕捉並更新畫面，此處不需手動 render
        } else {
            bookings.unshift(formData);
            if (window.saveBookingsLocal) window.saveBookingsLocal();
            if (window.renderAdminList) window.renderAdminList();
            if (window.renderSchedule) window.renderSchedule();
        }
    }

    // 封裝通用狀態更新函式 (供後台核准/退回呼叫)
    function updateBookingStatusToDB(id, newStatus) {
        if (db) {
            db.collection("bookings").doc(id).update({
                status: newStatus
            }).catch(err => {
                console.error("更新 Firebase 狀態失敗:", err);
            });
        } else {
            const item = bookings.find(b => b.id === id);
            if (item) {
                item.status = newStatus;
                if (window.saveBookingsLocal) window.saveBookingsLocal();
                if (window.renderAdminList) window.renderAdminList();
                if (window.renderSchedule) window.renderSchedule();
            }
        }
    }

    // 2. DOM 元素
    const venueGrid = document.getElementById('venueGrid');
    const bookingForm = document.getElementById('bookingForm');
    const sections = document.querySelectorAll('section');
    const scheduleSection = document.getElementById('schedule');

    // 租金計算輔助函式
    function calculateTotalRent(venueId, startDate, endDate, slotsCount) {
        const venue = venues.find(v => v.id === venueId);
        if (!venue) return 0;

        const priceStr = venue.price.replace(/[^0-9]/g, '');
        const pricePerHour = parseInt(priceStr, 10) || 0;

        const start = new Date(startDate);
        const end = new Date(endDate);
        const diffTime = Math.abs(end - start);
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;

        const hoursPerSlot = 4;
        return diffDays * slotsCount * hoursPerSlot * pricePerHour;
    }

    // 3. 初始化場地展示
    function renderVenues() {
        venueGrid.innerHTML = venues.map(venue => `
            <div class="venue-card">
                <img src="${venue.image}" alt="${venue.name}" class="venue-img">
                <div class="venue-info">
                    <div class="venue-tags">
                        ${venue.tags.map(tag => `<span class="tag">${tag}</span>`).join('')}
                    </div>
                    <h3>${venue.name}</h3>
                    <p style="color: var(--text-muted); font-size: 0.9rem; margin-bottom: 15px;">
                        適合：${venue.type} | 容量：${venue.capacity}
                    </p>
                    <div style="display: flex; justify-content: space-between; align-items: center;">
                        <span style="font-weight: 700; color: var(--accent);">${venue.price}</span>
                        <button class="btn-secondary select-venue-btn" data-id="${venue.id}">選擇</button>
                    </div>
                </div>
            </div>
        `).join('');

        // 綁定選取按鈕
        document.querySelectorAll('.select-venue-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const venueId = e.target.getAttribute('data-id');
                document.getElementById('venueSelect').value = venueId;
                window.location.hash = 'booking';
            });
        });
    }

    // 4. 表單分段切換邏輯
    const nextBtn = document.querySelector('.next-step');
    const prevBtn = document.querySelector('.prev-step');
    const steps = document.querySelectorAll('.form-step');

    nextBtn.addEventListener('click', () => {
        const venueVal = document.getElementById('venueSelect').value;
        if (!venueVal) {
            alert('請選擇場地！');
            return;
        }

        const startDate = document.getElementById('startDate').value;
        if (!startDate) {
            alert('請選擇預約開始日期！');
            return;
        }

        const endDate = document.getElementById('endDate').value;
        if (!endDate) {
            alert('請選擇預約結束日期！');
            return;
        }

        if (new Date(startDate) > new Date(endDate)) {
            alert('結束日期不能早於開始日期！');
            return;
        }

        const slotElms = document.querySelectorAll('input[name="slots"]:checked');
        if (slotElms.length === 0) {
            alert('請至少選擇一個場次！');
            return;
        }

        const reqSlotsTexts = Array.from(slotElms).map(el => el.parentElement.querySelector('span').textContent.split(' ')[0]);

        // 檢查防衝堂 (時段重疊)
        const hasConflict = bookings.some(b => {
            if (b.status !== '預約成功') return false;
            if (b.venue !== venueVal) return false;

            // 檢查日期交集
            const isDateOverlap = (startDate <= b.endDate) && (endDate >= b.startDate);
            if (!isDateOverlap) return false;

            // 檢查場次交集
            const isSlotOverlap = reqSlotsTexts.some(slot => b.slots.includes(slot));
            if (!isSlotOverlap) return false;

            return true;
        });

        if (hasConflict) {
            alert('抱歉，該時段與場地已被其他單位預約成功！請查看「檔期查詢」以選擇其他閒置時間。');
            return;
        }

        // 動態試算並顯示總金額
        const totalRent = calculateTotalRent(venueVal, startDate, endDate, slotElms.length);
        const totalRentDisplay = document.getElementById('totalRentDisplay');
        if (totalRentDisplay) {
            totalRentDisplay.textContent = `NT$ ${totalRent.toLocaleString()}`;
        }

        steps[0].classList.remove('active');
        steps[1].classList.add('active');
    });

    prevBtn.addEventListener('click', () => {
        steps[1].classList.remove('active');
        steps[0].classList.add('active');
    });

    // 5. 處理表單提交
    bookingForm.addEventListener('submit', (e) => {
        e.preventDefault();

        // 提交前驗證第二階段欄位
        const secondStepInputs = steps[1].querySelectorAll('input[required], textarea[required]');
        let isValid = true;
        secondStepInputs.forEach(input => {
            if (!input.checkValidity()) {
                input.reportValidity();
                isValid = false;
            }
        });

        if (!isValid) return;

        const startDate = document.getElementById('startDate').value;
        const endDate = document.getElementById('endDate').value;
        const slotElms = document.querySelectorAll('input[name="slots"]:checked');
        const slots = Array.from(slotElms).map(el => el.parentElement.querySelector('span').textContent.split(' ')[0]);

        if (slots.length === 0) {
            alert('請至少選擇一個場次！');
            return;
        }

        if (new Date(startDate) > new Date(endDate)) {
            alert('結束日期不能早於開始日期！');
            return;
        }

        const formData = {
            id: 'REQ-' + Math.random().toString(36).substr(2, 9).toUpperCase(),
            venue: document.getElementById('venueSelect').value,
            startDate: document.getElementById('startDate').value,
            endDate: document.getElementById('endDate').value,
            slots: Array.from(document.querySelectorAll('input[name="slots"]:checked')).map(el => el.parentElement.querySelector('span').textContent.split(' ')[0]),
            groupName: document.getElementById('groupName').value,
            applicant: document.getElementById('applicantName').value,
            email: document.getElementById('email').value,
            purpose: document.getElementById('purpose').value,
            totalRent: document.getElementById('totalRentDisplay') ? document.getElementById('totalRentDisplay').textContent : '',
            status: '審核中',
            timestamp: new Date().toLocaleString('zh-TW')
        };

        // 將表單資料透過封裝函式連線寫入 Firebase (或本機備用庫)
        addBookingToDB(formData);

        alert('申請已成功提交！將由 Email 通知您後續審核結果。');
        bookingForm.reset();
        steps[1].classList.remove('active');
        steps[0].classList.add('active');
        window.location.hash = 'schedule';
    });

    // 7. Scroll Reveal 動畫
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('visible');
            }
        });
    }, { threshold: 0.1 });

    sections.forEach(section => observer.observe(section));

    // 8. 自定義日曆組件邏輯
    function initCustomCalendar() {
        const picker = document.getElementById('calendarPicker');
        const daysContainer = document.getElementById('calendarDays');
        const monthYearLabel = document.getElementById('calendarMonthYear');
        const inputs = [document.getElementById('startDate'), document.getElementById('endDate')];
        let currentActiveInput = null;
        let displayedDate = new Date();

        function renderCalendar(date) {
            daysContainer.innerHTML = '';
            const year = date.getFullYear();
            const month = date.getMonth();
            monthYearLabel.textContent = `${year}年 ${month + 1}月`;

            const firstDay = new Date(year, month, 1).getDay();
            const daysInMonth = new Date(year, month + 1, 0).getDate();

            // 填充空白
            for (let i = 0; i < firstDay; i++) {
                const empty = document.createElement('div');
                empty.className = 'day empty';
                daysContainer.appendChild(empty);
            }

            // 填充日期
            for (let d = 1; d <= daysInMonth; d++) {
                const dayEl = document.createElement('div');
                dayEl.className = 'day';
                dayEl.textContent = d;

                const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
                if (currentActiveInput && currentActiveInput.value === dateStr) {
                    dayEl.classList.add('selected');
                }

                const todayStr = new Date().toISOString().split('T')[0];
                if (dateStr === todayStr) dayEl.classList.add('today');

                dayEl.addEventListener('click', () => {
                    if (currentActiveInput) {
                        currentActiveInput.value = dateStr;
                        picker.style.display = 'none';
                    }
                });

                daysContainer.appendChild(dayEl);
            }
        }

        inputs.forEach(input => {
            input.addEventListener('click', (e) => {
                currentActiveInput = input;
                const rect = input.getBoundingClientRect();
                picker.style.display = 'block';
                picker.style.top = `${window.scrollY + rect.bottom + 10}px`;
                picker.style.left = `${rect.left}px`;
                renderCalendar(displayedDate);
                e.stopPropagation();
            });
        });

        document.getElementById('prevMonth').addEventListener('click', (e) => {
            displayedDate.setMonth(displayedDate.getMonth() - 1);
            renderCalendar(displayedDate);
            e.stopPropagation();
        });

        document.getElementById('nextMonth').addEventListener('click', (e) => {
            displayedDate.setMonth(displayedDate.getMonth() + 1);
            renderCalendar(displayedDate);
            e.stopPropagation();
        });

        // 點擊外面關閉
        document.addEventListener('click', (e) => {
            if (!picker.contains(e.target) && !inputs.some(i => i.contains(e.target))) {
                picker.style.display = 'none';
            }
        });
    }

    // 9. 檔期查詢表格邏輯
    const scheduleVenueSelect = document.getElementById('scheduleVenue');
    const scheduleDateInput = document.getElementById('scheduleDate');
    const scheduleHeader = document.getElementById('scheduleHeader');
    const scheduleBody = document.getElementById('scheduleBody');

    if (scheduleDateInput) {
        scheduleDateInput.value = new Date().toISOString().split('T')[0];
    }

    window.renderSchedule = function () {
        if (!scheduleVenueSelect || !scheduleDateInput) return;
        const venueId = scheduleVenueSelect.value;
        const startDateStr = scheduleDateInput.value || new Date().toISOString().split('T')[0];
        const startDateObj = new Date(startDateStr);

        // 渲染表頭 (未來 7 天)
        let headerHtml = '<th>時段 \\ 日期</th>';
        const days = [];
        const dayNames = ['日', '一', '二', '三', '四', '五', '六'];

        for (let i = 0; i < 7; i++) {
            const d = new Date(startDateObj);
            d.setDate(startDateObj.getDate() + i);
            const dateStr = d.toISOString().split('T')[0];
            const displayDate = `${d.getMonth() + 1}/${d.getDate()} (${dayNames[d.getDay()]})`;
            headerHtml += `<th>${displayDate}</th>`;
            days.push(dateStr);
        }
        scheduleHeader.innerHTML = headerHtml;

        const timeSlots = [
            { id: '早', label: '早上 (09:00-13:00)' },
            { id: '午', label: '下午 (14:00-18:00)' },
            { id: '晚', label: '晚上 (19:00-23:00)' }
        ];

        let bodyHtml = '';
        timeSlots.forEach(slot => {
            let rowHtml = `<tr><td style="font-weight: 500; color: var(--text-main);">${slot.label}</td>`;

            days.forEach(dayStr => {
                // 檢查是否已被成功預約或審核中
                let cellStatus = 'available';

                const overlappingBookings = bookings.filter(b => {
                    return b.venue === venueId &&
                        (dayStr >= b.startDate && dayStr <= b.endDate) &&
                        b.slots.includes(slot.id);
                });

                if (overlappingBookings.some(b => b.status === '預約成功')) {
                    cellStatus = 'booked';
                } else if (overlappingBookings.some(b => b.status === '審核中')) {
                    cellStatus = 'pending';
                }

                if (cellStatus === 'booked') {
                    rowHtml += `<td class="status-booked"><span class="status-icon">✕</span>已被租借</td>`;
                } else if (cellStatus === 'pending') {
                    rowHtml += `<td class="status-pending-cell"><span class="status-icon">⚠</span>審核中</td>`;
                } else {
                    rowHtml += `<td class="status-available"><span class="status-icon">○</span>可預約</td>`;
                }
            });

            rowHtml += `</tr>`;
            bodyHtml += rowHtml;
        });

        scheduleBody.innerHTML = bodyHtml;
    };

    scheduleVenueSelect.addEventListener('change', window.renderSchedule);
    scheduleDateInput.addEventListener('change', window.renderSchedule);

    // 執行
    renderVenues();
    window.renderSchedule();
    initCustomCalendar();

    // --- 管理員登入與後台邏輯 ---
    const loginBtn = document.getElementById('loginBtn');
    const logoutBtn = document.getElementById('logoutBtn');
    const adminSystemBtn = document.getElementById('adminSystemBtn');
    const loginModal = document.getElementById('loginModal');
    const closeModal = document.querySelector('.close-modal');
    const adminLoginSubmit = document.getElementById('adminLoginSubmit');

    const heroSection = document.getElementById('home');
    const venuesSection = document.getElementById('venues');
    const bookingSection = document.getElementById('booking');
    const adminPanel = document.getElementById('adminPanel');
    const adminList = document.getElementById('adminList');

    let isAdminLoggedIn = false;

    loginBtn.addEventListener('click', () => {
        loginModal.style.display = 'block';
    });

    closeModal.addEventListener('click', () => {
        loginModal.style.display = 'none';
        document.getElementById('adminUsername').value = '';
        document.getElementById('adminPassword').value = '';
    });

    window.addEventListener('click', (e) => {
        if (e.target === loginModal) {
            closeModal.click();
        }
    });

    adminLoginSubmit.addEventListener('click', () => {
        const user = document.getElementById('adminUsername').value.trim();
        const pass = document.getElementById('adminPassword').value.trim();

        if (user === 'admin' && pass === 'admin@123') {
            isAdminLoggedIn = true;
            alert('登入成功，切換至後台模式。');
            loginModal.style.display = 'none';
            document.getElementById('adminUsername').value = '';
            document.getElementById('adminPassword').value = '';
            setAdminView();
        } else {
            alert('帳號或密碼錯誤！');
        }
    });

    // 支援按下 Enter 鍵進行登入
    document.getElementById('adminPassword').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            adminLoginSubmit.click();
        }
    });

    logoutBtn.addEventListener('click', () => {
        isAdminLoggedIn = false;
        alert('已登出管理者帳號。');
        setFrontendView();
        window.location.hash = 'home';
    });

    function setAdminView() {
        heroSection.style.display = 'none';
        venuesSection.style.display = 'none';
        if (scheduleSection) scheduleSection.style.display = 'none';
        bookingSection.style.display = 'none';
        adminPanel.style.display = 'block';

        loginBtn.style.display = 'none';
        if (adminSystemBtn) adminSystemBtn.style.display = 'none';
        logoutBtn.style.display = 'inline-block';

        renderAdminList();
        adminPanel.classList.add('visible');
        window.location.hash = 'adminPanel';
    }

    function setFrontendView() {
        heroSection.style.display = 'flex';
        venuesSection.style.display = 'block';
        if (scheduleSection) scheduleSection.style.display = 'block';
        bookingSection.style.display = 'block';
        adminPanel.style.display = 'none';

        if (isAdminLoggedIn) {
            loginBtn.style.display = 'none';
            if (adminSystemBtn) adminSystemBtn.style.display = 'inline-block';
            logoutBtn.style.display = 'inline-block';
        } else {
            loginBtn.style.display = 'inline-block';
            if (adminSystemBtn) adminSystemBtn.style.display = 'none';
            logoutBtn.style.display = 'none';
        }
    }

    if (adminSystemBtn) {
        adminSystemBtn.addEventListener('click', setAdminView);
    }

    // 攔截導覽列點擊，確保在有權限時可以直接回到前台
    document.querySelectorAll('.nav-links a').forEach(link => {
        link.addEventListener('click', () => {
            if (isAdminLoggedIn && adminPanel.style.display === 'block') {
                setFrontendView();
            }
        });
    });

    window.renderAdminList = function () {
        if (bookings.length === 0) {
            adminList.innerHTML = '<div class="empty-state"><p>目前無待審核申請</p></div>';
            return;
        }

        adminList.innerHTML = bookings.map(b => {
            const venueName = venues.find(v => v.id === b.venue)?.name || '未知場地';
            const dateDisplay = b.startDate === b.endDate ? b.startDate : `${b.startDate} 至 ${b.endDate}`;
            const slotDisplay = typeof b.slots === 'string' ? b.slots : (b.slots && b.slots.length > 0 ? b.slots.join('、') : '');

            let actionHtml = '';
            if (b.status === '審核中') {
                actionHtml = `
                    <div class="admin-actions">
                        <button class="btn-success" onclick="approveApplication('${b.id}')">核准申請</button>
                        <button class="btn-danger" onclick="rejectApplication('${b.id}')">退回申請</button>
                    </div>
                `;
            } else if (b.status === '預約成功') {
                actionHtml = `
                    <div class="admin-actions">
                        <button class="btn-primary" style="background-color: var(--accent); color: black; font-weight: 500;" onclick="resendApprovalEmail('${b.id}')">補傳通知信</button>
                    </div>
                `;
            }

            return `
                <div class="admin-item">
                    <div>
                        <div style="font-size: 0.8rem; color: var(--accent); margin-bottom: 5px;">${b.id} | ${b.timestamp}</div>
                        <h4 style="margin-bottom: 5px;">${venueName} [${slotDisplay}]</h4>
                        <p style="font-size: 0.85rem; color: var(--text-muted);">
                            時段: ${dateDisplay} | 劇團: ${b.groupName} | 聯絡人: ${b.applicant} | Email: ${b.email}
                        </p>
                        <p style="font-size: 0.85rem; color: var(--text-main); margin-top: 5px;">目的: ${b.purpose}</p>
                    </div>
                    ${actionHtml}
                    ${b.status !== '審核中' ? `<div class="status-badge ${b.status === '預約成功' ? 'status-approved' : 'status-rejected'}">${b.status}</div>` : ''}
                </div>
            `;
        }).join('');
    };

    function sendEmail(item, isResend = false) {
        // 如果有填寫金鑰，就進行真實的 API 寄信
        if (typeof emailjs !== 'undefined' && EMAILJS_PUBLIC_KEY && EMAILJS_PUBLIC_KEY.length > 5) {
            const venueName = venues.find(v => v.id === item.venue)?.name || item.venue;
            const templateParams = {
                to_email: item.email,
                applicant_name: item.applicant,
                group_name: item.groupName,
                booking_id: item.id,
                venue_name: venueName,
                booking_date: item.startDate === item.endDate ? item.startDate : `${item.startDate} ~ ${item.endDate}`,
                booking_slots: item.slots.join('、'),
                total_rent: item.totalRent || '無'
            };

            emailjs.send(EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_ID, templateParams)
                .then(() => {
                    const prefix = isResend ? '【補寄發信成功】' : '【真實發信成功】';
                    alert(`${prefix}核准通知已送至申請人信箱：${item.email}`);
                })
                .catch((err) => {
                    console.error('EmailJS 寄信失敗:', err);
                    alert(`【發信失敗】\n狀態碼：${err.status || '未知'}\n詳細錯誤：${err.text || err.message || JSON.stringify(err)}\n\n(這通常代表金鑰的字母被截斷了，或是瀏覽器阻攔了請求，請參考此訊息)`);
                });
        } else {
            // 原有的模擬發信
            const prefix = isResend ? '【模擬重新寄出】' : '【系統模擬發信】';
            alert(`${prefix}已成功寄送核准通知至聯絡人 ${item.applicant} 的信箱：${item.email}\n(註：您尚未填寫 EmailJS 金鑰，目前為模擬通知)`);
        }
    }

    window.resendApprovalEmail = function (id) {
        const item = bookings.find(b => b.id === id);
        if (item) {
            sendEmail(item, true);
        }
    };

    window.approveApplication = function (id) {
        const item = bookings.find(b => b.id === id);
        if (item) {
            // 本地先修改狀態以供 EmailJS 抓取
            item.status = '預約成功'; 
            
            // 同步狀態至雲端資料庫
            updateBookingStatusToDB(id, '預約成功');

            // 寄送通知信
            sendEmail(item, false);
        }
    };

    window.rejectApplication = function (id) {
        const item = bookings.find(b => b.id === id);
        if (item) {
            updateBookingStatusToDB(id, '預約退回');
            alert(`【系統通知】已將退回訊息寄送至：${item.email}`);
        }
    };

    // CSV 報表導出功能
    const exportCsvBtn = document.getElementById('exportCsvBtn');
    if (exportCsvBtn) {
        exportCsvBtn.addEventListener('click', () => {
            const successfulBookings = bookings.filter(b => b.status === '預約成功');
            if (successfulBookings.length === 0) {
                alert('目前沒有「預約成功」的資料可供匯出報表！');
                return;
            }

            const headers = ['案號', '申請時間', '狀態', '場地', '開始日期', '結束日期', '時段', '劇團名稱', '聯絡人', '電子郵件', '排練目的', '總計租金'];

            const rows = successfulBookings.map(b => {
                const venueName = venues.find(v => v.id === b.venue)?.name || b.venue;
                const slotStr = typeof b.slots === 'string' ? b.slots : (b.slots ? b.slots.join(';') : '');
                const rentVal = b.totalRent || '';

                return [
                    b.id, b.timestamp, b.status, venueName, b.startDate, b.endDate, slotStr,
                    b.groupName, b.applicant, b.email, b.purpose, rentVal
                ].map(val => `"${String(val).replace(/"/g, '""')}"`).join(',');
            });

            // 加入 BOM (\uFEFF) 讓 Excel 能正確識別 UTF-8 中文
            const csvContent = '\uFEFF' + headers.join(',') + '\n' + rows.join('\n');
            const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
            const url = URL.createObjectURL(blob);

            const link = document.createElement('a');
            const d = new Date();
            const fileName = `出租報表_${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}.csv`;

            link.setAttribute('href', url);
            link.setAttribute('download', fileName);
            link.style.visibility = 'hidden';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        });
    }
});
