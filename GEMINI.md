Sempre que for construir uma tela ou um novo complonente deverá seguir o estilo dos princípios do Material Design do Google com cartões com textura de papel, cores vibrantes e animações responsivas. Use sombras de elevação para indicar hierarquia e foco. Implemente um sistema de grade consistente com espaçamento e alinhamento adequados. Os botões devem ser planos, com efeitos de foco e animações em cascata ao clicar. Use as recomendações de fontes do Google e siga as diretrizes da paleta de cores do Material. Adicione transições sutis entre estados e microinterações responsivas.

As paginas ou telas serão encontrado os fontes em src/pages
 
A estrutura de dados do projeto está no Supabase e foram criadas fonforme abaixo:
create table public.accounts (
  id uuid not null default extensions.uuid_generate_v4 (),
  user_id uuid not null,
  name text not null,
  bank text null,
  account_number text null,
  account_type text not null,
  initial_balance numeric not null default 0,
  currency text not null default 'BRL'::text,
  is_active boolean null default true,
  created_at_base44 timestamp with time zone null,
  updated_at_base44 timestamp with time zone null,
  is_sample_data boolean null default false,
  created_at timestamp with time zone not null default timezone ('utc'::text, now()),
  updated_at timestamp with time zone not null default timezone ('utc'::text, now()),
  current_balance numeric null default 0,
  constraint accounts_pkey primary key (id),
  constraint accounts_user_id_fkey foreign KEY (user_id) references auth.users (id) on delete CASCADE,
  constraint accounts_account_type_check check (
    (
      account_type = any (
        array[
          'checking'::text,
          'savings'::text,
          'credit_card'::text,
          'investment'::text,
          'cash'::text
        ]
      )
    )
  ),
  constraint accounts_currency_check check (
    (
      currency = any (array['BRL'::text, 'USD'::text, 'EUR'::text])
    )
  )
) TABLESPACE pg_default;

create index IF not exists idx_accounts_user_id on public.accounts using btree (user_id) TABLESPACE pg_default;

create trigger on_accounts_updated BEFORE
update on accounts for EACH row
execute FUNCTION handle_updated_at ();

create table public.budgets (
  id uuid not null default extensions.uuid_generate_v4 (),
  user_id uuid not null,
  name text not null,
  amount numeric not null,
  period text not null,
  start_date date null,
  end_date date null,
  is_active boolean null default true,
  created_at_base44 timestamp with time zone null,
  updated_at_base44 timestamp with time zone null,
  is_sample_data boolean null default false,
  created_at timestamp with time zone not null default timezone ('utc'::text, now()),
  updated_at timestamp with time zone not null default timezone ('utc'::text, now()),
  tag_id uuid null,
  constraint budgets_pkey primary key (id),
  constraint budgets_tag_id_fkey foreign KEY (tag_id) references tags (id) on delete set null,
  constraint budgets_user_id_fkey foreign KEY (user_id) references auth.users (id) on delete CASCADE,
  constraint budgets_period_check check (
    (
      period = any (
        array['monthly'::text, 'weekly'::text, 'yearly'::text]
      )
    )
  )
) TABLESPACE pg_default;

create index IF not exists idx_budgets_user_id on public.budgets using btree (user_id) TABLESPACE pg_default;

create index IF not exists idx_budgets_tag_id on public.budgets using btree (tag_id) TABLESPACE pg_default;

create trigger on_budgets_updated BEFORE
update on budgets for EACH row
execute FUNCTION handle_updated_at ();

create table public.budgets (
  id uuid not null default extensions.uuid_generate_v4 (),
  user_id uuid not null,
  name text not null,
  amount numeric not null,
  period text not null,
  start_date date null,
  end_date date null,
  is_active boolean null default true,
  created_at_base44 timestamp with time zone null,
  updated_at_base44 timestamp with time zone null,
  is_sample_data boolean null default false,
  created_at timestamp with time zone not null default timezone ('utc'::text, now()),
  updated_at timestamp with time zone not null default timezone ('utc'::text, now()),
  tag_id uuid null,
  constraint budgets_pkey primary key (id),
  constraint budgets_tag_id_fkey foreign KEY (tag_id) references tags (id) on delete set null,
  constraint budgets_user_id_fkey foreign KEY (user_id) references auth.users (id) on delete CASCADE,
  constraint budgets_period_check check (
    (
      period = any (
        array['monthly'::text, 'weekly'::text, 'yearly'::text]
      )
    )
  )
) TABLESPACE pg_default;

create index IF not exists idx_budgets_user_id on public.budgets using btree (user_id) TABLESPACE pg_default;

create index IF not exists idx_budgets_tag_id on public.budgets using btree (tag_id) TABLESPACE pg_default;

create trigger on_budgets_updated BEFORE
update on budgets for EACH row
execute FUNCTION handle_updated_at ();

create table public.tags (
  id uuid not null default extensions.uuid_generate_v4 (),
  user_id uuid not null,
  name text not null,
  color text null default '#CCCCCC'::text,
  icon text null,
  tag_type text not null,
  is_active boolean null default true,
  created_at_base44 timestamp with time zone null,
  updated_at_base44 timestamp with time zone null,
  is_sample_data boolean null default false,
  created_at timestamp with time zone not null default timezone ('utc'::text, now()),
  updated_at timestamp with time zone not null default timezone ('utc'::text, now()),
  parent_tag_id uuid null,
  constraint tags_pkey primary key (id),
  constraint tags_parent_tag_id_fkey foreign KEY (parent_tag_id) references tags (id) on update CASCADE on delete set null,
  constraint tags_user_id_fkey foreign KEY (user_id) references auth.users (id) on delete CASCADE,
  constraint tags_tag_type_check check (
    (
      tag_type = any (
        array['expense'::text, 'income'::text, 'both'::text]
      )
    )
  )
) TABLESPACE pg_default;

create index IF not exists idx_tags_user_id on public.tags using btree (user_id) TABLESPACE pg_default;

create index IF not exists idx_tags_parent_tag_id on public.tags using btree (parent_tag_id) TABLESPACE pg_default;

create trigger on_tags_updated BEFORE
update on tags for EACH row
execute FUNCTION handle_updated_at ();

create table public.transactions (
  id uuid not null default extensions.uuid_generate_v4 (),
  id_base44 text null,
  user_id uuid not null,
  description text not null,
  amount numeric not null,
  transaction_type text not null,
  transaction_date date not null,
  notes text null,
  is_recurring_base44 boolean null default false,
  created_at_base44 timestamp with time zone null,
  updated_at_base44 timestamp with time zone null,
  is_sample_data boolean null default false,
  created_at timestamp with time zone not null default timezone ('utc'::text, now()),
  updated_at timestamp with time zone not null default timezone ('utc'::text, now()),
  account_id uuid null,
  destination_account_id uuid null,
  tag_id uuid null,
  constraint transactions_pkey primary key (id),
  constraint transactions_id_base44_key unique (id_base44),
  constraint transactions_destination_account_id_fkey foreign KEY (destination_account_id) references accounts (id) on delete RESTRICT,
  constraint transactions_account_id_fkey foreign KEY (account_id) references accounts (id) on delete RESTRICT,
  constraint transactions_tag_id_fkey foreign KEY (tag_id) references tags (id) on delete set null,
  constraint transactions_user_id_fkey foreign KEY (user_id) references auth.users (id) on delete CASCADE,
  constraint transactions_transaction_type_check check (
    (
      transaction_type = any (
        array['income'::text, 'expense'::text, 'transfer'::text]
      )
    )
  )
) TABLESPACE pg_default;

create index IF not exists idx_transactions_user_id on public.transactions using btree (user_id) TABLESPACE pg_default;

create index IF not exists idx_transactions_id_base44 on public.transactions using btree (id_base44) TABLESPACE pg_default;

create index IF not exists idx_transactions_transaction_date on public.transactions using btree (transaction_date) TABLESPACE pg_default;

create index IF not exists idx_transactions_account_id on public.transactions using btree (account_id) TABLESPACE pg_default;

create index IF not exists idx_transactions_destination_account_id on public.transactions using btree (destination_account_id) TABLESPACE pg_default;

create index IF not exists idx_transactions_tag_id on public.transactions using btree (tag_id) TABLESPACE pg_default;

create trigger on_transactions_updated BEFORE
update on transactions for EACH row
execute FUNCTION handle_updated_at ();

create trigger transactions_after_delete_update_balance
after DELETE on transactions for EACH row
execute FUNCTION update_account_balances_from_transaction ();

create trigger transactions_after_insert_update_balance
after INSERT on transactions for EACH row
execute FUNCTION update_account_balances_from_transaction ();

create trigger transactions_after_update_update_balance
after
update OF amount,
transaction_type,
account_id,
destination_account_id on transactions for EACH row
execute FUNCTION update_account_balances_from_transaction ();

create table public.exchange_rates (
  id uuid not null default extensions.uuid_generate_v4 (),
  user_id uuid null,
  from_currency text not null,
  to_currency text not null,
  rate numeric not null,
  rate_date date not null,
  is_sample_data boolean null default false,
  created_at timestamp with time zone not null default timezone ('utc'::text, now()),
  updated_at timestamp with time zone not null default timezone ('utc'::text, now()),
  constraint exchange_rates_pkey primary key (id),
  constraint exchange_rates_from_currency_to_currency_rate_date_user_id_key unique (from_currency, to_currency, rate_date, user_id),
  constraint exchange_rates_user_id_fkey foreign KEY (user_id) references auth.users (id) on delete CASCADE
) TABLESPACE pg_default;

create index IF not exists idx_exchange_rates_user_id on public.exchange_rates using btree (user_id) TABLESPACE pg_default;

create index IF not exists idx_exchange_rates_currency_pair_date on public.exchange_rates using btree (from_currency, to_currency, rate_date) TABLESPACE pg_default;

create trigger on_exchange_rates_updated BEFORE
update on exchange_rates for EACH row
execute FUNCTION handle_updated_at ();
