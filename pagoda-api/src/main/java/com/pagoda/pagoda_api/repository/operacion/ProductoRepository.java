package com.pagoda.pagoda_api.repository.operacion;

import com.pagoda.pagoda_api.entity.operacion.Producto;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.List;

@Repository
public interface ProductoRepository extends JpaRepository<Producto, Integer> {
    List<Producto> findByActivoTrue();
    List<Producto> findByCategoriaIdAndActivoTrue(Integer categoriaId);
    boolean existsByNombre(String nombre);
}