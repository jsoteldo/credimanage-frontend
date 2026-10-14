import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { InventoryView } from '../InventoryView';
import { AddInventoryModal } from '../AddInventoryModal';
import { AdjustInventoryModal } from '../AdjustInventoryModal';
import { TransferInventoryModal } from '../TransferInventoryModal';
import { SetMinimumStockModal } from '../SetMinimumStockModal';
import { ProductFormModal } from '../ProductFormModal';
import { PosScreen } from '../sales/PosScreen';
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
    createSale: vi.fn(),
    getCurrentCashSession: vi.fn(),
    getReceiptConfig: vi.fn(),
  },
}));

const mockLocations: Location[] = [
  {
    id: 'loc-tienda-1',
    businessId: 'default',
    name: 'Tienda Principal',
    code: 'T01',
    type: 'STORE',
    active: true,
  },
  {
    id: 'loc-tienda-2',
    businessId: 'default',
    name: 'Tienda Sucursal',
    code: 'T02',
    type: 'STORE',
    active: true,
  },
];

const mockDepartments: Department[] = [
  { id: 'dept-1', businessId: 'default', name: 'General', active: true },
];

const mockProducts: Product[] = [
  {
    id: 'prod-coca',
    businessId: 'default',
    sku: 'COCA-500',
    barcode: '7751234567890',
    name: 'Coca Cola 500ml',
    saleType: 'UNIT',
    costPrice: 2,
    salePrice: 3.5,
    wholesalePrice: 3,
    tracksInventory: true,
    defaultMinStock: 5,
    active: true,
  },
  {
    id: 'prod-arroz',
    businessId: 'default',
    sku: 'ARROZ-KG',
    barcode: '7759876543210',
    name: 'Arroz 1kg',
    saleType: 'UNIT',
    costPrice: 3,
    salePrice: 4.5,
    wholesalePrice: 4,
    tracksInventory: true,
    defaultMinStock: 10,
    active: true,
  },
];

const mockAdminUser: User = {
  id: 'u-admin',
  name: 'Admin Test',
  email: 'admin@credimanage.com',
  role: 'Administrador',
  active: true,
};

describe('Regla de Negocio: Cantidades Enteras en Inventario (Pruebas Frontend A a F)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (api.getCurrentCashSession as any).mockResolvedValue(null);
    (api.getReceiptConfig as any).mockResolvedValue(null);
    (api.getInventoryStock as any).mockResolvedValue([]);
    (api.getInventoryKpis as any).mockResolvedValue({
      totalProducts: 0,
      inStockCount: 0,
      lowStockCount: 0,
      outOfStockCount: 0,
      negativeStockCount: 0,
    });
  });

  // A. Inventario muestra 113, no 113.00
  it('A: Inventario muestra 113 exacto como entero, sin .00 ni decimales', async () => {
    const mockStockItems: InventoryStockItem[] = [
      {
        productId: 'prod-coca',
        productName: 'Coca Cola 500ml',
        sku: 'COCA-500',
        saleType: 'UNIT',
        costPrice: 2,
        salePrice: 3.5,
        locationId: 'loc-tienda-1',
        locationName: 'Tienda Principal',
        locationType: 'STORE',
        quantity: 113,
        minimumStock: 10,
        state: 'NORMAL',
      },
    ];

    const mockKpis: InventoryKpis = {
      totalProducts: 1,
      inStockCount: 1,
      lowStockCount: 0,
      outOfStockCount: 0,
      negativeStockCount: 0,
    };

    (api.getInventoryStock as any).mockResolvedValue(mockStockItems);
    (api.getInventoryKpis as any).mockResolvedValue(mockKpis);

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
    });

    // Validar que se muestre "113" y que NO exista "113.00" ni "113.000"
    expect(screen.getAllByText('113').length).toBeGreaterThan(0);
    expect(screen.queryByText('113.00')).toBeNull();
    expect(screen.queryByText('113.000')).toBeNull();
    expect(screen.queryByText('113.00200000000001')).toBeNull();
  });

  // B. Stock negativo muestra -1
  it('B: Stock negativo muestra -1 exacto sin decimales y con badge negativo', async () => {
    const mockStockItems: InventoryStockItem[] = [
      {
        productId: 'prod-arroz',
        productName: 'Arroz 1kg',
        sku: 'ARROZ-KG',
        saleType: 'UNIT',
        costPrice: 3,
        salePrice: 4.5,
        locationId: 'loc-tienda-1',
        locationName: 'Tienda Principal',
        locationType: 'STORE',
        quantity: -1,
        minimumStock: 5,
        state: 'NEGATIVE',
      },
    ];

    const mockKpis: InventoryKpis = {
      totalProducts: 1,
      inStockCount: 0,
      lowStockCount: 0,
      outOfStockCount: 0,
      negativeStockCount: 1,
    };

    (api.getInventoryStock as any).mockResolvedValue(mockStockItems);
    (api.getInventoryKpis as any).mockResolvedValue(mockKpis);

    render(
      <InventoryView
        locations={mockLocations}
        products={mockProducts}
        departments={mockDepartments}
        currentUser={mockAdminUser}
      />,
    );

    await waitFor(() => {
      expect(screen.getAllByText('Arroz 1kg').length).toBeGreaterThan(0);
    });

    expect(screen.getAllByText('-1').length).toBeGreaterThan(0);
    expect(screen.queryByText('-1.00')).toBeNull();
    expect(screen.queryByText('-1.0')).toBeNull();
  });

  // C. Inputs usan step=1
  it('C: Inputs de entradas, ajustes, transferencias y stock mínimo usan step="1"', () => {
    // 1. AddInventoryModal
    const { unmount: unmountAdd } = render(
      <AddInventoryModal
        isOpen={true}
        onClose={vi.fn()}
        locations={mockLocations}
        products={mockProducts}
        onSuccess={vi.fn()}
      />,
    );
    const addInput = document.getElementById('add-inventory-quantity') as HTMLInputElement;
    expect(addInput).toBeDefined();
    expect(addInput.getAttribute('step')).toBe('1');
    expect(addInput.getAttribute('type')).toBe('number');
    unmountAdd();

    // 2. AdjustInventoryModal
    const { unmount: unmountAdj } = render(
      <AdjustInventoryModal
        isOpen={true}
        onClose={vi.fn()}
        locations={mockLocations}
        products={mockProducts}
        onSuccess={vi.fn()}
      />,
    );
    const adjInput = document.getElementById('adjust-inventory-value') as HTMLInputElement;
    expect(adjInput).toBeDefined();
    expect(adjInput.getAttribute('step')).toBe('1');
    expect(adjInput.getAttribute('type')).toBe('number');
    unmountAdj();

    // 3. TransferInventoryModal
    const { unmount: unmountTrans } = render(
      <TransferInventoryModal
        isOpen={true}
        onClose={vi.fn()}
        locations={mockLocations}
        products={mockProducts}
        onSuccess={vi.fn()}
      />,
    );
    const transInput = screen.getByLabelText(/Cantidad a Transferir/i) as HTMLInputElement;
    expect(transInput).toBeDefined();
    expect(transInput.getAttribute('step')).toBe('1');
    expect(transInput.getAttribute('type')).toBe('number');
    unmountTrans();

    // 4. SetMinimumStockModal
    const { unmount: unmountMin } = render(
      <SetMinimumStockModal
        isOpen={true}
        onClose={vi.fn()}
        locations={mockLocations}
        product={mockProducts[0]}
        onSuccess={vi.fn()}
      />,
    );
    const minInput = screen.getByLabelText(/Stock Mínimo en esta Ubicación/i) as HTMLInputElement;
    expect(minInput).toBeDefined();
    expect(minInput.getAttribute('step')).toBe('1');
    expect(minInput.getAttribute('type')).toBe('number');
    unmountMin();
  });

  // D. No se puede confirmar cantidad decimal
  it('D: Rechaza confirmación de cantidad decimal con mensaje exacto en todos los modales', async () => {
    // 1. AddInventoryModal con 1.5
    const { unmount: unmountAdd } = render(
      <AddInventoryModal
        isOpen={true}
        onClose={vi.fn()}
        locations={mockLocations}
        products={mockProducts}
        preselectedProduct={mockProducts[0]}
        selectedLocationId="loc-tienda-1"
        onSuccess={vi.fn()}
      />,
    );

    const addInput = document.getElementById('add-inventory-quantity') as HTMLInputElement;
    fireEvent.change(addInput, { target: { value: '1.5' } });
    fireEvent.submit(addInput.closest('form')!);

    await waitFor(() => {
      expect(
        screen.getByText('La cantidad de inventario debe ser un número entero.'),
      ).toBeDefined();
    });
    expect(api.addInventory).not.toHaveBeenCalled();
    unmountAdd();

    // 2. AdjustInventoryModal con -2.5
    const { unmount: unmountAdj } = render(
      <AdjustInventoryModal
        isOpen={true}
        onClose={vi.fn()}
        locations={mockLocations}
        products={mockProducts}
        preselectedProduct={mockProducts[0]}
        selectedLocationId="loc-tienda-1"
        onSuccess={vi.fn()}
      />,
    );

    const adjInput = document.getElementById('adjust-inventory-value') as HTMLInputElement;
    fireEvent.change(adjInput, { target: { value: '-2.5' } });
    const reasonInput = document.getElementById('adjust-inventory-reason') as HTMLInputElement;
    fireEvent.change(reasonInput, { target: { value: 'Ajuste de prueba' } });
    fireEvent.submit(adjInput.closest('form')!);

    await waitFor(() => {
      expect(
        screen.getByText('La cantidad de inventario debe ser un número entero.'),
      ).toBeDefined();
    });
    expect(api.adjustInventory).not.toHaveBeenCalled();
    unmountAdj();

    // 3. TransferInventoryModal con 3.2
    const { unmount: unmountTrans } = render(
      <TransferInventoryModal
        isOpen={true}
        onClose={vi.fn()}
        locations={mockLocations}
        products={mockProducts}
        preselectedProduct={mockProducts[0]}
        selectedLocationId="loc-tienda-1"
        onSuccess={vi.fn()}
      />,
    );

    // Seleccionar destino diferente
    const selectDest = document.getElementById('transfer-to-location') as HTMLSelectElement;
    fireEvent.change(selectDest, { target: { value: 'loc-tienda-2' } });

    const transInput = screen.getByLabelText(/Cantidad a Transferir/i) as HTMLInputElement;
    fireEvent.change(transInput, { target: { value: '3.2' } });
    fireEvent.submit(transInput.closest('form')!);

    await waitFor(() => {
      expect(
        screen.getByText('La cantidad de inventario debe ser un número entero.'),
      ).toBeDefined();
    });
    expect(api.transferInventory).not.toHaveBeenCalled();
    unmountTrans();

    // 4. SetMinimumStockModal con 5.5
    const { unmount: unmountMin } = render(
      <SetMinimumStockModal
        isOpen={true}
        onClose={vi.fn()}
        locations={mockLocations}
        product={mockProducts[0]}
        locationId="loc-tienda-1"
        onSuccess={vi.fn()}
      />,
    );

    const minInput = screen.getByLabelText(/Stock Mínimo en esta Ubicación/i) as HTMLInputElement;
    fireEvent.change(minInput, { target: { value: '5.5' } });
    fireEvent.submit(minInput.closest('form')!);

    await waitFor(() => {
      expect(
        screen.getByText('La cantidad de inventario debe ser un número entero.'),
      ).toBeDefined();
    });
    expect(api.setMinimumStock).not.toHaveBeenCalled();
    unmountMin();
  });

  // E. POS incrementa/decrementa de uno en uno
  it('E: POS incrementa y decrementa de uno en uno con enteros', async () => {
    const user = userEvent.setup();

    (api.getCurrentCashSession as any).mockResolvedValue({
      id: 'session-01',
      storeId: 'loc-tienda-1',
      cashRegisterId: 'reg-01',
      status: 'OPEN',
      openingCashAmount: 200,
      cashRegister: { id: 'reg-01', name: 'Caja 01', code: 'C01' },
    });
    (api.getInventoryStock as any).mockResolvedValue([
      {
        productId: 'prod-coca',
        productName: 'Coca Cola 500ml',
        sku: 'COCA-500',
        quantity: 10,
        minimumStock: 5,
        state: 'NORMAL',
      },
    ]);

    render(
      <PosScreen
        locations={mockLocations}
        products={mockProducts}
        clients={[]}
        currentUser={mockAdminUser}
      />,
    );

    // Agregar producto al carrito mediante búsqueda/código de barras con Enter
    const searchInput = screen.getByPlaceholderText(
      /Código de barras, SKU o nombre del producto/i,
    );
    fireEvent.change(searchInput, { target: { value: '7751234567890' } });
    fireEvent.keyDown(searchInput, { key: 'Enter', code: 'Enter' });

    // Verificar que aparece en el carrito con cantidad inicial = 1
    await waitFor(() => {
      const qtyInput = screen.getByDisplayValue('1') as HTMLInputElement;
      expect(qtyInput).toBeDefined();
      expect(qtyInput.getAttribute('step')).toBe('1');
    });

    // Botón incrementar (+)
    const incButton = screen.getByLabelText('Incrementar cantidad');
    await user.click(incButton);
    expect(screen.getByDisplayValue('2')).toBeDefined();

    await user.click(incButton);
    expect(screen.getByDisplayValue('3')).toBeDefined();

    // Botón decrementar (-)
    const decButton = screen.getByLabelText('Disminuir cantidad');
    await user.click(decButton);
    expect(screen.getByDisplayValue('2')).toBeDefined();
  });

  // F. Kit solo permite cantidades enteras
  it('F: Kit solo permite cantidades enteras de componentes y rechaza decimales', async () => {
    const user = userEvent.setup();
    const handleSave = vi.fn();

    render(
      <ProductFormModal
        isOpen={true}
        onClose={vi.fn()}
        onSave={handleSave}
        departments={mockDepartments}
        availableComponentProducts={mockProducts}
      />,
    );

    // Seleccionar tipo KIT desde el select
    const saleTypeSelect = screen.getByLabelText(/Tipo de Venta/i);
    await user.selectOptions(saleTypeSelect, 'KIT');

    // Completar SKU y Nombre
    const skuInput = screen.getByPlaceholderText('Ej. REF-001');
    await user.clear(skuInput);
    await user.type(skuInput, 'KIT-PRUEBA');

    const nameInput = screen.getByPlaceholderText('Ej. Harina de Maíz Precocida 1kg');
    await user.type(nameInput, 'Combo Familiar');

    const priceInputs = screen.getAllByPlaceholderText('0.00');
    await user.type(priceInputs[1], '20.00');

    // Agregar un componente
    const addCompBtn = screen.getByRole('button', { name: /Agregar Componente/i });
    await user.click(addCompBtn);

    // Seleccionar producto componente
    const selectComp = screen.getByLabelText('Producto componente 1');
    await user.selectOptions(selectComp, 'prod-coca');

    // Asignar cantidad decimal 0.5
    const compQtyInput = screen.getByLabelText('Cantidad componente 1') as HTMLInputElement;
    expect(compQtyInput.getAttribute('step')).toBe('1');
    await user.clear(compQtyInput);
    await user.type(compQtyInput, '0.5');

    // Intentar guardar con submit del formulario
    const submitBtn = screen.getByRole('button', { name: /Crear Producto/i });
    fireEvent.submit(submitBtn.closest('form')!);

    // Debe mostrar error y no invocar onSave
    await waitFor(() => {
      expect(
        screen.getByText('La cantidad de inventario debe ser un número entero.'),
      ).toBeDefined();
    });
    expect(handleSave).not.toHaveBeenCalled();

    // Ahora corregir a entero 2
    await user.clear(compQtyInput);
    await user.type(compQtyInput, '2');
    fireEvent.submit(submitBtn.closest('form')!);

    await waitFor(() => {
      expect(handleSave).toHaveBeenCalledWith(
        expect.objectContaining({
          sku: 'KIT-PRUEBA',
          saleType: 'KIT',
          components: expect.arrayContaining([
            expect.objectContaining({
              componentProductId: 'prod-coca',
              quantity: 2,
            }),
          ]),
        }),
      );
    });
  });
});
