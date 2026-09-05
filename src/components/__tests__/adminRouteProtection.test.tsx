import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import App from '../../App';
import { Sidebar } from '../Sidebar';
import { mockAdminUser, mockCashierUser, mockClients, mockLoans } from '../../test/mocks/apiMock';
import * as apiModule from '../../services/api';

vi.mock('../../services/api', async () => {
  const actual = await vi.importActual('../../services/api');
  return {
    ...actual,
    getAuthToken: vi.fn(),
    api: {
      getMe: vi.fn(),
      getClients: vi.fn(),
      getDashboardKPIs: vi.fn(),
      getAllLoans: vi.fn(),
      getStatementOfAccount: vi.fn(),
      getAuditLogs: vi.fn(),
      getUsers: vi.fn(),
      getPendingPayments: vi.fn(),
      getAnnulledOperations: vi.fn(),
    },
  };
});

describe('Admin Route and Permission Protection Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (apiModule.api.getClients as any).mockResolvedValue(mockClients);
    (apiModule.api.getDashboardKPIs as any).mockResolvedValue({
      totalClients: 10,
      clientsWithDebt: 2,
      totalPendingDebt: 500,
      clientsWithBalanceInFavor: 0,
      todayPaymentsTotal: 0,
      todayPaymentsCount: 0,
    });
    (apiModule.api.getAllLoans as any).mockResolvedValue(mockLoans);
    (apiModule.api.getAuditLogs as any).mockResolvedValue([]);
    (apiModule.api.getUsers as any).mockResolvedValue([]);
    (apiModule.api.getPendingPayments as any).mockResolvedValue([]);
    (apiModule.api.getAnnulledOperations as any).mockResolvedValue({ annulledPurchases: [], annulledPayments: [] });
  });

  it('CASO 1: Administrador accede a /admin y AdminPanel se renderiza correctamente', async () => {
    window.history.pushState({}, '', '/admin');
    (apiModule.getAuthToken as any).mockReturnValue('admin-valid-token');
    (apiModule.api.getMe as any).mockResolvedValue({ user: mockAdminUser });

    render(<App />);

    await waitFor(() => {
      // In AdminPanel, tabs are rendered
      expect(screen.getByText(/Bitácora de Auditoría/i)).toBeInTheDocument();
    });

    expect(window.location.pathname).toBe('/admin');
  });

  it('CASO 2: Cajero intenta acceder directamente a /admin -> AdminPanel NO se renderiza y es redirigido a /clients', async () => {
    window.history.pushState({}, '', '/admin');
    (apiModule.getAuthToken as any).mockReturnValue('cashier-valid-token');
    (apiModule.api.getMe as any).mockResolvedValue({ user: mockCashierUser });

    render(<App />);

    await waitFor(() => {
      // User is redirected to /clients, showing Clients view
      expect(screen.getByText('Gestión de clientes, límites de crédito y configuración de cobro.')).toBeInTheDocument();
    });

    // AdminPanel MUST NOT be rendered
    expect(screen.queryByText(/Bitácora de Auditoría/i)).not.toBeInTheDocument();
    // Pathname must be updated to permitted route
    expect(window.location.pathname).toBe('/clients');
  });

  it('CASO 3: Cajero no ve el botón ni el acceso a Administración en la barra de navegación lateral', () => {
    const setCurrentViewMock = vi.fn();

    // Render with Cashier
    const { rerender } = render(
      <Sidebar
        currentView="clients"
        setCurrentView={setCurrentViewMock}
        user={mockCashierUser}
        onLogout={vi.fn()}
        onExportData={vi.fn()}
        onOpenLogin={vi.fn()}
      />
    );

    // Cashier must NOT see Administración
    expect(screen.queryByText('Administración')).not.toBeInTheDocument();

    // Rerender with Admin
    rerender(
      <Sidebar
        currentView="clients"
        setCurrentView={setCurrentViewMock}
        user={mockAdminUser}
        onLogout={vi.fn()}
        onExportData={vi.fn()}
        onOpenLogin={vi.fn()}
      />
    );

    // Admin MUST see Administración
    expect(screen.getByText('Administración')).toBeInTheDocument();
  });
});
