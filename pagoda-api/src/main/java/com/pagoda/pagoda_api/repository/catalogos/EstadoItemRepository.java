package com.pagoda.pagoda_api.repository.catalogos;

import com.pagoda.pagoda_api.entity.catalogos.EstadoItem;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.Optional;

@Repository
public interface EstadoItemRepository extends JpaRepository<EstadoItem, Integer> {
	Optional<EstadoItem> findByNombre(String nombre);
	boolean existsByNombre(String nombre);
}