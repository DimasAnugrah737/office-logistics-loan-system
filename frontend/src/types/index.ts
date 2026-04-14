export interface User {
  _id: string;
  fullName: string;
  nip: string;
  email: string;
  role: 'admin' | 'officer' | 'user';
  department?: string;
  position?: string;
  phone?: string;
  isActive: boolean;
  themePreference: 'light' | 'dark';
  createdAt: string;
  updatedAt: string;
}

export interface Category {
  _id: string;
  name: string;
  description?: string;
  createdBy: User | string;
  createdAt: string;
  updatedAt: string;
}

export interface Item {
  _id: string;
  name: string;
  description?: string;
  category: Category | string;
  serialNumber?: string;
  quantity: number;
  availableQuantity: number;
  condition: 'excellent' | 'good' | 'fair' | 'poor' | 'broken';
  location?: string;
  image?: string;
  specifications?: Record<string, string>;
  isAvailable: boolean;
  createdBy: User | string;
  createdAt: string;
  updatedAt: string;
}

export interface Borrowing {
  _id: string;
  user: User | string;
  item: Item | string;
  quantity: number;
  borrowDate: string;
  expectedReturnDate: string;
  actualReturnDate?: string;
  purpose?: string;
  status: 'pending' | 'approved' | 'rejected' | 'borrowed' | 'returned' | 'overdue';
  approvedBy?: User | string;
  approvedAt?: string;
  returnApprovedBy?: User | string;
  returnApprovedAt?: string;
  notes?: string;
  penalty: number;
  conditionBefore?: string;
  conditionAfter?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Notification {
  _id: string;
  user: User | string;
  title: string;
  message: string;
  type: 'borrow_request' | 'return_request' | 'approval' | 'rejection' | 'overdue' | 'system';
  relatedBorrowing?: Borrowing | string;
  isRead: boolean;
  readAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ActivityLog {
  _id: string;
  user: User | string;
  action: string;
  entityType: 'user' | 'item' | 'category' | 'borrowing' | 'return' | 'system';
  entityId?: string;
  details?: any;
  ipAddress?: string;
  userAgent?: string;
  createdAt: string;
  updatedAt: string;
}

export interface DashboardStats {
  totalBorrowings: number;
  totalItems: number;
  totalUsers: number;
  currentMonthBorrowings: number;
  pendingBorrowings: number;
  overdueBorrowings: number;
  availableItems: number;
  statusStats: Array<{ _id: string; count: number }>;
  monthlyTrends: Array<{ _id: { year: number; month: number }; count: number }>;
}

export interface LoginCredentials {
  identifier: string;
  password: string;
}

export interface CreateUserData {
  fullName: string;
  nip: string;
  email: string;
  password: string;
  role: 'admin' | 'officer' | 'user';
  department?: string;
  position?: string;
  phone?: string;
}

export interface CreateItemData {
  name: string;
  description?: string;
  category: string;
  serialNumber?: string;
  quantity: number;
  condition?: string;
  location?: string;
  specifications?: Record<string, string>;
}

export interface BorrowingRequest {
  itemId: string;
  quantity: number;
  expectedReturnDate: string;
  purpose: string;
}

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
}