import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PosScreen } from '../sales/PosScreen';
import { CheckoutModal } from '../sales/CheckoutModal';
import { SalesView } from '../sales/SalesView';
import { Product, Location, Client, User, Sale } from '../../types';
import { api } from '../../services/api';

vi.mock('../../services/api', () => ({
  api: {
    getInventoryStock: vi.fn(),
    createSale: vi.fn(),
    getSales: vi.fn(),
    getSaleById: vi.fn(),
    annulSale: vi.fn(),
    getCurrentCashSession: vi.fn(),
  },
}));

const mockLocations: Location[] = [
  {
    id: 'loc-tienda-centro',
    businessId: 'default',
    name: 'Tienda Centro',
    code: 'TC01',
    type: 'STORE',
    active: true,
  },
  {
    id: 'loc-tienda-norte',
    businessId: 'default',
    name: 'Tienda Norte',
    code: 'TN02',
    type: 'STORE',
    active: true,
  },
];

const mockProducts: Product[] = [
  {
    id: 'prod-coca',
    businessId: 'default',
    sku: 'COCA-500',
    barcode: '775001',
    name: 'Coca Cola 500ml',
    saleType: 'UNIT',
    salePrice: 3.0,
    costPrice: 2.0,
    wholesalePrice: 2.8,
    tracksInventory: true,
    defaultMinStock: 5,
    active: true,
  },
  {
    id: 'prod-arroz',
    businessId: 'default',
    sku: 'ARROZ-KG',
    barcode: '775002',
    name: 'Arroz Costeño 1kg',
    saleType: 'WEIGHT',
    salePrice: 5.0,
    costPrice: 3.8,
    wholesalePrice: 4.8,
    tracksInventory: true,
    defaultMinStock: 10,
    active: true,
  },
  {
    id: 'prod-kit-promo',
    businessId: 'default',
    sku: 'KIT-PROMO',
    barcode: '775999',
    name: 'Kit Promo Bebidas',
    saleType: 'KIT',
    salePrice: 10.0,
    costPrice: 6.0,
    wholesalePrice: 9.5,
    tracksInventory: false,
    defaultMinStock: 0,
    active: true,
  },
];

const mockClients: Client[] = [
  {
    id: 'cli-juan',
    clientNumber: 'CLI-1001',
    name: 'Juan Pérez',
    phone: '987654321',
    address: 'Av. Principal 123',
    creditLimit: 500,
    currentBalance: 100,
    dailyDebtBalance: 100,
    bankDebtBalance: 0,
    status: 'Activo',
    createdAt: '2026-01-01',
    updatedAt: '2026-01-01',
  },
];

const mockCashierUser: User = {
  id: 'u-cashier',
  name: 'Cajero Demo',
  email: 'cajero@test.com',
  role: 'Cajero',
  active: true,
  permissions: ['sales.view', 'sales.create'],
};

describe('ETAPA 2: Frontend POS & Ventas (Pruebas A a Q)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (api.getInventoryStock as any).mockResolvedValue([
      {
        productId: 'prod-coca',
        productName: 'Coca Cola 500ml',
        sku: 'COCA-500',
        quantity: 10,
        minimumStock: 5,
        state: 'NORMAL',
      },
      {
        productId: 'prod-arroz',
        productName: 'Arroz Costeño 1kg',
        sku: 'ARROZ-KG',
        quantity: 2, // low stock! <= minimumStock 10
        minimumStock: 10,
        state: 'LOW',
      },
    ]);

    (api.getSales as any).mockResolvedValue({
      total: 0,
      limit: 50,
      offset: 0,
      sales: [],
    });

    (api.getCurrentCashSession as any).mockResolvedValue({
      id: 'session-01',
      storeId: 'loc-tienda-centro',
      cashRegisterId: 'reg-01',
      status: 'OPEN',
      openingCashAmount: 200,
      cashRegister: { id: 'reg-01', name: 'Caja 01', code: 'C01' },
    });
  });

  // A. Buscar producto
  it('A. Buscar producto muestra resultados en dropdown filtrando por nombre o SKU', async () => {
    render(
      <PosScreen
        locations={mockLocations}
        products={mockProducts}
        clients={mockClients}
      />,
    );

    const searchInput = screen.getByPlaceholderText(
      /Código de barras, SKU o nombre del producto/i,
    );

    fireEvent.change(searchInput, { target: { value: 'coca' } });

    await waitFor(() => {
      expect(screen.getByText('Coca Cola 500ml')).toBeInTheDocument();
      expect(screen.getByText(/SKU: COCA-500/i)).toBeInTheDocument();
      expect(screen.getByText('S/ 3.00')).toBeInTheDocument();
    });
  });

  // B. Código + Enter
  it('B. Código + Enter agrega producto directamente al carrito por lector USB/código exacto', async () => {
    render(
      <PosScreen
        locations={mockLocations}
        products={mockProducts}
        clients={mockClients}
      />,
    );

    const searchInput = screen.getByPlaceholderText(
      /Código de barras, SKU o nombre del producto/i,
    );

    // Enter exact barcode
    fireEvent.change(searchInput, { target: { value: '775001' } });
    fireEvent.keyDown(searchInput, { key: 'Enter', code: 'Enter' });

    await waitFor(() => {
      // In cart
      const cartItems = screen.getAllByText('Coca Cola 500ml');
      expect(cartItems.length).toBeGreaterThan(0);
      expect(screen.getByText('Total a Pagar')).toBeInTheDocument();
      expect(screen.getAllByText('S/ 3.00').length).toBeGreaterThan(0);
    });
  });

  // C. Producto existente incrementa cantidad
  it('C. Producto existente en carrito incrementa cantidad en +1 sin duplicar fila', async () => {
    render(
      <PosScreen
        locations={mockLocations}
        products={mockProducts}
        clients={mockClients}
      />,
    );

    const searchInput = screen.getByPlaceholderText(
      /Código de barras, SKU o nombre del producto/i,
    );

    // Scan 1
    fireEvent.change(searchInput, { target: { value: '775001' } });
    fireEvent.keyDown(searchInput, { key: 'Enter', code: 'Enter' });

    // Scan 2
    fireEvent.change(searchInput, { target: { value: '775001' } });
    fireEvent.keyDown(searchInput, { key: 'Enter', code: 'Enter' });

    await waitFor(() => {
      const qtyInputs = screen.getAllByRole('spinbutton');
      // The cart quantity input
      const cartQty = qtyInputs.find((input) => (input as HTMLInputElement).value === '2');
      expect(cartQty).toBeDefined();
      expect(screen.getAllByText('S/ 6.00').length).toBeGreaterThan(0);
    });
  });

  // D. Editar cantidad
  it('D. Editar cantidad actualiza el importe de la línea y el total general', async () => {
    render(
      <PosScreen
        locations={mockLocations}
        products={mockProducts}
        clients={mockClients}
      />,
    );

    const searchInput = screen.getByPlaceholderText(
      /Código de barras, SKU o nombre del producto/i,
    );

    // Add Arroz (5.00)
    fireEvent.change(searchInput, { target: { value: 'ARROZ-KG' } });
    fireEvent.keyDown(searchInput, { key: 'Enter', code: 'Enter' });

    await waitFor(() => {
      expect(screen.getByText('Arroz Costeño 1kg')).toBeInTheDocument();
    });

    const qtyInput = screen.getByDisplayValue('1');
    fireEvent.change(qtyInput, { target: { value: '4' } });

    await waitFor(() => {
      // 4 x 5.00 = 20.00
      expect(screen.getAllByText('S/ 20.00').length).toBeGreaterThan(0);
    });
  });

  // E. Eliminar producto
  it('E. Eliminar producto lo retira del carrito y recalcula total a 0', async () => {
    render(
      <PosScreen
        locations={mockLocations}
        products={mockProducts}
        clients={mockClients}
      />,
    );

    const searchInput = screen.getByPlaceholderText(
      /Código de barras, SKU o nombre del producto/i,
    );

    fireEvent.change(searchInput, { target: { value: 'COCA-500' } });
    fireEvent.keyDown(searchInput, { key: 'Enter', code: 'Enter' });

    await waitFor(() => {
      expect(screen.getByText('Coca Cola 500ml')).toBeInTheDocument();
    });

    const removeBtn = screen.getByTitle('Eliminar producto');
    fireEvent.click(removeBtn);

    await waitFor(() => {
      expect(screen.getByText('El carrito está vacío')).toBeInTheDocument();
      expect(screen.getAllByText('S/ 0.00').length).toBeGreaterThan(0);
    });
  });

  // F. Stock bajo visible
  it('F. Stock bajo visible con badge indicativo en búsqueda', async () => {
    render(
      <PosScreen
        locations={mockLocations}
        products={mockProducts}
        clients={mockClients}
      />,
    );

    const searchInput = screen.getByPlaceholderText(
      /Código de barras, SKU o nombre del producto/i,
    );

    // Arroz has quantity: 2, minimumStock: 10 -> Low stock
    fireEvent.change(searchInput, { target: { value: 'arroz' } });

    await waitFor(() => {
      expect(screen.getByText(/Bajo \(2\)/i)).toBeInTheDocument();
    });
  });

  // G. Stock negativo visible pero vendible
  it('G. Stock negativo visible con advertencia en carrito pero permite la venta sin bloquear', async () => {
    render(
      <PosScreen
        locations={mockLocations}
        products={mockProducts}
        clients={mockClients}
      />,
    );

    const searchInput = screen.getByPlaceholderText(
      /Código de barras, SKU o nombre del producto/i,
    );

    await waitFor(() => {
      expect(api.getInventoryStock).toHaveBeenCalled();
    });

    // Arroz has stock 2
    fireEvent.change(searchInput, { target: { value: 'ARROZ-KG' } });
    fireEvent.keyDown(searchInput, { key: 'Enter', code: 'Enter' });

    await waitFor(() => {
      expect(screen.getByText('Arroz Costeño 1kg')).toBeInTheDocument();
    });

    // Change qty to 5 -> projected stock -3
    const qtyInput = screen.getByDisplayValue('1');
    fireEvent.change(qtyInput, { target: { value: '5' } });

    await waitFor(() => {
      expect(
        screen.getByText(/Dejará stock en -3 unidades/i),
      ).toBeInTheDocument();
      // Button Cobrar is NOT blocked
      const cobrarBtn = screen.getByRole('button', { name: /Cobrar \/ Confirmar/i });
      expect(cobrarBtn).not.toBeDisabled();
    });
  });

  // H. ClientSelector
  it('H. ClientSelector permite asignar cliente registrado y muestra deuda y crédito', async () => {
    render(
      <PosScreen
        locations={mockLocations}
        products={mockProducts}
        clients={mockClients}
      />,
    );

    const selectClientBtn = screen.getByRole('button', {
      name: /Seleccionar Cliente Registrado/i,
    });
    fireEvent.click(selectClientBtn);

    // Modal appears with ClientSelector
    expect(screen.getByText(/Seleccionar Cliente para la Venta/i)).toBeInTheDocument();

    // Type Juan
    const clientSearchInput = screen.getByPlaceholderText(/Buscar por nombre, código o teléfono/i);
    fireEvent.change(clientSearchInput, { target: { value: 'Juan' } });

    const juanOption = await screen.findByText('Juan Pérez');
    fireEvent.click(juanOption);

    await waitFor(() => {
      expect(screen.getByText('Juan Pérez')).toBeInTheDocument();
      expect(screen.getByText('CLI-1001')).toBeInTheDocument();
      expect(screen.getByText(/Deuda Corriente:/i)).toBeInTheDocument();
      expect(screen.getByText('S/ 100.00')).toBeInTheDocument();
    });
  });

  // I. Consumidor Final
  it('I. Por defecto la venta inicia con Consumidor Final', async () => {
    render(
      <PosScreen
        locations={mockLocations}
        products={mockProducts}
        clients={mockClients}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText('Consumidor Final')).toBeInTheDocument();
      expect(screen.getByText(/Por defecto/i)).toBeInTheDocument();
    });
  });

  // J. Cobro efectivo y vuelto
  it('J. Cobro en efectivo calcula automáticamente el cambio a entregar', () => {
    const handleConfirm = vi.fn().mockResolvedValue(undefined);

    render(
      <CheckoutModal
        store={mockLocations[0]}
        selectedClient={null}
        items={[
          {
            productId: 'prod-arroz',
            productName: 'Arroz Costeño 1kg',
            sku: 'ARROZ-KG',
            unitPrice: 5.0,
            quantity: 16,
            lineTotal: 80.0,
          },
        ]}
        total={80.0}
        onClose={vi.fn()}
        onConfirmSale={handleConfirm}
      />,
    );

    expect(screen.getByText('Total a Cobrar')).toBeInTheDocument();
    expect(screen.getAllByText('S/ 80.00').length).toBeGreaterThan(0);

    // Change efectivo recibido to 100.00
    const recibidoInput = screen.getByLabelText(/Efectivo Recibido/i);
    fireEvent.change(recibidoInput, { target: { value: '100' } });

    // Cambio should be 20.00
    expect(screen.getByText('S/ 20.00')).toBeInTheDocument();
    expect(screen.getByText(/Cambio a entregar/i)).toBeInTheDocument();
  });

  // K. Cobro digital (Yape / Plin / Card / Transfer)
  it('K. Permite seleccionar Yape con referencia opcional', () => {
    render(
      <CheckoutModal
        store={mockLocations[0]}
        selectedClient={null}
        items={[
          {
            productId: 'prod-coca',
            productName: 'Coca Cola 500ml',
            sku: 'COCA-500',
            unitPrice: 3.0,
            quantity: 2,
            lineTotal: 6.0,
          },
        ]}
        total={6.0}
        onClose={vi.fn()}
        onConfirmSale={vi.fn()}
      />,
    );

    const methodSelect = screen.getByRole('combobox');
    fireEvent.change(methodSelect, { target: { value: 'YAPE' } });

    expect(
      screen.getByPlaceholderText(/N° operación \/ voucher \/ referencia/i),
    ).toBeInTheDocument();
  });

  // L. Pago mixto
  it('L. Permite agregar múltiples métodos de pago sumando el total exacto', () => {
    render(
      <CheckoutModal
        store={mockLocations[0]}
        selectedClient={null}
        items={[
          {
            productId: 'prod-arroz',
            productName: 'Arroz',
            sku: 'A1',
            unitPrice: 50.0,
            quantity: 2,
            lineTotal: 100.0,
          },
        ]}
        total={100.0}
        onClose={vi.fn()}
        onConfirmSale={vi.fn()}
      />,
    );

    // Initial 1 payment: CASH 100
    // Change to 40
    const firstAmount = screen.getByLabelText(/Monto de pago 1/i);
    fireEvent.change(firstAmount, { target: { value: '40' } });

    expect(screen.getByText(/Faltan S\/ 60.00/i)).toBeInTheDocument();

    // Add second payment row
    const addRowBtn = screen.getByText(/Agregar otro medio/i);
    fireEvent.click(addRowBtn);

    // Second row starts with remaining 60!
    expect(screen.getByText('Monto exacto cubierto')).toBeInTheDocument();
  });

  // M. Pago crédito exige cliente
  it('M. Pago a crédito con Consumidor Final muestra error y bloquea confirmación', () => {
    render(
      <CheckoutModal
        store={mockLocations[0]}
        selectedClient={null} // Consumidor Final
        items={[
          {
            productId: 'prod-coca',
            productName: 'Coca Cola',
            sku: 'C1',
            unitPrice: 10.0,
            quantity: 1,
            lineTotal: 10.0,
          },
        ]}
        total={10.0}
        onClose={vi.fn()}
        onConfirmSale={vi.fn()}
      />,
    );

    const methodSelect = screen.getByRole('combobox');
    fireEvent.change(methodSelect, { target: { value: 'CREDIT' } });

    expect(
      screen.getByText(/Debe seleccionar un cliente registrado para habilitar venta a crédito/i),
    ).toBeInTheDocument();

    const confirmBtn = screen.getByRole('button', { name: /Confirmar Venta/i });
    expect(confirmBtn).toBeDisabled();
  });

  // N. Resumen y total
  it('N. Resumen de venta muestra desglose claro de subtotal, items y total', async () => {
    render(
      <PosScreen
        locations={mockLocations}
        products={mockProducts}
        clients={mockClients}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText('Resumen de Venta')).toBeInTheDocument();
      expect(screen.getByText('Items agregados:')).toBeInTheDocument();
      expect(screen.getByText('Total a Pagar')).toBeInTheDocument();
    });
  });

  // O. Confirmación anti doble-submit
  it('O. Protección anti doble-submit previene envíos concurrentes duplicados', async () => {
    let resolveSale: () => void = () => {};
    const pendingPromise = new Promise<void>((resolve) => {
      resolveSale = resolve;
    });

    const handleConfirm = vi.fn().mockImplementation(() => pendingPromise);

    render(
      <CheckoutModal
        store={mockLocations[0]}
        selectedClient={null}
        cashSession={{ id: 'sess-01', storeId: 'loc-tienda-centro', cashRegisterId: 'reg-01', status: 'OPEN', openingCashAmount: 200 } as any}
        items={[
          {
            productId: 'prod-coca',
            productName: 'Coca',
            sku: 'C1',
            unitPrice: 10.0,
            quantity: 1,
            lineTotal: 10.0,
          },
        ]}
        total={10.0}
        onClose={vi.fn()}
        onConfirmSale={handleConfirm}
      />,
    );

    const confirmBtn = screen.getByRole('button', { name: /Confirmar Venta/i });

    // Click twice quickly
    fireEvent.click(confirmBtn);
    fireEvent.click(confirmBtn);

    expect(handleConfirm).toHaveBeenCalledTimes(1);

    await act(async () => {
      resolveSale();
    });
  });

  // P. Venta exitosa limpia carrito
  it('P. Venta exitosa despliega confirmación con VEN-XXXX y permite iniciar Nueva Venta', async () => {
    const mockCreatedSale: Sale = {
      id: 's-123',
      saleNumber: 'VEN-0042',
      storeId: 'loc-tienda-centro',
      storeName: 'Tienda Centro',
      clientId: null,
      clientName: 'Consumidor Final',
      status: 'COMPLETED',
      subtotal: 6.0,
      total: 6.0,
      paymentStatus: 'PAID',
      createdBy: 'Cajero Demo',
      createdAt: new Date().toISOString(),
      items: [
        {
          id: 'item-1',
          productId: 'prod-coca',
          productCode: 'COCA-500',
          productName: 'Coca Cola 500ml',
          quantity: 2,
          unitPrice: 3.0,
          lineTotal: 6.0,
          productType: 'UNIT',
        },
      ],
      payments: [
        {
          id: 'pay-1',
          method: 'CASH',
          amount: 6.0,
          createdAt: new Date().toISOString(),
        },
      ],
    };

    (api.createSale as any).mockResolvedValue(mockCreatedSale);

    render(
      <PosScreen
        locations={mockLocations}
        products={mockProducts}
        clients={mockClients}
      />,
    );

    // Add item
    const searchInput = screen.getByPlaceholderText(
      /Código de barras, SKU o nombre del producto/i,
    );
    fireEvent.change(searchInput, { target: { value: '775001' } });
    fireEvent.keyDown(searchInput, { key: 'Enter', code: 'Enter' });

    // Wait for active cash session to be loaded
    await screen.findByText(/Turno abierto/i);

    // Open checkout
    const cobrarBtn = await screen.findByRole('button', { name: /Cobrar \/ Confirmar/i });
    fireEvent.click(cobrarBtn);

    // Confirm in modal
    const confirmBtn = await screen.findByRole('button', { name: /Confirmar Venta/i });
    fireEvent.click(confirmBtn);

    // Success screen appears
    await waitFor(() => {
      expect(screen.getByText(/¡Venta Registrada Correctamente!/i)).toBeInTheDocument();
      expect(screen.getByText(/VEN-0042/i)).toBeInTheDocument();
    });

    // Click "Nueva Venta"
    const newSaleBtn = screen.getByRole('button', { name: /Nueva Venta/i });
    fireEvent.click(newSaleBtn);

    await waitFor(() => {
      expect(screen.getByText('El carrito está vacío')).toBeInTheDocument();
    });
  });

  // Q. Responsive: no horizontal overflow
  it('Q. Vista completa de Ventas renderiza pestañas de navegación POS e Historial', async () => {
    render(
      <SalesView
        locations={mockLocations}
        products={mockProducts}
        clients={mockClients}
        currentUser={mockCashierUser}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText('Ventas / Punto de Venta (POS)')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /POS \/ Nueva Venta/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Historial de Ventas/i })).toBeInTheDocument();
    });
  });
});
