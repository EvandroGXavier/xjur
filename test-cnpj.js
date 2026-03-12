const axios = require('axios');

async function testCnpj(cnpj) {
  console.log(`Testing CNPJ: ${cnpj}`);
  
  try {
    console.log('--- ReceitaWS ---');
    const res1 = await axios.get(`https://receitaws.com.br/v1/cnpj/${cnpj}`, { timeout: 5000 });
    console.log('ReceitaWS Success:', res1.data.status);
    if (res1.data.status === 'ERROR') {
        console.log('ReceitaWS Error Message:', res1.data.message);
    }
  } catch (e) {
    console.log('ReceitaWS Error:', e.message);
    if (e.response) {
      console.log('ReceitaWS Response Data:', e.response.data);
      console.log('ReceitaWS Status:', e.response.status);
    }
  }

  try {
    console.log('\n--- BrasilAPI ---');
    const res2 = await axios.get(`https://brasilapi.com.br/api/cnpj/v1/${cnpj}`, { timeout: 10000 });
    console.log('BrasilAPI Success. Razao Social:', res2.data.razao_social);
  } catch (e) {
    console.log('BrasilAPI Error:', e.message);
    if (e.response) {
      console.log('BrasilAPI Response Data:', e.response.data);
      console.log('BrasilAPI Status:', e.response.status);
    }
  }
}

testCnpj('18236120000158'); // Nubank CNPJ for testing
