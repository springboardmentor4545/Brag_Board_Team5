import { Link, useNavigate } from 'react-router-dom';
import { useEffect, useState, useCallback, useRef } from 'react';
import { useAuth } from '../../context/AuthContext';
import { notificationsAPI } from '../../services/api';
import Avatar from './Avatar';
import '../../App.css';
 
export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [mounted, setMounted] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [notificationsLoading, setNotificationsLoading] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
 
  // Mount + scroll detection for animated, blurred navbar
  useEffect(() => {
    setMounted(true);
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);
 
  const handleLogout = () => {
    logout();
    setMenuOpen(false);
    setMobileMenuOpen(false);
    navigate('/login');
  };
 
  const formatTimestamp = useCallback((isoString) => {
    if (!isoString) return '';
    const date = new Date(isoString);
    if (Number.isNaN(date.getTime())) return '';
    const diff = Date.now() - date.getTime();
    if (diff < 60000) return 'just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    if (diff < 604800000) return `${Math.floor(diff / 86400000)}d ago`;
    return date.toLocaleDateString();
  }, []);
 
  const fetchNotifications = useCallback(async () => {
    if (!user) return;
    setNotificationsLoading(true);
    try {
      const { data } = await notificationsAPI.list({ limit: 15 });
      setNotifications(data?.notifications || []);
      setUnreadCount(data?.unread_count || 0);
    } catch (error) {
      console.error('Failed to load notifications', error);
    } finally {
      setNotificationsLoading(false);
    }
  }, [user]);
 
  useEffect(() => {
    if (!user) return;
    fetchNotifications();
    const intervalId = window.setInterval(fetchNotifications, 60000);
    return () => window.clearInterval(intervalId);
  }, [user, fetchNotifications]);
 
  useEffect(() => {
    if (user) return;
    setNotifications([]);
    setUnreadCount(0);
    setNotificationsOpen(false);
    setNotificationsLoading(false);
  }, [user]);
 
  const menuRef = useRef(null);
  const notificationsRef = useRef(null);
  const mobileMenuRef = useRef(null);
 
  useEffect(() => {
    if (!menuOpen) return;
    const handleClick = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [menuOpen]);
 
  useEffect(() => {
    if (!notificationsOpen) return;
    const handleClick = (event) => {
      if (notificationsRef.current && !notificationsRef.current.contains(event.target)) {
        setNotificationsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [notificationsOpen]);
 
  useEffect(() => {
    if (!mobileMenuOpen) return;
    const handleClick = (event) => {
      if (mobileMenuRef.current && !mobileMenuRef.current.contains(event.target)) {
        const toggler = event.target?.closest ? event.target.closest('[data-mobile-menu-toggle]') : null;
        if (!toggler) setMobileMenuOpen(false);
      }
    };
    const handleKey = (event) => {
      if (event.key === 'Escape') setMobileMenuOpen(false);
    };
    document.addEventListener('mousedown', handleClick);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('keydown', handleKey);
    };
  }, [mobileMenuOpen]);
 
  useEffect(() => {
    if (!mobileMenuOpen) return undefined;
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, [mobileMenuOpen]);
 
  useEffect(() => {
    if (mobileMenuOpen) {
      setMenuOpen(false);
      setNotificationsOpen(false);
    }
  }, [mobileMenuOpen]);
 
  useEffect(() => {
    if (!notificationsOpen || unreadCount === 0) return;
    const unreadIds = notifications.filter((item) => !item.is_read).map((item) => item.id);
    if (!unreadIds.length) {
      setUnreadCount(0);
      return;
    }
    const timestamp = new Date().toISOString();
    notificationsAPI.markRead(unreadIds).catch(() => {});
    setNotifications((prev) =>
      prev.map((item) => (unreadIds.includes(item.id) ? { ...item, is_read: true, read_at: timestamp } : item))
    );
    setUnreadCount(0);
  }, [notificationsOpen, unreadCount, notifications]);
 
  const handleNotificationsToggle = () => {
    setNotificationsOpen((open) => {
      const next = !open;
      if (!open && user) {
        fetchNotifications();
      }
      return next;
    });
  };
 
  const handleNotificationClick = (notification) => {
    setNotificationsOpen(false);
    const redirect = notification?.payload?.redirect_url || notification?.payload?.href;
    const section = notification?.payload?.section;
    setMobileMenuOpen(false);
    if (redirect) {
      navigate(redirect);
      return;
    }
    if (section) {
      navigate(`/admin?section=${section}`);
      return;
    }
    if (notification.reference_type === 'department_change') {
      navigate('/profile');
    } else if (notification.reference_type === 'department_change_request') {
      navigate('/admin?section=department-requests');
    } else if (notification.reference_type === 'admin' && user?.role === 'admin') {
      navigate('/admin');
    } else if (notification.reference_type === 'shoutout_report') {
      navigate('/admin?section=shoutout-reports');
    } else if (notification.reference_type === 'comment_report') {
      navigate('/admin?section=comment-reports');
    } else if (notification.reference_type === 'shoutout' || notification.reference_type === 'comment') {
      navigate('/feed');
    }
  };
 
  const handleMobileNavigate = (path) => {
    setMobileMenuOpen(false);
    navigate(path);
  };
 
  const handleClearAll = async () => {
    if (!notifications.length) {
      setUnreadCount(0);
      return;
    }
    setNotificationsLoading(true);
    try {
      await notificationsAPI.clearAll();
      setNotifications([]);
      setUnreadCount(0);
      setTimeout(() => {
        fetchNotifications();
      }, 300);
    } catch (error) {
      console.error('Failed to clear notifications', error);
    } finally {
      setNotificationsLoading(false);
    }
  };
  const navClasses = `navbar sticky top-0 z-50 theme-transition backdrop-blur-md border-b transition-[background-color,backdrop-filter,border-color,transform,opacity] duration-300 ${
    scrolled
      ? 'bg-white/70 dark:bg-gray-900/60 border-gray-200/20 dark:border-gray-800/60 shadow-sm'
      : 'bg-white/40 dark:bg-gray-900/40 border-transparent'
  } ${mounted ? 'navbar-mounted translate-y-0 opacity-100' : 'navbar-initial -translate-y-2 opacity-0'}`;
 
  return (
    <nav className={navClasses}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 navbar-inner">
        <div className="flex h-16 items-center justify-between gap-3 navbar-row">
          <div className="flex items-center gap-3 navbar-left">
            <button
              type="button"
              data-mobile-menu-toggle
              onClick={() => setMobileMenuOpen((open) => !open)}
              className="inline-flex items-center justify-center rounded-md p-2 text-gray-600 hover:text-blue-600 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:text-gray-300 dark:hover:text-blue-300 dark:hover:bg-gray-800 md:hidden navbar-toggle"
              aria-expanded={mobileMenuOpen}
              aria-controls="mobile-nav"
              aria-label="Toggle navigation menu"
            >
              {mobileMenuOpen ? (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                  <path d="M6 6L18 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                </svg>
              ) : (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M4 6H20" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                  <path d="M4 12H20" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                  <path d="M4 18H20" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                </svg>
              )}
            </button>
            <Link to="/" className="text-2xl font-bold text-blue-600 dark:text-blue-400 navbar-brand">
              Brag Board
            </Link>
          </div>
          <div className="hidden md:flex items-center gap-4 navbar-desktop">
            {user && (
              <div className="relative" ref={notificationsRef}>
                <button
                  type="button"
                  onClick={handleNotificationsToggle}
                  className="relative rounded-full p-2 text-gray-600 hover:text-blue-600 hover:bg-gray-100 transition dark:text-gray-300 dark:hover:text-blue-300 dark:hover:bg-gray-800 navbar-notify"
                  aria-label="Open notifications"
                >
                  <svg
                    width="22"
                    height="22"
                    viewBox="0 0 24 24"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                    className="pointer-events-none"
                  >
                    <path
                      d="M18 8a6 6 0 10-12 0c0 7-3 8-3 8h18s-3-1-3-8"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                    <path
                      d="M13.73 21a2 2 0 01-3.46 0"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                  {unreadCount > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 inline-flex min-w-[1.25rem] h-5 items-center justify-center rounded-full bg-red-500 px-1 text-xs font-semibold text-white">
                      {unreadCount > 9 ? '9+' : unreadCount}
                    </span>
                  )}
                </button>
                {notificationsOpen && (
                  <div className="absolute right-0 mt-2 w-80 max-w-[90vw] rounded-md border border-gray-200 bg-white shadow-lg dark:border-gray-700 dark:bg-gray-900 z-50 navbar-dropdown">
                    <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700 navbar-dropdown-header">
                      <span className="text-sm font-semibold text-gray-700 dark:text-gray-200">Notifications</span>
                      <div className="flex items-center gap-3">
                        {notificationsLoading && (
                          <span className="text-xs text-gray-400 dark:text-gray-500">Refreshing...</span>
                        )}
                        <button
                          type="button"
                          onClick={handleClearAll}
                          className="text-xs font-medium text-blue-600 hover:text-blue-500 dark:text-blue-400 dark:hover:text-blue-300 disabled:opacity-50"
                          disabled={!notifications.length || notificationsLoading}
                        >
                          Clear all
                        </button>
                      </div>
                    </div>
                    <div className="max-h-80 overflow-y-auto navbar-dropdown-list">
                      {notificationsLoading && !notifications.length ? (
                        <div className="px-4 py-6 text-sm text-gray-500 dark:text-gray-400">Loading notifications...</div>
                      ) : notifications.length === 0 ? (
                        <div className="px-4 py-6 text-sm text-gray-500 dark:text-gray-400">You're all caught up!</div>
                      ) : (
                        notifications.map((notification) => {
                          const actorName = notification.actor?.name || 'System';
                          const isUnread = !notification.is_read;
                          return (
                            <button
                              type="button"
                              key={notification.id}
                              onClick={() => handleNotificationClick(notification)}
                              className={`flex w-full items-start gap-3 px-4 py-3 text-left transition navbar-notification ${
                                isUnread
                                  ? 'bg-blue-50 hover:bg-blue-100 dark:bg-blue-900/20 dark:hover:bg-blue-900/30'
                                  : 'hover:bg-gray-100 dark:hover:bg-gray-800'
                              }`}
                            >
                              <Avatar
                                src={notification.actor?.avatar_url}
                                name={actorName}
                                size="xs"
                                className="mt-1 flex-shrink-0"
                              />
                              <div className="flex-1">
                                <div className="flex items-start justify-between gap-2">
                                  <p className="text-sm font-medium text-gray-800 dark:text-gray-100">
                                    {notification.title}
                                  </p>
                                  <span className="text-xs text-gray-400 dark:text-gray-500">
                                    {formatTimestamp(notification.created_at)}
                                  </span>
                                </div>
                                {notification.message ? (
                                  <p className="mt-1 text-xs text-gray-600 dark:text-gray-300">
                                    {notification.message}
                                  </p>
                                ) : null}
                                {notification.actor?.name ? (
                                  <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                                    From {notification.actor.name}
                                  </p>
                                ) : null}
                              </div>
                            </button>
                          );
                        })
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
            <Link
              to="/feed"
              className="px-3 py-2 rounded-md text-sm font-medium text-gray-700 transition hover:bg-gray-100 hover:text-blue-600 dark:text-gray-200 dark:hover:bg-gray-800 dark:hover:text-blue-300 navbar-link"
            >
              Feed
            </Link>
            {user ? (
              <div className="relative" ref={menuRef}>
                <button
                  type="button"
                  onClick={() => setMenuOpen((open) => !open)}
                  className="flex items-center gap-2 rounded-full border border-transparent px-2 py-1 transition hover:border-gray-300 dark:hover:border-gray-700 navbar-profile-trigger"
                >
                  <Avatar src={user.avatar_url} name={user.name} size="sm" />
                  <div className="hidden sm:flex flex-col items-start leading-tight">
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-200">{user.name}</span>
                    {user.department ? (
                      <span className="text-xs text-gray-500 dark:text-gray-400">{user.department}</span>
                    ) : null}
                  </div>
                </button>
                {menuOpen && (
                  <div className="absolute right-0 mt-2 w-48 rounded-md border border-gray-200 bg-white shadow-lg dark:border-gray-700 dark:bg-gray-900 z-50 navbar-profile-menu">
                    <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700 navbar-profile-menu-header">
                      <p className="text-sm font-semibold text-gray-800 dark:text-gray-100">{user.name}</p>
                      {user.department ? (
                        <p className="text-xs text-gray-500 dark:text-gray-400">{user.department}</p>
                      ) : null}
                      <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{user.email}</p>
                    </div>
                    {user?.role === 'admin' && (
                      <button
                        type="button"
                        onClick={() => { setMenuOpen(false); navigate('/admin'); }}
                        className="block w-full text-left px-4 py-2 text-sm text-gray-700 transition hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-800 navbar-profile-item"
                      >
                        Dashboard
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => { setMenuOpen(false); navigate('/profile'); }}
                      className="block w-full text-left px-4 py-2 text-sm text-gray-700 transition hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-800 navbar-profile-item"
                    >
                      View Profile
                    </button>
                    <button
                      type="button"
                      onClick={() => { setMenuOpen(false); navigate('/my-shoutouts'); }}
                      className="block w-full text-left px-4 py-2 text-sm text-gray-700 transition hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-800 navbar-profile-item"
                    >
                      My Shout-Outs
                    </button>
                    <button
                      type="button"
                      onClick={() => { setMenuOpen(false); navigate('/shoutouts-for-me'); }}
                      className="block w-full text-left px-4 py-2 text-sm text-gray-700 transition hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-800 navbar-profile-item"
                    >
                      Tagged For Me
                    </button>
                    <button
                      type="button"
                      onClick={() => { setMenuOpen(false); handleLogout(); }}
                      className="block w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 navbar-profile-item navbar-profile-item--danger"
                    >
                      Logout
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex items-center gap-2 navbar-auth">
                <Link
                  to="/login"
                  className="text-sm font-medium text-gray-700 transition hover:text-blue-600 dark:text-gray-200 dark:hover:text-blue-300 navbar-auth-link"
                >
                  Login
                </Link>
                <Link
                  to="/register"
                  className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-semibold text-white shadow hover:bg-blue-700 navbar-auth-cta"
                >
                  Sign up
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>
      {mobileMenuOpen && (
        <div
          id="mobile-nav"
          className="md:hidden border-t border-gray-200 bg-white/95 backdrop-blur-sm dark:border-gray-800 dark:bg-gray-950/95 navbar-mobile"
        >
          <div ref={mobileMenuRef} className="max-w-7xl mx-auto px-4 py-4 space-y-6 navbar-mobile-shell">
            {user ? (
              <div className="flex items-center gap-3 navbar-mobile-profile">
                <Avatar src={user.avatar_url} name={user.name} size="md" />
                <div className="flex-1">
                  <p className="text-sm font-semibold text-gray-800 dark:text-gray-100">{user.name}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{user.email}</p>
                  {user.department ? (
                    <p className="text-xs text-gray-500 dark:text-gray-400">{user.department}</p>
                  ) : null}
                </div>
              </div>
            ) : (
              <div className="space-y-2 navbar-mobile-auth">
                <Link
                  to="/login"
                  onClick={() => setMobileMenuOpen(false)}
                  className="block rounded-md border border-gray-200 px-4 py-2 text-center text-sm font-medium text-gray-700 transition hover:bg-gray-100 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800"
                >
                  Login
                </Link>
                <Link
                  to="/register"
                  onClick={() => setMobileMenuOpen(false)}
                  className="block rounded-md bg-blue-600 px-4 py-2 text-center text-sm font-semibold text-white shadow hover:bg-blue-700"
                >
                  Create account
                </Link>
              </div>
            )}
            <div className="space-y-2 navbar-mobile-links">
              <button
                type="button"
                onClick={() => handleMobileNavigate('/feed')}
                className="flex w-full items-center justify-between rounded-md border border-gray-200 px-4 py-2 text-left text-sm font-medium text-gray-700 transition hover:bg-gray-100 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800 navbar-mobile-link"
              >
                Feed
                <span className="text-xs text-gray-400">Main</span>
              </button>
              {user?.role === 'admin' && (
                <button
                  type="button"
                  onClick={() => handleMobileNavigate('/admin')}
                  className="flex w-full items-center justify-between rounded-md border border-gray-200 px-4 py-2 text-left text-sm font-medium text-gray-700 transition hover:bg-gray-100 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800 navbar-mobile-link"
                >
                  Dashboard
                  <span className="text-xs text-blue-500">Admin</span>
                </button>
              )}
              {user && (
                <>
                  <button
                    type="button"
                    onClick={() => handleMobileNavigate('/profile')}
                    className="flex w-full items-center justify-between rounded-md border border-gray-200 px-4 py-2 text-left text-sm font-medium text-gray-700 transition hover:bg-gray-100 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800 navbar-mobile-link"
                  >
                    View Profile
                  </button>
                  <button
                    type="button"
                    onClick={() => handleMobileNavigate('/my-shoutouts')}
                    className="flex w-full items-center justify-between rounded-md border border-gray-200 px-4 py-2 text-left text-sm font-medium text-gray-700 transition hover:bg-gray-100 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800 navbar-mobile-link"
                  >
                    My Shout-Outs
                  </button>
                  <button
                    type="button"
                    onClick={() => handleMobileNavigate('/shoutouts-for-me')}
                    className="flex w-full items-center justify-between rounded-md border border-gray-200 px-4 py-2 text-left text-sm font-medium text-gray-700 transition hover:bg-gray-100 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800 navbar-mobile-link"
                  >
                    Tagged For Me
                  </button>
                </>
              )}
            </div>
            {user && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-gray-700 dark:text-gray-200">Notifications</span>
                  <button
                    type="button"
                    onClick={handleClearAll}
                    className="text-xs font-medium text-blue-600 hover:text-blue-500 dark:text-blue-400 dark:hover:text-blue-300 disabled:opacity-50"
                    disabled={!notifications.length || notificationsLoading}
                  >
                    Clear all
                  </button>
                </div>
                <div className="max-h-64 space-y-2 overflow-y-auto navbar-mobile-notifications">
                  {notificationsLoading && !notifications.length ? (
                    <div className="rounded-md border border-dashed border-gray-300 px-3 py-4 text-center text-sm text-gray-500 dark:border-gray-700 dark:text-gray-400">
                      Loading notifications...
                    </div>
                  ) : notifications.length === 0 ? (
                    <div className="rounded-md border border-dashed border-gray-300 px-3 py-4 text-center text-sm text-gray-500 dark:border-gray-700 dark:text-gray-400">
                      You're all caught up!
                    </div>
                  ) : (
                    notifications.map((notification) => {
                      const actorName = notification.actor?.name || 'System';
                      const isUnread = !notification.is_read;
                      return (
                        <button
                          type="button"
                          key={notification.id}
                          onClick={() => handleNotificationClick(notification)}
                          className={`w-full rounded-md border px-3 py-2 text-left text-sm transition ${
                            isUnread
                              ? 'border-blue-200 bg-blue-50 dark:border-blue-900 dark:bg-blue-950/40'
                              : 'border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900'
                          }`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <p className="font-medium text-gray-800 dark:text-gray-100">{notification.title}</p>
                            <span className="text-xs text-gray-400 dark:text-gray-500">
                              {formatTimestamp(notification.created_at)}
                            </span>
                          </div>
                          {notification.message ? (
                            <p className="mt-1 text-xs text-gray-600 dark:text-gray-300">{notification.message}</p>
                          ) : null}
                          {actorName ? (
                            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">From {actorName}</p>
                          ) : null}
                        </button>
                      );
                    })
                  )}
                </div>
              </div>
            )}
            {user && (
              <button
                type="button"
                onClick={() => handleLogout()}
                className="flex w-full items-center justify-center rounded-md bg-red-600 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-red-700 navbar-mobile-logout"
              >
                Logout
              </button>
            )}
          </div>
        </div>
      )}
    </nav>
  );
}
