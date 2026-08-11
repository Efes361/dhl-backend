const express = require('express');
const cors = require('cors');
const fs = require('fs');
const cron = require('node-cron');
const nodemailer = require('nodemailer');

const app = express();
app.use(cors());
app.use(express.json());

const LOG_FILE = './daily_logs.json';

function readLogs() {
    if (!fs.existsSync(LOG_FILE)) return [];
    try {
        const data = fs.readFileSync(LOG_FILE, 'utf8');
        return JSON.parse(data);
    } catch (e) {
        return [];
    }
}

function writeLogs(logs) {
    fs.writeFileSync(LOG_FILE, JSON.stringify(logs, null, 2), 'utf8');
}

// Logları Excel / CSV formatına dönüştüren yardımcı fonksiyon
function generateCSV(logs) {
    const header = "Tarih/Saat,Kullanici,Konum,Islem\n";
    const rows = logs.map(l => `"${l.timestamp}","${l.user}","${l.location}","${l.action}"`).join("\n");
    return "\uFEFF" + header + rows; // \uFEFF Excel Türkçe karakter desteği için
}

// Mail Gönderme İşlemi
async function sendLogEmail() {
    console.log("Log maili hazirlaniyor...");
    const logs = readLogs();

    if (logs.length === 0) {
        console.log("Gönderilecek log kaydı bulunamadı.");
        return { success: false, message: "Gönderilecek log kaydı yok." };
    }

    const csvData = generateCSV(logs);

    let transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
            user: 'efet7582@gmail.com',
            pass: 'ncpahjuhsschhogf'
        }
    });

    let mailOptions = {
        from: '"DHL Depo Log Otomasyonu" <efet7582@gmail.com>',
        to: 'efet7582@gmail.com',
        subject: `DHL Depo Günlük Log Raporu - ${new Date().toLocaleDateString('tr-TR')}`,
        text: `Merhaba,\n\nKaydedilen tüm kullanıcı hareketleri Excel (CSV) formatında ekte yer almaktadır.\n\nToplam İşlem Sayısı: ${logs.length}`,
        attachments: [
            {
                filename: `dhl-log-${new Date().toISOString().split('T')[0]}.csv`,
                content: csvData,
                contentType: 'text/csv'
            }
        ]
    };

    try {
        await transporter.sendMail(mailOptions);
        console.log('Log raporu Gmail adresine başarıyla gönderildi!');
        writeLogs([]); // Mail gidince logları temizle
        return { success: true, message: "Mail başarıyla gönderildi!" };
    } catch (error) {
        console.error('Mail gönderme hatası:', error);
        throw error;
    }
}

// ANA ROTA
app.get('/', (req, res) => {
    res.send('DHL Backend Sunucusu Aktif ve Çalışıyor!');
});

// LOG KAYIT ROTASI
app.post('/api/log', (req, res) => {
    const { user, location, action } = req.body;
    const logs = readLogs();

    logs.push({
        timestamp: new Date().toLocaleString('tr-TR'),
        user: user || 'Bilinmeyen Kullanıcı',
        location: location || 'Genel',
        action: action || 'İşlem Yok'
    });

    writeLogs(logs);
    console.log(`[LOG ALINDI] ${user} -> ${location}: ${action}`);
    res.status(200).json({ status: 'ok' });
});

// DIŞARIDAN VEYA TEST İÇİN MAIL TETİKLEME ROTASI
app.get('/api/send-mail', async (req, res) => {
    try {
        const result = await sendLogEmail();
        res.status(200).json(result);
    } catch (err) {
        res.status(500).json({ error: err.toString() });
    }
});

// SUNUCU İÇİ CRON (Uyumadığı sürece çalışır)
cron.schedule('30 14 * * *', async () => {
    console.log("Saat 14:30 - Otomatik mail tetiklendi.");
    await sendLogEmail();
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`DHL Backend Sunucusu ${PORT} portunda aktif!`));