package dev.casefile;

import com.fasterxml.jackson.databind.*;
import com.sun.net.httpserver.HttpServer;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.*;
import org.springframework.test.web.servlet.*;
import java.net.*;
import java.nio.file.*;
import java.util.*;
import java.util.concurrent.*;
import static org.assertj.core.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
class GameIntegrationTest {
    static final HttpServer generator;
    static {
        try {
            generator = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
            byte[] fixture = Files.readAllBytes(Path.of("../shared/demo-case.json"));
            generator.createContext("/v1/cases/generate", exchange -> {
                if (exchange.getRequestHeaders().getFirst("Content-Length") == null) {
                    exchange.sendResponseHeaders(413, -1); exchange.close(); return;
                }
                exchange.getRequestBody().readAllBytes();
                exchange.getResponseHeaders().set("Content-Type", "application/json");
                exchange.sendResponseHeaders(200, fixture.length); exchange.getResponseBody().write(fixture); exchange.close();
            }); generator.start();
        } catch (Exception ex) { throw new ExceptionInInitializerError(ex); }
    }
    @DynamicPropertySource static void properties(DynamicPropertyRegistry r) { r.add("casefile.generator-url", () -> "http://127.0.0.1:" + generator.getAddress().getPort()); }
    @AfterAll static void shutdown() { generator.stop(0); }
    @Autowired MockMvc mvc;
    @Autowired ObjectMapper mapper;
    @Autowired GameService games;
    @Autowired MemberRepository members;

    JsonNode start() throws Exception { return mapper.readTree(mvc.perform(post("/api/rooms").contentType("application/json").content("{\"name\":\"Ada\",\"seed\":41}")).andExpect(status().isCreated()).andReturn().getResponse().getContentAsString()); }
    String code(JsonNode s) { return s.path("state").path("code").asText(); }
    String auth(JsonNode s) { return "Bearer " + s.path("token").asText(); }
    JsonNode act(JsonNode s, String type, String target, List<String> proof, String id) throws Exception {
        var body = mapper.createObjectNode().put("requestId", id).put("type", type).put("target", target);
        if (proof != null) body.set("evidenceIds", mapper.valueToTree(proof));
        return mapper.readTree(mvc.perform(post("/api/rooms/" + code(s) + "/actions").header("Authorization", auth(s)).contentType("application/json").content(body.toString())).andExpect(status().isOk()).andReturn().getResponse().getContentAsString());
    }
    JsonNode act(JsonNode s, String type, String target) throws Exception { return act(s, type, target, null, UUID.randomUUID().toString()); }

    @Test void snapshotDoesNotLeakSecretsAndTokenIsHashed() throws Exception {
        var s = start(); var state = s.path("state");
        assertThat(state.path("caseFile").has("solution")).isFalse();
        assertThat(state.path("caseFile").has("facts")).isFalse();
        assertThat(state.path("caseFile").path("suspects").get(1).has("statement")).isFalse();
        assertThat(state.has("processedRequests")).isFalse();
        assertThat(members.findById(s.path("playerId").asText()).orElseThrow().tokenHash).isNotEqualTo(s.path("token").asText()).hasSize(64);
        mvc.perform(get("/api/rooms/" + code(s))).andExpect(status().isUnauthorized());
        var other = start();
        mvc.perform(get("/api/rooms/" + code(s)).header("Authorization", auth(other))).andExpect(status().isUnauthorized());
    }
    @Test void duplicateRequestIsAppliedExactlyOnce() throws Exception {
        var s = start(); String id = UUID.randomUUID().toString();
        var first = act(s, "inspect", "access-log", null, id);
        var repeat = act(s, "inspect", "access-log", null, id);
        assertThat(repeat).isEqualTo(first);
        assertThat(repeat.path("discovered").size()).isEqualTo(1);
        assertThat(repeat.path("timeline").size()).isEqualTo(2);
    }
    @Test void accusationRequiresBothInterviewAndExaminedProof() throws Exception {
        var s = start();
        var body = Map.of("requestId", UUID.randomUUID().toString(), "type", "accuse", "target", "elias", "evidenceIds", List.of("access-log", "locker-receipt"));
        mvc.perform(post("/api/rooms/" + code(s) + "/actions").header("Authorization", auth(s)).contentType("application/json").content(mapper.writeValueAsString(body))).andExpect(status().isBadRequest());
        act(s, "inspect", "access-log"); act(s, "inspect", "locker-receipt");
        mvc.perform(post("/api/rooms/" + code(s) + "/actions").header("Authorization", auth(s)).contentType("application/json").content(mapper.writeValueAsString(body))).andExpect(status().isBadRequest());
        var interviewed = act(s, "interview", "elias");
        assertThat(interviewed.path("statements").path("elias").asText()).contains("never left my pocket");
        var solved = act(s, "accuse", "elias", List.of("locker-receipt", "access-log"), UUID.randomUUID().toString());
        assertThat(solved.path("status").asText()).isEqualTo("solved");
        mvc.perform(post("/api/rooms/" + code(s) + "/actions").header("Authorization", auth(s)).contentType("application/json").content(mapper.writeValueAsString(body))).andExpect(status().isConflict());
    }
    @Test void wrongProofDoesNotWinAndThreeFailuresCloseTheCase() throws Exception {
        var s = start(); act(s, "inspect", "access-log"); act(s, "inspect", "voice-note"); act(s, "interview", "elias");
        JsonNode state = null;
        for (int i = 0; i < 3; i++) state = act(s, "accuse", "elias", List.of("access-log", "voice-note"), UUID.randomUUID().toString());
        assertThat(state.path("mistakes").asInt()).isEqualTo(3); assertThat(state.path("status").asText()).isEqualTo("cold");
    }
    @Test void simultaneousInspectionsDoNotLoseUpdates() throws Exception {
        var s = start(); List<String> evidence = List.of("access-log", "locker-receipt", "voice-note", "floor-plan", "security-still", "exhibition-note");
        try (var pool = Executors.newFixedThreadPool(6)) {
            var jobs = new ArrayList<Callable<Object>>();
            for (String id : evidence) jobs.add(() -> games.act(code(s), auth(s), new GameService.Action(UUID.randomUUID().toString(), "inspect", id, null, null, null)));
            for (var result : pool.invokeAll(jobs)) result.get(15, TimeUnit.SECONDS);
        }
        var snapshot = games.snapshot(code(s), auth(s));
        assertThat(snapshot.path("discovered").size()).isEqualTo(6);
        assertThat(snapshot.path("version").asInt()).isEqualTo(7);
    }
    @Test void roomCapacityAndNameValidationAreEnforced() throws Exception {
        mvc.perform(post("/api/rooms").contentType("application/json").content("{\"name\":\"  \"}")).andExpect(status().isBadRequest());
        var s = start();
        for (int i = 1; i < 8; i++) mvc.perform(post("/api/rooms/" + code(s) + "/join").contentType("application/json").content("{\"name\":\"Detective\"}")).andExpect(status().isOk());
        mvc.perform(post("/api/rooms/" + code(s) + "/join").contentType("application/json").content("{\"name\":\"Ninth\"}")).andExpect(status().isConflict());
    }
    @Test void teammatesReceiveCommittedDiscoveriesOverAuthenticatedSse() throws Exception {
        var host = start();
        var teammate = mapper.readTree(mvc.perform(post("/api/rooms/" + code(host) + "/join")
            .contentType("application/json").content("{\"name\":\"Tobi\"}")).andExpect(status().isOk()).andReturn().getResponse().getContentAsString());
        var stream = mvc.perform(get("/api/rooms/" + code(host) + "/events").header("Authorization", auth(teammate)))
            .andExpect(status().isOk()).andExpect(request().asyncStarted()).andReturn();
        try {
            var before = stream.getResponse().getContentAsString();
            assertThat(before).contains("event:state").doesNotContain("solution_json", "processedRequests");
            act(host, "inspect", "access-log");
            var after = stream.getResponse().getContentAsString().substring(before.length());
            assertThat(after).contains("event:state", "\"discovered\":[\"access-log\"]");
            assertThat(games.snapshot(code(host), auth(teammate)).path("discovered").size()).isEqualTo(1);
        } finally { stream.getRequest().getAsyncContext().complete(); }
    }
}
