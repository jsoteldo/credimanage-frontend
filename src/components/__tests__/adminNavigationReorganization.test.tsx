import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { Sidebar } from '../Sidebar';
import { User, CurrentView } from '../../types';

const mockAdminUser: User = {
  id: 'u-admin-1',
  name: 'Admin Test',
  email: 'admin@test.com',
  role: 'Administrador',
  active: true,
  permissions: ['admin.manage'],
};

const mockCashierUser: User = {
  id: 'u-cashier-1',
  name: 'Cajero Test',
  email: 'cashier@test.com',
  role: 'Cajero',
  active: true,
  permissions: ['sales.view'],
};

describe('Reorganización de Navegación: Área de Administración / Configuración', () => {
  // A. Click Administración expande submenu
  it('A. Click en Administración expande el submenú mostrando las subopciones', async () => {
    const user = userEvent.setup();
    render(
      <Sidebar
        currentView="clients"
        setCurrentView={vi.fn()}
        user={mockAdminUser}
        onLogout={vi.fn()}
        onExportData={vi.fn()}
        onOpenLogin={vi.fn()}
      />
    );

    const adminBtn = screen.getByTestId('sidebar-admin-group-btn');
    expect(adminBtn).toBeDefined();

    // Initially collapsed since currentView is 'clients'
    const submenu = screen.getByTestId('sidebar-admin-submenu');
    expect(submenu.className).toContain('max-h-0');

    // Click to expand
    await user.click(adminBtn);

    // Now expanded
    expect(submenu.className).toContain('max-h-96');
    expect(screen.getByText('Bitácora de Auditoría')).toBeDefined();
    expect(screen.getByText('Usuarios del Sistema y Permisos')).toBeDefined();
    expect(screen.getByText('Aprobación de Abonos')).toBeDefined();
    expect(screen.getByText('Operaciones Anuladas')).toBeDefined();
    expect(screen.getByText('Consultas de Deuda & Saldos a Favor')).toBeDefined();
    expect(screen.getByText('Recordatorio de Cobranza')).toBeDefined();
    expect(screen.getByText('Configuración de Boleta')).toBeDefined();
  });

  // B. Segundo click colapsa
  it('B. Segundo click en Administración colapsa el submenú', async () => {
    const user = userEvent.setup();
    render(
      <Sidebar
        currentView="clients"
        setCurrentView={vi.fn()}
        user={mockAdminUser}
        onLogout={vi.fn()}
        onExportData={vi.fn()}
        onOpenLogin={vi.fn()}
      />
    );

    const adminBtn = screen.getByTestId('sidebar-admin-group-btn');
    const submenu = screen.getByTestId('sidebar-admin-submenu');

    // 1st click: expand
    await user.click(adminBtn);
    expect(submenu.className).toContain('max-h-96');

    // 2nd click: collapse
    await user.click(adminBtn);
    expect(submenu.className).toContain('max-h-0');
  });

  // C. Configuración Boleta aparece dentro
  it('C. Configuración de Boleta aparece dentro del grupo Administración', async () => {
    const user = userEvent.setup();
    render(
      <Sidebar
        currentView="clients"
        setCurrentView={vi.fn()}
        user={mockAdminUser}
        onLogout={vi.fn()}
        onExportData={vi.fn()}
        onOpenLogin={vi.fn()}
      />
    );

    await user.click(screen.getByTestId('sidebar-admin-group-btn'));

    const receiptSubItem = screen.getByTestId('sidebar-admin-sub-receipt-config');
    expect(receiptSubItem).toBeDefined();
    expect(receiptSubItem.textContent).toContain('Configuración de Boleta');
  });

  // D. Recordatorio Cobranza aparece dentro
  it('D. Recordatorio de Cobranza aparece dentro del grupo Administración', async () => {
    const user = userEvent.setup();
    render(
      <Sidebar
        currentView="clients"
        setCurrentView={vi.fn()}
        user={mockAdminUser}
        onLogout={vi.fn()}
        onExportData={vi.fn()}
        onOpenLogin={vi.fn()}
      />
    );

    await user.click(screen.getByTestId('sidebar-admin-group-btn'));

    const reminderSubItem = screen.getByTestId('sidebar-admin-sub-messages');
    expect(reminderSubItem).toBeDefined();
    expect(reminderSubItem.textContent).toContain('Recordatorio de Cobranza');
  });

  // E. Opciones ya no aparecen duplicadas en nivel principal
  it('E. Configuración Boleta y Recordatorio WhatsApp ya no aparecen duplicadas en el nivel principal del sidebar', () => {
    render(
      <Sidebar
        currentView="clients"
        setCurrentView={vi.fn()}
        user={mockAdminUser}
        onLogout={vi.fn()}
        onExportData={vi.fn()}
        onOpenLogin={vi.fn()}
      />
    );

    // Submenu is collapsed, so neither should be visible in main navigation list
    expect(screen.queryByText('Configuración Boleta')).toBeNull();
    expect(screen.queryByText('Recordatorio WhatsApp')).toBeNull();
  });

  // F. Click en cada subopción abre vista existente
  it('F. Click en cada subopción invoca la vista/tab correspondiente reutilizando rutas existentes', async () => {
    const user = userEvent.setup();
    const handleSetCurrentView = vi.fn();
    const handleSelectAdminTab = vi.fn();

    render(
      <Sidebar
        currentView="admin"
        setCurrentView={handleSetCurrentView}
        adminTab="audit"
        onSelectAdminTab={handleSelectAdminTab}
        user={mockAdminUser}
        onLogout={vi.fn()}
        onExportData={vi.fn()}
        onOpenLogin={vi.fn()}
      />
    );

    // 1. Click on Usuarios
    await user.click(screen.getByTestId('sidebar-admin-sub-users'));
    expect(handleSelectAdminTab).toHaveBeenCalledWith('users');

    // 2. Click on Aprobación de Abonos
    await user.click(screen.getByTestId('sidebar-admin-sub-pending_payments'));
    expect(handleSelectAdminTab).toHaveBeenCalledWith('pending_payments');

    // 3. Click on Operaciones Anuladas
    await user.click(screen.getByTestId('sidebar-admin-sub-annulled'));
    expect(handleSelectAdminTab).toHaveBeenCalledWith('annulled');

    // 4. Click on Consultas de Deuda
    await user.click(screen.getByTestId('sidebar-admin-sub-portfolio'));
    expect(handleSelectAdminTab).toHaveBeenCalledWith('portfolio');

    // 5. Click on Recordatorio de Cobranza
    await user.click(screen.getByTestId('sidebar-admin-sub-messages'));
    expect(handleSelectAdminTab).toHaveBeenCalledWith('messages');

    // 6. Click on Configuración de Boleta
    await user.click(screen.getByTestId('sidebar-admin-sub-receipt-config'));
    expect(handleSetCurrentView).toHaveBeenCalledWith('receipt-config');
  });

  // G. Ruta interna mantiene Administración expandido
  it('G. Cuando el usuario está en una ruta de Administración, el grupo permanece expandido automáticamente', () => {
    const { rerender } = render(
      <Sidebar
        currentView="admin"
        setCurrentView={vi.fn()}
        adminTab="users"
        user={mockAdminUser}
        onLogout={vi.fn()}
        onExportData={vi.fn()}
        onOpenLogin={vi.fn()}
      />
    );

    // On /admin, it is automatically expanded
    let submenu = screen.getByTestId('sidebar-admin-submenu');
    expect(submenu.className).toContain('max-h-96');

    // On /receipt-config, it also stays expanded
    rerender(
      <Sidebar
        currentView="receipt-config"
        setCurrentView={vi.fn()}
        user={mockAdminUser}
        onLogout={vi.fn()}
        onExportData={vi.fn()}
        onOpenLogin={vi.fn()}
      />
    );

    submenu = screen.getByTestId('sidebar-admin-submenu');
    expect(submenu.className).toContain('max-h-96');
  });

  // H. Subopción activa se resalta
  it('H. La subopción activa se resalta individualmente y el grupo muestra estado activo', () => {
    render(
      <Sidebar
        currentView="admin"
        setCurrentView={vi.fn()}
        adminTab="users"
        user={mockAdminUser}
        onLogout={vi.fn()}
        onExportData={vi.fn()}
        onOpenLogin={vi.fn()}
      />
    );

    // Active sub-item (users) has indigo background
    const activeSub = screen.getByTestId('sidebar-admin-sub-users');
    expect(activeSub.className).toContain('bg-indigo-600');
    expect(activeSub.className).toContain('text-white');

    // Inactive sub-item (audit) does NOT have solid active background
    const inactiveSub = screen.getByTestId('sidebar-admin-sub-audit');
    expect(inactiveSub.className).not.toContain('bg-indigo-600 text-white');

    // Parent Administration button indicates active group
    const parentBtn = screen.getByTestId('sidebar-admin-group-btn');
    expect(parentBtn.className).toContain('bg-indigo-50/80');
  });

  // I. Permisos siguen aplicándose
  it('I. Permisos: usuario Cajero no tiene acceso ni visualización del grupo Administración', () => {
    render(
      <Sidebar
        currentView="sales"
        setCurrentView={vi.fn()}
        user={mockCashierUser}
        onLogout={vi.fn()}
        onExportData={vi.fn()}
        onOpenLogin={vi.fn()}
      />
    );

    // Neither the Administration group nor any of its sub-items are rendered for Cajero
    expect(screen.queryByTestId('sidebar-admin-group-btn')).toBeNull();
    expect(screen.queryByText('Administración')).toBeNull();
    expect(screen.queryByText('Bitácora de Auditoría')).toBeNull();
    expect(screen.queryByText('Configuración de Boleta')).toBeNull();
  });

  // J. Mobile funciona
  it('J. En menú móvil, Administración es expandible y permite navegar cerrando el drawer', async () => {
    const user = userEvent.setup();
    const handleCloseMobile = vi.fn();
    const handleSelectAdminTab = vi.fn();

    render(
      <Sidebar
        currentView="dashboard"
        setCurrentView={vi.fn()}
        user={mockAdminUser}
        onLogout={vi.fn()}
        onExportData={vi.fn()}
        onOpenLogin={vi.fn()}
        isMobileOpen={true}
        onCloseMobile={handleCloseMobile}
        onSelectAdminTab={handleSelectAdminTab}
      />
    );

    // Mobile admin button is rendered
    const mobileAdminBtn = screen.getByTestId('mobile-admin-group-btn');
    expect(mobileAdminBtn).toBeDefined();

    // Click to expand in mobile
    await user.click(mobileAdminBtn);

    const mobileSubmenu = screen.getByTestId('mobile-admin-submenu');
    expect(mobileSubmenu.className).toContain('max-h-96');

    // Click sub-item in mobile
    const mobileAuditBtn = screen.getByTestId('mobile-admin-sub-audit');
    expect(mobileAuditBtn).toBeDefined();
    await user.click(mobileAuditBtn);

    expect(handleSelectAdminTab).toHaveBeenCalledWith('audit');
    expect(handleCloseMobile).toHaveBeenCalled();
  });
});
