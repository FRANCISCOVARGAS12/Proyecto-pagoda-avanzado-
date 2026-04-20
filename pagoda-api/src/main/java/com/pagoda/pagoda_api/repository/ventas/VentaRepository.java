package com.pagoda.pagoda_api.repository.ventas;

import com.pagoda.pagoda_api.entity.ventas.Venta;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.List;

@Repository
public interface VentaRepository extends JpaRepository<Venta, Integer> {
    List<Venta> findByJornadaId(Integer jornadaId);
    List<Venta> findByMesaId(Integer mesaId);
    List<Venta> findByFechaCierreIsNull();
}