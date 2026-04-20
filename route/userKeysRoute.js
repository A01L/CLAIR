import { Router } from "express";
import { authRequired } from "../middleware/authMiddleware.js";
import { setGeminiKey, deleteGeminiKey } from "../controller/userKeys.js";

const router = Router();

router.patch("/me/gemini-key", authRequired, setGeminiKey);
router.delete("/me/gemini-key", authRequired, deleteGeminiKey);

export default router;