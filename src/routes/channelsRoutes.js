import { Router } from "express";
import { authRequired } from "../middlewares/authMiddleware.js";

import {
  createChannel,
  getMyChannels,
  getChannelById,
  patchChannel,
  setChannelApiKey,
  rotateChannelApiKey,
  deleteChannel,
  setChannelProcessingStatus
} from "../controllers/channels.js";

import {
  getCustomPrompt,
  updateCustomPrompt,
  deleteCustomPrompt
} from "../controllers/channelPrompts.js";

const router = Router();

router.get("/", authRequired, getMyChannels);

router.get("/:id/prompt", authRequired, getCustomPrompt);
router.post("/:id/prompt", authRequired, updateCustomPrompt);
router.delete("/:id/prompt", authRequired, deleteCustomPrompt);

router.post("/", authRequired, createChannel);

router.patch("/:cid/status", authRequired, setChannelProcessingStatus);

router.get("/:cid", authRequired, getChannelById);
router.patch("/:cid", authRequired, patchChannel);
router.put("/:cid/api-key", authRequired, setChannelApiKey);
router.post("/:cid/rotate-key", authRequired, rotateChannelApiKey);
router.delete("/:cid", authRequired, deleteChannel);

export default router;