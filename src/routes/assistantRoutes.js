import { Router } from "express";
import { startSession, chatWithAssistant } from "../controllers/assistantController.js";
import { channelKeyRequired } from "../middlewares/channelAuthMiddleware.js";

const router = Router();

router.post("/session", channelKeyRequired, startSession);
router.post("/chat", channelKeyRequired, chatWithAssistant);

export default router;
