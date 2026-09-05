import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { AddDebtModal } from '../AddDebtModal';
import { mockClients } from '../../test/mocks/apiMock';
import { Client } from '../../types';

describe('AddDebtModal Component Characterization', () => {
  const defaultProps = {
    isOpen: true,
    onClose: vi.fn(),
    clients: mockClients,
    client: null,
    onSubmit: vi.fn(),
    onClientCreated: vi.fn(),
  };

  it('renders modal with ClientSelector in debt mode and default form inputs', () => {
    render(<AddDebtModal {...defaultProps} />);

    expect(screen.getByRole('heading', { name: 'Cargar Nueva Deuda a Cliente' })).toBeInTheDocument();
    expect(screen.getByText('Cliente Destino *')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Buscar cliente por nombre, código o teléfono...')).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/Ej\. Consumo del día/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText('0.00')).toBeInTheDocument();
    expect(screen.getByText(/Fecha del Cargo \*/i)).toBeInTheDocument();
  });

  it('calculates total charge and balance projection when client and unitPrice are selected', async () => {
    const user = userEvent.setup();
    // Cliente Test A: currentBalance 300, creditLimit 1000
    render(<AddDebtModal {...defaultProps} client={mockClients[0]} />);

    // Check client summary card is rendered by ClientSelector in debt mode
    expect(screen.getByText('Cliente Test A')).toBeInTheDocument();

    const priceInput = screen.getByPlaceholderText('0.00');
    await user.type(priceInput, '150');

    // Projection:
    // Saldo actual: S/ 300.00
    // Nuevo cargo: +S/ 150.00
    // Nuevo saldo: S/ 450.00
    expect(screen.getByText('Saldo Actual del Cliente:')).toBeInTheDocument();
    expect(screen.getByText('+S/ 150.00 PEN')).toBeInTheDocument();
  });

  it('blocks submission and disables submit button if charge exceeds client credit limit', async () => {
    const user = userEvent.setup();
    // Cliente Test A: currentBalance 300, creditLimit 1000. Exceeds limit at > 700.
    render(<AddDebtModal {...defaultProps} client={mockClients[0]} />);

    const priceInput = screen.getByPlaceholderText('0.00');
    await user.type(priceInput, '800'); // 300 + 800 = 1100 > 1000

    expect(screen.getByText(/⚠️ \(Excedido\)/i)).toBeInTheDocument();

    const submitBtn = screen.getByRole('button', { name: /Confirmar y Cargar Deuda/i });
    expect(submitBtn).toBeDisabled();
  });

  it('submits debt charge with correct payload and closes modal', async () => {
    const user = userEvent.setup();
    const handleSubmit = vi.fn().mockResolvedValue(undefined);
    const handleClose = vi.fn();

    render(
      <AddDebtModal
        {...defaultProps}
        client={mockClients[0]}
        onSubmit={handleSubmit}
        onClose={handleClose}
      />
    );

    const priceInput = screen.getByPlaceholderText('0.00');
    await user.type(priceInput, '100');

    const submitBtn = screen.getByRole('button', { name: /Confirmar y Cargar Deuda/i });
    expect(submitBtn).not.toBeDisabled();
    await user.click(submitBtn);

    await waitFor(() => {
      expect(handleSubmit).toHaveBeenCalledWith(
        'cli-001',
        expect.objectContaining({
          product: expect.any(String),
          unitPrice: 100,
          quantity: 1,
          debtType: 'simple',
        })
      );
      expect(handleClose).toHaveBeenCalled();
    });
  });

  it('preserves entered form inputs when modal remains open and a client is selected', async () => {
    const user = userEvent.setup();

    // Start with no client preselected
    const { rerender } = render(<AddDebtModal {...defaultProps} client={null} />);

    // Custom concept and price entered by user
    const conceptInput = screen.getByPlaceholderText(/Ej\. Consumo del día/i);
    await user.clear(conceptInput);
    await user.type(conceptInput, 'Consumo Especial Test Preservado');

    const priceInput = screen.getByPlaceholderText('0.00');
    await user.type(priceInput, '75.50');

    // New client created or selected while modal is open
    const newClient: Client = {
      id: 'cli-new-01',
      clientNumber: 'CLI-NEW-001',
      name: 'Nuevo Cliente Creado',
      phone: '987654321',
      address: 'Calle Test 123',
      creditLimit: 500,
      currentBalance: 0,
      status: 'Activo',
      createdAt: '2026-03-01T00:00:00.000Z',
      updatedAt: '2026-03-01T00:00:00.000Z',
    };

    // Rerender with clients list updated
    rerender(
      <AddDebtModal
        {...defaultProps}
        clients={[...mockClients, newClient]}
        client={null}
      />
    );

    // Form inputs must remain intact!
    expect(conceptInput).toHaveValue('Consumo Especial Test Preservado');
    expect(priceInput).toHaveValue(75.5);
  });
});
