import { scryptAsync } from '@noble/hashes/scrypt.js';
import { bytesToHex, utf8ToBytes } from '@noble/hashes/utils.js';
import { getRandomBytes } from 'expo-crypto';

// PIN 해시·검증 (D-235). 평문 PIN은 저장하지 않으며 로그·화면에 남기지 않는다 (D-244).
// 해시는 'scrypt$N$r$p$hex' 형식으로 저장해 비용 파라미터를 나중에 올려도 기존 해시를 검증할 수 있다.

export const PIN_LENGTH = 6;
const SCRYPT_N = 2 ** 13;
const SCRYPT_R = 8;
const SCRYPT_P = 1;
const DK_LEN = 32;

export function isValidPin(pin: string): boolean {
  return new RegExp(`^\\d{${PIN_LENGTH}}$`).test(pin);
}

export function generateSalt(): string {
  return bytesToHex(getRandomBytes(16));
}

export async function hashPin(pin: string, salt: string): Promise<string> {
  const dk = await scryptAsync(utf8ToBytes(pin), utf8ToBytes(salt), {
    N: SCRYPT_N,
    r: SCRYPT_R,
    p: SCRYPT_P,
    dkLen: DK_LEN,
  });
  return `scrypt$${SCRYPT_N}$${SCRYPT_R}$${SCRYPT_P}$${bytesToHex(dk)}`;
}

// 길이가 같으면 모든 글자를 비교해 비교 시간이 일치 위치에 의존하지 않게 한다.
function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export async function verifyPin(pin: string, salt: string, storedHash: string): Promise<boolean> {
  const parts = storedHash.split('$');
  if (parts.length !== 5 || parts[0] !== 'scrypt') return false;
  const [N, r, p] = [Number(parts[1]), Number(parts[2]), Number(parts[3])];
  if (![N, r, p].every((n) => Number.isInteger(n) && n > 0)) return false;

  const dk = await scryptAsync(utf8ToBytes(pin), utf8ToBytes(salt), { N, r, p, dkLen: DK_LEN });
  return constantTimeEqual(bytesToHex(dk), parts[4]);
}

// 연속 실패 횟수별 대기 시간(초). 5회부터 대기가 시작되고 점점 길어진다.
export function lockoutSeconds(failCount: number): number {
  if (failCount < 5) return 0;
  if (failCount === 5) return 30;
  if (failCount === 6) return 60;
  if (failCount === 7) return 300;
  return 900;
}

// 대기가 시작되기까지 남은 시도 횟수 (0이면 이미 대기 구간)
export function attemptsBeforeLockout(failCount: number): number {
  return Math.max(0, 5 - failCount);
}
