# Events / trips

**Intent.** Answer "what did this actually cost me?" for a trip, a party, a
renovation: a named date range that groups the spending it caused.

## Decisions

- **Model.** `events` table (name, icon, color, start/end as local day
  bounds, optional budget + currency, archived). Transactions join through
  `transactions.event_id`. Income may be tagged but only expenses count as
  "spent". Totals use `amount_main` (main currency at the row's day rate).
- **How expenses get in (hybrid, leaning manual).** While an event covers
  the transaction's date, Smart Add preselects it; one tap clears. Once the
  user touches the chip their choice sticks even if the date changes.
  Outside the dates the event is picked by hand. Bills paid from the Plan
  tab never auto-tag. Editing a row keeps its tag; turning a row into a
  transfer drops it.
- **After the fact.** The event screen lists untagged expenses inside the
  dates (excluding recurring bills) and offers a checklist, everything
  ticked by default, so rent can be unticked before attaching.
- **Where it lives.** Fifth Plan segment "Events": hero for the running or
  next event, then Happening now / Upcoming / Past, archived collapsed.
  Event screen: hero (dates, status, spent, per-day, budget bar), review
  banner, category breakdown, transaction rows (tap edits in Smart Add),
  menu with Edit / Add past expenses / Archive / Delete. Home shows a card
  only while an event is running. Activity gets an event filter chip.
- **Deleting an event** leaves its transactions alone; they lose the tag.
- **Backup** carries the `events` table (schema v4); older dumps restore
  without touching it.

## Not in this version

Sharing between profiles, splitting costs with friends, income-based
events, per-event currency.
