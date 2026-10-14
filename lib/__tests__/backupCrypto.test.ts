import { BackupError, decryptBackup, encryptBackup, MIN_PASSWORD_LENGTH } from '@/lib/backupCrypto';

// 실제 난수는 기기 모듈이라 테스트에서는 Node의 crypto로 대체한다
jest.mock('expo-crypto', () => ({
  getRandomBytes: (n: number) => new Uint8Array(require('crypto').randomBytes(n)),
}));

jest.setTimeout(60_000);

const PASSWORD = 'correct horse battery';
const PLAIN = JSON.stringify({ title: '아침 운동 💪', minutes: 90, note: 'Thinketh' });

async function expectCode(promise: Promise<unknown>, code: string) {
  await expect(promise).rejects.toMatchObject({ name: 'BackupError', code });
}

describe('백업 암호화 (D-237)', () => {
  it('암호화 → 복호화 왕복이 한글·이모지까지 같은 값을 돌려준다', async () => {
    const file = await encryptBackup(PLAIN, PASSWORD);
    expect(await decryptBackup(file, PASSWORD)).toBe(PLAIN);
  });

  it('파일에 평문이 그대로 들어 있지 않다', async () => {
    const file = await encryptBackup(PLAIN, PASSWORD);
    expect(file).not.toContain('아침 운동');
    expect(file).not.toContain('Thinketh"');
  });

  it('같은 입력도 매번 다른 파일(솔트·nonce 무작위)', async () => {
    const a = await encryptBackup(PLAIN, PASSWORD);
    const b = await encryptBackup(PLAIN, PASSWORD);
    expect(a).not.toBe(b);
  });

  it('틀린 비밀번호는 거부', async () => {
    const file = await encryptBackup(PLAIN, PASSWORD);
    await expectCode(decryptBackup(file, 'wrong password!'), 'wrong_password_or_tampered');
  });

  it('암호문이 변조되면 거부', async () => {
    const envelope = JSON.parse(await encryptBackup(PLAIN, PASSWORD));
    const flipped = envelope.data.slice(0, 10) + (envelope.data[10] === '0' ? '1' : '0') + envelope.data.slice(11);
    await expectCode(decryptBackup(JSON.stringify({ ...envelope, data: flipped }), PASSWORD), 'wrong_password_or_tampered');
  });

  it('헤더(kdf 파라미터)가 변조되어도 거부', async () => {
    const envelope = JSON.parse(await encryptBackup(PLAIN, PASSWORD));
    const tampered = { ...envelope, kdf: { ...envelope.kdf, r: envelope.kdf.r + 1 } };
    await expectCode(decryptBackup(JSON.stringify(tampered), PASSWORD), 'wrong_password_or_tampered');
  });

  it('이 앱의 파일이 아니거나 형식이 깨졌으면 bad_format', async () => {
    await expectCode(decryptBackup('not json', PASSWORD), 'bad_format');
    await expectCode(decryptBackup(JSON.stringify({ hello: 'world' }), PASSWORD), 'bad_format');
    const envelope = JSON.parse(await encryptBackup(PLAIN, PASSWORD));
    await expectCode(decryptBackup(JSON.stringify({ ...envelope, data: 'zz' }), PASSWORD), 'bad_format');
  });

  it('더 새로운 형식 버전은 unsupported_version', async () => {
    const envelope = JSON.parse(await encryptBackup(PLAIN, PASSWORD));
    await expectCode(decryptBackup(JSON.stringify({ ...envelope, formatVersion: 99 }), PASSWORD), 'unsupported_version');
  });

  it('과도한 kdf 비용을 요구하는 파일은 열지 않는다', async () => {
    const envelope = JSON.parse(await encryptBackup(PLAIN, PASSWORD));
    const heavy = { ...envelope, kdf: { ...envelope.kdf, N: 2 ** 22 } };
    await expectCode(decryptBackup(JSON.stringify(heavy), PASSWORD), 'bad_format');
  });

  it(`비밀번호는 ${MIN_PASSWORD_LENGTH}자 이상이어야 암호화한다`, async () => {
    await expectCode(encryptBackup(PLAIN, 'short'), 'weak_password');
  });

  it('BackupError는 Error를 상속한다', () => {
    expect(new BackupError('bad_format', 'x')).toBeInstanceOf(Error);
  });
});
