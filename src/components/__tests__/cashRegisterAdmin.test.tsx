import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { StoreCashRegistersTab } from '../cash/StoreCashRegistersTab';
import { CashRegisterFormModal } from '../cash/CashRegisterFormModal';
import { OpenCashModal } from '../cash/OpenCashModal';
import { LocationFormModal } from '../LocationFormModal';
import { Location, User, CashRegister } from '../../types';
import { api } from '../../services/api';

vi.mock('../../services/api', () => ({
  api: {
    getCashRegisters: vi.fn(),
    createCashRegister: vi.fn(),
    updateCashRegister: vi.fn(),
    openCashSession: vi.fn(),
  },
}));

const mockStore: Location = {
  id: 'store-centro',
  businessId: 'default',
  name: 'Tienda Centro',
  code: 'TC01',
  type: 'STORE',
  active: true,
};

const mockStoreChorrillos: Location = {
  id: 'store-chorrillos',
  businessId: 'default',
  name: 'Tienda Chorrillos',
  code: 'CHO1',
  type: 'STORE',
  active: true,
};

const mockAdminUser: User = {
  id: 'usr-admin',
  name: 'Admin User',
  email: 'admin@credimanage.com',
  role: 'Administrador',
  active: true,
  permissions: ['cash.manage', 'location.manage', 'location.view'],
};

const mockCajeroUser: User = {
  id: 'usr-cajero',
  name: 'Cajero User',
  email: 'cajero@credimanage.com',
  role: 'Cajero',
  active: true,
  permissions: ['sales.create', 'sales.view', 'location.view'],
};

describe('Configuración y Administración de Cajas (CashRegister Tests A a J)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // A. Administrador crea una caja activa
  it('A. Administrador crea una caja activa exitosamente', async () => {
    (api.getCashRegisters as any).mockResolvedValue([]);
    (api.createCashRegister as any).mockResolvedValue({
      id: 'reg-01',
      storeId: 'store-centro',
      code: 'CAJA-01',
      name: 'Caja Principal',
      status: 'ACTIVE',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    render(<StoreCashRegistersTab store={mockStore} currentUser={mockAdminUser} />);

    // Click "+ Nueva Caja" button
    const newBtn = (await screen.findAllByRole('button', { name: /Nueva Caja/i }))[0];
    fireEvent.click(newBtn);

    // Form modal opens
    expect(screen.getByRole('heading', { name: 'Nueva Caja' })).toBeInTheDocument();
    expect(screen.getByDisplayValue(/Tienda Centro/i)).toBeDisabled(); // Preselected & read-only

    // Fill form
    const codeInput = screen.getByPlaceholderText('Ej. CAJA-01');
    const nameInput = screen.getByPlaceholderText(/Caja Principal/i);

    fireEvent.change(codeInput, { target: { value: 'caja-01' } }); // should uppercase
    fireEvent.change(nameInput, { target: { value: 'Caja Principal' } });

    const submitBtn = screen.getByRole('button', { name: /Crear Caja/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(api.createCashRegister).toHaveBeenCalledWith({
        storeId: 'store-centro',
        code: 'CAJA-01',
        name: 'Caja Principal',
        status: 'ACTIVE',
      });
    });
  });

  // B. Caja aparece en Apertura de Turno
  it('B. Caja activa aparece en selector de Apertura de Turno', async () => {
    (api.getCashRegisters as any).mockResolvedValue([
      {
        id: 'reg-01',
        storeId: 'store-centro',
        code: 'CAJA-01',
        name: 'Caja Principal',
        status: 'ACTIVE',
      },
    ]);

    render(
      <OpenCashModal
        isOpen={true}
        onClose={vi.fn()}
        onSuccess={vi.fn()}
        currentUser={mockAdminUser}
        stores={[mockStore]}
        initialStoreId="store-centro"
      />,
    );

    await waitFor(() => {
      expect(screen.getByText('Caja Principal (CAJA-01)')).toBeInTheDocument();
    });
  });

  // C. Caja inactiva no aparece
  it('C. Caja inactiva no aparece como opción en Apertura de Turno', async () => {
    (api.getCashRegisters as any).mockResolvedValue([
      {
        id: 'reg-inactiva',
        storeId: 'store-centro',
        code: 'CAJA-02',
        name: 'Caja Inactiva',
        status: 'INACTIVE',
      },
    ]);

    render(
      <OpenCashModal
        isOpen={true}
        onClose={vi.fn()}
        onSuccess={vi.fn()}
        currentUser={mockAdminUser}
        stores={[mockStore]}
        initialStoreId="store-centro"
      />,
    );

    await waitFor(() => {
      // Must not show inactive register as option
      expect(screen.queryByText('Caja Inactiva (CAJA-02)')).not.toBeInTheDocument();
      // Must show message
      expect(
        screen.getByText('No hay cajas activas configuradas para esta tienda.'),
      ).toBeInTheDocument();
    });
  });

  // D. Cajero no puede crear caja
  it('D. Cajero no puede crear ni configurar cajas (botones restringidos)', async () => {
    (api.getCashRegisters as any).mockResolvedValue([
      {
        id: 'reg-01',
        storeId: 'store-centro',
        code: 'CAJA-01',
        name: 'Caja Principal',
        status: 'ACTIVE',
      },
    ]);

    render(<StoreCashRegistersTab store={mockStore} currentUser={mockCajeroUser} />);

    await waitFor(() => {
      expect(screen.getAllByText('Caja Principal').length).toBeGreaterThan(0);
    });

    // Cajero should NOT see "+ Nueva Caja", "Editar", or "Desactivar"
    expect(screen.queryByRole('button', { name: /Nueva Caja/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Editar/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Desactivar/i })).not.toBeInTheDocument();
  });

  // E. Código duplicado en misma tienda rechazado
  it('E. Código duplicado en misma tienda es rechazado con mensaje de error', async () => {
    (api.getCashRegisters as any).mockResolvedValue([
      {
        id: 'reg-01',
        storeId: 'store-centro',
        code: 'CAJA-01',
        name: 'Caja Principal',
        status: 'ACTIVE',
      },
    ]);
    (api.createCashRegister as any).mockRejectedValue(
      new Error('Ya existe una caja con el código "CAJA-01" en esta tienda'),
    );

    render(<StoreCashRegistersTab store={mockStore} currentUser={mockAdminUser} />);

    const newBtn = (await screen.findAllByRole('button', { name: /Nueva Caja/i }))[0];
    fireEvent.click(newBtn);

    const codeInput = screen.getByPlaceholderText('Ej. CAJA-01');
    const nameInput = screen.getByPlaceholderText(/Caja Principal/i);

    fireEvent.change(codeInput, { target: { value: 'CAJA-01' } });
    fireEvent.change(nameInput, { target: { value: 'Caja Duplicada' } });

    const submitBtn = screen.getByRole('button', { name: /Crear Caja/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(
        screen.getByText(/Ya existe una caja con el código "CAJA-01" en esta tienda/i),
      ).toBeInTheDocument();
    });
  });

  // F. Mismo código en tienda distinta permitido
  it('F. Mismo código en tienda distinta es permitido (multi-tienda)', async () => {
    (api.createCashRegister as any).mockResolvedValue({
      id: 'reg-cho-01',
      storeId: 'store-chorrillos',
      code: 'CAJA-01',
      name: 'Caja Chorrillos',
      status: 'ACTIVE',
    });

    const onSave = vi.fn(async (data) => {
      await api.createCashRegister({ ...data, storeId: 'store-chorrillos' });
    });

    render(
      <CashRegisterFormModal
        isOpen={true}
        onClose={vi.fn()}
        store={mockStoreChorrillos}
        onSave={onSave}
      />,
    );

    const codeInput = screen.getByPlaceholderText('Ej. CAJA-01');
    const nameInput = screen.getByPlaceholderText(/Caja Principal/i);

    fireEvent.change(codeInput, { target: { value: 'CAJA-01' } });
    fireEvent.change(nameInput, { target: { value: 'Caja Chorrillos' } });

    const submitBtn = screen.getByRole('button', { name: /Crear Caja/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(api.createCashRegister).toHaveBeenCalledWith(
        expect.objectContaining({
          storeId: 'store-chorrillos',
          code: 'CAJA-01',
        }),
      );
    });
  });

  // G. Caja con turno abierto no puede desactivarse
  it('G. Caja con turno abierto no puede desactivarse y muestra mensaje exacto', async () => {
    (api.getCashRegisters as any).mockResolvedValue([
      {
        id: 'reg-01',
        storeId: 'store-centro',
        code: 'CAJA-01',
        name: 'Caja Principal',
        status: 'ACTIVE',
        activeSession: { id: 'ses-open', status: 'OPEN' },
      },
    ]);

    render(<StoreCashRegistersTab store={mockStore} currentUser={mockAdminUser} />);

    await waitFor(() => {
      expect(screen.getAllByText('Caja Principal').length).toBeGreaterThan(0);
      expect(screen.getAllByText(/Turno Abierto/i).length).toBeGreaterThan(0);
    });

    // Try to deactivate
    const deactivateBtn = (await screen.findAllByRole('button', { name: /Desactivar/i }))[0];
    fireEvent.click(deactivateBtn);

    await waitFor(() => {
      expect(
        screen.getByText('No puedes desactivar esta caja porque tiene un turno abierto.'),
      ).toBeInTheDocument();
    });

    // api.updateCashRegister must NOT have been called with INACTIVE
    expect(api.updateCashRegister).not.toHaveBeenCalled();
  });

  // H. Caja desactivada conserva historial
  it('H. Desactivar caja sin turno abierto actualiza estado a INACTIVE sin eliminar registro', async () => {
    (api.getCashRegisters as any).mockResolvedValue([
      {
        id: 'reg-01',
        storeId: 'store-centro',
        code: 'CAJA-01',
        name: 'Caja Principal',
        status: 'ACTIVE',
        activeSession: null,
      },
    ]);
    (api.updateCashRegister as any).mockResolvedValue({
      id: 'reg-01',
      status: 'INACTIVE',
    });

    render(<StoreCashRegistersTab store={mockStore} currentUser={mockAdminUser} />);

    const deactivateBtn = (await screen.findAllByRole('button', { name: /Desactivar/i }))[0];
    fireEvent.click(deactivateBtn);

    await waitFor(() => {
      expect(api.updateCashRegister).toHaveBeenCalledWith('reg-01', {
        status: 'INACTIVE',
      });
    });
  });

  // I. Botón Configurar cajas aparece solo para Administrador cuando no hay cajas activas
  it('I. Botón "Configurar cajas" aparece para Administrador pero NO para Cajero cuando no hay cajas activas', async () => {
    (api.getCashRegisters as any).mockResolvedValue([]);

    // 1. Admin view
    const onConfigure = vi.fn();
    const { unmount } = render(
      <OpenCashModal
        isOpen={true}
        onClose={vi.fn()}
        onSuccess={vi.fn()}
        currentUser={mockAdminUser}
        stores={[mockStore]}
        initialStoreId="store-centro"
        onConfigureRegisters={onConfigure}
      />,
    );

    await waitFor(() => {
      expect(
        screen.getByText('No hay cajas activas configuradas para esta tienda.'),
      ).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Configurar cajas/i })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /Configurar cajas/i }));
    expect(onConfigure).toHaveBeenCalledWith('store-centro');

    unmount();

    // 2. Cajero view
    render(
      <OpenCashModal
        isOpen={true}
        onClose={vi.fn()}
        onSuccess={vi.fn()}
        currentUser={mockCajeroUser}
        stores={[mockStore]}
        initialStoreId="store-centro"
        onConfigureRegisters={onConfigure}
      />,
    );

    await waitFor(() => {
      expect(
        screen.getByText('No hay cajas activas configuradas para esta tienda.'),
      ).toBeInTheDocument();
      // For Cajero: NO configuration button
      expect(screen.queryByRole('button', { name: /Configurar cajas/i })).not.toBeInTheDocument();
    });
  });

  // J. Al volver de configuración, Apertura refresca listado
  it('J. Al volver o pulsar refrescar, Apertura de Turno recarga las cajas disponibles', async () => {
    // Initially empty
    (api.getCashRegisters as any)
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        {
          id: 'reg-nueva',
          storeId: 'store-centro',
          code: 'CAJA-NUEVA',
          name: 'Caja Recién Creada',
          status: 'ACTIVE',
        },
      ]);

    render(
      <OpenCashModal
        isOpen={true}
        onClose={vi.fn()}
        onSuccess={vi.fn()}
        currentUser={mockAdminUser}
        stores={[mockStore]}
        initialStoreId="store-centro"
      />,
    );

    await waitFor(() => {
      expect(
        screen.getByText('No hay cajas activas configuradas para esta tienda.'),
      ).toBeInTheDocument();
    });

    // User clicks Refrescar button
    const refreshBtn = screen.getByRole('button', { name: /Refrescar/i });
    fireEvent.click(refreshBtn);

    await waitFor(() => {
      expect(screen.getByText('Caja Recién Creada (CAJA-NUEVA)')).toBeInTheDocument();
    });
  });

  // LocationFormModal integration: Tienda -> Cajas tab
  it('Integración LocationFormModal: Al abrir tienda muestra pestañas Datos generales y Cajas', async () => {
    (api.getCashRegisters as any).mockResolvedValue([
      {
        id: 'reg-01',
        storeId: 'store-centro',
        code: 'CAJA-01',
        name: 'Caja Principal',
        status: 'ACTIVE',
      },
    ]);

    render(
      <LocationFormModal
        isOpen={true}
        onClose={vi.fn()}
        onSave={vi.fn()}
        initialLocation={mockStore}
        currentUser={mockAdminUser}
        initialTab="registers"
      />,
    );

    expect(screen.getByRole('button', { name: /Datos Generales/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Cajas/i })).toBeInTheDocument();

    // Verify Cajas tab is active and shows registers
    await waitFor(() => {
      expect(screen.getByText('Cajas Configuradas (1)')).toBeInTheDocument();
      expect(screen.getAllByText('Caja Principal').length).toBeGreaterThan(0);
      expect(screen.getAllByText('CAJA-01').length).toBeGreaterThan(0);
    });
  });
});
