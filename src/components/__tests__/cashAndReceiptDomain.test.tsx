import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CashView } from '../cash/CashView';
import { OpenCashModal } from '../cash/OpenCashModal';
import { CloseCashModal } from '../cash/CloseCashModal';
import { CashMovementModal } from '../cash/CashMovementModal';
import { SessionDetailModal } from '../cash/SessionDetailModal';
import { ReceiptModal } from '../cash/ReceiptModal';
import { ReceiptConfigView } from '../cash/ReceiptConfigView';
import { PosScreen } from '../sales/PosScreen';
import { Location, User, CashSession, CashSessionSummary, Receipt, ReceiptConfig } from '../../types';
import { api } from '../../services/api';

vi.mock('../../services/api', () => ({
  api: {
    getCashRegisters: vi.fn(),
    createCashRegister: vi.fn(),
    updateCashRegister: vi.fn(),
    getCurrentCashSession: vi.fn(),
    openCashSession: vi.fn(),
    closeCashSession: vi.fn(),
    getCashSessionSummary: vi.fn(),
    getCashSessionById: vi.fn(),
    getCashSessionsHistory: vi.fn(),
    addCashMovement: vi.fn(),
    getCashMovements: vi.fn(),
    getReceiptConfig: vi.fn(),
    updateReceiptConfig: vi.fn(),
    getSaleReceipt: vi.fn(),
    reprintSaleReceipt: vi.fn(),
    getSaleById: vi.fn(),
    getInventoryStock: vi.fn(),
    createSale: vi.fn(),
  },
}));

const mockStores: Location[] = [
  {
    id: 'store-centro',
    businessId: 'default',
    name: 'Tienda Centro',
    code: 'TC01',
    type: 'STORE',
    active: true,
  },
];

const mockAdminUser: User = {
  id: 'usr-admin',
  name: 'Admin Global',
  email: 'admin@credimanage.com',
  role: 'Administrador',
  active: true,
};

const mockCashierUser: User = {
  id: 'usr-cajero',
  name: 'Carlos Cajero',
  email: 'carlos@credimanage.com',
  role: 'Cajero',
  active: true,
};

const mockActiveSession: CashSession = {
  id: 'sess-01',
  storeId: 'store-centro',
  cashRegisterId: 'reg-01',
  openedByUserId: 'usr-admin',
  openedAt: '2026-10-01T09:00:00.000Z',
  openingCashAmount: 200,
  status: 'OPEN',
  createdAt: '2026-10-01T09:00:00.000Z',
  updatedAt: '2026-10-01T09:00:00.000Z',
  cashRegister: {
    id: 'reg-01',
    name: 'Caja 01',
    code: 'C01',
    status: 'ACTIVE',
    storeId: 'store-centro',
    createdAt: '2026-01-01',
    updatedAt: '2026-01-01',
  },
  store: {
    id: 'store-centro',
    name: 'Tienda Centro',
    code: 'TC01',
  },
  openedByUser: {
    id: 'usr-admin',
    name: 'Admin Global',
  },
};

const mockSummary: CashSessionSummary = {
  openingCash: 200,
  cashSales: 150,
  yapeSales: 50,
  plinSales: 20,
  cardSales: 80,
  transferSales: 30,
  creditSales: 60,
  cashIn: 40,
  cashOut: 20,
  cashDebtPayments: 0,
  cashLoanPayments: 0,
  cashSaleReversals: 0,
  expectedCashAmount: 370, // 200 + 150 + 40 - 20 = 370
  totalSalesAmount: 390,
  salesCount: 4,
  methodsSummary: {
    CASH: 150,
    YAPE: 50,
    PLIN: 20,
    CARD: 80,
    TRANSFER: 30,
    CREDIT: 60,
  },
};

describe('ETAPA 3 — Frontend Cash & Receipt Domain Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // A. Caja cerrada en POS bloquea checkout
  it('A. POS muestra advertencia y bloquea confirmación de venta cuando no hay caja abierta', async () => {
    (api.getCurrentCashSession as any).mockResolvedValue(null);
    (api.getInventoryStock as any).mockResolvedValue([]);

    render(
      <PosScreen
        locations={mockStores}
        products={[]}
        clients={[]}
        currentUser={mockAdminUser}
      />,
    );

    // Should display "Abrir Caja" button in header
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Abrir Caja/i })).toBeInTheDocument();
    });

    // Warning message in summary box
    expect(screen.getByText(/No existe una caja abierta para esta tienda/i)).toBeInTheDocument();

    // Confirm button is disabled
    const cobrarBtn = screen.getByRole('button', { name: /Cobrar \/ Confirmar/i });
    expect(cobrarBtn).toBeDisabled();
  });

  // B. Abrir caja modal
  it('B. OpenCashModal envía monto inicial y abre sesión en backend', async () => {
    (api.getCashRegisters as any).mockResolvedValue([
      { id: 'reg-01', name: 'Caja 01', code: 'C01', status: 'ACTIVE', storeId: 'store-centro' },
    ]);
    (api.openCashSession as any).mockResolvedValue(mockActiveSession);

    const onSuccess = vi.fn();
    const onClose = vi.fn();

    render(
      <OpenCashModal
        isOpen={true}
        onClose={onClose}
        onSuccess={onSuccess}
        currentUser={mockAdminUser}
        stores={mockStores}
        initialStoreId="store-centro"
      />,
    );

    await waitFor(() => {
      expect(screen.getByText(/Apertura de Turno de Caja/i)).toBeInTheDocument();
    });

    const amountInput = screen.getByPlaceholderText('200.00');
    fireEvent.change(amountInput, { target: { value: '250.00' } });

    const submitBtn = screen.getByRole('button', { name: /Abrir Turno/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(api.openCashSession).toHaveBeenCalledWith(
        expect.objectContaining({
          storeId: 'store-centro',
          cashRegisterId: 'reg-01',
          openingCashAmount: 250,
        }),
      );
      expect(onSuccess).toHaveBeenCalled();
      expect(onClose).toHaveBeenCalled();
    });
  });

  // C & D. Resumen de sesión y efectivo esperado en CashView
  it('C & D. CashView muestra efectivo esperado y desglose financiero de la sesión abierta', async () => {
    (api.getCurrentCashSession as any).mockResolvedValue(mockActiveSession);
    (api.getCashSessionSummary as any).mockResolvedValue(mockSummary);
    (api.getCashMovements as any).mockResolvedValue({ items: [], pagination: { total: 0 } });

    render(<CashView currentUser={mockAdminUser} stores={mockStores} />);

    await waitFor(() => {
      expect(screen.getByText(/TURNO EN CURSO/i)).toBeInTheDocument();
      expect(screen.getAllByText(/Caja 01/i).length).toBeGreaterThan(0);
      // Expected cash S/ 370.00
      expect(screen.getByText('S/ 370.00')).toBeInTheDocument();
      // Total sales S/ 390.00
      expect(screen.getByText('S/ 390.00')).toBeInTheDocument();
      // Credit sales S/ 60.00
      expect(screen.getAllByText('S/ 60.00').length).toBeGreaterThan(0);
    });
  });

  // E. Ingreso manual de efectivo (CASH_IN)
  it('E. CashMovementModal permite registrar un ingreso manual (CASH_IN)', async () => {
    (api.addCashMovement as any).mockResolvedValue({
      movement: { id: 'mov-1', type: 'CASH_IN', amount: 50 },
      summary: mockSummary,
    });

    const onSuccess = vi.fn();
    const onClose = vi.fn();

    render(
      <CashMovementModal
        isOpen={true}
        onClose={onClose}
        onSuccess={onSuccess}
        session={mockActiveSession}
        summary={mockSummary}
        defaultType="CASH_IN"
      />,
    );

    expect(screen.getByText('Ingreso de Efectivo')).toBeInTheDocument();

    const amountInput = screen.getByPlaceholderText('0.00');
    fireEvent.change(amountInput, { target: { value: '50.00' } });

    const reasonInput = screen.getByPlaceholderText(/Fondo adicional/i);
    fireEvent.change(reasonInput, { target: { value: 'Reposición de monedas' } });

    const submitBtn = screen.getByRole('button', { name: /Registrar Ingreso/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(api.addCashMovement).toHaveBeenCalledWith(
        'sess-01',
        expect.objectContaining({
          type: 'CASH_IN',
          amount: 50,
          reason: 'Reposición de monedas',
        }),
      );
      expect(onSuccess).toHaveBeenCalled();
    });
  });

  // F. Retiro con advertencia de saldo negativo (CASH_OUT)
  it('F. CashMovementModal muestra advertencia al dejar la caja en negativo y exige confirmación', async () => {
    (api.addCashMovement as any).mockResolvedValue({
      movement: { id: 'mov-2', type: 'CASH_OUT', amount: 500 },
      summary: mockSummary,
    });

    render(
      <CashMovementModal
        isOpen={true}
        onClose={vi.fn()}
        onSuccess={vi.fn()}
        session={mockActiveSession}
        summary={mockSummary} // current is 370
        defaultType="CASH_OUT"
      />,
    );

    const amountInput = screen.getByPlaceholderText('0.00');
    fireEvent.change(amountInput, { target: { value: '500.00' } }); // exceeds 370

    const reasonInput = screen.getByPlaceholderText(/Compra de suministros/i);
    fireEvent.change(reasonInput, { target: { value: 'Gasto mayor de emergencia' } });

    // Warning should show negative balance
    expect(screen.getByText(/Advertencia de saldo negativo/i)).toBeInTheDocument();

    const submitBtn = screen.getByRole('button', { name: /Registrar Retiro/i });
    // Must be disabled until checkbox checked
    expect(submitBtn).toBeDisabled();

    const checkbox = screen.getByRole('checkbox');
    fireEvent.click(checkbox);

    expect(submitBtn).not.toBeDisabled();
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(api.addCashMovement).toHaveBeenCalledWith(
        'sess-01',
        expect.objectContaining({
          type: 'CASH_OUT',
          amount: 500,
        }),
      );
    });
  });

  // G, H, I, J, K. Arqueo, diferencias y cierre de turno en CloseCashModal
  it('G & H. CloseCashModal calcula cuadra exacto cuando contado == esperado', async () => {
    (api.getCashSessionSummary as any).mockResolvedValue(mockSummary); // expected: 370
    (api.closeCashSession as any).mockResolvedValue({
      ...mockActiveSession,
      status: 'CLOSED',
      countedCashAmount: 370,
      differenceAmount: 0,
    });

    const onSuccess = vi.fn();
    render(
      <CloseCashModal
        isOpen={true}
        onClose={vi.fn()}
        onSuccess={onSuccess}
        session={mockActiveSession}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText('EFECTIVO ESPERADO EN GAVETA:')).toBeInTheDocument();
      expect(screen.getByText('S/ 370.00')).toBeInTheDocument();
    });

    const countedInput = screen.getByPlaceholderText('370.00');
    fireEvent.change(countedInput, { target: { value: '370.00' } });

    // Badge Cuadra Exacto
    expect(screen.getByText(/Cuadra Exacto/i)).toBeInTheDocument();

    const submitBtn = screen.getByRole('button', { name: /Proceder al Cierre/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(api.closeCashSession).toHaveBeenCalledWith('sess-01', {
        countedCashAmount: 370,
        notes: undefined,
      });
      expect(onSuccess).toHaveBeenCalled();
    });
  });

  it('I. CloseCashModal detecta Sobrante cuando contado > esperado', async () => {
    (api.getCashSessionSummary as any).mockResolvedValue(mockSummary); // expected: 370

    render(
      <CloseCashModal
        isOpen={true}
        onClose={vi.fn()}
        onSuccess={vi.fn()}
        session={mockActiveSession}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText('S/ 370.00')).toBeInTheDocument();
    });

    const countedInput = screen.getByPlaceholderText('370.00');
    fireEvent.change(countedInput, { target: { value: '380.00' } }); // +10

    expect(screen.getByText(/Sobrante \(\+S\/ 10.00\)/i)).toBeInTheDocument();
  });

  it('J. CloseCashModal detecta Faltante cuando contado < esperado y solicita confirmación', async () => {
    (api.getCashSessionSummary as any).mockResolvedValue(mockSummary); // expected: 370
    (api.closeCashSession as any).mockResolvedValue({
      ...mockActiveSession,
      status: 'CLOSED',
      countedCashAmount: 365,
      differenceAmount: -5,
    });

    render(
      <CloseCashModal
        isOpen={true}
        onClose={vi.fn()}
        onSuccess={vi.fn()}
        session={mockActiveSession}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText('S/ 370.00')).toBeInTheDocument();
    });

    const countedInput = screen.getByPlaceholderText('370.00');
    fireEvent.change(countedInput, { target: { value: '365.00' } }); // -5

    expect(screen.getByText(/Faltante \(-S\/ 5.00\)/i)).toBeInTheDocument();

    const submitBtn = screen.getByRole('button', { name: /Proceder al Cierre/i });
    fireEvent.click(submitBtn);

    // Confirmation screen appears
    await waitFor(() => {
      expect(screen.getByText(/Se detectó una diferencia de caja/i)).toBeInTheDocument();
      expect(screen.getByText(/Confirmar Cierre Definitivo/i)).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /Confirmar Cierre Definitivo/i }));

    await waitFor(() => {
      expect(api.closeCashSession).toHaveBeenCalledWith('sess-01', {
        countedCashAmount: 365,
        notes: undefined,
      });
    });
  });

  // L. Detalle de sesión cerrada
  it('L. SessionDetailModal muestra el acta de cierre completa y solo lectura', async () => {
    (api.getCashSessionById as any).mockResolvedValue({
      ...mockActiveSession,
      status: 'CLOSED',
      closedAt: '2026-10-01T18:00:00.000Z',
      expectedCashAmount: 370,
      countedCashAmount: 368,
      differenceAmount: -2,
    });
    (api.getCashMovements as any).mockResolvedValue({
      items: [
        {
          id: 'mov-1',
          type: 'OPENING',
          paymentMethod: 'CASH',
          amount: 200,
          createdAt: '2026-10-01T09:00:00.000Z',
          description: 'Apertura',
        },
      ],
      pagination: { total: 1 },
    });

    render(
      <SessionDetailModal
        isOpen={true}
        onClose={vi.fn()}
        sessionId="sess-01"
      />,
    );

    await waitFor(() => {
      expect(screen.getByText(/Acta y Detalle de Turno de Caja/i)).toBeInTheDocument();
      expect(screen.getByText('CERRADO')).toBeInTheDocument();
      expect(screen.getByText('S/ 368.00')).toBeInTheDocument();
      expect(screen.getAllByText(/2\.00/).length).toBeGreaterThan(0);
      expect(screen.getByText(/Movimientos Registrados \(1\)/i)).toBeInTheDocument();
    });
  });

  // M & N. Boleta Simple e Impresión / Reimpresión en ReceiptModal
  it('M & N. ReceiptModal muestra boleta formateada y gestiona reimpresión con auditoría', async () => {
    const mockReceipt: Receipt = {
      id: 'rec-01',
      saleId: 'sale-01',
      number: 'B001-000001',
      series: 'B001',
      sequence: 1,
      reprintedCount: 1,
      createdAt: '2026-10-01T10:00:00.000Z',
      configSnapshot: {
        businessName: 'TIENDA CREDIMANAGE',
        secondaryText: 'Ventas al por mayor',
        address: 'Calle Real 100',
        phone: '999888777',
        footerMessage: 'Gracias por su compra',
        paperWidth: '80mm',
        showStore: true,
        showCashier: true,
        showCustomer: true,
        showPaymentMethods: true,
      },
    };

    (api.getSaleReceipt as any).mockResolvedValue(mockReceipt);
    (api.getSaleById as any).mockResolvedValue({
      id: 'sale-01',
      saleNumber: 'VEN-000001',
      storeName: 'Tienda Centro',
      clientName: 'Juan Pérez',
      total: 100,
      createdAt: '2026-10-01T10:00:00.000Z',
      status: 'COMPLETED',
      items: [
        {
          id: 'item-1',
          productCode: 'PROD-01',
          productName: 'Camisa Sport',
          quantity: 2,
          unitPrice: 50,
          lineTotal: 100,
        },
      ],
      payments: [{ method: 'CASH', amount: 100 }],
    });

    render(<ReceiptModal isOpen={true} onClose={vi.fn()} saleId="sale-01" />);

    await waitFor(() => {
      expect(screen.getByText('TIENDA CREDIMANAGE')).toBeInTheDocument();
      expect(screen.getAllByText('B001-000001').length).toBeGreaterThan(0);
      expect(screen.getByText('Camisa Sport')).toBeInTheDocument();
      expect(screen.getAllByText(/100\.00/).length).toBeGreaterThan(0);
      expect(screen.getByText('[Copia #1]')).toBeInTheDocument();
    });

    // Check reprint button
    const printBtn = screen.getByRole('button', { name: /Reimprimir Boleta/i });
    expect(printBtn).toBeInTheDocument();
  });

  // O & P. Configuración de Boleta Simple y Vista Previa
  it('O & P. ReceiptConfigView permite al administrador editar datos y refleja en tiempo real la vista previa', async () => {
    (api.getReceiptConfig as any).mockResolvedValue({
      businessName: 'MI EMPRESA DEMO',
      secondaryText: 'Distribuidora',
      address: 'Av. Test 123',
      phone: '123456789',
      footerMessage: 'Vuelva pronto',
      paperWidth: '80mm',
    });
    (api.updateReceiptConfig as any).mockResolvedValue({
      businessName: 'MI EMPRESA MODIFICADA',
      secondaryText: 'Distribuidora',
      address: 'Av. Test 123',
      phone: '123456789',
      footerMessage: 'Vuelva pronto',
      paperWidth: '80mm',
    });

    render(<ReceiptConfigView currentUser={mockAdminUser} />);

    await waitFor(() => {
      expect(screen.getByDisplayValue('MI EMPRESA DEMO')).toBeInTheDocument();
      // Real-time preview shows the business name
      expect(screen.getAllByText('MI EMPRESA DEMO').length).toBeGreaterThan(0);
    });

    const nameInput = screen.getByDisplayValue('MI EMPRESA DEMO');
    fireEvent.change(nameInput, { target: { value: 'MI EMPRESA MODIFICADA' } });

    // Live preview updates immediately!
    expect(screen.getByText('MI EMPRESA MODIFICADA')).toBeInTheDocument();

    const saveBtn = screen.getByRole('button', { name: /Guardar Cambios/i });
    fireEvent.click(saveBtn);

    await waitFor(() => {
      expect(api.updateReceiptConfig).toHaveBeenCalledWith(
        expect.objectContaining({
          businessName: 'MI EMPRESA MODIFICADA',
        }),
      );
    });
  });

  // Q. Permisos de configuración
  it('Q. ReceiptConfigView no permite editar configuración a usuarios sin rol Administrador', async () => {
    (api.getReceiptConfig as any).mockResolvedValue({
      businessName: 'CREDIMANAGE',
      paperWidth: '80mm',
    });

    render(<ReceiptConfigView currentUser={mockCashierUser} />);

    await waitFor(() => {
      expect(
        screen.getByText(/Solo los administradores pueden modificar los datos del comprobante/i),
      ).toBeInTheDocument();
    });

    // Inputs should be disabled
    const nameInput = screen.getByDisplayValue('CREDIMANAGE');
    expect(nameInput).toBeDisabled();

    // No save button
    expect(screen.queryByRole('button', { name: /Guardar Cambios/i })).not.toBeInTheDocument();
  });

  // =========================================================================
  // CONTROL DE PERMISOS DE MOVIMIENTOS MANUALES: PRUEBAS FRONTEND A A F
  // =========================================================================
  describe('Control de Permisos de Movimientos Manuales (CASH_IN / CASH_OUT): Pruebas Frontend A a F', () => {
    const mockCashierWithCashOut: User = {
      id: 'usr-cajero-out',
      name: 'Cajero Retiros',
      email: 'retiros@credimanage.com',
      role: 'Cajero',
      active: true,
      permissions: ['cash.cash_out', 'cash.open', 'cash.close', 'cash.view'],
    };

    const mockCashierWithCashIn: User = {
      id: 'usr-cajero-in',
      name: 'Cajero Ingresos',
      email: 'ingresos@credimanage.com',
      role: 'Cajero',
      active: true,
      permissions: ['cash.cash_in', 'cash.open', 'cash.close', 'cash.view'],
    };

    const mockCashierNoMovements: User = {
      id: 'usr-cajero-none',
      name: 'Cajero Sin Movimientos',
      email: 'none@credimanage.com',
      role: 'Cajero',
      active: true,
      permissions: ['cash.open', 'cash.close', 'cash.view'],
    };

    it('A. Usuario con permiso ve/usa Retiro', async () => {
      (api.addCashMovement as any).mockResolvedValue({
        movement: { id: 'mov-out', type: 'CASH_OUT', amount: 30 },
        summary: mockSummary,
      });

      const onSuccess = vi.fn();

      render(
        <CashMovementModal
          isOpen={true}
          onClose={vi.fn()}
          onSuccess={onSuccess}
          session={mockActiveSession}
          summary={mockSummary}
          defaultType="CASH_OUT"
          currentUser={mockCashierWithCashOut}
        />,
      );

      // Retiro button should be enabled
      const retiroBtn = screen.getByRole('button', { name: /remove_circle.*Retiro/i });
      expect(retiroBtn).not.toBeDisabled();

      const amountInput = screen.getByPlaceholderText('0.00');
      fireEvent.change(amountInput, { target: { value: '30.00' } });

      const reasonInput = screen.getByPlaceholderText(/Compra de suministros/i);
      fireEvent.change(reasonInput, { target: { value: 'Pago de movilidad' } });

      const submitBtn = screen.getByRole('button', { name: /Registrar Retiro/i });
      expect(submitBtn).not.toBeDisabled();
      fireEvent.click(submitBtn);

      await waitFor(() => {
        expect(api.addCashMovement).toHaveBeenCalledWith(
          'sess-01',
          expect.objectContaining({
            type: 'CASH_OUT',
            amount: 30,
            reason: 'Pago de movilidad',
          }),
        );
        expect(onSuccess).toHaveBeenCalled();
      });
    });

    it('B. Usuario sin permiso no puede usar Retiro', () => {
      render(
        <CashMovementModal
          isOpen={true}
          onClose={vi.fn()}
          onSuccess={vi.fn()}
          session={mockActiveSession}
          summary={mockSummary}
          defaultType="CASH_OUT"
          currentUser={mockCashierNoMovements}
        />,
      );

      // Retiro toggle button must be disabled with tooltip
      const retiroBtn = screen.getByRole('button', { name: /remove_circle.*Retiro/i });
      expect(retiroBtn).toBeDisabled();
      expect(retiroBtn).toHaveAttribute(
        'title',
        'No tienes permiso para registrar retiros de caja.',
      );
    });

    it('C. Usuario con permiso ve/usa Ingreso', async () => {
      (api.addCashMovement as any).mockResolvedValue({
        movement: { id: 'mov-in', type: 'CASH_IN', amount: 80 },
        summary: mockSummary,
      });

      const onSuccess = vi.fn();

      render(
        <CashMovementModal
          isOpen={true}
          onClose={vi.fn()}
          onSuccess={onSuccess}
          session={mockActiveSession}
          summary={mockSummary}
          defaultType="CASH_IN"
          currentUser={mockCashierWithCashIn}
        />,
      );

      const ingresoBtn = screen.getByRole('button', { name: /add_circle.*Ingreso/i });
      expect(ingresoBtn).not.toBeDisabled();

      const amountInput = screen.getByPlaceholderText('0.00');
      fireEvent.change(amountInput, { target: { value: '80.00' } });

      const reasonInput = screen.getByPlaceholderText(/Fondo adicional/i);
      fireEvent.change(reasonInput, { target: { value: 'Inyección de caja' } });

      const submitBtn = screen.getByRole('button', { name: /Registrar Ingreso/i });
      expect(submitBtn).not.toBeDisabled();
      fireEvent.click(submitBtn);

      await waitFor(() => {
        expect(api.addCashMovement).toHaveBeenCalledWith(
          'sess-01',
          expect.objectContaining({
            type: 'CASH_IN',
            amount: 80,
            reason: 'Inyección de caja',
          }),
        );
        expect(onSuccess).toHaveBeenCalled();
      });
    });

    it('D. Usuario sin permiso no puede usar Ingreso', () => {
      render(
        <CashMovementModal
          isOpen={true}
          onClose={vi.fn()}
          onSuccess={vi.fn()}
          session={mockActiveSession}
          summary={mockSummary}
          defaultType="CASH_IN"
          currentUser={mockCashierNoMovements}
        />,
      );

      // Ingreso toggle button must be disabled with tooltip
      const ingresoBtn = screen.getByRole('button', { name: /add_circle.*Ingreso/i });
      expect(ingresoBtn).toBeDisabled();
      expect(ingresoBtn).toHaveAttribute(
        'title',
        'No tienes permiso para registrar ingresos manuales de caja.',
      );
    });

    it('E. Error backend 403 muestra mensaje amigable', async () => {
      const forbiddenError: any = new Error('Forbidden');
      forbiddenError.status = 403;
      (api.addCashMovement as any).mockRejectedValue(forbiddenError);

      render(
        <CashMovementModal
          isOpen={true}
          onClose={vi.fn()}
          onSuccess={vi.fn()}
          session={mockActiveSession}
          summary={mockSummary}
          defaultType="CASH_OUT"
          currentUser={mockCashierWithCashOut}
        />,
      );

      const amountInput = screen.getByPlaceholderText('0.00');
      fireEvent.change(amountInput, { target: { value: '25.00' } });

      const reasonInput = screen.getByPlaceholderText(/Compra de suministros/i);
      fireEvent.change(reasonInput, { target: { value: 'Gasto menor' } });

      const submitBtn = screen.getByRole('button', { name: /Registrar Retiro/i });
      fireEvent.click(submitBtn);

      await waitFor(() => {
        expect(screen.getByText('No tienes permiso para registrar retiros de caja.')).toBeInTheDocument();
        expect(screen.queryByText('Forbidden')).not.toBeInTheDocument();
      });
    });

    it('F. No aparece texto crudo "Unauthorized"', async () => {
      const unauthError: any = new Error('Unauthorized');
      unauthError.status = 401;
      (api.addCashMovement as any).mockRejectedValue(unauthError);

      render(
        <CashMovementModal
          isOpen={true}
          onClose={vi.fn()}
          onSuccess={vi.fn()}
          session={mockActiveSession}
          summary={mockSummary}
          defaultType="CASH_IN"
          currentUser={mockCashierWithCashIn}
        />,
      );

      const amountInput = screen.getByPlaceholderText('0.00');
      fireEvent.change(amountInput, { target: { value: '20.00' } });

      const reasonInput = screen.getByPlaceholderText(/Fondo adicional/i);
      fireEvent.change(reasonInput, { target: { value: 'Aporte' } });

      const submitBtn = screen.getByRole('button', { name: /Registrar Ingreso/i });
      fireEvent.click(submitBtn);

      await waitFor(() => {
        expect(screen.getByText(/Sesión expirada o no autenticado/i)).toBeInTheDocument();
        expect(screen.queryByText('Unauthorized')).not.toBeInTheDocument();
      });
    });
  });

  describe('Bloque 8: Historial de Turnos de Caja (Robustez y Cero Pantalla en Blanco)', () => {
    it('Renderiza correctamente el historial con montos serializados como strings o decimales', async () => {
      (api.getCurrentCashSession as any).mockResolvedValue(null);
      (api.getCashSessionsHistory as any).mockResolvedValue({
        items: [
          {
            id: 'sess-hist-1',
            cashRegisterId: 'reg-01',
            storeId: 'store-centro',
            openedByUserId: 'usr-admin',
            openedAt: '2026-10-12T08:00:00Z',
            closedAt: '2026-10-12T17:00:00Z',
            openingCashAmount: '100.00' as any,
            status: 'CLOSED',
            expectedCashAmount: '350.50' as any,
            countedCashAmount: '350.50' as any,
            differenceAmount: '0.00' as any,
            createdAt: '2026-10-12T08:00:00Z',
            updatedAt: '2026-10-12T17:00:00Z',
            cashRegister: { name: 'Caja Principal' },
            openedByUser: { name: 'Admin Global' },
          },
          {
            id: 'sess-hist-2',
            cashRegisterId: 'reg-01',
            storeId: 'store-centro',
            openedByUserId: 'usr-cajero',
            openedAt: '2026-10-11T08:00:00Z',
            closedAt: '2026-10-11T17:00:00Z',
            openingCashAmount: '80.00' as any,
            status: 'CLOSED',
            expectedCashAmount: '200.00' as any,
            countedCashAmount: '195.00' as any,
            differenceAmount: '-5.00' as any,
            createdAt: '2026-10-11T08:00:00Z',
            updatedAt: '2026-10-11T17:00:00Z',
            cashRegister: { name: 'Caja Principal' },
            openedByUser: { name: 'Carlos Cajero' },
          },
        ],
        pagination: { total: 2, page: 1, limit: 15, totalPages: 1 },
      });

      render(
        <CashView
          currentUser={mockAdminUser}
          stores={mockStores}
        />,
      );

      // Switch to Historial de Cierres tab
      const historyTabBtn = screen.getByRole('button', { name: /Historial de Cierres/i });
      fireEvent.click(historyTabBtn);

      await waitFor(() => {
        expect(screen.getByText('Historial de Turnos de Caja')).toBeInTheDocument();
        expect(screen.getAllByText('Caja Principal').length).toBeGreaterThan(0);
      });

      // Verify amounts format without crash
      expect(screen.getAllByText('0.00').length).toBeGreaterThan(0);
      expect(screen.getAllByText('-5.00').length).toBeGreaterThan(0);
    });

    it('SessionDetailModal renderiza sin error con openingCashAmount y differenceAmount como strings', async () => {
      (api.getCashSessionById as any).mockResolvedValue({
        id: 'sess-hist-detail',
        openingCashAmount: '150.00' as any,
        expectedCashAmount: '400.00' as any,
        countedCashAmount: '410.00' as any,
        differenceAmount: '10.00' as any,
        status: 'CLOSED',
        openedAt: '2026-10-12T08:00:00Z',
        closedAt: '2026-10-12T18:00:00Z',
        store: { name: 'Tienda Centro' },
        cashRegister: { name: 'Caja 01', code: 'C01' },
        openedByUser: { name: 'Admin Global' },
      });
      (api.getCashMovements as any).mockResolvedValue({ items: [] });

      render(
        <SessionDetailModal
          isOpen={true}
          onClose={vi.fn()}
          sessionId="sess-hist-detail"
        />,
      );

      await waitFor(() => {
        expect(screen.getByText('Acta y Detalle de Turno de Caja')).toBeInTheDocument();
        expect(screen.getByText(/Sobrante \(\+S\/ 10\.00\)/i)).toBeInTheDocument();
        expect(screen.getByText('S/ 150.00')).toBeInTheDocument();
      });
    });
  });
});
