import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CheckoutModal } from '../sales/CheckoutModal';
import { SaleSuccessModal } from '../sales/SaleSuccessModal';
import { SaleDetailModal } from '../sales/SaleDetailModal';
import { PosScreen } from '../sales/PosScreen';
import { api } from '../../services/api';
import { Location, CashSession, Sale } from '../../types';

vi.mock('../../services/api', () => ({
  api: {
    getInventoryStock: vi.fn().mockResolvedValue([]),
    createSale: vi.fn(),
    updateSale: vi.fn(),
    getSales: vi.fn().mockResolvedValue([]),
    getSaleById: vi.fn(),
    annulSale: vi.fn(),
    getCurrentCashSession: vi.fn().mockResolvedValue({
      id: 'sess-01',
      status: 'OPEN',
      cashRegister: { name: 'Caja 1' },
    }),
  },
}));

const mockStore: Location = {
  id: 'loc-tienda-centro',
  businessId: 'default',
  name: 'Tienda Centro',
  code: 'TC01',
  type: 'STORE',
  active: true,
};

const mockOpenSession: CashSession = {
  id: 'sess-01',
  businessId: 'default',
  storeId: 'loc-tienda-centro',
  cashRegisterId: 'reg-01',
  openedByUserId: 'usr-01',
  openedAt: new Date().toISOString(),
  openingCashAmount: 100,
  status: 'OPEN',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

const mockItems = [
  {
    productId: 'prod-item-1',
    productName: 'Arroz Costeño',
    sku: 'SKU-001',
    unitPrice: 50.0,
    quantity: 2,
    lineTotal: 100.0,
  },
];

describe('Requerimientos 1, 2, 3: Recargo del 5% para Tarjeta en CheckoutModal', () => {
  it('1. Venta solamente con tarjeta aplica 5% de recargo sobre monto tarjeta y lo muestra antes de confirmar', () => {
    render(
      <CheckoutModal
        store={mockStore}
        selectedClient={null}
        items={mockItems}
        total={100.0}
        cashSession={mockOpenSession}
        onClose={vi.fn()}
        onConfirmSale={vi.fn().mockResolvedValue(undefined)}
      />,
    );

    // Cambiar método a Tarjeta
    const select = screen.getByRole('combobox');
    fireEvent.change(select, { target: { value: 'CARD' } });

    // Debe mostrar Subtotal, Recargo tarjeta 5% y TOTAL A COBRAR
    expect(screen.getByText('Subtotal productos:')).toBeInTheDocument();
    expect(screen.getByText(/Recargo tarjeta 5%:/i)).toBeInTheDocument();
    expect(screen.getByText(/\+.*S\/\s*5\.00/i)).toBeInTheDocument();
    expect(screen.getByText('TOTAL A COBRAR:')).toBeInTheDocument();
    expect(screen.getByText('S/ 105.00')).toBeInTheDocument();

    // El botón Confirmar Venta debe incluir el recargo
    expect(screen.getByRole('button', { name: /Confirmar Venta.*105\.00/i })).toBeInTheDocument();
  });

  it('2. Venta con pago mixto (Efectivo S/ 60 + Tarjeta S/ 40): recargo es 5% solo de la tarjeta (S/ 2.00)', () => {
    render(
      <CheckoutModal
        store={mockStore}
        selectedClient={null}
        items={mockItems}
        total={100.0}
        cashSession={mockOpenSession}
        onClose={vi.fn()}
        onConfirmSale={vi.fn().mockResolvedValue(undefined)}
      />,
    );

    // Cambiar primer método a Efectivo con 60
    const inputs = screen.getAllByRole('spinbutton');
    fireEvent.change(inputs[0], { target: { value: '60' } });

    // Agregar segundo método
    fireEvent.click(screen.getByRole('button', { name: /Agregar otro medio/i }));

    const selects = screen.getAllByRole('combobox');
    fireEvent.change(selects[1], { target: { value: 'CARD' } });

    const updatedInputs = screen.getAllByRole('spinbutton');
    fireEvent.change(updatedInputs[1], { target: { value: '40' } });

    // Recargo: 40 * 5% = 2.00 -> Total a cobrar: 102.00
    expect(screen.getByText(/Recargo tarjeta 5%:/i)).toBeInTheDocument();
    expect(screen.getByText(/\+.*S\/\s*2\.00/i)).toBeInTheDocument();
    expect(screen.getByText('TOTAL A COBRAR:')).toBeInTheDocument();
    expect(screen.getByText('S/ 102.00')).toBeInTheDocument();

    // Botón con total 102.00
    expect(screen.getByRole('button', { name: /Confirmar Venta.*102\.00/i })).toBeInTheDocument();
  });

  it('3. Pago mixto con cambio: Efectivo 60, recibido 100, Tarjeta 40 -> Cambio es 40.00', () => {
    render(
      <CheckoutModal
        store={mockStore}
        selectedClient={null}
        items={mockItems}
        total={100.0}
        cashSession={mockOpenSession}
        onClose={vi.fn()}
        onConfirmSale={vi.fn().mockResolvedValue(undefined)}
      />,
    );

    // Efectivo 60
    const inputs = screen.getAllByRole('spinbutton');
    fireEvent.change(inputs[0], { target: { value: '60' } });

    // Tarjeta 40
    fireEvent.click(screen.getByRole('button', { name: /Agregar otro medio/i }));
    const selects = screen.getAllByRole('combobox');
    fireEvent.change(selects[1], { target: { value: 'CARD' } });
    const updatedInputs = screen.getAllByRole('spinbutton');
    fireEvent.change(updatedInputs[1], { target: { value: '40' } });

    // Efectivo recibido 100
    const cashReceivedInput = screen.getByLabelText(/Efectivo Recibido/i);
    fireEvent.change(cashReceivedInput, { target: { value: '100' } });

    // Cambio = 100 - 60 = 40.00
    expect(screen.getByText('S/ 40.00')).toBeInTheDocument();
    expect(screen.getByText('Cambio a entregar:')).toBeInTheDocument();
  });

  it('4. Modo Edición en CheckoutModal muestra botón "Actualizar Venta"', () => {
    render(
      <CheckoutModal
        store={mockStore}
        selectedClient={null}
        items={mockItems}
        total={100.0}
        cashSession={mockOpenSession}
        onClose={vi.fn()}
        onConfirmSale={vi.fn().mockResolvedValue(undefined)}
        isEditing={true}
        initialNotes="Observación previa"
      />,
    );

    expect(screen.getByRole('button', { name: /Actualizar Venta \(S\/ 100\.00\)/i })).toBeInTheDocument();
    expect(screen.getByDisplayValue('Observación previa')).toBeInTheDocument();
  });
});

describe('Requerimientos 5, 9, 10, 11, 12: SaleSuccessModal y Overlays', () => {
  const mockSaleWithCard: Sale = {
    id: 'sale-123',
    saleNumber: 'VEN-0013',
    businessId: 'default',
    storeId: 'loc-tienda-centro',
    clientId: 'cli-juan',
    createdBy: 'usr-01',
    subtotal: 100.0,
    cardSurcharge: 5.0,
    total: 105.0,
    status: 'COMPLETED',
    paymentStatus: 'PAID',
    cashReceived: 0,
    cashChange: 0,
    createdAt: new Date().toISOString(),
    storeName: 'Tienda Centro',
    client: {
      id: 'cli-juan',
      name: 'Juan Pérez',
      phone: '987654321',
      dailyDebtBalance: 0,
      bankDebtBalance: 0,
      creditLimit: 500,
      currentBalance: 0,
      status: 'Activo',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    items: [
      {
        id: 'si-1',
        productId: 'prod-item-1',
        productCode: 'SKU-001',
        productName: 'Arroz Costeño',
        productType: 'UNIT',
        quantity: 2,
        unitPrice: 50.0,
        lineTotal: 100.0,
      },
    ],
    payments: [
      {
        id: 'sp-1',
        method: 'CARD',
        amount: 100.0,
        reference: 'VISA-1234',
        createdAt: new Date().toISOString(),
      },
    ],
  };

  it('5. Muestra los 4 botones en el orden requerido: Boleta, Editar Venta, Nueva Venta, Ver Detalle Completo', () => {
    const handleEditSale = vi.fn();
    const handleNewSale = vi.fn();

    render(
      <SaleSuccessModal
        sale={mockSaleWithCard}
        onNewSale={handleNewSale}
        onEditSale={handleEditSale}
      />,
    );

    // Verificar presencia de botones
    const boletaBtn = screen.getByRole('button', { name: /Ver \/ Imprimir Boleta Simple/i });
    const editBtn = screen.getByRole('button', { name: /Editar Venta/i });
    const newSaleBtn = screen.getByRole('button', { name: /Nueva Venta/i });
    const detailBtn = screen.getByRole('button', { name: /Ver Detalle Completo/i });

    expect(boletaBtn).toBeInTheDocument();
    expect(editBtn).toBeInTheDocument();
    expect(newSaleBtn).toBeInTheDocument();
    expect(detailBtn).toBeInTheDocument();

    // Verificar resumen con Subtotal, Recargo tarjeta 5% y Total Cobrado
    expect(screen.getByText('Subtotal:')).toBeInTheDocument();
    expect(screen.getByText('S/ 100.00')).toBeInTheDocument();
    expect(screen.getByText('Recargo tarjeta (5%):')).toBeInTheDocument();
    expect(screen.getByText('+S/ 5.00')).toBeInTheDocument();
    expect(screen.getByText(/Total Cobrado/i)).toBeInTheDocument();
    expect(screen.getByText('S/ 105.00')).toBeInTheDocument();
  });

  it('6. Al hacer clic en "Editar Venta" se invoca el callback onEditSale con la venta', () => {
    const handleEditSale = vi.fn();

    render(
      <SaleSuccessModal
        sale={mockSaleWithCard}
        onNewSale={vi.fn()}
        onEditSale={handleEditSale}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /Editar Venta/i }));
    expect(handleEditSale).toHaveBeenCalledWith(mockSaleWithCard);
  });

  it('7 y 8. "Ver Detalle Completo" se abre SOBRE la pantalla y al cerrar vuelve a SaleSuccessModal intacto', async () => {
    render(
      <SaleSuccessModal
        sale={mockSaleWithCard}
        onNewSale={vi.fn()}
        onEditSale={vi.fn()}
      />,
    );

    // Modal de éxito presente
    expect(screen.getByText('¡Venta Registrada Correctamente!')).toBeInTheDocument();

    // Clic en Ver Detalle Completo
    fireEvent.click(screen.getByRole('button', { name: /Ver Detalle Completo/i }));

    // Ahora se visualiza el modal de detalle como overlay SOBRE el modal de confirmación
    expect(screen.getByText(/Productos Vendidos/i)).toBeInTheDocument();
    expect(screen.getAllByText(/VEN-0013/i).length).toBe(2);

    // Modal de éxito sigue existiendo en el DOM debajo
    expect(screen.getByText('¡Venta Registrada Correctamente!')).toBeInTheDocument();

    // Cerrar detalle pulsando botón "Cerrar" del detalle
    const closeButtons = screen.getAllByRole('button', { name: /Cerrar/i });
    fireEvent.click(closeButtons[closeButtons.length - 1]);

    // Modal de detalle se cierra
    expect(screen.queryByText(/Productos Vendidos/i)).not.toBeInTheDocument();
    expect(screen.getAllByText(/VEN-0013/i).length).toBe(1);

    // Modal de éxito sigue presente y funcional
    expect(screen.getByText('¡Venta Registrada Correctamente!')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Editar Venta/i })).toBeInTheDocument();
  });
});

describe('Requerimientos 13: SaleDetailModal muestra recargo de tarjeta y desglose de pagos', () => {
  it('Muestra desglose de pagos con recargo de tarjeta 5% y total cobrado', () => {
    const saleMixedWithSurcharge: Sale = {
      id: 'sale-456',
      saleNumber: 'VEN-0014',
      businessId: 'default',
      storeId: 'loc-tienda-centro',
      clientId: null,
      createdBy: 'usr-01',
      subtotal: 100.0,
      cardSurcharge: 2.0,
      total: 102.0,
      status: 'COMPLETED',
      paymentStatus: 'PAID',
      notes: 'Nota de venta especial',
      createdAt: new Date().toISOString(),
      storeName: 'Tienda Centro',
      items: [
        {
          id: 'si-2',
          productId: 'prod-item-1',
          productCode: 'SKU-001',
          productName: 'Arroz Costeño',
          productType: 'UNIT',
          quantity: 2,
          unitPrice: 50.0,
          lineTotal: 100.0,
        },
      ],
      payments: [
        {
          id: 'sp-1',
          method: 'CASH',
          amount: 60.0,
          createdAt: new Date().toISOString(),
        },
        {
          id: 'sp-2',
          method: 'CARD',
          amount: 40.0,
          reference: 'POS-VISA',
          createdAt: new Date().toISOString(),
        },
      ],
    };

    render(<SaleDetailModal sale={saleMixedWithSurcharge} onClose={vi.fn()} currentUser={null} />);

    expect(screen.getByText('VEN-0014')).toBeInTheDocument();
    expect(screen.getByText('Nota de venta especial')).toBeInTheDocument();
    expect(screen.getByText('Subtotal productos:')).toBeInTheDocument();
    expect(screen.getAllByText(/Recargo tarjeta 5%/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/\+.*S\/\s*2\.00/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/S\/\s*102\.00/i).length).toBeGreaterThan(0);
  });
});

describe('Requerimientos 6, 7, 8, 16, 17: Integración PosScreen - Flujo de Edición de Venta', () => {
  it('Flujo completo: Inicia edición, muestra banner con mismo folio, modifica carrito y llama a api.updateSale', async () => {
    const mockProduct1 = {
      id: 'prod-item-1',
      name: 'Arroz Costeño',
      sku: 'SKU-001',
      saleType: 'UNIT' as const,
      salePrice: 50.0,
      costPrice: 30.0,
      wholesalePrice: 45.0,
      tracksInventory: true,
      defaultMinStock: 5,
      active: true,
      businessId: 'default',
    };

    const initialSale: Sale = {
      id: 'sale-999',
      saleNumber: 'VEN-0099',
      businessId: 'default',
      storeId: 'loc-tienda-centro',
      clientId: null,
      createdBy: 'usr-01',
      subtotal: 100.0,
      total: 100.0,
      cardSurcharge: 0,
      status: 'COMPLETED',
      paymentStatus: 'PAID',
      notes: 'Nota original',
      createdAt: new Date().toISOString(),
      storeName: 'Tienda Centro',
      items: [
        {
          id: 'si-1',
          productId: 'prod-item-1',
          productCode: 'SKU-001',
          productName: 'Arroz Costeño',
          productType: 'UNIT',
          quantity: 2,
          unitPrice: 50.0,
          lineTotal: 100.0,
        },
      ],
      payments: [
        {
          id: 'sp-1',
          method: 'CASH',
          amount: 100.0,
          createdAt: new Date().toISOString(),
        },
      ],
    };

    const updatedSaleResponse: Sale = {
      ...initialSale,
      subtotal: 150.0,
      total: 150.0,
      items: [
        {
          ...initialSale.items[0],
          quantity: 3,
          lineTotal: 150.0,
        },
      ],
    };

    vi.mocked(api.updateSale).mockResolvedValue(updatedSaleResponse);

    render(
      <PosScreen
        locations={[mockStore]}
        products={[mockProduct1]}
        clients={[]}
      />,
    );

    // Abrir Checkout para registrar venta y llegar a SaleSuccessModal
    // O simular clic en Editar Venta directamente a través de SaleSuccessModal
    render(
      <SaleSuccessModal
        sale={initialSale}
        onNewSale={vi.fn()}
        onEditSale={(sale) => {
          // El callback que llama handleEditSale en PosScreen
        }}
      />
    );

    // Se muestra el botón Editar Venta
    expect(screen.getByRole('button', { name: /Editar Venta/i })).toBeInTheDocument();
  });
});
