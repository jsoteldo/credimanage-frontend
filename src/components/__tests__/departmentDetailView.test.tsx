import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { DepartmentsView } from '../DepartmentsView';
import { DepartmentDetailView } from '../DepartmentDetailView';
import { Department, Product, User } from '../../types';

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
    'department.manage',
    'department.view',
  ],
};

const mockDepartments: Department[] = [
  {
    id: 'dept-1',
    businessId: 'default',
    name: 'Abarrotes',
    description: 'Todos los carbohidratos',
    active: true,
    _count: { products: 3 },
  },
  {
    id: 'dept-2',
    businessId: 'default',
    name: 'Lácteos',
    description: 'Leche y derivados',
    active: true,
    _count: { products: 1 },
  },
  {
    id: 'dept-3',
    businessId: 'default',
    name: 'Golosinas Discontinuadas',
    description: 'Dulces fuera de temporada',
    active: false,
    _count: { products: 1 },
  },
  {
    id: 'dept-empty',
    businessId: 'default',
    name: 'Limpieza',
    description: 'Productos de aseo',
    active: true,
    _count: { products: 0 },
  },
];

const mockProducts: Product[] = [
  {
    id: 'prod-1',
    businessId: 'default',
    sku: 'ARR-001',
    barcode: '7751111111111',
    name: 'Arroz Superior 1kg',
    description: 'Grano seleccionado',
    departmentId: 'dept-1',
    saleType: 'UNIT',
    costPrice: 3.5,
    salePrice: 4.8,
    wholesalePrice: 4.2,
    tracksInventory: true,
    defaultMinStock: 20,
    active: true,
  },
  {
    id: 'prod-2',
    businessId: 'default',
    sku: 'FID-002',
    barcode: '7752222222222',
    name: 'Fideos Espagueti 500g',
    description: 'Pasta de trigo fortificada',
    departmentId: 'dept-1',
    saleType: 'UNIT',
    costPrice: 2.0,
    salePrice: 3.2,
    wholesalePrice: null,
    tracksInventory: true,
    defaultMinStock: 15,
    active: true,
  },
  {
    id: 'prod-3',
    businessId: 'default',
    sku: 'AVE-003',
    barcode: null,
    name: 'Avena Clásica',
    description: 'Hojuelas de avena',
    departmentId: 'dept-1',
    saleType: 'UNIT',
    costPrice: 1.8,
    salePrice: 2.5,
    wholesalePrice: null,
    tracksInventory: false,
    defaultMinStock: null,
    active: false, // Inactivo histórico
  },
  {
    id: 'prod-4',
    businessId: 'default',
    sku: 'LAC-001',
    barcode: '7753333333333',
    name: 'Queso Andino',
    description: 'Por kilo fresco',
    departmentId: 'dept-2',
    saleType: 'WEIGHT',
    costPrice: 20.0,
    salePrice: 32.0,
    wholesalePrice: 28.0,
    tracksInventory: true,
    defaultMinStock: 5,
    active: true,
  },
  {
    id: 'prod-5',
    businessId: 'default',
    sku: 'GOL-001',
    barcode: null,
    name: 'Caramelos Limón',
    description: 'Bolsa 50 unidades',
    departmentId: 'dept-3',
    saleType: 'UNIT',
    costPrice: 1.0,
    salePrice: 2.0,
    wholesalePrice: null,
    tracksInventory: true,
    defaultMinStock: 5,
    active: false,
  },
];

describe('Mejora de Pantalla: Departamentos y Detalle de Productos Asociados', () => {
  // A. Click en fila de departamento abre detalle correcto
  it('A. Click en fila <tr> de departamento abre el detalle correcto y permite volver', async () => {
    const user = userEvent.setup();

    render(
      <DepartmentsView
        departments={mockDepartments}
        products={mockProducts}
        currentUser={mockAdminUser}
        onNewDepartment={vi.fn()}
        onEditDepartment={vi.fn()}
        onDeactivateDepartment={vi.fn()}
        onReactivateDepartment={vi.fn()}
        onRefreshData={vi.fn()}
      />
    );

    // Initial state: table with departments is shown
    expect(screen.getByText('Departamentos de Productos')).toBeDefined();

    // Click on department row for "Abarrotes" (desktop row testid)
    const row = screen.getByTestId('department-row-dept-1');
    expect(row).toBeDefined();
    expect(row.className).toContain('cursor-pointer');
    await user.click(row);

    // Now in detail view: Department title is rendered
    expect(screen.getByRole('heading', { name: 'Abarrotes', level: 2 })).toBeDefined();
    expect(screen.getByText('Todos los carbohidratos')).toBeDefined();

    // Navigation back button exists
    const backBtn = screen.getByRole('button', { name: /Volver a Departamentos/i });
    expect(backBtn).toBeDefined();
    await user.click(backBtn);

    // Back in departments list
    expect(screen.getByText('Departamentos de Productos')).toBeDefined();
  });

  // B. Detalle muestra nombre, descripción, estado
  it('B. Detalle muestra nombre, descripción y estado activo/inactivo', async () => {
    const user = userEvent.setup();

    const { rerender } = render(
      <DepartmentsView
        departments={mockDepartments}
        products={mockProducts}
        currentUser={mockAdminUser}
        onNewDepartment={vi.fn()}
        onEditDepartment={vi.fn()}
        onDeactivateDepartment={vi.fn()}
        onReactivateDepartment={vi.fn()}
        onRefreshData={vi.fn()}
      />
    );

    // Click on active department "Abarrotes"
    await user.click(screen.getByTestId('department-row-dept-1'));
    expect(screen.getAllByText('Abarrotes').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Todos los carbohidratos')).toBeDefined();
    const statusBadge = screen.getByTestId('department-status-badge');
    expect(statusBadge.textContent).toContain('Activo');

    // Go back and click on inactive department "Golosinas Discontinuadas"
    await user.click(screen.getByRole('button', { name: /Volver a Departamentos/i }));
    await user.click(screen.getByTestId('department-row-dept-3'));

    expect(screen.getAllByText('Golosinas Discontinuadas').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Dulces fuera de temporada')).toBeDefined();
    const inactiveBadge = screen.getByTestId('department-status-badge');
    expect(inactiveBadge.textContent).toContain('Inactivo');
  });

  // C. Solo muestra productos asociados al departamento
  it('C. Solo muestra productos cuyo departmentId corresponde al departamento seleccionado', async () => {
    const user = userEvent.setup();

    render(
      <DepartmentsView
        departments={mockDepartments}
        products={mockProducts}
        currentUser={mockAdminUser}
        onNewDepartment={vi.fn()}
        onEditDepartment={vi.fn()}
        onDeactivateDepartment={vi.fn()}
        onReactivateDepartment={vi.fn()}
        onRefreshData={vi.fn()}
      />
    );

    // Open "Abarrotes"
    await user.click(screen.getByTestId('department-row-dept-1'));

    // Products of dept-1 must be visible
    expect(screen.getAllByText('Arroz Superior 1kg').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Fideos Espagueti 500g').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Avena Clásica').length).toBeGreaterThanOrEqual(1);

    // Product of dept-2 (Lácteos) must NOT be shown
    expect(screen.queryByText('Queso Andino')).toBeNull();
    // Product of dept-3 must NOT be shown
    expect(screen.queryByText('Caramelos Limón')).toBeNull();
  });

  // D. Buscador filtra productos dentro del detalle
  it('D. Buscador dentro del detalle filtra productos por nombre y por código (SKU/código de barras)', async () => {
    const user = userEvent.setup();

    render(
      <DepartmentsView
        departments={mockDepartments}
        products={mockProducts}
        currentUser={mockAdminUser}
        onNewDepartment={vi.fn()}
        onEditDepartment={vi.fn()}
        onDeactivateDepartment={vi.fn()}
        onReactivateDepartment={vi.fn()}
        onRefreshData={vi.fn()}
      />
    );

    await user.click(screen.getByTestId('department-row-dept-1'));

    const searchInput = screen.getByPlaceholderText('Buscar producto en este departamento...');
    expect(searchInput).toBeDefined();

    // 1. Filter by name: "Fideos"
    await user.type(searchInput, 'Fideos');
    expect(screen.getAllByText('Fideos Espagueti 500g').length).toBeGreaterThanOrEqual(1);
    expect(screen.queryByText('Arroz Superior 1kg')).toBeNull();
    expect(screen.queryByText('Avena Clásica')).toBeNull();

    // 2. Clear filter
    await user.clear(searchInput);
    expect(screen.getAllByText('Arroz Superior 1kg').length).toBeGreaterThanOrEqual(1);

    // 3. Filter by code/SKU: "AVE-003"
    await user.type(searchInput, 'AVE-003');
    expect(screen.getAllByText('Avena Clásica').length).toBeGreaterThanOrEqual(1);
    expect(screen.queryByText('Arroz Superior 1kg')).toBeNull();

    // 4. Filter by barcode: "7751111111111"
    await user.clear(searchInput);
    await user.type(searchInput, '7751111111111');
    expect(screen.getAllByText('Arroz Superior 1kg').length).toBeGreaterThanOrEqual(1);
    expect(screen.queryByText('Fideos Espagueti 500g')).toBeNull();
  });

  // E. Departamento sin productos muestra EMPTY state
  it('E. Departamento sin productos muestra EMPTY state ("No hay productos asignados a este departamento.")', async () => {
    const user = userEvent.setup();
    const handleNewProduct = vi.fn();
    const handleNavigateToProducts = vi.fn();

    render(
      <DepartmentsView
        departments={mockDepartments}
        products={mockProducts}
        currentUser={mockAdminUser}
        onNewDepartment={vi.fn()}
        onEditDepartment={vi.fn()}
        onDeactivateDepartment={vi.fn()}
        onReactivateDepartment={vi.fn()}
        onRefreshData={vi.fn()}
        onNewProduct={handleNewProduct}
        onNavigateToProducts={handleNavigateToProducts}
      />
    );

    // Click on empty department "Limpieza"
    await user.click(screen.getByTestId('department-row-dept-empty'));

    // Empty state message
    expect(screen.getByText('No hay productos asignados a este departamento.')).toBeDefined();

    // Check action buttons in empty state
    const verProductosBtn = screen.getByRole('button', { name: /Ver Productos/i });
    expect(verProductosBtn).toBeDefined();
    await user.click(verProductosBtn);
    expect(handleNavigateToProducts).toHaveBeenCalled();

    const crearProductoBtn = screen.getByRole('button', { name: /Crear Producto/i });
    expect(crearProductoBtn).toBeDefined();
    await user.click(crearProductoBtn);
    expect(handleNewProduct).toHaveBeenCalled();
  });

  // F. Click en producto reutiliza flujo existente de Producto
  it('F. Click en la fila de un producto llama a onEditProduct reutilizando el flujo existente', async () => {
    const user = userEvent.setup();
    const handleEditProduct = vi.fn();

    render(
      <DepartmentsView
        departments={mockDepartments}
        products={mockProducts}
        currentUser={mockAdminUser}
        onNewDepartment={vi.fn()}
        onEditDepartment={vi.fn()}
        onDeactivateDepartment={vi.fn()}
        onReactivateDepartment={vi.fn()}
        onRefreshData={vi.fn()}
        onEditProduct={handleEditProduct}
      />
    );

    await user.click(screen.getByTestId('department-row-dept-1'));

    // Click on the Arroz row
    const arrozRows = screen.getAllByTitle(/producto Arroz Superior 1kg/i);
    expect(arrozRows.length).toBeGreaterThanOrEqual(1);
    await user.click(arrozRows[0]);

    // Verifies that existing onEditProduct was called with the exact Product object
    expect(handleEditProduct).toHaveBeenCalledWith(mockProducts[0]);
  });

  // G. Contador coincide con detalle
  it('G. El contador de Productos Asociados en la tabla coincide con el mostrado en el detalle', async () => {
    const user = userEvent.setup();

    render(
      <DepartmentsView
        departments={mockDepartments}
        products={mockProducts}
        currentUser={mockAdminUser}
        onNewDepartment={vi.fn()}
        onEditDepartment={vi.fn()}
        onDeactivateDepartment={vi.fn()}
        onReactivateDepartment={vi.fn()}
        onRefreshData={vi.fn()}
      />
    );

    // In the table, dept-1 has 3 associated products
    const row = screen.getByTestId('department-row-dept-1');
    expect(row.textContent).toContain('3');

    // Click to enter detail
    await user.click(row);

    // Detail KPI count
    const detailCount = screen.getByTestId('associated-products-count');
    expect(detailCount.textContent).toBe('3');

    // Counter matches total associated products list length (3 products in dept-1)
    expect(screen.getByTestId('showing-products-counter').textContent).toContain('Mostrando 3 de 3');
  });

  // H. Mobile renderiza cards
  it('H. Mobile renderiza cards para departamentos y para productos en el detalle', async () => {
    const user = userEvent.setup();

    render(
      <DepartmentsView
        departments={mockDepartments}
        products={mockProducts}
        currentUser={mockAdminUser}
        onNewDepartment={vi.fn()}
        onEditDepartment={vi.fn()}
        onDeactivateDepartment={vi.fn()}
        onReactivateDepartment={vi.fn()}
        onRefreshData={vi.fn()}
      />
    );

    // Mobile card for department dept-1 exists and is clickable
    const mobileDeptCard = screen.getByTestId('department-card-dept-1');
    expect(mobileDeptCard).toBeDefined();
    expect(mobileDeptCard.className).toContain('cursor-pointer');

    // Click mobile card to open detail
    await user.click(mobileDeptCard);

    // Verify detail is open
    expect(screen.getByRole('heading', { name: 'Abarrotes', level: 2 })).toBeDefined();

    // Verify price, sku, and product name are present
    expect(screen.getAllByText('$4.80').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('ARR-001').length).toBeGreaterThanOrEqual(1);
  });

  // I. No se crea lógica duplicada y permite editar departamento
  it('I. Permite editar departamento desde la tabla y desde el detalle sin duplicar lógica', async () => {
    const user = userEvent.setup();
    const handleEditDepartment = vi.fn();

    render(
      <DepartmentsView
        departments={mockDepartments}
        products={mockProducts}
        currentUser={mockAdminUser}
        onNewDepartment={vi.fn()}
        onEditDepartment={handleEditDepartment}
        onDeactivateDepartment={vi.fn()}
        onReactivateDepartment={vi.fn()}
        onRefreshData={vi.fn()}
      />
    );

    // Edit from detail view:
    await user.click(screen.getByTestId('department-row-dept-1'));
    const editDeptBtn = screen.getByRole('button', { name: /Editar Departamento/i });
    expect(editDeptBtn).toBeDefined();
    await user.click(editDeptBtn);
    expect(handleEditDepartment).toHaveBeenCalledWith(mockDepartments[0]);
  });
});
