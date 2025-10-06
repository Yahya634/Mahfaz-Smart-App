from flask import Flask, render_template, request, jsonify
import os
import requests
from werkzeug.utils import secure_filename

app = Flask(__name__)
app.config['UPLOAD_FOLDER'] = 'uploads'
app.config['MAX_CONTENT_LENGTH'] = 16 * 1024 * 1024  # 16MB max file size

# تأكد من وجود مجلد التحميلات
os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/analyze-tajweed', methods=['POST'])
def analyze_tajweed():
    try:
        # الحصول على البيانات من الطلب
        ayah_text = request.form.get('ayah', '').strip()
        audio_file = request.files.get('audio_file')
        
        # التحقق من المدخلات
        if not ayah_text or len(ayah_text) < 5:
            return jsonify({
                'status': 'error',
                'message': 'يرجى إدخال الآية المرجعية كاملة.'
            }), 400
        
        if not audio_file:
            return jsonify({
                'status': 'error', 
                'message': 'لم يتم تسجيل أي صوت.'
            }), 400
        
        # حفظ الملف الصوتي مؤقتاً
        filename = secure_filename(audio_file.filename)
        filepath = os.path.join(app.config['UPLOAD_FOLDER'], filename)
        audio_file.save(filepath)
        
        # هنا يمكنك إضافة منطق التحليل التجويدي
        # باستخدام مكتبات مثل speechrecognition أو إرسال إلى API خارجي
        
        # مثال للرد (يجب استبداله بالمنطق الفعلي)
        report = """
        1. **الخطأ:** وجود خطأ في نطق حرف النون الساكنة
        2. **التصحيح العملي:** يجب إظهار النون دون غنة
        3. **القاعدة التجويدية:** قاعدة الإظهار الحلقي
        """
        
        # تنظيف الملف المؤقت
        if os.path.exists(filepath):
            os.remove(filepath)
        
        return jsonify({
            'status': 'success',
            'report': report
        })
        
    except Exception as e:
        return jsonify({
            'status': 'error',
            'message': f'حدث خطأ أثناء المعالجة: {str(e)}'
        }), 500

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5000)
