import { attemptsBeforeLockout, generateSalt, hashPin, isValidPin, lockoutSeconds, verifyPin } from '@/lib/pin';

// 실제 난수는 기기 모듈이라 테스트에서는 Node의 crypto로 대체한다
jest.mock('expo-crypto', () => ({
  getRandomBytes: (n: number) => new Uint8Array(require('crypto').randomBytes(n)),
}));

jest.setTimeout(30_000);

describe('PIN 형식·대기 시간 (D-235)', () => {
  it('6자리 숫자만 유효', () => {
    expect(isValidPin('123456')).toBe(true);
    expect(isValidPin('12345')).toBe(false);
    expect(isValidPin('1234567')).toBe(false);
    expect(isValidPin('12a456')).toBe(false);
    expect(isValidPin('')).toBe(false);
  });

  it('5회 미만 실패는 대기 없음, 이후 점점 길어짐', () => {
    expect([0, 1, 4].map(lockoutSeconds)).toEqual([0, 0, 0]);
    expect([5, 6, 7, 8, 20].map(lockoutSeconds)).toEqual([30, 60, 300, 900, 900]);
  });

  it('대기 전 남은 시도 횟수', () => {
    expect(attemptsBeforeLockout(0)).toBe(5);
    expect(attemptsBeforeLockout(4)).toBe(1);
    expect(attemptsBeforeLockout(5)).toBe(0);
    expect(attemptsBeforeLockout(9)).toBe(0);
  });
});

describe('PIN 해시·검증', () => {
  it('맞는 PIN은 통과, 틀린 PIN은 거부', async () => {
    const salt = generateSalt();
    const hash = await hashPin('135790', salt);
    expect(hash.startsWith('scrypt$')).toBe(true);
    expect(await verifyPin('135790', salt, hash)).toBe(true);
    expect(await verifyPin('135791', salt, hash)).toBe(false);
  });

  it('솔트가 다르면 같은 PIN도 다른 해시', async () => {
    const a = await hashPin('135790', generateSalt());
    const b = await hashPin('135790', generateSalt());
    expect(a).not.toBe(b);
  });

  it('다른 솔트로는 검증 실패', async () => {
    const hash = await hashPin('135790', 'salt-a');
    expect(await verifyPin('135790', 'salt-b', hash)).toBe(false);
  });

  it('형식이 깨졌거나 파라미터가 비정상인 해시는 거부', async () => {
    expect(await verifyPin('135790', 'x', 'garbage')).toBe(false);
    expect(await verifyPin('135790', 'x', 'scrypt$0$8$1$abcd')).toBe(false);
    expect(await verifyPin('135790', 'x', 'bcrypt$8192$8$1$abcd')).toBe(false);
  });
});
