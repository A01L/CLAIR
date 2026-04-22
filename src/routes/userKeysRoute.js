import { Router } from "express";
import { authRequired } from "../middlewares/authMiddleware.js";
import { setGeminiKey, deleteGeminiKey } from "../controllers/userKeys.js";

const router = Router();

router.patch("/me/gemini-key", authRequired, setGeminiKey);
router.delete("/me/gemini-key", authRequired, deleteGeminiKey);

export default router;