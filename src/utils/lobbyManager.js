const lobbies = {}; // Example data structure for lobbies

function lobbyExists(lobbyId) {
  console.log(`Checking lobby existence for ID: ${lobbyId}`);
  if (typeof lobbyId !== "string" || lobbyId.trim() === "") {
    console.log("Invalid lobby ID!");
    return false;
  }
  return !!lobbies[lobbyId];
}

const prompts = [
  "The best way to start your day is with ___.",
  "I can't believe I saw ___ at the park!",
  "My favorite food is ___ because it tastes like ___.",
  "If I could have any superpower, it would be ___ because ___.",
];

function startRound(io, lobbyId) {
  const lobby = lobbies[lobbyId];
  if (!lobby) return;

  const judge = lobby.players[lobby.judgeIndex];
  const prompt = prompts[Math.floor(Math.random() * prompts.length)]; // Randomize the prompt

  lobby.prompt = prompt;
  lobby.submissions = []; // Reset submissions for the new round

  console.log(`🎲 Starting round ${lobby.round} in lobby ${lobbyId}`);
  console.log(`👨‍⚖️ Judge is: ${judge.name}`);

  // Emit round start info to all players
  lobby.players.forEach((player) => {
      const isJudge = player.id === judge.id;

      io.to(player.id).emit("new-round", {
          prompt,
          isJudge,
          judgeName: judge.name,
      });
  });
}

function createLobby(lobbyId, creator) {
  if (!lobbies[lobbyId]) {
    lobbies[lobbyId] = {
      lobbyId, // Store the lobby ID
      players: [{
        ...creator, // Spread the creator's data and add score
        score: 0, // Initialize score in player object
      }], // Add the creator to the lobby
      leaderId: creator.id, // Set the creator as the initial leader
      gameInProgress: false, // Set gameInProgress to false initially
    };
    console.log("Lobby created:", lobbies[lobbyId]);
  }
}

function addPlayerToLobby(lobbyId, player) {
  // Ensure the lobby exists and the player is not already in the list
  if (!lobbies[lobbyId]) {
    lobbies[lobbyId] = { players: [], gameInProgress: false }; // Initialize the lobby if it doesn't exist
  }

  if (!lobbies[lobbyId].players.some(p => p.id === player.id)) {
    lobbies[lobbyId].players.push({
      ...player, // Spread the player data
      score: 0,  // Initialize score for the new player
    });
  }
}

function getLobbyPlayers(lobbyId) {
  return lobbies[lobbyId] ? lobbies[lobbyId].players : [];
}

function removePlayerFromLobby(playerId) {
  for (const lobbyId in lobbies) {
    const lobby = lobbies[lobbyId];
    const players = lobby.players;
    const index = players.findIndex((player) => player.id === playerId);

    if (index !== -1) {
      console.log(`Removing player ${playerId} from lobby ${lobbyId}`);
      players.splice(index, 1); // Remove the player

      // Reassign leader if the leader left
      if (lobby.leaderId === playerId) {
        if (players.length > 0) {
          const newLeader = players[Math.floor(Math.random() * players.length)];
          lobby.leaderId = newLeader.id; // Assign a new leader
          console.log(`New leader for lobby ${lobbyId} is ${newLeader.id}`);
        } else {
          console.log(`Lobby ${lobbyId} is now empty and will be deleted.`);
          delete lobbies[lobbyId]; // Delete the lobby if empty
        }
      }
      break;
    }
  }
}

function handleRoundWinner(io, socket, lobbyId, selectedPlayerId) {
  const lobby = lobbies[lobbyId];
  if (!lobby) return;

  const judge = lobby.players[lobby.judgeIndex];
  if (socket.id !== judge.id) {
    console.error("Only the judge can pick a favorite!");
    return;
  }

  const winner = lobby.players.find((p) => p.id === selectedPlayerId);
  console.log(`🏆 ${winner.name} won the round!`);

  // Award points to the winner (score is stored in player object)
  winner.score += 1;

  // Notify all players of the round results
  io.to(lobbyId).emit("round-results", {
    winnerName: winner.name,
    scores: lobby.players.map((player) => ({
      name: player.name,
      score: player.score,
    })),
  });

  // Move to the next round
  lobby.round += 1;
  lobby.judgeIndex = (lobby.judgeIndex + 1) % lobby.players.length; // Rotate judge

  // Now start the next round for all players
  startRound(io, lobbyId); // This will notify all players in the lobby
}


// utils/lobbyManager.js
function updateLobbyState(io, lobbyId) {
  const lobby = lobbies[lobbyId];
  if (!lobby) return;

  const players = getLobbyPlayers(lobbyId);
  io.to(lobbyId).emit("update-players", players);

  const leader = lobby.players.find((player) => player.id === lobby.leaderId);
  io.to(lobbyId).emit("update-leader", { leaderId: lobby.leaderId, leaderName: leader.name });
}



module.exports = {
  lobbyExists,
  createLobby,
  addPlayerToLobby,
  getLobbyPlayers,
  removePlayerFromLobby,
  lobbies,
  startRound,
  handleRoundWinner,
  updateLobbyState
};
