
const axios = require('axios');

async function testSend() {
  const connectionId = 'fd7b13dc-ad56-4771-a784-b45f30943ef3';
  const phone = '553183357429';

  console.log(`Sending message via API to ${phone}...`);

  try {
    const response = await axios.post('http://localhost:3000/api/whatsapp/send', {
      connectionId,
      to: phone,
      message: 'Teste com Link: https://google.com'
    });

    console.log('✅ Response:', response.data);
  } catch (error) {
    if (error.response) {
      console.error('❌ Server Error:', error.response.status, error.response.data);
    } else {
      console.error('❌ Network Error:', error.message);
    }
  }
}

testSend();
