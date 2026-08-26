import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
dotenv.config();

import { logger } from './services/logger.js';
import { router as webhookRouter } from './api/routes.js';
import { authRouter } from './api/auth.js';
import mongoose from 'mongoose';

const app = express();
const PORT = process.env.PORT || 8000;

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/jira-pr-agent')
  .then(() => logger.info('Connected to MongoDB'))
  .catch((err) => logger.error({ err }, 'MongoDB connection error'));

app.use(cors());
app.use(express.json());

app.get('/health', (req, res) => {
  res.json({ status: 'healthy' });
});

app.use('/api', webhookRouter);
app.use('/api/auth', authRouter);

app.listen(PORT, () => {
  logger.info(`Server listening on port ${PORT}`);
});
