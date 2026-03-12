const axios = require('axios');
const headers = { 'Content-Type': 'application/json', 'apikey': 'CHANGE_THIS_API_KEY' };
const EVOLUTION_API_URL = 'http://localhost:8080';

async function testConnection() {
    try {
        const instanceName = 'test_poll_' + Date.now();
        console.log('Creating instance:', instanceName);
        await axios.post(`${EVOLUTION_API_URL}/instance/create`, {
            instanceName,
            qrcode: true,
            integration: 'WHATSAPP-BAILEYS'
        }, { headers });

        console.log('Instance created. Polling /instance/connect for 15s...');
        for (let i = 0; i < 15; i++) {
            await new Promise(r => setTimeout(r, 1000));
            const connectRes = await axios.get(`${EVOLUTION_API_URL}/instance/connect/${instanceName}`, { headers });
            const data = connectRes.data;
            if (data.base64 || (data.qrcode && data.qrcode.base64)) {
                console.log('QR Code received in second', i);
                return;
            }
            console.log('Poll', i, data);
        }
    } catch (e) {
        console.error(e.response ? e.response.data : e.message);
    }
}
testConnection();
