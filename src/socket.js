// Import the new functions at the top
const { addPlayerToLobby, getLobbyPlayers, removePlayerFromLobby, createLobby, lobbyExists, lobbies, startRound, handleRoundWinner, updateLobbyState } = require('./utils/lobbyManager');

const socketToLobby = {}; // Map socket IDs to lobby IDs

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

      // Retrieve the newly created lobby
      const lobby = lobbies[lobbyId];
      if (!lobby) {
        console.error(`Lobby ${lobbyId} not found after creation!`);
        return callback({ success: false, message: "Failed to create lobby." });
      }

      // Emit the leader's information
      const leader = lobby.players.find((player) => player.id === lobby.leaderId);
      io.to(lobbyId).emit("update-leader", { leaderId: lobby.leaderId, leaderName: leader.name });

      console.log(`🏗️ Lobby ${lobbyId} created by ${name}`);

      // Emit the updated player list to the lobby
      const players = getLobbyPlayers(lobbyId);
      io.to(lobbyId).emit("update-players", players);

      callback({ success: true });
    });

    // Event: Judge picks winner
    socket.on("judge-pick", ({ lobbyId, selectedPlayerId }) => {
        handleRoundWinner(io, socket, lobbyId, selectedPlayerId);
    });

    // Event: Round results (from client-side)
    socket.on("round-results", ({ winnerName, scores }) => {
      console.log(`🏆 ${winnerName} won the round! Scores:`, scores);
      setWinner(winnerName);
      setScores(scores);
    });

    // Event: Start new round
    socket.on("new-round", ({ prompt, isJudge, judgeName }) => {
        console.log(`🎲 New round started. Prompt: ${prompt}`);
        setPrompt(prompt);
        setIsJudge(isJudge);
        setJudgeName(judgeName);
        setSubmissions([]); // Clear previous submissions
        setHasSubmitted(false); // Reset submission state for this round
        setAllSubmitted(false); // Reset all submitted status
    });

    // Event: Player submits an answer
    socket.on("submit-answer", ({ lobbyId, answer }) => {
      const lobby = lobbies[lobbyId];
      if (!lobby) return;

      const player = lobby.players.find((p) => p.id === socket.id);
      if (!player) return;

      lobby.submissions.push({ playerId: player.id, playerName: player.name, answer });
      console.log(`✏️ ${player.name} submitted: ${answer}`);

      const judge = lobby.players[lobby.judgeIndex];
      if (lobby.submissions.length === lobby.players.length - 1) {
        io.to(judge.id).emit("judge-pick", { submissions: lobby.submissions });
      }
    });

    // Event: Chat message
    socket.on("chat-message", ({ lobbyId, message, sender }) => {
      console.log(`💬 Message from ${sender} in lobby ${lobbyId}: ${message}`);
      io.to(lobbyId).emit("chat-message", { sender, message });
    });

    // Event: Start game
    socket.on("start-game", (lobbyId) => {
      console.log(`🚀 start-game received from: ${socket.id}`);
      console.log(`📣 Emitting game-started to room: ${lobbyId}`);

      if (!lobbyExists(lobbyId)) {
        console.error("Lobby does not exist!");
        return;
      }

      const lobby = lobbies[lobbyId];
      if (!lobby || lobby.players.length < 2) {
        console.error("Not enough players to start the game.");
        return;
      }

      lobby.gameInProgress = true;
      lobby.round = 1;
      lobby.judgeIndex = 0;

      io.to(lobbyId).emit("game-started", {
        round: lobby.round,
        phase: 1,
        players: lobby.players,
      });

      console.log(`🎮 Game started in lobby ${lobbyId}`);
      startRound(io, lobbyId);
    });

    // Event: Join a lobby
    socket.on("join-lobby", ({ lobbyId, name }) => {
      console.log(`Checking lobby existence for ID: ${lobbyId}`);

      if (!lobbyExists(lobbyId)) {
        console.log("Lobby does not exist!");
        socket.emit("lobby-not-found", { success: false, message: "Lobby does not exist!" });
        return;
      }

      const lobby = lobbies[lobbyId];
      if (!lobby) {
        console.error(`Lobby ${lobbyId} not found!`);
        socket.emit("lobby-not-found", { success: false, message: "Lobby not found!" });
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
      socketToLobby[socket.id] = lobbyId;
      socket.join(lobbyId);

      console.log(`🔗 ${name} joined lobby ${lobbyId}`);
      updateLobbyState(io, lobbyId); // Use updateLobbyState

      // Emit the leader's information
      const leader = lobby.players.find((player) => player.id === lobby.leaderId);
      io.to(lobbyId).emit("update-leader", { leaderId: lobby.leaderId, leaderName: leader.name });
    });

    // Event: Leave a lobby
    socket.on("leave-lobby", ({ lobbyId, playerId }) => {
      console.log(`🚪 Player ${playerId} is leaving lobby ${lobbyId}`);
      if (lobbyId && playerId) {
        removePlayerFromLobby(playerId); // Remove the player from the lobby
        updateLobbyState(io, lobbyId); // Use updateLobbyState
      }
    });

    // Event: Disconnect
    socket.on("disconnect", () => {
      const lobbyId = socketToLobby[socket.id];
      if (lobbyId) {
        console.log(`🔴 Socket ${socket.id} disconnected from lobby ${lobbyId}`);
        removePlayerFromLobby(socket.id);
        updateLobbyState(io, lobbyId); // Use updateLobbyState
      } else {
        console.log(`🔴 Socket ${socket.id} disconnected but was not in any lobby`);
      }
    });
  });
};
