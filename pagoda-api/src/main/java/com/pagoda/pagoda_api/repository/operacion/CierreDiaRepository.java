package com.pagoda.pagoda_api.repository.operacion;

import com.pagoda.pagoda_api.entity.operacion.CierreDia;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.time.LocalDate;
import java.util.Optional;

@Repository
public interface CierreDiaRepository extends JpaRepository<CierreDia, Integer> {
    Optional<CierreDia> findByFecha(LocalDate fecha);
    Optional<CierreDia> findByJornadaId(Integer jornadaId);
}