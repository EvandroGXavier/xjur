
const API_URL = 'http://localhost:3000/api/auth/login';

async function testLogin() {
  console.log(`Tentando login na API em ${API_URL}...`);
  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'admin@drx.local',
        password: '123456' // Senha resetada anteriormente
      })
    });

    if (response.ok) {
      const data = await response.json();
      console.log('✅ Login realizado com SUCESSO!');
      console.log('Token recebido:', data.access_token ? data.access_token.substring(0, 20) + '...' : 'Nenhum token');
      return true;
    } else {
      console.error(`❌ Falha no login. Status: ${response.status}`);
      const text = await response.text();
      console.error('Resposta:', text);
      return false;
    }
  } catch (error) {
    console.error('❌ Erro ao conectar na API:', error.message);
    return false;
  }
}

async function main() {
  let attempts = 0;
  const maxAttempts = 10;
  
  while (attempts < maxAttempts) {
    attempts++;
    console.log(`Tentativa ${attempts}/${maxAttempts}...`);
    const success = await testLogin();
    if (success) break;
    
    if (attempts < maxAttempts) {
        console.log('Aguardando 3 segundos para tentar novamente...');
        await new Promise(resolve => setTimeout(resolve, 3000));
    }
  }
}

main();
