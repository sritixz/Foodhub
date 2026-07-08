import mongoose from 'mongoose';
import User from '../models/User.js';

async function test() {
  console.log('Testing User model role validations...');
  
  // Test invalid role (legacy role)
  const legacyUser = new User({
    name: 'Test Legacy',
    email: 'legacy@test.com',
    phone: '1234567890',
    password: 'password123',
    role: 'Admin' // should be invalid now
  });
  
  const validationError = legacyUser.validateSync();
  if (validationError && validationError.errors.role) {
    console.log('✓ Successfully rejected legacy role "Admin":', validationError.errors.role.message);
  } else {
    console.error('✗ Failed to reject legacy role "Admin"');
    process.exit(1);
  }
  
  // Test valid role (new role)
  const newRoleUser = new User({
    name: 'Test Owner',
    email: 'owner@test.com',
    phone: '1234567890',
    password: 'password123',
    role: 'Owner' // should be valid now
  });
  
  const validationErrorValid = newRoleUser.validateSync();
  if (!validationErrorValid || !validationErrorValid.errors.role) {
    console.log('✓ Successfully accepted new role "Owner"');
  } else {
    console.error('✗ Failed to accept new role "Owner":', validationErrorValid.errors.role.message);
    process.exit(1);
  }

  // Test other new roles
  const rolesToTest = ['Management', 'Central Kitchen Manager', 'Outlet Sales Representative', 'Driver', 'Investment Partner', 'Non-Core Staff', 'Customer'];
  for (const role of rolesToTest) {
    const user = new User({
      name: `Test ${role}`,
      email: `${role.toLowerCase().replace(/ /g, '')}@test.com`,
      phone: '1234567890',
      password: 'password123',
      role: role
    });
    const error = user.validateSync();
    if (!error || !error.errors.role) {
      console.log(`✓ Successfully accepted role "${role}"`);
    } else {
      console.error(`✗ Failed to accept role "${role}":`, error.errors.role.message);
      process.exit(1);
    }
  }

  console.log('All validation checks passed!');
  process.exit(0);
}

test().catch(err => {
  console.error(err);
  process.exit(1);
});
