import { asyncHandler } from '../utils/errors.js';
import * as notificationService from '../services/notificationService.js';

export const list = asyncHandler(async (req, res) => {
  res.json(await notificationService.listForUser(req.user.id, req.valid.query.limit));
});

export const unreadCount = asyncHandler(async (req, res) => {
  res.json({ unreadCount: await notificationService.unreadCount(req.user.id) });
});

export const markRead = asyncHandler(async (req, res) => {
  res.json(await notificationService.markRead(req.user.id, req.valid.params.id));
});

export const markAllRead = asyncHandler(async (req, res) => {
  res.json(await notificationService.markAllRead(req.user.id));
});
