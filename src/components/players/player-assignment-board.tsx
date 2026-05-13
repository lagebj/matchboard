"use client";

import { useState, useEffect, useTransition, createContext, useContext } from "react";
import type { PlayerAssignmentBoard, PlayerAssignmentBoardPlayer } from "@/domain/player-assignment/types";
import { fetchPlayerAssignmentBoard, movePlayerToTeamAction } from "@/domain/player-assignment/actions";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  useDraggable,
  useDroppable,
  type DragStartEvent,
  type DragEndEvent,
} from "@dnd-kit/core";
import type { UniqueIdentifier } from "@dnd-kit/core";

type BoardContextValue = {
  board: PlayerAssignmentBoard | null;
  onMove: () => void;
};

const BoardCtx = createContext<BoardContextValue>({ board: null, onMove: () => {} });

function BoardContextProvider({ board, onMove, children }: { board: PlayerAssignmentBoard | null; onMove: () => void; children: React.ReactNode }) {
  return <BoardCtx.Provider value={{ board, onMove }}>{children}</BoardCtx.Provider>;
}

function useBoardContext() {
  return useContext(BoardCtx);
}

function DraggablePlayerCard({ player }: { player: PlayerAssignmentBoardPlayer }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: player.playerId });
  const [showMoveSelect, setShowMoveSelect] = useState(false);

  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      className={`group rounded border border-zinc-700/50 bg-zinc-800/60 px-2.5 py-2 text-sm transition-colors hover:border-zinc-600 hover:bg-zinc-800 cursor-grab active:cursor-grabbing ${isDragging ? "opacity-30" : ""}`}
      onDoubleClick={() => setShowMoveSelect(!showMoveSelect)}
    >
      <div className="flex items-center justify-between gap-1">
        <span className="text-zinc-200 truncate">{player.displayName || player.playerId}</span>
        {player.openIssueCount != null && player.openIssueCount > 0 && (
          <span className="shrink-0 rounded bg-amber-900/40 px-1 py-0.5 text-[9px] font-medium text-amber-300">{player.openIssueCount}</span>
        )}
      </div>
      <div className="flex items-center gap-2 mt-0.5">
        {player.primaryPosition && <span className="text-[10px] text-zinc-500">{player.primaryPosition}</span>}
        {player.rotatable === false && <span className="text-[10px] text-zinc-600">non-rotatable</span>}
      </div>
      {showMoveSelect && (
        <div className="mt-1">
          <MoveToSelect player={player} onDone={() => setShowMoveSelect(false)} />
        </div>
      )}
    </div>
  );
}

function MoveToSelect({ player, onDone }: { player: PlayerAssignmentBoardPlayer; onDone: () => void }) {
  const [isPending, startTransition] = useTransition();
  const { board, onMove } = useBoardContext();

  function handleMove(targetTeamId: string | null) {
    startTransition(async () => {
      await movePlayerToTeamAction({
        playerId: player.playerId,
        targetTeamId,
        previousTeamId: player.teamId ?? undefined,
      });
      onMove();
      onDone();
    });
  }

  const options = board
    ? [
        ...board.teams.map((t) => ({ value: t.teamId, label: t.name })),
        { value: "__unassigned__", label: "Unassigned" },
      ]
    : [];

  return (
    <select
      className="w-full rounded border border-zinc-700 bg-zinc-900 px-1 py-0.5 text-[10px] text-zinc-300"
      disabled={isPending}
      value=""
      onChange={(e) => {
        const val = e.target.value;
        handleMove(val === "__unassigned__" ? null : val);
      }}
      autoFocus
    >
      <option value="" disabled>Move to...</option>
      {options.map((opt) => (
        <option key={opt.value} value={opt.value}>{opt.label}</option>
      ))}
    </select>
  );
}

function DroppableTeamColumn({ id, name, playerCount, children }: { id: string; name: string; playerCount: number; children: React.ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id });

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-zinc-200">{name}</h2>
        <span className="rounded bg-zinc-800 px-1.5 py-0.5 text-[10px] text-zinc-400">{playerCount} players</span>
      </div>
      <div
        ref={setNodeRef}
        className={`flex min-h-[200px] flex-col gap-1.5 rounded-lg border bg-zinc-900/30 p-2 transition-colors ${isOver ? "border-blue-500/60 bg-blue-950/20" : "border-zinc-800"}`}
      >
        {children}
      </div>
    </div>
  );
}

function DroppableUnassignedColumn({ playerCount, children }: { playerCount: number; children: React.ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id: "__unassigned__" });

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-zinc-400">Unassigned</h2>
        <span className="rounded bg-zinc-800 px-1.5 py-0.5 text-[10px] text-zinc-500">{playerCount} players</span>
      </div>
      <div
        ref={setNodeRef}
        className={`flex min-h-[200px] flex-col gap-1.5 rounded-lg border border-dashed bg-zinc-900/20 p-2 transition-colors ${isOver ? "border-blue-500/60 bg-blue-950/20" : "border-zinc-700"}`}
      >
        {children}
      </div>
    </div>
  );
}

export function PlayerAssignmentBoard() {
  const [board, setBoard] = useState<PlayerAssignmentBoard | null>(null);
  const [activeId, setActiveId] = useState<UniqueIdentifier | null>(null);
  const [isPending, startTransition] = useTransition();

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
  );

  function loadBoard() {
    startTransition(async () => {
      const result = await fetchPlayerAssignmentBoard();
      setBoard(result);
    });
  }

  useEffect(() => { loadBoard(); }, []);

  function handleDragStart(event: DragStartEvent) {
    setActiveId(event.active.id);
  }

  async function handleDragEnd(event: DragEndEvent) {
    setActiveId(null);
    const over = event.over;
    if (!over || !board) return;

    const playerId = String(event.active.id);
    const targetId = String(over.id);
    const targetTeamId = targetId === "__unassigned__" ? null : targetId;

    const previousTeamId = board.teams.flatMap((t) => t.players).find((p) => p.playerId === playerId)?.teamId ?? null;

    startTransition(async () => {
      try {
        await movePlayerToTeamAction({ playerId, targetTeamId, previousTeamId: previousTeamId ?? undefined });
      } catch {
        setBoard(board);
        return;
      }
      loadBoard();
    });
  }

  const activePlayer = board
    ? [...board.teams.flatMap((t) => t.players), ...board.unassigned].find((p) => p.playerId === activeId)
    : null;

  return (
    <BoardContextProvider board={board} onMove={loadBoard}>
      <div className="flex flex-col gap-4">
        <div>
          <h1 className="text-lg font-semibold text-zinc-100">Players</h1>
          <p className="text-xs text-zinc-500 mt-0.5">Drag players between columns or double-click for the move menu.</p>
        </div>

        {isPending && !board ? (
          <div className="rounded-md border border-zinc-700/40 bg-zinc-800/20 p-6 text-sm text-zinc-500">Loading players...</div>
        ) : !board ? (
          <div className="rounded-md border border-zinc-700/40 bg-zinc-800/20 p-6 text-sm text-zinc-400">No players found.</div>
        ) : (
          <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-4">
              {board.teams.map((team) => (
                <DroppableTeamColumn key={team.teamId} id={team.teamId} name={team.name} playerCount={team.players.length}>
                  {team.players.length === 0 ? (
                    <p className="py-4 text-center text-xs text-zinc-600">Drop players here</p>
                  ) : (
                    team.players.map((player) => (
                      <DraggablePlayerCard key={player.playerId} player={player} />
                    ))
                  )}
                </DroppableTeamColumn>
              ))}
              <DroppableUnassignedColumn playerCount={board.unassigned.length}>
                {board.unassigned.length === 0 ? (
                  <p className="py-4 text-center text-xs text-zinc-600">No unassigned players</p>
                ) : (
                  board.unassigned.map((player) => (
                    <DraggablePlayerCard key={player.playerId} player={player} />
                  ))
                )}
              </DroppableUnassignedColumn>
            </div>
            <DragOverlay>
              {activePlayer ? (
                <div className="rounded border border-zinc-600 bg-zinc-800 px-3 py-2 text-sm text-zinc-200 shadow-lg">
                  {activePlayer.displayName || activePlayer.playerId}
                  {activePlayer.primaryPosition && (
                    <span className="ml-2 text-[10px] text-zinc-400">{activePlayer.primaryPosition}</span>
                  )}
                </div>
              ) : null}
            </DragOverlay>
          </DndContext>
        )}
      </div>
    </BoardContextProvider>
  );
}