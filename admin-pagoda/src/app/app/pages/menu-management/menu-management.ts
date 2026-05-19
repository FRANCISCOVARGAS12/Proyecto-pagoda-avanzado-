import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ApiClientService } from '../../core/api/api-client.service';
import { AuthService } from '../../core/auth/auth.service';
import { ToastService } from '../../core/ui/toast.service';

interface Categoria {
  id: number;
  nombre: string;
  descripcion: string | null;
}

interface ProductoApi {
  id: number;
  nombre: string;
  descripcion: string | null;
  precio: number;
  activo: boolean;
  categoria: Categoria;
}

interface Product {
  id: number;
  nombre: string;
  precio: number;
  categoria: string;
  categoriaId: number;
  descripcion: string;
}

interface ProductForm {
  nombre: string;
  precio: number | null;
  categoriaId: number | null;
  descripcion: string;
}

type ProtectedMenuAction = 'add' | 'edit' | 'delete';

@Component({
  selector: 'app-menu-management',
  imports: [FormsModule],
  templateUrl: './menu-management.html',
  styleUrl: './menu-management.css',
})
export class MenuManagement implements OnInit {
  protected categories: Categoria[] = [];
  protected products: Product[] = [];
  protected showDialog = false;
  protected showAuthDialog = false;
  protected editingProductId: number | null = null;
  protected form: ProductForm = {
    nombre: '',
    precio: null,
    categoriaId: null,
    descripcion: '',
  };
  protected searchQuery = '';
  protected selectedCategory = 'all';
  protected authPassword = '';
  protected authAction: ProtectedMenuAction | null = null;
  protected authProduct: Product | null = null;
  protected isAuthorizing = false;
  protected isSaving = false;

  constructor(
    private readonly apiClient: ApiClientService,
    private readonly authService: AuthService,
    private readonly toastService: ToastService,
    private readonly cdr: ChangeDetectorRef,
  ) {}

  async ngOnInit(): Promise<void> {
    await this.loadCatalog();
  }

  protected get filteredProducts(): Product[] {
    const query = this.searchQuery.trim().toLowerCase();

    return this.products.filter((product) => {
      const matchName = !query || product.nombre.toLowerCase().includes(query);
      const matchCategory =
        this.selectedCategory === 'all' || product.categoria === this.selectedCategory;
      return matchName && matchCategory;
    });
  }

  protected openAddDialog(): void {
    this.requestSuperuser('add');
  }

  protected openEditDialog(product: Product): void {
    this.requestSuperuser('edit', product);
  }

  protected closeDialog(): void {
    if (this.isSaving) {
      return;
    }
    this.showDialog = false;
  }

  protected removeProduct(product: Product): void {
    this.requestSuperuser('delete', product);
  }

  protected closeAuthDialog(): void {
    if (this.isAuthorizing) {
      return;
    }
    this.showAuthDialog = false;
    this.authPassword = '';
    this.authAction = null;
    this.authProduct = null;
  }

  protected async confirmProtectedAction(): Promise<void> {
    if (this.isAuthorizing || !this.authAction) {
      return;
    }
    const password = this.authPassword.trim();
    if (!password) {
      this.toastService.error('Introduce la contraseña de superusuario.');
      return;
    }

    this.isAuthorizing = true;
    try {
      const verification = await this.authService.verifySuperuser(password);
      if (!verification.ok) {
        this.toastService.error(verification.message);
        return;
      }

      const action = this.authAction;
      const product = this.authProduct;
      this.showAuthDialog = false;
      this.authPassword = '';
      this.authAction = null;
      this.authProduct = null;

      if (action === 'add') {
        this.openAddDialogAuthorized();
        return;
      }
      if (action === 'edit' && product) {
        this.openEditDialogAuthorized(product);
        return;
      }
      if (action === 'delete' && product) {
        await this.performRemoveProduct(product.id);
      }
    } finally {
      this.isAuthorizing = false;
      this.cdr.detectChanges();
    }
  }

  protected authDialogTitle(): string {
    if (this.authAction === 'delete') return 'Eliminar platillo';
    if (this.authAction === 'edit') return 'Editar platillo';
    return 'Añadir platillo';
  }

  protected authDialogBody(): string {
    const productName = this.authProduct?.nombre;
    if (this.authAction === 'delete' && productName) {
      return `Para eliminar "${productName}" se necesita la contraseña de superusuario.`;
    }
    if (this.authAction === 'edit' && productName) {
      return `Para editar "${productName}" se necesita la contraseña de superusuario.`;
    }
    return 'Para añadir un nuevo platillo se necesita la contraseña de superusuario.';
  }

  protected authConfirmLabel(): string {
    if (this.isAuthorizing) return 'Verificando...';
    if (this.authAction === 'delete') return 'Verificar y eliminar';
    if (this.authAction === 'edit') return 'Verificar y editar';
    return 'Verificar y continuar';
  }

  private requestSuperuser(action: ProtectedMenuAction, product: Product | null = null): void {
    this.authAction = action;
    this.authProduct = product;
    this.authPassword = '';
    this.showAuthDialog = true;
  }

  private openAddDialogAuthorized(): void {
    this.editingProductId = null;
    this.form = {
      nombre: '',
      precio: null,
      categoriaId: this.categories[0]?.id ?? null,
      descripcion: '',
    };
    this.showDialog = true;
  }

  private openEditDialogAuthorized(product: Product): void {
    this.editingProductId = product.id;
    this.form = {
      nombre: product.nombre,
      precio: product.precio,
      categoriaId: product.categoriaId,
      descripcion: product.descripcion,
    };
    this.showDialog = true;
  }

  private async performRemoveProduct(id: number): Promise<void> {
    try {
      await this.apiClient.deleteWithHeaders(
        `/api/productos/${id}`,
        this.authService.superuserHeaders(),
      );
      this.products = this.products.filter((product) => product.id !== id);
      this.toastService.success('Platillo eliminado correctamente.');
      this.cdr.detectChanges();
    } catch (error) {
      const message =
        error instanceof Error && error.message ? error.message : 'No se pudo eliminar el platillo.';
      this.toastService.error(message);
      this.cdr.detectChanges();
    }
  }

  protected async saveProduct(): Promise<void> {
    if (this.isSaving) {
      return;
    }
    if (!this.form.nombre.trim() || this.form.precio === null || this.form.categoriaId === null) {
      this.toastService.error('Completa nombre, precio y categoria.');
      return;
    }

    const payload = {
      nombre: this.form.nombre.trim(),
      descripcion: this.form.descripcion.trim(),
      precio: this.form.precio,
      categoriaId: this.form.categoriaId,
      activo: true,
    };

    this.isSaving = true;
    try {
      if (this.editingProductId !== null) {
        await this.apiClient.putWithHeaders<ProductoApi, typeof payload>(
          `/api/productos/${this.editingProductId}`,
          payload,
          this.authService.superuserHeaders(),
        );
      } else {
        await this.apiClient.postWithHeaders<ProductoApi, typeof payload>(
          '/api/productos',
          payload,
          this.authService.superuserHeaders(),
        );
      }

      await this.loadProducts();
      this.showDialog = false;
      this.toastService.success(
        this.editingProductId !== null
          ? 'Platillo actualizado correctamente.'
          : 'Platillo creado correctamente.',
      );
      this.cdr.detectChanges();
    } catch (error) {
      const message =
        error instanceof Error && error.message ? error.message : 'No se pudo guardar el producto.';
      this.toastService.error(message);
      this.cdr.detectChanges();
    } finally {
      this.isSaving = false;
      this.cdr.detectChanges();
    }
  }

  protected clearFilters(): void {
    this.searchQuery = '';
    this.selectedCategory = 'all';
  }

  private async loadCatalog(): Promise<void> {
    try {
      const [categorias, productos] = await Promise.all([
        this.apiClient.get<Categoria[]>('/api/categorias'),
        this.apiClient.get<ProductoApi[]>('/api/productos'),
      ]);

      this.categories = categorias;
      this.products = productos.map((product) => this.mapProduct(product));
      this.cdr.detectChanges();
    } catch (error) {
      const message =
        error instanceof Error && error.message
          ? error.message
          : 'No se pudieron cargar categorias y productos.';
      this.toastService.error(message);
      this.cdr.detectChanges();
    }
  }

  private async loadProducts(): Promise<void> {
    const productos = await this.apiClient.get<ProductoApi[]>('/api/productos');
    this.products = productos.map((product) => this.mapProduct(product));
    this.cdr.detectChanges();
  }

  private mapProduct(product: ProductoApi): Product {
    return {
      id: product.id,
      nombre: product.nombre,
      precio: Number(product.precio),
      categoria: product.categoria?.nombre ?? 'Sin categoria',
      categoriaId: product.categoria?.id ?? 0,
      descripcion: product.descripcion ?? '',
    };
  }
}
