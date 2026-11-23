import { asyncHandler } from '../utils/errors.js';
import { changeUserRole, listManagedUsers, setUserStatus } from '../services/adminService.js';
import { getProfile, updateOwnProfile } from '../services/profileService.js';

export const me = asyncHandler(async (req, res) => {
  res.json({ profile: await getProfile(req.user.id) });
});

export const updateMe = asyncHandler(async (req, res) => {
  res.json({ profile: await updateOwnProfile(req.user, req.valid.body, req.ip) });
});

export const updateRole = asyncHandler(async (req, res) => {
  res.json(await changeUserRole({ admin: req.user, ...req.valid.body, ip: req.ip }));
});

export const listUsers = asyncHandler(async (_req, res) => {
  res.json({ items: await listManagedUsers() });
});

export const updateStatus = asyncHandler(async (req, res) => {
  res.json(await setUserStatus({
    actor: req.user, userId: req.valid.params.id, active: req.valid.body.active, reason: req.valid.body.reason, ip: req.ip,
  }));
});
