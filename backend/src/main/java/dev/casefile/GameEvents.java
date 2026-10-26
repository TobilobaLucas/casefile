package dev.casefile;

import com.fasterxml.jackson.databind.node.ObjectNode;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;
import java.util.concurrent.*;

/** One-process fan-out. Durable state remains in SQL; reconnect always fetches it. */
@Component
public class GameEvents {
    private final ConcurrentMap<String, CopyOnWriteArrayList<SseEmitter>> rooms = new ConcurrentHashMap<>();
    public SseEmitter subscribe(String code, ObjectNode snapshot) {
        var emitter = new SseEmitter(300_000L);
        var listeners = rooms.computeIfAbsent(code, k -> new CopyOnWriteArrayList<>());
        listeners.add(emitter);
        Runnable remove = () -> { listeners.remove(emitter); if (listeners.isEmpty()) rooms.remove(code, listeners); };
        emitter.onCompletion(remove); emitter.onTimeout(remove); emitter.onError(e -> remove.run());
        send(emitter, snapshot);
        return emitter;
    }
    private void send(SseEmitter emitter, ObjectNode snapshot) {
        try { emitter.send(SseEmitter.event().name("state").id(snapshot.path("version").asText()).data(snapshot)); }
        catch (Exception e) { emitter.complete(); }
    }
    public void publish(String code, ObjectNode state) {
        var listeners = rooms.get(code);
        if (listeners != null) listeners.forEach(e -> send(e, state));
    }
    @Scheduled(fixedDelay = 20_000)
    void heartbeat() {
        rooms.values().forEach(list -> list.forEach(e -> {
            try { e.send(SseEmitter.event().comment("heartbeat")); }
            catch (Exception ex) { e.complete(); }
        }));
    }
}
