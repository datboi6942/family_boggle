import { useGameStore } from '../stores/gameStore';
import { useShallow } from 'zustand/react/shallow';
import { useWebSocketContext } from '../contexts/WebSocketContext';
import { useAudioContext } from '../contexts/AudioContext';
import { MonsterAvatar } from './MonsterAvatar';

export const TeamAssignment = () => {
  const { players, hostId, playerId } = useGameStore(
    useShallow(state => ({
      players: state.players,
      hostId: state.hostId,
      playerId: state.playerId,
    }))
  );
  const { send } = useWebSocketContext();
  const audio = useAudioContext();

  const isHost = hostId === playerId;
  if (!isHost) {
    // Non-hosts see read-only team display
    const teams: Record<string, typeof players> = {};
    players.forEach(p => {
      const tid = p.team_id || 'unassigned';
      if (!teams[tid]) teams[tid] = [];
      teams[tid].push(p);
    });

    return (
      <div className="space-y-4">
        <h3 className="text-center font-bold text-white/50">TEAMS</h3>
        <div className="grid grid-cols-2 gap-4">
          {Object.entries(teams).map(([teamId, teamPlayers]) => (
            <div key={teamId} className="frosted-glass p-4">
              <p className="font-bold text-primary mb-2">
                {teamId === 'unassigned' ? 'Unassigned' : `Team ${teamId.toUpperCase().replace('TEAM_', '')}`}
              </p>
              <div className="space-y-2">
                {teamPlayers.map(p => (
                  <div key={p.id} className="flex items-center space-x-2">
                    <MonsterAvatar name={p.character} size={30} />
                    <span className="text-sm truncate">{p.username}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Host assignment UI
  const handleAssign = (playerId: string, teamId: string) => {
    audio.playButtonClick();
    // Build new assignments: keep existing assignments, update this player
    const assignments: Record<string, string> = {};
    players.forEach(p => {
      if (p.id === playerId) {
        assignments[p.id] = teamId;
      } else if (p.team_id) {
        assignments[p.id] = p.team_id;
      }
    });
    send('assign_teams', { team_assignments: assignments });
  };

  const teams = ['team_a', 'team_b'];
  const unassignedPlayers = players.filter(p => !p.team_id);

  return (
    <div className="space-y-4">
      <h3 className="text-center font-bold text-white/50">ASSIGN TEAMS</h3>
      <div className="grid grid-cols-2 gap-4">
        {teams.map(teamId => {
          const teamPlayers = players.filter(p => p.team_id === teamId);
          return (
            <div key={teamId} className="frosted-glass p-4">
              <p className="font-bold text-primary mb-2">Team {teamId.toUpperCase().replace('TEAM_', '')}</p>
              <div className="space-y-2 min-h-[100px]">
                {teamPlayers.map(p => (
                  <div key={p.id} className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <MonsterAvatar name={p.character} size={30} />
                      <span className="text-sm truncate">{p.username}</span>
                    </div>
                    <button
                      onClick={() => handleAssign(p.id, '')}
                      className="text-xs bg-white/10 px-2 py-1 rounded"
                    >
                      Remove
                    </button>
                  </div>
                ))}
                <div className="pt-2 border-t border-white/10">
                  <p className="text-xs text-white/50 mb-1">Assign player:</p>
                  {unassignedPlayers.map(p => (
                    <button
                      key={p.id}
                      onClick={() => handleAssign(p.id, teamId)}
                      className="block w-full text-left text-xs bg-white/5 hover:bg-white/10 p-2 rounded mb-1"
                    >
                      {p.username}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          );
        })}
      </div>
      {unassignedPlayers.length > 0 && (
        <div className="frosted-glass p-4">
          <p className="font-bold text-white/50 mb-2">Unassigned Players</p>
          <div className="flex flex-wrap gap-2">
            {unassignedPlayers.map(p => (
              <div key={p.id} className="flex items-center space-x-2 bg-white/5 p-2 rounded">
                <MonsterAvatar name={p.character} size={24} />
                <span className="text-sm">{p.username}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};