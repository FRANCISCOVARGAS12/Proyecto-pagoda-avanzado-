package com.pagoda.pagoda_api.service;

import com.pagoda.pagoda_api.entity.operacion.ParametrosLocal;
import com.pagoda.pagoda_api.exception.ErrorCode;
import com.pagoda.pagoda_api.exception.PagodaException;
import com.pagoda.pagoda_api.repository.operacion.ParametrosLocalRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

@Service
@RequiredArgsConstructor
public class SuperuserAuthService {

    private static final long TOKEN_MINUTES = 30;

    private final ParametrosLocalService parametrosLocalService;
    private final ParametrosLocalRepository parametrosLocalRepository;
    private final PasswordEncoder passwordEncoder;
    private final ConcurrentHashMap<String, Instant> tokenExpirations = new ConcurrentHashMap<>();

    public boolean estaConfigurado() {
        return hasConfiguredHash(parametrosLocalService.obtener());
    }

    public SuperuserSession configurar(String password) {
        ParametrosLocal parametros = parametrosLocalService.obtener();
        if (hasConfiguredHash(parametros)) {
            throw new PagodaException(ErrorCode.SUPERUSUARIO_YA_CONFIGURADO);
        }

        parametros.setSuperusuarioPasswordHash(passwordEncoder.encode(normalizePassword(password)));
        parametrosLocalRepository.save(parametros);
        return crearToken();
    }

    public SuperuserSession crearSesion(String password) {
        ParametrosLocal parametros = parametrosLocalService.obtener();
        if (!hasConfiguredHash(parametros)) {
            throw new PagodaException(ErrorCode.SUPERUSUARIO_NO_CONFIGURADO);
        }
        if (!passwordEncoder.matches(normalizePassword(password), parametros.getSuperusuarioPasswordHash())) {
            throw new PagodaException(ErrorCode.SUPERUSUARIO_INVALIDO);
        }

        return crearToken();
    }

    public void validarToken(String token) {
        String normalized = token == null ? "" : token.trim();
        if (normalized.isBlank()) {
            throw new PagodaException(ErrorCode.SUPERUSUARIO_INVALIDO);
        }

        Instant expiresAt = tokenExpirations.get(normalized);
        if (expiresAt == null || Instant.now().isAfter(expiresAt)) {
            tokenExpirations.remove(normalized);
            throw new PagodaException(ErrorCode.SUPERUSUARIO_INVALIDO);
        }
    }

    private SuperuserSession crearToken() {
        purgeExpiredTokens();
        String token = UUID.randomUUID().toString();
        Instant expiresAt = Instant.now().plus(TOKEN_MINUTES, ChronoUnit.MINUTES);
        tokenExpirations.put(token, expiresAt);
        return new SuperuserSession(token, expiresAt.toString());
    }

    private String normalizePassword(String password) {
        String normalized = password == null ? "" : password.trim();
        if (normalized.length() < 8) {
            throw new PagodaException(ErrorCode.SUPERUSUARIO_INVALIDO);
        }
        return normalized;
    }

    private boolean hasConfiguredHash(ParametrosLocal parametros) {
        String hash = parametros.getSuperusuarioPasswordHash();
        return hash != null && !hash.trim().isBlank();
    }

    private void purgeExpiredTokens() {
        Instant now = Instant.now();
        tokenExpirations.entrySet().removeIf(entry -> now.isAfter(entry.getValue()));
    }

    public record SuperuserSession(String token, String expiresAt) {
    }
}
