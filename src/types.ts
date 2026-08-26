export type UserRole = 'Administrador' | 'Cajero';

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  avatar?: string;
  active: boolean;
  createdAt: string;
}

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
  annulledAt?: string;
  annulledBy?: string;
  annulmentReason?: string;
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
