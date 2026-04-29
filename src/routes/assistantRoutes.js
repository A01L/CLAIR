import { Router } from "express";
import {
  startSession,
  chatWithAssistant
} from "../controllers/assistantController.js";
import { authRequired } from "../middlewares/authMiddleware.js";

const router = Router();

router.post("/session", authRequired, startSession);
router.post("/chat", authRequired, chatWithAssistant);

export default router;