import { useGameStore } from '../stores/gameStore';
import { useShallow } from 'zustand/react/shallow';
import { motion } from 'framer-motion';

export const TeamDisplay = () => {
  const { players, playerId } = useGameStore(
    useShallow(state => ({
      players: state.players,
      playerId: state.playerId,
    }))
  );

  // Group players by team
  const teams: Record<string, typeof players> = {};
  players.forEach(p => {
    const tid = p.team_id || 'unassigned';
    if (!teams[tid]) teams[tid] = [];
    teams[tid].push(p);
  });

  // Remove unassigned team (players without team)
  delete teams.unassigned;

  // If no teams, don't render
  if (Object.keys(teams).length === 0) {
    return null;
  }

  // Calculate team scores
  const teamScores: Record<string, number> = {};
  Object.entries(teams).forEach(([teamId, teamPlayers]) => {
    teamScores[teamId] = teamPlayers.reduce((sum, p) => sum + (p.score || 0), 0);
  });

  // Sort teams by score (desc)
  const sortedTeams = Object.entries(teams).sort(([aId], [bId]) => teamScores[bId] - teamScores[aId]);

  const currentPlayer = players.find(p => p.id === playerId);
  const currentTeamId = currentPlayer?.team_id;

  return (
     <div className="frosted-glass p-3 sm:p-4 mb-0">
       <h3 className="text-center font-bold text-primary mb-2 sm:mb-3">TEAMS</h3>
       <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-4">
        {sortedTeams.map(([teamId, teamPlayers]) => {
          const score = teamScores[teamId];
          const isMyTeam = teamId === currentTeamId;
          return (
            <motion.div
              key={teamId}
              layout
               className={`p-3 sm:p-4 rounded-xl ${isMyTeam ? 'border-2 border-primary bg-primary/10' : 'bg-white/5 border border-white/10'}`}
            >
              <div className="flex justify-between items-center mb-2">
                 <h4 className="font-bold text-white text-sm sm:text-base">
                  {teamId.toUpperCase().replace('TEAM_', 'TEAM ')}
                  {isMyTeam && <span className="ml-2 text-xs text-primary">(YOU)</span>}
                </h4>
                 <div className="text-lg sm:text-xl font-black text-primary">{score}</div>
              </div>
              <div className="space-y-2">
                {teamPlayers.map(player => (
                   <div key={player.id} className="flex justify-between items-center text-xs sm:text-sm">
                    <span className="text-white/80 truncate">{player.username}</span>
                    <span className="font-bold text-white">{player.score || 0}</span>
                  </div>
                ))}
              </div>
            </motion.div>
          );
        })}
      </div>
       <p className="text-xs text-white/30 mt-2 sm:mt-3 text-center">
        Team scores are updated in real-time
      </p>
    </div>
  );
};