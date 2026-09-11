import Link from "next/link";
import { TouchlineButton } from "@/components/touchline";
import {
  AvailabilityStatus,
  BestSide,
  FootPreference,
  GoalkeeperAbility,
  SecondaryFoot,
  type Player,
  type Team,
} from "@/generated/prisma/client";
import {
  availabilityOptions,
  bestSideOptions,
  goalkeeperAbilityOptions,
  optionalPlayerPositionOptions,
  playerPositionOptions,
  preferredFootOptions,
  secondaryFootOptions,
} from "@/lib/player-form-options";
import { formatAvailabilityStatus, formatPlayerName } from "@/lib/player-metrics";

type TeamOption = Pick<Team, "id" | "name">;

type PlayerWithCoreTeam = Player & { coreTeam: Pick<Team, "id" | "name"> | null };

type PlayerEditorFormProps = {
  action: (formData: FormData) => void | Promise<void>;
  cancelHref?: string;
  player?: PlayerWithCoreTeam;
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
    <label className="flex flex-col gap-1 text-sm font-medium text-[var(--foreground)]">
      {label}
      <input
        className="h-10 rounded-[var(--tl-c-radius-object)] border border-[var(--border-soft)] bg-[var(--tl-c-surface-hover)] px-3 font-normal text-[var(--foreground)] outline-none placeholder:text-[var(--text-muted)]"
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
  defaultValue: number | null;
  label: string;
  name: string;
}) {
  return (
    <label className="flex flex-col gap-1 text-sm font-medium text-[var(--foreground)]">
      {label}
      <input
        className="h-10 rounded-[var(--tl-c-radius-object)] border border-[var(--border-soft)] bg-[var(--tl-c-surface-hover)] px-3 font-normal text-[var(--foreground)] outline-none placeholder:text-[var(--text-muted)]"
        defaultValue={defaultValue ?? ""}
        min={1}
        max={10}
        name={name}
        placeholder="1–10 or leave blank"
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
    <label className="flex flex-col gap-1 text-sm font-medium text-[var(--foreground)]">
      {label}
      <select
        className="h-10 rounded-[var(--tl-c-radius-object)] border border-[var(--border-soft)] bg-[var(--tl-c-surface-hover)] px-3 font-normal text-[var(--foreground)] outline-none"
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

export function PlayerEditorForm({
  action,
  cancelHref,
  player,
  submitLabel,
  teams,
}: PlayerEditorFormProps) {
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
        <label className="flex flex-col gap-1 text-sm font-medium text-[var(--foreground)]">
          Shirt Number
          <input
            className="h-10 rounded-[var(--tl-c-radius-object)] border border-[var(--border-soft)] bg-[var(--tl-c-surface-hover)] px-3 font-normal text-[var(--foreground)] outline-none placeholder:text-[var(--text-muted)]"
            defaultValue={player?.shirtNumber ?? ""}
            name="shirtNumber"
            placeholder="Optional"
            type="number"
            min={1}
            max={99}
          />
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium text-[var(--foreground)]">
          Core Team
          <select
            className="h-10 rounded-[var(--tl-c-radius-object)] border border-[var(--border-soft)] bg-[var(--tl-c-surface-hover)] px-3 font-normal text-[var(--foreground)] outline-none"
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
          defaultValue={player?.goalkeeperAbility ?? GoalkeeperAbility.NO}
          label="Goalkeeper Ability"
          name="goalkeeperAbility"
          options={goalkeeperAbilityOptions}
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

      <div className="grid gap-3 text-sm text-[var(--foreground)] md:grid-cols-2">
        <label className="flex items-center gap-2 rounded-xl border border-[var(--border-soft)] bg-[var(--tl-c-surface)] px-3 py-3">
          <input defaultChecked={player?.active ?? true} name="active" type="checkbox" />
          Active
        </label>
        <label className="flex items-center gap-2 rounded-xl border border-[var(--border-soft)] bg-[var(--tl-c-surface)] px-3 py-3">
          <input defaultChecked={player?.nonRotatable ?? false} name="nonRotatable" type="checkbox" />
          Non-rotatable
        </label>
        <label className="flex items-center gap-2 rounded-xl border border-[var(--border-soft)] bg-[var(--tl-c-surface)] px-3 py-3">
          <input defaultChecked={player?.reducedMatchLoadAllowed ?? false} name="reducedMatchLoadAllowed" type="checkbox" />
          Reduced match load
        </label>
      </div>

      <section className="grid gap-6 xl:grid-cols-2">
        <div className="flex flex-col gap-4 rounded-[var(--tl-c-radius-feature)] border border-[var(--border-soft)] bg-[var(--tl-c-surface)] p-4">
          <div>
            <h2 className="text-base font-semibold text-[var(--foreground)]">Technical</h2>
            <p className="mt-1 text-sm app-copy-soft">Ball mastery and attacking quality.</p>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <RatingField defaultValue={player?.ballControl ?? null} label="Ball Control" name="ballControl" />
            <RatingField defaultValue={player?.passing ?? null} label="Passing" name="passing" />
            <RatingField defaultValue={player?.firstTouch ?? null} label="First Touch" name="firstTouch" />
            <RatingField
              defaultValue={player?.oneVOneAttacking ?? null}
              label="1v1 Attacking"
              name="oneVOneAttacking"
            />
          </div>
        </div>

        <div className="flex flex-col gap-4 rounded-[var(--tl-c-radius-feature)] border border-[var(--border-soft)] bg-[var(--tl-c-surface)] p-4">
          <div>
            <h2 className="text-base font-semibold text-[var(--foreground)]">Tactical</h2>
            <p className="mt-1 text-sm app-copy-soft">Positioning, defending, and decisions.</p>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <RatingField defaultValue={player?.positioning ?? null} label="Positioning" name="positioning" />
            <RatingField
              defaultValue={player?.oneVOneDefending ?? null}
              label="1v1 Defending"
              name="oneVOneDefending"
            />
            <RatingField
              defaultValue={player?.decisionMaking ?? null}
              label="Decision Making"
              name="decisionMaking"
            />
          </div>
        </div>

        <div className="flex flex-col gap-4 rounded-[var(--tl-c-radius-feature)] border border-[var(--border-soft)] bg-[var(--tl-c-surface)] p-4">
          <div>
            <h2 className="text-base font-semibold text-[var(--foreground)]">Mental</h2>
            <p className="mt-1 text-sm app-copy-soft">Effort, concentration, and team play.</p>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <RatingField defaultValue={player?.effort ?? null} label="Effort" name="effort" />
            <RatingField defaultValue={player?.teamplay ?? null} label="Teamplay" name="teamplay" />
            <RatingField
              defaultValue={player?.concentration ?? null}
              label="Concentration"
              name="concentration"
            />
          </div>
        </div>

        <div className="flex flex-col gap-4 rounded-[var(--tl-c-radius-feature)] border border-[var(--border-soft)] bg-[var(--tl-c-surface)] p-4">
          <div>
            <h2 className="text-base font-semibold text-[var(--foreground)]">Physical</h2>
            <p className="mt-1 text-sm app-copy-soft">Speed and strength.</p>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <RatingField defaultValue={player?.speed ?? null} label="Speed" name="speed" />
            <RatingField defaultValue={player?.strength ?? null} label="Strength" name="strength" />
          </div>
        </div>
      </section>

      <label className="flex flex-col gap-1 text-sm font-medium text-[var(--foreground)]">
        Notes
        <textarea
          className="min-h-28 rounded-[var(--tl-c-radius-feature)] border border-[var(--border-soft)] bg-[var(--tl-c-surface-hover)] px-3 py-2 font-normal text-[var(--foreground)] outline-none placeholder:text-[var(--text-muted)]"
          defaultValue={player?.notes ?? ""}
          name="notes"
          placeholder="Optional notes about the player."
        />
      </label>

      <div className="flex flex-wrap gap-3">
        <TouchlineButton type="submit" variant="primary">
          {submitLabel}
        </TouchlineButton>
        {cancelHref ? (
          <TouchlineButton as={Link} href={cancelHref} variant="secondary">
            Cancel
          </TouchlineButton>
        ) : null}
      </div>
    </form>
  );
}

export function PlayerSummaryCard({ player }: { player: PlayerWithCoreTeam }) {
  return (
    <section className="rounded-[var(--tl-c-radius-overlay)] border border-[var(--border-soft)] bg-[var(--tl-c-surface)] p-5">
      <div className="flex flex-col gap-1">
        <p className="text-sm font-medium uppercase tracking-wide app-copy-muted">Player</p>
        <h1 className="text-3xl font-semibold tracking-tight text-[var(--foreground)]">{formatPlayerName(player)}</h1>
        <p className="text-sm app-copy-soft">
          {player.coreTeam?.name ?? "Unassigned"} · {formatAvailabilityStatus(player.currentAvailability)}
        </p>
      </div>
      <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div>
          <p className="text-xs uppercase tracking-wide app-copy-muted">Primary Position</p>
          <p className="mt-1 text-sm text-[var(--foreground)]">{player.primaryPosition}</p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-wide app-copy-muted">Secondary Position</p>
          <p className="mt-1 text-sm text-[var(--foreground)]">{player.secondaryPosition ?? "-"}</p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-wide app-copy-muted">Tertiary Position</p>
          <p className="mt-1 text-sm text-[var(--foreground)]">{player.tertiaryPosition ?? "-"}</p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-wide app-copy-muted">Rotation</p>
          <p className="mt-1 text-sm text-[var(--foreground)]">{player.nonRotatable ? "Non-rotatable" : "Eligible"}</p>
        </div>
      </div>
    </section>
  );
}