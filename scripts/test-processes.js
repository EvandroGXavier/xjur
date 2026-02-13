
const axios = require('axios');
const fs = require('fs');

const API_URL = 'http://localhost:3000/api';
// Default dev user
const USER = { email: 'admin@drx.local', password: '123' };

async function run() {
    let token = '';
    let processId = '';
    let contactId = '';

    console.log('--- STARTING AUDIT TEST ---');

    try {
        // 1. Authenticate
        console.log('[1] Logging in...');
        try {
            const resLogin = await axios.post(`${API_URL}/auth/login`, USER);
            token = resLogin.data.access_token;
            console.log(' SUCCESS: Logged in.');
        } catch (e) {
            console.log(' Failed to login:', e.response?.data || e.message);
            console.log(' Attempting register...');
            try {
                const resReg = await axios.post(`${API_URL}/auth/register`, { ...USER, name: 'Admin', document: '00000000000' });
                token = resReg.data.token;
                console.log(' SUCCESS: Registered & Logged in.');
            } catch (errReg) {
                console.error(' FATAL: Could not login or register.', errReg.response?.data || errReg.message);
                return;
            }
        }

        const api = axios.create({
            baseURL: API_URL,
            headers: { Authorization: `Bearer ${token}` }
        });

        // 2. Create Contact (Minimal)
        console.log('[2] Creating Test Contact...');
        const resContact = await api.post('/contacts', {
            name: 'Teste Cliente Audit',
            email: 'cliente@teste.com',
            personType: 'PF',
            document: '12345678909'
        });
        contactId = resContact.data.id;
        console.log(' SUCCESS: Contact Created. ID:', contactId);

        // 3. Create Process (Judicial)
        console.log('[3] Creating Judicial Process...');
        const cnj = `000${Date.now().toString().slice(-10)}.8.13.0024`; // Pseudo CNJ
        const resJudicial = await api.post('/processes', {
            title: 'Processo Judicial Teste Audit',
            cnj: cnj,
            category: 'JUDICIAL',
            status: 'ATIVO',
            value: 50000.00
        });
        processId = resJudicial.data.id;
        console.log(' SUCCESS: Judicial Process Created. ID:', processId);

        // 4. Update Process
        console.log('[4] Updating Process...');
        await api.patch(`/processes/${processId}`, {
            description: 'Updated Description via Audit Script',
            folder: 'http://drive.google.com/test'
        });
        console.log(' SUCCESS: Process Updated.');

        // 5. Create Process (Extrajudicial / Consultive) - Testing fix
        console.log('[5] Creating Extrajudicial Process...');
        const resExtra = await api.post('/processes', {
            title: 'Caso Consultivo Teste Audit',
            category: 'EXTRAJUDICIAL',
            status: 'EM_ANDAMENTO'
        });
        console.log(' SUCCESS: Extrajudicial Process Created. Code:', resExtra.data.code);

        // 6. Add Timeline Entry with Attachment
        console.log('[6] Adding Timeline Entry...');
        const formData = new FormData(); // Node's FormData needs spec handling or mock direct payload if JSON allowed not suitable.
        // Actually timeline is usually JSON + separate upload or JSON only first.
        // Let's check logic: ProcessoAndamentos uses POST /processes/:id/timelines
        await api.post(`/processes/${processId}/timelines`, {
            title: 'Andamento Teste',
            description: 'Descrição do andamento',
            date: new Date().toISOString(),
            type: 'MOVEMENT'
        });
        console.log(' SUCCESS: Timeline Added.');

        // 7. Add Party
        console.log('[7] Adding Party to Process...');
        // Need a Role ID first. fetch or create.
        const roles = await api.get(`/processes/party-roles`);
        const roleId = roles.data[0]?.id; // Take first available role
        if (!roleId) throw new Error('No roles found');

        await api.post(`/processes/${processId}/parties`, {
            contactId,
            roleId,
            isClient: true
        });
        console.log(' SUCCESS: Party Added.');

        // 8. Create Appointment linked to Process
        console.log('[8] Creating Appointment for Process...');
        await api.post('/appointments', {
            title: 'Audiência de Teste',
            type: 'AUDIENCIA',
            startAt: new Date(Date.now() + 86400000).toISOString(), // Tomorrow
            endAt: new Date(Date.now() + 90000000).toISOString(),
            processId: processId,
            description: 'Audiência criada via script de auditoria'
        });
        console.log(' SUCCESS: Appointment Created.');

        // 9. List Processes to verify
        console.log('[9] Listing Processes...');
        const list = await api.get('/processes');
        if (list.data.length < 2) throw new Error('Expected at least 2 processes');
        console.log(` SUCCESS: Found ${list.data.length} processes.`);

        console.log('--- ALL TESTS PASSED SUCCESSFULLY ---');

    } catch (err) {
        console.error(' FAIL:', err.response?.data || err.message);
        process.exit(1);
    }
}

run();
