import { Component, OnInit } from '@angular/core';
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
  protected form: UserForm = {
    nombre: '',
    rolId: null,
    pin: '',
  };

  constructor(
    private readonly apiClient: ApiClientService,
    private readonly toastService: ToastService,
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
  }

  protected async addUser(): Promise<void> {
    const pin = this.form.pin.trim();

    if (!this.form.nombre.trim() || this.form.rolId === null || !/^\d{4,8}$/.test(pin)) {
      this.toastService.error('Nombre, rol y PIN de 4 a 8 digitos son obligatorios.');
      return;
    }

    try {
      await this.apiClient.post<UsuarioApi, { nombre: string; rolId: number; pin: string }>(
        '/api/operacion/usuarios',
        {
          nombre: this.form.nombre.trim(),
          rolId: this.form.rolId,
          pin,
        },
      );

      await this.loadUsers();
      this.closeDialog();
      this.toastService.success('Usuario creado correctamente.');
    } catch (error) {
      const message =
        error instanceof Error && error.message ? error.message : 'No se pudo crear el usuario.';
      this.toastService.error(message);
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
    } catch (error) {
      const message =
        error instanceof Error && error.message
          ? error.message
          : 'No se pudieron cargar usuarios y roles.';
      this.toastService.error(message);
    }
  }

  private async loadUsers(): Promise<void> {
    const usuarios = await this.apiClient.get<UsuarioApi[]>('/api/operacion/usuarios');
    this.users = usuarios.map((usuario) => this.mapUser(usuario));
  }

  private mapUser(usuario: UsuarioApi): UserRow {
    const activo = Boolean(usuario.activo);
    return {
      id: usuario.id,
      nombre: usuario.nombre,
      rol: usuario.rol,
      estado: activo ? 'activo' : 'inactivo',
      activo,
    };
  }
}
