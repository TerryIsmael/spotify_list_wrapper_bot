import cors from 'cors';
import dotenv from 'dotenv';

dotenv.config();

const cors_options = {
  origin: (origin, callback) => {
      callback(null, true);
  },
  credentials: true,
  exposedHeaders: ['Access-Control-Allow-Origin']
};

export default cors(cors_options);