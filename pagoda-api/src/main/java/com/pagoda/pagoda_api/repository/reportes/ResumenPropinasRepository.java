package com.pagoda.pagoda_api.repository.reportes;

import com.pagoda.pagoda_api.entity.reportes.ResumenPropinaDiario;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

@Repository
public interface ResumenPropinasRepository extends JpaRepository<ResumenPropinaDiario, Integer> {

    List<ResumenPropinaDiario> findByJornadaId(Integer jornadaId);

    @Query("SELECT r FROM ResumenPropinaDiario r WHERE r.jornada.fecha BETWEEN :inicio AND :fin")
    List<ResumenPropinaDiario> findByJornadaFechaBetween(
            @Param("inicio") LocalDate inicio,
            @Param("fin") LocalDate fin
    );

    // ✅ Nuevo método: suma de propinas netas en un rango de fechas de jornada
    @Query("SELECT COALESCE(SUM(r.totalPropinasNeto), 0) FROM ResumenPropinaDiario r WHERE r.jornada.fecha BETWEEN :inicio AND :fin")
    BigDecimal sumPropinasBetween(@Param("inicio") LocalDate inicio, @Param("fin") LocalDate fin);
}