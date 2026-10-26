package dev.casefile;

import com.fasterxml.jackson.databind.*;
import com.fasterxml.jackson.databind.node.*;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.*;
import org.springframework.http.client.JdkClientHttpRequestFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.*;
import org.springframework.web.client.RestClient;
import org.springframework.web.server.ResponseStatusException;
import java.net.http.HttpClient;
import java.nio.charset.StandardCharsets;
import java.security.*;
import java.time.*;
import java.util.*;

@Service
public class GameService {
    private final RoomRepository rooms;
    private final MemberRepository members;
    private final ObjectMapper mapper;
    private final GameEvents events;
    private final RestClient generator;
    private final String generatorSecret;
    private final SecureRandom random = new SecureRandom();

    public record Session(String token, String playerId, ObjectNode state) {}
    public record Action(String requestId, String type, String target, String other, String note, List<String> evidenceIds) {}

    public GameService(RoomRepository rooms, MemberRepository members, ObjectMapper mapper, GameEvents events,
                       @Value("${casefile.generator-url}") String url,
                       @Value("${casefile.generator-secret}") String secret) {
        this.rooms = rooms; this.members = members; this.mapper = mapper; this.events = events; this.generatorSecret = secret;
        var client = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(3)).build();
        var factory = new JdkClientHttpRequestFactory(client);
        factory.setReadTimeout(Duration.ofSeconds(5));
        this.generator = RestClient.builder().baseUrl(url).requestFactory(factory).build();
    }

    @Transactional
    public Session create(String name, Integer seed) {
        ObjectNode generated;
        try {
            // The private standard-library HTTP adapter accepts bounded,
            // length-delimited JSON; do not send an unknown-length chunked body.
            byte[] requestBody = mapper.writeValueAsBytes(Map.of("seed", seed == null ? random.nextInt(Integer.MAX_VALUE) : seed));
            generated = generator.post().uri("/v1/cases/generate").header("X-Generator-Secret", generatorSecret)
                .contentType(MediaType.APPLICATION_JSON).contentLength(requestBody.length).body(requestBody)
                .retrieve().body(ObjectNode.class);
        } catch (Exception ex) { throw error(503, "The case engine is unavailable. Start the Python generator and try again."); }
        if (generated == null || !generated.has("solution")) throw error(502, "The case engine returned an invalid case.");
        var solution = generated.remove("solution");
        generated.remove("facts");
        // Statements are private until an interview is requested.
        var statements = mapper.createObjectNode();
        generated.withArray("suspects").forEach(s -> statements.set(s.path("id").asText(), ((ObjectNode)s).remove("statement")));
        ((ObjectNode)solution).set("statements", statements);
        String code;
        do { code = randomCode(); } while (rooms.existsById(code));
        var state = mapper.createObjectNode();
        state.put("code", code).put("version", 0).put("status", "investigating")
            .put("startedAt", Instant.now().toString()).put("mistakes", 0);
        state.set("caseFile", generated);
        for (String key : List.of("players", "discovered", "interviewed", "connections", "notes", "timeline", "processedRequests")) state.putArray(key);
        state.putObject("statements");
        var room = rooms.saveAndFlush(new GameRoom(code, state.toString(), solution.toString()));
        return addMember(room, state, name);
    }

    @Transactional
    public Session join(String code, String name) {
        var room = locked(code);
        var state = read(room.stateJson);
        if (!state.path("status").asText().equals("investigating")) throw error(409, "This case is already closed.");
        if (members.countByRoomCode(code) >= 8) throw error(409, "This room already has eight detectives.");
        return addMember(room, state, name);
    }

    private Session addMember(GameRoom room, ObjectNode state, String name) {
        String token = UUID.randomUUID() + "." + UUID.randomUUID();
        String id = UUID.randomUUID().toString();
        members.save(new RoomMember(id, room.code, name.strip(), hash(token)));
        state.withArray("players").addObject().put("id", id).put("name", name.strip());
        timeline(state, name.strip(), "joined the investigation", "join");
        save(room, state);
        return new Session(token, id, publicState(state));
    }

    @Transactional(readOnly = true)
    public ObjectNode snapshot(String code, String token) {
        authenticate(code, token);
        return publicState(read(rooms.findById(code).orElseThrow(() -> error(404, "Room not found.")).stateJson));
    }

    @Transactional
    public ObjectNode act(String code, String token, Action action) {
        var member = authenticate(code, token);
        var room = locked(code);
        var state = read(room.stateJson);
        if (action.requestId() == null || !action.requestId().matches("[a-zA-Z0-9-]{8,64}")) throw error(400, "A requestId of 8–64 letters, digits, or hyphens is required.");
        if (contains(state.withArray("processedRequests"), action.requestId())) return publicState(state);
        if (!state.path("status").asText().equals("investigating")) throw error(409, "This case is already closed.");
        if (state.withArray("processedRequests").size() >= 1000) throw error(409, "This room has reached its action limit. Start a new case.");
        var caseFile = state.with("caseFile");
        switch (action.type() == null ? "" : action.type()) {
            case "inspect" -> {
                requireItem(caseFile.withArray("evidence"), action.target());
                if (addUnique(state.withArray("discovered"), action.target())) timeline(state, member.displayName, "examined " + title(caseFile.withArray("evidence"), action.target()), "evidence");
            }
            case "interview" -> {
                requireItem(caseFile.withArray("suspects"), action.target());
                if (addUnique(state.withArray("interviewed"), action.target())) {
                    state.with("statements").set(action.target(), read(room.solutionJson).path("statements").path(action.target()));
                    timeline(state, member.displayName, "questioned " + name(caseFile.withArray("suspects"), action.target()), "interview");
                }
            }
            case "connect" -> {
                requireItem(caseFile.withArray("evidence"), action.target());
                requireItem(caseFile.withArray("evidence"), action.other());
                if (Objects.equals(action.target(), action.other())) throw error(400, "Choose two different exhibits.");
                var pair = new TreeSet<>(List.of(action.target(), action.other()));
                String id = String.join(":", pair);
                var connections = state.withArray("connections");
                int found = -1;
                for (int i = 0; i < connections.size(); i++) if (connections.get(i).path("id").asText().equals(id)) found = i;
                if (found >= 0) connections.remove(found);
                else { connections.addObject().put("id", id).put("from", pair.first()).put("to", pair.last()); timeline(state, member.displayName, "connected two exhibits", "connection"); }
            }
            case "note" -> {
                if (action.note() == null || action.note().isBlank() || action.note().length() > 500) throw error(400, "Notes must contain 1–500 characters.");
                if (state.withArray("notes").size() >= 50) throw error(409, "This case already has 50 notes.");
                state.withArray("notes").addObject().put("id", UUID.randomUUID().toString()).put("text", action.note().strip()).put("author", member.displayName).put("at", Instant.now().toString());
                timeline(state, member.displayName, "added a field note", "note");
            }
            case "accuse" -> {
                requireItem(caseFile.withArray("suspects"), action.target());
                if (action.evidenceIds() == null || action.evidenceIds().size() != 2 || new HashSet<>(action.evidenceIds()).size() != 2) throw error(400, "Submit exactly two different supporting exhibits.");
                for (String id : action.evidenceIds()) {
                    requireItem(caseFile.withArray("evidence"), id);
                    if (!contains(state.withArray("discovered"), id)) throw error(400, "Examine both supporting exhibits first.");
                }
                if (!contains(state.withArray("interviewed"), action.target())) throw error(400, "Question this suspect before making an accusation.");
                var solution = read(room.solutionJson);
                Set<String> proof = new HashSet<>(); solution.withArray("proofIds").forEach(p -> proof.add(p.asText()));
                boolean correct = action.target().equals(solution.path("suspectId").asText()) && proof.equals(new HashSet<>(action.evidenceIds()));
                if (correct) {
                    state.put("status", "solved").put("finishedAt", Instant.now().toString()).put("explanation", solution.path("explanation").asText());
                    state.put("culpritId", action.target());
                    timeline(state, member.displayName, "closed the case. Mystery solved.", "solved");
                } else {
                    int mistakes = state.path("mistakes").asInt() + 1;
                    state.put("mistakes", mistakes);
                    timeline(state, member.displayName, "submitted a theory. The evidence did not hold up.", "mistake");
                    if (mistakes >= 3) {
                        state.put("status", "cold").put("finishedAt", Instant.now().toString()).put("explanation", solution.path("explanation").asText()).put("culpritId", solution.path("suspectId").asText());
                    }
                }
            }
            default -> throw error(400, "Unknown investigation action.");
        }
        state.withArray("processedRequests").add(action.requestId());
        save(room, state);
        return publicState(state);
    }

    private void save(GameRoom room, ObjectNode state) {
        state.put("version", state.path("version").asInt() + 1);
        room.stateJson = state.toString();
        rooms.save(room);
        var snapshot = publicState(state);
        // Never broadcast a state that could still roll back.
        TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
            @Override public void afterCommit() { events.publish(room.code, snapshot); }
        });
    }
    private ObjectNode publicState(ObjectNode state) { var copy = state.deepCopy(); copy.remove("processedRequests"); return copy; }
    private GameRoom locked(String code) { return rooms.locked(code).orElseThrow(() -> error(404, "Room not found. Check the six-letter code.")); }
    private RoomMember authenticate(String code, String token) {
        if (token == null || !token.startsWith("Bearer ") || token.length() > 200) throw error(401, "A room session is required.");
        return members.findByRoomCodeAndTokenHash(code, hash(token.substring(7))).orElseThrow(() -> error(401, "This session cannot access that room."));
    }
    private ObjectNode read(String value) {
        try { return (ObjectNode)mapper.readTree(value); } catch (Exception ex) { throw new IllegalStateException("Stored case state is invalid", ex); }
    }
    private void timeline(ObjectNode state, String actor, String text, String kind) {
        state.withArray("timeline").addObject().put("id", UUID.randomUUID().toString()).put("actor", actor).put("text", text).put("kind", kind).put("at", Instant.now().toString());
    }
    private static boolean contains(ArrayNode list, String value) { for (var item : list) if (item.asText().equals(value)) return true; return false; }
    private static boolean addUnique(ArrayNode list, String value) { if (contains(list, value)) return false; list.add(value); return true; }
    private static void requireItem(ArrayNode list, String id) { for (var item : list) if (item.path("id").asText().equals(id)) return; throw error(400, "Unknown exhibit or suspect."); }
    private static String title(ArrayNode list, String id) { for (var item : list) if (item.path("id").asText().equals(id)) return item.path("title").asText(); return id; }
    private static String name(ArrayNode list, String id) { for (var item : list) if (item.path("id").asText().equals(id)) return item.path("name").asText(); return id; }
    static String hash(String token) {
        try { return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(token.getBytes(StandardCharsets.UTF_8))); }
        catch (NoSuchAlgorithmException ex) { throw new IllegalStateException(ex); }
    }
    private String randomCode() { var code = new StringBuilder(); String alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ"; for (int i = 0; i < 6; i++) code.append(alphabet.charAt(random.nextInt(alphabet.length()))); return code.toString(); }
    static ResponseStatusException error(int status, String message) { return new ResponseStatusException(HttpStatus.valueOf(status), message); }
}
