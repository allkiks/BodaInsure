import { Link, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  Users,
  Building2,
  FileCheck,
  Settings,
  ChevronDown,
  BarChart3,
  CreditCard,
  Shield,
  Wallet,
  FileBarChart,
  User,
  Upload,
  FileText,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useState, useMemo } from 'react';
import { useAuthStore } from '@/stores/authStore';
import type { UserRole } from '@/types';

interface NavItem {
  label: string;
  path: string;
  icon: React.ReactNode;
  children?: NavItem[];
  roles?: UserRole[];
}

// Rider navigation items
const riderNavItems: NavItem[] = [
  { label: 'Wallet', path: '/my/wallet', icon: <Wallet className="h-5 w-5" /> },
  { label: 'Make Payment', path: '/my/payment', icon: <CreditCard className="h-5 w-5" /> },
  { label: 'My Policies', path: '/my/policies', icon: <Shield className="h-5 w-5" /> },
  { label: 'KYC Documents', path: '/my/kyc', icon: <Upload className="h-5 w-5" /> },
  { label: 'Profile', path: '/my/profile', icon: <User className="h-5 w-5" /> },
];

// Admin navigation items
const adminNavItems: NavItem[] = [
  {
    label: 'Dashboard',
    path: '/dashboard',
    icon: <LayoutDashboard className="h-5 w-5" />,
    children: [
      { label: 'Overview', path: '/dashboard', icon: <LayoutDashboard className="h-4 w-4" /> },
      { label: 'Enrollment', path: '/dashboard/enrollment', icon: <BarChart3 className="h-4 w-4" /> },
      { label: 'Payments', path: '/dashboard/payments', icon: <CreditCard className="h-4 w-4" /> },
      { label: 'Policies', path: '/dashboard/policies', icon: <Shield className="h-4 w-4" /> },
    ],
    roles: ['platform_admin', 'sacco_admin', 'kba_admin', 'insurance_admin'],
  },
  {
    label: 'User Management',
    path: '/admin/users',
    icon: <Users className="h-5 w-5" />,
    roles: ['platform_admin'],
  },
  {
    label: 'Users',
    path: '/users',
    icon: <Users className="h-5 w-5" />,
    roles: ['platform_admin'],
  },
  {
    label: 'Organizations',
    path: '/organizations',
    icon: <Building2 className="h-5 w-5" />,
    roles: ['platform_admin', 'sacco_admin', 'kba_admin'],
  },
  {
    label: 'KYC Review',
    path: '/kyc',
    icon: <FileCheck className="h-5 w-5" />,
    roles: ['platform_admin'],
  },
  {
    label: 'Reports',
    path: '/reports',
    icon: <FileBarChart className="h-5 w-5" />,
    roles: ['platform_admin', 'sacco_admin', 'kba_admin', 'insurance_admin'],
  },
  {
    label: 'Settings',
    path: '/settings',
    icon: <Settings className="h-5 w-5" />,
    children: [
      { label: 'General', path: '/settings', icon: <Settings className="h-4 w-4" /> },
      { label: 'Policy Terms', path: '/settings/policy-terms', icon: <FileText className="h-4 w-4" />, roles: ['platform_admin', 'insurance_admin'] },
    ],
    roles: ['platform_admin', 'insurance_admin'],
  },
];

export function Sidebar() {
  const location = useLocation();
  const { user } = useAuthStore();
  const [expandedItems, setExpandedItems] = useState<string[]>(['Dashboard']);

  // Get navigation items based on user role
  const navItems = useMemo(() => {
    if (!user) return [];

    // Riders see rider-specific navigation
    if (user.role === 'rider') {
      return riderNavItems;
    }

    // Admin users see filtered admin navigation based on their role
    return adminNavItems.filter((item) => {
      if (!item.roles) return true; // No role restriction
      return item.roles.includes(user.role);
    });
  }, [user]);

  const toggleExpand = (label: string) => {
    setExpandedItems((prev) =>
      prev.includes(label) ? prev.filter((l) => l !== label) : [...prev, label]
    );
  };

  const isActive = (path: string) => {
    if (path === '/dashboard' || path === '/my/wallet') {
      return location.pathname === path;
    }
    return location.pathname.startsWith(path);
  };

  // Get home link based on role
  const homeLink = user?.role === 'rider' ? '/my/wallet' : '/dashboard';

  return (
    <aside className="hidden w-64 flex-col border-r bg-card lg:flex">
      {/* Logo */}
      <div className="flex h-16 items-center border-b px-6">
        <Link to={homeLink} className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
            <Shield className="h-5 w-5 text-primary-foreground" />
          </div>
          <span className="text-lg font-semibold">BodaInsure</span>
        </Link>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto p-4">
        <ul className="space-y-1">
          {navItems.map((item) => (
            <li key={item.label}>
              {item.children ? (
                <>
                  <button
                    onClick={() => toggleExpand(item.label)}
                    className={cn(
                      'flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                      isActive(item.path)
                        ? 'bg-primary/10 text-primary'
                        : 'text-muted-foreground hover:bg-accent hover:text-foreground'
                    )}
                  >
                    <div className="flex items-center gap-3">
                      {item.icon}
                      {item.label}
                    </div>
                    <ChevronDown
                      className={cn(
                        'h-4 w-4 transition-transform',
                        expandedItems.includes(item.label) && 'rotate-180'
                      )}
                    />
                  </button>
                  {expandedItems.includes(item.label) && (
                    <ul className="ml-4 mt-1 space-y-1 border-l pl-4">
                      {item.children.map((child) => (
                        <li key={child.path}>
                          <Link
                            to={child.path}
                            className={cn(
                              'flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors',
                              location.pathname === child.path
                                ? 'bg-primary/10 text-primary'
                                : 'text-muted-foreground hover:bg-accent hover:text-foreground'
                            )}
                          >
                            {child.icon}
                            {child.label}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  )}
                </>
              ) : (
                <Link
                  to={item.path}
                  className={cn(
                    'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                    isActive(item.path)
                      ? 'bg-primary/10 text-primary'
                      : 'text-muted-foreground hover:bg-accent hover:text-foreground'
                  )}
                >
                  {item.icon}
                  {item.label}
                </Link>
              )}
            </li>
          ))}
        </ul>
      </nav>

      {/* Footer */}
      <div className="border-t p-4">
        <p className="text-xs text-muted-foreground">
          {user?.role === 'rider' ? 'BodaInsure v1.0' : 'BodaInsure Admin v1.0'}
        </p>
      </div>
    </aside>
  );
}
