package com.pagoda.pagoda_api.service;

import com.pagoda.pagoda_api.entity.catalogos.*;
import com.pagoda.pagoda_api.entity.operacion.ParametrosLocal;
import com.pagoda.pagoda_api.repository.catalogos.*;
import com.pagoda.pagoda_api.repository.operacion.ParametrosLocalRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class InitializationService {

    private final RolRepository rolRepo;
    private final EstadoMesaRepository estadoMesaRepo;
    private final EstadoItemRepository estadoItemRepo;
    private final MetodoPagoRepository metodoPagoRepo;
    private final TipoCobroRepository tipoCobroRepo;
    private final CategoriaRepository categoriaRepo;
    private final ParametrosLocalRepository parametrosRepo;

    @Transactional
    public String cleanAndInitializeData() {
        ensureBasicData();
        return "Base de datos inicializada correctamente.";
    }

    private void ensureBasicData() {
        // Roles
        ensureRol("ADMIN", "Acceso total al sistema incluyendo panel administrativo");
        ensureRol("MESERO", "Acceso a la app móvil para gestión de mesas y pedidos");

        // Estados mesa
        ensureEstadoMesa("LIBRE");
        ensureEstadoMesa("OCUPADO");
        ensureEstadoMesa("PIDIENDO_CUENTA");
        ensureEstadoMesa("LIMPIANDO");

        // Estados item
        ensureEstadoItem("PENDIENTE");
        ensureEstadoItem("ENVIADO");
        ensureEstadoItem("CANCELADO");

        // Métodos pago
        ensureMetodoPago("EFECTIVO");
        ensureMetodoPago("TARJETA");

        // Tipos cobro
        ensureTipoCobro("TOTAL");
        ensureTipoCobro("EQUITATIVO");
        ensureTipoCobro("POR_PERSONA");

        // Categorías
        ensureCategoria("Entradas", "Platillos para comenzar");
        ensureCategoria("Rollos", "Rollos de sushi variados");
        ensureCategoria("Hot Pot", "Sopas estilo hot pot individual y familiar");
        ensureCategoria("Parrilladas", "Parrilladas asian BBQ y coreana");
        ensureCategoria("Salsas", "Salsas y extras");
        ensureCategoria("Pagoda Kids", "Menú infantil");
        ensureCategoria("Postres", "Postres asiáticos");
        ensureCategoria("Bebidas Sin Alcohol", "Refrescos, boba tea y bebidas frías");
        ensureCategoria("Bebidas Con Alcohol", "Cervezas, vinos y destilados");

        // Parámetros
        ensureParametros();
    }

    private void ensureRol(String nombre, String descripcion) {
        if (rolRepo.findByNombre(nombre).isEmpty()) {
            Rol rol = Rol.builder()
                    .nombre(nombre)
                    .descripcion(descripcion)
                    .build();
            rolRepo.save(rol);
        }
    }

    private void ensureEstadoMesa(String nombre) {
        if (estadoMesaRepo.findByNombre(nombre).isEmpty()) {
            EstadoMesa estado = EstadoMesa.builder()
                    .nombre(nombre)
                    .build();
            estadoMesaRepo.save(estado);
        }
    }

    private void ensureEstadoItem(String nombre) {
        if (estadoItemRepo.findByNombre(nombre).isEmpty()) {
            EstadoItem estado = EstadoItem.builder()
                    .nombre(nombre)
                    .build();
            estadoItemRepo.save(estado);
        }
    }

    private void ensureMetodoPago(String nombre) {
        if (metodoPagoRepo.findByNombre(nombre).isEmpty()) {
            MetodoPago metodo = MetodoPago.builder()
                    .nombre(nombre)
                    .build();
            metodoPagoRepo.save(metodo);
        }
    }

    private void ensureTipoCobro(String nombre) {
        if (tipoCobroRepo.findByNombre(nombre).isEmpty()) {
            TipoCobro tipo = TipoCobro.builder()
                    .nombre(nombre)
                    .build();
            tipoCobroRepo.save(tipo);
        }
    }

    private void ensureCategoria(String nombre, String descripcion) {
        if (categoriaRepo.findByNombre(nombre).isEmpty()) {
            Categoria cat = Categoria.builder()
                    .nombre(nombre)
                    .descripcion(descripcion)
                    .build();
            categoriaRepo.save(cat);
        }
    }

    private void ensureParametros() {
        if (parametrosRepo.count() == 0) {
            ParametrosLocal param = ParametrosLocal.builder()
                    .fondoLunes(new java.math.BigDecimal("1000.0"))
                    .fondoMartes(new java.math.BigDecimal("1000.0"))
                    .fondoMiercoles(new java.math.BigDecimal("1000.0"))
                    .fondoJueves(new java.math.BigDecimal("1000.0"))
                    .fondoViernes(new java.math.BigDecimal("1000.0"))
                    .fondoSabado(new java.math.BigDecimal("1000.0"))
                    .fondoDomingo(new java.math.BigDecimal("1000.0"))
                    .comisionBancaria(new java.math.BigDecimal("3.5"))
                    .build();
            parametrosRepo.save(param);
        }
    }
}
