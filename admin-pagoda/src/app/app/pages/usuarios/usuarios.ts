import { ChangeDetectorRef, Component, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ApiClientService } from '../../core/api/api-client.service';
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
  estado: 'activo' | 'inactivo';
  activo: boolean;
}

interface UserForm {
  nombre: string;
  rolId: number | null;
  pin: string;
}

@Component({
  selector: 'app-usuarios',
  imports: [FormsModule],
  templateUrl: './usuarios.html',
  styleUrl: './usuarios.css',
})
export class Usuarios implements OnInit {
  protected roles: RolApi[] = [];
  protected users: UserRow[] = [];
  protected showDialog = false;
  protected isSaving = signal(false);
  protected form: UserForm = {
    nombre: '',
    rolId: null,
    pin: '',
  };

  constructor(
    private readonly apiClient: ApiClientService,
    private readonly toastService: ToastService,
    private readonly cdr: ChangeDetectorRef,
  ) {}

  async ngOnInit(): Promise<void> {
    await this.loadInitialData();
  }

  protected openDialog(): void {
    this.showDialog = true;
    this.form = {
      nombre: '',
      rolId: this.roles[0]?.id ?? null,
      pin: '',
    };
  }

  protected closeDialog(): void {
    this.showDialog = false;
    this.isSaving.set(false);
  }

  protected async addUser(): Promise<void> {
    if (this.isSaving()) {
      return;
    }
    const pin = this.form.pin.trim();

    if (!this.form.nombre.trim() || this.form.rolId === null || !/^\d{6}$/.test(pin)) {
      this.toastService.error('Nombre, rol y PIN de 6 digitos son obligatorios.');
      return;
    }

    this.isSaving.set(true);
    try {
      await this.apiClient.post<UsuarioApi, { nombre: string; rolId: number; pin: string }>(
        '/api/operacion/usuarios',
        {
          nombre: this.form.nombre.trim(),
          rolId: this.form.rolId,
          pin,
        },
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

  protected async deactivateUser(userId: number): Promise<void> {
    const user = this.users.find((item) => item.id === userId);

    if (!user || !user.activo) {
      return;
    }

    try {
      await this.apiClient.delete(`/api/operacion/usuarios/${userId}`);
      await this.loadUsers();
      this.toastService.success('Usuario desactivado correctamente.');
    } catch (error) {
      const message =
        error instanceof Error && error.message
          ? error.message
          : 'No se pudo desactivar el usuario.';
      this.toastService.error(message);
    }
  }

  private async loadInitialData(): Promise<void> {
    try {
      const [roles, usuarios] = await Promise.all([
        this.apiClient.get<RolApi[]>('/api/catalogos/roles'),
        this.apiClient.get<UsuarioApi[]>('/api/operacion/usuarios'),
      ]);

      this.roles = roles;
      this.users = usuarios.map((usuario) => this.mapUser(usuario));
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
      estado: activo ? 'activo' : 'inactivo',
      activo,
    };
  }
}
