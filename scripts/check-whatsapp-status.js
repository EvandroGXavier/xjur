
const axios = require('axios');

async function check() {
  try {
    console.log('Fetching WhatsApp debug info...');
    const res = await axios.get('http://localhost:3000/whatsapp/debug');
    console.log(JSON.stringify(res.data, null, 2));
  } catch (error) {
    console.error('Error fetching debug info:', error.message);
    if (error.response) {
      console.error('Create Status:', error.response.status);
      console.error('Data:', error.response.data);
    }
  }
}

check();
