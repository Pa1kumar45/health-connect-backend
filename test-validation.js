/**
 * Validation Testing Script
 * 
 * Tests all validation rules for authentication endpoints
 * Run with: node test-validation.js
 */

const BASE_URL = 'http://localhost:5000/api/auth';

// Test cases for registration validation
const registrationTests = [
  {
    name: 'Test 1: Weak password (no uppercase)',
    data: {
      name: 'John Doe',
      email: 'john@example.com',
      password: 'weak123!',
      role: 'patient'
    },
    expectedError: 'Password must contain at least one uppercase letter'
  },
  {
    name: 'Test 2: Weak password (no special char)',
    data: {
      name: 'John Doe',
      email: 'john@example.com',
      password: 'Weak1234',
      role: 'patient'
    },
    expectedError: 'Password must contain at least one special character'
  },
  {
    name: 'Test 3: Weak password (less than 8 chars)',
    data: {
      name: 'John Doe',
      email: 'john@example.com',
      password: 'Weak1!',
      role: 'patient'
    },
    expectedError: 'Password must be at least 8 characters long'
  },
  {
    name: 'Test 4: Invalid email format',
    data: {
      name: 'John Doe',
      email: 'invalid-email',
      password: 'StrongPass123!',
      role: 'patient'
    },
    expectedError: 'Please provide a valid email address'
  },
  {
    name: 'Test 5: Name with numbers',
    data: {
      name: 'John123',
      email: 'john@example.com',
      password: 'StrongPass123!',
      role: 'patient'
    },
    expectedError: 'Name can only contain letters, spaces, hyphens, and apostrophes'
  },
  {
    name: 'Test 6: Name too short',
    data: {
      name: 'J',
      email: 'john@example.com',
      password: 'StrongPass123!',
      role: 'patient'
    },
    expectedError: 'Name must be at least 2 characters long'
  },
  {
    name: 'Test 7: Invalid phone number',
    data: {
      name: 'John Doe',
      email: 'john@example.com',
      password: 'StrongPass123!',
      role: 'patient',
      contactNumber: '123'
    },
    expectedError: 'Phone number must be a valid 10-digit Indian mobile number'
  },
  {
    name: 'Test 8: Doctor without specialization',
    data: {
      name: 'Dr. Smith',
      email: 'drsmith@example.com',
      password: 'StrongPass123!',
      role: 'doctor',
      qualification: 'MBBS',
      experience: 5
    },
    expectedError: 'Specialization is required for doctors'
  },
  {
    name: 'Test 9: Doctor with negative experience',
    data: {
      name: 'Dr. Smith',
      email: 'drsmith@example.com',
      password: 'StrongPass123!',
      role: 'doctor',
      specialization: 'Cardiology',
      qualification: 'MBBS',
      experience: -5
    },
    expectedError: 'Experience cannot be negative'
  },
  {
    name: 'Test 10: Valid patient registration',
    data: {
      name: 'John Doe',
      email: 'john.doe@example.com',
      password: 'StrongPass123!',
      role: 'patient',
      contactNumber: '9876543210',
      gender: 'male',
      bloodGroup: 'O+'
    },
    expectedError: null // Should succeed
  },
  {
    name: 'Test 11: Valid doctor registration',
    data: {
      name: "Dr. Sarah O'Connor",
      email: 'sarah.oconnor@hospital.com',
      password: 'SecurePass456!',
      role: 'doctor',
      specialization: 'Cardiology',
      qualification: 'MBBS, MD',
      experience: 10,
      contactNumber: '9123456789'
    },
    expectedError: null // Should succeed
  }
];

// Test cases for login validation
const loginTests = [
  {
    name: 'Test 1: Login with invalid email',
    data: {
      email: 'not-an-email',
      password: 'password123',
      role: 'patient'
    },
    expectedError: 'Please provide a valid email address'
  },
  {
    name: 'Test 2: Login without password',
    data: {
      email: 'john@example.com',
      password: '',
      role: 'patient'
    },
    expectedError: 'Password is required'
  },
  {
    name: 'Test 3: Login with invalid role',
    data: {
      email: 'john@example.com',
      password: 'password123',
      role: 'admin'
    },
    expectedError: 'Role must be either "doctor" or "patient"'
  }
];

// Helper function to make API requests
async function makeRequest(endpoint, data) {
  try {
    const response = await fetch(`${BASE_URL}${endpoint}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });

    const result = await response.json();
    return {
      status: response.status,
      data: result
    };
  } catch (error) {
    return {
      status: 0,
      error: error.message
    };
  }
}

// Run tests
async function runTests() {
  console.log('🧪 Starting Validation Tests\n');
  console.log('=' .repeat(80));

  // Test Registration Validation
  console.log('\n[INFO] REGISTRATION VALIDATION TESTS\n');
  let passedTests = 0;
  let failedTests = 0;

  for (const test of registrationTests) {
    console.log(`\n${test.name}`);
    console.log('-'.repeat(80));
    console.log('Input:', JSON.stringify(test.data, null, 2));

    const result = await makeRequest('/register', test.data);
    
    console.log('Status:', result.status);
    console.log('Response:', JSON.stringify(result.data, null, 2));

    if (test.expectedError === null) {
      // Should succeed (201 Created)
      if (result.status === 201 && result.data.success) {
        console.log('[SUCCESS] PASS: Registration succeeded as expected');
        passedTests++;
      } else {
        console.log('[ERROR] FAIL: Expected success but got error');
        failedTests++;
      }
    } else {
      // Should fail with specific error
      if (result.status === 400 && !result.data.success) {
        const hasExpectedError = JSON.stringify(result.data).includes(test.expectedError);
        if (hasExpectedError) {
          console.log('[SUCCESS] PASS: Got expected validation error');
          passedTests++;
        } else {
          console.log(`[ERROR] FAIL: Expected error "${test.expectedError}" not found`);
          failedTests++;
        }
      } else {
        console.log('[ERROR] FAIL: Expected validation error but got different response');
        failedTests++;
      }
    }
  }

  // Test Login Validation
  console.log('\n\n[INFO] LOGIN VALIDATION TESTS\n');

  for (const test of loginTests) {
    console.log(`\n${test.name}`);
    console.log('-'.repeat(80));
    console.log('Input:', JSON.stringify(test.data, null, 2));

    const result = await makeRequest('/login', test.data);
    
    console.log('Status:', result.status);
    console.log('Response:', JSON.stringify(result.data, null, 2));

    if (result.status === 400 && !result.data.success) {
      const hasExpectedError = JSON.stringify(result.data).includes(test.expectedError);
      if (hasExpectedError) {
        console.log('[SUCCESS] PASS: Got expected validation error');
        passedTests++;
      } else {
        console.log(`[ERROR] FAIL: Expected error "${test.expectedError}" not found`);
        failedTests++;
      }
    } else {
      console.log('[ERROR] FAIL: Expected validation error but got different response');
      failedTests++;
    }
  }

  // Print Summary
  console.log('\n\n' + '='.repeat(80));
  console.log('[INFO] TEST SUMMARY');
  console.log('='.repeat(80));
  console.log(`Total Tests: ${passedTests + failedTests}`);
  console.log(`[SUCCESS] Passed: ${passedTests}`);
  console.log(`[ERROR] Failed: ${failedTests}`);
  console.log(`Success Rate: ${((passedTests / (passedTests + failedTests)) * 100).toFixed(2)}%`);
  console.log('='.repeat(80));
}

// Run the tests
runTests().catch(console.error);
