# ** يجب استبدال هذا الرابط برابط الخادم الذي سيستضيف ملف app.py **

const API_ENDPOINT_URL = 'https://your-api-domain.com/analyze-tajweed'; 

// المعرفات (IDs) التي يجب أن تتطابق مع تصميم Figma
const elements = {
    ayahInput: document.getElementById('ayah-input'),
    analyzeButton: document.getElementById('analyze-button'),
    statusArea: document.getElementById('status-area'),
    reportArea: document.getElementById('report-area'),
};

// متغيرات التسجيل
let mediaRecorder;
let audioChunks = [];
let recordedAudioBlob = null; // سيتم تخزين ملف الصوت هنا

// -----------------------------------------------------------------
// A. دوال التعامل مع واجهة المستخدم
// -----------------------------------------------------------------

function updateStatus(message, color) {
    elements.statusArea.textContent = message;
    elements.statusArea.style.color = color;
    elements.statusArea.style.fontWeight = 'bold';
}

function resetUI() {
    elements.analyzeButton.textContent = 'ابدأ التسجيل والتحليل';
    elements.analyzeButton.disabled = false;
    elements.analyzeButton.style.backgroundColor = '#2ecc71'; // لون أخضر مبدئي
    updateStatus('جاهز للبدء. الرجاء إدخال الآية.', 'black');
    elements.reportArea.innerHTML = ''; // مسح النتائج السابقة
}

// -----------------------------------------------------------------
// B. دوال التسجيل الصوتي (MediaRecorder API)
// -----------------------------------------------------------------

async function startRecording() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        mediaRecorder = new MediaRecorder(stream);
        audioChunks = [];

        mediaRecorder.ondataavailable = event => {
            audioChunks.push(event.data);
        };

        mediaRecorder.onstop = () => {
            // إنشاء ملف الصوت (Blob) عند الإيقاف
            recordedAudioBlob = new Blob(audioChunks, { type: 'audio/wav' });
            stream.getTracks().forEach(track => track.stop()); // إيقاف الميكروفون فعلياً
            analyzeTajweed(); // الانتقال إلى التحليل مباشرة
        };

        mediaRecorder.start();
        updateStatus('🟢 جاري التسجيل. انقر للإيقاف.', 'green');
        elements.analyzeButton.textContent = 'إيقاف التسجيل';
        elements.analyzeButton.style.backgroundColor = 'red';
        
    } catch (err) {
        console.error('فشل الوصول للميكروفون:', err);
        updateStatus('❌ فشل الوصول للميكروفون. يرجى السماح بالوصول.', 'red');
    }
}

function stopRecording() {
    if (mediaRecorder && mediaRecorder.state === 'recording') {
        mediaRecorder.stop();
        elements.analyzeButton.disabled = true; // تعطيل الزر لمنع الضغط مرة أخرى أثناء التحليل
    }
}

// -----------------------------------------------------------------
// C. دالة الربط بـ API (Fetch Request)
// -----------------------------------------------------------------

async function analyzeTajweed() {
    const ayahText = elements.ayahInput.value.trim();
    
    if (!ayahText || ayahText.length < 5) {
        updateStatus("❌ يرجى إدخال الآية المرجعية كاملة.", 'red');
        resetUI();
        return;
    }

    if (!recordedAudioBlob) {
         updateStatus("❌ لم يتم تسجيل أي صوت.", 'red');
         resetUI();
         return;
    }

    updateStatus("جاري التحليل... (🔴)", "red");
    elements.analyzeButton.textContent = 'جاري التحليل...';

    // إرسال البيانات
    const formData = new FormData();
    formData.append('ayah', ayahText);
    formData.append('audio_file', recordedAudioBlob, 'talaawa.wav'); 

    try {
        const response = await fetch(API_ENDPOINT_URL, {
            method: 'POST',
            body: formData, 
        });

        const result = await response.json();

        if (response.ok) {
            // النجاح في التحليل
            if (result.status === 'success') {
                displayReport(result.report);
                updateStatus("✅ اكتمل التحليل بنجاح!", "green");
            }
        } else {
            // خطأ من الخادم (مثل: التلاوة لا تطابق الآية المطلوبة)
            displayError(result.message || "حدث خطأ في الخادم.");
        }
    } catch (error) {
        console.error('Fetch error:', error);
        updateStatus("❌ فشل الاتصال بالخادم. تحقق من الرابط.", "red");
    } finally {
        recordedAudioBlob = null; // مسح الملف الصوتي بعد الانتهاء
        resetUI();
    }
}

// -----------------------------------------------------------------
// D. دوال عرض النتائج
// -----------------------------------------------------------------

function displayReport(report) {
    // هذه الدالة تحتاج لمعالجة النص الناتج من Gemini وتقسيمه لعرضه
    // في الأقسام الثلاثة (#report-area) في تصميمك.
    
    // تقسيم النص يدوياً بناءً على العناوين (1. الخطأ: 2. التصحيح العملي: 3. القاعدة التجويدية:)
    // هنا مثال بسيط:
    report = report.replace(/\n/g, '<br>'); // استبدال الأسطر الجديدة بـ <br>
    report = report.replace('1. **الخطأ:**', '<h3>1. الخطأ:</h3>');
    report = report.replace('2. **التصحيح العملي:**', '<h3>2. التصحيح العملي:</h3>');
    report = report.replace('3. **القاعدة التجويدية:**', '<h3>3. القاعدة التجويدية:</h3>');
    
    elements.reportArea.innerHTML = `<h2>تقرير المحفظ الذكي</h2><div style="padding: 15px; border: 1px solid #ccc; background-color: #f9f9f9;">${report}</div>`;
}

function displayError(message) {
    elements.reportArea.innerHTML = `<p style="color:red; font-weight: bold;">❌ خطأ: ${message}</p>`;
}

// -----------------------------------------------------------------
// E. التهيئة (بدء تشغيل التطبيق)
// -----------------------------------------------------------------

document.addEventListener('DOMContentLoaded', () => {
    // ربط زر التحليل بوظيفة التبديل بين التسجيل والإيقاف
    elements.analyzeButton.addEventListener('click', () => {
        if (elements.analyzeButton.textContent.includes('ابدأ التسجيل')) {
            startRecording();
        } else if (elements.analyzeButton.textContent.includes('إيقاف التسجيل')) {
            stopRecording();
        }
    });

    resetUI();

});
