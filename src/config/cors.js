import cors from 'cors';
import dotenv from 'dotenv';

dotenv.config();
const TEST_MODE = process.env.TEST_MODE === 'false'; 
const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',') || [];
const allowedIPOrigins = process.env.ALLOWED_IP_ORIGINS?.split(',') || [];

const corsOptions = {
  origin: (origin, callback) => {
      callback(null, true);
  },
  credentials: true,
  exposedHeaders: ['Access-Control-Allow-Origin']
};

export default cors(corsOptions);