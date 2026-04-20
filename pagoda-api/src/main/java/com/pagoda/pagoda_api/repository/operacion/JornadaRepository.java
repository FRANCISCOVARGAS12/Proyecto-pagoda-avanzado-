package com.pagoda.pagoda_api.repository.operacion;

import com.pagoda.pagoda_api.entity.operacion.Jornada;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.time.LocalDate;
import java.util.Optional;

@Repository
public interface JornadaRepository extends JpaRepository<Jornada, Integer> {
    Optional<Jornada> findByFecha(LocalDate fecha);
    Optional<Jornada> findByEstado(String estado);
    Optional<Jornada> findByEstadoIgnoreCase(String estado);
}