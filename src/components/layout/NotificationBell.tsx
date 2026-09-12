'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Bell } from 'lucide-react';

interface NotificationItem {
  _id: string;
  type: 'request_approved' | 'request_rejected' | 'new_request';
  message: string;
  relatedRequestId: string;
  isRead: boolean;
  createdAt: string;
}

export function NotificationBell() {
  const router = useRouter();
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isOpen, setIsOpen] = useState(false);

  const fetchNotifications = useCallback(async () => {
    try {
      const res = await fetch('/api/notifications');
      const data = await res.json();
      if (data.success) {
        setNotifications(data.data.notifications);
        setUnreadCount(data.data.unreadCount);
      }
    } catch {
      // Silently ignore; the bell just won't update this cycle.
    }
  }, []);

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 60000);
    return () => clearInterval(interval);
  }, [fetchNotifications]);

  const handleNotificationClick = async (notification: NotificationItem) => {
    if (!notification.isRead) {
      try {
        await fetch(`/api/notifications/${notification._id}/read`, { method: 'POST' });
        fetchNotifications();
      } catch {
        // Non-fatal: the notification just won't show as read yet. Still navigate below.
      }
    }
    setIsOpen(false);
    if (notification.type === 'new_request') {
      router.push(`/admin/requests/${notification.relatedRequestId}`);
    } else {
      router.push('/profile');
    }
  };

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen((prev) => !prev)}
        className="relative inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground h-9 w-9"
        aria-label="알림"
      >
        <Bell className="h-4 w-4" />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 h-2 w-2 rounded-full bg-destructive" />
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 max-h-96 overflow-auto rounded-md border bg-background shadow-lg z-50">
          {notifications.length === 0 ? (
            <div className="p-4 text-sm text-muted-foreground">알림이 없습니다.</div>
          ) : (
            <ul>
              {notifications.map((n) => (
                <li key={n._id}>
                  <button
                    onClick={() => handleNotificationClick(n)}
                    className={`w-full text-left px-4 py-3 text-sm border-b last:border-0 hover:bg-accent ${
                      n.isRead ? 'text-muted-foreground' : 'font-medium'
                    }`}
                  >
                    {n.message}
                    <div className="text-xs text-muted-foreground mt-1">
                      {new Date(n.createdAt).toLocaleString()}
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
