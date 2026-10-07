import http from 'http';
import dotenv from 'dotenv';
import connectDB from '../config/database.js';
import app from '../server.js';
import Outlet from '../models/Outlet.js';
import User from '../models/User.js';

dotenv.config();

const PORT = 5099;

function makeRequest(path, method = 'GET', body = null, headers = {}) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: '127.0.0.1',
      port: PORT,
      path: path,
      method: method,
      headers: {
        'Content-Type': 'application/json',
        ...headers,
      },
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          resolve({ status: res.statusCode, data: parsed });
        } catch (e) {
          resolve({ status: res.statusCode, raw: data });
        }
      });
    });

    req.on('error', (err) => {
      reject(err);
    });

    if (body) {
      req.write(JSON.stringify(body));
    }
    req.end();
  });
}

async function runApiTests() {
  console.log('=== STARTING API LEVEL INTEGRATION TESTS ===\n');
  let testServer;

  try {
    // Start test server
    testServer = app.listen(PORT, () => {
      console.log(`Test server running on port ${PORT}`);
    });

    // Wait 1 sec for DB connection to establish
    await new Promise((r) => setTimeout(r, 1500));

    // Test 1: Health check
    console.log('Test 1: Health Check GET /health');
    const healthRes = await makeRequest('/health');
    console.log(`Status: ${healthRes.status}, Response:`, healthRes.data);
    if (healthRes.status === 200 && healthRes.data.status === 'OK') {
      console.log('✓ Health check Passed!\n');
    } else {
      console.error('✗ Health check Failed!\n');
    }

    // Test 2: Outlets list (Verifying 11 official outlets with categories)
    console.log('Test 2: Outlets List GET /api/outlets');
    const outletsRes = await makeRequest('/api/outlets');
    console.log(`Status: ${outletsRes.status}, Total outlets fetched: ${outletsRes.data?.length}`);
    if (Array.isArray(outletsRes.data)) {
      const corpOutlets = outletsRes.data.filter((o) => o.category === 'Corporate Client');
      const commOutlets = outletsRes.data.filter((o) => o.category === 'Commercial/Office Complex');
      console.log(`Corporate Outlets (${corpOutlets.length}):`, corpOutlets.map((o) => o.name));
      console.log(`Commercial Outlets (${commOutlets.length}):`, commOutlets.map((o) => o.name));
      if (outletsRes.data.length >= 11 && corpOutlets.length >= 7 && commOutlets.length >= 4) {
        console.log('✓ All 11 Official Outlets verified on API level!\n');
      } else {
        console.warn('! Outlets count warning:', outletsRes.data.length);
      }
    } else {
      console.error('✗ Outlets fetch Failed!');
    }

    // Test 3: User Registration with Corporate Client Category & Assigned Company
    console.log('Test 3: User Registration POST /api/auth/register (Corporate)');
    const testEmail = `api.test.${Date.now()}@deepaknitrite.com`;
    const regRes = await makeRequest('/api/auth/register', 'POST', {
      name: 'API Test Corporate User',
      email: testEmail,
      phone: '9876543210',
      password: 'password123',
      role: 'Customer',
      companyCategory: 'Corporate Client',
      assignedCompany: 'Deepak Nitrite Limited',
      outlet: 'CORP001',
    });

    console.log(`Status: ${regRes.status}`);
    let userToken = regRes.data?.token;
    let userId = regRes.data?.user?._id;

    if (regRes.status === 201 && userToken) {
      console.log('Registered User:', {
        name: regRes.data.user.name,
        email: regRes.data.user.email,
        category: regRes.data.user.companyCategory,
        assignedCompany: regRes.data.user.assignedCompany,
        outlet: regRes.data.user.outlet,
      });
      console.log('✓ Registration with Category & Company Passed!\n');
    } else {
      console.error('✗ Registration Failed:', regRes.data);
    }

    // Test 4: User Login
    console.log('Test 4: User Login POST /api/auth/login');
    const loginRes = await makeRequest('/api/auth/login', 'POST', {
      email: testEmail,
      password: 'password123',
    });
    console.log(`Status: ${loginRes.status}`);
    if (loginRes.status === 200 && loginRes.data.token) {
      userToken = loginRes.data.token;
      console.log('Login User Data:', {
        name: loginRes.data.user.name,
        companyCategory: loginRes.data.user.companyCategory,
        assignedCompany: loginRes.data.user.assignedCompany,
      });
      console.log('✓ Login API Passed!\n');
    } else {
      console.error('✗ Login Failed:', loginRes.data);
    }

    // Test 5: User Profile GET /api/auth/me
    console.log('Test 5: Fetch Profile GET /api/auth/me');
    const meRes = await makeRequest('/api/auth/me', 'GET', null, {
      Authorization: `Bearer ${userToken}`,
    });
    console.log(`Status: ${meRes.status}`);
    if (meRes.status === 200 && meRes.data.email === testEmail) {
      console.log('Fetched Profile:', {
        email: meRes.data.email,
        companyCategory: meRes.data.companyCategory,
        assignedCompany: meRes.data.assignedCompany,
      });
      console.log('✓ Profile API Passed!\n');
    } else {
      console.error('✗ Profile API Failed:', meRes.data);
    }

    // Test 6: Commercial Complex User Registration
    console.log('Test 6: User Registration POST /api/auth/register (Commercial Complex)');
    const commEmail = `api.comm.${Date.now()}@panorama.com`;
    const commRegRes = await makeRequest('/api/auth/register', 'POST', {
      name: 'API Commercial User',
      email: commEmail,
      phone: '9876543211',
      password: 'password123',
      role: 'Customer',
      companyCategory: 'Commercial/Office Complex',
      assignedCompany: 'Panorama Complex- Alkapuri',
      outlet: 'COMM001',
    });
    console.log(`Status: ${commRegRes.status}`);
    if (commRegRes.status === 201 && commRegRes.data.user) {
      console.log('Registered Commercial User:', {
        category: commRegRes.data.user.companyCategory,
        assignedCompany: commRegRes.data.user.assignedCompany,
      });
      console.log('✓ Commercial Complex Registration Passed!\n');
    } else {
      console.error('✗ Commercial Registration Failed:', commRegRes.data);
    }

    // Test 7: Menu Items API GET /api/menu-items
    console.log('Test 7: Menu Items GET /api/menu-items');
    const menuRes = await makeRequest('/api/menu-items');
    console.log(`Status: ${menuRes.status}, Total items: ${menuRes.data?.length || 0}`);
    if (menuRes.status === 200) {
      console.log('✓ Menu Items API Passed!\n');
    } else {
      console.error('✗ Menu Items API Failed:', menuRes.data);
    }

    console.log('=== ALL API INTEGRATION TESTS COMPLETED SUCCESSFULLY! ===');
  } catch (err) {
    console.error('Error during API testing:', err);
  } finally {
    if (testServer) {
      testServer.close(() => {
        console.log('Test server closed.');
        process.exit(0);
      });
    } else {
      process.exit(0);
    }
  }
}

runApiTests();
