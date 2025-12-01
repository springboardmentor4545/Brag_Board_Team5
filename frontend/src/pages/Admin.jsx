import { useEffect, useState, useCallback, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { adminAPI, shoutoutAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/useToast';
import DepartmentStatsChart from '../../src/components/admin/DepartmentStatsChart';

export default function Admin() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { addToast } = useToast();
  const [analytics, setAnalytics] = useState(null);
  const [shoutoutReports, setShoutoutReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [shoutoutPreview, setShoutoutPreview] = useState({ open: false, data: null, loading: false, error: '' });
  const [departmentRequests, setDepartmentRequests] = useState([]);
  const [requestFilter, setRequestFilter] = useState('pending');
  const [requestLoading, setRequestLoading] = useState(false);
  const [processingRequestId, setProcessingRequestId] = useState(null);
  const [roleRequests, setRoleRequests] = useState([]);
  const [roleRequestFilter, setRoleRequestFilter] = useState('pending');
  const [roleRequestLoading, setRoleRequestLoading] = useState(false);
  const [processingRoleRequestId, setProcessingRoleRequestId] = useState(null);
  const [roleRequestsSupported, setRoleRequestsSupported] = useState(true);
  const [shoutoutReportFilter, setShoutoutReportFilter] = useState('pending');
  const [shoutoutReportLoading, setShoutoutReportLoading] = useState(false);
  const [resolvingShoutoutReportId, setResolvingShoutoutReportId] = useState(null);
  const [commentReports, setCommentReports] = useState([]);
  const [commentReportFilter, setCommentReportFilter] = useState('pending');
  const [commentReportLoading, setCommentReportLoading] = useState(false);
  const [resolvingCommentReportId, setResolvingCommentReportId] = useState(null);
  const [confirmDialog, setConfirmDialog] = useState({
    open: false,
    title: '',
    message: '',
    confirmLabel: 'Yes',
    cancelLabel: 'No',
    onConfirm: null,
  });
  const [exportFormat, setExportFormat] = useState('csv');
  const [exportStartDate, setExportStartDate] = useState('');
  const [exportEndDate, setExportEndDate] = useState('');
  const [exporting, setExporting] = useState(null);
  const roleSectionRef = useRef(null);
  const departmentSectionRef = useRef(null);
  const shoutoutReportsRef = useRef(null);
  const commentReportsRef = useRef(null);
  const [highlightedSection, setHighlightedSection] = useState(null);
  const formatRoleLabel = (value) => {
    if (!value) return '--';
    const normalized = value.toLowerCase();
    return normalized === 'admin' ? 'Admin' : 'Employee';
  };

  const fetchData = useCallback(async () => {
    try {
      const analyticsRes = await adminAPI.getAnalytics();
      setAnalytics(analyticsRes.data);
    } catch (error) {
      console.error('Error fetching admin data:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchDepartmentRequests = useCallback(async (statusOverride) => {
    const status = statusOverride ?? requestFilter;
    setRequestLoading(true);
    try {
      const res = await adminAPI.getDepartmentChangeRequests(status === 'all' ? undefined : status);
      setDepartmentRequests(res.data || []);
    } catch (error) {
      console.error('Error fetching department change requests:', error);
    } finally {
      setRequestLoading(false);
    }
  }, [requestFilter]);

  const fetchRoleRequests = useCallback(async (statusOverride) => {
    if (!roleRequestsSupported) {
      return;
    }
    const status = statusOverride ?? roleRequestFilter;
    setRoleRequestLoading(true);
    try {
      const res = await adminAPI.getRoleChangeRequests(
        status === 'all' ? undefined : status,
        { skipErrorToast: true }
      );
      setRoleRequests(res.data || []);
    } catch (error) {
      if (error?.response?.status === 404) {
        console.info('Role change requests endpoint not available; disabling section.');
        setRoleRequestsSupported(false);
        setRoleRequests([]);
      } else {
        console.error('Error fetching role change requests:', error);
      }
    } finally {
      setRoleRequestLoading(false);
    }
  }, [roleRequestFilter, roleRequestsSupported]);

  const fetchShoutoutReports = useCallback(async (statusOverride) => {
    const status = statusOverride ?? shoutoutReportFilter;
    setShoutoutReportLoading(true);
    try {
      const res = await adminAPI.getReports(status === 'all' ? undefined : status);
      setShoutoutReports(res.data || []);
    } catch (error) {
      console.error('Error fetching shout-out reports:', error);
    } finally {
      setShoutoutReportLoading(false);
    }
  }, [shoutoutReportFilter]);

  const fetchCommentReports = useCallback(async (statusOverride) => {
    const status = statusOverride ?? commentReportFilter;
    setCommentReportLoading(true);
    try {
      const res = await adminAPI.getCommentReports(status === 'all' ? undefined : status);
      setCommentReports(res.data || []);
    } catch (error) {
      console.error('Error fetching comment reports:', error);
    } finally {
      setCommentReportLoading(false);
    }
  }, [commentReportFilter]);

  useEffect(() => {
    if (authLoading) return;
    if (!user || user.role !== 'admin') {
      navigate('/');
      return;
    }
    fetchData();
  }, [authLoading, fetchData, navigate, user]);

  useEffect(() => {
    if (authLoading) return;
    if (!user || user.role !== 'admin') {
      return;
    }
    fetchDepartmentRequests();
  }, [authLoading, fetchDepartmentRequests, user]);

  useEffect(() => {
    if (authLoading) return;
    if (!user || user.role !== 'admin') {
      return;
    }
    if (roleRequestsSupported) {
      fetchRoleRequests();
    }
  }, [authLoading, fetchRoleRequests, roleRequestsSupported, user]);

  useEffect(() => {
    if (authLoading) return;
    if (!user || user.role !== 'admin') {
      return;
    }
    fetchShoutoutReports();
  }, [authLoading, fetchShoutoutReports, user]);

  useEffect(() => {
    if (authLoading) return;
    if (!user || user.role !== 'admin') {
      return;
    }
    fetchCommentReports();
  }, [authLoading, fetchCommentReports, user]);

  const handleResolveShoutoutReport = async (reportId, action) => {
    setResolvingShoutoutReportId(reportId);
    try {
      await adminAPI.resolveReport(reportId, action, { skipErrorToast: true });
      await fetchShoutoutReports();
      const actionText = action === 'approved' ? 'approved' : 'rejected';
      addToast('success', `Report ${actionText} successfully.`);
    } catch (e) {
      console.error('Failed to resolve report', e);
      addToast('error', 'Failed to update report. Please try again.');
    } finally {
      setResolvingShoutoutReportId(null);
    }
  };

  const handleDeleteShoutout = async (id) => {
    try {
      await adminAPI.deleteShoutout(id, { skipErrorToast: true });
      // refresh both analytics and reports as counts change
      fetchData();
      fetchShoutoutReports();
      addToast('success', 'Shout-out deleted successfully.');
    } catch (e) {
      console.error('Failed to delete shoutout', e);
      addToast('error', 'Failed to delete shout-out. Please try again.');
    }
  };

  const handleResolveCommentReport = async (reportId, action) => {
    setResolvingCommentReportId(reportId);
    try {
      await adminAPI.resolveCommentReport(reportId, action, { skipErrorToast: true });
      await fetchCommentReports();
      const actionText = action === 'approved' ? 'approved' : 'rejected';
      addToast('success', `Comment report ${actionText}.`);
    } catch (e) {
      console.error('Failed to resolve comment report', e);
      addToast('error', 'Failed to update comment report. Please try again.');
    } finally {
      setResolvingCommentReportId(null);
    }
  };

  const handleDeleteComment = async (commentId) => {
    try {
      await adminAPI.deleteComment(commentId, { skipErrorToast: true });
      await fetchCommentReports();
      fetchShoutoutReports();
      addToast('success', 'Comment removed successfully.');
    } catch (e) {
      console.error('Failed to delete comment', e);
      addToast('error', 'Failed to delete comment. Please try again.');
    }
  };

  const handleDepartmentDecision = async (requestId, action) => {
    setProcessingRequestId(requestId);
    const pastTense = action === 'approved' ? 'approved' : 'rejected';
    const verb = action === 'approved' ? 'approve' : 'reject';
    try {
      await adminAPI.decideDepartmentChangeRequest(requestId, action, { skipErrorToast: true });
      await fetchDepartmentRequests();
      if (action === 'approved') {
        // pending requests list changed, refresh analytics to reflect updated department stats
        fetchData();
      }
      addToast('success', `Request ${pastTense} successfully.`);
    } catch (error) {
      console.error(`Failed to ${action} request`, error);
      addToast('error', `Failed to ${verb} request. Please try again.`);
    } finally {
      setProcessingRequestId(null);
    }
  };

  const handleRoleDecision = async (requestId, action) => {
    if (!roleRequestsSupported) {
      return;
    }
    setProcessingRoleRequestId(requestId);
    const pastTense = action === 'approved' ? 'approved' : 'rejected';
    const verb = action === 'approved' ? 'approve' : 'reject';
    try {
      await adminAPI.decideRoleChangeRequest(requestId, action, { skipErrorToast: true });
      await fetchRoleRequests();
      if (action === 'approved') {
        fetchData();
      }
      addToast('success', `Role request ${pastTense} successfully.`);
    } catch (error) {
      console.error(`Failed to ${action} role request`, error);
      addToast('error', `Failed to ${verb} role request. Please try again.`);
    } finally {
      setProcessingRoleRequestId(null);
    }
  };

  const openShoutout = async (id) => {
    setShoutoutPreview({ open: true, data: null, loading: true, error: '' });
    try {
      const res = await shoutoutAPI.getOne(id, { skipErrorToast: true });
      setShoutoutPreview({ open: true, data: res.data, loading: false, error: '' });
    } catch (e) {
      const message = e?.response?.data?.detail || 'Failed to load shout-out.';
      setShoutoutPreview({ open: true, data: null, loading: false, error: message });
      addToast('error', message);
    }
  };

  const closeShoutout = () => setShoutoutPreview({ open: false, data: null, loading: false, error: '' });

  const showConfirm = useCallback((message, onConfirm, options = {}) => {
    setConfirmDialog({
      open: true,
      message,
      onConfirm,
      title: options.title || 'Confirm Action',
      confirmLabel: options.confirmLabel || 'Yes',
      cancelLabel: options.cancelLabel || 'No',
    });
  }, []);

  const handleConfirmCancel = useCallback(() => {
    setConfirmDialog((prev) => ({ ...prev, open: false, onConfirm: null }));
  }, []);

  const handleConfirmYes = useCallback(() => {
    const callback = confirmDialog.onConfirm;
    setConfirmDialog((prev) => ({ ...prev, open: false, onConfirm: null }));
    if (callback) {
      callback();
    }
  }, [confirmDialog]);

  useEffect(() => {
    if (!confirmDialog.open) {
      return undefined;
    }
    const onKeyDown = (event) => {
      if (event.key === 'Escape') {
        handleConfirmCancel();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [confirmDialog.open, handleConfirmCancel]);

  useEffect(() => {
    const section = searchParams.get('section');
    if (!section) {
      return;
    }
    const mapping = {
      ...(roleRequestsSupported ? { 'role-requests': roleSectionRef } : {}),
      'department-requests': departmentSectionRef,
      'shoutout-reports': shoutoutReportsRef,
      'comment-reports': commentReportsRef,
    };
    const targetRef = mapping[section];
    if (targetRef?.current) {
      const scrollToSection = () => {
        targetRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      };
      if (typeof window !== 'undefined' && typeof window.requestAnimationFrame === 'function') {
        window.requestAnimationFrame(scrollToSection);
      } else {
        scrollToSection();
      }
      setHighlightedSection(section);
    }
  }, [roleRequestsSupported, searchParams]);

  useEffect(() => {
    if (!highlightedSection) {
      return undefined;
    }
    const timeoutId = window.setTimeout(() => setHighlightedSection(null), 5000);
    return () => window.clearTimeout(timeoutId);
  }, [highlightedSection]);

  const getFilenameFromHeaders = (headers, fallback) => {
    const disposition = headers?.['content-disposition'] || headers?.['Content-Disposition'];
    if (!disposition) {
      return fallback;
    }
    const match = disposition.match(/filename\*=UTF-8''([^;]+)|filename="?([^";]+)"?/i);
    if (!match) {
      return fallback;
    }
    const encoded = match[1] || match[2];
    if (!encoded) {
      return fallback;
    }
    try {
      return decodeURIComponent(encoded);
    } catch (error) {
      console.warn('Failed to decode filename from headers', error);
      return encoded;
    }
  };

  const triggerDownload = useCallback((blob, filename) => {
    if (!blob) {
      return;
    }
    const dataBlob = blob instanceof Blob ? blob : new Blob([blob]);
    const url = window.URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  }, []);

  const handleExportDownload = useCallback(async (kind) => {
    if (exportStartDate && exportEndDate && exportStartDate > exportEndDate) {
      addToast('error', 'Start date cannot be after end date.');
      return;
    }

    const baseParams = { format: exportFormat };
    if (exportStartDate) {
      baseParams.start_date = exportStartDate;
    }
    if (exportEndDate) {
      baseParams.end_date = exportEndDate;
    }

    const requestConfig = { skipErrorToast: true };
    let requestFn;
    let fallbackPrefix;

    if (kind === 'logs') {
      requestFn = (params) => adminAPI.downloadAdminLogs(params, requestConfig);
      fallbackPrefix = 'admin-logs';
    } else if (kind === 'shoutoutReports') {
      requestFn = (params) => adminAPI.downloadReports({ ...params, report_type: 'shoutout' }, requestConfig);
      fallbackPrefix = 'shoutout-reports';
    } else if (kind === 'commentReports') {
      requestFn = (params) => adminAPI.downloadReports({ ...params, report_type: 'comment' }, requestConfig);
      fallbackPrefix = 'comment-reports';
    } else {
      return;
    }

    setExporting(kind);
    try {
      const response = await requestFn(baseParams);
      const filename = getFilenameFromHeaders(response?.headers, `${fallbackPrefix}.${exportFormat}`);
      triggerDownload(response?.data, filename);
      addToast('success', 'Download started.');
    } catch (error) {
      console.error('Failed to download export', error);
      addToast('error', 'Failed to download export. Please try again.');
    } finally {
      setExporting(null);
    }
  }, [addToast, exportEndDate, exportFormat, exportStartDate, triggerDownload]);

  if (authLoading || loading) {
    return <div className="flex justify-center items-center min-h-screen bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-gray-100">Loading...</div>;
  }

  return (
    <>
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 py-8">
      <div className="max-w-7xl mx-auto px-4">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-8">Admin Dashboard</h1>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 p-6 rounded-lg shadow">
            <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">Total Users</h3>
            <p className="text-3xl font-bold text-gray-900 dark:text-gray-100">{analytics?.total_users || 0}</p>
          </div>
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 p-6 rounded-lg shadow">
            <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">Total Shout-Outs</h3>
            <p className="text-3xl font-bold text-gray-900 dark:text-gray-100">{analytics?.total_shoutouts || 0}</p>
          </div>
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 p-6 rounded-lg shadow md:col-span-2 lg:col-span-2">
            <h5 className="text-x font-bold text-gray-900 dark:text-gray-100">Data Exports</h5>
            {/* <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">Download admin logs and reported items as CSV or PDF. Apply an optional date range before exporting.</p> */}
            <div className="flex flex-wrap items-end gap-3 mt-4">
              <div className="flex flex-col">
                <label htmlFor="export-start-date" className="text-sm text-gray-600 dark:text-gray-400 mb-1">Start date</label>
                <input
                  id="export-start-date"
                  type="date"
                  value={exportStartDate}
                  onChange={(e) => setExportStartDate(e.target.value)}
                  className="px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded text-sm text-gray-700 dark:text-gray-300"
                />
              </div>
              <div className="flex flex-col">
                <label htmlFor="export-end-date" className="text-sm text-gray-600 dark:text-gray-400 mb-1">End date</label>
                <input
                  id="export-end-date"
                  type="date"
                  value={exportEndDate}
                  onChange={(e) => setExportEndDate(e.target.value)}
                  className="px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded text-sm text-gray-700 dark:text-gray-300"
                />
              </div>
              <div className="flex flex-col">
                <label htmlFor="export-format" className="text-sm text-gray-600 dark:text-gray-400 mb-1">Format</label>
                <select
                  id="export-format"
                  value={exportFormat}
                  onChange={(e) => setExportFormat(e.target.value)}
                  className="px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded text-sm text-gray-700 dark:text-gray-300"
                >
                  <option value="csv">CSV</option>
                  <option value="pdf">PDF</option>
                </select>
              </div>
              <div className="flex flex-col">
                <span className="text-sm invisible mb-1 select-none" aria-hidden="true">placeholder</span>
                <button
                  type="button"
                  onClick={() => handleExportDownload('logs')}
                  disabled={exporting === 'logs'}
                  className={`px-4 py-2 rounded text-white text-sm ${exporting === 'logs' ? 'bg-blue-500/70 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'}`}
                >
                  {exporting === 'logs' ? 'Preparing...' : 'Admin Logs'}
                </button>
              </div>
            </div>
            <div className="flex flex-wrap gap-3 mt-4">
              <button
                type="button"
                onClick={() => handleExportDownload('shoutoutReports')}
                disabled={exporting === 'shoutoutReports'}
                className={`px-4 py-2 rounded text-white text-sm ${exporting === 'shoutoutReports' ? 'bg-indigo-500/70 cursor-not-allowed' : 'bg-indigo-600 hover:bg-indigo-700'}`}
              >
                {exporting === 'shoutoutReports' ? 'Preparing...' : 'Shout-out Reports'}
              </button>
              <button
                type="button"
                onClick={() => handleExportDownload('commentReports')}
                disabled={exporting === 'commentReports'}
                className={`px-4 py-2 rounded text-white text-sm ${exporting === 'commentReports' ? 'bg-purple-500/70 cursor-not-allowed' : 'bg-purple-600 hover:bg-purple-700'}`}
              >
                {exporting === 'commentReports' ? 'Preparing...' : 'Comment Reports'}
              </button>
            </div>
          </div>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 p-6 rounded-lg shadow">
            <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-4">Top Contributors</h2>
            <div className="space-y-3">
              {analytics?.top_contributors?.map((user, index) => (
                <div key={user.id} className="flex justify-between items-center">
                  <div>
                    <span className="font-medium text-gray-900 dark:text-gray-100">{index + 1}. {user.name}</span>
                    <span className="text-sm text-gray-500 dark:text-gray-400 ml-2">({user.department})</span>
                  </div>
                  <span className="text-blue-600 font-semibold">
                    {user.shoutouts_sent} sent
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 p-6 rounded-lg shadow">
            <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-4">Most Recognized</h2>
            <div className="space-y-3">
              {analytics?.most_tagged?.map((user, index) => (
                <div key={user.id} className="flex justify-between items-center">
                  <div>
                    <span className="font-medium text-gray-900 dark:text-gray-100">{index + 1}. {user.name}</span>
                    <span className="text-sm text-gray-500 dark:text-gray-400 ml-2">({user.department})</span>
                  </div>
                  <span className="text-green-600 font-semibold">
                    {user.times_tagged} received
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 p-6 rounded-lg shadow">
          <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-4">Department Stats</h2>
          <DepartmentStatsChart data={analytics?.department_stats} />
        </div>

        {roleRequestsSupported && (
        <div
          ref={roleSectionRef}
          className={`bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 p-6 rounded-lg shadow mt-8 ${highlightedSection === 'role-requests' ? 'ring-2 ring-blue-500' : ''}`}
        >
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
            <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">Role Change Requests</h2>
            <div className="flex items-center gap-2">
              <label htmlFor="role-request-filter" className="text-sm text-gray-600 dark:text-gray-400">Status</label>
              <select
                id="role-request-filter"
                value={roleRequestFilter}
                onChange={(e) => setRoleRequestFilter(e.target.value)}
                className="px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded text-sm text-gray-700 dark:text-gray-300"
              >
                <option value="pending">Pending</option>
                <option value="approved">Approved</option>
                <option value="rejected">Rejected</option>
                <option value="all">All</option>
              </select>
            </div>
          </div>

          {roleRequestLoading ? (
            <p className="text-gray-500 dark:text-gray-400">Loading role change requests...</p>
          ) : roleRequests.length === 0 ? (
            <p className="text-gray-500 dark:text-gray-400">No role change requests for this filter.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-800">
                <thead className="bg-gray-50 dark:bg-gray-800">
                  <tr>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">ID</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">User</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Current Role</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Requested Role</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Status</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Submitted</th>
                    <th className="px-4 py-2"></th>
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-800">
                  {roleRequests.map((req) => {
                    const isProcessing = processingRoleRequestId === req.id;
                    return (
                      <tr key={req.id}>
                        <td className="px-4 py-2 text-sm text-gray-700 dark:text-gray-300">#{req.id}</td>
                        <td className="px-4 py-2 text-sm text-gray-700 dark:text-gray-300">
                          <div className="font-medium text-gray-900 dark:text-gray-100">{req.user?.name || 'Unknown user'}</div>
                          {req.user?.email && <div className="text-xs text-gray-500 dark:text-gray-400">{req.user.email}</div>}
                        </td>
                        <td className="px-4 py-2 text-sm text-gray-700 dark:text-gray-300">{formatRoleLabel(req.current_role)}</td>
                        <td className="px-4 py-2 text-sm text-gray-700 dark:text-gray-300">{formatRoleLabel(req.requested_role)}</td>
                        <td className="px-4 py-2 text-sm">
                          <span className={`px-2 py-1 rounded text-xs ${req.status === 'pending' ? 'bg-yellow-100 text-yellow-800' : req.status === 'approved' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                            {req.status}
                          </span>
                          {req.admin?.name && req.status !== 'pending' && (
                            <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">by {req.admin.name}</div>
                          )}
                        </td>
                        <td className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400">
                          <div>{new Date(req.created_at).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}</div>
                          {req.resolved_at && (
                            <div className="text-xs text-gray-500 dark:text-gray-500">Resolved: {new Date(req.resolved_at).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}</div>
                          )}
                        </td>
                        <td className="px-4 py-2 text-sm text-right space-x-2">
                          {req.status === 'pending' ? (
                            <>
                              <button
                                onClick={() => showConfirm(
                                  'Do you really want to approve this role request?',
                                  () => handleRoleDecision(req.id, 'approved'),
                                  { title: 'Confirm Role Request Action' }
                                )}
                                disabled={isProcessing}
                                className={`px-3 py-1 rounded text-white text-sm ${isProcessing ? 'bg-green-500/60 cursor-not-allowed' : 'bg-green-600 hover:bg-green-700'}`}
                              >
                                Approve
                              </button>
                              <button
                                onClick={() => showConfirm(
                                  'Do you really want to reject this role request?',
                                  () => handleRoleDecision(req.id, 'rejected'),
                                  { title: 'Confirm Role Request Action' }
                                )}
                                disabled={isProcessing}
                                className={`px-3 py-1 rounded text-white text-sm ${isProcessing ? 'bg-gray-500/60 cursor-not-allowed' : 'bg-gray-600 hover:bg-gray-700'}`}
                              >
                                Reject
                              </button>
                            </>
                          ) : (
                            <span className="text-xs text-gray-500 dark:text-gray-400">No action required</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
        )}

        <div
          ref={departmentSectionRef}
          className={`bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 p-6 rounded-lg shadow mt-8 ${highlightedSection === 'department-requests' ? 'ring-2 ring-blue-500' : ''}`}
        >
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
            <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">Department Change Requests</h2>
            <div className="flex items-center gap-2">
              <label htmlFor="department-request-filter" className="text-sm text-gray-600 dark:text-gray-400">Status</label>
              <select
                id="department-request-filter"
                value={requestFilter}
                onChange={(e) => setRequestFilter(e.target.value)}
                className="px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded text-sm text-gray-700 dark:text-gray-300"
              >
                <option value="pending">Pending</option>
                <option value="approved">Approved</option>
                <option value="rejected">Rejected</option>
                <option value="all">All</option>
              </select>
            </div>
          </div>

          {requestLoading ? (
            <p className="text-gray-500 dark:text-gray-400">Loading requests...</p>
          ) : departmentRequests.length === 0 ? (
            <p className="text-gray-500 dark:text-gray-400">No requests for this filter.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-800">
                <thead className="bg-gray-50 dark:bg-gray-800">
                  <tr>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">ID</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">User</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Current</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Requested</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Status</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Submitted</th>
                    <th className="px-4 py-2"></th>
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-800">
                  {departmentRequests.map((req) => {
                    const isProcessing = processingRequestId === req.id;
                    return (
                      <tr key={req.id}>
                        <td className="px-4 py-2 text-sm text-gray-700 dark:text-gray-300">#{req.id}</td>
                        <td className="px-4 py-2 text-sm text-gray-700 dark:text-gray-300">
                          <div className="font-medium text-gray-900 dark:text-gray-100">{req.user?.name || 'Unknown user'}</div>
                          {req.user?.email && <div className="text-xs text-gray-500 dark:text-gray-400">{req.user.email}</div>}
                        </td>
                        <td className="px-4 py-2 text-sm text-gray-700 dark:text-gray-300">{req.current_department || '--'}</td>
                        <td className="px-4 py-2 text-sm text-gray-700 dark:text-gray-300">{req.requested_department}</td>
                        <td className="px-4 py-2 text-sm">
                          <span className={`px-2 py-1 rounded text-xs ${req.status === 'pending' ? 'bg-yellow-100 text-yellow-800' : req.status === 'approved' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                            {req.status}
                          </span>
                          {req.admin?.name && req.status !== 'pending' && (
                            <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">by {req.admin.name}</div>
                          )}
                        </td>
                        <td className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400">
                          <div>{new Date(req.created_at).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })}</div>
                          {req.resolved_at && (
                            <div className="text-xs text-gray-500 dark:text-gray-500">Resolved: {new Date(req.resolved_at).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })}</div>
                          )}
                        </td>
                        <td className="px-4 py-2 text-sm text-right space-x-2">
                          {req.status === 'pending' ? (
                            <>
                              <button
                                onClick={() => showConfirm(
                                  'Do you really want to approve this request?',
                                  () => handleDepartmentDecision(req.id, 'approved'),
                                  { title: 'Confirm Request Action' }
                                )}
                                disabled={isProcessing}
                                className={`px-3 py-1 rounded text-white text-sm ${isProcessing ? 'bg-green-500/60 cursor-not-allowed' : 'bg-green-600 hover:bg-green-700'}`}
                              >
                                Approve
                              </button>
                              <button
                                onClick={() => showConfirm(
                                  'Do you really want to reject this request?',
                                  () => handleDepartmentDecision(req.id, 'rejected'),
                                  { title: 'Confirm Request Action' }
                                )}
                                disabled={isProcessing}
                                className={`px-3 py-1 rounded text-white text-sm ${isProcessing ? 'bg-gray-500/60 cursor-not-allowed' : 'bg-gray-600 hover:bg-gray-700'}`}
                              >
                                Reject
                              </button>
                            </>
                          ) : (
                            <span className="text-xs text-gray-500 dark:text-gray-400">No action required</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
        <div
          ref={shoutoutReportsRef}
          className={`bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 p-6 rounded-lg shadow mt-8 ${highlightedSection === 'shoutout-reports' ? 'ring-2 ring-blue-500' : ''}`}
        >
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
            <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">Reported Shout-Outs</h2>
            <div className="flex items-center gap-2">
              <label htmlFor="report-filter" className="text-sm text-gray-600 dark:text-gray-400">Status</label>
              <select
                id="report-filter"
                value={shoutoutReportFilter}
                onChange={(e) => setShoutoutReportFilter(e.target.value)}
                className="px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded text-sm text-gray-700 dark:text-gray-300"
              >
                <option value="pending">Pending</option>
                <option value="approved">Approved</option>
                <option value="rejected">Rejected</option>
                <option value="all">All</option>
              </select>
            </div>
          </div>
          {shoutoutReportLoading ? (
            <p className="text-gray-500 dark:text-gray-400">Loading reports...</p>
          ) : shoutoutReports.length === 0 ? (
            <p className="text-gray-500 dark:text-gray-400">No reports for this filter.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-800">
                <thead className="bg-gray-50 dark:bg-gray-800">
                  <tr>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">ID</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Shoutout</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Reason</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Status</th>
                    <th className="px-4 py-2"></th>
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-800">
                  {shoutoutReports.map((r) => {
                    const isResolving = resolvingShoutoutReportId === r.id;
                    return (
                      <tr key={r.id}>
                        <td className="px-4 py-2 text-sm text-gray-700 dark:text-gray-300">#{r.id}</td>
                        <td className="px-4 py-2 text-sm text-blue-600">
                          <button
                            onClick={() => showConfirm(
                              'Do you really want to delete this reported content?',
                              () => handleDeleteShoutout(r.shoutout_id),
                              { title: 'Delete Shout-Out' }
                            )}
                            className="text-red-600 hover:underline mr-2"
                          >
                            Delete
                          </button>
                          <button onClick={() => openShoutout(r.shoutout_id)} className="text-blue-600 hover:underline">View</button>
                        </td>
                        <td className="px-4 py-2 text-sm text-gray-700 dark:text-gray-300 max-w-md truncate" title={r.reason}>{r.reason}</td>
                        <td className="px-4 py-2 text-sm">
                          <span className={`px-2 py-1 rounded text-xs ${r.status === 'pending' ? 'bg-yellow-100 text-yellow-800' : r.status === 'approved' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>{r.status}</span>
                        </td>
                        <td className="px-4 py-2 text-sm text-right space-x-2">
                          {r.status === 'pending' ? (
                            <>
                              <button
                                onClick={() => showConfirm(
                                  'Do you really want to approve this report?',
                                  () => handleResolveShoutoutReport(r.id, 'approved'),
                                  { title: 'Confirm Report Action' }
                                )}
                                disabled={isResolving}
                                className={`px-3 py-1 text-white rounded text-sm ${isResolving ? 'bg-green-500/60 cursor-not-allowed' : 'bg-green-600 hover:bg-green-700'}`}
                              >
                                Approve
                              </button>
                              <button
                                onClick={() => showConfirm(
                                  'Do you really want to reject this report?',
                                  () => handleResolveShoutoutReport(r.id, 'rejected'),
                                  { title: 'Confirm Report Action' }
                                )}
                                disabled={isResolving}
                                className={`px-3 py-1 text-white rounded text-sm ${isResolving ? 'bg-gray-500/60 cursor-not-allowed' : 'bg-gray-600 hover:bg-gray-700'}`}
                              >
                                Reject
                              </button>
                            </>
                          ) : (
                            <span className="text-xs text-gray-500 dark:text-gray-400">No action required</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
        <div
          ref={commentReportsRef}
          className={`bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 p-6 rounded-lg shadow mt-8 ${highlightedSection === 'comment-reports' ? 'ring-2 ring-blue-500' : ''}`}
        >
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
            <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">Reported Comments</h2>
            <div className="flex items-center gap-2">
              <label htmlFor="comment-report-filter" className="text-sm text-gray-600 dark:text-gray-400">Status</label>
              <select
                id="comment-report-filter"
                value={commentReportFilter}
                onChange={(e) => setCommentReportFilter(e.target.value)}
                className="px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded text-sm text-gray-700 dark:text-gray-300"
              >
                <option value="pending">Pending</option>
                <option value="approved">Approved</option>
                <option value="rejected">Rejected</option>
                <option value="all">All</option>
              </select>
            </div>
          </div>
          {commentReportLoading ? (
            <p className="text-gray-500 dark:text-gray-400">Loading comment reports...</p>
          ) : commentReports.length === 0 ? (
            <p className="text-gray-500 dark:text-gray-400">No comment reports for this filter.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-800">
                <thead className="bg-gray-50 dark:bg-gray-800">
                  <tr>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">ID</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Comment</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Reason</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Reporter</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Status</th>
                    <th className="px-4 py-2"></th>
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-800">
                  {commentReports.map((report) => {
                    const isResolving = resolvingCommentReportId === report.id;
                    return (
                      <tr key={report.id}>
                        <td className="px-4 py-2 text-sm text-gray-700 dark:text-gray-300">#{report.id}</td>
                        <td className="px-4 py-2 text-sm text-gray-700 dark:text-gray-300 max-w-xs">
                          <div className="font-medium text-gray-900 dark:text-gray-100">{report.comment?.user?.name || 'Unknown commenter'}</div>
                          <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">Comment #{report.comment_id}</div>
                          <p className="text-sm text-gray-700 dark:text-gray-200 truncate" title={report.comment?.content || ''}>
                            {report.comment?.content || 'Deleted comment'}
                          </p>
                        </td>
                        <td className="px-4 py-2 text-sm text-gray-700 dark:text-gray-300 max-w-sm truncate" title={report.reason}>{report.reason}</td>
                        <td className="px-4 py-2 text-sm text-gray-700 dark:text-gray-300">
                          <div>{report.reporter?.name || 'Unknown user'}</div>
                          {report.reporter?.email && (
                            <div className="text-xs text-gray-500 dark:text-gray-400">{report.reporter.email}</div>
                          )}
                        </td>
                        <td className="px-4 py-2 text-sm">
                          <span className={`px-2 py-1 rounded text-xs ${report.status === 'pending' ? 'bg-yellow-100 text-yellow-800' : report.status === 'approved' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>{report.status}</span>
                        </td>
                        <td className="px-4 py-2 text-sm text-right space-y-2">
                          <div className="flex flex-wrap items-center justify-end gap-2">
                            <button
                              onClick={() => openShoutout(report.shoutout_id)}
                              className="px-3 py-1 text-blue-600 hover:text-blue-700"
                            >
                              View Shout-Out
                            </button>
                            <button
                              onClick={() => showConfirm(
                                'Do you really want to delete this reported comment?',
                                () => handleDeleteComment(report.comment_id),
                                { title: 'Delete Comment' }
                              )}
                              className="px-3 py-1 text-red-600 hover:text-red-700"
                            >
                              Delete Comment
                            </button>
                          </div>
                          {report.status === 'pending' ? (
                            <div className="flex flex-wrap items-center justify-end gap-2">
                              <button
                                onClick={() => showConfirm(
                                  'Do you really want to approve this report?',
                                  () => handleResolveCommentReport(report.id, 'approved'),
                                  { title: 'Confirm Report Action' }
                                )}
                                disabled={isResolving}
                                className={`px-3 py-1 text-white rounded text-sm ${isResolving ? 'bg-green-500/60 cursor-not-allowed' : 'bg-green-600 hover:bg-green-700'}`}
                              >
                                Approve
                              </button>
                              <button
                                onClick={() => showConfirm(
                                  'Do you really want to reject this report?',
                                  () => handleResolveCommentReport(report.id, 'rejected'),
                                  { title: 'Confirm Report Action' }
                                )}
                                disabled={isResolving}
                                className={`px-3 py-1 text-white rounded text-sm ${isResolving ? 'bg-gray-500/60 cursor-not-allowed' : 'bg-gray-600 hover:bg-gray-700'}`}
                              >
                                Reject
                              </button>
                            </div>
                          ) : (
                            <span className="text-xs text-gray-500 dark:text-gray-400 inline-block">No action required</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
    {shoutoutPreview.open && (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
        <div className="bg-white dark:bg-gray-900 rounded-lg shadow-lg max-w-xl w-full max-h-[80vh] overflow-y-auto">
          <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Shout-Out Preview</h3>
            <button onClick={closeShoutout} className="text-gray-500 hover:text-gray-700">✕</button>
          </div>
          <div className="p-4 space-y-4">
            {shoutoutPreview.loading && <p className="text-sm text-gray-500">Loading...</p>}
            {shoutoutPreview.error && <p className="text-sm text-red-600">{shoutoutPreview.error}</p>}
            {shoutoutPreview.data && (
              <div className="space-y-3">
                <div>
                  <p className="text-sm text-gray-500">ID: {shoutoutPreview.data.id}</p>
                  <p className="font-medium text-gray-900 dark:text-gray-100">{shoutoutPreview.data.sender?.name}</p>
                  <p className="text-xs text-gray-500">{new Date(shoutoutPreview.data.created_at).toLocaleString()}</p>
                </div>
                <p className="text-gray-800 dark:text-gray-100 whitespace-pre-wrap">{shoutoutPreview.data.message}</p>
                {Array.isArray(shoutoutPreview.data.attachments) && shoutoutPreview.data.attachments.length > 0 && (
                  <div>
                    <p className="text-sm font-medium mb-1">Attachments</p>
                    <div className="grid grid-cols-2 gap-3">
                      {shoutoutPreview.data.attachments.map((a, i) => (
                        <a key={i} href={a.url} target="_blank" rel="noreferrer" className="block group">
                          {a.type?.startsWith('image/') ? (
                            <img src={a.url} alt={a.name} className="w-full h-32 object-cover rounded border border-gray-200 dark:border-gray-700" />
                          ) : (
                            <div className="h-32 flex items-center justify-center text-xs bg-gray-50 dark:bg-gray-800 rounded border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300">
                              📄 {a.name}
                            </div>
                          )}
                        </a>
                      ))}
                    </div>
                  </div>
                )}
                <div>
                  <p className="text-sm font-medium mb-1">Tagged Recipients</p>
                  <div className="flex flex-wrap gap-2">
                    {(shoutoutPreview.data.recipients || []).map(r => (
                      <span key={r.id} className="px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded">{r.name}</span>
                    ))}
                  </div>
                </div>
                <div className="flex gap-4 text-xs text-gray-600 dark:text-gray-400">
                  <span>Comments: {shoutoutPreview.data.comment_count}</span>
                  <span>Reactions: {Object.values(shoutoutPreview.data.reaction_counts || {}).reduce((a,b)=>a+b,0)}</span>
                </div>
                <div className="pt-2 border-t border-gray-200 dark:border-gray-700 flex justify-end">
                  <button onClick={() => { closeShoutout(); openShoutout(shoutoutPreview.data.id); }} className="text-xs text-gray-500 hover:text-gray-700 mr-auto">Refresh</button>
                  <button
                    onClick={() => {
                      const targetId = shoutoutPreview.data?.id;
                      showConfirm(
                        'Do you really want to delete this reported content?',
                        () => {
                          if (targetId) {
                            handleDeleteShoutout(targetId);
                          }
                          closeShoutout();
                        },
                        { title: 'Delete Shout-Out' }
                      );
                    }}
                    className="px-3 py-2 bg-red-600 text-white rounded hover:bg-red-700 text-sm"
                  >
                    Delete
                  </button>
                  <button onClick={closeShoutout} className="px-3 py-2 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-100 rounded hover:bg-gray-300 dark:hover:bg-gray-600 text-sm ml-2">Close</button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    )}
    {confirmDialog.open && (
      <div
        className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 px-4"
        role="dialog"
        aria-modal="true"
        onClick={handleConfirmCancel}
      >
        <div
          className="w-full max-w-sm rounded-lg bg-white dark:bg-gray-900 shadow-lg border border-gray-200 dark:border-gray-700"
          onClick={(event) => event.stopPropagation()}
        >
          <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700">
            <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">
              {confirmDialog.title || 'Confirm Action'}
            </h3>
          </div>
          <div className="px-4 py-4 text-sm text-gray-700 dark:text-gray-300 whitespace-pre-line">
            {confirmDialog.message}
          </div>
          <div className="flex justify-end gap-3 px-4 py-3 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/60">
            <button
              type="button"
              onClick={handleConfirmCancel}
              className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 hover:text-gray-900 dark:hover:text-gray-100"
            >
              {confirmDialog.cancelLabel || 'No'}
            </button>
            <button
              type="button"
              onClick={handleConfirmYes}
              className="px-4 py-2 text-sm font-semibold text-white bg-blue-600 rounded-md hover:bg-blue-700"
            >
              {confirmDialog.confirmLabel || 'Yes'}
            </button>
          </div>
        </div>
      </div>
    )}
    </>
  );
}
