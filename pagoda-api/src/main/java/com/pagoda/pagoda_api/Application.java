package com.pagoda.pagoda_api;

import com.pagoda.pagoda_api.service.InitializationService;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.context.event.ContextRefreshedEvent;
import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Component;

@SpringBootApplication
public class Application {

	public static void main(String[] args) {
		SpringApplication.run(Application.class, args);
	}

	@Component
	@RequiredArgsConstructor
	public static class DatabaseInitializer {
		private final InitializationService initService;
		private static volatile boolean initialized = false;

		@EventListener
		public void onApplicationEvent(ContextRefreshedEvent event) {
			if (!initialized) {
				synchronized (DatabaseInitializer.class) {
					if (!initialized) {
						initService.cleanAndInitializeData();
						initialized = true;
					}
				}
			}
		}
	}
}
