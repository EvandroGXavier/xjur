
const axios = require('axios');

const API_URL = 'http://localhost:3000';
const EMAIL = 'admin@admin.com'; // Adjust as needed
const PASSWORD = 'admin'; // Adjust as needed

async function testKanbanFlow() {
  try {
    console.log('1. Login...');
    const loginRes = await axios.post(`${API_URL}/auth/login`, {
      email: EMAIL,
      password: PASSWORD
    });
    const token = loginRes.data.access_token;
    console.log('✅ Login success');

    const headers = { Authorization: `Bearer ${token}` };

    console.log('2. Fetch Tickets for Kanban...');
    const ticketsRes = await axios.get(`${API_URL}/tickets`, { headers });
    console.log(`✅ Fetched ${ticketsRes.data.length} tickets`);
    
    if (ticketsRes.data.length > 0) {
        const ticketId = ticketsRes.data[0].id;
        const currentStatus = ticketsRes.data[0].status;
        const newStatus = currentStatus === 'OPEN' ? 'IN_PROGRESS' : 'OPEN';

        console.log(`3. Update Ticket ${ticketId} status from ${currentStatus} to ${newStatus}...`);
        await axios.patch(`${API_URL}/tickets/${ticketId}/status`, { status: newStatus }, { headers });
        console.log('✅ Status update success');

        // Revert
        console.log('4. Reverting status...');
        await axios.patch(`${API_URL}/tickets/${ticketId}/status`, { status: currentStatus }, { headers });
        console.log('✅ Revert success');
    } else {
        console.log('⚠️ No tickets to test status update.');
    }

  } catch (error) {
    console.error('❌ Test failed:', error.response ? error.response.data : error.message);
  }
}

testKanbanFlow();
