package dev.casefile;

import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.*;
import org.springframework.data.repository.query.Param;
import java.util.Optional;

public interface RoomRepository extends JpaRepository<GameRoom, String> {
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select r from GameRoom r where r.code = :code")
    Optional<GameRoom> locked(@Param("code") String code);
}
