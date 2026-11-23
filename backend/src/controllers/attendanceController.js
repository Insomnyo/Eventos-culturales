import { asyncHandler } from '../utils/errors.js';
import * as attendanceService from '../services/attendanceService.js';

export const listAttendees = asyncHandler(async (req, res) => {
  res.json(await attendanceService.listAttendees(req.user, req.valid.params.id));
});

export const setAttendance = asyncHandler(async (req, res) => {
  const reservation = await attendanceService.setAttendance({
    user: req.user,
    eventId: req.valid.params.id,
    reservationId: req.valid.params.reservationId,
    attendanceStatus: req.valid.body.attendance_status,
    ip: req.ip,
  });
  res.json({ reservation });
});

export const checkInByDni = asyncHandler(async (req, res) => {
  res.json(await attendanceService.checkInByDni({ user: req.user, eventId: req.valid.params.id, dni: req.valid.body.dni, ip: req.ip }));
});

export const lookupTicket = asyncHandler(async (req, res) => {
  res.json(await attendanceService.lookupTicket(req.user, req.valid.params.code));
});

export const checkInByTicket = asyncHandler(async (req, res) => {
  res.json(await attendanceService.checkInByTicket({ user: req.user, ticketCode: req.valid.params.code, ip: req.ip }));
});
