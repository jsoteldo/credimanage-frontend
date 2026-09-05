import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DebtView } from '../DebtView';
import { mockClients, mockAdminUser } from '../../test/mocks/apiMock';
import { api } from '../../services/api';

vi.mock('../../services/api', () => ({
  api: {
    getAllLoans: vi.fn(),
    getPurchasesHistory: vi.fn(),
    getPaymentsHistory: vi.fn(),
  },
}));

vi.mock('../CurrentDebtAdminModal', () => ({
  CurrentDebtAdminModal: ({ isOpen, onClose, client }: any) =>
    isOpen ? (
      <div data-testid="mock-debt-admin-modal">
        <span>Modal Administrar Deuda: {client?.name}</span>
        <button onClick={onClose}>Cerrar Modal</button>
      </div>
    ) : null,
  }));

describe('DebtView Component Characterization', () => {
  const defaultProps = {
    clients: mockClients,
    currentUser: mockAdminUser,
    onViewStatement: vi.fn(),
    onPayClient: vi.fn(),
    onAddDebtClient: vi.fn(),
    onRefreshData: vi.fn(),
  };

  beforeEach(() => {
    vi.mocked(api.getPurchasesHistory).mockResolvedValue({ purchases: [], summary: { count: 0, totalAmount: 0 } });
    vi.mocked(api.getPaymentsHistory).mockResolvedValue({ payments: [], summary: { count: 0, totalAmount: 0 } });
  });

  it('determines clientsWithDailyDebt directly from client.dailyDebtBalance > 0 without needing loans API', async () => {
    render(<DebtView {...defaultProps} />);

    // Does not call getAllLoans, eliminating the loans race condition
    expect(api.getAllLoans).not.toHaveBeenCalled();

    // Cliente Test A: dailyDebtBalance = 300 (> 0) -> present
    expect(screen.getAllByText('Cliente Test A').length).toBeGreaterThanOrEqual(1);

    // Cliente Test B: dailyDebtBalance = 0 -> NOT present
    expect(screen.queryByText('Cliente Test B')).not.toBeInTheDocument();

    // Cliente Test C: dailyDebtBalance = 100 (> 0) -> present
    expect(screen.getAllByText('Cliente Test C').length).toBeGreaterThanOrEqual(1);
  });

  it('excludes client from daily debt if dailyDebtBalance is 0 even if bank debt or currentBalance exists', async () => {
    const clientWithOnlyBankDebt = {
      ...mockClients[1],
      id: 'cli-bank-only',
      name: 'Cliente Solo Con Prestamo Bancario',
      currentBalance: 500,
      dailyDebtBalance: 0,
      bankDebtBalance: 500,
      creditExposure: 500,
      availableCredit: 0,
    };

    render(<DebtView {...defaultProps} clients={[clientWithOnlyBankDebt]} />);

    // Since dailyDebtBalance is 0, client should not be listed in daily debtors
    expect(screen.queryByText('Cliente Solo Con Prestamo Bancario')).not.toBeInTheDocument();
    expect(
      screen.getByText('No hay clientes con deuda corriente pendiente.')
    ).toBeInTheDocument();
  });

  it('P. includes client with dailyDebtBalance = 0.01 (S/ 0.01 es deuda válida)', async () => {
    const clientWithPennyDebt = {
      ...mockClients[1],
      id: 'cli-penny',
      name: 'Cliente Con Deuda Minima',
      dailyDebtBalance: 0.01,
      currentBalance: 0.01,
      bankDebtBalance: 0,
      creditExposure: 0.01,
      availableCredit: 499.99,
    };

    render(<DebtView {...defaultProps} clients={[clientWithPennyDebt]} />);

    // Must appear in DebtView
    expect(screen.getAllByText('Cliente Con Deuda Minima').length).toBeGreaterThanOrEqual(1);
    expect(screen.queryByText('No hay clientes con deuda corriente pendiente.')).not.toBeInTheDocument();
  });

  it('renders EMPTY state when no clients have daily debt', async () => {
    const handleAddDebt = vi.fn();
    render(
      <DebtView
        {...defaultProps}
        clients={[mockClients[1]]} // Cliente Test B (dailyDebtBalance = 0)
        onAddDebtClient={handleAddDebt}
      />
    );

    expect(
      screen.getByText('No hay clientes con deuda corriente pendiente.')
    ).toBeInTheDocument();

    const addDebtBtn = screen.getAllByRole('button', { name: /\+ Cargar Nueva Deuda/i })[0];
    const user = userEvent.setup();
    await user.click(addDebtBtn);
    expect(handleAddDebt).toHaveBeenCalled();
  });

  it('renders NO RESULTS state when searching for a query with no matches', async () => {
    const user = userEvent.setup();
    render(<DebtView {...defaultProps} />);

    const searchInput = screen.getByPlaceholderText('Buscar cliente por nombre o código...');
    await user.type(searchInput, 'Inexistente XYZ');

    expect(
      screen.getByText('No se encontraron clientes con deuda que coincidan con los filtros aplicados.')
    ).toBeInTheDocument();

    const clearBtn = screen.getByRole('button', { name: /Limpiar búsqueda/i });
    await user.click(clearBtn);
    expect(searchInput).toHaveValue('');
  });

  it('opens CurrentDebtAdminModal upon clicking a desktop row or mobile card', async () => {
    const user = userEvent.setup();
    render(<DebtView {...defaultProps} />);

    // Click on Cliente Test A
    const clientRows = screen.getAllByText('Cliente Test A');
    await user.click(clientRows[0]);

    expect(screen.getByTestId('mock-debt-admin-modal')).toBeInTheDocument();
    expect(screen.getByText(/Modal Administrar Deuda: Cliente Test A/i)).toBeInTheDocument();
  });

  it('triggers onAddDebtClient from the header button', async () => {
    const user = userEvent.setup();
    const handleAddDebt = vi.fn();
    render(<DebtView {...defaultProps} onAddDebtClient={handleAddDebt} />);

    const headerAddDebtBtn = screen.getByRole('button', { name: /\+ Cargar Nueva Deuda/i });
    await user.click(headerAddDebtBtn);
    expect(handleAddDebt).toHaveBeenCalledWith(null);
  });
});
