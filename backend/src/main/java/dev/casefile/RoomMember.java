package dev.casefile;

import jakarta.persistence.*;

@Entity
@Table(name = "room_member")
public class RoomMember {
    @Id @Column(length = 36) String id;
    @Column(name = "room_code", nullable = false, length = 8) String roomCode;
    @Column(name = "display_name", nullable = false, length = 24) String displayName;
    @Column(name = "token_hash", nullable = false, unique = true, length = 64) String tokenHash;
    protected RoomMember() {}
    RoomMember(String id, String code, String name, String tokenHash) {
        this.id = id; this.roomCode = code; this.displayName = name; this.tokenHash = tokenHash;
    }
}
