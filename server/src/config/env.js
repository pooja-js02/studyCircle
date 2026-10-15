import 'dotenv/config';

function required(key) {
  const value = process.env[key];
  if (!value) throw new Error(`Missing required environment variable ${key}`);
  return value;
}

const port = Number(process.env.PORT || 5000);

export const env = {
  nodeEnv: process.env.NODE_ENV || 'development',
  isProd: process.env.NODE_ENV === 'production',
  port,
  mongoUrl: required('MONGO_URL'),
  jwtSecret: required('JWT_SECRET'),
  jwtExpiresIn: '7d', // FR-AUTH-07
  // Comma-separated list of allowed frontend origins (NFR-SEC-06)
  clientOrigins: (process.env.CLIENT_ORIGIN || 'http://localhost:5173')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean),
  // When set, files go to Cloudinary; otherwise they are stored on local disk (Docker volume)
  cloudinaryUrl: process.env.CLOUDINARY_URL || '',
  uploadDir: process.env.UPLOAD_DIR || 'uploads',
  authRateLimit: Number(process.env.AUTH_RATE_LIMIT || 10), // NFR-SEC-04
};
