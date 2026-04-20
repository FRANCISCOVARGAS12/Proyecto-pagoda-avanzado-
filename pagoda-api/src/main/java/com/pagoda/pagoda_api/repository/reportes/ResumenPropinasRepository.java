package com.pagoda.pagoda_api.repository.reportes;

import com.pagoda.pagoda_api.entity.reportes.ResumenPropinaDiario;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.List;

@Repository
public interface ResumenPropinasRepository extends JpaRepository<ResumenPropinaDiario, Integer> {
    List<ResumenPropinaDiario> findByJornadaId(Integer jornadaId);
}