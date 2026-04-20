package com.pagoda.pagoda_api.repository.catalogos;

import com.pagoda.pagoda_api.entity.catalogos.TipoCobro;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.Optional;

@Repository
public interface TipoCobroRepository extends JpaRepository<TipoCobro, Integer> {
	Optional<TipoCobro> findByNombre(String nombre);
	boolean existsByNombre(String nombre);
}