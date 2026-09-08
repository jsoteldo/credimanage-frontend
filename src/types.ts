export type UserRole = 'Administrador' | 'Cajero';

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  avatar?: string;
  active: boolean;
  approved?: boolean;
  permissions?: string[];
  createdAt?: string;
}

export type CurrentView =
  | 'dashboard'
  | 'clients'
  | 'debt'
  | 'bank'
  | 'reports'
  | 'admin'
  | 'settings'
  | 'products'
  | 'departments'
  | 'kits'
  | 'suppliers'
  | 'locations';

export type ClientStatus = 'Activo' | 'Desactivado';
export type PaymentPeriod = 'Semanal' | 'Quincenal' | 'Mensual' | 'Día Fijo';

export interface Client {
  id: string;
  clientNumber: string;
  name: string;
  phone: string;
  address: string;
  creditLimit: number;
  currentBalance: number; // positive = owes money, 0 = clean, negative = balance in favor
  dailyDebtBalance?: number; // Deuda corriente pendiente (consumos/compras en tienda)
  bankDebtBalance?: number; // Saldo pendiente en créditos con intereses (sum(pendingAmount))
  creditExposure?: number; // Exposición crediticia total: max(0, daily) + bank
  availableCredit?: number | null; // Crédito disponible contractual o null si sin límite
  balanceModelVersion?: string;
  balanceOrigin?: 'MIGRATED_BASELINE' | 'NATIVE_V1' | null;
  paymentPeriod?: PaymentPeriod;
  paymentDay?: string; // e.g. "15" or "Lunes" or "Día 11"
  nextDueDate?: string; // e.g. "2026-08-11" (YYYY-MM-DD)
  status: ClientStatus;
  createdAt: string;
  updatedAt: string;
}

export type OperationStatus = 'Activo' | 'Anulado';

export type PaymentFrequency = 'Semanal' | 'Quincenal' | 'Mensual';
export type InstallmentStatus = 'Pendiente' | 'Pagada' | 'Parcial' | 'Vencida' | 'Anulada';
export type LoanStatus = 'Activo' | 'Pagado' | 'Vencido' | 'Anulado';

export interface LoanInstallment {
  installmentNumber: number;
  dueDate: string; // YYYY-MM-DD
  capital: number;
  interest: number;
  amount: number; // capital + interest
  paidAmount?: number;
  status: InstallmentStatus;
  paidDate?: string;
}

export interface LoanCredit {
  id: string;
  code: string; // e.g. CR-000123
  clientId: string;
  clientName?: string;
  clientNumber?: string;
  date: string;
  product?: string;
  capital: number;
  interestRate: number; // e.g. 10 for 10%
  interestAmount: number; // e.g. 100
  totalAmount: number; // e.g. 1100
  installmentsCount: number; // e.g. 5
  installmentAmount: number; // e.g. 220
  frequency: PaymentFrequency;
  firstDueDate: string;
  paidAmount: number;
  pendingAmount: number;
  paidInstallmentsCount?: number;
  status: LoanStatus;
  installments: LoanInstallment[];
  ticketNumber?: string;
  registeredBy: string;
  notes?: string;
  annulledAt?: string;
  annulledBy?: string;
  annulmentReason?: string;
}

export interface CreditPurchase {
  id: string;
  clientId: string;
  date: string;
  product: string;
  unitPrice: number;
  quantity: number;
  amount: number;
  ticketNumber?: string;
  registeredBy: string;
  status: OperationStatus;
  debtType?: 'simple' | 'credit';
  loanId?: string;
  annulledAt?: string;
  annulledBy?: string;
  annulmentReason?: string;
}

export type PaymentTargetType =
  | 'dailyDebt'
  | 'bankLoan'
  | 'legacyDirect'
  | 'legacyUnknown'
  | 'legacyMixed';

export interface PaymentAllocation {
  type: 'bankLoan' | 'dailyDebt';
  amount: number;
  loanId?: string;
  installmentNumber?: number;
}

export interface Payment {
  id: string;
  clientId: string;
  date: string;
  amount: number;
  previousBalance: number;
  resultingBalance: number;
  paymentMethod: 'Efectivo' | 'Tarjeta' | 'Transferencia';
  cardSurcharge?: number;
  totalCharged?: number;
  registeredBy: string;
  status: OperationStatus;
  notes?: string;
  loanId?: string;
  targetType?: PaymentTargetType;
  allocations?: PaymentAllocation[];
  annulledAt?: string;
  annulledBy?: string;
  annulmentReason?: string;
}

export interface BalanceTransferAllocation {
  installmentNumber: number;
  amountApplied: number;
}

export interface BalanceTransfer {
  id: string;
  clientId: string;
  date: string;
  amount: number; // Siempre positivo (> 0)
  sourceBalance: 'dailyDebtBalance';
  targetLoanId: string;
  affectedInstallments: BalanceTransferAllocation[];
  registeredBy: string;
  reason: string;
  status: OperationStatus;
  annulledAt?: string;
  annulledBy?: string;
  annulmentReason?: string;
}

export interface BalanceOpeningSnapshot {
  id: string;
  clientId: string;
  migrationVersion: string;
  cutOffDate?: string;
  migrationDate?: string;
  dailyDebtOpeningBalance: number;
  bankDebtOpeningBalance: number;
  currentOpeningBalance: number;
  creditExposureOpening: number;
  legacyUnknownPaymentCount: number;
  legacyMixedPaymentCount?: number;
  status: 'ACTIVO' | 'CONCILIADO' | 'AJUSTE_CENTAVOS' | 'DISCREPANCIA_CRITICA' | 'ANULADO';
  reconciliationRef?: string;
  notes?: string;
  createdAt: string;
}

export interface CreditPurchaseWithClient extends CreditPurchase {
  clientName: string;
  clientNumber: string;
  clientPhone?: string;
}

export interface PaymentWithClient extends Payment {
  clientName: string;
  clientNumber: string;
  clientPhone?: string;
}

export interface AuditLog {
  id: string;
  timestamp: string;
  userId: string;
  userName: string;
  userRole: UserRole;
  action: string;
  details: string;
  targetId?: string;
  ip?: string;
}

export interface DashboardMetrics {
  totalClients: number;
  clientsWithDebt: number;
  totalPendingDebt: number;
  clientsWithBalanceInFavor: number;
  todayPaymentsTotal: number;
  todayPaymentsCount: number;
  clientsAtLimitCount?: number;
  clientsAtLimitNames?: string[];
}

export interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
}

// =========================================================================
// MÓDULO PRODUCTOS E INVENTARIO - ENTREGA 1 (TIPOS FRONTEND)
// =========================================================================

export type LocationType = 'STORE' | 'WAREHOUSE';

export interface Location {
  id: string;
  businessId: string;
  name: string;
  code?: string | null;
  address?: string | null;
  type: LocationType;
  active: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface Department {
  id: string;
  businessId: string;
  name: string;
  description?: string | null;
  active: boolean;
  _count?: {
    products: number;
  };
  createdAt?: string;
  updatedAt?: string;
}

export interface Supplier {
  id: string;
  businessId: string;
  name: string;
  taxId?: string | null;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  contactName?: string | null;
  active: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export type ProductSaleType = 'UNIT' | 'WEIGHT' | 'KIT';

export interface ProductKitComponent {
  id: string;
  componentProductId: string;
  componentSku: string;
  componentName: string;
  quantity: number;
  saleType: ProductSaleType;
}

export interface Product {
  id: string;
  businessId: string;
  sku: string;
  barcode?: string | null;
  name: string;
  description?: string | null;
  departmentId?: string | null;
  departmentName?: string | null;
  department?: Department | null;
  saleType: ProductSaleType;
  costPrice: number;
  salePrice: number;
  wholesalePrice: number | null;
  tracksInventory: boolean;
  defaultMinStock: number | null;
  active: boolean;
  components?: ProductKitComponent[];
  kitComponents?: any[];
  createdAt?: string;
  updatedAt?: string;
}

export interface ImportProductsResult {
  success: boolean;
  totalRowsProcessed: number;
  createdCount: number;
  updatedCount: number;
  departmentsCreated: number;
  errors: { row: number; error: string; data?: any }[];
  pendingStockNotice: string;
}

export interface Permission {
  id: string;
  code: string;
  name: string;
  module: string;
  description?: string;
}

export interface Role {
  id: string;
  name: string;
  description?: string;
  isSystem: boolean;
  permissions?: { permission: Permission }[];
}
