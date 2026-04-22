import express from 'express';
import { textGen } from '../controllers/aiContextGemini.js';

const router = express.Router();
router.post('/context', textGen);

export default router;
