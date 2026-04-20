package com.pagoda.pagoda_api.repository.ventas;

import com.pagoda.pagoda_api.entity.ventas.Pago;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.List;

@Repository
public interface PagoRepository extends JpaRepository<Pago, Integer> {
    List<Pago> findByVentaId(Integer ventaId);
}