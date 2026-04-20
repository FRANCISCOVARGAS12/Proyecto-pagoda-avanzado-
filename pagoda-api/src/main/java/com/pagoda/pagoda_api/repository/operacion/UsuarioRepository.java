package com.pagoda.pagoda_api.repository.operacion;

import com.pagoda.pagoda_api.entity.operacion.Usuario;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.Optional;

@Repository
public interface UsuarioRepository extends JpaRepository<Usuario, Integer> {
    Optional<Usuario> findByNombre(String nombre);
    Optional<Usuario> findByNombreAndActivoTrue(String nombre);
    Optional<Usuario> findTopByNombreIgnoreCaseAndActivoTrueOrderByIdDesc(String nombre);
    boolean existsByNombre(String nombre);
}
