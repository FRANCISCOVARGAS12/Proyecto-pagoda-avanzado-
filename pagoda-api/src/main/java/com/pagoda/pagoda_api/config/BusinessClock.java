package com.pagoda.pagoda_api.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.time.Clock;
import java.time.DateTimeException;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.ZoneId;

@Component
public class BusinessClock {

    private static final String DEFAULT_ZONE_ID = "America/Mexico_City";

    private final ZoneId zoneId;
    private final Clock clock;

    public BusinessClock(@Value("${app.time-zone:" + DEFAULT_ZONE_ID + "}") String configuredZoneId) {
        this.zoneId = resolveZoneId(configuredZoneId);
        this.clock = Clock.system(this.zoneId);
    }

    public LocalDate today() {
        return LocalDate.now(clock);
    }

    public LocalDateTime now() {
        return LocalDateTime.now(clock);
    }

    private ZoneId resolveZoneId(String configuredZoneId) {
        String candidate = configuredZoneId == null ? "" : configuredZoneId.trim();
        if (candidate.isEmpty()) {
            return ZoneId.of(DEFAULT_ZONE_ID);
        }

        try {
            return ZoneId.of(candidate);
        } catch (DateTimeException ignored) {
            return ZoneId.of(DEFAULT_ZONE_ID);
        }
    }
}
