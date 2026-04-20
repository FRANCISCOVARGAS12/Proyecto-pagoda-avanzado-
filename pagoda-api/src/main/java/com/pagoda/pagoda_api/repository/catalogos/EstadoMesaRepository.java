package com.pagoda.pagoda_api.repository.catalogos;

import com.pagoda.pagoda_api.entity.catalogos.EstadoMesa;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.Optional;

@Repository
public interface EstadoMesaRepository extends JpaRepository<EstadoMesa, Integer> {
	Optional<EstadoMesa> findByNombre(String nombre);
	boolean existsByNombre(String nombre);
}