import { searchAppealsController } from "../controllers/searchController.js";
import { Router } from "express";
import {
  analyzeAndCreateAppeal,
  ingestExternalAppeal,
  deleteAppealById,
  deleteAllAppealsByChannel,
  getAppealsHistory,
  getAppealsMapData
} from "../controllers/appeals.js";

import { authRequired } from "../middlewares/authMiddleware.js";
import { channelKeyRequired } from "../middlewares/channelAuthMiddleware.js";

const router = Router();

router.post("/", authRequired, analyzeAndCreateAppeal);
router.post("/external", channelKeyRequired, ingestExternalAppeal);
router.get("/history", authRequired, getAppealsHistory);
router.get("/map", authRequired, getAppealsMapData);
router.get("/search", authRequired, searchAppealsController);
router.delete("/channel/:channelId/all", authRequired, deleteAllAppealsByChannel);
router.delete("/:appealId", authRequired, deleteAppealById);

export default router;