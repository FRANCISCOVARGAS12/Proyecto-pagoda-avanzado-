package com.pagoda.pagoda_api.repository.ventas;

import com.pagoda.pagoda_api.entity.ventas.ItemVenta;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.List;

@Repository
public interface ItemVentaRepository extends JpaRepository<ItemVenta, Integer> {
    List<ItemVenta> findByVentaId(Integer ventaId);
}