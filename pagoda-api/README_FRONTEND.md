# Pagoda API - Guia de Integracion Frontend

## Base URL

- Local: `http://localhost:8080`
- Health check: `GET /api/health`

## Formato de respuesta

Todas las respuestas usan `ApiResponse`:

```json
{
  "success": true,
  "message": "Texto descriptivo",
  "data": {},
  "errorCode": null
}
```

En error:

```json
{
  "success": false,
  "message": "Descripcion del error",
  "data": null,
  "errorCode": 6005
}
```

## CORS

Origenes permitidos en dev por defecto:

- `http://localhost:4200`
- `http://localhost:5173`
- `https://franciscovargas12.github.io`
- `https://paquinhodevv.github.io`

Puedes cambiarlo con variable de entorno:

```bash
export CORS_ALLOWED_ORIGINS="http://localhost:4200,http://localhost:3000,https://franciscovargas12.github.io,https://paquinhodevv.github.io"
```

## Endpoints clave para front

### Admin

- `POST /api/admin/login`
- `GET /api/admin/perfil`
- `POST /api/mesero/login`

`POST /api/admin/login` request:

```json
{
  "nombre": "Charbel",
  "pin": "1234"
}
```

### Catalogos

- `GET /api/categorias`
- `GET /api/categorias/{id}`
- `POST /api/categorias`
- `PUT /api/categorias/{id}`
- `DELETE /api/categorias/{id}`

- `GET /api/catalogos/roles`
- `GET /api/catalogos/estados-mesa`
- `GET /api/catalogos/estados-item`
- `GET /api/catalogos/metodos-pago`
- `GET /api/catalogos/tipos-cobro`

### Operacion

- `GET /api/mesas`
- `GET /api/mesas/libres`
- `GET /api/mesas/{id}`
- `POST /api/mesas`
- `PUT /api/mesas/{id}`
- `DELETE /api/mesas/{id}`

- `GET /api/productos`
- `GET /api/productos/{id}`
- `GET /api/productos/categoria/{categoriaId}`
- `POST /api/productos`
- `PUT /api/productos/{id}`
- `DELETE /api/productos/{id}`

- `GET /api/operacion/usuarios`
- `GET /api/operacion/usuarios/{id}`
- `POST /api/operacion/usuarios`
- `PUT /api/operacion/usuarios/{id}`
- `DELETE /api/operacion/usuarios/{id}`

- `GET /api/operacion/jornadas`
- `GET /api/operacion/jornadas/estado`
- `POST /api/operacion/jornadas/abrir`
- `PUT /api/operacion/jornadas/cerrar/{id}`

- `GET /api/operacion/cierres-dia`
- `GET /api/operacion/cierres-dia/{id}`
- `POST /api/operacion/cierres-dia`

- `GET /api/operacion/parametros`
- `POST /api/operacion/parametros`

### Ventas

- `GET /api/ventas/activas`
- `GET /api/ventas/jornada/{jornadaId}`
- `GET /api/ventas/{id}`
- `POST /api/ventas/abrir`
- `PUT /api/ventas/{id}/cerrar`

- `GET /api/ventas/items/venta/{ventaId}`
- `POST /api/ventas/items`
- `DELETE /api/ventas/items/{id}`

- `GET /api/ventas/pagos/venta/{ventaId}`
- `POST /api/ventas/pagos`

### Reportes

- `GET /api/reportes/ventas-diarias/jornada/{jornadaId}`
- `POST /api/reportes/ventas-diarias`
- `GET /api/reportes/platillos-diarios/jornada/{jornadaId}`
- `POST /api/reportes/platillos-diarios`
- `GET /api/reportes/propinas-diarias/jornada/{jornadaId}`
- `POST /api/reportes/propinas-diarias`

## Validaciones relevantes

- Login, usuario y producto ya devuelven `400` con mensaje claro en campos invalidos.
- PIN de usuario: entre 4 y 8 caracteres.
- Precio de producto: mayor a 0.

## Arranque rapido

```bash
cd /home/paquinhodevv/Escritorio/proyectos/Pagoda/pagoda-api
./mvnw spring-boot:run
```

## Test rapido

```bash
cd /home/paquinhodevv/Escritorio/proyectos/Pagoda/pagoda-api
./mvnw -q test
```
