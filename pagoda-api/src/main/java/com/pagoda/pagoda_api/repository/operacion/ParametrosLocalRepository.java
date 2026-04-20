package com.pagoda.pagoda_api.repository.operacion;

import com.pagoda.pagoda_api.entity.operacion.ParametrosLocal;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface ParametrosLocalRepository extends JpaRepository<ParametrosLocal, Integer> {
}