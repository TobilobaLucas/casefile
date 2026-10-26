package dev.casefile;

import jakarta.persistence.*;

@Entity
@Table(name = "game_room")
public class GameRoom {
    @Id @Column(length = 8) String code;
    @Column(name = "state_json", nullable = false, columnDefinition = "TEXT") String stateJson;
    @Column(name = "solution_json", nullable = false, columnDefinition = "TEXT") String solutionJson;
    @Version long revision;
    protected GameRoom() {}
    GameRoom(String code, String stateJson, String solutionJson) {
        this.code = code; this.stateJson = stateJson; this.solutionJson = solutionJson;
    }
}
