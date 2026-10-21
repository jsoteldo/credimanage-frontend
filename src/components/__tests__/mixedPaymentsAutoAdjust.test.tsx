import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { CheckoutModal } from '../sales/CheckoutModal';
import { Location, CashSession, Client } from '../../types';

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
    unitPrice: 100.0,
    quantity: 1,
    lineTotal: 100.0,
  },
];

const mockClientWithLimit: Client = {
  id: 'cli-01',
  clientNumber: 'CLI-1001',
  name: 'Juan Perez',
  phone: '999888777',
  address: 'Av. Principal 123',
  creditLimit: 150.0,
  currentBalance: 0,
  dailyDebtBalance: 0,
  bankDebtBalance: 0,
  status: 'Activo',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

describe('Pruebas Específicas de Autoajuste en Pagos Mixtos (Requerimiento 22: A a K)', () => {
  // A. Total 100: Tarjeta 100, agregar Efectivo 20 -> Tarjeta 80
  it('A. Total 100: Tarjeta 100, agregar Efectivo 20 -> Tarjeta pasa automáticamente a 80', () => {
    render(
      <CheckoutModal
        store={mockStore}
        selectedClient={null}
        items={mockItems}
        total={100.0}
        cashSession={mockOpenSession}
        onClose={vi.fn()}
        onConfirmSale={vi.fn()}
      />,
    );

    // Cambiar primer método a Tarjeta (100)
    const select1 = screen.getByRole('combobox');
    fireEvent.change(select1, { target: { value: 'CARD' } });

    // Agregar segundo método (Efectivo)
    fireEvent.click(screen.getByText(/Agregar otro medio/i));
    const select2 = screen.getAllByRole('combobox')[1];
    fireEvent.change(select2, { target: { value: 'CASH' } });

    // Modificar Efectivo a 20
    const inputs = screen.getAllByRole('spinbutton');
    fireEvent.change(inputs[1], { target: { value: '20' } });

    // Tarjeta (método residual) debe ser automáticamente 80
    expect(inputs[0]).toHaveValue(80);
    expect(inputs[1]).toHaveValue(20);
    expect(screen.getByText('Monto exacto cubierto')).toBeInTheDocument();
  });

  // B. Cambiar Efectivo 20 -> 30 -> Tarjeta 70
  it('B. Cambiar Efectivo 20 -> 30 -> Tarjeta pasa automáticamente a 70', () => {
    render(
      <CheckoutModal
        store={mockStore}
        selectedClient={null}
        items={mockItems}
        total={100.0}
        cashSession={mockOpenSession}
        onClose={vi.fn()}
        onConfirmSale={vi.fn()}
      />,
    );

    const select1 = screen.getByRole('combobox');
    fireEvent.change(select1, { target: { value: 'CARD' } });

    fireEvent.click(screen.getByText(/Agregar otro medio/i));
    const select2 = screen.getAllByRole('combobox')[1];
    fireEvent.change(select2, { target: { value: 'CASH' } });

    const inputs = screen.getAllByRole('spinbutton');
    // Efectivo = 20 -> Tarjeta = 80
    fireEvent.change(inputs[1], { target: { value: '20' } });
    expect(inputs[0]).toHaveValue(80);

    // Cambiar Efectivo = 30 -> Tarjeta = 70
    fireEvent.change(inputs[1], { target: { value: '30' } });
    expect(inputs[0]).toHaveValue(70);
    expect(inputs[1]).toHaveValue(30);
    expect(screen.getByText('Monto exacto cubierto')).toBeInTheDocument();
  });

  // C. Tres métodos: Yape 20, Efectivo 30 -> residual Tarjeta 50; Efectivo 40 -> residual 40
  it('C. Tres métodos: Yape 20, Efectivo 30 -> residual 50; luego Efectivo cambia a 40 -> residual 40', () => {
    render(
      <CheckoutModal
        store={mockStore}
        selectedClient={null}
        items={mockItems}
        total={100.0}
        cashSession={mockOpenSession}
        onClose={vi.fn()}
        onConfirmSale={vi.fn()}
      />,
    );

    // Método 1: Tarjeta (residual)
    const selects = screen.getAllByRole('combobox');
    fireEvent.change(selects[0], { target: { value: 'CARD' } });

    // Método 2: Yape (20)
    fireEvent.click(screen.getByText(/Agregar otro medio/i));
    const updatedSelects1 = screen.getAllByRole('combobox');
    fireEvent.change(updatedSelects1[1], { target: { value: 'YAPE' } });
    let inputs = screen.getAllByRole('spinbutton');
    fireEvent.change(inputs[1], { target: { value: '20' } });
    expect(inputs[0]).toHaveValue(80);

    // Método 3: Efectivo (30)
    fireEvent.click(screen.getByText(/Agregar otro medio/i));
    const updatedSelects2 = screen.getAllByRole('combobox');
    fireEvent.change(updatedSelects2[2], { target: { value: 'CASH' } });
    inputs = screen.getAllByRole('spinbutton');
    fireEvent.change(inputs[2], { target: { value: '30' } });

    // Tarjeta debe ser 50 (100 - 20 - 30)
    expect(inputs[0]).toHaveValue(50);
    expect(inputs[1]).toHaveValue(20);
    expect(inputs[2]).toHaveValue(30);
    expect(screen.getByText('Monto exacto cubierto')).toBeInTheDocument();

    // Luego Efectivo cambia a 40 -> Tarjeta debe pasar automáticamente a 40
    fireEvent.change(inputs[2], { target: { value: '40' } });
    expect(inputs[0]).toHaveValue(40);
    expect(inputs[1]).toHaveValue(20);
    expect(inputs[2]).toHaveValue(40);
    expect(screen.getByText('Monto exacto cubierto')).toBeInTheDocument();
  });

  // D. Eliminar método secundario -> residual absorbe diferencia
  it('D. Eliminar método secundario -> método residual absorbe la diferencia', () => {
    render(
      <CheckoutModal
        store={mockStore}
        selectedClient={null}
        items={mockItems}
        total={100.0}
        cashSession={mockOpenSession}
        onClose={vi.fn()}
        onConfirmSale={vi.fn()}
      />,
    );

    // Tarjeta 100
    const select1 = screen.getByRole('combobox');
    fireEvent.change(select1, { target: { value: 'CARD' } });

    // Agregar Yape (50) -> Tarjeta pasa a 50
    fireEvent.click(screen.getByText(/Agregar otro medio/i));
    const select2 = screen.getAllByRole('combobox')[1];
    fireEvent.change(select2, { target: { value: 'YAPE' } });
    const inputs = screen.getAllByRole('spinbutton');
    fireEvent.change(inputs[1], { target: { value: '50' } });

    expect(inputs[0]).toHaveValue(50);
    expect(inputs[1]).toHaveValue(50);

    // Eliminar Yape -> Tarjeta debe pasar automáticamente a 100
    const deleteButtons = screen.getAllByTitle(/Eliminar este pago/i);
    fireEvent.click(deleteButtons[1]);

    const finalInputs = screen.getAllByRole('spinbutton');
    expect(finalInputs[0]).toHaveValue(100);
    expect(screen.getByText('Monto exacto cubierto')).toBeInTheDocument();
  });

  // E. Otros métodos exceden total -> residual 0 + exceso visible
  it('E. Otros métodos exceden total -> residual queda en 0 y muestra exceso visible', () => {
    render(
      <CheckoutModal
        store={mockStore}
        selectedClient={null}
        items={mockItems}
        total={100.0}
        cashSession={mockOpenSession}
        onClose={vi.fn()}
        onConfirmSale={vi.fn()}
      />,
    );

    // Tarjeta
    const select1 = screen.getByRole('combobox');
    fireEvent.change(select1, { target: { value: 'CARD' } });

    // Yape (70)
    fireEvent.click(screen.getByText(/Agregar otro medio/i));
    const select2 = screen.getAllByRole('combobox')[1];
    fireEvent.change(select2, { target: { value: 'YAPE' } });
    let inputs = screen.getAllByRole('spinbutton');
    fireEvent.change(inputs[1], { target: { value: '70' } });

    // Efectivo (40)
    fireEvent.click(screen.getByText(/Agregar otro medio/i));
    const select3 = screen.getAllByRole('combobox')[2];
    fireEvent.change(select3, { target: { value: 'CASH' } });
    inputs = screen.getAllByRole('spinbutton');
    fireEvent.change(inputs[2], { target: { value: '40' } });

    // Residual (Tarjeta) queda en 0 (NO -10)
    expect(inputs[0]).toHaveValue(0);
    expect(inputs[1]).toHaveValue(70);
    expect(inputs[2]).toHaveValue(40);

    // Exceso de 10.00 visible
    expect(screen.getByText(/Exceso de S\/ 10.00 por asignar/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Confirmar Venta/i })).toBeDisabled();
  });

  // F. No aparecen valores negativos
  it('F. No aparecen valores negativos bajo ninguna circunstancia de autoajuste', () => {
    render(
      <CheckoutModal
        store={mockStore}
        selectedClient={null}
        items={mockItems}
        total={100.0}
        cashSession={mockOpenSession}
        onClose={vi.fn()}
        onConfirmSale={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByText(/Agregar otro medio/i));
    const inputs = screen.getAllByRole('spinbutton');

    // Escribir monto exorbitante en método 2 (300)
    fireEvent.change(inputs[1], { target: { value: '300' } });

    // Método residual no debe ser negativo
    expect(Number(inputs[0].getAttribute('value'))).toBeGreaterThanOrEqual(0);
    expect(inputs[0]).toHaveValue(0);
  });

  // G. Precisión monetaria correcta (Caso concreto S/ 32.80 - Efectivo S/ 5.00 -> Tarjeta S/ 27.80)
  it('G. Precisión monetaria exacta sin errores de float (32.80 - 5.00 = 27.80)', () => {
    render(
      <CheckoutModal
        store={mockStore}
        selectedClient={null}
        items={[
          {
            productId: 'p-1',
            productName: 'Item',
            sku: 'SKU-1',
            unitPrice: 32.8,
            quantity: 1,
            lineTotal: 32.8,
          },
        ]}
        total={32.8}
        cashSession={mockOpenSession}
        onClose={vi.fn()}
        onConfirmSale={vi.fn()}
      />,
    );

    // Tarjeta
    const select1 = screen.getByRole('combobox');
    fireEvent.change(select1, { target: { value: 'CARD' } });

    // Agregar Efectivo: 5.00
    fireEvent.click(screen.getByText(/Agregar otro medio/i));
    const select2 = screen.getAllByRole('combobox')[1];
    fireEvent.change(select2, { target: { value: 'CASH' } });
    const inputs = screen.getAllByRole('spinbutton');
    fireEvent.change(inputs[1], { target: { value: '5' } });

    // Tarjeta debe ser exactamente 27.80 (27.8 en number input)
    expect(inputs[0]).toHaveValue(27.8);
    expect(inputs[1]).toHaveValue(5);
    expect(screen.getByText('Monto exacto cubierto')).toBeInTheDocument();
  });

  // H. Tarjeta recalcula recargo correctamente (5% solo de la porción de tarjeta)
  it('H. Tarjeta recalcula recargo 5% únicamente sobre la porción de tarjeta tras autoajuste', () => {
    render(
      <CheckoutModal
        store={mockStore}
        selectedClient={null}
        items={[
          {
            productId: 'p-1',
            productName: 'Item',
            sku: 'SKU-1',
            unitPrice: 32.8,
            quantity: 1,
            lineTotal: 32.8,
          },
        ]}
        total={32.8}
        cashSession={mockOpenSession}
        onClose={vi.fn()}
        onConfirmSale={vi.fn()}
      />,
    );

    // Inicialmente Tarjeta 32.80 -> Recargo 5% sobre 32.80 = 1.64 -> Total a cobrar 34.44
    const select1 = screen.getByRole('combobox');
    fireEvent.change(select1, { target: { value: 'CARD' } });
    expect(screen.getByText(/\+.*S\/\s*1\.64/i)).toBeInTheDocument();
    expect(screen.getByText('S/ 34.44')).toBeInTheDocument();

    // Agregar Efectivo: 5.00 -> Tarjeta autoajusta a 27.80
    fireEvent.click(screen.getByText(/Agregar otro medio/i));
    const select2 = screen.getAllByRole('combobox')[1];
    fireEvent.change(select2, { target: { value: 'CASH' } });
    const inputs = screen.getAllByRole('spinbutton');
    fireEvent.change(inputs[1], { target: { value: '5' } });

    // Recargo debe ser 5% de 27.80 = 1.39 (NO 1.64!)
    expect(screen.getByText(/\+.*S\/\s*1\.39/i)).toBeInTheDocument();
    // TOTAL A COBRAR: 32.80 + 1.39 = 34.19
    expect(screen.getByText('S/ 34.19')).toBeInTheDocument();
    // Botón Confirmar con 34.19
    expect(screen.getByRole('button', { name: /Confirmar Venta.*34\.19/i })).toBeInTheDocument();
  });

  // I. Pago mixto con tarjeta no produce loop de cálculo
  it('I. Múltiples cambios consecutivos con tarjeta no producen loop ni bloqueo de cálculo', () => {
    render(
      <CheckoutModal
        store={mockStore}
        selectedClient={null}
        items={mockItems}
        total={100.0}
        cashSession={mockOpenSession}
        onClose={vi.fn()}
        onConfirmSale={vi.fn()}
      />,
    );

    const select1 = screen.getByRole('combobox');
    fireEvent.change(select1, { target: { value: 'CARD' } });

    fireEvent.click(screen.getByText(/Agregar otro medio/i));
    const select2 = screen.getAllByRole('combobox')[1];
    fireEvent.change(select2, { target: { value: 'CASH' } });

    const inputs = screen.getAllByRole('spinbutton');

    // Cambios rápidos sucesivos
    fireEvent.change(inputs[1], { target: { value: '10' } });
    expect(inputs[0]).toHaveValue(90);

    fireEvent.change(inputs[1], { target: { value: '25' } });
    expect(inputs[0]).toHaveValue(75);

    fireEvent.change(inputs[1], { target: { value: '50' } });
    expect(inputs[0]).toHaveValue(50);

    // Recargo 5% sobre 50 = 2.50 -> Total a cobrar 102.50
    expect(screen.getByText(/\+.*S\/\s*2\.50/i)).toBeInTheDocument();
    expect(screen.getByText('S/ 102.50')).toBeInTheDocument();
  });

  // J. Pago mixto con crédito conserva reglas actuales
  it('J. Pago mixto con crédito (Efectivo 30 + Crédito 70) valida límite de crédito y confirma correctamente', async () => {
    const handleConfirm = vi.fn().mockResolvedValue(undefined);

    render(
      <CheckoutModal
        store={mockStore}
        selectedClient={mockClientWithLimit}
        items={mockItems}
        total={100.0}
        cashSession={mockOpenSession}
        onClose={vi.fn()}
        onConfirmSale={handleConfirm}
      />,
    );

    // Método 1: Crédito (residual)
    const select1 = screen.getByRole('combobox');
    fireEvent.change(select1, { target: { value: 'CREDIT' } });

    // Método 2: Efectivo (30) -> Crédito autoajusta a 70
    fireEvent.click(screen.getByText(/Agregar otro medio/i));
    const select2 = screen.getAllByRole('combobox')[1];
    fireEvent.change(select2, { target: { value: 'CASH' } });
    const inputs = screen.getAllByRole('spinbutton');
    fireEvent.change(inputs[1], { target: { value: '30' } });

    expect(inputs[0]).toHaveValue(70);
    expect(inputs[1]).toHaveValue(30);
    expect(screen.getByText('Monto exacto cubierto')).toBeInTheDocument();

    const confirmBtn = screen.getByRole('button', { name: /Confirmar Venta/i });
    expect(confirmBtn).not.toBeDisabled();
    fireEvent.click(confirmBtn);

    await waitFor(() => {
      expect(handleConfirm).toHaveBeenCalledWith(
        expect.objectContaining({
          clientId: 'cli-01',
          payments: [
            { method: 'CREDIT', amount: 70 },
            { method: 'CASH', amount: 30 },
          ],
          cashReceived: 30,
        }),
      );
    });
  });

  // K. Confirmar se habilita solo cuando cuadra exactamente
  it('K. Botón Confirmar Venta se habilita únicamente cuando la suma cubre exactamente el total', () => {
    render(
      <CheckoutModal
        store={mockStore}
        selectedClient={null}
        items={mockItems}
        total={100.0}
        cashSession={mockOpenSession}
        onClose={vi.fn()}
        onConfirmSale={vi.fn()}
      />,
    );

    const confirmBtn = screen.getByRole('button', { name: /Confirmar Venta/i });
    // Inicialmente cubre 100 -> habilitado
    expect(confirmBtn).not.toBeDisabled();

    // Reducir método 1 a 60 (faltan 40)
    const input1 = screen.getByLabelText(/Monto de pago 1/i);
    fireEvent.change(input1, { target: { value: '60' } });
    expect(confirmBtn).toBeDisabled();

    // Agregar segundo método: auto-cubre 40 -> habilitado
    fireEvent.click(screen.getByText(/Agregar otro medio/i));
    expect(confirmBtn).not.toBeDisabled();

    // Poner segundo método en 50 -> total 110 (exceso de 10) -> deshabilitado
    const inputs = screen.getAllByRole('spinbutton');
    fireEvent.change(inputs[1], { target: { value: '50' } });
    // Autoajuste ajusta input 0 a 50 (100 - 50 = 50) -> total 100 -> habilitado
    expect(inputs[0]).toHaveValue(50);
    expect(confirmBtn).not.toBeDisabled();

    // Si segundo método se pone en 120 (excede 100) -> residual queda en 0, exceso 20 -> deshabilitado
    fireEvent.change(inputs[1], { target: { value: '120' } });
    expect(inputs[0]).toHaveValue(0);
    expect(confirmBtn).toBeDisabled();
  });
});
