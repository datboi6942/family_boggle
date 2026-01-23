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
      <div className="frosted-glass p-2 sm:p-3 mb-0 max-h-36 overflow-y-auto">
        <h3 className="text-center font-bold text-primary text-sm mb-1">TEAMS</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-1 sm:gap-2">
         {sortedTeams.map(([teamId, teamPlayers]) => {
           const score = teamScores[teamId];
           const isMyTeam = teamId === currentTeamId;
           return (
             <motion.div
               key={teamId}
               layout
                className={`p-2 sm:p-3 rounded-lg ${isMyTeam ? 'border-2 border-primary bg-primary/10' : 'bg-white/5 border border-white/10'}`}
             >
               <div className="flex justify-between items-center mb-1">
                  <h4 className="font-bold text-white text-xs sm:text-sm">
                   {teamId.toUpperCase().replace('TEAM_', 'TEAM ')}
                   {isMyTeam && <span className="ml-1 text-xs text-primary">(YOU)</span>}
                 </h4>
                  <div className="text-base sm:text-lg font-black text-primary">{score}</div>
               </div>
               <div className="space-y-1">
                 {teamPlayers.map(player => (
                    <div key={player.id} className="flex justify-between items-center text-xs">
                     <span className="text-white/80 truncate">{player.username}</span>
                     <span className="font-bold text-white">{player.score || 0}</span>
                   </div>
                 ))}
               </div>
             </motion.div>
           );
         })}
       </div>
        <p className="text-xs text-white/30 mt-1 text-center">
         Team scores are updated in real-time
       </p>
     </div>
   );
};