import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { ClientsTable } from '../ClientsTable';
import { mockClients } from '../../test/mocks/apiMock';

describe('ClientsTable Component', () => {
  const defaultProps = {
    clients: mockClients,
    onNewClient: vi.fn(),
    onViewStatement: vi.fn(),
    onEditClient: vi.fn(),
    onPayClient: vi.fn(),
    onAddDebtClient: vi.fn(),
    onDeactivateClient: vi.fn(),
    onReactivateClient: vi.fn(),
    onDeleteClient: vi.fn(),
    statusFilter: 'todos',
    setStatusFilter: vi.fn(),
    searchQuery: '',
    setSearchQuery: vi.fn(),
  };

  it('renders page header, KPI cards, and client records in desktop and mobile representations', () => {
    render(<ClientsTable {...defaultProps} />);

    expect(screen.getByRole('heading', { name: 'Clientes', level: 2 })).toBeInTheDocument();
    expect(screen.getByText('Total Clientes')).toBeInTheDocument();
    expect(screen.getAllByText('Con Deuda').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Al Día').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Desactivados').length).toBeGreaterThanOrEqual(1);

    // Verify client name appears (in both desktop and mobile variants)
    const clientANames = screen.getAllByText('Cliente Test A');
    expect(clientANames.length).toBeGreaterThanOrEqual(2); // desktop row + mobile card
  });

  it('renders EMPTY state when clients array is empty', () => {
    const handleNewClient = vi.fn();
    render(
      <ClientsTable
        {...defaultProps}
        clients={[]}
        onNewClient={handleNewClient}
      />
    );

    const emptyMessages = screen.getAllByText('No hay clientes registrados todavía.');
    expect(emptyMessages.length).toBeGreaterThanOrEqual(1);

    const newClientBtns = screen.getAllByRole('button', { name: /\+ Nuevo Cliente/i });
    expect(newClientBtns.length).toBeGreaterThanOrEqual(1);
  });

  it('renders NO RESULTS state when filters or search yield zero matches', async () => {
    const handleSetSearchQuery = vi.fn();
    const handleSetStatusFilter = vi.fn();

    render(
      <ClientsTable
        {...defaultProps}
        searchQuery="TextoNoCoincidenteXYZ"
        setSearchQuery={handleSetSearchQuery}
        statusFilter="con_deuda"
        setStatusFilter={handleSetStatusFilter}
      />
    );

    const noResults = screen.getAllByText(
      'No se encontraron clientes que coincidan con la búsqueda o los filtros aplicados.'
    );
    expect(noResults.length).toBeGreaterThanOrEqual(1);

    // Should offer "Limpiar búsqueda" and "Restaurar filtros"
    const clearSearchBtn = screen.getAllByRole('button', { name: /Limpiar búsqueda/i })[0];
    const resetFiltersBtn = screen.getAllByRole('button', { name: /Restaurar filtros/i })[0];

    const user = userEvent.setup();
    await user.click(clearSearchBtn);
    expect(handleSetSearchQuery).toHaveBeenCalledWith('');

    await user.click(resetFiltersBtn);
    expect(handleSetStatusFilter).toHaveBeenCalledWith('todos');
  });

  it('triggers onEditClient when clicking a client table row or card', async () => {
    const user = userEvent.setup();
    const handleEditClient = vi.fn();

    render(<ClientsTable {...defaultProps} onEditClient={handleEditClient} />);

    // Click desktop row
    const clientARows = screen.getAllByText('Cliente Test A');
    await user.click(clientARows[0]);

    expect(handleEditClient).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'cli-001', name: 'Cliente Test A' })
    );
  });

  it('calls setStatusFilter when clicking a filter pill or KPI card', async () => {
    const user = userEvent.setup();
    const handleSetStatusFilter = vi.fn();

    render(<ClientsTable {...defaultProps} setStatusFilter={handleSetStatusFilter} />);

    const conDeudaPill = screen.getByRole('button', { name: /Con Deuda/i });
    await user.click(conDeudaPill);
    expect(handleSetStatusFilter).toHaveBeenCalledWith('con_deuda');
  });

  it('triggers onNewClient when clicking the header + Nuevo Cliente button', async () => {
    const user = userEvent.setup();
    const handleNewClient = vi.fn();

    render(<ClientsTable {...defaultProps} onNewClient={handleNewClient} />);

    const newClientBtn = screen.getByRole('button', { name: /\+ Nuevo Cliente/i });
    await user.click(newClientBtn);
    expect(handleNewClient).toHaveBeenCalled();
  });

  it('renders disabled pagination buttons in footer', () => {
    render(<ClientsTable {...defaultProps} />);

    const prevBtn = screen.getByRole('button', { name: /Anterior/i });
    const nextBtn = screen.getByRole('button', { name: /Siguiente/i });

    expect(prevBtn).toBeDisabled();
    expect(nextBtn).toBeDisabled();
    expect(screen.getByText(/Mostrando 4 de 4 clientes/i)).toBeInTheDocument();
  });
});
