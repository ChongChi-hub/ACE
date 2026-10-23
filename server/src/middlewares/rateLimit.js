/**
 * In-memory Login Rate Limiter:
 * 5 lần đăng nhập sai thì khoá 15 phút theo key = IP + '_' + username
 */

const attempts = new Map(); // key -> { count: number, lockUntil: number | null }

const MAX_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 15 * 60 * 1000; // 15 phút

export function loginRateLimiter(req, res, next) {
  const ip = req.ip || req.connection?.remoteAddress || 'unknown';
  const username = String(req.body?.username || '').trim().toLowerCase();
  const key = `${ip}_${username}`;

  const record = attempts.get(key);
  const now = Date.now();

  if (record && record.lockUntil) {
    if (now < record.lockUntil) {
      const remainingMinutes = Math.ceil((record.lockUntil - now) / 60000);
      return res.status(429).json({
        success: false,
        message: `Đăng nhập thất bại quá 5 lần. Tài khoản tạm khoá trên thiết bị này, vui lòng thử lại sau ${remainingMinutes} phút!`
      });
    } else {
      // Hết thời gian khoá, reset
      attempts.delete(key);
    }
  }

  // Gắn helper để controller gọi khi login thất bại hoặc thành công
  req.rateLimitKey = key;
  next();
}

export function recordFailedLogin(key) {
  if (!key) return;
  const now = Date.now();
  const record = attempts.get(key) || { count: 0, lockUntil: null };
  record.count += 1;

  if (record.count >= MAX_ATTEMPTS) {
    record.lockUntil = now + LOCKOUT_DURATION_MS;
  }

  attempts.set(key, record);
}

export function resetLoginAttempts(key) {
  if (!key) return;
  attempts.delete(key);
}
