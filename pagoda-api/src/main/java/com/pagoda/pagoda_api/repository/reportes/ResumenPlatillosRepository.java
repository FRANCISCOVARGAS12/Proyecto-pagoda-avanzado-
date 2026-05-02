package com.pagoda.pagoda_api.repository.reportes;

import com.pagoda.pagoda_api.entity.reportes.ResumenPlatillosDiario;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDate;
import java.util.List;

@Repository
public interface ResumenPlatillosRepository extends JpaRepository<ResumenPlatillosDiario, Integer> {

    List<ResumenPlatillosDiario> findByJornadaId(Integer jornadaId);

    // Top 5 platillos con mayor totalGenerado en una fecha específica
    @Query("SELECT r FROM ResumenPlatillosDiario r WHERE r.jornada.fecha = :fecha ORDER BY r.totalGenerado DESC")
    List<ResumenPlatillosDiario> findTop5ByFecha(@Param("fecha") LocalDate fecha, Pageable pageable);

    default List<ResumenPlatillosDiario> findTop5ByFechaOrderByTotalGeneradoDesc(LocalDate fecha) {
        return findTop5ByFecha(fecha, PageRequest.of(0, 5));
    }

    @Query("SELECT r.producto.nombre, " +
            "r.producto.categoria.nombre, " +
            "SUM(r.cantidadVendida), " +
            "SUM(r.totalGenerado) " +
            "FROM ResumenPlatillosDiario r " +
            "WHERE r.jornada.fecha BETWEEN :inicio AND :fin " +
            "GROUP BY r.producto.nombre, r.producto.categoria.nombre " +
            "ORDER BY SUM(r.totalGenerado) DESC")
    List<Object[]> findTop5ByFechaBetween(@Param("inicio") LocalDate inicio,
                                          @Param("fin") LocalDate fin,
                                          Pageable pageable);
}