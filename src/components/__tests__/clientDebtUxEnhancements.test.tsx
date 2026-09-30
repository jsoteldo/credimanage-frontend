import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ClientFormModal } from '../ClientFormModal';
import { AddDebtModal } from '../AddDebtModal';
import { ClientSelector } from '../ClientSelector';
import { mockClients } from '../../test/mocks/apiMock';
import { Client } from '../../types';

describe('UX Enhancements: Editar Cliente & Cargar Nueva Deuda (Requirements A - K)', () => {
  const sampleClient: Client = {
    id: 'cli-1054',
    clientNumber: 'CLI-1054',
    name: 'Juan Pérez',
    phone: '987654321',
    address: 'Av. Siempre Viva 123',
    creditLimit: 1500,
    currentBalance: 350,
    dailyDebtBalance: 350,
    bankDebtBalance: 0,
    availableCredit: 1150,
    status: 'Activo',
    paymentPeriod: 'Quincenal',
    paymentDay: 'Día 15',
    nextDueDate: '2026-10-15',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  };

  const deactivatedClient: Client = {
    ...sampleClient,
    id: 'cli-deactivated',
    name: 'Cliente Inactivo',
    status: 'Desactivado',
  };

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('1. Nuevo Botón en Editar Cliente (Req A, B, E)', () => {
    it('A. Editar Cliente muestra botón Agregar Deuda con jerarquía secundaria operativa', () => {
      render(
        <ClientFormModal
          isOpen={true}
          onClose={vi.fn()}
          onSubmit={vi.fn()}
          initialClient={sampleClient}
          onOpenAddDebt={vi.fn()}
          onDeactivateClient={vi.fn()}
        />
      );

      // Verify header is Editar Cliente
      expect(screen.getByRole('heading', { name: 'Editar Cliente' })).toBeInTheDocument();

      // Desactivar Cliente is present (destructive / red)
      const deactivateBtn = screen.getByRole('button', { name: /Desactivar Cliente/i });
      expect(deactivateBtn).toBeInTheDocument();
      expect(deactivateBtn.className).toContain('text-rose-700');

      // Agregar Deuda button is present (positive / operational secondary)
      const addDebtBtn = screen.getByRole('button', { name: /\+ Agregar Deuda/i });
      expect(addDebtBtn).toBeInTheDocument();
      expect(addDebtBtn.className).toContain('text-indigo-700');
      expect(addDebtBtn.className).toContain('border-indigo-200');

      // Cancelar and Guardar Cliente buttons are present
      const cancelBtn = screen.getByRole('button', { name: /Cancelar/i });
      const saveBtn = screen.getByRole('button', { name: /Guardar Cliente/i });
      expect(cancelBtn).toBeInTheDocument();
      expect(saveBtn).toBeInTheDocument();
      expect(saveBtn.className).toContain('bg-indigo-600');
    });

    it('A2. Nuevo Cliente (creación) NO muestra botón Agregar Deuda', () => {
      render(
        <ClientFormModal
          isOpen={true}
          onClose={vi.fn()}
          onSubmit={vi.fn()}
          initialClient={null}
          onOpenAddDebt={vi.fn()}
        />
      );

      expect(screen.getByRole('heading', { name: 'Nuevo Cliente' })).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /Agregar Deuda/i })).not.toBeInTheDocument();
    });

    it('B. Click en Agregar Deuda abre flujo de Cargar Nueva Deuda pasando el cliente preseleccionado', async () => {
      const user = userEvent.setup();
      const handleOpenAddDebt = vi.fn();
      const handleClose = vi.fn();

      render(
        <ClientFormModal
          isOpen={true}
          onClose={handleClose}
          onSubmit={vi.fn()}
          initialClient={sampleClient}
          onOpenAddDebt={handleOpenAddDebt}
        />
      );

      const addDebtBtn = screen.getByRole('button', { name: /\+ Agregar Deuda/i });
      await user.click(addDebtBtn);

      expect(handleOpenAddDebt).toHaveBeenCalledTimes(1);
      expect(handleOpenAddDebt).toHaveBeenCalledWith(sampleClient);
      expect(handleClose).toHaveBeenCalledTimes(1);
    });

    it('B2. Si Editar Cliente tiene modificaciones pendientes, solicita confirmación y no guarda silenciosamente', async () => {
      const user = userEvent.setup();
      const handleOpenAddDebt = vi.fn();
      const handleClose = vi.fn();
      const handleSubmit = vi.fn();

      const confirmSpy = vi.spyOn(window, 'confirm');

      render(
        <ClientFormModal
          isOpen={true}
          onClose={handleClose}
          onSubmit={handleSubmit}
          initialClient={sampleClient}
          onOpenAddDebt={handleOpenAddDebt}
        />
      );

      // Modify the phone number (making the form dirty)
      const phoneInput = screen.getByLabelText(/Teléfono/i);
      await user.clear(phoneInput);
      await user.type(phoneInput, '911223344');

      // 1. User cancels the discard confirmation
      confirmSpy.mockReturnValueOnce(false);
      const addDebtBtn = screen.getByRole('button', { name: /\+ Agregar Deuda/i });
      await user.click(addDebtBtn);

      expect(confirmSpy).toHaveBeenCalledWith(
        expect.stringContaining('Tiene modificaciones no guardadas')
      );
      expect(handleOpenAddDebt).not.toHaveBeenCalled();
      expect(handleClose).not.toHaveBeenCalled();
      expect(handleSubmit).not.toHaveBeenCalled();

      // 2. User accepts the discard confirmation
      confirmSpy.mockReturnValueOnce(true);
      await user.click(addDebtBtn);

      expect(handleOpenAddDebt).toHaveBeenCalledWith(sampleClient);
      expect(handleClose).toHaveBeenCalled();
      // Changes were NOT auto-saved to backend/onSubmit
      expect(handleSubmit).not.toHaveBeenCalled();
    });

    it('B3. Desactivado: El botón Agregar Deuda está deshabilitado si el cliente está desactivado', () => {
      render(
        <ClientFormModal
          isOpen={true}
          onClose={vi.fn()}
          onSubmit={vi.fn()}
          initialClient={deactivatedClient}
          onOpenAddDebt={vi.fn()}
        />
      );

      const addDebtBtn = screen.getByRole('button', { name: /\+ Agregar Deuda/i });
      expect(addDebtBtn).toBeDisabled();
      expect(addDebtBtn).toHaveAttribute(
        'title',
        'No se puede cargar deuda a un cliente desactivado'
      );
    });
  });

  describe('2. Modal Cargar Nueva Deuda con Cliente Preseleccionado (Req C, D, E)', () => {
    it('C. Cliente editado queda automáticamente preseleccionado y muestra tarjeta compacta sin abrir listado completo', () => {
      render(
        <AddDebtModal
          isOpen={true}
          onClose={vi.fn()}
          client={sampleClient}
          clients={[sampleClient, ...mockClients]}
          onSubmit={vi.fn()}
        />
      );

      // Header is the existing Cargar Nueva Deuda modal
      expect(
        screen.getByRole('heading', { name: 'Cargar Nueva Deuda a Cliente' })
      ).toBeInTheDocument();

      // Summary card is displayed directly
      expect(screen.getByText('Juan Pérez')).toBeInTheDocument();
      expect(screen.getByText('CLI-1054')).toBeInTheDocument();
      expect(screen.getByText(/Debe:/i)).toBeInTheDocument();
      expect(screen.getAllByText('S/ 350.00').length).toBeGreaterThanOrEqual(1);
      expect(screen.getByText(/Disponible:/i)).toBeInTheDocument();

      // "Cambiar cliente" button is available
      expect(screen.getByRole('button', { name: /Cambiar cliente/i })).toBeInTheDocument();

      // Autocomplete listbox should NOT be opened automatically
      expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    });

    it('D. Botón Cambiar cliente sigue disponible y permite usar el ClientSelector normalmente', async () => {
      const user = userEvent.setup();

      render(
        <AddDebtModal
          isOpen={true}
          onClose={vi.fn()}
          client={sampleClient}
          clients={[sampleClient, ...mockClients]}
          onSubmit={vi.fn()}
        />
      );

      const changeBtn = screen.getByRole('button', { name: /Cambiar cliente/i });
      await user.click(changeBtn);

      // Now the search input is visible
      const searchInput = screen.getByPlaceholderText(
        'Buscar cliente por nombre, código o teléfono...'
      );
      expect(searchInput).toBeInTheDocument();

      // And typing filters clients normally
      await user.type(searchInput, 'Cliente Test B');
      expect(screen.getByText('Cliente Test B')).toBeInTheDocument();
    });

    it('E. Reutiliza AddDebtModal existente y procesa el cobro con la lógica estándar', async () => {
      const user = userEvent.setup();
      const handleSubmit = vi.fn().mockResolvedValue(undefined);
      const handleClose = vi.fn();

      render(
        <AddDebtModal
          isOpen={true}
          onClose={handleClose}
          client={sampleClient}
          clients={[sampleClient, ...mockClients]}
          onSubmit={handleSubmit}
        />
      );

      const priceInput = screen.getByPlaceholderText('0.00');
      await user.type(priceInput, '50');

      const submitBtn = screen.getByRole('button', { name: /Confirmar y Cargar Deuda/i });
      await user.click(submitBtn);

      await waitFor(() => {
        expect(handleSubmit).toHaveBeenCalledWith(
          'cli-1054',
          expect.objectContaining({
            unitPrice: 50,
            quantity: 1,
            debtType: 'simple',
          })
        );
        expect(handleClose).toHaveBeenCalled();
      });
    });
  });

  describe('3. Altura Visual y Scroll en ClientSelector (Req F, G, H, I, J, 14)', () => {
    // Generate a set of 6 active clients to test 3-item limit
    const sixActiveClients: Client[] = Array.from({ length: 6 }, (_, i) => ({
      id: `cli-active-${i + 1}`,
      clientNumber: `CLI-200${i + 1}`,
      name: `Cliente Activo Número ${i + 1}`,
      phone: `99900000${i + 1}`,
      address: `Dirección ${i + 1}`,
      creditLimit: 1000,
      currentBalance: 100 * (i + 1),
      dailyDebtBalance: 100 * (i + 1),
      status: 'Activo',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    }));

    it('F & G. ClientSelector en Cargar Nueva Deuda usa maxVisibleItems={3} con max-h-[210px] y scroll interno', async () => {
      const user = userEvent.setup();

      render(
        <AddDebtModal
          isOpen={true}
          onClose={vi.fn()}
          client={null}
          clients={sixActiveClients}
          onSubmit={vi.fn()}
        />
      );

      const searchInput = screen.getByPlaceholderText(
        'Buscar cliente por nombre, código o teléfono...'
      );
      await user.click(searchInput);

      const listbox = screen.getByRole('listbox');
      expect(listbox).toBeInTheDocument();

      // Check maxVisibleItems attribute and max-h-[210px] class
      expect(listbox).toHaveAttribute('data-max-visible-items', '3');
      expect(listbox.className).toContain('max-h-[210px]');
      expect(listbox.className).toContain('overflow-y-auto');

      // The 6 clients are rendered as options within the scrollable container
      const options = screen.getAllByRole('option');
      expect(options.length).toBe(6);
    });

    it('H. Búsqueda multivariable sigue funcionando con 1, 2, 3 o 4+ resultados', async () => {
      const user = userEvent.setup();

      render(
        <ClientSelector
          selectedClient={null}
          onSelectClient={vi.fn()}
          clients={sixActiveClients}
          maxVisibleItems={3}
        />
      );

      const searchInput = screen.getByPlaceholderText(
        'Buscar cliente por nombre, código o teléfono...'
      );

      // Search by exact code (1 result)
      await user.type(searchInput, 'CLI-2001');
      let options = screen.getAllByRole('option');
      expect(options.length).toBe(1);
      expect(screen.getByText('Cliente Activo Número 1')).toBeInTheDocument();

      // Search by phone
      await user.clear(searchInput);
      await user.type(searchInput, '999000002');
      options = screen.getAllByRole('option');
      expect(options.length).toBe(1);
      expect(screen.getByText('Cliente Activo Número 2')).toBeInTheDocument();
    });

    it('I. Botón + Nuevo Cliente sigue visible y accesible arriba de la lista', async () => {
      render(
        <ClientSelector
          selectedClient={null}
          onSelectClient={vi.fn()}
          clients={sixActiveClients}
          maxVisibleItems={3}
        />
      );

      const newClientBtn = screen.getByRole('button', { name: /Nuevo Cliente/i });
      expect(newClientBtn).toBeInTheDocument();
    });

    it('J. Otros usos de ClientSelector sin maxVisibleItems conservan max-h-60 por defecto', async () => {
      const user = userEvent.setup();

      render(
        <ClientSelector
          selectedClient={null}
          onSelectClient={vi.fn()}
          clients={sixActiveClients}
          mode="bank"
        />
      );

      const searchInput = screen.getByPlaceholderText(
        'Buscar cliente por nombre, código o teléfono...'
      );
      await user.click(searchInput);

      const listbox = screen.getByRole('listbox');
      expect(listbox).toBeInTheDocument();
      expect(listbox.className).toContain('max-h-60');
      expect(listbox.className).not.toContain('max-h-[210px]');
    });

    it('14. Accesibilidad: Navegación por teclado y scroll hacia elemento activo', async () => {
      const user = userEvent.setup();
      const handleSelect = vi.fn();

      render(
        <ClientSelector
          selectedClient={null}
          onSelectClient={handleSelect}
          clients={sixActiveClients}
          maxVisibleItems={3}
        />
      );

      const searchInput = screen.getByPlaceholderText(
        'Buscar cliente por nombre, código o teléfono...'
      );
      await user.click(searchInput);

      // Arrow down to highlight first option
      await user.keyboard('{ArrowDown}');
      const options = screen.getAllByRole('option');
      expect(options[0]).toHaveAttribute('aria-selected', 'true');

      // Arrow down to second option
      await user.keyboard('{ArrowDown}');
      expect(options[1]).toHaveAttribute('aria-selected', 'true');

      // Enter selects option
      await user.keyboard('{Enter}');
      expect(handleSelect).toHaveBeenCalledWith(sixActiveClients[1]);
    });
  });
});
