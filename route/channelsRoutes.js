import { Router } from "express";
import { authRequired } from "../middleware/authMiddleware.js";
import {
  createChannel,
  getMyChannels,
  getChannelById,
  patchChannel,
  setChannelApiKey,
  rotateChannelApiKey,
  deleteChannel
} from "../controller/channels.js";

const router = Router();

router.get("/", authRequired, getMyChannels);
router.get("/:cid", authRequired, getChannelById);
router.post("/", authRequired, createChannel);
router.patch("/:cid", authRequired, patchChannel);
router.put("/:cid/api-key", authRequired, setChannelApiKey);
router.post("/:cid/rotate-key", authRequired, rotateChannelApiKey);
router.delete("/:cid", authRequired, deleteChannel);

export default router;