import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { CheckoutModal } from '../sales/CheckoutModal';
import { Location, CashSession } from '../../types';

const mockStore: Location = {
  id: 'loc-tienda-centro',
  businessId: 'default',
  name: 'Tienda Centro',
  code: 'TC01',
  type: 'STORE',
  active: true,
};

const mockOpenSession: CashSession = {
  id: 'sess-01',
  businessId: 'default',
  storeId: 'loc-tienda-centro',
  cashRegisterId: 'reg-01',
  openedByUserId: 'usr-01',
  openedAt: new Date().toISOString(),
  openingCashAmount: 100,
  status: 'OPEN',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

const mockItems = [
  {
    productId: 'prod-item-1',
    productName: 'Producto Test',
    sku: 'SKU-001',
    unitPrice: 24.0,
    quantity: 1,
    lineTotal: 24.0,
  },
];

describe('CheckoutModal - Pruebas Funcionales de Pagos Mixtos y Resumen', () => {
  // 1. Pago únicamente en efectivo
  it('1. Pago únicamente en efectivo muestra resumen, efectivo aplicado y habilita confirmación', async () => {
    const handleConfirm = vi.fn().mockResolvedValue(undefined);

    render(
      <CheckoutModal
        store={mockStore}
        selectedClient={null}
        items={mockItems}
        total={24.0}
        cashSession={mockOpenSession}
        onClose={vi.fn()}
        onConfirmSale={handleConfirm}
      />,
    );

    expect(screen.getByText('Resumen del pago')).toBeInTheDocument();
    expect(screen.getByText('Total de la venta:')).toBeInTheDocument();
    expect(screen.getByText('Total asignado:')).toBeInTheDocument();
    expect(screen.getByText('Efectivo aplicado:')).toBeInTheDocument();
    expect(screen.getByLabelText(/Efectivo Recibido/i)).toBeInTheDocument();
    expect(screen.getByText(/Cambio a entregar:/i)).toBeInTheDocument();
    expect(screen.getByText('Monto exacto cubierto')).toBeInTheDocument();

    const confirmBtn = screen.getByRole('button', { name: /Confirmar Venta/i });
    expect(confirmBtn).not.toBeDisabled();

    fireEvent.click(confirmBtn);

    await waitFor(() => {
      expect(handleConfirm).toHaveBeenCalledWith(
        expect.objectContaining({
          payments: [{ method: 'CASH', amount: 24 }],
          cashReceived: 24,
        }),
      );
    });
  });

  // 2. Pago únicamente electrónico
  it('2. Pago únicamente electrónico oculta los campos de efectivo y cambio', async () => {
    const handleConfirm = vi.fn().mockResolvedValue(undefined);

    render(
      <CheckoutModal
        store={mockStore}
        selectedClient={null}
        items={mockItems}
        total={24.0}
        cashSession={mockOpenSession}
        onClose={vi.fn()}
        onConfirmSale={handleConfirm}
      />,
    );

    // Cambiar método a YAPE
    const select = screen.getByRole('combobox');
    fireEvent.change(select, { target: { value: 'YAPE' } });

    expect(screen.getByText('Resumen del pago')).toBeInTheDocument();
    expect(screen.getByText('Total de la venta:')).toBeInTheDocument();
    expect(screen.getByText('Total asignado:')).toBeInTheDocument();
    expect(screen.getByText('Monto exacto cubierto')).toBeInTheDocument();

    // No debe haber efectivo ni cambio
    expect(screen.queryByText('Efectivo aplicado:')).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/Efectivo Recibido/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Cambio a entregar:/i)).not.toBeInTheDocument();

    const confirmBtn = screen.getByRole('button', { name: /Confirmar Venta/i });
    expect(confirmBtn).not.toBeDisabled();

    fireEvent.click(confirmBtn);

    await waitFor(() => {
      expect(handleConfirm).toHaveBeenCalledWith(
        expect.objectContaining({
          payments: [{ method: 'YAPE', amount: 24 }],
          cashReceived: undefined,
        }),
      );
    });
  });

  // 3. Pago mixto (Ejemplo 1 del requerimiento: Efectivo S/ 20 + Yape S/ 4)
  it('3. Pago mixto Efectivo S/ 20 + Yape S/ 4 cubre monto exacto y cambio es S/ 0.00', async () => {
    const handleConfirm = vi.fn().mockResolvedValue(undefined);

    render(
      <CheckoutModal
        store={mockStore}
        selectedClient={null}
        items={mockItems}
        total={24.0}
        cashSession={mockOpenSession}
        onClose={vi.fn()}
        onConfirmSale={handleConfirm}
      />,
    );

    // Cambiar primer método (Efectivo) a 20
    const firstAmountInput = screen.getByLabelText(/Monto de pago 1/i);
    fireEvent.change(firstAmountInput, { target: { value: '20' } });

    // Agregar segundo método
    fireEvent.click(screen.getByText(/Agregar otro medio/i));

    // El segundo método (YAPE) se auto-llena con 4
    expect(screen.getByText('Monto exacto cubierto')).toBeInTheDocument();
    expect(screen.getByText('Efectivo aplicado:')).toBeInTheDocument();
    expect(screen.getAllByText('S/ 20.00').length).toBeGreaterThan(0);
    expect(screen.getByText('S/ 0.00')).toBeInTheDocument(); // Cambio S/ 0.00

    const confirmBtn = screen.getByRole('button', { name: /Confirmar Venta/i });
    expect(confirmBtn).not.toBeDisabled();

    fireEvent.click(confirmBtn);

    await waitFor(() => {
      expect(handleConfirm).toHaveBeenCalledWith(
        expect.objectContaining({
          payments: [
            { method: 'CASH', amount: 20 },
            { method: 'YAPE', amount: 4 },
          ],
          cashReceived: 20,
        }),
      );
    });
  });

  // 4. Pago mixto con cambio (Ejemplo 2: Efectivo S/ 20 + Yape S/ 4, cliente entrega S/ 50)
  it('4. Pago mixto con cambio: Efectivo S/ 20 + Yape S/ 4, cliente entrega billete S/ 50 -> Cambio S/ 30.00', async () => {
    const handleConfirm = vi.fn().mockResolvedValue(undefined);

    render(
      <CheckoutModal
        store={mockStore}
        selectedClient={null}
        items={mockItems}
        total={24.0}
        cashSession={mockOpenSession}
        onClose={vi.fn()}
        onConfirmSale={handleConfirm}
      />,
    );

    // Efectivo: 20
    const firstAmountInput = screen.getByLabelText(/Monto de pago 1/i);
    fireEvent.change(firstAmountInput, { target: { value: '20' } });

    // Agregar Yape (4)
    fireEvent.click(screen.getByText(/Agregar otro medio/i));

    // Cliente entrega S/ 50 en efectivo
    const recibidoInput = screen.getByLabelText(/Efectivo Recibido/i);
    fireEvent.change(recibidoInput, { target: { value: '50' } });

    // Cambio debe ser 30.00 (50 - 20)
    expect(screen.getByText('S/ 30.00')).toBeInTheDocument();

    const confirmBtn = screen.getByRole('button', { name: /Confirmar Venta/i });
    expect(confirmBtn).not.toBeDisabled();

    fireEvent.click(confirmBtn);

    await waitFor(() => {
      expect(handleConfirm).toHaveBeenCalledWith(
        expect.objectContaining({
          payments: [
            { method: 'CASH', amount: 20 },
            { method: 'YAPE', amount: 4 },
          ],
          cashReceived: 50,
        }),
      );
    });
  });

  // 5. Pago insuficiente (Ejemplo 3: Efectivo S/ 15 + Yape S/ 4 -> Total S/ 19, Faltan S/ 5)
  it('5. Pago insuficiente muestra "Faltan S/ 5.00 por asignar" y deshabilita confirmación', () => {
    render(
      <CheckoutModal
        store={mockStore}
        selectedClient={null}
        items={mockItems}
        total={24.0}
        cashSession={mockOpenSession}
        onClose={vi.fn()}
        onConfirmSale={vi.fn()}
      />,
    );

    // Efectivo: 15
    const firstAmountInput = screen.getByLabelText(/Monto de pago 1/i);
    fireEvent.change(firstAmountInput, { target: { value: '15' } });

    // Agregar segundo método
    fireEvent.click(screen.getByText(/Agregar otro medio/i));
    const secondAmountInput = screen.getByLabelText(/Monto de pago 2/i);
    fireEvent.change(secondAmountInput, { target: { value: '4' } });

    // Total asignado: 19, Faltan: 5
    expect(screen.getByText(/Faltan S\/ 5.00 por asignar/i)).toBeInTheDocument();
    expect(screen.getByText('S/ 19.00')).toBeInTheDocument();

    const confirmBtn = screen.getByRole('button', { name: /Confirmar Venta/i });
    expect(confirmBtn).toBeDisabled();
  });

  // 6. Eliminación de un medio de pago
  it('6. Eliminación de un medio de pago recalcula inmediatamente el total asignado', () => {
    render(
      <CheckoutModal
        store={mockStore}
        selectedClient={null}
        items={mockItems}
        total={24.0}
        cashSession={mockOpenSession}
        onClose={vi.fn()}
        onConfirmSale={vi.fn()}
      />,
    );

    // Efectivo: 20
    const firstAmountInput = screen.getByLabelText(/Monto de pago 1/i);
    fireEvent.change(firstAmountInput, { target: { value: '20' } });

    // Agregar Yape (4)
    fireEvent.click(screen.getByText(/Agregar otro medio/i));
    expect(screen.getByText('Monto exacto cubierto')).toBeInTheDocument();

    // Eliminar el segundo método (Yape)
    const deleteButtons = screen.getAllByTitle(/Eliminar este pago/i);
    fireEvent.click(deleteButtons[1]);

    // Ahora solo queda Efectivo 20, faltan 4
    expect(screen.getByText(/Faltan S\/ 4.00 por asignar/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Confirmar Venta/i })).toBeDisabled();
  });

  // 7. Modificación de importes en tiempo real
  it('7. Modificación de importes actualiza en tiempo real sin requerir pulsar "Ajustar"', () => {
    render(
      <CheckoutModal
        store={mockStore}
        selectedClient={null}
        items={mockItems}
        total={24.0}
        cashSession={mockOpenSession}
        onClose={vi.fn()}
        onConfirmSale={vi.fn()}
      />,
    );

    const firstAmountInput = screen.getByLabelText(/Monto de pago 1/i);

    // Escribir 10
    fireEvent.change(firstAmountInput, { target: { value: '10' } });
    expect(screen.getByText(/Faltan S\/ 14.00 por asignar/i)).toBeInTheDocument();

    // Escribir 24 nuevamente
    fireEvent.change(firstAmountInput, { target: { value: '24' } });
    expect(screen.getByText('Monto exacto cubierto')).toBeInTheDocument();
  });

  // 8. Adición de varios medios de pago
  it('8. Permite combinar múltiples medios (Efectivo + Yape + Tarjeta)', () => {
    render(
      <CheckoutModal
        store={mockStore}
        selectedClient={null}
        items={mockItems}
        total={24.0}
        cashSession={mockOpenSession}
        onClose={vi.fn()}
        onConfirmSale={vi.fn()}
      />,
    );

    // Efectivo: 10
    const firstAmountInput = screen.getByLabelText(/Monto de pago 1/i);
    fireEvent.change(firstAmountInput, { target: { value: '10' } });

    // Agregar Yape: 8
    fireEvent.click(screen.getByText(/Agregar otro medio/i));
    const secondAmountInput = screen.getByLabelText(/Monto de pago 2/i);
    fireEvent.change(secondAmountInput, { target: { value: '8' } });

    // Agregar Tarjeta: 6
    fireEvent.click(screen.getByText(/Agregar otro medio/i));
    const thirdMethodSelect = screen.getAllByRole('combobox')[2];
    fireEvent.change(thirdMethodSelect, { target: { value: 'CARD' } });

    // Total asignado: 10 + 8 + 6 = 24
    expect(screen.getByText('Monto exacto cubierto')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Confirmar Venta/i })).not.toBeDisabled();
  });

  // 9. Intento de confirmar una venta incompleta
  it('9. Intento de confirmar una venta incompleta bloquea el botón y muestra error si se envía formulario', async () => {
    const handleConfirm = vi.fn();

    render(
      <CheckoutModal
        store={mockStore}
        selectedClient={null}
        items={mockItems}
        total={24.0}
        cashSession={mockOpenSession}
        onClose={vi.fn()}
        onConfirmSale={handleConfirm}
      />,
    );

    // Efectivo: 10 (faltan 14)
    const firstAmountInput = screen.getByLabelText(/Monto de pago 1/i);
    fireEvent.change(firstAmountInput, { target: { value: '10' } });

    const confirmBtn = screen.getByRole('button', { name: /Confirmar Venta/i });
    expect(confirmBtn).toBeDisabled();

    // Intentar submit directo
    fireEvent.submit(firstAmountInput.closest('form')!);
    expect(handleConfirm).not.toHaveBeenCalled();
    expect(
      screen.getByText('Faltan S/ 14.00 por asignar para completar el total.'),
    ).toBeInTheDocument();
  });

  // 10. Efectivo recibido menor al efectivo requerido
  it('10. Efectivo recibido menor al requerido muestra advertencia y bloquea confirmación', () => {
    render(
      <CheckoutModal
        store={mockStore}
        selectedClient={null}
        items={mockItems}
        total={24.0}
        cashSession={mockOpenSession}
        onClose={vi.fn()}
        onConfirmSale={vi.fn()}
      />,
    );

    // Efectivo aplicado: 20, Yape: 4
    const firstAmountInput = screen.getByLabelText(/Monto de pago 1/i);
    fireEvent.change(firstAmountInput, { target: { value: '20' } });
    fireEvent.click(screen.getByText(/Agregar otro medio/i));

    // Efectivo recibido: 10 (menor a 20)
    const recibidoInput = screen.getByLabelText(/Efectivo Recibido/i);
    fireEvent.change(recibidoInput, { target: { value: '10' } });

    expect(
      screen.getByText(/El efectivo recibido debe ser al menos S\/ 20.00/i),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Confirmar Venta/i })).toBeDisabled();
  });

  // 11. Efectivo recibido exactamente igual al requerido
  it('11. Efectivo recibido exactamente igual al requerido genera cambio S/ 0.00 y habilita venta', () => {
    render(
      <CheckoutModal
        store={mockStore}
        selectedClient={null}
        items={mockItems}
        total={24.0}
        cashSession={mockOpenSession}
        onClose={vi.fn()}
        onConfirmSale={vi.fn()}
      />,
    );

    const firstAmountInput = screen.getByLabelText(/Monto de pago 1/i);
    fireEvent.change(firstAmountInput, { target: { value: '20' } });
    fireEvent.click(screen.getByText(/Agregar otro medio/i));

    const recibidoInput = screen.getByLabelText(/Efectivo Recibido/i);
    fireEvent.change(recibidoInput, { target: { value: '20' } });

    expect(screen.getByText('S/ 0.00')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Confirmar Venta/i })).not.toBeDisabled();
  });

  // 12. Efectivo recibido superior al requerido
  it('12. Efectivo recibido superior al requerido calcula el cambio exacto únicamente sobre el efectivo', () => {
    render(
      <CheckoutModal
        store={mockStore}
        selectedClient={null}
        items={mockItems}
        total={24.0}
        cashSession={mockOpenSession}
        onClose={vi.fn()}
        onConfirmSale={vi.fn()}
      />,
    );

    // Efectivo: 20, Yape: 4
    const firstAmountInput = screen.getByLabelText(/Monto de pago 1/i);
    fireEvent.change(firstAmountInput, { target: { value: '20' } });
    fireEvent.click(screen.getByText(/Agregar otro medio/i));

    // Cliente entrega 100
    const recibidoInput = screen.getByLabelText(/Efectivo Recibido/i);
    fireEvent.change(recibidoInput, { target: { value: '100' } });

    // Cambio = 100 - 20 = 80.00 (NO 100 - 24 = 76)
    expect(screen.getByText('S/ 80.00')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Confirmar Venta/i })).not.toBeDisabled();
  });
});
