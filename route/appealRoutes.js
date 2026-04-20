import { Router } from "express";
import {
  analyzeAndCreateAppeal,
  ingestExternalAppeal,
  deleteAppealById,
  deleteAllAppealsByChannel,
  getAppealsHistory
} from "../controller/appeals.js";

import { authRequired } from "../middleware/authMiddleware.js";
import { channelKeyRequired } from "../middleware/channelAuthMiddleware.js";

const router = Router();

router.post("/", authRequired, analyzeAndCreateAppeal);
router.post("/external", channelKeyRequired, ingestExternalAppeal);
router.get("/history", authRequired, getAppealsHistory);
router.delete("/channel/:channelId/all", authRequired, deleteAllAppealsByChannel);
router.delete("/:appealId", authRequired, deleteAppealById);

export default router;