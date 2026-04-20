import { Router } from "express";
import { authRequired } from "../middleware/authMiddleware.js";
import { updateProfile, changePassword } from "../controller/profile.js";

const router = Router();

router.patch("/profile", authRequired, updateProfile);
router.patch("/profile/password", authRequired, changePassword);

export default router;
