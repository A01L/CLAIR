import { Router } from "express";
import { authRequired } from "../middlewares/authMiddleware.js";
import { searchAppealsController } from "../controllers/searchController.js";

const router = Router();
router.get("/", authRequired, searchAppealsController);

export default router;