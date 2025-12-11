#!/usr/bin/env node
/**
 * Password Hashing Script
 * Usage: node scripts/hash-password.mjs <password>
 *
 * Generates a password hash compatible with the admin authentication system.
 */

import crypto from 'crypto';

const ITERATIONS = 100000;
const KEY_LENGTH = 64;
const DIGEST = 'sha512';

async function hashPassword(password) {
  const salt = crypto.randomBytes(16);

  return new Promise((resolve, reject) => {
    crypto.pbkdf2(password, salt, ITERATIONS, KEY_LENGTH, DIGEST, (err, derivedKey) => {
      if (err) reject(err);
      resolve(`${ITERATIONS}:${salt.toString('hex')}:${derivedKey.toString('hex')}`);
    });
  });
}

const password = process.argv[2];

if (!password) {
  console.error('Usage: node scripts/hash-password.mjs <password>');
  console.error('');
  console.error('Example:');
  console.error('  node scripts/hash-password.mjs "my-secure-password"');
  process.exit(1);
}

const hash = await hashPassword(password);

console.log('');
console.log('Password hash generated successfully!');
console.log('');
console.log('Hash:');
console.log(hash);
console.log('');
console.log('Use this SQL to create an admin user:');
console.log('');
console.log(`INSERT INTO admin_users (email, password_hash, name, role, tenant_id, is_active)`);
console.log(`VALUES ('admin@example.com', '${hash}', 'Admin Name', 'admin', 'default', 1);`);
console.log('');
