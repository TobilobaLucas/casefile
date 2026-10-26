CREATE TABLE game_room (
    code VARCHAR(8) PRIMARY KEY,
    state_json TEXT NOT NULL,
    solution_json TEXT NOT NULL,
    revision BIGINT NOT NULL DEFAULT 0
);
CREATE TABLE room_member (
    id VARCHAR(36) PRIMARY KEY,
    room_code VARCHAR(8) NOT NULL REFERENCES game_room(code),
    display_name VARCHAR(24) NOT NULL,
    token_hash VARCHAR(64) NOT NULL UNIQUE
);
CREATE INDEX ix_member_room ON room_member(room_code);
