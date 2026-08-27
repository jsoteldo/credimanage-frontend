import {
  User,
  Client,
  CreditPurchase,
  Payment,
  AuditLog,
  DashboardMetrics,
  LoanCredit,
} from '../types';

const TOKEN_KEY = 'credimanage_pos_token';

export const getAuthToken = (): string | null => localStorage.getItem(TOKEN_KEY);
export const setAuthToken = (token: string) => localStorage.setItem(TOKEN_KEY, token);
export const removeAuthToken = () => localStorage.removeItem(TOKEN_KEY);

const BASE_URL = (import.meta as any).env?.VITE_API_URL || 'https://credimanage-vdq7ahdckq-rj.a.run.app/crediApi';

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const token = getAuthToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const url = endpoint.startsWith('/api')
    ? `${BASE_URL}${endpoint.replace(/^\/api/, '')}`
    : `${BASE_URL}${endpoint}`;

  const res = await fetch(url, {
    ...options,
    headers,
  });

  const data = await res.json();

  if (!res.ok) {
    throw new Error(data.error || 'Ocurrió un error en la solicitud');
  }

  return data as T;
}

export const api = {
  // Auth
  login: (email: string, password: string) =>
    request<{ token: string; user: User }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),

  getMe: () => request<{ user: User }>('/api/auth/me'),

  // Dashboard
  getDashboardKPIs: () => request<DashboardMetrics>('/api/dashboard/kpis'),

  // Clients
  getClients: (searchQuery: string = '', status: string = 'todos') => {
    const params = new URLSearchParams();
    if (searchQuery) params.append('q', searchQuery);
    if (status) params.append('status', status);
    return request<Client[]>(`/api/clients?${params.toString()}`);
  },

  createClient: (clientData: Partial<Client>) =>
    request<Client>('/api/clients', {
      method: 'POST',
      body: JSON.stringify(clientData),
    }),

  updateClient: (id: string, clientData: Partial<Client>) =>
    request<Client>(`/api/clients/${id}`, {
      method: 'PUT',
      body: JSON.stringify(clientData),
    }),

  deactivateClient: (id: string) =>
    request<{ message: string; client: Client }>(`/api/clients/${id}/deactivate`, {
      method: 'POST',
    }),

  reactivateClient: (id: string) =>
    request<{ message: string; client: Client }>(`/api/clients/${id}/reactivate`, {
      method: 'POST',
    }),

  deleteClient: (id: string) =>
    request<{ message: string }>(`/api/clients/${id}`, {
      method: 'DELETE',
    }),

  // Statement of Account
  getStatementOfAccount: (id: string) =>
    request<{
      client: Client;
      availableCredit: number | string;
      purchases: CreditPurchase[];
      payments: Payment[];
      loans?: LoanCredit[];
    }>(`/api/clients/${id}/statement`),

  // Loans / Créditos con Intereses
  createLoanCredit: (
    clientId: string,
    loanData: {
      capital: number;
      interestRate: number;
      interestAmount: number;
      totalAmount: number;
      installmentsCount: number;
      installmentAmount: number;
      frequency: string;
      firstDueDate: string;
      product?: string;
      ticketNumber?: string;
      notes?: string;
      date?: string;
    }
  ) =>
    request<{ loan: LoanCredit; purchase: CreditPurchase; client: Client; message: string }>(
      `/api/clients/${clientId}/loans`,
      {
        method: 'POST',
        body: JSON.stringify(loanData),
      }
    ),

  getClientLoans: (clientId: string) => request<LoanCredit[]>(`/api/clients/${clientId}/loans`),

  getLoanById: (loanId: string) => request<LoanCredit>(`/api/loans/${loanId}`),

  annulLoan: (loanId: string, reason: string) =>
    request<{ message: string; loan: LoanCredit; client: Client }>(`/api/loans/${loanId}/annul`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    }),

  // Credit Purchase
  addCreditPurchase: (
    clientId: string,
    purchase: { product: string; unitPrice: number; quantity: number; ticketNumber?: string; date?: string }
  ) =>
    request<{ purchase: CreditPurchase; client: Client }>(`/api/clients/${clientId}/credit-purchase`, {
      method: 'POST',
      body: JSON.stringify(purchase),
    }),

  // Payment / Abono
  registerPayment: (
    clientId: string,
    payment: {
      amount: number;
      paymentMethod: 'Efectivo' | 'Tarjeta' | 'Transferencia';
      notes?: string;
      isFullPayoff?: boolean;
    }
  ) =>
    request<{ payment: Payment; client: Client; message: string }>(`/api/clients/${clientId}/payment`, {
      method: 'POST',
      body: JSON.stringify(payment),
    }),

  annulPayment: (paymentId: string, reason: string) =>
    request<{ message: string; payment: Payment; client: Client }>(`/api/payments/${paymentId}/annul`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    }),

  getPaymentsHistory: (params: {
    dateFilter?: string;
    startDate?: string;
    endDate?: string;
    query?: string;
  } = {}) => {
    const urlParams = new URLSearchParams();
    if (params.dateFilter) urlParams.append('dateFilter', params.dateFilter);
    if (params.startDate) urlParams.append('startDate', params.startDate);
    if (params.endDate) urlParams.append('endDate', params.endDate);
    if (params.query) urlParams.append('q', params.query);
    return request<{
      payments: (Payment & { clientName: string; clientNumber: string; clientPhone?: string })[];
      summary: { count: number; totalAmount: number };
    }>(`/api/payments/history?${urlParams.toString()}`);
  },

  getPurchasesHistory: (params: {
    dateFilter?: string;
    startDate?: string;
    endDate?: string;
    query?: string;
  } = {}) => {
    const urlParams = new URLSearchParams();
    if (params.dateFilter) urlParams.append('dateFilter', params.dateFilter);
    if (params.startDate) urlParams.append('startDate', params.startDate);
    if (params.endDate) urlParams.append('endDate', params.endDate);
    if (params.query) urlParams.append('q', params.query);
    return request<{
      purchases: (CreditPurchase & { clientName: string; clientNumber: string; clientPhone?: string })[];
      summary: { count: number; totalAmount: number };
    }>(`/api/purchases/history?${urlParams.toString()}`);
  },

  // Reports
  getBalanceReport: (filter: string = 'Todos', query: string = '') => {
    const params = new URLSearchParams();
    if (filter) params.append('filter', filter);
    if (query) params.append('q', query);
    return request<{
      report: Client[];
      summary: { totalClientsDebt: number; totalPortfolioAmount: number };
    }>(`/api/reports/balance?${params.toString()}`);
  },

  // Admin
  getUsers: () => request<User[]>('/api/admin/users'),

  createUser: (userData: { name: string; email: string; role: string; password?: string; active?: boolean; approved?: boolean }) =>
    request<User>('/api/admin/users', {
      method: 'POST',
      body: JSON.stringify(userData),
    }),

  updateUserPermissions: (id: string, updates: { role?: string; active?: boolean }) =>
    request<User>(`/api/admin/users/${id}/role`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    }),

  updateUser: (id: string, updates: any) =>
    request<User>(`/api/admin/users/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(updates),
    }),

  approveUser: (id: string) =>
    request<User>(`/api/admin/users/${id}/approve`, {
      method: 'PATCH',
    }),

  enableUser: (id: string) =>
    request<User>(`/api/admin/users/${id}/enable`, {
      method: 'PATCH',
    }),

  disableUser: (id: string) =>
    request<User>(`/api/admin/users/${id}/disable`, {
      method: 'PATCH',
    }),

  getAuditLogs: () => request<AuditLog[]>('/api/admin/audit-logs'),

  getAnnulledOperations: () =>
    request<{ annulledPurchases: CreditPurchase[]; annulledPayments: Payment[] }>(
      '/api/admin/annulled-operations'
    ),

  // Public register
  register: (userData: any) =>
    request<{ message: string; user: any }>('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify(userData),
    }),

  // Payments approval workflow
  getPendingPayments: () => request<any[]>('/api/payments/pending'),

  approvePayment: (paymentId: string) =>
    request<{ message: string; payment: Payment }>(`/api/payments/${paymentId}/approve`, {
      method: 'POST',
    }),

  rejectPayment: (paymentId: string, reason: string) =>
    request<{ message: string; payment: Payment }>(`/api/payments/${paymentId}/reject`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    }),
};
