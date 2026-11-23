import { asyncHandler } from '../utils/errors.js';
import * as reservationService from '../services/reservationService.js';

export const reserve = asyncHandler(async (req, res) => {
  const result = await reservationService.createReservation({ eventId: req.valid.params.id, user: req.user, ip: req.ip });
  res.status(201).json(result);
});

export const cancel = asyncHandler(async (req, res) => {
  await reservationService.cancelReservation({ reservationId: req.valid.params.id, user: req.user, ip: req.ip });
  res.status(204).end();
});

export const myReservations = asyncHandler(async (req, res) => {
  res.json({ items: await reservationService.listMyReservations(req.user) });
});
