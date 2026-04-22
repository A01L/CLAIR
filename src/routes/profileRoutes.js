import { Router } from "express";
import { authRequired } from "../middlewares/authMiddleware.js";
import { updateProfile, changePassword } from "../controllers/profile.js";

const router = Router();

router.patch("/profile", authRequired, updateProfile);
router.patch("/profile/password", authRequired, changePassword);

export default router;
