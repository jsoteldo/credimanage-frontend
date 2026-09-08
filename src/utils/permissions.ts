import { User } from '../types';

/**
 * Checks if a given user has a specific permission code.
 * If user.permissions is populated, checks it.
 * Administrador role always has access as safety fallback.
 */
export function hasPermission(user: User | null, permissionCode: string): boolean {
  if (!user || !user.active) return false;

  // System Administrator fallback
  if (user.role === 'Administrador') {
    return true;
  }

  // Dynamic permissions array from backend
  if (user.permissions && Array.isArray(user.permissions)) {
    return user.permissions.includes(permissionCode);
  }

  // Cajero default read-only permissions fallback
  if (user.role === 'Cajero') {
    return [
      'product.view',
      'department.view',
      'supplier.view',
      'kit.view',
      'location.view',
    ].includes(permissionCode);
  }

  return false;
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
