/**
 * ═══════════════════════════════════════════════════════════════════════════
 * المحفظ الذكي - Smart Quran Recitation Analyzer
 * JavaScript للتفاعل والتحكم
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * CODE CONVERSION NOTES - ملاحظات التحويل البرمجي
 * 
 * 1. #analyze-button (زر التسجيل والتحليل):
 *    - ينفذ طلب JavaScript fetch (POST) إلى API الخلفي
 *    - يرسل ملف الصوت المسجل + النص من حقل الإدخال
 *    - البيانات ترسل كـ FormData
 * 
 * 2. الحالة الخضراء 🟢 (أثناء التسجيل):
 *    - تغيير لون الزر إلى الأخضر
 *    - عرض رسالة "جاري التسجيل..." في منطقة الحالة
 *    - استخدام Web Audio API لالتقاط الصوت
 * 
 * 3. الحالة الحمراء 🔴 (أثناء التحليل):
 *    - تغيير لون الزر إلى الأحمر
 *    - عرض رسالة "جاري التحليل..."
 *    - إيقاف التسجيل وإرسال البيانات
 * 
 * 4. عرض النتيجة:
 *    - عرض تقرير Gemini API النصي في منطقة التقرير
 *    - تقسيم النتيجة إلى: الخطأ، التصحيح، القاعدة
 * ═══════════════════════════════════════════════════════════════════════════
 */

// ═══ Global Variables ═══
let mediaRecorder = null;
let audioChunks = [];
let recordingState = 'idle'; // 'idle', 'recording', 'analyzing', 'complete'

// ═══ DOM Elements ═══
const ayahInput = document.getElementById('ayah-input');
const analyzeButton = document.getElementById('analyze-button');
const buttonText = document.getElementById('button-text');
const statusArea = document.getElementById('status-area');
const statusMessage = document.getElementById('status-message');
const reportArea = document.getElementById('report-area');
const instructionsCard = document.getElementById('instructions-card');
const newRecordingBtn = document.getElementById('new-recording-btn');
const errorText = document.getElementById('error-text');
const correctionText = document.getElementById('correction-text');
const ruleText = document.getElementById('rule-text');

// ═══ Initialize App ═══
document.addEventListener('DOMContentLoaded', function() {
    // Enable/disable button based on input
    ayahInput.addEventListener('input', function() {
        analyzeButton.disabled = !ayahInput.value.trim();
    });

    // Main button click handler
    analyzeButton.addEventListener('click', handleButtonClick);

    // New recording button
    newRecordingBtn.addEventListener('click', resetApp);
});

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * MAIN FUNCTION: Handle Button Click
 * الدالة الرئيسية: معالجة النقر على الزر
 * ═══════════════════════════════════════════════════════════════════════════
 */
async function handleButtonClick() {
    if (recordingState === 'idle') {
        await startRecording();
    } else if (recordingState === 'recording') {
        stopRecording();
    }
}

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * FUNCTION: Start Audio Recording
 * الدالة: بدء التسجيل الصوتي
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * استخدام Web Audio API لالتقاط الصوت من الميكروفون
 */
async function startRecording() {
    try {
        // ═══ STEP 1: Request Microphone Access - طلب الوصول إلى الميكروفون ═══
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        
        // ═══ STEP 2: Create MediaRecorder - إنشاء مسجل الوسائط ═══
        mediaRecorder = new MediaRecorder(stream);
        audioChunks = [];

        // ═══ STEP 3: Collect Audio Data - جمع البيانات الصوتية ═══
        mediaRecorder.ondataavailable = (event) => {
            if (event.data.size > 0) {
                audioChunks.push(event.data);
            }
        };

        // ═══ STEP 4: Handle Recording Stop - معالجة إيقاف التسجيل ═══
        mediaRecorder.onstop = async () => {
            // Create audio blob
            const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
            
            // Send to backend
            await sendToBackendAPI(audioBlob, ayahInput.value);
            
            // Stop all tracks
            stream.getTracks().forEach(track => track.stop());
        };

        // ═══ STEP 5: Start Recording - بدء التسجيل ═══
        mediaRecorder.start();

        // ═══ UI UPDATE: Green State 🟢 - تحديث الواجهة: الحالة الخضراء ═══
        updateUIState('recording');

    } catch (error) {
        console.error('Error accessing microphone:', error);
        alert('لم يتم السماح بالوصول إلى الميكروفون. يرجى التحقق من الإعدادات.');
    }
}

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * FUNCTION: Stop Audio Recording
 * الدالة: إيقاف التسجيل الصوتي
 * ═══════════════════════════════════════════════════════════════════════════
 */
function stopRecording() {
    if (mediaRecorder && mediaRecorder.state === 'recording') {
        // ═══ UI UPDATE: Red State 🔴 - تحديث الواجهة: الحالة الحمراء ═══
        updateUIState('analyzing');
        
        // Stop recording
        mediaRecorder.stop();
    }
}

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * FUNCTION: Send to Backend API
 * الدالة: الإرسال إلى API الخلفي
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * هذه الدالة ترسل:
 * - ملف الصوت المسجل (audio file)
 * - النص المرجعي من حقل الإدخال (verse text)
 * 
 * إلى Backend API للتحليل باستخدام Gemini AI
 */
async function sendToBackendAPI(audioBlob, verseText) {
    try {
        // ═══ Create FormData - إنشاء FormData ═══
        const formData = new FormData();
        formData.append('audio', audioBlob, 'recording.webm');
        formData.append('verse', verseText);

        /**
         * ═══════════════════════════════════════════════════════════════════════
         * IMPORTANT: API Integration Point
         * المهم: نقطة التكامل مع API
         * ═══════════════════════════════════════════════════════════════════════
         * 
         * لتفعيل الاتصال الفعلي بالخادم الخلفي:
         * 
         * 1. استبدل 'YOUR_API_ENDPOINT' بعنوان API الحقيقي
         * 2. أضف API Key إذا لزم الأمر في headers
         * 3. عدل معالجة الاستجابة حسب شكل البيانات
         * 
         * مثال للطلب الفعلي:
         * 
         * const API_ENDPOINT = 'https://your-backend-api.com/analyze';
         * 
         * const response = await fetch(API_ENDPOINT, {
         *     method: 'POST',
         *     headers: {
         *         'Authorization': 'Bearer YOUR_API_KEY',
         *     },
         *     body: formData
         * });
         * 
         * if (!response.ok) {
         *     throw new Error(`HTTP error! status: ${response.status}`);
         * }
         * 
         * const data = await response.json();
         * displayResults(data);
         */

        // ═══ DEMO MODE: Simulated API Response - وضع التجربة: استجابة محاكاة ═══
        // احذف هذا الكود واستبدله بالكود أعلاه للإنتاج
        await simulateAPICall();

    } catch (error) {
        console.error('Error sending to API:', error);
        updateUIState('idle');
        alert('حدث خطأ أثناء إرسال البيانات. يرجى المحاولة مرة أخرى.');
    }
}

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * DEMO FUNCTION: Simulate API Call
 * دالة التجربة: محاكاة استدعاء API
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * هذه الدالة للتجربة فقط - استبدلها بطلب fetch حقيقي للإنتاج
 */
async function simulateAPICall() {
    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 2500));
    
    // Mock response data
    const mockResponse = {
        error: 'نطق حرف "الراء" كان مفخمًا في كلمة "رحيم" بينما يجب أن يكون مرققًا.',
        correction: 'انطق حرف "الراء" مرققًا (خفيفًا) في كلمة "رحيم" دون تفخيم. حاول أن تُبقي اللسان في وضع أقرب إلى الأسنان الأمامية.',
        rule: 'قاعدة الترقيق: يُرقق حرف الراء إذا جاء مكسورًا أو جاء بعد كسر أصلي غير مفصول بحرف استعلاء. في "الرَّحِيمِ" الراء مكسورة، لذا يجب ترقيقها.'
    };
    
    // Display results
    displayResults(mockResponse);
}

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * FUNCTION: Display Analysis Results
 * الدالة: عرض نتائج التحليل
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * @param {Object} data - البيانات من API
 * @param {string} data.error - وصف الخطأ
 * @param {string} data.correction - التصحيح العملي
 * @param {string} data.rule - القاعدة التجويدية
 */
function displayResults(data) {
    // Populate report sections
    errorText.textContent = data.error;
    correctionText.textContent = data.correction;
    ruleText.textContent = data.rule;
    
    // Show report area
    reportArea.classList.remove('hidden');
    
    // Hide instructions
    instructionsCard.classList.add('hidden');
    
    // Update state
    updateUIState('complete');
    
    // Scroll to report
    reportArea.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * FUNCTION: Update UI State
 * الدالة: تحديث حالة الواجهة
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * @param {string} state - الحالة الجديدة ('idle', 'recording', 'analyzing', 'complete')
 */
function updateUIState(state) {
    recordingState = state;
    
    // Remove all state classes
    analyzeButton.classList.remove('recording', 'analyzing');
    
    switch (state) {
        case 'idle':
            // Button state
            buttonText.textContent = 'ابدأ التسجيل والتحليل';
            analyzeButton.disabled = !ayahInput.value.trim();
            
            // Icon - Mic
            updateButtonIcon('mic');
            
            // Hide status
            statusArea.classList.add('hidden');
            
            break;
            
        case 'recording':
            // Button state - 🟢 Green
            buttonText.textContent = 'إيقاف التسجيل';
            analyzeButton.classList.add('recording');
            analyzeButton.disabled = false;
            
            // Icon - Mic Off
            updateButtonIcon('mic-off');
            
            // Show status - 🟢
            statusMessage.textContent = '🟢 جاري التسجيل...';
            statusArea.classList.remove('hidden');
            
            break;
            
        case 'analyzing':
            // Button state - 🔴 Red
            buttonText.textContent = 'جاري التحليل...';
            analyzeButton.classList.add('analyzing');
            analyzeButton.disabled = true;
            
            // Show status - 🔴
            statusMessage.textContent = '🔴 جاري التحليل...';
            
            break;
            
        case 'complete':
            // Button state
            analyzeButton.disabled = true;
            
            // Show status - ✅
            statusMessage.textContent = '✅ اكتمل التحليل';
            
            break;
    }
}

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * FUNCTION: Update Button Icon
 * الدالة: تحديث أيقونة الزر
 * ═══════════════════════════════════════════════════════════════════════════
 */
function updateButtonIcon(iconType) {
    const iconElement = analyzeButton.querySelector('.icon');
    
    if (iconType === 'mic') {
        iconElement.innerHTML = `
            <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/>
            <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
            <line x1="12" y1="19" x2="12" y2="22"/>
        `;
    } else if (iconType === 'mic-off') {
        iconElement.innerHTML = `
            <line x1="2" y1="2" x2="22" y2="22"/>
            <path d="M18.89 13.23A7.12 7.12 0 0 0 19 12v-2"/>
            <path d="M5 10v2a7 7 0 0 0 12 5"/>
            <path d="M15 9.34V5a3 3 0 0 0-5.68-1.33"/>
            <path d="M9 9v3a3 3 0 0 0 5.12 2.12"/>
            <line x1="12" y1="19" x2="12" y2="22"/>
        `;
    }
}

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * FUNCTION: Reset App
 * الدالة: إعادة تعيين التطبيق
 * ═══════════════════════════════════════════════════════════════════════════
 */
function resetApp() {
    // Reset state
    updateUIState('idle');
    
    // Hide report
    reportArea.classList.add('hidden');
    
    // Show instructions
    instructionsCard.classList.remove('hidden');
    
    // Clear form (optional)
    // ayahInput.value = '';
    
    // Scroll to top
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * UTILITY FUNCTIONS
 * الدوال المساعدة
 * ═══════════════════════════════════════════════════════════════════════════
 */

// Check browser compatibility
if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    console.error('Web Audio API is not supported in this browser');
    
    // Show error message to user
    document.addEventListener('DOMContentLoaded', function() {
        alert('متصفحك لا يدعم تسجيل الصوت. يرجى استخدام متصفح حديث مثل Chrome أو Firefox أو Safari.');
        analyzeButton.disabled = true;
        analyzeButton.textContent = 'المتصفح غير مدعوم';
    });
}

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * PRODUCTION INTEGRATION GUIDE
 * دليل التكامل للإنتاج
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * للتكامل مع Backend API الحقيقي:
 * 
 * 1. في دالة sendToBackendAPI:
 *    - استبدل simulateAPICall() بطلب fetch حقيقي
 *    - أضف عنوان API الخاص بك
 *    - أضف معالجة الأخطاء المناسبة
 * 
 * 2. شكل الطلب المتوقع (Request):
 *    POST /api/analyze
 *    Content-Type: multipart/form-data
 *    
 *    FormData:
 *    - audio: [File] (recording.webm)
 *    - verse: [String] (النص العربي)
 * 
 * 3. شكل الاستجابة المتوقع (Response):
 *    {
 *      "error": "وصف الخطأ",
 *      "correction": "التصحيح العملي",
 *      "rule": "القاعدة التجويدية"
 *    }
 * 
 * 4. معالجة الأخطاء:
 *    - تحقق من حالة HTTP
 *    - أضف رسائل خطأ مخصصة
 *    - سجل الأخطاء للتحليل
 * 
 * 5. الأمان:
 *    - لا تكشف API Keys في Frontend
 *    - استخدم HTTPS فقط
 *    - تحقق من صحة المدخلات
 *    - حدد حجم الملفات المسموح به
 * 
 * ═══════════════════════════════════════════════════════════════════════════
 */
