export default () => ({
  port: parseInt(process.env.PORT ?? '3000', 10),
  mongodbUri: process.env.MONGODB_URI ?? 'mongodb://localhost:27017/job-system',
  redis: {
    host: process.env.REDIS_HOST ?? 'localhost',
    port: parseInt(process.env.REDIS_PORT ?? '6379', 10),
  },
  jwt: {
    secret: process.env.JWT_SECRET ?? 'dev-secret-change-me',
    expiresIn: process.env.JWT_EXPIRES_IN ?? '1d',
  },
});
