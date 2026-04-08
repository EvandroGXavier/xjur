import axios from 'axios'

async function testApiLogin() {
  const url = 'http://localhost:3000/api/auth/login'
  const data = {
    email: 'evandro@conectionmg.com.br',
    password: '123456'
  }
  
  console.log(`Tentando login via HTTP POST em ${url}...`)
  
  try {
    const response = await axios.post(url, data)
    console.log('SUCESSO! A API local aceitou as credenciais.')
    console.log('Status:', response.status)
    console.log('User:', response.data.user.name)
  } catch (error: any) {
    console.log('ERRO ao tentar login via API:')
    if (error.response) {
      console.log('Status:', error.response.status)
      console.log('Data:', error.response.data)
    } else {
      console.log('Mensagem:', error.message)
    }
  }
}

testApiLogin()
