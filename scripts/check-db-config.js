#!/usr/bin/env node
/**
 * Script untuk debugging SQL Server connection configuration
 * Run: node scripts/check-db-config.js
 */

const requiredEnvVars = [
  'ROOT_SQL_SERVER_HOST',
  'ROOT_SQL_SERVER_USER',
  'ROOT_SQL_SERVER_PASSWORD',
  'ROOT_SQL_SERVER_DATABASE',
];

const optionalEnvVars = [
  'ROOT_SQL_SERVER_PORT',
  'ROOT_SQL_SERVER_INSTANCE',
  'ROOT_SQL_SERVER_ENCRYPT',
  'ROOT_SQL_SERVER_TRUST_CERT',
];

console.log('🔍 SQL Server Connection Configuration Check\n');

// Check required variables
console.log('📋 Required Environment Variables:');
let allRequiredSet = true;
requiredEnvVars.forEach((varName) => {
  const value = process.env[varName];
  const isSet = !!value;
  allRequiredSet = allRequiredSet && isSet;
  console.log(`  ${isSet ? '✅' : '❌'} ${varName}: ${isSet ? '***SET***' : 'NOT SET'}`);
});

console.log('\n📋 Optional Environment Variables:');
optionalEnvVars.forEach((varName) => {
  const value = process.env[varName];
  const isSet = !!value;
  console.log(`  ${isSet ? '✅' : '⊘'} ${varName}: ${isSet ? value : 'not configured'}`);
});

console.log('\n📋 Other Integrations:');
const otherVars = [
  'OUTLET_ID',
  'CENTRAL_CRM_DATABASE',
  'TEST_CUSTOMER_PHONE',
  'TEST_WHATSAPP_PHONE',
];
otherVars.forEach((varName) => {
  const value = process.env[varName];
  const isSet = !!value;
  console.log(`  ${isSet ? '✅' : '⊘'} ${varName}: ${isSet ? value : 'not configured'}`);
});

if (!allRequiredSet) {
  console.log('\n❌ FAILED: Pastikan semua Required Environment Variables sudah diset!');
  console.log('\n📝 Cara setup di Vercel:');
  console.log('  1. Buka Settings → Vars');
  console.log('  2. Tambah environment variables dengan nama dan value yang sesuai');
  console.log('  3. Re-deploy atau restart dev server');
  process.exit(1);
}

console.log('\n✅ PASSED: Semua required environment variables sudah diset!');

// Show connection details (masked)
const host = process.env.ROOT_SQL_SERVER_HOST;
const port = process.env.ROOT_SQL_SERVER_PORT || '1433';
const instance = process.env.ROOT_SQL_SERVER_INSTANCE;
const database = process.env.ROOT_SQL_SERVER_DATABASE;
const user = process.env.ROOT_SQL_SERVER_USER;

console.log('\n🔗 Connection Details:');
console.log(`  Server: ${host}:${port}${instance ? '\\' + instance : ''}`);
console.log(`  Database: ${database}`);
console.log(`  User: ${user}`);
console.log(`  Encrypt: ${process.env.ROOT_SQL_SERVER_ENCRYPT === 'true' ? 'yes' : 'no'}`);
console.log(`  Trust Cert: ${process.env.ROOT_SQL_SERVER_TRUST_CERT === 'true' ? 'yes' : 'no'}`);

console.log('\n💡 Next steps:');
console.log('  1. Test koneksi: npm run test-db');
console.log('  2. Lihat logs untuk detail error lebih lanjut');
console.log('  3. Pastikan SQL Server bisa diakses dari jaringan ini');
