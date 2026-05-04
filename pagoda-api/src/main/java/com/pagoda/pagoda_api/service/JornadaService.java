package com.pagoda.pagoda_api.service;

import com.pagoda.pagoda_api.entity.operacion.Jornada;
import com.pagoda.pagoda_api.entity.operacion.Usuario;
import com.pagoda.pagoda_api.exception.ErrorCode;
import com.pagoda.pagoda_api.exception.PagodaException;
import com.pagoda.pagoda_api.repository.operacion.JornadaRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.Optional;

@Service
@RequiredArgsConstructor
public class JornadaService {

    private static final String ESTADO_ABIERTA = "ABIERTA";
    private static final String ESTADO_CERRADA = "CERRADA";

    private final JornadaRepository jornadaRepository;
    private final SimpMessagingTemplate messagingTemplate;

    public List<Jornada> listarTodas() {
        return jornadaRepository.findAll();
    }

    public Optional<Jornada> obtenerJornadaAbierta() {
        Optional<Jornada> abierta = jornadaRepository.findByEstadoIgnoreCase(ESTADO_ABIERTA);
        if (abierta.isEmpty()) {
            return Optional.empty();
        }

        Jornada jornada = abierta.get();
        LocalDate hoy = LocalDate.now();
        if (jornada.getFecha() != null && jornada.getFecha().isBefore(hoy)) {
            Jornada cerrada = cerrarYGuardar(jornada);
            messagingTemplate.convertAndSend("/topic/jornada",
                    (Object) Map.of("accion", "CERRADA", "jornada", cerrada));
            return Optional.empty();
        }

        return Optional.of(jornada);
    }

    public Jornada obtenerPorId(Integer id) {
        return jornadaRepository.findById(id)
                .orElseThrow(() -> new PagodaException(ErrorCode.JORNADA_NO_ENCONTRADA));
    }

    public Jornada abrirJornada(Jornada jornada) {
        if (obtenerJornadaAbierta().isPresent()) {
            throw new PagodaException(ErrorCode.JORNADA_ABIERTA);
        }
        jornada.setFecha(jornada.getFecha() == null ? LocalDate.now() : jornada.getFecha());
        jornada.setHoraApertura(LocalDateTime.now());
        jornada.setHoraCierre(null);
        jornada.setEstado(ESTADO_ABIERTA);
        Jornada saved = jornadaRepository.save(jornada);

        // Notificar a los dashboards
        messagingTemplate.convertAndSend("/topic/jornada",
                (Object) Map.of("accion", "ABIERTA", "jornada", saved));

        return saved;
    }

    public Jornada cerrarJornada(Integer id) {
        Jornada jornada = obtenerPorId(id);
        if (ESTADO_CERRADA.equalsIgnoreCase(jornada.getEstado())) {
            throw new PagodaException(ErrorCode.JORNADA_CERRADA);
        }
        Jornada cerrada = cerrarYGuardar(jornada);

        // Notificar que la jornada se ha cerrado
        messagingTemplate.convertAndSend("/topic/jornada",
                (Object) Map.of("accion", "CERRADA", "jornada", cerrada));

        return cerrada;
    }

    public Jornada asegurarJornadaActiva(Usuario usuarioApertura) {
        LocalDate hoy = LocalDate.now();
        Optional<Jornada> abierta = obtenerJornadaAbierta();

        if (abierta.isPresent()) {
            Jornada jornadaAbierta = abierta.get();
            if (hoy.equals(jornadaAbierta.getFecha())) {
                return jornadaAbierta;
            }
            // Cerrar jornada anterior automáticamente
            jornadaAbierta.setEstado(ESTADO_CERRADA);
            jornadaAbierta.setHoraCierre(LocalDateTime.now());
            Jornada cerrada = jornadaRepository.save(jornadaAbierta);

            // Notificar cierre de la anterior
            messagingTemplate.convertAndSend("/topic/jornada",
                    (Object) Map.of("accion", "CERRADA", "jornada", cerrada));
        }

        Jornada nueva = Jornada.builder()
                .fecha(hoy)
                .fondoCaja(BigDecimal.ZERO)
                .horaApertura(LocalDateTime.now())
                .horaCierre(null)
                .estado(ESTADO_ABIERTA)
                .usuarioApertura(usuarioApertura)
                .build();
        Jornada saved = jornadaRepository.save(nueva);

        // Notificar apertura de la nueva
        messagingTemplate.convertAndSend("/topic/jornada",
                (Object) Map.of("accion", "ABIERTA", "jornada", saved));

        return saved;
    }

    private Jornada cerrarYGuardar(Jornada jornada) {
        jornada.setEstado(ESTADO_CERRADA);
        if (jornada.getHoraCierre() == null) {
            jornada.setHoraCierre(LocalDateTime.now());
        }
        return jornadaRepository.save(jornada);
    }
}
