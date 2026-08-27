import 'dotenv/config'

process.env.NODE_ENV ??= 'test'
process.env.LOG_LEVEL ??= 'silent'
process.env.SESSION_SECRET ??= 'test-session-secret-at-least-32-characters'
process.env.OTP_PEPPER ??= 'test-otp-pepper-at-least-32-characters'
process.env.CORS_ORIGINS ??= 'http://localhost:5173'
process.env.SMTP_HOST ??= '127.0.0.1'
process.env.SMTP_PORT ??= '1025'

