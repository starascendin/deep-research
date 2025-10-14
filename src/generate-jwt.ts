import jwt from 'jsonwebtoken';
import * as dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
dotenv.config({ path: join(__dirname, '../.env') });

const secret = process.env.MASTRA_JWT_SECRET;

if (!secret) {
  console.error('Error: MASTRA_JWT_SECRET not found in .env file');
  process.exit(1);
}

// Generate JWT token with standard claims
const token = jwt.sign(
  {
    sub: 'test-user',
    iat: Math.floor(Date.now() / 1000),
  },
  secret,
  {
    algorithm: 'HS256',
  }
);

console.log('\n✅ JWT Token generated successfully!\n');
console.log('Add this to your .env file:\n');
console.log(`MASTRA_JWT_TOKEN=${token}\n`);
console.log('Token details:');
console.log('-------------');
console.log(`Subject: test-user`);
console.log(`Algorithm: HS256`);
console.log(`Issued at: ${new Date().toISOString()}\n`);
