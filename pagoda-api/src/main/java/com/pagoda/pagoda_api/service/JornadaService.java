package com.pagoda.pagoda_api.service;

import com.pagoda.pagoda_api.entity.operacion.Jornada;
import com.pagoda.pagoda_api.entity.operacion.Usuario;
import com.pagoda.pagoda_api.exception.ErrorCode;
import com.pagoda.pagoda_api.exception.PagodaException;
import com.pagoda.pagoda_api.repository.operacion.JornadaRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
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
        return normalizarJornadasAbiertas(LocalDate.now());
    }

    @Scheduled(cron = "0 * * * * *")
    public void cerrarJornadasDeDiaAnteriorProgramado() {
        normalizarJornadasAbiertas(LocalDate.now());
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
        notifyJornadaEvent("ABIERTA", saved);

        return saved;
    }

    public Jornada cerrarJornada(Integer id) {
        Jornada jornada = obtenerPorId(id);
        if (ESTADO_CERRADA.equalsIgnoreCase(jornada.getEstado())) {
            throw new PagodaException(ErrorCode.JORNADA_CERRADA);
        }
        Jornada cerrada = cerrarYGuardar(jornada);

        // Notificar que la jornada se ha cerrado
        notifyJornadaEvent("CERRADA", cerrada);

        return cerrada;
    }

    public Jornada asegurarJornadaActiva(Usuario usuarioApertura) {
        LocalDate hoy = LocalDate.now();
        Optional<Jornada> abierta = normalizarJornadasAbiertas(hoy);

        if (abierta.isPresent()) {
            return abierta.get();
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
        notifyJornadaEvent("ABIERTA", saved);

        return saved;
    }

    private Optional<Jornada> normalizarJornadasAbiertas(LocalDate fechaReferencia) {
        List<Jornada> abiertas = new ArrayList<>(
                Optional.ofNullable(jornadaRepository.findAllByEstadoIgnoreCase(ESTADO_ABIERTA))
                        .orElseGet(List::of)
        );
        if (abiertas.isEmpty()) {
            jornadaRepository.findByEstadoIgnoreCase(ESTADO_ABIERTA).ifPresent(abiertas::add);
        }
        if (abiertas.isEmpty()) {
            return Optional.empty();
        }

        abiertas.sort(Comparator
                .comparing((Jornada jornada) -> jornada.getHoraApertura() != null ? jornada.getHoraApertura() : LocalDateTime.MIN)
                .reversed()
                .thenComparing(
                        jornada -> jornada.getId() != null ? jornada.getId() : 0,
                        Comparator.reverseOrder()
                ));

        Jornada jornadaVigente = null;
        LocalDate fechaMinimaVigente = fechaReferencia.minusDays(1);
        for (Jornada jornada : abiertas) {
            boolean esJornadaVigente = jornada.getFecha() == null || !jornada.getFecha().isBefore(fechaMinimaVigente);
            if (esJornadaVigente && jornadaVigente == null) {
                jornadaVigente = jornada;
                continue;
            }

            Jornada cerrada = cerrarYGuardar(jornada);
            notifyJornadaEvent("CERRADA", cerrada);
        }

        return Optional.ofNullable(jornadaVigente);
    }

    private Jornada cerrarYGuardar(Jornada jornada) {
        jornada.setEstado(ESTADO_CERRADA);
        if (jornada.getHoraCierre() == null) {
            jornada.setHoraCierre(LocalDateTime.now());
        }
        return jornadaRepository.save(jornada);
    }

    private void notifyJornadaEvent(String accion, Jornada jornada) {
        if (messagingTemplate == null) {
            return;
        }
        Map<String, Object> payload = new HashMap<>();
        payload.put("accion", accion);
        if (jornada != null) {
            payload.put("jornada", jornada);
        }
        messagingTemplate.convertAndSend("/topic/jornada", (Object) payload);
    }
}
