import { User } from '../types';

/**
 * Checks if a given user has a specific permission code.
 * If user.permissions is populated, checks it.
 * Administrador role always has access as safety fallback.
 */
export function hasPermission(
  user: User | null,
  permissionCode: string,
  ...aliases: string[]
): boolean {
  if (!user || user.active === false) return false;

  // System Administrator fallback
  if (user.role === 'Administrador') {
    return true;
  }

  const allCodes = [permissionCode, ...aliases];

  // Dynamic permissions array from backend
  if (user.permissions && Array.isArray(user.permissions)) {
    return allCodes.some((code) => user.permissions!.includes(code));
  }

  // Cajero default read-only and basic operational permissions fallback
  if (user.role === 'Cajero') {
    const defaultCajeroPermissions = [
      'product.view',
      'department.view',
      'supplier.view',
      'kit.view',
      'location.view',
      'inventory.view',
      'sales.view',
      'sales.create',
      'cash.open',
      'cash.close',
      'cash.view',
    ];
    return allCodes.some((code) => defaultCajeroPermissions.includes(code));
  }

  return false;
}

export function canViewSales(user: User | null): boolean {
  return hasPermission(user, 'sales.view');
}

export function canCreateSale(user: User | null): boolean {
  return hasPermission(user, 'sales.create');
}

export function canAnnulSale(user: User | null): boolean {
  return hasPermission(user, 'sales.annul');
}

export function canCreateProduct(user: User | null): boolean {
  return hasPermission(user, 'product.create');
}

export function canEditProduct(user: User | null): boolean {
  return hasPermission(user, 'product.edit');
}

export function canManageProducts(user: User | null): boolean {
  return hasPermission(user, 'product.edit');
}

export function canDeactivateProduct(user: User | null): boolean {
  return hasPermission(user, 'product.deactivate');
}

export function canImportProducts(user: User | null): boolean {
  return hasPermission(user, 'product.import');
}

export function canManageDepartments(user: User | null): boolean {
  return hasPermission(user, 'department.manage');
}

export function canManageSuppliers(user: User | null): boolean {
  return hasPermission(user, 'supplier.manage');
}

export function canManageLocations(user: User | null): boolean {
  return hasPermission(user, 'location.manage');
}

export function canViewInventory(user: User | null): boolean {
  return hasPermission(user, 'inventory.view');
}

export function canAddInventory(user: User | null): boolean {
  return hasPermission(user, 'inventory.entry');
}

export function canAdjustInventory(user: User | null): boolean {
  return hasPermission(user, 'inventory.adjust');
}

export function canTransferInventory(user: User | null): boolean {
  return hasPermission(user, 'inventory.transfer');
}

export function canManageMinStock(user: User | null): boolean {
  return hasPermission(user, 'inventory.min_stock');
}

export function canManageCashRegisters(user: User | null): boolean {
  return hasPermission(user, 'cash.manage');
}

export function canCashIn(user: User | null): boolean {
  return hasPermission(user, 'cash.cash_in', 'CAJA_INGRESAR_EFECTIVO');
}

export function canCashOut(user: User | null): boolean {
  return hasPermission(user, 'cash.cash_out', 'CAJA_RETIRAR_EFECTIVO');
}

export function canOpenCash(user: User | null): boolean {
  return hasPermission(user, 'cash.open', 'CAJA_ABRIR_TURNO');
}

export function canCloseCash(user: User | null): boolean {
  return hasPermission(user, 'cash.close', 'CAJA_CERRAR_TURNO');
}

export function canViewCash(user: User | null): boolean {
  return hasPermission(user, 'cash.view', 'CAJA_CONSULTAR_HISTORIAL');
}

