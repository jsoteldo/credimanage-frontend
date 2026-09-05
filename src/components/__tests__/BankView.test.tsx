import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BankView } from '../BankView';
import { mockClients, mockLoans, mockAdminUser, mockCashierUser } from '../../test/mocks/apiMock';
import { api } from '../../services/api';

vi.mock('../../services/api', () => ({
  api: {
    getAllLoans: vi.fn(),
    annulLoan: vi.fn(),
    createLoanCredit: vi.fn(),
  },
}));

vi.mock('../LoanScheduleModal', () => ({
  LoanScheduleModal: ({ isOpen, onClose, code }: any) =>
    isOpen ? (
      <div data-testid="mock-schedule-modal">
        <span>Cronograma de {code}</span>
        <button onClick={onClose}>Cerrar Cronograma</button>
      </div>
    ) : null,
}));

vi.mock('../GrantLoanModal', () => ({
  GrantLoanModal: ({ isOpen, onClose }: any) =>
    isOpen ? (
      <div data-testid="mock-grant-loan-modal">
        <span>Modal Otorgar Crédito</span>
        <button onClick={onClose}>Cerrar</button>
      </div>
    ) : null,
}));

describe('BankView Component Characterization', () => {
  const defaultProps = {
    clients: mockClients,
    currentUser: mockAdminUser,
    onPayClient: vi.fn(),
    onRefreshData: vi.fn(),
  };

  beforeEach(() => {
    vi.mocked(api.getAllLoans).mockResolvedValue(mockLoans);
    vi.mocked(api.annulLoan).mockResolvedValue({ success: true } as any);
  });

  it('separates active loans (pendingAmount > 0.01) and historical loans (Pagado/Anulado)', async () => {
    const user = userEvent.setup();
    render(<BankView {...defaultProps} />);

    await waitFor(() => {
      expect(api.getAllLoans).toHaveBeenCalled();
    });

    // In Active tab by default: CR-TEST-001 (Activo, pendingAmount: 1100)
    expect(screen.getAllByText('CR-TEST-001').length).toBeGreaterThanOrEqual(1);

    // CR-TEST-002 (Pagado) and CR-TEST-003 (Anulado) should NOT be in Active tab
    expect(screen.queryByText('CR-TEST-002')).not.toBeInTheDocument();
    expect(screen.queryByText('CR-TEST-003')).not.toBeInTheDocument();

    // Switch to Historial tab
    const historyTab = screen.getByRole('button', { name: /Historial de Créditos/i });
    await user.click(historyTab);

    // In History tab: CR-TEST-002 and CR-TEST-003 should appear
    expect(screen.getAllByText('CR-TEST-002').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('CR-TEST-003').length).toBeGreaterThanOrEqual(1);
    expect(screen.queryByText('CR-TEST-001')).not.toBeInTheDocument();
  });

  it('filters active loans with search input', async () => {
    const user = userEvent.setup();
    render(<BankView {...defaultProps} />);

    await waitFor(() => {
      expect(api.getAllLoans).toHaveBeenCalled();
    });

    const searchInput = screen.getByPlaceholderText('Buscar por cliente, código o ticket...');
    await user.type(searchInput, 'CR-TEST-001');

    expect(screen.getAllByText('CR-TEST-001').length).toBeGreaterThanOrEqual(1);

    await user.clear(searchInput);
    await user.type(searchInput, 'NO_MATCH_CODE_XYZ');

    expect(
      screen.getByText('No se encontraron créditos que coincidan con la búsqueda.')
    ).toBeInTheDocument();
  });

  it('renders EMPTY state when there are no active loans', async () => {
    // Only return paid and annulled loans
    vi.mocked(api.getAllLoans).mockResolvedValue([mockLoans[1], mockLoans[2]]);

    render(<BankView {...defaultProps} />);

    await waitFor(() => {
      expect(api.getAllLoans).toHaveBeenCalled();
    });

    expect(
      screen.getByText('No hay créditos con intereses activos.')
    ).toBeInTheDocument();
  });

  it('opens LoanScheduleModal when clicking Cronograma button', async () => {
    const user = userEvent.setup();
    render(<BankView {...defaultProps} />);

    await waitFor(() => {
      expect(api.getAllLoans).toHaveBeenCalled();
    });

    const cronogramaBtns = screen.getAllByRole('button', { name: /Cronograma/i });
    await user.click(cronogramaBtns[0]);

    expect(screen.getByTestId('mock-schedule-modal')).toBeInTheDocument();
    expect(screen.getByText(/Cronograma de CR-TEST-001/i)).toBeInTheDocument();
  });

  it('triggers onPayClient with the matching client when clicking Pagar button', async () => {
    const user = userEvent.setup();
    const handlePayClient = vi.fn();
    render(<BankView {...defaultProps} onPayClient={handlePayClient} />);

    await waitFor(() => {
      expect(api.getAllLoans).toHaveBeenCalled();
    });

    // Loan CR-TEST-001 belongs to cli-003 (Cliente Test C)
    const pagarBtns = screen.getAllByRole('button', { name: /Pagar/i });
    await user.click(pagarBtns[0]);

    expect(handlePayClient).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'cli-003', name: 'Cliente Test C' }),
      expect.objectContaining({
        mode: 'bankLoan',
        targetLoan: expect.objectContaining({ id: 'loan-001' }),
      })
    );
  });

  it('shows Anular button ONLY for Administrator when loan has paidAmount === 0', async () => {
    // Render as Admin: CR-TEST-001 has paidAmount: 0
    const { unmount } = render(<BankView {...defaultProps} currentUser={mockAdminUser} />);

    await waitFor(() => {
      expect(api.getAllLoans).toHaveBeenCalled();
    });

    const annulButtons = screen.getAllByTitle('Anular crédito sin pagos');
    expect(annulButtons.length).toBeGreaterThanOrEqual(1);

    unmount();

    // Render as Cashier: Anular button must NOT be rendered
    render(<BankView {...defaultProps} currentUser={mockCashierUser} />);
    await waitFor(() => {
      expect(api.getAllLoans).toHaveBeenCalled();
    });

    expect(screen.queryByTitle('Anular crédito sin pagos')).not.toBeInTheDocument();
  });

  it('opens GrantLoanModal when clicking header action button', async () => {
    const user = userEvent.setup();
    render(<BankView {...defaultProps} />);

    const grantBtn = screen.getByRole('button', { name: /Otorgar Crédito con Intereses/i });
    await user.click(grantBtn);

    expect(screen.getByTestId('mock-grant-loan-modal')).toBeInTheDocument();
  });
});
