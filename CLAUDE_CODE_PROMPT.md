# MoneyFlow — Expo/React Native Build Prompt

## Overview

Build a full expense tracker app called **MoneyFlow** using Expo (React Native). This is a port of an existing React web app. The app is a better version of the popular "1Money" expense tracker. All business logic, data structures, and UX patterns are defined below — your job is to implement them natively.

---

## Tech Stack

- **Framework:** Expo SDK (latest stable) with Expo Router for navigation
- **Language:** TypeScript
- **Storage:** expo-sqlite for persistent local data
- **Charts:** react-native-chart-kit or victory-native
- **Navigation:** 3 bottom tabs: Home, History, More (using Expo Router tabs)
- **Icons:** @expo/vector-icons (Ionicons or MaterialCommunityIcons)
- **Fonts:** expo-font with Outfit (display) + Plus Jakarta Sans (body) from Google Fonts
- **Animations:** react-native-reanimated for micro-interactions
- **Haptics:** expo-haptics for tactile feedback on transaction add

---

## Project Setup

```bash
npx create-expo-app moneyflow --template blank-typescript
cd moneyflow
npx expo install expo-router expo-sqlite expo-font expo-haptics react-native-reanimated react-native-chart-kit react-native-svg @expo/vector-icons
```

Set up Expo Router with a tab layout: Home, History, More.

---

## Design System

Dark finance aesthetic. Use these exact colors as a theme object:

```typescript
export const theme = {
  bg: '#08080F',
  bg1: '#0E0E18',
  bg2: '#161622',
  bg3: '#1E1E2E',
  bg4: '#282840',
  accent: '#00E09E',
  accentDim: '#00E09E20',
  income: '#00E09E',
  expense: '#FF6B8A',
  warning: '#FFBE44',
  indigo: '#818CF8',
  transfer: '#60A5FA',
  text1: '#EAEAF2',
  text2: '#8888AA',
  text3: '#55556A',
  border: '#252538',
};
```

Typography:
- Display headings: Outfit (bold 700-800)
- Body text: Plus Jakarta Sans (400-600)
- Monospace amounts: Outfit with letter-spacing -1 to -2

---

## Data Models

```typescript
interface Transaction {
  id: string;
  type: 'expense' | 'income' | 'transfer';
  amount: number;
  category?: string;        // not used for transfers
  account?: string;         // not used for transfers
  fromAccount?: string;     // transfers only
  toAccount?: string;       // transfers only
  date: string;             // ISO string
  note: string;
}

interface Account {
  id: string;
  name: string;
  type: 'cash' | 'bank' | 'credit' | 'savings';
  icon: string;
  color: string;
  balance: number;
  limit?: number;           // credit cards only
}

interface Budget {
  id: string;
  category: string;
  limit: number;
}

interface AppData {
  transactions: Transaction[];
  accounts: Account[];
  budgets: Budget[];
  recurring: RecurringItem[];
  paidIds: Record<string, string[]>; // { "2026-3": ["r1","r2"] } - paid recurring IDs per month
  streak: number;
}

interface RecurringItem {
  id: string;
  name: string;
  amount: number;
  type: 'expense' | 'income';
  category: string;
  account: string;
  dueDay: number;          // 1-31
  icon: string;
  color: string;
}
```

---

## Expense Categories (18 total)

```typescript
const EXPENSE_CATEGORIES = [
  { id: 'food', name: 'Food', icon: 'fast-food', color: '#FF6B8A' },
  { id: 'transport', name: 'Transport', icon: 'car', color: '#818CF8' },
  { id: 'shopping', name: 'Shopping', icon: 'cart', color: '#FFBE44' },
  { id: 'coffee', name: 'Coffee', icon: 'cafe', color: '#C084FC' },
  { id: 'bills', name: 'Bills', icon: 'flash', color: '#F97316' },
  { id: 'health', name: 'Health', icon: 'heart', color: '#34D399' },
  { id: 'entertainment', name: 'Fun', icon: 'game-controller', color: '#FB7185' },
  { id: 'education', name: 'Education', icon: 'book', color: '#60A5FA' },
  { id: 'travel', name: 'Travel', icon: 'airplane', color: '#2DD4BF' },
  { id: 'gifts', name: 'Gifts', icon: 'gift', color: '#E879F9' },
  { id: 'fuel', name: 'Fuel', icon: 'water', color: '#FBBF24' },
  { id: 'internet', name: 'Internet', icon: 'wifi', color: '#38BDF8' },
  { id: 'phone', name: 'Phone', icon: 'phone-portrait', color: '#A78BFA' },
  { id: 'rent', name: 'Rent', icon: 'home', color: '#FB923C' },
  { id: 'clothing', name: 'Clothing', icon: 'shirt', color: '#F472B6' },
  { id: 'fitness', name: 'Fitness', icon: 'barbell', color: '#4ADE80' },
  { id: 'subs', name: 'Subs', icon: 'document-text', color: '#38BDF8' },
  { id: 'other', name: 'Other', icon: 'ellipsis-horizontal', color: '#8888AA' },
];
```

## Income Categories (6 total)

```typescript
const INCOME_CATEGORIES = [
  { id: 'salary', name: 'Salary', icon: 'briefcase', color: '#00E09E' },
  { id: 'freelance', name: 'Freelance', icon: 'create', color: '#60A5FA' },
  { id: 'investment', name: 'Investment', icon: 'trending-up', color: '#818CF8' },
  { id: 'gift_in', name: 'Gift', icon: 'gift', color: '#E879F9' },
  { id: 'refund', name: 'Refund', icon: 'swap-horizontal', color: '#FFBE44' },
  { id: 'other_in', name: 'Other', icon: 'ellipsis-horizontal', color: '#8888AA' },
];
```

## Default Accounts

```typescript
const DEFAULT_ACCOUNTS = [
  { id: 'cash', name: 'Cash', type: 'cash', icon: 'wallet', color: '#00E09E', balance: 0 },
  { id: 'bank', name: 'Bank Account', type: 'bank', icon: 'card', color: '#818CF8', balance: 0 },
  { id: 'credit', name: 'Credit Card', type: 'credit', icon: 'card', color: '#FF6B8A', balance: 0, limit: 5000 },
  { id: 'savings', name: 'Savings', type: 'savings', icon: 'piggy-bank', color: '#FFBE44', balance: 0 },
];
```

---

## Screen-by-Screen Specification

### Tab 1: HOME SCREEN

The home screen is the financial command center. Top to bottom:

1. **Header Row**
   - Left: month/year label (uppercase, muted) + "MoneyFlow" title (Outfit, 26px, bold)
   - Right: Streak badge — flame icon + number + "days" in a pill with warm glow (amber/orange tones). Shows how many consecutive days the user has tracked at least one transaction.

2. **Balance Card** (glass-morphism card with subtle green glow)
   - "Net Worth" label + large formatted amount (green if positive, red if negative)
   - Top-right corner: percentage change vs last month in a small pill (green ↓ = spending less, red ↑ = spending more)
   - Below: two compact stat chips showing Income and Expenses for the month, each with a small colored icon

3. **Mini Spending Trend** (compact area chart)
   - Cumulative spending over current month, green gradient
   - X-axis: day numbers. No Y-axis labels. ~80px tall.

4. **Category Grid** — THE KEY FEATURE
   - 3-column grid showing every expense category that has spending this month
   - Each tile shows: category icon (in colored circle), category name, dollar amount (Outfit bold), and a thin percentage bar
   - Top-right corner of each tile: small ↑12% or ↓8% comparison vs last month
   - Tapping a tile expands an inline detail panel below the grid showing:
     - This month vs last month amounts
     - Daily average for this category
     - Last 5 transactions in this category
     - Close (X) button

5. **Account Quick Scroll** (horizontal scroll)
   - Cards for each account: icon, name, balance
   - Credit cards show a utilization bar (used / limit)

6. **Recent Transactions** (last 4, compact rows)

### Tab 2: HISTORY SCREEN

1. **Header** with "History" title + clear filter button (if active)
2. **Category Filter Chips** — horizontal scroll of category pills, tap to filter
3. **Grouped Transaction List** — grouped by date ("Today", "Yesterday", "Mar 25")
   - Each row: category icon (colored circle), note/name, category + date subtitle, amount (red for expense, green for income, blue for transfer)
   - Transfer rows show a transfer icon + "From → To" subtitle
   - Swipe-to-delete or delete icon on each row

### Tab 3: MORE SCREEN

Sub-navigation with 4 pill buttons: **Recurring** (default), **Budgets**, **Analytics**, **Accounts**

#### More > Recurring
See the "Recurring Expenses & Income" section above for full specification.

#### More > Budgets
1. Total budget usage bar (spent / total limit) with percentage
2. List of budget categories, each showing:
   - Category icon + name
   - Spent vs limit amounts
   - Progress bar (green → yellow → red as it fills)
   - "Left" amount + daily budget for remaining days
   - Warning icon if over budget
   - Edit button → inline input to change limit
3. "Add Budget" button → bottom sheet with category grid to pick from

#### More > Analytics
1. Quick stat grid (2x2): Avg/Day, Projected month total, Transaction count, Top category
2. Daily spending bar/area chart
3. **Monthly Comparison Table** — each category row shows:
   - Current month amount
   - Colored pill showing ↑ or ↓ percentage vs last month
   - This is the key insight feature that makes users feel their tracking is worth it

#### More > Accounts
1. Assets vs Debt summary (2-column)
2. Account cards with full details:
   - Balance, account type
   - Credit cards: utilization bar, used/available amounts, "Pay Debt" button
   - "Pay Debt" opens the add transaction screen in transfer mode, pre-filled with this card as the destination
3. "Quick Transfer" button at bottom

---

## ADD TRANSACTION (Full-screen modal)

Opens from the floating (+) button. This is the most critical UX flow.

1. **Top bar**: Close (X) | Mode switcher (Expense / Income / Transfer pills) | Confirm (checkmark)
2. **Amount display**: Large number in mode color (red/green/blue), with note input below
3. **Quick-Add Row** (EXPENSE MODE ONLY):
   - Shows 3-4 most frequently added transactions as tappable pills
   - Each pill shows: category icon, note, amount
   - ONE TAP = transaction added instantly (no further input needed)
   - Triggers success animation + haptic feedback
   - This is calculated by counting duplicate category+amount+note combos across all transactions

4. **Account selector** (expense/income) or **From/To selector** (transfer):
   - Horizontal scroll of account pills
   - Transfer mode: FROM row → arrow → TO row

5. **Category Grid** (expense/income only):
   - 4-column grid of category icons with names
   - Selected state: colored border + tinted background
   - NOT shown in transfer mode

6. **Numpad**:
   - 3x4 grid: 1-9, dot, 0, backspace
   - Large touch targets (48px+ height)
   - Active state: scale down + darken
   - Below numpad: full-width colored submit button ("Add Expense" / "Add Income" / "Transfer")
   - Button is disabled/dimmed until amount > 0 AND category selected (or valid transfer accounts)

---

## Success Animation

When a transaction is added:
1. Trigger `expo-haptics` medium impact
2. Show a full-screen overlay (pointer-events: none) with:
   - A green circle with a checkmark that pops in (scale 0 → 1.15 → 1)
   - 6 small colored confetti dots that animate upward and fade out
3. Auto-dismiss after 800ms

---

## Streak System

- Count consecutive days (from today backwards) where at least one transaction exists
- Display in header as a flame/fire emoji + number
- Streak badge has a subtle glowing animation
- When streak increases, briefly pulse the badge

---

## Balance Management Rules

These are critical for data integrity:

- **Expense**: subtract amount from selected account balance
- **Income**: add amount to selected account balance
- **Transfer**: subtract from source, add to destination
- **Delete transaction**: reverse the balance effect
- Credit card balances are negative (representing debt). A transfer TO a credit card adds to its balance (reduces debt).

---

## Recurring Expenses & Income (Fixed Costs)

This is a key feature that separates MoneyFlow from basic trackers. Users can set up monthly fixed costs (subscriptions, rent, bills) and fixed income (salary, rental income) that repeat every month.

### Data Model

```typescript
interface RecurringItem {
  id: string;
  name: string;           // "Netflix", "Rent", "Salary"
  amount: number;
  type: 'expense' | 'income';
  category: string;
  account: string;
  dueDay: number;          // day of month (1-31)
  icon: string;
  color: string;
}
```

Track which recurring items have been "paid" this month using a separate map:
```typescript
// { "2026-3": ["r1", "r2", "r5"] }  — paid IDs per month key
paidIds: Record<string, string[]>;
```

### Default Recurring Items (seed data)

```typescript
const DEFAULT_RECURRING = [
  { id: 'r1', name: 'Netflix', amount: 15.99, type: 'expense', category: 'subs', account: 'credit', dueDay: 15 },
  { id: 'r2', name: 'Claude Pro', amount: 20, type: 'expense', category: 'subs', account: 'credit', dueDay: 1 },
  { id: 'r3', name: 'Spotify', amount: 11.99, type: 'expense', category: 'subs', account: 'credit', dueDay: 22 },
  { id: 'r4', name: 'Rent', amount: 1500, type: 'expense', category: 'rent', account: 'bank', dueDay: 1 },
  { id: 'r5', name: 'Internet', amount: 65, type: 'expense', category: 'internet', account: 'bank', dueDay: 5 },
  { id: 'r6', name: 'Phone Plan', amount: 45, type: 'expense', category: 'phone', account: 'bank', dueDay: 12 },
  { id: 'r7', name: 'Gym', amount: 39.99, type: 'expense', category: 'fitness', account: 'bank', dueDay: 1 },
  { id: 'r8', name: 'Monthly Salary', amount: 3500, type: 'income', category: 'salary', account: 'bank', dueDay: 1 },
  { id: 'r9', name: 'Rental Income', amount: 800, type: 'income', category: 'investment', account: 'bank', dueDay: 5 },
];
```

### How It Works

1. **Mark as Paid** — tapping the circle checkbox on a recurring item:
   - Creates a REAL transaction (expense or income) with the recurring item's details
   - Adds the recurring ID to this month's `paidIds`
   - Updates the relevant account balance
   - Triggers success animation
   - The item visually shows as checked/completed (line-through, dimmed)

2. **Unmark** — tapping again:
   - Finds and deletes the associated transaction
   - Removes the ID from `paidIds`
   - Reverses the balance change

3. **Monthly Reset** — paid status resets automatically because `paidIds` is keyed by month. New month = clean slate.

### Home Screen: "Monthly Bills" Card

Shown on the home screen between the balance card and the spending chart:

- Header: "Monthly Bills" with a progress bar (X of Y paid)
- Shows remaining bills amount: "$235 left"
- Lists items sorted: unpaid first (by due day), then paid
- Each row shows: checkbox, icon, name, due status ("Due in 5d" / "Due today" / "Overdue" / "Paid"), amount
- Compact mode (5 items max, "show more" link to More tab)

### Home Screen: "Expected Income" Card

Below bills card:
- Shows fixed income items with same checkbox pattern
- "Received" vs "Pending" status

### More > Recurring Tab

Full management screen with sub-nav pill as the first option:

1. **Summary Cards** (2-column):
   - Monthly Bills total + unpaid count
   - Fixed Income total + pending count

2. **Disposable Income Card**:
   - Highlights: Fixed Income - Fixed Expenses = what you have to spend freely
   - Shows the math: "$4,300 - $1,697 = $2,603"

3. **Full Lists** with edit and delete buttons on each item

4. **Add Recurring** button → bottom sheet form:
   - Type toggle (expense / income)
   - Name input
   - Amount input + Due day input
   - Category grid (subset of main categories)
   - Account selector
   - Save button

### Key Computed Values

```typescript
// Total fixed monthly expenses
const totalFixedExp = recurring.filter(r => r.type === 'expense').reduce((s, r) => s + r.amount, 0);

// Total fixed monthly income
const totalFixedInc = recurring.filter(r => r.type === 'income').reduce((s, r) => s + r.amount, 0);

// Disposable income (what's left after fixed costs)
const disposable = totalFixedInc - totalFixedExp;

// Remaining bills this month (unpaid expenses)
const remainingBills = recurring.filter(r => r.type === 'expense' && !paidIds[monthKey]?.includes(r.id)).reduce((s, r) => s + r.amount, 0);
```

### Balance Card Enhancement

The balance card on the home screen now shows 3 metrics:
- Income (green)
- Expenses (red)
- **Free** — disposable income remaining (blue) = income minus all expenses so far

---

## Storage Layer

Use expo-sqlite with a single JSON column for simplicity (matches the web version's approach):

```typescript
// db.ts
import * as SQLite from 'expo-sqlite';

const db = SQLite.openDatabaseSync('moneyflow.db');

export const initDB = () => {
  db.execSync('CREATE TABLE IF NOT EXISTS appdata (key TEXT PRIMARY KEY, value TEXT)');
};

export const loadData = (): AppData | null => {
  const row = db.getFirstSync<{value: string}>('SELECT value FROM appdata WHERE key = ?', ['main']);
  return row ? JSON.parse(row.value) : null;
};

export const saveData = (data: AppData) => {
  db.runSync('INSERT OR REPLACE INTO appdata (key, value) VALUES (?, ?)', ['main', JSON.stringify(data)]);
};
```

---

## Seed Data

Generate 30 random expense transactions spread across the last 30 days, 20 transactions for last month (for comparisons), 3 income transactions, and 2 transfers. Use realistic amounts and notes matching the categories. Start accounts with: Cash $500, Bank $3200, Credit Card -$450, Savings $8500. Set initial streak to 5.

---

## File Structure

```
app/
  _layout.tsx          # Root layout with tab navigator
  (tabs)/
    _layout.tsx        # Tab bar configuration (3 tabs)
    index.tsx          # Home screen
    history.tsx        # History/transactions screen
    more.tsx           # More screen (recurring/budgets/analytics/accounts)
components/
  AddTransaction.tsx   # Full-screen modal
  TransactionRow.tsx   # Reusable transaction list item
  CategoryGrid.tsx     # Category grid component
  SuccessOverlay.tsx   # Confetti + checkmark animation
  StreakBadge.tsx       # Streak display with glow
  BudgetCard.tsx       # Individual budget progress card
  AccountCard.tsx      # Account display card
  Numpad.tsx           # Custom numpad component
  QuickAdd.tsx         # Frequent transaction pills
  RecurringRow.tsx     # Recurring item with checkbox
  RecurringCard.tsx    # Bills/income card for home screen
  AddRecurring.tsx     # Bottom sheet form for add/edit recurring
constants/
  theme.ts             # Colors, spacing, typography
  categories.ts        # Expense and income categories
  defaults.ts          # Default accounts, budgets, recurring items, seed data
hooks/
  useAppData.ts        # Central state management hook (load/save/mutations)
  useStreak.ts         # Streak calculation
  useRecurring.ts      # Recurring items logic (mark paid, unmark, monthly reset)
utils/
  format.ts            # Money formatting, date helpers
  db.ts                # SQLite wrapper
```

---

## Key UX Principles

1. **The add flow must be FAST.** Quick-add = 1 tap. Normal add = amount → category → done. No unnecessary screens.
2. **Category grid on home is the primary view.** Users should see ALL their spending at a glance, not just a chart.
3. **Monthly comparisons everywhere.** Every category tile, every analytics row — show if spending is up or down vs last month.
4. **Haptic feedback** on: adding transaction, quick-add, numpad taps, tab switches.
5. **Streak drives retention.** Make it visible, make it glow, make breaking it feel consequential.
6. **3 tabs max.** Home, History, More. No decision fatigue.

---

## Build Order (suggested)

1. Project setup, fonts, theme, navigation skeleton
2. Storage layer (db.ts + useAppData hook with seed data + recurring defaults)
3. Home screen (balance card + category grid)
4. Add Transaction modal (numpad + categories + submit)
5. Quick-add functionality
6. Success animation + haptics
7. **Recurring system: data model, mark-as-paid logic, useRecurring hook**
8. **Home screen: Monthly Bills card + Expected Income card**
9. History screen with filters
10. **More > Recurring tab (full management, add/edit form)**
11. More > Budgets
12. More > Analytics with monthly comparisons
13. More > Accounts with transfers and debt tracking
14. Streak system
15. Polish: animations, edge cases, empty states, disposable income calc
