import {
  User,
  Client,
  CreditPurchase,
  Payment,
  AuditLog,
  DashboardMetrics,
  LoanCredit,
  Location,
  Department,
  Supplier,
  Product,
  ProductKitComponent,
  ImportProductsResult,
  Permission,
  Role,
  WhatsAppReminderConfig,
  InventoryStockItem,
  InventoryMovement,
  InventoryKpis,
  ProductStockDetail,
  Sale,
  SaleSummaryItem,
  CreateSalePayload,
  CashRegister,
  CashSession,
  CashSessionSummary,
  CashMovement,
  Receipt,
  ReceiptConfig,
} from '../types';

const TOKEN_KEY = 'credimanage_pos_token';

export const getAuthToken = (): string | null => localStorage.getItem(TOKEN_KEY);
export const setAuthToken = (token: string) => localStorage.setItem(TOKEN_KEY, token);
export const removeAuthToken = () => localStorage.removeItem(TOKEN_KEY);

/**
 * Resolución dinámica de la URL del Backend:
 * - En Local: Toma VITE_API_URL de .env.local o .env.development (ej. http://localhost:3001/crediApi).
 * - En Vercel: Toma la variable de entorno VITE_API_URL configurada en el panel de Vercel (Project Settings -> Environment Variables).
 * - Fallbacks seguros: En modo desarrollo local usa http://localhost:3001/crediApi, en producción usa /api.
 */
function getBaseUrl(): string {
  let envUrl = ((import.meta as any).env?.VITE_API_URL as string | undefined)?.trim();
  if (envUrl) {
    // Remover barra final si existe
    envUrl = envUrl.endsWith('/') ? envUrl.slice(0, -1) : envUrl;

    // Si es una URL completa (http:// o https://) y no termina en /crediApi, agregar automáticamente /crediApi
    if (/^https?:\/\//i.test(envUrl) && !envUrl.endsWith('/crediApi')) {
      envUrl = `${envUrl}/crediApi`;
    }
    return envUrl;
  }
  if ((import.meta as any).env?.DEV) {
    return 'http://localhost:3001/crediApi';
  }
  return '/api';
}

const BASE_URL = getBaseUrl();

function buildUrl(endpoint: string): string {
  const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  if (BASE_URL === '/api') {
    return cleanEndpoint.startsWith('/api') ? cleanEndpoint : `/api${cleanEndpoint}`;
  }
  // Remueve el prefijo /api si el endpoint ya lo incluye para evitar /crediApi/api/...
  const cleanPath = cleanEndpoint.replace(/^\/api(?=\/|$)/, '');
  return `${BASE_URL}${cleanPath.startsWith('/') ? cleanPath : `/${cleanPath}`}`;
}

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const token = getAuthToken();
  const headers: Record<string, string> = {
    ...(options.body instanceof FormData ? {} : { 'Content-Type': 'application/json' }),
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const url = buildUrl(endpoint);

  let res: Response;
  try {
    res = await fetch(url, {
      ...options,
      headers,
    });
  } catch (networkError: any) {
    const err = new Error(
      'No se pudo conectar con el servidor backend. Por favor verifica tu conexión o el estado del servicio.'
    ) as Error & { status?: number; isNetworkError?: boolean };
    err.isNetworkError = true;
    throw err;
  }

  let data: any = null;
  const contentType = res.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    try {
      data = await res.json();
    } catch {
      data = null;
    }
  }

  if (!res.ok) {
    let errorMsg = data?.message || data?.error;
    if (Array.isArray(errorMsg)) {
      errorMsg = errorMsg.join(', ');
    }

    if (!errorMsg) {
      if (res.status === 401) {
        errorMsg = 'Credenciales incorrectas o sesión expirada. Por favor inicie sesión nuevamente.';
      } else if (res.status === 403) {
        errorMsg = 'Acceso denegado (403 Forbidden). Verifica los permisos del backend en Cloud Run.';
      } else if (res.status === 502 || res.status === 503 || res.status === 504) {
        errorMsg = 'El servidor backend no está disponible temporalmente (503/502). Inténtalo de nuevo en unos momentos.';
      } else if (res.status === 404) {
        errorMsg = 'El recurso solicitado no fue encontrado en el servidor (404).';
      } else {
        errorMsg = `Error en el servidor (${res.status} ${res.statusText || ''})`.trim();
      }
    }

    const err = new Error(errorMsg) as Error & { status?: number; statusCode?: number };
    err.status = res.status;
    err.statusCode = res.status;
    throw err;
  }

  return (data !== null ? data : {}) as T;
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

  getAllLoans: () => request<LoanCredit[]>('/api/loans'),

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

  annulCreditPurchase: (purchaseId: string, reason: string) =>
    request<{ message: string; purchase: CreditPurchase; client: Client }>(`/api/purchases/${purchaseId}/annul`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    }),

  // Payment / Abono - Flujos Específicos
  payDailyDebt: (
    clientId: string,
    payment: {
      amount: number;
      paymentMethod: 'Efectivo' | 'Tarjeta' | 'Transferencia';
      notes?: string;
      isFullPayoff?: boolean;
    }
  ) =>
    request<{ payment: Payment; client: Client; message: string }>(`/api/clients/${clientId}/debt-payment`, {
      method: 'POST',
      body: JSON.stringify(payment),
    }),

  payLoan: (
    loanId: string,
    payment: {
      amount: number;
      paymentMethod: 'Efectivo' | 'Tarjeta' | 'Transferencia';
      notes?: string;
      isFullPayoff?: boolean;
    }
  ) =>
    request<{ payment: Payment; client: Client; message: string }>(`/api/loans/${loanId}/payment`, {
      method: 'POST',
      body: JSON.stringify(payment),
    }),

  // Legacy Generic Payment (conservado exclusivamente para retrocompatibilidad, no invocar desde UI moderna)
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

  // =========================================================================
  // MÓDULO PRODUCTOS E INVENTARIO - BASE DEL DOMINIO
  // =========================================================================

  // Locations (Tiendas y Almacenes)
  getLocations: (params?: { type?: string; active?: string | boolean; q?: string }) => {
    const urlParams = new URLSearchParams();
    if (params?.type) urlParams.append('type', params.type);
    if (params?.active !== undefined) urlParams.append('active', String(params.active));
    if (params?.q) urlParams.append('q', params.q);
    return request<Location[]>(`/api/locations?${urlParams.toString()}`);
  },

  getLocationById: (id: string) => request<Location>(`/api/locations/${id}`),

  createLocation: (data: Partial<Location>) =>
    request<Location>('/api/locations', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  updateLocation: (id: string, data: Partial<Location>) =>
    request<Location>(`/api/locations/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  deactivateLocation: (id: string) =>
    request<Location>(`/api/locations/${id}/deactivate`, {
      method: 'PATCH',
    }),

  reactivateLocation: (id: string) =>
    request<Location>(`/api/locations/${id}/reactivate`, {
      method: 'PATCH',
    }),

  // Departments
  getDepartments: (params?: { active?: string | boolean; q?: string }) => {
    const urlParams = new URLSearchParams();
    if (params?.active !== undefined) urlParams.append('active', String(params.active));
    if (params?.q) urlParams.append('q', params.q);
    return request<Department[]>(`/api/departments?${urlParams.toString()}`);
  },

  getDepartmentById: (id: string) => request<Department>(`/api/departments/${id}`),

  createDepartment: (data: Partial<Department>) =>
    request<Department>('/api/departments', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  updateDepartment: (id: string, data: Partial<Department>) =>
    request<Department>(`/api/departments/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  deactivateDepartment: (id: string) =>
    request<Department>(`/api/departments/${id}/deactivate`, {
      method: 'PATCH',
    }),

  reactivateDepartment: (id: string) =>
    request<Department>(`/api/departments/${id}/reactivate`, {
      method: 'PATCH',
    }),

  deleteDepartment: (id: string) =>
    request<{ message: string }>(`/api/departments/${id}`, {
      method: 'DELETE',
    }),

  // Suppliers
  getSuppliers: (params?: { active?: string | boolean; q?: string }) => {
    const urlParams = new URLSearchParams();
    if (params?.active !== undefined) urlParams.append('active', String(params.active));
    if (params?.q) urlParams.append('q', params.q);
    return request<Supplier[]>(`/api/suppliers?${urlParams.toString()}`);
  },

  getSupplierById: (id: string) => request<Supplier>(`/api/suppliers/${id}`),

  createSupplier: (data: Partial<Supplier>) =>
    request<Supplier>('/api/suppliers', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  updateSupplier: (id: string, data: Partial<Supplier>) =>
    request<Supplier>(`/api/suppliers/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  deactivateSupplier: (id: string) =>
    request<Supplier>(`/api/suppliers/${id}/deactivate`, {
      method: 'PATCH',
    }),

  reactivateSupplier: (id: string) =>
    request<Supplier>(`/api/suppliers/${id}/reactivate`, {
      method: 'PATCH',
    }),

  // Products and Kits
  getProducts: (params?: {
    q?: string;
    departmentId?: string;
    saleType?: string;
    active?: string | boolean;
  }) => {
    const urlParams = new URLSearchParams();
    if (params?.q) urlParams.append('q', params.q);
    if (params?.departmentId) urlParams.append('departmentId', params.departmentId);
    if (params?.saleType) urlParams.append('saleType', params.saleType);
    if (params?.active !== undefined) urlParams.append('active', String(params.active));
    return request<Product[]>(`/api/products?${urlParams.toString()}`);
  },

  getProductById: (id: string) => request<Product>(`/api/products/${id}`),

  createProduct: (data: any) =>
    request<Product>('/api/products', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  updateProduct: (id: string, data: any) =>
    request<Product>(`/api/products/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  deactivateProduct: (id: string) =>
    request<Product>(`/api/products/${id}/deactivate`, {
      method: 'PATCH',
    }),

  reactivateProduct: (id: string) =>
    request<Product>(`/api/products/${id}/reactivate`, {
      method: 'PATCH',
    }),

  getProductComponents: (id: string) =>
    request<ProductKitComponent[]>(`/api/products/${id}/components`),

  importProductsFile: (formData: FormData) =>
    request<ImportProductsResult>('/api/products/import', {
      method: 'POST',
      body: formData,
    }),

  importProductsRows: (rows: any[]) =>
    request<ImportProductsResult>('/api/products/import', {
      method: 'POST',
      body: JSON.stringify({ rows }),
    }),

  // Roles & Permissions
  getRoles: () => request<Role[]>('/api/roles'),
  getRoleById: (id: string) => request<Role>(`/api/roles/${id}`),
  createRole: (data: { name: string; description?: string }) =>
    request<Role>('/api/roles', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  updateRolePermissions: (id: string, permissions: string[]) =>
    request<Role>(`/api/roles/${id}/permissions`, {
      method: 'PUT',
      body: JSON.stringify({ permissions }),
    }),
  getAllPermissions: () => request<Permission[]>('/api/permissions'),

  // Settings - WhatsApp Collection Reminder Template
  getWhatsAppReminderConfig: () =>
    request<WhatsAppReminderConfig>('/api/settings/whatsapp-collection-reminder'),

  updateWhatsAppReminderConfig: (template: string) =>
    request<WhatsAppReminderConfig>('/api/settings/whatsapp-collection-reminder', {
      method: 'PUT',
      body: JSON.stringify({ template }),
    }),

  resetWhatsAppReminderConfig: () =>
    request<WhatsAppReminderConfig>('/api/settings/whatsapp-collection-reminder/reset', {
      method: 'POST',
    }),

  // =========================================================================
  // MÓDULO INVENTARIO MULTI-TIENDA / MULTI-ALMACÉN - ETAPA 1
  // =========================================================================
  getInventoryStock: (params?: {
    locationId?: string;
    departmentId?: string;
    q?: string;
    stockState?: string;
  }) => {
    const urlParams = new URLSearchParams();
    if (params?.locationId) urlParams.append('locationId', params.locationId);
    if (params?.departmentId && params.departmentId !== 'todos')
      urlParams.append('departmentId', params.departmentId);
    if (params?.q) urlParams.append('q', params.q);
    if (params?.stockState && params.stockState !== 'all')
      urlParams.append('stockState', params.stockState);
    return request<InventoryStockItem[]>(`/api/inventory/stock?${urlParams.toString()}`);
  },

  getInventoryKpis: (locationId?: string) => {
    const urlParams = new URLSearchParams();
    if (locationId) urlParams.append('locationId', locationId);
    return request<InventoryKpis>(`/api/inventory/kpis?${urlParams.toString()}`);
  },

  getInventoryMovements: (params?: {
    locationId?: string;
    productId?: string;
    type?: string;
    startDate?: string;
    endDate?: string;
    page?: number;
    limit?: number;
  }) => {
    const urlParams = new URLSearchParams();
    if (params?.locationId && params.locationId !== 'all')
      urlParams.append('locationId', params.locationId);
    if (params?.productId) urlParams.append('productId', params.productId);
    if (params?.type && params.type !== 'all') urlParams.append('type', params.type);
    if (params?.startDate) urlParams.append('startDate', params.startDate);
    if (params?.endDate) urlParams.append('endDate', params.endDate);
    if (params?.page) urlParams.append('page', String(params.page));
    if (params?.limit) urlParams.append('limit', String(params.limit));
    return request<{
      total: number;
      page: number;
      limit: number;
      totalPages: number;
      movements: InventoryMovement[];
    }>(`/api/inventory/movements?${urlParams.toString()}`);
  },

  getProductStockDetails: (productId: string) =>
    request<ProductStockDetail>(`/api/inventory/product/${productId}`),

  addInventory: (data: {
    locationId: string;
    productId: string;
    quantity: number;
    notes?: string;
  }) =>
    request<{
      success: boolean;
      productId: string;
      productName: string;
      locationId: string;
      locationName: string;
      previousStock: number;
      quantityAdded: number;
      newStock: number;
      state: string;
      movementId: string;
    }>('/api/inventory/entry', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  adjustInventory: (data: {
    locationId: string;
    productId: string;
    adjustmentQuantity: number;
    reason: string;
    notes?: string;
  }) =>
    request<{
      success: boolean;
      productId: string;
      productName: string;
      locationId: string;
      locationName: string;
      previousStock: number;
      adjustmentQuantity: number;
      newStock: number;
      state: string;
      movementId: string;
    }>('/api/inventory/adjust', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  transferInventory: (data: {
    fromLocationId: string;
    toLocationId: string;
    productId: string;
    quantity: number;
    notes?: string;
  }) =>
    request<{
      success: boolean;
      referenceId: string;
      productId: string;
      productName: string;
      quantityTransferred: number;
      fromLocation: {
        id: string;
        name: string;
        previousStock: number;
        newStock: number;
        state: string;
      };
      toLocation: {
        id: string;
        name: string;
        previousStock: number;
        newStock: number;
        state: string;
      };
    }>('/api/inventory/transfer', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  setMinimumStock: (data: {
    locationId: string;
    productId: string;
    minimumStock: number;
  }) =>
    request<{
      success: boolean;
      productId: string;
      locationId: string;
      minimumStock: number;
      currentQuantity: number;
      state: string;
    }>('/api/inventory/minimum-stock', {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),

  explodeKitComponents: (kitProductId: string, quantity = 1) =>
    request<
      {
        componentProductId: string;
        sku: string;
        name: string;
        quantityPerKit: number;
        totalQuantityDeduction: number;
      }[]
    >(`/api/inventory/kit/${kitProductId}/explode?quantity=${quantity}`),

  // =========================================================================
  // MÓDULO VENTAS / POS (ETAPA 2)
  // =========================================================================
  getSales: (params?: {
    storeId?: string;
    clientId?: string;
    status?: string;
    startDate?: string;
    endDate?: string;
    q?: string;
    limit?: number;
    offset?: number;
  }) => {
    const urlParams = new URLSearchParams();
    if (params?.storeId && params.storeId !== 'all') urlParams.append('storeId', params.storeId);
    if (params?.clientId && params.clientId !== 'all') urlParams.append('clientId', params.clientId);
    if (params?.status && params.status !== 'all' && params.status !== 'todos')
      urlParams.append('status', params.status);
    if (params?.startDate) urlParams.append('startDate', params.startDate);
    if (params?.endDate) urlParams.append('endDate', params.endDate);
    if (params?.q) urlParams.append('q', params.q);
    if (params?.limit) urlParams.append('limit', String(params.limit));
    if (params?.offset) urlParams.append('offset', String(params.offset));
    return request<{
      total: number;
      limit: number;
      offset: number;
      sales: SaleSummaryItem[];
    }>(`/api/sales?${urlParams.toString()}`);
  },

  getSaleById: (id: string) => request<Sale>(`/api/sales/${id}`),

  createSale: (payload: CreateSalePayload) =>
    request<Sale>('/api/sales', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  updateSale: (id: string, payload: CreateSalePayload) =>
    request<Sale>(`/api/sales/${id}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    }),

  annulSale: (id: string, reason: string) =>
    request<Sale>(`/api/sales/${id}/annul`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    }),

  // =========================================================================
  // MÓDULO CAJA, TURNOS, MOVIMIENTOS Y BOLETA SIMPLE (ETAPA 3)
  // =========================================================================
  getCashRegisters: (storeId?: string) =>
    request<CashRegister[]>(
      storeId && storeId !== 'all'
        ? `/api/cash/registers?storeId=${storeId}`
        : '/api/cash/registers',
    ),

  createCashRegister: (data: {
    storeId: string;
    code: string;
    name: string;
    status?: 'ACTIVE' | 'INACTIVE';
  }) =>
    request<CashRegister>('/api/cash/registers', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  updateCashRegister: (
    id: string,
    data: { code?: string; name?: string; status?: 'ACTIVE' | 'INACTIVE' },
  ) =>
    request<CashRegister>(`/api/cash/registers/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  updateCashRegisterStatus: (
    id: string,
    status: 'ACTIVE' | 'INACTIVE',
  ) =>
    request<CashRegister>(`/api/cash/registers/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    }),

  getCurrentCashSession: (storeId?: string) =>
    request<CashSession | null>(
      storeId && storeId !== 'all'
        ? `/api/cash/sessions/current?storeId=${storeId}`
        : '/api/cash/sessions/current',
    ),

  openCashSession: (data: {
    cashRegisterId: string;
    storeId: string;
    openingCashAmount: number;
    notes?: string;
  }) =>
    request<CashSession>('/api/cash/sessions/open', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  closeCashSession: (
    sessionId: string,
    data: { countedCashAmount: number; notes?: string },
  ) =>
    request<CashSession>(`/api/cash/sessions/${sessionId}/close`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  getCashSessionSummary: (sessionId: string) =>
    request<CashSessionSummary>(`/api/cash/sessions/${sessionId}/summary`),

  getCashSessionById: (sessionId: string) =>
    request<CashSession>(`/api/cash/sessions/${sessionId}`),

  getCashSessionsHistory: (params?: {
    storeId?: string;
    cashRegisterId?: string;
    userId?: string;
    status?: string;
    startDate?: string;
    endDate?: string;
    page?: number;
    limit?: number;
  }) => {
    const urlParams = new URLSearchParams();
    if (params?.storeId && params.storeId !== 'all') urlParams.append('storeId', params.storeId);
    if (params?.cashRegisterId && params.cashRegisterId !== 'all')
      urlParams.append('cashRegisterId', params.cashRegisterId);
    if (params?.userId && params.userId !== 'all') urlParams.append('userId', params.userId);
    if (params?.status && params.status !== 'all') urlParams.append('status', params.status);
    if (params?.startDate) urlParams.append('startDate', params.startDate);
    if (params?.endDate) urlParams.append('endDate', params.endDate);
    if (params?.page) urlParams.append('page', String(params.page));
    if (params?.limit) urlParams.append('limit', String(params.limit));
    return request<{
      items: CashSession[];
      pagination: { total: number; page: number; limit: number; totalPages: number };
    }>(`/api/cash/sessions?${urlParams.toString()}`);
  },

  addCashMovement: (
    sessionId: string,
    data: {
      type: 'CASH_IN' | 'CASH_OUT';
      amount: number;
      reason: string;
      notes?: string;
    },
  ) =>
    request<{
      movement: CashMovement;
      summary: CashSessionSummary;
      warning?: string | null;
    }>(`/api/cash/sessions/${sessionId}/movements`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  getCashMovements: (params?: {
    cashSessionId?: string;
    storeId?: string;
    type?: string;
    paymentMethod?: string;
    startDate?: string;
    endDate?: string;
    page?: number;
    limit?: number;
  }) => {
    const urlParams = new URLSearchParams();
    if (params?.cashSessionId) urlParams.append('cashSessionId', params.cashSessionId);
    if (params?.storeId && params.storeId !== 'all') urlParams.append('storeId', params.storeId);
    if (params?.type && params.type !== 'all') urlParams.append('type', params.type);
    if (params?.paymentMethod && params.paymentMethod !== 'all')
      urlParams.append('paymentMethod', params.paymentMethod);
    if (params?.startDate) urlParams.append('startDate', params.startDate);
    if (params?.endDate) urlParams.append('endDate', params.endDate);
    if (params?.page) urlParams.append('page', String(params.page));
    if (params?.limit) urlParams.append('limit', String(params.limit));
    return request<{
      items: CashMovement[];
      pagination: { total: number; page: number; limit: number; totalPages: number };
    }>(`/api/cash/movements?${urlParams.toString()}`);
  },

  getReceiptConfig: (storeId?: string) =>
    request<ReceiptConfig>(
      storeId && storeId !== 'all'
        ? `/api/cash/receipt-config?storeId=${storeId}`
        : '/api/cash/receipt-config',
    ),

  updateReceiptConfig: (data: Partial<ReceiptConfig>, storeId?: string) =>
    request<ReceiptConfig>(
      storeId && storeId !== 'all'
        ? `/api/cash/receipt-config?storeId=${storeId}`
        : '/api/cash/receipt-config',
      {
        method: 'PUT',
        body: JSON.stringify(data),
      },
    ),

  getSaleReceipt: (saleId: string) => request<Receipt>(`/api/sales/${saleId}/receipt`),

  reprintSaleReceipt: (saleId: string) =>
    request<Receipt>(`/api/sales/${saleId}/receipt/reprint`, {
      method: 'POST',
    }),
};
