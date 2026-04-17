
const axios = require('axios');

async function main() {
  const instance = '49cad3cc-bb68-47c2-95c5-de5ac49556c2';
  const apikey = 'JaJyX0tc3DvmPScDDRojSsguMSddVGeO';
  const baseURL = 'http://localhost:8080';
  
  // Testar 3 variantes de URL para ver qual Evolution aceita e consegue disparar
  const webhookUrls = [
    'http://localhost:3000/api/evolution/webhook',
    'http://host.docker.internal:3000/api/evolution/webhook'
  ];

  for (const url of webhookUrls) {
      console.log(`Setting webhook to: ${url}`);
      try {
        const payload = {
            webhook: {
              enabled: true,
              url: url,
              webhookByEvents: false,
              webhookBase64: true,
              events: [
                "QRCODE_UPDATED",
                "MESSAGES_UPSERT",
                "MESSAGES_UPDATE",
                "MESSAGES_DELETE",
                "SEND_MESSAGE",
                "CONNECTION_UPDATE",
                "PRESENCE_UPDATE"
              ]
            }
          };
          
          const response = await axios.post(`${baseURL}/webhook/set/${instance}`, payload, {
            headers: { apikey }
          });
          console.log(`Response for ${url}:`, JSON.stringify(response.data));
      } catch (e) {
          console.error(`Error for ${url}:`, e.message);
      }
  }
}

main();
