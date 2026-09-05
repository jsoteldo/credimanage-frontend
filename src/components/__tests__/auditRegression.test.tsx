import React from 'react';
import { render, screen, waitFor, fireEvent, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { ClientFormModal } from '../ClientFormModal';
import { AddDebtModal } from '../AddDebtModal';
import { GrantLoanModal } from '../GrantLoanModal';
import { PaymentModal } from '../PaymentModal';
import { LoanScheduleModal } from '../LoanScheduleModal';
import { ClientSelector } from '../ClientSelector';
import { mockClients } from '../../test/mocks/apiMock';
import { Client } from '../../types';

describe('Audit Regression & Robustness Tests', () => {
  const activeClient: Client = {
    ...mockClients[0],
    id: 'cli-act-01',
    name: 'Cliente Activo Test',
    status: 'Activo',
    currentBalance: 200,
    creditLimit: 5000,
  };

  const deactivatedClient: Client = {
    ...mockClients[0],
    id: 'cli-deact-01',
    name: 'Cliente Desactivado Test',
    status: 'Desactivado',
    currentBalance: 150,
    creditLimit: 5000,
  };

  describe('ClientFormModal', () => {
    it('rejects negative credit limits with explicit error message', async () => {
      const user = userEvent.setup();
      const handleSubmit = vi.fn().mockResolvedValue(undefined);

      render(
        <ClientFormModal
          isOpen={true}
          onClose={vi.fn()}
          onSubmit={handleSubmit}
        />
      );

      const nameInput = screen.getByPlaceholderText(/Ej\. Juan Pérez/i);
      await user.type(nameInput, 'Carlos Mendoza');

      const limitInput = screen.getByLabelText(/Límite de Crédito/i);
      fireEvent.change(limitInput, { target: { value: '-50' } });

      const submitBtn = screen.getByRole('button', { name: /Guardar Cliente/i });
      fireEvent.submit(submitBtn.closest('form')!);

      expect(screen.getByText('El límite de crédito no puede ser negativo')).toBeInTheDocument();
      expect(handleSubmit).not.toHaveBeenCalled();
    });

    it('prevents concurrent double submission using synchronous ref mutex and re-enables after resolution', async () => {
      const user = userEvent.setup();
      let resolveSubmit: () => void;
      const deferredPromise = new Promise<void>((resolve) => {
        resolveSubmit = resolve;
      });
      const handleSubmit = vi.fn().mockReturnValue(deferredPromise);

      render(
        <ClientFormModal
          isOpen={true}
          onClose={vi.fn()}
          onSubmit={handleSubmit}
        />
      );

      const nameInput = screen.getByPlaceholderText(/Ej\. Juan Pérez/i);
      await user.type(nameInput, 'María Gómez');

      const form = screen.getByRole('button', { name: /Guardar Cliente/i }).closest('form')!;

      // Fire two submit events concurrently without awaiting render in-between
      act(() => {
        fireEvent.submit(form);
        fireEvent.submit(form);
      });

      // Verify synchronous mutex permitted exactly one submission
      expect(handleSubmit).toHaveBeenCalledTimes(1);

      // Resolve the in-flight request
      await act(async () => {
        resolveSubmit!();
        await new Promise((r) => setTimeout(r, 0));
      });

      // After completion, verify subsequent submission is unlocked and permitted
      await act(async () => {
        fireEvent.submit(form);
      });
      expect(handleSubmit).toHaveBeenCalledTimes(2);
    });
  });

  describe('AddDebtModal', () => {
    it('blocks debt charges on deactivated clients', async () => {
      const user = userEvent.setup();
      const handleSubmit = vi.fn().mockResolvedValue(undefined);

      render(
        <AddDebtModal
          isOpen={true}
          onClose={vi.fn()}
          clients={[deactivatedClient]}
          client={deactivatedClient}
          onSubmit={handleSubmit}
          onClientCreated={vi.fn()}
        />
      );

      const priceInput = screen.getByPlaceholderText('0.00');
      await user.type(priceInput, '50');

      const submitBtn = screen.getByRole('button', { name: /Confirmar y Cargar Deuda/i });
      await user.click(submitBtn);

      expect(screen.getByText('No se puede cargar deuda a un cliente desactivado')).toBeInTheDocument();
      expect(handleSubmit).not.toHaveBeenCalled();
    });

    it('prevents concurrent double submission using synchronous ref mutex and re-enables after resolution', async () => {
      let resolveSubmit: () => void;
      const deferredPromise = new Promise<void>((resolve) => {
        resolveSubmit = resolve;
      });
      const handleSubmit = vi.fn().mockReturnValue(deferredPromise);

      render(
        <AddDebtModal
          isOpen={true}
          onClose={vi.fn()}
          clients={[activeClient]}
          client={activeClient}
          onSubmit={handleSubmit}
          onClientCreated={vi.fn()}
        />
      );
      const priceInput = screen.getByPlaceholderText('0.00');
      fireEvent.change(priceInput, { target: { value: '50' } });

      const form = screen.getByRole('button', { name: /Confirmar y Cargar Deuda/i }).closest('form')!;

      // Fire two submits concurrently without awaiting React state/render cycles
      act(() => {
        fireEvent.submit(form);
        fireEvent.submit(form);
      });

      // The synchronous isSubmittingRef must prevent the second call
      expect(handleSubmit).toHaveBeenCalledTimes(1);

      // Resolve first submission
      await act(async () => {
        resolveSubmit!();
        await Promise.resolve();
      });

      // Verify the mutex is safely released in finally block
      await act(async () => {
        fireEvent.submit(form);
      });
      expect(handleSubmit).toHaveBeenCalledTimes(2);
    });
  });

  describe('GrantLoanModal', () => {
    it('blocks granting loans to deactivated clients', async () => {
      const user = userEvent.setup();
      const handleSubmit = vi.fn().mockResolvedValue(undefined);

      render(
        <GrantLoanModal
          isOpen={true}
          onClose={vi.fn()}
          clients={[deactivatedClient]}
          initialClientId={deactivatedClient.id}
          onSubmit={handleSubmit}
          onClientCreated={vi.fn()}
        />
      );

      const submitBtn = screen.getByRole('button', { name: /Otorgar Crédito/i });
      await user.click(submitBtn);

      expect(screen.getByText('No se puede otorgar crédito a un cliente desactivado')).toBeInTheDocument();
      expect(handleSubmit).not.toHaveBeenCalled();
    });

    it('prevents concurrent double submission using synchronous ref mutex and re-enables after resolution', async () => {
      let resolveSubmit: () => void;
      const deferredPromise = new Promise<void>((resolve) => {
        resolveSubmit = resolve;
      });
      const handleSubmit = vi.fn().mockReturnValue(deferredPromise);

      render(
        <GrantLoanModal
          isOpen={true}
          onClose={vi.fn()}
          clients={[activeClient]}
          initialClientId={activeClient.id}
          onSubmit={handleSubmit}
          onClientCreated={vi.fn()}
        />
      );

      const form = screen.getByRole('button', { name: /Otorgar Crédito/i }).closest('form')!;

      // Two concurrent submit triggers
      act(() => {
        fireEvent.submit(form);
        fireEvent.submit(form);
      });

      // Only one execution should pass through
      expect(handleSubmit).toHaveBeenCalledTimes(1);

      // Resolve in-flight request
      await act(async () => {
        resolveSubmit!();
        await new Promise((r) => setTimeout(r, 0));
      });

      // Subsequent operation must be permitted
      await act(async () => {
        fireEvent.submit(form);
      });
      expect(handleSubmit).toHaveBeenCalledTimes(2);
    });
  });

  describe('PaymentModal', () => {
    it('prevents concurrent double submission on final payment confirmation and re-enables after resolution', async () => {
      const user = userEvent.setup();
      let resolveSubmit: () => void;
      const deferredPromise = new Promise<void>((resolve) => {
        resolveSubmit = resolve;
      });
      const handleConfirm = vi.fn().mockReturnValue(deferredPromise);

      render(
        <PaymentModal
          isOpen={true}
          onClose={vi.fn()}
          client={activeClient}
          onConfirmPayment={handleConfirm}
        />
      );

      // Enter amount in step 1
      const amountInput = screen.getByPlaceholderText('0.00');
      await user.type(amountInput, '100');

      const nextBtn = screen.getByRole('button', { name: /Continuar a Confirmación/i });
      await user.click(nextBtn);

      // Step 2: Confirm button
      const confirmBtn = screen.getByRole('button', { name: /Confirmar y Registrar Movimiento/i });

      // Concurrent click triggers without waiting for intermediate renders
      act(() => {
        fireEvent.click(confirmBtn);
        fireEvent.click(confirmBtn);
      });

      expect(handleConfirm).toHaveBeenCalledTimes(1);

      // Resolve in-flight payment
      await act(async () => {
        resolveSubmit!();
        await new Promise((r) => setTimeout(r, 0));
      });

      // Subsequent payment invocation allowed after resolution
      await act(async () => {
        fireEvent.click(confirmBtn);
      });
      expect(handleConfirm).toHaveBeenCalledTimes(2);
    });
  });

  describe('Modal Stacking & Accessibility', () => {
    it('applies custom zIndexClass on LoanScheduleModal and exposes accessible close button', () => {
      const { container } = render(
        <LoanScheduleModal
          isOpen={true}
          onClose={vi.fn()}
          clientName="Juan Pérez"
          capital={1000}
          interestRate={10}
          interestAmount={100}
          totalAmount={1100}
          installmentsCount={2}
          frequency="Mensual"
          installments={[
            {
              installmentNumber: 1,
              dueDate: '2026-04-01',
              amount: 550,
              capital: 500,
              interest: 50,
              status: 'Pendiente',
            },
            {
              installmentNumber: 2,
              dueDate: '2026-05-01',
              amount: 550,
              capital: 500,
              interest: 50,
              status: 'Pendiente',
            },
          ]}
          zIndexClass="z-[70]"
        />
      );

      const overlay = container.querySelector('.fixed.inset-0');
      expect(overlay).toHaveClass('z-[70]');

      const closeButtons = screen.getAllByRole('button', { name: /Cerrar cronograma/i });
      expect(closeButtons.length).toBe(2);
    });

    it('ClientSelector renders listbox with role="listbox" and options with role="option"', async () => {
      const user = userEvent.setup();

      render(
        <ClientSelector
          selectedClient={null}
          onSelectClient={vi.fn()}
          clients={mockClients}
          mode="debt"
        />
      );

      const searchInput = screen.getByRole('textbox', { name: /Cliente Destino \*/i });
      expect(searchInput).toHaveAttribute('aria-autocomplete', 'list');

      // Type to open listbox
      await user.type(searchInput, 'Test');

      const listbox = screen.getByRole('listbox', { name: /Resultados de clientes/i });
      expect(listbox).toBeInTheDocument();

      const options = screen.getAllByRole('option');
      expect(options.length).toBeGreaterThan(0);
    });
  });
});

