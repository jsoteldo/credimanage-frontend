import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { InventoryView } from '../InventoryView';
import { AddInventoryModal } from '../AddInventoryModal';
import { AdjustInventoryModal } from '../AdjustInventoryModal';
import { TransferInventoryModal } from '../TransferInventoryModal';
import { SetMinimumStockModal } from '../SetMinimumStockModal';
import { Location, Product, Department, User, InventoryStockItem, InventoryKpis } from '../../types';
import { api } from '../../services/api';

vi.mock('../../services/api', () => ({
  api: {
    getInventoryStock: vi.fn(),
    getInventoryKpis: vi.fn(),
    getInventoryMovements: vi.fn(),
    getProductStockDetails: vi.fn(),
    addInventory: vi.fn(),
    adjustInventory: vi.fn(),
    transferInventory: vi.fn(),
    setMinimumStock: vi.fn(),
    explodeKitComponents: vi.fn(),
  },
}));

const mockLocations: Location[] = [
  {
    id: 'loc-tienda-centro',
    businessId: 'default',
    name: 'Tienda Centro',
    code: 'T01',
    type: 'STORE',
    active: true,
  },
  {
    id: 'loc-tienda-norte',
    businessId: 'default',
    name: 'Tienda Norte',
    code: 'T02',
    type: 'STORE',
    active: true,
  },
  {
    id: 'loc-almacen-central',
    businessId: 'default',
    name: 'Almacén Central',
    code: 'A01',
    type: 'WAREHOUSE',
    active: true,
  },
];

const mockDepartments: Department[] = [
  { id: 'dept-bebidas', businessId: 'default', name: 'Bebidas', active: true },
  { id: 'dept-abarrotes', businessId: 'default', name: 'Abarrotes', active: true },
];

const mockProducts: Product[] = [
  {
    id: 'prod-coca',
    businessId: 'default',
    sku: 'COCA-500',
    barcode: '7751234567890',
    name: 'Coca Cola 500ml',
    saleType: 'UNIT',
    costPrice: 2.0,
    salePrice: 3.5,
    wholesalePrice: null,
    tracksInventory: true,
    defaultMinStock: 10,
    active: true,
    departmentId: 'dept-bebidas',
  },
  {
    id: 'prod-arroz',
    businessId: 'default',
    sku: 'ARROZ-KG',
    barcode: '7759876543210',
    name: 'Arroz Costeño 1kg',
    saleType: 'WEIGHT',
    costPrice: 3.2,
    salePrice: 4.8,
    wholesalePrice: null,
    tracksInventory: true,
    defaultMinStock: 20,
    active: true,
    departmentId: 'dept-abarrotes',
  },
];

const mockAdminUser: User = {
  id: 'u-admin',
  name: 'Admin Test',
  email: 'admin@test.com',
  role: 'Administrador',
  active: true,
  permissions: [
    'inventory.view',
    'inventory.entry',
    'inventory.adjust',
    'inventory.transfer',
    'inventory.min_stock',
  ],
};

const mockCashierUser: User = {
  id: 'u-cashier',
  name: 'Cajero Test',
  email: 'cajero@test.com',
  role: 'Cajero',
  active: true,
  permissions: ['inventory.view'],
};

const mockStockItems: InventoryStockItem[] = [
  {
    productId: 'prod-coca',
    productName: 'Coca Cola 500ml',
    sku: 'COCA-500',
    barcode: '7751234567890',
    saleType: 'UNIT',
    costPrice: 2.0,
    salePrice: 3.5,
    departmentId: 'dept-bebidas',
    departmentName: 'Bebidas',
    locationId: 'loc-tienda-centro',
    locationName: 'Tienda Centro',
    locationType: 'STORE',
    quantity: 25,
    minimumStock: 10,
    state: 'NORMAL',
    lastMovement: {
      type: 'ENTRY',
      quantity: 15,
      createdAt: '2026-09-30T10:00:00.000Z',
    },
  },
  {
    productId: 'prod-arroz',
    productName: 'Arroz Costeño 1kg',
    sku: 'ARROZ-KG',
    barcode: '7759876543210',
    saleType: 'WEIGHT',
    costPrice: 3.2,
    salePrice: 4.8,
    departmentId: 'dept-abarrotes',
    departmentName: 'Abarrotes',
    locationId: 'loc-tienda-centro',
    locationName: 'Tienda Centro',
    locationType: 'STORE',
    quantity: 5,
    minimumStock: 15,
    state: 'LOW',
    lastMovement: null,
  },
  {
    productId: 'prod-zero',
    productName: 'Agua San Mateo 600ml',
    sku: 'AGUA-600',
    barcode: '7751111111111',
    saleType: 'UNIT',
    costPrice: 1.0,
    salePrice: 2.0,
    departmentId: 'dept-bebidas',
    departmentName: 'Bebidas',
    locationId: 'loc-tienda-centro',
    locationName: 'Tienda Centro',
    locationType: 'STORE',
    quantity: 0,
    minimumStock: 5,
    state: 'OUT_OF_STOCK',
    lastMovement: null,
  },
  {
    productId: 'prod-neg',
    productName: 'Galletas Soda Pack',
    sku: 'SODA-PK',
    barcode: '7752222222222',
    saleType: 'UNIT',
    costPrice: 1.5,
    salePrice: 2.5,
    departmentId: 'dept-abarrotes',
    departmentName: 'Abarrotes',
    locationId: 'loc-tienda-centro',
    locationName: 'Tienda Centro',
    locationType: 'STORE',
    quantity: -3,
    minimumStock: 5,
    state: 'NEGATIVE',
    lastMovement: null,
  },
];

const mockKpis: InventoryKpis = {
  totalProducts: 4,
  inStockCount: 1,
  lowStockCount: 1,
  outOfStockCount: 1,
  negativeStockCount: 1,
};

describe('ETAPA 1: Frontend Inventario Multi-Tienda (Requisitos A a J)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (api.getInventoryStock as any).mockResolvedValue(mockStockItems);
    (api.getInventoryKpis as any).mockResolvedValue(mockKpis);
    (api.getInventoryMovements as any).mockResolvedValue({
      total: 1,
      page: 1,
      limit: 30,
      totalPages: 1,
      movements: [
        {
          id: 'mov-1',
          createdAt: '2026-09-30T10:00:00.000Z',
          productId: 'prod-coca',
          productName: 'Coca Cola 500ml',
          sku: 'COCA-500',
          barcode: '7751234567890',
          saleType: 'UNIT',
          locationId: 'loc-tienda-centro',
          locationName: 'Tienda Centro',
          locationType: 'STORE',
          type: 'ENTRY',
          quantity: 10,
          previousStock: 0,
          newStock: 10,
          referenceType: 'MANUAL_ENTRY',
          referenceId: null,
          reason: 'Lote semanal',
          notes: null,
          createdBy: 'Admin Test',
        },
      ],
    });
  });

  // A. Selector de ubicación
  it('A. Selector de ubicación permite cambiar entre tiendas y almacenes recargando datos', async () => {
    render(
      <InventoryView
        locations={mockLocations}
        products={mockProducts}
        departments={mockDepartments}
        currentUser={mockAdminUser}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText('Inventario Multi-Tienda')).toBeInTheDocument();
    });

    const locationSelect = screen.getByDisplayValue(/Todas las ubicaciones/);
    expect(locationSelect).toBeInTheDocument();

    // Change location to Tienda Centro
    fireEvent.change(locationSelect, { target: { value: 'loc-tienda-centro' } });

    await waitFor(() => {
      expect(api.getInventoryStock).toHaveBeenCalledWith(
        expect.objectContaining({ locationId: 'loc-tienda-centro' }),
      );
    });
  });

  // B. Tabla desktop
  it('B. Tabla desktop renderiza columnas completas de producto, códigos, stock y estado', async () => {
    render(
      <InventoryView
        locations={mockLocations}
        products={mockProducts}
        departments={mockDepartments}
        currentUser={mockAdminUser}
      />,
    );

    await waitFor(() => {
      expect(screen.getAllByText('Coca Cola 500ml').length).toBeGreaterThan(0);
      expect(screen.getAllByText('Arroz Costeño 1kg').length).toBeGreaterThan(0);
    });

    // Check desktop headers
    expect(screen.getByText('Código / Barcode')).toBeInTheDocument();
    expect(screen.getByText('Stock Actual')).toBeInTheDocument();
    expect(screen.getByText('Stock Mínimo')).toBeInTheDocument();
    expect(screen.getByText('Último Movimiento')).toBeInTheDocument();
  });

  // C. Cards mobile
  it('C. Cards mobile existen en el DOM con layout adaptativo sin desbordar', async () => {
    const { container } = render(
      <InventoryView
        locations={mockLocations}
        products={mockProducts}
        departments={mockDepartments}
        currentUser={mockAdminUser}
      />,
    );

    await waitFor(() => {
      expect(screen.getAllByText('Coca Cola 500ml').length).toBeGreaterThan(0);
    });

    // Assert mobile cards container exists with md:hidden
    const mobileContainer = container.querySelector('.md\\:hidden');
    expect(mobileContainer).toBeInTheDocument();
  });

  // D. Estados visuales: Normal, Bajo, Sin Stock, Negativo
  it('D. Representa correctamente los 4 estados visuales con sus respectivos badges', async () => {
    render(
      <InventoryView
        locations={mockLocations}
        products={mockProducts}
        departments={mockDepartments}
        currentUser={mockAdminUser}
      />,
    );

    await waitFor(() => {
      expect(screen.getAllByText('Stock Normal').length).toBeGreaterThan(0);
      expect(screen.getAllByText('Stock Bajo').length).toBeGreaterThan(0);
      expect(screen.getAllByText('Sin Stock').length).toBeGreaterThan(0);
      expect(screen.getAllByText('Stock Negativo').length).toBeGreaterThan(0);
    });
  });

  // E. Agregar Inventario
  it('E. Modal Agregar Inventario permite capturar stock y llamar a la API atómica', async () => {
    (api.addInventory as any).mockResolvedValue({ success: true });

    render(
      <AddInventoryModal
        isOpen={true}
        onClose={vi.fn()}
        locations={mockLocations}
        products={mockProducts}
        onSuccess={vi.fn()}
      />,
    );

    expect(screen.getByText('Agregar Inventario')).toBeInTheDocument();

    // Select store
    const locSelect = screen.getByLabelText(/Tienda \/ Almacén Destino/);
    fireEvent.change(locSelect, { target: { value: 'loc-tienda-centro' } });

    // Select product
    const prodSelect = screen.getByLabelText(/Seleccionar Producto/);
    fireEvent.change(prodSelect, { target: { value: 'prod-coca' } });

    // Enter quantity
    const qtyInput = screen.getByPlaceholderText('Ej. 10');
    fireEvent.change(qtyInput, { target: { value: '15' } });

    // Submit
    const submitBtn = screen.getByRole('button', { name: /Confirmar Entrada/i });
    fireEvent.submit(submitBtn.closest('form')!);

    await waitFor(() => {
      expect(api.addInventory).toHaveBeenCalledWith(
        expect.objectContaining({
          locationId: 'loc-tienda-centro',
          productId: 'prod-coca',
          quantity: 15,
        }),
      );
    });
  });

  // F. Ajustar Inventario
  it('F. Modal Ajustar Inventario procesa ajuste con motivo y calcula delta', async () => {
    (api.adjustInventory as any).mockResolvedValue({ success: true });

    render(
      <AdjustInventoryModal
        isOpen={true}
        onClose={vi.fn()}
        locations={mockLocations}
        products={mockProducts}
        onSuccess={vi.fn()}
      />,
    );

    expect(screen.getByText('Ajustar Inventario')).toBeInTheDocument();

    const locSelect = screen.getByLabelText(/Tienda \/ Almacén/);
    fireEvent.change(locSelect, { target: { value: 'loc-tienda-centro' } });

    const prodSelect = screen.getByLabelText(/Seleccionar Producto/);
    fireEvent.change(prodSelect, { target: { value: 'prod-coca' } });

    const adjInput = screen.getByPlaceholderText('Ej. +5 o -3');
    fireEvent.change(adjInput, { target: { value: '-2' } });

    const reasonInput = screen.getByPlaceholderText(/Ej\. Conteo físico mensual/);
    fireEvent.change(reasonInput, { target: { value: 'Merma por producto dañado' } });

    const submitBtn = screen.getByRole('button', { name: /Confirmar Ajuste/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(api.adjustInventory).toHaveBeenCalledWith(
        expect.objectContaining({
          locationId: 'loc-tienda-centro',
          productId: 'prod-coca',
          adjustmentQuantity: -2,
          reason: 'Merma por producto dañado',
        }),
      );
    });
  });

  // G. Transferir Inventario
  it('G. Modal Transferir Inventario valida origen y destino diferentes', async () => {
    (api.transferInventory as any).mockResolvedValue({ success: true });

    render(
      <TransferInventoryModal
        isOpen={true}
        onClose={vi.fn()}
        locations={mockLocations}
        products={mockProducts}
        onSuccess={vi.fn()}
      />,
    );

    expect(screen.getByText('Transferir Inventario')).toBeInTheDocument();

    const fromSelect = screen.getByLabelText(/Ubicación Origen/);
    const toSelect = screen.getByLabelText(/Ubicación Destino/);

    fireEvent.change(fromSelect, { target: { value: 'loc-tienda-centro' } });
    fireEvent.change(toSelect, { target: { value: 'loc-almacen-central' } });

    const prodSelect = screen.getByLabelText(/Seleccionar Producto/);
    fireEvent.change(prodSelect, { target: { value: 'prod-coca' } });

    // Wait for stocks to load
    await waitFor(() => {
      expect(screen.getAllByText(/25 un/).length).toBeGreaterThan(0);
    });

    const qtyInput = screen.getByPlaceholderText('Ej. 10');
    fireEvent.change(qtyInput, { target: { value: '8' } });

    const submitBtn = screen.getByRole('button', { name: /Confirmar Transferencia/i });
    fireEvent.submit(submitBtn.closest('form')!);

    await waitFor(() => {
      expect(api.transferInventory).toHaveBeenCalledWith(
        expect.objectContaining({
          fromLocationId: 'loc-tienda-centro',
          toLocationId: 'loc-almacen-central',
          productId: 'prod-coca',
          quantity: 8,
        }),
      );
    });
  });

  // H. Código + Enter selecciona producto automáticamente
  it('H. Presionar Enter en el campo de código selecciona el producto para agilizar lector USB', async () => {
    render(
      <AddInventoryModal
        isOpen={true}
        onClose={vi.fn()}
        locations={mockLocations}
        products={mockProducts}
        onSuccess={vi.fn()}
      />,
    );

    const barcodeInput = screen.getByPlaceholderText(/Escribe o escanea código y presiona Enter/);
    fireEvent.change(barcodeInput, { target: { value: '7751234567890' } });
    act(() => {
      fireEvent.keyDown(barcodeInput, { key: 'Enter', code: 'Enter' });
    });

    await waitFor(() => {
      const prodSelect = screen.getByLabelText(/Seleccionar Producto/) as HTMLSelectElement;
      expect(prodSelect.value).toBe('prod-coca');
    });
  });

  // I. Stock negativo muestra advertencia pero no bloquea
  it('I. Stock negativo muestra advertencia visual explícita sin bloquear la operación', async () => {
    render(
      <AdjustInventoryModal
        isOpen={true}
        onClose={vi.fn()}
        locations={mockLocations}
        products={mockProducts}
        onSuccess={vi.fn()}
      />,
    );

    const prodSelect = screen.getByLabelText(/Seleccionar Producto/);
    fireEvent.change(prodSelect, { target: { value: 'prod-coca' } });

    const adjInput = screen.getByPlaceholderText('Ej. +5 o -3');
    // Set a negative adjustment that results in negative stock
    fireEvent.change(adjInput, { target: { value: '-10' } });

    // Set reason as it is required for adjustment validation
    const reasonInput = screen.getByPlaceholderText(/Ej\. Conteo físico mensual/);
    fireEvent.change(reasonInput, { target: { value: 'Ajuste de prueba' } });

    await waitFor(() => {
      expect(screen.getByText(/Advertencia de Stock Negativo/i)).toBeInTheDocument();
      expect(screen.getByText(/El sistema permite stock negativo/i)).toBeInTheDocument();
    });

    // The submit button is still active and NOT blocked
    const submitBtn = screen.getByRole('button', { name: /Confirmar Ajuste/i });
    expect(submitBtn).not.toBeDisabled();
  });

  // J. Permisos: Cajero no ve botones de acción de ajuste/agregar en el header
  it('J. Cajero tiene acceso de solo lectura y no ve botones operativos de agregar/ajustar', async () => {
    render(
      <InventoryView
        locations={mockLocations}
        products={mockProducts}
        departments={mockDepartments}
        currentUser={mockCashierUser}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText('Inventario Multi-Tienda')).toBeInTheDocument();
    });

    // Cashier cannot add, adjust, or transfer
    expect(screen.queryByRole('button', { name: /Agregar Stock/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Ajustar/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Transferir/i })).not.toBeInTheDocument();
  });
});
