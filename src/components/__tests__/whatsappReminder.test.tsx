import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  interpolateWhatsAppTemplate,
  validateTemplateVariables,
  DEFAULT_WHATSAPP_REMINDER_TEMPLATE,
} from '../../utils/whatsappReminder';
import { WhatsAppReminderConfigView } from '../WhatsAppReminderConfigView';
import { PaymentRemindersModal } from '../PaymentRemindersModal';
import { Client, User } from '../../types';
import * as apiModule from '../../services/api';

vi.mock('../../services/api', () => ({
  api: {
    getWhatsAppReminderConfig: vi.fn(),
    updateWhatsAppReminderConfig: vi.fn(),
    resetWhatsAppReminderConfig: vi.fn(),
  },
}));

describe('WhatsApp Collection Reminder Feature (End-to-End Characterization)', () => {
  const adminUser: User = {
    id: 'admin-1',
    name: 'Admin User',
    email: 'admin@credimanage.com',
    role: 'Administrador',
    active: true,
    approved: true,
  };

  const cashierUser: User = {
    id: 'cashier-1',
    name: 'Cajero User',
    email: 'cajero@credimanage.com',
    role: 'Cajero',
    active: true,
    approved: true,
  };

  const testClientWithDebt: Client = {
    id: 'cli-001',
    clientNumber: 'CLI-1050',
    name: 'Carlos Mendoza',
    phone: '987654321',
    address: 'Av. Las Flores 123',
    creditLimit: 2000,
    currentBalance: 1200, // saldo consolidado
    dailyDebtBalance: 400, // deuda corriente
    bankDebtBalance: 800, // deuda bancaria
    paymentPeriod: 'Quincenal',
    nextDueDate: '2026-10-15',
    status: 'Activo',
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
  };

  const testClientNoPhone: Client = {
    id: 'cli-002',
    clientNumber: 'CLI-1051',
    name: 'María Sin Teléfono',
    phone: '',
    address: 'Calle Luna 456',
    creditLimit: 1000,
    currentBalance: 500,
    dailyDebtBalance: 500,
    bankDebtBalance: 0,
    paymentPeriod: 'Mensual',
    nextDueDate: '2026-10-10',
    status: 'Activo',
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  // =========================================================================
  // 1. VARIABLE INTERPOLATION AND VALIDATION TESTS
  // =========================================================================
  describe('Variable Substitution & Validation', () => {
    it('E. {cliente} se reemplaza correctamente', () => {
      const template = 'Estimado {cliente}, revise su cuenta.';
      const result = interpolateWhatsAppTemplate(template, testClientWithDebt);
      expect(result).toBe('Estimado Carlos Mendoza, revise su cuenta.');
    });

    it('F. {deudaCorriente} utiliza dailyDebtBalance', () => {
      const template = 'Deuda corriente en tienda: {deudaCorriente}.';
      const result = interpolateWhatsAppTemplate(template, testClientWithDebt);
      expect(result).toContain('S/ 400.00');
    });

    it('G. {deudaBancaria} utiliza bankDebtBalance', () => {
      const template = 'Deuda por préstamos: {deudaBancaria}.';
      const result = interpolateWhatsAppTemplate(template, testClientWithDebt);
      expect(result).toContain('S/ 800.00');
    });

    it('H. {saldoConsolidado} utiliza currentBalance', () => {
      const template = 'Saldo total consolidado: {saldoConsolidado}.';
      const result = interpolateWhatsAppTemplate(template, testClientWithDebt);
      expect(result).toContain('S/ 1,200.00');
    });

    it('{codigoCliente}, {saldoPendiente} y {proximaFechaPago} se reemplazan correctamente', () => {
      const template =
        'Cliente: {codigoCliente}, Pendiente: {saldoPendiente}, Vence: {proximaFechaPago}.';
      const result = interpolateWhatsAppTemplate(template, testClientWithDebt);
      expect(result).toContain('CLI-1050');
      expect(result).toContain('S/ 1,200.00');
      expect(result).toContain('2026-10-15');
    });

    it('I. Variable desconocida produce error de validación', () => {
      const invalidTemplate = 'Hola {cliente}, su saldo es {saldo}.';
      const validation = validateTemplateVariables(invalidTemplate);
      expect(validation.isValid).toBe(false);
      expect(validation.invalidVariables).toEqual(['{saldo}']);
    });
  });

  // =========================================================================
  // 2. CONFIGURATION VIEW (ADMIN & CASHIER)
  // =========================================================================
  describe('WhatsAppReminderConfigView Component', () => {
    it('A & D. Administrador puede cargar la configuración existente o predeterminada', async () => {
      (apiModule.api.getWhatsAppReminderConfig as any).mockResolvedValue({
        key: 'WHATSAPP_COLLECTION_REMINDER_TEMPLATE',
        template: DEFAULT_WHATSAPP_REMINDER_TEMPLATE,
        isDefault: true,
        allowedVariables: [
          '{cliente}',
          '{codigoCliente}',
          '{saldoPendiente}',
          '{deudaCorriente}',
          '{deudaBancaria}',
          '{saldoConsolidado}',
          '{proximaFechaPago}',
        ],
        defaultTemplate: DEFAULT_WHATSAPP_REMINDER_TEMPLATE,
      });

      render(<WhatsAppReminderConfigView currentUser={adminUser} />);

      await waitFor(() => {
        expect(apiModule.api.getWhatsAppReminderConfig).toHaveBeenCalled();
      });

      expect(
        screen.getByRole('heading', {
          name: /Recordatorio de Cobranza por WhatsApp/i,
        }),
      ).toBeInTheDocument();
      expect(screen.getByText(/Plantilla Predeterminada/i)).toBeInTheDocument();
      expect(screen.getByDisplayValue(/Hola {cliente}/i)).toBeInTheDocument();
    });

    it('B. Administrador puede modificar la plantilla y guardarla', async () => {
      const user = userEvent.setup();
      (apiModule.api.getWhatsAppReminderConfig as any).mockResolvedValue({
        key: 'WHATSAPP_COLLECTION_REMINDER_TEMPLATE',
        template: DEFAULT_WHATSAPP_REMINDER_TEMPLATE,
        isDefault: false,
        allowedVariables: [],
        defaultTemplate: DEFAULT_WHATSAPP_REMINDER_TEMPLATE,
      });

      (apiModule.api.updateWhatsAppReminderConfig as any).mockResolvedValue({
        key: 'WHATSAPP_COLLECTION_REMINDER_TEMPLATE',
        template: 'Hola {cliente}, recuerda pagar {saldoPendiente}. Gracias.',
        isDefault: false,
        allowedVariables: [],
        defaultTemplate: DEFAULT_WHATSAPP_REMINDER_TEMPLATE,
      });

      render(<WhatsAppReminderConfigView currentUser={adminUser} />);

      const textarea = await screen.findByRole('textbox', {
        name: /Editor de Plantilla/i,
      });
      fireEvent.change(textarea, {
        target: {
          value: 'Hola {cliente}, recuerda pagar {saldoPendiente}. Gracias.',
        },
      });

      const saveBtn = screen.getByRole('button', {
        name: /Guardar Configuración/i,
      });
      await user.click(saveBtn);

      await waitFor(() => {
        expect(
          apiModule.api.updateWhatsAppReminderConfig,
        ).toHaveBeenCalledWith(
          'Hola {cliente}, recuerda pagar {saldoPendiente}. Gracias.',
        );
      });

      expect(
        await screen.findByText(/Plantilla guardada correctamente/i),
      ).toBeInTheDocument();
    });

    it('C. Cajero ve aviso de solo lectura y no puede guardar', async () => {
      (apiModule.api.getWhatsAppReminderConfig as any).mockResolvedValue({
        key: 'WHATSAPP_COLLECTION_REMINDER_TEMPLATE',
        template: DEFAULT_WHATSAPP_REMINDER_TEMPLATE,
        isDefault: true,
        allowedVariables: [],
        defaultTemplate: DEFAULT_WHATSAPP_REMINDER_TEMPLATE,
      });

      render(<WhatsAppReminderConfigView currentUser={cashierUser} />);

      await waitFor(() => {
        expect(apiModule.api.getWhatsAppReminderConfig).toHaveBeenCalled();
      });

      expect(screen.getByText(/Modo solo lectura/i)).toBeInTheDocument();
      expect(
        screen.queryByRole('button', { name: /Guardar Configuración/i }),
      ).not.toBeInTheDocument();
    });

    it('K. Restaurar mensaje predeterminado pide confirmación y no guarda automáticamente', async () => {
      const user = userEvent.setup();
      const customTemplate = 'Texto personalizado previo.';
      (apiModule.api.getWhatsAppReminderConfig as any).mockResolvedValue({
        key: 'WHATSAPP_COLLECTION_REMINDER_TEMPLATE',
        template: customTemplate,
        isDefault: false,
        allowedVariables: [],
        defaultTemplate: DEFAULT_WHATSAPP_REMINDER_TEMPLATE,
      });

      render(<WhatsAppReminderConfigView currentUser={adminUser} />);

      const restoreBtn = await screen.findByRole('button', {
        name: /Restaurar mensaje predeterminado/i,
      });
      await user.click(restoreBtn);

      // Confirm modal opens
      expect(
        screen.getByText(
          /Esta acción no guardará el cambio en la base de datos automáticamente/i,
        ),
      ).toBeInTheDocument();

      const confirmBtn = screen.getByRole('button', {
        name: /Sí, restaurar plantilla/i,
      });
      await user.click(confirmBtn);

      // Textarea now contains default template
      const textarea = screen.getByRole('textbox', {
        name: /Editor de Plantilla/i,
      });
      expect(textarea).toHaveValue(DEFAULT_WHATSAPP_REMINDER_TEMPLATE);

      // BUT updateWhatsAppReminderConfig was NOT called yet!
      expect(apiModule.api.updateWhatsAppReminderConfig).not.toHaveBeenCalled();
    });

    it('I. Muestra error visual e impide guardar cuando hay variables no reconocidas', async () => {
      const user = userEvent.setup();
      (apiModule.api.getWhatsAppReminderConfig as any).mockResolvedValue({
        key: 'WHATSAPP_COLLECTION_REMINDER_TEMPLATE',
        template: DEFAULT_WHATSAPP_REMINDER_TEMPLATE,
        isDefault: false,
        allowedVariables: [],
        defaultTemplate: DEFAULT_WHATSAPP_REMINDER_TEMPLATE,
      });

      render(<WhatsAppReminderConfigView currentUser={adminUser} />);

      const textarea = await screen.findByRole('textbox', {
        name: /Editor de Plantilla/i,
      });
      fireEvent.change(textarea, {
        target: { value: 'Hola {cliente}, tu saldo es {saldo}.' },
      });

      expect(
        screen.getByText(/Variable no reconocida:/i),
      ).toBeInTheDocument();
      expect(screen.getByText('{saldo}')).toBeInTheDocument();

      const saveBtn = screen.getByRole('button', {
        name: /Guardar Configuración/i,
      });
      expect(saveBtn).toBeDisabled();
    });
  });

  // =========================================================================
  // 3. PAYMENT REMINDERS MODAL INTEGRATION
  // =========================================================================
  describe('PaymentRemindersModal WhatsApp Flow', () => {
    it('L. Cliente sin teléfono no intenta abrir WhatsApp y muestra mensaje controlado', async () => {
      const user = userEvent.setup();
      const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null);

      (apiModule.api.getWhatsAppReminderConfig as any).mockResolvedValue({
        key: 'WHATSAPP_COLLECTION_REMINDER_TEMPLATE',
        template: DEFAULT_WHATSAPP_REMINDER_TEMPLATE,
        isDefault: true,
        allowedVariables: [],
        defaultTemplate: DEFAULT_WHATSAPP_REMINDER_TEMPLATE,
      });

      render(
        <PaymentRemindersModal
          isOpen={true}
          onClose={vi.fn()}
          clients={[testClientNoPhone]}
          onPayClient={vi.fn()}
          onAddDebtClient={vi.fn()}
          onViewStatement={vi.fn()}
        />,
      );

      // Select 'Total con Deuda Activa' status to ensure client appears
      const todosFilterBtn = screen.getByRole('button', {
        name: /Total con Deuda Activa/i,
      });
      await user.click(todosFilterBtn);

      const waBtn = screen.getByTitle(/Sin teléfono registrado/i);
      await user.click(waBtn);

      // Shows controlled message
      expect(
        screen.getByText(
          'El cliente no tiene un número de teléfono registrado.',
        ),
      ).toBeInTheDocument();

      // Does NOT open window
      expect(openSpy).not.toHaveBeenCalled();

      openSpy.mockRestore();
    });

    it('J & M. Cliente con teléfono abre modal de edición previa sin cambiar la plantilla global y envía por WhatsApp', async () => {
      const user = userEvent.setup();
      const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null);

      (apiModule.api.getWhatsAppReminderConfig as any).mockResolvedValue({
        key: 'WHATSAPP_COLLECTION_REMINDER_TEMPLATE',
        template:
          'Hola {cliente}, le recordamos su deuda de {deudaCorriente}.',
        isDefault: false,
        allowedVariables: [],
        defaultTemplate: DEFAULT_WHATSAPP_REMINDER_TEMPLATE,
      });

      render(
        <PaymentRemindersModal
          isOpen={true}
          onClose={vi.fn()}
          clients={[testClientWithDebt]}
          onPayClient={vi.fn()}
          onAddDebtClient={vi.fn()}
          onViewStatement={vi.fn()}
        />,
      );

      // Select 'Total con Deuda Activa' status
      const todosFilterBtn = screen.getByRole('button', {
        name: /Total con Deuda Activa/i,
      });
      await user.click(todosFilterBtn);

      const waBtn = screen.getByTitle(/Enviar Recordatorio por WhatsApp/i);
      await user.click(waBtn);

      // Edit before send modal opens
      expect(
        screen.getByRole('heading', {
          name: /Enviar Recordatorio por WhatsApp/i,
        }),
      ).toBeInTheDocument();

      const sendTextarea = screen.getByRole('textbox', {
        name: /Mensaje a enviar por WhatsApp/i,
      });
      expect(sendTextarea).toHaveValue(
        'Hola Carlos Mendoza, le recordamos su deuda de S/ 400.00.',
      );

      // User edits message for this send only
      fireEvent.change(sendTextarea, {
        target: {
          value:
            'Hola Carlos Mendoza, le recordamos su deuda de S/ 400.00. Saludos cordiales.',
        },
      });

      // Click "Abrir WhatsApp"
      const abrirBtn = screen.getByRole('button', { name: /Abrir WhatsApp/i });
      await user.click(abrirBtn);

      // Verifies window.open was called with clean phone and edited message
      expect(openSpy).toHaveBeenCalledWith(
        expect.stringContaining(
          'https://wa.me/987654321?text=Hola%20Carlos%20Mendoza%2C%20le%20recordamos%20su%20deuda%20de%20S%2F%20400.00.%20Saludos%20cordiales.',
        ),
        '_blank',
      );

      // J: Verifies that updating text in send modal did NOT modify the global template in backend
      expect(
        apiModule.api.updateWhatsAppReminderConfig,
      ).not.toHaveBeenCalled();

      openSpy.mockRestore();
    });
  });
});
