package com.pagoda.pagoda_api.service;

import com.pagoda.pagoda_api.config.BusinessClock;
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
    private final BusinessClock businessClock;

    public List<Jornada> listarTodas() {
        return jornadaRepository.findAll();
    }

    public Optional<Jornada> obtenerJornadaAbierta() {
        return normalizarJornadasAbiertas(businessClock.today());
    }

    @Scheduled(cron = "0 * * * * *")
    public void cerrarJornadasDeDiaAnteriorProgramado() {
        normalizarJornadasAbiertas(businessClock.today());
    }

    public Jornada obtenerPorId(Integer id) {
        return jornadaRepository.findById(id)
                .orElseThrow(() -> new PagodaException(ErrorCode.JORNADA_NO_ENCONTRADA));
    }

    public Jornada abrirJornada(Jornada jornada) {
        if (obtenerJornadaAbierta().isPresent()) {
            throw new PagodaException(ErrorCode.JORNADA_ABIERTA);
        }
        jornada.setFecha(jornada.getFecha() == null ? businessClock.today() : jornada.getFecha());
        jornada.setHoraApertura(businessClock.now());
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

        List<Jornada> abiertas = new ArrayList<>(
                Optional.ofNullable(jornadaRepository.findAllByEstadoIgnoreCase(ESTADO_ABIERTA))
                        .orElseGet(List::of)
        );
        if (abiertas.stream().noneMatch(item -> item.getId() != null && item.getId().equals(id))) {
            abiertas.add(jornada);
        }

        Jornada cerradaSolicitada = null;
        for (Jornada abierta : abiertas) {
            if (!ESTADO_ABIERTA.equalsIgnoreCase(abierta.getEstado())) {
                continue;
            }
            Jornada cerrada = cerrarYGuardar(abierta);
            notifyJornadaEvent("CERRADA", cerrada);
            if (cerrada.getId() != null && cerrada.getId().equals(id)) {
                cerradaSolicitada = cerrada;
            }
        }

        if (cerradaSolicitada == null) {
            cerradaSolicitada = cerrarYGuardar(jornada);
            notifyJornadaEvent("CERRADA", cerradaSolicitada);
        }

        return cerradaSolicitada;
    }

    public Jornada asegurarJornadaActiva(Usuario usuarioApertura) {
        LocalDate hoy = businessClock.today();
        Optional<Jornada> abierta = normalizarJornadasAbiertas(hoy);

        if (abierta.isPresent()) {
            return abierta.get();
        }

        Jornada nueva = Jornada.builder()
                .fecha(hoy)
                .fondoCaja(BigDecimal.ZERO)
                .horaApertura(businessClock.now())
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

        List<Jornada> vigentes = new ArrayList<>();
        for (Jornada jornada : abiertas) {
            if (debeCerrarPorCambioDeDia(jornada, fechaReferencia)) {
                Jornada cerrada = cerrarYGuardar(jornada);
                notifyJornadaEvent("CERRADA", cerrada);
                continue;
            }
            vigentes.add(jornada);
        }

        if (vigentes.isEmpty()) {
            return Optional.empty();
        }

        Jornada jornadaVigente = vigentes.get(0);
        for (int index = 1; index < vigentes.size(); index++) {
            Jornada jornada = vigentes.get(index);
            Jornada cerrada = cerrarYGuardar(jornada);
            notifyJornadaEvent("CERRADA", cerrada);
        }

        return Optional.of(jornadaVigente);
    }

    private boolean debeCerrarPorCambioDeDia(Jornada jornada, LocalDate fechaReferencia) {
        LocalDate fechaJornada = jornada.getFecha();
        return fechaJornada != null && fechaJornada.isBefore(fechaReferencia);
    }

    private Jornada cerrarYGuardar(Jornada jornada) {
        jornada.setEstado(ESTADO_CERRADA);
        if (jornada.getHoraCierre() == null) {
            jornada.setHoraCierre(businessClock.now());
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
