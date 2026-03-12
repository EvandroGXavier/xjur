const axios = require('axios');

async function testLocalApi() {
  try {
     console.log('Hitting local API...');
     // Must include the /api global prefix configured in main.ts!
     const res = await axios.get('http://localhost:3000/api/contacts/enrich/cnpj?cnpj=18236120000158', {
       headers: {
         'Accept': 'application/json'
       }
     });
     console.log('Success API response!');
     console.log(res.data);
  } catch(e) {
     console.log('Error hitting local API:', e.message);
     if (e.response) {
         console.log('Error details:');
         console.log(JSON.stringify(e.response.data, null, 2));
         console.log('Status:', e.response.status);
     } else if (e.request) {
         console.log('No response received (Network error/Timeout)');
     }
  }
}

testLocalApi();
