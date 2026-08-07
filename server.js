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

// TARAYICIDAN GİRİLDİĞİNDE SİTENİN AÇILMASINI SAĞLAYAN ANA ROTA
app.get('/', (req, res) => {
    res.send('DHL Backend Sunucusu Aktif ve Calisiyor!');
});

// Frontend'den gelen log kayitlarini alir
app.post('/api/log', (req, res) => {
    const { user, location, action } = req.body;
    const logs = readLogs();

    logs.push({
        timestamp: new Date().toLocaleString('tr-TR'),
        user: user || 'Bilinmeyen Kullanici',
        location: location || 'Genel',
        action: action
    });

    writeLogs(logs);
    console.log(`[LOG ALINDI] ${user} -> ${location}: ${action}`);
    res.status(200).json({ status: 'ok' });
});

// HER GÜN SAAT 14:30'DA MAİL ATAN OTOMASYON ('30 14 * * *')
cron.schedule('30 14 * * *', async () => {
    console.log("Saat 14:30 - Log maili hazirlaniyor...");
    const logs = readLogs();

    if (logs.length === 0) {
        console.log("Saat 14:30'a kadar kaydolan log bulunamadi.");
        return;
    }

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
        subject: `DHL Depo Gunluk Log Raporu (14:30) - ${new Date().toLocaleDateString('tr-TR')}`,
        text: `Merhaba,\n\nSaat 14:30'a kadar kaydedilen tum kullanici hareketleri ekteki dosyadadir.\n\nToplam Islem Sayisi: ${logs.length}`,
        attachments: [
            {
                filename: `dhl-log-${new Date().toISOString().split('T')[0]}.json`,
                content: JSON.stringify(logs, null, 2)
            }
        ]
    };

    try {
        await transporter.sendMail(mailOptions);
        console.log('Saat 14:30 log raporu Gmail adresine basariyla gonderildi!');
        writeLogs([]); // Mail gitti, günlük log sıfırlandı
    } catch (error) {
        console.error('Mail gonderme hatasi:', error);
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`DHL Backend Sunucusu ${PORT} portunda aktif!`));