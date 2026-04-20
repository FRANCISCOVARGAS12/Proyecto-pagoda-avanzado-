package com.pagoda.pagoda_api.repository.operacion;

import com.pagoda.pagoda_api.entity.operacion.Mesa;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.List;

@Repository
public interface MesaRepository extends JpaRepository<Mesa, Integer> {
    List<Mesa> findByEstadoNombre(String estadoNombre);
    boolean existsByNumero(Integer numero);
}