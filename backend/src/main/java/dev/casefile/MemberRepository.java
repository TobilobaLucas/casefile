package dev.casefile;

import org.springframework.data.jpa.repository.JpaRepository;
import java.util.Optional;

public interface MemberRepository extends JpaRepository<RoomMember, String> {
    Optional<RoomMember> findByRoomCodeAndTokenHash(String roomCode, String tokenHash);
    long countByRoomCode(String roomCode);
}
