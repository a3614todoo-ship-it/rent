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
    const EMAILJS_TEMPLATE_ID = 'template_rle8t5f'; // 此為「核准/成功」的 Template ID
    const EMAILJS_REJECT_TEMPLATE_ID = 'template_uz1rccd'; // 此為「拒絕退回」專用 Template ID

    // 初始化 EmailJS SDK
    if (typeof emailjs !== 'undefined' && EMAILJS_PUBLIC_KEY && EMAILJS_PUBLIC_KEY.length > 5) {
        emailjs.init(EMAILJS_PUBLIC_KEY);
    }

    // 1. 場地資源 (全域動態變數)
    let venues = [];

    // 預設資料 (若 Firebase 首次連線內部沒資料時，寫入這些當作種子)
    const defaultVenues = [
        {
            id: 'dance',
            name: '雲水排練場',
            type: '武戲與身段排練室',
            capacity: '20-30人',
            pricing: { morning: 3200, afternoon: 3200, evening: 4000 },
            timings: { morning: '09:00-13:00', afternoon: '14:00-18:00', evening: '19:00-23:00' },
            desc: '專為武戲與身段排練設計，高度達4米，配有專業彈性木地板與全牆面大鏡，適合各類甩髮、水袖及翻跌動作的日常排演。',
            tags: ['挑高空間', '專業彈性木地板', '全牆大鏡面'],
            image: 'assets/dance_studio.png',
            isActive: true,
            order: 1
        },
        {
            id: 'music',
            name: '絲竹雅音室',
            type: '文場與唱腔排練室',
            capacity: '5-10人',
            pricing: { morning: 2400, afternoon: 2400, evening: 3000 },
            timings: { morning: '09:00-13:00', afternoon: '14:00-18:00', evening: '19:00-23:00' },
            desc: '本空間提供絕佳的隔音設計與吸音材質，專為文場伴奏、京胡、二胡等傳統戲曲器樂及演員吊嗓唱腔排練打造。',
            tags: ['文場器樂隔音', '戲曲排練專用桌椅', '錄製設備'],
            image: 'assets/music_room.png',
            isActive: true,
            order: 2
        },
        {
            id: 'theater',
            name: '梨園實驗劇場',
            type: '總彩排黑盒劇場',
            capacity: '50-80人',
            pricing: { morning: 6000, afternoon: 6000, evening: 7500 },
            timings: { morning: '09:00-13:00', afternoon: '14:00-18:00', evening: '19:00-23:00' },
            desc: '可容納多名演員進行全劇走位與總彩排。配備頂級舞臺燈光及多視角側幕，並附設階梯式觀眾席供導演與劇團內部觀摩。',
            tags: ['專業舞台燈光', '多角度側幕', '階梯式觀眾席'],
            image: 'assets/black_box.png',
            isActive: true,
            order: 3
        }
    ];

    // 1.1 器材資源 (新增器材清單)
    let equipment = [];
    const defaultEquipment = [
        { name: '京胡 (專業級)', price: 500, totalQty: 5, description: '專業演出的京胡，附琴絃支撐。', image: 'assets/jinghu.png', isActive: true, order: 1 },
        { name: '單皮鼓與板 (組)', price: 400, totalQty: 3, description: '傳統武場打擊樂器，含鼓架。', image: 'assets/bangu_clapper.png', isActive: true, order: 2 },
        { name: '一桌二椅 (組)', price: 800, totalQty: 2, description: '傳統梨園舞台調度必備桌椅。', image: 'assets/table_chairs.png', isActive: true, order: 3 },
        { name: '無線麥克風 (一組兩入)', price: 600, totalQty: 4, description: '高品質U頻無線系統，附備用電池。', image: 'assets/wireless_mics.png', isActive: true, order: 4 },
        { name: '移動式大鏡子', price: 200, totalQty: 6, description: '全身式帶輪鏡子，適合身段與走位校正。', image: 'assets/moveable_mirror.png', isActive: true, order: 5 }
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
    let events = [];
    let eventRegistrations = [];

    // 【容錯優化】將初始化包裹在 try-catch 中，避免本地檔案瀏覽時因安全限制導致腳本崩潰
    try {
        if (typeof firebase !== 'undefined' && firebaseConfig.apiKey && !firebaseConfig.apiKey.includes("YOUR")) {
            firebase.initializeApp(firebaseConfig);
            db = firebase.firestore();

            // 場地動態監聽
            db.collection("venues").orderBy("order", "asc").onSnapshot((snapshot) => {
                venues = [];
                snapshot.forEach((doc) => {
                    venues.push({ dbId: doc.id, ...doc.data() });
                });

                if (venues.length === 0) {
                    // 若資料庫為空，僅載入至記憶體變數，取消自動 add() 避免 Github Pages 重新啟動時因為 snapshot 空窗期造成重複
                    venues = [...defaultVenues];
                }
                
                if (typeof window.renderVenues === 'function') window.renderVenues();
                if (typeof window.renderPricingTables === 'function') window.renderPricingTables();
                const adminPanel = document.getElementById('adminPanel');
                if (adminPanel && adminPanel.style.display === 'block') {
                    if (window.renderAdminVenueList) window.renderAdminVenueList();
                }
            }, (err) => console.log("Firebase Venues Offline:", err));

            // 【新增】器材動態監聽
            db.collection("equipment").orderBy("order", "asc").onSnapshot((snapshot) => {
                equipment = [];
                snapshot.forEach((doc) => {
                    equipment.push({ dbId: doc.id, ...doc.data() });
                });

                if (equipment.length === 0) {
                    // 同理，僅賦值以供渲染
                    equipment = [...defaultEquipment];
                }
                
                if (typeof window.renderBookingEquipment === 'function') window.renderBookingEquipment();
                if (typeof window.renderPricingTables === 'function') window.renderPricingTables();
                const adminPanel = document.getElementById('adminPanel');
                if (adminPanel && adminPanel.style.display === 'block') {
                    if (window.renderAdminEquipmentList) window.renderAdminEquipmentList();
                }
            }, (err) => console.log("Firebase Equipment Offline:", err));

            // 訂單監聽
            db.collection("bookings").orderBy("timestamp", "desc").onSnapshot((snapshot) => {
                bookings = [];
                snapshot.forEach((doc) => {
                    bookings.push({ id: doc.id, ...doc.data() });
                });
                if (window.renderSchedule) window.renderSchedule();
                const adminPanel = document.getElementById('adminPanel');
                if (adminPanel && adminPanel.style.display === 'block') {
                    if (window.renderAdminList) window.renderAdminList();
                }
            }, (error) => console.log("Firebase Bookings Offline:", error));

            // 【新增】活動監聽
            db.collection("events").orderBy("date", "asc").onSnapshot((snapshot) => {
                events = [];
                snapshot.forEach((doc) => {
                    events.push({ id: doc.id, ...doc.data() });
                });
                
                // 如果 Firebase 中還沒有活動，自動產出一筆測試活動供預覽
                if (events.length === 0) {
                    events = [{
                        id: 'EV-TEST-01',
                        name: '【大師開講】京劇武行身段解析與排演應用',
                        date: '2026-05-20',
                        time: '14:00-16:30',
                        location: '梨園實驗劇場',
                        capacity: 50,
                        image: 'assets/event_lecture_test.png',
                        description: '邀請資深京劇大師親自示範，帶領新生代演員從基礎的手眼身法步，進階至實際舞臺調度上的應用轉換。課程將包含實地體驗與QA問答環節，名額有限，歡迎熱愛傳統戲曲的朋友踴躍報名！',
                        isActive: true
                    }];
                }

                if (window.renderEventPreview) window.renderEventPreview();
                const adminPanel = document.getElementById('adminPanel');
                if (adminPanel && adminPanel.style.display === 'block') {
                    if (window.renderAdminEventsList) window.renderAdminEventsList();
                    if (window.updateCheckinSelect) window.updateCheckinSelect();
                }
            }, (error) => console.log("Firebase Events Offline:", error));

            // 【新增】活動報名監聽
            db.collection("event_registrations").orderBy("timestamp", "desc").onSnapshot((snapshot) => {
                eventRegistrations = [];
                snapshot.forEach((doc) => {
                    eventRegistrations.push({ id: doc.id, ...doc.data() });
                });
                const adminPanel = document.getElementById('adminPanel');
                if (adminPanel && adminPanel.style.display === 'block') {
                    if (window.renderCheckinList) window.renderCheckinList();
                }
            }, (error) => console.log("Firebase Event Reg Offline:", error));

            // 【新增】系統設定監聽 (用於預設主題等)
            db.collection("settings").doc("system").onSnapshot((doc) => {
                if (doc.exists) {
                    const sysData = doc.data();
                    
                    // 動態載入背景圖片設定
                    if (sysData.heroImageDark) {
                        document.documentElement.style.setProperty('--hero-bg-image-dark', `url('${sysData.heroImageDark}')`);
                        const el = document.getElementById('heroImageDark');
                        if (el) el.value = sysData.heroImageDark;
                    }
                    if (sysData.heroImageLight) {
                        document.documentElement.style.setProperty('--hero-bg-image-light', `url('${sysData.heroImageLight}')`);
                        const el = document.getElementById('heroImageLight');
                        if (el) el.value = sysData.heroImageLight;
                    }

                    // 動態載入聯絡資訊
                    if (sysData.contactAddress) {
                        const el1 = document.getElementById('displayContactAddress');
                        if (el1) el1.innerText = sysData.contactAddress;
                        const el2 = document.getElementById('settingContactAddress');
                        if (el2) el2.value = sysData.contactAddress;
                    }
                    if (sysData.contactPhone) {
                        const el1 = document.getElementById('displayContactPhone');
                        if (el1) el1.innerText = sysData.contactPhone;
                        const el2 = document.getElementById('settingContactPhone');
                        if (el2) el2.value = sysData.contactPhone;
                    }

                    // 動態載入地圖與交通指南
                    if (sysData.contactMap) {
                        const el1 = document.getElementById('displayContactMap');
                        const container = document.getElementById('contactMapContainer');
                        if (el1 && container) {
                            el1.src = sysData.contactMap;
                            container.style.display = 'block';
                        }
                        const el2 = document.getElementById('settingContactMap');
                        if (el2) el2.value = sysData.contactMap;
                    } else {
                        const container = document.getElementById('contactMapContainer');
                        if (container) container.style.display = 'none';
                    }

                    if (sysData.contactGuide) {
                        const el1 = document.getElementById('displayContactGuide');
                        const container = document.getElementById('contactGuideContainer');
                        if (el1 && container) {
                            el1.innerText = sysData.contactGuide;
                            container.style.display = 'block';
                        }
                        const el2 = document.getElementById('settingContactGuide');
                        if (el2) el2.value = sysData.contactGuide;
                    } else {
                        const container = document.getElementById('contactGuideContainer');
                        if (container) container.style.display = 'none';
                    }

                    // 如果用戶本地沒有手動切換過主題，則跟隨系統預設
                    if (!localStorage.getItem('userTheme')) {
                        applyTheme(sysData.defaultTheme || 'dark');
                    }
                    // 更新後台設定面板的選中狀態
                    const radios = document.getElementsByName('defaultTheme');
                    radios.forEach(r => {
                        if (r.value === (sysData.defaultTheme || 'dark')) r.checked = true;
                    });
                }
            });
        } else {
            throw new Error("Firebase not identified");
        }
    } catch (e) {
        console.warn("系統正以純本地模式 (LocalStorage) 運行:", e.message);
        // 備用方案：繼續使用 LocalStorage
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
            purpose: '本地模式範例',
            status: '預約成功',
            timestamp: new Date().toLocaleString('zh-TW'),
            totalRent: 'NT$ 3,200'
        }];
        const storedData = localStorage.getItem(STORAGE_KEY);
        bookings = storedData ? JSON.parse(storedData) : defaultBookings;
        venues = [...defaultVenues];
        equipment = [...defaultEquipment]; // 本地模式也載入器材
        
        // 賦予本地測試活動
        events = [{
            id: 'EV-TEST-01',
            name: '【大師開講】京劇武行身段解析與排演應用',
            date: '2026-05-20',
            time: '14:00-16:30',
            location: '梨園實驗劇場',
            capacity: 50,
            image: 'assets/event_lecture_test.png',
            description: '邀請資深京劇大師親自示範，帶領新生代演員從基礎的手眼身法步，進階至實際舞臺調度上的應用轉換。課程將包含實地體驗與 QA 問答環節，名額有限，歡迎熱愛傳統戲曲的朋友踴躍報名！',
            isActive: true
        }];

        window.saveBookingsLocal = function () {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(bookings));
        };
    }

    // ==========================================
    // 2. 主題管理與系統配置 (Theme Management)
    // ==========================================
    const themeToggle = document.getElementById('themeToggle');
    function applyTheme(theme) {
        document.documentElement.setAttribute('data-theme', theme);
        if (themeToggle) {
            themeToggle.innerText = theme === 'light' ? '☀️' : '🌙';
        }
    }

    // 初始載入主題
    const savedTheme = localStorage.getItem('userTheme');
    if (savedTheme) {
        applyTheme(savedTheme);
    } // 如果無存檔，則由 Firebase settings snapshot 處理 (見上方)

    if (themeToggle) {
        themeToggle.addEventListener('click', () => {
            const currentTheme = document.documentElement.getAttribute('data-theme') || 'dark';
            const newTheme = currentTheme === 'light' ? 'dark' : 'light';
            applyTheme(newTheme);
            localStorage.setItem('userTheme', newTheme);
        });
    }

    // 後台儲存系統設定
    const saveSettingsBtn = document.getElementById('saveSettingsBtn');
    if (saveSettingsBtn) {
        saveSettingsBtn.addEventListener('click', () => {
            if (!db) {
                alert('離線模式無法儲存系統設定');
                return;
            }
            const selectedTheme = document.querySelector('input[name="defaultTheme"]:checked').value;
            const heroDark = document.getElementById('heroImageDark').value.trim() || 'assets/opera_hero_bg.png';
            const heroLight = document.getElementById('heroImageLight').value.trim() || 'assets/opera_hero_light.png';
            const contactAddr = document.getElementById('settingContactAddress') ? document.getElementById('settingContactAddress').value.trim() : '';
            const contactPh = document.getElementById('settingContactPhone') ? document.getElementById('settingContactPhone').value.trim() : '';
            const contactMap = document.getElementById('settingContactMap') ? document.getElementById('settingContactMap').value.trim() : '';
            const contactGuide = document.getElementById('settingContactGuide') ? document.getElementById('settingContactGuide').value.trim() : '';

            db.collection("settings").doc("system").set({
                defaultTheme: selectedTheme,
                heroImageDark: heroDark,
                heroImageLight: heroLight,
                contactAddress: contactAddr,
                contactPhone: contactPh,
                contactMap: contactMap,
                contactGuide: contactGuide,
                updatedAt: new Date().toLocaleString('zh-TW')
            }, { merge: true }).then(() => {
                // 儲存的同時直接渲染畫面
                document.documentElement.style.setProperty('--hero-bg-image-dark', `url('${heroDark}')`);
                document.documentElement.style.setProperty('--hero-bg-image-light', `url('${heroLight}')`);
                alert('系統配置已成功儲存至雲端並套用');
            }).catch(err => {
                console.error("儲存設定失敗:", err);
                alert('儲存失敗');
            });
        });
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

    // 租金計算輔助函式 (動態早午晚加總演算法 + 器材租金[支援數量])
    function calculateTotalRent(venueId, startDate, endDate, dailySlots, selectedEquipments = []) {
        const venue = venues.find(v => v.id === venueId);
        if (!venue) return 0;

        // 計算總場次數
        let totalSessionsCount = 0;
        let totalVenueRent = 0;

        for (const date in dailySlots) {
            const slots = dailySlots[date];
            totalSessionsCount += slots.length;

            if (venue.pricing) {
                slots.forEach(slot => {
                    if (slot.includes('早')) totalVenueRent += (venue.pricing.morning || 0);
                    else if (slot.includes('午')) totalVenueRent += (venue.pricing.afternoon || 0);
                    else if (slot.includes('晚')) totalVenueRent += (venue.pricing.evening || 0);
                });
            } else {
                const pricePerHour = parseInt((venue.price || '').replace(/[^0-9]/g, ''), 10) || 0;
                totalVenueRent += slots.length * 4 * pricePerHour;
            }
        }

        // 2. 計算器材租金 (按時段計費 × 數量)
        let totalEquipRent = 0;
        selectedEquipments.forEach(eq => {
            const item = equipment.find(e => e.dbId === eq.id);
            if (item && item.price) {
                totalEquipRent += (item.price * eq.qty * totalSessionsCount);
            }
        });

        return totalVenueRent + totalEquipRent;
    }

    // 輔助函式：取得兩日期間所有日期陣列
    function getDatesInRange(startDate, endDate) {
        const dates = [];
        let curr = new Date(startDate);
        const end = new Date(endDate);
        while (curr <= end) {
            dates.push(new Date(curr).toISOString().split('T')[0]);
            curr.setDate(curr.getDate() + 1);
        }
        return dates;
    }

    // 動態渲染逐日時段選擇矩陣
    window.renderDailySlotInputs = function () {
        const venueId = document.getElementById('venueSelect').value;
        const startDate = document.getElementById('startDate').value;
        const endDate = document.getElementById('endDate').value;
        const container = document.getElementById('dailySlotsGrid');
        const wrapper = document.getElementById('dailySlotsWrapper');

        if (!startDate || !endDate) {
            wrapper.style.display = 'none';
            return;
        }

        const start = new Date(startDate);
        const end = new Date(endDate);
        if (start > end) {
            wrapper.style.display = 'none';
            return;
        }

        wrapper.style.display = 'block';
        const dates = getDatesInRange(startDate, endDate);

        container.innerHTML = dates.map(date => {
            return `
            <div class="daily-slot-row" data-date="${date}">
                <div class="daily-slot-date">${date.substring(5)}</div>
                <div class="daily-slot-options">
                    ${['morning', 'afternoon', 'evening'].map(slotKey => {
                const currentVenue = venues.find(v => v.id === venueId);
                const timings = currentVenue?.timings || { morning: '09:00-13:00', afternoon: '14:00-18:00', evening: '19:00-23:00' };
                const labelMap = { 'morning': '早', 'afternoon': '午', 'evening': '晚' };
                const timeMap = { 'morning': timings.morning, 'afternoon': timings.afternoon, 'evening': timings.evening };

                // 檢查衝突
                const isOccupied = bookings.some(b =>
                    b.status === '預約成功' &&
                    b.venue === venueId &&
                    (
                        (b.dailySlots && b.dailySlots[date] && b.dailySlots[date].some(s => s.startsWith(labelMap[slotKey]))) ||
                        (!b.dailySlots && date >= b.startDate && date <= b.endDate && b.slots.some(s => s.startsWith(labelMap[slotKey])))
                    )
                );

                return `
                        <label class="slot-pill ${isOccupied ? 'disabled' : ''}">
                            <input type="checkbox" name="slots_${date}" value="${slotKey}" ${isOccupied ? 'disabled' : ''}>
                            <span>${labelMap[slotKey]} (${timeMap[slotKey]})</span>
                        </label>
                        `;
            }).join('')}
                </div>
            </div>
            `;
        }).join('');

        // 綁定事件
        container.querySelectorAll('input[type="checkbox"]').forEach(cb => {
            cb.addEventListener('change', (e) => {
                const pill = e.target.closest('.slot-pill');
                if (e.target.checked) pill.classList.add('selected');
                else pill.classList.remove('selected');
                updateTotalRentPreview();
            });
        });
    };

    // 3.0 渲染首頁總覽費用表
    window.renderPricingTables = function () {
        const venueTbody = document.getElementById('pricingVenueTbody');
        const equipTbody = document.getElementById('pricingEquipTbody');
        
        if (venueTbody) {
            const activeVenues = venues.filter(v => v.isActive !== false);
            venueTbody.innerHTML = activeVenues.map(v => {
                const tm = v.timings ? v.timings.morning : '09:00-13:00';
                const ta = v.timings ? v.timings.afternoon : '14:00-18:00';
                const te = v.timings ? v.timings.evening : '19:00-23:00';
                return `
                <tr>
                    <td style="font-weight: bold; color: var(--text-main); white-space: nowrap;">${v.name}</td>
                    <td>${v.type} <br><span style="font-size:0.85rem; color:var(--text-muted);">${v.capacity}</span></td>
                    <td style="white-space: nowrap;"><span style="display:block; color:var(--accent); font-weight:bold;">$${v.pricing?.morning.toLocaleString() || 'N/A'}</span><span style="font-size:0.8rem; color:var(--text-muted);">${tm}</span></td>
                    <td style="white-space: nowrap;"><span style="display:block; color:var(--accent); font-weight:bold;">$${v.pricing?.afternoon.toLocaleString() || 'N/A'}</span><span style="font-size:0.8rem; color:var(--text-muted);">${ta}</span></td>
                    <td style="white-space: nowrap;"><span style="display:block; color:var(--accent); font-weight:bold;">$${v.pricing?.evening.toLocaleString() || 'N/A'}</span><span style="font-size:0.8rem; color:var(--text-muted);">${te}</span></td>
                </tr>
                `;
            }).join('');
        }

        if (equipTbody) {
            const activeEquip = equipment.filter(e => e.isActive !== false);
            equipTbody.innerHTML = activeEquip.map(e => `
                <tr>
                    <td style="font-weight: bold; color: var(--text-main); white-space: nowrap;">${e.name}</td>
                    <td style="color: var(--text-muted); font-size: 0.95rem;">${e.description}</td>
                    <td style="color: var(--accent); font-weight: bold; white-space: nowrap;">$${e.price.toLocaleString()}</td>
                    <td style="white-space: nowrap;">${e.totalQty} 組</td>
                </tr>
            `).join('');
        }
    };

    // 3. 初始化場地展示
    window.renderVenues = function () {
        const activeVenues = venues.filter(v => v.isActive !== false);
        const venueGrid = document.getElementById('venueGrid');
        if (!venueGrid) return;

        venueGrid.innerHTML = activeVenues.map(venue => {
            const displayPrice = venue.pricing ? `$${venue.pricing.morning} 起 / 時段` : venue.price;
            return `
            <div class="venue-card">
                <div class="venue-img" style="background-image: url('${venue.image}'); background-size: cover; background-position: center; height: 260px;"></div>
                <div class="venue-info">
                    <div class="venue-tags">
                        ${(venue.tags || []).map(tag => `<span class="tag">${tag}</span>`).join('')}
                    </div>
                    <h3>${venue.name}</h3>
                    <p style="color: var(--text-muted); font-size: 0.9rem; margin-bottom: 15px;">
                        適合：${venue.type} | 容量：${venue.capacity}
                    </p>
                    <div style="display: flex; justify-content: space-between; align-items: center; border-top: 1px solid var(--border); padding-top: 15px; margin-top: 15px;">
                        <span style="font-weight: 700; color: var(--accent);">${displayPrice}</span>
                        <button class="btn-secondary" onclick="openVenueModal('${venue.id}')" style="padding: 8px 16px;">瞭解詳情</button>
                    </div>
                </div>
            </div>
            `;
        }).join('');

        // 即時刷新表單的 Select選單
        const venueSelect = document.getElementById('venueSelect');
        if (venueSelect) {
            const currentSelected = venueSelect.value;
            venueSelect.innerHTML = '<option value="" disabled selected>請選擇您欲租借的排練場地</option>' +
                activeVenues.map(v => `<option value="${v.id}">${v.name} (${v.capacity})</option>`).join('');
            if (activeVenues.some(v => v.id === currentSelected)) venueSelect.value = currentSelected;
        }

        // 即時刷新檔期查詢的 Select選單
        const scheduleVenue = document.getElementById('scheduleVenue');
        if (scheduleVenue) {
            const curSchedSelected = scheduleVenue.value;
            scheduleVenue.innerHTML = activeVenues.map(v => `<option value="${v.id}">${v.name}</option>`).join('');
            if (activeVenues.some(v => v.id === curSchedSelected)) {
                scheduleVenue.value = curSchedSelected;
            } else if (activeVenues.length > 0) {
                scheduleVenue.value = activeVenues[0].id;
            }
            scheduleVenue.dispatchEvent(new Event('change'));
        }
    };

    // 3.1 渲染前台「預約表單」的器材選項 (圖文與數量)
    function getEquipImage(e) {
        if (e.image) return e.image;
        if (e.name.includes('譜架')) return 'assets/music_stand.png';
        if (e.name.includes('譜燈')) return 'assets/stand_light.png';
        if (e.name.includes('白色長桌') || e.name.includes('長桌')) return 'assets/white_table.png';

        const defaultMatch = defaultEquipment.find(d => d.name === e.name);
        return defaultMatch ? defaultMatch.image : 'https://images.unsplash.com/photo-1510915361894-db8b60106cb1?auto=format&fit=crop&w=200&q=80';
    }

    // --- [核心演算法] 計算指定器材在特定日期時段組合中的最大併發借用量，從而得出剩餘可用庫存 ---
    function getAvailableEquipQty(equip, dailySlots) {
        if (!dailySlots || Object.keys(dailySlots).length === 0) return equip.totalQty;

        let maxBorrowedAtAnySlot = 0;

        // 我們必須遍歷使用者選中的「每一個」日期的「每一格」時段
        for (const date in dailySlots) {
            const slots = dailySlots[date];

            slots.forEach(slotName => {
                let currentSlotBorrowed = 0;

                // 檢查所有已成功的預約單
                bookings.forEach(b => {
                    if (b.status !== '預約成功' && b.status !== '審核中') return;

                    // 檢查該筆預約單是否包含這一格時段
                    let bHasThisSlot = false;
                    if (b.dailySlots && b.dailySlots[date] && b.dailySlots[date].some(s => s.startsWith(slotName))) {
                        bHasThisSlot = true;
                    } else if (!b.dailySlots && date >= b.startDate && date <= b.endDate && b.slots.some(s => s.startsWith(slotName))) {
                        bHasThisSlot = true;
                    }

                    if (bHasThisSlot) {
                        // 找該訂單內是否有這項器材
                        const used = (b.equipment && Array.isArray(b.equipment))
                            ? b.equipment.find(eq => eq.dbId === equip.dbId || eq.name === equip.name)
                            : null;
                        if (used) currentSlotBorrowed += (parseInt(used.qty) || 0);
                    }
                });

                if (currentSlotBorrowed > maxBorrowedAtAnySlot) {
                    maxBorrowedAtAnySlot = currentSlotBorrowed;
                }
            });
        }

        return Math.max(0, equip.totalQty - maxBorrowedAtAnySlot);
    }

    window.renderBookingEquipment = function () {
        const container = document.getElementById('bookingEquipmentContainer');
        if (!container) return;

        const activeEquip = equipment.filter(e => e.isActive !== false);
        if (activeEquip.length === 0) {
            container.innerHTML = '<p style="color: var(--text-muted); font-size: 0.9rem;">目前無可用附加器材。</p>';
            return;
        }

        // 動態取得當下所選日期與時段，以此扣算有效庫存
        const dailySlots = {};
        document.querySelectorAll('.daily-slot-row').forEach(row => {
            const date = row.getAttribute('data-date');
            const selected = Array.from(row.querySelectorAll('input:checked')).map(el => el.parentElement.querySelector('span').textContent.split(' ')[0]);
            if (selected.length > 0) dailySlots[date] = selected;
        });

        container.innerHTML = activeEquip.map(e => {
            const availQty = getAvailableEquipQty(e, dailySlots);
            const imgUrl = getEquipImage(e);

            return `
            <div class="equip-item-advanced">
                <div class="equip-img" style="background-image: url('${imgUrl}');"></div>
                <div class="equip-content">
                    <span class="equip-name">${e.name}</span>
                    <span class="equip-desc">${e.description || '無詳細說明'}</span>
                    <span class="equip-price">NT$ ${e.price.toLocaleString()} / 時段</span>
                </div>
                <div class="equip-actions">
                    <label style="font-size: 0.85rem; color: var(--text-muted); display: block; margin-bottom: 5px;">
                        本時段可借數量：<span style="color:${availQty > 0 ? 'var(--accent)' : '#ef4444'}; font-weight:bold;">${availQty}</span> / 總量(${e.totalQty})
                    </label>
                    <input type="number" class="equip-qty-input" data-id="${e.dbId}" min="0" max="${availQty}" value="0" ${availQty === 0 ? 'disabled' : ''}>
                </div>
            </div>
            `;
        }).join('');

        // 監聽數量變化事件，即時更新總金額
        container.querySelectorAll('.equip-qty-input').forEach(input => {
            input.addEventListener('change', () => {
                // 防呆：不可小於0，不可大於總數
                let val = parseInt(input.value, 10) || 0;
                const max = parseInt(input.getAttribute('max'), 10) || 0;
                if (val < 0) val = 0;
                if (val > max) val = max;
                input.value = val;

                const nextBtn = document.querySelector('.next-step');
                if (nextBtn) {
                    updateTotalRentPreview();
                }
            });
        });
    };

    // 輔助函式：從表單當前內容獲取參數並更新預覽租金
    function updateTotalRentPreview() {
        const venueVal = document.getElementById('venueSelect').value;
        const startDate = document.getElementById('startDate').value;
        const endDate = document.getElementById('endDate').value;

        if (!venueVal || !startDate || !endDate) return;

        const dailySlots = {};
        let hasAnySlot = false;
        document.querySelectorAll('.daily-slot-row').forEach(row => {
            const date = row.getAttribute('data-date');
            const selected = Array.from(row.querySelectorAll('input:checked')).map(el => el.parentElement.querySelector('span').textContent.split(' ')[0]);
            if (selected.length > 0) {
                dailySlots[date] = selected;
                hasAnySlot = true;
            }
        });

        if (!hasAnySlot) {
            const totalRentDisplay = document.getElementById('totalRentDisplay');
            if (totalRentDisplay) totalRentDisplay.textContent = `NT$ 0`;
            return;
        }

        // 抓取數量大於 0 的器材
        const selectedEquipments = [];
        document.querySelectorAll('.equip-qty-input').forEach(input => {
            const qty = parseInt(input.value, 10);
            if (qty > 0) {
                selectedEquipments.push({ id: input.getAttribute('data-id'), qty: qty });
            }
        });

        const totalRent = calculateTotalRent(venueVal, startDate, endDate, dailySlots, selectedEquipments);
        const totalRentDisplay = document.getElementById('totalRentDisplay');
        if (totalRentDisplay) {
            totalRentDisplay.textContent = `NT$ ${totalRent.toLocaleString()}`;
        }
    }

    // 開啟「場地詳情 Modal」公用函式
    window.openVenueModal = function (id) {
        const v = venues.find(x => x.id === id);
        if (!v) return;
        document.getElementById('venueModalName').textContent = v.name;
        document.getElementById('venueModalTags').textContent = (v.tags || []).join(' | ');
        document.getElementById('venueModalDesc').textContent = v.desc || '暫無說明。';
        document.getElementById('venueModalImage').style.backgroundImage = `url('${v.image}')`;

        document.getElementById('venueModalPriceM').textContent = v.pricing ? v.pricing.morning.toLocaleString() : 'N/A';
        document.getElementById('venueModalPriceA').textContent = v.pricing ? v.pricing.afternoon.toLocaleString() : 'N/A';
        document.getElementById('venueModalPriceE').textContent = v.pricing ? v.pricing.evening.toLocaleString() : 'N/A';

        document.getElementById('venueModalTimeM').textContent = `早時段 (${v.timings ? v.timings.morning : '09:00-13:00'})`;
        document.getElementById('venueModalTimeA').textContent = `午時段 (${v.timings ? v.timings.afternoon : '14:00-18:00'})`;
        document.getElementById('venueModalTimeE').textContent = `晚時段 (${v.timings ? v.timings.evening : '19:00-23:00'})`;

        document.getElementById('bookVenueNowBtn').onclick = () => {
            document.getElementById('venueDetailsModal').classList.remove('show');
            setTimeout(() => {
                document.getElementById('venueDetailsModal').style.display = 'none';
                document.getElementById('venueSelect').value = v.id;
                window.location.hash = 'booking';
            }, 300);
        };

        const modal = document.getElementById('venueDetailsModal');
        modal.style.display = 'flex';
        modal.offsetHeight;
        modal.classList.add('show');
    };

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

        const dailySlots = {};
        let hasAnySlot = false;
        document.querySelectorAll('.daily-slot-row').forEach(row => {
            const date = row.getAttribute('data-date');
            const selected = Array.from(row.querySelectorAll('input:checked')).map(el => el.parentElement.querySelector('span').textContent.split(' ')[0]);
            if (selected.length > 0) {
                dailySlots[date] = selected;
                hasAnySlot = true;
            }
        });

        if (!hasAnySlot) {
            alert('請至少勾選一個場次時段！');
            return;
        }

        // 檢查防衝堂 (逐日逐場次精確比對)
        let conflictInfo = null;
        for (const date in dailySlots) {
            const mySlots = dailySlots[date];
            const hasConflict = bookings.some(b => {
                if (b.status !== '預約成功') return false;
                if (b.venue !== venueVal) return false;

                return mySlots.some(s => {
                    const label = s.substring(0, 1);
                    if (b.dailySlots && b.dailySlots[date] && b.dailySlots[date].some(bs => bs.startsWith(label))) return true;
                    if (!b.dailySlots && date >= b.startDate && date <= b.endDate && b.slots.some(bs => bs.startsWith(label))) return true;
                    return false;
                });
            });

            if (hasConflict) {
                conflictInfo = `${date} 的部分時段`;
                break;
            }
        }

        if (conflictInfo) {
            alert(`抱歉，您選擇的 ${conflictInfo} 已被其他單位預約成功，請調整您的勾選。`);
            return;
        }

        // 刷新第二步器材的動態庫存數字 (依據具體選中的場次)
        window.renderBookingEquipment();

        // 動態試算並顯示總金額
        updateTotalRentPreview();

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
        const venueId = document.getElementById('venueSelect').value;

        // 採集 dailySlots
        const dailySlots = {};
        const allSlotsSet = new Set();
        document.querySelectorAll('.daily-slot-row').forEach(row => {
            const date = row.getAttribute('data-date');
            const selected = Array.from(row.querySelectorAll('input:checked')).map(el => el.parentElement.querySelector('span').textContent.split(' ')[0]);
            if (selected.length > 0) {
                dailySlots[date] = selected;
                selected.forEach(s => allSlotsSet.add(s));
            }
        });

        if (Object.keys(dailySlots).length === 0) {
            alert('請至少選擇一個場次！');
            return;
        }

        const selectedEquipments = [];
        document.querySelectorAll('.equip-qty-input').forEach(input => {
            const qty = parseInt(input.value, 10);
            if (qty > 0) {
                const item = equipment.find(e => e.dbId === input.getAttribute('data-id'));
                if (item) {
                    selectedEquipments.push({
                        id: item.dbId,
                        name: item.name,
                        qty: qty,
                        price: item.price
                    });
                }
            }
        });

        const formData = {
            id: 'REQ-' + Math.random().toString(36).substr(2, 9).toUpperCase(),
            venue: venueId,
            startDate: startDate,
            endDate: endDate,
            slots: Array.from(allSlotsSet), // 舊版相容：存入所有出現過的場次
            dailySlots: dailySlots,         // 新版：存入逐日明細
            equipment: selectedEquipments,
            groupName: document.getElementById('groupName').value,
            applicant: document.getElementById('applicantName').value,
            email: document.getElementById('email').value,
            purpose: document.getElementById('purpose').value,
            totalRent: `NT$ ${calculateTotalRent(venueId, startDate, endDate, dailySlots, selectedEquipments).toLocaleString()}`,
            status: '審核中',
            timestamp: new Date().toLocaleString('zh-TW')
        };

        // 將表單資料透過封裝函式連線寫入 Firebase (或本機備用庫)
        addBookingToDB(formData);

        alert('申請已成功提交！將由 Email 通知您後續審核結果。');
        bookingForm.reset();

        // 隱藏時段矩陣並重置 UI
        document.getElementById('dailySlotsWrapper').style.display = 'none';
        document.getElementById('dailySlotsGrid').innerHTML = '<p style="color: var(--text-muted); font-size: 0.9rem;">請先選擇預約日期...</p>';

        steps[1].classList.remove('active');
        steps[0].classList.add('active');
        window.location.hash = 'schedule';
    });

    // 場地選擇變更時，觸發時段矩陣重新檢查
    document.getElementById('venueSelect')?.addEventListener('change', () => {
        if (window.renderDailySlotInputs) window.renderDailySlotInputs();
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

    // 8. 自定義日曆組件佈局與邏輯
    function initCustomCalendar() {
        const picker = document.getElementById('calendarPicker');
        const daysContainer = document.getElementById('calendarDays');
        const monthYearLabel = document.getElementById('calendarMonthYear');
        const inputs = [
            document.getElementById('startDate'),
            document.getElementById('endDate'),
            document.getElementById('scheduleDate'),
            document.getElementById('inventoryDate')
        ].filter(Boolean);

        let currentActiveInput = null;
        let displayedDate = new Date();

        function renderCalendar(date) {
            if (!daysContainer || !monthYearLabel) return;
            daysContainer.innerHTML = '';
            const year = date.getFullYear();
            const month = date.getMonth();
            monthYearLabel.textContent = `${year}年 ${month + 1}月`;

            const firstDay = new Date(year, month, 1).getDay();
            const daysInMonth = new Date(year, month + 1, 0).getDate();

            for (let i = 0; i < firstDay; i++) {
                const empty = document.createElement('div');
                empty.className = 'day empty';
                daysContainer.appendChild(empty);
            }

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

                dayEl.addEventListener('click', (e) => {
                    if (currentActiveInput) {
                        currentActiveInput.value = dateStr;
                        picker.style.display = 'none';
                        currentActiveInput.dispatchEvent(new Event('change'));

                        // 若變更的是開始或結束日期，則重繪時段矩陣
                        if (currentActiveInput.id === 'startDate' || currentActiveInput.id === 'endDate') {
                            window.renderDailySlotInputs();
                        }

                        e.stopPropagation();
                    }
                });
                daysContainer.appendChild(dayEl);
            }
        }

        inputs.forEach(input => {
            const handleOpen = (e) => {
                currentActiveInput = input;
                const rect = input.getBoundingClientRect();
                picker.style.display = 'block';

                // 強大定位：使用 fixed 避免 scrollY 計算誤差，並支援 mobile 彈性置中
                picker.style.position = 'fixed';
                let topPos = rect.bottom + 10;
                let leftPos = rect.left;

                if (topPos + 350 > window.innerHeight) {
                    topPos = rect.top - 360;
                }
                if (window.innerWidth < 450) {
                    leftPos = (window.innerWidth - 320) / 2;
                } else if (leftPos + 320 > window.innerWidth) {
                    leftPos = window.innerWidth - 340;
                }

                picker.style.top = `${Math.max(10, topPos)}px`;
                picker.style.left = `${Math.max(10, leftPos)}px`;
                picker.style.zIndex = '9999';

                renderCalendar(displayedDate);
                e.preventDefault();
                e.stopPropagation();
            };

            input.addEventListener('click', handleOpen);
            input.addEventListener('touchstart', (e) => {
                handleOpen(e);
            }, { passive: false });
        });

        document.getElementById('prevMonth')?.addEventListener('click', (e) => {
            displayedDate.setMonth(displayedDate.getMonth() - 1);
            renderCalendar(displayedDate);
            e.stopPropagation();
        });

        document.getElementById('nextMonth')?.addEventListener('click', (e) => {
            displayedDate.setMonth(displayedDate.getMonth() + 1);
            renderCalendar(displayedDate);
            e.stopPropagation();
        });

        document.addEventListener('click', (e) => {
            if (picker && !picker.contains(e.target) && !inputs.some(i => i.contains(e.target))) {
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
                    if (b.venue !== venueId) return false;

                    if (b.dailySlots) {
                        // 新機制：精確檢查該日期是否存在該時段
                        return b.dailySlots[dayStr] && b.dailySlots[dayStr].some(s => s.startsWith(slot.id));
                    } else {
                        // 舊機制：檢查區間與聯集 slots
                        return (dayStr >= b.startDate && dayStr <= b.endDate) && b.slots.some(s => s.startsWith(slot.id));
                    }
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

    // 9.1 渲染後台「器材管理」清單
    window.renderAdminEquipmentList = function () {
        const container = document.getElementById('adminEquipmentList');
        if (!container) return;

        if (equipment.length === 0) {
            container.innerHTML = '<div class="empty-state"><p>載入器材中...</p></div>';
            return;
        }

        container.innerHTML = equipment.map(e => `
            <div class="admin-item-equip">
                <div class="admin-equip-content">
                    ${e.image ? `<div class="admin-equip-img" style="background-image: url('${e.image}');"></div>` : '<div class="admin-equip-img" style="display:flex; justify-content:center; align-items:center; background:rgba(0,0,0,0.5); font-size:1.5rem;">📷</div>'}
                    <div>
                        <h4 style="margin-bottom: 5px;">${e.name} ${e.isActive ? '' : '<span style="color: #ef4444; font-size: 0.75rem;">(已下架)</span>'}</h4>
                        <p style="font-size: 0.85rem; color: var(--text-muted); margin-bottom: 3px;">
                            價格: NT$ ${e.price} / 庫存: ${e.totalQty}
                        </p>
                        <p style="font-size: 0.85rem; color: var(--text-main);">
                            ${e.description || '無描述'}
                        </p>
                    </div>
                </div>
                <div class="admin-actions">
                    <button class="btn-secondary" onclick="editEquip('${e.dbId}')" style="padding: 6px 12px; font-size: 0.85rem;">編輯</button>
                    <button class="btn-secondary" onclick="deleteEquip('${e.dbId}')" style="padding: 6px 12px; font-size: 0.85rem; background: rgba(163, 38, 42, 0.1); color: var(--accent-red); border-color: var(--accent-red);">刪除</button>
                </div>
            </div>
        `).join('');
    };

    // 9.2 渲染後台「庫存現量報表」
    window.renderInventoryReport = function (dateString) {
        const tbody = document.getElementById('inventoryReportTBody');
        if (!tbody) return;

        if (!dateString) {
            tbody.innerHTML = '<tr><td colspan="5" style="text-align: center; color: var(--text-muted);">請選擇有效日期</td></tr>';
            return;
        }

        const activeEquip = equipment.filter(e => e.isActive !== false);
        if (activeEquip.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" style="text-align: center; color: var(--text-muted);">目前無器材資料</td></tr>';
            return;
        }

        tbody.innerHTML = activeEquip.map(e => {
            const m = getAvailableEquipQty(e, { [dateString]: ['早'] });
            const a = getAvailableEquipQty(e, { [dateString]: ['午'] });
            const ev = getAvailableEquipQty(e, { [dateString]: ['晚'] });

            const highlightAlert = (avail) => avail === 0 ? '<span style="color:var(--danger);font-weight:bold;">0</span>' : avail;

            return `
            <tr>
                <td style="font-weight: bold; color: var(--text-main); text-align: left;">${e.name}</td>
                <td>${highlightAlert(m)}</td>
                <td>${highlightAlert(a)}</td>
                <td>${highlightAlert(ev)}</td>
                <td style="color: var(--text-muted);">${e.totalQty}</td>
            </tr>
            `;
        }).join('');
    };

    scheduleVenueSelect.addEventListener('change', window.renderSchedule);
    scheduleDateInput.addEventListener('change', window.renderSchedule);

    // 執行初始化
    initCustomCalendar();
    renderVenues();
    if (window.renderSchedule) window.renderSchedule();
    
    // 預設今日日期為 inventoryDate
    const invDateInput = document.getElementById('inventoryDate');
    if (invDateInput) {
        const todayStr = new Date(new Date().getTime() - new Date().getTimezoneOffset() * 60000).toISOString().split('T')[0];
        invDateInput.value = todayStr;
        invDateInput.addEventListener('change', (e) => {
            if (window.renderInventoryReport) window.renderInventoryReport(e.target.value);
        });
    }

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

    // 9.2 後台頁籤切換邏輯
    const adminTabs = document.querySelectorAll('.tab-btn');
    const tabContents = document.querySelectorAll('.tab-content');

    adminTabs.forEach(btn => {
        btn.addEventListener('click', () => {
            const target = btn.getAttribute('data-tab');

            adminTabs.forEach(b => {
                b.classList.remove('active', 'btn-primary');
                b.classList.add('btn-secondary');
            });
            btn.classList.add('active', 'btn-primary');
            btn.classList.remove('btn-secondary');

            tabContents.forEach(content => {
                content.style.display = (content.id === target) ? 'block' : 'none';
            });

            // 當切換到庫存報表時，觸發渲染更新
            if (target === 'inventoryTab') {
                const dateVal = document.getElementById('inventoryDate')?.value;
                if (window.renderInventoryReport && dateVal) {
                    window.renderInventoryReport(dateVal);
                }
            }

            if (target === 'equipmentTab' && typeof window.renderAdminEquipmentList === 'function') window.renderAdminEquipmentList();
            if (target === 'venuesTab' && typeof window.renderAdminVenueList === 'function') window.renderAdminVenueList();
            if (target === 'eventsManageTab' && typeof window.renderAdminEventsList === 'function') window.renderAdminEventsList();
            if (target === 'checkinTab') {
                if (typeof window.updateCheckinSelect === 'function') window.updateCheckinSelect();
                if (typeof window.renderCheckinList === 'function') window.renderCheckinList();
            }
        });
    });

    // 9.3 器材管理 CRUD
    const equipmentEditModal = document.getElementById('equipmentEditModal');
    const equipmentEditForm = document.getElementById('equipmentEditForm');
    const addEquipmentBtn = document.getElementById('addEquipmentBtn');

    if (addEquipmentBtn) {
        addEquipmentBtn.addEventListener('click', () => {
            document.getElementById('equipmentEditTitle').textContent = '新增器材項目';
            document.getElementById('editEquipDbId').value = '';
            document.getElementById('editEquipName').value = '';
            document.getElementById('editEquipPrice').value = '';
            document.getElementById('editEquipQty').value = '';
            document.getElementById('editEquipDesc').value = '';
            document.getElementById('editEquipImage').value = '';
            document.getElementById('editEquipActive').checked = true;

            if (equipmentEditModal) {
                equipmentEditModal.style.display = 'flex';
                equipmentEditModal.offsetHeight;
                equipmentEditModal.classList.add('show');
            }
        });
    }

    window.editEquip = function (dbId) {
        const e = equipment.find(x => x.dbId === dbId);
        if (!e) return;

        document.getElementById('equipmentEditTitle').textContent = '編輯器材資訊';
        document.getElementById('editEquipDbId').value = e.dbId;
        document.getElementById('editEquipName').value = e.name;
        document.getElementById('editEquipPrice').value = e.price;
        document.getElementById('editEquipQty').value = e.totalQty;
        document.getElementById('editEquipDesc').value = e.description || '';
        document.getElementById('editEquipImage').value = e.image || '';
        document.getElementById('editEquipActive').checked = e.isActive !== false;

        if (equipmentEditModal) {
            equipmentEditModal.style.display = 'flex';
            equipmentEditModal.offsetHeight;
            equipmentEditModal.classList.add('show');
        }
    };

    window.deleteEquip = function (dbId) {
        if (!confirm('確定要刪除此器材嗎？此動作無法復原。')) return;
        if (db) {
            db.collection("equipment").doc(dbId).delete().then(() => {
                alert('器材已刪除');
            });
        } else {
            equipment = equipment.filter(e => e.dbId !== dbId);
            if (window.renderAdminEquipmentList) window.renderAdminEquipmentList();
            alert('本地模式：器材已移除');
        }
    };

    if (equipmentEditForm) {
        equipmentEditForm.addEventListener('submit', (evt) => {
            evt.preventDefault();
            const dbId = document.getElementById('editEquipDbId').value;
            const price = parseInt(document.getElementById('editEquipPrice').value, 10);
            const qty = parseInt(document.getElementById('editEquipQty').value, 10);

            const newEquip = {
                name: document.getElementById('editEquipName').value,
                price: price,
                totalQty: qty,
                description: document.getElementById('editEquipDesc').value,
                image: document.getElementById('editEquipImage').value,
                isActive: document.getElementById('editEquipActive').checked,
                order: equipment.length + 1
            };

            if (dbId && db) {
                db.collection("equipment").doc(dbId).update(newEquip).then(() => {
                    if (equipmentEditModal) {
                        equipmentEditModal.classList.remove('show');
                        setTimeout(() => equipmentEditModal.style.display = 'none', 300);
                    }
                    alert('器材資訊已更新');
                    if (typeof window.renderPricingTables === 'function') window.renderPricingTables();
                });
            } else if (db) {
                db.collection("equipment").add(newEquip).then(() => {
                    if (equipmentEditModal) {
                        equipmentEditModal.classList.remove('show');
                        setTimeout(() => equipmentEditModal.style.display = 'none', 300);
                    }
                    alert('新器材已新增');
                    if (typeof window.renderPricingTables === 'function') window.renderPricingTables();
                });
            } else {
                alert('提示：目前處於離線模式，無法儲存至雲端。');
            }
        });
    }

    window.renderAdminList = function () {
        if (bookings.length === 0) {
            adminList.innerHTML = '<div class="empty-state"><p>目前無待審核申請</p></div>';
            return;
        }
        const parseTWDateStr = (str) => {
            if (!str) return 0;
            const match = str.match(/(\d{4})\/(\d{1,2})\/(\d{1,2})\s+(上午|下午)?\s*(\d{1,2}):(\d{1,2}):(\d{1,2})/);
            if (match) {
                let [_, y, m, d, ampm, h, min, sec] = match;
                h = parseInt(h, 10);
                if (ampm === '下午' && h < 12) h += 12;
                if (ampm === '上午' && h === 12) h = 0;
                return new Date(y, m-1, d, h, min, sec).getTime();
            }
            return new Date(str.replace('上午', ' AM').replace('下午', ' PM')).getTime() || 0;
        };

        const sortedBookings = [...bookings].sort((a, b) => parseTWDateStr(b.timestamp) - parseTWDateStr(a.timestamp));

        adminList.innerHTML = sortedBookings.map(b => {
            const venueName = venues.find(v => v.id === b.venue)?.name || '未知場地';
            const dateDisplay = b.startDate === b.endDate ? b.startDate : `${b.startDate} 至 ${b.endDate}`;

            // 處理時段顯示 (優先顯示 dailySlots 明細)
            let slotDisplay = '';
            if (b.dailySlots) {
                const dayDetails = [];
                for (const date in b.dailySlots) {
                    dayDetails.push(`${date.substring(5)}(${b.dailySlots[date].join('/')})`);
                }
                slotDisplay = dayDetails.join(' | ');
            } else {
                slotDisplay = typeof b.slots === 'string' ? b.slots : (b.slots && b.slots.length > 0 ? b.slots.join('、') : '');
            }

            let actionHtml = '';
            if (b.status === '審核中') {
                actionHtml = `
                    <div class="admin-actions">
                        <button class="btn-success" style="white-space: nowrap; padding: 6px 12px; font-size: 0.85rem;" onclick="approveApplication('${b.id}')">核准申請</button>
                        <button class="btn-danger" style="white-space: nowrap; padding: 6px 12px; font-size: 0.85rem;" onclick="rejectApplication('${b.id}')">退回申請</button>
                    </div>
                `;
            } else if (b.status === '預約成功') {
                actionHtml = `
                    <div class="admin-actions">
                        <button class="btn-primary" style="white-space: nowrap; padding: 6px 12px; font-size: 0.85rem;" onclick="resendApprovalEmail('${b.id}')">補傳核准信</button>
                        <button class="btn-secondary" style="white-space: nowrap; padding: 6px 12px; font-size: 0.85rem;" onclick="printReceipt('${b.id}')">列印收據</button>
                    </div>
                `;
            } else if (b.status === '預約退回') {
                actionHtml = `
                    <div class="admin-actions">
                        <button class="btn-secondary" style="white-space: nowrap; padding: 6px 12px; font-size: 0.85rem;" onclick="resendRejectEmail('${b.id}')">補傳退回信</button>
                    </div>
                `;
            }

            let equipDisplay = '';
            let equipStrList = [];
            if (b.equipment && Array.isArray(b.equipment)) {
                equipStrList = b.equipment.map(eq => typeof eq === 'string' ? eq : `${eq.name} (x${eq.qty})`);
            }
            if (equipStrList.length > 0) {
                equipDisplay = `<p style="font-size: 0.85rem; color: var(--text-main); margin-top: 5px;">附加器材: ${equipStrList.join('、')}</p>`;
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
                        ${equipDisplay}
                        <p style="font-size: 0.85rem; color: var(--accent); margin-top: 5px; font-weight: bold;">總計租金: ${b.totalRent || '無'}</p>
                    </div>
                    ${actionHtml}
                    ${b.status !== '審核中' ? `<div style="font-size: 0.9rem; font-weight: bold; white-space: nowrap; margin-left: 10px; color: ${b.status === '預約成功' ? 'var(--accent)' : 'var(--danger)'};">${b.status}</div>` : ''}
                </div>
            `;
        }).join('');
    };

    function sendEmail(item, isResend = false, isReject = false) {
        // 如果有填寫金鑰，就進行真實的 API 寄信
        if (typeof emailjs !== 'undefined' && EMAILJS_PUBLIC_KEY && EMAILJS_PUBLIC_KEY.length > 5) {
            const venueName = venues.find(v => v.id === item.venue)?.name || item.venue;

            let slotStr = '';
            if (item.dailySlots) {
                const dayDetails = [];
                Object.keys(item.dailySlots).sort().forEach(date => {
                    dayDetails.push(`${date.substring(5)}(${item.dailySlots[date].join('/')})`);
                });
                slotStr = dayDetails.join(' | ');
            } else {
                slotStr = item.slots.join('、');
            }

            let equipStrList = [];
            if (item.equipment && Array.isArray(item.equipment)) {
                equipStrList = item.equipment.map(eq => typeof eq === 'string' ? eq : `${eq.name} (x${eq.qty})`);
            }

            const templateParams = {
                to_email: item.email,
                applicant_name: item.applicant,
                group_name: item.groupName,
                booking_id: item.id,
                venue_name: venueName,
                booking_date: item.startDate === item.endDate ? item.startDate : `${item.startDate} ~ ${item.endDate}`,
                booking_slots: slotStr,
                booking_equipment: equipStrList.length > 0 ? equipStrList.join('、') : '無',
                total_rent: item.totalRent || '無',
                status: isReject ? '退回' : '核准'
            };

            const targetTemplate = isReject && EMAILJS_REJECT_TEMPLATE_ID ? EMAILJS_REJECT_TEMPLATE_ID : EMAILJS_TEMPLATE_ID;

            emailjs.send(EMAILJS_SERVICE_ID, targetTemplate, templateParams)
                .then(() => {
                    const statusStr = isReject ? '退回' : '核准';
                    const prefix = isResend ? '【補寄發信成功】' : '【發信成功】';
                    alert(`${prefix}${statusStr}通知已送至申請人信箱：${item.email}`);
                })
                .catch((err) => {
                    console.error('EmailJS 寄信失敗:', err);
                    alert(`【發信失敗】\n狀態碼：${err.status || '未知'}\n詳細錯誤：${err.text || err.message || JSON.stringify(err)}\n\n(這通常代表金鑰的字母被截斷了，或是瀏覽器阻攔了請求，請參考此訊息)`);
                });
        } else {
            // 原有的模擬發信
            const statusStr = isReject ? '退回' : '核准';
            const prefix = isResend ? '【模擬重新寄出】' : '【系統模擬發信】';
            alert(`${prefix}已成功寄送${statusStr}通知至聯絡人 ${item.applicant} 的信箱：${item.email}\n(註：您尚未填寫 EmailJS 金鑰，目前為模擬通知)`);
        }
    }

    window.resendApprovalEmail = function (id) {
        const item = bookings.find(b => b.id === id);
        if (item) {
            sendEmail(item, true);
        }
    };

    window.resendRejectEmail = function (id) {
        const item = bookings.find(b => b.id === id);
        if (item) {
            sendEmail(item, true, true);
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
            item.status = '預約退回';
            updateBookingStatusToDB(id, '預約退回');
            sendEmail(item, false, true);
        }
    };

    // ============================================
    // 後台：場地管理系統 (新增/編輯邏輯)
    // ============================================
    // 渲染後台場地列表
    window.renderAdminVenueList = function () {
        const adminVenueList = document.getElementById('adminVenueList');
        if (!adminVenueList) return;

        if (venues.length === 0) {
            adminVenueList.innerHTML = '<div class="empty-state"><p>沒有場地資料</p></div>';
            return;
        }

        adminVenueList.innerHTML = venues.map(v => `
            <div class="admin-item" style="display: flex; justify-content: space-between; align-items: center; background: rgba(255,255,255,0.03); padding: 15px; border-radius: 8px; margin-bottom: 15px; border: 1px solid var(--border);">
                <div style="display: flex; align-items: center; gap: 15px;">
                    <div style="width: 70px; height: 70px; border-radius: 8px; background-image: url('${v.image}'); background-size: cover; background-position: center; border: 2px solid ${v.isActive ? 'var(--accent)' : '#555'};"></div>
                    <div>
                        <h4 style="margin-bottom: 5px; font-size: 1.1rem;">${v.name} <span style="font-size:0.85rem; color: var(--text-muted); font-weight: normal;">(${v.id})</span></h4>
                        <p style="font-size: 0.9rem; color: var(--text-muted);">
                            狀態: <span style="color: ${v.isActive ? 'var(--accent)' : '#ff4d4d'}; font-weight: bold;">${v.isActive ? '開放營業中' : '已下架'}</span>
                            | 價格: 早 ${v.pricing?.morning}/午 ${v.pricing?.afternoon}/晚 ${v.pricing?.evening}
                        </p>
                    </div>
                </div>
                <div style="display: flex; gap: 10px; align-items: center;">
                    <button class="btn-secondary" onclick="editVenue('${v.dbId}')" style="padding: 6px 12px; font-size: 0.85rem;">編輯</button>
                    ${v.dbId ? `<button class="btn-secondary" onclick="deleteVenue('${v.dbId}')" style="padding: 6px 12px; font-size: 0.85rem; background: rgba(163, 38, 42, 0.1); color: var(--accent-red); border-color: var(--accent-red);">刪除</button>` : ''}
                </div>
            </div>
        `).join('');
    };

    // 場地編輯 Modal 控制邏輯
    const venueEditModal = document.getElementById('venueEditModal');
    const venueEditForm = document.getElementById('venueEditForm');
    const addVenueBtn = document.getElementById('addVenueBtn');

    if (addVenueBtn) {
        addVenueBtn.addEventListener('click', () => {
            if (venues.length >= 6) {
                alert('系統限制最多僅能開放 6 個場地，請直接修改現有場地！');
                return;
            }
            document.getElementById('venueEditTitle').textContent = '新增場地';
            venueEditForm.reset();
            document.getElementById('editVenueDbId').value = '';
            document.getElementById('editVenueActive').checked = true;

            venueEditModal.style.display = 'flex';
            venueEditModal.offsetHeight; // trigger reflow
            venueEditModal.classList.add('show');
        });
    }

    // Modal 關閉按鈕通用綁定
    document.querySelectorAll('.close-modal').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const modal = e.target.closest('.modal');
            modal.classList.remove('show');
            setTimeout(() => modal.style.display = 'none', 300);
        });
    });
    // 點擊背景關閉
    window.addEventListener('click', (e) => {
        if (e.target.classList.contains('modal')) {
            e.target.classList.remove('show');
            setTimeout(() => e.target.style.display = 'none', 300);
        }
    });

    // 處理編輯表單送出 (寫回 Firebase)
    if (venueEditForm) {
        venueEditForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const dbId = document.getElementById('editVenueDbId').value;
            const pm = parseInt(document.getElementById('editVenuePriceM').value, 10);
            const pa = parseInt(document.getElementById('editVenuePriceA').value, 10);
            const pe = parseInt(document.getElementById('editVenuePriceE').value, 10);

            const tm = document.getElementById('editVenueTimeM').value || '09:00-13:00';
            const ta = document.getElementById('editVenueTimeA').value || '14:00-18:00';
            const te = document.getElementById('editVenueTimeE').value || '19:00-23:00';

            const newVenue = {
                id: document.getElementById('editVenueAlias').value,
                name: document.getElementById('editVenueName').value,
                type: document.getElementById('editVenueType').value,
                capacity: document.getElementById('editVenueCapacity').value,
                image: document.getElementById('editVenueImage').value,
                tags: document.getElementById('editVenueTags').value.split(',').map(s => s.trim()).filter(Boolean),
                desc: document.getElementById('editVenueDesc').value,
                pricing: { morning: pm, afternoon: pa, evening: pe },
                timings: { morning: tm, afternoon: ta, evening: te },
                isActive: document.getElementById('editVenueActive').checked,
            };

            if (dbId && db) {
                // Update
                db.collection("venues").doc(dbId).update(newVenue).then(() => {
                    venueEditModal.classList.remove('show');
                    setTimeout(() => venueEditModal.style.display = 'none', 300);
                    alert('場地已更新！前台畫面將自動同步。');
                    if (window.renderPricingTables) window.renderPricingTables();
                });
            } else if (db) {
                // Add
                newVenue.order = venues.length + 1;
                db.collection("venues").add(newVenue).then(() => {
                    venueEditModal.classList.remove('show');
                    setTimeout(() => venueEditModal.style.display = 'none', 300);
                    alert('場地已新增！前台畫面將自動同步。');
                    if (window.renderPricingTables) window.renderPricingTables();
                });
            } else {
                alert('提示：目前處於本機離線模式，未填入 Firebase 金鑰，因此無法儲存變更設定。');
            }
        });
    }

    window.editVenue = function (dbId) {
        const v = venues.find(x => x.dbId === dbId);
        if (!v) return;

        document.getElementById('venueEditTitle').textContent = '編輯場地資訊';
        document.getElementById('editVenueDbId').value = v.dbId;
        document.getElementById('editVenueAlias').value = v.id;
        document.getElementById('editVenueName').value = v.name;
        document.getElementById('editVenueType').value = v.type;
        document.getElementById('editVenueCapacity').value = v.capacity;
        document.getElementById('editVenueImage').value = v.image;
        document.getElementById('editVenueTags').value = (v.tags || []).join(', ');
        document.getElementById('editVenueDesc').value = v.desc || '';
        document.getElementById('editVenuePriceM').value = v.pricing ? v.pricing.morning : 0;
        document.getElementById('editVenuePriceA').value = v.pricing ? v.pricing.afternoon : 0;
        document.getElementById('editVenuePriceE').value = v.pricing ? v.pricing.evening : 0;

        document.getElementById('editVenueTimeM').value = v.timings ? v.timings.morning : '09:00-13:00';
        document.getElementById('editVenueTimeA').value = v.timings ? v.timings.afternoon : '14:00-18:00';
        document.getElementById('editVenueTimeE').value = v.timings ? v.timings.evening : '19:00-23:00';

        document.getElementById('editVenueActive').checked = v.isActive !== false;

        venueEditModal.style.display = 'flex';
        venueEditModal.offsetHeight;
        venueEditModal.classList.add('show');
    };

    window.deleteVenue = function(dbId) {
        if (!confirm('確認要永久刪除此場地資料嗎？此操作無法還原，且前台也會同步撤下。')) return;
        if (db && dbId) {
            db.collection("venues").doc(dbId).delete().then(() => {
                alert('場地已成功刪除！');
                if (window.renderPricingTables) window.renderPricingTables();
            }).catch((err) => {
                alert('刪除失敗：' + err.message);
            });
        } else {
            alert('無法刪除，可能是離線的預設資料或金鑰未設定。');
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

            const headers = ['案號', '申請時間', '狀態', '場地', '開始日期', '結束日期', '時段', '劇團名稱', '聯絡人', '電子郵件', '排練目的', '附加器材', '總計租金'];

            const rows = successfulBookings.map(b => {
                const venueName = venues.find(v => v.id === b.venue)?.name || b.venue;

                let slotStr = '';
                if (b.dailySlots) {
                    const dayDetails = [];
                    Object.keys(b.dailySlots).sort().forEach(date => {
                        dayDetails.push(`${date}(${b.dailySlots[date].join('/')})`);
                    });
                    slotStr = dayDetails.join('; ');
                } else {
                    slotStr = typeof b.slots === 'string' ? b.slots : (b.slots ? b.slots.join(';') : '');
                }

                let equipStrList = [];
                if (b.equipment && Array.isArray(b.equipment)) {
                    equipStrList = b.equipment.map(eq => typeof eq === 'string' ? eq : `${eq.name} (x${eq.qty})`);
                }
                const equipStr = equipStrList.length > 0 ? equipStrList.join(';') : '無';
                const rentVal = b.totalRent || '';

                return [
                    b.id, b.timestamp, b.status, venueName, b.startDate, b.endDate, slotStr,
                    b.groupName, b.applicant, b.email, b.purpose, equipStr, rentVal
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

    // === 實體收據列印系統 ===
    window.printReceipt = function (id) {
        const item = bookings.find(b => b.id === id);
        if (!item) return;

        const v = venues.find(v => v.id === item.venue);
        const venueName = v?.name || item.venue;

        // 計算總場次與各類場次天數 (依據 dailySlots)
        let morningDays = 0, afternoonDays = 0, eveningDays = 0;
        let totalSessionsCount = 0;

        if (item.dailySlots) {
            for (const date in item.dailySlots) {
                item.dailySlots[date].forEach(s => {
                    totalSessionsCount++;
                    if (s.includes('早')) morningDays++;
                    else if (s.includes('午')) afternoonDays++;
                    else if (s.includes('晚')) eveningDays++;
                });
            }
        } else {
            // 舊版資料相容處理
            const d1 = new Date(item.startDate);
            const d2 = new Date(item.endDate);
            const days = Math.round((d2 - d1) / (1000 * 60 * 60 * 24)) + 1;
            totalSessionsCount = days * (item.slots ? item.slots.length : 1);
            if (item.slots) {
                item.slots.forEach(s => {
                    if (s.includes('早')) morningDays = days;
                    if (s.includes('午')) afternoonDays = days;
                    if (s.includes('晚')) eveningDays = days;
                });
            }
        }

        let venueRentHtml = '';
        if (v && v.pricing) {
            const rows = [];
            if (morningDays > 0) rows.push(`<tr><td>場租: ${venueName} (早場)</td><td>NT$ ${v.pricing.morning.toLocaleString()} × ${morningDays}場</td><td style="text-align:right; font-weight:bold;">NT$ ${(v.pricing.morning * morningDays).toLocaleString()}</td></tr>`);
            if (afternoonDays > 0) rows.push(`<tr><td>場租: ${venueName} (午場)</td><td>NT$ ${v.pricing.afternoon.toLocaleString()} × ${afternoonDays}場</td><td style="text-align:right; font-weight:bold;">NT$ ${(v.pricing.afternoon * afternoonDays).toLocaleString()}</td></tr>`);
            if (eveningDays > 0) rows.push(`<tr><td>場租: ${venueName} (晚場)</td><td>NT$ ${v.pricing.evening.toLocaleString()} × ${eveningDays}場</td><td style="text-align:right; font-weight:bold;">NT$ ${(v.pricing.evening * eveningDays).toLocaleString()}</td></tr>`);
            venueRentHtml = rows.join('');
        } else {
            venueRentHtml = `<tr><td>場租: ${venueName}</td><td>(計價資訊依總金額計算)</td><td style="text-align:right;">${item.totalRent}</td></tr>`;
        }

        // 渲染器材明細
        let equipItemsHtml = '';
        if (item.equipment && Array.isArray(item.equipment) && item.equipment.length > 0) {
            equipItemsHtml = item.equipment.map(eq => {
                if (typeof eq === 'string') return `<tr><td>器材: ${eq}</td><td>-</td><td style="text-align:right;"> - </td></tr>`;
                const subtotal = eq.price * eq.qty * totalSessionsCount;
                return `<tr>
                    <td>器材: ${eq.name}</td>
                    <td>NT$ ${eq.price.toLocaleString()} × ${eq.qty}件 × ${totalSessionsCount}場次</td>
                    <td style="text-align:right; font-weight:bold;">NT$ ${subtotal.toLocaleString()}</td>
                </tr>`;
            }).join('');
        } else {
            equipItemsHtml = `<tr><td colspan="3" style="color: #666; text-align:center;">無特殊附加器材</td></tr>`;
        }

        const dateStr = item.startDate === item.endDate ? item.startDate : `${item.startDate} ~ ${item.endDate}`;

        let displayDays = 0;
        let displaySlots = '';
        if (item.dailySlots) {
            displayDays = Object.keys(item.dailySlots).length;
            const slotDetails = [];
            Object.keys(item.dailySlots).sort().forEach(date => {
                slotDetails.push(`${date.substring(5)}(${item.dailySlots[date].join('/')})`);
            });
            displaySlots = slotDetails.join(' | ');
        } else {
            const d1 = new Date(item.startDate);
            const d2 = new Date(item.endDate);
            displayDays = Math.round((d2 - d1) / (1000 * 60 * 60 * 24)) + 1;
            displaySlots = item.slots ? item.slots.join('、') : '';
        }

        const receiptHtml = `
            <div id="printReceiptWrapper" class="receipt-wrapper">
                <div class="receipt-header">
                    <h2>傳統戲曲排練空間 - 租借結帳收據</h2>
                    <p>案號：${item.id} | 日期：${item.timestamp.split(' ')[0]}</p>
                </div>
                <div class="receipt-section">
                    <h3>申請人資訊</h3>
                    <p><strong>申請單位：</strong>${item.groupName}</p>
                    <p><strong>聯絡人：</strong>${item.applicant}</p>
                    <p><strong>聯絡信箱：</strong>${item.email}</p>
                    <p><strong>排練目的：</strong>${item.purpose}</p>
                </div>
                <div class="receipt-section">
                    <h3>預約檔期</h3>
                    <p><strong>預約日期：</strong>${dateStr} (共 ${displayDays} 天)</p>
                    <p><strong>預約時段：</strong>${displaySlots}</p>
                </div>
                <div class="receipt-section">
                    <h3>費用計算明細</h3>
                    <table class="receipt-table">
                        <thead>
                            <tr>
                                <th>計費項目</th>
                                <th>計算基礎 (單價 × 數量/天數)</th>
                                <th style="text-align:right;">小計金額</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${venueRentHtml}
                            ${equipItemsHtml}
                        </tbody>
                    </table>
                </div>
                <div class="receipt-total">
                    <h3>實收總計金額： <span class="amount">${item.totalRent || 'NT$ 0'}</span></h3>
                </div>
                <div class="receipt-signatures">
                    <div class="sig-box">
                        <p>經理人簽署 (Manager)</p>
                        <div class="sig-line"></div>
                    </div>
                    <div class="sig-box">
                        <p>團隊代表簽收 (Client)</p>
                        <div class="sig-line"></div>
                    </div>
                </div>
            </div>
        `;

        let existingWrapper = document.getElementById('printReceiptWrapper');
        if (existingWrapper) existingWrapper.remove();

        document.body.insertAdjacentHTML('beforeend', receiptHtml);
        window.print();
    };

    // ============================================
    // 前台：首頁活動預覽區
    // ============================================
    window.renderEventPreview = function() {
        const previewGrid = document.getElementById('eventPreviewGrid');
        if (!previewGrid) return;
        const activeEvents = events.filter(e => e.isActive !== false);
        if (activeEvents.length === 0) {
            previewGrid.innerHTML = '<div class="empty-state" style="grid-column: 1 / -1; text-align: center;"><p>近期暫無開放的活動</p></div>';
            return;
        }
        previewGrid.innerHTML = activeEvents.map(e => {
            const regCount = (e.id === 'EV-TEST-01') ? 32 : eventRegistrations.filter(r => r.eventId === e.id).length;
            const capacity = parseInt(e.capacity)||0;
            const fullStatus = regCount >= capacity ? '<span style="color:#ef4444; font-size:0.85rem;">[已額滿]</span>' : '';
            return `
            <div class="venue-card" style="display:flex; flex-direction:column; background:var(--glass-card-bg);">
                <div class="venue-img" style="background-image: url('${e.image || 'assets/opera_hero_bg.png'}'); height: 200px; background-size: cover; background-position: center;"></div>
                <div class="venue-info" style="flex: 1; display:flex; flex-direction:column; padding: 20px;">
                    <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 10px;">
                        <h3 style="margin: 0; font-family: var(--font-heading); flex: 1;">${e.name} ${fullStatus}</h3>
                        <div style="font-size: 0.8rem; background: rgba(var(--accent-rgb, 212,175,55), 0.15); color: var(--accent); padding: 2px 8px; border-radius: 12px; border: 1px solid var(--accent); white-space: nowrap; margin-left: 10px;">已報名 ${regCount}/${capacity}</div>
                    </div>
                    <p style="color:var(--text-muted); font-size:0.9rem; margin-bottom:5px;">📅 ${e.date} ${e.time}</p>
                    <p style="color:var(--text-muted); font-size:0.9rem; margin-bottom:15px; flex:1;">📍 ${e.location}</p>
                    <a href="events.html?id=${e.id}" class="btn-primary" style="text-align:center; padding:10px 0; border-radius:8px;">查看詳情與報名</a>
                </div>
            </div>
            `;
        }).join('');
    };

    // ============================================
    // 後台：活動管理 CRUD
    // ============================================
    const eventEditModal = document.getElementById('eventEditModal');
    const addEventBtn = document.getElementById('addEventBtn');
    const eventEditForm = document.getElementById('eventEditForm');

    window.renderAdminEventsList = function() {
        const list = document.getElementById('adminEventsList');
        if(!list) return;
        if(events.length === 0) {
            list.innerHTML = '<div class="empty-state"><p>沒有活動資料</p></div>';
            return;
        }
        list.innerHTML = events.map(e => {
            const openSpan = e.isActive ? `<span style="color:var(--accent); font-weight:bold;">上架中</span>` : `<span style="color:#ff4d4d; font-weight:bold;">已下架</span>`;
            return `
            <div class="admin-item" style="background:rgba(255,255,255,0.03); border:1px solid var(--border); padding:15px; margin-bottom:15px; border-radius:8px; display:flex; justify-content:space-between; align-items:center;">
                <div>
                    <h4 style="margin-bottom:5px; font-size:1.1rem;">${e.name}</h4>
                    <p style="font-size:0.85rem; color:var(--text-muted);">日期: ${e.date} ${e.time} | 地點: ${e.location} | 人數上限: ${e.capacity}</p>
                </div>
                <div style="display:flex; gap:10px; align-items:center;">
                    ${openSpan}
                    <button class="btn-secondary" style="padding:6px 12px; font-size:0.85rem;" onclick="openEventEditModal('${e.id}')">編輯</button>
                    <button class="btn-danger" style="padding:6px 12px; font-size:0.85rem;" onclick="deleteEvent('${e.id}')">刪除</button>
                </div>
            </div>
            `;
        }).join('');
    };

    if (addEventBtn) {
        addEventBtn.addEventListener('click', () => {
            document.getElementById('eventEditTitle').textContent = '新增活動';
            eventEditForm.reset();
            document.getElementById('editEventDbId').value = '';
            eventEditModal.style.display = 'block';
        });
    }

    if (eventEditForm) {
        eventEditForm.addEventListener('submit', (e) => {
            e.preventDefault();
            if(!db) { alert('離線模式無法操作活動'); return; }

            const id = document.getElementById('editEventDbId').value;
            const data = {
                name: document.getElementById('editEventName').value,
                date: document.getElementById('editEventDate').value,
                time: document.getElementById('editEventTime').value,
                location: document.getElementById('editEventLocation').value,
                capacity: document.getElementById('editEventCapacity').value,
                image: document.getElementById('editEventImage').value,
                description: document.getElementById('editEventDesc').value,
                isActive: document.getElementById('editEventActive').checked,
            };

            if (id) {
                db.collection('events').doc(id).update(data)
                .then(()=> { eventEditModal.style.display='none'; })
                .catch(err=> alert('更新失敗:'+err));
            } else {
                db.collection('events').add(data)
                .then(()=> { eventEditModal.style.display='none'; })
                .catch(err=> alert('新增失敗:'+err));
            }
        });
    }

    window.openEventEditModal = function(id) {
        const ev = events.find(x => x.id === id);
        if(!ev) return;
        document.getElementById('eventEditTitle').textContent = '編輯活動';
        document.getElementById('editEventDbId').value = ev.id;
        document.getElementById('editEventName').value = ev.name;
        document.getElementById('editEventDate').value = ev.date||'';
        document.getElementById('editEventTime').value = ev.time;
        document.getElementById('editEventLocation').value = ev.location;
        document.getElementById('editEventCapacity').value = ev.capacity;
        document.getElementById('editEventImage').value = ev.image;
        document.getElementById('editEventDesc').value = ev.description;
        document.getElementById('editEventActive').checked = ev.isActive;
        eventEditModal.style.display = 'block';
    };

    window.deleteEvent = function(id) {
        if(confirm('確定要刪除此活動嗎？這不會刪除已報名的紀錄，但前台將不會再顯示該活動。')) {
            db.collection('events').doc(id).delete();
        }
    };

    // ============================================
    // 後台：現場報到模組
    // ============================================
    window.updateCheckinSelect = function() {
        const select = document.getElementById('checkinEventSelect');
        if(!select) return;
        const curVal = select.value;
        select.innerHTML = '<option value="" disabled selected>請選擇要核對的活動...</option>' + 
                           events.map(e => `<option value="${e.id}">${e.name} (${e.date})</option>`).join('');
        if(events.some(e=>e.id===curVal)) select.value = curVal;
    };

    const checkinSelect = document.getElementById('checkinEventSelect');
    const checkinSearch = document.getElementById('checkinSearchInput');

    if(checkinSelect) {
        checkinSelect.addEventListener('change', window.renderCheckinList);
    }
    if(checkinSearch) {
        checkinSearch.addEventListener('input', window.renderCheckinList);
    }

    const checkinSearchBtn = document.getElementById('checkinSearchBtn');
    if(checkinSearchBtn) {
        checkinSearchBtn.addEventListener('click', window.renderCheckinList);
    }

    window.renderCheckinList = function() {
        const tbody = document.getElementById('checkinTbody');
        if(!tbody) return;
        
        const selectedId = checkinSelect ? checkinSelect.value : null;
        if(!selectedId) {
            tbody.innerHTML = '<tr><td colspan="5" style="text-align: center; color: var(--text-muted);">請先選擇上方活動</td></tr>';
            document.getElementById('checkinCount').textContent = '0';
            document.getElementById('checkinTotal').textContent = '0';
            return;
        }

        let list = eventRegistrations.filter(r => r.eventId === selectedId);
        
        // 【優化】若是測試活動且目前沒有真實報名資料，則注入模擬名單供測試
        if (selectedId === 'EV-TEST-01' && list.length === 0) {
            list = [
                { id: 'MOCK-01', userName: '張大千', userPhone: '0912345678', status: 'registered', timestamp: '2026-04-15T10:00:00Z', eventId: 'EV-TEST-01' },
                { id: 'MOCK-02', userName: '梅蘭芳', userPhone: '0987654321', status: 'checked-in', timestamp: '2026-04-15T10:05:00Z', eventId: 'EV-TEST-01' },
                { id: 'MOCK-03', userName: '程硯秋', userPhone: '0922333444', status: 'registered', timestamp: '2026-04-15T10:10:00Z', eventId: 'EV-TEST-01' }
            ];
        }
        
        // 更新進度條
        document.getElementById('checkinTotal').textContent = list.length;
        document.getElementById('checkinCount').textContent = list.filter(r => r.status === 'checked-in').length;

        // 搜尋功能
        const keyword = (checkinSearch ? checkinSearch.value.trim() : '').toLowerCase();
        if(keyword) {
            list = list.filter(r => 
                (r.userName && r.userName.toLowerCase().includes(keyword)) ||
                (r.userPhone && r.userPhone.includes(keyword))
            );
        }

        if(list.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" style="text-align: center; color: var(--text-muted);">沒有符合條件的名單</td></tr>';
            return;
        }

        list.sort((a,b) => (a.timestamp > b.timestamp ? 1 : -1));

        tbody.innerHTML = list.map(r => {
            const isChecked = r.status === 'checked-in';
            const statusDisplay = isChecked 
                ? '<span style="color:#10b981; font-weight:bold;">已報到</span>' 
                : '<span style="color:var(--text-muted);">未報到</span>';
            
            const actionBtn = isChecked
                ? `<button class="btn-secondary" style="padding:4px 10px; font-size:0.85rem;" onclick="toggleCheckin('${r.id}', 'registered')">取消報到</button>`
                : `<button class="btn-primary" style="padding:4px 10px; font-size:0.85rem; background:#10b981; color:white; border:none;" onclick="toggleCheckin('${r.id}', 'checked-in')">報到</button>`;

            return `
            <tr>
                <td style="color:var(--text-main); font-weight:bold;">${r.userName}</td>
                <td>${r.userPhone}</td>
                <td style="font-size:0.85rem; color:var(--text-muted);">${new Date(r.timestamp).toLocaleString('zh-TW')}</td>
                <td>${statusDisplay}</td>
                <td>${actionBtn}</td>
            </tr>
            `;
        }).join('');
    };

    window.toggleCheckin = function(regId, newStatus) {
        if(!db) return;
        db.collection('event_registrations').doc(regId).update({ status: newStatus });
    };

    // 匯出名冊
    const exportCheckinCsvBtn = document.getElementById('exportCheckinCsvBtn');
    if(exportCheckinCsvBtn) {
        exportCheckinCsvBtn.addEventListener('click', () => {
            const selectedId = checkinSelect ? checkinSelect.value : null;
            if(!selectedId) { alert('請先選擇活動'); return; }
            
            const ev = events.find(e => e.id === selectedId);
            const list = eventRegistrations.filter(r => r.eventId === selectedId);
            
            let csvContent = "\uFEFF"; // BOM for UTF-8 Excel
            csvContent += "表單流水號,姓名,電話,信箱,報名時間,報到狀態\n";
            list.forEach(r => {
                const s = r.status === 'checked-in' ? "已報到" : "未報到";
                const row = `"${r.id}","${r.userName}","${r.userPhone}","${r.userEmail}","${new Date(r.timestamp).toLocaleString('zh-TW')}","${s}"`;
                csvContent += row + "\n";
            });
            const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
            const link = document.createElement("a");
            link.href = URL.createObjectURL(blob);
            link.download = `活動報到名冊_${ev.name}_${new Date().toISOString().slice(0,10)}.csv`;
            link.click();
        });
    }

    // --- 最終啟動指令 ---
    initCustomCalendar();
    renderVenues();
    if (window.renderEventPreview) window.renderEventPreview();
    if (window.renderSchedule) window.renderSchedule();
});
