const { addPlayerToLobby, getLobbyPlayers, removePlayerFromLobby, createLobby, lobbyExists, lobbies} = require('./utils/lobbyManager');

const socketToLobby = {}; // Map socket IDs to lobby IDs

const generateWordOptions = () => {
    const words = ['apple', 'banana', 'cherry', 'dog', 'elephant', 'fish'];
    const options = [];
    for (let i = 0; i < 3; i++) {
      const randomIndex = Math.floor(Math.random() * words.length);
      options.push(words[randomIndex]);
    }
    return options;
  };

module.exports = (io) => {
  io.on("connection", (socket) => {
    console.log("🟢 New socket connected:", socket.id);

    // Event: Create a lobby
    socket.on("create-lobby", ({ lobbyId, name }, callback) => {
        console.log(`🏗️ ${name} is creating lobby ${lobbyId}`);
        if (lobbyExists(lobbyId)) {
            return callback({ success: false, message: "Lobby already exists" });
        }

        // Add the creator to the lobby
        createLobby(lobbyId, { id: socket.id, name });
        socketToLobby[socket.id] = lobbyId; // Map socket to lobby
        socket.join(lobbyId);

        console.log(`🏗️ Lobby ${lobbyId} created by ${name}`);

        // Emit the updated player list to the lobby
        const players = getLobbyPlayers(lobbyId);
        io.to(lobbyId).emit("update-players", players);

        callback({ success: true });
    });

    socket.on("chat-message", ({ lobbyId, message, sender }) => {
        console.log(`💬 Message from ${sender} in lobby ${lobbyId}: ${message}`);
        io.to(lobbyId).emit("chat-message", { sender, message }); // Broadcast to all players in the lobby
    });

    socket.on("start-game", (lobbyId) => {
        console.log(`Checking if lobby exists for ID: ${lobbyId}`);
        if (!lobbyExists(lobbyId)) {
            console.error("Lobby does not exist!");
            return;
        }
        
        const players = getLobbyPlayers(lobbyId);
        if (players.length <= 1) {
            console.error("Not enough players to start the game.");
            return;
        }
    
        const lobby = lobbies[lobbyId];
        if (!lobby) {
            console.error(`Lobby with ID ${lobbyId} is not found when starting the game!`);
            return;
        }
        
        lobby.gameInProgress = true; // Mark the game as in progress
        console.log("Game is now in progress for lobby:", lobbyId);
        
        const round = 1;
        const phase = 1; // "Enter Info" phase
        const wordOptions = generateWordOptions();
    
        // Send game state and word options
        io.to(lobbyId).emit('game-started', { round, phase, wordOptions });
        console.log(`🎮 Game started in lobby ${lobbyId} with players:`, players);
    });
    

    // Event: Join a lobby
    socket.on("join-lobby", ({ lobbyId, name }) => {
        console.log(`Checking lobby existence for ID: ${lobbyId}`);
    
        if (typeof lobbyId !== "string" || lobbyId.trim() === "") {
            console.log("Invalid lobby ID!");
            socket.emit("lobby-not-found", { success: false, message: "Invalid lobby ID!" });
            return;
        }
    
        const exists = lobbyExists(lobbyId);
        console.log(`Lobby exists: ${exists}`);
    
        if (!exists) {
            console.log("Lobby does not exist!");
            socket.emit("lobby-not-found", { success: false, message: "Lobby does not exist!" });
            return;
        }
        
        if (lobby.gameInProgress) {
            console.log("Cannot join lobby. Game is already in progress.");
            socket.emit("lobby-join-failed", { success: false, message: "Game is already in progress." });
            return;
        }
    
        if (!name) {
            console.log("🔎 Probe join (no name), lobby found");
            socket.emit("lobby-found", { success: true, message: "Lobby found!" });
            return;
        }
    
        const player = { id: socket.id, name };
        addPlayerToLobby(lobbyId, player);
        socketToLobby[socket.id] = lobbyId; // Map socket to lobby
        socket.join(lobbyId);
    
        console.log(`🔗 ${name} joined lobby ${lobbyId}`);
        const players = getLobbyPlayers(lobbyId);
        io.to(lobbyId).emit("update-players", players);
    });

    // Event: Leave a lobby
    socket.on("leave-lobby", ({ lobbyId, playerId }) => {
        console.log(`🚪 Player ${playerId} is leaving lobby ${lobbyId}`);
        if (lobbyId && playerId) {
            removePlayerFromLobby(playerId); // Remove the player from the lobby
            const players = getLobbyPlayers(lobbyId); // Get the updated player list
            io.to(lobbyId).emit("update-players", players); // Notify remaining players
            delete socketToLobby[playerId]; // Clean up the mapping
        }
    });

    // Event: Disconnect
    socket.on("disconnect", () => {
        const lobbyId = socketToLobby[socket.id]; // Get the lobby ID for this socket
        if (lobbyId) {
            console.log(`🔴 Socket ${socket.id} disconnected from lobby ${lobbyId}`);
            removePlayerFromLobby(socket.id); // Remove player from the lobby
            const players = getLobbyPlayers(lobbyId); // Get updated player list
            io.to(lobbyId).emit("update-players", players); // Notify remaining players
            delete socketToLobby[socket.id]; // Clean up the mapping
        } else {
            console.log(`🔴 Socket ${socket.id} disconnected but was not in any lobby`);
        }
    });
  });
};