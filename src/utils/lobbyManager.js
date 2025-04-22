const lobbies = {}; // Example data structure for lobbies

function lobbyExists(lobbyId) {
  console.log(`Checking lobby existence for ID: ${lobbyId}`);
  if (typeof lobbyId !== "string" || lobbyId.trim() === "") {
    console.log("Invalid lobby ID!");
    return false;
  }
  return !!lobbies[lobbyId];
}

function createLobby(lobbyId, creator) {
  // Initialize the lobby with the given lobbyId if it doesn't already exist
  if (!lobbies[lobbyId]) {
      lobbies[lobbyId] = {
          players: [creator], // Add the creator to the lobby
          gameInProgress: false, // Set gameInProgress to false initially
      };
      console.log("Lobby created:", lobbies[lobbyId]);
      console.log("Lobby ID:", lobbies);
  }
}

function addPlayerToLobby(lobbyId, player) {
  // Ensure the lobby exists and the player is not already in the list
  if (!lobbies[lobbyId]) {
    lobbies[lobbyId] = { players: [], gameInProgress: false }; // Initialize the lobby if it doesn't exist
  }

  if (!lobbies[lobbyId].players.some(p => p.id === player.id)) {
    lobbies[lobbyId].players.push(player);
  }
}

function getLobbyPlayers(lobbyId) {
  return lobbies[lobbyId] ? lobbies[lobbyId].players : [];
}

function removePlayerFromLobby(socketId) {
  // Iterate over each lobby and remove the player
  for (const lobbyId in lobbies) {
    lobbies[lobbyId].players = lobbies[lobbyId].players.filter(player => player.id !== socketId);
    
    // If the lobby has no players left, remove the lobby
    if (lobbies[lobbyId].players.length === 0) {
      delete lobbies[lobbyId];
    }
  }
}

module.exports = {
  lobbyExists,
  createLobby,
  addPlayerToLobby,
  getLobbyPlayers,
  removePlayerFromLobby,
  lobbies
};
