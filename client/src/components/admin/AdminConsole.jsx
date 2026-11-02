import React, { useState, useEffect, useCallback } from 'react';
import {
  Users,
  Clock,
  CheckCircle2,
  ShieldAlert,
  ShieldCheck,
  Search,
  ArrowUpDown,
  Download,
  RefreshCw,
  Eye,
  Trash2,
  KeyRound,
  UserCheck,
  UserX,
  PauseCircle,
  Activity,
  Store,
  Copy,
  MessageCircle,
} from 'lucide-react';
import { apiFetch } from '../../services/api';
import { useDebounce } from '../../hooks/useDebounce';
import { StatCard } from '../ui/StatCard';
import { Badge } from '../ui/Badge';
import { Modal } from '../ui/Modal';
import { EmptyState } from '../ui/EmptyState';

const formatNaira = (val) => {
  const num = Number(val || 0);
  if (Number.isNaN(num)) return '₦0';
  const isWhole = num % 1 === 0;
  const fixed = isWhole ? String(Math.round(num)) : num.toFixed(2);
  const parts = fixed.split('.');
  parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return `₦${parts.join('.')}`;
};

const STATUS_BADGE = {
  APPROVED: { variant: 'success', label: 'APPROVED' },
  PENDING: { variant: 'warning', label: 'PENDING APPROVAL' },
  SUSPENDED: { variant: 'danger', label: 'SUSPENDED' },
  REJECTED: { variant: 'danger', label: 'REJECTED' },
};

export function AdminConsole({ currentUser, onToast }) {
  const [subView, setSubView] = useState('users'); // 'users' | 'audit'
  const [loading, setLoading] = useState(true);
  const [overview, setOverview] = useState({});
  const [users, setUsers] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, pageSize: 25, total: 0, totalPages: 1 });
  const [auditLogs, setAuditLogs] = useState([]);

  // Filters & Sorting
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 180);
  const [statusFilter, setStatusFilter] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [providerFilter, setProviderFilter] = useState('');
  const [sortBy, setSortBy] = useState('created_at');
  const [sortOrder, setSortOrder] = useState('desc');
  const [page, setPage] = useState(1);

  // Bulk Selection
  const [selectedIds, setSelectedIds] = useState([]);
  const [actionBusy, setActionBusy] = useState(false);

  // User Detail Modal
  const [inspectingUser, setInspectingUser] = useState(null);
  const [detailData, setDetailData] = useState(null);
  const [adminNoteInput, setAdminNoteInput] = useState('');
  const [resetResult, setResetResult] = useState(null);

  const loadAdminData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: '25',
        sort: sortBy,
        order: sortOrder,
      });
      if (debouncedSearch) params.set('search', debouncedSearch);
      if (statusFilter) params.set('status', statusFilter);
      if (roleFilter) params.set('role', roleFilter);
      if (providerFilter) params.set('provider', providerFilter);

      const [ov, usr, aud] = await Promise.all([
        apiFetch('/api/v1/admin/overview'),
        apiFetch(`/api/v1/admin/users?${params.toString()}`),
        apiFetch('/api/v1/admin/audit-logs?pageSize=40'),
      ]);

      setOverview(ov || {});
      setUsers(usr?.users || []);
      setPagination(usr?.pagination || { page: 1, pageSize: 25, total: 0, totalPages: 1 });
      setAuditLogs(aud?.logs || []);
    } catch (err) {
      onToast?.(err.message);
    } finally {
      setLoading(false);
    }
  }, [page, sortBy, sortOrder, debouncedSearch, statusFilter, roleFilter, providerFilter, onToast]);

  useEffect(() => {
    loadAdminData();
  }, [loadAdminData]);

  const openUserDetail = async (u) => {
    setInspectingUser(u);
    setAdminNoteInput(u.admin_note || '');
    setResetResult(null);
    try {
      const detail = await apiFetch(`/api/v1/admin/users/${u.id}`);
      setDetailData(detail);
      setAdminNoteInput(detail?.user?.admin_note || '');
    } catch {
      // ignore
    }
  };

  const handleStatusChange = async (userId, nextStatus, note) => {
    setActionBusy(true);
    try {
      const res = await apiFetch(`/api/v1/admin/users/${userId}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status: nextStatus, note }),
      });
      onToast?.(`Account status updated to ${nextStatus}`);
      if (inspectingUser && inspectingUser.id === userId) {
        setInspectingUser(res.user);
      }
      await loadAdminData();
    } catch (err) {
      alert(err.message);
    } finally {
      setActionBusy(false);
    }
  };

  const handleBulkStatus = async (nextStatus) => {
    if (!selectedIds.length) return;
    setActionBusy(true);
    try {
      const res = await apiFetch('/api/v1/admin/users/bulk-status', {
        method: 'POST',
        body: JSON.stringify({ user_ids: selectedIds, status: nextStatus }),
      });
      setSelectedIds([]);
      onToast?.(`Updated ${res.updatedCount} account(s) to ${nextStatus}`);
      await loadAdminData();
    } catch (err) {
      alert(err.message);
    } finally {
      setActionBusy(false);
    }
  };

  const handleRoleChange = async (userId, nextRole) => {
    setActionBusy(true);
    try {
      const res = await apiFetch(`/api/v1/admin/users/${userId}/role`, {
        method: 'PATCH',
        body: JSON.stringify({ role: nextRole }),
      });
      onToast?.(`Role updated to ${nextRole}`);
      if (inspectingUser && inspectingUser.id === userId) {
        setInspectingUser(res.user);
      }
      await loadAdminData();
    } catch (err) {
      alert(err.message);
    } finally {
      setActionBusy(false);
    }
  };

  const handleSaveNote = async (e) => {
    e.preventDefault();
    if (!inspectingUser) return;
    setActionBusy(true);
    try {
      const res = await apiFetch(`/api/v1/admin/users/${inspectingUser.id}/note`, {
        method: 'PATCH',
        body: JSON.stringify({ note: adminNoteInput }),
      });
      setInspectingUser(res.user);
      onToast?.('Admin note saved!');
      await loadAdminData();
    } catch (err) {
      alert(err.message);
    } finally {
      setActionBusy(false);
    }
  };

  const handleResetPassword = async (userId) => {
    setActionBusy(true);
    try {
      const res = await apiFetch(`/api/v1/admin/users/${userId}/reset-password`, {
        method: 'POST',
        body: JSON.stringify({}),
      });
      setResetResult(res);
      onToast?.('Temporary password generated!');
    } catch (err) {
      alert(err.message);
    } finally {
      setActionBusy(false);
    }
  };

  const handleDeleteUser = async (user) => {
    if (
      !window.confirm(
        `Delete "${user.full_name}" (${user.business_name}) and all their store records permanently?`
      )
    ) {
      return;
    }
    setActionBusy(true);
    try {
      await apiFetch(`/api/v1/admin/users/${user.id}`, { method: 'DELETE' });
      setInspectingUser(null);
      onToast?.(`Deleted ${user.email}`);
      await loadAdminData();
    } catch (err) {
      alert(err.message);
    } finally {
      setActionBusy(false);
    }
  };

  const handleExportUsersCSV = async () => {
    try {
      const { users: all } = await apiFetch('/api/v1/admin/users/export');
      if (!all?.length) return;
      const headers = Object.keys(all[0]).join(',');
      const csv = [
        headers,
        ...all.map((r) =>
          Object.values(r)
            .map((v) => `"${String(v ?? '').replace(/"/g, '""')}"`)
            .join(',')
        ),
      ].join('\n');
      const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `stockflow-users-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      alert(err.message);
    }
  };

  const toggleSelectUser = (id) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const toggleSelectAll = () => {
    if (selectedIds.length === users.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(users.map((u) => u.id));
    }
  };

  return (
    <div className="space-y-5 sm:space-y-6">
      {/* Admin Top Banner */}
      <div className="liquid-glass rounded-3xl p-4 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Badge variant="info" icon={ShieldCheck}>
              PLATFORM ADMIN CONTROL CENTER
            </Badge>
            <span className="text-xs font-bold text-theme-secondary">
              Signed in as {currentUser?.full_name}
            </span>
          </div>
          <h2 className="text-lg sm:text-2xl font-extrabold font-luxury text-theme-primary">
            User Approvals, Store Governance & Platform Audit
          </h2>
          <p className="text-xs text-theme-secondary">
            Approve new provision store registrations, sort & filter accounts, manage permissions,
            and monitor platform-wide activity.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setSubView('users')}
            className={`px-3.5 py-2 rounded-xl text-xs font-extrabold cursor-pointer flex items-center gap-1.5 ${
              subView === 'users' ? 'liquid-btn-primary' : 'liquid-glass-subtle text-theme-primary'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>Manage Users ({overview.total_users || 0})</span>
          </button>

          <button
            type="button"
            onClick={() => setSubView('audit')}
            className={`px-3.5 py-2 rounded-xl text-xs font-extrabold cursor-pointer flex items-center gap-1.5 ${
              subView === 'audit' ? 'liquid-btn-primary' : 'liquid-glass-subtle text-theme-primary'
            }`}
          >
            <Activity className="w-4 h-4" />
            <span>Audit Log</span>
          </button>

          <button
            type="button"
            onClick={handleExportUsersCSV}
            className="liquid-glass-subtle px-3 py-2 rounded-xl text-xs font-bold text-theme-primary flex items-center gap-1.5 cursor-pointer"
          >
            <Download className="w-4 h-4" />
            <span>Export CSV</span>
          </button>

          <button
            type="button"
            onClick={loadAdminData}
            className="liquid-glass-subtle p-2 rounded-xl text-theme-primary cursor-pointer"
            title="Refresh Admin Data"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* 4 Admin Platform KPI Cards */}
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-4">
        <StatCard
          title="Total Registered Stores"
          value={overview.total_users || 0}
          icon={Users}
          loading={loading}
          subtitle={
            <span>
              Last 7d: <strong className="text-theme-inflow">+{overview.signups_7d || 0}</strong> |
              Active: <strong className="text-theme-primary">{overview.active_7d || 0}</strong>
            </span>
          }
        />

        <StatCard
          title="Pending Approval Queue"
          value={overview.pending_users || 0}
          valueColor={
            Number(overview.pending_users) > 0 ? 'text-theme-warning' : 'text-theme-inflow'
          }
          icon={Clock}
          loading={loading}
          subtitle={
            <button
              type="button"
              onClick={() => {
                setSubView('users');
                setStatusFilter(statusFilter === 'PENDING' ? '' : 'PENDING');
                setPage(1);
              }}
              className="text-theme-brand font-extrabold underline cursor-pointer"
            >
              {statusFilter === 'PENDING' ? 'Showing Pending Only (Clear)' : 'Filter Pending Queue →'}
            </button>
          }
        />

        <StatCard
          title="Approved Active Stores"
          value={overview.approved_users || 0}
          valueColor="text-theme-inflow"
          icon={CheckCircle2}
          loading={loading}
          subtitle={
            <span>
              Suspended: <strong className="text-theme-outflow">{overview.suspended_users || 0}</strong>{' '}
              | Admins: <strong>{overview.admin_users || 0}</strong>
            </span>
          }
        />

        <StatCard
          title="Sign-In Providers"
          value={`${overview.email_users || 0} Email`}
          icon={ShieldCheck}
          loading={loading}
          subtitle={
            <span>
              Google: <strong className="text-theme-primary">{overview.google_users || 0}</strong> |
              Apple: <strong className="text-theme-primary">{overview.apple_users || 0}</strong>
            </span>
          }
        />
      </section>

      {subView === 'users' ? (
        <div className="liquid-glass rounded-3xl p-4 sm:p-6 space-y-4">
          {/* Status Quick Filter Pills */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap gap-1.5">
              {[
                { id: '', label: `All Users (${overview.total_users || 0})` },
                { id: 'PENDING', label: `Pending Approval (${overview.pending_users || 0})` },
                { id: 'APPROVED', label: `Approved (${overview.approved_users || 0})` },
                { id: 'SUSPENDED', label: `Suspended (${overview.suspended_users || 0})` },
                { id: 'REJECTED', label: `Rejected (${overview.rejected_users || 0})` },
              ].map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => {
                    setStatusFilter(tab.id);
                    setPage(1);
                  }}
                  className={`px-3 py-1.5 rounded-xl text-xs font-extrabold cursor-pointer ${
                    statusFilter === tab.id ? 'liquid-btn-primary' : 'liquid-glass-subtle'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Bulk Action Bar */}
            {selectedIds.length > 0 && (
              <div className="flex flex-wrap items-center gap-2 liquid-glass-subtle px-3 py-1.5 rounded-2xl">
                <span className="text-xs font-extrabold text-theme-primary">
                  {selectedIds.length} selected:
                </span>
                <button
                  type="button"
                  disabled={actionBusy}
                  onClick={() => handleBulkStatus('APPROVED')}
                  className="liquid-btn-primary px-2.5 py-1 rounded-lg text-[11px] font-bold cursor-pointer"
                >
                  ✓ Approve Selected
                </button>
                <button
                  type="button"
                  disabled={actionBusy}
                  onClick={() => handleBulkStatus('SUSPENDED')}
                  className="bg-amber-600 text-white px-2.5 py-1 rounded-lg text-[11px] font-bold cursor-pointer"
                >
                  Suspend Selected
                </button>
                <button
                  type="button"
                  disabled={actionBusy}
                  onClick={() => handleBulkStatus('REJECTED')}
                  className="bg-rose-600 text-white px-2.5 py-1 rounded-lg text-[11px] font-bold cursor-pointer"
                >
                  Reject Selected
                </button>
              </div>
            )}
          </div>

          {/* Search, Filter & Sort Controls */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2.5">
            <div className="sm:col-span-2 relative">
              <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-theme-secondary" />
              <input
                type="text"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                placeholder="Search by trader name, shop name, email, or phone..."
                className="liquid-input w-full pl-10 pr-4 py-2.5 rounded-2xl text-xs sm:text-sm"
              />
            </div>

            <select
              value={roleFilter}
              onChange={(e) => {
                setRoleFilter(e.target.value);
                setPage(1);
              }}
              className="liquid-input rounded-2xl px-3 py-2.5 text-xs font-bold"
            >
              <option value="">All Roles (User & Admin)</option>
              <option value="USER">Store Owners (USER)</option>
              <option value="ADMIN">Administrators (ADMIN)</option>
            </select>

            <select
              value={providerFilter}
              onChange={(e) => {
                setProviderFilter(e.target.value);
                setPage(1);
              }}
              className="liquid-input rounded-2xl px-3 py-2.5 text-xs font-bold"
            >
              <option value="">All Sign-In Methods</option>
              <option value="EMAIL">Email & Password</option>
              <option value="GOOGLE">Google Account</option>
              <option value="APPLE">Apple ID</option>
            </select>

            <div className="flex gap-1.5">
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="liquid-input flex-1 rounded-2xl px-3 py-2.5 text-xs font-bold"
              >
                <option value="created_at">Sort: Date Joined</option>
                <option value="business_name">Sort: Shop Name</option>
                <option value="full_name">Sort: Trader Name</option>
                <option value="email">Sort: Email</option>
                <option value="status">Sort: Status</option>
                <option value="last_login_at">Sort: Last Active</option>
              </select>
              <button
                type="button"
                onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
                title={`Order: ${sortOrder.toUpperCase()}`}
                className="liquid-glass-subtle px-3 rounded-2xl text-xs font-extrabold flex items-center gap-1 text-theme-primary cursor-pointer shrink-0"
              >
                <ArrowUpDown className="w-3.5 h-3.5" />
                <span>{sortOrder === 'asc' ? 'ASC' : 'DESC'}</span>
              </button>
            </div>
          </div>

          {/* Users Table */}
          {users.length === 0 ? (
            <EmptyState
              icon={Users}
              title="No matching user accounts found"
              description="Try clearing your search or status filter to view all registered traders."
            />
          ) : (
            <div className="overflow-x-auto -mx-4 sm:mx-0">
              <table className="w-full text-left border-collapse min-w-[780px]">
                <thead
                  style={{
                    backgroundColor: 'var(--bg-subtle)',
                    borderColor: 'var(--border-outer)',
                  }}
                  className="text-[11px] font-bold uppercase tracking-wider border-y text-theme-secondary"
                >
                  <tr>
                    <th className="py-3 px-3 w-10">
                      <input
                        type="checkbox"
                        checked={users.length > 0 && selectedIds.length === users.length}
                        onChange={toggleSelectAll}
                      />
                    </th>
                    <th className="py-3 px-3">Trader & Store</th>
                    <th className="py-3 px-3">Contact & Method</th>
                    <th className="py-3 px-3">Status & Role</th>
                    <th className="py-3 px-3 text-right">Store Activity</th>
                    <th className="py-3 px-3">Joined</th>
                    <th className="py-3 px-3 text-right">Quick Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y theme-divider text-xs">
                  {users.map((u) => {
                    const statusMeta = STATUS_BADGE[u.status] || {
                      variant: 'neutral',
                      label: u.status,
                    };
                    return (
                      <tr
                        key={u.id}
                        className="hover:bg-white/25 dark:hover:bg-white/5 transition-colors"
                      >
                        <td className="py-3.5 px-3">
                          <input
                            type="checkbox"
                            checked={selectedIds.includes(u.id)}
                            onChange={() => toggleSelectUser(u.id)}
                          />
                        </td>

                        <td className="py-3.5 px-3">
                          <div className="font-extrabold font-luxury text-sm text-theme-primary">
                            {u.business_name || 'Provision Store'}
                          </div>
                          <div className="text-theme-secondary font-medium">
                            {u.full_name} • <span className="text-[11px]">{u.city || 'Lagos'}</span>
                          </div>
                        </td>

                        <td className="py-3.5 px-3">
                          <div className="font-bold text-theme-primary">{u.email}</div>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <Badge variant="neutral">{u.auth_provider}</Badge>
                            {u.phone && (
                              <span className="text-theme-secondary tabular-nums">{u.phone}</span>
                            )}
                          </div>
                        </td>

                        <td className="py-3.5 px-3">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <Badge variant={statusMeta.variant}>{statusMeta.label}</Badge>
                            {u.role === 'ADMIN' && <Badge variant="info">ADMIN</Badge>}
                          </div>
                        </td>

                        <td className="py-3.5 px-3 text-right tabular-nums">
                          <div className="font-extrabold text-theme-inflow">
                            {formatNaira(u.total_inflow)}
                          </div>
                          <div className="text-[11px] text-theme-secondary">
                            {u.product_count || 0} SKUs
                          </div>
                        </td>

                        <td className="py-3.5 px-3 text-theme-secondary tabular-nums">
                          <div>{new Date(u.created_at).toLocaleDateString()}</div>
                          <div className="text-[10px]">
                            {u.last_login_at
                              ? `Active ${new Date(u.last_login_at).toLocaleDateString()}`
                              : 'Never logged in'}
                          </div>
                        </td>

                        <td className="py-3.5 px-3 text-right">
                          <div className="inline-flex items-center justify-end gap-1.5">
                            {u.status !== 'APPROVED' && (
                              <button
                                type="button"
                                disabled={actionBusy}
                                onClick={() => handleStatusChange(u.id, 'APPROVED')}
                                className="liquid-btn-primary px-2.5 py-1.5 rounded-xl text-[11px] font-extrabold cursor-pointer flex items-center gap-1"
                                title="Approve Store Account"
                              >
                                <UserCheck className="w-3.5 h-3.5" />
                                <span>Approve</span>
                              </button>
                            )}

                            {u.status === 'PENDING' && (
                              <button
                                type="button"
                                disabled={actionBusy}
                                onClick={() => handleStatusChange(u.id, 'REJECTED')}
                                className="liquid-glass-subtle px-2.5 py-1.5 rounded-xl text-[11px] font-bold text-theme-outflow cursor-pointer"
                                title="Decline Registration"
                              >
                                Reject
                              </button>
                            )}

                            {u.status === 'APPROVED' && u.id !== currentUser?.id && (
                              <button
                                type="button"
                                disabled={actionBusy}
                                onClick={() => handleStatusChange(u.id, 'SUSPENDED')}
                                className="liquid-glass-subtle px-2.5 py-1.5 rounded-xl text-[11px] font-bold text-theme-warning cursor-pointer"
                                title="Suspend Account"
                              >
                                Suspend
                              </button>
                            )}

                            <button
                              type="button"
                              onClick={() => openUserDetail(u)}
                              className="liquid-glass-subtle px-2.5 py-1.5 rounded-xl text-[11px] font-extrabold text-theme-primary flex items-center gap-1 cursor-pointer"
                            >
                              <Eye className="w-3.5 h-3.5" />
                              <span>Manage</span>
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination */}
          {pagination.totalPages > 1 && (
            <div className="flex items-center justify-between pt-2 text-xs text-theme-secondary">
              <span>
                Page {pagination.page} of {pagination.totalPages} ({pagination.total} total accounts)
              </span>
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  className="liquid-glass-subtle px-3 py-1.5 rounded-xl font-bold disabled:opacity-40 cursor-pointer"
                >
                  Previous
                </button>
                <button
                  type="button"
                  disabled={page >= pagination.totalPages}
                  onClick={() => setPage((p) => p + 1)}
                  className="liquid-glass-subtle px-3 py-1.5 rounded-xl font-bold disabled:opacity-40 cursor-pointer"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      ) : (
        /* AUDIT LOGS VIEW */
        <div className="liquid-glass rounded-3xl p-4 sm:p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-extrabold font-luxury text-theme-primary">
                Platform Security & Governance Audit Trail
              </h3>
              <p className="text-xs text-theme-secondary">
                Every registration, login, approval, role update, and password reset is logged.
              </p>
            </div>
          </div>

          <div className="overflow-x-auto -mx-4 sm:mx-0">
            <table className="w-full text-left border-collapse min-w-[640px]">
              <thead
                style={{
                  backgroundColor: 'var(--bg-subtle)',
                  borderColor: 'var(--border-outer)',
                }}
                className="text-[11px] font-bold uppercase tracking-wider border-y text-theme-secondary"
              >
                <tr>
                  <th className="py-2.5 px-3">Timestamp</th>
                  <th className="py-2.5 px-3">Event</th>
                  <th className="py-2.5 px-3">Actor</th>
                  <th className="py-2.5 px-3">Target Account</th>
                  <th className="py-2.5 px-3">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y theme-divider text-xs">
                {auditLogs.map((log) => (
                  <tr key={log.id}>
                    <td className="py-3 px-3 text-theme-secondary tabular-nums whitespace-nowrap">
                      {new Date(log.created_at).toLocaleString()}
                    </td>
                    <td className="py-3 px-3">
                      <Badge variant="info">{log.action}</Badge>
                    </td>
                    <td className="py-3 px-3 font-bold text-theme-primary">
                      {log.actor_name || log.actor_email || 'System'}
                    </td>
                    <td className="py-3 px-3 text-theme-secondary">
                      {log.target_name ? `${log.target_name} (${log.target_email})` : '—'}
                    </td>
                    <td className="py-3 px-3 text-theme-secondary font-mono text-[11px]">
                      {JSON.stringify(log.details || {})}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* USER DETAIL & MANAGEMENT MODAL */}
      <Modal
        isOpen={Boolean(inspectingUser)}
        onClose={() => {
          setInspectingUser(null);
          setDetailData(null);
          setResetResult(null);
        }}
        title={`Manage Account: ${inspectingUser?.business_name || inspectingUser?.full_name}`}
        subtitle={`${inspectingUser?.full_name} • ${inspectingUser?.email} • Joined ${
          inspectingUser ? new Date(inspectingUser.created_at).toLocaleDateString() : ''
        }`}
      >
        {inspectingUser && (
          <div className="space-y-4 text-xs">
            {/* Store KPI Snapshot */}
            {detailData?.storeStats && (
              <div className="grid grid-cols-3 gap-2.5">
                <div className="liquid-glass-subtle p-3 rounded-2xl">
                  <div className="text-[10px] font-bold uppercase text-theme-secondary">
                    Shelf Value
                  </div>
                  <div className="text-sm font-extrabold font-luxury tabular-nums text-theme-primary mt-0.5">
                    {formatNaira(detailData.storeStats.stock_retail_value)}
                  </div>
                  <div className="text-[10px] text-theme-secondary">
                    {detailData.storeStats.product_count} products
                  </div>
                </div>

                <div className="liquid-glass-subtle p-3 rounded-2xl">
                  <div className="text-[10px] font-bold uppercase text-theme-secondary">
                    Total Cash In
                  </div>
                  <div className="text-sm font-extrabold font-luxury tabular-nums text-theme-inflow mt-0.5">
                    {formatNaira(detailData.storeStats.total_inflow)}
                  </div>
                  <div className="text-[10px] text-theme-secondary">
                    {detailData.storeStats.sale_count} sales
                  </div>
                </div>

                <div className="liquid-glass-subtle p-3 rounded-2xl">
                  <div className="text-[10px] font-bold uppercase text-theme-secondary">
                    Active Debtors
                  </div>
                  <div className="text-sm font-extrabold font-luxury tabular-nums text-theme-outflow mt-0.5">
                    {detailData.storeStats.active_debtors} owing
                  </div>
                  <div className="text-[10px] text-theme-secondary">
                    Outflow: {formatNaira(detailData.storeStats.total_outflow)}
                  </div>
                </div>
              </div>
            )}

            {/* Approval & Status Controls */}
            <div className="liquid-glass-subtle p-3.5 rounded-2xl space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="font-extrabold text-theme-primary">Account Approval & Access</span>
                <Badge variant={STATUS_BADGE[inspectingUser.status]?.variant || 'neutral'}>
                  {inspectingUser.status}
                </Badge>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <button
                  type="button"
                  disabled={actionBusy || inspectingUser.status === 'APPROVED'}
                  onClick={() => handleStatusChange(inspectingUser.id, 'APPROVED')}
                  className="liquid-btn-primary py-2 px-2.5 rounded-xl font-extrabold flex items-center justify-center gap-1 cursor-pointer disabled:opacity-40"
                >
                  <UserCheck className="w-3.5 h-3.5" />
                  <span>Approve</span>
                </button>

                <button
                  type="button"
                  disabled={actionBusy || inspectingUser.status === 'PENDING'}
                  onClick={() => handleStatusChange(inspectingUser.id, 'PENDING')}
                  className="liquid-glass py-2 px-2.5 rounded-xl font-bold flex items-center justify-center gap-1 cursor-pointer disabled:opacity-40"
                >
                  <Clock className="w-3.5 h-3.5" />
                  <span>Set Pending</span>
                </button>

                <button
                  type="button"
                  disabled={
                    actionBusy ||
                    inspectingUser.status === 'SUSPENDED' ||
                    inspectingUser.id === currentUser?.id
                  }
                  onClick={() => handleStatusChange(inspectingUser.id, 'SUSPENDED')}
                  className="liquid-glass py-2 px-2.5 rounded-xl font-bold text-theme-warning flex items-center justify-center gap-1 cursor-pointer disabled:opacity-40"
                >
                  <PauseCircle className="w-3.5 h-3.5" />
                  <span>Suspend</span>
                </button>

                <button
                  type="button"
                  disabled={
                    actionBusy ||
                    inspectingUser.status === 'REJECTED' ||
                    inspectingUser.id === currentUser?.id
                  }
                  onClick={() => handleStatusChange(inspectingUser.id, 'REJECTED')}
                  className="liquid-glass py-2 px-2.5 rounded-xl font-bold text-theme-outflow flex items-center justify-center gap-1 cursor-pointer disabled:opacity-40"
                >
                  <UserX className="w-3.5 h-3.5" />
                  <span>Reject</span>
                </button>
              </div>
            </div>

            {/* Role & Password Reset Controls */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <div className="liquid-glass-subtle p-3.5 rounded-2xl space-y-2">
                <div className="font-extrabold text-theme-primary">Platform Role</div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    disabled={actionBusy || inspectingUser.role === 'USER'}
                    onClick={() => handleRoleChange(inspectingUser.id, 'USER')}
                    className={`flex-1 py-2 rounded-xl font-bold cursor-pointer ${
                      inspectingUser.role === 'USER' ? 'liquid-btn-primary' : 'liquid-glass'
                    }`}
                  >
                    Store Owner
                  </button>
                  <button
                    type="button"
                    disabled={actionBusy || inspectingUser.role === 'ADMIN'}
                    onClick={() => handleRoleChange(inspectingUser.id, 'ADMIN')}
                    className={`flex-1 py-2 rounded-xl font-bold cursor-pointer ${
                      inspectingUser.role === 'ADMIN' ? 'liquid-btn-primary' : 'liquid-glass'
                    }`}
                  >
                    Admin
                  </button>
                </div>
              </div>

              <div className="liquid-glass-subtle p-3.5 rounded-2xl space-y-2">
                <div className="font-extrabold text-theme-primary">Password Recovery</div>
                <button
                  type="button"
                  disabled={actionBusy}
                  onClick={() => handleResetPassword(inspectingUser.id)}
                  className="liquid-glass w-full py-2 px-3 rounded-xl font-extrabold text-theme-brand flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <KeyRound className="w-3.5 h-3.5" />
                  <span>Generate Temp Password</span>
                </button>
              </div>
            </div>

            {resetResult && (
              <div className="p-3.5 rounded-2xl liquid-glass border border-sky-400/40 space-y-2">
                <div className="font-extrabold text-theme-primary">
                  Temporary Password for {resetResult.email}:
                </div>
                <div className="flex items-center justify-between gap-2 p-2 rounded-xl liquid-glass-subtle font-mono text-sm font-extrabold text-theme-brand">
                  <span>{resetResult.temporaryPassword}</span>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard?.writeText(resetResult.temporaryPassword);
                        onToast?.('Copied temporary password!');
                      }}
                      className="px-2.5 py-1 rounded-lg liquid-btn-primary text-[11px] font-sans flex items-center gap-1 cursor-pointer"
                    >
                      <Copy className="w-3 h-3" /> Copy
                    </button>
                    {inspectingUser.phone && (
                      <a
                        href={`https://wa.me/${inspectingUser.phone.replace(/^0/, '234').replace(/\D/g, '')}?text=${encodeURIComponent(
                          `Hello ${inspectingUser.full_name}, your StockFlow Lagos temporary password is: ${resetResult.temporaryPassword}`
                        )}`}
                        target="_blank"
                        rel="noreferrer"
                        className="px-2.5 py-1 rounded-lg bg-emerald-600 text-white text-[11px] font-sans flex items-center gap-1"
                      >
                        <MessageCircle className="w-3 h-3" /> WhatsApp
                      </a>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Admin Note Form */}
            <form onSubmit={handleSaveNote} className="space-y-2">
              <label className="block font-extrabold text-theme-primary">
                Internal Admin Note (Only visible to administrators)
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={adminNoteInput}
                  onChange={(e) => setAdminNoteInput(e.target.value)}
                  placeholder="e.g. Verified shop at Oke-Arin market..."
                  className="liquid-input flex-1 rounded-xl px-3 py-2 text-xs"
                />
                <button
                  type="submit"
                  disabled={actionBusy}
                  className="liquid-btn-primary px-4 py-2 rounded-xl font-bold cursor-pointer"
                >
                  Save Note
                </button>
              </div>
            </form>

            {/* Delete User Footer */}
            {inspectingUser.id !== currentUser?.id && (
              <div
                className="pt-3 border-t flex items-center justify-between"
                style={{ borderColor: 'var(--divider-color)' }}
              >
                <span className="text-[11px] text-theme-secondary">
                  Permanently remove this account and its store records
                </span>
                <button
                  type="button"
                  disabled={actionBusy}
                  onClick={() => handleDeleteUser(inspectingUser)}
                  className="px-3 py-1.5 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 text-theme-outflow font-extrabold flex items-center gap-1 cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Delete Account</span>
                </button>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
