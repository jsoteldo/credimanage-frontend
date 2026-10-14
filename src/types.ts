export type UserRole = 'Administrador' | 'Cajero' | 'Generico';


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
  | 'sales'
  | 'cash'
  | 'clients'
  | 'debt'
  | 'bank'
  | 'reports'
  | 'admin'
  | 'settings'
  | 'inventory'
  | 'products'
  | 'departments'
  | 'kits'
  | 'suppliers'
  | 'locations'
  | 'receipt-config';

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
  _count?: {
    users: number;
  };
}

export interface WhatsAppReminderConfig {
  key: string;
  template: string;
  isDefault: boolean;
  allowedVariables: string[];
  defaultTemplate: string;
}

// =========================================================================
// MÓDULO INVENTARIO MULTI-TIENDA / MULTI-ALMACÉN - ETAPA 1 (TIPOS FRONTEND)
// =========================================================================

export type StockState = 'NORMAL' | 'LOW' | 'OUT_OF_STOCK' | 'NEGATIVE';

export type InventoryMovementType =
  | 'INITIAL'
  | 'ENTRY'
  | 'ADJUSTMENT_POSITIVE'
  | 'ADJUSTMENT_NEGATIVE'
  | 'TRANSFER_OUT'
  | 'TRANSFER_IN'
  | 'SALE'
  | 'SALE_REVERSAL'
  | 'RETURN';

export interface InventoryStockItem {
  productId: string;
  productName: string;
  sku: string;
  barcode?: string | null;
  saleType: ProductSaleType;
  costPrice: number;
  salePrice: number;
  departmentId?: string | null;
  departmentName?: string | null;
  locationId: string;
  locationName: string;
  locationType: LocationType | null;
  quantity: number;
  minimumStock: number;
  state: StockState;
  lastMovement?: {
    type: InventoryMovementType;
    quantity: number;
    createdAt: string;
    notes?: string | null;
  } | null;
  locationBreakdown?: {
    locationId: string;
    locationName: string;
    locationType: LocationType;
    quantity: number;
    minimumStock: number;
    state: StockState;
  }[];
  updatedAt?: string;
}

export interface InventoryMovement {
  id: string;
  createdAt: string;
  productId: string;
  productName: string;
  sku: string;
  barcode?: string | null;
  saleType: ProductSaleType;
  locationId: string;
  locationName: string;
  locationType: LocationType;
  type: InventoryMovementType;
  quantity: number;
  previousStock: number;
  newStock: number;
  referenceType?: string | null;
  referenceId?: string | null;
  reason?: string | null;
  notes?: string | null;
  createdBy: string;
}

export interface InventoryKpis {
  totalProducts: number;
  inStockCount: number;
  lowStockCount: number;
  outOfStockCount: number;
  negativeStockCount: number;
}

export interface ProductStockDetail {
  product: {
    id: string;
    name: string;
    sku: string;
    barcode?: string | null;
    saleType: ProductSaleType;
    departmentName?: string | null;
    salePrice: number;
    costPrice?: number;
    defaultMinStock?: number;
    isKit: boolean;
  };
  isKit: boolean;
  locationStocks?: {
    locationId: string;
    locationName: string;
    locationType: LocationType;
    quantity: number;
    minimumStock: number;
    state: StockState;
    updatedAt?: string | null;
  }[];
  kitComponents?: {
    componentProductId: string;
    sku: string;
    name: string;
    quantity: number;
  }[];
  locationsAvailability?: {
    locationId: string;
    locationName: string;
    locationType: LocationType;
    availableKits: number;
    components: {
      componentProductId: string;
      sku: string;
      name: string;
      quantityPerKit: number;
      availableStock: number;
      kitsPossible: number;
    }[];
  }[];
  recentMovements: {
    id: string;
    locationId: string;
    locationName: string;
    locationType: LocationType;
    type: InventoryMovementType;
    quantity: number;
    previousStock: number;
    newStock: number;
    referenceType?: string | null;
    referenceId?: string | null;
    reason?: string | null;
    notes?: string | null;
    createdBy: string;
    createdAt: string;
  }[];
}

// =========================================================================
// MÓDULO VENTAS / POS (ETAPA 2)
// =========================================================================

export type SaleStatus = 'DRAFT' | 'COMPLETED' | 'ANULLED';

export type SalePaymentMethod =
  | 'CASH'
  | 'YAPE'
  | 'PLIN'
  | 'CARD'
  | 'TRANSFER'
  | 'CREDIT';

export interface SaleItem {
  id: string;
  productId: string;
  productCode: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
  productType: ProductSaleType;
}

export interface SalePayment {
  id: string;
  method: SalePaymentMethod;
  amount: number;
  reference?: string | null;
  createdAt: string;
}

export interface Sale {
  id: string;
  saleNumber: string;
  businessId?: string;
  storeId: string;
  storeName?: string;
  storeCode?: string | null;
  clientId?: string | null;
  clientName?: string;
  clientNumber?: string | null;
  clientPhone?: string | null;
  status: SaleStatus;
  subtotal: number;
  cardSurcharge?: number;
  total: number;
  paymentStatus: string;
  cashReceived?: number | null;
  cashChange?: number | null;
  notes?: string | null;
  createdBy: string;
  createdAt: string;
  completedAt?: string | null;
  annulledAt?: string | null;
  annulledBy?: string | null;
  annulReason?: string | null;
  cashSessionId?: string | null;
  cashRegisterName?: string | null;
  receipt?: Receipt | null;
  items: SaleItem[];
  payments: SalePayment[];
  client?: Partial<Client> | null;
  warnings?: string[];
}

export interface SaleSummaryItem {
  id: string;
  saleNumber: string;
  storeId: string;
  storeName: string;
  clientId?: string | null;
  clientName: string;
  clientNumber?: string | null;
  status: SaleStatus;
  subtotal: number;
  cardSurcharge?: number;
  total: number;
  paymentStatus: string;
  cashReceived?: number | null;
  cashChange?: number | null;
  createdBy: string;
  createdAt: string;
  completedAt?: string | null;
  annulledAt?: string | null;
  annulledBy?: string | null;
  annulReason?: string | null;
  payments: { method: SalePaymentMethod; amount: number }[];
  itemsCount: number;
  cashSessionId?: string | null;
  receiptNumber?: string | null;
}

export interface CreateSalePayload {
  storeId: string;
  clientId?: string | null;
  cashSessionId?: string;
  items: { productId: string; quantity: number }[];
  payments: { method: SalePaymentMethod; amount: number; reference?: string }[];
  cashReceived?: number;
  notes?: string;
}

export type UpdateSalePayload = CreateSalePayload;

// =========================================================================
// MÓDULO CAJA, TURNOS, MOVIMIENTOS Y BOLETAS (ETAPA 3)
// =========================================================================

export type CashRegisterStatus = 'ACTIVE' | 'INACTIVE';
export type CashSessionStatus = 'OPEN' | 'CLOSED';
export type CashMovementType =
  | 'OPENING'
  | 'SALE'
  | 'SALE_REVERSAL'
  | 'CASH_IN'
  | 'CASH_OUT'
  | 'DEBT_PAYMENT'
  | 'LOAN_PAYMENT'
  | 'CLOSING_ADJUSTMENT';

export interface CashRegister {
  id: string;
  businessId?: string;
  storeId: string;
  code: string;
  name: string;
  status: CashRegisterStatus;
  createdAt: string;
  updatedAt: string;
  store?: { id: string; name: string; code?: string | null };
  activeSession?: CashSession | null;
}

export interface CashSessionSummary {
  openingCash: number;
  cashSales: number;
  yapeSales: number;
  plinSales: number;
  cardSales: number;
  transferSales: number;
  creditSales: number;
  cashIn: number;
  cashOut: number;
  cashDebtPayments: number;
  cashLoanPayments: number;
  cashSaleReversals: number;
  expectedCashAmount: number;
  totalSalesAmount: number;
  salesCount: number;
  methodsSummary: {
    CASH: number;
    YAPE: number;
    PLIN: number;
    CARD: number;
    TRANSFER: number;
    CREDIT: number;
  };
}

export interface CashSession {
  id: string;
  businessId?: string;
  cashRegisterId: string;
  storeId: string;
  openedByUserId: string;
  openedAt: string;
  openingCashAmount: number;
  status: CashSessionStatus;
  closedAt?: string | null;
  closedByUserId?: string | null;
  expectedCashAmount?: number | null;
  countedCashAmount?: number | null;
  differenceAmount?: number | null;
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
  cashRegister?: CashRegister;
  store?: { id: string; name: string; code?: string | null };
  openedByUser?: { id: string; name: string; email?: string };
  closedByUser?: { id: string; name: string; email?: string } | null;
  summary?: CashSessionSummary;
  differenceType?: 'CUADRA' | 'SOBRANTE' | 'FALTANTE';
  movements?: CashMovement[];
}

export interface CashMovement {
  id: string;
  businessId?: string;
  cashSessionId: string;
  storeId: string;
  cashRegisterId: string;
  saleId?: string | null;
  type: CashMovementType;
  paymentMethod: SalePaymentMethod;
  amount: number;
  referenceType?: string | null;
  referenceId?: string | null;
  description?: string | null;
  notes?: string | null;
  createdByUserId: string;
  createdByUser?: { id: string; name: string };
  createdAt: string;
  cashRegister?: { id: string; name: string; code: string };
  store?: { id: string; name: string };
}

export interface ReceiptConfig {
  businessName: string;
  secondaryText?: string;
  address?: string;
  phone?: string;
  footerMessage?: string;
  paperWidth?: '58mm' | '80mm' | 'a4';
  showLogo?: boolean;
  showProductCode?: boolean;
  showCustomer?: boolean;
  showCashier?: boolean;
  showStore?: boolean;
  showPaymentMethods?: boolean;
  series?: string;
}

export interface Receipt {
  id: string;
  businessId?: string;
  saleId: string;
  number: string;
  series: string;
  sequence: number;
  configSnapshot: ReceiptConfig;
  notes?: string | null;
  reprintedCount: number;
  lastReprintedAt?: string | null;
  createdAt: string;
  sale?: Sale;
}



