import express from 'express';
import { textGen } from '../controller/aiContextGemini.js';

const router = express.Router();
router.post('/context', textGen);

export default router;
