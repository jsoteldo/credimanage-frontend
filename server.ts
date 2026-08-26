import express, { Request, Response, NextFunction } from 'express';
import path from 'path';
import jwt from 'jsonwebtoken';
import { createServer as createViteServer } from 'vite';
import {
  INITIAL_USERS,
  INITIAL_CLIENTS,
  INITIAL_CREDIT_PURCHASES,
  INITIAL_PAYMENTS,
  INITIAL_AUDIT_LOGS,
  INITIAL_LOAN_CREDITS,
} from './src/data/initialData.js';
import { Client, CreditPurchase, Payment, User, AuditLog, UserRole, LoanCredit } from './src/types.js';

const PORT = 3001;
const JWT_SECRET = process.env.JWT_SECRET || 'credimanage_pos_jwt_secret_key_2026';

// In-Memory Database Store
let usersStore: User[] = [...INITIAL_USERS];
let clientsStore: Client[] = [...INITIAL_CLIENTS];
let purchasesStore: CreditPurchase[] = [...INITIAL_CREDIT_PURCHASES];
let paymentsStore: Payment[] = [...INITIAL_PAYMENTS];
let auditLogsStore: AuditLog[] = [...INITIAL_AUDIT_LOGS];
let loansStore: LoanCredit[] = [...INITIAL_LOAN_CREDITS];

// Helper to log audit actions
function logAudit(
  user: { id: string; name: string; role: UserRole },
  action: string,
  details: string,
  targetId?: string
) {
  const newLog: AuditLog = {
    id: `aud-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    timestamp: new Date().toISOString(),
    userId: user.id,
    userName: user.name,
    userRole: user.role,
    action,
    details,
    targetId,
  };
  auditLogsStore.unshift(newLog);
  return newLog;
}

// Authentication Middleware
interface AuthenticatedRequest extends Request {
  user?: User;
}

function authenticateJWT(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No se proporcionó token de autenticación' });
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { id: string; email: string; role: UserRole };
    const foundUser = usersStore.find((u) => u.id === decoded.id && u.active);
    if (!foundUser) {
      return res.status(401).json({ error: 'Usuario no encontrado o inactivado' });
    }
    req.user = foundUser;
    next();
  } catch (err) {
    return res.status(403).json({ error: 'Token inválido o expirado' });
  }
}

function requireAdminRole(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  if (!req.user || req.user.role !== 'Administrador') {
    return res.status(403).json({ error: 'Acceso denegado: Se requieren permisos de Administrador' });
  }
  next();
}

async function startServer() {
  const app = express();
  app.use(express.json());

  // --- API ROUTES ---

  // 1. Auth Login
  app.post('/api/auth/login', (req: Request, res: Response) => {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Correo y contraseña requeridos' });
    }

    // Demo password checks: admin123 or cajero123 or any 6+ char password for existing users
    const user = usersStore.find((u) => u.email.toLowerCase() === email.trim().toLowerCase());
    if (!user) {
      return res.status(401).json({ error: 'Credenciales inválidas' });
    }

    if (email === 'admin@credimanage.pos' && password !== 'admin123') {
      return res.status(401).json({ error: 'Contraseña incorrecta para Administrador' });
    }
    if (email === 'cajero@credimanage.pos' && password !== 'cajero123') {
      return res.status(401).json({ error: 'Contraseña incorrecta para Cajero' });
    }

    const token = jwt.sign(
      { id: user.id, email: user.email, name: user.name, role: user.role },
      JWT_SECRET,
      { expiresIn: '12h' }
    );

    logAudit(user, 'INICIO_SESION', `Inicio de sesión exitoso como ${user.role}`);

    return res.json({
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        avatar: user.avatar,
      },
    });
  });

  // Auth Me
  app.get('/api/auth/me', authenticateJWT, (req: AuthenticatedRequest, res: Response) => {
    res.json({ user: req.user });
  });

  // 2. Dashboard KPIs
  app.get('/api/dashboard/kpis', authenticateJWT, (req: Request, res: Response) => {
    const totalClients = clientsStore.length;
    const clientsWithDebt = clientsStore.filter((c) => c.currentBalance > 0).length;
    const totalPendingDebt = clientsStore.reduce(
      (sum, c) => (c.currentBalance > 0 ? sum + c.currentBalance : sum),
      0
    );
    const clientsWithBalanceInFavor = clientsStore.filter((c) => c.currentBalance < 0).length;

    // Today payments
    const todayStr = new Date().toISOString().split('T')[0];
    const todayPayments = paymentsStore.filter(
      (p) => p.status === 'Activo' && p.date.startsWith(todayStr)
    );
    const todayPaymentsTotal = todayPayments.reduce((sum, p) => sum + p.amount, 0);

    res.json({
      totalClients,
      clientsWithDebt,
      totalPendingDebt,
      clientsWithBalanceInFavor,
      todayPaymentsTotal,
      todayPaymentsCount: todayPayments.length,
    });
  });

  // 3. Client Management APIs
  // List clients with search and filter
  app.get('/api/clients', authenticateJWT, (req: Request, res: Response) => {
    const query = (req.query.q as string || '').toLowerCase().trim();
    const statusFilter = req.query.status as string;

    let result = [...clientsStore];

    if (statusFilter && statusFilter !== 'todos') {
      if (statusFilter === 'con_deuda') {
        result = result.filter((c) => c.status === 'Activo' && c.currentBalance > 0);
      } else if (statusFilter === 'al_dia') {
        result = result.filter((c) => c.status === 'Activo' && c.currentBalance <= 0);
      } else if (statusFilter === 'desactivados' || statusFilter === 'Desactivado') {
        result = result.filter((c) => c.status === 'Desactivado');
      } else if (statusFilter === 'activos' || statusFilter === 'Activo') {
        result = result.filter((c) => c.status === 'Activo');
      } else {
        result = result.filter((c) => c.status === statusFilter);
      }
    }

    if (query) {
      result = result.filter(
        (c) =>
          c.name.toLowerCase().includes(query) ||
          c.phone.toLowerCase().includes(query) ||
          c.clientNumber.toLowerCase().includes(query)
      );
    }

    res.json(result);
  });

  // Create Client
  app.post('/api/clients', authenticateJWT, (req: AuthenticatedRequest, res: Response) => {
    const { name, phone, address, creditLimit, clientNumber, paymentPeriod, paymentDay, nextDueDate } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'El nombre completo es obligatorio' });
    }

    const nextNumber = clientNumber
      ? clientNumber.trim()
      : `CLI-${1040 + clientsStore.length + Math.floor(Math.random() * 90)}`;

    const newClient: Client = {
      id: `cli-${Date.now()}`,
      clientNumber: nextNumber,
      name: name.trim(),
      phone: phone ? phone.trim() : '',
      address: address ? address.trim() : '',
      creditLimit: parseFloat(creditLimit) || 0,
      currentBalance: 0,
      paymentPeriod: paymentPeriod || 'Mensual',
      paymentDay: paymentDay ? paymentDay.trim() : '',
      nextDueDate: nextDueDate ? nextDueDate.trim() : '',
      status: 'Activo',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    clientsStore.unshift(newClient);

    logAudit(
      req.user!,
      'CREAR_CLIENTE',
      `Nuevo cliente registrado: ${newClient.name} (${newClient.clientNumber}) - Periodo: ${newClient.paymentPeriod} - Límite S/ ${newClient.creditLimit.toFixed(2)}`,
      newClient.id
    );

    res.status(201).json(newClient);
  });

  // Update Client
  app.put('/api/clients/:id', authenticateJWT, (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;
    const { name, phone, address, creditLimit, paymentPeriod, paymentDay, nextDueDate } = req.body;

    const clientIndex = clientsStore.findIndex((c) => c.id === id);
    if (clientIndex === -1) {
      return res.status(404).json({ error: 'Cliente no encontrado' });
    }

    const existing = clientsStore[clientIndex];
    const oldLimit = existing.creditLimit;

    clientsStore[clientIndex] = {
      ...existing,
      name: name ? name.trim() : existing.name,
      phone: phone !== undefined ? phone.trim() : existing.phone,
      address: address !== undefined ? address.trim() : existing.address,
      creditLimit: creditLimit !== undefined ? parseFloat(creditLimit) : existing.creditLimit,
      paymentPeriod: paymentPeriod !== undefined ? paymentPeriod : existing.paymentPeriod,
      paymentDay: paymentDay !== undefined ? paymentDay.trim() : existing.paymentDay,
      nextDueDate: nextDueDate !== undefined ? nextDueDate.trim() : existing.nextDueDate,
      updatedAt: new Date().toISOString(),
    };

    const updated = clientsStore[clientIndex];

    logAudit(
      req.user!,
      'MODIFICACION_CLIENTE',
      `Datos de cliente modificados: ${updated.name} (${updated.clientNumber}). Periodo: ${updated.paymentPeriod}, Cobro: ${updated.nextDueDate || 'Sin fecha'}.`,
      updated.id
    );

    res.json(updated);
  });

  // Deactivate Client (Rule: balance must be 0)
  app.post('/api/clients/:id/deactivate', authenticateJWT, (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;
    const client = clientsStore.find((c) => c.id === id);

    if (!client) {
      return res.status(404).json({ error: 'Cliente no encontrado' });
    }

    // Balance check
    if (Math.abs(client.currentBalance) > 0.01) {
      if (client.currentBalance > 0) {
        return res.status(400).json({
          error: `No se puede desactivar el cliente porque tiene un saldo pendiente de S/ ${client.currentBalance.toFixed(2)}. Debe saldar la cuenta a S/ 0.00.`,
        });
      } else {
        return res.status(400).json({
          error: `No se puede desactivar el cliente porque tiene un saldo a favor de S/ ${Math.abs(client.currentBalance).toFixed(2)}. Debe saldar la cuenta a S/ 0.00.`,
        });
      }
    }

    client.status = 'Desactivado';
    client.updatedAt = new Date().toISOString();

    logAudit(
      req.user!,
      'DESACTIVAR_CLIENTE',
      `Cliente desactivado: ${client.name} (${client.clientNumber}). Traceabilidad histórica conservada.`,
      client.id
    );

    res.json({ message: 'Cliente desactivado con éxito', client });
  });

  // Reactivate Client
  app.post('/api/clients/:id/reactivate', authenticateJWT, (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;
    const client = clientsStore.find((c) => c.id === id);

    if (!client) {
      return res.status(404).json({ error: 'Cliente no encontrado' });
    }

    client.status = 'Activo';
    client.updatedAt = new Date().toISOString();

    logAudit(
      req.user!,
      'REACTIVAR_CLIENTE',
      `Cliente reactivado: ${client.name} (${client.clientNumber}).`,
      client.id
    );

    res.json({ message: 'Cliente reactivado con éxito', client });
  });

  // Delete Client (Strict Rule Validation both frontend & backend)
  app.delete('/api/clients/:id', authenticateJWT, (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;
    const client = clientsStore.find((c) => c.id === id);

    if (!client) {
      return res.status(404).json({ error: 'Cliente no encontrado' });
    }

    // 1. Check Saldo === 0
    if (Math.abs(client.currentBalance) > 0.01) {
      if (client.currentBalance > 0) {
        return res.status(400).json({
          error: `Regla de Negocio: No es posible eliminar un cliente con saldo pendiente (S/ ${client.currentBalance.toFixed(2)}). El saldo debe ser exactamente S/ 0.00.`,
        });
      } else {
        return res.status(400).json({
          error: `Regla de Negocio: No es posible eliminar un cliente con saldo a favor (S/ ${Math.abs(client.currentBalance).toFixed(2)}). El saldo debe ser exactamente S/ 0.00.`,
        });
      }
    }

    // 2. Check historical movements (purchases or payments)
    const clientPurchases = purchasesStore.filter((p) => p.clientId === id);
    const clientPayments = paymentsStore.filter((p) => p.clientId === id);

    if (clientPurchases.length > 0 || clientPayments.length > 0) {
      return res.status(400).json({
        error: `Regla de Auditoría: El cliente posee ${clientPurchases.length} compras a crédito y ${clientPayments.length} abonos en su historial. Por trazabilidad legal y financiera no se permite borrado físico. Se recomienda la opción "Desactivar Cliente".`,
        suggestDeactivation: true,
      });
    }

    // Physical deletion allowed if 0 balance and 0 historical movements
    clientsStore = clientsStore.filter((c) => c.id !== id);

    logAudit(
      req.user!,
      'ELIMINAR_CLIENTE_FISICO',
      `Eliminación física realizada para el cliente sin historial: ${client.name} (${client.clientNumber})`,
      id
    );

    res.json({ message: 'Cliente eliminado físicamente con éxito' });
  });

  // Statement of Account
  app.get('/api/clients/:id/statement', authenticateJWT, (req: Request, res: Response) => {
    const { id } = req.params;
    const client = clientsStore.find((c) => c.id === id);

    if (!client) {
      return res.status(404).json({ error: 'Cliente no encontrado' });
    }

    const purchases = purchasesStore.filter((p) => p.clientId === id);
    const payments = paymentsStore.filter((p) => p.clientId === id);
    const loans = loansStore.filter((l) => l.clientId === id);

    const availableCredit = client.creditLimit > 0 ? client.creditLimit - client.currentBalance : 0;

    res.json({
      client,
      availableCredit: client.creditLimit > 0 ? Math.max(0, availableCredit) : 'Sin límite',
      purchases,
      payments,
      loans,
    });
  });

  // Register Credit with Interest (Crédito con intereses)
  app.post('/api/clients/:id/loans', authenticateJWT, (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;
    const {
      capital,
      interestRate,
      interestAmount,
      totalAmount,
      installmentsCount,
      installmentAmount,
      frequency,
      firstDueDate,
      product,
      ticketNumber,
      notes,
      date,
    } = req.body;

    const client = clientsStore.find((c) => c.id === id);
    if (!client) {
      return res.status(404).json({ error: 'Cliente no encontrado' });
    }

    const cap = parseFloat(capital) || 0;
    const rate = parseFloat(interestRate) || 0;
    const count = parseInt(installmentsCount, 10) || 1;
    const freq = frequency || 'Mensual';
    const firstDate = firstDueDate || new Date().toISOString().split('T')[0];

    if (cap <= 0) {
      return res.status(400).json({ error: 'El capital del crédito debe ser mayor a S/ 0.00' });
    }

    // Precise calculations
    const calculatedInterest = Math.round(((cap * rate) / 100 + Number.EPSILON) * 100) / 100;
    const calculatedTotal = Math.round((cap + calculatedInterest + Number.EPSILON) * 100) / 100;
    const calculatedInstallment = Math.round((calculatedTotal / count + Number.EPSILON) * 100) / 100;

    // Credit limit validation (Saldo actual + Total crédito <= Límite)
    if (client.creditLimit > 0) {
      const projectedBalance = client.currentBalance + calculatedTotal;
      if (projectedBalance > client.creditLimit) {
        return res.status(400).json({
          error: `El crédito solicitado supera el límite de crédito del cliente. Límite: S/ ${client.creditLimit.toFixed(2)}, Saldo actual: S/ ${client.currentBalance.toFixed(2)}, Total del nuevo crédito: S/ ${calculatedTotal.toFixed(2)}, Exceso: S/ ${(projectedBalance - client.creditLimit).toFixed(2)}`,
        });
      }
    }

    // Build installment schedule
    const installments: any[] = [];
    const baseCap = Math.round((cap / count + Number.EPSILON) * 100) / 100;
    const baseInt = Math.round((calculatedInterest / count + Number.EPSILON) * 100) / 100;
    const todayStr = new Date().toISOString().split('T')[0];

    let accCap = 0;
    let accInt = 0;
    let accTot = 0;

    for (let i = 1; i <= count; i++) {
      const isLast = i === count;
      const c = isLast ? Math.round((cap - accCap) * 100) / 100 : baseCap;
      const int = isLast ? Math.round((calculatedInterest - accInt) * 100) / 100 : baseInt;
      const tot = isLast ? Math.round((calculatedTotal - accTot) * 100) / 100 : Math.round((c + int) * 100) / 100;

      accCap += c;
      accInt += int;
      accTot += tot;

      // Calculate due date
      const [yS, mS, dS] = firstDate.split('-');
      const dObj = new Date(parseInt(yS, 10), parseInt(mS, 10) - 1, parseInt(dS, 10));
      if (freq === 'Semanal') {
        dObj.setDate(dObj.getDate() + 7 * (i - 1));
      } else if (freq === 'Quincenal') {
        dObj.setDate(dObj.getDate() + 15 * (i - 1));
      } else if (freq === 'Mensual') {
        const targetM = parseInt(mS, 10) - 1 + (i - 1);
        dObj.setMonth(targetM);
      }
      const dueDate = `${dObj.getFullYear()}-${String(dObj.getMonth() + 1).padStart(2, '0')}-${String(dObj.getDate()).padStart(2, '0')}`;

      installments.push({
        installmentNumber: i,
        dueDate,
        capital: c,
        interest: int,
        amount: tot,
        paidAmount: 0,
        status: dueDate < todayStr ? 'Vencida' : 'Pendiente',
      });
    }

    const loanCode = ticketNumber ? ticketNumber.trim() : `CR-${Math.floor(100000 + Math.random() * 900000)}`;
    const loanDate = date ? new Date(date).toISOString() : new Date().toISOString();

    const newLoan: LoanCredit = {
      id: `loan-${Date.now()}`,
      code: loanCode,
      clientId: id,
      clientName: client.name,
      clientNumber: client.clientNumber,
      date: loanDate,
      product: product ? product.trim() : `Crédito con intereses ${rate}% (${count} cuotas)`,
      capital: cap,
      interestRate: rate,
      interestAmount: calculatedInterest,
      totalAmount: calculatedTotal,
      installmentsCount: count,
      installmentAmount: calculatedInstallment,
      frequency: freq,
      firstDueDate: firstDate,
      paidAmount: 0,
      pendingAmount: calculatedTotal,
      paidInstallmentsCount: 0,
      status: 'Activo',
      installments,
      ticketNumber: loanCode,
      registeredBy: req.user!.name,
      notes: notes ? notes.trim() : '',
    };

    loansStore.unshift(newLoan);

    // Also register a purchase movement for accounting traceability
    const purchaseMovement: CreditPurchase = {
      id: `pur-${Date.now()}`,
      clientId: id,
      date: loanDate,
      product: `Crédito con Intereses (${loanCode}) - Cap: S/ ${cap.toFixed(2)} + Int: S/ ${calculatedInterest.toFixed(2)} (${count} cuotas ${freq})`,
      unitPrice: calculatedTotal,
      quantity: 1,
      amount: calculatedTotal,
      ticketNumber: loanCode,
      registeredBy: req.user!.name,
      status: 'Activo',
      debtType: 'credit',
      loanId: newLoan.id,
    };
    purchasesStore.unshift(purchaseMovement);

    // Increase client balance by the total amount to pay
    client.currentBalance += calculatedTotal;
    client.updatedAt = new Date().toISOString();

    logAudit(
      req.user!,
      'REGISTRO_CREDITO_INTERES',
      `Crédito con intereses otorgado (${loanCode}) por S/ ${calculatedTotal.toFixed(2)} (Capital S/ ${cap.toFixed(2)} + Intereses S/ ${calculatedInterest.toFixed(2)}) en ${count} cuotas ${freq} para ${client.name} (${client.clientNumber}). Saldo resultante: S/ ${client.currentBalance.toFixed(2)}`,
      newLoan.id
    );

    res.status(201).json({
      loan: newLoan,
      purchase: purchaseMovement,
      client,
      message: 'Crédito con intereses registrado con éxito',
    });
  });

  // Get Loans for Client
  app.get('/api/clients/:id/loans', authenticateJWT, (req: Request, res: Response) => {
    const { id } = req.params;
    const clientLoans = loansStore.filter((l) => l.clientId === id);
    res.json(clientLoans);
  });

  // Get Single Loan
  app.get('/api/loans/:id', authenticateJWT, (req: Request, res: Response) => {
    const { id } = req.params;
    const loan = loansStore.find((l) => l.id === id || l.code === id);
    if (!loan) {
      return res.status(404).json({ error: 'Crédito no encontrado' });
    }
    res.json(loan);
  });

  // Annul Loan (Admin only)
  app.post('/api/loans/:id/annul', authenticateJWT, requireAdminRole, (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;
    const { reason } = req.body;

    if (!reason || !reason.trim()) {
      return res.status(400).json({ error: 'Debe especificar el motivo de la anulación del crédito' });
    }

    const loan = loansStore.find((l) => l.id === id || l.code === id);
    if (!loan) {
      return res.status(404).json({ error: 'Crédito no encontrado' });
    }

    if (loan.status === 'Anulado') {
      return res.status(400).json({ error: 'Este crédito ya se encuentra anulado' });
    }

    const client = clientsStore.find((c) => c.id === loan.clientId);
    if (!client) {
      return res.status(404).json({ error: 'Cliente asociado no encontrado' });
    }

    if (loan.paidAmount > 0) {
      return res.status(400).json({
        error: `No se puede anular el crédito ${loan.code} porque ya posee pagos registrados (S/ ${loan.paidAmount.toFixed(2)}).`,
      });
    }

    // Mark loan as annulled
    loan.status = 'Anulado';
    loan.annulledAt = new Date().toISOString();
    loan.annulledBy = req.user!.name;
    loan.annulmentReason = reason.trim();

    // Mark installments as Anulada
    loan.installments.forEach((inst) => {
      if (inst.status !== 'Pagada') {
        inst.status = 'Anulada';
      }
    });

    // Revert pending amount from client's balance
    const amountToRevert = loan.pendingAmount;
    client.currentBalance -= amountToRevert;
    client.updatedAt = new Date().toISOString();

    // Also mark related purchase movement as annulled if exists
    const relPurchase = purchasesStore.find((p) => p.loanId === loan.id || p.ticketNumber === loan.code);
    if (relPurchase) {
      relPurchase.status = 'Anulado';
      relPurchase.annulledAt = new Date().toISOString();
      relPurchase.annulledBy = req.user!.name;
      relPurchase.annulmentReason = reason.trim();
    }

    logAudit(
      req.user!,
      'ANULACION_CREDITO',
      `Crédito ${loan.code} anulado para ${client.name}. Motivo: ${reason.trim()}. Saldo restaurado a: S/ ${client.currentBalance.toFixed(2)}`,
      loan.id
    );

    res.json({ message: 'Crédito anulado con éxito', loan, client });
  });

  // Register Credit Purchase (Nueva compra a crédito)
  app.post('/api/clients/:id/credit-purchase', authenticateJWT, (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;
    const { product, unitPrice, quantity, ticketNumber, date } = req.body;

    const client = clientsStore.find((c) => c.id === id);
    if (!client) {
      return res.status(404).json({ error: 'Cliente no encontrado' });
    }

    const price = parseFloat(unitPrice) || 0;
    const qty = parseInt(quantity, 10) || 1;
    const totalAmount = price * qty;

    if (totalAmount <= 0) {
      return res.status(400).json({ error: 'El importe total de la compra debe ser mayor a S/ 0.00' });
    }

    // Credit limit check
    if (client.creditLimit > 0) {
      const projectedBalance = client.currentBalance + totalAmount;
      if (projectedBalance > client.creditLimit) {
        return res.status(400).json({
          error: `Límite de crédito excedido. Límite actual: S/ ${client.creditLimit.toFixed(2)}, Saldo actual: S/ ${client.currentBalance.toFixed(2)}, Exceso: S/ ${(projectedBalance - client.creditLimit).toFixed(2)}`,
        });
      }
    }

    let purchaseDate = new Date().toISOString();
    if (date) {
      const now = new Date();
      const timePart = now.toISOString().split('T')[1] || '12:00:00.000Z';
      const customIso = `${date}T${timePart}`;
      const parsed = new Date(customIso);
      if (!isNaN(parsed.getTime())) {
        purchaseDate = parsed.toISOString();
      } else if (!isNaN(new Date(date).getTime())) {
        purchaseDate = new Date(date).toISOString();
      }
    }

    const newPurchase: CreditPurchase = {
      id: `pur-${Date.now()}`,
      clientId: id,
      date: purchaseDate,
      product: product.trim(),
      unitPrice: price,
      quantity: qty,
      amount: totalAmount,
      ticketNumber: ticketNumber ? ticketNumber.trim() : `TKT-${Math.floor(1000 + Math.random() * 9000)}`,
      registeredBy: req.user!.name,
      status: 'Activo',
    };

    purchasesStore.unshift(newPurchase);

    // Update client balance
    client.currentBalance += totalAmount;
    client.updatedAt = new Date().toISOString();

    logAudit(
      req.user!,
      'COMPRA_CREDITO',
      `Compra a crédito registrada por S/ ${totalAmount.toFixed(2)} (${product}) para ${client.name}. Nuevo saldo: S/ ${client.currentBalance.toFixed(2)}`,
      newPurchase.id
    );

    res.status(201).json({ purchase: newPurchase, client });
  });

  // Register Abono (Partial or Full Payment)
  app.post('/api/clients/:id/payment', authenticateJWT, (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;
    const { amount, paymentMethod, notes, isFullPayoff } = req.body;

    const client = clientsStore.find((c) => c.id === id);
    if (!client) {
      return res.status(404).json({ error: 'Cliente no encontrado' });
    }

    let payAmount = parseFloat(amount);
    if (isFullPayoff) {
      payAmount = client.currentBalance;
    }

    if (isNaN(payAmount) || payAmount <= 0) {
      return res.status(400).json({ error: 'El importe del abono debe ser mayor a S/ 0.00' });
    }

    // No permitir sobrepago accidental
    if (payAmount > client.currentBalance) {
      return res.status(400).json({
        error: `No se permite sobrepago. El abono solicitado (S/ ${payAmount.toFixed(2)}) supera el saldo deudor del cliente (S/ ${client.currentBalance.toFixed(2)})`,
      });
    }

    const method = paymentMethod || 'Efectivo';
    const cardSurcharge = method === 'Tarjeta' ? Math.round(payAmount * 0.05 * 100) / 100 : 0;
    const totalCharged = payAmount + cardSurcharge;

    const previousBalance = client.currentBalance;
    const resultingBalance = previousBalance - payAmount;

    // 1. Distribute payment across active loans and installments
    const activeLoans = loansStore.filter(
      (l) => l.clientId === id && (l.status === 'Activo' || l.status === 'Vencido')
    );

    let remainingPayment = payAmount;
    let lastAffectedLoanId: string | undefined = undefined;

    // Collect all pending installments and sort them chronologically
    const allInstallments: any[] = [];
    activeLoans.forEach((loan) => {
      loan.installments.forEach((inst) => {
        if (inst.status === 'Pendiente' || inst.status === 'Parcial' || inst.status === 'Vencida') {
          allInstallments.push({ inst, loan });
        }
      });
    });

    allInstallments.sort((a, b) => {
      if (a.inst.dueDate !== b.inst.dueDate) {
        return a.inst.dueDate.localeCompare(b.inst.dueDate);
      }
      return a.inst.installmentNumber - b.inst.installmentNumber;
    });

    const todayStr = new Date().toISOString().split('T')[0];

    for (const item of allInstallments) {
      if (remainingPayment <= 0) break;

      const unpaidAmount = Math.round((item.inst.amount - (item.inst.paidAmount || 0)) * 100) / 100;
      const toPay = Math.min(unpaidAmount, remainingPayment);

      item.inst.paidAmount = Math.round(((item.inst.paidAmount || 0) + toPay) * 100) / 100;
      remainingPayment = Math.round((remainingPayment - toPay) * 100) / 100;

      if (item.inst.paidAmount >= item.inst.amount - 0.001) {
        item.inst.status = 'Pagada';
        item.inst.paidDate = new Date().toISOString();
      } else {
        item.inst.status = item.inst.dueDate < todayStr ? 'Vencida' : 'Parcial';
      }

      lastAffectedLoanId = item.loan.id;
    }

    // 2. Recalculate statistics for each affected loan
    activeLoans.forEach((loan) => {
      const totalPaid = loan.installments.reduce((sum, inst) => sum + (inst.paidAmount || 0), 0);
      loan.paidAmount = totalPaid;
      loan.pendingAmount = Math.round((loan.totalAmount - totalPaid) * 100) / 100;
      loan.paidInstallmentsCount = loan.installments.filter((inst) => inst.status === 'Pagada').length;

      if (loan.pendingAmount <= 0.01) {
        loan.status = 'Pagado';
      } else {
        const hasOverdue = loan.installments.some((inst) => inst.dueDate < todayStr && inst.status !== 'Pagada');
        loan.status = hasOverdue ? 'Vencido' : 'Activo';
      }
    });

    let defaultNote = isFullPayoff ? 'Liquidación automática de adeudo' : 'Abono parcial registrado';
    if (method === 'Tarjeta') {
      defaultNote += ` (Incluye recargo del 5% por tarjeta: S/ ${cardSurcharge.toFixed(2)})`;
    }

    const newPayment: Payment = {
      id: `pay-${Date.now()}`,
      clientId: id,
      date: new Date().toISOString(),
      amount: payAmount,
      previousBalance,
      resultingBalance,
      paymentMethod: method,
      cardSurcharge: cardSurcharge > 0 ? cardSurcharge : undefined,
      totalCharged: cardSurcharge > 0 ? totalCharged : payAmount,
      registeredBy: req.user!.name,
      status: 'Activo',
      notes: notes ? notes.trim() : defaultNote,
      loanId: lastAffectedLoanId,
    };

    paymentsStore.unshift(newPayment);

    // Update Client Balance
    client.currentBalance = resultingBalance;
    client.updatedAt = new Date().toISOString();

    const actionType = isFullPayoff ? 'LIQUIDAR_ADEUDO' : 'REGISTRO_ABONO';
    const surchargeNote = cardSurcharge > 0 ? ` (+Recargo 5% tarjeta: S/ ${cardSurcharge.toFixed(2)} = Total Cobrado S/ ${totalCharged.toFixed(2)})` : '';
    logAudit(
      req.user!,
      actionType,
      `${isFullPayoff ? 'Liquidación total' : 'Abono'} de S/ ${payAmount.toFixed(2)}${surchargeNote} registrado para ${client.name} (${client.clientNumber}). Saldo anterior: S/ ${previousBalance.toFixed(2)}, Nuevo saldo: S/ ${resultingBalance.toFixed(2)}`,
      newPayment.id
    );

    res.status(201).json({
      payment: newPayment,
      client,
      message: `Abono registrado con éxito. Nuevo saldo: S/ ${resultingBalance.toFixed(2)}`,
    });
  });

  // Annul Payment (Admin action)
  app.post('/api/payments/:id/annul', authenticateJWT, requireAdminRole, (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;
    const { reason } = req.body;

    if (!reason || !reason.trim()) {
      return res.status(400).json({ error: 'Debe especificar el motivo de la anulación' });
    }

    const payment = paymentsStore.find((p) => p.id === id);
    if (!payment) {
      return res.status(404).json({ error: 'Abono no encontrado' });
    }

    if (payment.status === 'Anulado') {
      return res.status(400).json({ error: 'Este abono ya se encuentra anulado' });
    }

    const client = clientsStore.find((c) => c.id === payment.clientId);
    if (!client) {
      return res.status(404).json({ error: 'Cliente asociado no encontrado' });
    }

    // Revert the payment distribution from installments (LIFO)
    const activeLoans = loansStore.filter(
      (l) => l.clientId === payment.clientId && (l.status === 'Activo' || l.status === 'Vencido' || l.status === 'Pagado')
    );

    let remainingRevert = payment.amount;

    // Collect all installments that have been paid and sort them descending (newest paid first)
    const allPaidInstallments: any[] = [];
    activeLoans.forEach((loan) => {
      loan.installments.forEach((inst) => {
        if ((inst.paidAmount || 0) > 0) {
          allPaidInstallments.push({ inst, loan });
        }
      });
    });

    allPaidInstallments.sort((a, b) => {
      if (a.inst.dueDate !== b.inst.dueDate) {
        return b.inst.dueDate.localeCompare(a.inst.dueDate);
      }
      return b.inst.installmentNumber - a.inst.installmentNumber;
    });

    const todayStr = new Date().toISOString().split('T')[0];

    for (const item of allPaidInstallments) {
      if (remainingRevert <= 0) break;

      const toRevert = Math.min(item.inst.paidAmount || 0, remainingRevert);
      item.inst.paidAmount = Math.round(((item.inst.paidAmount || 0) - toRevert) * 100) / 100;
      remainingRevert = Math.round((remainingRevert - toRevert) * 100) / 100;

      if (item.inst.paidAmount > 0) {
        item.inst.status = 'Parcial';
      } else {
        item.inst.status = item.inst.dueDate < todayStr ? 'Vencida' : 'Pendiente';
        item.inst.paidDate = undefined;
      }
    }

    // Recalculate statistics for each affected loan
    activeLoans.forEach((loan) => {
      const totalPaid = loan.installments.reduce((sum, inst) => sum + (inst.paidAmount || 0), 0);
      loan.paidAmount = totalPaid;
      loan.pendingAmount = Math.round((loan.totalAmount - totalPaid) * 100) / 100;
      loan.paidInstallmentsCount = loan.installments.filter((inst) => inst.status === 'Pagada').length;

      if (loan.pendingAmount <= 0.01) {
        loan.status = 'Pagado';
      } else {
        const hasOverdue = loan.installments.some((inst) => inst.dueDate < todayStr && inst.status !== 'Pagada');
        loan.status = hasOverdue ? 'Vencido' : 'Activo';
      }
    });

    // Mark as Anulado & Revert Balance
    payment.status = 'Anulado';
    payment.annulledAt = new Date().toISOString();
    payment.annulledBy = req.user!.name;
    payment.annulmentReason = reason.trim();

    // Revert balance (add back the payment amount)
    client.currentBalance += payment.amount;
    client.updatedAt = new Date().toISOString();

    logAudit(
      req.user!,
      'ANULACION_ABONO',
      `Abono ${payment.id} de S/ ${payment.amount.toFixed(2)} anulado para ${client.name}. Motivo: ${reason.trim()}. Saldo restaurado a: S/ ${client.currentBalance.toFixed(2)}`,
      payment.id
    );

    res.json({ message: 'Abono anulado con éxito', payment, client });
  });

  // Get Payments History with populated client details and filtering
  app.get('/api/payments/history', authenticateJWT, (req: Request, res: Response) => {
    const query = (req.query.q as string || '').toLowerCase().trim();
    const dateFilter = (req.query.dateFilter as string || 'today').toLowerCase();
    const startDate = req.query.startDate as string;
    const endDate = req.query.endDate as string;

    let list = paymentsStore.map((p) => {
      const client = clientsStore.find((c) => c.id === p.clientId);
      return {
        ...p,
        clientName: client ? client.name : 'Cliente Desconocido',
        clientNumber: client ? client.clientNumber : 'N/A',
        clientPhone: client ? client.phone : '',
      };
    });

    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];

    if (dateFilter === 'today') {
      list = list.filter((p) => p.date.startsWith(todayStr));
    } else if (dateFilter === 'yesterday') {
      const yesterday = new Date(now);
      yesterday.setDate(now.getDate() - 1);
      const yesterdayStr = yesterday.toISOString().split('T')[0];
      list = list.filter((p) => p.date.startsWith(yesterdayStr));
    } else if (dateFilter === 'last7') {
      const sevenDaysAgo = new Date(now);
      sevenDaysAgo.setDate(now.getDate() - 7);
      list = list.filter((p) => new Date(p.date) >= sevenDaysAgo);
    } else if (dateFilter === 'thismonth') {
      const monthStr = todayStr.substring(0, 7);
      list = list.filter((p) => p.date.startsWith(monthStr));
    } else if (dateFilter === 'custom' && startDate) {
      const start = new Date(`${startDate}T00:00:00`);
      const end = endDate ? new Date(`${endDate}T23:59:59`) : new Date(`${startDate}T23:59:59`);
      list = list.filter((p) => {
        const pDate = new Date(p.date);
        return pDate >= start && pDate <= end;
      });
    }

    if (query) {
      list = list.filter(
        (p) =>
          p.clientName.toLowerCase().includes(query) ||
          p.clientNumber.toLowerCase().includes(query) ||
          p.paymentMethod.toLowerCase().includes(query) ||
          (p.notes && p.notes.toLowerCase().includes(query)) ||
          p.registeredBy.toLowerCase().includes(query)
      );
    }

    // Sort by date descending
    list.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    const activePayments = list.filter((p) => p.status === 'Activo');
    const totalAmount = activePayments.reduce((sum, p) => sum + p.amount, 0);

    res.json({
      payments: list,
      summary: {
        count: activePayments.length,
        totalAmount,
      },
    });
  });

  // Get Credit Purchases / Debts History with populated client details and filtering
  app.get('/api/purchases/history', authenticateJWT, (req: Request, res: Response) => {
    const query = (req.query.q as string || '').toLowerCase().trim();
    const dateFilter = (req.query.dateFilter as string || 'today').toLowerCase();
    const startDate = req.query.startDate as string;
    const endDate = req.query.endDate as string;

    let list = purchasesStore.map((p) => {
      const client = clientsStore.find((c) => c.id === p.clientId);
      return {
        ...p,
        clientName: client ? client.name : 'Cliente Desconocido',
        clientNumber: client ? client.clientNumber : 'N/A',
        clientPhone: client ? client.phone : '',
      };
    });

    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];

    if (dateFilter === 'today') {
      list = list.filter((p) => p.date.startsWith(todayStr));
    } else if (dateFilter === 'yesterday') {
      const yesterday = new Date(now);
      yesterday.setDate(now.getDate() - 1);
      const yesterdayStr = yesterday.toISOString().split('T')[0];
      list = list.filter((p) => p.date.startsWith(yesterdayStr));
    } else if (dateFilter === 'last7') {
      const sevenDaysAgo = new Date(now);
      sevenDaysAgo.setDate(now.getDate() - 7);
      list = list.filter((p) => new Date(p.date) >= sevenDaysAgo);
    } else if (dateFilter === 'thismonth') {
      const monthStr = todayStr.substring(0, 7);
      list = list.filter((p) => p.date.startsWith(monthStr));
    } else if (dateFilter === 'custom' && startDate) {
      const start = new Date(`${startDate}T00:00:00`);
      const end = endDate ? new Date(`${endDate}T23:59:59`) : new Date(`${startDate}T23:59:59`);
      list = list.filter((p) => {
        const pDate = new Date(p.date);
        return pDate >= start && pDate <= end;
      });
    }

    if (query) {
      list = list.filter(
        (p) =>
          p.clientName.toLowerCase().includes(query) ||
          p.clientNumber.toLowerCase().includes(query) ||
          p.product.toLowerCase().includes(query) ||
          (p.ticketNumber && p.ticketNumber.toLowerCase().includes(query)) ||
          p.registeredBy.toLowerCase().includes(query)
      );
    }

    // Sort by date descending
    list.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    const activePurchases = list.filter((p) => p.status === 'Activo');
    const totalAmount = activePurchases.reduce((sum, p) => sum + p.amount, 0);

    res.json({
      purchases: list,
      summary: {
        count: activePurchases.length,
        totalAmount,
      },
    });
  });

  // 4. Balance Report API
  app.get('/api/reports/balance', authenticateJWT, (req: Request, res: Response) => {
    const filter = (req.query.filter as string || 'Todos').toLowerCase();
    const query = (req.query.q as string || '').toLowerCase().trim();

    let result = [...clientsStore];

    if (query) {
      result = result.filter(
        (c) =>
          c.name.toLowerCase().includes(query) ||
          c.phone.toLowerCase().includes(query) ||
          c.clientNumber.toLowerCase().includes(query)
      );
    }

    if (filter === 'con deuda') {
      result = result.filter((c) => c.currentBalance > 0);
    } else if (filter === 'al límite') {
      result = result.filter(
        (c) => c.creditLimit > 0 && c.currentBalance >= c.creditLimit * 0.9 && c.currentBalance > 0
      );
    } else if (filter === 'sin deuda' || filter === 'pagado') {
      result = result.filter((c) => c.currentBalance <= 0);
    } else if (filter === 'saldo a favor') {
      result = result.filter((c) => c.currentBalance < 0);
    }

    const totalClientsDebt = clientsStore.filter((c) => c.currentBalance > 0).length;
    const totalPortfolioAmount = clientsStore.reduce(
      (sum, c) => (c.currentBalance > 0 ? sum + c.currentBalance : sum),
      0
    );

    res.json({
      report: result,
      summary: {
        totalClientsDebt,
        totalPortfolioAmount,
      },
    });
  });

  // 5. Admin APIs: Users & Audit Logs
  app.get('/api/admin/users', authenticateJWT, requireAdminRole, (req: Request, res: Response) => {
    res.json(usersStore);
  });

  app.post('/api/admin/users', authenticateJWT, requireAdminRole, (req: AuthenticatedRequest, res: Response) => {
    const { name, email, role } = req.body;

    if (!name || !email || !role) {
      return res.status(400).json({ error: 'Nombre, correo y rol son requeridos' });
    }

    const existing = usersStore.find((u) => u.email.toLowerCase() === email.trim().toLowerCase());
    if (existing) {
      return res.status(400).json({ error: 'Ya existe un usuario registrado con este correo' });
    }

    const newUser: User = {
      id: `usr-${Date.now()}`,
      name: name.trim(),
      email: email.trim().toLowerCase(),
      role: role as UserRole,
      avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&q=80&w=150',
      active: true,
      createdAt: new Date().toISOString(),
    };

    usersStore.push(newUser);

    logAudit(
      req.user!,
      'CREAR_USUARIO',
      `Nuevo usuario de sistema creado: ${newUser.name} (${newUser.email}) con rol ${newUser.role}`,
      newUser.id
    );

    res.status(201).json(newUser);
  });

  app.put('/api/admin/users/:id/role', authenticateJWT, requireAdminRole, (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;
    const { role, active } = req.body;

    const user = usersStore.find((u) => u.id === id);
    if (!user) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    if (role) user.role = role;
    if (active !== undefined) user.active = Boolean(active);

    logAudit(
      req.user!,
      'MODIFICAR_PERMISOS',
      `Permisos/Estado actualizados para usuario ${user.name}: Rol=${user.role}, Activo=${user.active}`,
      user.id
    );

    res.json(user);
  });

  // Audit Logs API
  app.get('/api/admin/audit-logs', authenticateJWT, requireAdminRole, (req: Request, res: Response) => {
    res.json(auditLogsStore);
  });

  // Annulled operations list
  app.get('/api/admin/annulled-operations', authenticateJWT, requireAdminRole, (req: Request, res: Response) => {
    const annulledPurchases = purchasesStore.filter((p) => p.status === 'Anulado');
    const annulledPayments = paymentsStore.filter((p) => p.status === 'Anulado');
    res.json({
      annulledPurchases,
      annulledPayments,
    });
  });

  // --- VITE MIDDLEWARE / STATIC SERVING ---
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req: Request, res: Response) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`CrediManage POS Server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer();
