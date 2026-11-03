const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const AppError = require('../utils/AppError');
const userRepo = require('../repositories/user.repository');
const auditRepo = require('../repositories/audit.repository');
const { isOwnerEmail } = require('../config/owner');

const VALID_STATUSES = ['PENDING', 'APPROVED', 'SUSPENDED', 'REJECTED'];
const VALID_ROLES = ['USER', 'ADMIN'];

class AdminService {
  async getOverview() {
    return userRepo.adminStats();
  }

  async listUsers(query = {}) {
    const page = Math.max(1, Number(query.page) || 1);
    const pageSize = Math.min(100, Math.max(5, Number(query.pageSize) || 25));
    const search = String(query.search || '').trim();
    const status = VALID_STATUSES.includes(query.status) ? query.status : '';
    const role = VALID_ROLES.includes(query.role) ? query.role : '';
    const provider = ['EMAIL', 'GOOGLE', 'APPLE'].includes(query.provider) ? query.provider : '';
    const sort = query.sort || 'created_at';
    const order = query.order === 'asc' ? 'asc' : 'desc';

    const { users, total } = await userRepo.adminList({
      search,
      status,
      role,
      provider,
      sort,
      order,
      page,
      pageSize,
    });

    return {
      users,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.max(1, Math.ceil(total / pageSize)),
      },
    };
  }

  async getUserDetail(targetId) {
    const user = await userRepo.adminFindById(Number(targetId));
    if (!user) throw new AppError('User not found.', 404, 'USER_NOT_FOUND');
    const storeStats = await userRepo.adminStoreStats(user.id);
    const { logs } = await auditRepo.list({ page: 1, pageSize: 15, targetUserId: user.id });
    return { user, storeStats, auditLogs: logs };
  }

  async updateUserStatus(actorAdminId, targetId, { status, note }, ip = null) {
    const id = Number(targetId);
    const nextStatus = String(status || '').toUpperCase();
    if (!VALID_STATUSES.includes(nextStatus)) {
      throw new AppError('Invalid account status.', 400, 'INVALID_STATUS');
    }

    const target = await userRepo.adminFindById(id);
    if (!target) throw new AppError('User not found.', 404, 'USER_NOT_FOUND');

    if (id === Number(actorAdminId) && nextStatus !== 'APPROVED') {
      throw new AppError('You cannot suspend or reject your own admin account.', 400, 'SELF_LOCKOUT');
    }
    if (isOwnerEmail(target.email) && nextStatus !== 'APPROVED') {
      throw new AppError('The platform owner account cannot be deactivated.', 400, 'OWNER_PROTECTED');
    }

    if (target.role === 'ADMIN' && nextStatus !== 'APPROVED') {
      const adminCount = await userRepo.countAdmins();
      if (adminCount <= 1) {
        throw new AppError('Cannot deactivate the only active administrator.', 400, 'LAST_ADMIN');
      }
    }

    await userRepo.adminUpdateStatus(id, nextStatus, actorAdminId, note);
    await auditRepo.log({
      actorUserId: actorAdminId,
      action: `USER_STATUS_${nextStatus}`,
      targetUserId: id,
      details: { previous_status: target.status, new_status: nextStatus, note: note || null },
      ip,
    });

    return userRepo.adminFindById(id);
  }

  async bulkUpdateStatus(actorAdminId, { user_ids, status, note }, ip = null) {
    if (!Array.isArray(user_ids) || user_ids.length === 0) {
      throw new AppError('Select at least one user.', 400);
    }
    const nextStatus = String(status || '').toUpperCase();
    if (!VALID_STATUSES.includes(nextStatus)) {
      throw new AppError('Invalid status.', 400);
    }

    const updated = [];
    for (const rawId of user_ids) {
      const id = Number(rawId);
      if (!id || (id === Number(actorAdminId) && nextStatus !== 'APPROVED')) continue;
      const bulkTarget = await userRepo.adminFindById(id);
      if (!bulkTarget || isOwnerEmail(bulkTarget.email)) continue;
      await userRepo.adminUpdateStatus(id, nextStatus, actorAdminId, note);
      updated.push(id);
    }

    await auditRepo.log({
      actorUserId: actorAdminId,
      action: `BULK_STATUS_${nextStatus}`,
      targetUserId: null,
      details: { count: updated.length, user_ids: updated, note: note || null },
      ip,
    });

    return { updatedCount: updated.length };
  }

  async updateUserRole(actorAdminId, targetId, { role }, ip = null) {
    const id = Number(targetId);
    const nextRole = String(role || '').toUpperCase();
    if (!VALID_ROLES.includes(nextRole)) {
      throw new AppError('Invalid role.', 400, 'INVALID_ROLE');
    }
    // The administrator role is reserved exclusively for the platform owner.
    if (nextRole === 'ADMIN') {
      throw new AppError(
        'The administrator role is reserved for the platform owner and cannot be assigned.',
        403,
        'ADMIN_ROLE_RESERVED'
      );
    }

    const target = await userRepo.adminFindById(id);
    if (!target) throw new AppError('User not found.', 404, 'USER_NOT_FOUND');

    if (id === Number(actorAdminId) || isOwnerEmail(target.email)) {
      throw new AppError('The platform owner account cannot be modified.', 400, 'OWNER_PROTECTED');
    }

    if (target.role === 'ADMIN' && nextRole !== 'ADMIN') {
      const adminCount = await userRepo.countAdmins();
      if (adminCount <= 1) {
        throw new AppError('Cannot demote the last active administrator.', 400, 'LAST_ADMIN');
      }
    }

    await userRepo.adminSetRole(id, nextRole);
    await auditRepo.log({
      actorUserId: actorAdminId,
      action: `USER_ROLE_${nextRole}`,
      targetUserId: id,
      details: { previous_role: target.role, new_role: nextRole },
      ip,
    });

    return userRepo.adminFindById(id);
  }

  async updateAdminNote(actorAdminId, targetId, { note }, ip = null) {
    const id = Number(targetId);
    const target = await userRepo.adminFindById(id);
    if (!target) throw new AppError('User not found.', 404);

    await userRepo.adminSetNote(id, String(note || '').trim() || null);
    await auditRepo.log({
      actorUserId: actorAdminId,
      action: 'ADMIN_NOTE_UPDATED',
      targetUserId: id,
      details: { note: String(note || '').trim() },
      ip,
    });

    return userRepo.adminFindById(id);
  }

  async resetUserPassword(actorAdminId, targetId, { temporary_password } = {}, ip = null) {
    const id = Number(targetId);
    const target = await userRepo.adminFindById(id);
    if (!target) throw new AppError('User not found.', 404);
    if (isOwnerEmail(target.email)) {
      throw new AppError('The platform owner password can only be changed from Settings.', 400, 'OWNER_PROTECTED');
    }

    const tempPassword =
      temporary_password && String(temporary_password).length >= 6
        ? String(temporary_password)
        : `Lagos-${crypto.randomInt(100000, 999999)}`;

    const hash = await bcrypt.hash(tempPassword, 10);
    await userRepo.setPassword(id, hash, { mustChange: true, bumpTokenVersion: true });

    await auditRepo.log({
      actorUserId: actorAdminId,
      action: 'ADMIN_PASSWORD_RESET',
      targetUserId: id,
      details: { email: target.email },
      ip,
    });

    return { temporaryPassword: tempPassword, email: target.email };
  }

  async deleteUser(actorAdminId, targetId, ip = null) {
    const id = Number(targetId);
    if (id === Number(actorAdminId)) {
      throw new AppError('You cannot delete your own admin account.', 400, 'SELF_DELETE');
    }
    const target = await userRepo.adminFindById(id);
    if (!target) throw new AppError('User not found.', 404);
    if (isOwnerEmail(target.email)) {
      throw new AppError('The platform owner account cannot be deleted.', 400, 'OWNER_PROTECTED');
    }

    await auditRepo.log({
      actorUserId: actorAdminId,
      action: 'USER_DELETED',
      targetUserId: null,
      details: { deleted_user_id: id, email: target.email, business_name: target.business_name },
      ip,
    });
    await userRepo.deleteWithData(id);
    return { deleted: true };
  }

  async getAuditLogs(query = {}) {
    const page = Math.max(1, Number(query.page) || 1);
    const pageSize = Math.min(100, Math.max(10, Number(query.pageSize) || 30));
    return auditRepo.list({
      page,
      pageSize,
      action: query.action || '',
      targetUserId: query.targetUserId ? Number(query.targetUserId) : null,
    });
  }

  async exportUsers() {
    return userRepo.exportAll();
  }
}

module.exports = new AdminService();
