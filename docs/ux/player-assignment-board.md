# Player Assignment Board

## Purpose

Players are managed through a board with columns for each team plus Unassigned.

## Columns

- Blå
- Hvit
- Rød
- Unassigned

Use actual team records if available. The above are required for the current football context.

## Drag and drop behavior

Dragging a player from one column to another changes the player's team assignment.

## Persistence

Dropping a player must persist the assignment to the backend.

## Safety

The UI must show pending, success, and failure states.
On failure, the player returns to the previous column.

## Audit

If decision records or audit logs exist, changing team assignment must create a record.