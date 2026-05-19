import { ChangeDetectorRef, Component, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ApiClientService } from '../../core/api/api-client.service';
import { AuthService } from '../../core/auth/auth.service';
import { AdminSettingsService } from '../../core/ui/admin-settings.service';
import { ToastService } from '../../core/ui/toast.service';

interface RolApi {
  id: number;
  nombre: string;
}

interface UsuarioApi {
  id: number;
  nombre: string;
  rol: string;
  activo: boolean;
}

interface UserRow {
  id: number;
  nombre: string;
  rol: string;
  rolId: number | null;
  estado: 'activo' | 'inactivo';
  activo: boolean;
}

interface UserForm {
  nombre: string;
  rolId: number | null;
  pin: string;
}

type ProtectedUserAction = 'create' | 'edit' | 'reactivate';
type UserFilter = 'activos' | 'inactivos';

@Component({
  selector: 'app-usuarios',
  imports: [FormsModule],
  templateUrl: './usuarios.html',
  styleUrl: './usuarios.css',
})
export class Usuarios implements OnInit {
  protected roles: RolApi[] = [];
  protected users: UserRow[] = [];
  protected userFilter: UserFilter = 'activos';
  protected showDialog = false;
  protected editingUserId: number | null = null;
  protected isSaving = signal(false);
  protected authDialogVisible = false;
  protected authPassword = '';
  protected authAction: ProtectedUserAction | null = null;
  protected authUserId: number | null = null;
  protected isAuthorizing = signal(false);
  protected deleteDialogVisible = false;
  protected deleteTarget: UserRow | null = null;
  protected deleteSuperPassword = '';
  protected isDeleting = signal(false);
  protected editingUserWasActive = true;
  protected form: UserForm = {
    nombre: '',
    rolId: null,
    pin: '',
  };

  constructor(
    private readonly apiClient: ApiClientService,
    private readonly authService: AuthService,
    private readonly adminSettingsService: AdminSettingsService,
    private readonly toastService: ToastService,
    private readonly cdr: ChangeDetectorRef,
  ) {}

  async ngOnInit(): Promise<void> {
    await this.loadInitialData();
  }

  protected get filteredUsers(): UserRow[] {
    const shouldBeActive = this.userFilter === 'activos';
    return this.users.filter((user) => user.activo === shouldBeActive);
  }

  protected setUserFilter(filter: UserFilter): void {
    this.userFilter = filter;
  }

  protected activeCount(): number {
    return this.users.filter((user) => user.activo).length;
  }

  protected inactiveCount(): number {
    return this.users.filter((user) => !user.activo).length;
  }

  protected openDialog(): void {
    this.requestUserAuthorization('create');
  }

  protected openEditDialog(userId: number): void {
    this.requestUserAuthorization('edit', userId);
  }

  protected reactivateUser(userId: number): void {
    this.requestUserAuthorization('reactivate', userId);
  }

  protected closeAuthDialog(): void {
    if (this.isAuthorizing()) {
      return;
    }

    this.authDialogVisible = false;
    this.authPassword = '';
    this.authAction = null;
    this.authUserId = null;
  }

  protected async confirmUserAuthorization(): Promise<void> {
    if (this.isAuthorizing() || !this.authAction) {
      return;
    }

    const password = this.authPassword.trim();
    if (!password) {
      this.toastService.error('Introduce la contraseña de superusuario.');
      return;
    }

    this.isAuthorizing.set(true);
    try {
      const verification = await this.authService.verifySuperuser(password);
      if (!verification.ok) {
        this.toastService.error(verification.message);
        return;
      }

      const action = this.authAction;
      const userId = this.authUserId;
      this.authDialogVisible = false;
      this.authPassword = '';
      this.authAction = null;
      this.authUserId = null;

      if (action === 'create') {
        this.openDialogAuthorized();
        return;
      }
      if ((action === 'edit' || action === 'reactivate') && userId !== null) {
        this.openEditDialogAuthorized(userId);
      }
    } finally {
      this.isAuthorizing.set(false);
      this.cdr.detectChanges();
    }
  }

  protected authDialogTitle(): string {
    if (this.authAction === 'reactivate') {
      return 'Reactivar usuario';
    }
    return this.authAction === 'edit' ? 'Editar usuario' : 'Agregar usuario';
  }

  protected authDialogBody(): string {
    if (this.authAction === 'reactivate') {
      return 'Para reactivar este usuario se necesita la contraseña de superusuario.';
    }
    if (this.authAction === 'edit') {
      return 'Para editar este usuario se necesita la contraseña de superusuario.';
    }
    return 'Para agregar un nuevo usuario se necesita la contraseña de superusuario.';
  }

  private requestUserAuthorization(action: ProtectedUserAction, userId: number | null = null): void {
    this.authAction = action;
    this.authUserId = userId;
    this.authPassword = '';
    this.authDialogVisible = true;
  }

  private openDialogAuthorized(): void {
    this.showDialog = true;
    this.editingUserId = null;
    this.editingUserWasActive = true;
    this.form = {
      nombre: '',
      rolId: this.resolveDefaultRoleId(),
      pin: '',
    };
  }

  private openEditDialogAuthorized(userId: number): void {
    const user = this.users.find((item) => item.id === userId);
    if (!user) {
      return;
    }
    this.showDialog = true;
    this.editingUserId = user.id;
    this.editingUserWasActive = user.activo;
    this.form = {
      nombre: user.nombre,
      rolId: user.rolId ?? this.resolveDefaultRoleId(),
      pin: '',
    };
  }

  protected closeDialog(): void {
    this.showDialog = false;
    this.editingUserId = null;
    this.editingUserWasActive = true;
    this.isSaving.set(false);
  }

  protected async submitUser(): Promise<void> {
    if (this.editingUserId === null) {
      await this.addUser();
      return;
    }
    await this.updateUser();
  }

  protected isEditing(): boolean {
    return this.editingUserId !== null;
  }

  protected isReactivating(): boolean {
    return this.isEditing() && !this.editingUserWasActive;
  }

  private async addUser(): Promise<void> {
    if (this.isSaving()) {
      return;
    }
    const pin = this.form.pin.trim();
    const nombre = this.form.nombre.trim();

    if (!nombre || this.form.rolId === null || !/^\d{6}$/.test(pin)) {
      this.toastService.error('Nombre, rol y PIN de 6 digitos son obligatorios.');
      return;
    }
    const duplicate = this.findUserByName(nombre);
    if (duplicate?.activo) {
      this.toastService.error('Ya existe un usuario activo con ese nombre.');
      return;
    }
    if (duplicate && !duplicate.activo) {
      this.toastService.error('Ya existe un usuario inactivo con ese nombre. Ve a Inactivos para reactivarlo o usa otro nombre.');
      return;
    }

    this.isSaving.set(true);
    try {
      await this.apiClient.postWithHeaders<UsuarioApi, { nombre: string; rolId: number; pin: string }>(
        '/api/operacion/usuarios',
        {
          nombre,
          rolId: this.form.rolId,
          pin,
        },
        this.authService.superuserHeaders(),
      );

      this.toastService.success('Usuario creado correctamente.');
      await this.loadUsers();
      this.closeDialog();
    } catch (error) {
      const message =
        error instanceof Error && error.message ? error.message : 'No se pudo crear el usuario.';
      this.toastService.error(message);
    } finally {
      this.isSaving.set(false);
    }
  }

  private async updateUser(): Promise<void> {
    if (this.isSaving() || this.editingUserId === null) {
      return;
    }
    const nombre = this.form.nombre.trim();
    const pin = this.form.pin.trim();

    if (!nombre || this.form.rolId === null) {
      this.toastService.error('Nombre y rol son obligatorios.');
      return;
    }
    if (pin && !/^\d{6}$/.test(pin)) {
      this.toastService.error('El PIN debe tener 6 digitos.');
      return;
    }
    if (this.isReactivating() && !pin) {
      this.toastService.error('Para reactivar un usuario, asigna un PIN nuevo de 6 digitos.');
      return;
    }
    const duplicate = this.findUserByName(nombre, this.editingUserId);
    if (duplicate?.activo) {
      this.toastService.error('Ya existe un usuario activo con ese nombre.');
      return;
    }
    if (duplicate && !duplicate.activo) {
      this.toastService.error('Ya existe un usuario inactivo con ese nombre. Ve a Inactivos para reactivarlo o usa otro nombre.');
      return;
    }

    this.isSaving.set(true);
    try {
      await this.apiClient.putWithHeaders<
        UsuarioApi,
        { nombre: string; rolId: number; pin: string | null; activo: boolean }
      >(`/api/operacion/usuarios/${this.editingUserId}`, {
        nombre,
        rolId: this.form.rolId,
        pin: pin || null,
        activo: true,
      }, this.authService.superuserHeaders());

      this.toastService.success(this.isReactivating() ? 'Usuario reactivado correctamente.' : 'Usuario actualizado correctamente.');
      await this.loadUsers();
      if (this.isReactivating()) {
        this.userFilter = 'activos';
      }
      this.closeDialog();
    } catch (error) {
      const message =
        error instanceof Error && error.message ? error.message : 'No se pudo actualizar el usuario.';
      this.toastService.error(message);
    } finally {
      this.isSaving.set(false);
    }
  }

  protected async deactivateUser(userId: number): Promise<void> {
    const user = this.users.find((item) => item.id === userId);

    if (!user || !user.activo) {
      return;
    }
    if (!this.canDeactivate(user)) {
      this.toastService.error(this.deactivateDisabledReason(user));
      return;
    }

    this.deleteTarget = user;
    this.deleteSuperPassword = '';
    this.deleteDialogVisible = true;
  }

  protected closeDeleteDialog(): void {
    if (this.isDeleting()) {
      return;
    }

    this.deleteDialogVisible = false;
    this.deleteTarget = null;
    this.deleteSuperPassword = '';
  }

  protected async confirmDeleteUser(): Promise<void> {
    const user = this.deleteTarget;
    const password = this.deleteSuperPassword.trim();

    if (!user || this.isDeleting()) {
      return;
    }
    if (!password) {
      this.toastService.error('Introduce la contraseña de superusuario.');
      return;
    }

    this.isDeleting.set(true);
    try {
      const verification = await this.authService.verifySuperuser(password);
      if (!verification.ok) {
        this.toastService.error(verification.message);
        return;
      }

      await this.apiClient.deleteWithHeaders(
        `/api/operacion/usuarios/${user.id}`,
        this.authService.superuserHeaders(),
      );
      this.users = this.users.map((item) =>
        item.id === user.id
          ? { ...item, activo: false, estado: 'inactivo' }
          : item,
      );
      this.deleteDialogVisible = false;
      this.deleteTarget = null;
      this.deleteSuperPassword = '';
      this.cdr.detectChanges();
      this.toastService.success('Usuario desactivado correctamente.');
    } catch (error) {
      const message =
        error instanceof Error && error.message
          ? error.message
          : 'No se pudo desactivar el usuario.';
      this.toastService.error(message);
    } finally {
      this.isDeleting.set(false);
    }
  }

  private async loadInitialData(): Promise<void> {
    try {
      const [roles, usuarios] = await Promise.all([
        this.apiClient.get<RolApi[]>('/api/catalogos/roles'),
        this.apiClient.get<UsuarioApi[]>('/api/operacion/usuarios'),
      ]);

      this.roles = roles;
      this.users = usuarios
        .map((usuario) => this.mapUser(usuario))
        .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es', { sensitivity: 'base' }));
      this.cdr.detectChanges();
    } catch (error) {
      const message =
        error instanceof Error && error.message
          ? error.message
          : 'No se pudieron cargar usuarios y roles.';
      this.toastService.error(message);
      this.cdr.detectChanges();
    }
  }

  private async loadUsers(): Promise<void> {
    try {
      const usuarios = await this.apiClient.get<UsuarioApi[]>('/api/operacion/usuarios');
      this.users = usuarios
        .map((usuario) => this.mapUser(usuario))
        .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es', { sensitivity: 'base' }));
      this.cdr.detectChanges();
    } catch (error) {
      const message =
        error instanceof Error && error.message
          ? error.message
          : 'No se pudieron cargar los usuarios.';
      this.toastService.error(message);
      this.cdr.detectChanges();
    }
  }

  private mapUser(usuario: UsuarioApi): UserRow {
    const activo = Boolean(usuario.activo);
    const nombre = (usuario.nombre ?? '').toString().trim();
    const rol = (usuario.rol ?? '').toString().trim();
    return {
      id: usuario.id,
      nombre: nombre || 'Sin nombre',
      rol: rol || 'Sin rol',
      rolId: this.resolveRoleIdByName(rol),
      estado: activo ? 'activo' : 'inactivo',
      activo,
    };
  }

  private resolveRoleIdByName(rolNombre: string): number | null {
    const normalized = (rolNombre ?? '').trim().toUpperCase();
    if (!normalized) {
      return null;
    }
    const match = this.roles.find((rol) => rol.nombre.toUpperCase() === normalized);
    return match?.id ?? null;
  }

  private resolveDefaultRoleId(): number | null {
    if (!this.roles.length) {
      return null;
    }

    const preferredRole = this.adminSettingsService.snapshot().defaultRoleName.toUpperCase();
    const match = this.roles.find((role) => role.nombre.toUpperCase() === preferredRole);
    if (match) {
      return match.id;
    }

    return this.roles[0]?.id ?? null;
  }

  protected canDeactivate(user: UserRow): boolean {
    if (!user.activo) {
      return false;
    }
    if (this.isCurrentUser(user)) {
      return false;
    }
    return !(this.isAdminUser(user) && this.activeAdminCount() <= 1);
  }

  protected deactivateDisabledReason(user: UserRow): string {
    if (!user.activo) {
      return 'El usuario ya esta inactivo.';
    }
    if (this.isCurrentUser(user)) {
      return 'No puedes desactivar el usuario con el que tienes la sesion iniciada.';
    }
    if (this.isAdminUser(user) && this.activeAdminCount() <= 1) {
      return 'Debe existir al menos un administrador activo.';
    }
    return 'Desactivar usuario';
  }

  private activeAdminCount(): number {
    return this.users.filter((user) => user.activo && this.isAdminUser(user)).length;
  }

  private isAdminUser(user: UserRow): boolean {
    return user.rol.trim().toUpperCase() === 'ADMIN';
  }

  private isCurrentUser(user: UserRow): boolean {
    return user.id === this.authService.userId();
  }

  private findUserByName(nombre: string, excludeId: number | null = null): UserRow | undefined {
    const normalized = this.normalizeUserName(nombre);
    return this.users.find((user) =>
      (excludeId === null || user.id !== excludeId) &&
      this.normalizeUserName(user.nombre) === normalized
    );
  }

  private normalizeUserName(nombre: string): string {
    return (nombre ?? '').trim().replace(/\s+/g, ' ').toLowerCase();
  }
}
