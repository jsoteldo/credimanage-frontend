import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { GrantLoanModal } from '../GrantLoanModal';
import { mockClients } from '../../test/mocks/apiMock';
import { Client } from '../../types';

vi.mock('../LoanScheduleModal', () => ({
  LoanScheduleModal: ({ isOpen, onClose, title }: any) =>
    isOpen ? (
      <div data-testid="mock-schedule-modal">
        <span>{title}</span>
        <button onClick={onClose}>Cerrar</button>
      </div>
    ) : null,
}));

describe('GrantLoanModal Component Characterization', () => {
  const defaultProps = {
    isOpen: true,
    onClose: vi.fn(),
    clients: mockClients,
    initialClientId: null,
    onSubmit: vi.fn(),
    onClientCreated: vi.fn(),
  };

  it('renders modal with ClientSelector in bank mode and financial default values', () => {
    render(<GrantLoanModal {...defaultProps} />);

    expect(
      screen.getByRole('heading', { name: 'Otorgar Crédito con Intereses' })
    ).toBeInTheDocument();
    expect(screen.getByText('Seleccionar Cliente *')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('1000.00')).toHaveValue(1000);
    expect(screen.getByPlaceholderText('10')).toHaveValue(10);
    expect(screen.getByPlaceholderText('5')).toHaveValue(5);
  });

  it('updates real-time financial calculations when capital, rate, or installments change', async () => {
    const user = userEvent.setup();
    render(<GrantLoanModal {...defaultProps} initialClientId="cli-003" />);

    // Cliente Test C is selected
    expect(screen.getByText('Cliente Test C')).toBeInTheDocument();

    const capitalInput = screen.getByPlaceholderText('1000.00');
    await user.clear(capitalInput);
    await user.type(capitalInput, '2000');

    const rateInput = screen.getByPlaceholderText('10');
    await user.clear(rateInput);
    await user.type(rateInput, '20');

    // Capital: 2000, 20% -> Interest: 400, Total: 2400
    expect(screen.getByText('Total a Pagar')).toBeInTheDocument();
    expect(screen.getByText(/2,400\.00/i)).toBeInTheDocument();
  });

  it('blocks submission and disables submit button when projected balance exceeds credit limit', async () => {
    const user = userEvent.setup();
    // Cliente Test A: creditLimit = 1000, currentBalance = 300.
    // Capital 1000 + 10% = 1100 -> projected = 1400 > 1000 limit
    render(<GrantLoanModal {...defaultProps} initialClientId="cli-001" />);

    expect(screen.getByText(/⚠️ \(Excedido\)/i)).toBeInTheDocument();

    const submitBtn = screen.getByRole('button', { name: /Otorgar Crédito/i });
    expect(submitBtn).toBeDisabled();
  });

  it('opens LoanScheduleModal when clicking Previsualizar Cronograma', async () => {
    const user = userEvent.setup();
    render(<GrantLoanModal {...defaultProps} initialClientId="cli-003" />);

    const previewBtn = screen.getByRole('button', { name: /Previsualizar Cronograma/i });
    await user.click(previewBtn);

    expect(screen.getByTestId('mock-schedule-modal')).toBeInTheDocument();
    expect(screen.getByText('Cronograma Proyectado de Cuotas')).toBeInTheDocument();
  });

  it('submits loan application with computed financial parameters and closes modal', async () => {
    const user = userEvent.setup();
    const handleSubmit = vi.fn().mockResolvedValue(undefined);
    const handleClose = vi.fn();

    // Cliente Test C: creditLimit = 2000, currentBalance = 1200.
    // Let's set capital = 400, rate = 10% -> total = 440 -> projected = 1640 <= 2000
    render(
      <GrantLoanModal
        {...defaultProps}
        initialClientId="cli-003"
        onSubmit={handleSubmit}
        onClose={handleClose}
      />
    );

    const capitalInput = screen.getByPlaceholderText('1000.00');
    await user.clear(capitalInput);
    await user.type(capitalInput, '400');

    const submitBtn = screen.getByRole('button', { name: /Otorgar Crédito/i });
    expect(submitBtn).not.toBeDisabled();
    await user.click(submitBtn);

    await waitFor(() => {
      expect(handleSubmit).toHaveBeenCalledWith(
        'cli-003',
        expect.objectContaining({
          capital: 400,
          interestRate: 10,
          interestAmount: 40,
          totalAmount: 440,
          installmentsCount: 5,
        })
      );
      expect(handleClose).toHaveBeenCalled();
    });
  });

  it('preserves form inputs (capital, rate, installments) when a new client is added while open', async () => {
    const user = userEvent.setup();

    const { rerender } = render(<GrantLoanModal {...defaultProps} initialClientId={null} />);

    // Custom financial inputs
    const capitalInput = screen.getByPlaceholderText('1000.00');
    await user.clear(capitalInput);
    await user.type(capitalInput, '3500');

    const rateInput = screen.getByPlaceholderText('10');
    await user.clear(rateInput);
    await user.type(rateInput, '15');

    const installmentsInput = screen.getByPlaceholderText('5');
    await user.clear(installmentsInput);
    await user.type(installmentsInput, '8');

    // Simulate newly registered client
    const newClient: Client = {
      id: 'cli-new-bank',
      clientNumber: 'CLI-NEW-002',
      name: 'Cliente Nuevo Banco',
      phone: '999888777',
      address: 'Jr. Financiero 789',
      creditLimit: 5000,
      currentBalance: 0,
      status: 'Activo',
      createdAt: '2026-03-01T00:00:00.000Z',
      updatedAt: '2026-03-01T00:00:00.000Z',
    };

    rerender(
      <GrantLoanModal
        {...defaultProps}
        clients={[...mockClients, newClient]}
        initialClientId={null}
      />
    );

    // Inputs must be preserved
    expect(capitalInput).toHaveValue(3500);
    expect(rateInput).toHaveValue(15);
    expect(installmentsInput).toHaveValue(8);
  });
});
