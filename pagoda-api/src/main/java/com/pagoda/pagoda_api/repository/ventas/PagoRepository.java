package com.pagoda.pagoda_api.repository.ventas;

import com.pagoda.pagoda_api.entity.ventas.Pago;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

@Repository
public interface PagoRepository extends JpaRepository<Pago, Integer> {
    List<Pago> findByVentaId(Integer ventaId);

    @Query("""
            SELECT COALESCE(SUM(COALESCE(p.propinaNeto, p.propinaMonto, 0)), 0)
            FROM Pago p
            WHERE p.venta.jornada.fecha BETWEEN :inicio AND :fin
            """)
    BigDecimal sumPropinasNetasByRango(@Param("inicio") LocalDate inicio,
                                       @Param("fin") LocalDate fin);
}
