const fs = require('fs');
const axios = require('axios');
const FormData = require('form-data');
const path = require('path');

const API_URL = 'http://localhost:3000/api';
const EMAIL = 'evandro@conectionmg.com.br';
const PASSWORD = '572811Egx@';

async function runTest() {
    try {
        console.log('1. Logging in...');
        const authResponse = await axios.post(`${API_URL}/auth/login`, {
            email: EMAIL,
            password: PASSWORD
        });
        const token = authResponse.data.access_token;
        console.log('   Login successful.');

        // Configure axios with token
        const client = axios.create({
            baseURL: API_URL,
            headers: { Authorization: `Bearer ${token}` }
        });

        const uniqueId = Math.floor(Math.random() * 10000000000).toString().padStart(11, '0');
        const csvContent = `Nome,Email,Telefone,CPF\nTeste Importacao Node ${uniqueId},import.${uniqueId}@exemple.com,11988887777,${uniqueId}`;
        const filePath = path.join(__dirname, 'test_import.csv');
        fs.writeFileSync(filePath, csvContent);
        console.log('   CSV created at', filePath);

        console.log('3. Uploading file...');
        const formData = new FormData();
        formData.append('file', fs.createReadStream(filePath));
        
        const uploadResponse = await client.post('/contacts/import/upload', formData, {
            headers: {
                ...formData.getHeaders()
            }
        });
        console.log('   Upload successful. Headers detected:', uploadResponse.data.headers);
        const previewData = uploadResponse.data.data;

        console.log('4. Executing Import...');
        // Map columns
        const mapping = {
            name: 'Nome',
            email: 'Email',
            phone: 'Telefone',
            document: 'CPF',
            personType: 'PF'
        };

        const importPayload = {
            data: previewData,
            mapping: mapping,
            duplicateAction: 'skip'
        };

        const executeResponse = await client.post('/contacts/import/execute', importPayload);
        console.log('   Import execution finished:', executeResponse.data);

        if (executeResponse.data.success > 0) {
            console.log('✅ TEST PASSED: Contact imported successfully.');
        } else {
            console.error('❌ TEST FAILED: No contacts imported.', executeResponse.data);
        }

    } catch (error) {
        console.error('❌ ERROR:', error.response ? error.response.data : error.message);
    }
}

runTest();
