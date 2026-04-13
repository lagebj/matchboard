import Link from "next/link";
import {
  AvailabilityStatus,
  BestSide,
  FootPreference,
  SecondaryFoot,
  type Player,
  type Team,
} from "@/generated/prisma/client";
import {
  availabilityOptions,
  bestSideOptions,
  optionalPlayerPositionOptions,
  playerPositionOptions,
  preferredFootOptions,
  secondaryFootOptions,
} from "@/lib/player-form-options";
import { formatAvailabilityStatus, formatPlayerName } from "@/lib/player-metrics";

type TeamOption = Pick<Team, "id" | "name">;

type PlayerWithTeams = Player & {
  allowedFloatTeams: Array<{
    team: TeamOption;
    teamId: string;
  }>;
  coreTeam: TeamOption;
};

type PlayerEditorFormProps = {
  action: (formData: FormData) => void | Promise<void>;
  cancelHref?: string;
  player?: PlayerWithTeams;
  submitLabel: string;
  teams: TeamOption[];
};

function TextField({
  defaultValue,
  label,
  name,
  placeholder,
  required = false,
}: {
  defaultValue?: string;
  label: string;
  name: string;
  placeholder?: string;
  required?: boolean;
}) {
  return (
    <label className="flex flex-col gap-1 text-sm font-medium text-zinc-100">
      {label}
      <input
        className="h-10 rounded-xl border app-hairline bg-[rgba(8,10,14,0.32)] px-3 font-normal text-zinc-100 outline-none placeholder:text-zinc-500"
        defaultValue={defaultValue}
        name={name}
        placeholder={placeholder}
        required={required}
      />
    </label>
  );
}

function RatingField({
  defaultValue,
  label,
  name,
}: {
  defaultValue: number;
  label: string;
  name: string;
}) {
  return (
    <label className="flex flex-col gap-1 text-sm font-medium text-zinc-100">
      {label}
      <input
        className="h-10 rounded-xl border app-hairline bg-[rgba(8,10,14,0.32)] px-3 font-normal text-zinc-100 outline-none"
        defaultValue={defaultValue}
        max={5}
        min={1}
        name={name}
        required
        type="number"
      />
    </label>
  );
}

function SelectField({
  defaultValue,
  label,
  name,
  options,
  required = true,
}: {
  defaultValue: string;
  label: string;
  name: string;
  options: ReadonlyArray<{ label: string; value: string }>;
  required?: boolean;
}) {
  return (
    <label className="flex flex-col gap-1 text-sm font-medium text-zinc-100">
      {label}
      <select
        className="h-10 rounded-xl border app-hairline bg-[rgba(8,10,14,0.32)] px-3 font-normal text-zinc-100 outline-none"
        defaultValue={defaultValue}
        name={name}
        required={required}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function FloatTeamChecklist({
  coreTeamId,
  selectedTeamIds,
  teams,
}: {
  coreTeamId?: string;
  selectedTeamIds: string[];
  teams: TeamOption[];
}) {
  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm font-medium text-zinc-100">Allowed Float Teams</p>
      <div className="grid gap-2 md:grid-cols-2">
        {teams
          .filter((team) => team.id !== coreTeamId)
          .map((team) => (
            <label
              key={team.id}
              className="flex items-center gap-2 rounded-xl border app-hairline bg-[rgba(255,255,255,0.025)] px-3 py-2 text-sm text-zinc-100"
            >
              <input
                defaultChecked={selectedTeamIds.includes(team.id)}
                name="allowedFloatTeamIds"
                type="checkbox"
                value={team.id}
              />
              <span>{team.name}</span>
            </label>
          ))}
      </div>
      <p className="text-sm app-copy-soft">
        Floating is explicit. Only checked teams are allowed in addition to the player&apos;s core
        team.
      </p>
    </div>
  );
}

export function PlayerEditorForm({
  action,
  cancelHref,
  player,
  submitLabel,
  teams,
}: PlayerEditorFormProps) {
  const selectedFloatTeamIds = player?.allowedFloatTeams.map((entry) => entry.teamId) ?? [];

  return (
    <form action={action} className="flex flex-col gap-6">
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <TextField
          defaultValue={player?.firstName}
          label="First Name"
          name="firstName"
          required
        />
        <TextField defaultValue={player?.lastName ?? ""} label="Last Name" name="lastName" />
        <label className="flex flex-col gap-1 text-sm font-medium text-zinc-100">
          Core Team
          <select
            className="h-10 rounded-xl border app-hairline bg-[rgba(8,10,14,0.32)] px-3 font-normal text-zinc-100 outline-none"
            defaultValue={player?.coreTeamId ?? teams[0]?.id}
            name="coreTeamId"
            required
          >
            {teams.map((team) => (
              <option key={team.id} value={team.id}>
                {team.name}
              </option>
            ))}
          </select>
        </label>

        <SelectField
          defaultValue={player?.primaryPosition ?? playerPositionOptions[0].value}
          label="Primary Position"
          name="primaryPosition"
          options={playerPositionOptions}
        />
        <SelectField
          defaultValue={player?.secondaryPosition ?? ""}
          label="Secondary Position"
          name="secondaryPosition"
          options={optionalPlayerPositionOptions}
          required={false}
        />
        <SelectField
          defaultValue={player?.tertiaryPosition ?? ""}
          label="Tertiary Position"
          name="tertiaryPosition"
          options={optionalPlayerPositionOptions}
          required={false}
        />

        <SelectField
          defaultValue={player?.preferredFoot ?? FootPreference.RIGHT}
          label="Preferred Foot"
          name="preferredFoot"
          options={preferredFootOptions}
        />
        <SelectField
          defaultValue={player?.secondaryFoot ?? SecondaryFoot.WEAK}
          label="Secondary Foot"
          name="secondaryFoot"
          options={secondaryFootOptions}
        />
        <SelectField
          defaultValue={player?.bestSide ?? BestSide.CENTER}
          label="Best Side"
          name="bestSide"
          options={bestSideOptions}
        />

        <SelectField
          defaultValue={player?.currentAvailability ?? AvailabilityStatus.AVAILABLE}
          label="Availability"
          name="currentAvailability"
          options={availabilityOptions}
        />
      </section>

      <div className="grid gap-3 text-sm text-zinc-100 md:grid-cols-3">
        <label className="flex items-center gap-2 rounded-xl border app-hairline bg-[rgba(255,255,255,0.025)] px-3 py-3">
          <input defaultChecked={player?.active ?? true} name="active" type="checkbox" />
          Active
        </label>
        <label className="flex items-center gap-2 rounded-xl border app-hairline bg-[rgba(255,255,255,0.025)] px-3 py-3">
          <input defaultChecked={player?.isFloating ?? false} name="isFloating" type="checkbox" />
          Floating
        </label>
        <label className="flex items-center gap-2 rounded-xl border app-hairline bg-[rgba(255,255,255,0.025)] px-3 py-3">
          <input
            defaultChecked={player?.canDropCoreMatch ?? false}
            name="canDropCoreMatch"
            type="checkbox"
          />
          Can drop one core match
        </label>
      </div>

      <label className="flex max-w-xs flex-col gap-1 text-sm font-medium text-zinc-100">
        Development Match Target
        <input
          className="h-10 rounded-xl border app-hairline bg-[rgba(8,10,14,0.32)] px-3 font-normal text-zinc-100 outline-none placeholder:text-zinc-500"
          defaultValue={player?.maxDevelopmentMatches ?? ""}
          min={0}
          name="maxDevelopmentMatches"
          placeholder="Leave empty for no target"
          type="number"
        />
      </label>

      <FloatTeamChecklist
        coreTeamId={player?.coreTeamId}
        selectedTeamIds={selectedFloatTeamIds}
        teams={teams}
      />

      <section className="grid gap-6 xl:grid-cols-2">
        <div className="flex flex-col gap-4 rounded-[1.4rem] border app-hairline bg-[rgba(255,255,255,0.025)] p-4">
          <div>
            <h2 className="text-base font-semibold text-zinc-50">Technical</h2>
            <p className="mt-1 text-sm app-copy-soft">Ball mastery and attacking quality.</p>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <RatingField defaultValue={player?.ballControl ?? 5} label="Ball Control" name="ballControl" />
            <RatingField defaultValue={player?.passing ?? 5} label="Passing" name="passing" />
            <RatingField defaultValue={player?.firstTouch ?? 5} label="First Touch" name="firstTouch" />
            <RatingField
              defaultValue={player?.oneVOneAttacking ?? 5}
              label="1v1 Attacking"
              name="oneVOneAttacking"
            />
          </div>
        </div>

        <div className="flex flex-col gap-4 rounded-[1.4rem] border app-hairline bg-[rgba(255,255,255,0.025)] p-4">
          <div>
            <h2 className="text-base font-semibold text-zinc-50">Tactical</h2>
            <p className="mt-1 text-sm app-copy-soft">Positioning, defending, and decisions.</p>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <RatingField defaultValue={player?.positioning ?? 5} label="Positioning" name="positioning" />
            <RatingField
              defaultValue={player?.oneVOneDefending ?? 5}
              label="1v1 Defending"
              name="oneVOneDefending"
            />
            <RatingField
              defaultValue={player?.decisionMaking ?? 5}
              label="Decision Making"
              name="decisionMaking"
            />
          </div>
        </div>

        <div className="flex flex-col gap-4 rounded-[1.4rem] border app-hairline bg-[rgba(255,255,255,0.025)] p-4">
          <div>
            <h2 className="text-base font-semibold text-zinc-50">Mental</h2>
            <p className="mt-1 text-sm app-copy-soft">Effort, concentration, and team play.</p>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <RatingField defaultValue={player?.effort ?? 5} label="Effort" name="effort" />
            <RatingField defaultValue={player?.teamplay ?? 5} label="Teamplay" name="teamplay" />
            <RatingField
              defaultValue={player?.concentration ?? 5}
              label="Concentration"
              name="concentration"
            />
          </div>
        </div>

        <div className="flex flex-col gap-4 rounded-[1.4rem] border app-hairline bg-[rgba(255,255,255,0.025)] p-4">
          <div>
            <h2 className="text-base font-semibold text-zinc-50">Physical</h2>
            <p className="mt-1 text-sm app-copy-soft">Speed and strength.</p>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <RatingField defaultValue={player?.speed ?? 5} label="Speed" name="speed" />
            <RatingField defaultValue={player?.strength ?? 5} label="Strength" name="strength" />
          </div>
        </div>
      </section>

      <label className="flex flex-col gap-1 text-sm font-medium text-zinc-100">
        Notes
        <textarea
          className="min-h-28 rounded-2xl border app-hairline bg-[rgba(8,10,14,0.32)] px-3 py-2 font-normal text-zinc-100 outline-none placeholder:text-zinc-500"
          defaultValue={player?.notes ?? ""}
          name="notes"
          placeholder="Optional notes about the player."
        />
      </label>

      <div className="flex flex-wrap gap-3">
        <button
          className="h-10 rounded-full border border-[rgba(205,219,210,0.32)] bg-[linear-gradient(180deg,rgba(146,171,151,0.26),rgba(88,110,100,0.18))] px-4 text-sm font-semibold text-zinc-50 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]"
          type="submit"
        >
          {submitLabel}
        </button>
        {cancelHref ? (
          <Link
            className="inline-flex h-10 items-center rounded-full border app-hairline px-4 text-sm font-medium app-copy-soft hover:bg-[rgba(255,255,255,0.05)] hover:text-zinc-50"
            href={cancelHref}
          >
            Cancel
          </Link>
        ) : null}
      </div>
    </form>
  );
}

export function PlayerSummaryCard({ player }: { player: PlayerWithTeams }) {
  return (
    <section className="rounded-[1.6rem] border app-hairline bg-[rgba(255,255,255,0.025)] p-5">
      <div className="flex flex-col gap-1">
        <p className="text-sm font-medium uppercase tracking-wide app-copy-muted">Player</p>
        <h1 className="text-3xl font-semibold tracking-tight text-zinc-50">{formatPlayerName(player)}</h1>
        <p className="text-sm app-copy-soft">
          {player.coreTeam.name} · {formatAvailabilityStatus(player.currentAvailability)}
        </p>
      </div>
      <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div>
          <p className="text-xs uppercase tracking-wide app-copy-muted">Primary Position</p>
          <p className="mt-1 text-sm text-zinc-100">{player.primaryPosition}</p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-wide app-copy-muted">Secondary Position</p>
          <p className="mt-1 text-sm text-zinc-100">{player.secondaryPosition ?? "-"}</p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-wide app-copy-muted">Tertiary Position</p>
          <p className="mt-1 text-sm text-zinc-100">{player.tertiaryPosition ?? "-"}</p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-wide app-copy-muted">Float Teams</p>
          <p className="mt-1 text-sm text-zinc-100">
            {player.allowedFloatTeams.length > 0
              ? player.allowedFloatTeams.map((entry) => entry.team.name).join(", ")
              : "None"}
          </p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-wide app-copy-muted">Development Target</p>
          <p className="mt-1 text-sm text-zinc-100">
            {player.maxDevelopmentMatches ?? "No individual target"}
          </p>
        </div>
      </div>
    </section>
  );
}
