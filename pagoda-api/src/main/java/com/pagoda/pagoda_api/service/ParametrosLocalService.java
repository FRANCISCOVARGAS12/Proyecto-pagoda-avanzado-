package com.pagoda.pagoda_api.service;

import com.pagoda.pagoda_api.entity.operacion.ParametrosLocal;
import com.pagoda.pagoda_api.exception.ErrorCode;
import com.pagoda.pagoda_api.exception.PagodaException;
import com.pagoda.pagoda_api.repository.operacion.ParametrosLocalRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Objects;

@Service
@RequiredArgsConstructor
public class ParametrosLocalService {

    private final ParametrosLocalRepository parametrosLocalRepository;

    public ParametrosLocal obtener() {
        List<ParametrosLocal> todos = parametrosLocalRepository.findAll();
        if (todos.isEmpty()) {
            throw new PagodaException(ErrorCode.PARAMETROS_NO_CONFIGURADOS);
        }
        ParametrosLocal actual = todos.getFirst();
        return normalizeExisting(actual) ? parametrosLocalRepository.save(actual) : actual;
    }

    public ParametrosLocal guardar(ParametrosLocal payload) {
        ParametrosLocal actual;
        List<ParametrosLocal> todos = parametrosLocalRepository.findAll();
        if (todos.isEmpty()) {
            actual = payload;
            actual.setRolPorDefecto(nonBlank(payload.getRolPorDefecto(), null, "MESERO"));
            actual.setAutoLogoutMinutos(nonNegative(payload.getAutoLogoutMinutos(), null, 30));
            actual.setImpresoraTickets(normalizePrinter(payload.getImpresoraTickets(), null));
            actual.setImprimirResumenCierre(payload.getImprimirResumenCierre() != null
                    ? payload.getImprimirResumenCierre()
                    : true);
            actual.setEncabezadoTicket(nonBlank(payload.getEncabezadoTicket(), null, "Restaurante Asiático"));
            actual.setPieTicket(nonBlank(payload.getPieTicket(), null, "¡Gracias por su visita!"));
        } else {
            actual = todos.getFirst();
            actual.setFondoLunes(payload.getFondoLunes());
            actual.setFondoMartes(payload.getFondoMartes());
            actual.setFondoMiercoles(payload.getFondoMiercoles());
            actual.setFondoJueves(payload.getFondoJueves());
            actual.setFondoViernes(payload.getFondoViernes());
            actual.setFondoSabado(payload.getFondoSabado());
            actual.setFondoDomingo(payload.getFondoDomingo());
            actual.setComisionBancaria(payload.getComisionBancaria());
            actual.setRolPorDefecto(nonBlank(payload.getRolPorDefecto(), actual.getRolPorDefecto(), "MESERO"));
            actual.setAutoLogoutMinutos(nonNegative(payload.getAutoLogoutMinutos(), actual.getAutoLogoutMinutos(), 30));
            actual.setImpresoraTickets(normalizePrinter(payload.getImpresoraTickets(), actual.getImpresoraTickets()));
            actual.setImprimirResumenCierre(payload.getImprimirResumenCierre() != null
                    ? payload.getImprimirResumenCierre()
                    : actual.getImprimirResumenCierre());
            actual.setEncabezadoTicket(nonBlank(payload.getEncabezadoTicket(), actual.getEncabezadoTicket(), "Restaurante Asiático"));
            actual.setPieTicket(nonBlank(payload.getPieTicket(), actual.getPieTicket(), "¡Gracias por su visita!"));
            actual.setActualizadoPor(payload.getActualizadoPor());
        }
        actual.setFechaActualizacion(LocalDateTime.now());
        return parametrosLocalRepository.save(actual);
    }

    private String nonBlank(String value, String current, String fallback) {
        String normalized = value == null ? "" : value.trim();
        if (!normalized.isBlank()) {
            return normalized;
        }
        normalized = current == null ? "" : current.trim();
        return normalized.isBlank() ? fallback : normalized;
    }

    private Integer nonNegative(Integer value, Integer current, Integer fallback) {
        if (value != null && value >= 0) {
            return value;
        }
        return current != null && current >= 0 ? current : fallback;
    }

    private String normalizePrinter(String value, String current) {
        String normalized = value == null ? "" : value.trim().toLowerCase();
        if (normalized.equals("default") || normalized.equals("thermal") || normalized.equals("none")) {
            return normalized;
        }
        String currentNormalized = current == null ? "" : current.trim().toLowerCase();
        if (currentNormalized.equals("default") || currentNormalized.equals("thermal") || currentNormalized.equals("none")) {
            return currentNormalized;
        }
        return "default";
    }

    private boolean normalizeExisting(ParametrosLocal actual) {
        boolean changed = false;

        String rol = nonBlank(actual.getRolPorDefecto(), null, "MESERO");
        if (!Objects.equals(actual.getRolPorDefecto(), rol)) {
            actual.setRolPorDefecto(rol);
            changed = true;
        }

        Integer autoLogout = nonNegative(actual.getAutoLogoutMinutos(), null, 30);
        if (!Objects.equals(actual.getAutoLogoutMinutos(), autoLogout)) {
            actual.setAutoLogoutMinutos(autoLogout);
            changed = true;
        }

        String impresora = normalizePrinter(actual.getImpresoraTickets(), null);
        if (!Objects.equals(actual.getImpresoraTickets(), impresora)) {
            actual.setImpresoraTickets(impresora);
            changed = true;
        }

        if (actual.getImprimirResumenCierre() == null) {
            actual.setImprimirResumenCierre(true);
            changed = true;
        }

        String encabezado = nonBlank(actual.getEncabezadoTicket(), null, "Restaurante Asiático");
        if (!Objects.equals(actual.getEncabezadoTicket(), encabezado)) {
            actual.setEncabezadoTicket(encabezado);
            changed = true;
        }

        String pie = nonBlank(actual.getPieTicket(), null, "¡Gracias por su visita!");
        if (!Objects.equals(actual.getPieTicket(), pie)) {
            actual.setPieTicket(pie);
            changed = true;
        }

        if (changed) {
            actual.setFechaActualizacion(LocalDateTime.now());
        }
        return changed;
    }
}
