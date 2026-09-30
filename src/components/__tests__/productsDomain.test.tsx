import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { ProductsView } from '../ProductsView';
import { ProductFormModal } from '../ProductFormModal';
import { DepartmentFormModal } from '../DepartmentFormModal';
import { LocationFormModal } from '../LocationFormModal';
import { KitsView } from '../KitsView';
import { ImportProductsModal } from '../ImportProductsModal';
import { DepartmentsView } from '../DepartmentsView';
import { SuppliersView } from '../SuppliersView';
import { SupplierFormModal } from '../SupplierFormModal';
import { LocationsView } from '../LocationsView';
import { Product, Department, Supplier, Location, User } from '../../types';
import { hasPermission, canCreateProduct, canManageProducts } from '../../utils/permissions';

const mockAdminUser: User = {
  id: 'u-admin',
  name: 'Admin Test',
  email: 'admin@test.com',
  role: 'Administrador',
  active: true,
  permissions: [
    'product.create',
    'product.edit',
    'product.view',
    'product.deactivate',
    'product.import',
    'department.manage',
    'department.view',
    'supplier.manage',
    'supplier.view',
    'location.manage',
    'location.view',
    'kit.manage',
    'kit.view',
  ],
};

const mockCashierUser: User = {
  id: 'u-cashier',
  name: 'Cajero Test',
  email: 'cashier@test.com',
  role: 'Cajero',
  active: true,
  permissions: ['product.view', 'department.view', 'supplier.view', 'kit.view', 'location.view'],
};

const mockDepartments: Department[] = [
  { id: 'dept-1', businessId: 'default', name: 'Bebidas', description: 'Gaseosas y jugos', active: true, _count: { products: 2 } },
  { id: 'dept-2', businessId: 'default', name: 'Lácteos', description: 'Leche y derivados', active: true, _count: { products: 1 } },
];

const mockProducts: Product[] = [
  {
    id: 'prod-1',
    businessId: 'default',
    sku: 'BEB-001',
    barcode: '7751234567890',
    name: 'Gaseosa Cola 1.5L',
    description: 'Botella retornable',
    departmentId: 'dept-1',
    saleType: 'UNIT',
    costPrice: 5.0,
    salePrice: 8.5,
    wholesalePrice: 7.5,
    tracksInventory: true,
    defaultMinStock: 10,
    active: true,
    department: mockDepartments[0],
  },
  {
    id: 'prod-2',
    businessId: 'default',
    sku: 'LAC-001',
    barcode: null,
    name: 'Queso Andino',
    description: 'Por kilo',
    departmentId: 'dept-2',
    saleType: 'WEIGHT',
    costPrice: 20.0,
    salePrice: 32.0,
    wholesalePrice: 28.0,
    tracksInventory: true,
    defaultMinStock: 5,
    active: true,
    department: mockDepartments[1],
  },
  {
    id: 'prod-3',
    businessId: 'default',
    sku: 'KIT-001',
    barcode: '7759999999999',
    name: 'Combo Parrillero',
    description: 'Gaseosa + Queso',
    departmentId: 'dept-1',
    saleType: 'KIT',
    costPrice: 25.0,
    salePrice: 38.0,
    wholesalePrice: null,
    tracksInventory: false,
    defaultMinStock: null,
    active: true,
    department: mockDepartments[0],
    kitComponents: [
      {
        id: 'comp-1',
        parentProductId: 'prod-3',
        componentProductId: 'prod-1',
        quantity: 2,
        componentProduct: {
          id: 'prod-1',
          name: 'Gaseosa Cola 1.5L',
          sku: 'BEB-001',
          saleType: 'UNIT',
          salePrice: 8.5,
          costPrice: 5.0,
        },
      },
    ],
  },
];

const mockSuppliers: Supplier[] = [
  {
    id: 'sup-1',
    businessId: 'default',
    name: 'Distribuidora Lima S.A.C.',
    taxId: '20123456789',
    phone: '999888777',
    email: 'contacto@distlima.com',
    contactName: 'Carlos Ramos',
    address: 'Av. Industrial 123',
    active: true,
  },
];

const mockLocations: Location[] = [
  {
    id: 'loc-1',
    businessId: 'default',
    name: 'Tienda Principal',
    code: 'TIENDA-01',
    type: 'STORE',
    address: 'Av. Central 456',
    active: true,
  },
  {
    id: 'loc-2',
    businessId: 'default',
    name: 'Almacén Central',
    code: 'ALMACEN-01',
    type: 'WAREHOUSE',
    address: 'Parque Industrial Lote 5',
    active: true,
  },
];

describe('Entrega 1: Products & Inventory Base Domain (Frontend Tests)', () => {
  describe('Permissions Utilities', () => {
    it('returns true when user is Administrador or has explicit permission', () => {
      expect(hasPermission(mockAdminUser, 'product.view')).toBe(true);
      expect(hasPermission(mockAdminUser, 'product.create')).toBe(true);
      expect(canCreateProduct(mockAdminUser)).toBe(true);
      expect(canManageProducts(mockAdminUser)).toBe(true);
    });

    it('honors permissions correctly for restricted Cajero', () => {
      expect(hasPermission(mockCashierUser, 'product.view')).toBe(true);
      expect(hasPermission(mockCashierUser, 'product.create')).toBe(false);
      expect(canCreateProduct(mockCashierUser)).toBe(false);
      expect(canManageProducts(mockCashierUser)).toBe(false);
    });
  });

  describe('ProductsView Component', () => {
    it('renders products table with KPIs and product data', () => {
      render(
        <ProductsView
          products={mockProducts}
          departments={mockDepartments}
          currentUser={mockAdminUser}
          onNewProduct={vi.fn()}
          onEditProduct={vi.fn()}
          onDeactivateProduct={vi.fn()}
          onReactivateProduct={vi.fn()}
          onOpenImportModal={vi.fn()}
          onRefreshData={vi.fn()}
        />
      );

      // KPI totals
      expect(screen.getByText('Catálogo de Productos')).toBeDefined();
      expect(screen.getAllByText('BEB-001').length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText('Gaseosa Cola 1.5L').length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText('LAC-001').length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText('Queso Andino').length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText('KIT-001').length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText('Combo Parrillero').length).toBeGreaterThanOrEqual(1);
    });

    it('shows New Product button for Admin and triggers callback', async () => {
      const handleNew = vi.fn();
      const user = userEvent.setup();

      render(
        <ProductsView
          products={mockProducts}
          departments={mockDepartments}
          currentUser={mockAdminUser}
          onNewProduct={handleNew}
          onEditProduct={vi.fn()}
          onDeactivateProduct={vi.fn()}
          onReactivateProduct={vi.fn()}
          onOpenImportModal={vi.fn()}
          onRefreshData={vi.fn()}
        />
      );

      const newBtn = screen.getByRole('button', { name: /Nuevo Producto/i });
      await user.click(newBtn);
      expect(handleNew).toHaveBeenCalledTimes(1);
    });

    it('hides New Product button for Cajero lacking permission', () => {
      render(
        <ProductsView
          products={mockProducts}
          departments={mockDepartments}
          currentUser={mockCashierUser}
          onNewProduct={vi.fn()}
          onEditProduct={vi.fn()}
          onDeactivateProduct={vi.fn()}
          onReactivateProduct={vi.fn()}
          onOpenImportModal={vi.fn()}
          onRefreshData={vi.fn()}
        />
      );

      expect(screen.queryByRole('button', { name: /Nuevo Producto/i })).toBeNull();
    });

    it('filters products by search input', async () => {
      render(
        <ProductsView
          products={mockProducts}
          departments={mockDepartments}
          currentUser={mockAdminUser}
          onNewProduct={vi.fn()}
          onEditProduct={vi.fn()}
          onDeactivateProduct={vi.fn()}
          onReactivateProduct={vi.fn()}
          onOpenImportModal={vi.fn()}
          onRefreshData={vi.fn()}
        />
      );

      const searchInput = screen.getByPlaceholderText('Buscar SKU, barras o nombre...');
      fireEvent.change(searchInput, { target: { value: 'Queso' } });

      expect(screen.getAllByText('Queso Andino').length).toBeGreaterThanOrEqual(1);
      expect(screen.queryByText('Combo Parrillero')).toBeNull();
    });

    it('clicking on a product row triggers onEditProduct', async () => {
      const handleEdit = vi.fn();
      const user = userEvent.setup();

      render(
        <ProductsView
          products={mockProducts}
          departments={mockDepartments}
          currentUser={mockAdminUser}
          onNewProduct={vi.fn()}
          onEditProduct={handleEdit}
          onOpenImportModal={vi.fn()}
          onRefreshData={vi.fn()}
        />
      );

      const rows = screen.getAllByTitle('Editar producto');
      expect(rows.length).toBeGreaterThanOrEqual(1);
      await user.click(rows[0]);
      expect(handleEdit).toHaveBeenCalledWith(mockProducts[0]);
    });

    it('filters products when clicking on KPI cards (Total Catálogo, Venta Unitaria, A Granel / Peso, Kits / Combos)', async () => {
      const user = userEvent.setup();

      render(
        <ProductsView
          products={mockProducts}
          departments={mockDepartments}
          currentUser={mockAdminUser}
          onNewProduct={vi.fn()}
          onEditProduct={vi.fn()}
          onOpenImportModal={vi.fn()}
          onRefreshData={vi.fn()}
        />
      );

      // Initially all products are visible
      expect(screen.getAllByText('Gaseosa Cola 1.5L').length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText('Queso Andino').length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText('Combo Parrillero').length).toBeGreaterThanOrEqual(1);

      // Click "Venta Unitaria" KPI card
      const unitKpi = screen.getByTitle('Filtrar por productos de venta unitaria');
      await user.click(unitKpi);
      expect(screen.getAllByText('Gaseosa Cola 1.5L').length).toBeGreaterThanOrEqual(1);
      expect(screen.queryByText('Queso Andino')).toBeNull();
      expect(screen.queryByText('Combo Parrillero')).toBeNull();

      // Click "A Granel / Peso" KPI card
      const weightKpi = screen.getByTitle('Filtrar por productos a granel o peso');
      await user.click(weightKpi);
      expect(screen.getAllByText('Queso Andino').length).toBeGreaterThanOrEqual(1);
      expect(screen.queryByText('Gaseosa Cola 1.5L')).toBeNull();
      expect(screen.queryByText('Combo Parrillero')).toBeNull();

      // Click "Kits / Combos" KPI card
      const kitKpi = screen.getByTitle('Filtrar por kits y combos compuestos');
      await user.click(kitKpi);
      expect(screen.getAllByText('Combo Parrillero').length).toBeGreaterThanOrEqual(1);
      expect(screen.queryByText('Gaseosa Cola 1.5L')).toBeNull();
      expect(screen.queryByText('Queso Andino')).toBeNull();

      // Click "Total Catálogo" KPI card to reset
      const totalKpi = screen.getByTitle('Mostrar todos los productos registrados');
      await user.click(totalKpi);
      expect(screen.getAllByText('Gaseosa Cola 1.5L').length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText('Queso Andino').length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText('Combo Parrillero').length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('ProductFormModal Component (Unified Create & Edit)', () => {
    it('renders fields for creating a standard UNIT product and calls onSave', async () => {
      const handleSave = vi.fn().mockResolvedValue(undefined);
      const handleClose = vi.fn();
      const user = userEvent.setup();

      render(
        <ProductFormModal
          isOpen={true}
          onClose={handleClose}
          onSave={handleSave}
          initialProduct={null}
          departments={mockDepartments}
          availableComponentProducts={mockProducts}
        />
      );

      expect(screen.getByText('Nuevo Producto')).toBeDefined();

      const skuInput = screen.getByPlaceholderText('Ej. REF-001');
      await user.clear(skuInput);
      await user.type(skuInput, 'PROD-NEW');

      const nameInput = screen.getByPlaceholderText('Ej. Harina de Maíz Precocida 1kg');
      await user.type(nameInput, 'Galleta Salada');

      const priceInputs = screen.getAllByPlaceholderText('0.00');
      await user.type(priceInputs[1], '3.50');

      const submitBtn = screen.getByRole('button', { name: /Crear Producto/i });
      await user.click(submitBtn);

      await waitFor(() => {
        expect(handleSave).toHaveBeenCalledWith(
          expect.objectContaining({
            sku: 'PROD-NEW',
            name: 'Galleta Salada',
            salePrice: 3.5,
            saleType: 'UNIT',
          })
        );
      });
    });

    it('shows kit components section when saleType is KIT and rejects kit without components', async () => {
      const handleSave = vi.fn().mockResolvedValue(undefined);
      const user = userEvent.setup();

      render(
        <ProductFormModal
          isOpen={true}
          onClose={vi.fn()}
          onSave={handleSave}
          initialProduct={null}
          departments={mockDepartments}
          availableComponentProducts={mockProducts}
        />
      );

      // Select KIT sale type in select dropdown
      const saleTypeSelect = screen.getByDisplayValue('Unidad (Entera)');
      fireEvent.change(saleTypeSelect, { target: { value: 'KIT' } });

      // Verify invariant: components section visible
      expect(screen.getByText(/Componentes del Kit/i)).toBeDefined();

      const nameInput = screen.getByPlaceholderText('Ej. Harina de Maíz Precocida 1kg');
      await user.type(nameInput, 'Kit Sin Insumos');

      const priceInputs = screen.getAllByPlaceholderText('0.00');
      await user.type(priceInputs[1], '25.00');

      const submitBtn = screen.getByRole('button', { name: /Crear Producto/i });
      await user.click(submitBtn);

      // Error message should appear and save must not be called
      expect(screen.getByText(/debe tener al menos un componente/i)).toBeDefined();
      expect(handleSave).not.toHaveBeenCalled();
    });

    it('renders Desactivar Producto in bottom-left when editing active product and triggers onDeactivateProduct', async () => {
      const handleDeactivate = vi.fn().mockResolvedValue(undefined);
      const handleClose = vi.fn();
      const user = userEvent.setup();

      render(
        <ProductFormModal
          isOpen={true}
          onClose={handleClose}
          onSave={vi.fn()}
          initialProduct={mockProducts[0]}
          departments={mockDepartments}
          availableComponentProducts={mockProducts}
          onDeactivateProduct={handleDeactivate}
        />
      );

      const deactivateBtn = screen.getByRole('button', { name: /Desactivar Producto/i });
      expect(deactivateBtn).toBeDefined();
      await user.click(deactivateBtn);
      expect(handleDeactivate).toHaveBeenCalledWith(mockProducts[0]);
      expect(handleClose).toHaveBeenCalled();
    });

    it('manages Kit components with controlled height container, counter, edit quantity, remove and submit without limits', async () => {
      const handleSave = vi.fn().mockResolvedValue(undefined);
      const user = userEvent.setup();

      // Provide multiple mock component products so we can add >5 components
      const testAvailableProducts: Product[] = Array.from({ length: 8 }, (_, i) => ({
        id: `comp-prod-${i + 1}`,
        businessId: 'default',
        sku: `COMP-${i + 1}`,
        barcode: null,
        name: `Componente Insumo ${i + 1}`,
        description: null,
        departmentId: 'dept-1',
        saleType: 'UNIT',
        costPrice: 2.0,
        salePrice: 5.0,
        wholesalePrice: null,
        tracksInventory: true,
        defaultMinStock: 5,
        active: true,
      }));

      render(
        <ProductFormModal
          isOpen={true}
          onClose={vi.fn()}
          onSave={handleSave}
          initialProduct={null}
          departments={mockDepartments}
          availableComponentProducts={testAvailableProducts}
        />
      );

      // Select KIT sale type
      const saleTypeSelect = screen.getByDisplayValue('Unidad (Entera)');
      fireEvent.change(saleTypeSelect, { target: { value: 'KIT' } });

      // C. Invariant: Component list container has controlled max-height and discrete scroll styling
      const addBtn = screen.getByRole('button', { name: /Agregar Componente/i });
      expect(addBtn).toBeDefined();

      // Check initial counter: 0 componentes
      expect(screen.getByTestId('kit-components-count').textContent).toContain('0 componentes');

      // A & F: Add 6 components (> 5, proving no artificial limit)
      for (let i = 0; i < 6; i++) {
        await user.click(addBtn);
      }

      // Counter should display 6 componentes
      expect(screen.getByTestId('kit-components-count').textContent).toContain('6 componentes');

      // C. Verify list container has controlled max-height class (3 items max)
      const listContainer = screen.getByTestId('kit-components-list-container');
      expect(listContainer).toBeDefined();
      expect(listContainer.className).toContain('max-h-[160px]');
      expect(listContainer.className).toContain('overflow-y-auto');

      // E. Quantity is editable
      const quantityInputs = screen.getAllByPlaceholderText('1');
      expect(quantityInputs.length).toBe(6);
      await user.clear(quantityInputs[0]);
      await user.type(quantityInputs[0], '3.5');

      // D. Remove a component
      const deleteButtons = screen.getAllByTitle('Eliminar componente');
      expect(deleteButtons.length).toBe(6);
      await user.click(deleteButtons[5]); // Remove 6th

      // Counter updates to 5 componentes
      expect(screen.getByTestId('kit-components-count').textContent).toContain('5 componentes');

      // Fill basic required fields and submit
      const skuInput = screen.getByPlaceholderText('Ej. REF-001');
      await user.clear(skuInput);
      await user.type(skuInput, 'KIT-SUPER');

      const nameInput = screen.getByPlaceholderText('Ej. Harina de Maíz Precocida 1kg');
      await user.type(nameInput, 'Combo Megapack');

      const priceInputs = screen.getAllByPlaceholderText('0.00');
      await user.type(priceInputs[1], '50.00');

      const submitBtn = screen.getByRole('button', { name: /Crear Producto/i });
      await user.click(submitBtn);

      // B. All 5 components exist in the submitted payload with edited quantity
      await waitFor(() => {
        expect(handleSave).toHaveBeenCalledWith(
          expect.objectContaining({
            sku: 'KIT-SUPER',
            name: 'Combo Megapack',
            saleType: 'KIT',
            components: expect.arrayContaining([
              expect.objectContaining({
                componentProductId: 'comp-prod-1',
                quantity: 3.5,
              }),
            ]),
          })
        );
      });

      const calledPayload = handleSave.mock.calls[0][0];
      expect(calledPayload.components.length).toBe(5);
    });
  });

  describe('KitsView Component', () => {
    it('renders only KIT products and lists their components', () => {
      render(
        <KitsView
          products={mockProducts}
          currentUser={mockAdminUser}
          onNewKit={vi.fn()}
          onEditKit={vi.fn()}
          onDeactivateKit={vi.fn()}
          onReactivateKit={vi.fn()}
          onRefreshData={vi.fn()}
        />
      );

      expect(screen.getByText('Kits y Productos Compuestos')).toBeDefined();
      expect(screen.getAllByText('Combo Parrillero').length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText('KIT-001').length).toBeGreaterThanOrEqual(1);
      // Regular unit product should NOT be in the kit table
      expect(screen.queryByText('LAC-001')).toBeNull();
    });
  });

  describe('ImportProductsModal Component', () => {
    it('renders file upload dropzone and template download', () => {
      render(
        <ImportProductsModal
          isOpen={true}
          onClose={vi.fn()}
          onSuccess={vi.fn()}
        />
      );

      expect(screen.getByText('Importar Productos desde Excel')).toBeDefined();
      expect(screen.getByText(/Descargar Plantilla Excel/i)).toBeDefined();
      expect(screen.getByText(/Haz clic o arrastra tu archivo Excel aquí/i)).toBeDefined();
    });
  });

  describe('DepartmentsView, SuppliersView, LocationsView Components', () => {
    it('renders departments with count and allows editing', async () => {
      const handleEdit = vi.fn();
      const user = userEvent.setup();

      render(
        <DepartmentsView
          departments={mockDepartments}
          currentUser={mockAdminUser}
          onNewDepartment={vi.fn()}
          onEditDepartment={handleEdit}
          onDeactivateDepartment={vi.fn()}
          onReactivateDepartment={vi.fn()}
          onRefreshData={vi.fn()}
        />
      );

      expect(screen.getByText('Departamentos de Productos')).toBeDefined();
      expect(screen.getByText('Bebidas')).toBeDefined();
      expect(screen.getByText('Lácteos')).toBeDefined();

      const editBtns = screen.getAllByTitle('Editar departamento');
      await user.click(editBtns[0]);
      expect(handleEdit).toHaveBeenCalledWith(mockDepartments[0]);
    });

    it('renders suppliers directory', () => {
      render(
        <SuppliersView
          suppliers={mockSuppliers}
          currentUser={mockAdminUser}
          onNewSupplier={vi.fn()}
          onEditSupplier={vi.fn()}
          onDeactivateSupplier={vi.fn()}
          onReactivateSupplier={vi.fn()}
          onRefreshData={vi.fn()}
        />
      );

      expect(screen.getByText('Directorio de Proveedores')).toBeDefined();
      expect(screen.getByText('Distribuidora Lima S.A.C.')).toBeDefined();
      expect(screen.getByText('20123456789')).toBeDefined();
    });

    it('clicking on a supplier row triggers onEditSupplier', async () => {
      const handleEdit = vi.fn();
      const user = userEvent.setup();

      render(
        <SuppliersView
          suppliers={mockSuppliers}
          currentUser={mockAdminUser}
          onNewSupplier={vi.fn()}
          onEditSupplier={handleEdit}
          onDeactivateSupplier={vi.fn()}
          onReactivateSupplier={vi.fn()}
          onRefreshData={vi.fn()}
        />
      );

      const rows = screen.getAllByTitle('Clic para editar proveedor');
      expect(rows.length).toBeGreaterThanOrEqual(1);
      await user.click(rows[0]);
      expect(handleEdit).toHaveBeenCalledWith(mockSuppliers[0]);
    });

    it('renders Desactivar Proveedor in SupplierFormModal when editing active supplier', async () => {
      const handleDeactivate = vi.fn().mockResolvedValue(undefined);
      const handleClose = vi.fn();
      const user = userEvent.setup();

      render(
        <SupplierFormModal
          isOpen={true}
          onClose={handleClose}
          onSave={vi.fn()}
          initialSupplier={mockSuppliers[0]}
          onDeactivateSupplier={handleDeactivate}
        />
      );

      const deactivateBtn = screen.getByRole('button', { name: /Desactivar Proveedor/i });
      expect(deactivateBtn).toBeDefined();
      await user.click(deactivateBtn);
      expect(handleDeactivate).toHaveBeenCalledWith(mockSuppliers[0]);
      expect(handleClose).toHaveBeenCalled();
    });

    it('renders locations with badges', () => {
      render(
        <LocationsView
          locations={mockLocations}
          currentUser={mockAdminUser}
          onNewLocation={vi.fn()}
          onEditLocation={vi.fn()}
          onDeactivateLocation={vi.fn()}
          onReactivateLocation={vi.fn()}
          onRefreshData={vi.fn()}
        />
      );

      expect(screen.getByText('Tiendas y Almacenes')).toBeDefined();
      expect(screen.getByText('Tienda Principal')).toBeDefined();
      expect(screen.getByText('Almacén Central')).toBeDefined();
      expect(screen.getByText('TIENDA-01')).toBeDefined();
      expect(screen.getByText('ALMACEN-01')).toBeDefined();
    });

    it('clicking on a location row triggers onEditLocation', async () => {
      const handleEdit = vi.fn();
      const user = userEvent.setup();

      render(
        <LocationsView
          locations={mockLocations}
          currentUser={mockAdminUser}
          onNewLocation={vi.fn()}
          onEditLocation={handleEdit}
          onDeactivateLocation={vi.fn()}
          onReactivateLocation={vi.fn()}
          onRefreshData={vi.fn()}
        />
      );

      const rows = screen.getAllByTitle('Editar ubicación');
      expect(rows.length).toBeGreaterThanOrEqual(1);
      await user.click(rows[0]);
      expect(handleEdit).toHaveBeenCalledWith(mockLocations[0]);
    });

    it('renders Desactivar Departamento in DepartmentFormModal when editing active department', async () => {
      const handleDeactivate = vi.fn().mockResolvedValue(undefined);
      const handleClose = vi.fn();
      const user = userEvent.setup();

      render(
        <DepartmentFormModal
          isOpen={true}
          onClose={handleClose}
          onSave={vi.fn()}
          initialDepartment={mockDepartments[0]}
          onDeactivateDepartment={handleDeactivate}
        />
      );

      const deactivateBtn = screen.getByRole('button', { name: /Desactivar Departamento/i });
      expect(deactivateBtn).toBeDefined();
      await user.click(deactivateBtn);
      expect(handleDeactivate).toHaveBeenCalledWith(mockDepartments[0]);
      expect(handleClose).toHaveBeenCalled();
    });

    it('renders Desactivar Ubicación in LocationFormModal when editing active location', async () => {
      const handleDeactivate = vi.fn().mockResolvedValue(undefined);
      const handleClose = vi.fn();
      const user = userEvent.setup();

      render(
        <LocationFormModal
          isOpen={true}
          onClose={handleClose}
          onSave={vi.fn()}
          initialLocation={mockLocations[0]}
          onDeactivateLocation={handleDeactivate}
        />
      );

      const deactivateBtn = screen.getByRole('button', { name: /Desactivar Ubicación/i });
      expect(deactivateBtn).toBeDefined();
      await user.click(deactivateBtn);
      expect(handleDeactivate).toHaveBeenCalledWith(mockLocations[0]);
      expect(handleClose).toHaveBeenCalled();
    });
  });
});
