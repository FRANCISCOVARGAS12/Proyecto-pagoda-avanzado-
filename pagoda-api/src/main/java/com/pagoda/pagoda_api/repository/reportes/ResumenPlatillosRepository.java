package com.pagoda.pagoda_api.repository.reportes;

import com.pagoda.pagoda_api.entity.reportes.ResumenPlatillosDiario;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.List;

@Repository
public interface ResumenPlatillosRepository extends JpaRepository<ResumenPlatillosDiario, Integer> {
    List<ResumenPlatillosDiario> findByJornadaId(Integer jornadaId);
}