import { ownerOnly, managementOrOwner, outletSalesRepresentativeOnly } from '../middleware/roleAuth.js';

function mockRes() {
  const res = {};
  res.status = (code) => {
    res.statusCode = code;
    return res;
  };
  res.json = (data) => {
    res.jsonData = data;
    return res;
  };
  return res;
}

function testMiddleware() {
  console.log('Testing role authentication middleware...');

  // 1. Test ownerOnly
  const reqOwner = { user: { role: 'Owner' } };
  const resOwner = mockRes();
  let calledNext = false;
  ownerOnly[1](reqOwner, resOwner, () => { calledNext = true; });
  if (!calledNext) {
    console.error('✗ Owner failed ownerOnly check');
    process.exit(1);
  }
  console.log('✓ Owner successfully passed ownerOnly');

  const reqStaff = { user: { role: 'Outlet Sales Representative' } };
  const resStaff = mockRes();
  calledNext = false;
  ownerOnly[1](reqStaff, resStaff, () => { calledNext = true; });
  if (calledNext || resStaff.statusCode !== 403) {
    console.error('✗ Outlet Sales Rep incorrectly bypassed ownerOnly check or returned wrong code:', resStaff.statusCode);
    process.exit(1);
  }
  console.log('✓ Outlet Sales Rep successfully blocked by ownerOnly');

  // 2. Test managementOrOwner
  const reqMgmt = { user: { role: 'Management' } };
  const resMgmt = mockRes();
  calledNext = false;
  managementOrOwner[1](reqMgmt, resMgmt, () => { calledNext = true; });
  if (!calledNext) {
    console.error('✗ Management failed managementOrOwner check');
    process.exit(1);
  }
  console.log('✓ Management successfully passed managementOrOwner');

  // 3. Test outletSalesRepresentativeOnly
  const reqRep = { user: { role: 'Outlet Sales Representative' } };
  const resRep = mockRes();
  calledNext = false;
  outletSalesRepresentativeOnly[1](reqRep, resRep, () => { calledNext = true; });
  if (!calledNext) {
    console.error('✗ Outlet Sales Rep failed outletSalesRepresentativeOnly check');
    process.exit(1);
  }
  console.log('✓ Outlet Sales Rep successfully passed outletSalesRepresentativeOnly');

  console.log('All middleware checks passed successfully!');
  process.exit(0);
}

testMiddleware();
