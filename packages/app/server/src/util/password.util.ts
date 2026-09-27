import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
import bcrypt from 'bcrypt';

// OWASP's 32 MiB scrypt configuration. Passwords are not truncated.
const options = { N: 32768, r: 8, p: 3, maxmem: 64 * 1024 * 1024 };
const prefix = 'scrypt-v1';
const deriveKey = (password: string, salt: string) =>
    new Promise<Buffer>((resolve, reject) => {
        scrypt(password, salt, 64, options, (error, key) => (error ? reject(error) : resolve(key)));
    });

export const hashPassword = async (password: string) => {
    const salt = randomBytes(16).toString('hex');
    const key = await deriveKey(password, salt);
    return `${prefix}$${salt}$${key.toString('hex')}`;
};

export const verifyPassword = async (password: string, hash: string) => {
    // Keep existing accounts usable without accepting bcrypt's truncated suffixes.
    if (hash.startsWith('$2')) return Buffer.byteLength(password) <= 72 && bcrypt.compare(password, hash);
    const [version, salt, stored, extra] = hash.split('$');
    if (version !== prefix || !/^[a-f0-9]{32}$/.test(salt ?? '') || !/^[a-f0-9]{128}$/.test(stored ?? '') || extra) {
        return false;
    }
    const key = await deriveKey(password, salt);
    return timingSafeEqual(key, Buffer.from(stored, 'hex'));
};
