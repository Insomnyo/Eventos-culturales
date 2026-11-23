import { asyncHandler } from '../utils/errors.js';
import * as eventService from '../services/eventService.js';
import { uploadEventCover } from '../services/storageService.js';

export const listEvents = asyncHandler(async (req, res) => {
  res.json(await eventService.listPublicEvents(req.valid.query));
});

export const getEvent = asyncHandler(async (req, res) => {
  res.json({ event: await eventService.getEventForViewer(req.valid.params.id, req.user) });
});

export const listMyManagedEvents = asyncHandler(async (req, res) => {
  res.json({ items: await eventService.listOrganizerEvents(req.user) });
});

export const createEvent = asyncHandler(async (req, res) => {
  const event = await eventService.createEvent(req.user, req.valid.body, req.ip);
  res.status(201).json({ event });
});

export const updateEvent = asyncHandler(async (req, res) => {
  const event = await eventService.updateEvent(req.user, req.valid.params.id, req.valid.body, req.ip);
  res.json({ event });
});

export const deleteEvent = asyncHandler(async (req, res) => {
  await eventService.deleteEvent(req.user, req.valid.params.id, req.ip);
  res.status(204).end();
});

export const uploadCover = asyncHandler(async (req, res) => {
  res.json(await uploadEventCover(req.user, req.valid.params.id, req.file, req.ip));
});
