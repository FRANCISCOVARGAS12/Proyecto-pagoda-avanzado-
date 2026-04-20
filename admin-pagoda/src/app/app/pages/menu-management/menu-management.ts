import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ApiClientService } from '../../core/api/api-client.service';
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
  protected editingProductId: number | null = null;
  protected form: ProductForm = {
    nombre: '',
    precio: null,
    categoriaId: null,
    descripcion: '',
  };
  protected searchQuery = '';
  protected selectedCategory = 'all';

  constructor(
    private readonly apiClient: ApiClientService,
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
    this.editingProductId = null;
    this.form = {
      nombre: '',
      precio: null,
      categoriaId: this.categories[0]?.id ?? null,
      descripcion: '',
    };
    this.showDialog = true;
  }

  protected openEditDialog(product: Product): void {
    this.editingProductId = product.id;
    this.form = {
      nombre: product.nombre,
      precio: product.precio,
      categoriaId: product.categoriaId,
      descripcion: product.descripcion,
    };
    this.showDialog = true;
  }

  protected closeDialog(): void {
    this.showDialog = false;
  }

  protected async removeProduct(id: number): Promise<void> {
    try {
      await this.apiClient.delete(`/api/productos/${id}`);
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

    try {
      if (this.editingProductId !== null) {
        await this.apiClient.put<ProductoApi, typeof payload>(
          `/api/productos/${this.editingProductId}`,
          payload,
        );
      } else {
        await this.apiClient.post<ProductoApi, typeof payload>('/api/productos', payload);
      }

      await this.loadProducts();
      this.closeDialog();
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
