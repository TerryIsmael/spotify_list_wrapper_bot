import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import router from './src/router.js';
import cors from './src/config/cors.js';
import cookieParser from "cookie-parser";

export const app = express();
app.set('serverPort', process.env.SERVER_PORT);
app.use(cors);
app.use(express.json({ limit: '200mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(path.dirname(fileURLToPath(import.meta.url)), 'public')));
app.use(cookieParser());

app.use(router);

export default app;