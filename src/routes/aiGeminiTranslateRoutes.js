import express from 'express';
import { translateText } from '../controllers/aiGemini.js';

const router = express.Router();
router.post('/langrussian', translateText);

export default router;
