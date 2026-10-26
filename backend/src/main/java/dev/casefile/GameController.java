package dev.casefile;

import com.fasterxml.jackson.databind.node.ObjectNode;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.http.*;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.servlet.config.annotation.*;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

@RestController
@RequestMapping("/api/rooms")
public class GameController {
    private final GameService games;
    private final GameEvents events;
    public GameController(GameService games, GameEvents events) { this.games = games; this.events = events; }
    public record Start(@NotBlank @Size(max = 24) String name, @Min(0) Integer seed) {}
    public record Join(@NotBlank @Size(max = 24) String name) {}

    @PostMapping @ResponseStatus(HttpStatus.CREATED)
    public GameService.Session create(@Valid @RequestBody Start request) { return games.create(request.name(), request.seed()); }
    @PostMapping("/{code}/join")
    public GameService.Session join(@PathVariable String code, @Valid @RequestBody Join request) { return games.join(code.toUpperCase(), request.name()); }
    @GetMapping("/{code}")
    public ObjectNode snapshot(@PathVariable String code, @RequestHeader(value = "Authorization", required = false) String auth) { return games.snapshot(code.toUpperCase(), auth); }
    @PostMapping("/{code}/actions")
    public ObjectNode act(@PathVariable String code, @RequestHeader(value = "Authorization", required = false) String auth, @RequestBody GameService.Action action) { return games.act(code.toUpperCase(), auth, action); }
    @GetMapping(value = "/{code}/events", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public SseEmitter subscribe(@PathVariable String code, @RequestHeader(value = "Authorization", required = false) String auth) {
        // Subscription precedes a second snapshot; the client merges by version to close the subscribe race.
        var initial = games.snapshot(code.toUpperCase(), auth);
        var emitter = events.subscribe(code.toUpperCase(), initial);
        events.publish(code.toUpperCase(), games.snapshot(code.toUpperCase(), auth));
        return emitter;
    }
    @Bean WebMvcConfigurer cors(@Value("${casefile.cors-origins}") String origins) {
        return new WebMvcConfigurer() {
            @Override public void addCorsMappings(CorsRegistry registry) {
                registry.addMapping("/api/**").allowedOrigins(origins.split(",")).allowedMethods("GET", "POST").allowedHeaders("Content-Type", "Authorization").maxAge(3600);
            }
        };
    }
}
