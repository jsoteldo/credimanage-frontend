import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { ClientSelector } from '../ClientSelector';
import { mockClients } from '../../test/mocks/apiMock';

// Mock ClientFormModal to keep test focused and fast
vi.mock('../ClientFormModal', () => ({
  ClientFormModal: ({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) =>
    isOpen ? (
      <div data-testid="mock-client-form-modal">
        <span>Modal Nuevo Cliente</span>
        <button onClick={onClose}>Cerrar Modal</button>
      </div>
    ) : null,
}));

describe('ClientSelector Component', () => {
  it('renders search input with default label and placeholder in debt mode', () => {
    render(
      <ClientSelector
        selectedClient={null}
        onSelectClient={vi.fn()}
        clients={mockClients}
        mode="debt"
      />
    );

    expect(screen.getByText('Cliente Destino *')).toBeInTheDocument();
    expect(
      screen.getByPlaceholderText('Buscar cliente por nombre, código o teléfono...')
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /\+ Nuevo Cliente/i })).toBeInTheDocument();
  });

  it('renders bank mode label and helper text', () => {
    render(
      <ClientSelector
        selectedClient={null}
        onSelectClient={vi.fn()}
        clients={mockClients}
        mode="bank"
      />
    );

    expect(screen.getByText('Seleccionar Cliente *')).toBeInTheDocument();
    expect(
      screen.getByText(/Puedes seleccionar cualquier cliente activo, tenga o no créditos previos/i)
    ).toBeInTheDocument();
  });

  it('filters clients by name (case-insensitive) and selects a client', async () => {
    const user = userEvent.setup();
    const handleSelect = vi.fn();

    render(
      <ClientSelector
        selectedClient={null}
        onSelectClient={handleSelect}
        clients={mockClients}
        mode="debt"
      />
    );

    const searchInput = screen.getByPlaceholderText('Buscar cliente por nombre, código o teléfono...');
    await user.type(searchInput, 'cliente test a');

    // Should find Cliente Test A
    const option = screen.getByText('Cliente Test A');
    expect(option).toBeInTheDocument();

    await user.click(option);
    expect(handleSelect).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Cliente Test A', id: 'cli-001' })
    );
  });

  it('filters clients by clientNumber/code', async () => {
    const user = userEvent.setup();

    render(
      <ClientSelector
        selectedClient={null}
        onSelectClient={vi.fn()}
        clients={mockClients}
        mode="debt"
      />
    );

    const searchInput = screen.getByPlaceholderText('Buscar cliente por nombre, código o teléfono...');
    await user.type(searchInput, 'cli-test-002');

    expect(screen.getByText('Cliente Test B')).toBeInTheDocument();
    expect(screen.queryByText('Cliente Test A')).not.toBeInTheDocument();
  });

  it('filters clients by phone number', async () => {
    const user = userEvent.setup();

    render(
      <ClientSelector
        selectedClient={null}
        onSelectClient={vi.fn()}
        clients={mockClients}
        mode="debt"
      />
    );

    const searchInput = screen.getByPlaceholderText('Buscar cliente por nombre, código o teléfono...');
    await user.type(searchInput, '999555666');

    expect(screen.getByText('Cliente Test C')).toBeInTheDocument();
    expect(screen.queryByText('Cliente Test A')).not.toBeInTheDocument();
  });

  it('shows empty results state when query matches no clients and offers create client action', async () => {
    const user = userEvent.setup();

    render(
      <ClientSelector
        selectedClient={null}
        onSelectClient={vi.fn()}
        clients={mockClients}
        mode="debt"
      />
    );

    const searchInput = screen.getByPlaceholderText('Buscar cliente por nombre, código o teléfono...');
    await user.type(searchInput, 'Inexistente XYZ');

    expect(screen.getByText(/No se encontraron clientes para:/i)).toBeInTheDocument();
    expect(screen.getByText('"Inexistente XYZ"')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /\+ Crear nuevo cliente/i })).toBeInTheDocument();
  });

  it('clears search text when clear button is clicked', async () => {
    const user = userEvent.setup();

    render(
      <ClientSelector
        selectedClient={null}
        onSelectClient={vi.fn()}
        clients={mockClients}
        mode="debt"
      />
    );

    const searchInput = screen.getByPlaceholderText('Buscar cliente por nombre, código o teléfono...');
    await user.type(searchInput, 'Test');
    expect(searchInput).toHaveValue('Test');

    const clearButton = screen.getByTitle('Limpiar búsqueda');
    await user.click(clearButton);

    expect(searchInput).toHaveValue('');
  });

  it('renders selected client card with debt details and allows changing client', async () => {
    const user = userEvent.setup();
    const handleSelect = vi.fn();
    const clientWithDebt = mockClients[0]; // Cliente Test A, balance: 300

    render(
      <ClientSelector
        selectedClient={clientWithDebt}
        onSelectClient={handleSelect}
        clients={mockClients}
        mode="debt"
      />
    );

    expect(screen.getByText('Cliente Test A')).toBeInTheDocument();
    expect(screen.getByText('CLI-TEST-001')).toBeInTheDocument();
    expect(screen.getByText('Debe:')).toBeInTheDocument();

    const changeButton = screen.getByRole('button', { name: /Cambiar cliente/i });
    expect(changeButton).toBeInTheDocument();

    await user.click(changeButton);
    expect(handleSelect).toHaveBeenCalledWith(null);
  });

  it('renders selected client card with bank details in bank mode', () => {
    const client = mockClients[2]; // Cliente Test C, creditLimit: 2000, currentBalance: 1200

    render(
      <ClientSelector
        selectedClient={client}
        onSelectClient={vi.fn()}
        clients={mockClients}
        mode="bank"
      />
    );

    expect(screen.getByText('Cliente Test C')).toBeInTheDocument();
    expect(screen.getByText('Saldo actual:')).toBeInTheDocument();
    expect(screen.getByText('Disponible:')).toBeInTheDocument();
  });

  it('opens + Nuevo Cliente modal when button is clicked', async () => {
    const user = userEvent.setup();

    render(
      <ClientSelector
        selectedClient={null}
        onSelectClient={vi.fn()}
        clients={mockClients}
        mode="debt"
      />
    );

    const newClientBtn = screen.getByRole('button', { name: /\+ Nuevo Cliente/i });
    await user.click(newClientBtn);

    expect(screen.getByTestId('mock-client-form-modal')).toBeInTheDocument();
    expect(screen.getByText('Modal Nuevo Cliente')).toBeInTheDocument();
  });
});
