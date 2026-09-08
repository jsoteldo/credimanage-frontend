import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { ProductsView } from '../ProductsView';
import { ProductFormModal } from '../ProductFormModal';
import { KitsView } from '../KitsView';
import { ImportProductsModal } from '../ImportProductsModal';
import { DepartmentsView } from '../DepartmentsView';
import { SuppliersView } from '../SuppliersView';
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

      const newBtn = screen.getByRole('button', { name: /\+ Nuevo Producto/i });
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

      expect(screen.queryByRole('button', { name: /\+ Nuevo Producto/i })).toBeNull();
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
  });
});
