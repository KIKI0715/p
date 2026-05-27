import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

const ALGORITHM = 'aes-256-gcm';

function keyBuffer(): Buffer {
  const key = process.env.ENCRYPTION_KEY ?? '';
  return Buffer.from(key.slice(0, 32).padEnd(32, '0'));
}

export function encrypt(plaintext: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGORITHM, keyBuffer(), iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted.toString('hex')}`;
}

export function decrypt(encoded: string): string {
  const [ivHex, authTagHex, encryptedHex] = encoded.split(':');
  if (!ivHex || !authTagHex || !encryptedHex) throw new Error('Invalid encrypted format');
  const decipher = createDecipheriv(ALGORITHM, keyBuffer(), Buffer.from(ivHex, 'hex'));
  decipher.setAuthTag(Buffer.from(authTagHex, 'hex'));
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(encryptedHex, 'hex')),
    decipher.final(),
  ]);
  return decrypted.toString('utf8');
}
