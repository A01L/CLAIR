import { Router } from "express";
import { authRequired } from "../middlewares/authMiddleware.js";
import {
  getUserChannelsReports,
  getAppealsStats,
  getAppealsAiSummary,
  resumeChannelProcessing
} from "../controllers/report.js";

const router = Router();

router.get("/reports/channels", authRequired, getUserChannelsReports);
router.get("/reports/stats", authRequired, getAppealsStats);
router.get("/reports/summary", authRequired, getAppealsAiSummary);
router.post("/channels/:channelId/resume", authRequired, resumeChannelProcessing);

export default router;