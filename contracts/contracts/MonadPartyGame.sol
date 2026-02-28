// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title MonadPartyGame
 * @notice Manages multiplayer party game rooms on Monad. Players pay 1 MON entry fee,
 *         winner receives prize pool minus 5% platform fee.
 */
contract MonadPartyGame is ReentrancyGuard, Ownable {
    // ─── Constants ────────────────────────────────────────────────────────────
    uint256 public constant ENTRY_FEE = 1 ether; // 1 MON
    uint8 public constant MAX_PLAYERS = 8;
    uint256 public constant PLATFORM_FEE_BPS = 500; // 5% in basis points

    // ─── Types ────────────────────────────────────────────────────────────────
    enum RoomStatus { WAITING, IN_GAME, FINISHED }

    struct Room {
        bytes32 roomId;
        address host;
        address[] players;
        uint8 maxPlayers;
        RoomStatus status;
        uint256 pot;
        uint256 createdAt;
        bool exists;
    }

    // ─── State ────────────────────────────────────────────────────────────────
    mapping(bytes32 => Room) private rooms;
    mapping(bytes32 => mapping(address => bool)) private isPlayerInRoom;
    address public operator; // Backend operator that can call endGame
    uint256 public collectedFees;

    // ─── Events ───────────────────────────────────────────────────────────────
    event RoomCreated(bytes32 indexed roomId, address indexed host, uint8 maxPlayers);
    event PlayerJoined(bytes32 indexed roomId, address indexed player, uint256 pot);
    event GameStarted(bytes32 indexed roomId, uint256 playerCount);
    event GameEnded(bytes32 indexed roomId, address indexed winner);
    event RewardDistributed(bytes32 indexed roomId, address indexed winner, uint256 reward, uint256 fee);

    // ─── Modifiers ────────────────────────────────────────────────────────────
    modifier onlyOperatorOrOwner() {
        require(msg.sender == operator || msg.sender == owner(), "Not authorized");
        _;
    }

    modifier roomExists(bytes32 roomId) {
        require(rooms[roomId].exists, "Room does not exist");
        _;
    }

    // ─── Constructor ──────────────────────────────────────────────────────────
    constructor(address _operator) Ownable(msg.sender) {
        operator = _operator;
    }

    // ─── Admin Functions ──────────────────────────────────────────────────────

    /**
     * @notice Update the operator address (backend wallet)
     */
    function setOperator(address _operator) external onlyOwner {
        operator = _operator;
    }

    /**
     * @notice Withdraw collected platform fees
     */
    function withdrawFees() external onlyOwner nonReentrant {
        uint256 amount = collectedFees;
        collectedFees = 0;
        (bool success, ) = payable(owner()).call{value: amount}("");
        require(success, "Fee withdrawal failed");
    }

    // ─── Game Functions ───────────────────────────────────────────────────────

    /**
     * @notice Create a new game room. Host pays 1 MON entry fee.
     * @param roomId Unique bytes32 room identifier
     * @param maxPlayers Maximum number of players (2-8)
     */
    function createRoom(bytes32 roomId, uint8 maxPlayers) external payable nonReentrant {
        require(!rooms[roomId].exists, "Room already exists");
        require(msg.value == ENTRY_FEE, "Must pay exactly 1 MON");
        require(maxPlayers >= 2 && maxPlayers <= MAX_PLAYERS, "Invalid max players (2-8)");

        Room storage room = rooms[roomId];
        room.roomId = roomId;
        room.host = msg.sender;
        room.maxPlayers = maxPlayers;
        room.status = RoomStatus.WAITING;
        room.pot = msg.value;
        room.createdAt = block.timestamp;
        room.exists = true;
        room.players.push(msg.sender);
        isPlayerInRoom[roomId][msg.sender] = true;

        emit RoomCreated(roomId, msg.sender, maxPlayers);
        emit PlayerJoined(roomId, msg.sender, room.pot);
    }

    /**
     * @notice Join an existing room. Player pays 1 MON entry fee.
     * @param roomId The room to join
     */
    function joinRoom(bytes32 roomId) external payable nonReentrant roomExists(roomId) {
        Room storage room = rooms[roomId];

        require(room.status == RoomStatus.WAITING, "Room not accepting players");
        require(room.players.length < room.maxPlayers, "Room is full");
        require(!isPlayerInRoom[roomId][msg.sender], "Already in this room");
        require(msg.value == ENTRY_FEE, "Must pay exactly 1 MON");

        room.players.push(msg.sender);
        room.pot += msg.value;
        isPlayerInRoom[roomId][msg.sender] = true;

        emit PlayerJoined(roomId, msg.sender, room.pot);
    }

    /**
     * @notice Start the game. Can only be called by the room host.
     *         Requires at least 2 players.
     * @param roomId The room to start
     */
    function startGame(bytes32 roomId) external roomExists(roomId) {
        Room storage room = rooms[roomId];

        require(msg.sender == room.host, "Only host can start the game");
        require(room.status == RoomStatus.WAITING, "Game already started");
        require(room.players.length >= 2, "Need at least 2 players");

        room.status = RoomStatus.IN_GAME;

        emit GameStarted(roomId, room.players.length);
    }

    /**
     * @notice End the game and distribute rewards. Called by operator/owner (backend).
     * @param roomId The room that ended
     * @param winner Address of the winning player
     */
    function endGame(bytes32 roomId, address winner) external nonReentrant onlyOperatorOrOwner roomExists(roomId) {
        Room storage room = rooms[roomId];

        require(room.status == RoomStatus.IN_GAME, "Game is not in progress");
        require(isPlayerInRoom[roomId][winner], "Winner must be a room player");

        room.status = RoomStatus.FINISHED;

        uint256 totalPot = room.pot;
        uint256 fee = (totalPot * PLATFORM_FEE_BPS) / 10000;
        uint256 reward = totalPot - fee;

        collectedFees += fee;
        room.pot = 0;

        emit GameEnded(roomId, winner);
        emit RewardDistributed(roomId, winner, reward, fee);

        (bool success, ) = payable(winner).call{value: reward}("");
        require(success, "Reward transfer failed");
    }

    // ─── View Functions ───────────────────────────────────────────────────────

    /**
     * @notice Get room information
     */
    function getRoom(bytes32 roomId) external view roomExists(roomId) returns (
        bytes32 id,
        address host,
        address[] memory players,
        uint8 maxPlayers,
        RoomStatus status,
        uint256 pot,
        uint256 createdAt
    ) {
        Room storage room = rooms[roomId];
        return (
            room.roomId,
            room.host,
            room.players,
            room.maxPlayers,
            room.status,
            room.pot,
            room.createdAt
        );
    }

    /**
     * @notice Check if a player is in a specific room
     */
    function isPlayerInRoomCheck(bytes32 roomId, address player) external view returns (bool) {
        return isPlayerInRoom[roomId][player];
    }

    /**
     * @notice Get player count in a room
     */
    function getPlayerCount(bytes32 roomId) external view roomExists(roomId) returns (uint256) {
        return rooms[roomId].players.length;
    }

    /**
     * @notice Get contract balance (should equal collectedFees + active pots)
     */
    function getContractBalance() external view returns (uint256) {
        return address(this).balance;
    }
}
